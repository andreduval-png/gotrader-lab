import { matchValidationProvenance, type ValidationProvenanceIdentity } from "@/lib/validationProvenance";

import { describeValidationChainStage } from "./buildValidationChain";
import type { AdvisorValidationChainContext, ValidationChainEntry } from "./validationChainTypes";

export interface CurrentCycleValidationIdentity {
  cycleId?: string;
  validationId?: string;
  provenance?: ValidationProvenanceIdentity;
}

export interface AdvisorValidationChainInvariantResult {
  ok: boolean;
  violations: string[];
}

export const validateAdvisorValidationChainInvariant = (
  context?: AdvisorValidationChainContext
): AdvisorValidationChainInvariantResult => {
  if (!context) return { ok: true, violations: [] };

  const violations = [
    context.evidenceRelationship === "current_cycle" && !context.currentValidationAvailable
      ? "Current-cycle validation context cannot exist without current validation."
      : undefined,
    context.evidenceRelationship === "current_cycle" && !context.identityMatched
      ? "Current-cycle validation context must match the current cycle identity."
      : undefined,
    context.evidenceRelationship === "historical_evidence" && Boolean(context.replayVerdict)
      ? "Historical replay evidence cannot populate the current replay verdict."
      : undefined,
    context.evidenceRelationship === "historical_evidence" && Boolean(context.walkForwardVerdict)
      ? "Historical walk-forward evidence cannot populate the current walk-forward verdict."
      : undefined,
    !context.currentValidationAvailable && (context.replayVerdict === "passed" || context.walkForwardVerdict === "passed")
      ? "A passed validation-chain verdict requires current validation evidence."
      : undefined
  ].filter((item): item is string => Boolean(item));

  return { ok: violations.length === 0, violations };
};

export const resolveAdvisorValidationChainContext = (input: {
  entry?: ValidationChainEntry;
  current?: CurrentCycleValidationIdentity;
}): AdvisorValidationChainContext | undefined => {
  const { entry, current } = input;
  if (!entry) return undefined;

  const currentValidationAvailable = Boolean(
    current?.cycleId && current.validationId && current.provenance
  );
  const expectedProvenance = currentValidationAvailable
    ? {
        ...current!.provenance,
        validationRunId: current!.validationId
      }
    : undefined;
  const identityReview = currentValidationAvailable
    ? matchValidationProvenance(expectedProvenance, entry.provenance, {
        purpose: "readiness",
        requireValidationRunId: true
      })
    : undefined;
  const cycleMatched = Boolean(
    currentValidationAvailable &&
      entry.sourceCycleId &&
      entry.sourceCycleId === current?.cycleId
  );
  const identityMatched = Boolean(cycleMatched && identityReview?.matched);
  const historicalReason = !currentValidationAvailable
    ? "The current cycle has no identity-matched validation suite."
    : !entry.sourceCycleId
      ? "The stored entry predates exact cycle binding."
      : !cycleMatched
        ? `The stored entry belongs to cycle ${entry.sourceCycleId}, not current cycle ${current?.cycleId}.`
        : identityReview?.summary ?? "The stored validation identity does not match the current cycle.";

  const context: AdvisorValidationChainContext = {
    recognitionId: entry.recognitionId,
    setupLabel: entry.setupLabel,
    hypothesisStatus: entry.hypothesisStatus,
    stage: identityMatched
      ? describeValidationChainStage(entry)
      : `Historical evidence - ${describeValidationChainStage(entry)}`,
    replayVerdict: identityMatched ? entry.replayResult?.verdict : undefined,
    walkForwardVerdict: identityMatched ? entry.walkForwardResult?.verdict : undefined,
    historicalReplayVerdict: identityMatched ? undefined : entry.replayResult?.verdict,
    historicalWalkForwardVerdict: identityMatched ? undefined : entry.walkForwardResult?.verdict,
    nextAction: identityMatched
      ? entry.nextAction
      : `${historicalReason} Historical results remain visible but cannot describe the current cycle. Run identity-matched validation and OOS evidence for the current cycle.`,
    sampleOnly: entry.sourceStatus.isMockOrSample,
    recognitionIsEvidence: false,
    authority: "none",
    evidenceRelationship: identityMatched ? "current_cycle" : "historical_evidence",
    evidenceRelationshipLabel: identityMatched
      ? "Current-cycle validation evidence"
      : "Historical evidence - not current-cycle evidence",
    currentValidationAvailable,
    identityMatched,
    currentCycleId: current?.cycleId,
    sourceCycleId: entry.sourceCycleId,
    identityBlockers: identityMatched
      ? []
      : [historicalReason, ...(identityReview?.blockers ?? [])]
  };

  const invariant = validateAdvisorValidationChainInvariant(context);
  if (!invariant.ok) {
    throw new Error(`Advisor validation-chain invariant failed: ${invariant.violations.join(" ")}`);
  }
  return context;
};
