#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildOpportunity, candle, loadBt2Modules } from "./support/bt2-simulation-fixtures.mjs";

const root = path.resolve(".gotrader", "bt2-simulator-tests");
fs.rmSync(root, { recursive: true, force: true });
const modules = await loadBt2Modules({ outRoot: path.join(root, "compiled") });
const cost = await modules.simulation.buildSimulationCostModel({
  version: "1",
  pointSize: 0.01,
  spreadMode: "static",
  staticSpreadPoints: 2,
  slippagePoints: 1,
  commissionR: 0.01,
  swapR: 0
});
const simulate = async (opportunity, candles, policy = "conservative_stop_first_v1", lowerTimeframeCandles) =>
  modules.simulation.simulateTrade({ opportunity, candles, intrabarPolicy: policy, costModel: cost, lowerTimeframeCandles });

const longOpportunity = await buildOpportunity(modules);
const ambiguousCandle = candle("2026-01-05T14:30:00.000Z", 100, 102.2, 98.8, 101);
const conservative = await simulate(longOpportunity, [ambiguousCandle]);
assert.equal(conservative.terminalState, "exited");
assert.equal(conservative.exitReason, "stop");
assert.equal(conservative.grossR, -1);
assert.ok(conservative.netR < conservative.grossR);

const ambiguous = await simulate(longOpportunity, [ambiguousCandle], "ambiguous_no_result_v1");
assert.equal(ambiguous.terminalState, "ambiguous");
assert.equal(ambiguous.grossR, undefined);

const entryTargetOnly = candle("2026-01-05T14:30:00.000Z", 101, 102.2, 99.8, 101.5);
const conservativeEntryTarget = await simulate(longOpportunity, [
  entryTargetOnly,
  candle("2026-01-05T14:35:00.000Z", 101.5, 101.8, 98.8, 99)
]);
assert.equal(conservativeEntryTarget.exitReason, "stop");
assert.equal(conservativeEntryTarget.grossR, -1);
const ambiguousEntryTarget = await simulate(longOpportunity, [entryTargetOnly], "ambiguous_no_result_v1");
assert.equal(ambiguousEntryTarget.exitReason, "entry_target_order_ambiguous");
const resolvedEntryTarget = await simulate(longOpportunity, [entryTargetOnly], "lower_timeframe_resolution_v1", [
  { ...candle("2026-01-05T14:30:00.000Z", 101, 101.2, 99.8, 100.5), closeTimeUtc: "2026-01-05T14:31:00.000Z" },
  { ...candle("2026-01-05T14:31:00.000Z", 100.5, 102.1, 100.4, 102), closeTimeUtc: "2026-01-05T14:32:00.000Z" }
]);
assert.equal(resolvedEntryTarget.exitReason, "target");

const resolved = await simulate(longOpportunity, [ambiguousCandle], "lower_timeframe_resolution_v1", [
  { ...candle("2026-01-05T14:30:00.000Z", 100, 102.1, 99.8, 101.5), closeTimeUtc: "2026-01-05T14:31:00.000Z" }
]);
assert.equal(resolved.exitReason, "target");
assert.equal(resolved.grossR, 2);

const gapStop = await simulate(longOpportunity, [
  candle("2026-01-05T14:30:00.000Z", 100, 100.5, 99.8, 100.2),
  candle("2026-01-05T14:35:00.000Z", 98.5, 99.2, 98, 98.8)
]);
assert.equal(gapStop.exitPrice, 98.5);
assert.equal(gapStop.grossR, -1.5);

const shortOpportunity = await buildOpportunity(modules, {
  direction: "short",
  stopPrice: 101,
  targetPrices: Object.freeze([98])
});
const shortTarget = await simulate(shortOpportunity, [
  candle("2026-01-05T14:30:00.000Z", 100, 100.4, 99.4, 99.8),
  candle("2026-01-05T14:35:00.000Z", 99.8, 100, 97.8, 98.2)
]);
assert.equal(shortTarget.exitReason, "target");
assert.equal(shortTarget.grossR, 2);

const expired = await simulate(
  await buildOpportunity(modules, { entryPrice: 95, stopPrice: 94, targetPrices: Object.freeze([97]) }),
  [candle("2026-01-05T14:55:00.000Z", 100, 101, 99, 100)],
);
assert.equal(expired.terminalState, "expired_unfilled");

const insufficient = await simulate(
  await buildOpportunity(modules, { entryPrice: 95, stopPrice: 94, targetPrices: Object.freeze([97]) }),
  [candle("2026-01-05T14:30:00.000Z", 100, 101, 99, 100)]
);
assert.equal(insufficient.terminalState, "insufficient_data");

const candleSpreadCost = await modules.simulation.buildSimulationCostModel({
  version: "1", pointSize: 0.01, spreadMode: "candle", slippagePoints: 0, commissionR: 0, swapR: 0
});
const missingSpread = await modules.simulation.simulateTrade({
  opportunity: longOpportunity,
  candles: [candle("2026-01-05T14:30:00.000Z", 100, 100.5, 99.5, 100, undefined), candle("2026-01-05T14:35:00.000Z", 100, 102.1, 99.8, 102, undefined)].map(({ spreadPoints: _spread, ...item }) => item),
  intrabarPolicy: "conservative_stop_first_v1",
  costModel: candleSpreadCost
});
assert.equal(missingSpread.terminalState, "blocked");
assert.equal(missingSpread.transitions.at(-1).state, "blocked");
assert.ok(missingSpread.blockers.includes("bt2_cost_spread_missing"));

console.log(JSON.stringify({
  status: "passed",
  conservativeRecordId: conservative.recordId,
  ambiguousRecordId: ambiguous.recordId,
  longShortCovered: true,
  gapAware: true,
  grossNetSeparated: conservative.netR !== conservative.grossR,
  authority: conservative.authority
}, null, 2));
