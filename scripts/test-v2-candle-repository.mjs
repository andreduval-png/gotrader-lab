#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-candle-repository-test");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
  "src/lib/v2/candles/v2Mt5ReadOnlyAdapter.ts",
  "src/lib/v2/candles/v2ReplaySnapshotAdapter.ts",
  "src/lib/v2/candles/v2PushFeedAdapter.ts",
  "src/lib/v2/candles/v2RepositoryRegistry.ts",
  "src/lib/v2/candles/v2CandleComparison.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });

const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const authorityModule = await load("v2Authority");
const serializationModule = await load("canonicalSerialization");
const identityModule = await load("v2Identity");
const identityTypesModule = await load("v2IdentityTypes");
const candleTypesModule = await load("v2CandleTypes");
const validationModule = await load("v2CandleValidation");
const staticRepositoryModule = await load("v2StaticCandleRepository");
const mt5AdapterModule = await load("v2Mt5ReadOnlyAdapter");
const replayAdapterModule = await load("v2ReplaySnapshotAdapter");
const pushAdapterModule = await load("v2PushFeedAdapter");
const registryModule = await load("v2RepositoryRegistry");
const comparisonModule = await load("v2CandleComparison");

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
assert.deepEqual(authorityModule.V2_AUTHORITY_NONE, authority);
assert.deepEqual(authorityModule.V2_MARKET_DATA_READ_ONLY.authority, authority);
assert.equal(authorityModule.V2_MARKET_DATA_READ_ONLY.marketDataAccess, "read_only");
assert.equal(authorityModule.V2_MARKET_DATA_READ_ONLY.transportCapability, "market_data_read_only");
assert.throws(
  () => authorityModule.assertV2Authority({ ...authority, brokerAuthority: "read_only" }),
  /must remain execution none/i
);

const serializedA = serializationModule.canonicalSerialize({
  z: 2,
  a: { second: "line1\r\nline2", first: 1 },
  semanticOrder: ["second", "first"],
  workspacePath: "C:\\workspace\\file"
});
const serializedB = serializationModule.canonicalSerialize({
  semanticOrder: ["second", "first"],
  workspacePath: "C:/workspace/file",
  a: { first: 1, second: "line1\nline2" },
  z: 2
});
assert.equal(serializedA, serializedB, "Canonical serialization must normalize key order, line endings, and path fields.");
assert.throws(() => serializationModule.canonicalSerialize({ value: undefined }), /rejects undefined/i);
assert.throws(() => serializationModule.canonicalSerialize({ value: () => true }), /rejects function/i);
const cyclic = {};
cyclic.self = cyclic;
assert.throws(() => serializationModule.canonicalSerialize(cyclic), /cyclic/i);
const hashA = await serializationModule.canonicalHash({ b: 2, a: 1 });
const hashB = await serializationModule.canonicalHash({ a: 1, b: 2 });
const hashChanged = await serializationModule.canonicalHash({ a: 1, b: 3 });
assert.equal(hashA, hashB);
assert.notEqual(hashA, hashChanged);
assert.match(hashA, /^sha256:[a-f0-9]{64}$/);

const createIdentity = ({
  fingerprint = "legacy-fingerprint-unchanged",
  kind = "mt5_read_only",
  provider = "mt5_read_only",
  sourceId = "mt5-feed-1"
} = {}) => identityModule.createV2SourceIdentity({
  sourceId,
  provider,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: fingerprint,
  sourceKind: kind
});

const mt5Identity = createIdentity();
assert.equal(mt5Identity.requestedSymbol, "MNQ");
assert.equal(mt5Identity.brokerSymbol, "USTECH");
assert.equal(mt5Identity.sourceFingerprint, "legacy-fingerprint-unchanged");
assert.equal(mt5Identity.marketDataAccess, "read_only");

const identityA = await identityModule.buildV2MarketDataIdentity({
  source: mt5Identity,
  timeframeFingerprints: { "15m": "f15", "5m": "f5" },
  dataWindowStart: "2026-06-12T14:00:00.000Z",
  dataWindowEnd: "2026-06-12T14:15:00.000Z",
  lastClosedCandle: "2026-06-12T14:15:00.000Z",
  candleCountByTimeframe: { "15m": 1, "5m": 3 }
});
const identityB = await identityModule.buildV2MarketDataIdentity({
  source: mt5Identity,
  timeframeFingerprints: { "5m": "f5", "15m": "f15" },
  dataWindowStart: "2026-06-12T14:00:00.000Z",
  dataWindowEnd: "2026-06-12T14:15:00.000Z",
  lastClosedCandle: "2026-06-12T14:15:00.000Z",
  candleCountByTimeframe: { "5m": 3, "15m": 1 }
});
assert.equal(identityA.identityHash, identityB.identityHash, "Timeframe-map insertion order must not change identity.");
const identityDifferentSourceKind = await identityModule.buildV2MarketDataIdentity({
  ...identityA,
  source: createIdentity({ kind: "imported_historical", provider: "imported_historical" })
});
assert.notEqual(identityA.identityHash, identityDifferentSourceKind.identityHash);
assert.equal(identityA.identitySchemaVersion, identityTypesModule.V2_IDENTITY_SCHEMA_VERSION);

const candles = [0, 1, 2].map((index) => ({
  timestamp: new Date(Date.parse("2026-06-12T14:00:00.000Z") + index * 300_000).toISOString(),
  open: 21_000 + index,
  high: 21_010 + index,
  low: 20_995 + index,
  close: 21_005 + index,
  volume: 100 + index
}));
const asOf = "2026-06-12T14:20:00.000Z";
const query = {
  source: mt5Identity,
  timeframe: "5m",
  limit: 3,
  closedOnly: true,
  purpose: "current_read"
};
const sourceSnapshot = {
  identity: mt5Identity,
  timeframe: "5m",
  candles,
  closurePolicy: "elapsed_time",
  stale: false,
  warnings: []
};
const repository = staticRepositoryModule.createV2StaticCandleRepository({
  adapterId: "test-static",
  asOf: () => asOf,
  loadSource: async (requested) => requested.sourceId === mt5Identity.sourceId ? sourceSnapshot : undefined
});
const validWindow = await repository.getWindow(query);
assert.equal(validWindow.diagnostics.status, "eligible");
assert.equal(validWindow.candles.length, 3);
assert.equal(validWindow.candles[0].openTime, "2026-06-12T14:00:00.000Z");
assert.equal(validWindow.candles[0].closeTime, "2026-06-12T14:05:00.000Z");
assert.equal(validWindow.candles[0].closureSource, "timeframe_elapsed");
assert.equal(validWindow.shadowOnly, true);
assert.equal(validWindow.evidencePolicy.repositoryCreatesEvidence, false);
assert.equal(validWindow.evidencePolicy.mayCreateEvidence, false);
assert.deepEqual(validWindow.capability.authority, authority);
assert.equal(Object.isFrozen(validWindow), true);
assert.equal(Object.isFrozen(validWindow.candles), true);
assert.equal(Object.isFrozen(validWindow.candles[0]), true);
assert.throws(() => validWindow.candles.push(candles[0]), TypeError);
assert.doesNotMatch(serializationModule.canonicalSerialize(validWindow.identity), /candles|password|secret|account|order|position/i);

const baseCandidates = candles.map((candle) => ({
  openTime: candle.timestamp,
  closeTime: new Date(Date.parse(candle.timestamp) + 300_000).toISOString(),
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
  volume: candle.volume,
  isClosed: true,
  closureSource: "historical_dataset"
}));
const validate = (candidateInput, options = {}) => validationModule.validateAndNormalizeV2Candles({
  asOf,
  candidates: candidateInput,
  expectedIntervalMs: 300_000,
  ...options
});
const invalidOhlc = validate([{ ...baseCandidates[0], high: 20_000 }]);
assert.equal(invalidOhlc.diagnostics.status, "blocked");
assert.equal(invalidOhlc.diagnostics.invalidOhlcCount, 1);
const invalidVolume = validate([{ ...baseCandidates[0], volume: -1 }]);
assert.equal(invalidVolume.diagnostics.status, "blocked");
assert.equal(invalidVolume.diagnostics.invalidVolumeCount, 1);
const duplicate = validate([baseCandidates[0], { ...baseCandidates[0] }]);
assert.equal(duplicate.diagnostics.status, "degraded");
assert.equal(duplicate.diagnostics.duplicateCount, 1);
assert.equal(duplicate.candles.length, 1);
const conflictingDuplicate = validate([baseCandidates[0], { ...baseCandidates[0], close: baseCandidates[0].close + 1 }]);
assert.equal(conflictingDuplicate.diagnostics.status, "blocked");
assert.equal(conflictingDuplicate.diagnostics.conflictingDuplicateCount, 1);
const outOfOrder = validate([baseCandidates[1], baseCandidates[0]]);
assert.equal(outOfOrder.diagnostics.status, "degraded");
assert.equal(outOfOrder.diagnostics.outOfOrderCount, 1);
assert.equal(outOfOrder.candles[0].openTime, baseCandidates[0].openTime);
const partial = validate([baseCandidates[0], { ...baseCandidates[1], isClosed: false }]);
assert.equal(partial.diagnostics.status, "degraded");
assert.equal(partial.diagnostics.partialCandleCount, 1);
assert.equal(partial.candles.length, 1);
const unknownClosure = validate([baseCandidates[0], { ...baseCandidates[1], isClosed: undefined }]);
assert.equal(unknownClosure.diagnostics.status, "blocked");
assert.equal(unknownClosure.diagnostics.closureUnknownCount, 1);
const future = validate([{ ...baseCandidates[0], openTime: "2026-06-12T15:00:00.000Z", closeTime: "2026-06-12T15:05:00.000Z" }]);
assert.equal(future.diagnostics.status, "blocked");
assert.equal(future.diagnostics.futureTimestampCount, 1);
const stale = validate(baseCandidates, { sourceStale: true });
assert.equal(stale.diagnostics.status, "blocked");
assert.equal(stale.diagnostics.stale, true);

await assert.rejects(
  () => repository.getWindow({ ...query, limit: 1001 }),
  (error) => error.code === "query_limit_exceeded"
);
await assert.rejects(
  () => repository.getWindow({ ...query, source: createIdentity({ sourceId: "unknown" }) }),
  (error) => error.code === "source_unavailable"
);
await assert.rejects(
  () => repository.getWindow({ ...query, source: createIdentity({ fingerprint: "changed" }) }),
  (error) => error.code === "source_identity_mismatch"
);

const mockIdentity = createIdentity({
  fingerprint: "mock-fingerprint",
  kind: "mock_sample",
  provider: "mock",
  sourceId: "mock:explicit"
});
const mockRepository = staticRepositoryModule.createV2StaticCandleRepository({
  adapterId: "mock-explicit",
  asOf: () => asOf,
  loadSource: async () => ({
    identity: mockIdentity,
    timeframe: "5m",
    candles,
    closurePolicy: "mock_sample",
    stale: false,
    warnings: ["Explicit mock/sample source."]
  })
});
const mockWindow = await mockRepository.getWindow({ ...query, source: mockIdentity });
assert.equal(mockWindow.evidencePolicy.sourceEligible, false);
assert.equal(mockWindow.evidencePolicy.mayCreateEvidence, false);
await assert.rejects(
  () => mockRepository.getWindow({ ...query, source: mockIdentity, purpose: "replay" }),
  (error) => error.code === "mock_evidence_forbidden"
);

const deepCandles = Array.from({ length: 1_200 }, (_, index) => ({
  timestamp: new Date(Date.parse("2026-01-01T00:00:00.000Z") + index * 300_000).toISOString(),
  open: 20_000 + index / 100,
  high: 20_002 + index / 100,
  low: 19_998 + index / 100,
  close: 20_001 + index / 100,
  volume: 100
}));
const importedIdentity = createIdentity({
  fingerprint: "imported-fingerprint",
  kind: "imported_historical",
  provider: "imported_historical",
  sourceId: "import:90d"
});
const deepRepository = staticRepositoryModule.createV2StaticCandleRepository({
  adapterId: "imported-history",
  asOf: () => "2026-06-01T00:00:00.000Z",
  loadSource: async () => ({
    identity: importedIdentity,
    timeframe: "5m",
    candles: deepCandles,
    closurePolicy: "historical_dataset",
    stale: false,
    warnings: []
  })
});
const deepWindow = await deepRepository.getWindow({
  source: importedIdentity,
  timeframe: "5m",
  limit: 1_200,
  closedOnly: true,
  purpose: "deep_research"
});
assert.equal(deepWindow.candles.length, 1_200);
assert.equal(deepWindow.evidencePolicy.mayCreateEvidence, true);

const mt5Feed = {
  feedId: "mt5-feed-1",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  symbol: "MNQ",
  timeframe: "5m",
  candleFingerprint: "legacy-fingerprint-unchanged",
  candles,
  connectionStatus: "connected",
  fetchedAt: asOf,
  warnings: []
};
const mt5Repository = mt5AdapterModule.createV2Mt5ReadOnlyRepository({
  asOf: () => asOf,
  loadFeed: async () => mt5Feed
});
const pollingWindow = await mt5Repository.getWindow(query);
assert.equal(pollingWindow.diagnostics.status, "eligible");

const replayInput = {
  snapshotId: "replay:1",
  sourceFingerprint: "replay-fingerprint",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  candles
};
const replaySnapshot = replayAdapterModule.replayInputToV2Snapshot(replayInput);
const replayRepository = replayAdapterModule.createV2ReplaySnapshotRepository({
  asOf: () => asOf,
  loadSnapshot: async () => replayInput
});
const replayWindow = await replayRepository.getWindow({
  source: replaySnapshot.identity,
  timeframe: "5m",
  closedOnly: true,
  purpose: "replay"
});
assert.equal(replayWindow.candles[0].closureSource, "replay_snapshot");
assert.equal(replayWindow.evidencePolicy.mayCreateEvidence, true);

const pushFingerprint = "push-last-fingerprint";
const pushState = {
  candlesBySeries: {
    "mt5:USTECH:5m": candles.map((candle) => ({
      ...candle,
      brokerSymbol: "USTECH",
      requestedSymbol: "MNQ",
      timeframe: "5m",
      sourceFingerprint: pushFingerprint,
      closed: true,
      serverTimestamp: candle.timestamp,
      receivedAt: asOf
    }))
  },
  status: {
    status: "connected",
    connectionStatus: "connected",
    lastCandleFingerprint: pushFingerprint,
    warnings: []
  }
};
const pushIdentity = pushAdapterModule.createV2SourceIdentityFromPushFeed({
  brokerSymbol: "USTECH",
  requestedSymbol: "MNQ",
  sourceFingerprint: pushFingerprint,
  timeframe: "5m"
});
const pushRepository = pushAdapterModule.createV2PushFeedRepository({
  asOf: () => asOf,
  getState: () => pushState
});
const pushWindow = await pushRepository.getWindow({ ...query, source: pushIdentity });
assert.deepEqual(pushWindow.capability.authority, authority, "Legacy read_only transport must map to strict V2 authority none.");
assert.equal(pushWindow.candles[0].closureSource, "provider_event");
const comparison = comparisonModule.compareV2CandleWindows(pollingWindow, pushWindow);
assert.equal(comparison.status, "equivalent_with_documented_variance");
assert.equal(comparison.ohlcMismatchCount, 0);

pushState.status.status = "stale";
pushState.status.connectionStatus = "degraded";
const stalePushWindow = await pushRepository.getWindow({ ...query, source: pushIdentity });
assert.equal(stalePushWindow.diagnostics.status, "blocked");
assert.equal(stalePushWindow.diagnostics.stale, true);
pushState.status.status = "connected";
pushState.status.connectionStatus = "connected";

const emptyIdentity = createIdentity({ fingerprint: "empty", sourceId: "empty" });
const emptyRepository = staticRepositoryModule.createV2StaticCandleRepository({
  adapterId: "empty",
  asOf: () => asOf,
  loadSource: async () => ({
    identity: emptyIdentity,
    timeframe: "5m",
    candles: [],
    closurePolicy: "historical_dataset"
  })
});
const emptyWindow = await emptyRepository.getWindow({ ...query, source: emptyIdentity });
assert.equal(comparisonModule.compareV2CandleWindows(validWindow, emptyWindow).status, "insufficient_comparison_data");

const registry = registryModule.createV2CandleRepositoryRegistry({ mt5_read_only: mt5Repository });
assert.deepEqual(registry.supportedSourceKinds(), ["mt5_read_only"]);
assert.equal((await registry.getWindow(query)).candles.length, 3);
assert.throws(
  () => registry.getRepository("imported_historical"),
  (error) => error.code === "adapter_unavailable"
);

const repositoryContract = fs.readFileSync(
  path.join(workspace, "src", "lib", "v2", "candles", "v2CandleTypes.ts"),
  "utf8"
);
const repositoryInterface = repositoryContract.match(/export interface V2CandleRepository \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.doesNotMatch(repositoryInterface, /account|order|position|execute|trade|mutation|evidence|readiness/i);
const pushAdapterSource = fs.readFileSync(
  path.join(workspace, "src", "lib", "v2", "candles", "v2PushFeedAdapter.ts"),
  "utf8"
);
assert.doesNotMatch(pushAdapterSource, /publish\(|trigger|runResearch|placeOrder|buyMarket|sellMarket/i);

const v2Root = path.join(workspace, "src", "lib", "v2");
const productionImports = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(fullPath);
    else if (/\.(ts|tsx)$/.test(entry.name) && !fullPath.startsWith(v2Root)) {
      const source = fs.readFileSync(fullPath, "utf8");
      if (/from\s+["'][^"']*(?:\/lib\/v2|\/v2\/)[^"']*["']/.test(source)) {
        productionImports.push(path.relative(workspace, fullPath));
      }
    }
  }
};
visit(path.join(workspace, "src"));
assert.deepEqual(productionImports, [], "No production consumer may adopt the Phase 1 V2 facade.");

const compactResult = {
  status: "passed",
  serializationHash: hashA,
  identityHash: identityA.identityHash,
  identitySchemaVersion: identityTypesModule.V2_IDENTITY_SCHEMA_VERSION,
  candleCount: validWindow.candles.length,
  deepResearchCandleCount: deepWindow.candles.length,
  pushPollingComparison: comparison.status,
  mockEvidenceAllowed: mockWindow.evidencePolicy.mayCreateEvidence,
  productionConsumerCount: productionImports.length,
  authority
};
const compactSerialized = JSON.stringify(compactResult);
assert.doesNotMatch(compactSerialized, /rawCandles|accountData|orderData|positionData|password|secret|apiKey/i);
console.log(JSON.stringify(compactResult, null, 2));
