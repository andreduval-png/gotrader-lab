import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import {
  CONTROLLED_EXPERIMENT_SCHEMA,
  EXPERIMENT_POLICY_AUTHORITY,
  MULTIPLE_COMPARISON_SCHEMA,
  type ControlledExperimentCandidate,
  type ControlledExperimentRegistration,
  type DependencyAssumption,
  type ExperimentTail,
  type ExperimentTrialResult,
  type MultipleComparisonAssessment,
  type MultipleComparisonCandidateAssessment,
  type MultipleComparisonMethod
} from "./experimentPolicyTypes";

const HASH = /^sha256:[0-9a-f]{64}$/;
const METHODS: readonly MultipleComparisonMethod[] = Object.freeze([
  "benjamini_hochberg",
  "holm",
  "bonferroni"
]);
const DIAGNOSTICS = Object.freeze([
  Object.freeze({ method: "bootstrap_reality_check" as const, applicability: "not_applicable" as const,
    reason: "This policy consumes supplied p-values and does not own a preregistered dependent-return null generator." }),
  Object.freeze({ method: "deflated_sharpe" as const, applicability: "not_applicable" as const,
    reason: "No Sharpe sampling distribution, non-normality estimate, or independent-trial count is supplied to this policy." }),
  Object.freeze({ method: "probability_of_backtest_overfitting" as const, applicability: "not_applicable" as const,
    reason: "No preregistered combinatorially symmetric cross-validation matrix is supplied to this policy." })
]);

const round = (value: number) => Number(Math.min(1, Math.max(0, value)).toFixed(12));
const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort();
const exact = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const assertText = (value: string, label: string) => {
  if (!value.trim()) throw new Error(`${label} is required.`);
};
const assertRate = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) throw new Error(`${label} must be between zero and one.`);
};

export async function preregisterControlledExperiment(input: Readonly<{
  familyKey: string;
  hypothesis: string;
  primaryStatistic: string;
  tail: ExperimentTail;
  alpha: number;
  fdrTarget: number;
  dependencyAssumption: DependencyAssumption;
  candidates: readonly Readonly<ControlledExperimentCandidate>[];
}>) {
  assertText(input.familyKey, "Experiment family key");
  assertText(input.hypothesis, "Experiment hypothesis");
  assertText(input.primaryStatistic, "Primary statistic");
  if (!["left", "right", "two_sided"].includes(input.tail)) throw new Error("Experiment tail is unsupported.");
  assertRate(input.alpha, "Alpha");
  assertRate(input.fdrTarget, "FDR target");
  if (input.dependencyAssumption !== "independent_or_positive_dependency") {
    throw new Error("Benjamini-Hochberg is unsupported for arbitrary dependency in this policy version.");
  }
  if (!input.candidates.length) throw new Error("Experiment family must contain at least one candidate.");
  const candidateIds = input.candidates.map((candidate) => candidate.candidateId);
  if (uniqueSorted(candidateIds).length !== candidateIds.length) throw new Error("Experiment family rejects duplicate candidate IDs.");
  input.candidates.forEach((candidate) => {
    assertText(candidate.candidateId, "Candidate ID");
    assertText(candidate.label, "Candidate label");
  });
  const candidates = Object.freeze(input.candidates
    .map((candidate) => Object.freeze({ candidateId: candidate.candidateId, label: candidate.label }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId)));
  const core = Object.freeze({
    schemaVersion: CONTROLLED_EXPERIMENT_SCHEMA,
    registrationVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    familyKey: input.familyKey,
    hypothesis: input.hypothesis,
    primaryStatistic: input.primaryStatistic,
    tail: input.tail,
    alpha: input.alpha,
    fdrTarget: input.fdrTarget,
    dependencyAssumption: input.dependencyAssumption,
    candidates,
    methods: METHODS,
    diagnostics: DIAGNOSTICS,
    researchOnly: true as const,
    automaticSelectionAllowed: false as const,
    automaticPromotionAllowed: false as const,
    authority: EXPERIMENT_POLICY_AUTHORITY
  });
  return Object.freeze({ ...core, familyId: await canonicalHash(core) }) as Readonly<ControlledExperimentRegistration>;
}

export async function validateControlledExperimentRegistration(value: unknown) {
  if (!value || typeof value !== "object") return Object.freeze(["experiment_registration_missing"]);
  const registration = value as Partial<ControlledExperimentRegistration>;
  const blockers: string[] = [];
  if (registration.schemaVersion !== CONTROLLED_EXPERIMENT_SCHEMA || registration.registrationVersion !== "v1") blockers.push("experiment_registration_schema_unsupported");
  if (registration.hashVersion !== V2_CANONICAL_HASH_VERSION || !HASH.test(String(registration.familyId ?? ""))) blockers.push("experiment_registration_identity_invalid");
  if (!registration.researchOnly || registration.automaticSelectionAllowed !== false || registration.automaticPromotionAllowed !== false) blockers.push("experiment_registration_authority_invalid");
  if (!exact(registration.authority, EXPERIMENT_POLICY_AUTHORITY)) blockers.push("experiment_registration_authority_invalid");
  if (!Number.isFinite(registration.alpha) || registration.alpha! <= 0 || registration.alpha! >= 1 ||
      !Number.isFinite(registration.fdrTarget) || registration.fdrTarget! <= 0 || registration.fdrTarget! >= 1 ||
      registration.dependencyAssumption !== "independent_or_positive_dependency") blockers.push("experiment_registration_assumptions_invalid");
  if (!["left", "right", "two_sided"].includes(String(registration.tail))) blockers.push("experiment_registration_assumptions_invalid");
  const candidates = registration.candidates ?? [];
  const ids = candidates.map((candidate) => candidate.candidateId);
  if (!ids.length || uniqueSorted(ids).length !== ids.length || !exact(ids, [...ids].sort())) blockers.push("experiment_registration_family_invalid");
  if (!exact(registration.methods, METHODS)) blockers.push("experiment_registration_methods_invalid");
  if (!exact(registration.diagnostics, DIAGNOSTICS)) blockers.push("experiment_registration_diagnostics_invalid");
  if (HASH.test(String(registration.familyId ?? ""))) {
    const { familyId, ...core } = registration as ControlledExperimentRegistration;
    if (await canonicalHash(core) !== familyId) blockers.push("experiment_registration_identity_invalid");
  }
  return Object.freeze(uniqueSorted(blockers));
}

export async function assessMultipleComparisons(
  registration: Readonly<ControlledExperimentRegistration>,
  trials: readonly Readonly<ExperimentTrialResult>[]
) {
  const registrationBlockers = await validateControlledExperimentRegistration(registration);
  if (registrationBlockers.length) throw new Error(`Experiment registration rejected: ${registrationBlockers.join(", ")}`);
  if (trials.length !== registration.candidates.length) throw new Error("Experiment assessment requires the complete preregistered family.");
  const registeredIds = registration.candidates.map((candidate) => candidate.candidateId);
  const trialIds = trials.map((trial) => trial.candidateId);
  if (uniqueSorted(trialIds).length !== trialIds.length || !exact(uniqueSorted(trialIds), registeredIds)) {
    throw new Error("Experiment assessment candidate membership does not match registration.");
  }
  trials.forEach((trial) => {
    if (trial.familyId !== registration.familyId) throw new Error("Experiment trial family identity mismatch.");
    if (!Number.isFinite(trial.rawPValue) || trial.rawPValue < 0 || trial.rawPValue > 1) throw new Error("Experiment raw p-value must be between zero and one.");
  });

  const ranked = [...trials].sort((left, right) => left.rawPValue - right.rawPValue || left.candidateId.localeCompare(right.candidateId));
  const count = ranked.length;
  let bhCutoff = 0;
  ranked.forEach((trial, index) => {
    if (trial.rawPValue <= registration.fdrTarget * (index + 1) / count) bhCutoff = index + 1;
  });
  const bhAdjusted = new Array<number>(count);
  let nextBh = 1;
  for (let index = count - 1; index >= 0; index -= 1) {
    nextBh = Math.min(nextBh, ranked[index].rawPValue * count / (index + 1));
    bhAdjusted[index] = round(nextBh);
  }
  const holmAdjusted = new Array<number>(count);
  let previousHolm = 0;
  let holmStillRejecting = true;
  const holmRejected = new Array<boolean>(count);
  ranked.forEach((trial, index) => {
    const multiplier = count - index;
    previousHolm = Math.max(previousHolm, trial.rawPValue * multiplier);
    holmAdjusted[index] = round(previousHolm);
    const passes = trial.rawPValue <= registration.alpha / multiplier;
    holmStillRejecting = holmStillRejecting && passes;
    holmRejected[index] = holmStillRejecting;
  });

  const results = Object.freeze(ranked.map((trial, index) => Object.freeze({
    candidateId: trial.candidateId,
    rawPValue: trial.rawPValue,
    rank: index + 1,
    benjaminiHochberg: Object.freeze({
      criticalThreshold: round(registration.fdrTarget * (index + 1) / count),
      adjustedQValue: bhAdjusted[index],
      rejected: index + 1 <= bhCutoff
    }),
    holm: Object.freeze({
      criticalThreshold: round(registration.alpha / (count - index)),
      adjustedPValue: holmAdjusted[index],
      rejected: holmRejected[index]
    }),
    bonferroni: Object.freeze({
      criticalThreshold: round(registration.alpha / count),
      adjustedPValue: round(trial.rawPValue * count),
      rejected: trial.rawPValue <= registration.alpha / count
    })
  })) as readonly Readonly<MultipleComparisonCandidateAssessment>[]);
  const core = Object.freeze({
    schemaVersion: MULTIPLE_COMPARISON_SCHEMA,
    assessmentVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION,
    familyId: registration.familyId,
    candidateCount: count,
    alpha: registration.alpha,
    fdrTarget: registration.fdrTarget,
    dependencyAssumption: registration.dependencyAssumption,
    familyComplete: true as const,
    results,
    diagnostics: registration.diagnostics,
    researchOnly: true as const,
    automaticSelectionAllowed: false as const,
    automaticPromotionAllowed: false as const,
    authority: EXPERIMENT_POLICY_AUTHORITY
  });
  return Object.freeze({ ...core, assessmentId: await canonicalHash(core) }) as Readonly<MultipleComparisonAssessment>;
}

export async function validateMultipleComparisonAssessment(
  value: unknown,
  registration: Readonly<ControlledExperimentRegistration>,
  trials: readonly Readonly<ExperimentTrialResult>[]
) {
  if (!value || typeof value !== "object") return Object.freeze(["multiple_comparison_assessment_missing"]);
  const assessment = value as Partial<MultipleComparisonAssessment>;
  const blockers: string[] = [];
  if (assessment.schemaVersion !== MULTIPLE_COMPARISON_SCHEMA || assessment.assessmentVersion !== "v1") blockers.push("multiple_comparison_schema_unsupported");
  if (assessment.hashVersion !== V2_CANONICAL_HASH_VERSION || !HASH.test(String(assessment.assessmentId ?? ""))) blockers.push("multiple_comparison_identity_invalid");
  if (assessment.familyId !== registration.familyId || assessment.familyComplete !== true) blockers.push("multiple_comparison_family_invalid");
  if (!assessment.researchOnly || assessment.automaticSelectionAllowed !== false || assessment.automaticPromotionAllowed !== false) blockers.push("multiple_comparison_authority_invalid");
  if (!exact(assessment.authority, EXPERIMENT_POLICY_AUTHORITY)) blockers.push("multiple_comparison_authority_invalid");
  if (HASH.test(String(assessment.assessmentId ?? ""))) {
    const { assessmentId, ...core } = assessment as MultipleComparisonAssessment;
    if (await canonicalHash(core) !== assessmentId) blockers.push("multiple_comparison_identity_invalid");
  }
  if (!blockers.filter((blocker) => blocker !== "multiple_comparison_identity_invalid").length) {
    const expected = await assessMultipleComparisons(registration, trials);
    if (!exact(value, expected)) blockers.push("multiple_comparison_reproduction_mismatch");
  }
  return Object.freeze(uniqueSorted(blockers));
}
