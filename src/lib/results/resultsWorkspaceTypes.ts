import type { CanonicalPerformanceMetrics } from "@/lib/performance/canonicalMetrics";
import type { ResearchRuntimeSnapshot } from "@/lib/runtime";
import type { IctLatestResearchState } from "@/lib/ict-strategy-suite";
import type { IctActivateMarketLatestSummary } from "@/lib/ict-strategy-suite/ictActivateMarketPipelineTypes";
import type { PaperDemoOperationsState } from "@/lib/paperDemoOperations";
import type { PredictionLedgerState } from "@/lib/predictionLedger";
import type { ValidationChainEntry } from "@/lib/validationChain";
import type { WalkForwardRun } from "@/lib/walkForward";
import type { ForwardEvidenceEntry } from "@/lib/forwardEvidence";

export const RESULTS_WORKSPACE_AUTHORITY = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;

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
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
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
    totalSignals: number;
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
    windows: number;
    windowsPassed: number;
    oosTrades: number;
    oosAverageR: number | null;
    oosLower95: number | null;
    overfitRisk: string;
    provenanceStatus: string;
  };
  monteCarlo: {
    status: "available" | "missing";
    robustness: string;
    usableOutcomes: number;
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
    profileId: string;
    status: "historically_validated_forward_evidence_required";
    historicalTrades: number;
    historicalTargetFirstRate: number;
    historicalAverageR: number;
    historicalProfitFactor: number;
    historicalUniqueDates: number;
    rollingWindowsPassed: number;
    rollingWindowsTotal: number;
    oosTrades: number;
    oosAverageR: number;
    oosProfitFactor: number;
    monteCarloRobustness: string;
    forwardCompleted: number;
    forwardRequired: number;
    forwardIndependentDates: number;
    forwardWindows: number;
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
    evidenceScore: number;
    maturityScore: number;
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
