import { computeEdgeStatistics } from "@/lib/statistics/edgeStatistics";
import type {
  DetectorProfileTradeOutcome,
  DetectorProfileWalkForwardInput,
  DetectorProfileWalkForwardResult,
  DetectorProfileWalkForwardWindow
} from "@/lib/walkForward/detectorProfileWalkForwardTypes";
import { getFrozenResearchProfile } from "@/lib/forwardEvidence";
import {
  buildValidationProvenanceIdentity,
  fingerprintValidationParameters
} from "@/lib/validationProvenance";

const DAY_MS = 86_400_000;
const AUTHORITY_NONE = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

const round = (value: number, digits = 3) => Number(value.toFixed(digits));

const nyTradingDate = (timestamp: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const summarizeReturns = (trades: DetectorProfileTradeOutcome[], additionalCostR = 0) => {
  const returns = trades.map((trade) => trade.rMultiple - additionalCostR).filter(Number.isFinite);
  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value < 0);
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  let equity = 0;
  let peak = 0;
  let maxDrawdownR = 0;
  for (const value of returns) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
  }
  const edge = computeEdgeStatistics(returns, {
    minimumSampleSize: 20,
    provenance: "out_of_sample"
  });
  return {
    trades: returns.length,
    targetFirst: trades.filter((trade) => trade.outcome === "target_hit").length,
    invalidationFirst: trades.filter((trade) => trade.outcome === "stop_hit").length,
    stalled: trades.filter((trade) => trade.outcome === "expired").length,
    winRate: round(returns.length ? wins.length / returns.length : 0, 4),
    averageR: round(returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? 99 : 0,
    maxDrawdownR: round(maxDrawdownR),
    uniqueTradingDates: new Set(trades.map((trade) => nyTradingDate(trade.openedAt))).size,
    edge
  };
};

const compactDate = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

export function runDetectorProfileWalkForward(
  input: DetectorProfileWalkForwardInput
): DetectorProfileWalkForwardResult {
  const holdoutFraction = Math.min(0.5, Math.max(0.2, input.holdoutFraction ?? 1 / 3));
  const windowDays = Math.max(15, Math.round(input.windowDays ?? 30));
  const frozenProfile = getFrozenResearchProfile(input.profileId);
  const frozenRequirements = frozenProfile?.walkForwardRequirements;
  const minimumOosWindows = Math.max(2, input.minimumOosWindows ?? frozenRequirements?.minimumOosWindows ?? 2);
  const minimumOosTrades = Math.max(20, input.minimumOosTrades ?? frozenRequirements?.minimumOosTrades ?? 40);
  const minimumTradesPerWindow = Math.max(5, input.minimumTradesPerWindow ?? frozenRequirements?.minimumTradesPerWindow ?? 10);
  const minimumUniqueDates = Math.max(3, input.minimumUniqueDates ?? frozenRequirements?.minimumUniqueDates ?? 20);
  const minimumWindowPassRate = Math.min(1, Math.max(0.5, input.minimumWindowPassRate ?? frozenRequirements?.minimumWindowPassRate ?? 0.6));
  const maximumSingleDateShare = Math.min(0.5, Math.max(0.05, input.maximumSingleDateShare ?? frozenRequirements?.maximumSingleDateShare ?? 0.15));
  const start = Date.parse(input.sourceStart);
  const requestedEnd = Date.parse(input.sourceEnd);
  const frozenCutoff = frozenProfile ? Date.parse(frozenProfile.validationCutoff) : Number.NaN;
  const inputRangeValid = Number.isFinite(start) && Number.isFinite(requestedEnd) && requestedEnd > start;
  const postCutoffForwardOnly =
    inputRangeValid && Number.isFinite(frozenCutoff) && start > frozenCutoff;
  const historicalEnd = Number.isFinite(frozenCutoff) && Number.isFinite(requestedEnd)
    ? Math.min(requestedEnd, frozenCutoff)
    : requestedEnd;
  const historicalRangeValid =
    inputRangeValid && !postCutoffForwardOnly && Number.isFinite(historicalEnd) && historicalEnd > start;
  const sourceBlocked =
    !input.sourceFingerprint || /mock|sample|unavailable/i.test(input.sourceProvider || "") || !inputRangeValid;
  const developmentEnd = historicalRangeValid
    ? start + (historicalEnd - start) * (1 - holdoutFraction)
    : 0;
  const sortedTrades = input.trades
    .filter((trade) => {
      const openedAt = Date.parse(trade.openedAt);
      return Number.isFinite(openedAt) && openedAt <= historicalEnd && Number.isFinite(trade.rMultiple);
    })
    .sort((left, right) => Date.parse(left.openedAt) - Date.parse(right.openedAt));
  const windows: DetectorProfileWalkForwardWindow[] = [];
  const windowMs = windowDays * DAY_MS;

  if (!sourceBlocked && historicalRangeValid) {
    // Ignore tiny trailing fragments; they are not independent OOS windows and
    // can distort pass rates around an inclusive range-end timestamp.
    for (let cursor = developmentEnd; cursor + windowMs * 0.5 <= historicalEnd + 1; cursor += windowMs) {
      const windowEnd = Math.min(historicalEnd + 1, cursor + windowMs);
      const priorTradeCount = sortedTrades.filter((trade) => Date.parse(trade.openedAt) < cursor).length;
      const scoped = sortedTrades.filter((trade) => {
        const openedAt = Date.parse(trade.openedAt);
        return openedAt >= cursor && openedAt < windowEnd;
      });
      const summary = summarizeReturns(scoped);
      const failReasons = [
        summary.trades < minimumTradesPerWindow
          ? `Only ${summary.trades} OOS trades; ${minimumTradesPerWindow} required in this window.`
          : undefined,
        summary.averageR <= 0 ? `OOS expectancy is ${summary.averageR}R.` : undefined,
        summary.profitFactor <= 1 ? `OOS profit factor is ${summary.profitFactor}.` : undefined
      ].filter((reason): reason is string => Boolean(reason));
      windows.push({
        windowIndex: windows.length + 1,
        from: compactDate(cursor),
        to: compactDate(windowEnd),
        priorTradeCount,
        oosTrades: summary.trades,
        uniqueTradingDates: summary.uniqueTradingDates,
        targetFirst: summary.targetFirst,
        invalidationFirst: summary.invalidationFirst,
        stalled: summary.stalled,
        winRate: summary.winRate,
        averageR: summary.averageR,
        profitFactor: summary.profitFactor,
        maxDrawdownR: summary.maxDrawdownR,
        expectancyLower95: summary.edge.expectancyLower95,
        expectancyUpper95: summary.edge.expectancyUpper95,
        edgeVerdict: summary.edge.verdict,
        passed: failReasons.length === 0,
        failReasons
      });
    }
  }

  const holdoutTrades = sourceBlocked || postCutoffForwardOnly
    ? []
    : sortedTrades.filter((trade) => {
        const openedAt = Date.parse(trade.openedAt);
        return openedAt >= developmentEnd && openedAt <= historicalEnd;
      });
  const pooled = summarizeReturns(holdoutTrades);
  const stressed = summarizeReturns(holdoutTrades, 0.5);
  const dateCounts = holdoutTrades.reduce((counts, trade) => {
    const date = nyTradingDate(trade.openedAt);
    counts.set(date, (counts.get(date) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const largestSingleDateShare = holdoutTrades.length
    ? Math.max(...dateCounts.values()) / holdoutTrades.length
    : 0;
  const passedWindows = windows.filter((window) => window.passed).length;
  const passRate = windows.length ? passedWindows / windows.length : 0;
  const historicalGateBlockers = [
    windows.length < minimumOosWindows
      ? `Only ${windows.length} chronological OOS windows; ${minimumOosWindows} required.`
      : undefined,
    pooled.trades < minimumOosTrades ? `Only ${pooled.trades} OOS trades; ${minimumOosTrades} required.` : undefined,
    pooled.uniqueTradingDates < minimumUniqueDates
      ? `Only ${pooled.uniqueTradingDates} unique OOS dates; ${minimumUniqueDates} required.`
      : undefined,
    passRate < minimumWindowPassRate
      ? `Only ${round(passRate * 100, 1)}% of OOS windows passed; ${round(minimumWindowPassRate * 100, 1)}% required.`
      : undefined,
    pooled.edge.verdict !== "positive_edge"
      ? `Pooled OOS edge verdict is ${pooled.edge.verdict}; positive_edge required.`
      : undefined,
    stressed.averageR <= 0 || stressed.profitFactor <= 1
      ? `Additional 0.5R cost stress failed (${stressed.averageR}R, PF ${stressed.profitFactor}).`
      : undefined,
    largestSingleDateShare > maximumSingleDateShare
      ? `Largest OOS date contributes ${round(largestSingleDateShare * 100, 1)}%; maximum is ${round(maximumSingleDateShare * 100, 1)}%.`
      : undefined
  ].filter((reason): reason is string => Boolean(reason));

  const blockers = sourceBlocked
    ? ["Eligible non-mock source metadata, a source fingerprint, and a valid chronological range are required."]
    : postCutoffForwardOnly
      ? [
          `Active source begins after the frozen validation cutoff ${frozenProfile?.validationCutoff ?? "unavailable"}; historical OOS validation is already frozen and this window must be recorded as forward evidence.`
        ]
      : historicalGateBlockers;

  const verdict = sourceBlocked
    ? "blocked_source"
    : postCutoffForwardOnly
      ? "forward_evidence_required"
      : pooled.trades < minimumOosTrades || windows.length < minimumOosWindows
      ? "insufficient_data"
      : blockers.length
        ? "failed"
        : "passed";

  const generatedAt = new Date().toISOString();
  const effectiveEnd = postCutoffForwardOnly
    ? input.sourceEnd
    : Number.isFinite(historicalEnd)
      ? new Date(historicalEnd).toISOString()
      : input.sourceEnd;
  const validationRunId = input.validationRunId ??
    `detector_validation_${fingerprintValidationParameters({
      profileId: input.profileId,
      sourceFingerprint: input.sourceFingerprint,
      sourceStart: input.sourceStart,
      sourceEnd: effectiveEnd
    }).replace("params_", "")}`;
  const walkForwardRunId = `detector_walk_forward_${fingerprintValidationParameters({
    validationRunId,
    holdoutFraction,
    windowDays
  }).replace("params_", "")}`;
  const provenance = buildValidationProvenanceIdentity({
    strategyProfile: input.profileId,
    strategyProfileVersion: frozenProfile?.profileVersion,
    proposalId: input.proposalId,
    candidateId: input.candidateId,
    sourceProvider: input.sourceProvider,
    requestedSymbol: input.requestedSymbol ?? frozenProfile?.requestedSymbol,
    brokerSymbol: input.brokerSymbol ?? frozenProfile?.brokerSymbol,
    timeframe: input.timeframe ?? frozenProfile?.timeframe,
    sourceFingerprint: input.sourceFingerprint,
    parameterFingerprint: input.parameterFingerprint ??
      (frozenProfile ? fingerprintValidationParameters(frozenProfile.frozenParameters) : undefined),
    detectorProfileFingerprint: input.detectorProfileFingerprint ??
      (frozenProfile ? fingerprintValidationParameters(frozenProfile.frozenParameters) : undefined),
    validationRunId,
    walkForwardRunId,
    validationCutoff: frozenProfile?.validationCutoff,
    dataRangeStart: input.sourceStart,
    dataRangeEnd: effectiveEnd
  });
  return {
    profileId: input.profileId,
    generatedAt,
    method: "frozen_profile_chronological_holdout",
    verdict,
    sourceProvider: input.sourceProvider,
    sourceFingerprint: input.sourceFingerprint,
    sourceStart: input.sourceStart,
    sourceEnd: provenance.dataRangeEnd ?? input.sourceEnd,
    provenance,
    developmentEnd: developmentEnd ? new Date(developmentEnd).toISOString() : "unavailable",
    holdoutFraction: round(holdoutFraction, 4),
    windowDays,
    oosWindowCount: windows.length,
    oosWindowsPassed: passedWindows,
    oosWindowPassRate: round(passRate, 4),
    totalOosTrades: pooled.trades,
    uniqueOosTradingDates: pooled.uniqueTradingDates,
    largestSingleDateShare: round(largestSingleDateShare, 4),
    requirements: {
      minimumOosWindows,
      minimumOosTrades,
      minimumTradesPerWindow,
      minimumUniqueDates,
      minimumWindowPassRate: round(minimumWindowPassRate, 4),
      maximumSingleDateShare: round(maximumSingleDateShare, 4)
    },
    pooledOos: {
      averageR: pooled.averageR,
      profitFactor: pooled.profitFactor,
      maxDrawdownR: pooled.maxDrawdownR,
      expectancyLower95: pooled.edge.expectancyLower95,
      expectancyUpper95: pooled.edge.expectancyUpper95,
      edgeVerdict: pooled.edge.verdict
    },
    additionalCost05R: {
      averageR: stressed.averageR,
      profitFactor: stressed.profitFactor,
      expectancyLower95: stressed.edge.expectancyLower95,
      expectancyUpper95: stressed.edge.expectancyUpper95,
      edgeVerdict: stressed.edge.verdict
    },
    windows,
    blockers,
    warnings: [
      "This is chronological holdout evidence for a frozen research profile, not untouched future-market proof.",
      "MT5 USTECH is CFD/proxy data for MNQ-style research, not CME MNQ futures truth.",
      ...(postCutoffForwardOnly
        ? ["The active tactical window is post-cutoff forward data. It is not a replacement for the frozen historical audit."]
        : []),
      "Passing this validator cannot create evidence, readiness, Paper-Demo eligibility, or execution authority by itself."
    ],
    nextAction:
      verdict === "passed"
        ? "Freeze the profile and collect an untouched forward sample before evidence/maturity review."
        : verdict === "forward_evidence_required"
          ? "Record eligible post-cutoff outcomes in the forward evidence ledger; do not rerun or mutate the frozen profile."
        : "Keep the profile research-only and inspect the failed OOS gate before any further progression.",
    authority: AUTHORITY_NONE,
    safety: {
      rawCandlesExcluded: true,
      accountDataExcluded: true,
      orderDataExcluded: true,
      positionDataExcluded: true,
      readinessPromotionAllowed: false
    }
  };
}
