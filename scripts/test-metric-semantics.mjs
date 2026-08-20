#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, ".gotrader", "metric-semantics-test");
fs.mkdirSync(outDir, { recursive: true });

const transpile = (sourceRelative, outputName, replacements = []) => {
  const sourcePath = path.join(root, sourceRelative);
  let output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  for (const [from, to] of replacements) output = output.replaceAll(from, to);
  const outputPath = path.join(outDir, outputName);
  fs.writeFileSync(outputPath, output, "utf8");
  return outputPath;
};

fs.writeFileSync(path.join(outDir, "edgeStatistics.mjs"), "export const computeEdgeStatistics = (values) => ({ sampleSize: values.length });\n", "utf8");
fs.writeFileSync(
  path.join(outDir, "configSearchSpace.mjs"),
  `export const defaultAutoResearchScoringCriteria = ${JSON.stringify({
    stabilityFirst: true,
    weights: {
      lowerMaxDrawdown: 0.22,
      betterAverageR: 0.12,
      acceptableWinRate: 0.1,
      lowerFalsePositives: 0.14,
      confidenceCalibration: 0.14,
      sessionConsistency: 0.08,
      sufficientTradeCount: 0.1,
      skippedSignalBalance: 0.05,
      profitFactor: 0.05,
      robustnessAcrossScenarios: 0.1,
      grinchModelSupport: 0.06
    }
  })};\n`,
  "utf8"
);

const metricsPath = transpile(
  path.join("src", "lib", "statistics", "tradeMetrics.ts"),
  "tradeMetrics.mjs",
  [["@/lib/statistics/edgeStatistics", "./edgeStatistics.mjs"]]
);
const scorePath = transpile(
  path.join("src", "lib", "autoResearch", "scoreCandidateConfig.ts"),
  "scoreCandidateConfig.mjs",
  [["@/lib/autoResearch/configSearchSpace", "./configSearchSpace.mjs"]]
);

const { summarizeTradeOutcomes, falsePositiveCountFromTrades } = await import(`${pathToFileURL(metricsPath).href}?v=${Date.now()}`);
const { scoreCandidateConfig } = await import(`${pathToFileURL(scorePath).href}?v=${Date.now()}`);

const trades = [
  { bias: "long", outcome: "target_hit", rMultiple: 2 },
  { bias: "short", outcome: "stop_hit", rMultiple: -1 },
  { bias: "neutral", outcome: "neutral", rMultiple: 0 }
];
const summary = summarizeTradeOutcomes(trades);
assert.equal(summary.stopHitCount, 1);
assert.equal(summary.estimatedLossCount, 1);
assert.equal(summary.falsePositiveCount, 0, "a stop hit must not create false-positive attribution");
assert.equal(falsePositiveCountFromTrades(trades), 0);

const baseMetrics = {
  totalTrades: 20,
  winRate: 0.5,
  averageR: 0.4,
  maxDrawdown: 2,
  profitFactor: 1.5,
  skippedSignals: 2,
  falsePositiveCount: 0,
  confidenceCalibration: 0.8,
  readinessScore: 70,
  readinessStatus: "green",
  stabilityScore: 70,
  conservativeScenarioStable: true
};
const validation = { scenarios: [{ readiness: "green", score: 75 }] };
const quality = {
  sessionComparison: [{ readiness: "green", totalTrades: 20, averageR: 0.4 }],
  failureAttribution: {
    completedTradeCount: 20,
    attributedStopHitCount: 2,
    contextEvaluationCoverage: 1,
    failureCauses: []
  }
};
const baselineScore = scoreCandidateConfig({ baselineMetrics: baseMetrics, metrics: baseMetrics, validation, quality });
const legacyScore = scoreCandidateConfig({
  baselineMetrics: baseMetrics,
  metrics: { ...baseMetrics, falsePositiveCount: 19 },
  validation,
  quality
});
assert.equal(legacyScore.falsePositiveScore, baselineScore.falsePositiveScore, "legacy raw-stop aliases must not affect avoidable-loss scoring");
assert.equal(legacyScore.avoidableLossScore, baselineScore.avoidableLossScore);

const worseScore = scoreCandidateConfig({
  baselineMetrics: baseMetrics,
  metrics: baseMetrics,
  validation,
  quality: { ...quality, failureAttribution: { ...quality.failureAttribution, attributedStopHitCount: 10 } }
});
assert(worseScore.falsePositiveScore < baselineScore.falsePositiveScore);
assert(worseScore.avoidableLossScore < baselineScore.avoidableLossScore);

console.log(JSON.stringify({
  status: "passed",
  stopHitsAreNotFalsePositives: true,
  legacyAliasCannotDriveScoring: true,
  attributedAvoidableLossesDriveScoring: true
}, null, 2));
