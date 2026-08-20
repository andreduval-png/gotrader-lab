import { defaultAutoResearchScoringCriteria } from "@/lib/autoResearch/configSearchSpace";
import type {
  AutoResearchScoreBreakdown,
  AutoResearchScoringCriteria
} from "@/lib/autoResearch/autoResearchTypes";
import type { CalibrationProposalMetrics } from "@/lib/selfImprovement";
import type { ResearchQualityReview } from "@/lib/researchQuality";
import type { EdgeStatistics } from "@/lib/statistics/edgeStatistics";
import type { GrinchStrategyScore } from "@/lib/strategyLibrary";
import type { ValidationSuiteReport } from "@/lib/validation";

const round = (value: number, digits = 0) => Number(value.toFixed(digits));
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

/**
 * Minimum trade sample before a candidate can be treated as statistically
 * meaningful. Two trades (the previous minimum) is pure noise.
 */
export const AUTO_RESEARCH_MINIMUM_SAMPLE_TRADES = 20;

const scoreProfitFactor = (profitFactor: number | null) => {
  if (profitFactor === null) {
    return 35;
  }
  return clamp((Math.min(profitFactor, 3) / 3) * 100);
};

const sessionConsistencyScore = (quality: ResearchQualityReview) => {
  if (!quality.sessionComparison.length) {
    return 0;
  }
  const usable = quality.sessionComparison.filter(
    (session) => session.readiness !== "red" && session.totalTrades > 0 && session.averageR >= -0.1
  ).length;
  return clamp((usable / quality.sessionComparison.length) * 100);
};

/**
 * Weight of held-out out-of-sample evidence in the blended total score. OOS
 * results dominate ranking direction so proposals are ranked by generalization
 * rather than in-sample fit.
 */
const OOS_BLEND_WEIGHT = 0.45;

const scoreOutOfSample = (oos: EdgeStatistics) => {
  if (oos.sampleSize === 0) {
    return 0;
  }
  // Expectancy lower bound is the primary OOS signal: -0.5R -> 0, +0.5R -> 100.
  const expectancyComponent = clamp(((oos.expectancyLower95 + 0.5) / 1) * 100);
  const winRateComponent = clamp(oos.winRate * 100);
  const sampleComponent = clamp((oos.sampleSize / oos.minimumSampleSize) * 100);
  return clamp(expectancyComponent * 0.6 + winRateComponent * 0.2 + sampleComponent * 0.2);
};

const robustnessScore = (validation: ValidationSuiteReport) => {
  const nonRed = validation.scenarios.filter((scenario) => scenario.readiness !== "red").length;
  const averageScenarioScore =
    validation.scenarios.reduce((sum, scenario) => sum + scenario.score, 0) / Math.max(1, validation.scenarios.length);
  return clamp(averageScenarioScore * 0.6 + (nonRed / Math.max(1, validation.scenarios.length)) * 40);
};

export function scoreCandidateConfig({
  baselineMetrics,
  metrics,
  validation,
  quality,
  grinchScore,
  outOfSample,
  scoringCriteria = defaultAutoResearchScoringCriteria
}: {
  baselineMetrics: CalibrationProposalMetrics;
  metrics: CalibrationProposalMetrics;
  validation: ValidationSuiteReport;
  quality: ResearchQualityReview;
  grinchScore?: GrinchStrategyScore;
  /** Edge statistics from a held-out out-of-sample window, when available. */
  outOfSample?: EdgeStatistics;
  scoringCriteria?: AutoResearchScoringCriteria;
}): AutoResearchScoreBreakdown {
  const drawdownScore = clamp(100 - metrics.maxDrawdown * 14);
  const averageRScore = clamp(((metrics.averageR + 0.4) / 1.4) * 100);
  const winRateScore = clamp(metrics.winRate * 100);
  const attribution = quality.failureAttribution;
  const avoidableLossRate = attribution
    ? attribution.attributedStopHitCount / Math.max(1, attribution.completedTradeCount)
    : undefined;
  // Missing attribution is neutral, never inferred from ordinary stop-hit losses.
  const avoidableLossScore = typeof avoidableLossRate === "number" ? clamp((1 - avoidableLossRate) * 100) : 50;
  const confidenceCalibrationScore = clamp(metrics.confidenceCalibration * 100);
  const sessionScore = sessionConsistencyScore(quality);
  const tradeCountScore = clamp((metrics.totalTrades / AUTO_RESEARCH_MINIMUM_SAMPLE_TRADES) * 100);
  const skippedSignalBalanceScore = clamp(
    (metrics.totalTrades / Math.max(1, metrics.totalTrades + metrics.skippedSignals)) * 100
  );
  const profitFactorScore = scoreProfitFactor(metrics.profitFactor);
  const robustScore = robustnessScore(validation);
  const grinchModelScore = grinchScore?.grinchModelScore ?? 50;
  const grinchPenalty = grinchScore
    ? Math.min(
        28,
        grinchScore.falsePositiveRisk * 0.08 +
          (grinchScore.setupQuality === "blocked" ? 14 : grinchScore.setupQuality === "low_probability" ? 6 : 0) +
          ((grinchScore.falsePositiveBlockers ?? []).includes("missing_intermarket_confirmation") ? 3 : 0)
      )
    : 0;
  const weights = scoringCriteria.weights;
  const inSampleTotal =
    drawdownScore * weights.lowerMaxDrawdown +
    averageRScore * weights.betterAverageR +
    winRateScore * weights.acceptableWinRate +
    avoidableLossScore * weights.lowerFalsePositives +
    confidenceCalibrationScore * weights.confidenceCalibration +
    sessionScore * weights.sessionConsistency +
    tradeCountScore * weights.sufficientTradeCount +
    skippedSignalBalanceScore * weights.skippedSignalBalance +
    profitFactorScore * weights.profitFactor +
    robustScore * weights.robustnessAcrossScenarios +
    grinchModelScore * weights.grinchModelSupport -
    grinchPenalty;
  const oosScore = outOfSample ? scoreOutOfSample(outOfSample) : undefined;
  const totalScore = round(
    typeof oosScore === "number"
      ? inSampleTotal * (1 - OOS_BLEND_WEIGHT) + oosScore * OOS_BLEND_WEIGHT
      : inSampleTotal
  );
  const stabilityImproved =
    metrics.maxDrawdown <= baselineMetrics.maxDrawdown &&
    metrics.confidenceCalibration >= baselineMetrics.confidenceCalibration - 0.03;
  const sufficientSample =
    metrics.totalTrades >= AUTO_RESEARCH_MINIMUM_SAMPLE_TRADES &&
    metrics.totalTrades >= Math.max(AUTO_RESEARCH_MINIMUM_SAMPLE_TRADES, baselineMetrics.totalTrades * 0.35);

  return {
    totalScore,
    drawdownScore: round(drawdownScore),
    averageRScore: round(averageRScore),
    winRateScore: round(winRateScore),
    avoidableLossScore: round(avoidableLossScore),
    falsePositiveScore: round(avoidableLossScore),
    confidenceCalibrationScore: round(confidenceCalibrationScore),
    sessionConsistencyScore: round(sessionScore),
    tradeCountScore: round(tradeCountScore),
    skippedSignalBalanceScore: round(skippedSignalBalanceScore),
    profitFactorScore: round(profitFactorScore),
    robustnessScore: round(robustScore),
    grinchModelScore: grinchScore ? round(grinchModelScore) : undefined,
    grinchFalsePositiveRisk: grinchScore ? round(grinchScore.falsePositiveRisk) : undefined,
    grinchProfileValidity: grinchScore ? round(grinchScore.profileValidity) : undefined,
    oosScore: typeof oosScore === "number" ? round(oosScore) : undefined,
    oosTradeCount: outOfSample?.sampleSize,
    oosAverageR: outOfSample?.meanR,
    oosWinRate: outOfSample?.winRate,
    oosExpectancyLower95: outOfSample?.expectancyLower95,
    oosVerdict: outOfSample?.verdict,
    stabilityImproved,
    sufficientSample,
    rationale: stabilityImproved
      ? grinchScore
        ? `Candidate preserved or improved stability; Grinch support ${round(grinchModelScore)}/100 with false-positive risk ${round(grinchScore.falsePositiveRisk)}/100.`
        : "Candidate preserved or improved stability before profit was considered."
      : grinchScore
        ? `Candidate did not improve the stability-first gate enough; Grinch support ${round(grinchModelScore)}/100 is supporting evidence only.`
        : "Candidate did not improve the stability-first gate enough to auto-select confidently."
  };
}
