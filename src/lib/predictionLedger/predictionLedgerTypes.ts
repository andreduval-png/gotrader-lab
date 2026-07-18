import type { ForwardScenarioMap, ForwardScenarioProbabilityBand } from "@/lib/forwardScenario";
import type { Mt5CanonicalCandle } from "@/lib/mt5PushFeed";
import type { MarketEpisodeOpportunity } from "@/lib/marketEpisodes";

export const PREDICTION_LEDGER_AUTHORITY = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;

export type PredictionLifecycleState =
  | "observed_context"
  | "anticipated"
  | "forming"
  | "armed"
  | "triggered"
  | "invalidated"
  | "expired"
  | "resolved";

export type PredictionResolution =
  | "pending"
  | "target_first"
  | "invalidation_first"
  | "ambiguous"
  | "expired"
  | "not_actionable";

export type PredictionProbabilitySource =
  | "heuristic_uncalibrated"
  | "historical_episode_rate"
  | "walk_forward_calibrated";

export type PredictionCalibrationClassification =
  | "uncalibrated"
  | "insufficient_data"
  | "calibrated_positive"
  | "calibrated_negative"
  | "unstable";

export interface PredictionPriceZone {
  lower: number;
  upper: number;
}

export interface UniversalPredictionLedgerEntry {
  predictionId: string;
  scenarioMapId: string;
  scenarioId: string;
  scenarioFamily: string;
  modelVersion: string;
  issuedAt: string;
  asOfTimestamp: string;
  expiresAt: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceProvider: string;
  sourceFingerprint: string;
  direction: "bullish" | "bearish" | "neutral";
  lifecycleState: PredictionLifecycleState;
  probabilityBand: ForwardScenarioProbabilityBand;
  probabilityEstimate: number;
  probabilitySource: PredictionProbabilitySource;
  calibrationSampleSize: number;
  confidenceInterval?: { lower: number; upper: number };
  thesis: string;
  liquidityDraw: string;
  expectedSequence: string[];
  requiredConfirmations: string[];
  invalidationConditions: string[];
  entryZone?: PredictionPriceZone;
  stopReference?: number;
  targetReferences: Array<{ label: string; price: number }>;
  expectedR?: number;
  triggeredAt?: string;
  resolvedAt?: string;
  resolution: PredictionResolution;
  realizedR?: number;
  barsObserved: number;
  maxBarsToResolve: number;
  independentDate: string;
  blockerSummary: string;
  authority: typeof PREDICTION_LEDGER_AUTHORITY;
  safety: {
    researchOnly: true;
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    autoPromotionAllowed: false;
    executionIntentCreated: false;
  };
}

export interface PredictionLedgerState {
  version: 1;
  updatedAt: string;
  entries: UniversalPredictionLedgerEntry[];
  authority: typeof PREDICTION_LEDGER_AUTHORITY;
}

export interface PredictionIssueOptions {
  modelVersion?: string;
  maxBarsToResolve?: number;
  probabilitySource?: PredictionProbabilitySource;
  historicalTargetFirstRate?: number;
  historicalSampleSize?: number;
  confidenceInterval?: { lower: number; upper: number };
}

export interface PredictionLedgerCandleUpdate {
  entries: UniversalPredictionLedgerEntry[];
  updatedPredictionIds: string[];
  ignored: boolean;
  reason?: string;
  authority: typeof PREDICTION_LEDGER_AUTHORITY;
}

export interface PredictionCalibrationSummary {
  generatedAt: string;
  scenarioFamily?: string;
  totalForecasts: number;
  actionableForecasts: number;
  completedForecasts: number;
  pendingForecasts: number;
  targetFirst: number;
  invalidationFirst: number;
  ambiguous: number;
  expired: number;
  targetFirstRate: number | null;
  averagePredictedProbability: number | null;
  brierScore: number | null;
  calibrationError: number | null;
  averageRealizedR: number | null;
  profitFactor: number | null;
  independentDates: number;
  activeWindows: number;
  classification: PredictionCalibrationClassification;
  blockers: string[];
  autoPromotionAllowed: false;
  authority: typeof PREDICTION_LEDGER_AUTHORITY;
}

export interface PredictionLedgerMt5Subscription {
  unsubscribe: () => void;
  processedCandleCount: () => number;
  updatedPredictionCount: () => number;
}

export interface MarketOpportunityPredictionInput {
  opportunity: MarketEpisodeOpportunity;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
  modelVersion: string;
  scenarioFamily: string;
  maxBarsToResolve?: number;
}

export interface CmdLondonLongV2Subscription {
  unsubscribe: () => void;
  processedCandleCount: () => number;
  issuedObservationCount: () => number;
  blockedObservationCount: () => number;
}

export interface FrozenMarketEpisodeProfileSubscription {
  unsubscribe: () => void;
  processedCandleCount: () => number;
  issuedObservationCount: () => number;
  blockedObservationCount: () => number;
}

export type PredictionScenarioMapInput = ForwardScenarioMap;
export type PredictionCandleInput = Pick<
  Mt5CanonicalCandle,
  "timestamp" | "high" | "low" | "close" | "brokerSymbol" | "requestedSymbol" | "timeframe" | "sourceFingerprint"
>;
