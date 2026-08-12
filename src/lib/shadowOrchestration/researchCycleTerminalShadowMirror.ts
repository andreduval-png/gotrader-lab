import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import type { ResearchCycleRun } from "../researchCycle/researchCycleTypes";
import { adaptResearchCycleRunToShadow, validateResearchCycleShadowAdaptation } from "./researchCycleShadowAdapter";
import { loadShadowOrchestrationSnapshot, persistShadowOrchestrationSnapshot } from "./shadowOrchestrationIndexedDb";
import { SHADOW_ORCHESTRATION_AUTHORITY } from "./shadowOrchestrationTypes";

export const RESEARCH_CYCLE_TERMINAL_SHADOW_MIRROR_VERSION = "gotrader-v2-terminal-shadow-mirror-v1" as const;
export const RESEARCH_CYCLE_TERMINAL_SHADOW_RECEIPT_SCHEMA = "gotrader-v2-terminal-shadow-mirror-receipt-v1" as const;
export const RESEARCH_CYCLE_TERMINAL_SHADOW_EVENT = "gotrader:research-cycle-terminal-shadow-mirror" as const;

export interface ResearchCycleTerminalShadowReceipt {
  schemaVersion: typeof RESEARCH_CYCLE_TERMINAL_SHADOW_RECEIPT_SCHEMA;
  mirrorVersion: typeof RESEARCH_CYCLE_TERMINAL_SHADOW_MIRROR_VERSION;
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  legacyCycleId: string;
  legacyCycleIdentity: string;
  sourceFingerprint: string;
  logicalJobId: string;
  checkpointId: string;
  terminalSealId: string;
  projectionId: string;
  parityAssessmentId: string;
  legacyResearchCycleAuthoritative: true;
  terminalShadowMirroringAllowed: true;
  runtimeAdoptionAllowed: false;
  authority: typeof SHADOW_ORCHESTRATION_AUTHORITY;
  receiptId: string;
}

export type ResearchCycleTerminalShadowMirrorOutcome =
  | Readonly<{ status: "mirrored" | "unchanged"; receipt: Readonly<ResearchCycleTerminalShadowReceipt> }>
  | Readonly<{ status: "failed"; cycleId: string; error: string; legacyResearchCycleAuthoritative: true }>;

const publishOutcome = (outcome: ResearchCycleTerminalShadowMirrorOutcome) => {
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(RESEARCH_CYCLE_TERMINAL_SHADOW_EVENT, { detail: outcome }));
  }
  return Object.freeze(outcome);
};

export async function mirrorTerminalResearchCycleRun(
  run: Readonly<ResearchCycleRun>
): Promise<ResearchCycleTerminalShadowMirrorOutcome> {
  try {
    const adaptation = await adaptResearchCycleRunToShadow(run);
    const persistence = await persistShadowOrchestrationSnapshot({
      job: adaptation.job,
      checkpoint: adaptation.checkpoint,
      artifacts: adaptation.artifacts,
      seal: adaptation.seal,
      projection: adaptation.projection
    });
    const loaded = await loadShadowOrchestrationSnapshot(adaptation.job.logicalJobId);
    if (!loaded?.seal || !loaded.projection || !await validateResearchCycleShadowAdaptation(run, {
      ...adaptation,
      checkpoint: loaded.checkpoint,
      artifacts: loaded.artifacts,
      seal: loaded.seal,
      projection: loaded.projection
    })) {
      throw new Error("Persisted terminal shadow mirror failed reproduction validation.");
    }
    const core = Object.freeze({
      schemaVersion: RESEARCH_CYCLE_TERMINAL_SHADOW_RECEIPT_SCHEMA,
      mirrorVersion: RESEARCH_CYCLE_TERMINAL_SHADOW_MIRROR_VERSION,
      hashVersion: V2_CANONICAL_HASH_VERSION,
      legacyCycleId: run.cycleId,
      legacyCycleIdentity: adaptation.legacyCycleIdentity,
      sourceFingerprint: run.sourceMetadata!.activeSourceFingerprint,
      logicalJobId: adaptation.job.logicalJobId,
      checkpointId: loaded.checkpoint.checkpointId,
      terminalSealId: loaded.seal.terminalSealId,
      projectionId: loaded.projection.projectionId,
      parityAssessmentId: adaptation.parity.parityAssessmentId,
      legacyResearchCycleAuthoritative: true as const,
      terminalShadowMirroringAllowed: true as const,
      runtimeAdoptionAllowed: false as const,
      authority: SHADOW_ORCHESTRATION_AUTHORITY
    });
    const receipt = Object.freeze({ ...core, receiptId: await canonicalHash(core) });
    return publishOutcome({ status: persistence.status === "unchanged" ? "unchanged" : "mirrored", receipt });
  } catch (error) {
    return publishOutcome({
      status: "failed",
      cycleId: run.cycleId,
      error: error instanceof Error ? error.message : "Terminal shadow mirror failed.",
      legacyResearchCycleAuthoritative: true
    });
  }
}
