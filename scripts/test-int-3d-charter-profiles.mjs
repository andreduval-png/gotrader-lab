#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", `int-3d-charter-profiles-${process.pid}`);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const transpile = (sourcePath, outputName, replacements = []) => {
  const source = fs.readFileSync(path.join(root, sourcePath), "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement);
  fs.writeFileSync(path.join(out, outputName), output, "utf8");
};

transpile("src/lib/ictCharterProfiles/ictCharterProfileRuntime.ts", "ictCharterProfileRuntime.mjs", [
  [/from\s+["']\.\/ictCharterProfileTypes["']/g, 'from "./ictCharterProfileTypes.mjs"']
]);
fs.writeFileSync(path.join(out, "ictCharterProfileTypes.mjs"), "export {};\n", "utf8");
transpile("src/lib/currentOpportunity/canonicalRuntimeCandidateSet.ts", "canonicalRuntimeCandidateSet.mjs");
transpile("src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts", "buildOperatorConsoleSnapshot.mjs", [
  [/from\s+["']@\/lib\/tradeGeometry["']/g, 'from "./tradeGeometry.mjs"'],
  [/from\s+["']@\/lib\/researchCoverage["']/g, 'from "./researchCoverage.mjs"'],
  [/from\s+["']\.\/operatorConsoleTypes["']/g, 'from "./operatorConsoleTypes.mjs"']
]);
fs.writeFileSync(path.join(out, "researchCoverage.mjs"), `export const CANONICAL_LIVE_RESEARCH_OWNER_ORDER = [
  "ifvg_fresh_retest_v3_research", "ict_2022_model_v1", "ict_market_maker_buy_model_v1",
  "ict_market_maker_sell_model_v1", "nasdaq_london_raid_ny_reversal_v1"
];\n`, "utf8");
fs.writeFileSync(path.join(out, "tradeGeometry.mjs"), `export const projectCanonicalTradeGeometry = (geometry) => geometry ? {
  geometryId: geometry.geometryId,
  intendedEntry: geometry.entry?.intendedPrice,
  intendedStop: geometry.stop?.price,
  intendedTarget: geometry.target?.price,
  theoreticalRR: geometry.theoreticalRR,
  geometryValid: geometry.geometryValid,
  actionable: geometry.actionable,
  status: geometry.status
} : undefined;\n`, "utf8");
fs.writeFileSync(path.join(out, "operatorConsoleTypes.mjs"), `export const OPERATOR_AUTHORITY = {
  executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none"
};\n`, "utf8");

const runtime = await import(`${pathToFileURL(path.join(out, "ictCharterProfileRuntime.mjs")).href}?v=${Date.now()}`);
const canonical = await import(`${pathToFileURL(path.join(out, "canonicalRuntimeCandidateSet.mjs")).href}?v=${Date.now()}`);
const operator = await import(`${pathToFileURL(path.join(out, "buildOperatorConsoleSnapshot.mjs")).href}?v=${Date.now()}`);

const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const geometry = (id, direction, entry, stop, target) => ({
  geometryId: id,
  direction,
  entry: { intendedPrice: entry },
  stop: { price: stop },
  target: { price: target },
  theoreticalRR: Math.abs(target - entry) / Math.abs(entry - stop),
  geometryValid: true,
  actionable: true,
  status: "VALID_ACTIONABLE",
  blockers: []
});
const opportunity = ({ strategyId, candidateId, timeframe = "5m", side = "long", actionable = true, nativeGeometry }) => ({
  id: candidateId,
  candidateId,
  strategyId,
  strategyVersion: "1.0.0",
  candidateState: "QUALIFIED",
  contextIdentity: "int-3d-source",
  model: strategyId,
  symbol: "MNQ",
  brokerSymbol: "USTECH",
  side,
  timeframe,
  contextTimeframes: ["15m", "1h"],
  status: actionable ? "valid_candidate" : "near_miss",
  classification: actionable ? "trade_candidate" : "forming_candidate",
  setupName: strategyId,
  thesis: "Fixture owner candidate.",
  entry: nativeGeometry?.entry.intendedPrice,
  invalidation: nativeGeometry?.stop.price,
  target: nativeGeometry?.target.price,
  rrEstimate: nativeGeometry?.theoreticalRR,
  geometry: nativeGeometry,
  geometryMode: nativeGeometry ? "canonical" : "unavailable",
  geometryStatus: nativeGeometry?.status,
  canonicalCandidate: true,
  actionable,
  confidence: 80,
  requiredValidation: [],
  blockers: [],
  missingConditions: [],
  nextAction: "Replay.",
  sourceDepth: {},
  researchOnly: true,
  executionIntentCreated: false,
  authority
});

const ictGeometry = geometry("ict-geometry", "LONG", 100.5, 105, 89);
const mmbmGeometry = geometry("mmbm-geometry", "LONG", 99, 90, 120);
const mmsmGeometry = geometry("mmsm-geometry", "SHORT", 101, 110, 80);
const ownerOpportunities = [
  opportunity({ strategyId: "ict_2022_model_v1", candidateId: "ict-owner", nativeGeometry: ictGeometry }),
  opportunity({ strategyId: "ict_market_maker_buy_model_v1", candidateId: "mmbm-owner", nativeGeometry: mmbmGeometry }),
  opportunity({ strategyId: "ict_market_maker_sell_model_v1", candidateId: "mmsm-owner", side: "short", nativeGeometry: mmsmGeometry })
];
const attributed = runtime.attributeCharterOwnerCandidates(ownerOpportunities);

assert.equal(attributed.length, ownerOpportunities.length, "profiles must not duplicate owner candidates");
assert.deepEqual(attributed.map((item) => item.charterProfile?.charterModelNumber), [1, 6, 7]);
assert.deepEqual(attributed.map((item) => item.charterProfile?.ownerStrategyId), attributed.map((item) => item.strategyId));
assert.equal(attributed[0].geometry, ictGeometry, "profile attribution must preserve owner geometry by identity");
assert.equal(attributed[1].geometry, mmbmGeometry);
assert.equal(attributed[2].geometry, mmsmGeometry);

const shortTerm = runtime.attributeCharterOwnerCandidates([
  opportunity({ strategyId: "ict_2022_model_v1", candidateId: "ict-short-term", timeframe: "1h", nativeGeometry: ictGeometry })
]);
assert.equal(shortTerm[0].charterProfile?.charterModelNumber, 2);

const blockedOwner = opportunity({ strategyId: "ict_2022_model_v1", candidateId: "ict-blocked", actionable: false });
const [blockedAttributed] = runtime.attributeCharterOwnerCandidates([blockedOwner]);
assert.equal(blockedAttributed.actionable, false, "profile actionability cannot exceed owner actionability");
assert.equal(blockedAttributed.geometry, undefined, "profile attribution cannot manufacture geometry");

const sideChannelOwners = [
  opportunity({ strategyId: "turtle_soup_v1", candidateId: "turtle", nativeGeometry: ictGeometry }),
  opportunity({ strategyId: "mmxm_delivery_framework_v1", candidateId: "mmxm", nativeGeometry: undefined })
];
assert.deepEqual(runtime.attributeCharterOwnerCandidates(sideChannelOwners).map((item) => item.charterProfile), [undefined, undefined]);

const snapshot = runtime.buildCharterProfileRuntimeSnapshot({
  opportunities: attributed,
  generatedAt: "2026-08-26T12:00:00.000Z",
  sourceFingerprint: "int-3d-source"
});
assert.equal(runtime.assertCharterProfileRuntimeSnapshot(snapshot).ok, true);
assert.equal(snapshot.profiles.length, 12);
assert.equal(snapshot.executableStrategiesAdded, 0);
assert.equal(snapshot.geometryProduced, 0);
assert.deepEqual(
  snapshot.profiles.filter((profile) => [3, 4, 8].includes(profile.charterModelNumber)).map((profile) => profile.runtimeStatus),
  ["framework_only", "framework_only", "framework_only"]
);
assert.deepEqual(
  snapshot.profiles.filter((profile) => [5, 9, 10, 11, 12].includes(profile.charterModelNumber)).map((profile) => profile.runtimeStatus),
  ["source_blocked", "source_blocked", "source_blocked", "source_blocked", "source_blocked"]
);
assert.doesNotMatch(JSON.stringify(snapshot), /"(entry|stop|target|riskReward|canonicalGeometry|proposedGeometry)"\s*:/i);

const conflictOwners = runtime.attributeCharterOwnerCandidates([
  opportunity({ strategyId: "ict_2022_model_v1", candidateId: "ict-long", nativeGeometry: ictGeometry }),
  opportunity({ strategyId: "ict_market_maker_sell_model_v1", candidateId: "mmsm-short", side: "short", nativeGeometry: mmsmGeometry })
]);
const candidateSet = canonical.buildCanonicalRuntimeCandidateSet({
  opportunities: conflictOwners,
  generatedAt: "2026-08-26T12:00:00.000Z",
  sourceFingerprint: "int-3d-source",
  authority
});
assert.equal(candidateSet.candidates.length, 2);
assert.equal(candidateSet.disposition, "CONFLICTING_CANONICAL_SETUPS");
assert.deepEqual(candidateSet.candidates.map((candidate) => candidate.charterProfile?.charterModelNumber), [1, 7]);

const candidatePlans = conflictOwners.map((item) => ({
  strategyId: item.strategyId,
  strategyVersion: item.strategyVersion,
  charterProfile: item.charterProfile,
  candidateId: item.candidateId,
  setupName: item.setupName,
  side: item.side,
  status: item.status,
  geometryId: item.geometry.geometryId,
  entry: item.entry,
  stop: item.invalidation,
  target: item.target,
  riskReward: item.rrEstimate,
  actionable: item.actionable,
  blockers: []
}));
const activation = {
  activationTimestamp: "2026-08-26T12:00:00.000Z",
  currentReadEvaluatedAt: "2026-08-26T12:00:00.000Z",
  cycleId: "int-3d-cycle",
  sourceFingerprint: "int-3d-source",
  candidatePlans,
  charterProfiles: snapshot.profiles,
  canonicalSetupConflict: "CONFLICTING_CANONICAL_SETUPS",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  primaryTimeframe: "5m",
  researchOnly: true,
  executionAllowed: false,
  authority
};
const operatorSnapshot = operator.buildOperatorConsoleSnapshot({
  activation,
  cycle: {
    status: "completed", stage: "completed", cycleId: "int-3d-cycle", sourceFingerprint: "int-3d-source", progressPercent: 100,
    message: "Complete", authority, autoApplyAllowed: false, researchOnly: true
  },
  now: "2026-08-26T12:00:01.000Z"
});
assert.equal(operatorSnapshot.charterProfiles.length, 12);
const projectProfiles = (cycle) => operator.buildOperatorConsoleSnapshot({ activation, cycle, now: "2026-08-26T12:00:01.000Z" }).charterProfiles;
assert.deepEqual(projectProfiles({ cycleId: "other-cycle", sourceFingerprint: "int-3d-source" }), []);
assert.deepEqual(projectProfiles({ cycleId: "int-3d-cycle", sourceFingerprint: "other-source" }), []);
assert.equal(projectProfiles({ cycleId: "int-3d-cycle", sourceFingerprint: "int-3d-source" }).length, 12);
assert.deepEqual(operatorSnapshot.candidatePlans.map((plan) => plan.charterModelNumber), [1, 7]);
assert.doesNotMatch(JSON.stringify(operatorSnapshot.charterProfiles), /"(entryPrice|stopLoss|takeProfit|riskReward|geometry)"\s*:/i);

const view = fs.readFileSync(path.join(root, "src/components/operator/OperatorConsoleView.tsx"), "utf8");
assert.match(view, /operator-charter-profiles/);
assert.match(view, /Charter profiles/);
assert.match(view, /Owner attribution only/);
const advisorView = fs.readFileSync(path.join(root, "src/components/advisor/ResearchAdvisorView.tsx"), "utf8");
assert.match(advisorView, /advisor-charter-profiles/);
assert.match(advisorView, /No profile geometry/);

console.log(JSON.stringify({
  status: "passed",
  ownerCandidates: attributed.length,
  attributedModels: attributed.map((item) => item.charterProfile.charterModelNumber),
  profileCount: snapshot.profiles.length,
  executableStrategiesAdded: snapshot.executableStrategiesAdded,
  geometryProduced: snapshot.geometryProduced,
  conflict: candidateSet.disposition,
  authority
}, null, 2));
