#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHistoricalDatasetNodeStorage } from "./support/historical-dataset-node-storage.mjs";
import {
  buildFixtureRequest,
  createFixtureProvider,
  loadBt1Modules
} from "./support/bt1-dataset-fixtures.mjs";

const workspace = process.cwd();
const testRoot = path.resolve(workspace, ".gotrader", "bt1-dataset-restart-test");
assert.ok(testRoot.startsWith(`${path.resolve(workspace, ".gotrader")}${path.sep}`));
fs.rmSync(testRoot, { recursive: true, force: true });

const modules = await loadBt1Modules({ outRoot: path.join(testRoot, "compiled") });
const fixture = await buildFixtureRequest(modules);
const source = createFixtureProvider(fixture.description);
const storage = createHistoricalDatasetNodeStorage({ root: path.join(testRoot, "dataset") });
let checkpointWrites = 0;
let interruptionInjected = false;
const interruptedAdapter = Object.freeze({
  readText: storage.adapter.readText,
  listFiles: storage.adapter.listFiles,
  async writeTextAtomic(relativePath, value) {
    if (relativePath.startsWith("checkpoints/")) {
      checkpointWrites += 1;
      if (checkpointWrites === 2) {
        interruptionInjected = true;
        const error = new Error("Injected process interruption after immutable partition write.");
        error.code = "EIO";
        throw error;
      }
    }
    return storage.adapter.writeTextAtomic(relativePath, value);
  }
});
const interruptedRepository = new modules.repository.HistoricalDatasetRepository({
  storage: interruptedAdapter,
  now: () => "2024-01-03T00:00:00.000Z"
});

await assert.rejects(
  () => interruptedRepository.createDataset(fixture.request, source.provider),
  /Injected process interruption/
);
assert.equal(interruptionInjected, true);
assert.equal((await storage.adapter.listFiles("partitions")).length, 1);
assert.equal((await storage.adapter.listFiles("checkpoints")).length, 1);

const resumedRepository = new modules.repository.HistoricalDatasetRepository({
  storage: storage.adapter,
  now: () => "2024-01-03T00:00:00.000Z"
});
const resumed = await resumedRepository.createDataset(fixture.request, source.provider);
assert.equal(resumed.action, "resumed");
assert.equal(resumed.verification.status, "verified");
assert.equal(source.fetchCount, 3, "Only the uncheckpointed first page may be fetched again.");
assert.equal((await resumedRepository.readCandles(resumed.manifest.datasetId, "1m")).length, 15);
assert.equal((await storage.adapter.listFiles("checkpoints")).length, 1);
assert.equal((await storage.adapter.listFiles("partitions")).length, 4);

const coalesced = await resumedRepository.createDataset(fixture.request, source.provider);
assert.equal(coalesced.action, "coalesced");
assert.equal(coalesced.manifest.datasetId, resumed.manifest.datasetId);
assert.equal(source.fetchCount, 3);

const sourceEntry = resumed.manifest.timeframes.find((entry) => entry.timeframe === "1m");
assert.ok(sourceEntry);
const partitionId = sourceEntry.partitionIds[0];
const partitionPath = `partitions/${partitionId.replace(":", "_")}.json`;
const storedPartition = JSON.parse(await storage.adapter.readText(partitionPath));
storedPartition.payload.candles[0].close += 100;
fs.writeFileSync(storage.resolveSafe(partitionPath), JSON.stringify(storedPartition), "utf8");
const tampered = await resumedRepository.verifyDataset(resumed.manifest.datasetId);
assert.equal(tampered.status, "blocked");
assert.ok(tampered.blockers.includes("historical_storage_integrity_mismatch"));

console.log(JSON.stringify({
  status: "passed",
  interruptionPoint: "after_partition_before_checkpoint",
  resumedAction: resumed.action,
  sourceFetchesIncludingIdempotentRefetch: source.fetchCount,
  checkpointFiles: 1,
  partitionFiles: 4,
  canonicalSourceCandles: 15,
  tamperDetected: true,
  tamperBlockers: tampered.blockers
}, null, 2));
