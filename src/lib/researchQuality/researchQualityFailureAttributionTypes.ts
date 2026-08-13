export interface ResearchQualityAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface ResearchQualityTradeContext {
  strategyProfile?: string;
  setupFamily?: string;
  htfAlignment?: string;
  sessionPreferred?: boolean;
  liquidityTargetPresent?: boolean;
  cleanRetest?: boolean;
  freshRetest?: boolean;
  signalAgeBars?: number;
  displacementConfirmed?: boolean;
  presentConditions?: string[];
  warnings?: string[];
}

export type ResearchQualityAssociationStatus =
  | "qualified_causal_hypothesis"
  | "not_discriminating"
  | "insufficient_comparator";

/**
 * Compact comparison of a pre-entry context flag against trades where the
 * flag was absent. A flag is not a causal failure family merely because it
 * appeared on a stopped trade.
 */
export interface ResearchQualityContextAssociationSummary {
  causeCode: string;
  label: string;
  exposedCompletedCount: number;
  exposedStopHitCount: number;
  comparatorCompletedCount: number;
  comparatorStopHitCount: number;
  exposedStopHitRate: number;
  comparatorStopHitRate: number;
  stopHitRateDelta: number;
  riskRatio: number | null;
  status: ResearchQualityAssociationStatus;
  directlyAttributed: boolean;
  evidence: string;
}

export interface ResearchQualityFailureCauseSummary {
  causeCode: string;
  label: string;
  stopHitCount: number;
  totalLostR: number;
  averageConfidence: number;
  averageRiskReward: number;
  worstR: number;
  sessions: string[];
  sides: string[];
  regimes: string[];
  sampleTradeIds: string[];
  directlyAttributed: boolean;
  evidence: string;
  associationStatus?: ResearchQualityAssociationStatus | "unattributed";
  exposedCompletedCount?: number;
  comparatorCompletedCount?: number;
  exposedStopHitRate?: number;
  comparatorStopHitRate?: number;
  stopHitRateDelta?: number;
}

export interface ResearchQualitySessionOutcome {
  session: string;
  completedTrades: number;
  targetHits: number;
  stopHits: number;
  expired: number;
  targetFirstRate: number;
  averageR: number;
  averageWinR: number;
  averageLossR: number;
  profitFactor: number | null;
  maxDrawdownR: number;
}

export interface ResearchQualityDrawdownCluster {
  clusterId: string;
  startAt: string;
  endAt: string;
  tradeCount: number;
  stopHitCount: number;
  cumulativeR: number;
  maxDrawdownR: number;
  recovered: boolean;
  sessions: string[];
  sides: string[];
  dominantFailureCause?: string;
  sampleTradeIds: string[];
  risk: "green" | "yellow" | "red";
}

export interface ResearchQualityRejectedContextSummary {
  reason: string;
  count: number;
  classification: "rejected_context_not_false_positive";
}

/** Compact telemetry persisted with one validation scenario. Raw candles and full trade records are excluded. */
export interface ValidationScenarioQualityTelemetry {
  schemaVersion: 1;
  basis: "completed_simulated_trade_outcomes";
  completedTradeCount: number;
  targetHitCount: number;
  stopHitCount: number;
  expiredCount: number;
  neutralCount: number;
  averageWinR: number;
  averageLossR: number;
  stopHitRate: number;
  attributedStopHitCount: number;
  unattributedStopHitCount: number;
  contextEvaluatedStopHitCount: number;
  contextEvaluationCoverage: number;
  attributionCoverage: number;
  failureCauses: ResearchQualityFailureCauseSummary[];
  contextAssociations: ResearchQualityContextAssociationSummary[];
  sessionOutcomes: ResearchQualitySessionOutcome[];
  drawdownClusters: ResearchQualityDrawdownCluster[];
  rejectedContexts: ResearchQualityRejectedContextSummary[];
  authority: ResearchQualityAuthority;
  safety: {
    rawCandlesExcluded: true;
    fullTradeRecordsExcluded: true;
    accountOrderPositionDataExcluded: true;
    evidenceCreationAllowed: false;
    readinessPromotionAllowed: false;
  };
}

export interface ResearchQualityFailureAttribution {
  id: string;
  generatedAt: string;
  sourceValidationId: string;
  sourceProvider?: string;
  requestedSymbol?: string;
  brokerSymbol?: string;
  timeframe?: string;
  sourceFingerprint?: string;
  strategyProfile?: string;
  strategyProfileVersion?: string;
  parameterFingerprint?: string;
  canonicalScenarioId?: string;
  canonicalScenarioName?: string;
  completedTradeCount: number;
  targetHitCount: number;
  stopHitCount: number;
  expiredCount: number;
  stopHitRate: number;
  attributedStopHitCount: number;
  unattributedStopHitCount: number;
  contextEvaluatedStopHitCount: number;
  contextEvaluationCoverage: number;
  attributionCoverage: number;
  failureCauses: ResearchQualityFailureCauseSummary[];
  contextAssociations: ResearchQualityContextAssociationSummary[];
  sessionMatrix: ResearchQualitySessionOutcome[];
  drawdownClusters: ResearchQualityDrawdownCluster[];
  rejectedContexts: ResearchQualityRejectedContextSummary[];
  topFailureCause?: ResearchQualityFailureCauseSummary;
  topContextAssociation?: ResearchQualityContextAssociationSummary;
  recommendedExperiment: string;
  nextAction: string;
  blockers: string[];
  authority: ResearchQualityAuthority;
  safety: {
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    secretsExcluded: true;
    accountOrderPositionDataExcluded: true;
    evidenceCreationAllowed: false;
    readinessPromotionAllowed: false;
    profileMutationAllowed: false;
  };
}
