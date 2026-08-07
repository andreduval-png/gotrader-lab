#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildFixtureRequest, loadBt1Modules } from "./support/bt1-dataset-fixtures.mjs";

const workspace = process.cwd();
const testRoot = path.resolve(workspace, ".gotrader", "bt1-historical-time-test");
assert.ok(testRoot.startsWith(`${path.resolve(workspace, ".gotrader")}${path.sep}`));
fs.rmSync(testRoot, { recursive: true, force: true });
const modules = await loadBt1Modules({ outRoot: path.join(testRoot, "compiled") });
const fixture = await buildFixtureRequest(modules);

const wallClockPolicy = Object.freeze({
  policyId: "verified-new-york-wall-clock",
  version: "1",
  provider: "fixture",
  basis: "mt5_server_wall_clock",
  sourceTimezone: "America/New_York",
  outputTimezone: "UTC",
  discoveryMethod: "configured_iana_timezone",
  dstPolicy: "iana_timezone_rules",
  maximumClockSkewMs: 1000,
  closureToleranceMs: 0
});
const winter = modules.timeNormalization.normalizeHistoricalProviderTime("2024-01-15T09:30:00", wallClockPolicy);
const summer = modules.timeNormalization.normalizeHistoricalProviderTime("2024-07-15T09:30:00", wallClockPolicy);
const springGap = modules.timeNormalization.normalizeHistoricalProviderTime("2024-03-10T02:30:00", wallClockPolicy);
const fallOverlap = modules.timeNormalization.normalizeHistoricalProviderTime("2024-11-03T01:30:00", wallClockPolicy);
const compactTimeResult = (value) => ({
  status: value.status,
  normalizedTimeUtc: value.normalizedTimeUtc,
  providerTimeBasis: value.providerTimeBasis,
  offsetAppliedMinutes: value.offsetAppliedMinutes,
  dstState: value.dstState,
  blockers: value.blockers
});
for (const [rawTime, policy] of [
  ["2024-01-15T09:30:00", wallClockPolicy],
  ["2024-07-15T09:30:00", wallClockPolicy],
  ["2024-03-10T02:30:00", wallClockPolicy],
  ["2024-11-03T01:30:00", wallClockPolicy],
  [1705329000, { ...wallClockPolicy, basis: "epoch_utc", sourceTimezone: undefined, dstPolicy: "not_applicable" }],
  ["2024-01-15T14:30:00.000Z", { ...wallClockPolicy, basis: "utc_iso", sourceTimezone: undefined, dstPolicy: "not_applicable" }],
  ["2024-01-15T09:30:00-05:00", { ...wallClockPolicy, basis: "iso_with_offset", sourceTimezone: undefined, dstPolicy: "explicit_offset" }]
]) {
  assert.deepEqual(
    compactTimeResult(modules.timeNormalization.normalizeHistoricalProviderTime(rawTime, policy)),
    compactTimeResult(modules.v2TimeNormalization.normalizeMt5ProviderTime(rawTime, policy)),
    `BT1 historical time semantics must match the governed V2 result for ${String(rawTime)}.`
  );
}
assert.equal(winter.status, "normalized");
assert.equal(winter.normalizedTimeUtc, "2024-01-15T14:30:00.000Z");
assert.equal(winter.dstState, "standard");
assert.equal(summer.status, "normalized");
assert.equal(summer.normalizedTimeUtc, "2024-07-15T13:30:00.000Z");
assert.equal(summer.dstState, "daylight");
assert.equal(springGap.status, "blocked");
assert.ok(springGap.blockers.includes("nonexistent_local_time"));
assert.equal(fallOverlap.status, "blocked");
assert.ok(fallOverlap.blockers.includes("ambiguous_local_time"));

const blockedProviderId = "mt5_read_only_historical";
const blockedProviderVersion = "unverified-history";
const blockedSourceFingerprint = await modules.canonical.canonicalHash({
  provider: blockedProviderId,
  version: blockedProviderVersion
});
const blockedTerminalFingerprint = await modules.canonical.canonicalHash({ terminal: "unverified" });
const blockedRecords = [];
for (const [period, blocker] of [
  ["winter", "winter_evidence_missing"],
  ["summer", "summer_evidence_missing"],
  ["spring_transition", "spring_evidence_missing"],
  ["fall_transition", "fall_evidence_missing"],
  ["maintenance_boundary", "maintenance_evidence_missing"]
]) {
  blockedRecords.push(await modules.qualification.buildHistoricalTimeEvidenceRecord({
    period,
    providerId: blockedProviderId,
    providerVersion: blockedProviderVersion,
    terminalIdentityFingerprint: blockedTerminalFingerprint,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "1m",
    rawProviderTime: "2024-01-01T00:00:00",
    normalizedTimeUtc: "2024-01-01T00:00:00.000Z",
    expectedSessionInterpretation: "unverified",
    providerTimeBasis: "mt5_server_wall_clock",
    sourceFingerprint: blockedSourceFingerprint,
    normalizationPolicyId: wallClockPolicy.policyId,
    normalizationPolicyVersion: wallClockPolicy.version,
    timestampStatus: "blocked",
    sessionStatus: "blocked",
    blockers: Object.freeze([blocker])
  }));
}
const blockedEvidencePackage = await modules.qualification.buildHistoricalTimeEvidencePackage({
  providerId: blockedProviderId,
  providerVersion: blockedProviderVersion,
  terminalIdentityFingerprint: blockedTerminalFingerprint,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  providerTimeBasis: "mt5_server_wall_clock",
  timestampDstPolicy: "iana_timezone_rules",
  sessionTimezone: "America/New_York",
  sourceFingerprint: blockedSourceFingerprint,
  normalizationPolicyId: wallClockPolicy.policyId,
  normalizationPolicyVersion: wallClockPolicy.version,
  verificationVersion: "blocked-v1",
  records: Object.freeze(blockedRecords)
});
const blockedCalendar = await modules.qualification.buildHistoricalMarketCalendarSnapshot({
  version: "blocked-v1",
  providerId: blockedProviderId,
  brokerSymbol: "USTECH",
  timezone: "America/New_York",
  dstPolicy: "iana_timezone_rules",
  evidencePackageId: blockedEvidencePackage.evidencePackageId,
  verificationVersion: "blocked-v1",
  verificationStatus: "configured_unverified",
  closedIntervals: Object.freeze([]),
  sourceFingerprint: blockedSourceFingerprint
});
const blockedAuthority = await modules.contracts.buildHistoricalTimeAuthority({
  providerId: blockedProviderId,
  providerVersion: blockedProviderVersion,
  providerTimeBasis: "mt5_server_wall_clock",
  dstPolicy: "iana_timezone_rules",
  timeNormalizationPolicy: wallClockPolicy,
  evidencePackage: blockedEvidencePackage,
  calendar: blockedCalendar,
  verificationVersion: "blocked-v1"
});
assert.equal(blockedAuthority.historicalTimeVerified, false);
assert.equal(blockedAuthority.historicalDstVerified, false);
assert.ok(blockedAuthority.blockers.includes("historical_winter_time_not_verified"));
assert.ok(blockedAuthority.blockers.includes("historical_fall_dst_transition_not_verified"));

const invalidSymbol = await modules.contracts.buildHistoricalSymbolSpecSnapshot({
  providerId: "fixture",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  digits: 2,
  pointSize: 0.01,
  pipSize: 0.01,
  pipInPoints: 10,
  spreadUnit: "broker_points",
  verificationStatus: "configured_unverified",
  sourceFingerprint: fixture.description.sourceFingerprint
});
assert.ok(invalidSymbol.blockers.includes("symbol_pip_point_relationship_invalid"));
assert.ok(invalidSymbol.blockers.includes("symbol_spec_provider_metadata_unverified"));

const normalizedCandle = (minute, close = 100 + minute) => Object.freeze({
  openTimeUtc: new Date(Date.parse("2024-01-02T00:00:00.000Z") + minute * 60_000).toISOString(),
  closeTimeUtc: new Date(Date.parse("2024-01-02T00:01:00.000Z") + minute * 60_000).toISOString(),
  open: 100 + minute,
  high: 102 + minute,
  low: 99 + minute,
  close,
  volume: 10 + minute,
  spreadPoints: 2
});
const maintenanceCalendar = Object.freeze({
  ...fixture.request.calendar,
  calendarId: "fixture-maintenance-calendar",
  closedIntervals: Object.freeze([{
    startUtc: "2024-01-02T00:01:00.000Z",
    endUtc: "2024-01-02T00:03:00.000Z",
    reason: "maintenance",
    evidenceId: "fixture:maintenance"
  }])
});
const expectedGap = await modules.integrity.buildHistoricalIntegrityLedger({
  requestId: "sha256:" + "1".repeat(64),
  timeframe: "1m",
  candles: Object.freeze([normalizedCandle(0), normalizedCandle(3)]),
  sourceEvents: Object.freeze([]),
  calendar: maintenanceCalendar
});
assert.equal(expectedGap.ledger.summary.status, "accepted_with_warnings");
assert.equal(expectedGap.ledger.summary.expectedClosureGapCount, 1);
assert.equal(expectedGap.ledger.summary.unclassifiedGapCount, 0);

const unverifiedGap = await modules.integrity.buildHistoricalIntegrityLedger({
  requestId: "sha256:" + "2".repeat(64),
  timeframe: "1m",
  candles: Object.freeze([normalizedCandle(0), normalizedCandle(3)]),
  sourceEvents: Object.freeze([]),
  calendar: Object.freeze({ ...maintenanceCalendar, verificationStatus: "configured_unverified" })
});
assert.equal(unverifiedGap.ledger.summary.status, "blocked");
assert.equal(unverifiedGap.ledger.summary.unclassifiedGapCount, 1);

const duplicateConflict = await modules.integrity.buildHistoricalIntegrityLedger({
  requestId: "sha256:" + "3".repeat(64),
  timeframe: "1m",
  candles: Object.freeze([normalizedCandle(0), normalizedCandle(0), normalizedCandle(0, 999)]),
  sourceEvents: Object.freeze([]),
  calendar: fixture.request.calendar
});
assert.equal(duplicateConflict.ledger.summary.duplicateCount, 1);
assert.equal(duplicateConflict.ledger.summary.conflictingDuplicateCount, 1);
assert.equal(duplicateConflict.ledger.summary.status, "blocked");

const completeMinutes = Object.freeze(Array.from({ length: 15 }, (_, index) => normalizedCandle(index)));
const firstDerivation = await modules.timeframe.deriveHistoricalTimeframe({
  parentDatasetRequestId: "sha256:" + "4".repeat(64),
  parentTimeframe: "1m",
  parentPartitionIds: Object.freeze(["sha256:" + "b".repeat(64), "sha256:" + "a".repeat(64)]),
  targetTimeframe: "5m",
  candles: completeMinutes,
  rangeStartUtc: "2024-01-02T00:00:00.000Z",
  rangeEndUtc: "2024-01-02T00:15:00.000Z",
  calendar: fixture.request.calendar,
  alignment: fixture.request.timeframeAlignment
});
const reorderedDerivation = await modules.timeframe.deriveHistoricalTimeframe({
  parentDatasetRequestId: "sha256:" + "4".repeat(64),
  parentTimeframe: "1m",
  parentPartitionIds: Object.freeze(["sha256:" + "a".repeat(64), "sha256:" + "b".repeat(64)]),
  targetTimeframe: "5m",
  candles: Object.freeze([...completeMinutes].reverse()),
  rangeStartUtc: "2024-01-02T00:00:00.000Z",
  rangeEndUtc: "2024-01-02T00:15:00.000Z",
  calendar: fixture.request.calendar,
  alignment: fixture.request.timeframeAlignment
});
assert.equal(firstDerivation.candles.length, 3);
assert.equal(firstDerivation.lineage.lineageId, reorderedDerivation.lineage.lineageId);
assert.deepEqual(firstDerivation.candles, reorderedDerivation.candles);

const calendarAdjusted = await modules.timeframe.deriveHistoricalTimeframe({
  parentDatasetRequestId: "sha256:" + "5".repeat(64),
  parentTimeframe: "1m",
  parentPartitionIds: Object.freeze(["sha256:" + "c".repeat(64)]),
  targetTimeframe: "5m",
  candles: Object.freeze([normalizedCandle(0), normalizedCandle(1), normalizedCandle(3), normalizedCandle(4)]),
  rangeStartUtc: "2024-01-02T00:00:00.000Z",
  rangeEndUtc: "2024-01-02T00:05:00.000Z",
  calendar: Object.freeze({
    ...fixture.request.calendar,
    calendarId: "single-minute-closure",
    closedIntervals: Object.freeze([{
      startUtc: "2024-01-02T00:02:00.000Z",
      endUtc: "2024-01-02T00:03:00.000Z",
      reason: "maintenance",
      evidenceId: "fixture:single-minute-closure"
    }])
  }),
  alignment: fixture.request.timeframeAlignment
});
assert.equal(calendarAdjusted.lineage.completeness, "calendar_adjusted");
assert.equal(calendarAdjusted.candles.length, 1);

console.log(JSON.stringify({
  status: "passed",
  winterUtc: winter.normalizedTimeUtc,
  summerUtc: summer.normalizedTimeUtc,
  springGapBlocked: springGap.blockers,
  fallOverlapBlocked: fallOverlap.blockers,
  unverifiedAuthorityBlockers: blockedAuthority.blockers,
  verifiedMaintenanceGapClassified: true,
  unverifiedGapBlocked: true,
  duplicateConflictBlocked: true,
  deterministicDerivedLineageId: firstDerivation.lineage.lineageId,
  calendarAdjustedLineage: calendarAdjusted.lineage.completeness
}, null, 2));
