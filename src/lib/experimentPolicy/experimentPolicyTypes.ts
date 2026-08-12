import type { V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";

export const CONTROLLED_EXPERIMENT_SCHEMA = "gotrader-v2-controlled-experiment-v1" as const;
export const MULTIPLE_COMPARISON_SCHEMA = "gotrader-v2-multiple-comparison-assessment-v1" as const;

export const EXPERIMENT_POLICY_AUTHORITY = Object.freeze({
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
});

export type MultipleComparisonMethod = "benjamini_hochberg" | "holm" | "bonferroni";
export type ExperimentTail = "left" | "right" | "two_sided";
export type DependencyAssumption = "independent_or_positive_dependency" | "arbitrary_dependency";

export interface ControlledExperimentCandidate {
  candidateId: string;
  label: string;
}

export interface ControlledExperimentRegistration {
  schemaVersion: typeof CONTROLLED_EXPERIMENT_SCHEMA;
  registrationVersion: "v1";
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  familyKey: string;
  hypothesis: string;
  primaryStatistic: string;
  tail: ExperimentTail;
  alpha: number;
  fdrTarget: number;
  dependencyAssumption: DependencyAssumption;
  candidates: readonly Readonly<ControlledExperimentCandidate>[];
  methods: readonly MultipleComparisonMethod[];
  diagnostics: readonly Readonly<{
    method: "bootstrap_reality_check" | "deflated_sharpe" | "probability_of_backtest_overfitting";
    applicability: "not_applicable";
    reason: string;
  }>[];
  researchOnly: true;
  automaticSelectionAllowed: false;
  automaticPromotionAllowed: false;
  authority: typeof EXPERIMENT_POLICY_AUTHORITY;
  familyId: string;
}

export interface ExperimentTrialResult {
  familyId: string;
  candidateId: string;
  rawPValue: number;
}

export interface MultipleComparisonCandidateAssessment {
  candidateId: string;
  rawPValue: number;
  rank: number;
  benjaminiHochberg: Readonly<{
    criticalThreshold: number;
    adjustedQValue: number;
    rejected: boolean;
  }>;
  holm: Readonly<{
    criticalThreshold: number;
    adjustedPValue: number;
    rejected: boolean;
  }>;
  bonferroni: Readonly<{
    criticalThreshold: number;
    adjustedPValue: number;
    rejected: boolean;
  }>;
}

export interface MultipleComparisonAssessment {
  schemaVersion: typeof MULTIPLE_COMPARISON_SCHEMA;
  assessmentVersion: "v1";
  hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  familyId: string;
  candidateCount: number;
  alpha: number;
  fdrTarget: number;
  dependencyAssumption: DependencyAssumption;
  familyComplete: true;
  results: readonly Readonly<MultipleComparisonCandidateAssessment>[];
  diagnostics: ControlledExperimentRegistration["diagnostics"];
  researchOnly: true;
  automaticSelectionAllowed: false;
  automaticPromotionAllowed: false;
  authority: typeof EXPERIMENT_POLICY_AUTHORITY;
  assessmentId: string;
}
