#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadLrsBaselineModules } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";
import { prepareR1CompletedTrialEvidenceArchive } from "./support/liquidity-reclaim-scalper-r1-evidence-capacity.mjs";
import {
  openR1Controller,
  R1_CERTIFICATE_ID,
  R1_DATASET_ID,
  summarizeR1FamilyDispositions,
  verifyAcceptedR1Inputs,
  verifyR1TrialReport,
  writeR1ControllerCheckpoint
} from "./support/liquidity-reclaim-scalper-r1-executor.mjs";

const root = process.cwd();
const outputRoot = path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/r1-blocked-report-disposition-test");
fs.rmSync(outputRoot, { recursive: true, force: true });

const modules = await loadLrsBaselineModules(
  path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/compiled-r1-blocked-report-disposition-test")
);
const { definitions } = await verifyAcceptedR1Inputs({
  modules,
  acceptancePath: path.join(root, "docs/gotrader-strategies/liquidity-reclaim-scalper/r1-trial-controls-acceptance.json")
});
const trial = definitions.find((item) => item.initialDisposition === "planned_unique");
const trialRoot = path.join(outputRoot, "trials", trial.trialId.replace(":", "_"));
const reportPath = path.join(trialRoot, "baseline-report.json");
fs.mkdirSync(path.join(trialRoot, "checkpoints"), { recursive: true });

const writeReport = async (status, overrides = {}) => {
  const core = {
    schemaVersion: "gotrader-lrs-certified-baseline-v1",
    status,
    parameterHash: trial.parameterHash,
    certificateId: R1_CERTIFICATE_ID,
    datasetId: R1_DATASET_ID,
    ledgerSealId: `sha256:${"9".repeat(64)}`,
    outcomeCounts: { exited: 203, expired_unfilled: 1, ambiguous: 0, insufficient_data: 0, blocked: status === "blocked" ? 1 : 0 },
    researchValidated: false,
    productionAdoptionAllowed: false,
    rawCandlesSerialized: false,
    mt5Contacted: false,
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
    ...overrides
  };
  const report = { ...core, reportId: await modules.canonical.canonicalHash(core) };
  fs.writeFileSync(reportPath, `${modules.canonical.canonicalSerialize(report)}\n`);
  return report;
};

await writeReport("passed");
const passed = await verifyR1TrialReport({ modules, reportPath, trial });
assert.equal(passed.researchDisposition, "completed");
assert.equal(passed.reasonCode, "verified_passing_research_outcome");

const blockedReport = await writeReport("blocked");
const blocked = await verifyR1TrialReport({ modules, reportPath, trial });
assert.equal(blocked.report.reportId, blockedReport.reportId);
assert.equal(blocked.researchDisposition, "rejected");
assert.equal(blocked.reasonCode, "verified_blocked_research_outcome");

await writeReport("rejected");
await assert.rejects(verifyR1TrialReport({ modules, reportPath, trial }), /failed verification/);
await writeReport("passed", { outcomeCounts: { exited: 203, expired_unfilled: 1, ambiguous: 0, insufficient_data: 0, blocked: 1 } });
await assert.rejects(verifyR1TrialReport({ modules, reportPath, trial }), /failed verification/);
await writeReport("blocked", { authority: { executionAuthority: "none", brokerAuthority: "read_only", readinessOverrideAuthority: "none" } });
await assert.rejects(verifyR1TrialReport({ modules, reportPath, trial }), /failed verification/);
await writeReport("blocked", { certificateId: `sha256:${"0".repeat(64)}` });
await assert.rejects(verifyR1TrialReport({ modules, reportPath, trial }), /failed verification/);
await writeReport("blocked");

const family = summarizeR1FamilyDispositions([
  { disposition: "completed" },
  { disposition: "rejected" },
  { disposition: "coalesced" },
  { disposition: "attempted" }
]);
assert.deepEqual(family, { passingTrialCount: 1, blockedTrialCount: 1, terminalUniqueTrialCount: 2, coalescedCount: 1 });

fs.writeFileSync(path.join(trialRoot, "checkpoints", "terminal.json"), '{"status":"blocked","rawCandlesSerialized":false}\n');
const controllerCommit = "d".repeat(40);
const opened = await openR1Controller({
  modules,
  outputRoot,
  mode: "pilot",
  selectedTrialIds: [trial.trialId],
  controllerCommit
});
const archive = await prepareR1CompletedTrialEvidenceArchive({
  modules,
  storage: opened.storage,
  outputRoot,
  trial,
  orderedChildTelemetryIds: []
});
const terminal = await writeR1ControllerCheckpoint({
  modules,
  storage: opened.storage,
  input: {
    mode: "pilot",
    selectedTrialIds: [trial.trialId],
    nextPosition: 1,
    dispositions: [{
      trialId: trial.trialId,
      ordinal: trial.ordinal,
      disposition: "rejected",
      reportStatus: "blocked",
      reportId: blockedReport.reportId,
      ledgerSealId: blockedReport.ledgerSealId,
      evidenceArchiveId: archive.archiveId
    }],
    orderedEventIds: [],
    controllerCommit,
    startedAtUtc: opened.checkpoint.startedAtUtc,
    childRuns: 0,
    maximumObservedRssBytes: 0,
    telemetryStartChildRun: 0,
    orderedChildTelemetryIds: []
  }
});
const reopened = await openR1Controller({
  modules,
  outputRoot,
  mode: "pilot",
  selectedTrialIds: [trial.trialId],
  controllerCommit
});
assert.equal(reopened.checkpoint.checkpointId, terminal.checkpointId);
assert.equal(reopened.checkpoint.dispositions[0].disposition, "rejected");
assert.equal(fs.existsSync(reportPath), true);
assert.equal(fs.existsSync(path.join(trialRoot, "checkpoints", "terminal.json")), false);

console.log(JSON.stringify({
  status: "passed",
  passedReportDisposition: passed.researchDisposition,
  blockedReportDisposition: blocked.researchDisposition,
  blockedReportId: blocked.report.reportId,
  restartVerified: true,
  familyAccounting: family,
  authority: "none/none/none"
}, null, 2));
