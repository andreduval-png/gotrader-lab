import type { V2Authority } from "../../authority/v2Authority";
import type { V2CanonicalCandleWindow } from "../../candles/v2CandleTypes";
import type { V2CanonicalMarketState } from "../../context/v2ContextTypes";
import type { V2StrategyAdapterDiagnostics } from "../v2StrategyAdapter";
import type { V2IfvgV3ParityOutcome } from "./v2IfvgV3Types";

export const V2_IFVG_V3_GEOMETRY_ADAPTER_ID = "gotrader-v2-ifvg-v3-geometry-shadow-adapter";
export const V2_IFVG_V3_GEOMETRY_ADAPTER_VERSION = "phase-3b-geometry-v1";
export const V2_IFVG_V3_GEOMETRY_INPUT_CONTRACT_VERSION = "canonical-context-plus-primary-window-v1";
export const V2_IFVG_V3_GEOMETRY_ARTIFACT_SCHEMA_VERSION = "gotrader-v2-ifvg-v3-geometry-artifact-v1";
export const V2_IFVG_V3_GEOMETRY_COMPARISON_SCHEMA_VERSION = "gotrader-v2-ifvg-v3-geometry-comparison-v1";
export const V2_IFVG_V3_RETEST_HORIZON_BARS = 24;

export type V2IfvgV3GeometryArtifactState =
  | "constructed"
  | "blocked"
  | "insufficient_data";

export interface V2IfvgV3RetestReference {
  candleCloseTime: string;
  barsAfterInversion: number;
  cleanRetest: boolean;
  signalAgeBars: number;
  signalFresh: boolean;
}

export interface V2IfvgV3GeometryValues {
  zoneLow: number;
  zoneHigh: number;
  zoneMidpoint: number;
  entry?: number;
  invalidation?: number;
  target?: number;
  rr?: number;
  riskDistance?: number;
  targetDistance?: number;
  minimumRR: number;
}

export interface V2IfvgV3TargetReference {
  type: "buy_side_liquidity" | "sell_side_liquidity";
  source: "prior_swing";
  price: number;
}

export interface V2IfvgV3GeometryArtifact {
  schemaVersion: typeof V2_IFVG_V3_GEOMETRY_ARTIFACT_SCHEMA_VERSION;
  artifactId: string;
  origin: "legacy_normalized" | "v2_shadow";
  normalizedCandidateId: string;
  detectionArtifactId?: string;
  strategyId: "ifvg_v1";
  profileId: "ifvg_fresh_retest_v3_research";
  adapterVersion: string;
  artifactState: V2IfvgV3GeometryArtifactState;
  direction: "long" | "short";
  source: Readonly<{
    provider: string;
    requestedSymbol: string;
    brokerSymbol: string;
    sourceFingerprint: string;
    timeframe: string;
  }>;
  contextArtifactId: string;
  contextIdentityHash: string;
  primaryWindowIdentityHash: string;
  inversionTime: string;
  retest?: Readonly<V2IfvgV3RetestReference>;
  geometry: Readonly<V2IfvgV3GeometryValues>;
  targetReference?: Readonly<V2IfvgV3TargetReference>;
  constructionValid: boolean;
  geometryComplete: boolean;
  blockerIds: readonly string[];
  warningIds: readonly string[];
  limitationIds: readonly string[];
  observedMarketTime: string;
  causalClosedCandleTime: string;
  canCreateValidationChainEntry: false;
  researchOnly: true;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgV3GeometryCanaryInput {
  context: Readonly<V2CanonicalMarketState>;
  primaryWindow: Readonly<V2CanonicalCandleWindow>;
}

export interface V2IfvgV3GeometryAdapterResult {
  strategyId: "ifvg_v1";
  profileId: "ifvg_fresh_retest_v3_research";
  adapterId: typeof V2_IFVG_V3_GEOMETRY_ADAPTER_ID;
  adapterVersion: typeof V2_IFVG_V3_GEOMETRY_ADAPTER_VERSION;
  inputContractVersion: typeof V2_IFVG_V3_GEOMETRY_INPUT_CONTRACT_VERSION;
  contextArtifactId: string;
  sourceFingerprint: string;
  primaryWindowIdentityHash: string;
  artifacts: readonly Readonly<V2IfvgV3GeometryArtifact>[];
  diagnostics: Readonly<V2StrategyAdapterDiagnostics>;
  selectedCandidateRankingMigrated: false;
  fullStrategyParityClaimed: false;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface LegacyIfvgV3GeometryObservation {
  strategyId: "ifvg_v1";
  profileId: "ifvg_fresh_retest_v3_research";
  sourceFingerprint: string;
  contextArtifactId: string;
  primaryWindowIdentityHash: string;
  artifacts: readonly Readonly<V2IfvgV3GeometryArtifact>[];
  diagnostics: Readonly<V2StrategyAdapterDiagnostics>;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgV3GeometryCandidateComparison {
  normalizedCandidateId: string;
  outcome: V2IfvgV3ParityOutcome;
  differences: readonly string[];
  legacyArtifactId?: string;
  v2ArtifactId?: string;
}

export interface V2IfvgV3GeometryComparisonReport {
  schemaVersion: typeof V2_IFVG_V3_GEOMETRY_COMPARISON_SCHEMA_VERSION;
  reportId: string;
  profileId: "ifvg_fresh_retest_v3_research";
  sourceFingerprint: string;
  contextArtifactId: string;
  primaryWindowIdentityHash: string;
  outcome: V2IfvgV3ParityOutcome;
  legacyArtifactCount: number;
  v2ArtifactCount: number;
  candidateComparisons: readonly Readonly<V2IfvgV3GeometryCandidateComparison>[];
  differences: readonly string[];
  documentedVariances: readonly string[];
  limitations: readonly string[];
  selectedCandidateGeometryParityAchieved: boolean;
  fullCandidateSelectionParityAchieved: false;
  fullStrategyParityClaimed: false;
  productionAdoptionAllowed: false;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}
