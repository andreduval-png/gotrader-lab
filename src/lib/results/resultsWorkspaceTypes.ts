import type { CanonicalPerformanceMetrics } from "@/lib/performance/canonicalMetrics";
import type { ResearchRuntimeSnapshot } from "@/lib/runtime";
import type { IctLatestResearchState } from "@/lib/ict-strategy-suite";
import type { IctActivateMarketLatestSummary } from "@/lib/ict-strategy-suite/ictActivateMarketPipelineTypes";
import type { PaperDemoOperationsState } from "@/lib/paperDemoOperations";
import type { PredictionLedgerState } from "@/lib/predictionLedger";
import type { ValidationChainEntry } from "@/lib/validationChain";
import type { WalkForwardRun } from "@/lib/walkForward";
import type { ForwardEvidenceEntry } from "@/lib/forwardEvidence";
import type { ValidationProvenanceIdentity } from "@/lib/validationProvenance";

export const RESULTS_WORKSPACE_AUTHORITY = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;

export type ResultsEvidenceRelationship = "current_cycle" | "historical_evidence" | "unavailable";

export interface ResultsSectionProvenance {
  relationship: ResultsEvidenceRelationship;
  sourceType: string;
  sourceId?: string;
  generatedAt?: string;
  identity?: ValidationProvenanceIdentity;
  identityMatched: boolean;
  reason: string;
}

export interface ResultsWorkspaceBuildInput {
  runtimeSnapshot?: ResearchRuntimeSnapshot;
  canonicalMetrics?: CanonicalPerformanceMetrics;
  activationSummary?: IctActivateMarketLatestSummary;
  latestResearchState?: IctLatestResearchState;
  walkForward?: WalkForwardRun;
  validationChainEntry?: ValidationChainEntry;
  paperDemoState: PaperDemoOperationsState;
  predictionLedger: PredictionLedgerState;
  forwardEvidenceEntries: ForwardEvidenceEntry[];
}

export interface ResultsWorkspaceSnapshot {
  generatedAt: string;
  currentCycleId?: string;
  currentIdentity?: ValidationProvenanceIdentity;
  provenance: {
    source: ResultsSectionProvenance;
    backtest: ResultsSectionProvenance;
    replay: ResultsSectionProvenance;
    walkForward: ResultsSectionProvenance;
    monteCarlo: ResultsSectionProvenance;
    paperDemo: ResultsSectionProvenance;
    frozenProfile: ResultsSectionProvenance;
    predictions: ResultsSectionProvenance;
    validation: ResultsSectionProvenance;
  };
  source: {
    provider: string;
    requestedSymbol: string;
    brokerSymbol: string;
    timeframe: string;
    candleCount: number;
    fingerprint: string;
    dataQuality: string;
    analysisDepthStatus: string;
    analysisTimeframesRequested: string[];
    analysisTimeframesLoaded: string[];
    missingTimeframes: string[];
    requiredTimeframesLoaded: boolean;
    weeklyBiasStatus: string;
    weeklyBiasDirection: string;
  };
  backtest: {
    status: "available" | "missing";
    cycleId?: string;
    totalTrades: number | null;
    winningTrades: number | null;
    losingTrades: number | null;
    winRate: number | null;
    averageR: number | null;
    profitFactor: number | null;
    maxDrawdownR: number | null;
    realizedPnL: number | null;
    metricSource: string;
  };
  replay: {
    status: "available" | "missing";
    runId?: string;
    totalSignals: number | null;
    targetFirstRate: number | null;
    approvedTargetFirstRate: number | null;
    averageRrAchieved: number | null;
    approvedAverageRr: number | null;
    verdict: string;
  };
  walkForward: {
    status: string;
    runId?: string;
    verdict: string;
    windows: number | null;
    windowsPassed: number | null;
    oosTrades: number | null;
    oosAverageR: number | null;
    oosLower95: number | null;
    overfitRisk: string;
    provenanceStatus: string;
  };
  monteCarlo: {
    status: "available" | "missing";
    robustness: string;
    usableOutcomes: number | null;
    medianEndingR: number | null;
    fifthPercentileEndingR: number | null;
    medianMaxDrawdownPct: number | null;
    worstMaxDrawdownPct: number | null;
    riskOfRuinPct: number | null;
    recommendedMaxRiskPerTradePct: number | null;
  };
  paperDemo: {
    candidateCount: number;
    monitoringCount: number;
    blockedCount: number;
    watchlistCount: number;
    retiredCount: number;
    journalEntries: number;
    checklistCompleted: number;
    checklistTotal: number;
    brokerConnected: false;
  };
  frozenProfile: {
    profileId: string | null;
    status: "historically_validated_forward_evidence_required" | "unavailable";
    historicalTrades: number | null;
    historicalTargetFirstRate: number | null;
    historicalAverageR: number | null;
    historicalProfitFactor: number | null;
    historicalUniqueDates: number | null;
    rollingWindowsPassed: number | null;
    rollingWindowsTotal: number | null;
    oosTrades: number | null;
    oosAverageR: number | null;
    oosProfitFactor: number | null;
    monteCarloRobustness: string | null;
    forwardCompleted: number | null;
    forwardRequired: number;
    forwardIndependentDates: number | null;
    forwardWindows: number | null;
    forwardTargetFirstRate: number | null;
    forwardAverageR: number | null;
    reassessmentEligible: boolean;
    recommendation: string;
  };
  predictions: {
    totalForecasts: number;
    actionableForecasts: number;
    completedForecasts: number;
    pendingForecasts: number;
    targetFirstRate: number | null;
    averageRealizedR: number | null;
    brierScore: number | null;
    independentDates: number;
    activeWindows: number;
    classification: string;
  };
  validation: {
    setupLabel: string;
    hypothesisStatus: string;
    replayVerdict: string;
    walkForwardVerdict: string;
    evidenceScore: number | null;
    maturityScore: number | null;
    readinessState: string;
    blockers: string[];
    nextAction: string;
  };
  authority: typeof RESULTS_WORKSPACE_AUTHORITY;
  safety: {
    researchOnly: true;
    aggregateMetricsNotFabricatedIntoDailyResults: true;
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    accountDataExcluded: true;
    orderDataExcluded: true;
    positionDataExcluded: true;
    secretsExcluded: true;
    executionIntentCreated: false;
  };
}
