#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "market-prediction-ledger-test");

const compile = (sourceRelative, outputName, replacements = []) => {
  const sourcePath = path.join(root, sourceRelative);
  const outputPath = path.join(outRoot, outputName);
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, replacements.reduce((value, [from, to]) => value.replaceAll(from, to), output), "utf8");
};

const candle = (index, values = {}) => {
  const timestamp = new Date(Date.parse("2026-06-15T13:30:00.000Z") + index * 5 * 60_000).toISOString();
  const center = 100 + (index % 4) * 0.04;
  return {
    id: `fixture-${index}`,
    symbol: "MNQ",
    timeframe: "5m",
    timestamp,
    open: center,
    high: center + 0.2,
    low: center - 0.2,
    close: center + (index % 2 ? -0.05 : 0.05),
    volume: 100 + index,
    ...values
  };
};

const buildEpisodeCandles = () => {
  const candles = Array.from({ length: 56 }, (_, index) => candle(index));
  candles[16] = candle(16, { open: 99.95, high: 100.2, low: 98.8, close: 99.92 });
  candles[17] = candle(17, { open: 99.92, high: 102.2, low: 99.82, close: 102.05 });
  candles[18] = candle(18, { open: 102.05, high: 103.1, low: 101.8, close: 102.95 });
  for (let index = 19; index < candles.length; index += 1) {
    const base = 103 + (index - 19) * 0.28;
    candles[index] = candle(index, {
      open: base,
      high: base + 0.45,
      low: base - 0.18,
      close: base + 0.3
    });
  }
  return candles;
};

const scenarioMap = {
  scenarioMapId: "scenario-map-causal-fixture",
  timestamp: "2026-05-01T14:00:00.000Z",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "mt5-fixture-fingerprint",
  currentSession: "new_york_am",
  marketPhase: "retracement",
  currentDecisionState: "confirmed_setup",
  primaryScenario: {
    scenarioId: "scenario-ifvg-fixture",
    scenarioFamily: "ifvg_fresh_retest_continuation",
    direction: "bullish",
    setupType: "intraday_expansion",
    probabilityBand: "moderate",
    confidence: 0.65,
    thesis: "A fresh bullish IFVG retest may continue toward external liquidity.",
    liquidityDraw: "External buy-side liquidity",
    expectedSequence: ["Retest entry zone", "Hold invalidation", "Expand to external liquidity"],
    requiredConfirmations: ["Closed-candle retest confirmation"],
    invalidationConditions: ["Close through the protected low"],
    conditionalEntryPlan: {
      status: "conditional",
      label: "Conditional entry zone if confirmation appears",
      zone: { lower: 100, upper: 101 },
      trigger: "Closed candle trades into the zone.",
      researchOnly: true
    },
    conditionalStopPlan: {
      status: "conditional",
      label: "Conditional stop reference",
      referencePrice: 98,
      condition: "Research invalidation only.",
      researchOnly: true
    },
    conditionalTargetPlan: {
      status: "conditional",
      label: "Conditional target references",
      references: [{ label: "External liquidity", price: 106 }],
      condition: "Research outcome target only.",
      researchOnly: true
    },
    whyNotConfirmedYet: [],
    whatWouldUpgradeThis: [],
    whatWouldDowngradeThis: [],
    safetyNotice: "Research-only confirmed setup. Paper-demo/live execution still blocked unless readiness gates pass."
  },
  invalidationScenario: {
    scenarioId: "scenario-invalid-fixture",
    scenarioFamily: "no_trade_waiting_for_liquidity",
    direction: "neutral",
    setupType: "no_trade",
    probabilityBand: "low",
    confidence: 0.2,
    thesis: "No-trade fallback.",
    liquidityDraw: "None",
    expectedSequence: [],
    requiredConfirmations: [],
    invalidationConditions: [],
    conditionalEntryPlan: { status: "unavailable", label: "Conditional entry zone if confirmation appears", trigger: "None", researchOnly: true },
    conditionalStopPlan: { status: "unavailable", label: "Conditional stop reference", condition: "None", researchOnly: true },
    conditionalTargetPlan: { status: "unavailable", label: "Conditional target references", references: [], condition: "None", researchOnly: true },
    whyNotConfirmedYet: [],
    whatWouldUpgradeThis: [],
    whatWouldDowngradeThis: [],
    safetyNotice: "Research-only scenario forecast. Not a confirmed setup. No execution authority."
  },
  missingConfirmations: [],
  nextEvidenceToWatch: [],
  authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
  safety: {
    researchOnly: true,
    rawCandlesExcluded: true,
    rawSnapshotsExcluded: true,
    autoApplyAllowed: false,
    autoPromotionAllowed: false
  }
};

const closedCandle = (timestamp, values = {}) => ({
  timestamp,
  open: 101,
  high: 102,
  low: 100.5,
  close: 101.5,
  volume: 10,
  brokerSymbol: "USTECH",
  requestedSymbol: "MNQ",
  timeframe: "5m",
  source: "mt5",
  sourceFingerprint: "mt5-fixture-fingerprint",
  serverTimestamp: timestamp,
  receivedAt: timestamp,
  ...values
});

const completedForecasts = (template, family, wins, losses, winR) => {
  const total = wins + losses;
  return Array.from({ length: total }, (_, index) => {
    const issuedAt = new Date(Date.parse("2026-01-02T14:00:00.000Z") + index * 4 * 24 * 60 * 60_000).toISOString();
    const targetFirst = index < wins;
    return {
      ...template,
      predictionId: `${family}-${index}`,
      scenarioFamily: family,
      issuedAt,
      asOfTimestamp: issuedAt,
      independentDate: issuedAt.slice(0, 10),
      probabilitySource: "historical_episode_rate",
      probabilityEstimate: wins / total,
      calibrationSampleSize: total,
      lifecycleState: "resolved",
      resolution: targetFirst ? "target_first" : "invalidation_first",
      realizedR: targetFirst ? winR : -1,
      resolvedAt: new Date(Date.parse(issuedAt) + 60_000).toISOString()
    };
  });
};

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/marketEpisodes/marketEpisodeTypes.ts", "marketEpisodeTypes.mjs");
  compile(
    "src/lib/marketEpisodes/reconstructMarketEpisodes.ts",
    "reconstructMarketEpisodes.mjs",
    [["./marketEpisodeTypes", "./marketEpisodeTypes.mjs"]]
  );
  compile("src/lib/marketEpisodes/marketEpisodeVariantTypes.ts", "marketEpisodeVariantTypes.mjs");
  compile(
    "src/lib/marketEpisodes/discoverMarketEpisodeVariants.ts",
    "discoverMarketEpisodeVariants.mjs",
    [
      ["./marketEpisodeTypes", "./marketEpisodeTypes.mjs"],
      ["./marketEpisodeVariantTypes", "./marketEpisodeVariantTypes.mjs"]
    ]
  );
  compile("src/lib/predictionLedger/predictionLedgerTypes.ts", "predictionLedgerTypes.mjs");
  compile(
    "src/lib/predictionLedger/predictionLedger.ts",
    "predictionLedger.mjs",
    [["./predictionLedgerTypes", "./predictionLedgerTypes.mjs"]]
  );

  const episodesModule = await import(pathToFileURL(path.join(outRoot, "reconstructMarketEpisodes.mjs")).href);
  const variantsModule = await import(pathToFileURL(path.join(outRoot, "discoverMarketEpisodeVariants.mjs")).href);
  const ledgerModule = await import(pathToFileURL(path.join(outRoot, "predictionLedger.mjs")).href);

  const episodes = episodesModule.reconstructMarketEpisodes({
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "episode-fixture-fingerprint",
    candles: buildEpisodeCandles(),
    minimumEpisodeCandles: 24,
    maxResolutionBars: 32
  });
  const episodeSummary = episodesModule.summarizeMarketEpisodes(episodes);
  assert.ok(episodes.length > 0);
  assert.ok(episodeSummary.eventCounts.liquidity_sweep > 0);
  assert.ok(episodeSummary.eventCounts.displacement > 0);
  assert.ok(episodeSummary.opportunityCount > 0);
  assert.equal(episodes[0].authority.executionAuthority, "none");
  const fixtureDiscovery = variantsModule.discoverMarketEpisodeVariants(episodes);
  assert.equal(fixtureDiscovery.promisingVariantCount, 0);
  assert.equal(fixtureDiscovery.safety.autoPromotionAllowed, false);

  const originalSignalCutoff = buildEpisodeCandles()[20].timestamp;
  const originalEvents = episodes[0].events
    .filter((event) => Date.parse(event.timestamp) <= Date.parse(originalSignalCutoff))
    .map(({ type, timestamp, direction, quality }) => ({ type, timestamp, direction, quality }));
  const volatileFuture = Array.from({ length: 24 }, (_, index) => candle(56 + index, {
    open: 120 + index * 10,
    high: 135 + index * 10,
    low: 105 + index * 10,
    close: 132 + index * 10
  }));
  const extendedEpisodes = episodesModule.reconstructMarketEpisodes({
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "episode-future-volatility-fixture",
    candles: [...buildEpisodeCandles(), ...volatileFuture],
    minimumEpisodeCandles: 24,
    maxResolutionBars: 32
  });
  const extendedOriginalEvents = extendedEpisodes[0].events
    .filter((event) => Date.parse(event.timestamp) <= Date.parse(originalSignalCutoff))
    .map(({ type, timestamp, direction, quality }) => ({ type, timestamp, direction, quality }));
  assert.deepEqual(
    extendedOriginalEvents,
    originalEvents,
    "future volatility must not change historical event recognition thresholds"
  );

  const issued = ledgerModule.issuePredictionFromScenarioMap(scenarioMap, { maxBarsToResolve: 12 });
  assert.equal(issued.probabilitySource, "heuristic_uncalibrated");
  assert.equal(issued.resolution, "pending");
  assert.equal(issued.safety.executionIntentCreated, false);
  const contextOnlyScenario = {
    ...scenarioMap,
    scenarioMapId: "scenario-map-context-fixture",
    currentDecisionState: "anticipated_scenario",
    primaryScenario: {
      ...scenarioMap.primaryScenario,
      scenarioId: "scenario-context-fixture",
      scenarioFamily: "consolidation_raid_displacement",
      conditionalEntryPlan: {
        status: "unavailable",
        label: "Conditional entry zone if confirmation appears",
        trigger: "Wait for a causal trigger.",
        researchOnly: true
      },
      conditionalStopPlan: {
        status: "unavailable",
        label: "Conditional stop reference",
        condition: "Wait for causal invalidation.",
        researchOnly: true
      },
      conditionalTargetPlan: {
        status: "unavailable",
        label: "Conditional target references",
        references: [{ label: "Opposing external liquidity" }],
        condition: "Wait for a priced target.",
        researchOnly: true
      }
    }
  };
  const contextWatch = ledgerModule.issuePredictionFromScenarioMap(contextOnlyScenario, { maxBarsToResolve: 12 });
  assert.equal(contextWatch.lifecycleState, "anticipated");
  assert.equal(contextWatch.resolution, "not_actionable");
  assert.equal(contextWatch.safety.executionIntentCreated, false);
  assert.equal(ledgerModule.evaluatePredictionCalibration([contextWatch]).actionableForecasts, 0);
  const frozenProfileIssued = ledgerModule.issuePredictionFromScenarioMap(scenarioMap, {
    modelVersion: "profile-version-fixture",
    maxBarsToResolve: 12
  });
  assert.notEqual(frozenProfileIssued.predictionId, issued.predictionId, "profile observations need a distinct ledger identity");
  assert.equal(frozenProfileIssued.modelVersion, "profile-version-fixture");

  const hindsightCandle = closedCandle("2026-05-01T13:55:00.000Z", { high: 107 });
  assert.deepEqual(ledgerModule.updatePredictionWithClosedCandle(issued, hindsightCandle), issued);

  const triggered = ledgerModule.updatePredictionWithClosedCandle(
    issued,
    closedCandle("2026-05-01T14:05:00.000Z")
  );
  assert.equal(triggered.lifecycleState, "triggered");
  assert.equal(triggered.resolution, "pending");

  const resolved = ledgerModule.updatePredictionWithClosedCandle(
    triggered,
    closedCandle("2026-05-01T14:10:00.000Z", { high: 106.2, low: 101 })
  );
  assert.equal(resolved.lifecycleState, "resolved");
  assert.equal(resolved.resolution, "target_first");
  assert.ok(resolved.realizedR > 0);

  const calibratedPositive = ledgerModule.evaluatePredictionCalibration(
    completedForecasts(issued, "positive-family", 16, 8, 2)
  );
  assert.equal(calibratedPositive.classification, "calibrated_positive");
  assert.ok(calibratedPositive.averageRealizedR > 0);
  assert.ok(calibratedPositive.independentDates >= 3);
  assert.ok(calibratedPositive.activeWindows >= 2);

  const highHitRateNegativeExpectancy = ledgerModule.evaluatePredictionCalibration(
    completedForecasts(issued, "negative-family", 12, 8, 0.2)
  );
  assert.equal(highHitRateNegativeExpectancy.targetFirstRate, 0.6);
  assert.equal(highHitRateNegativeExpectancy.classification, "calibrated_negative");
  assert.ok(highHitRateNegativeExpectancy.averageRealizedR < 0);

  const heuristicSummary = ledgerModule.evaluatePredictionCalibration([resolved]);
  assert.equal(heuristicSummary.classification, "uncalibrated");
  assert.equal(heuristicSummary.autoPromotionAllowed, false);

  const serialized = JSON.stringify({ episodes, issued, resolved, calibratedPositive });
  assert.doesNotMatch(serialized, /"(?:candles|rawCandles|rawSnapshot|account|orders|positions|apiKey|token|secret)"\s*:/i);
  assert.doesNotMatch(serialized, /"executionIntentCreated"\s*:\s*true/i);
  assert.equal(resolved.authority.executionAuthority, "none");
  assert.equal(resolved.authority.brokerAuthority, "none");
  assert.equal(resolved.authority.readinessOverrideAuthority, "none");

  const appSource = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  const cycleSource = fs.readFileSync(path.join(root, "src/lib/researchCycle/runResearchCycle.ts"), "utf8");
  const operatorCycleSource = fs.readFileSync(path.join(root, "src/lib/operatorConsole/operatorCycle.ts"), "utf8");
  assert.match(appSource, /subscribePredictionLedgerToMt5PushFeed/);
  assert.match(cycleSource, /recordForwardScenarioPrediction/);
  assert.match(cycleSource, /sourceFingerprint:\s*activeResearchCandleSource\.identity\.dataFingerprint/);
  assert.match(operatorCycleSource, /recordForwardScenarioPrediction\(preparedScenario\.scenarioMap/);
  assert.match(operatorCycleSource, /operator_market_scenario:v1/);

  console.log(JSON.stringify({
    status: "passed",
    reconstructedEpisodes: episodes.length,
    reconstructedOpportunities: episodeSummary.opportunityCount,
    fixtureVariantStatus: fixtureDiscovery.variants[0]?.classification ?? "none",
    causalForecastResolution: resolved.resolution,
    positiveCalibration: calibratedPositive.classification,
    negativeExpectancyGuard: highHitRateNegativeExpectancy.classification,
    heuristicForecastStatus: heuristicSummary.classification,
    futureDataLeakageGuard: "passed",
    authority: resolved.authority,
    rawCandlesSerialized: false,
    executionIntentCreated: false
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
