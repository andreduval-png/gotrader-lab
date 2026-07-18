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
  status: OperatorCycleStatus;
  stage: OperatorCycleStage;
  progressPercent: number;
  message: string;
  startedAt?: string;
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

export interface OperatorConsoleSnapshot {
  generatedAt: string;
  source: OperatorSourceSummary;
  cycle: OperatorCycleState;
  insight: OperatorInsightSummary;
  results: OperatorResultsSummary;
  validation: OperatorValidationSummary;
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
