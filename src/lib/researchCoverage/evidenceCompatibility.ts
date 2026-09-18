import { findResearchCoverage } from "./canonicalResearchCoverageRegistry";
import type {
  CanonicalResearchEvidenceIdentity,
  EvidenceCompatibilityCode,
  EvidenceCompatibilityResult
} from "./researchCoverageTypes";

const required = (value: unknown) => typeof value === "string" && value.trim().length > 0;

export const evaluateResearchEvidenceCompatibility = (
  evidence: CanonicalResearchEvidenceIdentity,
  expectedStrategyId?: string
): EvidenceCompatibilityResult => {
  if (expectedStrategyId && evidence.strategyId !== expectedStrategyId) {
    return { compatible: false, classification: "QUARANTINED", codes: ["STRATEGY_ID_MISMATCH"], reason: `Evidence belongs to ${evidence.strategyId}, not ${expectedStrategyId}.` };
  }
  const contract = findResearchCoverage(evidence.strategyId);
  if (!contract || ![
    evidence.strategyVersion,
    evidence.researchProfileId,
    evidence.geometryPolicyId,
    evidence.geometryPolicyVersion,
    evidence.datasetFamily,
    evidence.datasetVersion,
    evidence.datasetCertificateId,
    evidence.datasetChecksum,
    evidence.sourceFingerprint,
    evidence.parameterHash,
    evidence.sessionPolicyVersion,
    evidence.runId,
    evidence.asOfStart,
    evidence.asOfEnd,
    evidence.producerLineage
  ].every(required) || !Number.isFinite(Date.parse(evidence.asOfStart)) ||
      !Number.isFinite(Date.parse(evidence.asOfEnd)) || Date.parse(evidence.asOfStart) >= Date.parse(evidence.asOfEnd)) {
    return { compatible: false, classification: "INSUFFICIENT_IDENTITY", codes: ["INSUFFICIENT_IDENTITY"], reason: "Evidence is missing a registered owner or one or more mandatory identity fields." };
  }

  if (/irl[_-]erl[_-]transition|transition[_-]injection/i.test(evidence.producerLineage) &&
      (evidence.strategyId === "ict_market_maker_buy_model_v1" || evidence.strategyId === "ict_market_maker_sell_model_v1")) {
    return { compatible: false, classification: "QUARANTINED", codes: ["LEGACY_TRANSITION_LINEAGE"], reason: "Legacy transition-injection evidence cannot validate the DH4 delivery-sequence owner." };
  }

  if (/rr[_-]selected[_-]target|target[_-]stretch/i.test(evidence.producerLineage) && evidence.strategyId === "nasdaq_london_raid_ny_reversal_v1") {
    return { compatible: false, classification: "INVALIDATED_BY_POLICY_CHANGE", codes: ["LEGACY_LONDON_TARGET_POLICY"], reason: "London evidence generated under R:R-selected target policy is not current-owner evidence." };
  }

  if (
    evidence.strategyId === "nasdaq_london_raid_ny_reversal_v1" &&
    (evidence.geometryPolicyId !== contract.geometryPolicyId || evidence.geometryPolicyVersion !== contract.geometryPolicyVersion)
  ) {
    return { compatible: false, classification: "INVALIDATED_BY_POLICY_CHANGE", codes: ["LEGACY_LONDON_TARGET_POLICY"], reason: "London evidence generated before nearest-native-objective policy v2 is invalidated by the target-policy change." };
  }

  const codes: EvidenceCompatibilityCode[] = [];
  if (evidence.strategyVersion !== contract.ownerStrategyVersion) codes.push("STRATEGY_VERSION_MISMATCH");
  if (evidence.researchProfileId !== contract.researchProfileId) codes.push("PROFILE_MISMATCH");
  if (evidence.geometryPolicyId !== contract.geometryPolicyId || evidence.geometryPolicyVersion !== contract.geometryPolicyVersion) codes.push("GEOMETRY_POLICY_MISMATCH");
  if (
    evidence.datasetFamily !== contract.datasetRequirement.historicalDatasetFamily ||
    evidence.datasetVersion !== contract.datasetRequirement.historicalDatasetVersion ||
    (contract.datasetRequirement.certificateRequirement === "REQUIRED" && evidence.datasetCertificateId !== contract.datasetRequirement.certificateId) ||
    (contract.datasetRequirement.datasetChecksum && evidence.datasetChecksum !== contract.datasetRequirement.datasetChecksum) ||
    (contract.datasetRequirement.sourceFingerprintRequirement === "EXACT" && contract.datasetRequirement.sourceFingerprint !== "FROZEN_PROFILE_SOURCE_BINDING_REQUIRED" && evidence.sourceFingerprint !== contract.datasetRequirement.sourceFingerprint)
  ) codes.push("DATASET_IDENTITY_MISMATCH");
  if (evidence.parameterHash !== contract.parameterIdentity) codes.push("PARAMETER_IDENTITY_MISMATCH");
  if (evidence.sessionPolicyVersion !== contract.datasetRequirement.sessionPolicyVersion) codes.push("SESSION_POLICY_MISMATCH");

  const tierPolicy = evidence.evaluationTier === "TACTICAL_RESEARCH" ? contract.tacticalResearchPolicy
    : evidence.evaluationTier === "HISTORICAL_VALIDATION" ? contract.historicalValidationPolicy
      : evidence.evaluationTier === "WALK_FORWARD" ? contract.walkForwardPolicy
        : evidence.evaluationTier === "OOS" ? contract.oosPolicy
          : evidence.evaluationTier === "FORWARD_EVIDENCE" ? contract.forwardEvidencePolicy : undefined;
  if (!tierPolicy?.supported) codes.push("TIER_NOT_SUPPORTED");

  if (codes.length) {
    return { compatible: false, classification: "QUARANTINED", codes, reason: `Evidence does not match ${contract.ownerStrategyId} exactly: ${codes.join(", ")}.` };
  }

  return {
    compatible: true,
    classification: contract.runtimeAdmissionStatus === "RESEARCH_ONLY" ? "CURRENT_RESEARCH_ONLY" : "CURRENT_AUTHORITATIVE",
    codes: ["COMPATIBLE"],
    reason: "Evidence identity exactly matches the registered owner and supported tier."
  };
};
