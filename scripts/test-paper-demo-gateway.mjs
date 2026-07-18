import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildPaperDemoExecutionRequest,
  buildPaperDemoGatewayStatus,
  evaluatePaperDemoPreparation,
  loadPaperDemoGatewayPolicy,
  preparePaperDemoSimulation,
  readRecentPaperDemoReceipts,
  summarizeForwardEvidenceReport,
  summarizeValidationReport,
  verifyPaperDemoExecutionRequestHash,
  writePaperDemoExecutionRequest
} from "./gotrader-paper-demo-gateway-core.mjs";
import { appendTradeProposalAudit, evaluateTradeProposal } from "./gotrader-trade-proposal-core.mjs";

const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const now = "2026-07-18T14:00:00.000Z";
const proposal = evaluateTradeProposal(
  {
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    strategyProfileId: "ifvg_fresh_retest_v3_research",
    direction: "short",
    entry: 28570,
    stop: 28600,
    targets: [28510],
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5_read_only|MNQ|USTECH|5m|1000|start|1|end|2",
    validationChainId: "validation_ifvg_v3_current",
    autoApplyAllowed: false,
    authority: authorityNone
  },
  {
    now,
    sizingPolicy: {
      mode: "paper_preview",
      configured: true,
      riskBudgetUsd: 300,
      pointValueUsd: 2,
      maxUnits: 5,
      operatorConfigured: true,
      llmMayOverride: false
    }
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

const prepared = evaluatePaperDemoPreparation({
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
assert.deepEqual(prepared.authority, authorityNone);

const duplicate = evaluatePaperDemoPreparation({
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: prepared.state,
  now: "2026-07-18T14:03:01.000Z"
});
assert.equal(duplicate.status, "already_prepared");
assert.equal(duplicate.state.preparations.length, 1);

const disabled = evaluatePaperDemoPreparation({
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: { ...enabledPolicy, enabled: false },
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert(disabled.blockers.includes("paper_demo_gateway_not_enabled"));

const killed = evaluatePaperDemoPreparation({
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: { ...enabledPolicy, killSwitchActive: true },
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert(killed.blockers.includes("paper_demo_kill_switch_active"));

const stale = evaluatePaperDemoPreparation({
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: emptyState,
  now: "2026-07-18T14:06:00.000Z"
});
assert(stale.blockers.includes("paper_demo_signal_stale"));

const notReady = evaluatePaperDemoPreparation({
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
assert(nonCanonicalFingerprint.blockers.includes("proposal_source_fingerprint_not_canonical"));

const noForward = evaluatePaperDemoPreparation({
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(undefined),
  policy: enabledPolicy,
  state: emptyState,
  now: "2026-07-18T14:03:00.000Z"
});
assert(noForward.blockers.includes("untouched_forward_evidence_missing"));

const lossLocked = evaluatePaperDemoPreparation({
  proposalEvaluation: proposal,
  validationEvidence: summarizeValidationReport(validationReport),
  forwardEvidence: summarizeForwardEvidenceReport(forwardReport),
  policy: enabledPolicy,
  state: { ...emptyState, dailyRealizedR: -4 },
  now: "2026-07-18T14:03:00.000Z"
});
assert(lossLocked.blockers.includes("paper_demo_daily_loss_limit_reached"));

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "gotrader-paper-demo-gateway-"));
await mkdir(path.join(tempRoot, ".gotrader"), { recursive: true });
await appendTradeProposalAudit(proposal, { repoRoot: tempRoot });
await writeFile(path.join(tempRoot, ".gotrader", "validation.json"), JSON.stringify(validationReport), "utf8");
await writeFile(path.join(tempRoot, ".gotrader", "forward.json"), JSON.stringify(forwardReport), "utf8");
const env = {
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
const persisted = JSON.parse(await readFile(path.join(tempRoot, ".gotrader", "paper-demo-gateway-state.json"), "utf8"));
assert.equal(persisted.preparations.length, 1);
assert.equal(persisted.preparations[0].brokerSubmissionAttempted, false);
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
assert.equal(verifyPaperDemoExecutionRequestHash(queuedRequest), true);
assert.deepEqual(queuedRequest.authority, authorityNone);

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
await assert.rejects(
  () => writePaperDemoExecutionRequest({ ...rebuiltRequest, requestHash: "tampered" }, { repoRoot: tempRoot }),
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
assert.equal(defaultPolicy.enabled, false);
assert.equal(defaultPolicy.killSwitchActive, true);
const currentStatus = await buildPaperDemoGatewayStatus({ repoRoot: process.cwd(), env: {} });
assert.equal(currentStatus.enabled, false);
assert.equal(currentStatus.killSwitchActive, true);
assert.equal(currentStatus.brokerGateway.status, "disabled");
assert.equal(currentStatus.paperGateway.immutableOutboxSupported, true);
assert.equal(currentStatus.paperGateway.monitoringSupported, true);
assert.deepEqual(currentStatus.authority, authorityNone);

const serialized = JSON.stringify({ prepared, currentStatus });
for (const forbidden of ["rawCandles", "accountData", "orders", "positions", "apiKey", "password"]) {
  assert(!serialized.includes(forbidden), `Gateway output must exclude ${forbidden}.`);
}

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
  brokerSubmissionAttempted: false,
  authority: authorityNone
}, null, 2));
