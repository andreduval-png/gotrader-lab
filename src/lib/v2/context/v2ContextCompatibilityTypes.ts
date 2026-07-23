import type { V2Authority } from "../authority/v2Authority";
import type { V2CanonicalMarketState, V2ContextFactFamily } from "./v2ContextTypes";

export const V2_CONTEXT_COMPATIBILITY_SCHEMA_VERSION =
  "gotrader-v2-context-compatibility-v1";
export const V2_CONTEXT_COMPATIBILITY_POLICY_VERSION =
  "gotrader-v2-context-compatibility-policy-v1";

export type V2ContextCompatibilityOutcome =
  | "exact_parity"
  | "semantic_parity"
  | "documented_variance"
  | "regression"
  | "insufficient_comparison_data";

export type V2ContextCompatibilityStatus =
  | "ready_for_canary_review"
  | "review_required"
  | "blocked";

export type V2ContextCompatibilityMetricValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];

export interface V2ContextCompatibilityMetric {
  key: string;
  value: V2ContextCompatibilityMetricValue;
}

export interface V2LegacyContextObservation {
  family: V2ContextFactFamily;
  status: "available" | "missing" | "not_comparable";
  requestedSymbol: string;
  brokerSymbol: string;
  sourceFingerprint: string;
  timeframes: readonly string[];
  metrics: readonly Readonly<V2ContextCompatibilityMetric>[];
  summary: string;
  knownDifferences: readonly string[];
  reviewedVariancePolicyId?: string;
  authority: Readonly<V2Authority>;
}

export interface V2ContextFactSummary {
  family: V2ContextFactFamily;
  factCount: number;
  timeframes: readonly string[];
  metrics: readonly Readonly<V2ContextCompatibilityMetric>[];
  summary: string;
}

export interface V2ContextCompatibilityEntry {
  family: V2ContextFactFamily;
  outcome: V2ContextCompatibilityOutcome;
  legacy: Readonly<V2LegacyContextObservation>;
  v2: Readonly<V2ContextFactSummary>;
  differences: readonly string[];
  reviewedVariancePolicyId?: string;
  blocksPhase3: boolean;
}

export interface V2ContextCompatibilityRequest {
  v2Context: Readonly<V2CanonicalMarketState>;
  legacyObservations: readonly Readonly<V2LegacyContextObservation>[];
  builtAt?: string;
}

export interface V2ContextCompatibilityReport {
  reportId: string;
  schemaVersion: typeof V2_CONTEXT_COMPATIBILITY_SCHEMA_VERSION;
  policyVersion: typeof V2_CONTEXT_COMPATIBILITY_POLICY_VERSION;
  contextArtifactId: string;
  sourceFingerprint: string;
  requestedSymbol: string;
  brokerSymbol: string;
  legacyAuthoritative: true;
  v2ShadowOnly: true;
  status: V2ContextCompatibilityStatus;
  entries: readonly Readonly<V2ContextCompatibilityEntry>[];
  blockers: readonly string[];
  warnings: readonly string[];
  builtAt: string;
  rawCandlesSerialized: false;
  authority: Readonly<V2Authority>;
}
