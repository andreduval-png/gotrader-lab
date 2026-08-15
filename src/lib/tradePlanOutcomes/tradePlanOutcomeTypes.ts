import type { ResearchCycleStatus } from "@/lib/researchCycle/researchCycleTypes";

export type TradePlanHorizon = "scalp" | "intraday" | "swing" | "unspecified";

export type TradePlanOutcomeStatus =
  | "not_evaluable"
  | "pending_entry"
  | "active"
  | "passed_target_first"
  | "failed_stop_first"
  | "ambiguous_stop_first"
  | "not_triggered"
  | "expired_open";

export interface TradePlanOutcomeAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface TradePlanIdentity {
  lineageKey: string;
  sourceFingerprint: string;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol?: string;
  candleSymbol: string;
  timeframe: string;
}

export interface SavedResearchTradePlan {
  planId: string;
  generatedAt: string;
  expiresAt: string;
  strategyId: string;
  tradeModel: string;
  side: "long" | "short" | "flat";
  signal: "BUY" | "SELL" | "NO_TRADE";
  decision: string;
  confidence: number;
  horizon: TradePlanHorizon;
  horizonReason: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  statedRiskReward?: number;
  calculatedRiskReward?: number;
  plannedTargetPoints?: number;
  plannedStopPoints?: number;
  coherent: boolean;
  evaluable: boolean;
  evaluationReason: string;
}

export interface TradePlanObservedOutcome {
  status: TradePlanOutcomeStatus;
  observationRevision: number;
  observedThrough?: string;
  entryReachedAt?: string;
  resolvedAt?: string;
  barsObserved: number;
  realizedPoints?: number;
  realizedR?: number;
  maximumFavorableExcursionPoints?: number;
  maximumAdverseExcursionPoints?: number;
  resultReason: string;
}

export interface TradePlanCycleResultRecord {
  schemaVersion: 1;
  cycleId: string;
  startedAt: string;
  completedAt: string;
  cycleStatus: ResearchCycleStatus;
  identity: TradePlanIdentity;
  plan?: SavedResearchTradePlan;
  outcome: TradePlanObservedOutcome;
  cycleResult: {
    summary: string;
    readinessState: string;
    blockers: string[];
  };
  researchOnly: true;
  authority: TradePlanOutcomeAuthority;
  safety: {
    rawCandlesExcluded: true;
    accountDataExcluded: true;
    orderDataExcluded: true;
    positionDataExcluded: true;
    executionIntentCreated: false;
    calibrationAutoApplyAllowed: false;
  };
}

export interface TradePlanDailySummary {
  date: string;
  cycleCount: number;
  planCount: number;
  passedCount: number;
  failedCount: number;
  ambiguousCount: number;
  pendingCount: number;
  notTriggeredCount: number;
  realizedPoints: number;
}

export interface TradePlanResultsSnapshot {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  cycleCount: number;
  planCount: number;
  evaluatedCount: number;
  passedCount: number;
  failedCount: number;
  ambiguousCount: number;
  pendingCount: number;
  notTriggeredCount: number;
  notEvaluableCount: number;
  plannedTargetPoints: number;
  realizedPoints: number;
  averageRealizedR: number | null;
  passRate: number | null;
  daily: TradePlanDailySummary[];
  records: TradePlanCycleResultRecord[];
  calibrationSuggestions: string[];
  authority: TradePlanOutcomeAuthority;
}

export const TRADE_PLAN_OUTCOME_AUTHORITY: TradePlanOutcomeAuthority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

export const TRADE_PLAN_OUTCOME_SAFETY = {
  rawCandlesExcluded: true,
  accountDataExcluded: true,
  orderDataExcluded: true,
  positionDataExcluded: true,
  executionIntentCreated: false,
  calibrationAutoApplyAllowed: false
} as const;
