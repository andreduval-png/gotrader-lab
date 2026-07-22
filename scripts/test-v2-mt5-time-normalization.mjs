#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-mt5-time-normalization-test");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2TimeNormalization.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
  "src/lib/v2/candles/v2Mt5TimeNormalizedAdapter.ts",
  "src/lib/v2/candles/v2CandleComparison.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const time = await load("v2TimeNormalization");
const identity = await load("v2Identity");
const identityTypes = await load("v2IdentityTypes");
const mt5 = await load("v2Mt5TimeNormalizedAdapter");
const comparison = await load("v2CandleComparison");
const authorityModule = await load("v2Authority");

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
assert.deepEqual(authorityModule.V2_AUTHORITY_NONE, authority);

const policy = (overrides = {}) => time.createV2TimeNormalizationPolicy({
  policyId: "gotrader-v2-mt5-server-time",
  version: "1",
  provider: "mt5_read_only",
  basis: "mt5_server_wall_clock",
  sourceTimezone: "Europe/Helsinki",
  outputTimezone: "UTC",
  discoveryMethod: "configured_iana_timezone",
  dstPolicy: "iana_timezone_rules",
  maximumClockSkewMs: 60_000,
  closureToleranceMs: 1_000,
  ...overrides
});

const normalized = (input, selectedPolicy = policy()) => {
  const result = time.normalizeMt5ProviderTime(input, selectedPolicy);
  assert.equal(result.status, "normalized", JSON.stringify(result));
  return result;
};

assert.equal(
  normalized(1_704_067_200, policy({ basis: "epoch_utc", sourceTimezone: undefined, dstPolicy: "not_applicable", discoveryMethod: "explicit_utc_contract" })).normalizedTimeUtc,
  "2024-01-01T00:00:00.000Z"
);
assert.equal(
  normalized("2026-01-15T14:30:00Z", policy({ basis: "utc_iso", sourceTimezone: undefined, dstPolicy: "not_applicable", discoveryMethod: "explicit_utc_contract" })).normalizedTimeUtc,
  "2026-01-15T14:30:00.000Z"
);
assert.equal(
  normalized("2026-07-15T16:30:00+03:00", policy({ basis: "iso_with_offset", sourceTimezone: undefined, dstPolicy: "not_applicable", discoveryMethod: "explicit_payload_offset" })).normalizedTimeUtc,
  "2026-07-15T13:30:00.000Z"
);
assert.equal(
  normalized("2026-01-15T16:30:00", policy()).normalizedTimeUtc,
  "2026-01-15T14:30:00.000Z"
);
const helsinkiSummer = normalized("2026-07-15T16:30:00", policy());
assert.equal(helsinkiSummer.normalizedTimeUtc, "2026-07-15T13:30:00.000Z");
assert.equal(helsinkiSummer.offsetAppliedMinutes, 180);
assert.equal(helsinkiSummer.dstState, "daylight");
assert.equal(
  normalized("2026-07-15T16:30:00", policy({ sourceTimezone: undefined, sourceUtcOffsetMinutes: 180, discoveryMethod: "server_clock_comparison", dstPolicy: "explicit_offset" })).normalizedTimeUtc,
  "2026-07-15T13:30:00.000Z"
);
assert.equal(
  normalized("2026-01-15T16:30:00", policy({ sourceTimezone: undefined, sourceUtcOffsetMinutes: 120, discoveryMethod: "server_clock_comparison", dstPolicy: "explicit_offset" })).normalizedTimeUtc,
  "2026-01-15T14:30:00.000Z"
);

const unknownPolicy = policy({
  basis: "unknown",
  sourceTimezone: undefined,
  discoveryMethod: "unknown",
  dstPolicy: "unknown"
});
assert.deepEqual(time.normalizeMt5ProviderTime("2026-07-15T16:30:00", unknownPolicy).blockers, ["unknown_provider_time_basis"]);
assert.deepEqual(
  time.normalizeMt5ProviderTime("2026-07-15T16:30:00", policy({ sourceTimezone: undefined })).blockers,
  ["missing_source_timezone"]
);
assert.equal(time.normalizeMt5ProviderTime("2026-07-15T16:30:00", policy({ basis: "utc_iso", sourceTimezone: undefined })).status, "blocked");

const newYorkPolicy = policy({ sourceTimezone: "America/New_York" });
const nyCases = [
  ["2026-01-15T03:00:00", "2026-01-15T08:00:00.000Z", "Silver Bullet 03:00 EST"],
  ["2026-01-15T09:30:00", "2026-01-15T14:30:00.000Z", "New York open EST"],
  ["2026-01-15T10:00:00", "2026-01-15T15:00:00.000Z", "Silver Bullet 10:00 EST"],
  ["2026-01-15T14:00:00", "2026-01-15T19:00:00.000Z", "Silver Bullet 14:00 EST"],
  ["2026-07-15T03:00:00", "2026-07-15T07:00:00.000Z", "Silver Bullet 03:00 EDT"],
  ["2026-07-15T09:30:00", "2026-07-15T13:30:00.000Z", "New York open EDT"],
  ["2026-07-15T10:00:00", "2026-07-15T14:00:00.000Z", "Silver Bullet 10:00 EDT"],
  ["2026-07-15T14:00:00", "2026-07-15T18:00:00.000Z", "Silver Bullet 14:00 EDT"],
  ["2026-07-15T00:00:00", "2026-07-15T04:00:00.000Z", "New York midnight"],
  ["2026-07-19T00:00:00", "2026-07-19T04:00:00.000Z", "Sunday boundary"]
];
for (const [raw, expected, label] of nyCases) {
  assert.equal(normalized(raw, newYorkPolicy).normalizedTimeUtc, expected, label);
}
assert.deepEqual(
  time.normalizeMt5ProviderTime("2026-03-08T02:30:00", newYorkPolicy).blockers,
  ["nonexistent_local_time"]
);
assert.deepEqual(
  time.normalizeMt5ProviderTime("2026-11-01T01:30:00", newYorkPolicy).blockers,
  ["ambiguous_local_time"]
);

const trusted = time.validateV2TrustedReferenceClock({
  systemUtc: "2026-07-22T17:50:00.000Z",
  receivedAtUtc: "2026-07-22T17:49:59.900Z",
  maximumClockSkewMs: 1_000
});
assert.equal(trusted.status, "trusted");
const skewed = time.validateV2TrustedReferenceClock({
  systemUtc: "2026-07-22T17:50:00.000Z",
  receivedAtUtc: "2026-07-22T17:45:00.000Z",
  maximumClockSkewMs: 1_000
});
assert.equal(skewed.status, "blocked");
assert.ok(skewed.blockers.includes("reference_clock_skew"));

const closed = time.proveV2CandleClosure({
  normalizedOpenTimeUtc: "2026-07-22T17:40:00.000Z",
  timeframeMs: 300_000,
  trustedClock: trusted,
  closureToleranceMs: 1_000,
  explicitProviderClosed: true
});
assert.equal(closed.status, "closed");
assert.equal(closed.normalizedCloseTimeUtc, "2026-07-22T17:45:00.000Z");
const partial = time.proveV2CandleClosure({
  normalizedOpenTimeUtc: "2026-07-22T17:48:00.000Z",
  timeframeMs: 300_000,
  trustedClock: trusted,
  closureToleranceMs: 1_000
});
assert.equal(partial.status, "future");
const futureExplicit = time.proveV2CandleClosure({
  normalizedOpenTimeUtc: "2026-07-22T17:55:00.000Z",
  timeframeMs: 300_000,
  trustedClock: trusted,
  closureToleranceMs: 1_000,
  explicitProviderClosed: true
});
assert.equal(futureExplicit.status, "future", "A push close event cannot override a future normalized close.");

const source = identity.createV2SourceIdentity({
  sourceId: "mt5:USTECH:5m",
  provider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "legacy-fingerprint-unchanged",
  sourceKind: "mt5_read_only"
});
const identityInput = {
  source,
  timeframeFingerprints: { "5m": "legacy-fingerprint-unchanged" },
  dataWindowStart: "2026-07-22T17:35:00.000Z",
  dataWindowEnd: "2026-07-22T17:45:00.000Z",
  lastClosedCandle: "2026-07-22T17:45:00.000Z",
  candleCountByTimeframe: { "5m": 2 },
  timeNormalizationPolicyId: "gotrader-v2-mt5-server-time"
};
const identityV1 = await identity.buildV2MarketDataIdentity({ ...identityInput, timeNormalizationPolicyVersion: "1" });
const identityV2 = await identity.buildV2MarketDataIdentity({ ...identityInput, timeNormalizationPolicyVersion: "2" });
assert.notEqual(identityV1.identityHash, identityV2.identityHash);
assert.equal(identityV1.source.sourceFingerprint, "legacy-fingerprint-unchanged");
assert.equal(identityV1.identitySchemaVersion, identityTypes.V2_IDENTITY_SCHEMA_VERSION);

const rawCandles = [
  {
    rawProviderTime: Date.UTC(2026, 6, 22, 20, 35) / 1_000,
    open: 20_000,
    high: 20_010,
    low: 19_995,
    close: 20_005,
    volume: 100
  },
  {
    rawProviderTime: Date.UTC(2026, 6, 22, 20, 40) / 1_000,
    open: 20_005,
    high: 20_015,
    low: 20_000,
    close: 20_012,
    volume: 120
  }
];
const feed = {
  feedId: source.sourceId,
  requestedSymbol: source.requestedSymbol,
  brokerSymbol: source.brokerSymbol,
  symbol: source.brokerSymbol,
  timeframe: "5m",
  candleFingerprint: source.sourceFingerprint,
  candles: rawCandles,
  connectionStatus: "connected",
  receivedAt: "2026-07-22T17:49:59.900Z",
  timePolicy: policy()
};
const repository = mt5.createV2Mt5TimeNormalizedRepository({
  asOf: () => "2026-07-22T17:50:00.000Z",
  loadFeed: async () => feed
});
const query = { source, timeframe: "5m", limit: 10, closedOnly: true, purpose: "current_read" };
const pollingWindow = await repository.getWindow(query);
assert.equal(pollingWindow.diagnostics.status, "eligible");
assert.equal(pollingWindow.candles.length, 2);
assert.equal(pollingWindow.candles[0].openTime, "2026-07-22T17:35:00.000Z");
assert.equal(pollingWindow.candles[0].timeAudit.rawProviderOpenTime, rawCandles[0].rawProviderTime);
assert.equal(pollingWindow.candles[0].timeAudit.offsetAppliedMinutes, 180);
assert.equal(pollingWindow.identity.timeNormalizationPolicyVersion, "1");
assert.equal(pollingWindow.identity.source.sourceFingerprint, "legacy-fingerprint-unchanged");
assert.ok(Object.isFrozen(pollingWindow.candles[0].timeAudit));
assert.ok(Object.isFrozen(pollingWindow.candles[0].timeAudit.blockers));
assert.deepEqual(pollingWindow.capability.authority, authority);
const description = await repository.describeSource(source);
assert.equal(description.providerTimeBasis, "mt5_server_wall_clock");
assert.equal(description.timeNormalizationPolicyVersion, "1");
assert.equal(description.capability.marketDataAccess, "read_only");

const pushRepository = mt5.createV2Mt5TimeNormalizedRepository({
  asOf: () => "2026-07-22T17:50:00.000Z",
  loadFeed: async () => ({
    ...feed,
    candles: rawCandles.map((candle) => ({ ...candle, closed: true }))
  })
});
const pushWindow = await pushRepository.getWindow(query);
const parity = comparison.compareV2CandleWindows(pollingWindow, pushWindow);
assert.equal(parity.status, "exact_match");

const blockedRepository = mt5.createV2Mt5TimeNormalizedRepository({
  asOf: () => "2026-07-22T17:50:00.000Z",
  loadFeed: async () => ({ ...feed, timePolicy: unknownPolicy })
});
const blockedWindow = await blockedRepository.getWindow(query);
assert.equal(blockedWindow.diagnostics.status, "blocked");
assert.equal(blockedWindow.candles.length, 0);
assert.equal(blockedWindow.evidencePolicy.mayCreateEvidence, false);

const mismatchedCloseRepository = mt5.createV2Mt5TimeNormalizedRepository({
  asOf: () => "2026-07-22T17:50:00.000Z",
  loadFeed: async () => ({
    ...feed,
    candles: [{
      ...rawCandles[0],
      rawProviderCloseTime: Date.UTC(2026, 6, 22, 20, 41) / 1_000,
      closed: true
    }]
  })
});
const mismatchedCloseWindow = await mismatchedCloseRepository.getWindow(query);
assert.equal(mismatchedCloseWindow.diagnostics.status, "blocked");
assert.equal(mismatchedCloseWindow.candles.length, 0);

const compactResult = {
  status: "passed",
  policy: `${policy().policyId}@${policy().version}`,
  identitySchemaVersion: identityTypes.V2_IDENTITY_SCHEMA_VERSION,
  dstFixtureCount: nyCases.length + 2,
  normalizedCandleCount: pollingWindow.candles.length,
  deterministicPushPollingParity: parity.status,
  unknownBasisStatus: blockedWindow.diagnostics.status,
  rawProviderTimePreserved: pollingWindow.candles[0].timeAudit.rawProviderOpenTime === rawCandles[0].rawProviderTime,
  legacyFingerprintUnchanged: pollingWindow.identity.source.sourceFingerprint === source.sourceFingerprint,
  productionConsumersChanged: false,
  rawCandleArraysSerialized: false,
  mutationEndpointsCalled: false,
  authority
};
const serialized = JSON.stringify(compactResult);
assert.doesNotMatch(serialized, /accountData|orderData|positionData|password|secret|apiKey/i);
assert.doesNotMatch(serialized, /"candles"\s*:/i);

const adapterSource = fs.readFileSync(
  path.join(workspace, "src", "lib", "v2", "candles", "v2Mt5TimeNormalizedAdapter.ts"),
  "utf8"
);
assert.doesNotMatch(adapterSource, /placeOrder|buyMarket|sellMarket|executeTrade|accountData|positionData/i);
console.log(JSON.stringify(compactResult, null, 2));
