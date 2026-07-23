import type { V2Authority } from "../../authority/v2Authority";
import type { V2CanonicalCandleWindow } from "../../candles/v2CandleTypes";
import type { V2CanonicalMarketState } from "../../context/v2ContextTypes";
import type { V2StrategyAdapterDiagnostics } from "../v2StrategyAdapter";
import type { V2IfvgV3ParityOutcome } from "./v2IfvgV3Types";

export const V2_IFVG_V3_SELECTION_ADAPTER_ID = "gotrader-v2-ifvg-v3-selection-shadow-adapter";
export const V2_IFVG_V3_SELECTION_ADAPTER_VERSION = "phase-3c-selection-v1";
export const V2_IFVG_V3_SELECTION_INPUT_CONTRACT_VERSION = "canonical-context-plus-primary-window-v1";
export const V2_IFVG_V3_SELECTION_ARTIFACT_SCHEMA_VERSION = "gotrader-v2-ifvg-v3-selection-artifact-v1";
export const V2_IFVG_V3_SELECTION_COMPARISON_SCHEMA_VERSION = "gotrader-v2-ifvg-v3-selection-comparison-v1";

export type V2IfvgV3SelectionState =
  | "selected"
  | "no_candidate"
  | "ambiguous"
  | "blocked"
  | "insufficient_data";

export type V2IfvgV3SelectionHtfAlignment =
  | "aligned"
  | "against_htf"
  | "mixed"
  | "unavailable";

export interface V2IfvgV3SelectionSessionContext {
  id: "london_open" | "new_york_open" | "rth" | "outside_rth";
  label: string;
  localTime: string;
  timingZone: "America/New_York";
  preferredWindow: boolean;
}

export interface V2IfvgV3SelectionVolumeContext {
  inversionVolume?: number;
  baselineVolume?: number;
  volumeRatio?: number;
  lowVolume: boolean;
  policy: "inversion_vs_prior_24_positive_volume_35pct";
}

export interface V2IfvgV3RankKey {
  readyRank: 0 | 1;
  blockerCount: number;
  recencyIndex: number;
  discoveryIndex: number;
}

export interface V2IfvgV3RankedCandidate {
  normalizedCandidateId: string;
  geometryArtifactId: string;
  direction: "long" | "short";
  selected: boolean;
  rank: number;
  rankKey: Readonly<V2IfvgV3RankKey>;
  baseSelectionReady: boolean;
  htfAlignment: V2IfvgV3SelectionHtfAlignment;
  htfDirections: readonly string[];
  volumeContext: Readonly<V2IfvgV3SelectionVolumeContext>;
  sessionContext?: Readonly<V2IfvgV3SelectionSessionContext>;
  rankingBlockerIds: readonly string[];
  finalBlockerIds: readonly string[];
  warningIds: readonly string[];
  canCreateValidationChainEntry: false;
  researchOnly: true;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgV3SelectionCanaryInput {
  context: Readonly<V2CanonicalMarketState>;
  primaryWindow: Readonly<V2CanonicalCandleWindow>;
}

export interface V2IfvgV3SelectionResult {
  schemaVersion: typeof V2_IFVG_V3_SELECTION_ARTIFACT_SCHEMA_VERSION;
  selectionArtifactId: string;
  strategyId: "ifvg_v1";
  profileId: "ifvg_fresh_retest_v3_research";
  adapterId: typeof V2_IFVG_V3_SELECTION_ADAPTER_ID;
  adapterVersion: typeof V2_IFVG_V3_SELECTION_ADAPTER_VERSION;
  inputContractVersion: typeof V2_IFVG_V3_SELECTION_INPUT_CONTRACT_VERSION;
  sourceFingerprint: string;
  contextArtifactId: string;
  primaryWindowIdentityHash: string;
  selectionState: V2IfvgV3SelectionState;
  selectedCandidateId?: string;
  candidates: readonly Readonly<V2IfvgV3RankedCandidate>[];
  diagnostics: Readonly<V2StrategyAdapterDiagnostics>;
  selectedCandidateRankingMigrated: true;
  fullCandidateSetOrderingObservable: false;
  fullStrategyParityClaimed: false;
  productionAdoptionAllowed: false;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface LegacyIfvgV3SelectionObservation {
  schemaVersion: typeof V2_IFVG_V3_SELECTION_ARTIFACT_SCHEMA_VERSION;
  selectionArtifactId: string;
  strategyId: "ifvg_v1";
  profileId: "ifvg_fresh_retest_v3_research";
  sourceFingerprint: string;
  contextArtifactId: string;
  primaryWindowIdentityHash: string;
  selectionState: V2IfvgV3SelectionState;
  selectedCandidateId?: string;
  selectedCandidate?: Readonly<V2IfvgV3RankedCandidate>;
  diagnostics: Readonly<V2StrategyAdapterDiagnostics>;
  fullCandidateSetOrderingObservable: false;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgV3SelectionComparisonReport {
  schemaVersion: typeof V2_IFVG_V3_SELECTION_COMPARISON_SCHEMA_VERSION;
  reportId: string;
  profileId: "ifvg_fresh_retest_v3_research";
  sourceFingerprint: string;
  contextArtifactId: string;
  primaryWindowIdentityHash: string;
  outcome: V2IfvgV3ParityOutcome;
  differences: readonly string[];
  limitations: readonly string[];
  legacySelectionState: V2IfvgV3SelectionState;
  v2SelectionState: V2IfvgV3SelectionState;
  legacySelectedCandidateId?: string;
  v2SelectedCandidateId?: string;
  selectedCandidateIdentityParityAchieved: boolean;
  selectedCandidateBlockerParityAchieved: boolean;
  htfAlignmentParityAchieved: boolean;
  volumeBlockerParityAchieved: boolean;
  sessionContextParityAchieved: boolean;
  selectedCandidateRankingParityAchieved: boolean;
  fullCandidateSetOrderingParityAchieved: false;
  fullStrategyParityClaimed: false;
  productionAdoptionAllowed: false;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}
