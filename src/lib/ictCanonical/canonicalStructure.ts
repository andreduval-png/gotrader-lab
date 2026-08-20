import {
  canonicalFactBase,
  canonicalFactId,
  canonicalLineage,
  causalCandlesAt,
  fingerprintCanonicalSource,
  resolveFactMarket
} from "@/lib/ictCanonical/canonicalIctIdentity";
import type {
  CanonicalDisplacementFact,
  CanonicalFactBuildInput,
  CanonicalMssFact,
  CanonicalSwingFact
} from "@/lib/ictCanonical/canonicalIctTypes";

export interface CanonicalDisplacementPolicy {
  policyId: string;
  policyVersion: string;
  bodyLookback: number;
  minimumBodyMultiple: number;
}

export const LEGACY_SUITE_DISPLACEMENT_POLICY: CanonicalDisplacementPolicy = Object.freeze({
  policyId: "gotrader.canonical.displacement.legacy-suite",
  policyVersion: "1.0.0",
  bodyLookback: 10,
  minimumBodyMultiple: 1.6
});

const round = (value: number, digits = 8) => Number(value.toFixed(digits));

export const buildCanonicalDisplacements = (
  input: CanonicalFactBuildInput,
  policy: CanonicalDisplacementPolicy = LEGACY_SUITE_DISPLACEMENT_POLICY
): CanonicalDisplacementFact[] => {
  const candles = causalCandlesAt(input.candles, input.asOf);
  if (!candles.length) return [];
  const { symbol, timeframe } = resolveFactMarket(candles, input.symbol, input.timeframe);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);
  const facts: CanonicalDisplacementFact[] = [];
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const prior = candles.slice(Math.max(0, index - policy.bodyLookback), index);
    const bodySize = Math.abs(candle.close - candle.open);
    const baselineBodySize = prior.length
      ? prior.reduce((total, item) => total + Math.abs(item.close - item.open), 0) / prior.length
      : bodySize;
    if (bodySize < baselineBodySize * policy.minimumBodyMultiple || bodySize === 0) continue;
    const direction = candle.close >= candle.open ? "bullish" : "bearish";
    const factId = canonicalFactId("DISPLACEMENT", {
      symbol,
      timeframe,
      candleId: candle.id,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion
    });
    facts.push({
      ...canonicalFactBase({
        factId,
        factType: "DISPLACEMENT",
        symbol,
        timeframe,
        occurredAt: candle.timestamp,
        confirmedAt: candle.timestamp,
        validFrom: candle.timestamp,
        state: "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: [...prior.map((item) => item.id), candle.id],
          sourceFingerprint,
          policyId: policy.policyId,
          policyVersion: policy.policyVersion
        })
      }),
      factType: "DISPLACEMENT",
      displacementId: factId,
      direction,
      startCandleId: candle.id,
      endCandleId: candle.id,
      bodySize: round(bodySize),
      baselineBodySize: round(baselineBodySize),
      bodyMultiple: round(bodySize / Math.max(baselineBodySize, Number.EPSILON)),
      measurementPolicyId: policy.policyId
    });
  }
  return facts;
};

export const buildCanonicalMss = ({
  input,
  swings,
  displacements = []
}: {
  input: CanonicalFactBuildInput;
  swings: readonly CanonicalSwingFact[];
  displacements?: readonly CanonicalDisplacementFact[];
}): CanonicalMssFact[] => {
  const candles = causalCandlesAt(input.candles, input.asOf);
  if (!candles.length) return [];
  const { symbol, timeframe } = resolveFactMarket(candles, input.symbol, input.timeframe);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);
  const broken = new Set<string>();
  const facts: CanonicalMssFact[] = [];
  let structure: "bullish" | "bearish" | "neutral" = "neutral";

  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index];
    const previous = candles[index - 1];
    const available = swings.filter(
      (swing) => Date.parse(swing.validFrom) <= Date.parse(candle.timestamp) && Date.parse(swing.occurredAt) < Date.parse(candle.timestamp)
    );
    const high = available.filter((swing) => swing.direction === "high").at(-1);
    const low = available.filter((swing) => swing.direction === "low").at(-1);
    const brokenSwing =
      high && candle.close > high.price && previous.close <= high.price
        ? high
        : low && candle.close < low.price && previous.close >= low.price
          ? low
          : undefined;
    if (!brokenSwing || broken.has(brokenSwing.swingId)) continue;
    const direction = brokenSwing.direction === "high" ? "bullish" : "bearish";
    if (structure === direction) continue;
    structure = direction;
    broken.add(brokenSwing.swingId);
    const displacement = displacements.find(
      (fact) => fact.endCandleId === candle.id && fact.direction === direction
    );
    const factId = canonicalFactId("MSS", {
      symbol,
      timeframe,
      direction,
      brokenStructureId: brokenSwing.swingId,
      breakCandleId: candle.id
    });
    facts.push({
      ...canonicalFactBase({
        factId,
        factType: "MSS",
        symbol,
        timeframe,
        occurredAt: candle.timestamp,
        confirmedAt: candle.timestamp,
        validFrom: candle.timestamp,
        state: "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: [...brokenSwing.lineage.sourceCandleIds, candle.id],
          sourceFactIds: [brokenSwing.factId, ...(displacement ? [displacement.factId] : [])],
          sourceFingerprint,
          policyId: "gotrader.canonical.mss.close-through-confirmed-swing",
          policyVersion: "1.0.0"
        })
      }),
      factType: "MSS",
      mssId: factId,
      direction,
      brokenStructureId: brokenSwing.swingId,
      breakCandleId: candle.id,
      displacementId: displacement?.displacementId,
      breakPrice: brokenSwing.price
    });
  }
  return facts;
};
