#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildFixtureRequest, loadBt1Modules } from "./support/bt1-dataset-fixtures.mjs";

const workspace = process.cwd();
const testRoot = path.resolve(workspace, ".gotrader", "bt1-5-qualification-contract-test");
assert.ok(testRoot.startsWith(`${path.resolve(workspace, ".gotrader")}${path.sep}`));
fs.rmSync(testRoot, { recursive: true, force: true });

const modules = await loadBt1Modules({ outRoot: path.join(testRoot, "compiled") });
const fixture = await buildFixtureRequest(modules);

assert.equal(fixture.timeAuthority.historicalTimeVerified, true);
assert.equal(fixture.timeAuthority.historicalDstVerified, true);
assert.equal(fixture.timeAuthority.historicalSessionVerified, true);
assert.equal(fixture.timeAuthority.historicalSessionDstVerified, true);
assert.equal(fixture.timeAuthority.evidencePackageId, fixture.evidencePackage.evidencePackageId);
assert.equal(fixture.timeAuthority.calendarId, fixture.calendar.calendarId);
assert.equal(fixture.timeAuthority.normalizationPolicyId, fixture.request.timeNormalizationPolicy.policyId);
assert.match(fixture.timeAuthority.normalizationPolicyHash, /^sha256:[0-9a-f]{64}$/);

assert.deepEqual(
  await modules.qualification.validateHistoricalTimeEvidencePackage(fixture.evidencePackage),
  []
);
assert.deepEqual(
  await modules.qualification.validateHistoricalMarketCalendarSnapshot(fixture.calendar),
  []
);
assert.deepEqual(
  await modules.qualification.validateHistoricalTimeframeAlignmentPolicy(
    fixture.timeframeAlignment,
    ["5m", "15m"]
  ),
  []
);

const tamperedEvidence = Object.freeze({
  ...fixture.evidencePackage,
  verificationVersion: "tampered"
});
assert.ok(
  (await modules.qualification.validateHistoricalTimeEvidencePackage(tamperedEvidence))
    .includes("historical_evidence_package_identity_mismatch")
);

const tamperedCalendar = Object.freeze({
  ...fixture.calendar,
  timezone: "UTC"
});
assert.ok(
  (await modules.qualification.validateHistoricalMarketCalendarSnapshot(tamperedCalendar))
    .includes("historical_market_calendar_identity_mismatch")
);

await assert.rejects(
  () => modules.qualification.buildHistoricalTimeframeAlignmentPolicy({
    version: "invalid-daily-v1",
    anchorOffsetMinutes: 0,
    weekStartsOn: "monday",
    calendarId: fixture.calendar.calendarId,
    evidencePackageId: fixture.evidencePackage.evidencePackageId,
    verificationVersion: "invalid-daily-v1",
    supportedDerivedTimeframes: Object.freeze(["1d", "1w"]),
    verificationStatus: "verified"
  }),
  /use native source bars/i
);

await assert.rejects(
  () => modules.contracts.deriveHistoricalDatasetRequestIdentity(
    Object.freeze({ ...fixture.request, calendar: tamperedCalendar }),
    fixture.description
  ),
  /does not bind|identity[_ ]mismatch/i
);

const withinBounds = await modules.qualification.buildHistoricalDatasetCapacityPlan({
  sourceTimeframes: Object.freeze(["1m", "1d", "1w"]),
  pilotStartUtc: "2024-01-01T00:00:00.000Z",
  pilotEndUtc: "2024-01-08T00:00:00.000Z",
  targetStartUtc: "2024-01-01T00:00:00.000Z",
  targetEndUtc: "2025-12-31T00:00:00.000Z",
  observedSourceBars: 7_000,
  observedPartitionCount: 2,
  observedStorageBytes: 2_000_000,
  observedPeakMemoryBytes: 10_000_000,
  maximumSourceBars: 1_000_000,
  maximumPartitionCount: 300,
  maximumStorageBytes: 300_000_000,
  maximumPeakMemoryBytes: 1_500_000_000
});
assert.equal(withinBounds.status, "within_bounds");
assert.match(withinBounds.capacityPlanId, /^sha256:[0-9a-f]{64}$/);

const blockedCapacity = await modules.qualification.buildHistoricalDatasetCapacityPlan({
  sourceTimeframes: Object.freeze(["1m", "1d", "1w"]),
  pilotStartUtc: "2024-01-01T00:00:00.000Z",
  pilotEndUtc: "2024-01-08T00:00:00.000Z",
  targetStartUtc: "2024-01-01T00:00:00.000Z",
  targetEndUtc: "2025-12-31T00:00:00.000Z",
  observedSourceBars: 7_000,
  observedPartitionCount: 2,
  observedStorageBytes: 2_000_000,
  observedPeakMemoryBytes: 20_000_000,
  maximumSourceBars: 500_000,
  maximumPartitionCount: 100,
  maximumStorageBytes: 100_000_000,
  maximumPeakMemoryBytes: 1_000_000_000
});
assert.equal(blockedCapacity.status, "blocked");
assert.ok(blockedCapacity.blockers.includes("historical_capacity_source_bar_bound_exceeded"));
assert.ok(blockedCapacity.blockers.includes("historical_capacity_partition_bound_exceeded"));
assert.ok(blockedCapacity.blockers.includes("historical_capacity_storage_bound_exceeded"));
assert.ok(blockedCapacity.blockers.includes("historical_capacity_memory_bound_exceeded"));
await assert.rejects(
  () => modules.qualification.buildHistoricalDatasetCapacityPlan({
    ...blockedCapacity,
    sourceTimeframes: Object.freeze(["2m"])
  }),
  /unsupported source timeframe/i
);

const adapterA = modules.mt5Provider.createMt5ReadOnlyHistoricalProvider({
  baseUrl: "http://127.0.0.1:7341",
  providerVersion: "fixture-wrapper-v1",
  providerTimeBasis: "utc_iso",
  sourceIdentityFingerprint: fixture.terminalIdentityFingerprint,
  now: () => "2024-01-02T00:01:30.000Z",
  closedBarSafetyLagMs: 1_000,
  fetchImpl: async () => new Response(JSON.stringify({
    candles: [
      { timestamp: "2024-01-02T00:00:00.000Z", open: 1, high: 2, low: 0.5, close: 1.5 },
      { timestamp: "2024-01-02T00:01:00.000Z", open: 1.5, high: 2, low: 1, close: 1.75 }
    ],
    sourceMethod: "upstream_http:/candles/range",
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  }), { status: 200 })
});
const closurePage = await adapterA.fetchPage({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "1m",
  startUtc: "2024-01-02T00:00:00.000Z",
  endUtc: "2024-01-02T00:02:00.000Z",
  limit: 2
});
assert.equal(closurePage.candles[0].isClosed, true);
assert.equal(closurePage.candles[1].isClosed, false);

const adapterB = modules.mt5Provider.createMt5ReadOnlyHistoricalProvider({
  baseUrl: "http://127.0.0.1:7341",
  providerVersion: "fixture-wrapper-v1",
  providerTimeBasis: "utc_iso",
  sourceIdentityFingerprint: await modules.canonical.canonicalHash({ terminal: "different" }),
  fetchImpl: async () => new Response("{}", { status: 500 })
});
assert.notEqual(
  (await adapterA.describe()).sourceFingerprint,
  (await adapterB.describe()).sourceFingerprint,
  "The provider identity must change with terminal/source identity."
);
const timeoutBoundProvider = modules.mt5Provider.createMt5ReadOnlyHistoricalProvider({
  baseUrl: "http://127.0.0.1:7341",
  providerVersion: "fixture-wrapper-v1",
  providerTimeBasis: "utc_iso",
  sourceIdentityFingerprint: fixture.terminalIdentityFingerprint,
  requestTimeoutMs: 120_000,
  fetchImpl: async () => new Response("{}", { status: 500 })
});
assert.notEqual(
  (await adapterA.describe()).sourceFingerprint,
  (await timeoutBoundProvider.describe()).sourceFingerprint,
  "The provider identity must bind the historical request timeout."
);

console.log(JSON.stringify({
  status: "passed",
  timeAuthorityId: fixture.timeAuthority.authorityId,
  evidencePackageId: fixture.evidencePackage.evidencePackageId,
  calendarId: fixture.calendar.calendarId,
  alignmentPolicyId: fixture.timeframeAlignment.policyId,
  capacityPlanId: withinBounds.capacityPlanId,
  blockedCapacity: blockedCapacity.blockers,
  derivedDailyRequiresNativeSource: true,
  closedCandleClassification: closurePage.candles.map((candle) => candle.isClosed),
  authority: fixture.timeAuthority.authority
}, null, 2));
