#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, ".gotrader", "internal-agent-evidence-policy-test");
fs.mkdirSync(outDir, { recursive: true });

function compile(sourceRelative, outputName, replacements = []) {
  const sourcePath = path.join(root, sourceRelative);
  const outputPath = path.join(outDir, outputName);
  let output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }
  fs.writeFileSync(outputPath, output, "utf8");
  return outputPath;
}

fs.writeFileSync(
  path.join(outDir, "utils.mjs"),
  "export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));\n",
  "utf8"
);

const policyPath = compile("src/lib/agents/agentEvidencePolicy.ts", "agentEvidencePolicy.mjs");
const cioPath = compile("src/lib/agents/cioSynthesis.ts", "cioSynthesis.mjs", [
  [/@\/lib\/agents\/agentEvidencePolicy/g, "./agentEvidencePolicy.mjs"],
  [/@\/lib\/utils/g, "./utils.mjs"]
]);

const policy = await import(`${pathToFileURL(policyPath).href}?v=${Date.now()}`);
const cio = await import(`${pathToFileURL(cioPath).href}?v=${Date.now()}`);

const candles = Array.from({ length: 100 }, (_, index) => ({
  id: `c${index}`,
  symbol: "MNQ",
  timeframe: "5m",
  timestamp: new Date(Date.UTC(2026, 0, 1, 0, index * 5)).toISOString(),
  open: 100 + index * 0.1,
  high: 101 + index * 0.1,
  low: 99 + index * 0.1,
  close: 100.5 + index * 0.1,
  volume: 100
}));

function context(overrides = {}) {
  return {
    input: { symbol: "MNQ", timeframe: "5m", session: "New York AM", marketRegime: "trend" },
    ictContext: {},
    marketContext: {
      mode: "imported",
      priceVolume: {
        ohlcv: { candles },
        levels: [],
        volumeProfile: { volumeProfileStatus: "planned" }
      },
      macro: { status: "planned" },
      intermarket: { status: "planned" },
      positioning: { status: "planned" },
      orderFlow: { domStatus: "later_advanced", footprintStatus: "later_advanced" }
    },
    regimeClassification: { dataQuality: "sufficient" },
    ...overrides
  };
}

function opinion(agentId, bias = "bullish", weight = 0.2) {
  return {
    agentId,
    name: agentId,
    layer: "strategy",
    bias,
    confidence: 0.9,
    weight,
    reasoning: "candidate reasoning",
    supportingFactors: ["candidate evidence"],
    warningFactors: [],
    recommendation: "candidate recommendation",
    ictTags: []
  };
}

const core = policy.applyInternalAgentEvidencePolicy(opinion("ict-liquidity-agent"), context());
assert.equal(core.synthesisRole, "vote");
assert.equal(core.evidenceStatus, "derived");
assert.equal(core.weight, 0.2);

for (const agentId of [
  "grinch-smt-intermarket-agent",
  "session-levels-agent",
  "auction-volume-profile-agent",
  "macro-event-risk-agent",
  "intermarket-confirmation-agent",
  "positioning-gamma-agent",
  "order-flow-agent"
]) {
  const result = policy.applyInternalAgentEvidencePolicy(opinion(agentId, "bearish", 0.5), context());
  assert.equal(result.synthesisRole, "abstain", `${agentId} should abstain without verified evidence`);
  assert.equal(result.weight, 0, `${agentId} should have zero active weight`);
  assert.equal(result.confidence, 0, `${agentId} should have zero synthesis confidence`);
  assert.deepEqual(result.supportingFactors, [], `${agentId} should not surface placeholder evidence`);
}

const limitedRegime = policy.applyInternalAgentEvidencePolicy(
  opinion("composite-regime-agent", "bullish", 0.2),
  context({ regimeClassification: { dataQuality: "limited" } })
);
assert.equal(limitedRegime.evidenceStatus, "limited");
assert.equal(limitedRegime.weight, 0.1);

const mockCore = policy.applyInternalAgentEvidencePolicy(
  opinion("ict-structure-agent", "bullish", 0.2),
  context({ marketContext: { ...context().marketContext, mode: "mock" } })
);
assert.equal(mockCore.evidenceStatus, "limited");
assert.equal(mockCore.weight, 0.1);

const unavailableBear = policy.applyInternalAgentEvidencePolicy(
  opinion("macro-event-risk-agent", "bearish", 0.8),
  context()
);
const participation = policy.summarizeInternalAgentParticipation([core, unavailableBear]);
assert.equal(participation.activeAgentCount, 1);
assert.equal(participation.abstainingAgentCount, 1);
assert.equal(Number(participation.evidenceCoverage.toFixed(2)), 0.2);

const ictContext = {
  fairValueGaps: [],
  liquiditySweeps: [],
  narrativeSummary: "Canonical candle-derived ICT context.",
  premiumDiscountZone: {
    currentPrice: 100,
    equilibrium: 100,
    rangeHigh: 110,
    rangeLow: 90,
    premium: [100, 110],
    discount: [90, 100],
    currentZone: "equilibrium"
  }
};
const synthesis = cio.synthesizeCIO(context().input, ictContext, [core, unavailableBear]);
assert.equal(synthesis.finalBias, "bullish", "An unavailable bearish opinion must not sway CIO direction");
assert.equal(synthesis.activeAgentCount, 1);
assert.equal(synthesis.abstainingAgentCount, 1);
assert.equal(synthesis.evidenceCoverage, 0.2);
assert.ok(synthesis.confidence <= 0.4161, "CIO confidence must be capped by evidence coverage");

const missingPriceSynthesis = cio.synthesizeCIO(
  context().input,
  { ...ictContext, premiumDiscountZone: { ...ictContext.premiumDiscountZone, currentPrice: 0 } },
  [core]
);
assert.equal(missingPriceSynthesis.finalBias, "neutral", "missing canonical price must fail closed to neutral");
assert.equal(missingPriceSynthesis.confidence, 0.2);
assert.equal(missingPriceSynthesis.pricePlan, undefined);
assert.equal(missingPriceSynthesis.entryZone, undefined);
assert.equal(missingPriceSynthesis.invalidationLevel, undefined);
assert.equal(missingPriceSynthesis.targetLiquidity, undefined);
assert.match(missingPriceSynthesis.riskNotes, /price levels are unavailable/i);

const serialized = JSON.stringify({ core, unavailableBear, participation, synthesis });
assert.doesNotMatch(serialized, /"(?:rawCandles|candles|account|orders|positions|secrets)"\s*:/i);
assert.equal("executionAuthority" in synthesis, false);
assert.equal("brokerAuthority" in synthesis, false);
assert.equal("readinessOverrideAuthority" in synthesis, false);

const auditSource = fs.readFileSync(path.join(root, "src/lib/agentAudit/auditAgentDecision.ts"), "utf8");
assert.doesNotMatch(auditSource, /uses mock ICT facts only/i);
assert.match(auditSource, /Abstain when required evidence is unavailable/);
const simulationSource = fs.readFileSync(path.join(root, "src/lib/simulation/index.ts"), "utf8");
const researchUiSource = fs.readFileSync(path.join(root, "src/components/research/ResearchWorkbench.tsx"), "utf8");
const marketContextSource = fs.readFileSync(path.join(root, "src/lib/marketData/mockMarketContext.ts"), "utf8");
const regimeSource = fs.readFileSync(path.join(root, "src/lib/regime/compositeRegimeClassifier.ts"), "utf8");
assert.doesNotMatch(simulationSource, /Generated local simulated outcome for research scoring/);
assert.doesNotMatch(researchUiSource, /Score simulated outcome/);
assert.match(researchUiSource, /Open Replay Validation/);
assert.match(marketContextSource, /economicCalendar: imported \? \[\]/);
assert.match(marketContextSource, /volumeProfileStatus: "planned"/);
assert.match(regimeSource, /macroStatus === "available_mock"/);

console.log(JSON.stringify({
  status: "passed",
  activeAgentCount: synthesis.activeAgentCount,
  abstainingAgentCount: synthesis.abstainingAgentCount,
  evidenceCoverage: synthesis.evidenceCoverage,
  confidence: synthesis.confidence,
  unavailableDirectionalVoteIgnored: true,
  circularSelfScoringRemoved: true,
  syntheticExternalContextExcludedFromRealCandles: true,
  rawCandlesSerialized: false,
  authority: {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  }
}, null, 2));
