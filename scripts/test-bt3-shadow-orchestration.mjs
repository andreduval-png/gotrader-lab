#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "tests/fixtures/bt3-shadow-orchestration");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const snapshotText = text(path.join(fixtureRoot, "shadow-orchestration.snapshot.json"));
const snapshot = JSON.parse(snapshotText);
const hashManifest = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json")));
assert.equal(sha256(snapshotText), hashManifest.hashes["shadow-orchestration.snapshot.json"]);

const { orchestration, job, handlers, interrupted, scenarios } = await buildShadowOrchestrationScenario();
assert.deepEqual(scenarios, snapshot.payload);
assert.deepEqual(scenarios.resumed, scenarios.uninterrupted);
assert.equal(scenarios.uninterrupted.artifacts[1].attemptNumber, 2);
assert.equal(scenarios.uninterrupted.projection.terminalStatus, "completed");
assert.equal(scenarios.blocked.projection.terminalStatus, "blocked");
assert.deepEqual(scenarios.blocked.artifacts.slice(2).map((artifact) => artifact.status), ["skipped", "skipped"]);
assert.equal(scenarios.failed.artifacts[1].attemptNumber, 2);
assert.equal(scenarios.failed.projection.terminalStatus, "failed");
assert.equal(scenarios.cancelled.projection.terminalStatus, "cancelled");
assert.equal(scenarios.cancelled.checkpoint.cancellationRequested, true);
assert.equal(scenarios.optionalSkipped.artifacts[3].status, "skipped");
assert.equal(scenarios.optionalSkipped.projection.terminalStatus, "completed");
assert.deepEqual(scenarios.uninterrupted.artifacts.map((artifact) => artifact.stageOrdinal), [0, 1, 2, 3]);
assert.deepEqual(scenarios.uninterrupted.artifacts.map((artifact) => artifact.attemptNumber), [1, 2, 1, 1]);
assert.equal(scenarios.uninterrupted.checkpoint.heartbeatSequence, 4);

assert.equal(await orchestration.validateShadowResearchJob(job), true);
assert.equal(await orchestration.validateShadowCheckpoint(interrupted.checkpoint), true);
assert.ok((await Promise.all(scenarios.uninterrupted.artifacts.map(orchestration.validateShadowStageArtifact))).every(Boolean));
assert.equal(await orchestration.validateShadowTerminalSeal(scenarios.uninterrupted.seal), true);
assert.equal(await orchestration.validateShadowOperatorProjection(scenarios.uninterrupted.projection), true);

const tamperedCheckpoint = structuredClone(interrupted.checkpoint);
tamperedCheckpoint.heartbeatSequence += 1;
assert.equal(await orchestration.validateShadowCheckpoint(tamperedCheckpoint), false);
await assert.rejects(orchestration.runShadowOrchestration({
  job,
  handlers,
  checkpoint: tamperedCheckpoint,
  priorArtifacts: interrupted.artifacts
}), /resume evidence identity is invalid/);

const tamperedArtifact = structuredClone(interrupted.artifacts[0]);
tamperedArtifact.stageOrdinal = 1;
assert.equal(await orchestration.validateShadowStageArtifact(tamperedArtifact), false);
const rehashedUnsafeJob = structuredClone(job);
rehashedUnsafeJob.authority.executionAuthority = "enabled";
delete rehashedUnsafeJob.logicalJobId;
rehashedUnsafeJob.logicalJobId = await orchestration.buildShadowResearchJob({
  jobType: job.jobType,
  jobTypeVersion: job.jobTypeVersion,
  inputArtifactIds: job.inputArtifactIds,
  compactInput: job.compactInput,
  stages: job.stages
}).then((safeJob) => safeJob.logicalJobId);
assert.equal(await orchestration.validateShadowResearchJob(rehashedUnsafeJob), false);
const repository = new orchestration.InMemoryShadowOrchestrationRepository();
repository.writeJob(job);
const conflictingJob = structuredClone(job);
conflictingJob.compactInput.fixture = "conflict";
assert.throws(() => repository.writeJob(conflictingJob), /Immutable shadow job conflict/);
repository.writeCheckpoint(interrupted.checkpoint);
const initialCheckpoint = await orchestration.buildInitialShadowCheckpoint(job);
assert.throws(() => repository.writeCheckpoint(initialCheckpoint), /heartbeat regression/);

await assert.rejects(orchestration.buildShadowResearchJob({
  jobType: "unsafe_fixture",
  jobTypeVersion: "v1",
  inputArtifactIds: [`sha256:${"2".repeat(64)}`],
  compactInput: { rawCandles: "not-allowed" },
  stages: [{ stageName: "stage", stageVersion: "v1", required: true, retryLimit: 0 }]
}), /forbidden field/);
await assert.rejects(orchestration.buildShadowResearchJob({
  jobType: "nested_fixture",
  jobTypeVersion: "v1",
  inputArtifactIds: [`sha256:${"3".repeat(64)}`],
  compactInput: { nested: { value: 1 } },
  stages: [{ stageName: "stage", stageVersion: "v1", required: true, retryLimit: 0 }]
}), /non-compact value/);

const serialized = JSON.stringify(scenarios);
for (const forbidden of ["rawCandles", "accountNumber", "orderId", "positionId", "brokerMutation", "executionIntent"]) {
  assert.equal(serialized.includes(forbidden), false);
}
const report = {
  schemaVersion: "gotrader-bt3-shadow-orchestration-report-v1",
  status: "passed",
  snapshotHash: `sha256:${sha256(snapshotText)}`,
  logicalJobId: job.logicalJobId,
  stageCount: job.stages.length,
  interruptionResumeParity: true,
  boundedRetry: true,
  cancellation: true,
  immutableConflictDetection: true,
  heartbeatMonotonicity: true,
  identityTamperRejection: true,
  compactPayloadBoundary: true,
  runtimeIntegrated: false,
  mt5Contacted: false,
  authority: job.authority
};
const reportPath = path.join(root, ".gotrader/bt3-shadow-orchestration/report.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
