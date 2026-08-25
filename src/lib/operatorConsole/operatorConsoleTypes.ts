export type OperatorCycleStatus =
  | "idle"
  | "running"
  | "stopping"
  | "completed"
  | "blocked"
  | "failed"
  | "canceled";

export type OperatorCycleStage =
  | "idle"
  | "activating_source"
  | "building_market_read"
  | "running_research"
  | "finalizing"
  | "complete";

export interface OperatorAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface OperatorInsightSummary {
  bias: string;
  setup: string;
  modelLane: string;
  confidence?: number;
  summary: string;
  nextAction: string;
}

export interface OperatorCycleState {
  cycleId?: string;
  ownerTabId?: string;
  ownerInstanceId?: string;
  status: OperatorCycleStatus;
  stage: OperatorCycleStage;
  progressPercent: number;
  message: string;
  startedAt?: string;
  heartbeatAt?: string;
  completedAt?: string;
  lastError?: string;
  sourceFingerprint?: string;
  latestInsight?: OperatorInsightSummary;
  authority: OperatorAuthority;
  autoApplyAllowed: false;
  researchOnly: true;
}

export type OperatorDecisionKind =
  | "source_attention"
  | "cycle_attention"
  | "proposal_review"
  | "paper_demo_review";

export interface OperatorDecision {
  id: string;
  kind: OperatorDecisionKind;
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
  severity: "info" | "warning" | "critical";
}

export interface OperatorSourceSummary {
  provider: string;
  label: string;
  requestedSymbol: string;
  brokerSymbol?: string;
  timeframe: string;
  candleCount: number;
  fingerprint?: string;
  researchEligible: boolean;
  status: "active" | "attention" | "unavailable";
  statusLabel: string;
  lastTimestamp?: string;
}

export interface OperatorResultsSummary {
  totalTrades: number;
  winRate?: number;
  averageR?: number;
  maxDrawdownR?: number;
  profitFactor?: number;
  readiness: string;
  evidenceScore?: number;
  maturityScore?: number;
  walkForwardStatus: string;
  generatedAt?: string;
}

export interface OperatorValidationSummary {
  status: string;
  setupLabel: string;
  nextAction: string;
  updatedAt?: string;
}

export interface OperatorPredictionSummary {
  latestFamily: string;
  latestState: string;
  pendingForecasts: number;
  completedForecasts: number;
  classification: string;
  averageRealizedR?: number;
  nextAction: string;
}

export interface OperatorMemorySummary {
  storedEvidenceRecords: number;
  profileIdentities: number;
  independentCycleDates: number;
  positiveEdgeCycles: number;
  gbrainTotal: number;
  gbrainPending: number;
  gbrainDelivered: number;
  gbrainFailed: number;
  gbrainDeliveryEnabled: boolean;
  latestProfile?: string;
  latestUpdatedAt?: string;
}

export type OperatorResearchPlanStatus = "complete" | "partial" | "no_trade" | "unavailable";

export interface OperatorResearchPlanSummary {
  status: OperatorResearchPlanStatus;
  planIdentityStatus: "current" | "pending_cycle" | "legacy_unbound" | "stale_cycle" | "source_mismatch" | "candidate_mismatch" | "unavailable";
  cycleId?: string;
  currentReadEvaluatedAt?: string;
  currentCandidateId?: string;
  setup: string;
  side: "long" | "short" | "flat";
  setupDirection: "bullish" | "bearish" | "neutral";
  signal: "BUY" | "SELL" | "NO_TRADE";
  planSource: "canonical_geometry" | "unavailable";
  planCoherence: "coherent" | "incomplete" | "incoherent";
  planCoherenceReason: string;
  candidateStatus?: string;
  entryZone?: { lower: number; upper: number };
  entryPrice?: number;
  entryPriceMethod?: "canonical_geometry";
  geometryId?: string;
  geometryStatus?: string;
  geometryValid?: boolean;
  actionable?: boolean;
  displayKind?: "ACTIONABLE_GEOMETRY" | "RESEARCH_GEOMETRY";
  stopLoss?: number;
  takeProfit?: number;
  targetProvenance?: {
    type: string;
    sourceTimeframe?: string;
    selectionReason: string;
    distancePoints?: number;
    rr?: number;
    minimumRR: number;
    gateStatus: "accepted" | "rejected" | "unavailable";
    rejectionReasons: string[];
  };
  riskReward?: number;
  riskScreeningStatus: string;
  riskScreeningReason: string;
  accountRiskEvaluation: "external_simulation_required";
  recommendedMaxRiskPerTradePct?: number;
  sourceFingerprint?: string;
  generatedAt?: string;
  informationalOnly: true;
  executionAllowed: false;
}

export interface OperatorCandidatePlanSummary {
  strategyId: string;
  strategyVersion?: string;
  profileId?: string;
  candidateId: string;
  candidateState?: string;
  setup: string;
  side: "long" | "short" | "flat";
  status: string;
  signal: "BUY" | "SELL" | "NO_TRADE";
  geometryId?: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskReward?: number;
  actionable: boolean;
  blocker?: string;
  contextIdentity?: string;
}

export interface OperatorConsoleSnapshot {
  generatedAt: string;
  source: OperatorSourceSummary;
  cycle: OperatorCycleState;
  insight: OperatorInsightSummary;
  results: OperatorResultsSummary;
  validation: OperatorValidationSummary;
  prediction: OperatorPredictionSummary;
  memory: OperatorMemorySummary;
  researchPlan: OperatorResearchPlanSummary;
  candidatePlans: OperatorCandidatePlanSummary[];
  canonicalSetupConflict: "NONE" | "CONFLICTING_CANONICAL_SETUPS";
  decisions: OperatorDecision[];
  authority: OperatorAuthority;
  autoApplyAllowed: false;
  researchOnly: true;
  safetyNote: string;
}

export const OPERATOR_AUTHORITY: OperatorAuthority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
