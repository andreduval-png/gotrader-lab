#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-dealing-range-liquidity-facts-test");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
  "src/lib/v2/context/v2ContextTypes.ts",
  "src/lib/v2/context/v2ContextIdentity.ts",
  "src/lib/v2/context/v2ContextEligibility.ts",
  "src/lib/v2/context/v2SessionOpeningFactEngine.ts",
  "src/lib/v2/context/v2DealingRangeLiquidityFactEngine.ts",
  "src/lib/v2/context/v2ContextBuilder.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const identityModule = await load("v2Identity");
const repositoryModule = await load("v2StaticCandleRepository");
const contextModule = await load("v2ContextBuilder");
const contextTypes = await load("v2ContextTypes");

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const overrides = new Map([
  ["2026-07-13T00:30:00.000Z", { open: 103, high: 105, low: 99, close: 104 }],
  ["2026-07-13T03:00:00.000Z", { open: 97, high: 101, low: 95, close: 96 }],
  ["2026-07-13T06:30:00.000Z", { open: 104, high: 106, low: 99, close: 105.5 }],
  ["2026-07-13T07:30:00.000Z", { open: 96, high: 101, low: 94, close: 96 }]
]);
const makeCandles = ({
  start = "2026-07-12T22:00:00.000Z",
  end = "2026-07-13T20:00:00.000Z",
  minutes = 5
} = {}) => {
  const candles = [];
  for (let timestamp = Date.parse(start); timestamp < Date.parse(end); timestamp += minutes * 60_000) {
    const iso = new Date(timestamp).toISOString();
    const price = overrides.get(iso) ?? { open: 100, high: 101, low: 99, close: 100.5 };
    candles.push(Object.freeze({ timestamp: iso, ...price, volume: 100, closed: true }));
  }
  return Object.freeze(candles);
};

const source = identityModule.createV2SourceIdentity({
  sourceId: "fixture:USTECH:5m:phase2a4",
  provider: "imported_historical",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "phase2a4-range-liquidity-fixture",
  sourceKind: "imported_historical"
});
const fullCandles = makeCandles();
const windowFor = async ({ candles = fullCandles, timeframe = "5m", asOf = "2026-07-13T20:00:00.000Z" } = {}) => {
  const repository = repositoryModule.createV2StaticCandleRepository({
    adapterId: "phase2a4-fixture-adapter",
    asOf: () => asOf,
    loadSource: async () => ({
      identity: source,
      timeframe,
      candles,
      closurePolicy: "historical_dataset"
    })
  });
  return repository.getWindow({ source, timeframe, limit: 500, closedOnly: true, purpose: "context_shadow" });
};

const fullWindow = await windowFor();
const request = {
  source,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: "2026-07-13T20:00:00.000Z",
  requiredTimeframes: ["5m"],
  windows: [fullWindow],
  purpose: "deterministic_fixture",
  requestedFactFamilies: ["session", "opening_price", "dealing_range", "liquidity"],
  builtAt: "2026-07-13T20:00:01.000Z"
};
const context = await contextModule.buildV2CanonicalMarketContext(request);
assert.equal(context.diagnostics.status, "eligible");
assert.equal(context.diagnostics.factEngineStatus, "range_liquidity_phase_2a4");
assert.deepEqual(context.identity.requestedFactFamilies, ["dealing_range", "liquidity", "opening_price", "session"]);
assert.deepEqual(context.identity.factPolicyVersions, [
  contextTypes.V2_CONTEXT_DEALING_RANGE_FACT_POLICY_VERSION,
  contextTypes.V2_CONTEXT_LIQUIDITY_FACT_POLICY_VERSION,
  contextTypes.V2_CONTEXT_OPENING_PRICE_FACT_POLICY_VERSION,
  contextTypes.V2_CONTEXT_SESSION_FACT_POLICY_VERSION
]);

const ranges = context.facts.filter((fact) => fact.kind === "dealing_range");
const pools = context.facts.filter((fact) => fact.kind === "liquidity_pool");
const sweeps = context.facts.filter((fact) => fact.kind === "liquidity_sweep");
assert.equal(ranges.length, 5);
assert.equal(pools.length, 10);
assert.equal(sweeps.length, 2);
assert.ok(ranges.every((fact) => fact.payload.complete));
assert.ok(pools.every((fact) => fact.payload.confirmedAt === fact.payload.formedAt));

const asiaRange = ranges.find((fact) => fact.payload.rangeType === "session:asia");
assert.deepEqual({
  low: asiaRange.payload.low,
  high: asiaRange.payload.high,
  midpoint: asiaRange.payload.midpoint,
  equilibrium: asiaRange.payload.equilibrium,
  premiumBoundary: asiaRange.payload.premiumBoundary,
  discountBoundary: asiaRange.payload.discountBoundary,
  direction: asiaRange.payload.direction
}, {
  low: 95,
  high: 105,
  midpoint: 100,
  equilibrium: 100,
  premiumBoundary: 105,
  discountBoundary: 95,
  direction: "bullish"
});
assert.equal(asiaRange.payload.anchorFactIds.length, 1);
assert.deepEqual(asiaRange.derivation.inputFactIds, asiaRange.payload.anchorFactIds);

const asiaBuyPool = pools.find((fact) => fact.payload.poolType === "session_high:asia");
const asiaSellPool = pools.find((fact) => fact.payload.poolType === "session_low:asia");
const londonBuyPool = pools.find((fact) => fact.payload.poolType === "session_high:london");
assert.equal(asiaBuyPool.payload.state, "swept");
assert.equal(asiaSellPool.payload.state, "swept");
assert.equal(londonBuyPool.payload.state, "active");
assert.equal(asiaBuyPool.payload.price, 105);
assert.equal(asiaSellPool.payload.price, 95);
const buySweep = sweeps.find((fact) => fact.payload.side === "buy_side");
const sellSweep = sweeps.find((fact) => fact.payload.side === "sell_side");
assert.equal(buySweep.payload.closedBackInside, false);
assert.equal(buySweep.payload.confirmationState, "wick_through");
assert.equal(sellSweep.payload.closedBackInside, true);
assert.equal(sellSweep.payload.confirmationState, "confirmed");
assert.ok(sweeps.every((fact) => !("displacementFollowThrough" in fact.payload)));
assert.deepEqual(sweeps.map((fact) => fact.payload.side).sort(), ["buy_side", "sell_side"]);

const rebuilt = await contextModule.buildV2CanonicalMarketContext({ ...request, builtAt: "2026-07-13T20:01:00.000Z" });
assert.equal(rebuilt.contextArtifactId, context.contextArtifactId);
assert.deepEqual(rebuilt.facts.map((fact) => fact.factId), context.facts.map((fact) => fact.factId));

const missingDependency = await contextModule.buildV2CanonicalMarketContext({
  ...request,
  requestedFactFamilies: ["dealing_range"]
});
assert.equal(missingDependency.diagnostics.status, "blocked");
assert.ok(missingDependency.diagnostics.blockers.includes("fact_family_dependency_missing:dealing_range:session"));
assert.equal(missingDependency.facts.length, 0);

const partialCandles = Object.freeze(fullCandles.filter((candle) => Date.parse(candle.timestamp) < Date.parse("2026-07-13T14:00:00.000Z")));
const partialWindow = await windowFor({ candles: partialCandles, asOf: "2026-07-13T14:00:00.000Z" });
const partial = await contextModule.buildV2CanonicalMarketContext({
  ...request,
  asOfMarketTime: "2026-07-13T14:00:00.000Z",
  windows: [partialWindow]
});
const partialNyAmRange = partial.facts.find((fact) => fact.kind === "dealing_range" && fact.payload.rangeType === "session:new_york_am");
assert.equal(partial.diagnostics.status, "degraded");
assert.equal(partialNyAmRange.payload.complete, false);
assert.ok(partial.diagnostics.warnings.includes("liquidity_pool_deferred_incomplete_session:new_york_am"));
assert.equal(partial.facts.some((fact) => fact.kind === "liquidity_pool" && fact.payload.poolType.endsWith(":new_york_am")), false);

const serialized = JSON.stringify(context);
assert.doesNotMatch(serialized, /"candles"\s*:/i);
assert.doesNotMatch(serialized, /rawServer|rawProvider|timeCurrentRaw|accountData|orderData|positionData|password|secret|apiKey|token/i);
assert.deepEqual(context.authority, authority);
assert.ok(context.facts.every((fact) => JSON.stringify(fact.authority) === JSON.stringify(authority)));

const productionAdoptions = [];
const scan = (directory) => {
  if (directory === path.join(workspace, "src", "lib", "v2")) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(fullPath);
    else if (/\.(?:ts|tsx)$/.test(entry.name) && /buildV2DealingRangeLiquidityFacts|V2_CONTEXT_LIQUIDITY_FACT_POLICY_VERSION/.test(fs.readFileSync(fullPath, "utf8"))) {
      productionAdoptions.push(fullPath);
    }
  }
};
scan(path.join(workspace, "src"));
assert.deepEqual(productionAdoptions, []);

console.log(JSON.stringify({
  status: "passed",
  completeSessionRanges: ranges.length,
  confirmedLiquidityPools: pools.length,
  strictLiquiditySweeps: sweeps.length,
  rejectedBackInsideSweeps: sweeps.filter((fact) => fact.payload.closedBackInside).length,
  wickThroughSweeps: sweeps.filter((fact) => fact.payload.confirmationState === "wick_through").length,
  incompleteSessionPoolCreated: false,
  displacementInferred: false,
  missingDependencyBlocked: missingDependency.diagnostics.status === "blocked",
  rawCandleArraysSerialized: false,
  productionAdoptions: productionAdoptions.length,
  shadowOnly: context.shadowOnly,
  authority
}, null, 2));
