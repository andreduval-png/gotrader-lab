import type { IctMonteCarloRobustnessRating, IctMonteCarloSource } from "./ictMonteCarloTypes";
import type { IctMarketAnalysisContext } from "./ictMarketAnalysisContextTypes";
import type { ValidationProvenanceIdentity } from "../validationProvenance";

export type IctLatestResearchSource =
  | "current_read"
  | "manual_replay_review"
  | "monte_carlo"
  | "research_cycle"
  | "market_scorecard";

export interface IctLatestResearchIdentity {
  sourceCycleId?: string;
  activeSourceFingerprint?: string;
  provenance?: ValidationProvenanceIdentity;
}

export interface IctLatestReplaySnapshot extends IctLatestResearchIdentity {
  runId?: string;
  generatedAt: string;
  requestedSymbol?: string;
  brokerSymbol?: string;
  primaryTimeframe?: string;
  totalSignals?: number;
  targetFirstRate?: number;
  approvedTargetFirstRate?: number;
  averageRrAchieved?: number;
  approvedAverageRr?: number;
  researchOnly: true;
}

export interface IctLatestMonteCarloSnapshot extends IctLatestResearchIdentity {
  generatedAt: string;
  source: IctMonteCarloSource | string;
  usableOutcomes: number;
  robustnessRating: IctMonteCarloRobustnessRating;
  medianEndingR?: number;
  fifthPercentileEndingR?: number;
  medianMaxDrawdownPct?: number;
  worstMaxDrawdownPct?: number;
  riskOfRuinPct?: number;
  recommendedMaxRiskPerTradePct?: number;
  warnings: string[];
  researchOnly: true;
}

export interface IctLatestWalkForwardSnapshot extends IctLatestResearchIdentity {
  runId?: string;
  generatedAt: string;
  verdict: "passed" | "failed" | "needs_more_data";
  oosVerdict?: string;
  tradeCount: number;
  windowsTested: number;
  oosWindowsPassed: number;
  warningFlags: string[];
  reason: string;
  researchOnly: true;
}

export interface IctLatestMarketAnalysisSnapshot {
  generatedAt: string;
  sourceProvider: string;
  sourceFingerprint?: string;
  requestedSymbol: string;
  brokerSymbol: string;
  context: IctMarketAnalysisContext;
  researchOnly: true;
}

export interface IctLatestScorecardSnapshot {
  runId?: string;
  generatedAt: string;
  completedSymbols: number;
  researchPreferredSymbols: string[];
  watchlistOnlySymbols: string[];
  noisySymbols: string[];
  bestApprovedTargetFirstSymbol?: string;
  bestApprovedRrSymbol?: string;
  researchOnly: true;
}

export interface IctLatestResearchState {
  updatedAt: string;
  researchOnly: true;
  latestReplay?: IctLatestReplaySnapshot;
  latestMonteCarlo?: IctLatestMonteCarloSnapshot;
  latestWalkForward?: IctLatestWalkForwardSnapshot;
  latestMarketAnalysis?: IctLatestMarketAnalysisSnapshot;
  latestScorecard?: IctLatestScorecardSnapshot;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
  safety: {
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    accountDataExcluded: true;
    orderDataExcluded: true;
    positionDataExcluded: true;
    secretsExcluded: true;
  };
}

export interface IctLatestResearchStateJournalEvent {
  eventType: "ict_latest_research_state_updated";
  journalEventId: string;
  updatedAt: string;
  source: IctLatestResearchSource;
  hasReplay: boolean;
  hasMonteCarlo: boolean;
  hasWalkForward: boolean;
  hasMarketAnalysis: boolean;
  hasScorecard: boolean;
  monteCarloRobustnessRating?: IctMonteCarloRobustnessRating;
  riskOfRuinPct?: number;
  recommendedMaxRiskPerTradePct?: number;
  researchOnly: true;
  authority: IctLatestResearchState["authority"];
  safety: IctLatestResearchState["safety"];
}
