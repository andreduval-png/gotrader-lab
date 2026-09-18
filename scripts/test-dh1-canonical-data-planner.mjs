#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", `dh1-canonical-data-${process.pid}`);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const transpile = (source, output, replacements = []) => {
  let code = ts.transpileModule(fs.readFileSync(path.join(root, source), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove, verbatimModuleSyntax: false },
    fileName: source
  }).outputText;
  for (const [pattern, replacement] of replacements) code = code.replace(pattern, replacement);
  fs.writeFileSync(path.join(out, output), code, "utf8");
};

transpile("src/lib/canonicalData/canonicalDataRequirements.ts", "canonicalDataRequirements.mjs", [
  [/from\s+["']\.\/canonicalDataTypes["']/g, 'from "./canonicalDataTypes.mjs"']
]);
transpile("src/lib/canonicalData/canonicalDataPlanner.ts", "canonicalDataPlanner.mjs", [
  [/from\s+["']@\/lib\/ictCanonical\/canonicalIctIdentity["']/g, 'from "./canonicalIdentityStub.mjs"'],
  [/from\s+["']@\/lib\/ictCanonical\/canonicalFactBuilder["']/g, 'from "./canonicalFactBuilderStub.mjs"'],
  [/from\s+["']\.\/canonicalDataTypes["']/g, 'from "./canonicalDataTypes.mjs"']
]);
fs.writeFileSync(path.join(out, "canonicalDataTypes.mjs"), "export {};\n");
fs.writeFileSync(path.join(out, "canonicalIdentityStub.mjs"), `
const stable = (value) => JSON.stringify(value, Object.keys(value ?? {}).sort());
export const canonicalFingerprint = (value) => "fixture:" + Buffer.from(stable(value)).toString("base64url");
export const fingerprintCanonicalSource = (candles) => canonicalFingerprint(candles.map((c) => [c.id, c.timestamp, c.close]));
`);
fs.writeFileSync(path.join(out, "canonicalFactBuilderStub.mjs"), `
export const buildCanonicalIctFactSnapshot = (input) => ({ asOf: input.asOf, sourceFingerprint: input.sourceFingerprint, facts: [] });
`);

const requirements = await import(`${pathToFileURL(path.join(out, "canonicalDataRequirements.mjs")).href}?v=${Date.now()}`);
const planner = await import(`${pathToFileURL(path.join(out, "canonicalDataPlanner.mjs")).href}?v=${Date.now()}`);

const liveRequirements = requirements.canonicalLiveRequirements();
assert.deepEqual(liveRequirements.map((item) => item.consumerId), [
  "live.ifvg_v3", "live.ict_2022", "live.mmbm", "live.mmsm", "live.london_raid_v1", "context.mmxm", "context.i4_i5"
]);
assert.ok(liveRequirements.every((item) => item.tier === "LIVE_CONTEXT" && item.requiresCompletedBars));
assert.equal(requirements.CANONICAL_TACTICAL_IFVG_V4_REQUIREMENT.researchWindow.maximumCandles, 1000);
assert.equal(requirements.CANONICAL_IFVG_V4_VALIDATION_REQUIREMENT.validationWindow.maximumCandles, 50000);

const planInput = {
  requirements: liveRequirements,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  provider: "mt5_readonly",
  sourceId: "fixture-source",
  asOf: "2026-03-09T14:30:00.000Z"
};
const plan = planner.resolveCanonicalFetchPlan(planInput);
const repeated = planner.resolveCanonicalFetchPlan({ ...planInput, requirements: [...liveRequirements].reverse() });
assert.equal(plan.planId, repeated.planId, "requirement order must not change plan identity");
assert.deepEqual(plan.requests.map((item) => item.timeframe), ["W1", "D1", "H4", "H1", "M15", "M5"]);
assert.equal(new Set(plan.requests.map((item) => item.timeframe)).size, plan.requests.length, "one request per timeframe");
assert.equal(plan.requests.find((item) => item.timeframe === "M5").minimumCalendarDays, 90, "union uses max, not sum");
assert.equal(plan.concurrencyLimit, 3);
assert.ok(plan.requests.every((item) => (item.maximumHistoryBars ?? 0) < 50000), "live plan cannot inherit validation scale");
assert.throws(() => planner.resolveCanonicalFetchPlan({ ...planInput, requirements: [liveRequirements[0], requirements.CANONICAL_IFVG_V4_VALIDATION_REQUIREMENT] }), /cannot inherit HISTORICAL_VALIDATION/);

const candle = (timestamp, id = timestamp, close = 100) => ({ id, symbol: "MNQ", timeframe: "5m", timestamp, open: close, high: close + 1, low: close - 1, close, volume: 1 });
const opening = candle("2026-03-09T14:30:00.000Z", "opening");
assert.equal(planner.partitionCanonicalCompletedBars({ candles: [opening], timeframe: "M5", asOf: "2026-03-09T14:34:59.999Z" }).formingCandles.length, 1);
assert.equal(planner.partitionCanonicalCompletedBars({ candles: [opening], timeframe: "M5", asOf: "2026-03-09T14:35:00.000Z" }).closedCandles.length, 1);
assert.equal(planner.partitionCanonicalCompletedBars({ candles: [opening], timeframe: "M5", asOf: "2026-03-09T14:35:00.001Z" }).closedCandles.length, 1);

const dstOpening = candle("2026-11-01T06:00:00.000Z", "dst");
assert.equal(planner.partitionCanonicalCompletedBars({ candles: [dstOpening], timeframe: "H1", asOf: "2026-11-01T06:59:59.999Z" }).formingCandles.length, 1);
assert.equal(planner.partitionCanonicalCompletedBars({ candles: [dstOpening], timeframe: "H1", asOf: "2026-11-01T07:00:00.000Z" }).closedCandles.length, 1);
assert.equal(planner.canonicalCandleCloseTimestamp({ openTimestamp: "2026-03-08T05:00:00.000Z", timeframe: "D1" }), "2026-03-09T04:00:00.000Z", "spring DST daily bar closes at next New York wall-clock boundary");
assert.equal(planner.canonicalCandleCloseTimestamp({ openTimestamp: "2026-11-01T04:00:00.000Z", timeframe: "D1" }), "2026-11-02T05:00:00.000Z", "fall DST daily bar closes at next New York wall-clock boundary");
assert.equal(planner.partitionCanonicalCompletedBars({ candles: [candle("2026-03-08T05:00:00.000Z", "daily")], timeframe: "D1", asOf: "2026-03-09T03:59:59.999Z" }).formingCandles.length, 1);
assert.equal(planner.partitionCanonicalCompletedBars({ candles: [candle("2026-03-08T05:00:00.000Z", "daily")], timeframe: "D1", asOf: "2026-03-09T04:00:00.000Z" }).closedCandles.length, 1);

const continuity = (timestamps, timeframe = "M5") => planner.classifyCanonicalContinuity({ candles: timestamps.map((value, index) => candle(value, String(index))), timeframe, policy: "SESSION_AWARE_REQUIRED" });
assert.equal(continuity(["2026-03-09T14:30:00.000Z"]).status, "UNKNOWN");
assert.equal(continuity(["2026-03-09T14:30:00.000Z", "2026-03-09T14:35:00.000Z"]).status, "VERIFIED");
assert.equal(continuity(["2026-03-06T21:55:00.000Z", "2026-03-08T22:00:00.000Z"]).status, "EXPECTED_SESSION_BREAK");
assert.equal(continuity(["2026-03-09T21:55:00.000Z", "2026-03-09T23:00:00.000Z"]).status, "MAINTENANCE");
assert.equal(continuity(["2026-03-09T14:30:00.000Z", "2026-03-09T15:30:00.000Z"]).status, "PROVIDER_OUTAGE");
assert.equal(continuity(["2026-03-09T14:30:00.000Z", "2026-03-09T14:40:00.000Z"]).status, "GAPS_PRESENT");

let active = 0;
let peak = 0;
const taskResults = await planner.runBoundedCanonicalTasks([0, 1, 2, 3, 4, 5], 3, async (value) => {
  active += 1;
  peak = Math.max(peak, active);
  await new Promise((resolve) => setTimeout(resolve, 5));
  active -= 1;
  return value * 2;
});
assert.equal(peak, 3);
assert.deepEqual(taskResults, [0, 2, 4, 6, 8, 10]);

const stopped = new AbortController();
stopped.abort("operator_stop_requested");
let started = 0;
await assert.rejects(planner.runBoundedCanonicalTasks([1, 2], 1, async () => { started += 1; }, stopped.signal), (error) => error === stopped.signal.reason);
assert.equal(started, 0);
const midFlight = new AbortController();
await assert.rejects(planner.runBoundedCanonicalTasks([1, 2, 3], 1, async () => {
  started += 1;
  midFlight.abort("operator_timeout");
}, midFlight.signal), (error) => error === midFlight.signal.reason);
assert.equal(started, 1, "aborted queue must not schedule the next timeframe");

const duplicateBars = planner.partitionCanonicalCompletedBars({ candles: [
  candle("2026-03-09T14:20:00.000Z", "z", 200),
  candle("2026-03-09T14:20:00.000Z", "a", 100)
], timeframe: "M5", asOf: plan.asOf });
assert.deepEqual(duplicateBars.closedCandles.map((item) => item.id), ["a"], "dedup keeps deterministic id ordering");

const m5Request = plan.requests.find((item) => item.timeframe === "M5");
const historical = [
  candle("2026-03-09T14:20:00.000Z", "a"),
  candle("2026-03-09T14:25:00.000Z", "b"),
  candle("2026-03-09T14:30:00.000Z", "forming"),
  candle("2026-03-09T15:00:00.000Z", "future")
];
const timeframeSnapshot = planner.createCanonicalTimeframeSnapshot({ candles: historical, request: m5Request, asOf: plan.asOf, sourceMethod: "fixture" });
assert.deepEqual(timeframeSnapshot.closedCandles.map((item) => item.id), ["a", "b"]);
assert.equal(timeframeSnapshot.liveDisplayCandle.id, "forming");
const snapshot = planner.buildCanonicalDataSnapshot({ plan, timeframes: { M5: timeframeSnapshot } });
const futureSnapshot = planner.buildCanonicalDataSnapshot({ plan, timeframes: { M5: planner.createCanonicalTimeframeSnapshot({ candles: [...historical, candle("2027-01-01T00:00:00.000Z", "far-future")], request: m5Request, asOf: plan.asOf, sourceMethod: "fixture" }) } });
assert.equal(snapshot.snapshotId, futureSnapshot.snapshotId, "future append must not alter fixed-asOf snapshot");

const mmbmView = planner.buildCanonicalStrategyDataView({ snapshot, requirement: requirements.CANONICAL_LIVE_DATA_REQUIREMENTS.MMBM });
assert.equal(mmbmView.dependencyStatus, "AVAILABLE");
assert.deepEqual(mmbmView.missingFactTypes, []);
assert.equal(planner.canonicalFactDependencyInventory().PD_LOCATION, "PRODUCED_AND_AVAILABLE");
assert.equal(planner.canonicalFactDependencyInventory().IRL_ERL_TRANSITION, "SOURCE_OR_SEMANTIC_BLOCKED");

const completeTimeframes = Object.fromEntries(plan.requests.map((request) => [request.timeframe, {
  ...timeframeSnapshot,
  timeframe: request.timeframe,
  continuity: { ...timeframeSnapshot.continuity, timeframe: request.timeframe, status: "VERIFIED", safeForCanonicalFacts: true },
  warmupBars: Math.min(request.minimumWarmupBars, timeframeSnapshot.closedCandles.length),
  evaluationBars: Math.min(request.evaluationBars, timeframeSnapshot.closedCandles.length),
  firstEvaluationIndex: 0
}]));
const completeSnapshot = planner.buildCanonicalDataSnapshot({ plan, timeframes: completeTimeframes });
for (const requirement of liveRequirements) {
  const view = planner.buildCanonicalStrategyDataView({ snapshot: completeSnapshot, requirement });
  assert.deepEqual(Object.keys(view.timeframes).sort(), requirement.requiredTimeframes.map((item) => item.timeframe).sort(), `${requirement.consumerId} receives every declared timeframe`);
  assert.ok(Object.values(view.timeframes).every((item) => item.completedBarsOnly), `${requirement.consumerId} receives completed bars only`);
  assert.ok(Object.values(view.timeframes).every((item) => item.continuityStatus === "VERIFIED"), `${requirement.consumerId} receives explicit continuity state`);
  assert.ok(Object.values(view.timeframes).every((item) => item.evaluationStartIndex >= 0 && item.evaluationEndIndex >= item.evaluationStartIndex), `${requirement.consumerId} receives bounded evaluation indices`);
}

const inherited = requirements.canonicalCharterRequirement(requirements.CANONICAL_LIVE_DATA_REQUIREMENTS.ICT_2022, "charter-model-1");
assert.equal(inherited.inheritsOwnerId, requirements.CANONICAL_LIVE_DATA_REQUIREMENTS.ICT_2022.ownerId);
assert.equal(inherited.requiredTimeframes, requirements.CANONICAL_LIVE_DATA_REQUIREMENTS.ICT_2022.requiredTimeframes);

console.log(`DH1 canonical planner tests passed: ${plan.requests.length} live timeframe requests, concurrency ${peak}, forming bars quarantined, tier isolation enforced.`);
