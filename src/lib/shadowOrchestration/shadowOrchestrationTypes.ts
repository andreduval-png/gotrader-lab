import type { V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";

export const SHADOW_JOB_SCHEMA = "gotrader-v2-shadow-research-job-v1" as const;
export const SHADOW_STAGE_SCHEMA = "gotrader-v2-shadow-stage-artifact-v1" as const;
export const SHADOW_CHECKPOINT_SCHEMA = "gotrader-v2-shadow-orchestration-checkpoint-v1" as const;
export const SHADOW_SEAL_SCHEMA = "gotrader-v2-shadow-terminal-seal-v1" as const;
export const SHADOW_PROJECTION_SCHEMA = "gotrader-v2-shadow-operator-projection-v1" as const;

export const SHADOW_ORCHESTRATION_AUTHORITY = Object.freeze({
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
});

export type ShadowStageStatus = "completed" | "blocked" | "failed" | "cancelled" | "skipped";
export type ShadowTerminalStatus = "completed" | "blocked" | "failed" | "cancelled";

export interface ShadowStageDefinition {
  stageName: string;
  stageVersion: string;
  required: boolean;
  retryLimit: number;
}

export interface ShadowResearchJob {
  schemaVersion: typeof SHADOW_JOB_SCHEMA;
  jobVersion: "v1";
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  jobType: string;
  jobTypeVersion: string;
  inputArtifactIds: readonly string[];
  compactInput: Readonly<Record<string, string | number | boolean | null>>;
  stages: readonly Readonly<ShadowStageDefinition>[];
  shadowOnly: true;
  currentResearchCycleAuthoritative: true;
  runtimeAdoptionAllowed: false;
  authority: typeof SHADOW_ORCHESTRATION_AUTHORITY;
  logicalJobId: string;
}

export interface ShadowStageArtifact {
  schemaVersion: typeof SHADOW_STAGE_SCHEMA;
  stageVersion: string;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  logicalJobId: string;
  stageName: string;
  stageOrdinal: number;
  attemptId: string;
  attemptNumber: number;
  inputArtifactIds: readonly string[];
  previousStageArtifactId: string;
  status: ShadowStageStatus;
  outputSummary: Readonly<Record<string, string | number | boolean | null>>;
  blockers: readonly string[];
  warnings: readonly string[];
  retryLimit: number;
  shadowOnly: true;
  runtimeAdoptionAllowed: false;
  authority: typeof SHADOW_ORCHESTRATION_AUTHORITY;
  stageArtifactId: string;
}

export interface ShadowOrchestrationCheckpoint {
  schemaVersion: typeof SHADOW_CHECKPOINT_SCHEMA;
  checkpointVersion: "v1";
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  logicalJobId: string;
  nextStageOrdinal: number;
  orderedStageArtifactIds: readonly string[];
  heartbeatSequence: number;
  cancellationRequested: boolean;
  terminalStatus?: ShadowTerminalStatus;
  previousCheckpointId: string;
  shadowOnly: true;
  authority: typeof SHADOW_ORCHESTRATION_AUTHORITY;
  checkpointId: string;
}

export interface ShadowTerminalSeal {
  schemaVersion: typeof SHADOW_SEAL_SCHEMA;
  sealVersion: "v1";
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  logicalJobId: string;
  terminalStatus: ShadowTerminalStatus;
  orderedStageArtifactIds: readonly string[];
  terminalCheckpointId: string;
  stageChainRoot: string;
  shadowOnly: true;
  runtimeAdoptionAllowed: false;
  authority: typeof SHADOW_ORCHESTRATION_AUTHORITY;
  terminalSealId: string;
}

export interface ShadowOperatorProjection {
  schemaVersion: typeof SHADOW_PROJECTION_SCHEMA;
  projectionVersion: "v1";
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  logicalJobId: string;
  terminalStatus: ShadowTerminalStatus;
  completedStageCount: number;
  totalStageCount: number;
  lastStageName: string;
  blockers: readonly string[];
  warnings: readonly string[];
  terminalSealId: string;
  terminalCheckpointId: string;
  shadowOnly: true;
  currentResearchCycleAuthoritative: true;
  runtimeAdoptionAllowed: false;
  authority: typeof SHADOW_ORCHESTRATION_AUTHORITY;
  projectionId: string;
}

export interface ShadowStageHandlerResult {
  status?: "completed" | "blocked" | "skipped";
  outputSummary?: Readonly<Record<string, string | number | boolean | null>>;
  blockers?: readonly string[];
  warnings?: readonly string[];
}

export type ShadowStageHandler = (context: Readonly<{
  job: Readonly<ShadowResearchJob>;
  stage: Readonly<ShadowStageDefinition>;
  stageOrdinal: number;
  attemptNumber: number;
  previousStageArtifactId: string;
}>) => Promise<Readonly<ShadowStageHandlerResult>> | Readonly<ShadowStageHandlerResult>;
