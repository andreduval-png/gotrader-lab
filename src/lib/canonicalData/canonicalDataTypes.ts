import type { Candle } from "@/lib/types";
import type { IctAnalysisTimeframe } from "@/lib/ict-strategy-suite/ictMarketAnalysisContextTypes";

export type CanonicalDataTier = "LIVE_CONTEXT" | "TACTICAL_RESEARCH" | "HISTORICAL_VALIDATION" | "FORWARD_EVIDENCE";
export type CanonicalRequirementBasis = "SOURCE_DEFINED" | "CODE_REQUIRED" | "COMPATIBILITY_BASELINE" | "RESEARCH_PARAMETER" | "UNKNOWN";
export type CanonicalContinuityPolicy = "SESSION_AWARE_REQUIRED" | "REPORT_ONLY" | "NONE";
export type CanonicalContinuityStatus =
  | "VERIFIED"
  | "GAPS_PRESENT"
  | "PROVIDER_OUTAGE"
  | "MAINTENANCE"
  | "EXPECTED_SESSION_BREAK"
  | "UNKNOWN";

export interface CanonicalTimeframeRequirement {
  timeframe: IctAnalysisTimeframe;
  minimumWarmupBars: number;
  evaluationBars: number;
  minimumCalendarDays?: number;
  optionalMaximumHistoryBars?: number;
  basis: CanonicalRequirementBasis;
  reason: string;
}

export interface CanonicalDataRequirement {
  contractVersion: "1.0.0";
  ownerId: string;
  consumerId: string;
  tier: CanonicalDataTier;
  purpose: string;
  requiredTimeframes: readonly CanonicalTimeframeRequirement[];
  sessionHistoryRequirements: readonly string[];
  weekHistoryRequirements: number;
  requiresCompletedBars: boolean;
  continuityPolicy: CanonicalContinuityPolicy;
  researchWindow?: { maximumCandles: number; basis: CanonicalRequirementBasis };
  validationWindow?: { calendarDays: number; maximumCandles: number; basis: CanonicalRequirementBasis };
  requiredFactTypes?: readonly string[];
  inheritsOwnerId?: string;
}

export interface CanonicalFetchPlanRequest {
  timeframe: IctAnalysisTimeframe;
  requestTimeframe: string;
  minimumWarmupBars: number;
  evaluationBars: number;
  minimumCalendarDays: number;
  maximumHistoryBars?: number;
  requiresCompletedBars: boolean;
  continuityPolicy: CanonicalContinuityPolicy;
  consumerIds: readonly string[];
}

export interface CanonicalFetchPlan {
  contractVersion: "1.0.0";
  planId: string;
  tier: CanonicalDataTier;
  requestedSymbol: string;
  brokerSymbol: string;
  provider: string;
  sourceId: string;
  asOf: string;
  requests: readonly CanonicalFetchPlanRequest[];
  sessionHistoryRequirements: readonly string[];
  weekHistoryRequirements: number;
  consumerIds: readonly string[];
  concurrencyLimit: number;
}

export interface CanonicalContinuityGap {
  previousTimestamp: string;
  nextTimestamp: string;
  missingBars: number;
  classification: Exclude<CanonicalContinuityStatus, "VERIFIED" | "UNKNOWN">;
}

export interface CanonicalContinuityReport {
  status: CanonicalContinuityStatus;
  timeframe: IctAnalysisTimeframe;
  expectedIntervalMs: number;
  observedBars: number;
  gaps: readonly CanonicalContinuityGap[];
  safeForCanonicalFacts: boolean;
  policyId: "gotrader.canonical-data.continuity.session-aware.v1";
}

export interface CanonicalCompletedBarPartition {
  timeframe: IctAnalysisTimeframe;
  asOf: string;
  closedCandles: readonly Candle[];
  formingCandles: readonly Candle[];
  malformedCandles: readonly Candle[];
  providerTimestampConvention: "BAR_OPEN_TIME";
  policyId: "gotrader.canonical-data.completed-bars.v1";
}

export interface CanonicalTimeframeDataSnapshot {
  timeframe: IctAnalysisTimeframe;
  closedCandles: readonly Candle[];
  liveDisplayCandle?: Candle;
  continuity: CanonicalContinuityReport;
  warmupBars: number;
  evaluationBars: number;
  firstEvaluationIndex: number;
  sourceMethod: string;
}

export interface CanonicalDataSnapshot {
  snapshotId: string;
  fetchPlanId: string;
  asOf: string;
  requestedSymbol: string;
  brokerSymbol: string;
  tier: CanonicalDataTier;
  timeframes: Readonly<Partial<Record<IctAnalysisTimeframe, CanonicalTimeframeDataSnapshot>>>;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}

export interface CanonicalStrategyDataView {
  viewId: string;
  snapshotId: string;
  consumerId: string;
  ownerId: string;
  tier: CanonicalDataTier;
  asOf: string;
  dependencyStatus: "AVAILABLE" | "DEPENDENCY_UNAVAILABLE";
  missingFactTypes: readonly string[];
  timeframes: Readonly<Partial<Record<IctAnalysisTimeframe, {
    candles: readonly Candle[];
    warmupEndIndex: number;
    evaluationStartIndex: number;
    evaluationEndIndex: number;
    continuityStatus: CanonicalContinuityStatus;
    completedBarsOnly: boolean;
  }>>>;
}
