import { CANONICAL_LIVE_RESEARCH_OWNER_ORDER } from "@/lib/researchCoverage";
import { evaluateCanonicalOwnerPolicyCycle, type OwnerAccumulationEvidenceStatus } from "@/lib/ownerValidationPolicy";
import { runMultiStrategyValidationAcceptance } from "./multiStrategyValidationAcceptance";
import { readOperatorCycleState, saveOperatorCycleState } from "./operatorCycle";

let scenarioPromise: ReturnType<typeof runMultiStrategyValidationAcceptance> | undefined;

export const runOwnerValidationPolicyAcceptance = () => {
  if (scenarioPromise) return scenarioPromise;
  scenarioPromise = runMultiStrategyValidationAcceptance().then((runtime) => {
    const cycle = readOperatorCycleState();
    const summary = cycle.ownerResearch;
    if (!cycle.cycleId || !summary?.ownerValidation) {
      throw new Error("Owner policy acceptance requires the multi-strategy validation summary.");
    }
    const capacityBlocked = Object.fromEntries(
      CANONICAL_LIVE_RESEARCH_OWNER_ORDER.map((ownerStrategyId) => [ownerStrategyId, "CAPACITY_BLOCKED"])
    ) as Record<(typeof CANONICAL_LIVE_RESEARCH_OWNER_ORDER)[number], OwnerAccumulationEvidenceStatus>;
    summary.ownerValidation.policySummary = evaluateCanonicalOwnerPolicyCycle({
      cycleId: cycle.cycleId,
      accumulationStatusByOwner: capacityBlocked
    });
    saveOperatorCycleState({ ...cycle, ownerResearch: summary });
    return runtime;
  });
  return scenarioPromise;
};
