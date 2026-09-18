import { canonicalLiveResearchCoverage } from "@/lib/researchCoverage";
import {
  evaluateCanonicalOwnerValidationCycle,
  OWNER_VALIDATION_EVIDENCE_SCHEMA,
  type CanonicalOwnerValidationEvidence
} from "@/lib/ownerValidation";
import type { CanonicalLiveResearchOwnerId } from "@/lib/researchCoverage";
import { runRc1cProductionAcceptance } from "./rc1cProductionAcceptance";
import { readOperatorCycleState, saveOperatorCycleState } from "./operatorCycle";

let scenarioPromise: ReturnType<typeof runRc1cProductionAcceptance> | undefined;

export const runMultiStrategyValidationAcceptance = () => {
  if (scenarioPromise) return scenarioPromise;
  scenarioPromise = runRc1cProductionAcceptance().then((runtime) => {
    const cycle = readOperatorCycleState();
    const summary = cycle.ownerResearch;
    if (!cycle.cycleId || !summary) throw new Error("Validation acceptance requires the RC1C owner summary.");
    const ifvg = canonicalLiveResearchCoverage()[0];
    const identity = summary.tasks.find((task) => task.ownerStrategyId === ifvg.ownerStrategyId)?.evidence.at(-1);
    const evidenceByOwner: Partial<Record<CanonicalLiveResearchOwnerId, readonly CanonicalOwnerValidationEvidence[]>> = {};
    if (identity) {
      evidenceByOwner[ifvg.ownerStrategyId] = [{
        schemaVersion: OWNER_VALIDATION_EVIDENCE_SCHEMA,
        evidenceVersion: ifvg.evidenceVersion,
        identity,
        historicalParityStatus: "PASSED",
        determinismStatus: "PASSED",
        causalityStatus: "PASSED",
        walkForwardStatus: "PASSED",
        oosStatus: "PASSED",
        readinessEvidenceStatus: "PASSED",
        metrics: { evaluations: 2, candidates: 1, fills: 1, resolvedOutcomes: 1 },
        createdAt: "2026-08-28T12:59:00.000Z"
      }];
    }
    summary.ownerValidation = evaluateCanonicalOwnerValidationCycle({
      cycleId: cycle.cycleId,
      tasks: summary.tasks,
      evaluatedAt: "2026-08-28T13:00:01.500Z",
      evidenceByOwner
    });
    saveOperatorCycleState({ ...cycle, ownerResearch: summary });
    return runtime;
  });
  return scenarioPromise;
};
