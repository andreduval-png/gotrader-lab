#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadLrsBaselineModules } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";
import {
  buildR1ChildTelemetry,
  classifyR1ChildRss,
  openR1Controller,
  R1_AUTHORITY,
  R1_CERTIFICATE_ID,
  R1_DATASET_ID,
  R1_EXECUTOR_SCHEMA_VERSION,
  R1_FAMILY_ID,
  R1_LEGACY_EXECUTOR_SCHEMA_VERSION,
  R1_MAX_RSS_BYTES,
  R1_PLAN_ID,
  R1_PREVIOUS_EXECUTOR_SCHEMA_VERSION,
  R1_SAMPLE_SET_ID,
  R1_SOURCE_FINGERPRINT,
  summarizeR1StageSamples,
  writeR1ChildTelemetry,
  writeR1ControllerCheckpoint
} from "./support/liquidity-reclaim-scalper-r1-executor.mjs";

const root = process.cwd();
const outputRoot = path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/r1-child-rss-enforcement-test");
const legacyRoot = path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/r1-child-rss-legacy-test");
const previousRoot = path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/r1-child-rss-previous-test");
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.rmSync(legacyRoot, { recursive: true, force: true });
fs.rmSync(previousRoot, { recursive: true, force: true });

const modules = await loadLrsBaselineModules(path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/compiled-r1-child-rss-test"));
const selectedTrialIds = ["lrs-r1-trial:000"];
const controllerCommit = "d".repeat(40);
const opened = await openR1Controller({ modules, outputRoot, mode: "pilot", selectedTrialIds, controllerCommit });

assert.equal(classifyR1ChildRss(500_000_000), "within_limit");
assert.equal(classifyR1ChildRss(805_306_368), "soft_limit_recycle");
assert.equal(classifyR1ChildRss(R1_MAX_RSS_BYTES + 1), "hard_limit_exceeded");

const stageTelemetry = summarizeR1StageSamples([
  { stage: "after_m5_load", rssBytes: 400_000_000 },
  { stage: "after_segment_context", rssBytes: 610_000_000 },
  { stage: "after_segment_context", rssBytes: 640_000_000 }
]);
assert.deepEqual(stageTelemetry, [
  { stage: "after_m5_load", sampleCount: 1, maximumRssBytes: 400_000_000, lastRssBytes: 400_000_000 },
  { stage: "after_segment_context", sampleCount: 2, maximumRssBytes: 640_000_000, lastRssBytes: 640_000_000 }
]);

const telemetry = await buildR1ChildTelemetry(modules, {
  childRun: 1,
  trialId: selectedTrialIds[0],
  trialOrdinal: 0,
  childOrdinal: 0,
  startedAtUtc: "2026-08-14T00:00:00.000Z",
  completedAtUtc: "2026-08-14T00:01:00.000Z",
  exitStatus: 75,
  resultReason: "controlled_memory_recycle",
  maximumObservedRssBytes: 640_000_000,
  resourceDecision: "within_limit",
  trialCheckpointId: `sha256:${"3".repeat(64)}`,
  stageTelemetry
});
await writeR1ChildTelemetry({ modules, storage: opened.storage, telemetry });
const telemetryFiles = fs.readdirSync(path.join(outputRoot, "telemetry"));
assert.equal(telemetryFiles.length, 1);
assert.match(telemetryFiles[0], /^child-000001-[a-f0-9]{64}\.json$/);
const telemetryOnDisk = JSON.parse(fs.readFileSync(path.join(outputRoot, "telemetry", telemetryFiles[0]), "utf8"));
assert.equal(telemetryOnDisk.telemetryId, telemetry.telemetryId);
assert.equal(telemetryOnDisk.authority.executionAuthority, "none");

const checkpoint = await writeR1ControllerCheckpoint({
  modules,
  storage: opened.storage,
  input: {
    mode: "pilot",
    selectedTrialIds,
    nextPosition: 0,
    dispositions: [],
    orderedEventIds: [],
    controllerCommit,
    startedAtUtc: opened.checkpoint.startedAtUtc,
    childRuns: 1,
    maximumObservedRssBytes: 640_000_000,
    orderedChildTelemetryIds: [telemetry.telemetryId]
  }
});
const reopened = await openR1Controller({ modules, outputRoot, mode: "pilot", selectedTrialIds, controllerCommit });
assert.equal(reopened.checkpoint.checkpointId, checkpoint.checkpointId);
assert.deepEqual(reopened.checkpoint.orderedChildTelemetryIds, [telemetry.telemetryId]);
const tamperedTelemetry = { ...telemetryOnDisk, maximumObservedRssBytes: telemetryOnDisk.maximumObservedRssBytes + 1 };
fs.writeFileSync(path.join(outputRoot, "telemetry", telemetryFiles[0]), `${JSON.stringify(tamperedTelemetry)}\n`);
await assert.rejects(
  openR1Controller({ modules, outputRoot, mode: "pilot", selectedTrialIds, controllerCommit }),
  /telemetry identity or integrity/
);
fs.writeFileSync(path.join(outputRoot, "telemetry", telemetryFiles[0]), `${modules.canonical.canonicalSerialize(telemetryOnDisk)}\n`);

const legacyCore = {
  schemaVersion: R1_LEGACY_EXECUTOR_SCHEMA_VERSION,
  mode: "pilot",
  experimentFamilyId: R1_FAMILY_ID,
  samplingPlanId: R1_PLAN_ID,
  sampleSetId: R1_SAMPLE_SET_ID,
  datasetCertificateId: R1_CERTIFICATE_ID,
  datasetId: R1_DATASET_ID,
  sourceFingerprint: R1_SOURCE_FINGERPRINT,
  selectedTrialIds,
  nextPosition: 0,
  dispositions: [],
  orderedEventIds: [],
  controllerCommit,
  startedAtUtc: "2026-08-14T00:00:00.000Z",
  childRuns: 0,
  maximumObservedRssBytes: 0,
  authority: R1_AUTHORITY,
  researchValidated: false,
  productionAdoptionAllowed: false,
  holdoutUsed: false,
  adaptiveSearchUsed: false
};
const legacyCheckpoint = { ...legacyCore, checkpointId: await modules.canonical.canonicalHash(legacyCore) };
fs.mkdirSync(path.join(legacyRoot, "checkpoints"), { recursive: true });
fs.writeFileSync(path.join(legacyRoot, "checkpoints/controller.json"), `${modules.canonical.canonicalSerialize(legacyCheckpoint)}\n`);
const migrated = await openR1Controller({ modules, outputRoot: legacyRoot, mode: "pilot", selectedTrialIds, controllerCommit });
assert.equal(migrated.checkpoint.schemaVersion, R1_EXECUTOR_SCHEMA_VERSION);
assert.deepEqual(migrated.checkpoint.orderedChildTelemetryIds, []);

const { checkpointId: ignoredCheckpointId, ...currentCore } = checkpoint;
const previousCore = { ...currentCore, schemaVersion: R1_PREVIOUS_EXECUTOR_SCHEMA_VERSION };
const previousCheckpoint = { ...previousCore, checkpointId: await modules.canonical.canonicalHash(previousCore) };
fs.mkdirSync(path.join(previousRoot, "checkpoints"), { recursive: true });
fs.mkdirSync(path.join(previousRoot, "telemetry"), { recursive: true });
fs.writeFileSync(path.join(previousRoot, "checkpoints/controller.json"), `${modules.canonical.canonicalSerialize(previousCheckpoint)}\n`);
fs.copyFileSync(path.join(outputRoot, "telemetry", telemetryFiles[0]), path.join(previousRoot, "telemetry", telemetryFiles[0]));
const migratedPrevious = await openR1Controller({ modules, outputRoot: previousRoot, mode: "pilot", selectedTrialIds, controllerCommit });
assert.equal(migratedPrevious.checkpoint.schemaVersion, R1_EXECUTOR_SCHEMA_VERSION);
assert.deepEqual(migratedPrevious.checkpoint.orderedChildTelemetryIds, [telemetry.telemetryId]);

const controllerSource = fs.readFileSync(path.join(root, "scripts/run-liquidity-reclaim-scalper-r1-bounded.mjs"), "utf8");
const immediateGate = controllerSource.indexOf("if (resourceDecision === \"hard_limit_exceeded\")");
const childStatusGate = controllerSource.indexOf("if (![0, 75].includes");
const completionGate = controllerSource.indexOf("completed = fs.existsSync", immediateGate);
assert.ok(immediateGate > 0 && childStatusGate > immediateGate && completionGate > immediateGate);
assert.match(controllerSource, /writeR1ChildTelemetry/);
assert.match(controllerSource, /orderedChildTelemetryIds/);

const trialSource = fs.readFileSync(path.join(root, "scripts/run-liquidity-reclaim-scalper-r1-trial.mjs"), "utf8");
assert.match(trialSource, /R1_STAGE/);
assert.match(trialSource, /checkpointId: scanCheckpointId\(\)/);
const baselineSource = fs.readFileSync(path.join(root, "scripts/support/liquidity-reclaim-scalper-baseline-runner.mjs"), "utf8");
for (const stage of ["after_m5_load", "after_m15_load", "after_segment_context", "after_event_context", "after_m1_index", "after_bt2_record_checkpoint"]) {
  assert.match(baselineSource, new RegExp(stage));
}

console.log(JSON.stringify({
  status: "passed",
  immediateChildEnforcement: true,
  immutableTelemetry: true,
  checkpointRestart: true,
  legacyMigration: true,
  stageTelemetry: stageTelemetry.map((item) => item.stage),
  hardRssBytes: R1_MAX_RSS_BYTES,
  authority: "none/none/none",
  holdoutUsed: false
}, null, 2));
