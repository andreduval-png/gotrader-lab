#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-higher-timeframe-bias-facts-test");
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
  "src/lib/v2/context/v2DisplacementFvgFactEngine.ts",
  "src/lib/v2/context/v2HigherTimeframeBiasFactEngine.ts",
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
const source = identityModule.createV2SourceIdentity({
  sourceId: "fixture:USTECH:multi-timeframe:phase2a6",
  provider: "imported_historical",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "phase2a6-explicit-htf-fixture",
  sourceKind: "imported_historical"
});
const timeframeMilliseconds = {
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000
};
const fixtureEnd = "2026-07-20T00:00:00.000Z";
const makeCandles = ({ timeframe, closes, highs = [] }) =>
  Object.freeze(closes.map((close, index) => {
    const open = index ? closes[index - 1] : close - 0.05;
    const timestamp = Date.parse(fixtureEnd) - timeframeMilliseconds[timeframe] * (closes.length - index);
    return Object.freeze({
      timestamp: new Date(timestamp).toISOString(),
      open,
      high: highs[index] ?? Math.max(open, close) + 0.2,
      low: Math.min(open, close) - 0.2,
      close,
      volume: 100 + index,
      closed: true
    });
  }));

const snapshots = new Map([
  ["15m", makeCandles({ timeframe: "15m", closes: [100.2, 100.4, 100.6, 100.8, 102] })],
  ["1h", makeCandles({ timeframe: "1h", closes: [110, 109.8, 109.5, 109.2, 107] })],
  ["4h", makeCandles({ timeframe: "4h", closes: [100, 100.02, 99.99, 100.03, 100.04] })],
  ["1d", makeCandles({
    timeframe: "1d",
    closes: [100.2, 101.4, 102, 101.8, 101.5],
    highs: [100.4, 101.6, 102.5, 102, 102.1]
  })],
  ["1w", makeCandles({ timeframe: "1w", closes: [100, 101] })],
  ["5m", makeCandles({ timeframe: "5m", closes: [100, 100.1, 100.2, 100.3, 100.4] })]
]);
const windowFor = async (timeframe) => {
  const repository = repositoryModule.createV2StaticCandleRepository({
    adapterId: `phase2a6-${timeframe}-fixture-adapter`,
    asOf: () => "2026-07-20T00:00:00.000Z",
    loadSource: async () => ({
      identity: source,
      timeframe,
      candles: snapshots.get(timeframe),
      closurePolicy: "historical_dataset"
    })
  });
  return repository.getWindow({
    source,
    timeframe,
    limit: 20,
    closedOnly: true,
    purpose: "context_shadow"
  });
};

const requiredTimeframes = ["15m", "1h", "4h", "1d", "1w"];
const windows = await Promise.all(requiredTimeframes.map(windowFor));
const request = {
  source,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: "2026-07-20T00:00:00.000Z",
  requiredTimeframes,
  windows,
  purpose: "deterministic_fixture",
  requestedFactFamilies: ["higher_timeframe_bias"],
  builtAt: "2026-07-20T00:00:01.000Z"
};
const context = await contextModule.buildV2CanonicalMarketContext(request);
assert.equal(context.diagnostics.status, "degraded", JSON.stringify(context.diagnostics));
assert.equal(context.diagnostics.factEngineStatus, "higher_timeframe_bias_phase_2a6");
assert.deepEqual(context.identity.requestedFactFamilies, ["higher_timeframe_bias"]);
assert.deepEqual(
  context.identity.factPolicyVersions,
  [contextTypes.V2_CONTEXT_HIGHER_TIMEFRAME_BIAS_FACT_POLICY_VERSION]
);
assert.equal(context.facts.length, 5);

const byTimeframe = Object.fromEntries(context.facts.map((fact) => [fact.timeframe, fact]));
assert.equal(byTimeframe["15m"].payload.direction, "bullish");
assert.equal(byTimeframe["15m"].payload.confidenceClass, "high");
assert.equal(byTimeframe["1h"].payload.direction, "bearish");
assert.equal(byTimeframe["1h"].payload.confidenceClass, "high");
assert.equal(byTimeframe["4h"].payload.direction, "neutral");
assert.equal(byTimeframe["4h"].payload.confidenceClass, "low");
assert.equal(byTimeframe["1d"].payload.direction, "bullish");
assert.equal(byTimeframe["1d"].payload.confidenceClass, "medium");
assert.equal(byTimeframe["1w"].payload.direction, "insufficient_data");
assert.equal(byTimeframe["1w"].payload.complete, false);
assert.equal(byTimeframe["1w"].quality.status, "degraded");
assert.ok(context.diagnostics.warnings.includes(
  "higher_timeframe_bias_insufficient_closed_candles:1w:2/5"
));
assert.deepEqual(byTimeframe["1w"].derivation.inputWindowIdentityHashes, [windows[4].identity.identityHash]);
assert.deepEqual(byTimeframe["1w"].derivation.inputFactIds, []);
assert.doesNotMatch(byTimeframe["1w"].payload.basis, /1d|derived|synthesized/i);

const reordered = await contextModule.buildV2CanonicalMarketContext({
  ...request,
  windows: [...windows].reverse(),
  builtAt: "2026-07-20T00:00:02.000Z"
});
assert.equal(reordered.contextArtifactId, context.contextArtifactId);
assert.deepEqual(reordered.facts.map((fact) => fact.factId), context.facts.map((fact) => fact.factId));

const missingH4 = await contextModule.buildV2CanonicalMarketContext({
  ...request,
  windows: windows.filter((window) => Object.keys(window.identity.candleCountByTimeframe)[0] !== "4h")
});
assert.equal(missingH4.diagnostics.status, "blocked");
assert.ok(missingH4.diagnostics.blockers.includes("required_timeframe_missing:4h"));
assert.equal(missingH4.facts.length, 0);

const m5Window = await windowFor("5m");
const unsupportedOnly = await contextModule.buildV2CanonicalMarketContext({
  ...request,
  requiredTimeframes: ["5m"],
  windows: [m5Window]
});
assert.equal(unsupportedOnly.diagnostics.status, "blocked");
assert.ok(unsupportedOnly.diagnostics.blockers.includes(
  "higher_timeframe_bias_requires_explicit_m15_h1_h4_d1_or_w1_window"
));

const serialized = JSON.stringify(context);
assert.doesNotMatch(serialized, /"candles"\s*:/i);
assert.doesNotMatch(serialized, /rawServer|rawProvider|accountData|orderData|positionData|password|secret|apiKey|token/i);
assert.deepEqual(context.authority, authority);
assert.ok(context.facts.every((fact) => JSON.stringify(fact.authority) === JSON.stringify(authority)));

const productionAdoptions = [];
const scan = (directory) => {
  if (directory === path.join(workspace, "src", "lib", "v2")) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(fullPath);
    else if (
      /\.(?:ts|tsx)$/.test(entry.name) &&
      /buildV2HigherTimeframeBiasFacts|V2_CONTEXT_HIGHER_TIMEFRAME_BIAS_FACT_POLICY_VERSION/.test(
        fs.readFileSync(fullPath, "utf8")
      )
    ) {
      productionAdoptions.push(fullPath);
    }
  }
};
scan(path.join(workspace, "src"));
assert.deepEqual(productionAdoptions, []);

console.log(JSON.stringify({
  status: "passed",
  factCount: context.facts.length,
  directions: Object.fromEntries(
    Object.entries(byTimeframe).map(([timeframe, fact]) => [timeframe, fact.payload.direction])
  ),
  explicitWindowsOnly: true,
  missingTimeframeVisible: missingH4.diagnostics.missingTimeframes,
  weeklySynthesizedFromDaily: false,
  rawCandleArraysSerialized: false,
  productionAdoptions: productionAdoptions.length,
  shadowOnly: context.shadowOnly,
  authority
}, null, 2));
