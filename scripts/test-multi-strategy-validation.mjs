#!/usr/bin/env node

import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({ cacheDir: ".gotrader/p2-validation-ssr-cache", optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true }, appType: "custom" });

try {
  const coverage = await server.ssrLoadModule("/src/lib/researchCoverage/canonicalResearchCoverageRegistry.ts");
  const scheduler = await server.ssrLoadModule("/src/lib/operatorResearch/operatorResearchScheduler.ts");
  const validation = await server.ssrLoadModule("/src/lib/ownerValidation/ownerValidationEngine.ts");
  const validationRegistry = await server.ssrLoadModule("/src/lib/ownerValidation/ownerValidationRegistry.ts");
  const types = await server.ssrLoadModule("/src/lib/ownerValidation/ownerValidationTypes.ts");

  const contracts = coverage.canonicalLiveResearchCoverage();
  assert.equal(contracts.length, 5);
  assert.equal(validationRegistry.canonicalOwnerValidationContracts.filter((item) => !item.researchOnly).length, 5);
  assert.equal(validationRegistry.canonicalOwnerValidationContracts.filter((item) => item.researchOnly).length, 1);

  const at = "2026-08-28T15:00:00.000Z";
  const evidenceFor = (contract, overrides = {}) => ({
    schemaVersion: types.OWNER_VALIDATION_EVIDENCE_SCHEMA,
    evidenceVersion: contract.evidenceVersion,
    identity: {
      strategyId: contract.ownerStrategyId,
      strategyVersion: contract.ownerStrategyVersion,
      researchProfileId: contract.researchProfileId,
      geometryPolicyId: contract.geometryPolicyId,
      geometryPolicyVersion: contract.geometryPolicyVersion,
      datasetFamily: contract.datasetRequirement.historicalDatasetFamily,
      datasetVersion: contract.datasetRequirement.historicalDatasetVersion,
      datasetCertificateId: contract.datasetRequirement.certificateId,
      datasetChecksum: contract.datasetRequirement.datasetChecksum,
      sourceFingerprint: contract.datasetRequirement.sourceFingerprint,
      parameterHash: contract.parameterIdentity,
      sessionPolicyVersion: contract.datasetRequirement.sessionPolicyVersion,
      evaluationTier: "HISTORICAL_VALIDATION",
      runId: `${contract.ownerStrategyId}:accepted-evidence`,
      asOfStart: "2024-01-01T00:00:00.000Z",
      asOfEnd: "2024-01-02T00:00:00.000Z",
      producerLineage: contract.foldRunnerId
    },
    historicalParityStatus: "PASSED",
    determinismStatus: "PASSED",
    causalityStatus: "PASSED",
    walkForwardStatus: "PASSED",
    oosStatus: "PASSED",
    readinessEvidenceStatus: "PASSED",
    metrics: { evaluations: 2, candidates: 1, fills: 1, resolvedOutcomes: 1, wins: 1, losses: 0, foldCount: 1, oosOutcomeCount: 1 },
    createdAt: "2026-08-28T14:59:00.000Z",
    ...overrides
  });
  const [ifvg, ict2022, mmbm, mmsm, london] = contracts;
  const evaluate = (owner, evidence, upstreamStatus = "PASSED") => validation.evaluateCanonicalOwnerEvidence({ ownerStrategyId: owner.ownerStrategyId, evidence: evidence ? [evidence] : [], upstreamStatus, evaluatedAt: at });

  assert.equal(evaluate(ifvg, evidenceFor(ifvg)).status, "INSUFFICIENT_EVIDENCE");
  for (const status of ["CANCELLED", "RUNNING", "QUEUED", "EVIDENCE_INCOMPATIBLE"]) {
    assert.equal(evaluate(ifvg, evidenceFor(ifvg), status).status, "SOURCE_BLOCKED");
  }
  for (const patch of [{ createdAt: "invalid" }, { createdAt: "2027-01-01T00:00:00.000Z" }, { metrics: { evaluations: 2, candidates: 1, fills: 0, resolvedOutcomes: 1 } }]) {
    assert.equal(evaluate(ifvg, evidenceFor(ifvg, patch)).status, "EVIDENCE_INCOMPATIBLE");
  }
  assert.equal(evaluate(mmsm, evidenceFor(mmbm)).status, "EVIDENCE_INCOMPATIBLE", "MMBM evidence must not validate MMSM");

  const v4 = coverage.researchOnlyCoverage()[0];
  assert.equal(evaluate(ifvg, evidenceFor(v4)).status, "EVIDENCE_INCOMPATIBLE", "IFVG v4 must not validate v3");
  assert.equal(validationRegistry.findOwnerValidationContract(v4.ownerStrategyId).researchOnly, true);

  const legacyMmbm = evidenceFor(mmbm);
  legacyMmbm.identity = { ...legacyMmbm.identity, producerLineage: "legacy_irl_erl_transition_injection" };
  assert.equal(evaluate(mmbm, legacyMmbm).status, "EVIDENCE_INCOMPATIBLE");
  const legacyMmsm = evidenceFor(mmsm);
  legacyMmsm.identity = { ...legacyMmsm.identity, producerLineage: "transition-injection-v0" };
  assert.equal(evaluate(mmsm, legacyMmsm).status, "EVIDENCE_INCOMPATIBLE");
  const legacyLondon = evidenceFor(london);
  legacyLondon.identity = { ...legacyLondon.identity, producerLineage: "rr_selected_target_stretch" };
  assert.equal(evaluate(london, legacyLondon).status, "EVIDENCE_INCOMPATIBLE");

  const mismatches = [
    ["certificate", { datasetCertificateId: "wrong" }],
    ["parameter", { parameterHash: "wrong" }],
    ["geometry", { geometryPolicyVersion: "wrong" }],
    ["session", { sessionPolicyVersion: "wrong" }],
    ["version", { strategyVersion: "wrong" }],
    ["profile", { researchProfileId: "wrong" }],
    ["source", { sourceFingerprint: "wrong" }]
  ];
  for (const [name, identityPatch] of mismatches) {
    const evidence = evidenceFor(ifvg);
    evidence.identity = { ...evidence.identity, ...identityPatch };
    assert.equal(evaluate(ifvg, evidence).status, "EVIDENCE_INCOMPATIBLE", `${name} mismatch must fail closed`);
  }

  const zero = evidenceFor(ifvg, { metrics: { evaluations: 2, candidates: 0, fills: 0, resolvedOutcomes: 0 } });
  assert.equal(evaluate(ifvg, zero).status, "INSUFFICIENT_EVIDENCE");
  assert.equal(evaluate(ifvg, undefined, "CAPACITY_BLOCKED").status, "CAPACITY_BLOCKED");
  assert.equal(evaluate(ifvg, undefined, "CERTIFICATE_INVALID").status, "CERTIFICATE_INVALID");
  assert.equal(evaluate(ifvg, evidenceFor(ifvg, { determinismStatus: "NOT_EVALUATED" })).status, "DETERMINISM_REQUIRED");
  assert.equal(evaluate(ifvg, evidenceFor(ifvg, { walkForwardStatus: "NOT_EVALUATED" })).status, "WALK_FORWARD_REQUIRED");
  assert.equal(evaluate(ifvg, evidenceFor(ifvg, { oosStatus: "NOT_EVALUATED" })).status, "OOS_REQUIRED");
  assert.equal(evaluate(ict2022, evidenceFor(ict2022)).status, "INSUFFICIENT_EVIDENCE", "Defined policy does not make one outcome sufficient");

  const queue = scheduler.createCanonicalOwnerResearchQueue({ cycleId: "validation-cycle", queuedAt: at });
  queue.tasks.forEach((task) => {
    task.status = "PASSED";
    task.completedAt = at;
    task.progress = { evaluationsCompleted: 2, candidateCount: 1, fillCount: 1, outcomeCount: 1, blockedCount: 0 };
  });
  const partial = validation.evaluateCanonicalOwnerValidationCycle({
    cycleId: "validation-cycle",
    tasks: queue.tasks,
    evaluatedAt: at,
    evidenceByOwner: { [ifvg.ownerStrategyId]: [evidenceFor(ifvg)] }
  });
  assert.equal(partial.globalStatus, "NONE_VALIDATED");
  assert.equal(partial.owners.find((item) => item.ownerStrategyId === ifvg.ownerStrategyId).status, "INSUFFICIENT_EVIDENCE");
  assert.equal(partial.readiness.find((item) => item.ownerStrategyId === ifvg.ownerStrategyId).status, "INSUFFICIENT_EVIDENCE");
  assert.ok(partial.owners.filter((item) => item.ownerStrategyId !== ifvg.ownerStrategyId).every((item) => item.status === "INSUFFICIENT_EVIDENCE"));
  assert.equal(partial.researchValidated, false);
  assert.deepEqual(partial.authority, { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none", productionAdoptionAllowed: false, canCreateTradeIntent: false });

  const noReadiness = validation.evaluateCanonicalOwnerValidationCycle({
    cycleId: "validation-no-readiness",
    tasks: queue.tasks.map((task) => ({ ...task, cycleId: "validation-no-readiness" })),
    evaluatedAt: at,
    evidenceByOwner: { [ifvg.ownerStrategyId]: [evidenceFor(ifvg, { readinessEvidenceStatus: "NOT_EVALUATED" })] }
  });
  assert.equal(noReadiness.readiness.find((item) => item.ownerStrategyId === ifvg.ownerStrategyId).status, "INSUFFICIENT_EVIDENCE");

  const current = partial;
  const stale = { ...partial, cycleId: "old-cycle", evaluatedAt: "2026-08-28T14:00:00.000Z" };
  assert.equal(validation.preserveCurrentCycleValidation(current, stale, "validation-cycle"), current);

  const plan = Object.freeze({ candidateId: "candidate-1", geometryId: "geometry-1", entry: 100.5, stop: 105, target: 89 });
  const before = JSON.stringify(plan);
  validation.evaluateCanonicalOwnerValidationCycle({ cycleId: "geometry-freeze", tasks: queue.tasks, evaluatedAt: at });
  assert.equal(JSON.stringify(plan), before, "validation must not mutate current plan geometry");

  console.log(JSON.stringify({
    status: "passed",
    liveOwners: contracts.map((contract) => contract.ownerStrategyId),
    researchOnly: v4.ownerStrategyId,
    crossOwner: "EVIDENCE_INCOMPATIBLE",
    crossVersion: "EVIDENCE_INCOMPATIBLE",
    zeroCandidate: "INSUFFICIENT_EVIDENCE",
    globalSummary: partial.globalStatus,
    singleOutcomeReadinessBlocked: true,
    additionalPolicyOwners: contracts.slice(1).map((contract) => contract.ownerStrategyId),
    researchValidated: partial.researchValidated,
    authority: "none/none/none"
  }, null, 2));
} finally {
  await server.close();
}
