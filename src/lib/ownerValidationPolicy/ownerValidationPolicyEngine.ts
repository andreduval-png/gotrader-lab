import { CANONICAL_LIVE_RESEARCH_OWNER_ORDER, RESEARCH_COVERAGE_AUTHORITY, findResearchCoverage, type CanonicalLiveResearchOwnerId } from "@/lib/researchCoverage";
import { findOwnerPerformancePolicy } from "./ownerPerformancePolicyRegistry";
import { canonicalOwnerTechnicalEvidenceInventory, findOwnerValidationPolicy } from "./ownerValidationPolicyRegistry";
import {
  OWNER_VALIDATION_POLICY_SCHEMA,
  OWNER_VALIDATION_POLICY_EVIDENCE_SCHEMA,
  type CanonicalOwnerPerformancePolicy,
  type CanonicalOwnerPolicyEvaluation,
  type CanonicalOwnerPolicyEvidence,
  type CanonicalOwnerPolicySummary,
  type OwnerEvidenceDeficit,
  type OwnerPolicyEvidenceMetrics
} from "./ownerValidationPolicyTypes";

const emptyMetrics = (): OwnerPolicyEvidenceMetrics => ({
  evaluations: 0, detections: 0, candidates: 0, blockedCandidates: 0, nearMisses: 0,
  validCandidates: 0, fills: 0, notRetraced: 0, entryMissed: 0, targetFirst: 0,
  invalidationFirst: 0, partial: 0, stalled: 0, insufficientFuture: 0, resolvedOutcomes: 0
});

const compatibleEvidence = (evidence: CanonicalOwnerPolicyEvidence | undefined, ownerStrategyId: CanonicalLiveResearchOwnerId) => {
  const policy = findOwnerValidationPolicy(ownerStrategyId);
  const performancePolicy = findOwnerPerformancePolicy(ownerStrategyId);
  const coverage = findResearchCoverage(ownerStrategyId);
  if (!evidence || !policy || !performancePolicy || !coverage) return false;
  const start = Date.parse(evidence.timeRange?.startUtc);
  const end = Date.parse(evidence.timeRange?.endUtc);
  if (typeof evidence.runId !== "string" || !evidence.runId.trim() ||
      typeof evidence.checkpointIdentity !== "string" || !evidence.checkpointIdentity.trim() ||
      !Number.isFinite(start) || !Number.isFinite(end) || start >= end ||
      !["CERTIFIED_HISTORICAL", "WALK_FORWARD", "OOS", "FORWARD_EVIDENCE", "READINESS_EVIDENCE"].includes(evidence.tier)) return false;
  const m = evidence.metrics;
  const optionalCounts = [m.oosWindows, m.oosTrades, m.oosTradesPerWindowMinimum, m.uniqueOosDates,
    m.uniqueOosWeeks, m.uniqueOosMonths, m.independentOosUnits];
  const shares = [m.oosWindowPassRate, m.largestSingleDateShare, m.largestSingleIndependentUnitShare];
  if (optionalCounts.some((value) => value !== undefined && (!Number.isSafeInteger(value) || value < 0)) ||
      shares.some((value) => value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1))) return false;
  const counts = [m.evaluations, m.detections, m.candidates, m.blockedCandidates, m.nearMisses, m.validCandidates,
    m.fills, m.notRetraced, m.entryMissed, m.targetFirst, m.invalidationFirst, m.partial, m.stalled, m.insufficientFuture, m.resolvedOutcomes];
  if (!counts.every((value) => Number.isSafeInteger(value) && value >= 0) ||
      m.fills > m.candidates || m.resolvedOutcomes > m.fills ||
      Object.values(m).some((value) => typeof value === "number" && !Number.isFinite(value))) return false;
  return evidence.schemaVersion === OWNER_VALIDATION_POLICY_EVIDENCE_SCHEMA
    && evidence.evidenceVersion === coverage.evidenceVersion
    && evidence.ownerStrategyId === ownerStrategyId
    && evidence.ownerStrategyVersion === policy.ownerStrategyVersion
    && evidence.policyId === policy.policyId
    && evidence.policyVersion === policy.policyVersion
    && evidence.performancePolicyId === performancePolicy.performancePolicyId
    && evidence.performancePolicyVersion === performancePolicy.performancePolicyVersion
    && evidence.performancePolicyHash === performancePolicy.policyHash
    && performancePolicy.symbolScope.includes(evidence.symbol)
    && evidence.researchProfileId === coverage.researchProfileId
    && evidence.geometryPolicyId === coverage.geometryPolicyId
    && evidence.geometryPolicyVersion === coverage.geometryPolicyVersion
    && evidence.parameterHash === coverage.parameterIdentity
    && evidence.datasetId === coverage.datasetRequirement.historicalDatasetVersion
    && evidence.datasetCertificateId === coverage.datasetRequirement.certificateId
    && evidence.datasetChecksum === coverage.datasetRequirement.datasetChecksum
    && evidence.sourceFingerprint === coverage.datasetRequirement.sourceFingerprint
    && evidence.sessionPolicyVersion === coverage.datasetRequirement.sessionPolicyVersion;
};

const policyOutcomeCount = (policy: CanonicalOwnerPerformancePolicy, metrics: OwnerPolicyEvidenceMetrics) =>
  policy.policyFamily === "IFVG_V3_FROZEN" ? (metrics.oosTrades ?? 0) : metrics.resolvedOutcomes;

const deficitFor = (policy: CanonicalOwnerPerformancePolicy, metrics: OwnerPolicyEvidenceMetrics) => ({
  resolvedOutcomes: Math.max(0, policy.minimumResolvedOutcomes - policyOutcomeCount(policy, metrics)),
  oosWindows: Math.max(0, policy.minimumOosWindows - (metrics.oosWindows ?? 0)),
  resolvedOutcomesPerWindow: Math.max(0, policy.minimumResolvedOutcomesPerWindow - (metrics.oosTradesPerWindowMinimum ?? 0)),
  distinctDates: Math.max(0, policy.minimumDistinctDates - (metrics.uniqueOosDates ?? 0)),
  distinctWeeks: Math.max(0, (policy.minimumDistinctWeeks ?? 0) - (metrics.uniqueOosWeeks ?? 0)),
  distinctMonths: Math.max(0, (policy.minimumDistinctMonths ?? 0) - (metrics.uniqueOosMonths ?? 0)),
  independentUnits: Math.max(0, (policy.minimumIndependentUnits ?? 0) - (metrics.independentOosUnits ?? 0))
});

const insufficiencyCriteria = (policy: CanonicalOwnerPerformancePolicy, metrics: OwnerPolicyEvidenceMetrics) => {
  const criteria = Object.entries(deficitFor(policy, metrics)).filter(([, value]) => value > 0).map(([name]) => name);
  if (policy.policyFamily === "IFVG_V3_FROZEN" && (metrics.candidates <= 0 || metrics.resolvedOutcomes <= 0)) {
    criteria.push("ifvgFrozenCandidateAndResolvedOutcomePresence");
  }
  return criteria;
};

const failedPerformanceCriteria = (policy: CanonicalOwnerPerformancePolicy, metrics: OwnerPolicyEvidenceMetrics) => {
  const failed: string[] = [];
  if ((metrics.oosWindowPassRate ?? Number.NEGATIVE_INFINITY) < policy.minimumWindowPassRate) failed.push("minimumWindowPassRate");
  if ((metrics.largestSingleDateShare ?? Number.POSITIVE_INFINITY) > policy.maximumSingleDateShare) failed.push("maximumSingleDateShare");
  if (policy.maximumSingleIndependentUnitShare !== undefined
    && (metrics.largestSingleIndependentUnitShare ?? Number.POSITIVE_INFINITY) > policy.maximumSingleIndependentUnitShare) failed.push("maximumSingleIndependentUnitShare");
  if (metrics.pooledOosEdgeVerdict !== "positive_edge") failed.push("pooledOosEdgeVerdict");
  if (policy.pooledAverageRMinimumExclusive !== undefined
    && (metrics.expectancyR ?? Number.NEGATIVE_INFINITY) <= policy.pooledAverageRMinimumExclusive) failed.push("expectancyR");
  if (policy.pooledProfitFactorMinimumExclusive !== undefined
    && (metrics.profitFactor ?? Number.NEGATIVE_INFINITY) <= policy.pooledProfitFactorMinimumExclusive) failed.push("profitFactor");
  if ((metrics.stressedAverageR ?? Number.NEGATIVE_INFINITY) <= policy.stressedAverageRMinimumExclusive) failed.push("stressedAverageR");
  if ((metrics.stressedProfitFactor ?? Number.NEGATIVE_INFINITY) <= policy.stressedProfitFactorMinimumExclusive) failed.push("stressedProfitFactor");
  return failed;
};

export const evaluateCanonicalOwnerPolicy = ({ ownerStrategyId, evidence, accumulationStatus }: {
  ownerStrategyId: CanonicalLiveResearchOwnerId;
  evidence?: CanonicalOwnerPolicyEvidence;
  accumulationStatus?: CanonicalOwnerPolicyEvidence["evidenceStatus"];
}): CanonicalOwnerPolicyEvaluation => {
  const policy = findOwnerValidationPolicy(ownerStrategyId);
  const performancePolicy = findOwnerPerformancePolicy(ownerStrategyId);
  const technical = canonicalOwnerTechnicalEvidenceInventory.find((item) => item.ownerStrategyId === ownerStrategyId);
  const coverage = findResearchCoverage(ownerStrategyId);
  if (!policy || !performancePolicy || !technical || !coverage) throw new Error(`Owner policy unavailable: ${ownerStrategyId}`);
  const technicalComplete = technical.identityCompatible
    && technical.ownerStrategyVersion === coverage.ownerStrategyVersion
    && technical.researchProfileId === coverage.researchProfileId
    && technical.geometryPolicyId === coverage.geometryPolicyId
    && technical.geometryPolicyVersion === coverage.geometryPolicyVersion
    && technical.parameterHash === coverage.parameterIdentity
    && technical.datasetCertificateId === coverage.datasetRequirement.certificateId
    && technical.datasetChecksum === coverage.datasetRequirement.datasetChecksum
    && technical.sourceFingerprint === coverage.datasetRequirement.sourceFingerprint
    && technical.sessionPolicyVersion === coverage.datasetRequirement.sessionPolicyVersion
    && technical.historicalParity === "PASSED" && technical.determinism === "PASSED"
    && technical.causality === "PASSED" && technical.checkpointRestart === "PASSED"
    && technical.datasetIntegrity === "PASSED" && technical.fillOutcomeSemantics === "PASSED";
  const metrics = evidence?.metrics ?? emptyMetrics();
  const compatible = compatibleEvidence(evidence, ownerStrategyId);
  const evidenceStatus = accumulationStatus ?? evidence?.evidenceStatus ?? "NO_EVIDENCE";
  const sourceBlocked = ["CAPACITY_BLOCKED", "DATASET_UNAVAILABLE", "CERTIFICATE_INVALID"].includes(evidenceStatus);
  const insufficient = insufficiencyCriteria(performancePolicy, metrics);
  const failedCriteria = insufficient.length === 0 ? failedPerformanceCriteria(performancePolicy, metrics) : [];
  const performancePass = compatible && !sourceBlocked && evidence?.tier === "OOS" && evidenceStatus === "EVIDENCE_COMPLETE_FOR_POLICY" && insufficient.length === 0 && failedCriteria.length === 0;
  const performanceStatus = evidence && !compatible
    ? "PERFORMANCE_EVIDENCE_INCOMPATIBLE" as const
    : sourceBlocked ? "PERFORMANCE_SOURCE_BLOCKED" as const
      : performancePass ? "PERFORMANCE_VALIDATED" as const
        : insufficient.length > 0 ? "INSUFFICIENT_PERFORMANCE_EVIDENCE" as const
          : "PERFORMANCE_POLICY_FAILED" as const;
  const walkForwardStatus = performancePass ? "EVALUATED" as const : "INSUFFICIENT_EVIDENCE" as const;
  const oosStatus = walkForwardStatus;
  const forwardEvidenceStatus = policy.forwardEvidencePolicyStatus === "POLICY_SOURCE_BLOCKED"
    ? "SOURCE_BLOCKED" as const : "INSUFFICIENT_EVIDENCE" as const;
  const deficits: OwnerEvidenceDeficit[] = [];
  if (sourceBlocked) deficits.push("CAPACITY_REQUIRED");
  if (!performancePass) deficits.push("MORE_RESOLVED_OUTCOMES_REQUIRED");
  if (walkForwardStatus !== "EVALUATED") deficits.push("WALK_FORWARD_REQUIRED");
  if (oosStatus !== "EVALUATED") deficits.push("OOS_REQUIRED");
  deficits.push("FORWARD_EVIDENCE_REQUIRED");
  return {
    ownerStrategyId, policyId: policy.policyId, policyVersion: policy.policyVersion,
    performancePolicyId: performancePolicy.performancePolicyId,
    performancePolicyVersion: performancePolicy.performancePolicyVersion,
    performancePolicyHash: performancePolicy.policyHash,
    technicalPolicyStatus: policy.technicalPolicyStatus,
    technicalStatus: technicalComplete ? "TECHNICALLY_VALIDATED" : "TECHNICAL_EVIDENCE_REQUIRED",
    performancePolicyStatus: policy.performancePolicyStatus, performanceStatus, evidenceStatus,
    walkForwardStatus, oosStatus, forwardEvidenceStatus, readinessStatus: "NOT_READY",
    deficits, evidenceDeficit: deficitFor(performancePolicy, metrics), failedCriteria,
    blocker: evidence && !compatible
      ? "Evidence identity does not match the exact owner, symbol, dataset, or immutable performance policy hash."
      : sourceBlocked ? "Certified accumulation is blocked by the current host/source gate."
        : performancePass ? "Fixture-compatible performance evidence passed; separate forward evidence remains unsatisfied."
          : insufficient.length > 0 ? `Compatible evidence is insufficient: ${insufficient.join(", ")}.`
            : `Compatible evidence failed: ${failedCriteria.join(", ")}.`,
    metrics, authority: RESEARCH_COVERAGE_AUTHORITY
  };
};

export const evaluateCanonicalOwnerPolicyCycle = ({ cycleId, evidenceByOwner = {}, accumulationStatusByOwner = {} }: {
  cycleId: string;
  evidenceByOwner?: Partial<Record<CanonicalLiveResearchOwnerId, CanonicalOwnerPolicyEvidence>>;
  accumulationStatusByOwner?: Partial<Record<CanonicalLiveResearchOwnerId, CanonicalOwnerPolicyEvidence["evidenceStatus"]>>;
}): CanonicalOwnerPolicySummary => {
  const owners = CANONICAL_LIVE_RESEARCH_OWNER_ORDER.map((ownerStrategyId) => evaluateCanonicalOwnerPolicy({
    ownerStrategyId, evidence: evidenceByOwner[ownerStrategyId], accumulationStatus: accumulationStatusByOwner[ownerStrategyId]
  }));
  return {
    schemaVersion: OWNER_VALIDATION_POLICY_SCHEMA, cycleId,
    technicallyValidatedCount: owners.filter((owner) => owner.technicalStatus === "TECHNICALLY_VALIDATED").length,
    performanceValidatedCount: owners.filter((owner) => owner.performanceStatus === "PERFORMANCE_VALIDATED").length,
    performancePolicyDefinedCount: owners.filter((owner) => owner.performancePolicyStatus === "POLICY_ACCEPTED").length,
    policyRequiredCount: owners.filter((owner) => owner.performanceStatus === "PERFORMANCE_POLICY_REQUIRED").length,
    researchReadyCount: owners.filter((owner) => owner.readinessStatus === "READY_FOR_RESEARCH_USE").length,
    owners,
    researchOnly: { ownerStrategyId: "ifvg_fresh_retest_v4_candidate", policyStatus: "POLICY_NOT_APPLICABLE", readinessStatus: "NOT_APPLICABLE" },
    researchValidated: false, authority: RESEARCH_COVERAGE_AUTHORITY
  };
};
