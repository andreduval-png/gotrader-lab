import type {
  CanonicalLiveResearchOwnerId,
  CanonicalResearchEvidenceIdentity,
  CanonicalResearchStrategyId,
  EvidenceEvaluationTier,
  ResearchAuthority
} from "@/lib/researchCoverage";

export const OWNER_VALIDATION_VERSION = "gotrader.multi-strategy-owner-validation.v1" as const;
export const OWNER_VALIDATION_EVIDENCE_SCHEMA = "gotrader.owner-validation-evidence.v1" as const;

export type OwnerValidationStatus =
  | "NOT_EVALUATED"
  | "INSUFFICIENT_EVIDENCE"
  | "EVIDENCE_INCOMPATIBLE"
  | "DATASET_UNAVAILABLE"
  | "CERTIFICATE_INVALID"
  | "CAPACITY_BLOCKED"
  | "PARITY_REQUIRED"
  | "DETERMINISM_REQUIRED"
  | "CAUSALITY_REQUIRED"
  | "WALK_FORWARD_REQUIRED"
  | "OOS_REQUIRED"
  | "VALIDATION_POLICY_REQUIRED"
  | "VALIDATION_RUNNING"
  | "VALIDATION_PASSED"
  | "VALIDATION_FAILED"
  | "RESEARCH_ONLY"
  | "SOURCE_BLOCKED";

export type OwnerReadinessStatus =
  | "NOT_READY"
  | "VALIDATION_REQUIRED"
  | "INSUFFICIENT_EVIDENCE"
  | "CAPACITY_BLOCKED"
  | "POLICY_REQUIRED"
  | "READY_FOR_RESEARCH_USE"
  | "RESEARCH_ONLY"
  | "SOURCE_BLOCKED"
  | "NOT_APPLICABLE";

export type ValidationRequirementStatus = "PASSED" | "FAILED" | "NOT_EVALUATED";
export type ThresholdPolicyClassification = "EXISTING_ACCEPTED" | "LEGACY_IFVG_ONLY" | "OWNER_NEUTRAL" | "OWNER_SPECIFIC" | "UNDEFINED";

export interface CanonicalOwnerValidationContract {
  validationVersion: typeof OWNER_VALIDATION_VERSION;
  ownerStrategyId: CanonicalResearchStrategyId;
  strategyVersion: string;
  researchProfileId: string;
  geometryPolicyId: string;
  geometryPolicyVersion: string;
  parameterHash: string;
  datasetFamily: string;
  datasetVersion: string;
  datasetCertificateId?: string;
  datasetChecksum?: string;
  sourceFingerprint?: string;
  sessionPolicyVersion: string;
  evidenceVersion: string;
  requiredEvidenceTier: EvidenceEvaluationTier;
  requiredHistoricalParityStatus: "PASSED";
  requiredDeterminismStatus: "PASSED";
  requiredCausalityStatus: "PASSED";
  requiredWalkForwardStatus: "PASSED";
  requiredOosStatus: "PASSED";
  thresholdPolicy: ThresholdPolicyClassification;
  thresholdPolicyReason: string;
  researchOnly: boolean;
  authority: ResearchAuthority;
}

export interface CanonicalOwnerValidationMetrics {
  evaluations: number;
  candidates: number;
  fills: number;
  resolvedOutcomes: number;
  wins?: number;
  losses?: number;
  expectancyR?: number;
  maxDrawdownR?: number;
  profitFactor?: number;
  stabilityScore?: number;
  foldCount?: number;
  oosOutcomeCount?: number;
}

export interface CanonicalOwnerValidationEvidence {
  schemaVersion: typeof OWNER_VALIDATION_EVIDENCE_SCHEMA;
  evidenceVersion: string;
  identity: CanonicalResearchEvidenceIdentity;
  historicalParityStatus: ValidationRequirementStatus;
  determinismStatus: ValidationRequirementStatus;
  causalityStatus: ValidationRequirementStatus;
  walkForwardStatus: ValidationRequirementStatus;
  oosStatus: ValidationRequirementStatus;
  readinessEvidenceStatus: ValidationRequirementStatus;
  metrics: CanonicalOwnerValidationMetrics;
  createdAt: string;
}

export interface CanonicalOwnerValidationRecord {
  ownerStrategyId: CanonicalResearchStrategyId;
  strategyVersion: string;
  researchProfileId: string;
  status: OwnerValidationStatus;
  blocker?: string;
  evidenceIds: string[];
  metrics: CanonicalOwnerValidationMetrics;
  lastEvaluatedAt: string;
  evidenceAgeMs?: number;
  evidenceCompatibility: "CURRENT" | "INCOMPATIBLE" | "MISSING";
  researchValidated: false;
}

export interface CanonicalOwnerReadinessRecord {
  ownerStrategyId: CanonicalResearchStrategyId;
  validationStatus: OwnerValidationStatus;
  status: OwnerReadinessStatus;
  reason: string;
  evidenceIds: string[];
  lastEvaluatedAt: string;
  authority: ResearchAuthority;
}

export type OwnerValidationGlobalStatus = "ALL_VALIDATED" | "PARTIALLY_VALIDATED" | "NONE_VALIDATED" | "VALIDATION_BLOCKED";

export interface CanonicalOwnerValidationSummary {
  schemaVersion: typeof OWNER_VALIDATION_VERSION;
  cycleId: string;
  liveOwnerCount: 5;
  globalStatus: OwnerValidationGlobalStatus;
  owners: CanonicalOwnerValidationRecord[];
  readiness: CanonicalOwnerReadinessRecord[];
  policySummary: import("@/lib/ownerValidationPolicy").CanonicalOwnerPolicySummary;
  researchOnly: {
    ownerStrategyId: "ifvg_fresh_retest_v4_candidate";
    validationStatus: "RESEARCH_ONLY";
    readinessStatus: "NOT_APPLICABLE";
  };
  evaluatedAt: string;
  researchValidated: false;
  authority: ResearchAuthority;
}

export interface EvaluateOwnerValidationInput {
  ownerStrategyId: CanonicalLiveResearchOwnerId;
  evidence?: readonly CanonicalOwnerValidationEvidence[];
  upstreamStatus?: string;
  evaluatedAt: string;
}
