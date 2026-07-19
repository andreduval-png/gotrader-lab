#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "ict-strategy-suite");
const outRoot = path.join(projectRoot, ".gotrader", "autonomous-evidence-pipeline-test");
const files = [
  "ictMarketAnalysisContextTypes.ts",
  "ictMonteCarloTypes.ts",
  "ictMonteCarlo.ts",
  "ictLatestResearchStateTypes.ts",
  "ictLatestResearchState.ts",
  "ictAutomatedCycleEvidence.ts"
];

function compile() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });
  for (const file of files) {
    const sourcePath = path.join(sourceRoot, file);
    const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText.replace(/from\s+"\.\/([^\"]+)"/g, 'from "./$1.mjs"');
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), output, "utf8");
  }
}

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const safety = {
  rawCandlesExcluded: true,
  rawSnapshotsExcluded: true,
  accountDataExcluded: true,
  orderDataExcluded: true,
  positionDataExcluded: true,
  secretsExcluded: true
};

function backtestFixture() {
  const trades = Array.from({ length: 36 }, (_, index) => ({
    id: `trade_${index}`,
    symbol: "MNQ",
    bias: index % 2 ? "bearish" : "bullish",
    confidence: 0.78,
    openedAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    outcome: index % 4 === 0 ? "stop_hit" : "target_hit",
    rMultiple: index % 4 === 0 ? -1 : 2.4,
    riskReward: 2.4
  }));
  return {
    config: { strategyProfile: "ifvg_fresh_retest_v3_research", timeframe: "5m" },
    trades,
    summary: { totalTrades: trades.length }
  };
}

const provenance = {
  strategyProfile: "ifvg_fresh_retest_v3_research",
  strategyProfileVersion: "v3",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "mt5_validation_window",
  parameterFingerprint: "params_ifvg_v3",
  validationRunId: "validation_1",
  walkForwardRunId: "wf_1"
};

const marketContext = {
  researchOnly: true,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  displayTimeframe: "5m",
  displayTimeframeRole: "chart_display_reference_only",
  analysisTimeframes: ["W1", "D1", "H4", "H1", "M15", "M5"].map((timeframe) => ({
    timeframe,
    requestedLookbackDays: 90,
    availableLookbackDays: 89,
    candleCount: 100,
    dataDepthStatus: "sufficient",
    sourceMethod: "mt5_chunked_history",
    role: timeframe === "W1" ? "weekly_bias" : timeframe === "D1" ? "daily_bias" : timeframe === "M15" ? "session_model" : timeframe === "M5" ? "confirmation_refinement" : "htf_bias"
  })),
  analysisTimeframesRequested: ["W1", "D1", "H4", "H1", "M15", "M5"],
  analysisTimeframesLoaded: ["W1", "D1", "H4", "H1", "M15", "M5"],
  requiredTimeframesLoaded: true,
  chartDisplayCandleCount: 1000,
  analysisDepthStatus: "sufficient",
  multiTimeframeContextStatus: "built",
  analysisTimeframesUsed: ["W1", "D1", "H4", "H1", "M15", "M5"],
  missingTimeframes: [],
  htfBiasSource: ["W1", "D1", "H4", "H1"],
  sessionModelSourceTimeframe: "M15",
  confirmationSourceTimeframe: "M5",
  weeklyBiasStatus: "loaded",
  weeklyBiasDirection: "bullish",
  weeklyBiasReason: "MT5-derived weekly bias.",
  warnings: [],
  generatedAt: "2026-07-19T12:00:00.000Z",
  authority,
  safety
};

const walkForwardRun = {
  runId: "wf_1",
  startedAt: "2026-07-19T12:00:00.000Z",
  completedAt: "2026-07-19T12:01:00.000Z",
  status: "completed",
  actualWindowsGenerated: 3,
  windows: Array.from({ length: 3 }, (_, index) => ({
    metricsBySplit: { out_of_sample: { totalTrades: 10 + index } }
  })),
  stability: {
    verdict: "robust_research",
    outOfSampleWindowsPassed: 3,
    summary: "Three independent OOS windows passed.",
    failReasons: []
  },
  warnings: [],
  provenance
};

async function main() {
  compile();
  const evidence = await import(pathToFileURL(path.join(outRoot, "ictAutomatedCycleEvidence.mjs")));
  const latest = await import(pathToFileURL(path.join(outRoot, "ictLatestResearchState.mjs")));
  latest.clearLatestResearchState();
  const result = evidence.buildAndSaveAutomatedCycleEvidence({
    backtestResult: backtestFixture(),
    cycleId: "cycle_1",
    generatedAt: "2026-07-19T12:02:00.000Z",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    sourceProvider: "mt5_read_only",
    activeSourceFingerprint: "mt5_active_window",
    provenance,
    walkForwardRun,
    marketAnalysisContext: marketContext
  });

  assert.equal(result.outcomeCount, 36);
  assert.equal(result.replay.totalSignals, 36);
  assert.equal(result.monteCarlo.usableOutcomes, 36);
  assert.notEqual(result.monteCarlo.robustnessRating, "insufficient_data");
  assert.equal(result.walkForward.verdict, "passed");
  assert.equal(result.walkForward.tradeCount, 33);
  assert.deepEqual(result.marketAnalysis.context.missingTimeframes, []);
  assert.equal(result.marketAnalysis.context.analysisDepthStatus, "sufficient");
  assert.equal(result.state.latestReplay.provenance.strategyProfile, "ifvg_fresh_retest_v3_research");
  assert.equal(result.state.latestReplay.activeSourceFingerprint, "mt5_active_window");
  assert.equal(result.authority.executionAuthority, "none");
  assert.equal(result.authority.brokerAuthority, "none");
  assert.equal(result.authority.readinessOverrideAuthority, "none");
  assert.equal(latest.assertIctLatestResearchStateIsCompact(result.state).ok, true);
  const serialized = JSON.stringify(result.state);
  assert.doesNotMatch(serialized, /"candles"\s*:/i);
  assert.doesNotMatch(
    serialized,
    /"(?:account|accountNumber|accountId|positions?|positionId|orders?|orderId|password|secret|api[_-]?key)"\s*:/i,
  );

  console.log(JSON.stringify({
    status: "passed",
    replayOutcomes: result.outcomeCount,
    monteCarlo: result.monteCarlo.robustnessRating,
    walkForward: result.walkForward.verdict,
    timeframes: result.marketAnalysis.context.analysisTimeframesLoaded,
    authority: result.authority
  }, null, 2));
}

main().catch((error) => {
  console.error("Autonomous evidence pipeline test failed:", error);
  process.exitCode = 1;
});
