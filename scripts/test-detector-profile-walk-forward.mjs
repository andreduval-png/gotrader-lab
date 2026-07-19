#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "detector-profile-walk-forward-test");

const compile = (sourceRelative, outputRelative, replacements = []) => {
  const sourcePath = path.join(root, sourceRelative);
  const outputPath = path.join(outRoot, outputRelative);
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
  fs.writeFileSync(
    outputPath,
    replacements.reduce((value, [from, to]) => value.replaceAll(from, to), output),
    "utf8"
  );
};

const timestamp = (start, day, hour = 15) =>
  new Date(Date.parse(start) + day * 86_400_000 + hour * 3_600_000).toISOString();

const buildTrades = ({ start, fromDay, days, tradesPerDay = 1, winning = true }) => {
  const trades = [];
  for (let day = fromDay; day < fromDay + days; day += 1) {
    for (let index = 0; index < tradesPerDay; index += 1) {
      const win = winning ? (day + index) % 2 === 0 : (day + index) % 4 === 0;
      trades.push({
        openedAt: timestamp(start, day, 14 + index),
        rMultiple: win ? 3 : -1,
        outcome: win ? "target_hit" : "stop_hit"
      });
    }
  }
  return trades;
};

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/statistics/edgeStatistics.ts", "statistics/edgeStatistics.mjs");
  compile("src/lib/forwardEvidence/forwardEvidenceTypes.ts", "forwardEvidence/forwardEvidenceTypes.mjs");
  compile(
    "src/lib/forwardEvidence/frozenProfileRegistry.ts",
    "forwardEvidence/frozenProfileRegistry.mjs",
    [["./forwardEvidenceTypes", "./forwardEvidenceTypes.mjs"]]
  );
  compile(
    "src/lib/validationProvenance/validationProvenance.ts",
    "validationProvenance/validationProvenance.mjs"
  );
  compile(
    "src/lib/walkForward/detectorProfileWalkForward.ts",
    "walkForward/detectorProfileWalkForward.mjs",
    [
      ["@/lib/statistics/edgeStatistics", "../statistics/edgeStatistics.mjs"],
      ["@/lib/forwardEvidence", "../forwardEvidence/frozenProfileRegistry.mjs"],
      ["@/lib/validationProvenance", "../validationProvenance/validationProvenance.mjs"]
    ]
  );
  compile(
    "src/lib/walkForward/detectorProfileWalkForwardAdapter.ts",
    "walkForward/detectorProfileWalkForwardAdapter.mjs",
    [["@/lib/statistics/edgeStatistics", "../statistics/edgeStatistics.mjs"]]
  );
  compile(
    "src/lib/researchQuality/falsePositiveAnalysis.ts",
    "researchQuality/falsePositiveAnalysis.mjs"
  );
  fs.mkdirSync(path.join(outRoot, "marketData"), { recursive: true });
  fs.writeFileSync(
    path.join(outRoot, "marketData", "historicalCandleImport.mjs"),
    "export const loadActiveCandleSource = async () => ({ mode: 'mock', label: 'test', candles: [] });\n",
    "utf8"
  );
  compile(
    "src/lib/marketData/candleWindowing.ts",
    "marketData/candleWindowing.mjs",
    [["@/lib/marketData/historicalCandleImport", "./historicalCandleImport.mjs"]]
  );
  const { runDetectorProfileWalkForward } = await import(
    pathToFileURL(path.join(outRoot, "walkForward", "detectorProfileWalkForward.mjs")).href
  );
  const { adaptDetectorProfileWalkForwardRun } = await import(
    pathToFileURL(path.join(outRoot, "walkForward", "detectorProfileWalkForwardAdapter.mjs")).href
  );
  const { analyzeFalsePositivePatterns } = await import(
    pathToFileURL(path.join(outRoot, "researchQuality", "falsePositiveAnalysis.mjs")).href
  );
  const { prepareCandlesForResearch } = await import(
    pathToFileURL(path.join(outRoot, "marketData", "candleWindowing.mjs")).href
  );

  const deepFixture = Array.from({ length: 12050 }, (_, index) => ({
    id: `deep_${index}`,
    symbol: "MNQ",
    timeframe: "5m",
    timestamp: new Date(Date.parse("2026-01-01T00:00:00.000Z") + index * 300000).toISOString(),
    open: 20000 + index,
    high: 20001 + index,
    low: 19999 + index,
    close: 20000.5 + index,
    volume: 100
  }));
  const ordinaryPrepared = prepareCandlesForResearch(
    deepFixture,
    { windowSize: 50000, targetTimeframe: "5m", sessionFilter: "all", advancedMode: true },
    true
  );
  const explicitDeepPrepared = prepareCandlesForResearch(
    deepFixture,
    { windowSize: 50000, targetTimeframe: "5m", sessionFilter: "all", advancedMode: true },
    true,
    { maximumWindowSize: 50000 }
  );
  assert.equal(ordinaryPrepared.processedCandleCount, 10000, "Ordinary browser research keeps the existing hard cap.");
  assert.equal(explicitDeepPrepared.processedCandleCount, deepFixture.length, "Explicit detector validation keeps the complete compact history.");

  const sourceStart = "2026-01-01T00:00:00.000Z";
  const sourceEnd = "2026-06-30T00:00:00.000Z";
  const developmentTrades = buildTrades({ start: sourceStart, fromDay: 0, days: 120 });
  const oosTrades = buildTrades({ start: sourceStart, fromDay: 120, days: 60 });
  const safeResult = runDetectorProfileWalkForward({
    profileId: "ifvg_fresh_retest_v3_research",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5_test_fp",
    sourceStart,
    sourceEnd,
    trades: [...developmentTrades, ...oosTrades]
  });
  assert.equal(safeResult.verdict, "passed");
  assert.equal(safeResult.oosWindowCount, 2);
  assert.equal(safeResult.oosWindowsPassed, 2);
  assert.equal(safeResult.totalOosTrades, 60);
  assert.equal(safeResult.pooledOos.edgeVerdict, "positive_edge");
  assert.ok(safeResult.additionalCost05R.averageR > 0);
  assert.equal(safeResult.authority.executionAuthority, "none");
  assert.equal(safeResult.authority.brokerAuthority, "none");
  assert.equal(safeResult.authority.readinessOverrideAuthority, "none");
  assert.equal(safeResult.safety.readinessPromotionAllowed, false);
  const adapted = adaptDetectorProfileWalkForwardRun({
    result: safeResult,
    config: {
      strategyProfile: "ifvg_fresh_retest_v3_research",
      symbol: "MNQ",
      timeframe: "5m",
      sessionFilter: "all",
      marketRegime: "trend",
      minimumConfluenceThreshold: 0.35,
      minimumConfidenceThreshold: 0.42,
      targetRMultiple: 2,
      stopModel: "latest swing",
      fixedTickStopSize: 48,
      maxBarsToResolveTrade: 48,
      allowLong: true,
      allowShort: true,
      agentWeights: {},
      warmupCandles: 100,
      decisionInterval: 1,
      lookaheadCandles: 48,
      visibleWindow: 80,
      spreadTicks: 1,
      slippageTicks: 1,
      commissionTicks: 1
    },
    oosTrades,
    sourceLabel: "MT5 read-only explicit detector history",
    rawCandleCount: 35000,
    processedCandleCount: 35000,
    availableLookbackDays: 180,
    requestedLookbackDays: 180
  });
  assert.equal(adapted.stability.verdict, "robust_research");
  assert.equal(adapted.stability.edgeStatistics.provenance, "out_of_sample");
  assert.equal(adapted.stability.edgeStatistics.sampleSize, 60);
  assert.equal(adapted.provenance.validationRunId, safeResult.provenance.validationRunId);
  assert.equal(adapted.provenance.sourceFingerprint, safeResult.sourceFingerprint);
  assert.equal(adapted.preflight.authority.executionAuthority, "none");
  assert.doesNotMatch(JSON.stringify(adapted), /"(?:candles|rawCandles|accountData|orders|positions)"\s*:/i);

  const scenario = (overrides = {}) => ({
    id: "conservative-confluence",
    name: "Conservative confluence threshold",
    category: "threshold",
    totalTrades: 30,
    winRate: 0.6,
    averageR: 1.2,
    maxDrawdown: 2,
    worstTradeR: -1,
    confidenceCalibration: { calibrationGap: 0.1, averageConfidence: 0.7 },
    ...overrides
  });
  const ordinaryLosses = analyzeFalsePositivePatterns({ scenarios: [scenario(), scenario({ id: "swing-stop", name: "Swing stop" })] });
  assert.equal(ordinaryLosses.length, 0, "An ordinary stopped trade is not a false-positive pattern family.");
  const repeatedCalibration = analyzeFalsePositivePatterns({
    scenarios: [
      scenario({ confidenceCalibration: { calibrationGap: 0.3, averageConfidence: 0.9 } }),
      scenario({ id: "high-confidence-only", name: "High confidence", confidenceCalibration: { calibrationGap: 0.25, averageConfidence: 0.85 } })
    ]
  });
  assert.equal(repeatedCalibration.length, 1, "Repeated scenario manifestations should collapse to one root pattern.");
  const serialized = JSON.stringify(safeResult);
  for (const forbiddenKey of ["candles", "rawCandles", "accountData", "orders", "positions"]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(safeResult, forbiddenKey),
      false,
      `Walk-forward output must not expose ${forbiddenKey}.`
    );
  }
  assert.doesNotMatch(
    serialized,
    /"(?:candles|rawCandles|accountData|orders|positions)"\s*:/i
  );

  const concentrated = runDetectorProfileWalkForward({
    profileId: "one_date_cluster",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5_test_fp",
    sourceStart,
    sourceEnd,
    trades: [
      ...developmentTrades,
      ...Array.from({ length: 50 }, (_, index) => ({
        openedAt: timestamp(sourceStart, 150, 10 + (index % 10)),
        rMultiple: 3,
        outcome: "target_hit"
      }))
    ]
  });
  assert.equal(concentrated.verdict, "failed");
  assert.match(concentrated.blockers.join(" "), /unique OOS dates|Largest OOS date/i);

  const weak = runDetectorProfileWalkForward({
    profileId: "negative_oos",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5_test_fp",
    sourceStart,
    sourceEnd,
    trades: [
      ...developmentTrades,
      ...buildTrades({ start: sourceStart, fromDay: 120, days: 60, winning: false })
    ]
  });
  assert.equal(weak.verdict, "failed");
  assert.match(weak.blockers.join(" "), /edge verdict|cost stress|windows passed/i);

  const mock = runDetectorProfileWalkForward({
    profileId: "mock_profile",
    sourceProvider: "mock",
    sourceFingerprint: "mock_fp",
    sourceStart,
    sourceEnd,
    trades: [...developmentTrades, ...oosTrades]
  });
  assert.equal(mock.verdict, "blocked_source");

  const forwardOnly = runDetectorProfileWalkForward({
    profileId: "ifvg_fresh_retest_v3_research",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5_post_cutoff_fp",
    sourceStart: "2026-07-14T09:40:00.000Z",
    sourceEnd: "2026-07-17T23:55:00.000Z",
    trades: []
  });
  assert.equal(forwardOnly.verdict, "forward_evidence_required");
  assert.match(forwardOnly.blockers.join(" "), /begins after the frozen validation cutoff/i);
  assert.match(forwardOnly.nextAction, /forward evidence ledger/i);
  assert.doesNotMatch(forwardOnly.blockers.join(" "), /source fingerprint are required/i);
  assert.equal(forwardOnly.authority.executionAuthority, "none");
  assert.equal(forwardOnly.safety.readinessPromotionAllowed, false);

  console.log(
    JSON.stringify(
      {
        ok: true,
        diagnostic: "detector_profile_walk_forward",
        safeProfile: {
          verdict: safeResult.verdict,
          windows: `${safeResult.oosWindowsPassed}/${safeResult.oosWindowCount}`,
          oosTrades: safeResult.totalOosTrades,
          uniqueDates: safeResult.uniqueOosTradingDates,
          averageR: safeResult.pooledOos.averageR,
          stressedAverageR: safeResult.additionalCost05R.averageR,
          edgeVerdict: safeResult.pooledOos.edgeVerdict
        },
        adaptedRun: {
          verdict: adapted.stability.verdict,
          oosTrades: adapted.stability.edgeStatistics.sampleSize,
          provenanceMatched: adapted.provenance.validationRunId === safeResult.provenance.validationRunId
        },
        deepHistoryPreparation: {
          ordinaryBrowserCandles: ordinaryPrepared.processedCandleCount,
          explicitDetectorCandles: explicitDeepPrepared.processedCandleCount
        },
        falsePositiveFamilies: repeatedCalibration.length,
        forwardOnly: {
          verdict: forwardOnly.verdict,
          nextAction: forwardOnly.nextAction
        },
        safety: safeResult.safety,
        authority: safeResult.authority
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
