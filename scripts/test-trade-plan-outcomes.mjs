#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gotrader-trade-plan-outcomes-"));
const compile = (source, target, replacements = []) => {
  let output = ts.transpileModule(fs.readFileSync(path.join(root, source), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  for (const [from, to] of replacements) output = output.replaceAll(from, to);
  fs.writeFileSync(path.join(temp, target), output, "utf8");
};

compile("src/lib/tradePlanOutcomes/tradePlanOutcomeTypes.ts", "tradePlanOutcomeTypes.mjs");
compile("src/lib/tradePlanOutcomes/tradePlanOutcomeEvaluation.ts", "tradePlanOutcomeEvaluation.mjs", [
  ["./tradePlanOutcomeTypes", "./tradePlanOutcomeTypes.mjs"]
]);
compile("src/lib/tradePlanOutcomes/tradePlanResultsSnapshot.ts", "tradePlanResultsSnapshot.mjs", [
  ["./tradePlanOutcomeTypes", "./tradePlanOutcomeTypes.mjs"]
]);

const evaluation = await import(new URL(`file:///${path.join(temp, "tradePlanOutcomeEvaluation.mjs").replaceAll("\\", "/")}`));
const summary = await import(new URL(`file:///${path.join(temp, "tradePlanResultsSnapshot.mjs").replaceAll("\\", "/")}`));

const candle = (timestamp, { open = 100, high = 101, low = 99, close = 100, symbol = "MNQ", timeframe = "5m" } = {}) => ({
  id: `candle-${timestamp}`,
  timestamp,
  symbol,
  timeframe,
  open,
  high,
  low,
  close
});

const run = ({ cycleId, side = "long", decision = "research_only", entry = 100, stop = 95, target = 110, generatedAt = "2026-08-15T10:00:00.000Z", scalpStatus } = {}) => ({
  cycleId,
  startedAt: generatedAt,
  completedAt: generatedAt,
  status: "completed_with_warnings",
  steps: [],
  llmBridgeAvailable: true,
  researchTimeframe: "5m",
  dataSourceMode: "mt5_read_only",
  sourceMetadata: {
    activeSourceMode: "mt5_read_only",
    activeSourceLabel: "MT5 USTECH",
    activeSourceFingerprint: `fingerprint-${cycleId}`,
    candleCount: 100,
    researchEligibility: "eligible",
    eligibilityReasons: [],
    sourceWarnings: [],
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }
  },
  thesisSummary: { symbol: "MNQ", timeframe: "5m" },
  ictAdvisorSignalSummary: {
    packetId: `packet-${cycleId}`,
    generatedAt,
    strategyId: "liquidity_reclaim_scalper_v1",
    setup: "liquidity_reclaim",
    side,
    decision,
    confidence: 0.78,
    compositeBias: side === "long" ? "bullish" : "bearish",
    entryZoneMidpoint: entry,
    invalidation: stop,
    target,
    rrEstimate: 2,
    scalpStatus,
    summary: "Research-only plan",
    noTradeReasons: []
  },
  blockers: [],
  promotionBlockers: [],
  readinessSnapshot: { state: "Not Ready" },
  nextRecommendedAction: "Observe only",
  resultSummary: "Cycle complete",
  safetyNotice: "Research cycle only. Broker execution remains disabled."
});

const identityCandles = [candle("2026-08-15T09:55:00.000Z")];
const longRecord = evaluation.buildTradePlanCycleResult(run({ cycleId: "long-target" }), identityCandles);
assert.equal(longRecord.plan.horizon, "intraday");
assert.equal(longRecord.plan.signal, "BUY");
assert.equal(longRecord.plan.plannedTargetPoints, 10);
const longPassed = evaluation.evaluateTradePlanOutcome(longRecord, [
  candle("2026-08-15T10:05:00.000Z", { high: 101, low: 99, close: 100.5 }),
  candle("2026-08-15T10:10:00.000Z", { high: 111, low: 99, close: 109 })
], "2026-08-15T10:20:00.000Z");
assert.equal(longPassed.outcome.status, "passed_target_first");
assert.equal(longPassed.outcome.realizedPoints, 10);
assert.equal(longPassed.outcome.realizedR, 2);

const shortRecord = evaluation.buildTradePlanCycleResult(run({ cycleId: "short-stop", side: "short", entry: 100, stop: 105, target: 90 }), identityCandles);
assert.equal(shortRecord.plan.signal, "SELL");
const shortFailed = evaluation.evaluateTradePlanOutcome(shortRecord, [
  candle("2026-08-15T10:05:00.000Z", { high: 106, low: 99, close: 105 })
], "2026-08-15T10:20:00.000Z");
assert.equal(shortFailed.outcome.status, "failed_stop_first");
assert.equal(shortFailed.outcome.realizedPoints, -5);

const ambiguous = evaluation.evaluateTradePlanOutcome(longRecord, [
  candle("2026-08-15T10:05:00.000Z", { high: 111, low: 94, close: 103 })
], "2026-08-15T10:20:00.000Z");
assert.equal(ambiguous.outcome.status, "ambiguous_stop_first");
assert.equal(ambiguous.outcome.realizedR, -1);

const noTrade = evaluation.buildTradePlanCycleResult(run({ cycleId: "no-trade", decision: "no_trade" }), identityCandles);
assert.equal(noTrade.outcome.status, "not_evaluable");
assert.equal(noTrade.plan.signal, "NO_TRADE");

const notTriggered = evaluation.evaluateTradePlanOutcome(
  evaluation.buildTradePlanCycleResult(run({ cycleId: "not-triggered" }), identityCandles),
  [candle("2026-08-15T10:05:00.000Z", { high: 120, low: 110, close: 115 })],
  "2026-08-16T11:00:00.000Z"
);
assert.equal(notTriggered.outcome.status, "not_triggered");

const mismatch = evaluation.evaluateTradePlanOutcome(longRecord, [
  candle("2026-08-15T10:05:00.000Z", { symbol: "ES", high: 111, low: 94 })
], "2026-08-15T10:20:00.000Z");
assert.deepEqual(mismatch.outcome, longRecord.outcome);

assert.equal(evaluation.classifyTradePlanHorizon({ timeframe: "5m", scalpStatus: "scalp_candidate" }).horizon, "scalp");
assert.equal(evaluation.classifyTradePlanHorizon({ timeframe: "1h" }).horizon, "swing");

const snapshot = summary.buildTradePlanResultsSnapshot(
  [longPassed, shortFailed, ambiguous, noTrade, notTriggered],
  "2026-08-16T12:00:00.000Z"
);
assert.equal(snapshot.cycleCount, 5);
assert.equal(snapshot.passedCount, 1);
assert.equal(snapshot.failedCount, 1);
assert.equal(snapshot.ambiguousCount, 1);
assert.equal(snapshot.notTriggeredCount, 1);
assert.equal(snapshot.daily.reduce((sum, day) => sum + day.cycleCount, 0), 5);
assert.equal(snapshot.authority.executionAuthority, "none");
assert.ok(snapshot.calibrationSuggestions.some((item) => /ambiguity/i.test(item)));
assert.doesNotMatch(JSON.stringify(longPassed), /"candles"\s*:/);

const view = fs.readFileSync(path.join(root, "src/components/performance/PerformanceView.tsx"), "utf8");
const cycleRunner = fs.readFileSync(path.join(root, "src/lib/researchCycle/runResearchCycle.ts"), "utf8");
for (const marker of ["results-tab-trade-plans", "trade-plan-outcome-list", "trade-plan-daily-results", "trade-plan-calibration-suggestions", "refresh-trade-plan-outcomes"]) {
  assert.match(view, new RegExp(marker));
}
assert.match(cycleRunner, /persistTradePlanCycleSafely/);
assert.match(cycleRunner, /scalpStatus:\s*advisorPacket\.compactSummary\.scalpStatus/);

console.log(JSON.stringify({
  status: "passed",
  scenarios: ["long_target_first", "short_stop_first", "same_bar_ambiguous", "no_trade", "not_triggered", "identity_mismatch"],
  rawCandlesPersisted: false,
  authority: "none/none/none"
}, null, 2));
