#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "operatorConsole");
const outRoot = path.join(projectRoot, ".gotrader", "operator-console-test");
const sourceFiles = ["operatorConsoleTypes.ts", "buildOperatorConsoleSnapshot.ts"];

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

  const cycleSource = fs.readFileSync(path.join(sourceRoot, "operatorCycle.ts"), "utf8");
  assert.match(cycleSource, /advancedFullResearchMode:\s*false/, "operator cycle must use bounded research mode");
  assert.match(cycleSource, /OPERATOR_RESEARCH_TIMEOUT_MS\s*=\s*120_000/, "operator cycle must have a responsiveness timeout");
  assert.match(cycleSource, /recoverInterruptedState/, "orphaned running state must recover after a reload");
  assert.match(cycleSource, /status:\s*"canceled"/, "interrupted cycles must become terminal");

  const autonomousSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "autonomousResearch", "runAutonomousResearchLoop.ts"),
    "utf8"
  );
  assert.match(
    autonomousSource,
    /maxResearchCandles:\s*settings\.advancedFullResearchMode\s*\?\s*undefined\s*:\s*500/,
    "bounded autonomous cycles must cap their working candle window"
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

  console.log("GoTrader operator console snapshot test passed.");
  console.log(JSON.stringify({ source: active.source, results: active.results, authority: active.authority }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
