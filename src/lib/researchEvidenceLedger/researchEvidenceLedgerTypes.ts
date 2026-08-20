export interface ResearchEvidenceAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface ResearchEvidenceSafety {
  rawCandlesExcluded: true;
  rawRuntimeSnapshotsExcluded: true;
  importedOhlcvArraysExcluded: true;
  accountDataExcluded: true;
  orderDataExcluded: true;
  positionDataExcluded: true;
  secretsExcluded: true;
  screenshotsBase64Excluded: true;
  readinessPromotionAllowed: false;
}

export type ResearchEvidenceResultClass =
  | "positive_edge"
  | "promising_small_sample"
  | "inconclusive"
  | "negative_edge"
  | "no_sample";

export interface ResearchEvidenceIdentity {
  identityKey: string;
  strategyProfile: string;
  strategyProfileVersion?: string;
  parameterFingerprint?: string;
  requestedSymbol: string;
  brokerSymbol?: string;
  timeframe: string;
  sourceProvider: string;
}

export interface ResearchEvidenceCycleRecord {
  schemaVersion: 1;
  evidenceId: string;
  cycleId: string;
  startedAt: string;
  completedAt: string;
  cycleStatus: string;
  identity: ResearchEvidenceIdentity;
  source: {
    provider: string;
    label: string;
    sourceFingerprint: string;
    candleCount: number;
    processedCandleCount: number;
    requestedLookbackDays?: number;
    availableLookbackDays?: number;
    dataRangeStart?: string;
    dataRangeEnd?: string;
    eligibility?: string;
    warnings: string[];
  };
  context: {
    regime?: string;
    regimeConfidence?: number;
    regimeDataQuality?: string;
    setup?: string;
    side?: string;
    thesisBias?: string;
    advisoryStatus: "available" | "unavailable" | "skipped" | "unknown";
  };
  performance: {
    tradeCount: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageR: number;
    realizedR: number;
    profitFactor: number | null;
    maxDrawdownR: number;
    stopHitCount?: number;
    attributedAvoidableLossCount?: number;
    /** @deprecated Compatibility alias for attributedAvoidableLossCount. */
    falsePositiveCount: number;
    skippedSignals: number;
  };
  validation: {
    validationId?: string;
    readinessScore?: number;
    researchQualityGrade?: string;
    researchQualityScore?: number;
    walkForwardRunId?: string;
    walkForwardVerdict?: string;
    walkForwardOosTrades: number;
    walkForwardWindowsPassed: number;
    walkForwardWindowsTested: number;
    edgeVerdict?: string;
    edgeFlags: string[];
    monteCarloUsableOutcomes: number;
    monteCarloRobustness?: string;
  };
  evidenceMaturity: {
    evidenceScore?: number;
    maturityScore?: number;
    maturityGrade?: string;
    readinessState?: string;
  };
  proposal: {
    proposalId?: string;
    proposalStatus?: string;
    activeCalibrationId?: string;
  };
  resultClass: ResearchEvidenceResultClass;
  blockers: string[];
  promotionBlockers: string[];
  nextAction: string;
  resultSummary: string;
  researchOnly: true;
  authority: ResearchEvidenceAuthority;
  safety: ResearchEvidenceSafety;
}

export interface ResearchEvidenceAggregate {
  identity: ResearchEvidenceIdentity;
  firstCompletedAt: string;
  lastCompletedAt: string;
  cycleCount: number;
  independentCycleDates: number;
  sourceFingerprintCount: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  weightedAverageR: number;
  totalRealizedR: number;
  worstMaxDrawdownR: number;
  weightedProfitFactor: number | null;
  positiveEdgeCycles: number;
  promisingCycles: number;
  negativeEdgeCycles: number;
  noSampleCycles: number;
  oosTrades: number;
  oosWindowsPassed: number;
  oosWindowsTested: number;
  walkForwardPassedCycles: number;
  monteCarloRobustCycles: number;
  latestEvidenceScore?: number;
  latestMaturityScore?: number;
  latestReadinessState?: string;
  latestResultClass: ResearchEvidenceResultClass;
  recurringBlockers: Array<{ blocker: string; occurrences: number }>;
  latestNextAction: string;
  authority: ResearchEvidenceAuthority;
}

export interface ResearchEvidenceAggregateIndex {
  schemaVersion: 1;
  generatedAt: string;
  totalRecords: number;
  totalProfiles: number;
  aggregates: ResearchEvidenceAggregate[];
  authority: ResearchEvidenceAuthority;
  safety: ResearchEvidenceSafety;
}

export interface ResearchEvidenceAppendResult {
  status: "appended" | "duplicate";
  backend: "indexeddb" | "localStorage_fallback" | "memory";
  record: ResearchEvidenceCycleRecord;
  aggregateIndex: ResearchEvidenceAggregateIndex;
}

export const researchEvidenceAuthorityNone: ResearchEvidenceAuthority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

export const researchEvidenceSafety: ResearchEvidenceSafety = {
  rawCandlesExcluded: true,
  rawRuntimeSnapshotsExcluded: true,
  importedOhlcvArraysExcluded: true,
  accountDataExcluded: true,
  orderDataExcluded: true,
  positionDataExcluded: true,
  secretsExcluded: true,
  screenshotsBase64Excluded: true,
  readinessPromotionAllowed: false
};
