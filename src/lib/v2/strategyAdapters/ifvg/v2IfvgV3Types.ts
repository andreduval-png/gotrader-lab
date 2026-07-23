import type { V2Authority } from "../../authority/v2Authority";
import type { V2StrategyAdapterResult } from "../v2StrategyAdapter";

export const V2_IFVG_V3_PROFILE_ID = "ifvg_fresh_retest_v3_research";
export const V2_IFVG_V3_STRATEGY_ID = "ifvg_v1";
export const V2_IFVG_V3_ADAPTER_ID = "gotrader-v2-ifvg-v3-shadow-adapter";
export const V2_IFVG_V3_ADAPTER_VERSION = "phase-3a-detection-v1";
export const V2_IFVG_V3_INPUT_CONTRACT_VERSION = "canonical-market-state-v1";
export const V2_IFVG_V3_ARTIFACT_SCHEMA_VERSION = "gotrader-v2-ifvg-shadow-artifact-v1";
export const V2_IFVG_V3_COMPARISON_SCHEMA_VERSION = "gotrader-v2-ifvg-shadow-comparison-v1";

export type V2IfvgV3ArtifactState = "detected" | "rejected" | "blocked" | "expired";
export type V2IfvgV3DetectionFlowState =
  | "inversion_confirmed"
  | "awaiting_inversion"
  | "invalidated"
  | "expired"
  | "insufficient_data";

export interface V2IfvgV3SourceReference {
  provider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  sourceFingerprint: string;
  timeframe: string;
}

export interface V2IfvgV3FvgReference {
  factId?: string;
  semanticIdentityHash: string;
  originalDirection: "bullish" | "bearish";
  confirmationCandleTime: string;
  lifecycleState: string;
}

export interface V2IfvgV3InversionReference {
  originalFvgFactId?: string;
  inversionTime: string;
  derivedFromLifecycleState: "inverted";
}

export interface V2IfvgV3DetectionArtifact {
  schemaVersion: typeof V2_IFVG_V3_ARTIFACT_SCHEMA_VERSION;
  artifactId: string;
  normalizedCandidateId: string;
  strategyId: typeof V2_IFVG_V3_STRATEGY_ID;
  profileId: typeof V2_IFVG_V3_PROFILE_ID;
  adapterVersion: string;
  artifactState: V2IfvgV3ArtifactState;
  detectionFlowState: V2IfvgV3DetectionFlowState;
  direction: "long" | "short";
  source: Readonly<V2IfvgV3SourceReference>;
  contextArtifactId: string;
  contextIdentityHash: string;
  fvgReference: Readonly<V2IfvgV3FvgReference>;
  ifvgReference?: Readonly<V2IfvgV3InversionReference>;
  displacementFactId?: string;
  liquidityFactIds: readonly string[];
  confirmationState: "confirmed_closed_candle" | "not_confirmed";
  blockerIds: readonly string[];
  limitationIds: readonly string[];
  observedMarketTime: string;
  causalClosedCandleTime: string;
  policyVersion: string;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface LegacyIfvgV3DetectionObservation {
  strategyId: typeof V2_IFVG_V3_STRATEGY_ID;
  profileId: typeof V2_IFVG_V3_PROFILE_ID;
  sourceFingerprint: string;
  contextArtifactId: string;
  artifacts: readonly Readonly<V2IfvgV3DetectionArtifact>[];
  diagnostics: Readonly<{
    status: "eligible" | "blocked" | "insufficient_data";
    blockers: readonly string[];
    warnings: readonly string[];
    limitations: readonly string[];
  }>;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export type V2IfvgV3AdapterResult = V2StrategyAdapterResult<V2IfvgV3DetectionArtifact>;

export type V2IfvgV3ParityOutcome =
  | "exact_parity"
  | "acceptable_normalized_variance"
  | "legacy_only"
  | "v2_only"
  | "regression"
  | "insufficient_comparison_data";

export interface V2IfvgV3CandidateComparison {
  normalizedCandidateId: string;
  outcome: V2IfvgV3ParityOutcome;
  differences: readonly string[];
  legacyArtifactId?: string;
  v2ArtifactId?: string;
}

export interface V2IfvgV3ComparisonReport {
  schemaVersion: typeof V2_IFVG_V3_COMPARISON_SCHEMA_VERSION;
  reportId: string;
  profileId: typeof V2_IFVG_V3_PROFILE_ID;
  contextArtifactId: string;
  sourceFingerprint: string;
  outcome: V2IfvgV3ParityOutcome;
  legacyDetectedCount: number;
  v2DetectedCount: number;
  candidateComparisons: readonly Readonly<V2IfvgV3CandidateComparison>[];
  differences: readonly string[];
  limitations: readonly string[];
  detectionParityAchieved: boolean;
  fullStrategyParityClaimed: false;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}
