#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-ifvg-v1-v4/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-ifvg-v1-v4");
const writeMode = process.argv.includes("--write");
const sourceCommit = "2d53d9f5ddd5952768c9eb73fab675b55e7bdb6c";
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const iso = (minute) => new Date(Date.UTC(2026, 5, 12, 13, 30 + minute)).toISOString();
const candle = (minute, open, high, low, close, volume = 100) => ({ timestamp: iso(minute), open, high, low, close, volume });
const overlap = (start, count, base = 98) => Array.from({ length: count }, (_, index) => {
  const open = base + (index % 3) * 0.12;
  const close = base + ((index + 1) % 3) * 0.12;
  return candle(start + index * 5, open, base + 1.2, base - 1.2, close, 150 + index);
});
const validV1 = () => [
  ...overlap(0, 10, 100), candle(50, 101, 104, 96, 97), candle(55, 97, 99, 95.5, 96.8),
  candle(60, 93, 94, 90, 91), candle(65, 91, 93.4, 90.5, 92.2), candle(70, 92.5, 98.6, 92.2, 98),
  candle(75, 97.8, 98.2, 94.8, 95.6), candle(80, 95.7, 99, 95.2, 98.5), candle(85, 98.5, 101, 98, 100),
  ...overlap(90, 10, 98)
];
const validFiltered = () => [
  ...overlap(-30, 6, 100), ...overlap(0, 10, 100), candle(50, 101, 104, 96, 97),
  candle(55, 97, 99, 95.5, 96.8), candle(60, 93, 94, 90, 91), candle(65, 91, 93.4, 90.5, 92.2),
  candle(70, 92.5, 98.6, 92.2, 98), candle(75, 98, 99.2, 97.2, 98.8),
  candle(80, 98.8, 100.2, 98.2, 99.8), candle(85, 99.6, 100, 94.8, 95.6)
];
const noRetest = () => [
  ...overlap(0, 10, 100), candle(50, 101, 104, 96, 97), candle(55, 97, 99, 95.5, 96.8),
  candle(60, 93, 94, 90, 91), candle(65, 91, 93.4, 90.5, 92.2), candle(70, 92.5, 98.6, 92.2, 98),
  ...overlap(75, 10, 99)
];
const context = {
  "15m": [candle(-120, 90, 93, 89, 92), candle(-105, 92, 98, 91, 97), candle(-90, 97, 102, 96, 101)],
  "1h": [candle(-240, 88, 94, 87, 93), candle(-180, 93, 103, 92, 101)]
};

const canonical = (value) => `${JSON.stringify(value, Object.keys(value).sort(), 2)}\n`;
const stable = (value) => {
  const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function build() {
  compileTypescriptModules({
    files: [
      path.join(root, "src/lib/ict-strategy-suite/ictIfvg.ts"),
      path.join(root, "src/lib/ict-strategy-suite/ictIfvgShallowRetestV4.ts")
    ],
    outRoot
  });
  const baseDetector = await import(pathToFileURL(path.join(outRoot, "ictIfvg.mjs")).href);
  const v4Detector = await import(pathToFileURL(path.join(outRoot, "ictIfvgShallowRetestV4.mjs")).href);
  const base = { sourceProvider: "fixture_read_only", sourceFingerprint: "fixture|MNQ|USTECH|5m|bt3_ifvg_v1_v4", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m", generatedAt: "2026-06-12T16:00:00.000Z" };
  const v1Valid = baseDetector.evaluateIctIfvg({ ...base, candles: validV1(), contextCandles: context });
  const v1Blocked = baseDetector.evaluateIctIfvg({ ...base, candles: noRetest(), contextCandles: context });
  const filteredCandles = validFiltered();
  const v4Base = baseDetector.evaluateIctIfvg({ ...base, candles: filteredCandles, contextCandles: context });
  const bounds = v4Base.ifvgBounds;
  assert.ok(bounds && v4Base.retestCandle);
  const size = bounds.high - bounds.low;
  const assess = (depth) => v4Detector.assessIctIfvgShallowRetestV4(
    { ...base, candles: filteredCandles, contextCandles: context },
    { ...v4Base, retestCandle: { ...v4Base.retestCandle, low: bounds.high - size * depth, close: Math.max(v4Base.retestCandle.close, bounds.midpoint) } }
  );
  const v4Valid = assess(0.6);
  const v4Blocked = assess(0.9);
  const fixture = (id, profileVersion, classification, candidate, blockers, eligible) => ({
    schemaVersion: "gotrader-bt3-ifvg-v1-v4-fixture-v1",
    identity: {
      fixtureId: id, strategyId: profileVersion === "v1" ? "ifvg_v1" : "ifvg_fresh_retest_v4_candidate",
      profileVersion, classification, sourceCommit, requestedSymbol: "MNQ", brokerSymbol: "USTECH",
      sourceFingerprint: base.sourceFingerprint, timeframe: "5m", lastClosedCandle: candidate.latestCandleTimestamp,
      parameterFingerprint: profileVersion === "v1" ? "ifvg_v1|frozen_defaults" : "ifvg_v4|max_retest_penetration_0.66"
    },
    detectionState: eligible ? "trade_plan_constructed" : "blocked",
    blockers: [...new Set(blockers)],
    geometry: eligible ? { side: candidate.side, entry: candidate.entry, stop: candidate.stop, target: candidate.target, rr: candidate.rr } : undefined,
    promotionAllowed: false,
    authority
  });
  return {
    schemaVersion: "gotrader-bt3-ifvg-v1-v4-snapshot-v1",
    payload: [
      fixture("ifvg_v1_valid", "v1", "behavioral_fixture", v1Valid, v1Valid.blockers, v1Valid.canCreateValidationChainEntry),
      fixture("ifvg_v1_no_retest", "v1", "behavioral_fixture", v1Blocked, v1Blocked.blockers, false),
      fixture("ifvg_v4_shallow_valid", "v4", "experimental", v4Valid.candidate, v4Valid.blockers, v4Valid.eligible),
      fixture("ifvg_v4_deep_blocked", "v4", "experimental", v4Blocked.candidate, v4Blocked.blockers, false)
    ]
  };
}

const first = stable(await build());
const second = stable(await build());
assert.equal(second, first);
const snapshotPath = path.join(fixtureRoot, "ifvg-v1-v4.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-ifvg-v1-v4-hashes-v1", hashes: { "ifvg-v1-v4.snapshot.json": sha256(first) } });
fs.mkdirSync(fixtureRoot, { recursive: true });
if (writeMode) {
  fs.writeFileSync(snapshotPath, first, "utf8");
  fs.writeFileSync(hashPath, manifest, "utf8");
} else {
  assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest);
}
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, fixtureCount: 4, snapshotHash: `sha256:${sha256(first)}`, authority }, null, 2));
