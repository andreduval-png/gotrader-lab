#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-displacement-fvg-facts-test");
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

const overrides = new Map([
  ["2026-07-13T00:30:00.000Z", { open: 100, high: 105, low: 99, close: 104 }],
  ["2026-07-13T03:00:00.000Z", { open: 100, high: 101, low: 95, close: 96 }],
  ["2026-07-13T04:25:00.000Z", { open: 100, high: 107, low: 99.5, close: 106.5 }],
  ["2026-07-13T04:30:00.000Z", { open: 106.5, high: 108, low: 102, close: 107 }],
  ["2026-07-13T04:35:00.000Z", { open: 107, high: 107.5, low: 102, close: 106 }],
  ["2026-07-13T04:40:00.000Z", { open: 106, high: 106.5, low: 101.5, close: 105 }],
  ["2026-07-13T04:45:00.000Z", { open: 105, high: 105.5, low: 100.5, close: 101.2 }],
  ["2026-07-13T04:50:00.000Z", { open: 101.2, high: 102, low: 99, close: 100 }],
  ["2026-07-13T05:25:00.000Z", { open: 100, high: 100.5, low: 93.5, close: 94 }],
  ["2026-07-13T05:30:00.000Z", { open: 94, high: 98, low: 92, close: 93.5 }]
]);
const makeCandles = () => {
  const candles = [];
  const start = Date.parse("2026-07-12T22:00:00.000Z");
  const end = Date.parse("2026-07-13T20:00:00.000Z");
  for (let timestamp = start; timestamp < end; timestamp += 5 * 60_000) {
    const iso = new Date(timestamp).toISOString();
    const lowerRegime = timestamp > Date.parse("2026-07-13T05:30:00.000Z");
    const price = overrides.get(iso) ?? (lowerRegime
      ? { open: 94, high: 95, low: 93, close: 94.5 }
      : { open: 100, high: 101, low: 99, close: 100.5 });
    candles.push(Object.freeze({ timestamp: iso, ...price, volume: 100, closed: true }));
  }
  return Object.freeze(candles);
};

const source = identityModule.createV2SourceIdentity({
  sourceId: "fixture:USTECH:5m:phase2a5",
  provider: "imported_historical",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "phase2a5-displacement-fvg-fixture",
  sourceKind: "imported_historical"
});
const candles = makeCandles();
const windowAt = async (asOf) => {
  const repository = repositoryModule.createV2StaticCandleRepository({
    adapterId: "phase2a5-fixture-adapter",
    asOf: () => asOf,
    loadSource: async () => ({
      identity: source,
      timeframe: "5m",
      candles: candles.filter((candle) => Date.parse(candle.timestamp) < Date.parse(asOf)),
      closurePolicy: "historical_dataset"
    })
  });
  return repository.getWindow({
    source,
    timeframe: "5m",
    end: asOf,
    limit: 500,
    closedOnly: true,
    purpose: "context_shadow"
  });
};

const buildAt = async (asOf, requestedFactFamilies = ["displacement", "fair_value_gap"]) => {
  const window = await windowAt(asOf);
  return contextModule.buildV2CanonicalMarketContext({
    source,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    asOfMarketTime: asOf,
    requiredTimeframes: ["5m"],
    windows: [window],
    purpose: "deterministic_fixture",
    requestedFactFamilies,
    builtAt: "2026-07-13T20:00:01.000Z"
  });
};

const primaryGap = (context) => context.facts.find((fact) =>
  fact.kind === "fair_value_gap" && fact.payload.lowerBound === 101 && fact.payload.upperBound === 102
);
const lifecycleExpectations = [
  ["2026-07-13T04:35:00.000Z", "fresh"],
  ["2026-07-13T04:40:00.000Z", "touched"],
  ["2026-07-13T04:45:00.000Z", "partially_filled"],
  ["2026-07-13T04:50:00.000Z", "filled"],
  ["2026-07-13T04:55:00.000Z", "inverted"]
];
for (const [asOf, expectedState] of lifecycleExpectations) {
  const context = await buildAt(asOf);
  assert.equal(
    context.diagnostics.factEngineStatus,
    "displacement_fvg_phase_2a5",
    JSON.stringify(context.diagnostics)
  );
  assert.equal(primaryGap(context)?.payload.state, expectedState, `Expected ${expectedState} at ${asOf}`);
}

const fullFamilies = [
  "session",
  "opening_price",
  "dealing_range",
  "liquidity",
  "displacement",
  "fair_value_gap"
];
const context = await buildAt("2026-07-13T20:00:00.000Z", fullFamilies);
assert.equal(context.diagnostics.status, "eligible");
assert.equal(context.diagnostics.factEngineStatus, "displacement_fvg_phase_2a5");
assert.deepEqual(context.identity.requestedFactFamilies, [
  "dealing_range",
  "displacement",
  "fair_value_gap",
  "liquidity",
  "opening_price",
  "session"
]);
assert.ok(context.identity.factPolicyVersions.includes(contextTypes.V2_CONTEXT_DISPLACEMENT_FACT_POLICY_VERSION));
assert.ok(context.identity.factPolicyVersions.includes(contextTypes.V2_CONTEXT_FAIR_VALUE_GAP_FACT_POLICY_VERSION));

const displacements = context.facts.filter((fact) => fact.kind === "displacement");
const gaps = context.facts.filter((fact) => fact.kind === "fair_value_gap");
const bullishDisplacement = displacements.find((fact) => fact.payload.candleTime === "2026-07-13T04:25:00.000Z");
const bullishGap = primaryGap(context);
const bearishGap = gaps.find((fact) =>
  fact.payload.direction === "bearish" && fact.payload.lowerBound === 98 && fact.payload.upperBound === 99
);
assert.ok(bullishDisplacement);
assert.equal(bullishDisplacement.payload.direction, "bullish");
assert.equal(bullishDisplacement.payload.comparisonBaseline, "mean_body_previous_10_closed_candles");
assert.ok(bullishDisplacement.payload.displacementMultiple >= 1.6);
assert.equal(bullishDisplacement.payload.closesThroughStructure, true);
assert.equal(bullishDisplacement.payload.leavesFvg, true);
assert.ok(bullishDisplacement.derivation.inputFactIds.length >= 1);
assert.equal(bullishDisplacement.observedMarketTime, "2026-07-13T04:35:00.000Z");
assert.equal(bullishGap.payload.state, "inverted");
assert.equal(bullishGap.payload.inversionTime, "2026-07-13T04:55:00.000Z");
assert.equal(bullishGap.payload.inversionBarsAfterConfirmation, 4);
assert.equal(bullishGap.payload.preInversionUsage, "used");
assert.deepEqual(
  bullishGap.payload.lifecycleTransitions.map((transition) => transition.state),
  ["fresh", "touched", "partially_filled", "filled", "inverted"]
);
assert.deepEqual(
  bullishGap.payload.lifecycleTransitions.map((transition) => transition.barsAfterConfirmation),
  [0, 1, 2, 3, 4]
);
assert.deepEqual(bullishGap.derivation.inputFactIds, [bullishDisplacement.factId]);
assert.equal(bearishGap.payload.state, "fresh");
assert.equal(gaps.some((fact) => fact.payload.gapType === "ifvg"), false);
assert.equal(gaps.some((fact) => fact.payload.state === "invalidated"), false);

const rebuilt = await buildAt("2026-07-13T20:00:00.000Z", fullFamilies);
assert.equal(rebuilt.contextArtifactId, context.contextArtifactId);
assert.deepEqual(rebuilt.facts.map((fact) => fact.factId), context.facts.map((fact) => fact.factId));

const fvgOnly = await buildAt("2026-07-13T20:00:00.000Z", ["fair_value_gap"]);
assert.equal(fvgOnly.facts.some((fact) => fact.kind === "displacement"), false);
assert.ok(fvgOnly.facts.filter((fact) => fact.kind === "fair_value_gap").every((fact) => fact.derivation.inputFactIds.length === 0));

const missingM5Window = await contextModule.buildV2CanonicalMarketContext({
  source,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: "2026-07-13T20:00:00.000Z",
  requiredTimeframes: ["15m"],
  windows: [],
  purpose: "deterministic_fixture",
  requestedFactFamilies: ["displacement", "fair_value_gap"]
});
assert.equal(missingM5Window.diagnostics.status, "blocked");
assert.equal(missingM5Window.facts.length, 0);

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
    else if (/\.(?:ts|tsx)$/.test(entry.name) && /buildV2DisplacementFvgFacts|V2_CONTEXT_FAIR_VALUE_GAP_FACT_POLICY_VERSION/.test(fs.readFileSync(fullPath, "utf8"))) {
      productionAdoptions.push(fullPath);
    }
  }
};
scan(path.join(workspace, "src"));
assert.deepEqual(productionAdoptions, []);

console.log(JSON.stringify({
  status: "passed",
  displacementFacts: displacements.length,
  fairValueGapFacts: gaps.length,
  lifecycleStatesVerified: lifecycleExpectations.map(([, state]) => state),
  structuralDisplacementLinked: bullishDisplacement.derivation.inputFactIds.length > 0,
  displacementLinkedFvg: bullishGap.derivation.inputFactIds.length > 0,
  separateIfvgCandidateCreated: false,
  rawCandleArraysSerialized: false,
  productionAdoptions: productionAdoptions.length,
  shadowOnly: context.shadowOnly,
  authority
}, null, 2));
