import type {
  CanonicalResearchStrategyId,
  ResearchResourceClass,
  ResearchTier
} from "@/lib/researchCoverage";

export type CanonicalOwnerResearchTaskStatus =
  | "QUEUED"
  | "RUNNING"
  | "PASSED"
  | "PASSED_WITH_ZERO_CANDIDATES"
  | "FAILED"
  | "BLOCKED"
  | "CAPACITY_BLOCKED"
  | "DATASET_UNAVAILABLE"
  | "CERTIFICATE_INVALID"
  | "ADAPTER_BLOCKED"
  | "SKIPPED_BY_POLICY"
  | "INSUFFICIENT_DATA"
  | "EVIDENCE_INCOMPATIBLE"
  | "CANCELLED"
  | "NOT_SUPPORTED";

export interface CanonicalOwnerResearchProgress {
  evaluationsCompleted: number;
  candidateCount: number;
  fillCount: number;
  outcomeCount: number;
  blockedCount: number;
  currentPartition?: string;
  lastProgressAt?: string;
}

export interface CanonicalOwnerResearchTask {
  taskId: string;
  cycleId: string;
  ownerStrategyId: CanonicalResearchStrategyId;
  ownerLabel: string;
  strategyVersion: string;
  researchProfileId: string;
  tier: ResearchTier;
  adapterId?: string;
  foldRunnerId?: string;
  datasetFamily: string;
  datasetVersion: string;
  datasetCertificateId?: string;
  datasetChecksum?: string;
  sourceFingerprint?: string;
  resourceClass: ResearchResourceClass;
  estimatedMemoryMb: number;
  capacityGateEvaluated: boolean;
  datasetGateEvaluated: boolean;
  priority: number;
  liveOwner: boolean;
  researchOnly: boolean;
  status: CanonicalOwnerResearchTaskStatus;
  blocker?: string;
  queuedAt: string;
  startedAt?: string;
  lastProgressAt?: string;
  completedAt?: string;
  queueWaitMs?: number;
  runDurationMs?: number;
  evidenceIds: string[];
  evidence: import("@/lib/researchCoverage").CanonicalResearchEvidenceIdentity[];
  progress: CanonicalOwnerResearchProgress;
}

export type OperatorResearchGlobalStatus =
  | "NOT_STARTED"
  | "LIVE_PLAN_AVAILABLE"
  | "OWNER_RESEARCH_RUNNING"
  | "OWNER_RESEARCH_PARTIAL"
  | "OWNER_RESEARCH_COMPLETE"
  | "COMPLETE_WITH_BLOCKERS"
  | "CANCELLED";

export interface OperatorResearchPerformance {
  cycleStartedAt: string;
  sourcePrepCompletedAt?: string;
  activateMarketCompletedAt?: string;
  planPublishedAt?: string;
  firstOwnerResearchStartedAt?: string;
  firstHistoricalOwnerResearchCompletedAt?: string;
  validationCompleteAt?: string;
  readinessCompleteAt?: string;
  cycleCompletedAt?: string;
  timeToActivateMarketMs?: number;
  timeToLivePlanMs?: number;
  ownerQueueDurationMs?: number;
  validationDurationMs?: number;
  readinessDurationMs?: number;
  cycleTotalMs?: number;
  mt5RequestCount?: number;
  canonicalFactBuildCount: number;
  sharedLiveFetchPlanCount: 1;
  stageDurationsMs: Partial<Record<
    | "SOURCE_PREP"
    | "ACTIVATE_MARKET"
    | "PLAN_PUBLISH"
    | "OWNER_RESEARCH_QUEUE"
    | "IFVG_V3_RESEARCH"
    | "ICT2022_RESEARCH"
    | "MMBM_RESEARCH"
    | "MMSM_RESEARCH"
    | "LONDON_RESEARCH"
    | "IFVG_V4_RESEARCH_ONLY"
    | "VALIDATION"
    | "READINESS"
    | "LLM_ADVISORY"
    | "CYCLE_TOTAL",
    number
  >>;
}

export interface OperatorResearchCycleSummary {
  schemaVersion: "gotrader.operator-owner-research.v1";
  cycleId: string;
  globalStatus: OperatorResearchGlobalStatus;
  liveOwnerTaskCount: 5;
  tasks: CanonicalOwnerResearchTask[];
  researchOnlyTasks: CanonicalOwnerResearchTask[];
  performance: OperatorResearchPerformance;
  livePlanPublished: boolean;
  livePlanPreserved: boolean;
  geometryMutationDetected: false;
  sharedLiveContextCount: 1;
  historicalMt5FallbackUsed: false;
  researchValidated: false;
  ownerValidation?: import("@/lib/ownerValidation").CanonicalOwnerValidationSummary;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}

export interface OperatorResearchDatasetBinding {
  datasetFamily: string;
  datasetVersion: string;
  certificateId: string;
  datasetChecksum: string;
  sourceFingerprint: string;
}

export type OwnerResearchGateResult =
  | { status: "RUN" }
  | { status: "CAPACITY_BLOCKED" | "DATASET_UNAVAILABLE" | "CERTIFICATE_INVALID" | "ADAPTER_BLOCKED" | "SKIPPED_BY_POLICY"; blocker: string; global?: boolean };

export interface OwnerResearchExecutionResult {
  status: "PASSED" | "PASSED_WITH_ZERO_CANDIDATES" | "FAILED" | "BLOCKED" | "INSUFFICIENT_DATA" | "EVIDENCE_INCOMPATIBLE";
  blocker?: string;
  evidenceIds?: readonly string[];
  evidence?: readonly import("@/lib/researchCoverage").CanonicalResearchEvidenceIdentity[];
  progress: Omit<CanonicalOwnerResearchProgress, "lastProgressAt">;
}
