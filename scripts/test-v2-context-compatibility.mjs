#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-context-compatibility-test");
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
  "src/lib/v2/context/v2ContextBuilder.ts",
  "src/lib/v2/context/v2ContextCompatibilityTypes.ts",
  "src/lib/v2/context/v2ContextCompatibility.ts",
  "src/lib/ict-strategy-suite/ictStrategySuiteHelpers.ts",
  "src/lib/ict-strategy-suite/ictSessionNarrative.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const identityModule = await load("v2Identity");
const repositoryModule = await load("v2StaticCandleRepository");
const contextModule = await load("v2ContextBuilder");
const compatibilityModule = await load("v2ContextCompatibility");
const legacyHelpers = await load("ictStrategySuiteHelpers");
const legacyNarrative = await load("ictSessionNarrative");

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const source = identityModule.createV2SourceIdentity({
  sourceId: "fixture:USTECH:phase2a-compatibility",
  provider: "imported_historical",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "phase2a-compatibility-fixture",
  sourceKind: "imported_historical"
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
const makeM5Candles = () => {
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
const timeframeMilliseconds = {
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000
};
const makeHigherTimeframeCandles = (timeframe, closes) => Object.freeze(
  closes.map((close, index) => {
    const open = index ? closes[index - 1] : close - 0.05;
    const timestamp = Date.parse("2026-07-13T20:00:00.000Z") -
      timeframeMilliseconds[timeframe] * (closes.length - index);
    return Object.freeze({
      timestamp: new Date(timestamp).toISOString(),
      open,
      high: Math.max(open, close) + 0.2,
      low: Math.min(open, close) - 0.2,
      close,
      volume: 100 + index,
      closed: true
    });
  })
);
const snapshots = new Map([
  ["5m", makeM5Candles()],
  ["15m", makeHigherTimeframeCandles("15m", [100.2, 100.4, 100.6, 100.8, 102])],
  ["1h", makeHigherTimeframeCandles("1h", [110, 109.8, 109.5, 109.2, 107])],
  ["4h", makeHigherTimeframeCandles("4h", [100, 100.02, 99.99, 100.03, 100.04])],
  ["1d", makeHigherTimeframeCandles("1d", [100.2, 101.4, 102, 101.8, 101.5])],
  ["1w", makeHigherTimeframeCandles("1w", [98, 98.5, 99, 99.5, 101])]
]);
const windowFor = async (timeframe) => {
  const repository = repositoryModule.createV2StaticCandleRepository({
    adapterId: `phase2a-compatibility-${timeframe}`,
    asOf: () => "2026-07-13T20:00:00.000Z",
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
    limit: 500,
    closedOnly: true,
    purpose: "context_shadow"
  });
};

const requiredTimeframes = ["5m", "15m", "1h", "4h", "1d", "1w"];
const windows = await Promise.all(requiredTimeframes.map(windowFor));
const context = await contextModule.buildV2CanonicalMarketContext({
  source,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: "2026-07-13T20:00:00.000Z",
  requiredTimeframes,
  windows,
  purpose: "deterministic_fixture",
  requestedFactFamilies: [
    "session",
    "opening_price",
    "dealing_range",
    "liquidity",
    "displacement",
    "fair_value_gap",
    "higher_timeframe_bias"
  ],
  builtAt: "2026-07-13T20:00:01.000Z"
});
assert.notEqual(context.diagnostics.status, "blocked", JSON.stringify(context.diagnostics));

const summaries = new Map(
  compatibilityModule.summarizeV2ContextFacts(context).map((summary) => [summary.family, summary])
);
for (const family of [
  "session",
  "opening_price",
  "dealing_range",
  "liquidity",
  "displacement",
  "fair_value_gap",
  "higher_timeframe_bias"
]) {
  assert.ok(summaries.get(family).factCount > 0, `${family} needs fixture facts`);
}
const legacyM5Candles = snapshots.get("5m").map((candle, index) => Object.freeze({
  id: `legacy-fixture-${index}`,
  symbol: "MNQ",
  timeframe: "5m",
  timestamp: candle.timestamp,
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
  volume: candle.volume
}));
const legacySessionRanges = legacyNarrative.calculateIctSessionRanges(
  legacyM5Candles,
  "America/New_York"
).filter((range) => range.session !== "off_hours" && range.candleCount > 0);
const legacyPools = legacyHelpers.detectLiquidityPools(legacyM5Candles);
const legacyDisplacement = legacyHelpers.detectDisplacement(legacyM5Candles);
const legacyFvg = legacyHelpers.detectFairValueGap(legacyM5Candles);
const legacyRange = legacyHelpers.calculateDealingRange(legacyM5Candles, "m5");
assert.ok(legacyDisplacement);
assert.ok(legacyFvg);
assert.ok(legacyRange);

const exactObservation = (family, normalizedMetrics) => Object.freeze({
  family,
  status: "available",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: source.sourceFingerprint,
  timeframes: summaries.get(family).timeframes,
  metrics: Object.freeze(normalizedMetrics),
  summary: `Normalized legacy ${family} fixture observation.`,
  knownDifferences: Object.freeze([]),
  authority
});
const varianceObservation = ({ family, normalizedMetrics, policyId, difference }) => Object.freeze({
  family,
  status: "available",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: source.sourceFingerprint,
  timeframes: summaries.get(family).timeframes,
  metrics: Object.freeze(normalizedMetrics),
  summary: `Normalized legacy ${family} fixture observation.`,
  knownDifferences: Object.freeze([difference]),
  reviewedVariancePolicyId: policyId,
  authority
});
const policies = compatibilityModule.V2_CONTEXT_REVIEWED_VARIANCE_POLICIES;
const sessionTypes = Object.freeze(legacySessionRanges.map((range) => range.session).sort());
const openingPrice = (timestamp) => legacyM5Candles.find((candle) => candle.timestamp === timestamp)?.open;
const openingTypes = Object.freeze(["new_york_0930", "new_york_midnight", "sunday"].sort());
const openingPriceSignature = Object.freeze([
  `new_york_0930:${openingPrice("2026-07-13T13:30:00.000Z")}`,
  `new_york_midnight:${openingPrice("2026-07-13T04:00:00.000Z")}`,
  `sunday:${openingPrice("2026-07-12T22:00:00.000Z")}`
].sort());
const legacyPoolSides = Object.freeze([...new Set(legacyPools.flatMap((pool) => {
  if (/(?:high|equal_highs|opening_gap)$/.test(pool.type)) return ["buy_side"];
  if (/(?:low|equal_lows)$/.test(pool.type)) return ["sell_side"];
  return [];
}))].sort());
assert.deepEqual(legacyPoolSides, ["buy_side", "sell_side"]);
const legacyBias = (candles) => {
  const first = candles[0];
  const last = candles.at(-1);
  const change = (last.close - first.open) / Math.max(Math.abs(first.open), 0.01);
  return change > 0.001 ? "bullish" : change < -0.001 ? "bearish" : "neutral";
};
const legacyBiasDirections = Object.freeze(
  ["15m", "1h", "4h", "1d", "1w"].map((timeframe) =>
    `${timeframe}:${legacyBias(snapshots.get(timeframe))}`
  ).sort()
);
const observations = Object.freeze([
  exactObservation("session", [
    { key: "factCount", value: legacySessionRanges.length },
    { key: "timeframes", value: ["5m"] },
    { key: "sessionTypes", value: sessionTypes },
    { key: "completeSessionTypes", value: sessionTypes }
  ]),
  exactObservation("opening_price", [
    { key: "factCount", value: openingTypes.length },
    { key: "timeframes", value: ["5m"] },
    { key: "openingTypes", value: openingTypes },
    { key: "priceSignature", value: openingPriceSignature }
  ]),
  varianceObservation({
    family: "dealing_range",
    normalizedMetrics: [
      { key: "geometrySignature", value: [`legacy:m5:${legacyRange.low}:${legacyRange.high}`] }
    ],
    policyId: policies.dealing_range,
    difference: "legacy_full_window_range_is_not_session_scoped"
  }),
  varianceObservation({
    family: "liquidity",
    normalizedMetrics: [
      { key: "sides", value: legacyPoolSides },
      {
        key: "poolStates",
        value: Object.freeze([legacyPools.some((pool) => pool.swept) ? "swept" : "active"])
      }
    ],
    policyId: policies.liquidity,
    difference: "legacy_selects_swings_while_v2_tracks_session_pool_lifecycle"
  }),
  varianceObservation({
    family: "displacement",
    normalizedMetrics: [
      { key: "latestDirection", value: legacyDisplacement.direction },
      { key: "latestEventTime", value: legacyDisplacement.candleTime }
    ],
    policyId: policies.displacement,
    difference: "legacy_returns_latest_match_while_v2_emits_causal_fact_set"
  }),
  varianceObservation({
    family: "fair_value_gap",
    normalizedMetrics: [
      { key: "latestDirection", value: legacyFvg.direction },
      { key: "latestGeometry", value: `${legacyFvg.low}:${legacyFvg.high}` }
    ],
    policyId: policies.fair_value_gap,
    difference: "legacy_selects_one_pd_array_while_v2_tracks_gap_lifecycle"
  }),
  varianceObservation({
    family: "higher_timeframe_bias",
    normalizedMetrics: [
      { key: "timeframes", value: ["15m", "1d", "1h", "1w", "4h"] },
      { key: "directions", value: legacyBiasDirections }
    ],
    policyId: policies.higher_timeframe_bias,
    difference: "legacy_uses_full_window_while_v2_uses_last_five_explicit_candles"
  })
]);

const report = await compatibilityModule.buildV2ContextCompatibilityReport({
  v2Context: context,
  legacyObservations: observations,
  builtAt: "2026-07-13T20:00:02.000Z"
});
assert.equal(report.status, "ready_for_canary_review");
assert.equal(report.blockers.length, 0);
assert.equal(report.entries.length, 7);
assert.deepEqual(
  report.entries.filter((entry) => entry.outcome === "exact_parity").map((entry) => entry.family),
  ["session", "opening_price"]
);
assert.deepEqual(
  report.entries.filter((entry) => entry.outcome === "documented_variance").map((entry) => entry.family),
  ["dealing_range", "liquidity", "displacement", "fair_value_gap", "higher_timeframe_bias"]
);
assert.ok(report.entries.every((entry) => !entry.blocksPhase3));

const rebuilt = await compatibilityModule.buildV2ContextCompatibilityReport({
  v2Context: context,
  legacyObservations: observations,
  builtAt: "2026-07-13T20:10:00.000Z"
});
assert.equal(rebuilt.reportId, report.reportId);

const displacementObservation = observations.find((item) => item.family === "displacement");
const currentDirection = displacementObservation.metrics[0].value;
const directionMismatch = {
  ...displacementObservation,
  metrics: Object.freeze([{
    key: "latestDirection",
    value: currentDirection === "bullish" ? "bearish" : "bullish"
  }])
};
const directionReport = await compatibilityModule.buildV2ContextCompatibilityReport({
  v2Context: context,
  legacyObservations: observations.map((item) =>
    item.family === "displacement" ? directionMismatch : item
  )
});
assert.equal(directionReport.status, "blocked");
assert.equal(
  directionReport.entries.find((entry) => entry.family === "displacement").outcome,
  "regression"
);

const sourceMismatch = await compatibilityModule.buildV2ContextCompatibilityReport({
  v2Context: context,
  legacyObservations: observations.map((item) =>
    item.family === "session" ? { ...item, sourceFingerprint: "different-source" } : item
  )
});
assert.equal(sourceMismatch.status, "blocked");
assert.ok(sourceMismatch.entries.find((entry) => entry.family === "session")
  .differences.includes("source_fingerprint_mismatch"));

const missingFamily = await compatibilityModule.buildV2ContextCompatibilityReport({
  v2Context: context,
  legacyObservations: observations.filter((item) => item.family !== "fair_value_gap")
});
assert.equal(missingFamily.status, "blocked");
assert.equal(
  missingFamily.entries.find((entry) => entry.family === "fair_value_gap").outcome,
  "insufficient_comparison_data"
);

const wrongPolicy = await compatibilityModule.buildV2ContextCompatibilityReport({
  v2Context: context,
  legacyObservations: observations.map((item) =>
    item.family === "liquidity"
      ? { ...item, reviewedVariancePolicyId: "unreviewed-policy" }
      : item
  )
});
assert.equal(wrongPolicy.status, "blocked");
assert.equal(
  wrongPolicy.entries.find((entry) => entry.family === "liquidity").outcome,
  "regression"
);

const missingRequiredMetric = await compatibilityModule.buildV2ContextCompatibilityReport({
  v2Context: context,
  legacyObservations: observations.map((item) =>
    item.family === "dealing_range" ? { ...item, metrics: Object.freeze([]) } : item
  )
});
assert.equal(missingRequiredMetric.status, "blocked");
assert.equal(
  missingRequiredMetric.entries.find((entry) => entry.family === "dealing_range").outcome,
  "insufficient_comparison_data"
);

const serialized = JSON.stringify(report);
assert.doesNotMatch(serialized, /"candles"\s*:/i);
assert.doesNotMatch(
  serialized,
  /rawServer|rawProvider|accountData|orderData|positionData|password|secret|apiKey|token/i
);
assert.deepEqual(report.authority, authority);
assert.equal(report.legacyAuthoritative, true);
assert.equal(report.v2ShadowOnly, true);
assert.equal(report.rawCandlesSerialized, false);

const productionAdoptions = [];
const scan = (directory) => {
  if (directory === path.join(workspace, "src", "lib", "v2")) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(fullPath);
    else if (
      /\.(?:ts|tsx)$/.test(entry.name) &&
      /buildV2ContextCompatibilityReport|V2_CONTEXT_COMPATIBILITY_POLICY_VERSION/.test(
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
  contextStatus: context.diagnostics.status,
  factCounts: Object.fromEntries([...summaries].map(([family, summary]) => [family, summary.factCount])),
  compatibilityStatus: report.status,
  outcomes: Object.fromEntries(report.entries.map((entry) => [entry.family, entry.outcome])),
  reviewedVariancePolicies: report.warnings.length,
  mismatchBlocksPhase3: directionReport.status === "blocked",
  sourceMismatchBlocksPhase3: sourceMismatch.status === "blocked",
  missingFamilyBlocksPhase3: missingFamily.status === "blocked",
  wrongPolicyBlocksPhase3: wrongPolicy.status === "blocked",
  missingRequiredMetricBlocksPhase3: missingRequiredMetric.status === "blocked",
  rawCandleArraysSerialized: false,
  productionAdoptions: productionAdoptions.length,
  legacyAuthoritative: report.legacyAuthoritative,
  v2ShadowOnly: report.v2ShadowOnly,
  authority
}, null, 2));
