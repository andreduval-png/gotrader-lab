import type { CanonicalLiveResearchOwnerId, ResearchAuthority } from "@/lib/researchCoverage";

export const OWNER_VALIDATION_POLICY_SCHEMA = "gotrader.owner-validation-policy.v1" as const;
export const OWNER_VALIDATION_POLICY_EVIDENCE_SCHEMA = "gotrader.owner-validation-policy-evidence.v1" as const;
export const OWNER_PERFORMANCE_POLICY_SCHEMA = "gotrader.owner-performance-policy.v1" as const;

export type OwnerPolicyStatus =
  | "POLICY_ACCEPTED"
  | "POLICY_PARTIALLY_DEFINED"
  | "POLICY_REQUIRED"
  | "POLICY_NOT_APPLICABLE"
  | "POLICY_SOURCE_BLOCKED";

export type OwnerAccumulationEvidenceStatus =
  | "NO_EVIDENCE"
  | "INSUFFICIENT_EVIDENCE"
  | "EVIDENCE_ACCUMULATING"
  | "EVIDENCE_COMPATIBLE"
  | "EVIDENCE_INCOMPATIBLE"
  | "CERTIFIED_EVIDENCE_AVAILABLE"
  | "CAPACITY_BLOCKED"
  | "DATASET_UNAVAILABLE"
  | "CERTIFICATE_INVALID"
  | "EVIDENCE_COMPLETE_FOR_POLICY";

export type OwnerTechnicalValidationStatus =
  | "TECHNICALLY_VALIDATED"
  | "TECHNICAL_EVIDENCE_REQUIRED"
  | "TECHNICAL_EVIDENCE_INCOMPATIBLE"
  | "TECHNICAL_SOURCE_BLOCKED";

export type OwnerPerformanceValidationStatus =
  | "PERFORMANCE_VALIDATED"
  | "PERFORMANCE_POLICY_FAILED"
  | "PERFORMANCE_POLICY_REQUIRED"
  | "INSUFFICIENT_PERFORMANCE_EVIDENCE"
  | "PERFORMANCE_EVIDENCE_INCOMPATIBLE"
  | "PERFORMANCE_SOURCE_BLOCKED"
  | "NOT_APPLICABLE";

export type OwnerEvidenceDimensionStatus =
  | "EVALUATED"
  | "REQUIRED"
  | "INSUFFICIENT_EVIDENCE"
  | "POLICY_REQUIRED"
  | "SOURCE_BLOCKED"
  | "NOT_APPLICABLE";

export type OwnerThresholdClassification =
  | "OWNER_SPECIFIC_ACCEPTED"
  | "CROSS_OWNER_ACCEPTED"
  | "LEGACY_IFVG_ONLY"
  | "ENGINEERING_RESOURCE_GATE"
  | "STATISTICAL_DIAGNOSTIC_ONLY"
  | "UNSOURCED"
  | "DEPRECATED";

export type OwnerEvidenceDeficit =
  | "MORE_CANDIDATES_REQUIRED"
  | "MORE_RESOLVED_OUTCOMES_REQUIRED"
  | "WALK_FORWARD_REQUIRED"
  | "OOS_REQUIRED"
  | "FORWARD_EVIDENCE_REQUIRED"
  | "DATASET_BINDING_REQUIRED"
  | "POLICY_REQUIRED"
  | "CAPACITY_REQUIRED";

export type OwnerPerformancePolicyBasis =
  | "EXISTING_GOVERNANCE"
  | "STATISTICAL_GOVERNANCE_DECISION"
  | "STRATEGY_STRUCTURE"
  | "ENGINEERING_SAFETY"
  | "NOT_APPLICABLE";

export type OwnerPerformanceSampleUnit =
  | "RESOLVED_FILLED_TRADE"
  | "RESOLVED_DELIVERY_SEQUENCE"
  | "RESOLVED_LONDON_SESSION_TRADE";

export interface OwnerPerformanceThresholdDecision {
  metric: string;
  value: number | string | boolean;
  rationale: string;
  basis: OwnerPerformancePolicyBasis;
  definedBeforeEvidence: true;
}

export interface CanonicalOwnerPerformancePolicy {
  schemaVersion: typeof OWNER_PERFORMANCE_POLICY_SCHEMA;
  performancePolicyId: string;
  performancePolicyVersion: string;
  policyHash: string;
  policyFamily: "IFVG_V3_FROZEN" | "ICT_2022" | "MARKET_MAKER" | "LONDON_RAID";
  ownerStrategyId: CanonicalLiveResearchOwnerId;
  ownerStrategyVersion: string;
  symbolScope: readonly ["MNQ", "USTECH"];
  sampleUnit: OwnerPerformanceSampleUnit;
  minimumResolvedOutcomes: number;
  minimumOosWindows: number;
  minimumResolvedOutcomesPerWindow: number;
  minimumWindowPassRate: number;
  minimumDistinctDates: number;
  minimumDistinctWeeks?: number;
  minimumDistinctMonths?: number;
  minimumIndependentUnits?: number;
  independentUnit: "NOT_APPLICABLE" | "QUALIFYING_DELIVERY_SEQUENCE" | "LONDON_SESSION";
  maximumSingleDateShare: number;
  maximumSingleIndependentUnitShare?: number;
  pooledEdgeRequirement: "POSITIVE_EDGE";
  pooledAverageRMinimumExclusive?: 0;
  pooledProfitFactorMinimumExclusive?: 1;
  stressedAverageRMinimumExclusive: 0;
  stressedProfitFactorMinimumExclusive: 1;
  stressPolicy: string;
  drawdownPolicy: "DIAGNOSTIC_ONLY_R_UNITS";
  forwardEvidenceRequirement: {
    status: "REQUIRED";
    minimumResolvedOutcomes?: number;
    minimumDistinctDates?: number;
    minimumDistinctWeeks?: number;
    unit: "EXACT_PROFILE_RESOLVED_FILLED_TRADE" | "EXACT_OWNER_RESOLVED_DELIVERY_SEQUENCE" | "EXACT_OWNER_RESOLVED_LONDON_SESSION_TRADE";
  };
  denominatorPolicy: string;
  unresolvedPolicy: string;
  governanceDecisions: readonly OwnerPerformanceThresholdDecision[];
  effectiveFrom: string;
  immutableAfterEvidenceBegins: true;
}

export interface CanonicalOwnerThresholdRule {
  metric: string;
  operator: ">" | ">=" | "<=" | "==";
  value: number | string;
  classification: OwnerThresholdClassification;
  source: string;
}

export interface CanonicalOwnerValidationPolicy {
  schemaVersion: typeof OWNER_VALIDATION_POLICY_SCHEMA;
  policyId: string;
  policyVersion: string;
  ownerStrategyId: CanonicalLiveResearchOwnerId;
  ownerStrategyVersion: string;
  effectiveFrom: string;
  governanceBasis: readonly string[];
  technicalPolicyStatus: OwnerPolicyStatus;
  technicalRequirements: readonly string[];
  performancePolicyStatus: OwnerPolicyStatus;
  performancePolicyId: string;
  performancePolicyVersion: string;
  performancePolicyHash: string;
  performanceRules: readonly CanonicalOwnerThresholdRule[];
  walkForwardPolicyStatus: OwnerPolicyStatus;
  oosPolicyStatus: OwnerPolicyStatus;
  forwardEvidencePolicyStatus: OwnerPolicyStatus;
  readinessPolicyStatus: OwnerPolicyStatus;
  readinessRequirements: readonly string[];
  authority: ResearchAuthority;
}

export interface CanonicalOwnerTechnicalEvidenceInventory {
  ownerStrategyId: CanonicalLiveResearchOwnerId;
  ownerStrategyVersion: string;
  policyId: string;
  policyVersion: string;
  researchProfileId: string;
  geometryPolicyId: string;
  geometryPolicyVersion: string;
  parameterHash: string;
  datasetCertificateId: string;
  datasetChecksum: string;
  sourceFingerprint: string;
  sessionPolicyVersion: string;
  identityCompatible: boolean;
  historicalParity: "PASSED" | "NOT_EVALUATED";
  determinism: "PASSED" | "NOT_EVALUATED";
  causality: "PASSED" | "NOT_EVALUATED";
  checkpointRestart: "PASSED" | "NOT_EVALUATED";
  datasetIntegrity: "PASSED" | "NOT_EVALUATED";
  fillOutcomeSemantics: "PASSED" | "NOT_EVALUATED";
  sourceArtifacts: readonly string[];
}

export interface OwnerPolicyEvidenceMetrics {
  evaluations: number;
  detections: number;
  candidates: number;
  blockedCandidates: number;
  nearMisses: number;
  validCandidates: number;
  fills: number;
  notRetraced: number;
  entryMissed: number;
  targetFirst: number;
  invalidationFirst: number;
  partial: number;
  stalled: number;
  insufficientFuture: number;
  resolvedOutcomes: number;
  oosWindows?: number;
  oosTrades?: number;
  oosTradesPerWindowMinimum?: number;
  uniqueOosDates?: number;
  uniqueOosWeeks?: number;
  uniqueOosMonths?: number;
  independentOosUnits?: number;
  largestSingleIndependentUnitShare?: number;
  oosWindowPassRate?: number;
  largestSingleDateShare?: number;
  pooledOosEdgeVerdict?: string;
  stressedAverageR?: number;
  stressedProfitFactor?: number;
  winRate?: number;
  expectancyR?: number;
  profitFactor?: number;
  maxDrawdownR?: number;
}

export interface CanonicalOwnerPolicyEvidence {
  schemaVersion: typeof OWNER_VALIDATION_POLICY_EVIDENCE_SCHEMA;
  evidenceVersion: string;
  runId: string;
  ownerStrategyId: CanonicalLiveResearchOwnerId;
  ownerStrategyVersion: string;
  policyId: string;
  policyVersion: string;
  performancePolicyId: string;
  performancePolicyVersion: string;
  performancePolicyHash: string;
  symbol: "MNQ" | "USTECH";
  researchProfileId: string;
  geometryPolicyId: string;
  geometryPolicyVersion: string;
  parameterHash: string;
  datasetId: string;
  datasetCertificateId: string;
  datasetChecksum: string;
  sourceFingerprint: string;
  sessionPolicyVersion: string;
  tier: "CERTIFIED_HISTORICAL" | "WALK_FORWARD" | "OOS" | "FORWARD_EVIDENCE" | "READINESS_EVIDENCE";
  timeRange: { startUtc: string; endUtc: string };
  checkpointIdentity: string;
  evidenceStatus: OwnerAccumulationEvidenceStatus;
  metrics: OwnerPolicyEvidenceMetrics;
}

export interface CanonicalOwnerPolicyEvaluation {
  ownerStrategyId: CanonicalLiveResearchOwnerId;
  policyId: string;
  policyVersion: string;
  performancePolicyId: string;
  performancePolicyVersion: string;
  performancePolicyHash: string;
  technicalPolicyStatus: OwnerPolicyStatus;
  technicalStatus: OwnerTechnicalValidationStatus;
  performancePolicyStatus: OwnerPolicyStatus;
  performanceStatus: OwnerPerformanceValidationStatus;
  evidenceStatus: OwnerAccumulationEvidenceStatus;
  walkForwardStatus: OwnerEvidenceDimensionStatus;
  oosStatus: OwnerEvidenceDimensionStatus;
  forwardEvidenceStatus: OwnerEvidenceDimensionStatus;
  readinessStatus: "READY_FOR_RESEARCH_USE" | "NOT_READY";
  deficits: OwnerEvidenceDeficit[];
  evidenceDeficit: {
    resolvedOutcomes: number;
    oosWindows: number;
    resolvedOutcomesPerWindow: number;
    distinctDates: number;
    distinctWeeks: number;
    distinctMonths: number;
    independentUnits: number;
  };
  failedCriteria: string[];
  blocker?: string;
  metrics: OwnerPolicyEvidenceMetrics;
  authority: ResearchAuthority;
}

export interface CanonicalOwnerPolicySummary {
  schemaVersion: typeof OWNER_VALIDATION_POLICY_SCHEMA;
  cycleId: string;
  technicallyValidatedCount: number;
  performanceValidatedCount: number;
  performancePolicyDefinedCount: number;
  policyRequiredCount: number;
  researchReadyCount: number;
  owners: CanonicalOwnerPolicyEvaluation[];
  researchOnly: { ownerStrategyId: "ifvg_fresh_retest_v4_candidate"; policyStatus: "POLICY_NOT_APPLICABLE"; readinessStatus: "NOT_APPLICABLE" };
  researchValidated: false;
  authority: ResearchAuthority;
}
