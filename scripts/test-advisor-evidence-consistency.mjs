#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const libRoot = path.join(root, "src", "lib");
const outRoot = path.join(root, ".gotrader", "advisor-evidence-consistency-test");
const sourceFiles = [
  "validationProvenance/validationProvenanceTypes.ts",
  "validationProvenance/validationProvenance.ts",
  "validationProvenance/index.ts",
  "validationChain/validationChainTypes.ts",
  "validationChain/buildValidationChain.ts",
  "validationChain/advisorValidationChainContext.ts",
  "readiness/readinessCalibration.ts"
];

const rewriteImports = (source) =>
  source
    .replace(/from\s+"@\/lib\/validationProvenance"/g, 'from "../validationProvenance/index.mjs"')
    .replace(/from\s+'@\/lib\/validationProvenance'/g, "from '../validationProvenance/index.mjs'")
    .replace(/from\s+"\.\.\/validationProvenance"/g, 'from "../validationProvenance/index.mjs"')
    .replace(/from\s+'\.\.\/validationProvenance'/g, "from '../validationProvenance/index.mjs'")
    .replace(/from\s+"\.\/([^".]+)"/g, 'from "./$1.mjs"')
    .replace(/from\s+'\.\/([^'.]+)'/g, "from './$1.mjs'");

fs.rmSync(outRoot, { recursive: true, force: true });
for (const file of sourceFiles) {
  const sourcePath = path.join(libRoot, file);
  const outputPath = path.join(outRoot, file.replace(/\.ts$/, ".mjs"));
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
  fs.writeFileSync(outputPath, rewriteImports(output), "utf8");
}

const {
  resolveAdvisorValidationChainContext,
  validateAdvisorValidationChainInvariant
} = await import(
  pathToFileURL(path.join(outRoot, "validationChain", "advisorValidationChainContext.mjs")).href
);
const { summarizeReadinessCalibration } = await import(
  pathToFileURL(path.join(outRoot, "readiness", "readinessCalibration.mjs")).href
);

const provenance = {
  strategyProfile: "ifvg_fresh_retest_v4_candidate",
  strategyProfileVersion: "v4",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "mt5_read_only|certified_current_series",
  parameterFingerprint: "params_v4",
  validationRunId: "validation_current"
};
const entry = {
  researchOnly: true,
  sourceCycleId: "cycle_current",
  recognitionId: "candidate_current",
  recognitionType: "full_model",
  setupLabel: "IFVG Fresh Retest",
  candidateFamily: "ifvg",
  requiredValidation: "replay_then_walk_forward",
  symbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  htfContext: ["M15", "H1"],
  sourceFingerprint: provenance.sourceFingerprint,
  provenance,
  provenanceStatus: "matched",
  provenanceBlockers: [],
  sourceStatus: {
    sourceProvider: "mt5_read_only",
    isMockOrSample: false,
    isResearchActive: true,
    statusLabel: "research_active"
  },
  hypothesisStatus: "walk_forward_passed",
  replayResult: {
    generatedAt: "2026-08-14T19:00:00.000Z",
    verdict: "passed",
    reason: "Replay passed.",
    provenance
  },
  walkForwardResult: {
    generatedAt: "2026-08-14T19:05:00.000Z",
    verdict: "passed",
    warningFlags: [],
    reason: "Walk-forward passed.",
    provenance: { ...provenance, walkForwardRunId: "wf_current" }
  },
  paperDemoChecklistImpact: "Still gated.",
  nextAction: "Continue evidence review.",
  blockers: [],
  createdAt: "2026-08-14T19:00:00.000Z",
  updatedAt: "2026-08-14T19:05:00.000Z",
  executionIntent: "none",
  authority: {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  },
  safety: {
    rawCandlesExcluded: true,
    rawSnapshotsExcluded: true,
    accountDataExcluded: true,
    orderDataExcluded: true,
    positionDataExcluded: true,
    secretsExcluded: true
  }
};

const current = resolveAdvisorValidationChainContext({
  entry,
  current: {
    cycleId: "cycle_current",
    validationId: "validation_current",
    provenance
  }
});
assert.equal(current.evidenceRelationship, "current_cycle");
assert.equal(current.identityMatched, true);
assert.equal(current.replayVerdict, "passed");
assert.equal(current.walkForwardVerdict, "passed");
assert.equal(current.historicalReplayVerdict, undefined);
assert.equal(validateAdvisorValidationChainInvariant(current).ok, true);

const anotherCycle = resolveAdvisorValidationChainContext({
  entry,
  current: {
    cycleId: "cycle_new",
    validationId: "validation_new",
    provenance: { ...provenance, validationRunId: "validation_new" }
  }
});
assert.equal(anotherCycle.evidenceRelationship, "historical_evidence");
assert.equal(anotherCycle.identityMatched, false);
assert.equal(anotherCycle.replayVerdict, undefined);
assert.equal(anotherCycle.walkForwardVerdict, undefined);
assert.equal(anotherCycle.historicalReplayVerdict, "passed");
assert.equal(anotherCycle.historicalWalkForwardVerdict, "passed");
assert.match(anotherCycle.evidenceRelationshipLabel, /Historical evidence/i);

const missingValidation = resolveAdvisorValidationChainContext({
  entry,
  current: { cycleId: "cycle_without_validation" }
});
assert.equal(missingValidation.currentValidationAvailable, false);
assert.equal(missingValidation.evidenceRelationship, "historical_evidence");
assert.equal(missingValidation.replayVerdict, undefined);
assert.equal(missingValidation.walkForwardVerdict, undefined);
assert.match(missingValidation.nextAction, /no identity-matched validation suite/i);

const contradictory = {
  ...missingValidation,
  replayVerdict: "passed"
};
const contradictionReview = validateAdvisorValidationChainInvariant(contradictory);
assert.equal(contradictionReview.ok, false);
assert.match(contradictionReview.violations.join(" "), /passed validation-chain verdict requires current validation/i);

const unavailableCalibration = summarizeReadinessCalibration(undefined);
assert.equal(unavailableCalibration.available, false);
assert.equal(unavailableCalibration.displayValue, "unavailable");
assert.doesNotMatch(unavailableCalibration.detail, /0%/);

const measuredCalibration = summarizeReadinessCalibration({
  scenarios: [
    { id: "baseline", confidenceCalibration: { score: 0.61 } },
    { id: "conservative-confluence", confidenceCalibration: { score: 0.57 } }
  ]
});
assert.equal(measuredCalibration.available, true);
assert.equal(measuredCalibration.average, 0.59);
assert.equal(measuredCalibration.conservative, 0.57);

const advisorChatSource = fs.readFileSync(path.join(libRoot, "llm", "advisorChat.ts"), "utf8");
assert.doesNotMatch(advisorChatSource, /latestValidationChainEntry/);
assert.match(advisorChatSource, /context\.packet\?\.validationChain/);
assert.match(advisorChatSource, /validateAdvisorValidationChainInvariant\(chain\)/);

console.log("Advisor evidence-consistency tests passed.");
console.log(JSON.stringify({
  currentRelationship: current.evidenceRelationship,
  historicalRelationship: anotherCycle.evidenceRelationship,
  missingValidationReplay: missingValidation.replayVerdict ?? "unavailable",
  calibrationWithoutValidation: unavailableCalibration.displayValue,
  measuredCalibration: measuredCalibration.displayValue,
  authority: current.authority
}, null, 2));
