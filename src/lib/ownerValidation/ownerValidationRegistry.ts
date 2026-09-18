import { canonicalResearchCoverageRegistry } from "@/lib/researchCoverage";
import { findOwnerPerformancePolicy } from "@/lib/ownerValidationPolicy/ownerPerformancePolicyRegistry";
import type { CanonicalOwnerValidationContract, ThresholdPolicyClassification } from "./ownerValidationTypes";
import { OWNER_VALIDATION_VERSION } from "./ownerValidationTypes";

const thresholdPolicyFor = (ownerStrategyId: string): { policy: ThresholdPolicyClassification; reason: string } => {
  if (findOwnerPerformancePolicy(ownerStrategyId)) {
    return {
      policy: "OWNER_SPECIFIC",
      reason: "A versioned owner performance policy is defined; generic validation evidence cannot satisfy its exact policy identity or quantitative rules."
    };
  }
  if (ownerStrategyId === "ifvg_fresh_retest_v4_candidate") {
    return { policy: "UNDEFINED", reason: "IFVG v4 is research-only and cannot acquire live-owner readiness." };
  }
  return { policy: "UNDEFINED", reason: "No canonical owner performance policy is registered." };
};

export const canonicalOwnerValidationContracts: readonly CanonicalOwnerValidationContract[] = Object.freeze(
  canonicalResearchCoverageRegistry.map((coverage) => {
    const threshold = thresholdPolicyFor(coverage.ownerStrategyId);
    return Object.freeze({
      validationVersion: OWNER_VALIDATION_VERSION,
      ownerStrategyId: coverage.ownerStrategyId,
      strategyVersion: coverage.ownerStrategyVersion,
      researchProfileId: coverage.researchProfileId,
      geometryPolicyId: coverage.geometryPolicyId,
      geometryPolicyVersion: coverage.geometryPolicyVersion,
      parameterHash: coverage.parameterIdentity,
      datasetFamily: coverage.datasetRequirement.historicalDatasetFamily,
      datasetVersion: coverage.datasetRequirement.historicalDatasetVersion,
      datasetCertificateId: coverage.datasetRequirement.certificateId,
      datasetChecksum: coverage.datasetRequirement.datasetChecksum,
      sourceFingerprint: coverage.datasetRequirement.sourceFingerprint,
      sessionPolicyVersion: coverage.datasetRequirement.sessionPolicyVersion,
      evidenceVersion: coverage.evidenceVersion,
      requiredEvidenceTier: "HISTORICAL_VALIDATION" as const,
      requiredHistoricalParityStatus: "PASSED" as const,
      requiredDeterminismStatus: "PASSED" as const,
      requiredCausalityStatus: "PASSED" as const,
      requiredWalkForwardStatus: "PASSED" as const,
      requiredOosStatus: "PASSED" as const,
      thresholdPolicy: threshold.policy,
      thresholdPolicyReason: threshold.reason,
      researchOnly: coverage.runtimeAdmissionStatus === "RESEARCH_ONLY",
      authority: coverage.authority
    });
  })
);

export const findOwnerValidationContract = (ownerStrategyId: string) =>
  canonicalOwnerValidationContracts.find((contract) => contract.ownerStrategyId === ownerStrategyId);
