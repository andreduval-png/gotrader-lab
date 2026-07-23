#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildRuntimeSourceIdentity,
  compactDurableMarketEvent,
  continuousFeedAuthority,
  createContinuousFeedEngine,
  evaluateRuntimeTimeContract,
  normalizeRuntimeCandleResponse,
  normalizeRuntimeQuote
} from "./gotrader-continuous-feed-core.mjs";

const candle = (time, close = 100) => ({
  time,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  tickVolume: 10
});

const candles = (items, timeframe = "1m") => ({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe,
  candles: items
});

const quote = (timestamp) => ({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timestamp,
  bid: 100,
  ask: 101
});

const verifiedTime = {
  version: "mt5-time-contract-v1",
  currentLiveTimeBasisVerified: true,
  historicalDstPolicyVerified: true,
  providerTimeBasis: "utc",
  terminalEvidenceStatus: "fresh"
};

const unverifiedTime = {
  version: "mt5-time-contract-v1",
  currentLiveTimeBasisVerified: false,
  providerTimeBasis: "unknown",
  terminalEvidenceStatus: "missing"
};

const normalizedQuote = normalizeRuntimeQuote(
  quote("2026-07-23T10:01:30.000Z"),
  "2026-07-23T10:01:31.000Z"
);
assert.equal(normalizedQuote.mid, 100.5);
assert.equal(normalizedQuote.brokerSymbol, "USTECH");
const normalizedCandles = normalizeRuntimeCandleResponse(
  candles([candle("2026-07-23T10:00:00.000Z")]),
  "2026-07-23T10:01:31.000Z"
);
assert.equal(normalizedCandles.candles[0].candleCloseTime, "2026-07-23T10:01:00.000Z");
assert.equal(evaluateRuntimeTimeContract(unverifiedTime).eligible, false);
assert.equal(evaluateRuntimeTimeContract(verifiedTime).eligible, true);

const firstEngine = createContinuousFeedEngine();
const blocked = firstEngine.processPoll({
  quotePayload: quote("2026-07-23T10:01:30.000Z"),
  candlePayloads: [
    candles([
      candle("2026-07-23T10:00:00.000Z"),
      candle("2026-07-23T10:01:00.000Z", 101)
    ])
  ],
  timeContract: unverifiedTime,
  receivedAt: "2026-07-23T10:01:31.000Z"
});
assert.equal(blocked.events.some((event) => event.type === "candle_closed"), false);
assert.equal(blocked.events.some((event) => event.type === "source_blocked"), true);
assert.equal(blocked.events.some((event) => event.type === "quote_updated"), true);
assert.equal(blocked.events.some((event) => event.type === "forming_candle_updated"), true);
assert.equal(blocked.status.timeContractEligible, false);
assert.equal(blocked.status.blockers.includes("current_live_time_basis_not_verified"), true);

const baseline = firstEngine.processPoll({
  quotePayload: quote("2026-07-23T10:01:30.000Z"),
  candlePayloads: [
    candles([
      candle("2026-07-23T10:00:00.000Z"),
      candle("2026-07-23T10:01:00.000Z", 101)
    ])
  ],
  timeContract: verifiedTime,
  receivedAt: "2026-07-23T10:01:32.000Z"
});
assert.equal(baseline.events.some((event) => event.type === "candle_closed"), false);
assert.equal(baseline.events.some((event) => event.type === "feed_recovered"), true);
assert.equal(baseline.events.some((event) => event.type === "forming_candle_updated"), false);

const closed = firstEngine.processPoll({
  quotePayload: quote("2026-07-23T10:02:30.000Z"),
  candlePayloads: [
    candles([
      candle("2026-07-23T10:00:00.000Z"),
      candle("2026-07-23T10:01:00.000Z", 101),
      candle("2026-07-23T10:02:00.000Z", 102)
    ])
  ],
  timeContract: verifiedTime,
  receivedAt: "2026-07-23T10:02:31.000Z"
});
const closeEvent = closed.events.find((event) => event.type === "candle_closed");
assert.ok(closeEvent);
assert.equal(closeEvent.candleOpenTime, "2026-07-23T10:01:00.000Z");
assert.deepEqual(
  {
    executionAuthority: closeEvent.executionAuthority,
    brokerAuthority: closeEvent.brokerAuthority,
    readinessOverrideAuthority: closeEvent.readinessOverrideAuthority
  },
  continuousFeedAuthority
);

const duplicate = firstEngine.processPoll({
  quotePayload: quote("2026-07-23T10:02:30.000Z"),
  candlePayloads: [
    candles([
      candle("2026-07-23T10:00:00.000Z"),
      candle("2026-07-23T10:01:00.000Z", 101),
      candle("2026-07-23T10:02:00.000Z", 102)
    ])
  ],
  timeContract: verifiedTime,
  receivedAt: "2026-07-23T10:02:32.000Z"
});
assert.equal(duplicate.events.some((event) => event.type === "candle_closed"), false);

const checkpoint = firstEngine.checkpoint();
const restarted = createContinuousFeedEngine({
  checkpoint,
  knownEvents: [compactDurableMarketEvent(closeEvent)]
});
const afterRestart = restarted.processPoll({
  quotePayload: quote("2026-07-23T10:02:30.000Z"),
  candlePayloads: [
    candles([
      candle("2026-07-23T10:00:00.000Z"),
      candle("2026-07-23T10:01:00.000Z", 101),
      candle("2026-07-23T10:02:00.000Z", 102)
    ])
  ],
  timeContract: verifiedTime,
  receivedAt: "2026-07-23T10:02:33.000Z"
});
assert.equal(afterRestart.events.some((event) => event.type === "candle_closed"), false);

const conflicting = restarted.processPoll({
  quotePayload: quote("2026-07-23T10:02:30.000Z"),
  candlePayloads: [
    candles([
      candle("2026-07-23T10:00:00.000Z"),
      candle("2026-07-23T10:01:00.000Z", 999),
      candle("2026-07-23T10:02:00.000Z", 102)
    ])
  ],
  timeContract: verifiedTime,
  receivedAt: "2026-07-23T10:02:34.000Z"
});
assert.equal(
  conflicting.events.some(
    (event) => event.type === "source_blocked" && event.reason === "conflicting_closed_candle"
  ),
  true
);
assert.equal(conflicting.status.conflictingCandleCount, 1);

const many = Array.from({ length: 2_105 }, (_, index) =>
  candle(new Date(Date.parse("2026-01-01T00:00:00.000Z") + index * 60_000).toISOString(), 100 + index)
);
const bounded = createContinuousFeedEngine();
bounded.processPoll({
  quotePayload: quote("2026-01-02T12:00:00.000Z"),
  candlePayloads: [candles(many)],
  timeContract: verifiedTime,
  receivedAt: "2026-01-02T12:00:01.000Z"
});
assert.equal(bounded.status().rollingStoreCounts["MNQ:USTECH:1m"], 2_000);

const candleRecoveryEngine = createContinuousFeedEngine();
const candleUnavailable = candleRecoveryEngine.processPoll({
  quotePayload: quote("2026-07-23T10:02:30.000Z"),
  candlePayloads: [
    {
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      timeframe: "5m",
      candles: []
    }
  ],
  timeContract: verifiedTime,
  receivedAt: "2026-07-23T10:02:31.000Z"
});
assert.equal(
  candleUnavailable.status.blockers.includes("candle_data_unavailable"),
  true
);
const candleRecovered = candleRecoveryEngine.processPoll({
  quotePayload: quote("2026-07-23T10:05:30.000Z"),
  candlePayloads: [
    candles(
      [
        candle("2026-07-23T10:00:00.000Z"),
        candle("2026-07-23T10:05:00.000Z", 105)
      ],
      "5m"
    )
  ],
  timeContract: verifiedTime,
  receivedAt: "2026-07-23T10:05:31.000Z"
});
assert.equal(
  candleRecovered.status.blockers.includes("candle_data_unavailable"),
  false
);

const stale = restarted.markFeedStale({ reason: "fixture_transport_stale" });
assert.equal(stale.events[0].type, "feed_stale");
assert.equal(JSON.stringify(stale).includes("placeOrder"), false);
assert.equal(JSON.stringify(stale).includes("\"candles\":["), false);

const identityA = buildRuntimeSourceIdentity({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  timeContractVersion: "v1"
});
const identityB = buildRuntimeSourceIdentity({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  timeContractVersion: "v1",
  receivedAt: "ignored"
});
assert.equal(identityA, identityB);

console.log(
  JSON.stringify(
    {
      status: "passed",
      sourceIdentityStable: true,
      closeEventsEffectivelyOnce: true,
      closedCandleConflictsBlocked: true,
      recoveredCandleDataClearsBlocker: true,
      rollingStoresBounded: true,
      rawCandlesPersisted: false,
      ...continuousFeedAuthority
    },
    null,
    2
  )
);
