import {
  MARKET_EPISODE_AUTHORITY,
  type MarketEpisode,
  type MarketEpisodeOpportunity
} from "./marketEpisodeTypes";
import {
  ASIA_DISPLACEMENT_FVG_SHORT_V1_ID,
  type AsiaDisplacementFvgPeriodSummary,
  type AsiaDisplacementFvgStabilityAudit
} from "./asiaDisplacementFvgCandidateTypes";

const DAY_MS = 86_400_000;
const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const unique = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

export const asiaDisplacementFvgShortV1Candidate = Object.freeze({
  profileId: ASIA_DISPLACEMENT_FVG_SHORT_V1_ID,
  profileVersion: "v1",
  createdAt: "2026-07-18T00:00:00.000Z",
  status: "retrospective_candidate_requires_stability_audit",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  selector: Object.freeze({
    family: "displacement_fvg_continuation",
    session: "asia",
    side: "short"
  }),
  selectionDisclosure:
    "This cohort was selected after inspecting recent historical outcomes. Historical chronological splits are selection-contaminated and cannot be called untouched OOS evidence.",
  executable: false,
  forwardObservationEligible: false,
  paperDemoEligible: false,
  autoPromotionAllowed: false,
  authority: MARKET_EPISODE_AUTHORITY,
  safety: Object.freeze({
    researchOnly: true,
    rawCandlesExcluded: true,
    autoPromotionAllowed: false,
    executionIntentCreated: false
  })
});

export const isAsiaDisplacementFvgShortCandidate = (opportunity: MarketEpisodeOpportunity) =>
  opportunity.family === "displacement_fvg_continuation" &&
  opportunity.session === "asia" &&
  opportunity.side === "short";

const activeWindows = (opportunities: MarketEpisodeOpportunity[]) => {
  const times = opportunities.map((item) => Date.parse(item.detectedAt)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!times.length) return 0;
  const origin = times[0];
  return new Set(times.map((time) => Math.floor((time - origin) / (30 * DAY_MS)))).size;
};

const lower95 = (returns: number[]) => {
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return mean - 1.96 * Math.sqrt(variance / returns.length);
};

const returnSummary = (returns: number[], costR: number) => {
  if (!returns.length) return { averageR: null, profitFactor: null };
  const adjusted = returns.map((value) => value - costR);
  const grossProfit = adjusted.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(adjusted.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return {
    averageR: round(adjusted.reduce((sum, value) => sum + value, 0) / adjusted.length),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0
  };
};

export function summarizeAsiaDisplacementFvgPeriod(
  opportunities: MarketEpisodeOpportunity[]
): AsiaDisplacementFvgPeriodSummary {
  const completed = opportunities.filter((item) =>
    item.outcome === "target_first" || item.outcome === "invalidation_first"
  );
  const realized = completed.map((item) => item.realizedR).filter(finite);
  const baseline = returnSummary(realized, 0);
  const cost025 = returnSummary(realized, 0.25);
  const cost05 = returnSummary(realized, 0.5);
  return {
    candidateCount: opportunities.length,
    completedCount: completed.length,
    targetFirstRate: completed.length
      ? round(completed.filter((item) => item.outcome === "target_first").length / completed.length)
      : null,
    averageR: baseline.averageR,
    profitFactor: baseline.profitFactor,
    expectancyLower95: realized.length > 1 ? round(lower95(realized) ?? 0) : null,
    averageRWithCost025: cost025.averageR,
    profitFactorWithCost025: cost025.profitFactor,
    averageRWithCost05: cost05.averageR,
    profitFactorWithCost05: cost05.profitFactor,
    independentDates: new Set(opportunities.map((item) => item.detectedAt.slice(0, 10))).size,
    activeWindows: activeWindows(opportunities),
    externalTargetRate: opportunities.length
      ? round(opportunities.filter((item) => item.targetBasis === "external_liquidity").length / opportunities.length)
      : null
  };
}

export function analyzeAsiaDisplacementFvgStability(
  episodes: MarketEpisode[],
  splitTimestamp?: string
): AsiaDisplacementFvgStabilityAudit {
  const opportunities = episodes.flatMap((episode) => episode.opportunities).filter(isAsiaDisplacementFvgShortCandidate);
  const timestamps = opportunities.map((item) => Date.parse(item.detectedAt)).filter(Number.isFinite).sort((a, b) => a - b);
  const split = splitTimestamp
    ? Date.parse(splitTimestamp)
    : timestamps.length
      ? timestamps[0] + (timestamps.at(-1)! - timestamps[0]) / 2
      : Number.NaN;
  const preSelectionItems = opportunities.filter((item) => Date.parse(item.detectedAt) < split);
  const discoveryItems = opportunities.filter((item) => Date.parse(item.detectedAt) >= split);
  const preSelection = summarizeAsiaDisplacementFvgPeriod(preSelectionItems);
  const discovery = summarizeAsiaDisplacementFvgPeriod(discoveryItems);
  const pooled = summarizeAsiaDisplacementFvgPeriod(opportunities);
  const blockers = unique([
    preSelection.completedCount < 20
      ? `Earlier period has only ${preSelection.completedCount} completed outcomes; 20 are required.`
      : undefined,
    discovery.completedCount < 20
      ? `Recent period has only ${discovery.completedCount} completed outcomes; 20 are required.`
      : undefined,
    (preSelection.averageRWithCost025 ?? 0) <= 0
      ? `Earlier 0.25R-cost expectancy is ${preSelection.averageRWithCost025 ?? 0}R.`
      : undefined,
    (discovery.averageRWithCost025 ?? 0) <= 0
      ? `Recent 0.25R-cost expectancy is ${discovery.averageRWithCost025 ?? 0}R.`
      : undefined,
    (pooled.averageRWithCost05 ?? 0) <= 0
      ? `Pooled 0.5R-cost expectancy is ${pooled.averageRWithCost05 ?? 0}R.`
      : undefined,
    preSelection.independentDates < 10 ? "Earlier period has fewer than 10 independent dates." : undefined,
    discovery.independentDates < 10 ? "Recent period has fewer than 10 independent dates." : undefined,
    preSelection.activeWindows < 2 ? "Earlier period has fewer than two active windows." : undefined,
    discovery.activeWindows < 2 ? "Recent period has fewer than two active windows." : undefined
  ]);
  const enoughData = preSelection.completedCount >= 20 && discovery.completedCount >= 20;
  const positiveAfterCost =
    (preSelection.averageRWithCost025 ?? 0) > 0 &&
    (discovery.averageRWithCost025 ?? 0) > 0 &&
    (pooled.averageRWithCost05 ?? 0) > 0;
  const classification = !enoughData
    ? "insufficient_data" as const
    : !positiveAfterCost
      ? "negative_after_costs" as const
      : blockers.length
        ? "unstable" as const
        : "promising_for_forward_freeze" as const;
  return {
    profileId: ASIA_DISPLACEMENT_FVG_SHORT_V1_ID,
    generatedAt: new Date().toISOString(),
    splitTimestamp: Number.isFinite(split) ? new Date(split).toISOString() : "unavailable",
    preSelection,
    discovery,
    pooled,
    classification,
    blockers,
    selectionContaminated: true,
    untouchedOosEvidence: false,
    forwardObservationEligible: false,
    paperDemoEligible: false,
    nextAction: classification === "promising_for_forward_freeze"
      ? "Freeze a new detector-specific profile version and collect untouched closed-candle forward outcomes. Do not reuse these historical outcomes as forward evidence."
      : "Keep the cohort in discovery and inspect the failed stability or cost gate without loosening thresholds.",
    authority: MARKET_EPISODE_AUTHORITY,
    safety: {
      researchOnly: true,
      rawCandlesExcluded: true,
      autoPromotionAllowed: false,
      executionIntentCreated: false
    }
  };
}
