#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "ict-strategy-suite");
const outRoot = path.join(projectRoot, ".gotrader", "ict-activate-market-pipeline-test");

const sourceFiles = [
  "ictActivateMarketPipelineTypes.ts",
  "ictActivateMarketPipeline.ts"
];

function compileForNode() {
  fs.mkdirSync(outRoot, { recursive: true });
  for (const file of sourceFiles) {
    const sourcePath = path.join(sourceRoot, file);
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
      .replace(/from\s+"\.\.\/currentOpportunity"/g, 'from "./currentOpportunity.mjs"')
      .replace(/from\s+'\.\.\/currentOpportunity'/g, "from './currentOpportunity.mjs'")
      .replace(/from\s+"@\/lib\/tradeGeometry"/g, 'from "./tradeGeometry.mjs"')
      .replace(/from\s+'@\/lib\/tradeGeometry'/g, "from './tradeGeometry.mjs'")
      .replace(/from\s+"\.\.\/tradeGeometry"/g, 'from "./tradeGeometry.mjs"')
      .replace(/from\s+'\.\.\/tradeGeometry'/g, "from './tradeGeometry.mjs'");
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), rewritten, "utf8");
  }
  fs.writeFileSync(path.join(outRoot, "ictAdvisorEngine.mjs"), "export async function buildIctAdvisorPacketFromRuntime() { return { compactSummary: {} }; }\n", "utf8");
  fs.writeFileSync(
    path.join(outRoot, "runIctAdvisorPacket.mjs"),
    "export async function runIctAdvisorPacket() { return globalThis.__ACTIVATE_MARKET_TEST_PACKET ?? { compactSummary: {} }; }\n",
    "utf8"
  );
  fs.writeFileSync(path.join(outRoot, "ictCurrentRead.mjs"), "export function buildIctCurrentReadFromPacket() { return globalThis.__ACTIVATE_MARKET_TEST_READ; }\n", "utf8");
  fs.writeFileSync(path.join(outRoot, "ictMarketAnalysisContext.mjs"), "export async function buildIctMarketAnalysisContextBundle() { return globalThis.__ACTIVATE_MARKET_TEST_MARKET_CONTEXT; }\n", "utf8");
  fs.writeFileSync(path.join(outRoot, "ictSignalContract.mjs"), "export function buildIctResearchSignalFromCurrentRead() { return globalThis.__ACTIVATE_MARKET_TEST_SIGNAL; }\n", "utf8");
  fs.writeFileSync(path.join(outRoot, "tradeGeometry.mjs"), "export function projectCanonicalTradeGeometry(geometry) { return geometry ? { geometryId: geometry.geometryId, intendedEntry: geometry.entry?.intendedPrice, intendedStop: geometry.stop?.price, intendedTarget: geometry.target?.price, theoreticalRR: geometry.theoreticalRR, geometryValid: geometry.geometryValid, actionable: geometry.actionable, status: geometry.status, displayKind: geometry.actionable ? 'ACTIONABLE_GEOMETRY' : 'RESEARCH_GEOMETRY' } : undefined; }\n", "utf8");
  fs.writeFileSync(path.join(outRoot, "ictCmdPaperTracking.mjs"), "export function evaluateCmdPaperTrackingEligibility() { return globalThis.__ACTIVATE_MARKET_TEST_CMD_ELIGIBILITY; }\n", "utf8");
  fs.writeFileSync(
    path.join(outRoot, "currentOpportunity.mjs"),
    `export function buildCurrentOpportunityContext(input) { return input; }
export function detectCurrentOpportunities(input) {
  return {
    generatedAt: new Date().toISOString(),
    summary: input.currentRead?.currentOpportunitySummary,
    opportunities: input.currentRead?.currentOpportunities ?? []
  };
}
export function saveCurrentOpportunityScan() { return { ok: true, storage: "memory" }; }
`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(outRoot, "ictSelfImprovement.mjs"),
    `export function queueIctResearchHypothesis(hypothesis) {
  return globalThis.__ACTIVATE_MARKET_TEST_SELF_IMPROVEMENT_QUEUE ?? {
    ok: Boolean(hypothesis),
    storage: "memory",
    hypothesis,
    journalEvent: hypothesis ? { journalEventId: "test_hypothesis_journal", eventType: "ict_research_hypothesis_created" } : undefined,
    totalHypotheses: hypothesis ? 1 : 0,
    reason: hypothesis ? "Research hypothesis queued - needs replay validation." : "No eligible research hypothesis to queue."
  };
}
`,
    "utf8"
  );
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

const canonicalIfvgGeometry = {
  schemaVersion: "gotrader.trade-geometry.v1",
  geometryVersion: "g2.1.0",
  geometryId: "ifvg-v3-live-canonical-geometry",
  logicalGeometryKey: "ifvg-v3-live-logical-geometry",
  strategyId: "ifvg_fresh_retest_v3_research",
  strategyVersion: "v3",
  profileId: "ifvg_fresh_retest_v3_research",
  profileVersion: "v3",
  candidateId: "ifvg-v3-live-candidate",
  direction: "SHORT",
  entry: { model: "IFVG_NATIVE_MIDPOINT_RETEST", intendedPrice: 23100, lifecycleStatus: "ENTRY_TOUCHED_NOT_FILLED" },
  stop: { model: "IFVG_NATIVE_FULL_GAP_INVALIDATION", price: 23104, structuralInvalidation: true },
  target: { model: "EXTERNAL_LIQUIDITY", price: 23092, targetId: "ifvg-v3-target", targetType: "EXTERNAL_LIQUIDITY", selectionRole: "PRIMARY", policyId: "ifvg_fresh_retest_v3_research.native-liquidity-target", policyVersion: "v3" },
  targetPolicy: { policyId: "ifvg_fresh_retest_v3_research.native-liquidity-target", policyVersion: "v3", primaryTargetType: "EXTERNAL_LIQUIDITY", primaryTargetId: "ifvg-v3-target", allowedFallbackTargetTypes: [] },
  riskDistance: 4,
  rewardDistance: 8,
  theoreticalRR: 2,
  minimumRequiredRR: 2,
  geometryValid: true,
  actionable: true,
  status: "VALID_ACTIONABLE",
  blockers: [],
  warnings: [],
  sourceFingerprint: "mt5_ustech_5m_1000_fp",
  authority: { execution: "none", broker: "none", production: "none" }
};

const activeSource = (overrides = {}) => ({
  provider: "mt5_read_only",
  symbol: "MNQ",
  timeframe: "5m",
  candleCount: 1000,
  fingerprint: "mt5_ustech_5m_1000_fp",
  authority,
  provenance: {
    providerSymbol: "USTECH"
  },
  ...overrides
});

const snapshot = (sourceOverrides = {}, htfSources = [
  { provider: "mt5_read_only", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "15m", candleCount: 1000, fingerprint: "htf_15m_fp" },
  { provider: "mt5_read_only", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "1h", candleCount: 1000, fingerprint: "htf_1h_fp" }
]) => ({
  marketData: {
    symbol: "MNQ",
    contract: "MNQ",
    timeframe: "5m",
    activeResearchSource: activeSource(sourceOverrides)
  },
  mt5ReadOnly: {
    brokerSymbol: "USTECH",
    higherTimeframeSources: htfSources
  }
});

const currentRead = (overrides = {}) => ({
  researchOnly: true,
  packetSource: "live_mt5",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  primaryTimeframe: "5m",
  displayTimeframe: "5m",
  displayTimeframeRole: "chart_display_reference_only",
  analysisTimeframesRequested: ["W1", "D1", "H4", "H1", "M15", "M5"],
  analysisTimeframesLoaded: ["W1", "D1", "H4", "H1", "M15", "M5"],
  requiredTimeframesLoaded: true,
  analysisTimeframesUsed: ["W1", "D1", "H4", "H1", "M15", "M5"],
  analysisDepthStatus: "sufficient",
  multiTimeframeContextStatus: "built",
  missingTimeframes: [],
  weeklyBiasStatus: "loaded",
  weeklyBiasDirection: "bearish",
  weeklyBiasReason: "W1 compact bias loaded from test candles.",
  htfTimeframes: ["15m", "1h"],
  dataStatus: "ready",
  candleCount: 1000,
  side: "short",
  approvedStatus: "paper_watchlist_candidate",
  modelQualityLane: "paper_watchlist",
  paperWatchlistEligible: true,
  paperWatchlistModelName: "consolidation_manipulation_distribution",
  paperWatchlistReason: "CMD paper-watchlist - paper-test only.",
  paperWatchlistEvidenceSummary: "CMD strict evidence passed paper-only profile.",
  paperSimEligibilityStatus: "eligible",
  paperSimEligibilityReason: "Paper-only eligible from explicit paper-watchlist candidate.",
  paperSimAllowed: true,
  paperOnly: true,
  selfImprovementHypothesis: undefined,
  selfImprovementHypothesisQueued: false,
  selfImprovementHypothesisStatus: undefined,
  selfImprovementHypothesisReason: "Opportunity is already approved or paper-watchlist; no self-improvement hypothesis is created.",
  selfImprovementNextValidation: "No queued hypothesis.",
  readinessSummary: {
    researchReadiness: "ready",
    paperReadiness: "eligible",
    executionReadiness: "disabled",
    reasons: ["Execution readiness is disabled by design."]
  },
  executionAllowed: false,
  smtStatus: "confirmed",
  riskStatus: "normal session caution",
  modelDetected: true,
  modelName: "consolidation_manipulation_distribution",
  modelState: "candidate",
  topReasons: ["CMD paper-watchlist candidate."],
  nextAction: "Track CMD Paper Candidate",
  debug: {
    candleCount: 1000,
    primaryTimeframeAvailable: true,
    htfTimeframesAvailable: ["15m", "1h"],
    phase1SignalCount: 4,
    phase2SignalCount: 3,
    approvedStatus: "paper_watchlist_candidate",
    rejectionReasonsCount: 0,
    noTradeReasonsCount: 0,
    lastEvaluationAt: "2026-06-07T12:00:00.000Z",
    packetSource: "live_mt5",
    sourceFingerprint: "mt5_ustech_5m_1000_fp"
  },
  authority,
  safety,
  ...overrides
});

const signalContract = (overrides = {}) => ({
  signalId: "ict_signal_test",
  generatedAt: "2026-06-07T12:00:00.000Z",
  researchOnly: true,
  status: "watchlist_signal",
  executionReadiness: "research_only",
  executionAllowed: false,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  primaryTimeframe: "5m",
  displayTimeframe: "5m",
  displayTimeframeRole: "chart_display_reference_only",
  analysisTimeframesRequested: ["W1", "D1", "H4", "H1", "M15", "M5"],
  analysisTimeframesLoaded: ["W1", "D1", "H4", "H1", "M15", "M5"],
  requiredTimeframesLoaded: true,
  analysisTimeframesUsed: ["W1", "D1", "H4", "H1", "M15", "M5"],
  analysisDepthStatus: "sufficient",
  multiTimeframeContextStatus: "built",
  missingTimeframes: [],
  weeklyBiasStatus: "loaded",
  weeklyBiasDirection: "bearish",
  weeklyBiasReason: "W1 compact bias loaded from test candles.",
  htfTimeframes: ["15m", "1h"],
  side: "short",
  modelQualityLane: "paper_watchlist",
  paperWatchlistEligible: true,
  paperSimEligibilityStatus: "eligible",
  paperSimEligibilityReason: "Paper-only eligible from explicit paper-watchlist candidate.",
  paperSimAllowed: true,
  paperOnly: true,
  readinessSummary: {
    researchReadiness: "ready",
    paperReadiness: "eligible",
    executionReadiness: "disabled",
    reasons: ["Execution readiness is disabled by design."]
  },
  approvedProfileStatus: "paper_watchlist_candidate",
  modelName: "consolidation_manipulation_distribution",
  reasons: ["CMD paper-watchlist - paper-test only."],
  rejectionReasons: [],
  warnings: [],
  nextAction: "Track CMD Paper Candidate",
  authority,
  safety,
  provenance: {
    source: "ict_current_read",
    methodology: "ICT",
    researchOnly: true,
    generatedAt: "2026-06-07T12:00:00.000Z"
  },
  ...overrides
});

const latestResearchState = {
  updatedAt: "2026-06-07T12:01:00.000Z",
  researchOnly: true,
  latestMonteCarlo: {
    generatedAt: "2026-06-07T12:00:30.000Z",
    source: "manual_replay_review",
    usableOutcomes: 27,
    robustnessRating: "moderate",
    medianEndingR: 12.4,
    fifthPercentileEndingR: 1.2,
    medianMaxDrawdownPct: 4.1,
    worstMaxDrawdownPct: 8.8,
    riskOfRuinPct: 2.5,
    recommendedMaxRiskPerTradePct: 0.5,
    warnings: ["test compact Monte Carlo"],
    researchOnly: true
  },
  authority,
  safety
};

const assertSafe = (result) => {
  const serialized = JSON.stringify(result);
  assert.equal(result.researchOnly, true);
  assert.equal(result.authority.executionAuthority, "none");
  assert.equal(result.authority.brokerAuthority, "none");
  assert.equal(result.authority.readinessOverrideAuthority, "none");
  assert.equal(result.safety.rawCandlesExcluded, true);
  assert.equal(result.safety.rawSnapshotsExcluded, true);
  assert.equal(result.safety.accountDataExcluded, true);
  assert.equal(result.safety.orderDataExcluded, true);
  assert.equal(result.safety.positionDataExcluded, true);
  assert.equal(result.safety.secretsExcluded, true);
  assert.equal(result.summary.executionAllowed, false);
  assert.doesNotMatch(serialized, /"candles"\s*:|"rawSnapshot"\s*:|"snapshot"\s*:|"password"\s*:|"secret"\s*:|"api[_-]?key"\s*:|"account(Data|Number|Id)?"\s*:|"position(Data|s|Id)?"\s*:|"order(Data|s|Id)?"\s*:/i);
};

async function main() {
  compileForNode();
  const suite = await import(pathToFileURL(path.join(outRoot, "ictActivateMarketPipeline.mjs")));
  const initialSteps = suite.createActivateMarketInitialSteps();
  assert.deepEqual(
    initialSteps.map((step) => step.id),
    [
    "resolve_symbol",
    "check_mt5_readonly",
      "load_display_candles",
      "load_analysis_m5",
      "load_analysis_m15",
      "load_analysis_h1",
      "load_analysis_h4",
      "load_analysis_daily",
      "load_analysis_weekly",
      "load_weekly_bias",
      "build_multi_timeframe_context",
      "build_current_read",
      "detect_session_model",
      "run_universal_recognition",
      "detect_market_opportunity",
      "queue_research_hypothesis",
      "run_phase_one",
      "run_phase_two",
      "run_smt",
      "run_news_session_risk",
      "apply_approved_profile",
      "build_signal_contract",
      "build_operator_workflow",
      "check_cmd_paper_eligibility",
      "load_latest_monte_carlo_summary",
      "save_latest_state",
      "complete"
    ],
    "Activate Market steps should stay in the requested order"
  );
  assert.ok(initialSteps.every((step) => step.status === "pending"), "initial steps should be pending");

  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead();
  globalThis.__ACTIVATE_MARKET_TEST_SIGNAL = signalContract({
    entryReference: 23100,
    invalidation: 23150,
    target: 23000,
    rrEstimate: 2,
    targetProvenance: {
      type: "previous_day_low",
      sourceTimeframe: "daily",
      selectionReason: "Advisor signal selected directional liquidity: previous_day_low",
      distancePoints: 100,
      rr: 2,
      minimumRR: 2,
      gateStatus: "accepted",
      rejectionReasons: []
    }
  });
  globalThis.__ACTIVATE_MARKET_TEST_MARKET_CONTEXT = {
    context: {
      researchOnly: true,
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      displayTimeframe: "5m",
      displayTimeframeRole: "chart_display_reference_only",
      analysisTimeframesRequested: ["W1", "D1", "H4", "H1", "M15", "M5"],
      analysisTimeframes: ["W1", "D1", "H4", "H1", "M15", "M5"].map((timeframe) => ({
        timeframe,
        requestedLookbackDays: 90,
        availableLookbackDays: 88.95,
        candleCount: timeframe === "M5" ? 17799 : timeframe === "M15" ? 5960 : 600,
        dataDepthStatus: "sufficient",
        sourceMethod: `test_chunked_${timeframe}`,
        role: "test_role",
        firstTimestamp: "2026-03-01T00:00:00.000Z",
        lastTimestamp: "2026-06-07T00:00:00.000Z",
        chunkCount: 9
      })),
      chartDisplayCandleCount: 1000,
      analysisTimeframesLoaded: ["W1", "D1", "H4", "H1", "M15", "M5"],
      requiredTimeframesLoaded: true,
      analysisDepthStatus: "sufficient",
      multiTimeframeContextStatus: "built",
      analysisTimeframesUsed: ["W1", "D1", "H4", "H1", "M15", "M5"],
      missingTimeframes: [],
      htfBiasSource: ["W1", "D1", "H4", "H1"],
      sessionModelSourceTimeframe: "M15",
      confirmationSourceTimeframe: "M5",
      weeklyBiasStatus: "loaded",
      weeklyBiasDirection: "bearish",
      weeklyBiasReason: "W1 compact bias loaded from test candles.",
      warnings: ["test compact context"],
      generatedAt: "2026-06-07T12:00:00.000Z",
      authority,
      safety
    },
    displayCandles: [],
    analysisCandlesByTimeframe: {},
    depthSummariesByTimeframe: {}
  };
  globalThis.__ACTIVATE_MARKET_TEST_PACKET = {
    marketAnalysisContext: globalThis.__ACTIVATE_MARKET_TEST_MARKET_CONTEXT.context,
    compactSummary: {}
  };
  globalThis.__ACTIVATE_MARKET_TEST_CMD_ELIGIBILITY = {
    eligible: true,
    reasons: ["CMD strict paper-watchlist candidate is eligible for paper-only tracking."]
  };
  const updates = [];
  const savedSummaries = [];
  const success = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot(), latestResearchState, saveLatestSummary: true },
    { onStepUpdate: (step, allSteps) => updates.push({ step, allSteps }) },
    { saveLatestSummary: (summary) => savedSummaries.push(summary) }
  );
  if (success.status !== "completed") {
    console.error(JSON.stringify({ status: success.status, error: success.error, steps: success.steps.filter((step) => step.status === "failed") }, null, 2));
  }
  assert.equal(success.status, "completed", "successful pipeline should complete");
  assert.ok(success.steps.every((step) => step.status === "completed"), "successful pipeline should mark all steps completed");
  assert.ok(updates.length >= success.steps.length, "progress updates should be emitted");
  assert.ok(success.currentRead, "result should include compact current read");
  assert.ok(success.marketAnalysisContext, "result should include compact multi-timeframe context");
  assert.ok(success.signalContract, "result should include research signal contract");
  assert.deepEqual(success.summary.analysisTimeframesUsed, ["W1", "D1", "H4", "H1", "M15", "M5"]);
  assert.equal(success.summary.displayTimeframe, "5m");
  assert.equal(success.summary.analysisDepthStatus, "sufficient");
  assert.equal(success.operatorWorkflow.recommendedAction, "Track CMD Paper Candidate");
  assert.equal(success.cmdPaperEligibility.eligible, true);
  assert.equal(success.selfImprovementQueue.queued, false);
  assert.match(success.selfImprovementQueue.reason, /already approved or paper-watchlist|No eligible/i);
  assert.equal(success.summary.modelLane, "paper_watchlist");
  assert.equal(success.summary.selfImprovementHypothesisQueued, false);
  assert.equal(success.summary.readinessSummary.executionReadiness, "disabled");
  assert.equal(success.summary.paperSimAllowed, true);
  assert.equal(success.latestMonteCarlo.status, "saved");
  assert.equal(success.summary.recommendedMaxRiskPerTradePct, 0.5);
  assert.equal(savedSummaries.length, 1, "compact activation summary should be saved once");
  assert.equal(savedSummaries[0].executionAllowed, false);
  assert.deepEqual(savedSummaries[0].analysisTimeframesRequested, ["W1", "D1", "H4", "H1", "M15", "M5"]);
  assert.deepEqual(savedSummaries[0].analysisTimeframesLoaded, ["W1", "D1", "H4", "H1", "M15", "M5"]);
  assert.equal(savedSummaries[0].requiredTimeframesLoaded, true);
  assert.equal(savedSummaries[0].multiTimeframeContextStatus, "built");
  assert.equal(savedSummaries[0].weeklyBiasStatus, "loaded");
  assert.equal(savedSummaries[0].weeklyBiasDirection, success.summary.weeklyBiasDirection);
  assert.equal(savedSummaries[0].weeklyBiasDirection, "bearish");
  assert.equal(savedSummaries[0].proposedTargetProvenance, undefined, "signal-only geometry must not be promoted into the plan");
  assert.doesNotMatch(JSON.stringify(savedSummaries[0]), /"(?:candles|rawCandles|rawSnapshots)"\s*:/i);
  assertSafe(success);
  assert.match(suite.summarizeActivateMarketResult(success), /execution disabled/i);

  const canonicalIfvgOpportunity = {
    id: "ifvg-v3-live-opportunity",
    candidateId: "ifvg-v3-live-candidate",
    strategyId: "ifvg_fresh_retest_v3_research",
    strategyVersion: "v3",
    profileId: "ifvg_fresh_retest_v3_research",
    candidateState: "ACTIVE",
    setupName: "IFVG fresh-retest v3",
    status: "valid_candidate",
    side: "short",
    actionable: true,
    blockers: [],
    missingConditions: [],
    geometry: canonicalIfvgGeometry,
    entry: 23100,
    invalidation: 23104,
    target: 23092,
    rrEstimate: 2
  };
  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead({
    side: "short",
    currentOpportunitySummary: {
      topOpportunity: canonicalIfvgOpportunity
    },
    currentOpportunities: [canonicalIfvgOpportunity]
  });
  globalThis.__ACTIVATE_MARKET_TEST_SIGNAL = signalContract({
    status: "approved_research_signal",
    side: "short",
    canonicalGeometry: canonicalIfvgGeometry,
    canonicalGeometryId: canonicalIfvgGeometry.geometryId,
    entryReference: 23100,
    invalidation: 23104,
    target: 23092,
    rrEstimate: 2
  });
  const canonicalIfvgResult = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot(), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => undefined }
  );
  assert.notEqual(canonicalIfvgResult.status, "failed");
  assert.equal(canonicalIfvgResult.summary.proposedGeometry?.geometryId, canonicalIfvgGeometry.geometryId);
  assert.equal(canonicalIfvgResult.summary.proposedEntryPrice, 23100);
  assert.equal(canonicalIfvgResult.summary.proposedStopLoss, 23104);
  assert.equal(canonicalIfvgResult.summary.proposedTakeProfit, 23092);
  assert.equal(canonicalIfvgResult.summary.proposedRiskReward, 2);
  assert.equal(canonicalIfvgResult.summary.candidatePlans.length, 1);
  assert.equal(canonicalIfvgResult.summary.candidatePlans[0].candidateId, "ifvg-v3-live-candidate");
  assert.equal(canonicalIfvgResult.summary.candidatePlans[0].geometryId, canonicalIfvgGeometry.geometryId);
  assert.equal(canonicalIfvgResult.summary.executionAllowed, false);
  assertSafe(canonicalIfvgResult);

  const marketMakerBuyGeometry = {
    ...canonicalIfvgGeometry,
    geometryId: "mmbm-live-canonical-geometry",
    logicalGeometryKey: "mmbm-live-logical-geometry",
    strategyId: "ict_market_maker_buy_model_v1",
    strategyVersion: "1.0.0",
    profileId: "ict_market_maker_buy_model_v1_research",
    profileVersion: "1.0.0",
    candidateId: "mmbm-live-candidate",
    direction: "LONG",
    entry: { model: "PD_ARRAY_REPRICE", intendedPrice: 23090, lifecycleStatus: "ENTRY_TOUCHED_NOT_FILLED" },
    stop: { model: "ENGINEERING_EXTREME", price: 23080, structuralInvalidation: true },
    target: {
      ...canonicalIfvgGeometry.target,
      model: "OPPOSITE_EXTERNAL_LIQUIDITY",
      price: 23120,
      targetId: "mmbm-opposite-external-liquidity",
      policyId: "ict_market_maker_buy_model_v1.opposite-external-liquidity"
    },
    riskDistance: 10,
    rewardDistance: 30,
    theoreticalRR: 3,
    minimumRequiredRR: 2
  };
  const marketMakerBuyOpportunity = {
    ...canonicalIfvgOpportunity,
    id: "mmbm-live-opportunity",
    candidateId: "mmbm-live-candidate",
    strategyId: "ict_market_maker_buy_model_v1",
    strategyVersion: "1.0.0",
    profileId: "ict_market_maker_buy_model_v1_research",
    candidateState: "ACTIVE_DELIVERY",
    setupName: "Market Maker Buy Model",
    side: "long",
    geometry: marketMakerBuyGeometry,
    entry: 23090,
    invalidation: 23080,
    target: 23120,
    rrEstimate: 3
  };
  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead({
    side: "long",
    activeStrategyId: marketMakerBuyOpportunity.strategyId,
    activeCandidateId: marketMakerBuyOpportunity.candidateId,
    canonicalGeometry: marketMakerBuyGeometry,
    currentOpportunitySummary: {
      canonicalSetupConflict: "NONE",
      canonicalCandidateSetDisposition: "SINGLE_ACTIONABLE_CANDIDATE",
      canonicalCandidateCount: 1,
      actionableCanonicalCandidateCount: 1,
      selectedCanonicalCandidateId: marketMakerBuyOpportunity.candidateId,
      topOpportunity: marketMakerBuyOpportunity
    },
    currentOpportunities: [marketMakerBuyOpportunity],
    canonicalCandidates: [{
      opportunityId: marketMakerBuyOpportunity.id,
      candidateId: marketMakerBuyOpportunity.candidateId,
      strategyId: marketMakerBuyOpportunity.strategyId,
      direction: marketMakerBuyOpportunity.side,
      actionability: true,
      canonicalGeometry: marketMakerBuyGeometry,
      geometryId: marketMakerBuyGeometry.geometryId,
      opportunity: marketMakerBuyOpportunity
    }]
  });
  globalThis.__ACTIVATE_MARKET_TEST_SIGNAL = signalContract({
    status: "approved_research_signal",
    side: "long",
    strategyId: marketMakerBuyOpportunity.strategyId,
    canonicalGeometry: marketMakerBuyGeometry,
    canonicalGeometryId: marketMakerBuyGeometry.geometryId,
    entryReference: 23090,
    invalidation: 23080,
    target: 23120,
    rrEstimate: 3
  });
  const marketMakerBuyResult = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot(), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => undefined }
  );
  assert.notEqual(marketMakerBuyResult.status, "failed");
  assert.equal(marketMakerBuyResult.summary.proposedGeometry, marketMakerBuyGeometry, "Activate Market must preserve producer geometry by reference");
  assert.deepEqual(
    marketMakerBuyResult.summary.candidatePlans.map((plan) => [plan.strategyId, plan.candidateId, plan.geometryId, plan.entry, plan.stop, plan.target, plan.riskReward]),
    [["ict_market_maker_buy_model_v1", "mmbm-live-candidate", "mmbm-live-canonical-geometry", 23090, 23080, 23120, 3]]
  );
  assert.equal(marketMakerBuyResult.summary.executionAllowed, false);
  assertSafe(marketMakerBuyResult);

  const ict2022Geometry = {
    ...canonicalIfvgGeometry,
    geometryId: "ict-2022-long-canonical-geometry",
    logicalGeometryKey: "ict-2022-long-logical-geometry",
    strategyId: "ict_2022_model_v1",
    strategyVersion: "1.0.0",
    profileId: "ict_2022_model_v1_research",
    profileVersion: "1.0.0",
    candidateId: "ict-2022-long-candidate",
    direction: "LONG",
    entry: { model: "POST_MSS_FVG_MIDPOINT_RETRACE", intendedPrice: 23090, lifecycleStatus: "ENTRY_TOUCHED_NOT_FILLED" },
    stop: { model: "OPPOSING_RAID_EXTREME", price: 23080, structuralInvalidation: true },
    target: { ...canonicalIfvgGeometry.target, price: 23120, targetId: "ict-2022-primary-draw", policyId: "ict_2022_model_v1.primary_external_draw" },
    riskDistance: 10,
    rewardDistance: 30,
    theoreticalRR: 3,
    minimumRequiredRR: 2
  };
  const ict2022Opportunity = {
    ...canonicalIfvgOpportunity,
    id: "ict-2022-long-opportunity",
    candidateId: "ict-2022-long-candidate",
    strategyId: "ict_2022_model_v1",
    strategyVersion: "1.0.0",
    profileId: "ict_2022_model_v1_research",
    setupName: "ICT 2022 Model",
    side: "long",
    geometry: ict2022Geometry,
    entry: 23090,
    invalidation: 23080,
    target: 23120,
    rrEstimate: 3
  };
  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead({
    side: "flat",
    canonicalGeometry: undefined,
    currentOpportunitySummary: {
      canonicalSetupConflict: "CONFLICTING_CANONICAL_SETUPS",
      canonicalCandidateSetDisposition: "CONFLICTING_CANONICAL_SETUPS",
      canonicalCandidateCount: 2,
      actionableCanonicalCandidateCount: 2
    },
    currentOpportunities: [canonicalIfvgOpportunity, ict2022Opportunity],
    canonicalCandidates: [
      { opportunityId: canonicalIfvgOpportunity.id, candidateId: canonicalIfvgOpportunity.candidateId, strategyId: canonicalIfvgOpportunity.strategyId, direction: canonicalIfvgOpportunity.side, actionability: true, canonicalGeometry: canonicalIfvgOpportunity.geometry, geometryId: canonicalIfvgOpportunity.geometry.geometryId, opportunity: canonicalIfvgOpportunity },
      { opportunityId: ict2022Opportunity.id, candidateId: ict2022Opportunity.candidateId, strategyId: ict2022Opportunity.strategyId, direction: ict2022Opportunity.side, actionability: true, canonicalGeometry: ict2022Opportunity.geometry, geometryId: ict2022Opportunity.geometry.geometryId, opportunity: ict2022Opportunity }
    ]
  });
  globalThis.__ACTIVATE_MARKET_TEST_SIGNAL = signalContract({ status: "no_signal", side: "flat", canonicalGeometry: undefined });
  const conflictResult = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot(), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => undefined }
  );
  assert.equal(conflictResult.summary.canonicalSetupConflict, "CONFLICTING_CANONICAL_SETUPS");
  assert.equal(conflictResult.summary.researchSide, "flat");
  assert.equal(conflictResult.summary.proposedGeometry, undefined, "conflicts must not create a synthetic primary plan");
  assert.deepEqual(
    conflictResult.summary.candidatePlans.map((plan) => [plan.strategyId, plan.candidateId, plan.geometryId, plan.entry, plan.stop, plan.target, plan.riskReward]),
    [
      ["ifvg_fresh_retest_v3_research", "ifvg-v3-live-candidate", "ifvg-v3-live-canonical-geometry", 23100, 23104, 23092, 2],
      ["ict_2022_model_v1", "ict-2022-long-candidate", "ict-2022-long-canonical-geometry", 23090, 23080, 23120, 3]
    ]
  );

  const queuedHypothesis = {
    researchOnly: true,
    hypothesisId: "ict_research_hypothesis_test_queue",
    generatedAt: "2026-06-07T12:03:00.000Z",
    status: "queued_for_replay",
    title: "unknown structured opportunity hypothesis",
    sourceOpportunity: {
      opportunityId: "ict_opportunity_test_queue",
      type: "unknown_structured_opportunity",
      stage: "forming",
      quality: "medium",
      direction: "bearish",
      modelName: "consolidation_manipulation_distribution",
      modelFamily: "consolidation_manipulation_distribution",
      marketCycleStage: "manipulation",
      laneRecommendation: "watchlist_candidate",
      nextAction: "Replay validate the missing confirmation."
    },
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    primaryTimeframe: "5m",
    sourceFingerprint: "mt5_ustech_5m_1000_fp",
    candleCount: 1000,
    missingConfirmation: ["Displacement confirmation missing."],
    proposedValidationRules: ["Run manual replay validation on the same compact model family before any paper-watchlist review."],
    blockers: [],
    nextAction: "Research hypothesis queued - needs replay validation.",
    autoPromoteAllowed: false,
    executionAllowed: false,
    authority,
    safety
  };
  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead({
    approvedStatus: "watchlist_candidate",
    modelQualityLane: "watchlist",
    paperWatchlistEligible: false,
    paperSimEligibilityStatus: "not_eligible",
    paperSimEligibilityReason: "Watchlist only - not paper eligible.",
    paperSimAllowed: false,
    paperOnly: false,
    opportunityDetected: true,
    opportunityType: "unknown_structured_opportunity",
    opportunityStage: "forming",
    opportunityQuality: "medium",
    opportunityLaneRecommendation: "watchlist_candidate",
    opportunityNextAction: "Replay validate the missing confirmation.",
    opportunityMissingEvidence: ["Displacement confirmation missing."],
    opportunityBlockers: ["Approval evidence is incomplete."],
    selfImprovementHypothesis: queuedHypothesis,
    selfImprovementHypothesisQueued: true,
    selfImprovementHypothesisStatus: "queued_for_replay",
    selfImprovementHypothesisReason: "Research hypothesis queued - needs replay validation.",
    selfImprovementNextValidation: queuedHypothesis.proposedValidationRules[0],
    nextAction: "Research hypothesis queued - needs replay validation."
  });
  globalThis.__ACTIVATE_MARKET_TEST_SIGNAL = signalContract({
    status: "watchlist_signal",
    modelQualityLane: "watchlist",
    paperWatchlistEligible: false,
    approvedProfileStatus: "watchlist_candidate",
    nextAction: "Research hypothesis queued - needs replay validation."
  });
  globalThis.__ACTIVATE_MARKET_TEST_CMD_ELIGIBILITY = {
    eligible: false,
    reasons: ["Not eligible - no CMD paper-watchlist candidate."]
  };
  const queued = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot(), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => undefined }
  );
  assert.equal(queued.selfImprovementQueue.queued, true);
  assert.equal(queued.selfImprovementHypothesis.status, "queued_for_replay");
  assert.equal(queued.summary.selfImprovementHypothesisQueued, true);
  assert.match(queued.summary.selfImprovementHypothesisReason, /Research hypothesis queued/i);
  assert.equal(queued.summary.executionAllowed, false);
  assertSafe(queued);

  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead();
  globalThis.__ACTIVATE_MARKET_TEST_SIGNAL = signalContract();
  globalThis.__ACTIVATE_MARKET_TEST_CMD_ELIGIBILITY = {
    eligible: true,
    reasons: ["CMD strict paper-watchlist candidate is eligible for paper-only tracking."]
  };

  const unavailable = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot({ provider: "mock", candleCount: 48, fingerprint: "mock_fp" }), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => assert.fail("unavailable activation should not save summary") }
  );
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.steps.find((step) => step.id === "check_mt5_readonly").status, "failed");
  assert.match(unavailable.errors.join(" "), /MT5 read-only is required/i);
  assertSafe(unavailable);

  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead({ htfTimeframes: [], smtStatus: "confirmed" });
  globalThis.__ACTIVATE_MARKET_TEST_MARKET_CONTEXT = {
    ...globalThis.__ACTIVATE_MARKET_TEST_MARKET_CONTEXT,
    context: {
      ...globalThis.__ACTIVATE_MARKET_TEST_MARKET_CONTEXT.context,
      analysisTimeframes: globalThis.__ACTIVATE_MARKET_TEST_MARKET_CONTEXT.context.analysisTimeframes.map((context) =>
        context.timeframe === "H1" ? { ...context, candleCount: 0, dataDepthStatus: "unavailable" } : context
      ),
      analysisDepthStatus: "limited",
      multiTimeframeContextStatus: "partial",
      analysisTimeframesLoaded: ["W1", "D1", "H4", "M15", "M5"],
      requiredTimeframesLoaded: true,
      analysisTimeframesUsed: ["W1", "D1", "H4", "M15", "M5"],
      missingTimeframes: ["H1"],
      htfBiasSource: ["W1", "D1", "H4"]
    }
  };
  globalThis.__ACTIVATE_MARKET_TEST_PACKET = {
    ...globalThis.__ACTIVATE_MARKET_TEST_PACKET,
    marketAnalysisContext: globalThis.__ACTIVATE_MARKET_TEST_MARKET_CONTEXT.context
  };
  const missingHtf = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot({}, []), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => undefined }
  );
  assert.equal(missingHtf.status, "partial");
  assert.equal(missingHtf.steps.find((step) => step.id === "load_analysis_h1").status, "skipped");
  assert.match(missingHtf.warnings.join(" "), /H1 analysis context is missing|missing H1/i);
  assertSafe(missingHtf);

  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead({ smtStatus: "not available" });
  const missingSmt = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot(), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => undefined }
  );
  assert.equal(missingSmt.status, "partial");
  assert.equal(missingSmt.steps.find((step) => step.id === "run_smt").status, "completed");
  assert.equal(missingSmt.steps.find((step) => step.id === "run_smt").warning, undefined);
  assert.match(missingSmt.steps.find((step) => step.id === "run_smt").message, /Optional SMT confluence is unavailable/i);
  assert.doesNotMatch(missingSmt.warnings.join(" "), /SMT|relative.strength/i);
  assertSafe(missingSmt);

  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead({
    modelDetected: false,
    modelName: undefined,
    modelQualityLane: "no_trade",
    approvedStatus: "no_trade",
    paperWatchlistEligible: false,
    paperSimEligibilityStatus: "not_eligible",
    paperSimEligibilityReason: "Only approved research signals or explicit paper-watchlist candidates are eligible.",
    paperSimAllowed: false,
    paperOnly: false,
    readinessSummary: {
      researchReadiness: "partial",
      paperReadiness: "not_eligible",
      executionReadiness: "disabled",
      reasons: ["No complete session model detected.", "Execution readiness is disabled by design."]
    },
    topReasons: ["No current session model detected."],
    nextAction: "Wait / Check MT5 Depth"
  });
  globalThis.__ACTIVATE_MARKET_TEST_SIGNAL = signalContract({
    status: "no_signal",
    modelQualityLane: "no_trade",
    paperWatchlistEligible: false,
    approvedProfileStatus: "no_trade",
    modelName: undefined,
    nextAction: "Wait / Check MT5 Depth"
  });
  globalThis.__ACTIVATE_MARKET_TEST_CMD_ELIGIBILITY = {
    eligible: false,
    reasons: ["Only CMD paper-watchlist candidates can create CMD paper tracking."]
  };
  const noTrade = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot(), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => undefined }
  );
  assert.equal(noTrade.operatorWorkflow.recommendedAction, "Wait / Check MT5 Depth");
  assert.equal(noTrade.cmdPaperEligibility.eligible, false);
  assert.equal(noTrade.steps.find((step) => step.id === "check_cmd_paper_eligibility").status, "completed");
  assert.match(noTrade.cmdPaperEligibility.reason, /Only CMD paper-watchlist/i);
  assertSafe(noTrade);

  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead({
    modelQualityLane: "no_trade",
    riskStatus: "reject_candidate",
    currentOpportunitySummary: {
      topRejected: {
        status: "rejected",
        side: "short",
        entry: 23124.75
      }
    }
  });
  globalThis.__ACTIVATE_MARKET_TEST_SIGNAL = signalContract({
    status: "rejected_signal",
    side: "short",
    entryZone: undefined,
    invalidation: 23156.25,
    target: 23088.5,
    rrEstimate: 1.15
  });
  const rejectedWithCanonicalEntry = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot(), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => undefined }
  );
  assert.equal(rejectedWithCanonicalEntry.summary.proposedCandidateStatus, "rejected");
  assert.equal(rejectedWithCanonicalEntry.summary.proposedEntryPrice, undefined);
  assert.equal(rejectedWithCanonicalEntry.summary.proposedEntryZone, undefined);
  assert.equal(rejectedWithCanonicalEntry.summary.proposedStopLoss, undefined);
  assertSafe(rejectedWithCanonicalEntry);

  globalThis.__ACTIVATE_MARKET_TEST_READ = currentRead({
    currentOpportunitySummary: {
      topRejected: {
        status: "rejected",
        side: "long",
        entry: 23050
      }
    }
  });
  globalThis.__ACTIVATE_MARKET_TEST_SIGNAL = signalContract({
    status: "rejected_signal",
    side: "short",
    entryReference: 23100,
    invalidation: 23150,
    target: 23000,
    rrEstimate: 2
  });
  const mismatchedScannerCandidate = await suite.runIctActivateMarketPipeline(
    { snapshot: snapshot(), saveLatestSummary: false },
    undefined,
    { saveLatestSummary: () => undefined }
  );
  assert.equal(mismatchedScannerCandidate.summary.researchSide, "long", "scanner candidate owns side; signal fallback is ignored");
  assert.equal(mismatchedScannerCandidate.summary.proposedEntryPrice, undefined);
  assert.equal(mismatchedScannerCandidate.summary.proposedCandidateStatus, "rejected");
  assertSafe(mismatchedScannerCandidate);

  console.log(JSON.stringify({
    status: "passed",
    tested: [
      "initial_step_order",
      "successful_pipeline",
      "mt5_unavailable",
      "missing_htf_partial",
      "missing_smt_skipped",
      "progress_updates",
      "operator_workflow",
      "rejected_candidate_canonical_entry",
      "cross_source_direction_coherence",
      "safety_contract"
    ],
    authority,
    rawCandlesExposed: false
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
