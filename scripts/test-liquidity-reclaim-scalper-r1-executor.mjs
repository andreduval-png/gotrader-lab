#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadLrsBaselineModules } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";
import {
  enforceR1ResourceBounds,
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

const updated = await writeR1ControllerCheckpoint({
  modules,
  storage: opened.storage,
  input: {
    mode: "pilot",
    selectedTrialIds,
    nextPosition: 1,
    dispositions: [
      { trialId: selectedTrialIds[0], disposition: "completed" },
    ],
    orderedEventIds: [`sha256:${"1".repeat(64)}`],
    controllerCommit,
    startedAtUtc: opened.checkpoint.startedAtUtc,
    childRuns: 3,
    maximumObservedRssBytes: 400_000_000,
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
