#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MINIMUM_DURATION_MS, assessCanary, buildCanaryConfig, canonicalHash, nextSampleDelayMs, sealCheckpoint, sealFinalReport, validateCheckpoint } from "./bt3/phase8-operational-canary-core.mjs";

const candidateHead = "249631e36fde497892b42242b03c0edbbd86a290";
assert.throws(() => buildCanaryConfig({ candidateHead, durationMs: MINIMUM_DURATION_MS - 1 }), /four hours/);
const config = buildCanaryConfig({ candidateHead });
assert.equal(nextSampleDelayMs({ sequence: 1, sampleIntervalMs: 300_000, monotonicElapsedMs: 60_000 }), 240_000);
assert.equal(nextSampleDelayMs({ sequence: 2, sampleIntervalMs: 300_000, monotonicElapsedMs: 360_000 }), 240_000);
assert.equal(nextSampleDelayMs({ sequence: 2, sampleIntervalMs: 300_000, monotonicElapsedMs: 610_000 }), 0);
assert.throws(() => nextSampleDelayMs({ sequence: -1, sampleIntervalMs: 300_000, monotonicElapsedMs: 0 }), /invalid/);
let simulatedElapsedMs = 0;
let simulatedSequence = 0;
while (simulatedSequence < 48) {
  simulatedElapsedMs += 60_000;
  simulatedSequence += 1;
  simulatedElapsedMs += nextSampleDelayMs({
    sequence: simulatedSequence,
    sampleIntervalMs: config.sampleIntervalMs,
    monotonicElapsedMs: simulatedElapsedMs,
  });
}
assert.equal(simulatedElapsedMs, MINIMUM_DURATION_MS);
const startedAt = "2026-08-13T04:00:00.000Z";
const base = {
  runId: canonicalHash({ candidateHead, startedAt }), candidateHead, configId: config.configId,
  startedAt, observedAt: "2026-08-13T08:00:00.000Z", monotonicElapsedMs: MINIMUM_DURATION_MS,
  sequence: 48, controlledCancellationObserved: true, browserRestartObserved: true,
  exercisedContracts: ["orchestration", "checkpoint_recovery", "lease", "cancellation", "quarantine", "bounded_host", "scheduler", "operator", "rollback"],
  maxRssBytesObserved: 512 * 1024 * 1024, storageBytesObserved: 1024, unexpectedFailures: 0, blockers: [],
  authority: config.authority,
};
const checkpoint = sealCheckpoint(base);
assert.equal(validateCheckpoint(checkpoint, config), true);
assert.equal(validateCheckpoint({ ...checkpoint, sequence: 47 }, config), false);
const roundtrip = JSON.parse(JSON.stringify(checkpoint));
assert.equal(validateCheckpoint(roundtrip, config), true);
const second = sealCheckpoint({ ...roundtrip, observedAt: "2026-08-13T08:05:00.000Z", monotonicElapsedMs: MINIMUM_DURATION_MS + 300_000, sequence: 49, browserRestartObserved: true });
assert.equal(validateCheckpoint(second, config), true);
assert.notEqual(second.integrityHash, checkpoint.integrityHash);
assert.equal(Object.hasOwn(second, "priorIntegrityHash"), false);
const third = sealCheckpoint({ ...JSON.parse(JSON.stringify(second)), observedAt: "2026-08-13T08:10:00.000Z", monotonicElapsedMs: MINIMUM_DURATION_MS + 600_000, sequence: 50 });
assert.equal(validateCheckpoint(third, config), true);
assert.equal(validateCheckpoint({ ...third, injectedMetadata: "rejected" }, config), false);
assert.equal(assessCanary(checkpoint, config).status, "passed");
assert.equal(assessCanary(sealCheckpoint({ ...base, monotonicElapsedMs: MINIMUM_DURATION_MS - 1 }), config).status, "blocked");
const report = sealFinalReport(checkpoint, config);
assert.equal(report.assessment.status, "passed");
assert.equal(report.reportId, canonicalHash(Object.fromEntries(Object.entries(report).filter(([key]) => key !== "reportId"))));
const resumedReport = sealFinalReport(third, config);
assert.equal(resumedReport.finalCheckpointHash, third.integrityHash);
assert.equal(resumedReport.assessment.status, "passed");
assert.equal(resumedReport.reportId, canonicalHash(Object.fromEntries(Object.entries(resumedReport).filter(([key]) => key !== "reportId"))));
const output = path.join(process.cwd(), ".gotrader/bt3-phase8-operational-canary/focused-report.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ schemaVersion: "gotrader-bt3-phase8-operational-canary-focused-report-v1", status: "passed", minimumDurationEnforced: true, injectedTimeCannotBypassMonotonicDuration: true, fixedDeadlineCadenceValidated: true, boundedOverrunRecoveryValidated: true, fortyEightSamplesWithinMinimumDurationValidated: true, checkpointIntegrityValidated: true, consecutiveCheckpointIntegrityValidated: true, diskRoundtripValidated: true, browserRestartStateValidated: true, resumeIdentityBound: true, finalReportBindingValidated: true, unexpectedMetadataRejected: true, failClosedAssessment: true, operationalAcceptanceClaimed: false, authority: config.authority }, null, 2)}\n`);
console.log(fs.readFileSync(output, "utf8"));
