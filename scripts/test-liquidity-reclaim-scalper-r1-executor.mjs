#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadLrsBaselineModules } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";
import {
  enforceR1ResourceBounds,
  nextR1TrialEventSequence,
  openR1Controller,
  R1_SAMPLE_SET_ID,
  validateR1ControllerCheckpoint,
  verifyAcceptedR1Inputs,
  writeImmutableR1Artifact,
  writeR1ControllerCheckpoint,
} from "./support/liquidity-reclaim-scalper-r1-executor.mjs";

const root = process.cwd();
const outputRoot = path.join(
  root,
  ".gotrader/liquidity-reclaim-scalper-v1/r1-executor-test",
);
fs.rmSync(outputRoot, { recursive: true, force: true });

const modules = await loadLrsBaselineModules(
  path.join(
    root,
    ".gotrader/liquidity-reclaim-scalper-v1/compiled-r1-executor-test",
  ),
);
const accepted = await verifyAcceptedR1Inputs({
  modules,
  acceptancePath: path.join(
    root,
    "docs/gotrader-strategies/liquidity-reclaim-scalper/r1-trial-controls-acceptance.json",
  ),
});

assert.equal(accepted.definitions.length, 128);
assert.equal(
  new Set(accepted.definitions.map((item) => item.parameterHash)).size,
  125,
);
assert.equal(
  accepted.definitions.filter(
    (item) => item.initialDisposition === "coalesced_duplicate",
  ).length,
  3,
);

const selectedTrialIds = accepted.definitions
  .filter((item) => item.initialDisposition === "planned_unique")
  .slice(0, 2)
  .map((item) => item.trialId);
const controllerCommit = "c".repeat(40);
const opened = await openR1Controller({
  modules,
  outputRoot,
  mode: "pilot",
  selectedTrialIds,
  controllerCommit,
});
assert.equal(opened.checkpoint.sampleSetId, R1_SAMPLE_SET_ID);
assert.equal(opened.checkpoint.nextPosition, 0);

const eventRepository = new modules.trialControls.LrsR1TrialControlRepository(opened.storage.adapter);
const attemptedEvent = await modules.trialControls.buildLrsR1TrialEvent({
  trialId: selectedTrialIds[0],
  sequence: 0,
  disposition: "attempted",
  recordedAtUtc: "2026-08-20T00:00:00.000Z",
  reasonCodes: ["bounded_certified_trial_started"],
  evidenceIds: [],
});
await eventRepository.writeEvent(attemptedEvent);
const failedEvent = await modules.trialControls.buildLrsR1TrialEvent({
  trialId: selectedTrialIds[0],
  sequence: 1,
  disposition: "failed",
  recordedAtUtc: "2026-08-20T00:01:00.000Z",
  reasonCodes: ["bounded_child_failed"],
  evidenceIds: [`sha256:${"2".repeat(64)}`],
  previousEventId: attemptedEvent.eventId,
});
await eventRepository.writeEvent(failedEvent);
assert.equal(await nextR1TrialEventSequence({ storage: opened.storage,
  previousEventId: failedEvent.eventId, trialId: selectedTrialIds[0] }), 2);
await assert.rejects(nextR1TrialEventSequence({ storage: opened.storage,
  previousEventId: failedEvent.eventId, trialId: selectedTrialIds[1] }), /lineage/);
await assert.rejects(nextR1TrialEventSequence({ storage: opened.storage,
  previousEventId: `sha256:${"9".repeat(64)}`, trialId: selectedTrialIds[0] }), /missing/);

const updated = await writeR1ControllerCheckpoint({
  modules,
  storage: opened.storage,
  input: {
    mode: "pilot",
    selectedTrialIds,
    nextPosition: 1,
    dispositions: [
      { trialId: selectedTrialIds[0], disposition: "failed" },
    ],
    orderedEventIds: [`sha256:${"1".repeat(64)}`],
    controllerCommit,
    startedAtUtc: opened.checkpoint.startedAtUtc,
    childRuns: 3,
    maximumObservedRssBytes: 400_000_000,
    telemetryStartChildRun: 3,
    orderedChildTelemetryIds: [],
  },
});
const reopened = await openR1Controller({
  modules,
  outputRoot,
  mode: "pilot",
  selectedTrialIds,
  controllerCommit,
});
assert.equal(reopened.checkpoint.checkpointId, updated.checkpointId);
await assert.rejects(
  validateR1ControllerCheckpoint(
    modules,
    { ...updated, nextPosition: 2 },
    { mode: "pilot", selectedTrialIds, controllerCommit },
  ),
  /integrity/,
);
await assert.rejects(
  openR1Controller({
    modules,
    outputRoot,
    mode: "family",
    selectedTrialIds,
    controllerCommit,
  }),
  /identity/,
);

await writeImmutableR1Artifact({
  modules,
  storage: opened.storage,
  relativePath: "reports/test.json",
  artifact: { value: 1 },
});
await assert.rejects(
  writeImmutableR1Artifact({
    modules,
    storage: opened.storage,
    relativePath: "reports/test.json",
    artifact: { value: 2 },
  }),
  /conflict/,
);

assert.equal(
  enforceR1ResourceBounds(outputRoot, 500_000_000).maximumObservedRssBytes,
  500_000_000,
);
assert.throws(
  () => enforceR1ResourceBounds(outputRoot, 1_073_741_825),
  /RSS/,
);

const boundedControllerSource = fs.readFileSync(
  path.join(root, "scripts/run-liquidity-reclaim-scalper-r1-bounded.mjs"),
  "utf8",
);
assert.match(boundedControllerSource, /\["--expose-gc", "scripts\/run-liquidity-reclaim-scalper-r1-trial\.mjs"\]/);
assert.match(boundedControllerSource, /disposition\.disposition === "failed"/);
assert.match(boundedControllerSource, /authorized_bounded_child_failure_resume/);
assert.match(boundedControllerSource, /nextR1TrialEventSequence/);

const duplicateTrial = accepted.definitions.find(
  (item) => item.initialDisposition === "coalesced_duplicate",
);
const coalesced = await modules.trialControls.buildLrsR1TrialEvent({
  trialId: duplicateTrial.trialId,
  sequence: 0,
  disposition: "coalesced",
  recordedAtUtc: "2026-08-14T00:00:00.000Z",
  reasonCodes: ["accepted_duplicate_parameter_hash"],
  evidenceIds: [],
});
assert.equal(coalesced.disposition, "coalesced");

console.log(
  JSON.stringify(
    {
      status: "passed",
      attempts: 128,
      unique: 125,
      duplicates: 3,
      checkpointRestart: true,
      immutableConflict: true,
      resourceBounds: true,
      authority: "none/none/none",
      holdoutUsed: false,
    },
    null,
    2,
  ),
);
