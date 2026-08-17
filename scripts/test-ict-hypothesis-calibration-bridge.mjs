#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "ict-hypothesis-calibration-bridge-test");

const report = {
  id: "validation_bridge",
  generatedAt: "2026-08-17T15:00:00.000Z",
  provenance: { strategyProfile: "ifvg_fresh_retest_v3_research", strategyProfileVersion: "v3", sourceProvider: "mt5_read_only", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m", sourceFingerprint: "source_exact", parameterFingerprint: "params_exact" },
  scenarios: [],
  calibration: { readinessScore: 60, readinessStatus: "yellow" }
};
const baselineConfig = { strategyProfile: "ifvg_fresh_retest_v3_research", symbol: "MNQ", timeframe: "5m", marketRegime: "range" };
const beforeMetrics = { totalTrades: 10, winRate: 0.5, averageR: 0.2, maxDrawdown: 2, profitFactor: 1.1, skippedSignals: 1, falsePositiveCount: 2, confidenceCalibration: 0.6, readinessScore: 60, readinessStatus: "yellow", stabilityScore: 55, conservativeScenarioStable: false, provenance: report.provenance };
const proposals = [];

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });
  const sourcePath = path.join(root, "src/lib/selfImprovement/ictHypothesisCalibrationBridge.ts");
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove },
    fileName: sourcePath
  }).outputText
    .replaceAll('"@/lib/selfImprovement/approveCalibrationProposal"', '"./approve.mjs"')
    .replaceAll('"@/lib/selfImprovement/evaluateCalibrationProposal"', '"./evaluate.mjs"')
    .replaceAll('"@/lib/validation"', '"./validation.mjs"')
    .replaceAll('"@/lib/validationProvenance"', '"./provenance.mjs"');
  fs.writeFileSync(path.join(outRoot, "bridge.mjs"), output);
  fs.writeFileSync(path.join(outRoot, "approve.mjs"), `export const resolveActiveBacktestConfig = () => ({ config: globalThis.__baselineConfig }); export const loadSelfImprovementState = () => ({ proposals: globalThis.__proposals }); export const upsertCalibrationProposal = (proposal) => { globalThis.__proposals.push(proposal); };`);
  fs.writeFileSync(path.join(outRoot, "evaluate.mjs"), `export const summarizeValidationMetrics = () => globalThis.__beforeMetrics;`);
  fs.writeFileSync(path.join(outRoot, "validation.mjs"), `export const loadLatestValidationReport = () => globalThis.__report;`);
  fs.writeFileSync(path.join(outRoot, "provenance.mjs"), `export const matchValidationProvenance = (expected, actual) => { const fields = ["strategyProfile","sourceProvider","requestedSymbol","brokerSymbol","timeframe","sourceFingerprint","parameterFingerprint"]; const mismatchedFields = fields.filter((field) => !expected[field] || !actual[field] || expected[field] !== actual[field]); return { matched: mismatchedFields.length === 0, blockers: mismatchedFields.length ? ["source_fingerprint_mismatch"] : [], missingFields: [], mismatchedFields }; };`);
  globalThis.__baselineConfig = baselineConfig;
  globalThis.__beforeMetrics = beforeMetrics;
  globalThis.__proposals = proposals;
  globalThis.__report = report;
  const bridge = await import(pathToFileURL(path.join(outRoot, "bridge.mjs")).href);
  const hypothesis = { researchOnly: true, hypothesisId: "hypothesis_exact", generatedAt: "2026-08-17T15:01:00.000Z", status: "queued_for_replay", title: "liquidity reclaim hypothesis", sourceOpportunity: { opportunityId: "opportunity_1", type: "unknown_structured_opportunity", stage: "forming", quality: "medium", direction: "bearish", modelName: "liquidity_reclaim", modelFamily: "ICT", marketCycleStage: "manipulation", laneRecommendation: "watchlist_candidate", nextAction: "Replay" }, requestedSymbol: "MNQ", brokerSymbol: "USTECH", primaryTimeframe: "5m", sourceFingerprint: "source_exact", candleCount: 1000, missingConfirmation: ["displacement"], proposedValidationRules: ["Run replay validation."], blockers: [], nextAction: "Needs replay.", autoPromoteAllowed: false, executionAllowed: false, authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }, safety: {} };

  assert.equal(bridge.bridgeIctHypothesisToCalibrationDraft({ ...hypothesis, sourceFingerprint: undefined }).status, "blocked_identity");
  globalThis.__report = undefined;
  assert.equal(bridge.bridgeIctHypothesisToCalibrationDraft(hypothesis).status, "blocked_validation");
  globalThis.__report = report;
  assert.equal(bridge.bridgeIctHypothesisToCalibrationDraft({ ...hypothesis, sourceFingerprint: "wrong" }).status, "blocked_identity");
  const created = bridge.bridgeIctHypothesisToCalibrationDraft(hypothesis);
  assert.equal(created.status, "draft_created");
  assert.equal(proposals.length, 1);
  assert.deepEqual(proposals[0].proposedChanges, {});
  assert.equal(proposals[0].proposalIntent, "ict_research_hypothesis_intent");
  assert.equal(proposals[0].proposalIntentDetails.draftOnly, true);
  assert.equal(proposals[0].proposalIntentDetails.autoApplyAllowed, false);
  assert.equal(proposals[0].autoApplyStatus, "blocked");
  assert.equal(proposals[0].executionAuthority, "none");
  assert.equal(bridge.bridgeIctHypothesisToCalibrationDraft(hypothesis).status, "existing_draft");
  assert.equal(proposals.length, 1);
  process.stdout.write(JSON.stringify({ status: "passed", created: created.proposalId, mismatchedBlocked: true, authority: created.authority }, null, 2) + "\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
