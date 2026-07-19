import { runAgents, synthesizeCIO } from "@/lib/agents";
import {
  defaultBacktestConfig,
  sanitizeBacktestConfig
} from "@/lib/backtesting/backtestConfig";
import type {
  BacktestAgentAttributionSummary,
  BacktestAgentWeightId,
  BacktestConfig,
  BacktestDecisionPoint,
  BacktestGrinchSummary,
  BacktestResult,
  BacktestSkippedSignal,
  BacktestSummary,
  ResolvedBacktestConfig,
  SimulatedTradeRecord
} from "@/lib/backtesting/backtestTypes";
import { scoreSimulatedTradeOutcome } from "@/lib/backtesting/outcomeScoring";
import { buildICTContext, tagSession } from "@/lib/ict";
import { assessIctCmdHighDisplacementV2 } from "@/lib/ict-strategy-suite/ictCmdHighDisplacementV2";
import { assessIctIfvgFilteredV2 } from "@/lib/ict-strategy-suite/ictIfvgFilteredV2";
import { assessIctIfvgFreshRetestV3 } from "@/lib/ict-strategy-suite/ictIfvgFreshRetestV3";
import { assessIctIfvgShallowRetestV4 } from "@/lib/ict-strategy-suite/ictIfvgShallowRetestV4";
import { buildMarketContext } from "@/lib/marketData";
import { classifyMarketRegime } from "@/lib/regime";
import { summarizeTradeOutcomes } from "@/lib/statistics/tradeMetrics";
import { calculateGrinchStrategyScore } from "@/lib/strategyLibrary";
import type { Candle, FairValueGap, FuturesSymbol, MarketBias, SimulatedTradePlan, ThesisInput, TradingSession } from "@/lib/types";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const tickSizeBySymbol: Partial<Record<FuturesSymbol, number>> = {
  ES: 0.25,
  NQ: 0.25,
  MES: 0.25,
  MNQ: 0.25,
  YM: 1,
  XAUUSD: 0.01,
  EURUSD: 0.00001,
  BTCUSD: 0.01
};

const sessionFromCandle = (candle: Candle): TradingSession => {
  const tagged = tagSession(candle);
  if (tagged.session === "London") {
    return "London";
  }
  if (tagged.killZone === "NY Lunch") {
    return "New York Lunch";
  }
  if (tagged.killZone === "NY PM") {
    return "New York PM";
  }
  if (tagged.session === "New York") {
    return "New York AM";
  }
  return "Globex";
};

const resolveConfig = (candles: Candle[], config: BacktestConfig = {}): ResolvedBacktestConfig =>
  sanitizeBacktestConfig({
    ...defaultBacktestConfig,
    symbol: candles[0]?.symbol ?? defaultBacktestConfig.symbol,
    timeframe: candles[0]?.timeframe ?? defaultBacktestConfig.timeframe,
    ...config
  });

const signalText = (bias: MarketBias) => (bias === "neutral" ? "neutral" : `${bias} simulated thesis`);

const directionFor = (bias: MarketBias) => (bias === "bullish" ? 1 : bias === "bearish" ? -1 : 0);

const fvgInvalidationFor = (gaps: FairValueGap[], bias: MarketBias, fallback: number, tickSize: number) => {
  const gap = [...gaps].reverse().find((item) => item.direction === bias && !item.mitigated);
  if (!gap) {
    return fallback;
  }
  return bias === "bullish"
    ? Math.min(gap.start, gap.end) - tickSize
    : bias === "bearish"
      ? Math.max(gap.start, gap.end) + tickSize
      : fallback;
};

const buildSimulatedPlan = (
  decisionIndex: number,
  input: ThesisInput,
  synthesis: ReturnType<typeof synthesizeCIO>,
  config: ResolvedBacktestConfig,
  gaps: FairValueGap[]
): SimulatedTradePlan => {
  const bias = synthesis.finalBias;
  const direction = directionFor(bias);
  const tickSize = tickSizeBySymbol[input.symbol] ?? 0.25;
  const entryMid = (synthesis.entryZone[0] + synthesis.entryZone[1]) / 2;
  const stopDistance =
    config.stopModel === "fixed ticks"
      ? config.fixedTickStopSize * tickSize
      : Math.abs(entryMid - synthesis.invalidationLevel);
  const invalidation =
    bias === "neutral"
      ? synthesis.invalidationLevel
      : config.stopModel === "fixed ticks"
        ? entryMid - direction * stopDistance
        : config.stopModel === "FVG invalidation"
          ? fvgInvalidationFor(gaps, bias, synthesis.invalidationLevel, tickSize)
          : synthesis.invalidationLevel;
  const risk = Math.max(tickSize, Math.abs(entryMid - invalidation));
  const targetLiquidity =
    bias === "neutral"
      ? synthesis.targetLiquidity
      : entryMid + direction * risk * config.targetRMultiple;

  return {
    id: `bt_plan_${decisionIndex}`,
    symbol: input.symbol,
    timeframe: input.timeframe,
    bias,
    entryZone: synthesis.entryZone,
    invalidation: round(invalidation),
    targetLiquidity: round(targetLiquidity),
    stopRiskNotes: `${synthesis.riskNotes} Backtest assumption: ${config.stopModel} stop, ${config.targetRMultiple.toFixed(2)}R target, ${config.maxBarsToResolveTrade} bar max resolution.`,
    riskReward: bias === "neutral" ? 0 : round(config.targetRMultiple),
    mode: "simulation"
  };
};

const sessionMatchesFilter = (candle: Candle, config: ResolvedBacktestConfig) => {
  const tagged = tagSession(candle);
  if (config.sessionFilter === "all") {
    return true;
  }
  if (config.sessionFilter === "NY AM Kill Zone") {
    return tagged.killZone === "NY AM";
  }
  if (config.sessionFilter === "NY PM Kill Zone") {
    return tagged.killZone === "NY PM";
  }
  return tagged.session === config.sessionFilter;
};

const skipReasonFor = (decision: BacktestDecisionPoint, config: ResolvedBacktestConfig) => {
  const tagged = tagSession(decision.candle);
  if (!sessionMatchesFilter(decision.candle, config)) {
    return `Session filter ${config.sessionFilter} excluded ${tagged.label}.`;
  }
  if (decision.ictContext.confluenceScore < config.minimumConfluenceThreshold) {
    return `ICT confluence ${round(decision.ictContext.confluenceScore, 2)} below threshold ${config.minimumConfluenceThreshold}.`;
  }
  if (decision.thesis.confidence < config.minimumConfidenceThreshold) {
    return `CIO confidence ${round(decision.thesis.confidence, 2)} below threshold ${config.minimumConfidenceThreshold}.`;
  }
  if (decision.thesis.finalBias === "bullish" && !config.allowLong) {
    return "Long simulated theses disabled.";
  }
  if (decision.thesis.finalBias === "bearish" && !config.allowShort) {
    return "Short simulated theses disabled.";
  }
  if (decision.grinchScore?.hardGateReason) {
    return `Grinch hard gate blocked setup: ${decision.grinchScore.hardGateReason}.`;
  }
  if (decision.thesis.finalBias === "neutral") {
    return "CIO thesis was neutral.";
  }
  const htfBias = decision.ictContext.higherTimeframeBias;
  const htfSource = decision.ictContext.higherTimeframeBiasSource ?? "synthetic";
  // Hard skip only when a real HTF feed disagrees. Synthetic HTF (aggregated LTF)
  // is advisory — conflict is recorded as a soft skip reason for diagnostics only
  // when confidence is already marginal.
  if (
    htfSource === "real" &&
    htfBias !== "neutral" &&
    decision.thesis.finalBias !== htfBias
  ) {
    return `Higher-timeframe bias ${htfBias} conflicts with CIO thesis ${decision.thesis.finalBias}.`;
  }
  if (
    htfSource !== "real" &&
    htfBias !== "neutral" &&
    decision.thesis.finalBias !== htfBias &&
    decision.thesis.confidence < config.minimumConfidenceThreshold + 0.08
  ) {
    return `Synthetic HTF bias ${htfBias} conflicts with low-confidence CIO thesis ${decision.thesis.finalBias}.`;
  }
  return undefined;
};

function buildDecision(
  candles: Candle[],
  decisionIndex: number,
  config: ResolvedBacktestConfig
): BacktestDecisionPoint {
  const candle = candles[decisionIndex];
  // A decision only needs the recent market/session context. Reprocessing the
  // entire history for every decision made deep research quadratic and could
  // freeze the browser. Three hundred 5m candles cover more than one session
  // cycle while keeping every decision bounded and deterministic.
  const decisionContextWindow = Math.max(300, config.visibleWindow);
  const historicalCandles = candles.slice(
    Math.max(0, decisionIndex + 1 - decisionContextWindow),
    decisionIndex + 1
  );
  const marketContext = buildMarketContext({
    symbol: config.symbol,
    timeframe: config.timeframe,
    mode: "imported",
    candles: historicalCandles
  });
  const regimeClassification = classifyMarketRegime({
    candles: historicalCandles,
    marketContext,
    symbol: config.symbol,
    timeframe: config.timeframe
  });
  const regimeToMarket = (label: string): ThesisInput["marketRegime"] => {
    if (label.startsWith("trend")) return "trend";
    if (label.startsWith("range_low")) return "range";
    if (label.startsWith("range_high") || label.startsWith("event")) return "volatile";
    if (label.startsWith("risk_off")) return "risk-off";
    return config.marketRegime;
  };
  const input: ThesisInput = {
    symbol: config.symbol,
    timeframe: config.timeframe,
    session: config.session ?? sessionFromCandle(candle),
    marketRegime: regimeToMarket(regimeClassification.stableLabel),
    notes: `Replay decision at candle ${decisionIndex + 1} using local simulation OHLC only.`
  };
  const ictContext = buildICTContext(historicalCandles, input);
  const grinchScore = calculateGrinchStrategyScore({
    candles: historicalCandles,
    fairValueGaps: ictContext.fairValueGaps,
    liquiditySweeps: ictContext.liquiditySweeps,
    options: {
      symbol: input.symbol,
      timeframe: input.timeframe,
      currentTimestamp: candle.timestamp
    }
  });
  const agentOpinions = runAgents(input, ictContext, historicalCandles).map((opinion) => ({
    ...opinion,
    weight: config.agentWeights[opinion.agentId as BacktestAgentWeightId] ?? opinion.weight
  }));
  const cioSynthesis = synthesizeCIO(input, ictContext, agentOpinions);
  const plan = buildSimulatedPlan(decisionIndex, input, cioSynthesis, config, ictContext.fairValueGaps);
  const thesisId = `bt_thesis_${decisionIndex}`;
  const decisionId = `bt_decision_${decisionIndex}`;
  const thesis = {
    id: thesisId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    session: input.session,
    marketRegime: input.marketRegime,
    notes: input.notes,
    finalBias: cioSynthesis.finalBias,
    confidence: cioSynthesis.confidence,
    thesisSummary: cioSynthesis.thesisSummary,
    invalidationLevel: plan.invalidation,
    targetLiquidity: plan.targetLiquidity,
    riskNotes: plan.stopRiskNotes,
    reasoningSummary: cioSynthesis.reasoningSummary,
    ictContext,
    simulatedTradePlan: plan,
    createdAt: candle.timestamp,
    disclaimer: "Simulation only. No broker connection. No real trades."
  };

  return {
    id: decisionId,
    decisionIndex,
    candle,
    input,
    ictContext,
    agentOpinions: [...agentOpinions, cioSynthesis.cioOpinion],
    cioSynthesis,
    thesis,
    grinchScore
  };
}

const equityCurveFor = (trades: SimulatedTradeRecord[]) => {
  let equityR = 0;
  return trades.map((trade, index) => {
    equityR = round(equityR + trade.rMultiple, 2);
    return {
      index: index + 1,
      timestamp: trade.resolvedAt,
      equityR,
      rMultiple: trade.rMultiple
    };
  });
};

const maxDrawdownFor = (equityCurve: ReturnType<typeof equityCurveFor>) => {
  let peak = 0;
  let maxDrawdown = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equityR);
    maxDrawdown = Math.max(maxDrawdown, peak - point.equityR);
  }
  return round(maxDrawdown, 2);
};

const profitFactorFor = (trades: SimulatedTradeRecord[]) => {
  const positiveR = trades.filter((trade) => trade.rMultiple > 0).reduce((sum, trade) => sum + trade.rMultiple, 0);
  const negativeR = Math.abs(
    trades.filter((trade) => trade.rMultiple < 0).reduce((sum, trade) => sum + trade.rMultiple, 0)
  );
  if (negativeR === 0) {
    return positiveR > 0 ? 99 : null;
  }
  return round(positiveR / negativeR, 2);
};

const agentAttributionFor = (trades: SimulatedTradeRecord[]): BacktestAgentAttributionSummary[] => {
  const map = new Map<string, BacktestAgentAttributionSummary & { confidenceTotal: number; weightTotal: number; aligned: number }>();

  for (const trade of trades) {
    for (const agent of trade.agentAttribution) {
      const current =
        map.get(agent.agentId) ??
        {
          agentId: agent.agentId,
          name: agent.name,
          averageConfidence: 0,
          averageWeight: 0,
          totalOpinions: 0,
          bullishCount: 0,
          bearishCount: 0,
          neutralCount: 0,
          cioAlignmentRate: 0,
          confidenceTotal: 0,
          weightTotal: 0,
          aligned: 0
        };
      current.totalOpinions += 1;
      current.confidenceTotal += agent.confidence;
      current.weightTotal += agent.weight;
      current.aligned += agent.alignsWithCIO ? 1 : 0;
      current.bullishCount += agent.bias === "bullish" ? 1 : 0;
      current.bearishCount += agent.bias === "bearish" ? 1 : 0;
      current.neutralCount += agent.bias === "neutral" ? 1 : 0;
      map.set(agent.agentId, current);
    }
  }

  return [...map.values()]
    .map(({ confidenceTotal, weightTotal, aligned, ...summary }) => ({
      ...summary,
      averageConfidence: round(confidenceTotal / Math.max(1, summary.totalOpinions), 3),
      averageWeight: round(weightTotal / Math.max(1, summary.totalOpinions), 3),
      cioAlignmentRate: round(aligned / Math.max(1, summary.totalOpinions), 3)
    }))
    .sort((a, b) => b.averageWeight - a.averageWeight);
};

const skipReasonsFor = (skippedSignals: BacktestSkippedSignal[]) =>
  Object.entries(
    skippedSignals.reduce<Record<string, number>>((counts, skip) => {
      counts[skip.reason] = (counts[skip.reason] ?? 0) + 1;
      return counts;
    }, {})
  )
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

const grinchSummaryFor = (
  trades: SimulatedTradeRecord[],
  skippedSignals: BacktestSkippedSignal[],
  decisions: BacktestDecisionPoint[]
): BacktestGrinchSummary | undefined => {
  const scores = decisions.map((decision) => decision.grinchScore).filter((score): score is NonNullable<typeof score> => Boolean(score));
  if (!scores.length) {
    return undefined;
  }
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const activeProfileCounts = scores.reduce<BacktestGrinchSummary["activeProfileCounts"]>((counts, score) => {
    counts[score.activeProfile] = (counts[score.activeProfile] ?? 0) + 1;
    return counts;
  }, {});
  const tradeProfileCounts = trades.reduce<BacktestGrinchSummary["tradeProfileCounts"]>((counts, trade) => {
    const profile = trade.grinchScore?.activeProfile ?? "none";
    counts[profile] = (counts[profile] ?? 0) + 1;
    return counts;
  }, {});
  const profileCandidateCounts = scores.reduce<BacktestGrinchSummary["profileCandidateCounts"]>((counts, score) => {
    for (const profile of score.evaluatedProfiles ?? []) {
      if (profile.selectable) {
        counts[profile.profile] = (counts[profile.profile] ?? 0) + 1;
      }
    }
    return counts;
  }, {});
  const activeProfile = (Object.entries(activeProfileCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none") as BacktestGrinchSummary["activeProfile"];
  const ruleBlocks = [
    ...scores.flatMap((score) => score.ruleBlocks),
    ...skippedSignals.map((skip) => skip.grinchRuleBlock).filter((item): item is string => Boolean(item))
  ];
  const blockCounts = ruleBlocks.reduce<Record<string, number>>((counts, block) => {
    counts[block] = (counts[block] ?? 0) + 1;
    return counts;
  }, {});
  const falsePositiveBlockerCounts = scores.reduce<BacktestGrinchSummary["falsePositiveBlockerCounts"]>((counts, score) => {
    for (const blocker of score.falsePositiveBlockers ?? []) {
      counts[blocker] = (counts[blocker] ?? 0) + 1;
    }
    return counts;
  }, {});
  const latestScore = scores[scores.length - 1];
  const tradeScores = trades.map((trade) => trade.grinchScore).filter((score): score is NonNullable<typeof score> => Boolean(score));
  const skippedScores = skippedSignals
    .map((skip) => decisions.find((decision) => decision.decisionIndex === skip.decisionIndex)?.grinchScore)
    .filter((score): score is NonNullable<typeof score> => Boolean(score));
  const tradeAverage = average(tradeScores.map((score) => score.grinchModelScore));
  const skippedAverage = average(skippedScores.map((score) => score.grinchModelScore));

  return {
    averageGrinchModelScore: round(average(scores.map((score) => score.grinchModelScore))),
    averageFalsePositiveRisk: round(average(scores.map((score) => score.falsePositiveRisk))),
    averageProfileValidity: round(average(scores.map((score) => score.profileValidity))),
    latestScore,
    activeProfile,
    activeProfileCounts,
    tradeProfileCounts,
    profileCandidateCounts,
    noValidProfileSignals: scores.filter((score) => score.noValidProfile).length,
    dominantRuleBlock: Object.entries(blockCounts).sort((a, b) => b[1] - a[1])[0]?.[0],
    ruleBlocks: Object.entries(blockCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([block]) => block),
    missingEvidence: Array.from(new Set(scores.flatMap((score) => score.missingEvidence))).slice(0, 8),
    grinchImprovedLatestRun: tradeScores.length ? tradeAverage >= skippedAverage : undefined,
    hardBlockedSignals: scores.filter((score) => score.hardGateReason).length,
    falsePositiveBlockerCounts
  };
};

const summarizeBacktest = (
  trades: SimulatedTradeRecord[],
  skippedSignals: BacktestSkippedSignal[],
  decisions: BacktestDecisionPoint[]
): BacktestSummary => {
  const canonical = summarizeTradeOutcomes(trades, "in_sample");
  const equityCurve = equityCurveFor(trades);
  const bestTrade = [...trades].sort((a, b) => b.rMultiple - a.rMultiple)[0];
  const worstTrade = [...trades].sort((a, b) => a.rMultiple - b.rMultiple)[0];

  return {
    totalTrades: canonical.totalTrades,
    directionalTrades: canonical.directionalTrades,
    skippedSignals: skippedSignals.length,
    skipReasons: skipReasonsFor(skippedSignals),
    wins: canonical.wins,
    losses: canonical.losses,
    unresolved: canonical.unresolved,
    winRate: canonical.winRate,
    realizedR: canonical.realizedR,
    averageR: canonical.averageR,
    maxDrawdown: maxDrawdownFor(equityCurve),
    profitFactor: profitFactorFor(trades),
    bestTrade,
    worstTrade,
    equityCurve,
    agentAttribution: agentAttributionFor(trades),
    grinchSummary: grinchSummaryFor(trades, skippedSignals, decisions),
    edgeStatistics: { ...canonical.edgeStatistics, provenance: "in_sample" }
  };
};

const candidateKeyFor = (candidate: ReturnType<typeof assessIctIfvgFilteredV2>["candidate"]) =>
  [
    candidate.originalFvgCandle?.timestamp,
    candidate.inversionCandle?.timestamp,
    candidate.retestCandle?.timestamp,
    candidate.side
  ].join("|");

const sourceProviderFor = (candles: Candle[]) =>
  candles.some((candle) => /mock|sample|fixture/i.test(candle.id)) ? "mock" : "canonical_research";

const scoreIfvgFilteredTrade = ({
  candidate,
  decisionIndex,
  candles,
  config,
  profileId
}: {
  candidate: ReturnType<typeof assessIctIfvgFilteredV2>["candidate"];
  decisionIndex: number;
  candles: Candle[];
  config: ResolvedBacktestConfig;
  profileId: "ifvg_filtered_v2_research" | "ifvg_fresh_retest_v3_research" | "ifvg_fresh_retest_v4_candidate";
}): SimulatedTradeRecord | undefined => {
  if (
    candidate.side === "flat" ||
    !Number.isFinite(candidate.entry) ||
    !Number.isFinite(candidate.stop) ||
    !Number.isFinite(candidate.target)
  ) {
    return undefined;
  }
  const entry = candidate.entry!;
  const stop = candidate.stop!;
  const target = candidate.target!;
  const risk = Math.abs(entry - stop);
  if (!(risk > 0)) return undefined;
  const direction = candidate.side === "long" ? 1 : -1;
  const future = candles.slice(decisionIndex + 1, decisionIndex + 1 + config.maxBarsToResolveTrade);
  if (!future.length) return undefined;

  let outcome: SimulatedTradeRecord["outcome"] = "expired";
  let exitIndex = decisionIndex + future.length;
  let exitCandle = future.at(-1)!;
  for (let offset = 0; offset < future.length; offset += 1) {
    const candle = future[offset];
    const stopHit = candidate.side === "long" ? candle.low <= stop : candle.high >= stop;
    const targetHit = candidate.side === "long" ? candle.high >= target : candle.low <= target;
    if (stopHit || targetHit) {
      // Same-bar ambiguity is scored stop-first to avoid optimistic replay bias.
      outcome = stopHit ? "stop_hit" : "target_hit";
      exitIndex = decisionIndex + offset + 1;
      exitCandle = candle;
      break;
    }
  }

  const tickSize = tickSizeBySymbol[config.symbol] ?? 0.25;
  const optionalFriction = config as ResolvedBacktestConfig & {
    spreadTicks?: number;
    slippageTicks?: number;
    commissionTicks?: number;
  };
  const frictionTicks =
    (optionalFriction.spreadTicks ?? 1) +
    (optionalFriction.slippageTicks ?? 1) +
    (optionalFriction.commissionTicks ?? 1);
  const frictionR = (frictionTicks * tickSize) / risk;
  const targetR = Math.abs(target - entry) / risk;
  const markR = direction * (exitCandle.close - entry) / risk;
  const rMultiple = round(
    outcome === "target_hit"
      ? targetR - frictionR
      : outcome === "stop_hit"
        ? -1 - frictionR
        : Math.max(-1, Math.min(targetR, markR)) - frictionR,
    3
  );
  const favorable = future.map((candle) => direction > 0 ? candle.high - entry : entry - candle.low);
  const adverse = future.map((candle) => direction > 0 ? entry - candle.low : candle.high - entry);
  const openedAt = candles[decisionIndex]?.timestamp ?? candidate.retestCandle?.timestamp ?? new Date().toISOString();
  const bias = candidate.side === "long" ? "bullish" as const : "bearish" as const;

  return {
    id: `bt_${profileId}_${decisionIndex}_${candidate.side}`,
    decisionId: `bt_${profileId}_decision_${decisionIndex}`,
    thesisId: `bt_${profileId}_thesis_${decisionIndex}`,
    symbol: config.symbol,
    timeframe: config.timeframe,
    session: config.session ?? sessionFromCandle(candles[decisionIndex]),
    marketRegime: config.marketRegime,
    bias,
    confidence: 0.75,
    decisionIndex,
    entryIndex: decisionIndex,
    exitIndex,
    openedAt,
    resolvedAt: exitCandle.timestamp,
    entryZone: [entry, entry],
    entryPrice: entry,
    invalidation: stop,
    target,
    targetHit: outcome === "target_hit",
    stopHit: outcome === "stop_hit",
    expired: outcome === "expired",
    outcome,
    maxFavorableExcursion: round(Math.max(0, ...favorable), 3),
    maxAdverseExcursion: round(Math.max(0, ...adverse), 3),
    rMultiple,
    riskReward: round(targetR, 3),
    reason: `${profileId === "ifvg_filtered_v2_research" ? "IFVG filtered v2 clean retest + displacement" : profileId === "ifvg_fresh_retest_v4_candidate" ? "IFVG v4 fresh shallow clean retest candidate" : "IFVG fresh clean retest v3"}; ${outcome.replace(/_/g, " ")}; ${frictionR.toFixed(2)}R modeled cost.`,
    simulatedTradePlan: {
      id: `bt_${profileId}_plan_${decisionIndex}`,
      symbol: config.symbol,
      timeframe: config.timeframe,
      bias,
      entryZone: [entry, entry],
      invalidation: stop,
      targetLiquidity: target,
      stopRiskNotes: `Research-only ${profileId} simulation. Same-bar target/stop ambiguity resolves stop-first.`,
      riskReward: round(targetR, 3),
      mode: "simulation"
    },
    agentAttribution: []
  };
};

const runIfvgResearchBacktest = (
  sample: Candle[],
  resolved: ResolvedBacktestConfig
): BacktestResult => {
  const skippedSignals: BacktestSkippedSignal[] = [];
  const trades: SimulatedTradeRecord[] = [];
  const seen = new Set<string>();
  const blockerCounts: Record<string, number> = {};
  let evaluatedWindows = 0;
  let detectedCandidates = 0;
  let eligibleCandidates = 0;
  let duplicateCandidates = 0;
  let overlappingCandidates = 0;
  let activeUntilIndex = -1;
  const sourceProvider = sourceProviderFor(sample);
  const scanWindow = Math.max(resolved.timeframe === "5m" ? 160 : 120, resolved.visibleWindow);

  for (
    let decisionIndex = Math.max(resolved.warmupCandles, 40);
    decisionIndex < sample.length - 1;
    decisionIndex += 1
  ) {
    evaluatedWindows += 1;
    const window = sample.slice(Math.max(0, decisionIndex + 1 - scanWindow), decisionIndex + 1);
    const detectorInput = {
      candles: window,
      sourceProvider,
      sourceFingerprint: `${sourceProvider}|${resolved.symbol}|${resolved.timeframe}|${sample.length}|${sample[0]?.timestamp}|${sample.at(-1)?.timestamp}`,
      requestedSymbol: resolved.symbol,
      timeframe: resolved.timeframe,
      generatedAt: sample[decisionIndex].timestamp
    };
    const assessment = resolved.strategyProfile === "ifvg_fresh_retest_v4_candidate"
      ? assessIctIfvgShallowRetestV4(detectorInput)
      : resolved.strategyProfile === "ifvg_fresh_retest_v3_research"
        ? assessIctIfvgFreshRetestV3(detectorInput)
        : assessIctIfvgFilteredV2(detectorInput);
    const key = candidateKeyFor(assessment.candidate);
    if (!assessment.candidate.originalFvgCandle || seen.has(key)) {
      if (assessment.candidate.originalFvgCandle && seen.has(key)) duplicateCandidates += 1;
      continue;
    }
    seen.add(key);
    detectedCandidates += 1;
    const sessionAllowed = sessionMatchesFilter(sample[decisionIndex], resolved);
    const directionAllowed =
      (assessment.candidate.side !== "long" || resolved.allowLong) &&
      (assessment.candidate.side !== "short" || resolved.allowShort);
    const blockers = [
      ...assessment.blockers,
      sessionAllowed ? undefined : `session_filter_${resolved.sessionFilter.replace(/\s+/g, "_").toLowerCase()}`,
      directionAllowed ? undefined : `${assessment.candidate.side}_disabled`
    ].filter((item): item is string => Boolean(item));

    if (!assessment.eligible || blockers.length) {
      for (const blocker of blockers.length ? blockers : ["filtered_profile_not_eligible"]) {
        blockerCounts[blocker] = (blockerCounts[blocker] ?? 0) + 1;
      }
      skippedSignals.push({
        id: `bt_ifvg_v2_skip_${decisionIndex}`,
        decisionIndex,
        timestamp: sample[decisionIndex].timestamp,
        reason: blockers[0] ?? "IFVG filtered v2 conditions were incomplete.",
        bias: assessment.candidate.side === "long" ? "bullish" : assessment.candidate.side === "short" ? "bearish" : "neutral",
        confidence: 0,
        confluenceScore: 0,
        sessionLabel: tagSession(sample[decisionIndex]).label
      });
      continue;
    }

    if (decisionIndex <= activeUntilIndex) {
      overlappingCandidates += 1;
      blockerCounts.overlapping_research_position = (blockerCounts.overlapping_research_position ?? 0) + 1;
      continue;
    }

    const trade = scoreIfvgFilteredTrade({
      candidate: assessment.candidate,
      decisionIndex,
      candles: sample,
      config: resolved,
      profileId: resolved.strategyProfile === "ifvg_fresh_retest_v4_candidate"
        ? "ifvg_fresh_retest_v4_candidate"
        : resolved.strategyProfile === "ifvg_fresh_retest_v3_research"
          ? "ifvg_fresh_retest_v3_research"
          : "ifvg_filtered_v2_research"
    });
    if (!trade) {
      blockerCounts.insufficient_outcome_window = (blockerCounts.insufficient_outcome_window ?? 0) + 1;
      continue;
    }
    eligibleCandidates += 1;
    trades.push(trade);
    activeUntilIndex = trade.exitIndex;
  }

  const summary = summarizeBacktest(trades, skippedSignals, []);
  summary.strategyProfileSummary = {
    strategyProfile: resolved.strategyProfile,
    evaluatedWindows,
    detectedCandidates,
    eligibleCandidates,
    duplicateCandidates,
    overlappingCandidates,
    blockerCounts
  };
  return { config: resolved, candles: sample, decisions: [], skippedSignals, trades, summary };
};

const brokerSymbolForResearch = (symbol: FuturesSymbol) =>
  symbol === "NQ" || symbol === "MNQ"
    ? "USTECH"
    : symbol === "ES" || symbol === "MES"
      ? "US500"
      : symbol === "YM"
        ? "US30"
        : symbol;

const scoreCmdHighDisplacementTrade = ({
  candidate,
  decisionIndex,
  candles,
  config
}: {
  candidate: ReturnType<typeof assessIctCmdHighDisplacementV2>;
  decisionIndex: number;
  candles: Candle[];
  config: ResolvedBacktestConfig;
}): SimulatedTradeRecord | undefined => {
  if (
    !candidate.eligible ||
    candidate.side !== "short" ||
    !Number.isFinite(candidate.entry) ||
    !Number.isFinite(candidate.stop) ||
    !Number.isFinite(candidate.target)
  ) return undefined;
  const entry = candidate.entry!;
  const stop = candidate.stop!;
  const target = candidate.target!;
  const risk = stop - entry;
  if (!(risk > 0) || !(target < entry)) return undefined;
  const future = candles.slice(decisionIndex + 1, decisionIndex + 1 + config.maxBarsToResolveTrade);
  if (!future.length) return undefined;

  let outcome: SimulatedTradeRecord["outcome"] = "expired";
  let exitIndex = decisionIndex + future.length;
  let exitCandle = future.at(-1)!;
  for (let offset = 0; offset < future.length; offset += 1) {
    const candle = future[offset];
    const stopHit = candle.high >= stop;
    const targetHit = candle.low <= target;
    if (stopHit || targetHit) {
      outcome = stopHit ? "stop_hit" : "target_hit";
      exitIndex = decisionIndex + offset + 1;
      exitCandle = candle;
      break;
    }
  }

  const tickSize = tickSizeBySymbol[config.symbol] ?? 0.25;
  const frictionTicks = config.spreadTicks + config.slippageTicks + config.commissionTicks;
  const frictionR = (frictionTicks * tickSize) / risk;
  const targetR = (entry - target) / risk;
  const markR = (entry - exitCandle.close) / risk;
  const rMultiple = round(
    outcome === "target_hit"
      ? targetR - frictionR
      : outcome === "stop_hit"
        ? -1 - frictionR
        : Math.max(-1, Math.min(targetR, markR)) - frictionR,
    3
  );
  const favorable = future.map((candle) => entry - candle.low);
  const adverse = future.map((candle) => candle.high - entry);

  return {
    id: `bt_cmd_v2_${decisionIndex}_short`,
    decisionId: `bt_cmd_v2_decision_${decisionIndex}`,
    thesisId: `bt_cmd_v2_thesis_${decisionIndex}`,
    symbol: config.symbol,
    timeframe: config.timeframe,
    session: config.session ?? sessionFromCandle(candles[decisionIndex]),
    marketRegime: config.marketRegime,
    bias: "bearish",
    confidence: 0.75,
    decisionIndex,
    entryIndex: decisionIndex,
    exitIndex,
    openedAt: candidate.signalTime ?? candles[decisionIndex].timestamp,
    resolvedAt: exitCandle.timestamp,
    entryZone: [entry, entry],
    entryPrice: entry,
    invalidation: stop,
    target,
    targetHit: outcome === "target_hit",
    stopHit: outcome === "stop_hit",
    expired: outcome === "expired",
    outcome,
    maxFavorableExcursion: round(Math.max(0, ...favorable), 3),
    maxAdverseExcursion: round(Math.max(0, ...adverse), 3),
    rMultiple,
    riskReward: round(targetR, 3),
    reason: `CMD v2 fresh displacement + FVG + external target; ${outcome.replace(/_/g, " ")}; ${frictionR.toFixed(2)}R modeled cost.`,
    simulatedTradePlan: {
      id: `bt_cmd_v2_plan_${decisionIndex}`,
      symbol: config.symbol,
      timeframe: config.timeframe,
      bias: "bearish",
      entryZone: [entry, entry],
      invalidation: stop,
      targetLiquidity: target,
      stopRiskNotes: "Research-only CMD v2 simulation. Same-bar target/stop ambiguity resolves stop-first; execution authority remains none.",
      riskReward: round(targetR, 3),
      mode: "simulation"
    },
    agentAttribution: []
  };
};

const runCmdHighDisplacementV2Backtest = (
  sample: Candle[],
  resolved: ResolvedBacktestConfig
): BacktestResult => {
  const skippedSignals: BacktestSkippedSignal[] = [];
  const trades: SimulatedTradeRecord[] = [];
  const blockerCounts: Record<string, number> = {};
  let evaluatedWindows = 0;
  let detectedCandidates = 0;
  let eligibleCandidates = 0;
  let overlappingCandidates = 0;
  let activeUntilIndex = -1;
  const sourceProvider = sourceProviderFor(sample);
  const brokerSymbol = brokerSymbolForResearch(resolved.symbol);
  const scanWindow = 800;

  for (
    let decisionIndex = Math.max(resolved.warmupCandles, 160);
    decisionIndex < sample.length - 1;
    decisionIndex += 1
  ) {
    evaluatedWindows += 1;
    const window = sample.slice(Math.max(0, decisionIndex + 1 - scanWindow), decisionIndex + 1);
    const assessment = assessIctCmdHighDisplacementV2({
      candles: window,
      sourceProvider,
      sourceFingerprint: `${sourceProvider}|${resolved.symbol}|${brokerSymbol}|${resolved.timeframe}|${sample.length}|${sample[0]?.timestamp}|${sample.at(-1)?.timestamp}`,
      requestedSymbol: resolved.symbol,
      brokerSymbol,
      timeframe: resolved.timeframe,
      requestedLookbackDays: 90,
      availableLookbackDays: sample.length > 1
        ? (Date.parse(sample.at(-1)!.timestamp) - Date.parse(sample[0].timestamp)) / 86_400_000
        : 0
    });
    const formationBlocked = assessment.blockers.some((blocker) =>
      /confirmed consolidation-manipulation-distribution|short-only|bearish displacement|stale|displacement score|FVG/i.test(blocker)
    );
    if (!formationBlocked) {
      detectedCandidates += 1;
    }
    const sessionAllowed = sessionMatchesFilter(sample[decisionIndex], resolved);
    const blockers = [
      ...assessment.blockers,
      sessionAllowed ? undefined : `session_filter_${resolved.sessionFilter.replace(/\s+/g, "_").toLowerCase()}`,
      resolved.allowShort ? undefined : "short_disabled"
    ].filter((item): item is string => Boolean(item));
    if (!assessment.eligible || blockers.length) {
      for (const blocker of blockers.length ? blockers : ["cmd_v2_not_eligible"]) {
        blockerCounts[blocker] = (blockerCounts[blocker] ?? 0) + 1;
      }
      continue;
    }
    if (decisionIndex <= activeUntilIndex) {
      overlappingCandidates += 1;
      blockerCounts.overlapping_research_position = (blockerCounts.overlapping_research_position ?? 0) + 1;
      continue;
    }
    const trade = scoreCmdHighDisplacementTrade({ candidate: assessment, decisionIndex, candles: sample, config: resolved });
    if (!trade) {
      blockerCounts.insufficient_outcome_window = (blockerCounts.insufficient_outcome_window ?? 0) + 1;
      continue;
    }
    eligibleCandidates += 1;
    trades.push(trade);
    activeUntilIndex = trade.exitIndex;
  }

  const summary = summarizeBacktest(trades, skippedSignals, []);
  summary.strategyProfileSummary = {
    strategyProfile: "cmd_high_displacement_v2_research",
    evaluatedWindows,
    detectedCandidates,
    eligibleCandidates,
    duplicateCandidates: 0,
    overlappingCandidates,
    blockerCounts
  };
  return { config: resolved, candles: sample, decisions: [], skippedSignals, trades, summary };
};

export function runBacktest(candles: Candle[], config: BacktestConfig = {}): BacktestResult {
  const resolved = resolveConfig(candles, config);
  const scopedCandles = candles.filter(
    (candle) => candle.symbol === resolved.symbol && candle.timeframe === resolved.timeframe
  );
  const sample = scopedCandles.length
    ? scopedCandles
    : candles.map((candle) => ({ ...candle, symbol: resolved.symbol, timeframe: resolved.timeframe }));
  if (
    resolved.strategyProfile === "ifvg_filtered_v2_research" ||
    resolved.strategyProfile === "ifvg_fresh_retest_v3_research" ||
    resolved.strategyProfile === "ifvg_fresh_retest_v4_candidate"
  ) {
    return runIfvgResearchBacktest(sample, resolved);
  }
  if (resolved.strategyProfile === "cmd_high_displacement_v2_research") {
    return runCmdHighDisplacementV2Backtest(sample, resolved);
  }
  const decisions: BacktestDecisionPoint[] = [];
  const skippedSignals: BacktestSkippedSignal[] = [];
  const eligibleDecisions: BacktestDecisionPoint[] = [];

  for (
    let decisionIndex = resolved.warmupCandles;
    decisionIndex < Math.max(resolved.warmupCandles, sample.length - 1);
    decisionIndex += resolved.decisionInterval
  ) {
    const decision = buildDecision(sample, decisionIndex, resolved);
    decisions.push(decision);
    const skipReason = skipReasonFor(decision, resolved);
    if (skipReason) {
      skippedSignals.push({
        id: `bt_skip_${decisionIndex}`,
        decisionIndex,
        timestamp: decision.candle.timestamp,
        reason: skipReason,
        bias: decision.thesis.finalBias,
        confidence: decision.thesis.confidence,
        confluenceScore: decision.ictContext.confluenceScore,
        sessionLabel: tagSession(decision.candle).label,
        grinchRuleBlock: decision.grinchScore?.primaryRuleBlock,
        grinchHardGateReason: decision.grinchScore?.hardGateReason,
        grinchFalsePositiveBlockers: decision.grinchScore?.falsePositiveBlockers
      });
    } else {
      eligibleDecisions.push(decision);
    }
  }

  const fillFrictions = {
    tickSize: tickSizeBySymbol[resolved.symbol] ?? 0.25,
    spreadTicks: resolved.spreadTicks,
    slippageTicks: resolved.slippageTicks,
    commissionTicks: resolved.commissionTicks
  };
  const trades = eligibleDecisions.map((decision) => ({
    ...scoreSimulatedTradeOutcome(decision, sample, resolved.maxBarsToResolveTrade, fillFrictions),
    grinchScore: decision.grinchScore
  }));

  return {
    config: resolved,
    candles: sample,
    decisions,
    skippedSignals,
    trades,
    summary: summarizeBacktest(trades, skippedSignals, decisions)
  };
}

export { signalText };
