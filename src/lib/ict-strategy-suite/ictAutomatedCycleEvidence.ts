import type { BacktestResult } from "../backtesting";
import type { WalkForwardRun } from "../walkForward";
import type { ValidationProvenanceIdentity } from "../validationProvenance";
import type { IctMarketAnalysisContext } from "./ictMarketAnalysisContextTypes";
import {
  buildLatestMarketAnalysisSnapshot,
  buildLatestMonteCarloSnapshot,
  buildLatestWalkForwardSnapshot,
  saveLatestResearchStatePatch
} from "./ictLatestResearchState";
import type { IctLatestReplaySnapshot } from "./ictLatestResearchStateTypes";
import { runMonteCarloBatch } from "./ictMonteCarlo";
import type { IctMonteCarloTradeOutcome } from "./ictMonteCarloTypes";

const round = (value: number, decimals = 4) => Number(value.toFixed(decimals));

const stableSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.max(1, hash >>> 0);
};

const monteCarloOutcomesFromBacktest = (result: BacktestResult): IctMonteCarloTradeOutcome[] =>
  result.trades
    .filter((trade) => trade.outcome !== "neutral" && Number.isFinite(trade.rMultiple))
    .map((trade) => ({
      id: `cycle_mc_${trade.id}`,
      strategyId: result.config.strategyProfile,
      setup: result.config.strategyProfile,
      symbol: trade.symbol,
      side: trade.bias === "bullish" ? "long" as const : trade.bias === "bearish" ? "short" as const : "flat" as const,
      outcome:
        trade.outcome === "target_hit"
          ? "target_first" as const
          : trade.outcome === "stop_hit"
            ? "invalidation_first" as const
            : "stalled" as const,
      rMultiple: round(trade.rMultiple, 2),
      confidence: trade.confidence,
      sourceTime: trade.openedAt,
      researchOnly: true as const
    }));

const replaySnapshotFromBacktest = (input: {
  result: BacktestResult;
  runId: string;
  generatedAt: string;
  requestedSymbol: string;
  brokerSymbol: string;
  activeSourceFingerprint: string;
  provenance?: ValidationProvenanceIdentity;
}): IctLatestReplaySnapshot => {
  const resolvedTrades = input.result.trades.filter((trade) => trade.outcome !== "neutral");
  const targetFirst = resolvedTrades.filter((trade) => trade.outcome === "target_hit").length;
  const averageRr = resolvedTrades.length
    ? resolvedTrades.reduce((total, trade) => total + trade.riskReward, 0) / resolvedTrades.length
    : 0;
  return {
    runId: input.runId,
    generatedAt: input.generatedAt,
    requestedSymbol: input.requestedSymbol,
    brokerSymbol: input.brokerSymbol,
    primaryTimeframe: input.result.config.timeframe,
    totalSignals: resolvedTrades.length,
    targetFirstRate: resolvedTrades.length ? round(targetFirst / resolvedTrades.length) : 0,
    approvedTargetFirstRate: resolvedTrades.length ? round(targetFirst / resolvedTrades.length) : 0,
    averageRrAchieved: round(averageRr, 2),
    approvedAverageRr: round(averageRr, 2),
    activeSourceFingerprint: input.activeSourceFingerprint,
    provenance: input.provenance,
    researchOnly: true
  };
};
export interface BuildAutomatedCycleEvidenceInput {
  backtestResult: BacktestResult;
  cycleId: string;
  generatedAt?: string;
  requestedSymbol: string;
  brokerSymbol: string;
  sourceProvider: string;
  activeSourceFingerprint: string;
  provenance?: ValidationProvenanceIdentity;
  walkForwardRun?: WalkForwardRun;
  marketAnalysisContext?: IctMarketAnalysisContext;
}

export const buildAndSaveAutomatedCycleEvidence = (input: BuildAutomatedCycleEvidenceInput) => {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const replay = replaySnapshotFromBacktest({
    result: input.backtestResult,
    runId: input.cycleId,
    generatedAt,
    requestedSymbol: input.requestedSymbol,
    brokerSymbol: input.brokerSymbol,
    activeSourceFingerprint: input.activeSourceFingerprint,
    provenance: input.provenance
  });
  const outcomes = monteCarloOutcomesFromBacktest(input.backtestResult);
  const monteCarloSummary = runMonteCarloBatch(outcomes, {
    source: "research_cycle_backtest",
    simulationCount: 300,
    tradesPerSimulation: Math.min(100, Math.max(outcomes.length, 1)),
    includeApprovedOnly: false,
    includeWatchlist: true,
    randomSeed: stableSeed(`${input.cycleId}:${input.activeSourceFingerprint}`),
    researchOnly: true
  });
  const identity = {
    activeSourceFingerprint: input.activeSourceFingerprint,
    provenance: input.provenance
  };
  const monteCarlo = buildLatestMonteCarloSnapshot(monteCarloSummary, identity);
  const walkForward = input.walkForwardRun
    ? buildLatestWalkForwardSnapshot(input.walkForwardRun, identity)
    : undefined;
  const marketAnalysis = input.marketAnalysisContext
    ? buildLatestMarketAnalysisSnapshot({
        context: input.marketAnalysisContext,
        sourceProvider: input.sourceProvider,
        sourceFingerprint: input.activeSourceFingerprint
      })
    : undefined;
  const state = saveLatestResearchStatePatch({
    latestReplay: replay,
    latestMonteCarlo: monteCarlo,
    latestWalkForward: walkForward,
    latestMarketAnalysis: marketAnalysis
  }, "research_cycle");
  return {
    state,
    replay,
    monteCarlo,
    walkForward,
    marketAnalysis,
    outcomeCount: outcomes.length,
    researchOnly: true as const,
    authority: {
      executionAuthority: "none" as const,
      brokerAuthority: "none" as const,
      readinessOverrideAuthority: "none" as const
    }
  };
};
