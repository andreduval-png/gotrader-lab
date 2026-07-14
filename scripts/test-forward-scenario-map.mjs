#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "forward-scenario-map-test");

const compile = (sourceRelative, outputName, replacements = []) => {
  const sourcePath = path.join(root, sourceRelative);
  const outputPath = path.join(outRoot, outputName);
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
  fs.writeFileSync(outputPath, replacements.reduce((value, [from, to]) => value.replaceAll(from, to), output), "utf8");
};

const base = {
  timestamp: "2026-07-14T14:30:00.000Z",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "mt5-forward-scenario-fixture",
  direction: "bearish",
  liquidityDraw: "London high",
  liquidityDrawDirection: "bullish",
  londonRange: { high: 23_120, low: 23_020 },
  twelveAmOpen: 23_060,
  conditionalEntryZone: { lower: 23_100, upper: 23_110 },
  conditionalStopReference: 23_125,
  conditionalTargets: [{ label: "external sell-side liquidity", price: 23_020 }]
};

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/forwardScenario/forwardScenarioTypes.ts", "forwardScenarioTypes.mjs");
  compile(
    "src/lib/forwardScenario/buildForwardScenarioMap.ts",
    "buildForwardScenarioMap.mjs",
    [["./forwardScenarioTypes", "./forwardScenarioTypes.mjs"]]
  );
  const module = await import(pathToFileURL(path.join(outRoot, "buildForwardScenarioMap.mjs")).href);

  const unresolvedPool = module.buildForwardScenarioMap({ ...base, liquiditySwept: false });
  assert.equal(unresolvedPool.primaryScenario.scenarioFamily, "post_london_liquidity_sweep_reversal");
  assert.equal(unresolvedPool.currentDecisionState, "anticipated_scenario");
  assert.match(unresolvedPool.primaryScenario.requiredConfirmations.join(" "), /sweep/i);

  const swept = module.buildForwardScenarioMap({ ...base, liquiditySwept: true, mitigationDetected: false });
  assert.equal(swept.primaryScenario.scenarioFamily, "ny_am_mitigation_reversal");
  assert.equal(swept.currentDecisionState, "developing_setup");
  assert.match(swept.primaryScenario.requiredConfirmations.join(" "), /source zone|order block|IFVG/i);

  const mitigated = module.buildForwardScenarioMap({
    ...base,
    liquiditySwept: true,
    mitigationDetected: true,
    displacementConfirmed: false
  });
  assert.equal(mitigated.currentDecisionState, "developing_setup");
  assert.match(mitigated.primaryScenario.requiredConfirmations.join(" "), /displacement/i);

  const ifvg = module.buildForwardScenarioMap({
    ...base,
    liquiditySwept: true,
    mitigationDetected: true,
    displacementConfirmed: true,
    ifvgFreshRetestState: "partial",
    ifvgDirection: "bearish",
    ifvgZone: { lower: 23_100, upper: 23_110 },
    ifvgProfileStrength: "frozen_validated"
  });
  assert.equal(ifvg.primaryScenario.scenarioFamily, "ifvg_fresh_retest_continuation");
  assert.equal(ifvg.recommendedResearchTest.candidateFamily, "ifvg_fresh_retest_v3_research");
  assert.equal(ifvg.recommendedResearchTest.mutateFrozenProfile, false);
  assert.equal(ifvg.recommendedResearchTest.suggestedProfileFork, "ifvg_fresh_retest_v4_candidate");

  const noDraw = module.buildForwardScenarioMap({
    ...base,
    liquidityDraw: undefined,
    londonRange: undefined,
    twelveAmOpen: undefined,
    conditionalTargets: undefined,
    conditionalEntryZone: undefined,
    conditionalStopReference: undefined,
    missingConfirmations: ["No clean liquidity draw is resolved."]
  });
  assert.equal(noDraw.primaryScenario.scenarioFamily, "no_trade_waiting_for_liquidity");
  assert.equal(noDraw.currentDecisionState, "no_trade");

  const confirmed = module.buildForwardScenarioMap({
    ...base,
    confirmedSetup: true,
    liquiditySwept: true,
    mitigationDetected: true,
    displacementConfirmed: true,
    ifvgFreshRetestState: "confirmed",
    ifvgDirection: "bearish",
    ifvgZone: { lower: 23_100, upper: 23_110 },
    ifvgProfileStrength: "frozen_validated",
    missingConfirmations: []
  });
  assert.equal(confirmed.currentDecisionState, "confirmed_setup");
  assert.match(confirmed.primaryScenario.safetyNotice, /Paper-demo\/live execution still blocked/i);

  const mock = module.buildForwardScenarioMap({ ...base, sourceProvider: "mock_sample" });
  assert.equal(mock.currentDecisionState, "no_trade");
  assert.match(mock.missingConfirmations.join(" "), /non-mock/i);

  for (const map of [unresolvedPool, swept, mitigated, ifvg, noDraw, confirmed, mock]) {
    const safety = module.assertForwardScenarioMapIsSafe(map);
    assert.equal(safety.ok, true);
    assert.equal(map.authority.executionAuthority, "none");
    assert.equal(map.authority.brokerAuthority, "none");
    assert.equal(map.authority.readinessOverrideAuthority, "none");
    assert.equal(map.safety.autoApplyAllowed, false);
    assert.equal(map.safety.autoPromotionAllowed, false);
    assert.doesNotMatch(JSON.stringify(map), /"(?:candles|rawCandles|rawSnapshot|account|orders|positions)"\s*:/i);
  }

  const autoResearchSource = fs.readFileSync(path.join(root, "src/lib/autoResearch/runAutoResearchCycle.ts"), "utf8");
  assert.match(autoResearchSource, /prioritizeAutoResearchCandidatesByForwardScenario/);
  assert.match(autoResearchSource, /options\.forwardScenarioMap/);
  assert.doesNotMatch(autoResearchSource, /autoPromotionAllowed\s*:\s*true/);

  const uiSource = fs.readFileSync(path.join(root, "src/components/common/ForwardScenarioMapCard.tsx"), "utf8");
  assert.match(uiSource, /primary\.safetyNotice/);
  assert.match(uiSource, /data-testid="forward-scenario-map"/);
  assert.match(uiSource, /authority none \/ none \/ none/);

  console.log(JSON.stringify({
    status: "passed",
    scenariosCovered: 7,
    primaryIfvgFamily: ifvg.primaryScenario.scenarioFamily,
    confirmedDecisionState: confirmed.currentDecisionState,
    authority: confirmed.authority,
    autoApplyAllowed: confirmed.safety.autoApplyAllowed,
    autoPromotionAllowed: confirmed.safety.autoPromotionAllowed
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
