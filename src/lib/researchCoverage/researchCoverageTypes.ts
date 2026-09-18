export const RESEARCH_COVERAGE_CONTRACT_VERSION = "gotrader.rc1a.research-coverage.v1" as const;

export type CanonicalLiveResearchOwnerId =
  | "ifvg_fresh_retest_v3_research"
  | "ict_2022_model_v1"
  | "ict_market_maker_buy_model_v1"
  | "ict_market_maker_sell_model_v1"
  | "nasdaq_london_raid_ny_reversal_v1";

export type CanonicalResearchStrategyId =
  | CanonicalLiveResearchOwnerId
  | "ifvg_fresh_retest_v4_candidate";

export type ResearchParticipationState =
  | "SUPPORTED"
  | "SUPPORTED_WITH_LIMITATIONS"
  | "RESEARCH_ONLY"
  | "LIVE_ONLY"
  | "ADAPTER_REQUIRED"
  | "FOLD_RUNNER_REQUIRED"
  | "DATASET_REQUIRED"
  | "SOURCE_BLOCKED"
  | "NOT_APPLICABLE"
  | "DISABLED_BY_POLICY"
  | "HISTORICAL_REMEDIATION_REQUIRED"
  | "OUT_OF_PARITY";

export type ResearchTier =
  | "TACTICAL_RESEARCH"
  | "HISTORICAL_VALIDATION"
  | "WALK_FORWARD"
  | "OOS"
  | "READINESS"
  | "FORWARD_EVIDENCE";

export type ResearchResourceClass = "LIGHT" | "MEDIUM" | "HEAVY" | "CERTIFIED_HEAVY";

export type ResearchCoverageBlockerCode =
  | "HISTORICAL_ADAPTER_NOT_ADOPTED"
  | "HISTORICAL_SEMANTICS_OUT_OF_PARITY"
  | "FOLD_RUNNER_NOT_ADOPTED"
  | "FOLD_RUNNER_OUT_OF_PARITY"
  | "CERTIFIED_DATASET_NOT_BOUND"
  | "OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"
  | "OWNER_SPECIFIC_TACTICAL_ADAPTER_MISSING"
  | "IFVG_V3_G23_PARITY_UNVERIFIED"
  | "ICT_2022_V2_PARITY_UNVERIFIED"
  | "MARKET_MAKER_DH4_SEQUENCE_REQUIRED"
  | "LONDON_TARGET_POLICY_PARITY_UNRESOLVED"
  | "RESEARCH_ONLY_NOT_LIVE_OWNER";

export interface ResearchTierPolicy {
  tier: ResearchTier;
  status: ResearchParticipationState;
  supported: boolean;
  reason: string;
  blockers: readonly ResearchCoverageBlockerCode[];
}

export interface ResearchDatasetRequirement {
  liveRequirementId: string;
  historicalDatasetFamily: string;
  historicalDatasetVersion: string;
  certificateRequirement: "REQUIRED" | "NOT_APPLICABLE";
  certificateId?: string;
  datasetChecksum?: string;
  sourceFingerprintRequirement: "EXACT" | "NOT_APPLICABLE";
  sourceFingerprint?: string;
  timezonePolicy: string;
  sessionPolicyVersion: string;
  continuityRequirement: string;
  completedBarPolicy: "COMPLETED_BARS_ONLY";
  providerFallback: "PROHIBITED";
}

export interface ResearchWindowContract {
  contextRequirementId: string;
  warmupRequirement: string;
  evaluationRequirement: string;
  maximumContextBars?: number;
  maximumEvaluationBars?: number;
  minimumCalendarDays?: number;
}

export interface ResearchResourceBudget {
  resourceClass: ResearchResourceClass;
  estimatedMemoryMb: number;
  supportsCheckpoint: boolean;
  supportsBoundedBatch: boolean;
  schedulingPolicy: "SERIAL" | "BOUNDED_CONCURRENCY";
  maximumStrategyConcurrency: number;
  sharedCanonicalContextRequired: boolean;
}

export interface ResearchAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
  productionAdoptionAllowed: false;
  canCreateTradeIntent: false;
}

export interface CanonicalResearchCoverageContract {
  contractVersion: typeof RESEARCH_COVERAGE_CONTRACT_VERSION;
  ownerStrategyId: CanonicalResearchStrategyId;
  ownerStrategyVersion: string;
  researchProfileId: string;
  runtimeAdmissionStatus: "LIVE_OWNER" | "RESEARCH_ONLY";
  liveFactComplete: boolean;
  geometryPolicyId: string;
  geometryPolicyVersion: string;
  parameterIdentity: string;
  tacticalResearchPolicy: ResearchTierPolicy;
  historicalValidationPolicy: ResearchTierPolicy;
  walkForwardPolicy: ResearchTierPolicy;
  oosPolicy: ResearchTierPolicy;
  readinessPolicy: ResearchTierPolicy;
  forwardEvidencePolicy: ResearchTierPolicy;
  historicalGeometryAdapterId?: string;
  foldRunnerId?: string;
  datasetRequirement: ResearchDatasetRequirement;
  researchWindow: ResearchWindowContract;
  validationWindow: ResearchWindowContract;
  evidenceNamespace: string;
  evidenceVersion: string;
  resourceBudget: ResearchResourceBudget;
  blockers: readonly ResearchCoverageBlockerCode[];
  reason: string;
  authority: ResearchAuthority;
}

export type EvidenceEvaluationTier = Exclude<ResearchTier, "READINESS">;

export interface CanonicalResearchEvidenceIdentity {
  strategyId: CanonicalResearchStrategyId;
  strategyVersion: string;
  researchProfileId: string;
  geometryPolicyId: string;
  geometryPolicyVersion: string;
  datasetFamily: string;
  datasetVersion: string;
  datasetCertificateId: string;
  datasetChecksum: string;
  sourceFingerprint: string;
  parameterHash: string;
  sessionPolicyVersion: string;
  evaluationTier: EvidenceEvaluationTier;
  runId: string;
  asOfStart: string;
  asOfEnd: string;
  producerLineage: string;
}

export type EvidenceCompatibilityCode =
  | "COMPATIBLE"
  | "STRATEGY_ID_MISMATCH"
  | "STRATEGY_VERSION_MISMATCH"
  | "PROFILE_MISMATCH"
  | "GEOMETRY_POLICY_MISMATCH"
  | "DATASET_IDENTITY_MISMATCH"
  | "PARAMETER_IDENTITY_MISMATCH"
  | "SESSION_POLICY_MISMATCH"
  | "TIER_NOT_SUPPORTED"
  | "LEGACY_TRANSITION_LINEAGE"
  | "LEGACY_LONDON_TARGET_POLICY"
  | "INSUFFICIENT_IDENTITY";

export interface EvidenceCompatibilityResult {
  compatible: boolean;
  classification:
    | "CURRENT_AUTHORITATIVE"
    | "CURRENT_RESEARCH_ONLY"
    | "LEGACY_COMPATIBILITY"
    | "QUARANTINED"
    | "INVALIDATED_BY_POLICY_CHANGE"
    | "INSUFFICIENT_IDENTITY";
  codes: readonly EvidenceCompatibilityCode[];
  reason: string;
}

export interface CanonicalResearchOwnerStatus {
  strategyId: CanonicalResearchStrategyId;
  strategyVersion: string;
  researchProfileId: string;
  runtimeAdmissionStatus: CanonicalResearchCoverageContract["runtimeAdmissionStatus"];
  tacticalStatus: ResearchParticipationState;
  validationStatus: ResearchParticipationState;
  walkForwardStatus: ResearchParticipationState;
  oosStatus: ResearchParticipationState;
  readinessStatus: ResearchParticipationState;
  blockers: readonly ResearchCoverageBlockerCode[];
  evidenceIds: readonly string[];
}

export interface CanonicalResearchCoverageSnapshot {
  contractVersion: typeof RESEARCH_COVERAGE_CONTRACT_VERSION;
  cycleId: string;
  asOf: string;
  livePlanStatus: "AVAILABLE" | "NO_TRADE" | "UNAVAILABLE";
  livePlanReason: string;
  ownerResearchStatuses: readonly CanonicalResearchOwnerStatus[];
  blockedOwners: readonly CanonicalLiveResearchOwnerId[];
  researchOnlyStrategies: readonly CanonicalResearchStrategyId[];
  validationStatus: "AVAILABLE" | "PARTIAL" | "BLOCKED";
  readinessStatus: "AVAILABLE" | "PARTIAL" | "BLOCKED";
  timings: Readonly<Record<string, number>>;
  authority: ResearchAuthority;
}
