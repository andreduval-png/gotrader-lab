import {
  canonicalFactBase,
  canonicalFactId,
  canonicalLineage,
  causalCandlesAt,
  fingerprintCanonicalSource,
  resolveFactMarket
} from "@/lib/ictCanonical/canonicalIctIdentity";
import type {
  CanonicalBprFact,
  CanonicalFactBuildInput,
  CanonicalFvgFact,
  CanonicalFvgTransitionFact
} from "@/lib/ictCanonical/canonicalIctTypes";

const FVG_POLICY = Object.freeze({
  policyId: "gotrader.canonical.fvg.three-candle",
  policyVersion: "1.0.0"
});

const round = (value: number, digits = 8) => Number(value.toFixed(digits));

const fillFor = (
  direction: CanonicalFvgFact["direction"],
  proximal: number,
  distal: number,
  subsequent: readonly { high: number; low: number; timestamp: string }[]
) => {
  const width = Math.max(Math.abs(proximal - distal), Number.EPSILON);
  if (!subsequent.length) return { filledPercentage: 0, stateChangedAt: undefined };
  if (direction === "bullish") {
    const deepest = Math.min(...subsequent.map((candle) => candle.low));
    const filledPercentage = Math.min(1, Math.max(0, (proximal - deepest) / width));
    const change = subsequent.find((candle) => candle.low < proximal);
    return { filledPercentage, stateChangedAt: change?.timestamp };
  }
  const deepest = Math.max(...subsequent.map((candle) => candle.high));
  const filledPercentage = Math.min(1, Math.max(0, (deepest - proximal) / width));
  const change = subsequent.find((candle) => candle.high > proximal);
  return { filledPercentage, stateChangedAt: change?.timestamp };
};

export const buildCanonicalFvgs = (input: CanonicalFactBuildInput): CanonicalFvgFact[] => {
  const candles = causalCandlesAt(input.candles, input.asOf);
  if (candles.length < 3) return [];
  const { symbol, timeframe } = resolveFactMarket(candles, input.symbol, input.timeframe);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);
  const facts: CanonicalFvgFact[] = [];

  for (let index = 2; index < candles.length; index += 1) {
    const first = candles[index - 2];
    const middle = candles[index - 1];
    const third = candles[index];
    const direction = first.high < third.low ? "bullish" : first.low > third.high ? "bearish" : undefined;
    if (!direction) continue;
    const proximalPrice = direction === "bullish" ? third.low : third.high;
    const distalPrice = direction === "bullish" ? first.high : first.low;
    const subsequent = candles.slice(index + 1);
    const { filledPercentage, stateChangedAt } = fillFor(direction, proximalPrice, distalPrice, subsequent);
    const fvgState =
      filledPercentage >= 1 ? "FILLED" : filledPercentage > 0 ? "PARTIALLY_FILLED" : "OPEN";
    const factId = canonicalFactId("FVG", {
      symbol,
      timeframe,
      direction,
      originCandleIds: [first.id, middle.id, third.id],
      policyId: FVG_POLICY.policyId,
      policyVersion: FVG_POLICY.policyVersion
    });
    facts.push({
      ...canonicalFactBase({
        factId,
        factType: "FVG",
        symbol,
        timeframe,
        occurredAt: third.timestamp,
        confirmedAt: third.timestamp,
        validFrom: third.timestamp,
        state: fvgState === "FILLED" ? "COMPLETED" : "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: [first.id, middle.id, third.id],
          sourceFingerprint,
          policyId: FVG_POLICY.policyId,
          policyVersion: FVG_POLICY.policyVersion
        })
      }),
      factType: "FVG",
      fvgId: factId,
      direction,
      proximalPrice,
      distalPrice,
      midpoint: round((proximalPrice + distalPrice) / 2),
      originCandleIds: [first.id, middle.id, third.id],
      fvgState,
      filledPercentage: round(filledPercentage),
      stateChangedAt
    });
  }
  return facts;
};

export const buildCanonicalFvgTransitions = ({
  input,
  fvgs
}: {
  input: CanonicalFactBuildInput;
  fvgs: readonly CanonicalFvgFact[];
}): CanonicalFvgTransitionFact[] => {
  const candles = causalCandlesAt(input.candles, input.asOf);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);
  return fvgs.flatMap((fvg) => {
    const transition = candles.find(
      (candle) =>
        Date.parse(candle.timestamp) > Date.parse(fvg.validFrom) &&
        (fvg.direction === "bullish" ? candle.close < fvg.distalPrice : candle.close > fvg.distalPrice)
    );
    if (!transition) return [];
    const direction = fvg.direction === "bullish" ? "bearish" : "bullish";
    const factId = canonicalFactId("FVG_TRANSITION", {
      originFvgId: fvg.fvgId,
      transitionType: "INVERTED",
      transitionCandleId: transition.id
    });
    return [{
      ...canonicalFactBase({
        factId,
        factType: "FVG_TRANSITION",
        symbol: fvg.symbol,
        timeframe: fvg.timeframe,
        occurredAt: transition.timestamp,
        confirmedAt: transition.timestamp,
        validFrom: transition.timestamp,
        state: "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: [...fvg.lineage.sourceCandleIds, transition.id],
          sourceFactIds: [fvg.factId],
          sourceFingerprint,
          policyId: "gotrader.canonical.fvg.inversion",
          policyVersion: "1.0.0"
        })
      }),
      factType: "FVG_TRANSITION",
      transitionId: factId,
      transitionType: "INVERTED",
      originFvgId: fvg.fvgId,
      direction,
      transitionCandleId: transition.id,
      proximalPrice: fvg.proximalPrice,
      distalPrice: fvg.distalPrice
    }];
  });
};

export const buildCanonicalBprs = (
  fvgs: readonly CanonicalFvgFact[],
  sourceFingerprint: string
): CanonicalBprFact[] => {
  const facts: CanonicalBprFact[] = [];
  for (let index = 1; index < fvgs.length; index += 1) {
    const prior = fvgs[index - 1];
    const current = fvgs[index];
    if (
      prior.direction === current.direction ||
      prior.symbol !== current.symbol ||
      prior.timeframe !== current.timeframe
    ) continue;
    const priorLow = Math.min(prior.proximalPrice, prior.distalPrice);
    const priorHigh = Math.max(prior.proximalPrice, prior.distalPrice);
    const currentLow = Math.min(current.proximalPrice, current.distalPrice);
    const currentHigh = Math.max(current.proximalPrice, current.distalPrice);
    const overlapLow = Math.max(priorLow, currentLow);
    const overlapHigh = Math.min(priorHigh, currentHigh);
    if (overlapHigh <= overlapLow) continue;
    const bullish = prior.direction === "bullish" ? prior : current;
    const bearish = prior.direction === "bearish" ? prior : current;
    const validFrom = Date.parse(prior.validFrom) > Date.parse(current.validFrom) ? prior.validFrom : current.validFrom;
    const factId = canonicalFactId("BPR", {
      bullishFvgId: bullish.fvgId,
      bearishFvgId: bearish.fvgId,
      overlapLow,
      overlapHigh
    });
    facts.push({
      ...canonicalFactBase({
        factId,
        factType: "BPR",
        symbol: current.symbol,
        timeframe: current.timeframe,
        occurredAt: validFrom,
        confirmedAt: validFrom,
        validFrom,
        state: "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: [...new Set([...prior.lineage.sourceCandleIds, ...current.lineage.sourceCandleIds])],
          sourceFactIds: [prior.factId, current.factId],
          sourceFingerprint,
          policyId: "gotrader.canonical.bpr.opposing-fvg-overlap",
          policyVersion: "1.0.0"
        })
      }),
      factType: "BPR",
      bprId: factId,
      bullishFvgId: bullish.fvgId,
      bearishFvgId: bearish.fvgId,
      overlapLow,
      overlapHigh
    });
  }
  return facts;
};
