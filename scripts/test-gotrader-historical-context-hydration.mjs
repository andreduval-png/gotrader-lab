#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildHistoricalContextHydrationArtifact,
  defaultHistoricalContextHydrationPolicy,
  validateHistoricalContextHydrationArtifact
} from "./gotrader-historical-context-hydrator-core.mjs";
import {
  continuousFeedAuthority,
  selectRuntimeContextWindows
} from "./gotrader-continuous-feed-core.mjs";

const durationByTimeframe = {
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000
};
const start = Date.parse("2026-07-01T00:00:00.000Z");
const payloadFor = (timeframe, count = 8) => ({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe,
  candles: Array.from({ length: count }, (_, index) => ({
    time: new Date(
      start + index * durationByTimeframe[timeframe]
    ).toISOString(),
    open: 20_000 + index,
    high: 20_010 + index,
    low: 19_990 + index,
    close: 20_005 + index,
    tickVolume: 100 + index
  }))
});
const payloads = defaultHistoricalContextHydrationPolicy.requiredTimeframes.map(
  (timeframe) => payloadFor(timeframe)
);
const wallClockContract = {
  providerTimeBasis: "mt5_server_wall_clock",
  observedOffsetMinutes: 180
};
const first = buildHistoricalContextHydrationArtifact({
  candlePayloads: payloads,
  asOfUtc: "2026-07-19T21:00:00.000Z",
  timeContractVersion: "mt5-time-contract-v2",
  timeContract: wallClockContract,
  generatedAtUtc: "2026-07-23T20:00:00.000Z"
});
const repeated = buildHistoricalContextHydrationArtifact({
  candlePayloads: payloads,
  asOfUtc: "2026-07-19T21:00:00.000Z",
  timeContractVersion: "mt5-time-contract-v2",
  timeContract: wallClockContract,
  generatedAtUtc: "2026-07-23T20:01:00.000Z"
});
assert.equal(first.status, "ready");
assert.equal(first.boundedHistoricalContextEligible, true);
assert.equal(first.historicalEligible, false);
assert.equal(first.historicalDstPolicyVerified, false);
assert.equal(first.hydrationFingerprint, repeated.hydrationFingerprint);
assert.equal(first.timeframeSummaries.length, 5);
assert.equal(first.timeframeSummaries.every((item) => item.ready), true);
assert.equal(
  first.timeframeSummaries[0].firstCandleTime,
  "2026-06-30T21:00:00.000Z"
);
assert.equal(validateHistoricalContextHydrationArtifact(first).valid, true);
const preRegimeCandle = {
  candleOpenTime: "2026-07-22T12:00:00.000Z",
  candleCloseTime: "2026-07-22T16:00:00.000Z",
  open: 100,
  high: 110,
  low: 90,
  close: 105
};
const snapshot = {
  "MNQ:USTECH:4h": [preRegimeCandle]
};
const withoutHydration = selectRuntimeContextWindows({
  snapshot,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframes: ["4h"],
  asOf: "2026-07-23T20:00:00.000Z",
  continuityStartedAtUtc: "2026-07-23T19:00:00.000Z"
});
assert.equal(withoutHydration["4h"].length, 0);
const withHydration = selectRuntimeContextWindows({
  snapshot,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframes: ["4h"],
  asOf: "2026-07-23T20:00:00.000Z",
  continuityStartedAtUtc: "2026-07-23T19:00:00.000Z",
  hydrationArtifact: first
});
assert.equal(withHydration["4h"].length, 1);

const blocked = buildHistoricalContextHydrationArtifact({
  candlePayloads: payloads.filter((payload) => payload.timeframe !== "1d"),
  asOfUtc: "2026-07-19T21:00:00.000Z",
  timeContractVersion: "mt5-time-contract-v2",
  timeContract: wallClockContract
});
assert.equal(blocked.status, "blocked");
assert.equal(blocked.boundedHistoricalContextEligible, false);
assert.ok(
  blocked.blockers.some((blocker) =>
    blocker.startsWith("historical_context_hydration_insufficient:1d")
  )
);

const serialized = JSON.stringify(first).toLowerCase();
assert.equal(serialized.includes("\"candles\""), false);
assert.equal(serialized.includes("\"account\""), false);
assert.equal(serialized.includes("\"order\""), false);
assert.equal(serialized.includes("\"position\""), false);
assert.equal(first.rawCandlesPersisted, false);
assert.deepEqual(
  {
    executionAuthority: first.executionAuthority,
    brokerAuthority: first.brokerAuthority,
    readinessOverrideAuthority: first.readinessOverrideAuthority
  },
  continuousFeedAuthority
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      boundedPreload: true,
      deterministicFingerprint: true,
      allRequiredTimeframesReady: true,
      blockedWhenTimeframeMissing: true,
      rawCandlesPersisted: false,
      historicalEligible: false,
      historicalDstPolicyVerified: false,
      ...continuousFeedAuthority
    },
    null,
    2
  )
);
