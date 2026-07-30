export const CANONICAL_RESEARCH_JOB_SCHEMA_VERSION =
  "gotrader-b1-canonical-research-job-v1";
export const CANONICAL_RESEARCH_STAGE_SCHEMA_VERSION =
  "gotrader-b1-canonical-research-stage-v1";
export const CANONICAL_RESEARCH_CHECKPOINT_SCHEMA_VERSION =
  "gotrader-b1-canonical-research-checkpoint-v1";
export const CANONICAL_RESEARCH_RESULT_SCHEMA_VERSION =
  "gotrader-b1-canonical-research-result-v1";
export const CANONICAL_RESEARCH_PROJECTION_SCHEMA_VERSION =
  "gotrader-b1-canonical-research-projection-v1";

export type CanonicalResearchJobType =
  | "context_lineage"
  | "strategy_shadow";

export type CanonicalResearchJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled"
  | "expired";

export type CanonicalResearchStageName =
  | "job_admission"
  | "input_verification"
  | "context_rebuild"
  | "context_identity_verification"
  | "adapter_detection"
  | "result_validation"
  | "result_seal"
  | "projection_update";

export type CanonicalResearchStageStatus =
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled"
  | "expired";

export type CanonicalResearchResultClassification =
  | "context_lineage_verified"
  | "context_lineage_blocked"
  | "strategy_shadow_detected"
  | "strategy_shadow_rejected"
  | "strategy_shadow_blocked"
  | "strategy_shadow_expired";

export type CanonicalResearchExecutionAuthority = "none";
export type CanonicalResearchBrokerAuthority = "none";
export type CanonicalResearchReadinessOverrideAuthority = "none";

export interface CanonicalResearchAuthority {
  readonly executionAuthority: CanonicalResearchExecutionAuthority;
  readonly brokerAuthority: CanonicalResearchBrokerAuthority;
  readonly readinessOverrideAuthority: CanonicalResearchReadinessOverrideAuthority;
}

export interface CanonicalResearchCapabilities {
  readonly productionAdoptionAllowed: false;
  readonly canCreateEvidence: false;
  readonly canApproveReadiness: false;
  readonly canApplyCalibration: false;
  readonly canCreateTradeIntent: false;
}

export type CanonicalResearchBlockerCode = string;

export type CanonicalResearchCompactValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalResearchCompactValue[]
  | { readonly [key: string]: CanonicalResearchCompactValue };

export interface CanonicalResearchJobRequest {
  readonly jobType: CanonicalResearchJobType;
  readonly jobVersion: string;
  readonly requestedAt: string;
  readonly triggerEventId: string;
  readonly triggerCandleIdentity: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly primaryTimeframe: string;
  readonly contextArtifactId: string;
  readonly contextIdentity: string;
  readonly strategyId?: string;
  readonly profileId?: string;
  readonly profileVersion?: string;
  readonly parameterHash?: string;
  readonly costModelId?: string;
  readonly requiredFacts: readonly string[];
  readonly requiredTimeframes: readonly string[];
  readonly sourceFingerprint: string;
  readonly timeContractId: string;
  readonly schemaVersions: Readonly<Record<string, string>>;
  readonly shadowOnly: true;
  readonly authority: CanonicalResearchAuthority;
  readonly capabilities?: CanonicalResearchCapabilities;
}

export interface CanonicalResearchJobIdentityCore {
  readonly jobType: CanonicalResearchJobType;
  readonly jobVersion: string;
  readonly triggerEventId: string;
  readonly triggerCandleIdentity: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly primaryTimeframe: string;
  readonly contextArtifactId: string;
  readonly contextIdentity: string;
  readonly strategyId?: string;
  readonly profileId?: string;
  readonly profileVersion?: string;
  readonly parameterHash?: string;
  readonly costModelId?: string;
  readonly requiredFacts: readonly string[];
  readonly requiredTimeframes: readonly string[];
  readonly sourceFingerprint: string;
  readonly timeContractId: string;
  readonly schemaVersions: Readonly<Record<string, string>>;
}

export interface CanonicalResearchJobIdentity {
  readonly schemaVersion: typeof CANONICAL_RESEARCH_JOB_SCHEMA_VERSION;
  readonly hashVersion: "gotrader-v2-sha256-v1";
  readonly logicalJobId: string;
  readonly payloadHash: string;
  readonly identityCore: CanonicalResearchJobIdentityCore;
}

export interface CanonicalResearchStageArtifact {
  readonly schemaVersion: typeof CANONICAL_RESEARCH_STAGE_SCHEMA_VERSION;
  readonly stageArtifactId: string;
  readonly stageName: CanonicalResearchStageName;
  readonly stageVersion: string;
  readonly logicalJobId: string;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly inputArtifactIds: readonly string[];
  readonly previousStageArtifactId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly status: CanonicalResearchStageStatus;
  readonly outputSummary: Readonly<Record<string, CanonicalResearchCompactValue>>;
  readonly blockers: readonly CanonicalResearchBlockerCode[];
  readonly warnings: readonly string[];
  readonly payloadHash: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly authority: CanonicalResearchAuthority;
  readonly capabilities: CanonicalResearchCapabilities;
}

export interface CanonicalResearchJobCheckpoint {
  readonly schemaVersion: typeof CANONICAL_RESEARCH_CHECKPOINT_SCHEMA_VERSION;
  readonly logicalJobId: string;
  readonly status: CanonicalResearchJobStatus;
  readonly currentStage: CanonicalResearchStageName | "queued";
  readonly completedStageArtifactIds: readonly string[];
  readonly pendingNextStage?: CanonicalResearchStageName;
  readonly retryCount: number;
  readonly cancelRequestedAt?: string;
  readonly leaseOwner?: string;
  readonly leaseExpiresAt?: string;
  readonly lastHeartbeatAt?: string;
  readonly blocker?: CanonicalResearchBlockerCode;
  readonly nextAction: string;
  readonly authority: CanonicalResearchAuthority;
  readonly capabilities: CanonicalResearchCapabilities;
}

export interface CanonicalResearchResultArtifact {
  readonly schemaVersion: typeof CANONICAL_RESEARCH_RESULT_SCHEMA_VERSION;
  readonly resultArtifactId: string;
  readonly identity: CanonicalResearchJobIdentity;
  readonly classification: CanonicalResearchResultClassification;
  readonly sealedAt: string;
  readonly causalTimestamps: Readonly<Record<string, string>>;
  readonly geometry?: Readonly<Record<string, CanonicalResearchCompactValue>>;
  readonly diagnostics: readonly string[];
  readonly blockers: readonly CanonicalResearchBlockerCode[];
  readonly sourceLineageNodeKeys: readonly string[];
  readonly contextLineageNodeKeys: readonly string[];
  readonly shadowOnly: true;
  readonly canCreateEvidence: false;
  readonly readinessChanged: false;
  readonly productionAdoptionAllowed: false;
  readonly authority: CanonicalResearchAuthority;
  readonly capabilities: CanonicalResearchCapabilities;
}

export interface CanonicalResearchProjection {
  readonly schemaVersion: typeof CANONICAL_RESEARCH_PROJECTION_SCHEMA_VERSION;
  readonly logicalJobId: string;
  readonly status: CanonicalResearchJobStatus;
  readonly currentStage: CanonicalResearchStageName | "queued";
  readonly strategyId?: string;
  readonly profileId?: string;
  readonly profileVersion?: string;
  readonly sourceStatus: "available" | "degraded" | "unavailable";
  readonly resultClassification?: CanonicalResearchResultClassification;
  readonly blockers: readonly CanonicalResearchBlockerCode[];
  readonly nextAction: string;
  readonly artifactIds: readonly string[];
  readonly freshness: "fresh" | "stale" | "unknown";
  readonly shadowOnly: true;
  readonly authority: CanonicalResearchAuthority;
  readonly capabilities: CanonicalResearchCapabilities;
}

export interface CanonicalResearchValidationAccepted {
  readonly accepted: true;
  readonly blockers: readonly [];
  readonly request: CanonicalResearchJobRequest;
  readonly authority: CanonicalResearchAuthority;
  readonly capabilities: CanonicalResearchCapabilities;
}

export interface CanonicalResearchValidationBlocked {
  readonly accepted: false;
  readonly blockers: readonly CanonicalResearchBlockerCode[];
}

export type CanonicalResearchValidationResult =
  | CanonicalResearchValidationAccepted
  | CanonicalResearchValidationBlocked;

export type CanonicalResearchDuplicateDisposition =
  | "different_logical_job"
  | "coalesce_idempotently"
  | "quarantine_payload_conflict";

export interface CanonicalResearchDuplicateResult {
  readonly disposition: CanonicalResearchDuplicateDisposition;
  readonly blocker?: "logical_job_payload_conflict";
  readonly logicalJobId: string;
  readonly payloadHash: string;
}

export interface CanonicalResearchSealValidationResult {
  readonly allowed: boolean;
  readonly blockers: readonly CanonicalResearchBlockerCode[];
}
