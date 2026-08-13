#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-phase2/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-phase2");
const writeMode = process.argv.includes("--write");
const sourceCommit = "b71cfeed51ae58cb1989c9a50b0df2b0ba2b9913";
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const stable = (value) => {
  const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const candle = (id, timestamp, open, high, low, close, timeframe = "5m") =>
  ({ id, symbol: "MNQ", timeframe, timestamp, open, high, low, close, volume: 1000 });
const bullish = () => [
  candle("b0", "2026-06-05T12:00:00.000Z", 105, 108, 103, 107), candle("b1", "2026-06-05T12:05:00.000Z", 107, 109, 104, 106),
  candle("b2", "2026-06-05T12:10:00.000Z", 106, 107, 98, 101), candle("b3", "2026-06-05T12:15:00.000Z", 101, 104, 96, 103),
  candle("b4", "2026-06-05T12:20:00.000Z", 103, 105, 101, 102), candle("b5", "2026-06-05T12:25:00.000Z", 102, 113, 102, 112),
  candle("b6", "2026-06-05T12:30:00.000Z", 112, 116, 110, 115), candle("b7", "2026-06-05T12:35:00.000Z", 115, 119, 113, 118)
];
const bearish = () => [
  candle("s0", "2026-06-05T12:00:00.000Z", 118, 121, 116, 117), candle("s1", "2026-06-05T12:05:00.000Z", 117, 122, 115, 120),
  candle("s2", "2026-06-05T12:10:00.000Z", 120, 124, 117, 118), candle("s3", "2026-06-05T12:15:00.000Z", 118, 119, 116, 119),
  candle("s4", "2026-06-05T12:20:00.000Z", 119, 120, 110, 111), candle("s5", "2026-06-05T12:25:00.000Z", 111, 112, 104, 105),
  candle("s6", "2026-06-05T12:30:00.000Z", 105, 108, 102, 103), candle("s7", "2026-06-05T12:35:00.000Z", 103, 106, 100, 101)
];
const context = (candles, direction) => ({ brokerSymbol: "USTECH", candles, primaryTimeframe: "5m", requestedSymbol: "MNQ", symbol: "MNQ",
  htfCandles: { "15m": direction === "bullish"
    ? [candle("h0", "2026-06-05T12:00:00.000Z", 100, 111, 99, 108, "15m"), candle("h1", "2026-06-05T12:15:00.000Z", 108, 120, 104, 119, "15m")]
    : [candle("h0", "2026-06-05T12:00:00.000Z", 124, 125, 116, 118, "15m"), candle("h1", "2026-06-05T12:15:00.000Z", 118, 119, 100, 102, "15m")],
  "1h": direction === "bullish" ? [candle("d0", "2026-06-05T12:00:00.000Z", 98, 121, 97, 118, "1h")]
    : [candle("d0", "2026-06-05T12:00:00.000Z", 126, 127, 99, 101, "1h")] } });

const compact = (fixtureId, signal) => {
  const accepted = signal.decision === "research_only" && signal.side !== "flat" &&
    ["approved_research_candidate", "paper_watchlist_candidate", "watchlist_candidate"].includes(signal.approvedProfileDecision?.status) &&
    signal.noTradeReasons.length === 0;
  const geometry = accepted && signal.entryZone && Number.isFinite(signal.invalidation) && Number.isFinite(signal.target) && Number.isFinite(signal.rrEstimate)
    ? { entry: signal.entryZone.midpoint, stop: signal.invalidation, target: signal.target, rr: signal.rrEstimate } : undefined;
  return { schemaVersion: "gotrader-bt3-phase2-fixture-v1", identity: { fixtureId, strategyId: signal.strategyId,
    profileVersion: "phase2_v1", sourceCommit, requestedSymbol: signal.requestedSymbol, brokerSymbol: signal.brokerSymbol,
    sourceFingerprint: `mt5|MNQ|USTECH|bt3_phase2|${fixtureId}`, timeframe: "5m", generatedAt: "2026-06-05T12:40:00.000Z",
    lastClosedCandleOpen: "2026-06-05T12:35:00.000Z", expiresAtUtc: "2026-06-05T14:40:00.000Z",
    parameterFingerprint: `${signal.strategyId}|phase2_v1|native_geometry|approved_profile|rr_2` }, decision: signal.decision,
    side: signal.side, approvedProfileStatus: signal.approvedProfileDecision?.status ?? "missing", blockers: signal.noTradeReasons,
    ...(geometry ? { geometry } : {}), promotionAllowed: false, authority };
};

async function build() {
  compileTypescriptModules({ files: [path.join(root, "src/lib/ict-strategy-suite/ictPhase2BreadAndButter.ts"),
    path.join(root, "src/lib/ict-strategy-suite/ictPhase2OneShotOneKill.ts")], outRoot });
  const bread = await import(`${pathToFileURL(path.join(outRoot, "ictPhase2BreadAndButter.mjs")).href}?v=${Date.now()}`);
  const osok = await import(`${pathToFileURL(path.join(outRoot, "ictPhase2OneShotOneKill.mjs")).href}?v=${Date.now()}`);
  return { schemaVersion: "gotrader-bt3-phase2-snapshot-v1", payload: [
    compact("phase2_bread_and_butter_buy_fail_closed", bread.evaluateIctPhase2BreadAndButterBuy(context(bullish(), "bullish"))),
    compact("phase2_bread_and_butter_sell_fail_closed", bread.evaluateIctPhase2BreadAndButterSell(context(bearish(), "bearish"))),
    compact("phase2_osok_fail_closed", osok.evaluateIctPhase2OneShotOneKill(context(bullish(), "bullish"))) ] };
}

const first = stable(await build()), second = stable(await build());
assert.equal(second, first);
fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "phase2.snapshot.json"), hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-phase2-hashes-v1", hashes: { "phase2.snapshot.json": sha256(first) } });
if (writeMode) { fs.writeFileSync(snapshotPath, first); fs.writeFileSync(hashPath, manifest); }
else { assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first); assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest); }
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, fixtureCount: 3,
  snapshotHash: `sha256:${sha256(first)}`, authority }, null, 2));
