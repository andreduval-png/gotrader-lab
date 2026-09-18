#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", `rc1a-research-coverage-${process.pid}`);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const transpile = (source, output, replacements = []) => {
  let code = ts.transpileModule(fs.readFileSync(path.join(root, source), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: source
  }).outputText;
  for (const [pattern, replacement] of replacements) code = code.replace(pattern, replacement);
  fs.writeFileSync(path.join(out, output), code, "utf8");
};

transpile("src/lib/researchCoverage/researchCoverageTypes.ts", "researchCoverageTypes.mjs");
transpile("src/lib/researchCoverage/canonicalResearchCoverageRegistry.ts", "canonicalResearchCoverageRegistry.mjs", [
  [/from\s+["']\.\/researchCoverageTypes["']/g, 'from "./researchCoverageTypes.mjs"']
]);
transpile("src/lib/researchCoverage/evidenceCompatibility.ts", "evidenceCompatibility.mjs", [
  [/from\s+["']\.\/canonicalResearchCoverageRegistry["']/g, 'from "./canonicalResearchCoverageRegistry.mjs"']
]);
transpile("src/lib/researchCoverage/buildCanonicalResearchCoverageSnapshot.ts", "buildCanonicalResearchCoverageSnapshot.mjs", [
  [/from\s+["']\.\/canonicalResearchCoverageRegistry["']/g, 'from "./canonicalResearchCoverageRegistry.mjs"'],
  [/from\s+["']\.\/researchCoverageTypes["']/g, 'from "./researchCoverageTypes.mjs"']
]);

const registryModule = await import(`${pathToFileURL(path.join(out, "canonicalResearchCoverageRegistry.mjs")).href}?v=${Date.now()}`);
const evidenceModule = await import(`${pathToFileURL(path.join(out, "evidenceCompatibility.mjs")).href}?v=${Date.now()}`);
const snapshotModule = await import(`${pathToFileURL(path.join(out, "buildCanonicalResearchCoverageSnapshot.mjs")).href}?v=${Date.now()}`);

const registry = registryModule.canonicalResearchCoverageRegistry;
const live = registryModule.canonicalLiveResearchCoverage();
assert.equal(live.length, 5, "exactly five live-fact-complete research owners are registered");
assert.deepEqual(live.map((item) => item.ownerStrategyId), registryModule.CANONICAL_LIVE_RESEARCH_OWNER_ORDER);
assert.equal(new Set(registry.map((item) => item.ownerStrategyId)).size, registry.length, "research identities are unique");
assert.equal(registry.length, 6, "five live owners plus one separately labeled research-only strategy");
assert.ok(live.every((item) => item.liveFactComplete && item.runtimeAdmissionStatus === "LIVE_OWNER"));
assert.ok(registry.every((item) => item.authority.executionAuthority === "none" && item.authority.brokerAuthority === "none" && item.authority.readinessOverrideAuthority === "none"));

const v4 = registryModule.findResearchCoverage("ifvg_fresh_retest_v4_candidate");
assert.equal(v4.runtimeAdmissionStatus, "RESEARCH_ONLY");
assert.equal(v4.liveFactComplete, false);
assert.equal(v4.tacticalResearchPolicy.status, "RESEARCH_ONLY");
assert.equal(v4.readinessPolicy.status, "DISABLED_BY_POLICY");

const excluded = ["turtle_soup_v1", "silver_bullet_v2_refined_research", "cisd_v1", "ict-bread-and-butter-sell", "ict-one-shot-one-kill", "ict_power_of_three_v1", "ict_judas_swing_v1", "ict_cmd_short_paper_watchlist_v1"];
assert.ok(excluded.every((strategyId) => !registryModule.findResearchCoverage(strategyId)), "source-blocked and non-admitted strategies stay excluded");

const mmbm = registryModule.findResearchCoverage("ict_market_maker_buy_model_v1");
const mmsm = registryModule.findResearchCoverage("ict_market_maker_sell_model_v1");
assert.equal(mmbm.runtimeAdmissionStatus, "LIVE_OWNER");
assert.equal(mmbm.historicalValidationPolicy.status, "SUPPORTED");
assert.equal(mmbm.historicalValidationPolicy.blockers.length, 0);
assert.equal(mmsm.historicalValidationPolicy.status, "SUPPORTED");
assert.equal(mmsm.walkForwardPolicy.status, "SUPPORTED_WITH_LIMITATIONS");

const london = registryModule.findResearchCoverage("nasdaq_london_raid_ny_reversal_v1");
assert.equal(london.runtimeAdmissionStatus, "LIVE_OWNER", "London Raid is the fifth owner");
assert.equal(london.historicalValidationPolicy.status, "SUPPORTED");
assert.equal(london.geometryPolicyVersion, "2.0.0-nearest-native-objective");
assert.equal(london.datasetRequirement.providerFallback, "PROHIBITED");
assert.ok(registry.every((item) => item.resourceBudget.maximumStrategyConcurrency === 1));
assert.ok(registry.every((item) => item.resourceBudget.sharedCanonicalContextRequired));

const evidenceFor = (contract, patch = {}) => ({
  strategyId: contract.ownerStrategyId,
  strategyVersion: contract.ownerStrategyVersion,
  researchProfileId: contract.researchProfileId,
  geometryPolicyId: contract.geometryPolicyId,
  geometryPolicyVersion: contract.geometryPolicyVersion,
  datasetFamily: contract.datasetRequirement.historicalDatasetFamily,
  datasetVersion: contract.datasetRequirement.historicalDatasetVersion,
  datasetCertificateId: contract.datasetRequirement.certificateId ?? "not-applicable",
  datasetChecksum: contract.datasetRequirement.datasetChecksum ?? "not-applicable",
  sourceFingerprint: contract.datasetRequirement.sourceFingerprint ?? "fixture-source",
  parameterHash: contract.parameterIdentity,
  sessionPolicyVersion: contract.datasetRequirement.sessionPolicyVersion,
  evaluationTier: "TACTICAL_RESEARCH",
  runId: "fixture-run",
  asOfStart: "2026-01-01T00:00:00.000Z",
  asOfEnd: "2026-01-02T00:00:00.000Z",
  producerLineage: "owner-native-fixture",
  ...patch
});

const ifvgV3 = registryModule.findResearchCoverage("ifvg_fresh_retest_v3_research");
assert.equal(evidenceModule.evaluateResearchEvidenceCompatibility(evidenceFor(ifvgV3)).compatible, true);
for (const patch of [
  { runId: undefined }, { parameterHash: null }, { producerLineage: 12 },
  { asOfStart: "invalid" }, { asOfEnd: "2025-01-01T00:00:00.000Z" },
  { asOfEnd: "2026-01-01T00:00:00.000Z" }
]) {
  const result = evidenceModule.evaluateResearchEvidenceCompatibility(evidenceFor(ifvgV3, patch));
  assert.equal(result.compatible, false);
  assert.equal(result.classification, "INSUFFICIENT_IDENTITY");
}
const unknownTier = evidenceModule.evaluateResearchEvidenceCompatibility(evidenceFor(ifvgV3, { evaluationTier: "UNKNOWN" }));
assert.equal(unknownTier.compatible, false);
assert.ok(unknownTier.codes.includes("TIER_NOT_SUPPORTED"));
const v4AsV3 = evidenceModule.evaluateResearchEvidenceCompatibility(evidenceFor(ifvgV3, {
  strategyVersion: "v4",
  researchProfileId: "ifvg_fresh_retest_v4_candidate",
  geometryPolicyId: "ifvg_fresh_retest_v4_candidate.native-liquidity-target",
  geometryPolicyVersion: "v4"
}));
assert.equal(v4AsV3.compatible, false);
assert.ok(v4AsV3.codes.includes("STRATEGY_VERSION_MISMATCH") && v4AsV3.codes.includes("PROFILE_MISMATCH"));

for (const contract of [mmbm, mmsm]) {
  const legacy = evidenceModule.evaluateResearchEvidenceCompatibility(evidenceFor(contract, { producerLineage: "legacy_irl_erl_transition_injection" }));
  assert.equal(legacy.classification, "QUARANTINED");
  assert.deepEqual(legacy.codes, ["LEGACY_TRANSITION_LINEAGE"]);
}
const oldLondon = evidenceModule.evaluateResearchEvidenceCompatibility(evidenceFor(london, { producerLineage: "legacy_rr_selected_target_stretch" }));
assert.equal(oldLondon.classification, "INVALIDATED_BY_POLICY_CHANGE");
assert.deepEqual(oldLondon.codes, ["LEGACY_LONDON_TARGET_POLICY"]);
const oldLondonPolicyVersion = evidenceModule.evaluateResearchEvidenceCompatibility(evidenceFor(london, { geometryPolicyVersion: "1.0.0" }));
assert.equal(oldLondonPolicyVersion.classification, "INVALIDATED_BY_POLICY_CHANGE");
assert.deepEqual(oldLondonPolicyVersion.codes, ["LEGACY_LONDON_TARGET_POLICY"]);

const supportedHistorical = evidenceModule.evaluateResearchEvidenceCompatibility(evidenceFor(ifvgV3, { evaluationTier: "HISTORICAL_VALIDATION" }));
assert.equal(supportedHistorical.compatible, true);
assert.deepEqual(supportedHistorical.codes, ["COMPATIBLE"]);
const wrongCertificate = evidenceModule.evaluateResearchEvidenceCompatibility(evidenceFor(ifvgV3, { datasetCertificateId: "sha256:wrong" }));
assert.equal(wrongCertificate.compatible, false);
assert.ok(wrongCertificate.codes.includes("DATASET_IDENTITY_MISMATCH"));

const snapshot = snapshotModule.buildCanonicalResearchCoverageSnapshot({
  cycleId: "cycle-with-live-plan",
  asOf: "2026-08-28T12:00:00.000Z",
  livePlanStatus: "AVAILABLE",
  livePlanReason: "Activate Market produced a current owner-native plan.",
  timings: { activateMarketMs: 25 }
});
assert.equal(snapshot.livePlanStatus, "AVAILABLE", "research blockers cannot hide an available live plan");
assert.equal(snapshot.blockedOwners.length, 5);
assert.deepEqual(snapshot.researchOnlyStrategies, ["ifvg_fresh_retest_v4_candidate"]);
assert.equal(snapshot.validationStatus, "AVAILABLE");
assert.equal(snapshot.readinessStatus, "BLOCKED");

const rc1aSources = fs.readdirSync(path.join(root, "src", "lib", "researchCoverage"))
  .filter((file) => file.endsWith(".ts"))
  .map((file) => fs.readFileSync(path.join(root, "src", "lib", "researchCoverage", file), "utf8"))
  .join("\n");
for (const forbidden of [
  /buildIctTradeConstruction\s*\(/,
  /currentPrice\s*:/,
  /syntheticTarget/i,
  /fixedR/i,
  /stopMutation/i,
  /submitOrder|placeOrder|brokerWrite/i
]) assert.doesNotMatch(rc1aSources, forbidden, `RC1A architecture must not contain ${forbidden}`);

fs.rmSync(out, { recursive: true, force: true });
console.log("RC1A research coverage contract tests passed.");
