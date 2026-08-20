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

export type ResultsEvidenceIdentityStatus = "matched" | "missing" | "unverified" | "mismatch";

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
    activationIdentityStatus: ResultsEvidenceIdentityStatus;
  };
  backtest: {
    status: "available" | "missing";
    identityStatus: ResultsEvidenceIdentityStatus;
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
    identityStatus: ResultsEvidenceIdentityStatus;
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
    identityStatus: ResultsEvidenceIdentityStatus;
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
    identityStatus: ResultsEvidenceIdentityStatus;
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
    identityStatus: ResultsEvidenceIdentityStatus;
    candidateCount: number;
    excludedCandidateCount: number;
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
    availability: "available" | "unavailable";
    profileId: string;
    status: "historically_validated_forward_evidence_required" | "no_registered_frozen_evidence";
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
    monteCarloRobustness: string;
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
    identityStatus: ResultsEvidenceIdentityStatus;
    totalForecasts: number;
    excludedForecasts: number;
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
    chainIdentityStatus: ResultsEvidenceIdentityStatus;
    replayVerdict: string;
    walkForwardVerdict: string;
    evidenceScore: number;
    maturityScore: number;
    reportedReadinessState: string;
    readinessState: string;
    readinessIntegrity: "consistent" | "contradictory";
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
