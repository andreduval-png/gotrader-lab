#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-session-raid/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-session-raid");
const writeMode = process.argv.includes("--write");
const sourceCommit = "27befe1cca7afcb095e865fc4ad1bccb22778c51";
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const stable = (value) => { const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item; return `${JSON.stringify(sort(value), null, 2)}\n`; };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const nyIso = (dateKey, hour, minute = 0) => { const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour + 4, minute)).toISOString(); };
const candle = (dateKey, hour, minute, open, high, low, close) => ({ timestamp: nyIso(dateKey, hour, minute),
  open, high, low, close, volume: 100 });

function validScenario5m() {
  const candles = [
    candle("2026-06-07",20,0,90,91,89,90.5), candle("2026-06-09",9,30,96,103,95,101),
    candle("2026-06-09",10,0,101,102,86,88), candle("2026-06-09",15,55,89,92,87,91),
    candle("2026-06-09",20,0,97.5,98.5,96.7,98.1), candle("2026-06-09",20,30,98.1,99.2,97.4,98.9),
    candle("2026-06-09",21,0,98.9,99.4,96.9,97.8), candle("2026-06-09",22,0,97.8,98.6,96.5,97.1),
    candle("2026-06-09",23,0,97.1,98.9,96.8,98.3), candle("2026-06-10",0,0,98.1,99.1,97.2,98.6),
    candle("2026-06-10",0,30,98.6,99.3,97.7,98.9), candle("2026-06-10",2,0,98.9,100.2,98.1,99.8),
    candle("2026-06-10",2,45,99.8,102.4,99.4,101.9), candle("2026-06-10",3,45,101.9,104.8,101.3,104.2),
    candle("2026-06-10",4,15,104.2,105.2,102.9,103.5), candle("2026-06-10",5,0,103.5,104.1,101.5,102.3),
    candle("2026-06-10",8,55,102.3,103,100.8,101.4), candle("2026-06-10",9,20,101.4,104,100.9,103.8),
    candle("2026-06-10",9,35,103.8,106.5,102,105.4), candle("2026-06-10",9,40,105.4,105.8,100.9,101.3),
    candle("2026-06-10",9,45,101.3,101.6,96.4,97.2), candle("2026-06-10",9,50,97.2,98.4,94.5,95.7),
    candle("2026-06-10",10,0,95.7,99.5,94,96.2), candle("2026-06-10",10,15,96.2,101,95.8,99.8),
    candle("2026-06-10",10,30,99.8,100.4,91,92.2), candle("2026-06-10",10,45,92.2,92.8,84.8,86.2)
  ];
  for (let index = 0; index < 24; index += 1) { const localMinute = 650 + index * 5;
    const open = 86.2 + index * 0.08; candles.push(candle("2026-06-10", Math.floor(localMinute / 60), localMinute % 60,
      open, open + 0.8, open - 1.1, open - 0.2)); }
  return candles;
}

const validScenario15m = () => [
  candle("2026-06-10",9,30,103.8,106.5,102,105.4), candle("2026-06-10",9,45,105.4,105.8,98,99),
  candle("2026-06-10",10,0,98.8,99.5,94,96), candle("2026-06-10",10,15,96.2,101,95.8,99.8),
  candle("2026-06-10",10,30,99.8,100.4,91,92.2), candle("2026-06-10",10,45,92.2,92.8,84.8,86.2)
];
const base = () => ({ candles5m: validScenario5m(), candles15m: validScenario15m(), requestedSymbol: "MNQ",
  brokerSymbol: "USTECH", sourceProvider: "mt5_read_only", sourceFingerprint: "mt5|USTECH|MNQ|5m|session-raid-fixture",
  primaryTimeframe: "5m", entryTimeframe: "15m", htfContext: { H1: [{}], H4: [{}], D1: [{}] },
  weeklyBiasDirection: "bearish", timingZone: "America/New_York", generatedAt: "2026-06-10T16:00:00.000Z" });
const v1Audit = { profileVersion: "v1", candidateCount: 12, uniqueDateCount: 12, targetFirstCount: 3,
  invalidationFirstCount: 9, targetFirstRatePercent: 25, walkForwardVerdict: "blocked" };
const v2Audit = { profileVersion: "v2", retainedCandidateCount: 1, uniqueDateCount: 1,
  sampleVerdict: "insufficient", scannerGeometryOwned: false };
const retraceTimestamp = (narrative) => narrative.steps.find((item) => item.step === "fvg_retrace")?.timestamp;
const compactV1 = (fixtureId, narrative, fallbackSignalOpen) => { const eligible = narrative.status === "complete_bearish_reversal_candidate" &&
  narrative.blockers.length === 0 && narrative.canCreateValidationChainEntry; const signalOpen = retraceTimestamp(narrative) ??
    narrative.fairValueGap?.createdAt ?? fallbackSignalOpen;
  assert.ok(signalOpen); return { schemaVersion: "gotrader-bt3-session-raid-fixture-v1", identity: { fixtureId,
    strategyId: "nasdaq_london_raid_ny_reversal_v1", profileVersion: "v1", classification: "strict_research", sourceCommit,
    requestedSymbol: narrative.requestedSymbol, brokerSymbol: narrative.brokerSymbol, sourceFingerprint: narrative.sourceFingerprint,
    timeframe: "15m", generatedAt: "2026-06-10T16:00:00.000Z", sourceSignalCandleOpen: signalOpen,
    sessionClosesAtUtc: "2026-06-10T20:00:00.000Z",
    parameterFingerprint: "session_raid_v1|asia|london_expansion|ny_raid|bearish_mss|breaker|15m_fvg_retrace|min_rr_2|strict_research" },
    detectionState: narrative.status, blockers: narrative.blockers, missingConditions: narrative.missingConditions, failedFilters: [],
    geometry: eligible ? { side: "short", entry: narrative.entry, stop: narrative.invalidation, target: narrative.target, rr: narrative.rr } : undefined,
    audit: v1Audit, promotionAllowed: false, authority }; };
const compactV2 = (fixtureId, evaluation, sourceSignalCandleOpen) => ({ schemaVersion: "gotrader-bt3-session-raid-fixture-v1",
  identity: { fixtureId, strategyId: "nasdaq_london_raid_ny_reversal_v2_filtered_research", profileVersion: "v2",
    classification: "insufficient_sample_control", sourceCommit, requestedSymbol: evaluation.telemetry.requestedSymbol,
    brokerSymbol: evaluation.telemetry.brokerSymbol, sourceFingerprint: evaluation.telemetry.sourceFingerprint, timeframe: "15m",
    generatedAt: "2026-06-10T16:00:00.000Z", sourceSignalCandleOpen, sessionClosesAtUtc: "2026-06-10T20:00:00.000Z",
    parameterFingerprint: `session_raid_v2|default_thresholds|filter_telemetry_only|${JSON.stringify(evaluation.telemetry.thresholdSet)}` },
  detectionState: evaluation.status, blockers: [], missingConditions: [], failedFilters: evaluation.telemetry.failedFilters,
  filterPassed: evaluation.telemetry.passedV2, replayOutcome: evaluation.telemetry.outcome, audit: v2Audit,
  promotionAllowed: false, authority });

async function build() {
  compileTypescriptModules({ files: [
    path.join(root, "src/lib/ict-strategy-suite/ictTradeConstructionTypes.ts"),
    path.join(root, "src/lib/ict-strategy-suite/ictTradeConstruction.ts"),
    path.join(root, "src/lib/ict-strategy-suite/ictSessionRaidReversalTypes.ts"),
    path.join(root, "src/lib/ict-strategy-suite/ictSessionRaidReversal.ts"),
    path.join(root, "src/lib/ict-strategy-suite/ictSessionRaidReversalV2Types.ts"),
    path.join(root, "src/lib/ict-strategy-suite/ictSessionRaidReversalV2.ts") ], outRoot });
  const v1Module = await import(`${pathToFileURL(path.join(outRoot, "ictSessionRaidReversal.mjs")).href}?v=${Date.now()}`);
  const v2Module = await import(`${pathToFileURL(path.join(outRoot, "ictSessionRaidReversalV2.mjs")).href}?v=${Date.now()}`);
  const input = base(); const valid = v1Module.evaluateIctSessionRaidReversal(input);
  const noRaid = v1Module.evaluateIctSessionRaidReversal({ ...input, candles5m: validScenario5m().map((item) =>
    [nyIso("2026-06-10",9,35),nyIso("2026-06-10",9,40)].includes(item.timestamp)
      ? { ...item, high: 104.8, close: Math.min(item.close,104.2) } : item) });
  const noMss = v1Module.evaluateIctSessionRaidReversal({ ...input, candles5m: validScenario5m().map((item) =>
    item.timestamp >= nyIso("2026-06-10",9,45) ? { ...item, open: 102, high: 103, low: 101.2, close: 102.4 } : item) });
  const filtered = v2Module.evaluateIctSessionRaidReversalV2Filtered(input); const signalOpen = retraceTimestamp(valid);
  assert.equal(valid.status, "complete_bearish_reversal_candidate"); assert.equal(noRaid.status, "forming");
  assert.equal(noMss.status, "forming"); assert.ok(signalOpen); assert.equal(filtered.telemetry.passedV2, false);
  return { schemaVersion: "gotrader-bt3-session-raid-snapshot-v1", payload: [
    compactV1("session_raid_v1_short_valid", valid, input.candles15m.at(-1).timestamp),
    compactV1("session_raid_v1_no_raid_blocked", noRaid, input.candles15m.at(-1).timestamp),
    compactV1("session_raid_v1_no_mss_blocked", noMss, input.candles15m.at(-1).timestamp),
    compactV2("session_raid_v2_default_filtered_policy", filtered, signalOpen) ] };
}

const first = stable(await build()); const second = stable(await build()); assert.equal(second, first);
fs.mkdirSync(fixtureRoot, { recursive: true }); const snapshotPath = path.join(fixtureRoot, "session-raid.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json"); const manifest = stable({
  schemaVersion: "gotrader-bt3-session-raid-hashes-v1", hashes: { "session-raid.snapshot.json": sha256(first) } });
if (writeMode) { fs.writeFileSync(snapshotPath, first, "utf8"); fs.writeFileSync(hashPath, manifest, "utf8"); }
else { assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g,"\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g,"\n"), manifest); }
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, fixtureCount: 4,
  snapshotHash: `sha256:${sha256(first)}`, mt5Contacted: false, authority }, null, 2));
