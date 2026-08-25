#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "ict-strategy-suite");
const mt5Root = path.join(projectRoot, "src", "lib", "integrations", "mt5");
const outRoot = path.join(projectRoot, ".gotrader", "ict-current-read-flow-test");
const sourceFiles = [
  { root: sourceRoot, file: "ictStrategySuiteTypes.ts" },
  { root: sourceRoot, file: "ictAdvisorTypes.ts" },
  { root: sourceRoot, file: "ictSessionNarrativeTypes.ts" },
  { root: sourceRoot, file: "ictGrinchModelTypes.ts" },
  { root: sourceRoot, file: "ictPhase2Types.ts" },
  { root: sourceRoot, file: "ictStrategySuiteJournal.ts" },
  { root: sourceRoot, file: "ictBrowserResearchLimits.ts" },
  { root: sourceRoot, file: "ictAdvisorJournal.ts" },
  { root: sourceRoot, file: "ictStrategySuiteHelpers.ts" },
  { root: sourceRoot, file: "ictSessionNarrative.ts" },
  { root: sourceRoot, file: "ictStrategySuiteEngines.ts" },
  { root: sourceRoot, file: "ictPhase2OrderBlocks.ts" },
  { root: sourceRoot, file: "ictPhase2BreadAndButter.ts" },
  { root: sourceRoot, file: "ictPhase2OneShotOneKill.ts" },
  { root: sourceRoot, file: "ictMarketAnalysisContextTypes.ts" },
  { root: sourceRoot, file: "ictMarketAnalysisContext.ts" },
  { root: sourceRoot, file: "ictOpportunityDetectionTypes.ts" },
  { root: sourceRoot, file: "ictOpportunityDetection.ts" },
  { root: sourceRoot, file: "ictUniversalRecognitionTypes.ts" },
  { root: sourceRoot, file: "ictUniversalRecognition.ts" },
  { root: sourceRoot, file: "ictSelfImprovementTypes.ts" },
  { root: sourceRoot, file: "ictSelfImprovement.ts" },
  { root: sourceRoot, file: "ictHypothesisValidationTypes.ts" },
  { root: sourceRoot, file: "ictHypothesisValidation.ts" },
  { root: sourceRoot, file: "ictAdvisorEngine.ts" },
  { root: sourceRoot, file: "ictCurrentReadTypes.ts" },
  { root: sourceRoot, file: "ictCurrentRead.ts" },
  { root: sourceRoot, file: "ictReplayValidationTypes.ts" },
  { root: sourceRoot, file: "ictReplayDiagnosticsTypes.ts" },
  { root: sourceRoot, file: "ictApprovedSetupProfileTypes.ts" },
  { root: sourceRoot, file: "ictApprovedProfileOptimizerTypes.ts" },
  { root: sourceRoot, file: "ictIndexSmtTypes.ts" },
  { root: sourceRoot, file: "ictNewsSessionRiskTypes.ts" },
  { root: sourceRoot, file: "ictNewsSessionRisk.ts" },
  { root: sourceRoot, file: "ictSessionRaidReversalTypes.ts" },
  { root: sourceRoot, file: "ictSessionRaidReversal.ts" },
  { root: sourceRoot, file: "ictTradeConstructionTypes.ts" },
  { root: sourceRoot, file: "ictTradeConstruction.ts" },
  { root: sourceRoot, file: "ictIfvgTypes.ts" },
  { root: sourceRoot, file: "ictIfvgProducerPolicy.ts" },
  { root: sourceRoot, file: "ictIfvg.ts" },
  { root: sourceRoot, file: "ictIfvgFreshRetestV3.ts" },
  { root: sourceRoot, file: "ictReplayValidation.ts" },
  { root: sourceRoot, file: "ictReplayDiagnostics.ts" },
  { root: sourceRoot, file: "ictApprovedSetupProfile.ts" },
  { root: sourceRoot, file: "ictApprovedProfileOptimizer.ts" },
  { root: sourceRoot, file: "ictIndexSmt.ts" },
  { root: sourceRoot, file: "ictRealReplayRunnerTypes.ts" },
  { root: sourceRoot, file: "ictManualReplayReviewTypes.ts" },
  { root: sourceRoot, file: "ictMarketScorecardTypes.ts" },
  { root: sourceRoot, file: "ictMonteCarloTypes.ts" },
  { root: sourceRoot, file: "ictLatestResearchStateTypes.ts" },
  { root: sourceRoot, file: "ictLatestResearchState.ts" },
  { root: sourceRoot, file: "ictSignalContractTypes.ts" },
  { root: sourceRoot, file: "ictSignalContract.ts" },
  { root: sourceRoot, file: "ictPaperSignalSimulatorTypes.ts" },
  { root: sourceRoot, file: "ictPaperSignalSimulator.ts" },
  { root: sourceRoot, file: "ictCmdPaperTrackingTypes.ts" },
  { root: sourceRoot, file: "ictCmdPaperTracking.ts" },
  { root: sourceRoot, file: "ictResearchReportTypes.ts" },
  { root: sourceRoot, file: "ictRealReplayRunner.ts" },
  { root: sourceRoot, file: "ictManualReplayReview.ts" },
  { root: sourceRoot, file: "ictMarketScorecard.ts" },
  { root: sourceRoot, file: "ictMonteCarlo.ts" },
  { root: sourceRoot, file: "ictResearchReport.ts" },
  { root: mt5Root, file: "mt5ReadOnlyTypes.ts" },
  { root: mt5Root, file: "mt5SymbolSettings.ts" },
  { root: mt5Root, file: "mt5ReadOnlyNormalizer.ts" },
  { root: mt5Root, file: "mt5ReadOnlyDepth.ts" },
  { root: mt5Root, file: "mt5ReadOnlyClient.ts" },
  { root: sourceRoot, file: "index.ts" }
];

function compileSuiteForNode() {
  fs.mkdirSync(outRoot, { recursive: true });
  for (const { file, root } of sourceFiles) {
    const sourcePath = path.join(root, file);
    const source = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText;
    const rewritten = transpiled
      .replace(/from\s+"\.\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'\.\/([^']+)'/g, "from './$1.mjs'")
      .replace(/from\s+"..\/integrations\/mt5\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'..\/integrations\/mt5\/([^']+)'/g, "from './$1.mjs'")
      .replace(/from\s+"@\/lib\/integrations\/mt5\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'@\/lib\/integrations\/mt5\/([^']+)'/g, "from './$1.mjs'")
      .replace(/from\s+"..\/candleSources"/g, 'from "./candleSourcesStub.mjs"')
      .replace(/from\s+'..\/candleSources'/g, "from './candleSourcesStub.mjs'")
      .replace(/from\s+"..\/currentOpportunity"/g, 'from "./currentOpportunityStub.mjs"')
      .replace(/from\s+'..\/currentOpportunity'/g, "from './currentOpportunityStub.mjs'")
      .replace(/from\s+"..\/ictI2"/g, 'from "./ictI2Stub.mjs"')
      .replace(/from\s+'..\/ictI2'/g, "from './ictI2Stub.mjs'")
      .replace(/from\s+"..\/forwardScenario"/g, 'from "./forwardScenarioStub.mjs"')
      .replace(/from\s+'..\/forwardScenario'/g, "from './forwardScenarioStub.mjs'")
      .replace(/from\s+"@\/lib\/tradeGeometry"/g, 'from "./tradeGeometryStub.mjs"')
      .replace(/from\s+'@\/lib\/tradeGeometry'/g, "from './tradeGeometryStub.mjs'");
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), rewritten, "utf8");
  }
  fs.writeFileSync(
    path.join(outRoot, "candleSourcesStub.mjs"),
    `export async function loadCanonicalCandleSource(sourceId) {
  return globalThis.__ICT_CURRENT_READ_TEST_SOURCES?.get(sourceId);
}
export async function listCanonicalCandleSourceSummaries() {
  return Array.from(globalThis.__ICT_CURRENT_READ_TEST_SOURCES?.values() ?? []).map(({ candles, ...summary }) => summary);
}
`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(outRoot, "currentOpportunityStub.mjs"),
    `export const buildCurrentOpportunityContext = (input) => input;
export const detectCurrentOpportunities = () => globalThis.__ICT_CURRENT_READ_OPPORTUNITY_SCAN ?? ({
  generatedAt: new Date().toISOString(),
  opportunities: [],
  canonicalCandidates: [],
  summary: { total: 0, tradeCandidates: 0, formingCandidates: 0, diagnosticContexts: 0, rejectedCandidates: 0, noTrade: 0 }
});
`,
    "utf8"
  );
  fs.writeFileSync(path.join(outRoot, "forwardScenarioStub.mjs"), "export const buildForwardScenarioMapFromCurrentRead = () => undefined;\n", "utf8");
  fs.writeFileSync(path.join(outRoot, "ictI2Stub.mjs"), "export const buildIctCoreRuntimeCandidates = () => undefined;\n", "utf8");
  fs.writeFileSync(path.join(outRoot, "ictDetectorCanonicalGeometry.mjs"), "export const adaptIfvgNativeGeometry = () => undefined;\n", "utf8");
  fs.writeFileSync(path.join(outRoot, "tradeGeometryStub.mjs"), "export const projectCanonicalTradeGeometry = () => undefined;\n", "utf8");
  fs.writeFileSync(
    path.join(outRoot, "index.mjs"),
    `export * from "./ictAdvisorEngine.mjs";
export * from "./ictCurrentRead.mjs";
export * from "./ictSignalContract.mjs";
`,
    "utf8"
  );
}

const candle = (id, timestamp, open, high, low, close, symbol = "MNQ", timeframe = "5m") => ({
  id,
  symbol,
  timeframe,
  timestamp,
  open,
  high,
  low,
  close,
  volume: 1000
});

const candles = [
  candle("d1_0", "2026-06-01T19:00:00.000Z", 110, 113, 108, 112),
  candle("d1_1", "2026-06-01T20:00:00.000Z", 112, 120, 111, 118),
  candle("d1_2", "2026-06-01T21:00:00.000Z", 118, 119, 105, 108),
  candle("d1_3", "2026-06-01T22:00:00.000Z", 108, 116, 100, 112),
  candle("d2_0", "2026-06-02T08:00:00.000Z", 103, 105, 101, 102),
  candle("d2_1", "2026-06-02T08:05:00.000Z", 102, 103, 99, 101),
  candle("d2_2", "2026-06-02T08:10:00.000Z", 101, 103, 100.5, 102),
  candle("d2_3", "2026-06-02T08:15:00.000Z", 104, 111, 104, 110),
  candle("d2_4", "2026-06-02T08:20:00.000Z", 108, 112, 106, 107)
];

const sourceFor = (sourceId, timeframe, values, fingerprint) => ({
  sourceId,
  provider: "mt5_read_only",
  symbol: "MNQ",
  normalizedSymbol: "MNQ",
  timeframe,
  candles: values,
  candleCount: values.length,
  firstTimestamp: values[0]?.timestamp,
  lastTimestamp: values.at(-1)?.timestamp,
  storageBackend: "memory",
  dataQuality: values.length ? "sufficient" : "insufficient",
  eligibility: { chartDisplay: values.length > 0, quickAnalysis: values.length > 0, researchCycle: values.length > 0, walkForward: false },
  eligibilityReasons: [],
  warnings: ["MT5 read-only USTECH is CFD/proxy data, not CME MNQ futures truth."],
  provenance: {
    sourceLabel: `MT5 read-only USTECH ${timeframe} test source`,
    providerSymbol: "USTECH",
    generatedAt: new Date().toISOString()
  },
  authority: {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  },
  fingerprint,
  roles: ["research", "chart_display", "available"]
});

function runtimeSnapshot(activeSource, higherTimeframeSources) {
  return {
    marketData: {
      symbol: "MNQ",
      contract: "MNQ",
      timeframe: "5m",
      activeResearchSource: activeSource
    },
    mt5ReadOnly: {
      brokerSymbol: "USTECH",
      higherTimeframeSources
    }
  };
}

async function main() {
  compileSuiteForNode();
  const suite = await import(pathToFileURL(path.join(outRoot, "index.mjs")));
  const primary = sourceFor("mt5:MNQ:USTECH:5m", "5m", candles, "current_read_primary_fp");
  const htf15 = sourceFor(
    "mt5:MNQ:USTECH:15m",
    "15m",
    [
      candle("h15_0", "2026-06-02T08:00:00.000Z", 100, 106, 99, 104, "MNQ", "15m"),
      candle("h15_1", "2026-06-02T08:15:00.000Z", 104, 112, 102, 110, "MNQ", "15m")
    ],
    "current_read_15m_fp"
  );
  const htf1h = sourceFor(
    "mt5:MNQ:USTECH:1h",
    "1h",
    [
      candle("h1_0", "2026-06-02T07:00:00.000Z", 99, 106, 98, 104, "MNQ", "1h"),
      candle("h1_1", "2026-06-02T08:00:00.000Z", 104, 113, 103, 111, "MNQ", "1h")
    ],
    "current_read_1h_fp"
  );
  globalThis.__ICT_CURRENT_READ_TEST_SOURCES = new Map([
    [primary.sourceId, primary],
    [htf15.sourceId, htf15],
    [htf1h.sourceId, htf1h]
  ]);

  const htfRuntime = [
    { provider: "mt5_read_only", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "15m", candleCount: htf15.candleCount, fingerprint: htf15.fingerprint, eligibilityState: "eligible_for_analysis" },
    { provider: "mt5_read_only", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "1h", candleCount: htf1h.candleCount, fingerprint: htf1h.fingerprint, eligibilityState: "eligible_for_analysis" }
  ];
  const packet = await suite.buildIctAdvisorPacketFromRuntime(runtimeSnapshot(primary, htfRuntime));
  const read = suite.buildIctCurrentReadFromPacket(packet);

  assert.equal(read.researchOnly, true, "current read must be research-only");
  assert.equal(read.packetSource, "live_mt5", "current read should identify live MT5 source");
  assert.equal(read.dataStatus, "ready", "primary and HTF candles should produce ready data status");
  assert.equal(read.requestedSymbol, "MNQ");
  assert.equal(read.brokerSymbol, "USTECH");
  assert.equal(read.primaryTimeframe, "5m");
  assert.equal(read.displayTimeframe, "5m", "selected timeframe should be labeled as display/reference context");
  assert.equal(read.displayTimeframeRole, "chart_display_reference_only");
  assert.deepEqual(read.analysisTimeframesUsed.sort(), ["M5", "M15", "H1"].sort(), "lightweight read should expose registered/active analysis timeframes");
  assert.ok(read.missingTimeframes.includes("W1"), "lightweight read should explain missing weekly context until Activate Market runs");
  assert.ok(read.topReasons.some((reason) => /Multi-timeframe|Missing analysis timeframes|Analysis depth/i.test(reason)), "current read should surface incomplete multi-timeframe context");
  assert.deepEqual(read.htfTimeframes.sort(), ["15m", "1h"].sort(), "HTF timeframes should be preserved");
  assert.ok(read.htfAlignment, "Current read should expose compact HTF alignment diagnostics");
  assert.ok(["aligned", "partially_aligned", "mixed", "conflicted", "missing", "not_required_for_model"].includes(read.htfAlignment.alignmentStatus), "HTF alignment status should be classified");
  assert.ok(read.debug.phase1SignalCount >= 4, "Phase 1 signals should be counted");
  assert.ok(read.debug.phase2SignalCount >= 4, "Phase 2 signals should be counted");
  assert.ok(read.bestPhase1Setup, "Phase 1 setup should be exposed");
  assert.ok(read.bestPhase2Setup, "Phase 2 setup should be exposed when present");
  assert.ok(read.bestSetup, "Best displayed setup should be exposed");
  assert.ok(["approved_research_candidate", "paper_watchlist_candidate", "watchlist_candidate", "rejected_candidate", "no_trade"].includes(read.approvedStatus), "Approved profile status should be included");
  assert.ok(["approved", "paper_watchlist", "watchlist", "rejected", "no_trade"].includes(read.modelQualityLane), "Model quality lane should be included");
  assert.equal(typeof read.paperWatchlistEligible, "boolean", "Paper-watchlist eligibility should be explicit");
  assert.equal(read.executionAllowed, false, "Current read must keep execution disabled");
  assert.ok(read.smtStatus, "SMT status should be included");
  assert.equal(read.readinessSummary.reasons.some((reason) => /SMT|relative.strength/i.test(reason)), false, "missing SMT must not downgrade readiness");
  assert.doesNotMatch(read.nextAction, /SMT|relative.strength|correlated index/i, "missing SMT must not become the next required action");
  assert.ok(read.riskStatus, "news/session risk status should be included");
  assert.ok(read.topReasons.length >= 1, "Rejected/no-trade/current states should explain why");
  assert.ok(read.nextAction, "Current read should provide an operator next action");
  assert.equal(read.authority.executionAuthority, "none");
  assert.equal(read.authority.brokerAuthority, "none");
  assert.equal(read.authority.readinessOverrideAuthority, "none");
  assert.equal(suite.assertIctCurrentReadIsCompact(read).ok, true, "current read must remain compact and safe");
  assert.doesNotMatch(JSON.stringify(read), /"candles"\s*:|"snapshot"\s*:|"accountNumber"\s*:|"orderId"\s*:|"positionId"\s*:|"secret"\s*:/i);

  const conflictOpportunity = (strategyId, candidateId, side) => ({
    id: candidateId, candidateId, strategyId, setupName: strategyId, side, status: "valid_candidate",
    classification: "trade_candidate", canonicalCandidate: true, actionable: true, blockers: [], missingConditions: []
  });
  const ifvgConflictOpportunity = conflictOpportunity("ifvg_fresh_retest_v3_research", "ifvg-conflict-candidate", "long");
  const ictConflictOpportunity = conflictOpportunity("ict_2022_model_v1", "ict-2022-conflict-candidate", "short");
  globalThis.__ICT_CURRENT_READ_OPPORTUNITY_SCAN = {
    generatedAt: packet.generatedAt,
    opportunities: [ifvgConflictOpportunity, ictConflictOpportunity],
    canonicalCandidates: [
      { opportunityId: ifvgConflictOpportunity.id, candidateId: ifvgConflictOpportunity.candidateId, strategyId: ifvgConflictOpportunity.strategyId, direction: "long", actionability: true, opportunity: ifvgConflictOpportunity },
      { opportunityId: ictConflictOpportunity.id, candidateId: ictConflictOpportunity.candidateId, strategyId: ictConflictOpportunity.strategyId, direction: "short", actionability: true, opportunity: ictConflictOpportunity }
    ],
    summary: {
      canonicalSetupConflict: "CONFLICTING_CANONICAL_SETUPS",
      canonicalCandidateSetDisposition: "CONFLICTING_CANONICAL_SETUPS",
      canonicalCandidateCount: 2,
      actionableCanonicalCandidateCount: 2,
      nextAction: "Conflicting canonical setups are preserved; no automatic trade selector is authorized."
    }
  };
  const conflictRead = suite.buildIctCurrentReadFromPacket(packet);
  assert.equal(conflictRead.canonicalSetupConflict, "CONFLICTING_CANONICAL_SETUPS");
  assert.equal(conflictRead.activeCandidateId, undefined);
  assert.equal(conflictRead.activeStrategyId, undefined);
  assert.equal(conflictRead.canonicalGeometry, undefined);
  assert.equal(conflictRead.side, "flat");
  assert.equal(conflictRead.canonicalCandidates.length, 2);
  assert.match(conflictRead.topReasons.join(" "), /strategies disagree/i);
  globalThis.__ICT_CURRENT_READ_OPPORTUNITY_SCAN = undefined;

  const deepContext = {
    ...packet.marketAnalysisContext,
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
    analysisDepthStatus: "sufficient",
    multiTimeframeContextStatus: "built",
    analysisTimeframesUsed: ["W1", "D1", "H4", "H1", "M15", "M5"],
    missingTimeframes: [],
    htfBiasSource: ["W1", "D1", "H4", "H1"],
    weeklyBiasStatus: "loaded",
    weeklyBiasDirection: "bullish",
    weeklyBiasReason: "MT5-derived weekly bias.",
    generatedAt: new Date().toISOString()
  };
  const deepState = {
    updatedAt: deepContext.generatedAt,
    researchOnly: true,
    latestMarketAnalysis: {
      generatedAt: deepContext.generatedAt,
      sourceProvider: packet.activeSource.provider,
      sourceFingerprint: packet.activeSource.sourceFingerprint,
      requestedSymbol: packet.requestedSymbol,
      brokerSymbol: packet.brokerSymbol,
      context: deepContext,
      researchOnly: true
    },
    authority: read.authority,
    safety: {
      rawCandlesExcluded: true,
      rawSnapshotsExcluded: true,
      accountDataExcluded: true,
      orderDataExcluded: true,
      positionDataExcluded: true,
      secretsExcluded: true
    }
  };
  const deepRead = suite.buildIctCurrentReadFromPacket(packet, deepState);
  assert.equal(deepRead.analysisDepthStatus, "sufficient", "matching cycle context should hydrate sufficient depth");
  assert.deepEqual(deepRead.missingTimeframes, [], "matching cycle context should restore W1/D1/H4 coverage");
  assert.equal(deepRead.weeklyBiasStatus, "loaded", "matching cycle context should restore weekly bias");
  assert.equal(deepRead.weeklyBiasDirection, "bullish");
  const mismatchedDeepRead = suite.buildIctCurrentReadFromPacket(packet, {
    ...deepState,
    latestMarketAnalysis: { ...deepState.latestMarketAnalysis, brokerSymbol: "US30" }
  });
  assert.ok(mismatchedDeepRead.missingTimeframes.includes("W1"), "mismatched source lineage must not hydrate deep context");

  const missingSource = sourceFor("mt5:MNQ:USTECH:5m:missing", "5m", [], "missing_current_read_fp");
  globalThis.__ICT_CURRENT_READ_TEST_SOURCES = new Map([[missingSource.sourceId, missingSource]]);
  const missingPacket = await suite.buildIctAdvisorPacketFromRuntime(runtimeSnapshot(missingSource, []));
  const missingRead = suite.buildIctCurrentReadFromPacket(missingPacket);
  assert.equal(missingRead.dataStatus, "missing", "missing MT5 candles should be visible as missing data");
  assert.equal(missingRead.approvedStatus, "no_trade", "missing candles should not produce an approved candidate");
  assert.equal(missingRead.modelQualityLane, "no_trade", "missing candles should remain no-trade lane");
  assert.equal(missingRead.paperWatchlistEligible, false, "missing candles should not be paper-watchlist eligible");
  assert.ok(missingRead.topReasons.some((reason) => /missing candle|canonical research source/i.test(reason)), "missing source should explain the blocker");
  assert.equal(suite.assertIctCurrentReadIsCompact(missingRead).ok, true, "missing read must remain compact and safe");

  const unavailableRead = suite.buildUnavailableIctCurrentRead("MT5 data unavailable.");
  assert.equal(unavailableRead.packetSource, "unavailable");
  assert.equal(unavailableRead.dataStatus, "unavailable");
  assert.equal(unavailableRead.modelQualityLane, "no_trade");
  assert.equal(unavailableRead.paperWatchlistEligible, false);
  assert.equal(unavailableRead.authority.executionAuthority, "none");

  const paperWatchlistRead = {
    ...read,
    approvedStatus: "paper_watchlist_candidate",
    modelQualityLane: "paper_watchlist",
    paperWatchlistEligible: true,
    paperWatchlistModelName: "consolidation_manipulation_distribution",
    paperWatchlistReason: "CMD paper-watchlist - paper-test only.",
    paperWatchlistEvidenceSummary: "CMD paper-watchlist evidence; compact only; authority none.",
    side: "short",
    target: 99,
    invalidation: 113,
    rrEstimate: 2.1,
    confidence: 0.69,
    riskStatus: "allow",
    smtStatus: "confirms_candidate",
    dataStatus: "ready",
    topReasons: ["CMD paper-watchlist - paper-test only."]
  };
  const paperWatchlistSignal = suite.buildIctResearchSignalFromCurrentRead(paperWatchlistRead);
  assert.equal(paperWatchlistSignal.status, "rejected_signal");
  assert.equal(paperWatchlistSignal.modelQualityLane, "paper_watchlist");
  assert.equal(paperWatchlistSignal.paperWatchlistEligible, false);
  assert.equal(paperWatchlistSignal.entryReference, undefined);
  assert.equal(paperWatchlistSignal.target, undefined);
  assert.equal(paperWatchlistSignal.invalidation, undefined);
  assert.match(paperWatchlistSignal.reasons.join(" "), /CMD paper-watchlist|paper-test/i);

  process.stdout.write("GoTrader ICT current-read flow test passed.\n");
  process.stdout.write(`Source: ${read.packetSource} / ${read.brokerSymbol}->${read.requestedSymbol} / ${read.debug.candleCount} candles\n`);
  process.stdout.write(`Phase counts: ${read.debug.phase1SignalCount}/${read.debug.phase2SignalCount}\n`);
  process.stdout.write(`Approved status: ${read.approvedStatus}\n`);
  process.stdout.write(`Next action: ${read.nextAction}\n`);
  process.stdout.write(`Authority: ${read.authority.executionAuthority}/${read.authority.brokerAuthority}/${read.authority.readinessOverrideAuthority}\n`);
}

main().catch((error) => {
  process.stderr.write(`ICT current-read flow test failed: ${error?.message ?? error}\n`);
  process.exitCode = 1;
});
