import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  loadPaperSizingPreviewPolicy,
  readRecentTradeProposalAudits,
  TRADE_PROPOSAL_MCP_AUTHORITY
} from "./gotrader-trade-proposal-core.mjs";

export const PAPER_DEMO_GATEWAY_POLICY_VERSION = "gotrader_paper_demo_gateway_v1";
export const PAPER_DEMO_GATEWAY_AUTHORITY = TRADE_PROPOSAL_MCP_AUTHORITY;
export const PAPER_DEMO_GATEWAY_PROFILE = "ifvg_fresh_retest_v3_research";

const DEFAULT_SIGNAL_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_VALIDATION_REPORT = ".gotrader/ifvg-v3-profile-oos.json";
const DEFAULT_FORWARD_REPORT = ".gotrader/ifvg-v3-forward-evidence.json";
const STATE_FILE = ".gotrader/paper-demo-gateway-state.json";

const finitePositive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const unique = (values) => [...new Set(values.filter(Boolean))];
const compactToken = (value) => String(value ?? "").trim();
const normalizeStatus = (value) => compactToken(value).toLowerCase().replace(/[\s-]+/g, "_");
const today = (timestamp) => timestamp.slice(0, 10);
const createId = (prefix, now) => `${prefix}_${now.replace(/[^0-9a-z]/gi, "")}`;

const emptyState = (now) => ({
  policyVersion: PAPER_DEMO_GATEWAY_POLICY_VERSION,
  date: today(now),
  dailyRealizedR: 0,
  preparations: [],
  authority: PAPER_DEMO_GATEWAY_AUTHORITY
});

const safeJson = (text) => JSON.parse(text.replace(/^\uFEFF/, ""));

const resolveInsideRepo = (repoRoot, candidatePath) => {
  const resolved = path.resolve(repoRoot, candidatePath);
  const root = `${path.resolve(repoRoot)}${path.sep}`;
  if (resolved !== path.resolve(repoRoot) && !resolved.startsWith(root)) {
    throw new Error("Paper-Demo gateway path escaped the repository root.");
  }
  return resolved;
};

const readJsonFile = async (filePath) => {
  try {
    return safeJson(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
};

export const loadPaperDemoGatewayPolicy = (env = process.env) => {
  const maxDailyLossR = Number(env.GOTRADER_PAPER_MAX_DAILY_LOSS_R || 0);
  const maxPreparationsPerDay = Math.floor(Number(env.GOTRADER_PAPER_MAX_REQUESTS_PER_DAY || 0));
  const signalMaxAgeMs = Math.max(
    1_000,
    Math.floor(Number(env.GOTRADER_PAPER_SIGNAL_MAX_AGE_MS || DEFAULT_SIGNAL_MAX_AGE_MS))
  );
  return {
    enabled: env.GOTRADER_PAPER_DEMO_GATEWAY_ENABLED === "true",
    killSwitchActive: env.GOTRADER_PAPER_DEMO_KILL_SWITCH !== "false",
    maxDailyLossR: finitePositive(maxDailyLossR) ? maxDailyLossR : 0,
    maxPreparationsPerDay: Number.isFinite(maxPreparationsPerDay) && maxPreparationsPerDay > 0
      ? maxPreparationsPerDay
      : 0,
    signalMaxAgeMs,
    validationReportPath: env.GOTRADER_PAPER_VALIDATION_REPORT || DEFAULT_VALIDATION_REPORT,
    forwardEvidenceReportPath: env.GOTRADER_PAPER_FORWARD_EVIDENCE_REPORT || DEFAULT_FORWARD_REPORT,
    operatorConfigured: true,
    llmMayOverride: false
  };
};

export const summarizeValidationReport = (report, strategyProfileId = PAPER_DEMO_GATEWAY_PROFILE) => {
  const candidate = report?.candidates?.find((item) => item?.candidateFamily === strategyProfileId);
  const temporal = candidate?.temporalRobustness;
  return {
    available: Boolean(report && candidate),
    reportStatus: report?.status,
    sourceProvider: report?.source?.provider,
    requestedSymbol: report?.source?.requestedSymbol,
    brokerSymbol: report?.source?.brokerSymbol,
    timeframe: report?.source?.timeframe,
    sourceFingerprint: report?.source?.fingerprint,
    strategyProfileId: candidate?.candidateFamily,
    validationReadinessStatus: candidate?.validationReadinessStatus,
    walkForwardVerdict: candidate?.walkForwardVerdict,
    completedTrades: temporal?.summary?.trades,
    uniqueTradingDates: temporal?.summary?.uniqueTradingDates,
    activeRollingWindows: temporal?.rolling?.activeWindows,
    positiveRollingWindows: temporal?.rolling?.positiveWindows,
    monteCarloRobustness: temporal?.monteCarlo?.robustness,
    authority: candidate?.safetyAuthority ?? report?.safetyAuthority ?? report?.source?.safetyAuthority
  };
};

export const summarizeForwardEvidenceReport = (report) => ({
  available: Boolean(report),
  profileId: report?.profileId,
  completedForwardOutcomes: report?.completedForwardOutcomes,
  independentDates: report?.independentDates,
  forwardWindows: report?.forwardWindows,
  reassessmentEligible: report?.reassessmentEligible === true,
  recommendation: report?.recommendation,
  authority: report?.authority
});

const authorityIsNone = (authority) =>
  authority?.executionAuthority === "none" &&
  authority?.brokerAuthority === "none" &&
  authority?.readinessOverrideAuthority === "none";

const sourceIdentityMatches = (proposal, validation) =>
  proposal?.sourceProvider === validation.sourceProvider &&
  proposal?.requestedSymbol === validation.requestedSymbol &&
  proposal?.brokerSymbol === validation.brokerSymbol &&
  proposal?.timeframe === validation.timeframe;

const sizingIsPrepared = (proposalEvaluation) =>
  proposalEvaluation?.sizingPreview?.status === "paper_preview_only" &&
  proposalEvaluation?.sizingPreview?.executable === false &&
  finitePositive(proposalEvaluation?.sizingPreview?.paperUnitsPreview);

const sourceFingerprintIsCanonical = (proposal) =>
  compactToken(proposal?.sourceFingerprint).startsWith(
    `${proposal?.sourceProvider}|${proposal?.requestedSymbol}|${proposal?.brokerSymbol}|${proposal?.timeframe}|`
  );

export const evaluatePaperDemoPreparation = ({
  forwardEvidence,
  now = new Date().toISOString(),
  policy = loadPaperDemoGatewayPolicy(),
  proposalEvaluation,
  state = emptyState(now),
  validationEvidence
}) => {
  const blockers = [];
  const proposal = proposalEvaluation?.compactProposal;
  const nowMs = Date.parse(now);
  const proposalMs = Date.parse(proposalEvaluation?.createdAt ?? "");
  const currentState = state.date === today(now) ? state : emptyState(now);
  const dailyCount = currentState.preparations.length;
  const idempotencyKey = proposalEvaluation?.proposalId
    ? `${proposalEvaluation.proposalId}:${proposal?.validationChainId ?? "missing"}`
    : undefined;
  const existing = idempotencyKey
    ? currentState.preparations.find((item) => item.idempotencyKey === idempotencyKey)
    : undefined;

  if (!policy.enabled) blockers.push("paper_demo_gateway_not_enabled");
  if (policy.killSwitchActive) blockers.push("paper_demo_kill_switch_active");
  if (!finitePositive(policy.maxDailyLossR)) blockers.push("paper_demo_daily_loss_limit_not_configured");
  if (!finitePositive(policy.maxPreparationsPerDay)) blockers.push("paper_demo_daily_request_limit_not_configured");
  if (!proposalEvaluation || proposalEvaluation.status !== "queued_for_deterministic_validation") {
    blockers.push("safe_trade_proposal_required");
  }
  if (!proposalEvaluation?.deterministicChecks?.payloadSafe) blockers.push("proposal_payload_not_safe");
  if (!proposalEvaluation?.deterministicChecks?.geometryValid) blockers.push("proposal_geometry_not_valid");
  if ((proposalEvaluation?.deterministicChecks?.rr ?? 0) < 2) blockers.push("proposal_minimum_rr_not_met");
  if (!sizingIsPrepared(proposalEvaluation)) blockers.push("operator_paper_sizing_not_prepared");
  if (!Number.isFinite(proposalMs) || !Number.isFinite(nowMs) || nowMs - proposalMs > policy.signalMaxAgeMs || nowMs < proposalMs) {
    blockers.push("paper_demo_signal_stale");
  }
  if (!validationEvidence?.available) blockers.push("authoritative_validation_report_missing");
  if (validationEvidence?.reportStatus !== "completed") blockers.push("authoritative_validation_incomplete");
  if (!sourceIdentityMatches(proposal, validationEvidence)) blockers.push("validation_source_identity_mismatch");
  if (!sourceFingerprintIsCanonical(proposal)) blockers.push("proposal_source_fingerprint_not_canonical");
  if (proposal?.strategyProfileId !== validationEvidence?.strategyProfileId) blockers.push("validation_profile_mismatch");
  if (validationEvidence?.walkForwardVerdict !== "passed") blockers.push("walk_forward_not_passed");
  if ((validationEvidence?.completedTrades ?? 0) < 30) blockers.push("validation_trade_sample_insufficient");
  if ((validationEvidence?.uniqueTradingDates ?? 0) < 20) blockers.push("validation_independent_dates_insufficient");
  if ((validationEvidence?.activeRollingWindows ?? 0) < 2) blockers.push("validation_rolling_windows_insufficient");
  if (validationEvidence?.monteCarloRobustness !== "strong") blockers.push("monte_carlo_not_strong");
  if (!authorityIsNone(validationEvidence?.authority)) blockers.push("validation_authority_not_none");
  if (!["paper_demo_candidate", "paper_demo_review_candidate"].includes(normalizeStatus(validationEvidence?.validationReadinessStatus))) {
    blockers.push("paper_demo_readiness_not_granted");
  }
  if (!forwardEvidence?.available) blockers.push("untouched_forward_evidence_missing");
  if (forwardEvidence?.profileId !== proposal?.strategyProfileId) blockers.push("forward_evidence_profile_mismatch");
  if ((forwardEvidence?.completedForwardOutcomes ?? 0) < 40) blockers.push("forward_outcome_sample_insufficient");
  if ((forwardEvidence?.independentDates ?? 0) < 20) blockers.push("forward_independent_dates_insufficient");
  if ((forwardEvidence?.forwardWindows ?? 0) < 2) blockers.push("forward_windows_insufficient");
  if (!forwardEvidence?.reassessmentEligible || forwardEvidence?.recommendation !== "reassess_for_paper_demo") {
    blockers.push("forward_evidence_not_reassessment_eligible");
  }
  if (!authorityIsNone(forwardEvidence?.authority)) blockers.push("forward_evidence_authority_not_none");
  if (currentState.dailyRealizedR <= -Math.abs(policy.maxDailyLossR || 0)) blockers.push("paper_demo_daily_loss_limit_reached");
  if (dailyCount >= policy.maxPreparationsPerDay) blockers.push("paper_demo_daily_request_limit_reached");

  const uniqueBlockers = unique(blockers);
  if (existing) {
    return {
      status: "already_prepared",
      preparation: existing,
      blockers: [],
      nextAction: "Use the existing Paper-Demo preparation; duplicate preparation was ignored.",
      state: currentState,
      brokerSubmissionAttempted: false,
      authority: PAPER_DEMO_GATEWAY_AUTHORITY
    };
  }
  if (uniqueBlockers.length) {
    return {
      status: "blocked",
      blockers: uniqueBlockers,
      nextAction: uniqueBlockers.includes("paper_demo_readiness_not_granted")
        ? "Keep collecting untouched forward outcomes and rerun deterministic readiness review."
        : "Resolve the Paper-Demo gateway blockers before preparing a local simulation review.",
      state: currentState,
      brokerSubmissionAttempted: false,
      authority: PAPER_DEMO_GATEWAY_AUTHORITY
    };
  }

  const preparation = {
    preparationId: createId("paper_demo_preparation", now),
    idempotencyKey,
    proposalId: proposalEvaluation.proposalId,
    validationChainId: proposal.validationChainId,
    preparedAt: now,
    expiresAt: new Date(nowMs + policy.signalMaxAgeMs).toISOString(),
    strategyProfileId: proposal.strategyProfileId,
    requestedSymbol: proposal.requestedSymbol,
    brokerSymbol: proposal.brokerSymbol,
    timeframe: proposal.timeframe,
    direction: proposal.direction,
    entry: proposal.entry,
    stop: proposal.stop,
    targets: proposal.targets,
    paperUnitsPreview: proposalEvaluation.sizingPreview.paperUnitsPreview,
    status: "prepared_for_local_paper_simulation_review",
    paperOnly: true,
    executable: false,
    brokerSubmissionAttempted: false,
    readinessOverrideApplied: false,
    authority: PAPER_DEMO_GATEWAY_AUTHORITY
  };
  const nextState = {
    ...currentState,
    preparations: [preparation, ...currentState.preparations].slice(0, policy.maxPreparationsPerDay),
    authority: PAPER_DEMO_GATEWAY_AUTHORITY
  };
  return {
    status: "prepared_for_local_paper_simulation_review",
    preparation,
    blockers: [],
    nextAction: "Review the prepared paper-only scenario in GoTrader. No broker submission was made.",
    state: nextState,
    brokerSubmissionAttempted: false,
    authority: PAPER_DEMO_GATEWAY_AUTHORITY
  };
};

export const loadPaperDemoGatewayState = async ({ repoRoot = process.cwd(), now = new Date().toISOString() } = {}) => {
  const filePath = resolveInsideRepo(repoRoot, STATE_FILE);
  const state = await readJsonFile(filePath);
  if (!state || state.date !== today(now) || !Array.isArray(state.preparations) || !authorityIsNone(state.authority)) {
    return emptyState(now);
  }
  return state;
};

export const savePaperDemoGatewayState = async (state, { repoRoot = process.cwd() } = {}) => {
  const serialized = JSON.stringify(state);
  if (/"(?:candles|rawCandles|account|accounts|orders|positions|apiKey|password|secret|token)"\s*:/i.test(serialized)) {
    throw new Error("Paper-Demo gateway state rejected unsafe fields.");
  }
  const filePath = resolveInsideRepo(repoRoot, STATE_FILE);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return filePath;
};

export const preparePaperDemoSimulation = async (
  proposalId,
  { env = process.env, now = new Date().toISOString(), repoRoot = process.cwd() } = {}
) => {
  const policy = loadPaperDemoGatewayPolicy(env);
  const proposals = await readRecentTradeProposalAudits({ limit: 20, repoRoot });
  const proposalEvaluation = proposals.find((item) => item.proposalId === proposalId);
  const validationReport = await readJsonFile(resolveInsideRepo(repoRoot, policy.validationReportPath));
  const forwardReport = await readJsonFile(resolveInsideRepo(repoRoot, policy.forwardEvidenceReportPath));
  const state = await loadPaperDemoGatewayState({ repoRoot, now });
  const result = evaluatePaperDemoPreparation({
    forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
    now,
    policy,
    proposalEvaluation,
    state,
    validationEvidence: summarizeValidationReport(validationReport, proposalEvaluation?.compactProposal?.strategyProfileId)
  });
  if (result.status === "prepared_for_local_paper_simulation_review") {
    await savePaperDemoGatewayState(result.state, { repoRoot });
  }
  return result;
};

export const buildPaperDemoGatewayStatus = async ({ env = process.env, repoRoot = process.cwd() } = {}) => {
  const policy = loadPaperDemoGatewayPolicy(env);
  const validationReport = await readJsonFile(resolveInsideRepo(repoRoot, policy.validationReportPath));
  const forwardReport = await readJsonFile(resolveInsideRepo(repoRoot, policy.forwardEvidenceReportPath));
  return {
    provider: "gotrader_local_paper_demo_gateway",
    stage: "paper_simulation_preparation",
    policyVersion: PAPER_DEMO_GATEWAY_POLICY_VERSION,
    enabled: policy.enabled,
    killSwitchActive: policy.killSwitchActive,
    policyConfigured: finitePositive(policy.maxDailyLossR) && finitePositive(policy.maxPreparationsPerDay),
    validationEvidence: summarizeValidationReport(validationReport),
    forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
    brokerGateway: {
      status: "disabled",
      submissionSupported: false,
      monitoringSupported: false
    },
    liveExecutionAllowed: false,
    llmMayOverridePolicy: false,
    authority: PAPER_DEMO_GATEWAY_AUTHORITY
  };
};
