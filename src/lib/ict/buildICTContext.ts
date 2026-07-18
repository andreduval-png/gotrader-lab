import { detectBOS } from "@/lib/ict/detectBOS";
import { detectFairValueGaps } from "@/lib/ict/detectFVG";
import { detectLiquiditySweeps } from "@/lib/ict/detectLiquiditySweeps";
import { detectMSS } from "@/lib/ict/detectMSS";
import { detectPremiumDiscount } from "@/lib/ict/detectPremiumDiscount";
import { detectSwings } from "@/lib/ict/detectSwings";
import { tagSessions } from "@/lib/ict/sessionTagger";
import {
  loadICTScoringWeights,
  scoreICTConfluence,
  sanitizeICTScoringWeights
} from "@/lib/ict/confluenceScoring";
import type { Candle, ICTContext, ICTScoringWeights, MarketBias, ThesisInput, Timeframe } from "@/lib/types";

type ICTContextInput = Pick<ThesisInput, "symbol" | "timeframe" | "session">;

const latestByIndex = <T extends { index: number }>(items: T[]) =>
  [...items].sort((a, b) => b.index - a.index)[0];

const HTF_AGGREGATION: Partial<Record<Timeframe, { factor: number; timeframe: Timeframe }>> = {
  "1m": { factor: 15, timeframe: "15m" },
  "5m": { factor: 12, timeframe: "1h" },
  "15m": { factor: 4, timeframe: "1h" },
  "1h": { factor: 4, timeframe: "4h" },
  "4h": { factor: 6, timeframe: "1d" }
};

const MIN_HTF_CANDLES = 10;

/** Aggregates consecutive lower-timeframe candles into higher-timeframe buckets. */
export function aggregateCandlesToHigherTimeframe(candles: Candle[], factor: number, timeframe: Timeframe): Candle[] {
  const aggregated: Candle[] = [];
  for (let start = 0; start < candles.length; start += factor) {
    const bucket = candles.slice(start, start + factor);
    if (bucket.length < factor) {
      break;
    }
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    aggregated.push({
      ...first,
      id: `htf_${timeframe}_${first.id}`,
      timeframe,
      timestamp: first.timestamp,
      open: first.open,
      close: last.close,
      high: Math.max(...bucket.map((candle) => candle.high)),
      low: Math.min(...bucket.map((candle) => candle.low)),
      volume: bucket.reduce((sum, candle) => sum + (candle.volume ?? 0), 0)
    });
  }
  return aggregated;
}

export type HtfBiasResolution = {
  bias: MarketBias;
  source: "synthetic" | "real" | "fallback";
};

/**
 * Derives a structural higher-timeframe bias from aggregated HTF candles:
 * recent MSS/BOS direction plus premium/discount location. Falls back to the
 * same-timeframe bias only when there is not enough HTF history.
 * Source is "synthetic" when LTF candles are aggregated (not a true HTF feed).
 */
function resolveStructuralHtfBias(candles: Candle[], timeframe: Timeframe, fallback: MarketBias): HtfBiasResolution {
  const aggregation = HTF_AGGREGATION[timeframe];
  if (!aggregation) {
    return { bias: fallback, source: "fallback" };
  }
  const htfCandles = aggregateCandlesToHigherTimeframe(candles, aggregation.factor, aggregation.timeframe);
  if (htfCandles.length < MIN_HTF_CANDLES) {
    return { bias: fallback, source: "fallback" };
  }
  const htfSwings = detectSwings(htfCandles, 2);
  const htfMss = detectMSS(htfCandles, htfSwings);
  const htfBos = detectBOS(htfCandles, htfSwings);
  const structureEvents = [...htfMss, ...htfBos].sort((a, b) => b.index - a.index).slice(0, 5);
  const bullishEvents = structureEvents.filter((event) => event.direction === "bullish").length;
  const bearishEvents = structureEvents.filter((event) => event.direction === "bearish").length;
  const htfZone = detectPremiumDiscount(htfCandles, htfSwings);

  if (bullishEvents > bearishEvents) {
    // Extended into premium weakens a bullish structural read.
    return {
      bias: htfZone.currentZone === "premium" && bullishEvents - bearishEvents === 1 ? "neutral" : "bullish",
      source: "synthetic"
    };
  }
  if (bearishEvents > bullishEvents) {
    return {
      bias: htfZone.currentZone === "discount" && bearishEvents - bullishEvents === 1 ? "neutral" : "bearish",
      source: "synthetic"
    };
  }
  return { bias: "neutral", source: "synthetic" };
}

const riskRewardQualityFor = (
  currentPrice: number,
  latestSwingHigh: number | undefined,
  latestSwingLow: number | undefined,
  rangeHigh: number,
  rangeLow: number
) => {
  const bullishTarget = Math.max(latestSwingHigh ?? rangeHigh, rangeHigh);
  const bullishInvalidation = Math.min(latestSwingLow ?? rangeLow, rangeLow);
  const bearishTarget = Math.min(latestSwingLow ?? rangeLow, rangeLow);
  const bearishInvalidation = Math.max(latestSwingHigh ?? rangeHigh, rangeHigh);
  const bullishRisk = Math.max(1, currentPrice - bullishInvalidation);
  const bearishRisk = Math.max(1, bearishInvalidation - currentPrice);
  const bullishReward = Math.max(0, bullishTarget - currentPrice);
  const bearishReward = Math.max(0, currentPrice - bearishTarget);
  const bullishRatio = bullishReward / bullishRisk;
  const bearishRatio = bearishReward / bearishRisk;
  const bullish = Math.min(1, Math.max(0, (bullishRatio - 1) / 2));
  const bearish = Math.min(1, Math.max(0, (bearishRatio - 1) / 2));

  return {
    bullish,
    bearish,
    neutral: Math.max(0, 1 - Math.max(bullish, bearish))
  };
};

export function buildICTContext(
  candles: Candle[],
  input: ICTContextInput,
  scoringWeights: Partial<ICTScoringWeights> = loadICTScoringWeights()
): ICTContext {
  const scopedCandles = candles.filter((candle) => candle.symbol === input.symbol && candle.timeframe === input.timeframe);
  const sample = scopedCandles.length ? scopedCandles : candles;
  const swings = detectSwings(sample, 2);
  const mss = detectMSS(sample, swings);
  const bos = detectBOS(sample, swings);
  const liquiditySweeps = detectLiquiditySweeps(sample, swings);
  const fairValueGaps = detectFairValueGaps(sample);
  const premiumDiscountZone = detectPremiumDiscount(sample, swings);
  const sessions = tagSessions(sample);
  const latestSwingHigh = latestByIndex(swings.filter((swing) => swing.type === "high"));
  const latestSwingLow = latestByIndex(swings.filter((swing) => swing.type === "low"));
  const latestStructure = latestByIndex([...mss, ...bos]);
  const latestSweep = latestByIndex(liquiditySweeps);
  const latestGap = latestByIndex(fairValueGaps.filter((gap) => !gap.mitigated)) ?? latestByIndex(fairValueGaps);
  const latestSession = sessions[sessions.length - 1];

  const hasBullishMSS = mss.some((event) => event.direction === "bullish");
  const hasBearishMSS = mss.some((event) => event.direction === "bearish");
  const hasBullishBOS = bos.some((event) => event.direction === "bullish");
  const hasBearishBOS = bos.some((event) => event.direction === "bearish");
  const fairValueGap = latestGap?.direction ?? "none";
  const displacement = latestStructure?.displacement ?? (latestGap?.createdByDisplacement ? "mild" : "none");
  const killZone = latestSession?.killZone ?? "none";
  const weightsUsed = sanitizeICTScoringWeights(scoringWeights);
  const confluenceBreakdown = scoreICTConfluence({
    hasBullishMSS,
    hasBearishMSS,
    hasBullishBOS,
    hasBearishBOS,
    latestLiquiditySweep: latestSweep,
    latestFairValueGapDirection: fairValueGap,
    premiumDiscountZone,
    killZone,
    latestSwingHigh,
    latestSwingLow,
    riskRewardQuality: riskRewardQualityFor(
      premiumDiscountZone.currentPrice,
      latestSwingHigh?.price,
      latestSwingLow?.price,
      premiumDiscountZone.rangeHigh,
      premiumDiscountZone.rangeLow
    ),
    weights: weightsUsed
  });
  const bias = confluenceBreakdown.finalBias;
  const confluenceScore = confluenceBreakdown.totalScore;
  const htfResolution = resolveStructuralHtfBias(sample, input.timeframe, bias);

  const swingHighText = latestSwingHigh ? latestSwingHigh.price : "n/a";
  const swingLowText = latestSwingLow ? latestSwingLow.price : "n/a";
  const narrativeSummary = `ICT engine reads ${bias} with ${Math.round(confluenceBreakdown.confidence * 100)}% confidence: latest swing high ${swingHighText}, latest swing low ${swingLowText}, ${mss.length} MSS, ${bos.length} BOS, ${liquiditySweeps.length} sweep(s), ${fairValueGaps.length} FVG(s), price in ${premiumDiscountZone.currentZone}, kill zone ${killZone}. ${confluenceBreakdown.explanation}`;

  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    session: input.session,
    bias,
    latestSwingHigh,
    latestSwingLow,
    hasBullishMSS,
    hasBearishMSS,
    hasBullishBOS,
    hasBearishBOS,
    liquiditySweeps,
    fairValueGaps,
    premiumDiscountZone,
    killZone,
    confluenceScore,
    confluenceBreakdown,
    scoringWeightsUsed: weightsUsed,
    narrativeSummary,
    liquiditySweep: liquiditySweeps.length > 0,
    marketStructureShift: mss.length > 0,
    displacement,
    fairValueGap,
    premiumDiscount: premiumDiscountZone.currentZone,
    sessionTiming: input.session,
    higherTimeframeBias: htfResolution.bias,
    higherTimeframeBiasSource: htfResolution.source,
    killZoneTag: killZone
  };
}
