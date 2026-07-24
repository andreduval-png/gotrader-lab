import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { withFileLock } from "./gotrader-file-lock.mjs";
import { findAuthoritativeProfile } from "./gotrader-mcp-context-core.mjs";

export const TRADE_PROPOSAL_MCP_POLICY_VERSION = "gotrader_trade_proposal_mcp_research_v2";
export const TRADE_PROPOSAL_MCP_AUTHORITY = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const TRADE_PROPOSAL_MCP_ALLOWED_PROFILES = Object.freeze([
  "ifvg_fresh_retest_v3_research"
]);

const frozenProfiles = new Set(TRADE_PROPOSAL_MCP_ALLOWED_PROFILES);
const forbiddenKeys = new Set([
  "account",
  "accountbalance",
  "accountdata",
  "apikey",
  "autoapply",
  "brokeraccount",
  "brokermutation",
  "candles",
  "closetrade",
  "closeposition",
  "credentials",
  "executionrequest",
  "execute",
  "importedohlcv",
  "modifyorder",
  "order",
  "orderdata",
  "orderroute",
  "orders",
  "password",
  "placeorder",
  "position",
  "positiondata",
  "positions",
  "rawcandles",
  "rawruntime",
  "rawsnapshot",
  "readinessoverride",
  "screenshot",
  "secret",
  "sellmarket",
  "buymarket",
  "token"
]);
const forbiddenCommandPattern =
  /\b(place|submit|send|modify|cancel|close)\s+(?:an?\s+)?(order|position|trade)\b|\b(buy|sell)\s+(market|now|at)\b|\bapply\s+calibration\b/i;

const compactKey = (value) => String(value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const finiteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const unique = (values) => [...new Set(values.filter(Boolean))];
const round = (value, decimals = 4) => Number(value.toFixed(decimals));
const createId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const looksLikeCandleArray = (value) =>
  Array.isArray(value) &&
  value.some(
    (item) =>
      item &&
      typeof item === "object" &&
      ["open", "high", "low", "close"].filter((field) => finiteNumber(item[field])).length >= 3
  );

export const scanTradeProposalForForbiddenContent = (value, pathPrefix = "proposal") => {
  const blocked = [];
  const visit = (item, itemPath) => {
    if (typeof item === "string") {
      if (forbiddenCommandPattern.test(item)) blocked.push(`${itemPath}:execution_language`);
      if (/^data:(?:image|application)\//i.test(item)) blocked.push(`${itemPath}:embedded_binary`);
      return;
    }
    if (looksLikeCandleArray(item)) blocked.push(`${itemPath}:raw_candle_array`);
    if (Array.isArray(item)) {
      item.slice(0, 25).forEach((entry, index) => visit(entry, `${itemPath}[${index}]`));
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const [key, nested] of Object.entries(item)) {
      const normalized = compactKey(key);
      const childPath = `${itemPath}.${key}`;
      if (forbiddenKeys.has(normalized) || /(?:password|credential|secret|apikey|accesstoken|refreshtoken)/.test(normalized)) {
        blocked.push(`${childPath}:forbidden_field`);
        continue;
      }
      visit(nested, childPath);
    }
  };
  visit(value, pathPrefix);
  return unique(blocked);
};

export const loadPaperSizingPreviewPolicy = (env = process.env) => {
  const riskBudgetUsd = Math.max(0, Number(env.GOTRADER_PAPER_RISK_BUDGET_USD || 0));
  const pointValueUsd = Math.max(0, Number(env.GOTRADER_PAPER_POINT_VALUE_USD || 0));
  const maxUnits = Math.max(0, Math.floor(Number(env.GOTRADER_PAPER_MAX_UNITS || 0)));
  return {
    mode: "paper_preview",
    configured: riskBudgetUsd > 0 && pointValueUsd > 0 && maxUnits > 0,
    riskBudgetUsd,
    pointValueUsd,
    maxUnits,
    operatorConfigured: true,
    llmMayOverride: false
  };
};

const buildPaperSizingPreview = ({ entry, stop, sizingPolicy }) => {
  const riskDistance = finiteNumber(entry) && finiteNumber(stop) ? Math.abs(entry - stop) : 0;
  if (!sizingPolicy.configured || riskDistance <= 0) {
    return {
      status: "blocked_policy_not_configured",
      riskDistance: round(riskDistance),
      paperUnitsPreview: null,
      riskBudgetUsd: null,
      pointValueUsd: null,
      executable: false,
      reason:
        "Paper sizing requires operator-owned GOTRADER_PAPER_RISK_BUDGET_USD, GOTRADER_PAPER_POINT_VALUE_USD, and GOTRADER_PAPER_MAX_UNITS settings."
    };
  }
  const rawUnits = Math.floor(sizingPolicy.riskBudgetUsd / (riskDistance * sizingPolicy.pointValueUsd));
  const paperUnitsPreview = Math.max(0, Math.min(sizingPolicy.maxUnits, rawUnits));
  return {
    status: paperUnitsPreview > 0 ? "paper_preview_only" : "blocked_risk_budget_too_small",
    riskDistance: round(riskDistance),
    paperUnitsPreview: paperUnitsPreview || null,
    riskBudgetUsd: sizingPolicy.riskBudgetUsd,
    pointValueUsd: sizingPolicy.pointValueUsd,
    executable: false,
    reason:
      paperUnitsPreview > 0
        ? "Deterministic paper sizing preview only; no broker submission authority."
        : "Configured paper risk budget does not support one unit at this stop distance."
  };
};

export const evaluateTradeProposal = (
  proposal,
  {
    actor = {},
    authoritativeContext,
    sizingPolicy = loadPaperSizingPreviewPolicy(),
    now = new Date().toISOString()
  } = {}
) => {
  const blockedFields = scanTradeProposalForForbiddenContent(proposal);
  const blockers = [];
  const warnings = [];
  const requestedSymbol = String(proposal?.requestedSymbol || "").trim().toUpperCase();
  const brokerSymbol = String(proposal?.brokerSymbol || "").trim().toUpperCase();
  const timeframe = String(proposal?.timeframe || "").trim().toLowerCase();
  const strategyProfileId = String(proposal?.strategyProfileId || "").trim();
  const claimedSourceProvider = String(proposal?.sourceProvider || "").trim();
  const claimedSourceFingerprint = String(proposal?.sourceFingerprint || "").trim();
  const claimedValidationChainId = String(proposal?.validationChainId || "").trim();
  const direction = proposal?.direction;
  const entry = proposal?.entry;
  const stop = proposal?.stop;
  const targets = Array.isArray(proposal?.targets) ? proposal.targets.filter(finiteNumber).slice(0, 4) : [];

  if (blockedFields.length) blockers.push("unsafe_or_forbidden_payload");
  if (proposal?.authority) {
    for (const [key, expected] of Object.entries(TRADE_PROPOSAL_MCP_AUTHORITY)) {
      if (proposal.authority[key] !== undefined && proposal.authority[key] !== expected) {
        blockers.push(`${key}_must_be_none`);
      }
    }
  }
  if (proposal?.autoApplyAllowed === true) blockers.push("auto_apply_not_allowed");
  if (!TRADE_PROPOSAL_MCP_ALLOWED_PROFILES.includes(strategyProfileId)) blockers.push("strategy_profile_not_allowlisted");
  const authoritativeProfile = findAuthoritativeProfile(authoritativeContext, strategyProfileId);
  const authoritativeSource = authoritativeContext?.source;
  if (authoritativeContext?.status !== "available") blockers.push("authoritative_context_required");
  if (!authoritativeProfile) blockers.push("authoritative_profile_evidence_required");
  if (authoritativeProfile?.evidenceStatus !== "authoritative_compact_evidence") {
    blockers.push("authoritative_profile_evidence_blocked");
  }
  if (authoritativeSource?.provider !== "mt5_read_only") blockers.push("canonical_mt5_source_required");
  if (
    !authoritativeSource?.fingerprint ||
    authoritativeProfile?.sourceFingerprint !== authoritativeSource.fingerprint
  ) {
    blockers.push("authoritative_source_fingerprint_required");
  }
  if (
    !(
      requestedSymbol === authoritativeSource?.requestedSymbol &&
      brokerSymbol === authoritativeSource?.brokerSymbol
    )
  ) {
    blockers.push("authoritative_symbol_identity_mismatch");
  }
  if (timeframe !== authoritativeSource?.timeframe) blockers.push("authoritative_timeframe_mismatch");
  if (claimedSourceProvider && claimedSourceProvider !== authoritativeSource?.provider) {
    blockers.push("claimed_source_provider_mismatch");
  }
  if (claimedSourceFingerprint && claimedSourceFingerprint !== authoritativeSource?.fingerprint) {
    blockers.push("claimed_source_fingerprint_mismatch");
  }
  if (
    claimedValidationChainId &&
    claimedValidationChainId !== authoritativeProfile?.validationChainId
  ) {
    blockers.push("claimed_validation_chain_mismatch");
  }
  if (direction !== "long" && direction !== "short") blockers.push("direction_must_be_long_or_short");
  if (!finiteNumber(entry)) blockers.push("entry_required");
  if (!finiteNumber(stop)) blockers.push("stop_required");
  if (!targets.length) blockers.push("target_required");

  let riskDistance = null;
  let rewardDistance = null;
  let rr = null;
  if (finiteNumber(entry) && finiteNumber(stop) && targets.length && (direction === "long" || direction === "short")) {
    const target = targets[0];
    const geometryValid = direction === "long" ? stop < entry && entry < target : stop > entry && entry > target;
    if (!geometryValid) blockers.push("invalid_price_order");
    riskDistance = Math.abs(entry - stop);
    rewardDistance = Math.abs(target - entry);
    rr = riskDistance > 0 ? rewardDistance / riskDistance : null;
    if (!finiteNumber(rr) || rr < 2) blockers.push("minimum_rr_not_met");
  }

  if (frozenProfiles.has(strategyProfileId)) {
    warnings.push("Frozen profile parameters cannot be mutated; changes require a new candidate profile version.");
  }
  if (authoritativeProfile) {
    warnings.push("Validation and source identities were resolved from GoTrader-owned compact evidence.");
  }

  const uniqueBlockers = unique(blockers);
  const safeDraft = uniqueBlockers.length === 0;
  const sizingPreview = buildPaperSizingPreview({ entry, stop, sizingPolicy });
  const proposalId = createId("mcp_trade_proposal");
  const sourceProvider = authoritativeSource?.provider ?? claimedSourceProvider;
  const sourceFingerprint = authoritativeSource?.fingerprint ?? claimedSourceFingerprint;
  const validationChainId =
    authoritativeProfile?.validationChainId ?? claimedValidationChainId;
  return {
    proposalId,
    createdAt: now,
    policyVersion: TRADE_PROPOSAL_MCP_POLICY_VERSION,
    audit: {
      agentId: String(actor.agentId || "local_stdio_agent").slice(0, 80),
      sessionId: String(actor.sessionId || "unattributed_session").slice(0, 120),
      correlationId: String(actor.correlationId || proposalId).slice(0, 120),
      transport: "stdio"
    },
    status: safeDraft ? "queued_for_deterministic_validation" : "blocked",
    compactProposal: {
      requestedSymbol,
      brokerSymbol,
      timeframe,
      strategyProfileId,
      direction: direction === "long" || direction === "short" ? direction : "invalid",
      entry: finiteNumber(entry) ? entry : null,
      stop: finiteNumber(stop) ? stop : null,
      targets,
      sourceProvider,
      sourceFingerprint: sourceFingerprint || null,
      validationChainId: validationChainId || null
      },
      deterministicChecks: {
        payloadSafe: blockedFields.length === 0,
      sourceIdentityValid:
        sourceProvider === "mt5_read_only" &&
        requestedSymbol === authoritativeSource?.requestedSymbol &&
        brokerSymbol === authoritativeSource?.brokerSymbol &&
        timeframe === authoritativeSource?.timeframe &&
        sourceFingerprint === authoritativeSource?.fingerprint,
      profileAllowlisted: TRADE_PROPOSAL_MCP_ALLOWED_PROFILES.includes(strategyProfileId),
      geometryValid: !uniqueBlockers.includes("invalid_price_order"),
      rr: finiteNumber(rr) ? round(rr) : null,
      minimumRr: 2,
      validationContext: safeDraft ? "authoritative_match" : "blocked"
    },
    sizingPreview,
    blockedFields,
    blockers: uniqueBlockers,
    warnings,
    nextAction: safeDraft
      ? "The compact proposal is identity-bound and queued for deterministic GoTrader validation. No broker request was created."
      : "Correct the compact proposal and resubmit it for deterministic validation.",
    brokerGateway: {
      status: "disabled",
      submissionAttempted: false,
      monitoringStatus: "not_started"
    },
    autoApplyAllowed: false,
    profileMutationAllowed: false,
    paperDemoPromotionAllowed: false,
    liveExecutionAllowed: false,
    authority: TRADE_PROPOSAL_MCP_AUTHORITY
  };
};

export const appendTradeProposalAudit = async (evaluation, { repoRoot = process.cwd() } = {}) => {
  const runtimeDir = path.join(repoRoot, ".gotrader");
  const ledgerPath = path.join(runtimeDir, "mcp-trade-proposals.jsonl");
  const lockPath = path.join(runtimeDir, "locks", "mcp-trade-proposals.lock");
  await mkdir(runtimeDir, { recursive: true });
  await withFileLock(lockPath, () =>
    appendFile(ledgerPath, `${JSON.stringify(evaluation)}\n`, "utf8")
  );
  return ledgerPath;
};

export const readRecentTradeProposalAudits = async ({ limit = 10, repoRoot = process.cwd() } = {}) => {
  const ledgerPath = path.join(repoRoot, ".gotrader", "mcp-trade-proposals.jsonl");
  try {
    const content = await readFile(ledgerPath, "utf8");
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-Math.max(1, Math.min(20, limit)))
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

export const buildTradeProposalControlPlaneStatus = ({
  authoritativeContext,
  sizingPolicy = loadPaperSizingPreviewPolicy()
} = {}) => ({
  provider: "gotrader_trade_proposal_mcp",
  stage: "research_validation",
  policyVersion: TRADE_PROPOSAL_MCP_POLICY_VERSION,
  allowedProfiles: TRADE_PROPOSAL_MCP_ALLOWED_PROFILES,
  llmRole: ["propose", "initiate_deterministic_validation"],
  goTraderRole: ["validate_source_identity", "validate_geometry", "validate_rr", "preview_operator_owned_paper_sizing"],
  brokerGatewayRole: [
    "independent_mt5_demo_gateway",
    "disabled_by_default",
    "no_direct_mcp_submission",
    "compact_receipts_only",
    "live_accounts_blocked"
  ],
  sizingPolicy: {
    configured: sizingPolicy.configured,
    mode: sizingPolicy.mode,
    llmMayOverride: false
  },
  authoritativeContext: {
    status: authoritativeContext?.status ?? "unavailable",
    sourceFingerprintBound: Boolean(authoritativeContext?.source?.fingerprint),
    validationIdentityBound: Boolean(authoritativeContext?.profiles?.some((profile) => profile.validationChainId)),
    blockers: authoritativeContext?.blockers ?? ["authoritative_context_not_loaded"]
  },
  forbiddenCapabilities: [
    "account_access",
    "order_access",
    "position_access",
    "broker_mutation",
    "readiness_override",
    "auto_apply",
    "live_execution"
  ],
  authority: TRADE_PROPOSAL_MCP_AUTHORITY
});
