#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-silver-bullet/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-silver-bullet");
const writeMode = process.argv.includes("--write");
const sourceCommit = "a31382a7b478841e37e6b5afc7f5b910f8c37c26";
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const stable = (value) => {
  const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const candle = (timestamp, open, high, low, close) => ({
  id: `MNQ-1m-${timestamp}`, symbol: "MNQ", timeframe: "1m", timestamp, open, high, low, close, volume: 100
});
const iso = (hour, minute) => `2026-06-12T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
const v1PreSession = () => Array.from({ length: 25 }, (_, index) => candle(iso(13, 35 + index), 105, 110, 100, 105));
const v1Long = () => [...v1PreSession(),
  candle(iso(14, 0), 105, 107, 101, 104), candle(iso(14, 1), 104, 106, 101.5, 103),
  candle(iso(14, 2), 102, 102, 99, 101.2), candle(iso(14, 3), 101.5, 108, 103.5, 107),
  candle(iso(14, 4), 107.5, 109, 103.2, 108.5), candle(iso(14, 5), 108, 108.2, 102.6, 104),
  candle(iso(14, 6), 104, 105, 103, 104.2)];
const v1Short = () => [...v1PreSession(),
  candle(iso(14, 0), 105, 108, 102, 106), candle(iso(14, 1), 106, 109, 103, 107),
  candle(iso(14, 2), 109, 111, 108, 109), candle(iso(14, 3), 108.5, 108.8, 104, 105),
  candle(iso(14, 4), 105, 107, 104, 104.5), candle(iso(14, 5), 105, 107.6, 104.6, 106.8),
  candle(iso(14, 6), 106.5, 106.8, 104, 104.2)];
const v2PreSession = () => Array.from({ length: 56 }, (_, index) => {
  const minute = index % 60;
  const hour = 13 + Math.floor(index / 60);
  return candle(iso(hour, minute), 105, 106, 104, 105);
});
const v2Long = () => [...v2PreSession(), candle(iso(14, 0), 105, 106, 103, 104.8),
  candle(iso(14, 1), 104.8, 105.5, 104.2, 104.5), candle(iso(14, 2), 107, 113, 107, 112),
  candle(iso(14, 3), 112, 112.5, 106.4, 107.4)];
const v2Short = () => [...v2PreSession(), candle(iso(14, 0), 105, 107.5, 104, 105.4),
  candle(iso(14, 1), 105.2, 105.8, 104.5, 105.5), candle(iso(14, 2), 103, 103, 97, 98),
  candle(iso(14, 3), 98, 103.6, 97.5, 102.6)];
const context = (timeframe, bearish = false) => Array.from({ length: 8 }, (_, index) => ({
  id: `ctx-${timeframe}-${index}`, symbol: "MNQ", timeframe,
  timestamp: `2026-06-12T13:${String(index * 5).padStart(2, "0")}:00.000Z`,
  open: bearish ? 110 - index : 100 + index, high: bearish ? 111 - index : 102 + index,
  low: bearish ? 108 - index : 99 + index, close: bearish ? 109 - index : 101 + index, volume: 100
}));
const source = (profile, bearish = false) => ({
  sourceProvider: "mt5_read_only", sourceFingerprint: `mt5|MNQ|USTECH|1m|bt3_silver_bullet|${profile}`,
  requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "1m",
  contextCandles: { "5m": context("5m", bearish), "15m": context("15m", bearish) }, newsEvents: [], vwap: profile === "v1" ? 104 : 106
});

const compact = (fixtureId, profileVersion, candidate) => {
  const eligible = candidate.status === "replay_required" && candidate.blockers.length === 0;
  const expectedStrategy = profileVersion === "v1" ? "silver_bullet_v1" : "silver_bullet_v2_refined_research";
  assert.equal(candidate.strategyId, expectedStrategy);
  assert.equal(candidate.sessionWindow?.id, "new_york_am");
  assert.ok(candidate.latestCandleTimestamp);
  return {
    schemaVersion: "gotrader-bt3-silver-bullet-fixture-v1",
    identity: {
      fixtureId, strategyId: candidate.strategyId, profileVersion,
      classification: profileVersion === "v1" ? "negative_control" : "strict_research",
      sourceCommit, requestedSymbol: candidate.requestedSymbol, brokerSymbol: candidate.brokerSymbol,
      sourceFingerprint: candidate.sourceFingerprint, timeframe: "1m", generatedAt: candidate.generatedAt,
      lastClosedCandleOpen: candidate.latestCandleTimestamp, sessionClosesAtUtc: "2026-06-12T15:00:00.000Z",
      parameterFingerprint: profileVersion === "v1"
        ? "silver_bullet_v1|native_sweep_fvg_return|min_rr_2|rejected_negative_control"
        : "silver_bullet_v2|meaningful_sweep|context|displacement|return_10|min_rr_2|max_rr_15|strict_research"
    },
    detectionState: candidate.status,
    sessionId: candidate.sessionWindow.id,
    blockers: candidate.blockers,
    warnings: candidate.warnings,
    presentConditions: candidate.presentConditions,
    missingConditions: candidate.missingConditions,
    geometry: eligible ? {
      side: candidate.side, entry: candidate.entry, stop: candidate.stop, target: candidate.target, rr: candidate.rr,
      returnToFvgTimestamp: candidate.returnToFvgTimestamp
    } : undefined,
    promotionAllowed: false,
    authority
  };
};

async function build() {
  compileTypescriptModules({ files: [path.join(root, "src/lib/ict-strategy-suite/ictSilverBullet.ts")], outRoot });
  const detector = await import(`${pathToFileURL(path.join(outRoot, "ictSilverBullet.mjs")).href}?v=${Date.now()}`);
  const generatedAtV1 = "2026-06-12T14:07:00.000Z";
  const generatedAtV2 = "2026-06-12T14:04:00.000Z";
  const v1LongCandidate = detector.evaluateIctSilverBullet({ ...source("v1"), candles: v1Long(), generatedAt: generatedAtV1 });
  const v1ShortCandidate = detector.evaluateIctSilverBullet({ ...source("v1"), candles: v1Short(), generatedAt: generatedAtV1 });
  const v1NoSweep = detector.evaluateIctSilverBullet({ ...source("v1"), generatedAt: generatedAtV1,
    candles: v1Long().map((item) => item.timestamp === iso(14, 2) ? { ...item, low: 100.5, close: 101.2 } : item) });
  const v2LongCandidate = detector.evaluateIctSilverBulletV2({ ...source("v2"), candles: v2Long(), generatedAt: generatedAtV2 });
  const v2ShortCandidate = detector.evaluateIctSilverBulletV2({ ...source("v2", true), candles: v2Short(), generatedAt: generatedAtV2 });
  const v2WeakSweep = detector.evaluateIctSilverBulletV2({ ...source("v2"), generatedAt: generatedAtV2,
    candles: v2Long().map((item) => item.timestamp === iso(14, 0) ? { ...item, low: 103.95 } : item) });
  return {
    schemaVersion: "gotrader-bt3-silver-bullet-snapshot-v1",
    payload: [
      compact("silver_bullet_v1_long_valid", "v1", v1LongCandidate),
      compact("silver_bullet_v1_short_valid", "v1", v1ShortCandidate),
      compact("silver_bullet_v1_no_sweep_blocked", "v1", v1NoSweep),
      compact("silver_bullet_v2_long_valid", "v2", v2LongCandidate),
      compact("silver_bullet_v2_short_valid", "v2", v2ShortCandidate),
      compact("silver_bullet_v2_weak_sweep_blocked", "v2", v2WeakSweep)
    ]
  };
}

const first = stable(await build());
const second = stable(await build());
assert.equal(second, first);
fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "silver-bullet.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-silver-bullet-hashes-v1", hashes: { "silver-bullet.snapshot.json": sha256(first) } });
if (writeMode) {
  fs.writeFileSync(snapshotPath, first, "utf8");
  fs.writeFileSync(hashPath, manifest, "utf8");
} else {
  assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest);
}
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, fixtureCount: 6,
  snapshotHash: `sha256:${sha256(first)}`, authority }, null, 2));
