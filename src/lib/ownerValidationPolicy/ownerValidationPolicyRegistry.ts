import { ifvgFreshRetestV3FrozenProfile } from "@/lib/forwardEvidence/frozenProfileRegistry";
import { canonicalLiveResearchCoverage, RESEARCH_COVERAGE_AUTHORITY } from "@/lib/researchCoverage";
import {
  OWNER_VALIDATION_POLICY_SCHEMA,
  type CanonicalOwnerTechnicalEvidenceInventory,
  type CanonicalOwnerValidationPolicy
} from "./ownerValidationPolicyTypes";
import { findOwnerPerformancePolicy } from "./ownerPerformancePolicyRegistry";

const technicalRequirements: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ifvg_fresh_retest_v3_research: Object.freeze([
    "G2.3 canonical producer geometry and four-point MNQ stop policy",
    "ENTRY_MISSED, ENTRY_NOT_RETRACED, and retracement lifecycle parity",
    "historical fill/outcome semantics, determinism, causality, checkpoint restart, and certified dataset integrity"
  ]),
  ict_2022_model_v1: Object.freeze([
    "entry, stop, target, external draw, raid, retrace, entry-missed, and consumed-target live/historical parity",
    "causal fold execution, determinism, checkpoint restart, and certified dataset integrity"
  ]),
  ict_market_maker_buy_model_v1: Object.freeze([
    "DH4 MarketMakerDeliverySequence with canonical range, PD_LOCATION, consumed liquidity, displacement, later same-range FVG, and opposite external objective",
    "same-range provenance, live/historical parity, determinism, checkpoint restart, and certified dataset integrity"
  ]),
  ict_market_maker_sell_model_v1: Object.freeze([
    "DH4 MarketMakerDeliverySequence with canonical range, PD_LOCATION, consumed liquidity, displacement, later same-range FVG, and opposite external objective",
    "same-range provenance, live/historical parity, determinism, checkpoint restart, and certified dataset integrity"
  ]),
  nasdaq_london_raid_ny_reversal_v1: Object.freeze([
    "session/DST correctness and native objective identity",
    "nearest-native-objective-before-R:R with below-R:R preservation and no farther target",
    "causality, live/historical parity, determinism, checkpoint restart, and certified dataset integrity"
  ])
});

const technicalSources: Readonly<Record<string, readonly string[]>> = Object.freeze({
  ifvg_fresh_retest_v3_research: Object.freeze(["G2.3", "RC1B IFVG v3 parity", "BT-G1.2 deterministic fold runner"]),
  ict_2022_model_v1: Object.freeze(["INT-3A ICT 2022", "RC1B ICT 2022 parity", "BT-G1.2 deterministic fold runner"]),
  ict_market_maker_buy_model_v1: Object.freeze(["DH4/DH4.1 MMBM", "RC1B MMBM parity", "BT-G1.2 deterministic fold runner"]),
  ict_market_maker_sell_model_v1: Object.freeze(["DH4/DH4.1 MMSM", "RC1B MMSM parity", "BT-G1.2 deterministic fold runner"]),
  nasdaq_london_raid_ny_reversal_v1: Object.freeze(["London Raid v1 target remediation", "RC1B London parity", "BT-G1.2 deterministic fold runner"])
});

const ifvgPerformanceRules = Object.freeze([
  { metric: "minimumOosWindows", operator: ">=" as const, value: ifvgFreshRetestV3FrozenProfile.walkForwardRequirements.minimumOosWindows, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: "ifvgFreshRetestV3FrozenProfile.walkForwardRequirements" },
  { metric: "minimumOosTrades", operator: ">=" as const, value: ifvgFreshRetestV3FrozenProfile.walkForwardRequirements.minimumOosTrades, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: "ifvgFreshRetestV3FrozenProfile.walkForwardRequirements" },
  { metric: "minimumTradesPerWindow", operator: ">=" as const, value: ifvgFreshRetestV3FrozenProfile.walkForwardRequirements.minimumTradesPerWindow, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: "ifvgFreshRetestV3FrozenProfile.walkForwardRequirements" },
  { metric: "minimumUniqueDates", operator: ">=" as const, value: ifvgFreshRetestV3FrozenProfile.walkForwardRequirements.minimumUniqueDates, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: "ifvgFreshRetestV3FrozenProfile.walkForwardRequirements" },
  { metric: "minimumWindowPassRate", operator: ">=" as const, value: ifvgFreshRetestV3FrozenProfile.walkForwardRequirements.minimumWindowPassRate, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: "ifvgFreshRetestV3FrozenProfile.walkForwardRequirements" },
  { metric: "maximumSingleDateShare", operator: "<=" as const, value: ifvgFreshRetestV3FrozenProfile.walkForwardRequirements.maximumSingleDateShare, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: "ifvgFreshRetestV3FrozenProfile.walkForwardRequirements" },
  { metric: "pooledOosEdgeVerdict", operator: "==" as const, value: "positive_edge", classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: "detectorProfileWalkForward historical gate" },
  { metric: "stressedAverageR", operator: ">" as const, value: 0, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: "detectorProfileWalkForward 0.5R cost stress" },
  { metric: "stressedProfitFactor", operator: ">" as const, value: 1, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: "detectorProfileWalkForward 0.5R cost stress" }
]);

export const canonicalOwnerValidationPolicyRegistry: readonly CanonicalOwnerValidationPolicy[] = Object.freeze(
  canonicalLiveResearchCoverage().map((coverage) => {
    const ifvg = coverage.ownerStrategyId === "ifvg_fresh_retest_v3_research";
    const performancePolicy = findOwnerPerformancePolicy(coverage.ownerStrategyId);
    if (!performancePolicy) throw new Error(`Owner performance policy unavailable: ${coverage.ownerStrategyId}`);
    return Object.freeze({
      schemaVersion: OWNER_VALIDATION_POLICY_SCHEMA,
      policyId: `gotrader.owner-policy.${coverage.ownerStrategyId}`,
      policyVersion: ifvg ? "1.0.0-frozen-ifvg-v3" : "2.0.0-performance-policy-defined",
      ownerStrategyId: coverage.ownerStrategyId,
      ownerStrategyVersion: coverage.ownerStrategyVersion,
      effectiveFrom: "2026-08-28T00:00:00.000Z",
      governanceBasis: Object.freeze([...(technicalSources[coverage.ownerStrategyId] ?? []), ifvg ? "IFVG v3 frozen profile policy" : "Owner performance policy defined before evidence accumulation"]),
      technicalPolicyStatus: "POLICY_ACCEPTED" as const,
      technicalRequirements: technicalRequirements[coverage.ownerStrategyId] ?? Object.freeze([]),
      performancePolicyStatus: "POLICY_ACCEPTED" as const,
      performancePolicyId: performancePolicy.performancePolicyId,
      performancePolicyVersion: performancePolicy.performancePolicyVersion,
      performancePolicyHash: performancePolicy.policyHash,
      performanceRules: ifvg ? ifvgPerformanceRules : Object.freeze([
        { metric: "minimumResolvedOutcomes", operator: ">=" as const, value: performancePolicy.minimumResolvedOutcomes, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: performancePolicy.performancePolicyId },
        { metric: "minimumOosWindows", operator: ">=" as const, value: performancePolicy.minimumOosWindows, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: performancePolicy.performancePolicyId },
        { metric: "minimumResolvedOutcomesPerWindow", operator: ">=" as const, value: performancePolicy.minimumResolvedOutcomesPerWindow, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: performancePolicy.performancePolicyId },
        { metric: "minimumDistinctDates", operator: ">=" as const, value: performancePolicy.minimumDistinctDates, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: performancePolicy.performancePolicyId },
        { metric: "minimumWindowPassRate", operator: ">=" as const, value: performancePolicy.minimumWindowPassRate, classification: "CROSS_OWNER_ACCEPTED" as const, source: performancePolicy.performancePolicyId },
        { metric: "maximumSingleDateShare", operator: "<=" as const, value: performancePolicy.maximumSingleDateShare, classification: "OWNER_SPECIFIC_ACCEPTED" as const, source: performancePolicy.performancePolicyId },
        { metric: "pooledOosEdgeVerdict", operator: "==" as const, value: "positive_edge", classification: "CROSS_OWNER_ACCEPTED" as const, source: performancePolicy.performancePolicyId },
        { metric: "stressedAverageR", operator: ">" as const, value: 0, classification: "CROSS_OWNER_ACCEPTED" as const, source: performancePolicy.performancePolicyId },
        { metric: "stressedProfitFactor", operator: ">" as const, value: 1, classification: "CROSS_OWNER_ACCEPTED" as const, source: performancePolicy.performancePolicyId }
      ]),
      walkForwardPolicyStatus: "POLICY_ACCEPTED" as const,
      oosPolicyStatus: "POLICY_ACCEPTED" as const,
      forwardEvidencePolicyStatus: coverage.forwardEvidencePolicy.status === "ADAPTER_REQUIRED" ? "POLICY_SOURCE_BLOCKED" as const : "POLICY_PARTIALLY_DEFINED" as const,
      readinessPolicyStatus: "POLICY_PARTIALLY_DEFINED" as const,
      readinessRequirements: Object.freeze(ifvg
        ? ["technical validation complete", "IFVG v3 performance policy complete", "compatible walk-forward/OOS complete", "required exact-profile forward evidence complete"]
        : ["technical validation complete", "exact owner performance policy evidence complete", "separate exact-owner forward evidence complete"]),
      authority: RESEARCH_COVERAGE_AUTHORITY
    });
  })
);

export const canonicalOwnerTechnicalEvidenceInventory: readonly CanonicalOwnerTechnicalEvidenceInventory[] = Object.freeze(
  canonicalOwnerValidationPolicyRegistry.map((policy) => {
    const coverage = canonicalLiveResearchCoverage().find((item) => item.ownerStrategyId === policy.ownerStrategyId);
    if (!coverage) throw new Error(`Owner coverage unavailable: ${policy.ownerStrategyId}`);
    return Object.freeze({
    ownerStrategyId: policy.ownerStrategyId,
    ownerStrategyVersion: policy.ownerStrategyVersion,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    researchProfileId: coverage.researchProfileId,
    geometryPolicyId: coverage.geometryPolicyId,
    geometryPolicyVersion: coverage.geometryPolicyVersion,
    parameterHash: coverage.parameterIdentity,
    datasetCertificateId: coverage.datasetRequirement.certificateId ?? "",
    datasetChecksum: coverage.datasetRequirement.datasetChecksum ?? "",
    sourceFingerprint: coverage.datasetRequirement.sourceFingerprint ?? "",
    sessionPolicyVersion: coverage.datasetRequirement.sessionPolicyVersion,
    identityCompatible: true,
    historicalParity: "NOT_EVALUATED" as const,
    determinism: "NOT_EVALUATED" as const,
    causality: "NOT_EVALUATED" as const,
    checkpointRestart: "NOT_EVALUATED" as const,
    datasetIntegrity: "NOT_EVALUATED" as const,
    fillOutcomeSemantics: "NOT_EVALUATED" as const,
    sourceArtifacts: technicalSources[policy.ownerStrategyId] ?? Object.freeze([])
    });
  })
);

export const findOwnerValidationPolicy = (ownerStrategyId: string) =>
  canonicalOwnerValidationPolicyRegistry.find((policy) => policy.ownerStrategyId === ownerStrategyId);
