#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", "int-3a-1-operator-conflict-test");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const source = fs.readFileSync(path.join(root, "src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove }
}).outputText
  .replace(/from\s+["']@\/lib\/tradeGeometry["']/g, 'from "./tradeGeometry.mjs"')
  .replace(/from\s+["']@\/lib\/researchCoverage["']/g, 'from "./researchCoverage.mjs"')
  .replace(/from\s+["']\.\/operatorConsoleTypes["']/g, 'from "./operatorConsoleTypes.mjs"');
fs.writeFileSync(path.join(out, "buildOperatorConsoleSnapshot.mjs"), js, "utf8");
fs.writeFileSync(path.join(out, "tradeGeometry.mjs"), `export const projectCanonicalTradeGeometry = (geometry) => geometry ? {
  geometryId: geometry.geometryId,
  intendedEntry: geometry.entry?.intendedPrice,
  intendedStop: geometry.stop?.price,
  intendedTarget: geometry.target?.price,
  theoreticalRR: geometry.theoreticalRR,
  geometryValid: geometry.geometryValid,
  actionable: geometry.actionable,
  status: geometry.status,
  displayKind: geometry.actionable ? "ACTIONABLE_GEOMETRY" : "RESEARCH_GEOMETRY"
} : undefined;\n`, "utf8");
fs.writeFileSync(path.join(out, "operatorConsoleTypes.mjs"), `export const OPERATOR_AUTHORITY = {
  executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none"
};\n`, "utf8");
fs.writeFileSync(path.join(out, "researchCoverage.mjs"), `export const CANONICAL_LIVE_RESEARCH_OWNER_ORDER = [
  "ifvg_fresh_retest_v3_research",
  "ict_2022_model_v1",
  "ict_market_maker_buy_model_v1",
  "ict_market_maker_sell_model_v1",
  "nasdaq_london_raid_ny_reversal_v1"
];\n`, "utf8");

const { buildOperatorConsoleSnapshot } = await import(`${pathToFileURL(path.join(out, "buildOperatorConsoleSnapshot.mjs")).href}?v=${Date.now()}`);
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const candidatePlan = (strategyId, candidateId, geometryId, side, entry, stop, target) => ({
  strategyId, candidateId, geometryId, setupName: strategyId, side, status: "valid_candidate",
  entry, stop, target, riskReward: 2, actionable: true, blockers: []
});
const activation = {
  activationTimestamp: "2026-08-25T12:00:00.000Z",
  cycleId: "int-3a-1-conflict-cycle",
  sourceFingerprint: "canonical-source",
  currentReadEvaluatedAt: "2026-08-25T12:00:00.000Z",
  canonicalSetupConflict: "CONFLICTING_CANONICAL_SETUPS",
  currentOpportunitySummary: {
    canonicalSetupConflict: "CONFLICTING_CANONICAL_SETUPS",
    canonicalCandidateSetDisposition: "CONFLICTING_CANONICAL_SETUPS",
    canonicalCandidateCount: 2,
    actionableCanonicalCandidateCount: 2
  },
  candidatePlans: [
    candidatePlan("ifvg_fresh_retest_v3_research", "ifvg-conflict", "ifvg-geometry", "long", 95, 93.9095, 98.6),
    candidatePlan("ict_2022_model_v1", "ict-conflict", "ict-geometry", "short", 100.5, 105, 89)
  ],
  requestedSymbol: "ES", brokerSymbol: "ES", primaryTimeframe: "5m", researchSide: "flat",
  executionAllowed: false, researchOnly: true, authority,
  safety: { rawCandlesExcluded: true, rawSnapshotsExcluded: true }
};
const cycle = {
  status: "completed", stage: "completed", cycleId: activation.cycleId, progressPercent: 100,
  message: "Complete", authority, autoApplyAllowed: false, researchOnly: true
};
const snapshot = buildOperatorConsoleSnapshot({ activation, cycle, now: "2026-08-25T12:00:01.000Z" });

assert.equal(snapshot.canonicalSetupConflict, "CONFLICTING_CANONICAL_SETUPS");
assert.equal(snapshot.researchPlan.status, "no_trade");
assert.equal(snapshot.researchPlan.signal, "NO_TRADE");
assert.equal(snapshot.researchPlan.setup, "Conflicting canonical setups");
assert.equal(snapshot.researchPlan.entryPrice, undefined);
assert.equal(snapshot.researchPlan.stopLoss, undefined);
assert.equal(snapshot.researchPlan.takeProfit, undefined);
assert.equal(snapshot.candidatePlans.length, 2);
assert.deepEqual(snapshot.candidatePlans.map((candidate) => candidate.signal), ["NO_TRADE", "NO_TRADE"]);
assert.deepEqual(snapshot.candidatePlans.map((candidate) => candidate.candidateActionable), [true, true]);
assert.deepEqual(snapshot.candidatePlans.map((candidate) => candidate.globalActionable), [false, false]);
assert.deepEqual(snapshot.candidatePlans.map((candidate) => candidate.geometryId), ["ifvg-geometry", "ict-geometry"]);
assert.equal(snapshot.authority.executionAuthority, "none");

const marketMakerActivation = {
  ...activation,
  cycleId: "int-3b-mmbm-cycle",
  canonicalSetupConflict: "NONE",
  currentOpportunitySummary: {
    canonicalSetupConflict: "NONE",
    canonicalCandidateSetDisposition: "SINGLE_ACTIONABLE_CANDIDATE",
    canonicalCandidateCount: 1,
    actionableCanonicalCandidateCount: 1,
    selectedCanonicalCandidateId: "mmbm-candidate"
  },
  candidatePlans: [
    candidatePlan("ict_market_maker_buy_model_v1", "mmbm-candidate", "mmbm-geometry", "long", 23090, 23080, 23120)
  ],
  currentCandidateId: "mmbm-candidate",
  researchSide: "long",
  proposedCandidateStatus: "valid_candidate",
  proposedGeometry: {
    geometryId: "mmbm-geometry",
    entry: { intendedPrice: 23090 },
    stop: { price: 23080 },
    target: { price: 23120 },
    theoreticalRR: 3,
    geometryValid: true,
    actionable: true,
    status: "VALID_ACTIONABLE"
  },
  proposedEntryPrice: 23090,
  proposedStopLoss: 23080,
  proposedTakeProfit: 23120,
  proposedRiskReward: 3
};
const marketMakerCycle = { ...cycle, cycleId: marketMakerActivation.cycleId };
const marketMakerSnapshot = buildOperatorConsoleSnapshot({
  activation: marketMakerActivation,
  cycle: marketMakerCycle,
  now: "2026-08-25T12:01:01.000Z"
});
assert.equal(marketMakerSnapshot.researchPlan.currentCandidateId, "mmbm-candidate");
assert.equal(marketMakerSnapshot.researchPlan.geometryId, "mmbm-geometry");
assert.equal(marketMakerSnapshot.researchPlan.entryPrice, 23090);
assert.equal(marketMakerSnapshot.researchPlan.stopLoss, 23080);
assert.equal(marketMakerSnapshot.researchPlan.takeProfit, 23120);
assert.equal(marketMakerSnapshot.candidatePlans.length, 1);
assert.equal(marketMakerSnapshot.candidatePlans[0].strategyId, "ict_market_maker_buy_model_v1");
assert.equal(marketMakerSnapshot.candidatePlans[0].candidateId, "mmbm-candidate");
assert.equal(marketMakerSnapshot.candidatePlans[0].geometryId, "mmbm-geometry");
assert.equal(marketMakerSnapshot.candidatePlans[0].candidateActionable, true);
assert.equal(marketMakerSnapshot.candidatePlans[0].globalActionable, true);
assert.equal(marketMakerSnapshot.authority.executionAuthority, "none");

const view = fs.readFileSync(path.join(root, "src/components/operator/OperatorConsoleView.tsx"), "utf8");
assert.match(view, /operator-canonical-conflict/);
assert.match(view, /Conflicting canonical setups/);
assert.match(view, /candidate\.side\.toUpperCase\(\)/);
assert.match(view, /candidate\.candidateActionable/);
assert.match(view, /Conflict \/ context only/);

const hook = fs.readFileSync(path.join(root, "src/components/operator/useOperatorConsole.ts"), "utf8");
assert.doesNotMatch(hook, /buildInt3a1ConflictAcceptanceFixture|int3a1Fixture/, "final snapshot paint must not remain an acceptance authority");

console.log(JSON.stringify({
  status: "passed",
  conflict: snapshot.canonicalSetupConflict,
  heroSignal: snapshot.researchPlan.signal,
  proposedGeometry: null,
  candidateIds: snapshot.candidatePlans.map((candidate) => candidate.candidateId),
  geometryIds: snapshot.candidatePlans.map((candidate) => candidate.geometryId),
  executionAuthority: snapshot.authority.executionAuthority
}, null, 2));
