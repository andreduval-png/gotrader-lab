#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, "src", "lib", "readiness", "strategyProfileEvidence.ts");
const outRoot = path.join(projectRoot, ".gotrader", "paper-demo-strategy-evidence-test");
const outputPath = path.join(outRoot, "strategyProfileEvidence.mjs");

fs.mkdirSync(outRoot, { recursive: true });
const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    verbatimModuleSyntax: false
  },
  fileName: sourcePath
}).outputText;
fs.writeFileSync(outputPath, output, "utf8");

const {
  resolveProfileTradeSample,
  resolveStrategyProfileEvidence,
  strategyFamilyForProfile
} = await import(`${pathToFileURL(outputPath).href}?t=${Date.now()}`);

assert.equal(strategyFamilyForProfile("ifvg_fresh_retest_v4_candidate"), "ifvg");
assert.equal(strategyFamilyForProfile("cmd_high_displacement_v2_research"), "cmd");
assert.equal(strategyFamilyForProfile("agent_consensus"), "agent_consensus");

const v4Evidence = {
  completedTrades: 68,
  oosTrades: 21,
  passedOosWindows: 2,
  totalOosWindows: 2,
  monteCarloRobustness: "strong"
};

const exactV4 = resolveStrategyProfileEvidence({
  strategyProfile: "ifvg_fresh_retest_v4_candidate",
  currentCycleTrades: 3,
  validationMatched: true,
  frozenEvidence: v4Evidence,
  frozenSourceMatches: true,
  grinchProfilePresent: false,
  grinchBlocked: true,
  grinchBlocker: "opening_price_alignment_weak"
});
assert.equal(exactV4.status, "pass");
assert.match(exactV4.label, /IFVG detector/);
assert.doesNotMatch(exactV4.blockerReason, /Grinch/);

const wrongSourceV4 = resolveStrategyProfileEvidence({
  strategyProfile: "ifvg_fresh_retest_v4_candidate",
  currentCycleTrades: 3,
  validationMatched: false,
  frozenEvidence: v4Evidence,
  frozenSourceMatches: false,
  grinchProfilePresent: true,
  grinchBlocked: false
});
assert.equal(wrongSourceV4.status, "warning");
assert.match(wrongSourceV4.blockerReason, /does not match/);

const v4Sample = resolveProfileTradeSample({
  currentCycleTrades: 3,
  frozenEvidenceTrades: 68,
  frozenSourceMatches: true
});
assert.equal(v4Sample.count, 68);
assert.equal(v4Sample.source, "exact_profile_historical_validation");

const mismatchedSample = resolveProfileTradeSample({
  currentCycleTrades: 3,
  frozenEvidenceTrades: 172,
  frozenSourceMatches: false
});
assert.equal(mismatchedSample.count, 3);
assert.equal(mismatchedSample.source, "latest_cycle");

const cmd = resolveStrategyProfileEvidence({
  strategyProfile: "cmd_high_displacement_v2_research",
  currentCycleTrades: 55,
  validationMatched: true,
  frozenSourceMatches: false,
  grinchProfilePresent: false,
  grinchBlocked: false
});
assert.equal(cmd.status, "warning");
assert.match(cmd.blockerReason, /independent-date/);

const grinch = resolveStrategyProfileEvidence({
  strategyProfile: "agent_consensus",
  currentCycleTrades: 40,
  validationMatched: true,
  frozenSourceMatches: false,
  grinchProfilePresent: true,
  grinchBlocked: true,
  grinchBlocker: "opening_price_alignment_weak"
});
assert.equal(grinch.status, "warning");
assert.match(grinch.currentValue, /opening_price_alignment_weak/);

const runtimeSource = fs.readFileSync(
  path.join(projectRoot, "src", "lib", "runtime", "resolveResearchRuntimeSnapshot.ts"),
  "utf8"
);
assert.match(runtimeSource, /validation:\s*matchingReadinessValidation/);
assert.match(runtimeSource, /latestRun:\s*matchingWalkForward/);
assert.match(runtimeSource, /researchIdentity:\s*\{/);
assert.match(runtimeSource, /RUNTIME_SOURCE_HYDRATION_TIMEOUT_MS\s*=\s*4_000/);
assert.match(runtimeSource, /withRuntimeSourceTimeout/);
assert.match(runtimeSource, /latestCycle\?\.validationReport/);
assert.match(runtimeSource, /validationCandidates\.find/);
assert.match(runtimeSource, /review\.sourceValidationId === matchingReadinessValidation\.id/);
assert.match(runtimeSource, /quality:\s*matchingResearchQuality/);
assert.match(runtimeSource, /does not match the active research identity/);
assert.match(runtimeSource, /latestCycle\?\.researchQualitySummary &&/);

const checklistSource = fs.readFileSync(
  path.join(projectRoot, "src", "lib", "readiness", "buildPaperDemoChecklist.ts"),
  "utf8"
);
assert.match(checklistSource, /frozenProfileSourceMatches/);
assert.match(checklistSource, /resolveStrategyProfileEvidence/);
assert.match(checklistSource, /evidenceSummary\?\.minimumWindows \?\? 3/);
assert.match(checklistSource, /verdict === "robust_research"/);
assert.doesNotMatch(checklistSource, /windowsTested >= 3 && passRate/);
assert.doesNotMatch(checklistSource, /Math\.max\([^)]*v3/i);

const frozenRegistrySource = fs.readFileSync(
  path.join(projectRoot, "src", "lib", "forwardEvidence", "frozenProfileRegistry.ts"),
  "utf8"
);
assert.match(frozenRegistrySource, /applyFrozenResearchProfileConfig/);
assert.match(frozenRegistrySource, /sessionFilter:\s*"all"/);

const backtestLabSource = fs.readFileSync(
  path.join(projectRoot, "src", "components", "backtest-lab", "BacktestLab.tsx"),
  "utf8"
);
assert.match(backtestLabSource, /backtest-strategy-profile/);
assert.match(backtestLabSource, /IFVG v4 shallow retest \(frozen candidate\)/);
assert.match(backtestLabSource, /Selecting the profile does not promote readiness or permit execution/);

const labStorageSource = fs.readFileSync(
  path.join(projectRoot, "src", "lib", "storage", "index.ts"),
  "utf8"
);
assert.match(labStorageSource, /compactLabStateForStorage/);
assert.match(labStorageSource, /Lab state storage write skipped after safe pruning/);

const researchCycleSource = fs.readFileSync(
  path.join(projectRoot, "src", "lib", "researchCycle", "runResearchCycle.ts"),
  "utf8"
);
assert.match(researchCycleSource, /compactResearchCycleRun\(run,\s*"aggressive"\)/);
assert.match(researchCycleSource, /autoResearchCheckpoint:\s*undefined/);
assert.match(researchCycleSource, /latestGeneratedProposal:\s*mode === "aggressive" \? undefined/);

console.log("GoTrader paper-demo strategy evidence test passed.");
console.log(JSON.stringify({
  v4ProfileGate: exactV4.status,
  latestCycleTrades: v4Sample.currentCycleTrades,
  exactProfileHistoricalTrades: v4Sample.frozenTrades,
  wrongProfileBorrowedTrades: mismatchedSample.frozenTrades,
  cmdGate: cmd.status,
  authority: {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  }
}, null, 2));
