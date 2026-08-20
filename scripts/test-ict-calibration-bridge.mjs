#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "ict-calibration-bridge-test");
fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });

const sourcePath = path.join(root, "src", "lib", "ict-strategy-suite", "ictCalibrationBridge.ts");
const transpiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    verbatimModuleSyntax: false
  },
  fileName: sourcePath
}).outputText
  .replaceAll('"@/lib/validation"', '"./validation.mjs"')
  .replaceAll('"@/lib/validationProvenance"', '"./validationProvenance.mjs"')
  .replaceAll('"@/lib/selfImprovement/approveCalibrationProposal"', '"./selfImprovement.mjs"')
  .replaceAll('"@/lib/selfImprovement/evaluateCalibrationProposal"', '"./selfImprovement.mjs"');
fs.writeFileSync(path.join(outRoot, "ictCalibrationBridge.mjs"), transpiled, "utf8");

fs.writeFileSync(path.join(outRoot, "validation.mjs"), `
let report = {
  provenance: { sourceFingerprint: "source_exact" },
  calibration: { readinessStatus: "yellow", readinessScore: 72 }
};
export const loadLatestValidationReport = () => report;
export const setValidationReport = (next) => { report = next; };
`, "utf8");
fs.writeFileSync(path.join(outRoot, "validationProvenance.mjs"), `
export const fingerprintValidationParameters = (value) => "fp_" + JSON.stringify(value).length;
`, "utf8");
fs.writeFileSync(path.join(outRoot, "selfImprovement.mjs"), `
export const proposals = [];
export const resolveActiveBacktestConfig = () => ({ config: { strategyProfile: "baseline", minimumConfluenceThreshold: 0.7 } });
export const summarizeValidationMetrics = () => ({
  totalTrades: 12, winRate: 0.5, averageR: 0.7, maxDrawdown: 2,
  profitFactor: 1.4, skippedSignals: 3, falsePositiveCount: 0,
  confidenceCalibration: 0.8, readinessScore: 72, readinessStatus: "yellow",
  stabilityScore: 68, conservativeScenarioStable: false
});
export const upsertCalibrationProposal = (proposal) => {
  const index = proposals.findIndex((item) => item.proposalId === proposal.proposalId);
  if (index >= 0) proposals[index] = proposal; else proposals.push(proposal);
  return { proposals };
};
`, "utf8");

const bridge = await import(pathToFileURL(path.join(outRoot, "ictCalibrationBridge.mjs")).href);
const selfImprovement = await import(pathToFileURL(path.join(outRoot, "selfImprovement.mjs")).href);
const validationStore = await import(pathToFileURL(path.join(outRoot, "validation.mjs")).href);

const hypothesis = {
  researchOnly: true,
  hypothesisId: "ict_hypothesis_exact",
  generatedAt: "2026-08-17T18:00:00.000Z",
  status: "replay_tested",
  title: "Displacement-confirmed liquidity reclaim",
  sourceOpportunity: {
    opportunityId: "opportunity_1",
    type: "liquidity_reclaim",
    stage: "confirmed",
    quality: "high",
    direction: "bullish",
    modelName: "liquidity_reclaim_scalp",
    modelFamily: "ICT",
    marketCycleStage: "distribution",
    laneRecommendation: "watchlist_candidate",
    nextAction: "Validate the exact candidate."
  },
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  primaryTimeframe: "5m",
  sourceFingerprint: "source_exact",
  candleCount: 12000,
  missingConfirmation: [],
  proposedValidationRules: ["Require displacement."],
  blockers: [],
  nextAction: "Run bounded candidate research.",
  autoPromoteAllowed: false,
  executionAllowed: false,
  authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
  safety: {
    rawCandlesExcluded: true, rawSnapshotsExcluded: true, accountDataExcluded: true,
    orderDataExcluded: true, positionDataExcluded: true, secretsExcluded: true
  }
};
const validation = {
  researchOnly: true,
  hypothesisId: hypothesis.hypothesisId,
  generatedAt: "2026-08-17T18:05:00.000Z",
  source: "manual_review",
  status: "promising",
  testedWindows: 12,
  totalOccurrences: 24,
  usableOutcomes: 20,
  targetFirstRate: 0.6,
  invalidationFirstRate: 0.25,
  averageRr: 1.2,
  classificationReason: "Replay evidence is promising.",
  recommendation: "Create a bounded candidate.",
  evidence: ["20 usable outcomes"],
  blockers: [],
  nextResearchAction: "Run bounded candidate research.",
  autoPromoteAllowed: false,
  executionAllowed: false,
  approvedProfileMutated: false,
  authority: hypothesis.authority,
  safety: hypothesis.safety
};

const weak = bridge.bridgeValidatedIctHypothesisToCalibration(hypothesis, { ...validation, status: "weak" });
assert.equal(weak.status, "not_eligible");
assert.equal(selfImprovement.proposals.length, 0);

validationStore.setValidationReport({ provenance: { sourceFingerprint: "different_source" } });
const mismatch = bridge.bridgeValidatedIctHypothesisToCalibration(hypothesis, validation);
assert.equal(mismatch.status, "identity_mismatch");
assert.equal(selfImprovement.proposals.length, 0);

validationStore.setValidationReport({ provenance: {} });
const missingFingerprint = bridge.bridgeValidatedIctHypothesisToCalibration(hypothesis, validation);
assert.equal(missingFingerprint.status, "identity_mismatch");
assert.equal(selfImprovement.proposals.length, 0);

validationStore.setValidationReport({ provenance: { sourceFingerprint: "source_exact" } });
const created = bridge.bridgeValidatedIctHypothesisToCalibration(hypothesis, validation);
assert.equal(created.status, "created");
assert.equal(created.proposal.proposalIntent, "ict_hypothesis_calibration_intent");
assert.deepEqual(created.proposal.proposedChanges, {});
assert.equal(created.proposal.approvalRequired, true);
assert.equal(created.proposal.autoApplyStatus, "blocked");
assert.equal(created.proposal.executionAuthority, "none");
assert.equal(created.proposal.proposalIntentDetails.sourceFingerprint, "source_exact");
assert.equal(selfImprovement.proposals.length, 1);

const duplicate = bridge.bridgeValidatedIctHypothesisToCalibration(hypothesis, validation);
assert.equal(duplicate.proposal.proposalId, created.proposal.proposalId);
assert.equal(selfImprovement.proposals.length, 1, "identity-equivalent intent must upsert instead of duplicate");
assert.doesNotMatch(JSON.stringify(created.proposal), /"(?:candles|orders|positions|accountData|secret|apiKey)"\s*:/i);

console.log(JSON.stringify({
  status: "passed",
  proposalId: created.proposal.proposalId,
  weakStatus: weak.status,
  mismatchStatus: mismatch.status,
  missingFingerprintStatus: missingFingerprint.status,
  authority: created.proposal.executionAuthority
}, null, 2));
