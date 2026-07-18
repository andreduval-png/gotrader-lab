import type { Candle } from "@/lib/types";

export const MARKET_EPISODE_AUTHORITY = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;

export type MarketEpisodeEventType =
  | "session_open"
  | "consolidation"
  | "liquidity_sweep"
  | "displacement"
  | "fair_value_gap"
  | "cisd"
  | "expansion";

export type MarketEpisodeDirection = "bullish" | "bearish" | "neutral";
export type MarketEpisodeSession = "asia" | "london" | "new_york_am" | "new_york_pm" | "off_hours";
export type MarketEpisodeOpportunityFamily =
  | "consolidation_manipulation_distribution"
  | "session_raid_reversal"
  | "displacement_fvg_continuation";
export type MarketEpisodeOutcome =
  | "target_first"
  | "invalidation_first"
  | "ambiguous"
  | "expired"
  | "insufficient_data";

export interface MarketEpisodeEvent {
  eventId: string;
  type: MarketEpisodeEventType;
  timestamp: string;
  session: MarketEpisodeSession;
  direction: MarketEpisodeDirection;
  price?: number;
  lower?: number;
  upper?: number;
  quality: number;
  evidence: string[];
}

export interface MarketEpisodeOpportunity {
  opportunityId: string;
  family: MarketEpisodeOpportunityFamily;
  detectedAt: string;
  session: MarketEpisodeSession;
  side: "long" | "short";
  entryReference: number;
  invalidationReference: number;
  targetReference: number;
  targetBasis: "external_liquidity" | "minimum_2r_projection";
  rr: number;
  evidence: string[];
  outcome: MarketEpisodeOutcome;
  resolvedAt?: string;
  realizedR?: number;
  mfeR?: number;
  maeR?: number;
  barsToResolution?: number;
  researchOnly: true;
}

export interface MarketEpisodeFeatureSnapshot {
  asOfTimestamp: string;
  twelveAmOpen?: number;
  dayOpen: number;
  dayHigh: number;
  dayLow: number;
  dayClose: number;
  dealingRangeMidpoint: number;
  premiumDiscountContext: "premium" | "discount" | "equilibrium";
  medianTrueRange: number;
  medianBodySize: number;
  consolidationCount: number;
  liquiditySweepCount: number;
  displacementCount: number;
  fairValueGapCount: number;
  cisdCount: number;
}

export interface MarketEpisode {
  episodeId: string;
  tradingDate: string;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
  firstTimestamp: string;
  lastTimestamp: string;
  candleCount: number;
  features: MarketEpisodeFeatureSnapshot;
  events: MarketEpisodeEvent[];
  opportunities: MarketEpisodeOpportunity[];
  summary: string;
  authority: typeof MARKET_EPISODE_AUTHORITY;
  safety: {
    researchOnly: true;
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    autoPromotionAllowed: false;
  };
}

export interface MarketEpisodeReconstructionInput {
  candles: Candle[];
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
  timezone?: "America/New_York";
  minimumEpisodeCandles?: number;
  maxResolutionBars?: number;
}

export interface MarketEpisodeReconstructionSummary {
  episodeCount: number;
  opportunityCount: number;
  independentDates: number;
  eventCounts: Record<MarketEpisodeEventType, number>;
  opportunityCounts: Record<MarketEpisodeOpportunityFamily, number>;
  outcomeCounts: Record<MarketEpisodeOutcome, number>;
  targetFirstRate: number | null;
  averageRealizedR: number | null;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
  authority: typeof MARKET_EPISODE_AUTHORITY;
  safety: {
    rawCandlesExcluded: true;
    researchOnly: true;
  };
}

export interface InternalIndexedCandle {
  candle: Candle;
  sourceIndex: number;
}
