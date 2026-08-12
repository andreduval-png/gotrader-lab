import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import type { ResearchCycleRun, ResearchCycleStepResult } from "../researchCycle/researchCycleTypes";
import { buildShadowResearchJob, runShadowOrchestration, validateShadowCheckpoint, validateShadowResearchJob, validateShadowStageChain } from "./shadowOrchestrationEngine";
import { loadShadowOrchestrationSnapshot, persistShadowOrchestrationSnapshot } from "./shadowOrchestrationIndexedDb";
import { LEGACY_RESEARCH_CYCLE_STEP_ORDER } from "./researchCycleShadowAdapter";
import { SHADOW_ORCHESTRATION_AUTHORITY } from "./shadowOrchestrationTypes";

export const RESEARCH_CYCLE_CHECKPOINT_OBSERVATION_VERSION = "gotrader-v2-research-cycle-checkpoint-observation-v1" as const;
export const RESEARCH_CYCLE_CHECKPOINT_RECOVERY_SCHEMA = "gotrader-v2-research-cycle-checkpoint-recovery-v1" as const;
export const RESEARCH_CYCLE_CHECKPOINT_EVENT = "gotrader:research-cycle-checkpoint-observation" as const;
const HASH = /^sha256:[0-9a-f]{64}$/;
const OBSERVABLE_STATUSES = new Set(["passed", "completed", "warning"]);
const queues = new Map<string, Promise<ResearchCycleCheckpointObservationOutcome>>();

export interface ResearchCycleCheckpointRecoveryDescriptor {
  schemaVersion: typeof RESEARCH_CYCLE_CHECKPOINT_RECOVERY_SCHEMA;
  observationVersion: typeof RESEARCH_CYCLE_CHECKPOINT_OBSERVATION_VERSION;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  legacyCycleId: string;
  sourceFingerprint: string;
  logicalJobId: string;
  checkpointId: string;
  completedPrefixCount: number;
  completedStepIds: readonly string[];
  heartbeatSequence: number;
  legacyResearchCycleAuthoritative: true;
  intermediateCheckpointObservationAllowed: true;
  recoveryExecutionAllowed: false;
  runtimeAdoptionAllowed: false;
  authority: typeof SHADOW_ORCHESTRATION_AUTHORITY;
  recoveryDescriptorId: string;
}

export type ResearchCycleCheckpointObservationOutcome =
  | Readonly<{ status: "observed" | "unchanged"; recovery: Readonly<ResearchCycleCheckpointRecoveryDescriptor> }>
  | Readonly<{ status: "ignored"; cycleId: string; reason: string }>
  | Readonly<{ status: "failed"; cycleId: string; error: string; legacyResearchCycleAuthoritative: true }>;

const publish = (outcome: ResearchCycleCheckpointObservationOutcome) => {
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(RESEARCH_CYCLE_CHECKPOINT_EVENT, { detail: outcome }));
  }
  return Object.freeze(outcome);
};

const validateSource = (run: Readonly<ResearchCycleRun>) => {
  if (!run.cycleId.trim() || !run.sourceMetadata || !HASH.test(run.sourceMetadata.activeSourceFingerprint) ||
      JSON.stringify(run.sourceMetadata.authority) !== JSON.stringify(SHADOW_ORCHESTRATION_AUTHORITY)) {
    throw new Error("Checkpoint observation requires an identified authority-none research source.");
  }
  if (run.steps.length !== LEGACY_RESEARCH_CYCLE_STEP_ORDER.length ||
      !run.steps.every((step, ordinal) => step.stepId === LEGACY_RESEARCH_CYCLE_STEP_ORDER[ordinal])) {
    throw new Error("Checkpoint observation rejects legacy step order mismatch.");
  }
};

const completedPrefix = (steps: readonly Readonly<ResearchCycleStepResult>[]) => {
  const firstUnobserved = steps.findIndex((step) => !OBSERVABLE_STATUSES.has(step.status));
  const count = firstUnobserved < 0 ? steps.length : firstUnobserved;
  if (steps.slice(count).some((step) => OBSERVABLE_STATUSES.has(step.status))) {
    throw new Error("Checkpoint observation rejects a non-contiguous completed prefix.");
  }
  return steps.slice(0, count);
};

const buildObservationJob = async (run: Readonly<ResearchCycleRun>) => {
  validateSource(run);
  const cycleSourceIdentity = await canonicalHash({
    observationVersion: RESEARCH_CYCLE_CHECKPOINT_OBSERVATION_VERSION,
    legacyCycleId: run.cycleId,
    sourceFingerprint: run.sourceMetadata!.activeSourceFingerprint,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return buildShadowResearchJob({
    jobType: "legacy_research_cycle_checkpoint_observation",
    jobTypeVersion: RESEARCH_CYCLE_CHECKPOINT_OBSERVATION_VERSION,
    inputArtifactIds: [cycleSourceIdentity, run.sourceMetadata!.activeSourceFingerprint],
    compactInput: {
      legacyCycleId: run.cycleId,
      sourceMode: run.sourceMetadata!.activeSourceMode,
      registeredStageCount: LEGACY_RESEARCH_CYCLE_STEP_ORDER.length
    },
    stages: LEGACY_RESEARCH_CYCLE_STEP_ORDER.map((stageName) => ({
      stageName,
      stageVersion: "legacy-research-cycle-checkpoint-step-v1",
      required: true,
      retryLimit: 0
    }))
  });
};

const recoveryDescriptor = async (run: Readonly<ResearchCycleRun>, logicalJobId: string) => {
  const snapshot = await loadShadowOrchestrationSnapshot(logicalJobId);
  if (!snapshot || snapshot.seal || snapshot.projection || snapshot.checkpoint.terminalStatus !== undefined ||
      !await validateShadowResearchJob(snapshot.job) || !await validateShadowCheckpoint(snapshot.checkpoint) ||
      !await validateShadowStageChain(snapshot.job, snapshot.artifacts) || snapshot.checkpoint.nextStageOrdinal >= LEGACY_RESEARCH_CYCLE_STEP_ORDER.length ||
      snapshot.job.inputArtifactIds[1] !== run.sourceMetadata!.activeSourceFingerprint) {
    throw new Error("Checkpoint recovery evidence failed closed validation.");
  }
  const core = Object.freeze({
    schemaVersion: RESEARCH_CYCLE_CHECKPOINT_RECOVERY_SCHEMA,
    observationVersion: RESEARCH_CYCLE_CHECKPOINT_OBSERVATION_VERSION,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    legacyCycleId: run.cycleId,
    sourceFingerprint: run.sourceMetadata!.activeSourceFingerprint,
    logicalJobId,
    checkpointId: snapshot.checkpoint.checkpointId,
    completedPrefixCount: snapshot.artifacts.length,
    completedStepIds: Object.freeze(snapshot.artifacts.map((artifact) => artifact.stageName)),
    heartbeatSequence: snapshot.checkpoint.heartbeatSequence,
    legacyResearchCycleAuthoritative: true as const,
    intermediateCheckpointObservationAllowed: true as const,
    recoveryExecutionAllowed: false as const,
    runtimeAdoptionAllowed: false as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  return Object.freeze({ ...core, recoveryDescriptorId: await canonicalHash(core) });
};

async function observe(run: Readonly<ResearchCycleRun>): Promise<ResearchCycleCheckpointObservationOutcome> {
  try {
    if (run.status !== "running") return publish({ status: "ignored", cycleId: run.cycleId, reason: "terminal_run_uses_terminal_mirror" });
    const prefix = completedPrefix(run.steps);
    if (prefix.length === 0 || prefix.length >= LEGACY_RESEARCH_CYCLE_STEP_ORDER.length) {
      return publish({ status: "ignored", cycleId: run.cycleId, reason: prefix.length === 0 ? "no_completed_prefix" : "complete_prefix_uses_terminal_mirror" });
    }
    const job = await buildObservationJob(run);
    const handlers = Object.fromEntries(prefix.map((step, ordinal) => [step.stepId, () => ({
      status: "completed" as const,
      outputSummary: { legacyStatus: step.status, observedOrdinal: ordinal },
      warnings: step.status === "warning" ? [`legacy_step_warning_${step.stepId}`] : []
    })]));
    const result = await runShadowOrchestration({ job, handlers, interruptAfterStages: prefix.length });
    if (!result.interrupted || result.artifacts.length !== prefix.length) throw new Error("Checkpoint observation unexpectedly reached a terminal state.");
    const persisted = await persistShadowOrchestrationSnapshot({ job, checkpoint: result.checkpoint, artifacts: result.artifacts });
    const recovery = await recoveryDescriptor(run, job.logicalJobId);
    return publish({ status: persisted.status === "unchanged" ? "unchanged" : "observed", recovery });
  } catch (error) {
    return publish({ status: "failed", cycleId: run.cycleId, error: error instanceof Error ? error.message : "Checkpoint observation failed.", legacyResearchCycleAuthoritative: true });
  }
}

export function queueResearchCycleCheckpointObservation(run: Readonly<ResearchCycleRun>) {
  const snapshot = structuredClone(run) as ResearchCycleRun;
  const prior = queues.get(run.cycleId) ?? Promise.resolve(undefined);
  const queued = prior.then(() => observe(snapshot), () => observe(snapshot));
  queues.set(run.cycleId, queued);
  void queued.finally(() => { if (queues.get(run.cycleId) === queued) queues.delete(run.cycleId); });
  return queued;
}

export async function loadResearchCycleCheckpointRecovery(run: Readonly<ResearchCycleRun>) {
  const job = await buildObservationJob(run);
  return recoveryDescriptor(run, job.logicalJobId);
}
