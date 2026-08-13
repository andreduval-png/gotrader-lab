#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { compileTypescriptModules } from "./compile-typescript-modules.mjs";

const workspace = process.cwd();
const sourceRoot = path.join(workspace, "src", "lib");
const outRoot = path.join(workspace, ".gotrader", "v2-source-timing-test");
compileTypescriptModules({
  outRoot,
  files: [
    "candleSources/candleSourceEligibility.ts",
    "candleSources/candleSourceFingerprint.ts",
    "sessions/sessionTimeTypes.ts",
    "sessions/sessionTimeResolver.ts"
  ].map((file) => path.join(sourceRoot, file))
});

const eligibility = await import(`${pathToFileURL(path.join(outRoot, "candleSourceEligibility.mjs")).href}?t=${Date.now()}`);
const fingerprint = await import(`${pathToFileURL(path.join(outRoot, "candleSourceFingerprint.mjs")).href}?t=${Date.now()}`);
const timing = await import(`${pathToFileURL(path.join(outRoot, "sessionTimeResolver.mjs")).href}?t=${Date.now()}`);

const candle = (timestamp, open = 100, high = 102, low = 99, close = 101) => ({ timestamp, open, high, low, close, volume: 100 });
const valid = [
  candle("2026-07-20T13:30:00.000Z"),
  candle("2026-07-20T13:35:00.000Z", 101, 103, 100, 102),
  candle("2026-07-20T13:40:00.000Z", 102, 104, 101, 103)
];
assert.equal(eligibility.hasValidMonotonicTimestamps(valid), true);
assert.equal(eligibility.hasValidMonotonicTimestamps([valid[0], valid[0]]), false, "Duplicate candle time must fail closed.");
assert.equal(eligibility.hasValidMonotonicTimestamps([valid[1], valid[0]]), false, "Out-of-order candles must fail closed.");
assert.equal(eligibility.hasValidOhlc([candle("2026-07-20T13:30:00.000Z", 100, 99, 98, 101)]), false);

const sourceIdentity = {
  candles: valid,
  provider: "mt5_read_only",
  sourceId: "mt5:USTECH:5m",
  symbol: "CME_MINI:MNQ1!",
  timeframe: "5m"
};
assert.equal(fingerprint.normalizeCandleSourceSymbol("CME_MINI:MNQ1!"), "MNQ1!");
assert.equal(
  fingerprint.createCandleSourceFingerprint(sourceIdentity),
  fingerprint.createCandleSourceFingerprint(sourceIdentity),
  "Identical canonical source input must retain identity."
);

const mapping = timing.resolveSessionTimeMapping({
  provider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  candles: valid
});
assert.equal(mapping.timingZone, "America/New_York");
assert.equal(timing.getTimingClockMinutes("2026-03-06T14:30:00.000Z", mapping), 570, "EST open should resolve to 09:30.");
assert.equal(timing.getTimingClockMinutes("2026-03-09T13:30:00.000Z", mapping), 570, "EDT open should resolve to 09:30.");
assert.equal(timing.getTimingDayOfWeek("2026-07-18T14:00:00.000Z", mapping), 6, "Weekend classification must remain stable.");

console.log(JSON.stringify({
  status: "passed",
  checks: [
    "duplicate_and_out_of_order_rejected",
    "invalid_ohlc_rejected",
    "source_fingerprint_repeatable",
    "symbol_normalization_stable",
    "new_york_dst_boundaries_stable",
    "weekend_classification_stable"
  ],
  authority: {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  }
}, null, 2));
