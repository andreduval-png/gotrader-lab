import { canonicalHash, canonicalSerialize, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import type { ResearchCycleRun, ResearchCycleStepResult, ResearchCycleStepStatus } from "../researchCycle/researchCycleTypes";
import {
  buildShadowResearchJob,
  runShadowOrchestration,
  ShadowStageExecutionError,
  validateShadowCheckpoint,
  validateShadowOperatorProjection,
  validateShadowResearchJob,
  validateShadowStageChain,
  validateShadowTerminalSeal
} from "./shadowOrchestrationEngine";
import { SHADOW_ORCHESTRATION_AUTHORITY, type ShadowStageStatus, type ShadowTerminalStatus } from "./shadowOrchestrationTypes";

export const RESEARCH_CYCLE_SHADOW_ADAPTER_VERSION = "gotrader-v2-research-cycle-shadow-adapter-v1" as const;
export const RESEARCH_CYCLE_PARITY_SCHEMA = "gotrader-v2-research-cycle-shadow-parity-v1" as const;
const HASH = /^sha256:[0-9a-f]{64}$/;
const TERMINAL_RUN_STATUSES = ["completed", "completed_with_warnings", "failed", "canceled"];
const TERMINAL_STEP_STATUSES: ResearchCycleStepStatus[] = ["passed", "completed", "warning", "failed", "skipped"];
const exact = (left: unknown, right: unknown) => canonicalSerialize(left) === canonicalSerialize(right);
const without = <T extends Record<string, unknown>>(value: T, key: keyof T) => { const copy = { ...value }; delete copy[key]; return copy; };

export const LEGACY_RESEARCH_CYCLE_STEP_ORDER = Object.freeze([
  "thesis_generation", "backtest", "auto_research", "validation", "walk_forward", "research_quality",
  "self_improvement", "simulation_verification", "readiness_gate", "llm_advisory", "communications_audit"
] as const);

export interface ResearchCycleShadowParityAssessment {
  schemaVersion: typeof RESEARCH_CYCLE_PARITY_SCHEMA;
  adapterVersion: typeof RESEARCH_CYCLE_SHADOW_ADAPTER_VERSION;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  legacyCycleIdentity: string;
  logicalJobId: string;
  terminalSealId: string;
  projectionId: string;
  orderedStepParity: true;
  statusParity: true;
  terminalStatusParity: true;
  compactSummaryParity: true;
  sourceIdentityParity: true;
  legacyResearchCycleAuthoritative: true;
  automaticMirroringAllowed: false;
  runtimeAdoptionAllowed: false;
  authority: typeof SHADOW_ORCHESTRATION_AUTHORITY;
  parityAssessmentId: string;
}

const summaryIdentity = (step: Readonly<ResearchCycleStepResult>) => canonicalHash({
  stepId: step.stepId,
  status: step.status,
  summary: step.summary,
  detail: step.detail ?? null,
  warning: step.warning ?? null,
  error: step.error ?? null
});

function validateLegacyRun(run: Readonly<ResearchCycleRun>) {
  if (!run.cycleId.trim() || !TERMINAL_RUN_STATUSES.includes(run.status)) throw new Error("Research-cycle shadow adapter requires a terminal identified run.");
  if (!run.sourceMetadata || !HASH.test(run.sourceMetadata.activeSourceFingerprint) || !exact(run.sourceMetadata.authority, SHADOW_ORCHESTRATION_AUTHORITY)) {
    throw new Error("Research-cycle shadow adapter requires a stable authority-none source identity.");
  }
  if (run.steps.length !== LEGACY_RESEARCH_CYCLE_STEP_ORDER.length ||
      !run.steps.every((step, ordinal) => step.stepId === LEGACY_RESEARCH_CYCLE_STEP_ORDER[ordinal])) {
    throw new Error("Research-cycle shadow adapter rejects legacy step order mismatch.");
  }
  if (run.steps.some((step) => !TERMINAL_STEP_STATUSES.includes(step.status))) throw new Error("Research-cycle shadow adapter rejects non-terminal legacy steps.");
  const failed = run.steps.findIndex((step) => step.status === "failed");
  if (run.status === "failed" && (failed < 0 || run.failedStepId !== run.steps[failed].stepId)) throw new Error("Research-cycle failed status is inconsistent with its failed step.");
  if (run.status !== "failed" && failed >= 0) throw new Error("Research-cycle terminal status is inconsistent with a failed step.");
  if (run.status === "completed" && run.steps.some((step) => step.status === "warning" || step.status === "skipped")) {
    throw new Error("Completed research cycle contains warning or skipped steps.");
  }
  if (run.status === "canceled") {
    const firstSkipped = run.steps.findIndex((step) => step.status === "skipped");
    if (firstSkipped < 0 || run.steps.slice(firstSkipped).some((step) => step.status !== "skipped")) {
      throw new Error("Canceled research cycle requires an explicit skipped suffix.");
    }
  }
}

const expectedArtifactStatus = (run: Readonly<ResearchCycleRun>, step: Readonly<ResearchCycleStepResult>, ordinal: number): ShadowStageStatus => {
  if (run.status === "canceled") {
    const cancellationOrdinal = run.steps.findIndex((item) => item.status === "skipped");
    if (ordinal === cancellationOrdinal) return "cancelled";
    if (ordinal > cancellationOrdinal) return "skipped";
  }
  if (step.status === "failed") return "failed";
  if (step.status === "skipped") return "skipped";
  return "completed";
};

const expectedTerminalStatus = (run: Readonly<ResearchCycleRun>): ShadowTerminalStatus =>
  run.status === "failed" ? "failed" : run.status === "canceled" ? "cancelled" : "completed";

export async function adaptResearchCycleRunToShadow(run: Readonly<ResearchCycleRun>) {
  validateLegacyRun(run);
  const summaryIds = await Promise.all(run.steps.map(summaryIdentity));
  const legacyCycleCore = Object.freeze({
    adapterVersion: RESEARCH_CYCLE_SHADOW_ADAPTER_VERSION,
    cycleId: run.cycleId,
    status: run.status,
    sourceFingerprint: run.sourceMetadata!.activeSourceFingerprint,
    orderedSteps: Object.freeze(run.steps.map((step, ordinal) => Object.freeze({ stepId: step.stepId, status: step.status, summaryId: summaryIds[ordinal] }))),
    blockerSetIdentity: await canonicalHash({ blockers: [...(run.blockers ?? [])].sort(), promotionBlockers: [...(run.promotionBlockers ?? [])].sort() }),
    failedStepId: run.failedStepId ?? null,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  const legacyCycleIdentity = await canonicalHash(legacyCycleCore);
  const job = await buildShadowResearchJob({
    jobType: "legacy_research_cycle_shadow_projection",
    jobTypeVersion: RESEARCH_CYCLE_SHADOW_ADAPTER_VERSION,
    inputArtifactIds: [legacyCycleIdentity, run.sourceMetadata!.activeSourceFingerprint],
    compactInput: {
      legacyCycleId: run.cycleId,
      legacyStatus: run.status,
      sourceMode: run.sourceMetadata!.activeSourceMode,
      stepCount: run.steps.length
    },
    stages: run.steps.map((step) => ({ stageName: step.stepId, stageVersion: "legacy-research-cycle-step-v1", required: true, retryLimit: 0 }))
  });
  const handlers = Object.fromEntries(run.steps.map((step, ordinal) => [step.stepId, () => {
    if (step.status === "failed") throw new ShadowStageExecutionError(`legacy_step_failed_${step.stepId}`, true);
    return {
      status: step.status === "skipped" ? "skipped" as const : "completed" as const,
      outputSummary: { legacyStatus: step.status, summaryId: summaryIds[ordinal] },
      blockers: step.status === "skipped" ? [`legacy_step_skipped_${step.stepId}`] : [],
      warnings: step.status === "warning" ? [`legacy_step_warning_${step.stepId}`] : []
    };
  }]));
  const cancellationOrdinal = run.status === "canceled" ? run.steps.findIndex((step) => step.status === "skipped") : undefined;
  const result = await runShadowOrchestration({ job, handlers, ...(cancellationOrdinal !== undefined ? { cancelBeforeStage: cancellationOrdinal } : {}) });
  if (result.interrupted) throw new Error("Research-cycle shadow adaptation unexpectedly interrupted.");
  const orderedStepParity = result.artifacts.every((artifact, ordinal) => artifact.stageName === run.steps[ordinal].stepId && artifact.stageOrdinal === ordinal);
  const statusParity = result.artifacts.every((artifact, ordinal) => artifact.status === expectedArtifactStatus(run, run.steps[ordinal], ordinal));
  const terminalStatusParity = result.seal.terminalStatus === expectedTerminalStatus(run) && result.projection.terminalStatus === expectedTerminalStatus(run);
  const compactSummaryParity = result.artifacts.every((artifact, ordinal) => artifact.outputSummary.summaryId === summaryIds[ordinal] ||
    artifact.status === "failed" || artifact.status === "skipped" || artifact.status === "cancelled");
  const sourceIdentityParity = job.inputArtifactIds[1] === run.sourceMetadata!.activeSourceFingerprint;
  if (!orderedStepParity || !statusParity || !terminalStatusParity || !compactSummaryParity || !sourceIdentityParity) {
    throw new Error(`Research-cycle shadow parity failed closed: ${JSON.stringify({ orderedStepParity, statusParity, terminalStatusParity, compactSummaryParity, sourceIdentityParity })}`);
  }
  const parityCore = Object.freeze({
    schemaVersion: RESEARCH_CYCLE_PARITY_SCHEMA,
    adapterVersion: RESEARCH_CYCLE_SHADOW_ADAPTER_VERSION,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    legacyCycleIdentity,
    logicalJobId: job.logicalJobId,
    terminalSealId: result.seal.terminalSealId,
    projectionId: result.projection.projectionId,
    orderedStepParity: true as const,
    statusParity: true as const,
    terminalStatusParity: true as const,
    compactSummaryParity: true as const,
    sourceIdentityParity: true as const,
    legacyResearchCycleAuthoritative: true as const,
    automaticMirroringAllowed: false as const,
    runtimeAdoptionAllowed: false as const,
    authority: SHADOW_ORCHESTRATION_AUTHORITY
  });
  const parity = Object.freeze({ ...parityCore, parityAssessmentId: await canonicalHash(parityCore) }) as Readonly<ResearchCycleShadowParityAssessment>;
  return Object.freeze({ legacyCycleIdentity, job, checkpoint: result.checkpoint, artifacts: result.artifacts, seal: result.seal, projection: result.projection, parity });
}

export async function validateResearchCycleShadowAdaptation(run: Readonly<ResearchCycleRun>, adaptation: Awaited<ReturnType<typeof adaptResearchCycleRunToShadow>>) {
  const parityValid = adaptation.parity.schemaVersion === RESEARCH_CYCLE_PARITY_SCHEMA && adaptation.parity.adapterVersion === RESEARCH_CYCLE_SHADOW_ADAPTER_VERSION &&
    adaptation.parity.legacyResearchCycleAuthoritative === true && adaptation.parity.automaticMirroringAllowed === false && adaptation.parity.runtimeAdoptionAllowed === false &&
    exact(adaptation.parity.authority, SHADOW_ORCHESTRATION_AUTHORITY) &&
    await canonicalHash(without(adaptation.parity as unknown as Record<string, unknown>, "parityAssessmentId")) === adaptation.parity.parityAssessmentId;
  if (!parityValid || !await validateShadowResearchJob(adaptation.job) || !await validateShadowCheckpoint(adaptation.checkpoint) ||
      !await validateShadowStageChain(adaptation.job, adaptation.artifacts) || !await validateShadowTerminalSeal(adaptation.seal) ||
      !await validateShadowOperatorProjection(adaptation.projection)) return false;
  const reproduced = await adaptResearchCycleRunToShadow(run);
  return exact(reproduced, adaptation);
}
