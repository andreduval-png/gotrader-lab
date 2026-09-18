import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildMt5DemoExecutionRequest,
  buildPaperDemoExecutionRequest,
  buildPaperDemoGatewayStatus,
  evaluatePaperDemoPreparation,
  loadPaperDemoGatewayPolicy,
  preparePaperDemoSimulation,
  readRecentMt5DemoReceipts,
  readRecentPaperDemoReceipts,
  summarizeForwardEvidenceReport,
  summarizeValidationReport,
  verifyPaperDemoExecutionRequestHash,
  verifyMt5DemoExecutionRequestHash,
  writeMt5DemoExecutionRequest,
  writePaperDemoExecutionRequest
} from "./gotrader-paper-demo-gateway-core.mjs";
import { evaluateCanonicalTradeProposal, persistRuntimeMirror } from "./gotrader-research-mcp-core.mjs";
import {
  buildRiskEvaluationRequest,
  buildSimulationAccountSnapshot,
  createInitialSimulationAccountRiskState,
  evaluateSimulationAccountRisk,
  loadSimulationAccountRiskPolicy,
  refreshSimulationAccountHeartbeat
} from "./gotrader-account-risk-core.mjs";

const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const now = "2026-07-18T14:00:00.000Z";
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "gotrader-paper-demo-gateway-"));
const activeProfile = {
  profileId: "ifvg_fresh_retest_v3_research", profileVersion: "v3",
  parameterFingerprint: "test-frozen-v3", sourceFingerprint: "mt5_read_only|mt5_read_only:MNQ:USTECH:5m|MNQ|5m|1000|start|1|end|2",
  validationIdentity: "validation_ifvg_v3_current", sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m"
};
const mirror = {
  schemaVersion: 1, capturedAt: now, activeProfile,
  validation: { status: "available", identityStatus: "matched", evidenceId: activeProfile.validationIdentity },
  readiness: { state: "ready" },
  certifiedEvidence: { entries: [{
    evidenceId: activeProfile.validationIdentity, ledgerEntryId: "test-ledger",
    category: "validation results", certificationStatus: "identity_matched",
    profileId: activeProfile.profileId, profileVersion: activeProfile.profileVersion,
    parameterFingerprint: activeProfile.parameterFingerprint, sourceFingerprint: activeProfile.sourceFingerprint,
    validationIdentity: activeProfile.validationIdentity
  }] }, authority: authorityNone
};
await persistRuntimeMirror(mirror, { repoRoot: tempRoot, nowMs: Date.parse(now) });
const proposal = await evaluateCanonicalTradeProposal(
  {
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    strategyProfileId: "ifvg_fresh_retest_v3_research",
    strategyProfileVersion: "v3",
    parameterFingerprint: activeProfile.parameterFingerprint,
    direction: "short",
    entry: 28570,
    stop: 28600,
    targets: [28510],
    sourceProvider: "mt5_read_only",
    sourceFingerprint: activeProfile.sourceFingerprint,
    validationChainId: "validation_ifvg_v3_current",
    autoApplyAllowed: false,
    authority: authorityNone
  },
  {
    nowMs: Date.parse(now), repoRoot: tempRoot
  }
);
const validationReport = {
  status: "completed",
  source: {
    provider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    fingerprint: "mt5_read_only|MNQ|USTECH|5m|34989|start|1|end|2",
    safetyAuthority: authorityNone
  },
  candidates: [
    {
      candidateFamily: "ifvg_fresh_retest_v3_research",
      validationReadinessStatus: "paper_demo_candidate",
      walkForwardVerdict: "passed",
      temporalRobustness: {
        summary: { trades: 172, uniqueTradingDates: 95 },
        rolling: { activeWindows: 11, positiveWindows: 11 },
        monteCarlo: { robustness: "strong" }
      },
      safetyAuthority: authorityNone
    }
  ],
  safetyAuthority: authorityNone
};
const forwardReport = {
  profileId: "ifvg_fresh_retest_v3_research",
  completedForwardOutcomes: 40,
  independentDates: 20,
  forwardWindows: 2,
  reassessmentEligible: true,
  recommendation: "reassess_for_paper_demo",
  authority: authorityNone
};
const enabledPolicy = {
  simulationRiskUsd: 300,
  enabled: true,
  killSwitchActive: false,
  maxDailyLossR: 4,
  maxPreparationsPerDay: 3,
  signalMaxAgeMs: 300_000,
  validationReportPath: ".gotrader/validation.json",
  forwardEvidenceReportPath: ".gotrader/forward.json",
  operatorConfigured: true,
  llmMayOverride: false
};
const emptyState = {
  policyVersion: "gotrader_paper_demo_gateway_v1",
  date: "2026-07-18",
  dailyRealizedR: 0,
  preparations: [],
  authority: authorityNone
};
const accountRiskEnv = {
  GOTRADER_SIM_RISK_GOVERNOR_ENABLED: "true",
  GOTRADER_SIM_RISK_KILL_SWITCH: "false",
  GOTRADER_SIM_ACCOUNT_ID: "paper-demo-test",
  GOTRADER_SIM_STARTING_EQUITY_USD: "50000",
  GOTRADER_SIM_MAX_DAILY_LOSS_USD: "4000",
  GOTRADER_SIM_MAX_OPEN_RISK_USD: "1000",
  GOTRADER_SIM_MAX_RISK_PER_SCENARIO_USD: "300",
  GOTRADER_SIM_MAX_CONCURRENT_INTENTS: "3",
  GOTRADER_SIM_POINT_VALUE_USD: "2",
  GOTRADER_SIM_VOLUME_MIN: "1",
  GOTRADER_SIM_VOLUME_MAX: "5",
  GOTRADER_SIM_VOLUME_STEP: "1"
};
const accountRiskPolicy = loadSimulationAccountRiskPolicy(accountRiskEnv);
const accountRiskState = refreshSimulationAccountHeartbeat(
  createInitialSimulationAccountRiskState(accountRiskPolicy, "2026-07-18T14:03:00.000Z"),
  accountRiskPolicy,
  "2026-07-18T14:03:00.000Z"
);
const accountRiskRequest = buildRiskEvaluationRequest({
  now: "2026-07-18T14:03:00.000Z",
  proposalEvaluation: proposal,
  requestedRiskUsd: enabledPolicy.simulationRiskUsd
});
const accountRiskEvaluation = evaluateSimulationAccountRisk({
  now: "2026-07-18T14:03:00.000Z",
  policy: accountRiskPolicy,
  request: accountRiskRequest,
  snapshot: buildSimulationAccountSnapshot(accountRiskState, "2026-07-18T14:03:00.000Z")
});
assert.equal(accountRiskEvaluation.status, "approved_for_simulation");

const prepared = evaluatePaperDemoPreparation({
  accountRiskEvaluation,
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert.equal(prepared.status, "prepared_for_local_paper_simulation_review");
assert.equal(prepared.brokerSubmissionAttempted, false);
assert.equal(prepared.preparation.executable, false);
assert.equal(prepared.preparation.paperOnly, true);
assert.equal(prepared.preparation.riskBudgetUsd, 300);
assert.deepEqual(prepared.authority, authorityNone);

for (const patch of [
  { proposalEvaluation: { ...proposal, status: "queued_for_deterministic_validation" } },
  { proposalEvaluation: { ...proposal, executable: true } },
  { proposalEvaluation: { ...proposal, compactProposal: { ...proposal.compactProposal, entry: 28571 } } },
  { policy: { ...enabledPolicy, simulationRiskUsd: 0 } },
  { policy: { ...enabledPolicy, simulationRiskUsd: 1 } },
  { accountRiskEvaluation: { ...accountRiskEvaluation, requestId: "another-proposal" } },
  { accountRiskEvaluation: undefined }
]) {
  const denied = evaluatePaperDemoPreparation({
    accountRiskEvaluation, proposalEvaluation: proposal,
    validationEvidence: summarizeValidationReport(validationReport), forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
    policy: enabledPolicy, state: emptyState, now: "2026-07-18T14:03:00.000Z", ...patch
  });
  assert.equal(denied.status, "blocked");
  assert.equal(denied.brokerSubmissionAttempted, false);
}

const duplicate = evaluatePaperDemoPreparation({
  accountRiskEvaluation,
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: prepared.state,
  now: "2026-07-18T14:03:01.000Z"
});
assert.equal(duplicate.status, "already_prepared");
assert.equal(duplicate.state.preparations.length, 1);

const duplicateAfterRiskLock = evaluatePaperDemoPreparation({
  accountRiskEvaluation: {
    ...accountRiskEvaluation,
    status: "blocked",
    riskState: "locked",
    blockers: ["simulation_daily_loss_limit_reached"]
  },
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: prepared.state,
  now: "2026-07-18T14:03:01.000Z"
});
assert.equal(duplicateAfterRiskLock.status, "blocked");
assert(duplicateAfterRiskLock.blockers.includes("account_risk:simulation_daily_loss_limit_reached"));

const disabled = evaluatePaperDemoPreparation({
  accountRiskEvaluation,
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: { ...enabledPolicy, enabled: false },
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert(disabled.blockers.includes("paper_demo_gateway_not_enabled"));

const killed = evaluatePaperDemoPreparation({
  accountRiskEvaluation,
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: { ...enabledPolicy, killSwitchActive: true },
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert(killed.blockers.includes("paper_demo_kill_switch_active"));

const stale = evaluatePaperDemoPreparation({
  accountRiskEvaluation,
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: emptyState,
  now: "2026-07-18T14:06:00.000Z"
});
assert(stale.blockers.includes("paper_demo_signal_stale"));

const notReady = evaluatePaperDemoPreparation({
  accountRiskEvaluation,
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport({
    ...validationReport,
    candidates: validationReport.candidates.map((candidate) => ({
      ...candidate,
      validationReadinessStatus: "not_ready"
    }))
  }),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert(notReady.blockers.includes("paper_demo_readiness_not_granted"));

const nonCanonicalFingerprint = evaluatePaperDemoPreparation({
  accountRiskEvaluation,
  proposalEvaluation: {
    ...proposal,
    compactProposal: { ...proposal.compactProposal, sourceFingerprint: "opaque_unverified_fingerprint" }
  },
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert(nonCanonicalFingerprint.blockers.includes("proposal_identity_hash_mismatch"));

const noForward = evaluatePaperDemoPreparation({
  accountRiskEvaluation,
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(undefined),
  policy: enabledPolicy,
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert(noForward.blockers.includes("untouched_forward_evidence_missing"));

const lossLocked = evaluatePaperDemoPreparation({
  accountRiskEvaluation,
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: { ...emptyState, dailyRealizedR: -4 },
  now: "2026-07-18T14:03:00.000Z"
});
assert(lossLocked.blockers.includes("paper_demo_daily_loss_limit_reached"));

const accountRiskBlocked = evaluatePaperDemoPreparation({
  accountRiskEvaluation: {
    ...accountRiskEvaluation,
    status: "blocked",
    blockers: ["projected_open_risk_limit_exceeded"]
  },
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert(accountRiskBlocked.blockers.includes("account_risk_governor_not_approved"));
assert(accountRiskBlocked.blockers.includes("account_risk:projected_open_risk_limit_exceeded"));

await mkdir(path.join(tempRoot, ".gotrader"), { recursive: true });
await writeFile(path.join(tempRoot, ".gotrader", "validation.json"), JSON.stringify(validationReport), "utf8");
await writeFile(path.join(tempRoot, ".gotrader", "forward.json"), JSON.stringify(forwardReport), "utf8");
const env = {
  GOTRADER_PAPER_SIMULATION_RISK_USD: "300",
  ...accountRiskEnv,
  GOTRADER_PAPER_DEMO_GATEWAY_ENABLED: "true",
  GOTRADER_PAPER_DEMO_KILL_SWITCH: "false",
  GOTRADER_PAPER_MAX_DAILY_LOSS_R: "4",
  GOTRADER_PAPER_MAX_REQUESTS_PER_DAY: "3",
  GOTRADER_PAPER_SIGNAL_MAX_AGE_MS: "300000",
  GOTRADER_PAPER_VALIDATION_REPORT: ".gotrader/validation.json",
  GOTRADER_PAPER_FORWARD_EVIDENCE_REPORT: ".gotrader/forward.json"
};
const integrated = await preparePaperDemoSimulation(proposal.proposalId, {
  env,
  now: "2026-07-18T14:03:00.000Z",
  repoRoot: tempRoot
});
assert.equal(integrated.status, "prepared_for_local_paper_simulation_review");
assert.equal(integrated.gatewayRequest.status, "queued");
assert.equal(integrated.gatewayRequest.brokerSubmissionAllowed, false);
assert.equal(integrated.accountRisk.decision.status, "approved_for_simulation");
assert.equal(integrated.accountRisk.acknowledgement.status, "simulation_risk_reserved");
assert.equal(integrated.mt5DemoRequest.status, "disabled");
assert.equal(integrated.mt5DemoRequest.liveExecutionAllowed, false);
const persisted = JSON.parse(await readFile(path.join(tempRoot, ".gotrader", "paper-demo-gateway-state.json"), "utf8"));
assert.equal(persisted.preparations.length, 1);
assert.equal(persisted.preparations[0].brokerSubmissionAttempted, false);
const persistedRisk = JSON.parse(
  await readFile(path.join(tempRoot, ".gotrader", "simulation-account-risk-state.json"), "utf8")
);
assert.equal(persistedRisk.activeReservations.length, 1);
assert.equal(persistedRisk.openRiskUsd, 300);
const riskLedger = await readFile(
  path.join(tempRoot, ".gotrader", "simulation-account-risk-ledger.jsonl"),
  "utf8"
);
assert.equal(riskLedger.trim().split(/\r?\n/).length, 1);
assert(!/"(?:candles|rawCandles)"\s*:/.test(riskLedger));

await mkdir(path.join(tempRoot, ".gotrader", "paper-demo-risk-transaction.lock"));
const concurrentBlocked = await preparePaperDemoSimulation(proposal.proposalId, {
  env,
  now: "2026-07-18T14:03:00.500Z",
  repoRoot: tempRoot
});
assert.equal(concurrentBlocked.status, "blocked");
assert(concurrentBlocked.blockers.includes("account_risk_transaction_already_in_progress"));
const riskStateAfterConcurrentBlock = JSON.parse(
  await readFile(path.join(tempRoot, ".gotrader", "simulation-account-risk-state.json"), "utf8")
);
assert.equal(riskStateAfterConcurrentBlock.activeReservations.length, 1);
await rm(path.join(tempRoot, ".gotrader", "paper-demo-risk-transaction.lock"), { recursive: true, force: true });
const queuedRequest = JSON.parse(
  await readFile(
    path.join(tempRoot, ".gotrader", "paper-demo-outbox", `${integrated.gatewayRequest.requestId}.json`),
    "utf8"
  )
);
assert.equal(queuedRequest.contract, "gotrader.paper_demo_execution_request");
assert.equal(queuedRequest.mode, "paper_simulation");
assert.equal(queuedRequest.permissions.paperSimulationAllowed, true);
assert.equal(queuedRequest.permissions.brokerSubmissionAllowed, false);
assert.equal(queuedRequest.permissions.liveExecutionAllowed, false);
assert.equal(queuedRequest.safety.rawCandlesIncluded, false);
assert.equal(queuedRequest.riskPolicy.approvedRiskUsd, 300);
assert.equal(queuedRequest.riskPolicy.mt5BrokerRevalidationRequired, true);
assert.equal(verifyPaperDemoExecutionRequestHash(queuedRequest), true);
assert.deepEqual(queuedRequest.authority, authorityNone);

const mt5EnabledEnv = {
  ...env,
  GOTRADER_MT5_DEMO_HANDOFF_ENABLED: "true",
  GOTRADER_MT5_DEMO_HANDOFF_KILL_SWITCH: "false",
  GOTRADER_MT5_DEMO_HANDOFF_MAX_RISK_USD: "25"
};
const mt5Integrated = await preparePaperDemoSimulation(proposal.proposalId, {
  env: mt5EnabledEnv,
  now: "2026-07-18T14:03:02.000Z",
  repoRoot: tempRoot
});
assert.equal(mt5Integrated.status, "already_prepared");
assert.equal(mt5Integrated.mt5DemoRequest.status, "queued");
assert.equal(mt5Integrated.mt5DemoRequest.demoSubmissionAllowed, true);
assert.equal(mt5Integrated.mt5DemoRequest.liveExecutionAllowed, false);
const mt5QueuedRequest = JSON.parse(
  await readFile(
    path.join(tempRoot, ".gotrader", "mt5-demo-outbox", `${mt5Integrated.mt5DemoRequest.requestId}.json`),
    "utf8"
  )
);
assert.equal(mt5QueuedRequest.contract, "gotrader.mt5_demo_execution_request");
assert.equal(mt5QueuedRequest.mode, "mt5_demo");
assert.equal(mt5QueuedRequest.scenario.maxRiskUsd, 25);
assert.equal(mt5QueuedRequest.riskEnvelope.simulationVolumeIsAuthoritative, false);
assert.equal(mt5QueuedRequest.riskEnvelope.brokerMustRecomputeVolume, true);
assert.equal(mt5QueuedRequest.safety.simulationVolumeTrustedByBroker, false);
assert.equal(mt5QueuedRequest.permissions.mt5DemoSubmissionAllowed, true);
assert.equal(mt5QueuedRequest.permissions.liveExecutionAllowed, false);
assert.equal(mt5QueuedRequest.safety.demoAccountRequired, true);
assert.equal(mt5QueuedRequest.safety.liveAccountAllowed, false);
assert.equal(verifyMt5DemoExecutionRequestHash(mt5QueuedRequest), true);
assert.deepEqual(mt5QueuedRequest.authority, authorityNone);

const mt5Killed = await preparePaperDemoSimulation(proposal.proposalId, {
  env: { ...mt5EnabledEnv, GOTRADER_MT5_DEMO_HANDOFF_KILL_SWITCH: "true" },
  now: "2026-07-18T14:03:03.000Z",
  repoRoot: tempRoot
});
assert.equal(mt5Killed.mt5DemoRequest.status, "blocked");
assert.equal(mt5Killed.mt5DemoRequest.blocker, "mt5_demo_handoff_kill_switch_active");

const duplicateIntegrated = await preparePaperDemoSimulation(proposal.proposalId, {
  env,
  now: "2026-07-18T14:03:01.000Z",
  repoRoot: tempRoot
});
assert.equal(duplicateIntegrated.status, "already_prepared");
assert.equal(duplicateIntegrated.gatewayRequest.status, "already_queued");
assert.equal(duplicateIntegrated.gatewayRequest.requestHash, integrated.gatewayRequest.requestHash);

const rebuiltRequest = buildPaperDemoExecutionRequest({
  now: "2026-07-18T14:03:00.000Z",
  policy: enabledPolicy,
  preparation: prepared.preparation
});
assert.equal(verifyPaperDemoExecutionRequestHash(rebuiltRequest), true);
const rebuiltMt5Request = buildMt5DemoExecutionRequest({
  now: "2026-07-18T14:03:00.000Z",
  policy: {
    ...enabledPolicy,
    mt5DemoHandoffEnabled: true,
    mt5DemoKillSwitchActive: false,
    mt5DemoMaxRiskUsd: 25
  },
  preparation: prepared.preparation
});
assert.equal(verifyMt5DemoExecutionRequestHash(rebuiltMt5Request), true);
await assert.rejects(
  () => writePaperDemoExecutionRequest({ ...rebuiltRequest, requestHash: "tampered" }, { repoRoot: tempRoot }),
  /hash validation failed/
);
await assert.rejects(
  () => writeMt5DemoExecutionRequest(
    { ...rebuiltMt5Request, requestHash: "tampered" },
    { repoRoot: tempRoot }
  ),
  /hash validation failed/
);

await mkdir(path.join(tempRoot, ".gotrader", "paper-demo-receipts"), { recursive: true });
await writeFile(
  path.join(tempRoot, ".gotrader", "paper-demo-receipts", `${queuedRequest.requestId}.json`),
  JSON.stringify({
    contract: "gotrader.paper_demo_execution_receipt",
    version: "1.0",
    requestId: queuedRequest.requestId,
    requestHash: queuedRequest.requestHash,
    status: "waiting_for_entry",
    paperOnly: true,
    brokerCallsMade: false,
    authority: authorityNone
  }),
  "utf8"
);
const receipts = await readRecentPaperDemoReceipts({ repoRoot: tempRoot });
assert.equal(receipts.length, 1);
assert.equal(receipts[0].brokerCallsMade, false);

await mkdir(path.join(tempRoot, ".gotrader", "mt5-demo-receipts"), { recursive: true });
await writeFile(
  path.join(tempRoot, ".gotrader", "mt5-demo-receipts", `${mt5QueuedRequest.requestId}.json`),
  JSON.stringify({
    contract: "gotrader.mt5_demo_execution_receipt",
    version: "1.0",
    requestId: mt5QueuedRequest.requestId,
    requestHash: mt5QueuedRequest.requestHash,
    processedAt: now,
    updatedAt: now,
    status: "broker_demo_pending",
    strategyProfileId: mt5QueuedRequest.strategyProfileId,
    sourceFingerprint: mt5QueuedRequest.source.fingerprint,
    brokerSymbol: "USTECH",
    direction: "short",
    entry: 28570,
    stop: 28600,
    target: 28510,
    orderTicket: 7001,
    volume: 0.1,
    blockers: [],
    demoOnly: true,
    liveAccountAllowed: false,
    credentialsIncluded: false,
    rawBrokerResponseIncluded: false,
    readinessPromotionApplied: false,
    researchAuthority: authorityNone,
    gatewayScope: "mt5_demo_only"
  }),
  "utf8"
);
const mt5Receipts = await readRecentMt5DemoReceipts({ repoRoot: tempRoot });
assert.equal(mt5Receipts.length, 1);
assert.equal(mt5Receipts[0].status, "broker_demo_pending");
assert.equal(mt5Receipts[0].liveAccountAllowed, false);
assert.equal(mt5Receipts[0].rawBrokerResponseIncluded, false);
assert.deepEqual(mt5Receipts[0].researchAuthority, authorityNone);

const exportedForwardReportPath = path.join(tempRoot, "exported-forward-report.json");
await writeFile(exportedForwardReportPath, JSON.stringify({
  reportType: "gotrader_forward_evidence_gateway_report",
  reportVersion: "v1",
  generatedAt: now,
  profileVersion: "v3",
  cutoff: "2026-07-14T04:40:00.000Z",
  pendingOutcomes: 0,
  rejectedOutcomes: 0,
  unverifiedOutcomes: 0,
  targetFirstRate: 0.8,
  invalidationFirstRate: 0.2,
  averageR: 1.8,
  profitFactor: 10,
  maxDrawdownR: 2,
  blockers: [],
  autoPromotionAllowed: false,
  ...forwardReport
}), "utf8");
const importer = spawnSync(
  process.execPath,
  [path.join(process.cwd(), "scripts", "import-forward-evidence-report.mjs"), exportedForwardReportPath],
  { cwd: tempRoot, encoding: "utf8" }
);
assert.equal(importer.status, 0, importer.stderr);
const importedForwardReport = JSON.parse(
  await readFile(path.join(tempRoot, ".gotrader", "ifvg-v3-forward-evidence.json"), "utf8")
);
assert.equal(importedForwardReport.reportType, "gotrader_forward_evidence_gateway_report");
assert.equal(importedForwardReport.autoPromotionAllowed, false);
assert.deepEqual(importedForwardReport.authority, authorityNone);

const defaultPolicy = loadPaperDemoGatewayPolicy({});
assert.equal(defaultPolicy.simulationRiskUsd, 0);
assert.equal(defaultPolicy.enabled, false);
assert.equal(defaultPolicy.killSwitchActive, true);
assert.equal(defaultPolicy.mt5DemoHandoffEnabled, false);
assert.equal(defaultPolicy.mt5DemoKillSwitchActive, true);
const currentStatus = await buildPaperDemoGatewayStatus({ repoRoot: process.cwd(), env: {} });
assert.equal(currentStatus.enabled, false);
assert.equal(currentStatus.killSwitchActive, true);
assert.equal(currentStatus.brokerGateway.status, "disabled");
assert.equal(currentStatus.brokerGateway.provider, "mt5_demo_gateway");
assert.equal(currentStatus.brokerGateway.liveSubmissionSupported, false);
assert.equal(currentStatus.paperGateway.immutableOutboxSupported, true);
assert.equal(currentStatus.paperGateway.monitoringSupported, true);
assert.equal(currentStatus.accountRiskGovernor.enabled, false);
assert.equal(currentStatus.accountRiskGovernor.brokerSubmissionAllowed, false);
assert.deepEqual(currentStatus.authority, authorityNone);

const serialized = JSON.stringify({ prepared, currentStatus });
for (const forbidden of ["rawCandles", "accountData", "orders", "positions", "apiKey", "password"]) {
  assert(!serialized.includes(forbidden), `Gateway output must exclude ${forbidden}.`);
}

const beforeRevalidation = await readFile(path.join(tempRoot, ".gotrader", "simulation-account-risk-state.json"), "utf8");
await persistRuntimeMirror({ ...mirror, readiness: { state: "blocked" } }, { repoRoot: tempRoot, nowMs: Date.parse(now) });
const changedReadiness = await preparePaperDemoSimulation(proposal.proposalId, {
  env, now: "2026-07-18T14:03:04.000Z", repoRoot: tempRoot
});
assert.equal(changedReadiness.status, "blocked", "a stored passing proposal must be revalidated");
assert.equal(await readFile(path.join(tempRoot, ".gotrader", "simulation-account-risk-state.json"), "utf8"), beforeRevalidation);
const proposalLines = (await readFile(path.join(tempRoot, ".gotrader", "research-mcp", "trade-proposals.jsonl"), "utf8")).trim().split(/\r?\n/);
assert.equal(proposalLines.length, 1, "revalidation must not create duplicate proposals");

console.log(JSON.stringify({
  status: "passed",
  defaultEnabled: defaultPolicy.enabled,
  defaultKillSwitchActive: defaultPolicy.killSwitchActive,
  preparedStatus: prepared.status,
  duplicateStatus: duplicate.status,
  currentReadiness: currentStatus.validationEvidence.validationReadinessStatus,
  currentGatewayReady: false,
  immutableOutboxVerified: verifyPaperDemoExecutionRequestHash(queuedRequest),
  receiptContractVerified: receipts.length === 1,
  mt5ReceiptContractVerified: mt5Receipts.length === 1,
  brokerSubmissionAttempted: false,
  authority: authorityNone
}, null, 2));
