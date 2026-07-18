import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  loadPaperSizingPreviewPolicy,
  readRecentTradeProposalAudits,
  TRADE_PROPOSAL_MCP_AUTHORITY
} from "./gotrader-trade-proposal-core.mjs";

export const PAPER_DEMO_GATEWAY_POLICY_VERSION = "gotrader_paper_demo_gateway_v1";
export const PAPER_DEMO_GATEWAY_AUTHORITY = TRADE_PROPOSAL_MCP_AUTHORITY;
export const PAPER_DEMO_GATEWAY_PROFILE = "ifvg_fresh_retest_v3_research";
export const PAPER_DEMO_EXECUTION_REQUEST_CONTRACT = "gotrader.paper_demo_execution_request";
export const PAPER_DEMO_EXECUTION_REQUEST_VERSION = "1.0";

const DEFAULT_SIGNAL_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_VALIDATION_REPORT = ".gotrader/ifvg-v3-profile-oos.json";
const DEFAULT_FORWARD_REPORT = ".gotrader/ifvg-v3-forward-evidence.json";
const STATE_FILE = ".gotrader/paper-demo-gateway-state.json";
const DEFAULT_OUTBOX_DIR = ".gotrader/paper-demo-outbox";
const DEFAULT_RECEIPT_DIR = ".gotrader/paper-demo-receipts";

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
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
};
const stableJson = (value) => JSON.stringify(stableValue(value));
const sha256 = (value) => createHash("sha256").update(stableJson(value)).digest("hex");

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
    outboxDir: env.GOTRADER_PAPER_DEMO_OUTBOX_DIR || DEFAULT_OUTBOX_DIR,
    receiptDir: env.GOTRADER_PAPER_DEMO_RECEIPT_DIR || DEFAULT_RECEIPT_DIR,
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
    sourceProvider: proposal.sourceProvider,
    sourceFingerprint: proposal.sourceFingerprint,
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

export const buildPaperDemoExecutionRequest = ({
  now = new Date().toISOString(),
  policy,
  preparation
}) => {
  if (!preparation || preparation.paperOnly !== true || preparation.executable !== false) {
    throw new Error("A valid paper-only preparation is required before creating a gateway request.");
  }
  if (!authorityIsNone(preparation.authority)) {
    throw new Error("Paper-Demo request authority must remain none/none/none.");
  }
  const requestCreatedAt = preparation.preparedAt ?? now;
  const createdMs = Date.parse(requestCreatedAt);
  if (!Number.isFinite(createdMs)) throw new Error("Paper-Demo request timestamp is invalid.");
  const request = {
    contract: PAPER_DEMO_EXECUTION_REQUEST_CONTRACT,
    version: PAPER_DEMO_EXECUTION_REQUEST_VERSION,
    requestId: preparation.preparationId,
    proposalId: preparation.proposalId,
    validationChainId: preparation.validationChainId,
    createdAt: requestCreatedAt,
    entryExpiresAt: preparation.expiresAt,
    monitorUntil: new Date(createdMs + 7 * 24 * 60 * 60 * 1000).toISOString(),
    mode: "paper_simulation",
    status: "ready_for_paper_gateway",
    strategyProfileId: preparation.strategyProfileId,
    source: {
      provider: preparation.sourceProvider,
      requestedSymbol: preparation.requestedSymbol,
      brokerSymbol: preparation.brokerSymbol,
      timeframe: preparation.timeframe,
      fingerprint: preparation.sourceFingerprint
    },
    scenario: {
      direction: preparation.direction,
      instructionType: "limit_entry",
      entry: preparation.entry,
      stop: preparation.stop,
      targets: preparation.targets,
      paperUnits: preparation.paperUnitsPreview
    },
    riskPolicy: {
      maximumDailyLossR: policy.maxDailyLossR,
      maximumRequestsPerDay: policy.maxPreparationsPerDay,
      maximumLossPerScenarioR: 1
    },
    permissions: {
      paperSimulationAllowed: true,
      brokerSubmissionAllowed: false,
      liveExecutionAllowed: false,
      autoApplyAllowed: false,
      readinessPromotionAllowed: false
    },
    safety: {
      compactPayloadOnly: true,
      rawCandlesIncluded: false,
      credentialsIncluded: false,
      brokerMutationAllowed: false
    },
    authority: PAPER_DEMO_GATEWAY_AUTHORITY
  };
  return { ...request, requestHash: sha256(request) };
};

export const verifyPaperDemoExecutionRequestHash = (request) => {
  if (!request || typeof request !== "object" || !request.requestHash) return false;
  const { requestHash, ...payload } = request;
  return requestHash === sha256(payload);
};

const assertCompactPaperArtifact = (artifact, label) => {
  const serialized = JSON.stringify(artifact);
  if (/"(?:candles|rawCandles|account|accounts|orders|positions|apiKey|password|secret|token)"\s*:/i.test(serialized)) {
    throw new Error(`${label} rejected unsafe fields.`);
  }
  if (!authorityIsNone(artifact?.authority)) {
    throw new Error(`${label} authority must remain none/none/none.`);
  }
};

export const writePaperDemoExecutionRequest = async (
  request,
  { outboxDir = DEFAULT_OUTBOX_DIR, repoRoot = process.cwd() } = {}
) => {
  assertCompactPaperArtifact(request, "Paper-Demo execution request");
  if (!verifyPaperDemoExecutionRequestHash(request)) {
    throw new Error("Paper-Demo execution request hash validation failed.");
  }
  const directory = resolveInsideRepo(repoRoot, outboxDir);
  const filePath = path.join(directory, `${request.requestId}.json`);
  await mkdir(directory, { recursive: true });
  const existing = await readJsonFile(filePath);
  if (existing) {
    if (existing.requestHash !== request.requestHash || !verifyPaperDemoExecutionRequestHash(existing)) {
      throw new Error("Paper-Demo outbox request ID already exists with different content.");
    }
    return { filePath, status: "already_queued" };
  }
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(request, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
  return { filePath, status: "queued" };
};

const listJsonFiles = async (directory) => {
  try {
    return (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

export const readRecentPaperDemoReceipts = async (
  { limit = 20, receiptDir = DEFAULT_RECEIPT_DIR, repoRoot = process.cwd() } = {}
) => {
  const directory = resolveInsideRepo(repoRoot, receiptDir);
  const files = (await listJsonFiles(directory)).slice(-Math.max(1, Math.min(20, limit))).reverse();
  const receipts = [];
  for (const name of files) {
    const receipt = await readJsonFile(path.join(directory, name));
    if (!receipt || !authorityIsNone(receipt.authority)) continue;
    assertCompactPaperArtifact(receipt, "Paper-Demo receipt");
    receipts.push(receipt);
  }
  return receipts;
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
  if (result.status === "prepared_for_local_paper_simulation_review" || result.status === "already_prepared") {
    const request = buildPaperDemoExecutionRequest({ now, policy, preparation: result.preparation });
    const queued = await writePaperDemoExecutionRequest(request, {
      outboxDir: policy.outboxDir,
      repoRoot
    });
    return {
      ...result,
      gatewayRequest: {
        requestId: request.requestId,
        requestHash: request.requestHash,
        status: queued.status,
        paperOnly: true,
        brokerSubmissionAllowed: false
      },
      nextAction: "The immutable paper-only request is queued for independent simulation and monitoring. No broker submission was made."
    };
  }
  return result;
};

export const buildPaperDemoGatewayStatus = async ({ env = process.env, repoRoot = process.cwd() } = {}) => {
  const policy = loadPaperDemoGatewayPolicy(env);
  const validationReport = await readJsonFile(resolveInsideRepo(repoRoot, policy.validationReportPath));
  const forwardReport = await readJsonFile(resolveInsideRepo(repoRoot, policy.forwardEvidenceReportPath));
  const outboxCount = (await listJsonFiles(resolveInsideRepo(repoRoot, policy.outboxDir))).length;
  const receiptCount = (await listJsonFiles(resolveInsideRepo(repoRoot, policy.receiptDir))).length;
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
    paperGateway: {
      status: policy.enabled ? "operator_enabled" : "disabled",
      immutableOutboxSupported: true,
      simulationSupported: true,
      monitoringSupported: true,
      queuedRequestCount: outboxCount,
      receiptCount
    },
    liveExecutionAllowed: false,
    llmMayOverridePolicy: false,
    authority: PAPER_DEMO_GATEWAY_AUTHORITY
  };
};
