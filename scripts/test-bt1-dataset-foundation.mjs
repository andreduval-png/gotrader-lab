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
const testRoot = path.resolve(workspace, ".gotrader", "bt1-dataset-foundation-test");
assert.ok(testRoot.startsWith(`${path.resolve(workspace, ".gotrader")}${path.sep}`));
fs.rmSync(testRoot, { recursive: true, force: true });

const modules = await loadBt1Modules({ outRoot: path.join(testRoot, "compiled") });
const fixture = await buildFixtureRequest(modules);
const firstSource = createFixtureProvider(fixture.description);
const firstStorage = createHistoricalDatasetNodeStorage({ root: path.join(testRoot, "dataset-a") });
const firstRepository = new modules.repository.HistoricalDatasetRepository({
  storage: firstStorage.adapter,
  now: () => "2024-01-03T00:00:00.000Z"
});
const first = await firstRepository.createDataset(fixture.request, firstSource.provider);

assert.equal(first.action, "created");
assert.equal(first.verification.status, "verified");
assert.equal(first.manifest.historicalTimeVerified, true);
assert.equal(first.manifest.historicalDstVerified, true);
assert.equal(first.manifest.authoritativeScope, "historical_ohlc_only");
assert.equal(first.manifest.rawHistoricalOhlcPersisted, true);
assert.equal(first.manifest.researchOnly, true);
assert.deepEqual(first.manifest.authority, {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
assert.ok(Object.values(first.manifest.capabilities).every((value) => value === false));
assert.equal((await firstRepository.readCandles(first.manifest.datasetId, "1m")).length, 15);
assert.equal((await firstRepository.readCandles(first.manifest.datasetId, "5m")).length, 3);
assert.equal((await firstRepository.readCandles(first.manifest.datasetId, "15m")).length, 1);
assert.equal(first.manifest.timeframes.find((item) => item.timeframe === "1m")?.candleCount, 15);
assert.ok(first.manifest.warnings.some((warning) => warning.includes("duplicate")));
assert.equal(firstSource.fetchCount, 2);

const coalesced = await firstRepository.createDataset(fixture.request, firstSource.provider);
assert.equal(coalesced.action, "coalesced");
assert.equal(coalesced.manifest.datasetId, first.manifest.datasetId);
assert.equal(firstSource.fetchCount, 2, "A completed request must not fetch source pages again.");

const secondSource = createFixtureProvider(fixture.description);
const secondStorage = createHistoricalDatasetNodeStorage({ root: path.join(testRoot, "dataset-b") });
const secondRepository = new modules.repository.HistoricalDatasetRepository({
  storage: secondStorage.adapter,
  now: () => "2024-01-03T00:00:00.000Z"
});
const reproduced = await secondRepository.createDataset(fixture.request, secondSource.provider);
assert.equal(reproduced.verification.status, "verified");
assert.equal(reproduced.manifest.datasetId, first.manifest.datasetId);
assert.equal(reproduced.manifest.datasetChecksum, first.manifest.datasetChecksum);
assert.deepEqual(reproduced.manifest.timeframes, first.manifest.timeframes);

const changedFixture = await buildFixtureRequest(modules, {
  request: { creationPolicyVersion: "2" }
});
const changedIdentity = await modules.contracts.deriveHistoricalDatasetRequestIdentity(
  changedFixture.request,
  changedFixture.description
);
assert.notEqual(changedIdentity.requestId, first.manifest.requestId);

const lineageNode = await modules.lineage.buildHistoricalDatasetLineageNode(first.manifest);
assert.equal(lineageNode.nodeClass, "external_authoritative");
assert.equal(lineageNode.canonicalArtifactId, first.manifest.datasetId);
assert.equal(lineageNode.identityMetadata.datasetChecksum, first.manifest.datasetChecksum);
assert.equal(lineageNode.authority.executionAuthority, "none");

let requestedUrl;
let requestedMethod;
const adapter = modules.mt5Provider.createMt5ReadOnlyHistoricalProvider({
  baseUrl: "http://127.0.0.1:7341",
  providerVersion: "fixture-wrapper-v1",
  providerTimeBasis: "utc_iso",
  fetchImpl: async (url, init) => {
    requestedUrl = String(url);
    requestedMethod = init?.method;
    return new Response(JSON.stringify({
      candles: [
        { timestamp: "2024-01-02T00:00:00.000Z", open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, spread: 2 },
        { timestamp: "2024-01-02T00:01:00.000Z", open: 1.5, high: 2.5, low: 1, close: 2, volume: 11, spread: 2 }
      ],
      warnings: [],
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none"
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
});
const adapterPage = await adapter.fetchPage({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "1m",
  startUtc: "2024-01-02T00:00:00.000Z",
  endUtc: "2024-01-02T00:02:00.000Z",
  limit: 2
});
assert.equal(requestedMethod, "GET");
assert.match(requestedUrl, /^http:\/\/127\.0\.0\.1:7341\/candles\/range\?/);
assert.equal(adapterPage.candles.length, 2);
assert.equal(adapterPage.authority.executionAuthority, "none");
assert.throws(
  () => modules.mt5Provider.createMt5ReadOnlyHistoricalProvider({
    baseUrl: "https://example.com",
    providerVersion: "invalid",
    providerTimeBasis: "utc_iso"
  }),
  /loopback-only/i
);

await assert.rejects(
  () => firstStorage.adapter.readText("../escape.json"),
  /path is invalid|escaped/i
);

console.log(JSON.stringify({
  status: "passed",
  datasetId: first.manifest.datasetId,
  datasetChecksum: first.manifest.datasetChecksum,
  sourceCandles: 15,
  derived: { "5m": 3, "15m": 1 },
  sourcePages: firstSource.fetchCount,
  reproducedDatasetId: reproduced.manifest.datasetId,
  mt5AdapterNetworkUsed: false,
  authority: first.manifest.authority
}, null, 2));
