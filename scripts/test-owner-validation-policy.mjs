#!/usr/bin/env node

import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ cacheDir: ".gotrader/p2-policy-ssr-cache", server: { middlewareMode: true }, appType: "custom", optimizeDeps: { noDiscovery: true } });

try {
  const coverageModule = await server.ssrLoadModule("/src/lib/researchCoverage/canonicalResearchCoverageRegistry.ts");
  const policyModule = await server.ssrLoadModule("/src/lib/ownerValidationPolicy/index.ts");
  const identityModule = await server.ssrLoadModule("/src/lib/ictCanonical/canonicalIctIdentity.ts");
  const coverage = coverageModule.canonicalLiveResearchCoverage();
  const policies = policyModule.canonicalOwnerValidationPolicyRegistry;
  const performancePolicies = policyModule.canonicalOwnerPerformancePolicyRegistry;
  assert.equal(coverage.length, 5);
  assert.equal(policies.length, 5);
  assert.equal(performancePolicies.length, 5);
  assert.equal(new Set(performancePolicies.map((policy) => policy.performancePolicyId)).size, 5);
  assert.ok(performancePolicies.every((policy) => /^fnv1a128:[0-9a-f]{32}$/.test(policy.policyHash)));
  assert.ok(performancePolicies.every((policy) => {
    const { policyHash, ...hashInput } = policy;
    return identityModule.canonicalFingerprint(hashInput) === policyHash;
  }), "policy hashes must deterministically bind every frozen field");
  assert.ok(performancePolicies.every((policy) => policy.governanceDecisions.length > 0
    && policy.governanceDecisions.every((entry) => entry.definedBeforeEvidence === true && entry.basis && entry.rationale)));
  assert.ok(policies.every((policy) => policy.schemaVersion === "gotrader.owner-validation-policy.v1"));
  assert.ok(policies.every((policy) => policy.policyId && policy.policyVersion && policy.ownerStrategyVersion && policy.effectiveFrom));
  assert.ok(policies.every((policy) => policy.technicalPolicyStatus === "POLICY_ACCEPTED"));

  const [ifvg, ict2022, mmbm, mmsm, london] = policies;
  assert.equal(ifvg.performancePolicyStatus, "POLICY_ACCEPTED");
  assert.equal(ifvg.performanceRules.find((rule) => rule.metric === "minimumOosTrades").value, 40);
  assert.equal(ifvg.performanceRules.find((rule) => rule.metric === "minimumOosWindows").value, 2);
  assert.equal(ifvg.performanceRules.find((rule) => rule.metric === "minimumUniqueDates").value, 20);
  assert.ok(policies.every((policy) => policy.performancePolicyStatus === "POLICY_ACCEPTED"));
  assert.ok(policies.every((policy) => policy.performancePolicyId && policy.performancePolicyVersion && policy.performancePolicyHash));
  assert.equal(performancePolicies[2].policyFamily, "MARKET_MAKER");
  assert.equal(performancePolicies[3].policyFamily, "MARKET_MAKER");
  for (const field of ["minimumResolvedOutcomes", "minimumOosWindows", "minimumResolvedOutcomesPerWindow", "minimumWindowPassRate", "minimumDistinctDates", "maximumSingleDateShare", "pooledEdgeRequirement", "stressedAverageRMinimumExclusive", "stressedProfitFactorMinimumExclusive"]) {
    assert.equal(performancePolicies[2][field], performancePolicies[3][field], `market-maker symmetry drift: ${field}`);
  }

  const evidenceFor = (policy, metrics = {}, overrides = {}) => {
    const owner = coverage.find((entry) => entry.ownerStrategyId === policy.ownerStrategyId);
    const performancePolicy = performancePolicies.find((entry) => entry.ownerStrategyId === policy.ownerStrategyId);
    return {
      schemaVersion: policyModule.OWNER_VALIDATION_POLICY_EVIDENCE_SCHEMA,
      evidenceVersion: owner.evidenceVersion,
      runId: `${policy.ownerStrategyId}:fixture`,
      ownerStrategyId: policy.ownerStrategyId,
      ownerStrategyVersion: policy.ownerStrategyVersion,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      performancePolicyId: performancePolicy.performancePolicyId,
      performancePolicyVersion: performancePolicy.performancePolicyVersion,
      performancePolicyHash: performancePolicy.policyHash,
      symbol: "MNQ",
      researchProfileId: owner.researchProfileId,
      geometryPolicyId: owner.geometryPolicyId,
      geometryPolicyVersion: owner.geometryPolicyVersion,
      parameterHash: owner.parameterIdentity,
      datasetId: owner.datasetRequirement.historicalDatasetVersion,
      datasetCertificateId: owner.datasetRequirement.certificateId,
      datasetChecksum: owner.datasetRequirement.datasetChecksum,
      sourceFingerprint: owner.datasetRequirement.sourceFingerprint,
      sessionPolicyVersion: owner.datasetRequirement.sessionPolicyVersion,
      tier: "OOS",
      timeRange: { startUtc: "2025-01-01T00:00:00.000Z", endUtc: "2025-06-01T00:00:00.000Z" },
      checkpointIdentity: `${policy.ownerStrategyId}:checkpoint`,
      evidenceStatus: "EVIDENCE_COMPLETE_FOR_POLICY",
      metrics: {
        evaluations: 100,
        detections: 50,
        candidates: 50,
        blockedCandidates: 0,
        nearMisses: 0,
        validCandidates: 50,
        fills: 45,
        notRetraced: 5,
        entryMissed: 0,
        targetFirst: 30,
        invalidationFirst: 15,
        partial: 0,
        stalled: 0,
        insufficientFuture: 0,
        resolvedOutcomes: 45,
        oosWindows: performancePolicy.minimumOosWindows,
        oosTrades: performancePolicy.minimumResolvedOutcomes,
        oosTradesPerWindowMinimum: performancePolicy.minimumResolvedOutcomesPerWindow,
        uniqueOosDates: performancePolicy.minimumDistinctDates,
        uniqueOosWeeks: performancePolicy.minimumDistinctWeeks ?? 0,
        uniqueOosMonths: performancePolicy.minimumDistinctMonths ?? 0,
        independentOosUnits: performancePolicy.minimumIndependentUnits ?? 0,
        oosWindowPassRate: performancePolicy.minimumWindowPassRate,
        largestSingleDateShare: performancePolicy.maximumSingleDateShare,
        largestSingleIndependentUnitShare: performancePolicy.maximumSingleIndependentUnitShare,
        pooledOosEdgeVerdict: "positive_edge",
        stressedAverageR: 0.1,
        stressedProfitFactor: 1.1,
        expectancyR: 0.1,
        profitFactor: 1.1,
        ...metrics
      },
      ...overrides
    };
  };

  const positive = policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: evidenceFor(ifvg) });
  assert.equal(positive.technicalStatus, "TECHNICAL_EVIDENCE_REQUIRED");
  assert.equal(positive.performanceStatus, "PERFORMANCE_VALIDATED");
  assert.equal(positive.walkForwardStatus, "EVALUATED");
  assert.equal(positive.oosStatus, "EVALUATED");
  assert.equal(positive.readinessStatus, "NOT_READY", "performance evidence cannot stand in for forward/readiness evidence");
  for (const overrides of [{ tier: "FORWARD_EVIDENCE" }, { evidenceStatus: "EVIDENCE_INCOMPATIBLE" }, { checkpointIdentity: "" }, { runId: "" }, { timeRange: { startUtc: "invalid", endUtc: "2025-06-01T00:00:00.000Z" } }]) {
    assert.notEqual(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: evidenceFor(ifvg, {}, overrides) }).performanceStatus, "PERFORMANCE_VALIDATED");
  }
  for (const metrics of [{ fills: -1 }, { resolvedOutcomes: 1000 }, { stressedAverageR: Infinity }, { oosWindows: NaN }, { oosWindows: "3" }, { oosWindowPassRate: 2 }, { largestSingleDateShare: -1 }]) {
    assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: evidenceFor(ifvg, metrics) }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  }
  const blockedPositive = policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: evidenceFor(ifvg), accumulationStatus: "CAPACITY_BLOCKED" });
  assert.equal(blockedPositive.performanceStatus, "PERFORMANCE_SOURCE_BLOCKED");
  assert.notEqual(blockedPositive.oosStatus, "EVALUATED");
  for (const policy of policyModule.canonicalOwnerPerformancePolicyRegistry) {
    assert.equal(Object.isFrozen(policy.forwardEvidenceRequirement), true);
  }

  for (const policy of policies) {
    const fixturePass = policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: policy.ownerStrategyId, evidence: evidenceFor(policy) });
    assert.equal(fixturePass.performanceStatus, "PERFORMANCE_VALIDATED", `${policy.ownerStrategyId} positive fixture`);
    assert.equal(fixturePass.readinessStatus, "NOT_READY");
  }

  const wrongPolicy = evidenceFor(ifvg, {}, { policyVersion: "stale-policy" });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: wrongPolicy }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  const wrongCertificate = evidenceFor(ifvg, {}, { datasetCertificateId: "sha256:wrong-certificate" });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: wrongCertificate }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  const wrongParameter = evidenceFor(ifvg, {}, { parameterHash: "fnv1a128:wrong-parameter" });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: wrongParameter }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  const staleOwnerVersion = evidenceFor(ifvg, {}, { ownerStrategyVersion: "stale-owner-version" });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: staleOwnerVersion }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  const crossOwner = evidenceFor(mmbm);
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: mmsm.ownerStrategyId, evidence: crossOwner }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  const wrongSchema = evidenceFor(ifvg, {}, { schemaVersion: "stale-evidence-schema" });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: wrongSchema }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  const wrongPerformancePolicy = evidenceFor(ict2022, {}, { performancePolicyHash: "fnv1a128:00000000000000000000000000000000" });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ict2022.ownerStrategyId, evidence: wrongPerformancePolicy }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  const wrongPerformanceVersion = evidenceFor(ict2022, {}, { performancePolicyVersion: "2.0.0-mutated" });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ict2022.ownerStrategyId, evidence: wrongPerformanceVersion }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  const wrongSymbol = evidenceFor(ict2022, {}, { symbol: "ES" });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ict2022.ownerStrategyId, evidence: wrongSymbol }).performanceStatus, "PERFORMANCE_EVIDENCE_INCOMPATIBLE");
  assert.ok(policyModule.canonicalOwnerTechnicalEvidenceInventory.every((item) => {
    const owner = coverage.find((entry) => entry.ownerStrategyId === item.ownerStrategyId);
    return item.ownerStrategyVersion === owner.ownerStrategyVersion
      && item.researchProfileId === owner.researchProfileId
      && item.geometryPolicyVersion === owner.geometryPolicyVersion
      && item.parameterHash === owner.parameterIdentity
      && item.datasetCertificateId === owner.datasetRequirement.certificateId
      && item.sourceFingerprint === owner.datasetRequirement.sourceFingerprint;
  }));

  const unfavorable = evidenceFor(ifvg, {
    pooledOosEdgeVerdict: "insufficient_edge",
    stressedAverageR: -1,
    stressedProfitFactor: 0.5
  });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: unfavorable }).performanceStatus, "PERFORMANCE_POLICY_FAILED");

  const windowFailure = evidenceFor(ict2022, { oosWindowPassRate: 1 / 3 });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ict2022.ownerStrategyId, evidence: windowFailure }).performanceStatus, "PERFORMANCE_POLICY_FAILED");
  const concentrationFailure = evidenceFor(london, { largestSingleDateShare: 0.05 });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: london.ownerStrategyId, evidence: concentrationFailure }).performanceStatus, "PERFORMANCE_POLICY_FAILED");
  const insufficientStrong = evidenceFor(mmbm, { resolvedOutcomes: 39, oosTrades: 39 });
  const insufficientEvaluation = policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: mmbm.ownerStrategyId, evidence: insufficientStrong });
  assert.equal(insufficientEvaluation.performanceStatus, "INSUFFICIENT_PERFORMANCE_EVIDENCE");
  assert.equal(insufficientEvaluation.evidenceDeficit.resolvedOutcomes, 1);

  const zero = evidenceFor(ifvg, { candidates: 0, fills: 0, resolvedOutcomes: 0 });
  assert.equal(policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, evidence: zero }).performanceStatus, "INSUFFICIENT_PERFORMANCE_EVIDENCE");
  const capacity = policyModule.evaluateCanonicalOwnerPolicy({ ownerStrategyId: ifvg.ownerStrategyId, accumulationStatus: "CAPACITY_BLOCKED" });
  assert.equal(capacity.technicalStatus, "TECHNICAL_EVIDENCE_REQUIRED");
  assert.equal(capacity.performanceStatus, "PERFORMANCE_SOURCE_BLOCKED");
  assert.ok(capacity.deficits.includes("CAPACITY_REQUIRED"));

  const actual = policyModule.evaluateCanonicalOwnerPolicyCycle({
    cycleId: "actual-capacity-preflight",
    accumulationStatusByOwner: Object.fromEntries(policies.map((policy) => [policy.ownerStrategyId, "CAPACITY_BLOCKED"]))
  });
  assert.equal(actual.technicallyValidatedCount, 0);
  assert.equal(actual.performanceValidatedCount, 0);
  assert.equal(actual.performancePolicyDefinedCount, 5);
  assert.equal(actual.policyRequiredCount, 0);
  assert.equal(actual.researchReadyCount, 0);
  assert.equal(actual.researchValidated, false);
  assert.ok(actual.owners.every((owner) => owner.readinessStatus === "NOT_READY"));
  assert.deepEqual(actual.authority, { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none", productionAdoptionAllowed: false, canCreateTradeIntent: false });

  console.log(JSON.stringify({
    status: "passed",
    owners: policies.map((policy) => policy.ownerStrategyId),
    technicallyValidated: actual.technicallyValidatedCount,
    performanceValidated: actual.performanceValidatedCount,
    policyDefined: actual.performancePolicyDefinedCount,
    researchReady: actual.researchReadyCount,
    capacity: "CAPACITY_BLOCKED",
    authority: "none/none/none"
  }, null, 2));
} finally {
  await server.close();
}
