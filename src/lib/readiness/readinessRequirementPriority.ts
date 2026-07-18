import type { ReadinessRequirementResult } from "@/lib/readiness/readinessTypes";

const FINAL_REVIEW_REQUIREMENT_IDS = new Set([
  "llm-advisory-review",
  "runbook-complete"
]);

const failedRequirement = (
  requirements: ReadinessRequirementResult[],
  id: string
) => requirements.find((item) => item.id === id && !item.passed);

export interface PrioritizedReadinessRequirements {
  activeFailedRequirements: ReadinessRequirementResult[];
  deferredRequirements: ReadinessRequirementResult[];
}

export function prioritizeReadinessRequirements(
  requirements: ReadinessRequirementResult[]
): PrioritizedReadinessRequirements {
  const failedRequirements = requirements.filter((item) => !item.passed);
  const validationMissing = failedRequirement(requirements, "validation-exists");
  const sampleMissing = failedRequirement(requirements, "simulated-trade-sample");
  const qualityMissing = failedRequirement(requirements, "research-quality-exists");

  let activeFailedRequirements: ReadinessRequirementResult[];
  if (validationMissing) {
    activeFailedRequirements = [validationMissing];
  } else if (sampleMissing) {
    activeFailedRequirements = [sampleMissing];
  } else if (qualityMissing) {
    activeFailedRequirements = [qualityMissing];
  } else {
    const deterministicFailures = failedRequirements.filter(
      (item) => !FINAL_REVIEW_REQUIREMENT_IDS.has(item.id)
    );
    activeFailedRequirements = deterministicFailures.length
      ? deterministicFailures
      : failedRequirements.filter((item) => FINAL_REVIEW_REQUIREMENT_IDS.has(item.id));
  }

  const activeIds = new Set(activeFailedRequirements.map((item) => item.id));
  return {
    activeFailedRequirements,
    deferredRequirements: failedRequirements.filter((item) => !activeIds.has(item.id))
  };
}
