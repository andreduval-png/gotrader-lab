#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadLrsBaselineModules } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";
import {
  finalizeR1EvidenceArchive,
  prepareR1CompletedTrialEvidenceArchive,
  r1EvidenceBundlePathFor,
  verifyR1EvidenceArchive
} from "./support/liquidity-reclaim-scalper-r1-evidence-capacity.mjs";
import {
  buildR1ChildTelemetry,
  openR1Controller,
  verifyAcceptedR1Inputs,
  writeR1ChildTelemetry,
  writeR1ControllerCheckpoint
} from "./support/liquidity-reclaim-scalper-r1-executor.mjs";

const root = process.cwd();
const outputRoot = path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/r1-evidence-capacity-test");
fs.rmSync(outputRoot, { recursive: true, force: true });
const modules = await loadLrsBaselineModules(path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/compiled-r1-evidence-capacity-test"));
const { definitions } = await verifyAcceptedR1Inputs({ modules,
  acceptancePath: path.join(root, "docs/gotrader-strategies/liquidity-reclaim-scalper/r1-trial-controls-acceptance.json") });
const trial = definitions.find((item) => item.initialDisposition === "planned_unique");
const selectedTrialIds = [trial.trialId];
const controllerCommit = "e".repeat(40);
const opened = await openR1Controller({ modules, outputRoot, mode: "pilot", selectedTrialIds, controllerCommit });

const telemetryIds = [];
for (let index = 0; index < 2; index += 1) {
  const telemetry = await buildR1ChildTelemetry(modules, {
    childRun: index + 1,
    trialId: trial.trialId,
    trialOrdinal: trial.ordinal,
    childOrdinal: index,
    startedAtUtc: `2026-08-15T00:0${index}:00.000Z`,
    completedAtUtc: `2026-08-15T00:0${index}:30.000Z`,
    exitStatus: 75,
    resultReason: "controlled_memory_recycle",
    maximumObservedRssBytes: 320_000_000 + index,
    resourceDecision: "within_limit",
    stageTelemetry: [{ stage: "after_segment_context", sampleCount: 1, maximumRssBytes: 320_000_000 + index,
      lastRssBytes: 320_000_000 + index }],
    previousTelemetryId: telemetryIds.at(-1)
  });
  await writeR1ChildTelemetry({ modules, storage: opened.storage, telemetry });
  telemetryIds.push(telemetry.telemetryId);
}

const trialDirectory = trial.trialId.replace("sha256:", "sha256_");
const evidence = {
  [`trials/${trialDirectory}/checkpoints/scan.json`]: `${JSON.stringify({ checkpointId: `sha256:${"1".repeat(64)}`, seenFactIds: Array(200).fill("fact") })}\n`,
  [`trials/${trialDirectory}/bt2/records/record.json`]: `${JSON.stringify({ recordId: `sha256:${"2".repeat(64)}`, outcome: "stop" })}\n`,
  [`trials/${trialDirectory}/bt2/ledgers/ledger.json`]: `${JSON.stringify({ ledgerId: `sha256:${"3".repeat(64)}`, orderedRecordIds: [`sha256:${"2".repeat(64)}`] })}\n`,
  [`trials/${trialDirectory}/baseline-report.json`]: `${JSON.stringify({ reportId: `sha256:${"4".repeat(64)}` })}\n`
};
for (const [relativePath, text] of Object.entries(evidence)) await opened.storage.adapter.writeTextAtomic(relativePath, text);

const manifest = await prepareR1CompletedTrialEvidenceArchive({ modules, storage: opened.storage, outputRoot, trial,
  orderedChildTelemetryIds: telemetryIds });
const repeated = await prepareR1CompletedTrialEvidenceArchive({ modules, storage: opened.storage, outputRoot, trial,
  orderedChildTelemetryIds: telemetryIds });
assert.equal(repeated.archiveId, manifest.archiveId);
assert.equal(manifest.entryCount, 5);
assert.ok(manifest.compressedBytes < manifest.originalBytes);
await verifyR1EvidenceArchive({ modules, storage: opened.storage, archiveId: manifest.archiveId, expectedTrialId: trial.trialId });

const checkpoint = await writeR1ControllerCheckpoint({ modules, storage: opened.storage, input: {
  mode: "pilot",
  selectedTrialIds,
  nextPosition: 1,
  dispositions: [{ trialId: trial.trialId, ordinal: trial.ordinal, disposition: "completed", evidenceArchiveId: manifest.archiveId }],
  orderedEventIds: [],
  controllerCommit,
  startedAtUtc: opened.checkpoint.startedAtUtc,
  childRuns: 2,
  maximumObservedRssBytes: 320_000_001,
  telemetryStartChildRun: 0,
  orderedChildTelemetryIds: telemetryIds
} });
const reopened = await openR1Controller({ modules, outputRoot, mode: "pilot", selectedTrialIds, controllerCommit });
assert.equal(reopened.checkpoint.checkpointId, checkpoint.checkpointId);
for (const entry of manifest.entries) {
  assert.equal(fs.existsSync(opened.storage.resolveSafe(entry.relativePath)), false);
  if (entry.relativePath.startsWith("telemetry/")) assert.ok(await opened.storage.adapter.readText(entry.relativePath));
  else assert.equal(await opened.storage.adapter.readText(entry.relativePath), undefined);
}
const bundleRelativePath = r1EvidenceBundlePathFor(manifest.archiveId);
assert.equal(fs.existsSync(opened.storage.resolveSafe(bundleRelativePath)), true);
assert.equal(fs.existsSync(opened.storage.resolveSafe(`trials/${trialDirectory}/baseline-report.json`)), true);

const compressedPath = opened.storage.resolveSafe(bundleRelativePath);
const originalCompressed = fs.readFileSync(compressedPath);
fs.writeFileSync(compressedPath, Buffer.from("corrupt"));
await assert.rejects(
  verifyR1EvidenceArchive({ modules, storage: opened.storage, archiveId: manifest.archiveId, expectedTrialId: trial.trialId }),
  /bundle integrity/
);
fs.writeFileSync(compressedPath, originalCompressed);
await verifyR1EvidenceArchive({ modules, storage: opened.storage, archiveId: manifest.archiveId, expectedTrialId: trial.trialId });
await finalizeR1EvidenceArchive({ storage: opened.storage, manifest });

console.log(JSON.stringify({
  status: "passed",
  archiveId: manifest.archiveId,
  deterministicIdentity: true,
  roundtripVerified: true,
  controllerBound: true,
  crashCleanupIdempotent: true,
  corruptionRejected: true,
  entryCount: manifest.entryCount,
  originalBytes: manifest.originalBytes,
  compressedBytes: manifest.compressedBytes,
  authority: "none/none/none"
}, null, 2));
