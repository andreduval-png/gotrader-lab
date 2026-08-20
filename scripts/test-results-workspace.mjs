#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const view = read("src/components/performance/PerformanceView.tsx");
const types = read("src/lib/results/resultsWorkspaceTypes.ts");
const builder = read("src/lib/results/buildResultsWorkspaceSnapshot.ts");
const whyNotReady = read("src/components/common/WhyNotReadyCard.tsx");

for (const marker of [
  "results-calendar",
  "results-tab-overview",
  "results-tab-replay",
  "results-tab-walk-forward",
  "results-tab-paper-forward",
  "results-tab-robustness"
]) {
  assert.match(view, new RegExp(marker), `Results view must render ${marker}.`);
}

assert.ok(
  view.indexOf("<ResultsCalendar") < view.indexOf("data-testid=\"results-tabs\""),
  "The full-width results calendar must appear before the workspace tabs."
);
assert.doesNotMatch(view, /allocateMetricsAcrossCalendar|seededNoise/);
assert.doesNotMatch(view, /priceMove\s*\*\s*1\.25/);
assert.match(view, /Aggregate backtest metrics are intentionally not spread across calendar days/);
assert.match(view, /Cumulative dated outcome move/);
assert.match(view, /Latest active validation and frozen profile evidence are reported separately/);
assert.match(view, /Frozen profile chronological evidence/);
assert.match(view, /Latest saved simulation and frozen profile evidence remain distinct/);
assert.match(view, /readableProfile\(resultsSnapshot\.frozenProfile\.profileId\)/);
assert.doesNotMatch(view, /Frozen IFVG v3/);
assert.match(builder, /getFrozenResearchProfile\(activeFrozenProfileId/);

for (const section of [
  "backtest:",
  "replay:",
  "walkForward:",
  "monteCarlo:",
  "paperDemo:",
  "frozenProfile:",
  "predictions:",
  "validation:"
]) {
  assert.match(types, new RegExp(section), `Results snapshot must include ${section}`);
}

assert.match(builder, /aggregateMetricsNotFabricatedIntoDailyResults:\s*true/);
assert.match(builder, /executionIntentCreated:\s*false/);
assert.doesNotMatch(builder, /\?\?\s*ifvgFreshRetestV3FrozenProfile/);
assert.match(builder, /metricIdentityStatus === "matched"/);
assert.match(builder, /replayIdentityStatus === "matched"/);
assert.match(builder, /walkForwardIdentityStatus === "matched"/);
assert.match(builder, /monteCarloIdentityStatus === "matched"/);
assert.match(builder, /matchesSourceIdentity/);
assert.match(view, /other-source excluded/);
assert.match(view, /listSimulatedOutcomeEvents/);
assert.match(view, /verified identity-bound simulated outcomes/);
assert.match(view, /integrity failures excluded/);
assert.doesNotMatch(view, /state\.outcomes\.filter/);
assert.match(view, /Estimated simulated P&L/);
assert.match(view, /Requires at least one losing trade/);
assert.match(whyNotReady, /blockers\.length \? "Blocked" : reportedReadinessState/);
assert.match(types, /executionAuthority:\s*"none"/);
assert.match(types, /brokerAuthority:\s*"none"/);
assert.match(types, /readinessOverrideAuthority:\s*"none"/);

const serializedContracts = `${types}\n${builder}`;
assert.doesNotMatch(serializedContracts, /executionAuthority:\s*"(?:paper|live|enabled)"/i);
assert.doesNotMatch(serializedContracts, /brokerAuthority:\s*"(?:route_only|execute|live)"/i);

const bundleRoot = path.join(root, ".gotrader", "results-workspace-test");
const bundlePath = path.join(bundleRoot, "builder.mjs");
fs.mkdirSync(bundleRoot, { recursive: true });
await build({
  entryPoints: [path.join(root, "src", "lib", "results", "buildResultsWorkspaceSnapshot.ts")],
  outfile: bundlePath,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  alias: { "@": path.join(root, "src") },
  tsconfig: path.join(root, "tsconfig.json"),
  logLevel: "silent"
});

const { buildResultsWorkspaceSnapshot } = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
const identity = {
  strategyProfile: "ifvg_shallow_retest_v4_candidate",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "source-fingerprint",
  parameterFingerprint: "params-fingerprint"
};
const staleIdentity = { ...identity, strategyProfile: "different_profile" };
const metrics = {
  sourceCycleId: "cycle-current",
  dataSource: "MT5 read-only",
  symbol: "MNQ",
  timeframe: "5m",
  candleWindow: "1000 raw / 1000 processed 5m",
  rawCandleCount: 1000,
  processedCandleCount: 1000,
  startingBalance: 50000,
  currentBalance: 51290,
  realizedPnL: 1290,
  realizedPnLPercent: 0.0258,
  riskDollarsPerR: 500,
  totalTrades: 1,
  winningTrades: 1,
  losingTrades: 0,
  winRate: 1,
  averageR: 2.58,
  realizedR: 2.58,
  maxDrawdownR: 0,
  maxDrawdownDollars: 0,
  profitFactor: 99,
  bestTradeR: 2.58,
  worstTradeR: 2.58,
  falsePositiveCount: 250,
  skippedSignals: 32,
  confidenceCalibration: 0.84,
  readinessScore: 78,
  stabilityScore: 0,
  generatedAt: "2026-08-14T10:00:00.000Z",
  metricSourceLabel: "latest research cycle cycle-current",
  pnlAssumption: "Estimated simulation P&L."
};
const runtime = {
  marketData: {
    activeResearchSource: {
      provider: "mt5_read_only",
      timeframe: "5m",
      candleCount: 1000,
      fingerprint: "source-fingerprint",
      dataQuality: "provider_proxy",
      provenance: { providerSymbol: "USTECH" }
    },
    symbol: "MNQ",
    timeframe: "5m",
    processedCandleCount: 1000,
    researchDataFingerprint: "source-fingerprint"
  },
  mt5ReadOnly: { brokerSymbol: "USTECH" },
  performance: { canonicalPerformanceMetrics: metrics },
  researchIdentity: { active: identity },
  latestResearchCycle: { latestCycleId: "cycle-current" },
  activeConfig: { resolvedBacktestConfig: { strategyProfile: identity.strategyProfile } },
  walkForward: {},
  readiness: { readinessState: "Research Ready", actualBlockers: ["Simulation runbook incomplete."], nextAction: "Complete runbook." },
  evidence: { evidenceQualityScore: 56 },
  maturity: { maturityScore: 49 }
};
const baseInput = {
  runtimeSnapshot: runtime,
  canonicalMetrics: metrics,
  activationSummary: {
    researchOnly: true,
    sourceFingerprint: "source-fingerprint",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    primaryTimeframe: "5m",
    analysisDepthStatus: "sufficient",
    requiredTimeframesLoaded: true
  },
  latestResearchState: {
    latestReplay: { researchOnly: true, generatedAt: "2026-08-14T10:00:00.000Z", totalSignals: 10, provenance: staleIdentity },
    latestMonteCarlo: { researchOnly: true, generatedAt: "2026-08-14T10:00:00.000Z", source: "replay", usableOutcomes: 10, robustnessRating: "strong", warnings: [], provenance: staleIdentity }
  },
  walkForward: { runId: "wf-stale", status: "completed", actualWindowsGenerated: 2, provenance: staleIdentity },
  validationChainEntry: { researchOnly: true, provenance: staleIdentity, blockers: [], setupLabel: "stale", hypothesisStatus: "walk_forward_passed" },
  paperDemoState: {
    candidates: [
      { sourceFingerprint: "source-fingerprint", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m", status: "monitoring" },
      { sourceFingerprint: "older-source", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m", status: "monitoring" }
    ],
    dailyChecklists: [],
    journalEntries: []
  },
  predictionLedger: {
    entries: [
      { sourceFingerprint: "older-source", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m" }
    ]
  },
  forwardEvidenceEntries: []
};
const failClosed = buildResultsWorkspaceSnapshot(baseInput);
assert.equal(failClosed.backtest.identityStatus, "matched");
assert.equal(failClosed.backtest.profitFactor, null, "one-sided samples must not display sentinel profit factors");
assert.equal(failClosed.replay.identityStatus, "mismatch");
assert.equal(failClosed.replay.totalSignals, null);
assert.equal(failClosed.walkForward.identityStatus, "mismatch");
assert.equal(failClosed.walkForward.oosTrades, null);
assert.equal(failClosed.monteCarlo.identityStatus, "mismatch");
assert.equal(failClosed.validation.chainIdentityStatus, "mismatch");
assert.equal(failClosed.validation.reportedReadinessState, "Research Ready");
assert.equal(failClosed.validation.readinessState, "blocked");
assert.equal(failClosed.validation.readinessIntegrity, "contradictory");
assert.equal(failClosed.paperDemo.candidateCount, 1);
assert.equal(failClosed.paperDemo.excludedCandidateCount, 1);
assert.equal(failClosed.predictions.totalForecasts, 0);
assert.equal(failClosed.predictions.excludedForecasts, 1);

const unknownProfileRuntime = {
  ...runtime,
  researchIdentity: { active: { ...identity, strategyProfile: "liquidity_reclaim_scalper_v1_base_research" } },
  activeConfig: { resolvedBacktestConfig: { strategyProfile: "liquidity_reclaim_scalper_v1_base_research" } }
};
const unknownProfile = buildResultsWorkspaceSnapshot({ ...baseInput, runtimeSnapshot: unknownProfileRuntime });
assert.equal(unknownProfile.frozenProfile.availability, "unavailable");
assert.equal(unknownProfile.frozenProfile.historicalTrades, null);
assert.equal(unknownProfile.frozenProfile.oosTrades, null);
assert.equal(unknownProfile.frozenProfile.profileId, "liquidity_reclaim_scalper_v1_base_research");

const sourceMismatch = buildResultsWorkspaceSnapshot({
  ...baseInput,
  activationSummary: { ...baseInput.activationSummary, sourceFingerprint: "older-source" }
});
assert.equal(sourceMismatch.source.activationIdentityStatus, "mismatch");
assert.equal(sourceMismatch.source.analysisDepthStatus, "activation_required");

console.log(JSON.stringify({
  status: "passed",
  calendar: "dated_outcomes_only",
  aggregateDailyFabrication: false,
  resultSections: ["backtest", "replay", "walk_forward", "paper_forward", "robustness"],
  authority: {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  }
}, null, 2));
