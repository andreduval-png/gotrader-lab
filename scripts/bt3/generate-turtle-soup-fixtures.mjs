#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-turtle-soup/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-turtle-soup");
const writeMode = process.argv.includes("--write");
const sourceCommit = "941b76820e705c9f500c12381e729d48bec3c5ba";
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const stable = (value) => { const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item; return `${JSON.stringify(sort(value), null, 2)}\n`; };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const candle = ({ timestamp, timeframe, open, high, low, close }) => ({ id: `MNQ-${timeframe}-${timestamp}`,
  symbol: "MNQ", timeframe, timestamp, open, high, low, close, volume: 100 });
const iso = (hour, minute) => `2026-06-12T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
const setup = ({ high, low }) => Array.from({ length: 24 }, (_, index) => candle({
  timestamp: `2026-06-12T${String(6 + Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}:00.000Z`,
  timeframe: "15m", open: (high + low) / 2, high, low, close: (high + low) / 2 }));
const base = () => Array.from({ length: 30 }, (_, index) => candle({ timestamp: iso(11 + Math.floor(index / 12), (index % 12) * 5),
  timeframe: "5m", open: 103, high: 104, low: 101, close: 103 }));
const shortEntry = () => [...base(), candle({ timestamp: iso(13, 30), timeframe: "5m", open: 108, high: 112, low: 107, close: 109 }),
  candle({ timestamp: iso(13, 35), timeframe: "5m", open: 109, high: 109.5, low: 104, close: 105 }),
  candle({ timestamp: iso(13, 40), timeframe: "5m", open: 105, high: 106, low: 98, close: 100 }),
  candle({ timestamp: iso(13, 45), timeframe: "5m", open: 104, high: 106, low: 104, close: 105 })];
const longEntry = () => [...base().map((item) => ({ ...item, open: 101, high: 104, low: 99, close: 101 })),
  candle({ timestamp: iso(13, 30), timeframe: "5m", open: 98, high: 99, low: 93, close: 96 }),
  candle({ timestamp: iso(13, 35), timeframe: "5m", open: 96, high: 102, low: 96, close: 101 }),
  candle({ timestamp: iso(13, 40), timeframe: "5m", open: 101, high: 107, low: 100, close: 106 }),
  candle({ timestamp: iso(13, 45), timeframe: "5m", open: 103, high: 104, low: 102, close: 103 })];
const source = { sourceProvider: "mt5_read_only", sourceFingerprint: "mt5|MNQ|USTECH|15m|5m|bt3_turtle_soup",
  requestedSymbol: "MNQ", brokerSymbol: "USTECH", setupTimeframe: "15m", entryTimeframe: "5m", newsEvents: [] };
const compact = (fixtureId, candidate) => {
  const eligible = candidate.status === "replay_required" && candidate.blockers.length === 0;
  assert.equal(candidate.strategyId, "turtle_soup_v1"); assert.equal(candidate.sessionWindow?.id, "new_york_open");
  return { schemaVersion: "gotrader-bt3-turtle-soup-fixture-v1", identity: { fixtureId, strategyId: "turtle_soup_v1",
    profileVersion: "v1", classification: "diagnostic_control", sourceCommit, requestedSymbol: candidate.requestedSymbol,
    brokerSymbol: candidate.brokerSymbol, sourceFingerprint: candidate.sourceFingerprint, setupTimeframe: candidate.setupTimeframe,
    entryTimeframe: candidate.entryTimeframe, generatedAt: candidate.generatedAt, lastClosedCandleOpen: candidate.latestCandleTimestamp,
    sessionClosesAtUtc: "2026-06-12T15:00:00.000Z",
    parameterFingerprint: "turtle_soup_v1|setup_15m|entry_5m|sweep|rejection_1_3|mss|retest|min_rr_2.5|diagnostic_control" },
    detectionState: candidate.status, sessionId: candidate.sessionWindow.id, blockers: candidate.blockers,
    warnings: candidate.warnings, presentConditions: candidate.presentConditions, missingConditions: candidate.missingConditions,
    geometry: eligible ? { side: candidate.side, entry: candidate.entry, stop: candidate.stop, target: candidate.target, rr: candidate.rr } : undefined,
    auditedHistoricalCandidateCount: 0, auditedRobustness: "needs_more_data", promotionAllowed: false, authority };
};

async function build() {
  compileTypescriptModules({ files: [path.join(root, "src/lib/ict-strategy-suite/ictTurtleSoup.ts")], outRoot });
  const { evaluateIctTurtleSoup } = await import(`${pathToFileURL(path.join(outRoot, "ictTurtleSoup.mjs")).href}?v=${Date.now()}`);
  const generatedAt = "2026-06-12T13:50:00.000Z";
  const validShort = evaluateIctTurtleSoup({ ...source, generatedAt, setupCandles: setup({ high: 110, low: 75 }), entryCandles: shortEntry() });
  const validLong = evaluateIctTurtleSoup({ ...source, generatedAt, setupCandles: setup({ high: 135, low: 95 }), entryCandles: longEntry() });
  const noSweep = evaluateIctTurtleSoup({ ...source, generatedAt, setupCandles: setup({ high: 120, low: 75 }), entryCandles: shortEntry() });
  const noMss = evaluateIctTurtleSoup({ ...source, generatedAt, setupCandles: setup({ high: 110, low: 75 }),
    entryCandles: shortEntry().map((item) => item.timestamp === iso(13, 40) ? { ...item, low: 101, close: 102 } : item) });
  return { schemaVersion: "gotrader-bt3-turtle-soup-snapshot-v1", payload: [
    compact("turtle_soup_v1_short_valid", validShort), compact("turtle_soup_v1_long_valid", validLong),
    compact("turtle_soup_v1_no_sweep_blocked", noSweep), compact("turtle_soup_v1_no_mss_blocked", noMss) ] };
}
const first = stable(await build()); const second = stable(await build()); assert.equal(second, first);
fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "turtle-soup.snapshot.json"); const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-turtle-soup-hashes-v1", hashes: { "turtle-soup.snapshot.json": sha256(first) } });
if (writeMode) { fs.writeFileSync(snapshotPath, first, "utf8"); fs.writeFileSync(hashPath, manifest, "utf8"); }
else { assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest); }
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, fixtureCount: 4,
  snapshotHash: `sha256:${sha256(first)}`, auditedHistoricalCandidateCount: 0, authority }, null, 2));
