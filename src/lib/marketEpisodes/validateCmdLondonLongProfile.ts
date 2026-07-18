import {
  CMD_LONDON_LONG_FROZEN_PROFILE_ID,
  CMD_LONDON_LONG_PROFILE_AUTHORITY,
  type CmdLondonLongChronologicalWindow,
  type CmdLondonLongCostSensitivity,
  type CmdLondonLongFrozenValidationResult,
  type CmdLondonLongReturnSummary,
  type CmdLondonLongValidationInput
} from "./cmdLondonLongProfileTypes";
import { matchesCmdLondonLongFrozenProfile } from "./cmdLondonLongFrozenProfile";
import type { MarketEpisodeOpportunity } from "./marketEpisodeTypes";

const DAY_MS = 86_400_000;
const COST_LEVELS = [0, 0.25, 0.5, 1] as const;
const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const mockSource = (value: string) => /mock|sample|fixture|demo|unavailable/i.test(value);

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
};

const summarize = (opportunities: MarketEpisodeOpportunity[], additionalCostR = 0): CmdLondonLongReturnSummary => {
  const completed = opportunities.filter((item) => item.outcome === "target_first" || item.outcome === "invalidation_first");
  const realized = completed
    .map((item) => finite(item.realizedR) ? item.realizedR - additionalCostR : undefined)
    .filter((value): value is number => finite(value));
  const average = realized.length ? realized.reduce((sum, value) => sum + value, 0) / realized.length : null;
  const sampleVariance = realized.length > 1 && average !== null
    ? realized.reduce((sum, value) => sum + (value - average) ** 2, 0) / (realized.length - 1)
    : null;
  const standardError = sampleVariance !== null ? Math.sqrt(sampleVariance / realized.length) : null;
  const grossProfit = realized.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(realized.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of realized) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  const targetFirst = completed.filter((item) => item.outcome === "target_first").length;
  const invalidationFirst = completed.filter((item) => item.outcome === "invalidation_first").length;
  return {
    candidateCount: opportunities.length,
    completedCount: completed.length,
    targetFirst,
    invalidationFirst,
    expired: opportunities.filter((item) => item.outcome === "expired").length,
    targetFirstRate: completed.length ? round(targetFirst / completed.length) : null,
    averageR: average === null ? null : round(average),
    medianR: realized.length ? round(median(realized) ?? 0) : null,
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? Number.POSITIVE_INFINITY : null,
    maxDrawdownR: realized.length ? round(maxDrawdown) : null,
    expectancyLower95: average === null || standardError === null ? null : round(average - 1.96 * standardError),
    expectancyUpper95: average === null || standardError === null ? null : round(average + 1.96 * standardError),
    independentDates: new Set(opportunities.map((item) => item.detectedAt.slice(0, 10))).size
  };
};

const chronologicalWindows = (
  opportunities: MarketEpisodeOpportunity[],
  start: number,
  end: number,
  windowDays: number
): CmdLondonLongChronologicalWindow[] => {
  const windows: CmdLondonLongChronologicalWindow[] = [];
  const windowMs = windowDays * DAY_MS;
  for (let cursor = start; cursor < end; cursor += windowMs) {
    const windowEnd = Math.min(end, cursor + windowMs);
    const scoped = opportunities.filter((item) => {
      const timestamp = Date.parse(item.detectedAt);
      return timestamp >= cursor && timestamp < windowEnd;
    });
    const summary = summarize(scoped);
    windows.push({
      windowIndex: windows.length + 1,
      from: new Date(cursor).toISOString(),
      to: new Date(windowEnd).toISOString(),
      ...summary,
      passedUnstressed: summary.completedCount >= 5 &&
        (summary.averageR ?? Number.NEGATIVE_INFINITY) > 0 &&
        (summary.profitFactor ?? 0) > 1
    });
  }
  return windows;
};

export function validateCmdLondonLongFrozenProfile(
  input: CmdLondonLongValidationInput
): CmdLondonLongFrozenValidationResult {
  const sourceStart = Date.parse(input.firstTimestamp);
  const sourceEnd = Date.parse(input.lastTimestamp);
  const discoveryWindowDays = Math.max(30, input.discoveryWindowDays ?? 90);
  const discoveryStart = sourceEnd - discoveryWindowDays * DAY_MS;
  const minimumCompleted = Math.max(20, input.minimumCompletedChallenge ?? 20);
  const minimumDates = Math.max(3, input.minimumIndependentDates ?? 3);
  const minimumWindows = Math.max(2, input.minimumActiveWindows ?? 2);
  const sourceBlocked = mockSource(input.sourceProvider) ||
    !input.sourceFingerprint || input.sourceFingerprint === "missing" ||
    input.requestedSymbol !== "MNQ" || input.brokerSymbol !== "USTECH" ||
    input.timeframe.toLowerCase() !== "5m" ||
    !Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd) || sourceEnd <= sourceStart;
  const profileOpportunities = input.opportunities
    .filter(matchesCmdLondonLongFrozenProfile)
    .sort((left, right) => Date.parse(left.detectedAt) - Date.parse(right.detectedAt));
  const challenge = profileOpportunities.filter((item) => Date.parse(item.detectedAt) < discoveryStart);
  const discovery = profileOpportunities.filter((item) => Date.parse(item.detectedAt) >= discoveryStart);
  const challengeSummary = summarize(challenge);
  const discoverySummary = summarize(discovery);
  const pooledSummary = summarize(profileOpportunities);
  const costSensitivity: CmdLondonLongCostSensitivity[] = COST_LEVELS.map((additionalCostR) => ({
    additionalCostR,
    ...summarize(challenge, additionalCostR)
  }));
  const windows = Number.isFinite(sourceStart) && Number.isFinite(discoveryStart) && discoveryStart > sourceStart
    ? chronologicalWindows(challenge, sourceStart, discoveryStart, Math.max(15, input.chronologicalWindowDays ?? 30))
    : [];
  const activeChallengeWindows = windows.filter((window) => window.completedCount > 0).length;
  const positiveChallengeWindows = windows.filter((window) => window.passedUnstressed).length;
  const cost025 = costSensitivity.find((item) => item.additionalCostR === 0.25);
  const blockers = [
    sourceBlocked ? "An exact non-mock MT5 USTECH/MNQ 5m source fingerprint is required." : undefined,
    challengeSummary.completedCount < minimumCompleted
      ? `Only ${challengeSummary.completedCount} completed pre-selection outcomes; ${minimumCompleted} are required.`
      : undefined,
    challengeSummary.independentDates < minimumDates
      ? `Only ${challengeSummary.independentDates} independent pre-selection dates; ${minimumDates} are required.`
      : undefined,
    activeChallengeWindows < minimumWindows
      ? `Only ${activeChallengeWindows} active pre-selection windows; ${minimumWindows} are required.`
      : undefined,
    (challengeSummary.averageR ?? Number.NEGATIVE_INFINITY) <= 0
      ? `Pre-selection expectancy is ${challengeSummary.averageR ?? "unavailable"}R.`
      : undefined,
    (challengeSummary.profitFactor ?? 0) <= 1
      ? `Pre-selection profit factor is ${challengeSummary.profitFactor ?? "unavailable"}.`
      : undefined,
    (challengeSummary.expectancyLower95 ?? Number.NEGATIVE_INFINITY) <= 0
      ? `Pre-selection expectancy lower 95% bound is ${challengeSummary.expectancyLower95 ?? "unavailable"}R.`
      : undefined,
    (cost025?.averageR ?? Number.NEGATIVE_INFINITY) <= 0 || (cost025?.profitFactor ?? 0) <= 1
      ? `The 0.25R cost challenge failed (${cost025?.averageR ?? "unavailable"}R, PF ${cost025?.profitFactor ?? "unavailable"}).`
      : undefined
  ].filter((value): value is string => Boolean(value));
  const enoughData = !sourceBlocked &&
    challengeSummary.completedCount >= minimumCompleted &&
    challengeSummary.independentDates >= minimumDates &&
    activeChallengeWindows >= minimumWindows;
  const retrospectiveSupported = enoughData && blockers.length === 0;
  const verdict = sourceBlocked
    ? "blocked_source" as const
    : !enoughData
      ? "insufficient_data" as const
      : retrospectiveSupported
        ? "retrospective_supported_needs_forward" as const
        : "retrospective_failed" as const;
  // V1 was selected with a hindsight-contaminated full-day volatility baseline.
  // Keep the retrospective audit available, but do not issue new observations
  // under an invalidated profile identity.
  const forwardObservationEligible = false;
  blockers.push("CMD London-long v1 is retired after causal rolling normalization removed the discovery edge.");

  return {
    profileId: CMD_LONDON_LONG_FROZEN_PROFILE_ID,
    generatedAt: new Date().toISOString(),
    method: "frozen_profile_preselection_challenge",
    verdict,
    selectionBiasDisclosure:
      "The profile was selected from the most recent 90-day cohort. The older period is an independent pre-selection challenge, not untouched forward-market evidence.",
    source: {
      provider: input.sourceProvider,
      requestedSymbol: input.requestedSymbol,
      brokerSymbol: input.brokerSymbol,
      timeframe: input.timeframe,
      sourceFingerprint: input.sourceFingerprint,
      firstTimestamp: input.firstTimestamp,
      lastTimestamp: input.lastTimestamp
    },
    discoveryWindowStart: new Date(discoveryStart).toISOString(),
    preSelectionChallenge: challengeSummary,
    discoveryEra: discoverySummary,
    pooledHistory: pooledSummary,
    preSelectionCostSensitivity: costSensitivity,
    chronologicalWindows: windows,
    activeChallengeWindows,
    positiveChallengeWindows,
    blockers,
    forwardObservationEligible,
    forwardCalibrationEligible: false,
    paperDemoEligible: false,
    nextAction:
      "Do not track or calibrate v1. Run a causal regime-difference audit and create a separately named v2 only if it passes independent periods and cost gates.",
    authority: CMD_LONDON_LONG_PROFILE_AUTHORITY,
    safety: {
      researchOnly: true,
      rawCandlesExcluded: true,
      rawSnapshotsExcluded: true,
      executionIntentCreated: false,
      autoPromotionAllowed: false
    }
  };
}
