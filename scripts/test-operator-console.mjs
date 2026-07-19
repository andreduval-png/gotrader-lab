#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "operatorConsole");
const outRoot = path.join(projectRoot, ".gotrader", "operator-console-test");
const sourceFiles = ["operatorConsoleTypes.ts", "buildOperatorConsoleSnapshot.ts", "operatorForwardScenario.ts"];

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

  const active = buildOperatorConsoleSnapshot({
    runtime: runtime(),
    activation: {
      modelName: "ifvg_v1",
      modelLane: "watchlist",
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      primaryTimeframe: "5m",
      nextAction: "Run independent-date validation."
    },
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
  assert.match(cycleSource, /advancedFullResearchMode:\s*false/, "operator cycle must use bounded research mode");
  assert.match(
    cycleSource,
    /runLlmAdvisory:\s*true/,
    "bounded operator cycles should request one advisory review without enabling full autonomous research"
  );
  assert.match(
    cycleSource,
    /researchStrategyProfile:\s*"ifvg_fresh_retest_v3_research"/,
    "operator cycle must evaluate the frozen positive-edge IFVG v3 research profile"
  );
  assert.match(cycleSource, /maxResearchCandles:\s*1000/, "IFVG v3 operator validation must retain its bounded 1,000-candle window");
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
  const researchCycleSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "researchCycle", "runResearchCycle.ts"),
    "utf8"
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
  assert.match(
    operatorViewSource,
    /data-testid="operator-cycle-heartbeat"/,
    "the Overview cycle-status section must expose the live heartbeat"
  );
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
