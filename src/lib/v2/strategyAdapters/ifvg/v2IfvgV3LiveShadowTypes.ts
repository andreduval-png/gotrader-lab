import type { V2Authority } from "../../authority/v2Authority";
import type { V2CanonicalCandleWindow } from "../../candles/v2CandleTypes";
import type { V2CanonicalMarketState } from "../../context/v2ContextTypes";
import type {
  LegacyIfvgV3SelectionObservation,
  V2IfvgV3SelectionState
} from "./v2IfvgV3SelectionTypes";
import type { V2IfvgV3ParityOutcome } from "./v2IfvgV3Types";

export const V2_IFVG_V3_LIVE_SHADOW_SCHEMA = "gotrader-v2-ifvg-v3-live-shadow-observation";
export const V2_IFVG_V3_LIVE_SHADOW_VERSION = "phase-3d-live-shadow-v1";
export const V2_IFVG_V3_LIVE_SHADOW_LEDGER_SCHEMA = "gotrader-v2-ifvg-v3-live-shadow-ledger";
export const V2_IFVG_V3_LIVE_SHADOW_LEDGER_VERSION = "1.0.0";
export const V2_IFVG_V3_LIVE_SHADOW_FILE_SCHEMA = "gotrader-v2-ifvg-v3-live-shadow-ledger-file";
export const V2_IFVG_V3_LIVE_SHADOW_FILE_VERSION = "1.0.0";
export const V2_IFVG_V3_LIVE_SHADOW_MAX_OBSERVATIONS = 256;

export type V2IfvgV3LiveShadowStatus =
  | "exact_parity"
  | "regression"
  | "insufficient_comparison_data"
  | "blocked_context";

export interface V2IfvgV3LiveShadowSourceSummary {
  provider: "mt5_read_only";
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
  primaryWindowIdentityHash: string;
  contextArtifactId: string;
  windowReferenceTime: string;
  lastClosedCandleTime?: string;
  distinctClosedWindowKey: string;
  marketDateNewYork: string;
}

export interface V2IfvgV3LiveShadowParitySummary {
  outcome: V2IfvgV3ParityOutcome;
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
  differences: readonly string[];
  limitations: readonly string[];
}

export interface V2IfvgV3LiveShadowObservation {
  schemaId: typeof V2_IFVG_V3_LIVE_SHADOW_SCHEMA;
  version: typeof V2_IFVG_V3_LIVE_SHADOW_VERSION;
  observationId: string;
  collectedAtUtc: string;
  source: Readonly<V2IfvgV3LiveShadowSourceSummary>;
  status: V2IfvgV3LiveShadowStatus;
  parity?: Readonly<V2IfvgV3LiveShadowParitySummary>;
  contextStatus: "eligible" | "degraded" | "blocked";
  blockers: readonly string[];
  warnings: readonly string[];
  statisticallyIndependentWindowClaimed: false;
  fullCandidateSetOrderingParityAchieved: false;
  fullStrategyParityClaimed: false;
  canCreateValidationChainEntry: false;
  productionAdoptionAllowed: false;
  researchOnly: true;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgV3LiveShadowCollectorInput {
  context: Readonly<V2CanonicalMarketState>;
  primaryWindow: Readonly<V2CanonicalCandleWindow>;
  legacyObservation?: Readonly<LegacyIfvgV3SelectionObservation>;
  collectedAtUtc?: string;
}

export interface V2IfvgV3LiveShadowLedger {
  schemaId: typeof V2_IFVG_V3_LIVE_SHADOW_LEDGER_SCHEMA;
  version: typeof V2_IFVG_V3_LIVE_SHADOW_LEDGER_VERSION;
  policyVersion: typeof V2_IFVG_V3_LIVE_SHADOW_VERSION;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  observations: readonly Readonly<V2IfvgV3LiveShadowObservation>[];
  processedObservationCount: number;
  compactedObservationCount: number;
  exactParityCount: number;
  regressionCount: number;
  insufficientComparisonCount: number;
  blockedContextCount: number;
  distinctClosedWindowCount: number;
  distinctMarketDateCount: number;
  productionAdoptionAllowed: false;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgV3LiveShadowAppendResult {
  action: "added" | "idempotent" | "rejected_conflict";
  ledger: Readonly<V2IfvgV3LiveShadowLedger>;
  blockers: readonly string[];
}

export interface V2IfvgV3LiveShadowLedgerFile {
  schemaId: typeof V2_IFVG_V3_LIVE_SHADOW_FILE_SCHEMA;
  version: typeof V2_IFVG_V3_LIVE_SHADOW_FILE_VERSION;
  savedAtUtc: string;
  ledgerHash: string;
  ledger: Readonly<V2IfvgV3LiveShadowLedger>;
}

export interface V2IfvgV3LiveShadowValidationResult {
  status: "accepted" | "blocked";
  ledger?: Readonly<V2IfvgV3LiveShadowLedger>;
  file?: Readonly<V2IfvgV3LiveShadowLedgerFile>;
  blockers: readonly string[];
}
