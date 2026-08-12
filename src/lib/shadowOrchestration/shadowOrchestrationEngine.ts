import { canonicalHash, canonicalSerialize, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import {
  SHADOW_CHECKPOINT_SCHEMA,
  SHADOW_JOB_SCHEMA,
  SHADOW_ORCHESTRATION_AUTHORITY,
  SHADOW_PROJECTION_SCHEMA,
  SHADOW_SEAL_SCHEMA,
  SHADOW_STAGE_SCHEMA,
  type ShadowOperatorProjection,
  type ShadowOrchestrationCheckpoint,
  type ShadowResearchJob,
  type ShadowStageArtifact,
  type ShadowStageDefinition,
  type ShadowStageHandler,
  type ShadowStageStatus,
  type ShadowTerminalSeal,
  type ShadowTerminalStatus
} from "./shadowOrchestrationTypes";

const HASH = /^sha256:[0-9a-f]{64}$/;
const GENESIS = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
const FORBIDDEN_COMPACT_KEYS = /(?:account|broker|candle|credential|execution|order|password|position|secret|token|trade)/i;
const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort();
const compact = (value: Readonly<Record<string, string | number | boolean | null>> = {}) => {
  if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("Shadow compact payload must be a record.");
  for (const [key, item] of Object.entries(value)) {
    if (!key.trim() || FORBIDDEN_COMPACT_KEYS.test(key)) throw new Error("Shadow compact payload contains a forbidden field.");
    if (item !== null && !["string", "number", "boolean"].includes(typeof item)) throw new Error("Shadow compact payload contains a non-compact value.");
    if (typeof item === "number" && !Number.isFinite(item)) throw new Error("Shadow compact payload contains a non-finite number.");
  }
  return Object.freeze({ ...value });
};
const exact = (left: unknown, right: unknown) => canonicalSerialize(left) === canonicalSerialize(right);
const authorityIsNone = (value: unknown) => exact(value, SHADOW_ORCHESTRATION_AUTHORITY);
const without = <T extends Record<string, unknown>>(value: T, key: keyof T) => {
  const copy = { ...value };
  delete copy[key];
  return copy;
};

async function validateIdentity(value: Record<string, unknown>, identityKey: string, schema: string) {
  if (value.schemaVersion !== schema || value.hashVersion !== V2_CANONICAL_HASH_VERSION || !HASH.test(String(value[identityKey] ?? ""))) return false;
  return canonicalHash(without(value, identityKey)).then((identity) => identity === value[identityKey]);
}

function stageChainMatches(job: Readonly<ShadowResearchJob>, artifacts: readonly Readonly<ShadowStageArtifact>[]) {
  return artifacts.every((artifact, ordinal) => {
    const registration = job.stages[ordinal];
    const previousStageArtifactId = ordinal === 0 ? GENESIS : artifacts[ordinal - 1].stageArtifactId;
    const expectedInputs = ordinal === 0 ? job.inputArtifactIds : [previousStageArtifactId];
    return registration !== undefined && artifact.logicalJobId === job.logicalJobId && artifact.stageOrdinal === ordinal &&
      artifact.stageName === registration.stageName && artifact.stageVersion === registration.stageVersion &&
      artifact.retryLimit === registration.retryLimit && artifact.attemptNumber >= 1 && artifact.attemptNumber <= registration.retryLimit + 1 &&
      artifact.previousStageArtifactId === previousStageArtifactId && exact(artifact.inputArtifactIds, expectedInputs);
  });
}

export async function validateShadowResearchJob(job: Readonly<ShadowResearchJob>) {
  try { compact(job.compactInput); } catch { return false; }
  return job.jobVersion === "v1" && job.shadowOnly === true && job.currentResearchCycleAuthoritative === true &&
    job.runtimeAdoptionAllowed === false && authorityIsNone(job.authority) && Boolean(job.jobType.trim()) && Boolean(job.jobTypeVersion.trim()) &&
    job.inputArtifactIds.every((id) => HASH.test(id)) && job.stages.length > 0 &&
    uniqueSorted(job.stages.map((stage) => stage.stageName)).length === job.stages.length &&
    job.stages.every((stage) => Boolean(stage.stageName.trim()) && Boolean(stage.stageVersion.trim()) && Number.isInteger(stage.retryLimit) && stage.retryLimit >= 0 && stage.retryLimit <= 3) &&
    await validateIdentity(job as unknown as Record<string, unknown>, "logicalJobId", SHADOW_JOB_SCHEMA);
}
export async function validateShadowStageArtifact(artifact: Readonly<ShadowStageArtifact>) {
  try { compact(artifact.outputSummary); } catch { return false; }
  return artifact.shadowOnly === true && artifact.runtimeAdoptionAllowed === false && authorityIsNone(artifact.authority) &&
    HASH.test(artifact.logicalJobId) && HASH.test(artifact.attemptId) && HASH.test(artifact.previousStageArtifactId) &&
    artifact.inputArtifactIds.every((id) => HASH.test(id)) && Number.isInteger(artifact.stageOrdinal) && artifact.stageOrdinal >= 0 &&
    Number.isInteger(artifact.attemptNumber) && artifact.attemptNumber >= 1 && Number.isInteger(artifact.retryLimit) && artifact.retryLimit >= 0 &&
    ["completed", "blocked", "failed", "cancelled", "skipped"].includes(artifact.status) &&
    await validateIdentity(artifact as unknown as Record<string, unknown>, "stageArtifactId", SHADOW_STAGE_SCHEMA);
}
export async function validateShadowCheckpoint(checkpoint: Readonly<ShadowOrchestrationCheckpoint>) {
  return checkpoint.checkpointVersion === "v1" && checkpoint.shadowOnly === true && authorityIsNone(checkpoint.authority) &&
    HASH.test(checkpoint.logicalJobId) && HASH.test(checkpoint.previousCheckpointId) && checkpoint.orderedStageArtifactIds.every((id) => HASH.test(id)) &&
    Number.isInteger(checkpoint.nextStageOrdinal) && checkpoint.nextStageOrdinal >= 0 && checkpoint.nextStageOrdinal === checkpoint.orderedStageArtifactIds.length &&
    Number.isInteger(checkpoint.heartbeatSequence) && checkpoint.heartbeatSequence >= 0 &&
    await validateIdentity(checkpoint as unknown as Record<string, unknown>, "checkpointId", SHADOW_CHECKPOINT_SCHEMA);
}
export async function validateShadowTerminalSeal(seal: Readonly<ShadowTerminalSeal>) {
  return seal.sealVersion === "v1" && seal.shadowOnly === true && seal.runtimeAdoptionAllowed === false && authorityIsNone(seal.authority) &&
    HASH.test(seal.logicalJobId) && HASH.test(seal.terminalCheckpointId) && HASH.test(seal.stageChainRoot) && seal.orderedStageArtifactIds.every((id) => HASH.test(id)) &&
    ["completed", "blocked", "failed", "cancelled"].includes(seal.terminalStatus) &&
    await validateIdentity(seal as unknown as Record<string, unknown>, "terminalSealId", SHADOW_SEAL_SCHEMA);
}
export async function validateShadowOperatorProjection(projection: Readonly<ShadowOperatorProjection>) {
  return projection.projectionVersion === "v1" && projection.shadowOnly === true && projection.currentResearchCycleAuthoritative === true &&
    projection.runtimeAdoptionAllowed === false && authorityIsNone(projection.authority) && HASH.test(projection.logicalJobId) &&
    HASH.test(projection.terminalSealId) && HASH.test(projection.terminalCheckpointId) && Number.isInteger(projection.completedStageCount) &&
    Number.isInteger(projection.totalStageCount) && projection.completedStageCount >= 0 && projection.completedStageCount <= projection.totalStageCount &&
    await validateIdentity(projection as unknown as Record<string, unknown>, "projectionId", SHADOW_PROJECTION_SCHEMA);
}

export class ShadowStageExecutionError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "ShadowStageExecutionError";
  }
}

export async function buildShadowResearchJob(input: Readonly<{
  jobType: string;
  jobTypeVersion: string;
  inputArtifactIds: readonly string[];
  compactInput: Readonly<Record<string, string | number | boolean | null>>;
  stages: readonly Readonly<ShadowStageDefinition>[];
}>) {
  if (!input.jobType.trim() || !input.jobTypeVersion.trim()) throw new Error("Shadow job identity is incomplete.");
  if (!input.stages.length) throw new Error("Shadow job requires at least one stage.");
  if (input.inputArtifactIds.some((id) => !HASH.test(id))) throw new Error("Shadow job input identity is invalid.");
  const names = input.stages.map((stage) => stage.stageName);
  if (uniqueSorted(names).length !== names.length) throw new Error("Shadow job rejects duplicate stage names.");
  input.stages.forEach((stage) => {
    if (!stage.stageName.trim() || !stage.stageVersion.trim() || !Number.isInteger(stage.retryLimit) || stage.retryLimit < 0 || stage.retryLimit > 3) {
      throw new Error("Shadow stage registration is invalid.");
    }
  });
  const stages = Object.freeze(input.stages.map((stage) => Object.freeze({ ...stage })));
  const core = Object.freeze({
    schemaVersion: SHADOW_JOB_SCHEMA,
    jobVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    jobType: input.jobType,
    jobTypeVersion: input.jobTypeVersion,
    inputArtifactIds: Object.freeze([...input.inputArtifactIds]),
    compactInput: compact(input.compactInput),
    stages,
    shadowOnly: true as const,
    currentResearchCycleAuthoritative: true as const,
    runtimeAdoptionAllowed: false as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return Object.freeze({ ...core, logicalJobId: await canonicalHash(core) }) as Readonly<ShadowResearchJob>;
}

const buildCheckpoint = async (input: Omit<ShadowOrchestrationCheckpoint, "schemaVersion" | "checkpointVersion" | "hashVersion" | "shadowOnly" | "authority" | "checkpointId">) => {
  const core = Object.freeze({
    schemaVersion: SHADOW_CHECKPOINT_SCHEMA,
    checkpointVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    ...input,
    orderedStageArtifactIds: Object.freeze([...input.orderedStageArtifactIds]),
    shadowOnly: true as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return Object.freeze({ ...core, checkpointId: await canonicalHash(core) }) as Readonly<ShadowOrchestrationCheckpoint>;
};

export const buildInitialShadowCheckpoint = (job: Readonly<ShadowResearchJob>) => buildCheckpoint({
  logicalJobId: job.logicalJobId,
  nextStageOrdinal: 0,
  orderedStageArtifactIds: Object.freeze([]),
  heartbeatSequence: 0,
  cancellationRequested: false,
  previousCheckpointId: GENESIS
});

const buildStageArtifact = async (input: Omit<ShadowStageArtifact, "schemaVersion" | "hashVersion" | "shadowOnly" | "runtimeAdoptionAllowed" | "authority" | "stageArtifactId">) => {
  const core = Object.freeze({
    schemaVersion: SHADOW_STAGE_SCHEMA,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    ...input,
    inputArtifactIds: Object.freeze([...input.inputArtifactIds]),
    outputSummary: compact(input.outputSummary),
    blockers: Object.freeze(uniqueSorted(input.blockers)),
    warnings: Object.freeze(uniqueSorted(input.warnings)),
    shadowOnly: true as const,
    runtimeAdoptionAllowed: false as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return Object.freeze({ ...core, stageArtifactId: await canonicalHash(core) }) as Readonly<ShadowStageArtifact>;
};

const terminalFor = (artifacts: readonly Readonly<ShadowStageArtifact>[]): ShadowTerminalStatus => {
  if (artifacts.some((artifact) => artifact.status === "cancelled")) return "cancelled";
  if (artifacts.some((artifact) => artifact.status === "failed")) return "failed";
  if (artifacts.some((artifact) => artifact.status === "blocked")) return "blocked";
  return "completed";
};

export async function buildShadowTerminalSeal(job: Readonly<ShadowResearchJob>, checkpoint: Readonly<ShadowOrchestrationCheckpoint>, artifacts: readonly Readonly<ShadowStageArtifact>[]) {
  if (!await validateShadowResearchJob(job) || !await validateShadowCheckpoint(checkpoint) || !(await Promise.all(artifacts.map(validateShadowStageArtifact))).every(Boolean)) {
    throw new Error("Shadow terminal seal rejects invalid evidence identities.");
  }
  if (!stageChainMatches(job, artifacts)) throw new Error("Shadow terminal seal rejects an invalid stage chain.");
  if (checkpoint.logicalJobId !== job.logicalJobId || checkpoint.nextStageOrdinal !== job.stages.length || artifacts.length !== job.stages.length) {
    throw new Error("Shadow terminal seal requires a complete matching stage chain.");
  }
  if (!exact(checkpoint.orderedStageArtifactIds, artifacts.map((artifact) => artifact.stageArtifactId))) throw new Error("Shadow terminal stage chain mismatch.");
  const terminalStatus = terminalFor(artifacts);
  if (checkpoint.terminalStatus !== terminalStatus) throw new Error("Shadow terminal checkpoint status mismatch.");
  const stageChainRoot = await canonicalHash(artifacts.map((artifact) => artifact.stageArtifactId));
  const core = Object.freeze({
    schemaVersion: SHADOW_SEAL_SCHEMA,
    sealVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    logicalJobId: job.logicalJobId,
    terminalStatus,
    orderedStageArtifactIds: Object.freeze(artifacts.map((artifact) => artifact.stageArtifactId)),
    terminalCheckpointId: checkpoint.checkpointId,
    stageChainRoot,
    shadowOnly: true as const,
    runtimeAdoptionAllowed: false as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return Object.freeze({ ...core, terminalSealId: await canonicalHash(core) }) as Readonly<ShadowTerminalSeal>;
}

export async function materializeShadowOperatorProjection(job: Readonly<ShadowResearchJob>, seal: Readonly<ShadowTerminalSeal>, artifacts: readonly Readonly<ShadowStageArtifact>[]) {
  if (!await validateShadowResearchJob(job) || !await validateShadowTerminalSeal(seal) || !(await Promise.all(artifacts.map(validateShadowStageArtifact))).every(Boolean) ||
      !stageChainMatches(job, artifacts) || seal.logicalJobId !== job.logicalJobId || !exact(seal.orderedStageArtifactIds, artifacts.map((artifact) => artifact.stageArtifactId))) {
    throw new Error("Shadow projection rejects invalid terminal evidence.");
  }
  const core = Object.freeze({
    schemaVersion: SHADOW_PROJECTION_SCHEMA,
    projectionVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    logicalJobId: job.logicalJobId,
    terminalStatus: seal.terminalStatus,
    completedStageCount: artifacts.filter((artifact) => artifact.status === "completed").length,
    totalStageCount: job.stages.length,
    lastStageName: artifacts[artifacts.length - 1]?.stageName ?? "none",
    blockers: Object.freeze(uniqueSorted(artifacts.flatMap((artifact) => artifact.blockers))),
    warnings: Object.freeze(uniqueSorted(artifacts.flatMap((artifact) => artifact.warnings))),
    terminalSealId: seal.terminalSealId,
    terminalCheckpointId: seal.terminalCheckpointId,
    shadowOnly: true as const,
    currentResearchCycleAuthoritative: true as const,
    runtimeAdoptionAllowed: false as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return Object.freeze({ ...core, projectionId: await canonicalHash(core) }) as Readonly<ShadowOperatorProjection>;
}

export class InMemoryShadowOrchestrationRepository {
  private readonly jobs = new Map<string, string>();
  private readonly artifacts = new Map<string, string>();
  private readonly checkpoints = new Map<string, Readonly<ShadowOrchestrationCheckpoint>>();
  private readonly seals = new Map<string, string>();

  writeJob(job: Readonly<ShadowResearchJob>) { return this.writeImmutable(this.jobs, job.logicalJobId, job, "job"); }
  writeArtifact(artifact: Readonly<ShadowStageArtifact>) { return this.writeImmutable(this.artifacts, artifact.stageArtifactId, artifact, "stage artifact"); }
  writeSeal(seal: Readonly<ShadowTerminalSeal>) { return this.writeImmutable(this.seals, seal.terminalSealId, seal, "terminal seal"); }
  writeCheckpoint(checkpoint: Readonly<ShadowOrchestrationCheckpoint>) {
    const current = this.checkpoints.get(checkpoint.logicalJobId);
    if (current && checkpoint.heartbeatSequence < current.heartbeatSequence) throw new Error("Shadow checkpoint heartbeat regression.");
    if (current && checkpoint.heartbeatSequence === current.heartbeatSequence && !exact(current, checkpoint)) throw new Error("Shadow checkpoint heartbeat conflict.");
    this.checkpoints.set(checkpoint.logicalJobId, checkpoint);
  }
  readCheckpoint(logicalJobId: string) { return this.checkpoints.get(logicalJobId); }
  private writeImmutable(store: Map<string, string>, id: string, value: unknown, label: string) {
    const serialized = canonicalSerialize(value);
    const existing = store.get(id);
    if (existing !== undefined && existing !== serialized) throw new Error(`Immutable shadow ${label} conflict.`);
    store.set(id, serialized);
    return existing === undefined ? "persisted" as const : "coalesced" as const;
  }
}

export async function runShadowOrchestration(input: Readonly<{
  job: Readonly<ShadowResearchJob>;
  handlers: Readonly<Record<string, ShadowStageHandler>>;
  repository?: InMemoryShadowOrchestrationRepository;
  checkpoint?: Readonly<ShadowOrchestrationCheckpoint>;
  priorArtifacts?: readonly Readonly<ShadowStageArtifact>[];
  interruptAfterStages?: number;
  cancelBeforeStage?: number;
}>) {
  const repository = input.repository ?? new InMemoryShadowOrchestrationRepository();
  if (!await validateShadowResearchJob(input.job)) throw new Error("Shadow orchestration rejects an invalid job identity.");
  repository.writeJob(input.job);
  let checkpoint = input.checkpoint ?? await buildInitialShadowCheckpoint(input.job);
  const artifacts = [...(input.priorArtifacts ?? [])];
  if (!await validateShadowCheckpoint(checkpoint) || !(await Promise.all(artifacts.map(validateShadowStageArtifact))).every(Boolean)) {
    throw new Error("Shadow resume evidence identity is invalid.");
  }
  if (checkpoint.logicalJobId !== input.job.logicalJobId || checkpoint.nextStageOrdinal !== artifacts.length ||
      !exact(checkpoint.orderedStageArtifactIds, artifacts.map((artifact) => artifact.stageArtifactId)) || !stageChainMatches(input.job, artifacts)) {
    throw new Error("Shadow resume checkpoint is inconsistent.");
  }
  let stopStatus: Exclude<ShadowStageStatus, "completed" | "skipped"> | undefined;
  for (let ordinal = checkpoint.nextStageOrdinal; ordinal < input.job.stages.length; ordinal += 1) {
    const stage = input.job.stages[ordinal];
    const previousStageArtifactId = artifacts[artifacts.length - 1]?.stageArtifactId ?? GENESIS;
    let status: ShadowStageStatus = "skipped";
    let outputSummary: Readonly<Record<string, string | number | boolean | null>> = {};
    let blockers: readonly string[] = [];
    let warnings: readonly string[] = [];
    let attemptNumber = 1;
    if (stopStatus) {
      blockers = [`upstream_${stopStatus}`];
    } else if (input.cancelBeforeStage === ordinal) {
      status = "cancelled";
      blockers = ["cancellation_requested_before_stage"];
      stopStatus = "cancelled";
    } else {
      const handler = input.handlers[stage.stageName];
      if (!handler) {
        status = stage.required ? "blocked" : "skipped";
        blockers = ["stage_handler_missing"];
        if (stage.required) stopStatus = "blocked";
      } else {
        for (attemptNumber = 1; attemptNumber <= stage.retryLimit + 1; attemptNumber += 1) {
          try {
            const result = await handler({ job: input.job, stage, stageOrdinal: ordinal, attemptNumber, previousStageArtifactId });
            status = result.status ?? "completed";
            outputSummary = result.outputSummary ?? {};
            blockers = result.blockers ?? [];
            warnings = result.warnings ?? [];
            if (status === "blocked") stopStatus = "blocked";
            break;
          } catch (error) {
            const retryable = error instanceof ShadowStageExecutionError && error.retryable;
            if (!retryable || attemptNumber > stage.retryLimit) {
              status = retryable ? "failed" : "blocked";
              blockers = [error instanceof Error ? error.message : String(error)];
              stopStatus = status;
              break;
            }
          }
        }
      }
    }
    const attemptId = await canonicalHash({ logicalJobId: input.job.logicalJobId, stageName: stage.stageName, stageOrdinal: ordinal, attemptNumber });
    const artifact = await buildStageArtifact({
      stageVersion: stage.stageVersion,
      logicalJobId: input.job.logicalJobId,
      stageName: stage.stageName,
      stageOrdinal: ordinal,
      attemptId,
      attemptNumber,
      inputArtifactIds: ordinal === 0 ? input.job.inputArtifactIds : [previousStageArtifactId],
      previousStageArtifactId,
      status,
      outputSummary,
      blockers,
      warnings,
      retryLimit: stage.retryLimit
    });
    repository.writeArtifact(artifact);
    artifacts.push(artifact);
    const isTerminal = artifacts.length === input.job.stages.length;
    checkpoint = await buildCheckpoint({
      logicalJobId: input.job.logicalJobId,
      nextStageOrdinal: artifacts.length,
      orderedStageArtifactIds: artifacts.map((item) => item.stageArtifactId),
      heartbeatSequence: checkpoint.heartbeatSequence + 1,
      cancellationRequested: stopStatus === "cancelled",
      ...(isTerminal ? { terminalStatus: terminalFor(artifacts) } : {}),
      previousCheckpointId: checkpoint.checkpointId
    });
    repository.writeCheckpoint(checkpoint);
    if (!isTerminal && input.interruptAfterStages === artifacts.length) return Object.freeze({ interrupted: true as const, repository, checkpoint, artifacts: Object.freeze(artifacts) });
  }
  const seal = await buildShadowTerminalSeal(input.job, checkpoint, artifacts);
  repository.writeSeal(seal);
  const projection = await materializeShadowOperatorProjection(input.job, seal, artifacts);
  return Object.freeze({ interrupted: false as const, repository, checkpoint, artifacts: Object.freeze(artifacts), seal, projection });
}
