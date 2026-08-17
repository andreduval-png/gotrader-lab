#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "operatorConsole");
const outRoot = path.join(projectRoot, ".gotrader", "operator-console-test");
const sourceFiles = [
  "operatorConsoleTypes.ts",
  "operatorPendingState.ts",
  "buildOperatorConsoleSnapshot.ts",
  "operatorForwardScenario.ts",
  "operatorMemorySummary.ts"
];

function compileForNode() {
  fs.mkdirSync(outRoot, { recursive: true });
  for (const file of sourceFiles) {
    const sourcePath = path.join(sourceRoot, file);
    const source = fs.readFileSync(sourcePath, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText;
    const rewritten = output
      .replace(/from\s+"\.\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'\.\/([^']+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), rewritten, "utf8");
  }
}

const sourceSummary = ({ provider = "mt5_read_only", candles = 1000, fingerprint = "mt5-fingerprint" } = {}) => ({
  provider,
  symbol: "MNQ",
  normalizedSymbol: "MNQ",
  timeframe: "5m",
  candleCount: candles,
  fingerprint,
  lastTimestamp: "2026-07-12T14:00:00.000Z",
  eligibility: { researchCycle: provider !== "mock" && candles >= 500 },
  authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
  provenance: { providerSymbol: "USTECH" }
});

const runtime = ({ provider = "mt5_read_only", candles = 1000, fingerprint = "mt5-fingerprint", readiness = "Research Ready" } = {}) => ({
  marketData: {
    activeResearchSource: sourceSummary({ provider, candles, fingerprint }),
    activeResearchSourceLabel: provider === "mt5_read_only" ? "MNQ via USTECH" : "Mock candles",
    activeDataSource: provider,
    symbol: "MNQ",
    contract: "USTECH",
    timeframe: "5m",
    rawCandleCount: candles,
    isMockDataActive: provider === "mock",
    fallbackToMock: provider === "mock",
    researchDataFingerprint: fingerprint,
    chartDisplayLastTimestamp: "2026-07-12T14:00:00.000Z"
  },
  latestResearchCycle: {
    latestThesisSummary: {
      bias: "bullish",
      confidence: 62,
      summary: "Bullish research thesis with guarded confidence."
    }
  },
  performance: {
    canonicalPerformanceMetrics: {
      totalTrades: 24,
      winRate: 0.58,
      averageR: 0.44,
      maxDrawdownR: 3.2,
      profitFactor: 1.35,
      generatedAt: "2026-07-12T13:00:00.000Z"
    }
  },
  readiness: {
    readinessState: readiness,
    nextAction: "Collect more independent evidence."
  },
  evidence: { evidenceQualityScore: 52 },
  maturity: { maturityScore: 47 },
  walkForward: { latestRun: { stability: { verdict: "passed" } } },
  proposal: {
    latestProposalIsCurrent: false,
    latestProposalId: undefined
  }
});

async function main() {
  compileForNode();
  const { buildOperatorConsoleSnapshot } = await import(
    pathToFileURL(path.join(outRoot, "buildOperatorConsoleSnapshot.mjs")).href
  );
  const { prepareOperatorForwardScenario } = await import(
    pathToFileURL(path.join(outRoot, "operatorForwardScenario.mjs")).href
  );
  const { buildOperatorMemorySummary } = await import(
    pathToFileURL(path.join(outRoot, "operatorMemorySummary.mjs")).href
  );

  const memory = buildOperatorMemorySummary(
    {
      schemaVersion: 1,
      generatedAt: "2026-07-12T14:00:00.000Z",
      totalRecords: 12,
      totalProfiles: 2,
      aggregates: [
        {
          identity: { strategyProfile: "ifvg_fresh_retest_v3_research" },
          independentCycleDates: 5,
          positiveEdgeCycles: 3,
          lastCompletedAt: "2026-07-12T13:30:00.000Z"
        }
      ]
    },
    {
      schemaVersion: 1,
      deliveryEnabled: false,
      entries: [
        { status: "pending" },
        { status: "delivered" },
        { status: "failed" }
      ],
      safetyNotice: "gbrain memory is advisory only. GoTrader remains the research and readiness authority."
    }
  );

  const active = buildOperatorConsoleSnapshot({
    runtime: runtime(),
    activation: {
      modelName: "ifvg_v1",
      modelLane: "watchlist",
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      primaryTimeframe: "5m",
      researchSide: "short",
      proposedEntryZone: { lower: 22850.25, upper: 22856.5 },
      proposedStopLoss: 22882.25,
      proposedTakeProfit: 22765.75,
      proposedRiskReward: 3.1,
      riskScreeningStatus: "clear",
      riskScreeningReason: "Session/news risk screen is clear.",
      recommendedMaxRiskPerTradePct: 0.5,
      nextAction: "Run independent-date validation."
    },
    memory,
    cycle: {
      status: "completed",
      stage: "complete",
      progressPercent: 100,
      message: "Research cycle completed.",
      authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
      autoApplyAllowed: false,
      researchOnly: true
    }
  });
  assert.equal(active.source.researchEligible, true);
  assert.equal(active.source.provider, "mt5_read_only");
  assert.equal(active.source.brokerSymbol, "USTECH");
  assert.equal(active.results.totalTrades, 24);
  assert.equal(active.results.walkForwardStatus, "passed");
  assert.equal(active.decisions.length, 0);
  assert.equal(active.memory.storedEvidenceRecords, 12);
  assert.equal(active.memory.gbrainPending, 1);
  assert.equal(active.memory.gbrainDelivered, 1);
  assert.equal(active.memory.gbrainFailed, 1);
  assert.equal(active.researchPlan.status, "complete");
  assert.equal(active.researchPlan.side, "short");
  assert.equal(active.researchPlan.setupDirection, "bearish");
  assert.equal(active.researchPlan.signal, "SELL");
  assert.equal(active.researchPlan.planCoherence, "coherent");
  assert.equal(active.researchPlan.entryPrice, 22853.375);
  assert.equal(active.researchPlan.entryPriceMethod, "zone_midpoint");
  assert.equal(active.researchPlan.stopLoss, 22882.25);
  assert.equal(active.researchPlan.takeProfit, 22765.75);
  assert.equal(active.researchPlan.riskReward, 3.1);
  assert.equal(active.researchPlan.accountRiskEvaluation, "not_evaluated");
  assert.equal(active.researchPlan.executionAllowed, false);

  const runningCycle = buildOperatorConsoleSnapshot({
    runtime: runtime(),
    activation: active.researchPlan,
    cycle: {
      cycleId: "running-cycle",
      status: "running",
      stage: "building_market_read",
      progressPercent: 35,
      message: "Building the current market read.",
      latestInsight: {
        bias: "bullish",
        setup: "partial setup",
        modelLane: "research",
        confidence: 0.91,
        summary: "Intermediate insight must not leak.",
        nextAction: "Wait."
      },
      authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
      autoApplyAllowed: false,
      researchOnly: true
    }
  });
  assert.equal(runningCycle.insight.confidence, undefined, "running cycles must not publish partial confidence");
  assert.equal(runningCycle.insight.setup, "Current cycle in progress");
  assert.equal(runningCycle.researchPlan.status, "unavailable");
  assert.equal(runningCycle.researchPlan.setup, "Current cycle in progress");
  assert.equal(runningCycle.researchPlan.entryPrice, undefined);
  assert.equal(runningCycle.researchPlan.stopLoss, undefined);
  assert.equal(runningCycle.researchPlan.takeProfit, undefined);

  const bullish = buildOperatorConsoleSnapshot({
    activation: {
      modelName: "bullish_test",
      researchSide: "long",
      proposedEntryZone: { lower: 101, upper: 99 },
      proposedStopLoss: 97,
      proposedTakeProfit: 107,
      proposedRiskReward: 2.33
    }
  });
  assert.equal(bullish.researchPlan.setupDirection, "bullish");
  assert.equal(bullish.researchPlan.signal, "BUY");
  assert.equal(bullish.researchPlan.planCoherence, "coherent");
  assert.deepEqual(bullish.researchPlan.entryZone, { lower: 99, upper: 101 });
  assert.equal(bullish.researchPlan.entryPrice, 100);

  const flatPlan = buildOperatorConsoleSnapshot({
    activation: {
      modelName: "flat_test",
      researchSide: "flat",
      proposedEntryZone: { lower: 99, upper: 101 },
      proposedStopLoss: 97,
      proposedTakeProfit: 107,
      proposedRiskReward: 2.33
    }
  });
  assert.equal(flatPlan.researchPlan.status, "no_trade");
  assert.equal(flatPlan.researchPlan.setupDirection, "neutral");
  assert.equal(flatPlan.researchPlan.signal, "NO_TRADE");
  assert.equal(flatPlan.researchPlan.entryPrice, undefined);

  const incomplete = buildOperatorConsoleSnapshot({
    activation: { modelName: "incomplete_test", researchSide: "short" }
  });
  assert.equal(incomplete.researchPlan.status, "unavailable");
  assert.equal(incomplete.researchPlan.signal, "NO_TRADE");
  assert.equal(incomplete.researchPlan.entryPrice, undefined);

  const rejectedShort = buildOperatorConsoleSnapshot({
    activation: {
      modelName: "order_block_retracement",
      researchSide: "short",
      proposedCandidateStatus: "rejected",
      proposedEntryPrice: 23124.75,
      proposedStopLoss: 23156.25,
      proposedTakeProfit: 23088.5,
      proposedRiskReward: 1.15,
      riskScreeningStatus: "unsuitable_after_hours"
    }
  });
  assert.equal(rejectedShort.researchPlan.status, "no_trade");
  assert.equal(rejectedShort.researchPlan.setupDirection, "bearish");
  assert.equal(rejectedShort.researchPlan.entryPrice, 23124.75);
  assert.equal(rejectedShort.researchPlan.entryPriceMethod, "canonical_candidate");
  assert.equal(rejectedShort.researchPlan.signal, "NO_TRADE");

  const persistedRejectedShort = buildOperatorConsoleSnapshot({
    activation: {
      modelName: "order_block_retracement",
      researchSide: "short",
      proposedStopLoss: 23156.25,
      proposedTakeProfit: 23088.5,
      proposedRiskReward: 1.15,
      currentOpportunitySummary: {
        topRejected: { status: "rejected", entry: 23124.75 }
      }
    }
  });
  assert.equal(persistedRejectedShort.researchPlan.entryPrice, 23124.75);
  assert.equal(persistedRejectedShort.researchPlan.entryPriceMethod, "canonical_candidate");
  assert.equal(persistedRejectedShort.researchPlan.status, "no_trade");
  assert.equal(persistedRejectedShort.researchPlan.signal, "NO_TRADE");

  const impliedEntry = buildOperatorConsoleSnapshot({
    activation: {
      modelName: "one_shot_one_kill",
      researchSide: "long",
      proposedCandidateStatus: "rejected",
      proposedStopLoss: 23000,
      proposedTakeProfit: 23150,
      proposedRiskReward: 2
    }
  });
  assert.equal(impliedEntry.researchPlan.entryPrice, 23050);
  assert.equal(impliedEntry.researchPlan.entryPriceMethod, "rr_implied_recovery");
  assert.equal(impliedEntry.researchPlan.setupDirection, "bullish");
  assert.equal(impliedEntry.researchPlan.status, "no_trade");
  assert.equal(impliedEntry.researchPlan.signal, "NO_TRADE");

  const legacyFlatLong = buildOperatorConsoleSnapshot({
    activation: {
      modelName: "one_shot_one_kill",
      researchSide: "flat",
      proposedStopLoss: 23000,
      proposedTakeProfit: 23150,
      proposedRiskReward: 2,
      currentOpportunitySummary: {
        topRejected: { status: "rejected", side: "long" }
      }
    }
  });
  assert.equal(legacyFlatLong.researchPlan.side, "flat");
  assert.equal(legacyFlatLong.researchPlan.setupDirection, "neutral");
  assert.equal(legacyFlatLong.researchPlan.entryPrice, undefined);
  assert.equal(legacyFlatLong.researchPlan.signal, "NO_TRADE");

  const legacyMissingSideShort = buildOperatorConsoleSnapshot({
    activation: {
      modelName: "order_block_retracement",
      proposedStopLoss: 23150,
      proposedTakeProfit: 23000,
      proposedRiskReward: 2
    }
  });
  assert.equal(legacyMissingSideShort.researchPlan.side, "short");
  assert.equal(legacyMissingSideShort.researchPlan.setupDirection, "bearish");
  assert.equal(legacyMissingSideShort.researchPlan.entryPrice, 23100);
  assert.equal(legacyMissingSideShort.researchPlan.signal, "SELL");

  const conflictingBullishPlan = buildOperatorConsoleSnapshot({
    activation: {
      modelName: "direction_conflict",
      researchSide: "long",
      proposedEntryPrice: 23100,
      proposedStopLoss: 23150,
      proposedTakeProfit: 23000,
      proposedRiskReward: 2,
      riskScreeningStatus: "clear"
    }
  });
  assert.equal(conflictingBullishPlan.researchPlan.side, "long");
  assert.equal(conflictingBullishPlan.researchPlan.setupDirection, "neutral");
  assert.equal(conflictingBullishPlan.researchPlan.planCoherence, "incoherent");
  assert.match(conflictingBullishPlan.researchPlan.planCoherenceReason, /Bullish direction conflicts/);
  assert.equal(conflictingBullishPlan.researchPlan.status, "no_trade");
  assert.equal(conflictingBullishPlan.researchPlan.signal, "NO_TRADE");

  const unavailable = buildOperatorConsoleSnapshot({ runtime: runtime({ provider: "mock", candles: 48, fingerprint: "" }) });
  assert.equal(unavailable.source.researchEligible, false);
  assert.equal(unavailable.decisions[0]?.kind, "source_attention");

  const paperReview = buildOperatorConsoleSnapshot({ runtime: runtime({ readiness: "Paper-Demo Candidate" }) });
  assert.ok(paperReview.decisions.some((decision) => decision.kind === "paper_demo_review"));

  for (const item of [active, unavailable, paperReview]) {
    assert.deepEqual(item.authority, {
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none"
    });
    assert.equal(item.autoApplyAllowed, false);
    const serialized = JSON.stringify(item);
    assert.doesNotMatch(serialized, /"candles"\s*:/i);
    assert.doesNotMatch(serialized, /rawCandles|accountNumber|orderId|positionId|password|secret|api[_-]?key/i);
  }

  const scenarioMap = {
    scenarioMapId: "scenario-map-operator-fixture",
    timestamp: "2026-07-12T14:00:00.000Z",
    sourceProvider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "M5",
    sourceFingerprint: "canonical-manager-fingerprint",
    currentSession: "new_york",
    marketPhase: "retracement",
    currentDecisionState: "anticipated_scenario",
    primaryScenario: {},
    invalidationScenario: {},
    missingConfirmations: [],
    nextEvidenceToWatch: [],
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
    safety: { researchOnly: true, rawCandlesExcluded: true, rawSnapshotsExcluded: true, autoApplyAllowed: false, autoPromotionAllowed: false }
  };
  const source = {
    provider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    candleLimit: 1000,
    candleCount: 1000,
    sourceFingerprint: "activated-feed-fingerprint",
    activeForChart: true,
    activeForResearch: true,
    researchEligibilityReasons: [],
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }
  };
  const preparedScenario = prepareOperatorForwardScenario(scenarioMap, source);
  assert.equal(preparedScenario.ok, true);
  assert.equal(preparedScenario.reason, "ready");
  assert.equal(preparedScenario.scenarioMap?.sourceFingerprint, "activated-feed-fingerprint");
  assert.equal(preparedScenario.scenarioMap?.timeframe, "5m");
  assert.equal(prepareOperatorForwardScenario({ ...scenarioMap, brokerSymbol: "US30" }, source).reason, "source_identity_mismatch");
  assert.equal(prepareOperatorForwardScenario({ ...scenarioMap, sourceProvider: "mock" }, source).reason, "unsafe_source_provider");
  assert.doesNotMatch(JSON.stringify(preparedScenario), /"candles"\s*:/i);

  const cycleSource = fs.readFileSync(path.join(sourceRoot, "operatorCycle.ts"), "utf8");
  const researchCycleSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "researchCycle", "runResearchCycle.ts"),
    "utf8"
  );
  const activateMarketSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "ict-strategy-suite", "ictActivateMarketPipeline.ts"),
    "utf8"
  );
  assert.match(cycleSource, /advancedFullResearchMode:\s*false/, "operator cycle must use bounded research mode");
  assert.match(
    cycleSource,
    /runLlmAdvisory:\s*true/,
    "bounded operator cycles should request one advisory review without enabling full autonomous research"
  );
  assert.match(
    cycleSource,
    /OPERATOR_RESEARCH_PROFILE\s*=\s*ifvgShallowRetestV4FrozenProfile\.profileId/,
    "operator cycle must select the frozen shallow-retest IFVG v4 candidate profile"
  );
  assert.match(
    cycleSource,
    /researchStrategyProfile:\s*OPERATOR_RESEARCH_PROFILE/,
    "operator cycle must route its guarded validation through the selected frozen profile"
  );
  assert.match(cycleSource, /maxResearchCandles:\s*1000/, "IFVG v4 operator validation must retain its bounded 1,000-candle window");
  assert.match(
    cycleSource,
    /publishClosedMt5ReadOnlyCandles\(activatedFeed\)/,
    "source activation must publish the latest confirmed closed candle into the forward-evidence bus"
  );
  assert.match(
    cycleSource,
    /recordForwardScenarioPrediction\(preparedScenario\.scenarioMap/,
    "operator cycles must persist their compact research-only forward scenario"
  );
  assert.match(
    cycleSource,
    /modelVersion:\s*"operator_market_scenario:v1"/,
    "operator scenario watches need an explicit non-execution model version"
  );
  assert.match(cycleSource, /OPERATOR_RESEARCH_TIMEOUT_MS\s*=\s*300_000/, "operator cycle must allow deep validation and a bounded advisory request");
  assert.match(cycleSource, /exceeded five minutes/, "operator cycle must retain an explicit outer responsiveness timeout");
  assert.match(
    researchCycleSource,
    /backtestResult\s*=\s*await runDetectorProfileBacktest\(\{[\s\S]*?candles:\s*researchCandles,[\s\S]*?signal,/,
    "the baseline research backtest must run off the browser main thread"
  );
  assert.match(
    activateMarketSource,
    /notify\(callbacks, id, steps\);\s*await new Promise<void>\(\(resolve\) => globalThis\.setTimeout\(resolve, 0\)\);/,
    "activate-market stages must yield before synchronous analysis work"
  );
  assert.match(
    activateMarketSource,
    /runIctAdvisorPacket\(\{\s*snapshot\s*\}\)/,
    "multi-strategy advisor analysis must run off the browser main thread"
  );
  assert.match(cycleSource, /recoverInterruptedState/, "orphaned running state must recover after a reload");
  assert.match(cycleSource, /status:\s*"canceled"/, "interrupted cycles must become terminal");

  const autonomousSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "autonomousResearch", "runAutonomousResearchLoop.ts"),
    "utf8"
  );
  assert.match(
    autonomousSource,
    /frozenProfile\s*\?\s*1000\s*:\s*settings\.advancedFullResearchMode\s*\?\s*undefined\s*:\s*500/,
    "bounded autonomous cycles must use 1,000 candles only for a frozen profile and 500 otherwise"
  );
  assert.match(
    autonomousSource,
    /skipLlmAdvisory:\s*!\(settings\.runLlmAdvisory\s*\|\|\s*settings\.advancedFullResearchMode\)/,
    "LLM advisory must be independently selectable from the full autonomous search mode"
  );
  assert.doesNotMatch(
    researchCycleSource,
    /else if \(!llmAdvisoryRequiredNow\)/,
    "an explicitly requested post-validation advisory must not be deferred behind candidate readiness blockers"
  );

  const validationSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "validation", "runValidationSuite.ts"),
    "utf8"
  );
  assert.match(validationSource, /runValidationSuiteAsync/, "research validation must expose a cooperative runner");
  assert.match(validationSource, /setTimeout\(resolve, 0\)/, "cooperative validation must yield between scenarios");

  const walkForwardResolver = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "walkForward", "walkForwardSourceResolver.ts"),
    "utf8"
  );
  const cachedMt5Position = walkForwardResolver.indexOf("const cachedMt5Feed");
  const importedPosition = walkForwardResolver.indexOf("const importedOrMockSource");
  assert(cachedMt5Position >= 0 && importedPosition > cachedMt5Position, "walk-forward must resolve active MT5 before imported history");
  assert.match(walkForwardResolver, /SOURCE_RESOLUTION_TIMEOUT_MS\s*=\s*8_000/, "walk-forward source resolution must be bounded");

  const operatorViewSource = fs.readFileSync(
    path.join(projectRoot, "src", "components", "operator", "OperatorConsoleView.tsx"),
    "utf8"
  );
  const operatorStoreSource = fs.readFileSync(path.join(sourceRoot, "operatorConsoleStore.ts"), "utf8");
  assert.match(
    operatorViewSource,
    /data-testid="operator-cycle-heartbeat"/,
    "the Overview cycle-status section must expose the live heartbeat"
  );
  assert.match(operatorViewSource, /data-testid="operator-cycle-elapsed"/, "cycle status must expose elapsed time");
  assert.match(operatorViewSource, /window\.setInterval\(\(\) => setClockNow\(Date\.now\(\)\), 1000\)/, "active cycle elapsed time must update every second");
  assert.match(operatorViewSource, /elapsedTime\(snapshot\.cycle\.startedAt, snapshot\.cycle\.completedAt, clockNow\)/, "elapsed time must bind to recorded cycle timestamps");
  assert.match(operatorViewSource, /data-testid="operator-gbrain-memory-summary"/, "operator console must show memory counts");
  assert.match(operatorViewSource, /data-testid="operator-research-risk-preview"/, "operator console must show research levels and risk context");
  assert.match(operatorViewSource, /label: "Entry price", value: price\(snapshot\.researchPlan\.entryPrice\)/, "operator console must show one definite entry price");
  assert.match(operatorViewSource, /snapshot\.researchPlan\.setupDirection/, "operator console must show bullish, bearish, or neutral setup direction");
  assert.match(operatorViewSource, /snapshot\.researchPlan\.signal/, "operator console must show BUY, SELL, or NO TRADE");
  assert.match(operatorViewSource, /snapshot\.researchPlan\.signal === "NO_TRADE" \? "muted" : "success"/, "BUY and SELL signals must use the positive action color");
  assert.match(operatorViewSource, /label: "Stop loss"[\s\S]*?"negative"/, "stop loss must use the negative color");
  assert.match(operatorViewSource, /label: "Take profit"[\s\S]*?"positive"/, "take profit must use the positive color");
  assert.match(operatorViewSource, /label: "Confidence"/, "trade plan must label detector confidence honestly");
  assert.doesNotMatch(operatorViewSource, /label: "Probability"/, "uncalibrated confidence must not be labeled probability");
  assert.match(operatorViewSource, /cycleActive \? "Pending current cycle"/, "running cycles must hide partial confidence");
  assert.match(
    operatorStoreSource,
    /insight:\s*cycleActive \? pendingOperatorInsight\(cycle\)/,
    "cycle-only refreshes must replace intermediate insight with a pending state"
  );
  assert.match(
    operatorStoreSource,
    /researchPlan:\s*cycleActive[\s\S]*?pendingOperatorResearchPlan/,
    "cycle-only refreshes must replace the prior plan with a pending state"
  );
  assert.match(operatorViewSource, /normalized >= 0\.7/, "high confidence must begin at 70 percent");
  assert.match(operatorViewSource, /normalized >= 0\.5/, "medium confidence must begin at 50 percent");
  assert.match(operatorViewSource, /min-h-10 break-words/, "trade-plan values must wrap instead of clipping");
  assert.doesNotMatch(operatorViewSource, /mt-2 truncate font-mono text-base/, "trade-plan values must not truncate");
  assert.doesNotMatch(operatorViewSource, /mt-2 truncate text-lg font-semibold capitalize/, "trade-plan setup names must not truncate");
  assert.match(operatorViewSource, /Informational only/, "research levels must be explicitly non-executable");
  assert.doesNotMatch(operatorViewSource, /Place Order|Buy Market|Sell Market|Enable Live Trading|Connect Live Broker/);
  assert.match(
    operatorViewSource,
    /cycleActive\s*&&\s*"cycle-status-running"/,
    "the Overview cycle-status panel must radiate only while the cycle is active"
  );
  for (const stage of ["activating_source", "building_market_read", "running_research", "finalizing"]) {
    assert.match(
      operatorViewSource,
      new RegExp(`case ["']${stage}["']`),
      `the Overview heartbeat must distinguish the ${stage} stage`
    );
  }

  console.log("GoTrader operator console snapshot test passed.");
  console.log(JSON.stringify({ source: active.source, results: active.results, authority: active.authority }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
