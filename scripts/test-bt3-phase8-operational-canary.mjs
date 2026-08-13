#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MINIMUM_DURATION_MS, assessCanary, buildCanaryConfig, canonicalHash, sealCheckpoint, sealFinalReport, validateCheckpoint } from "./bt3/phase8-operational-canary-core.mjs";

const candidateHead = "249631e36fde497892b42242b03c0edbbd86a290";
assert.throws(() => buildCanaryConfig({ candidateHead, durationMs: MINIMUM_DURATION_MS - 1 }), /four hours/);
const config = buildCanaryConfig({ candidateHead });
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
assert.equal(assessCanary(checkpoint, config).status, "passed");
assert.equal(assessCanary(sealCheckpoint({ ...base, monotonicElapsedMs: MINIMUM_DURATION_MS - 1 }), config).status, "blocked");
const report = sealFinalReport(checkpoint, config);
assert.equal(report.assessment.status, "passed");
assert.equal(report.reportId, canonicalHash(Object.fromEntries(Object.entries(report).filter(([key]) => key !== "reportId"))));
const output = path.join(process.cwd(), ".gotrader/bt3-phase8-operational-canary/focused-report.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ schemaVersion: "gotrader-bt3-phase8-operational-canary-focused-report-v1", status: "passed", minimumDurationEnforced: true, injectedTimeCannotBypassMonotonicDuration: true, checkpointIntegrityValidated: true, resumeIdentityBound: true, failClosedAssessment: true, operationalAcceptanceClaimed: false, authority: config.authority }, null, 2)}\n`);
console.log(fs.readFileSync(output, "utf8"));

