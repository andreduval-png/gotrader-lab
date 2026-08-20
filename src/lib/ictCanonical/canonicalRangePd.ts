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
  CanonicalBlockFact,
  CanonicalDealingRangeFact,
  CanonicalFactBuildInput,
  CanonicalFvgFact,
  CanonicalFvgTransitionFact,
  CanonicalOteZoneFact,
  CanonicalPdArrayFact,
  CanonicalPdLocationFact,
  CanonicalSwingFact
} from "@/lib/ictCanonical/canonicalIctTypes";

export interface CanonicalOtePolicy {
  policyId: string;
  policyVersion: string;
  retracementFractions: readonly [number, number];
}

export const LEGACY_OTE_FOUNDATION_POLICY: CanonicalOtePolicy = Object.freeze({
  policyId: "gotrader.canonical.ote.legacy-foundation",
  policyVersion: "1.0.0",
  retracementFractions: [0.62, 0.79] as const
});

export const buildCanonicalDealingRange = ({
  input,
  swings
}: {
  input: CanonicalFactBuildInput;
  swings: readonly CanonicalSwingFact[];
}): CanonicalDealingRangeFact | undefined => {
  const candles = causalCandlesAt(input.candles, input.asOf);
  if (!candles.length) return undefined;
  const { symbol, timeframe } = resolveFactMarket(candles, input.symbol, input.timeframe);
  const available = swings.filter((swing) => Date.parse(swing.validFrom) <= Date.parse(input.asOf));
  const high = available.filter((swing) => swing.direction === "high").at(-1);
  const low = available.filter((swing) => swing.direction === "low").at(-1);
  if (!high || !low || high.price <= low.price) return undefined;
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);
  const context =
    Date.parse(low.occurredAt) < Date.parse(high.occurredAt)
      ? "bullish_range"
      : Date.parse(high.occurredAt) < Date.parse(low.occurredAt)
        ? "bearish_range"
        : "balanced_range";
  const validFrom = Date.parse(high.validFrom) > Date.parse(low.validFrom) ? high.validFrom : low.validFrom;
  const factId = canonicalFactId("DEALING_RANGE", {
    symbol,
    timeframe,
    highSwingId: high.swingId,
    lowSwingId: low.swingId
  });
  return {
    ...canonicalFactBase({
      factId,
      factType: "DEALING_RANGE",
      symbol,
      timeframe,
      occurredAt: Date.parse(high.occurredAt) > Date.parse(low.occurredAt) ? high.occurredAt : low.occurredAt,
      confirmedAt: validFrom,
      validFrom,
      state: "ACTIVE",
      lineage: canonicalLineage({
        sourceCandleIds: [...new Set([...high.lineage.sourceCandleIds, ...low.lineage.sourceCandleIds])],
        sourceFactIds: [high.factId, low.factId],
        sourceFingerprint,
        policyId: "gotrader.canonical.dealing-range.latest-confirmed-opposing-swings",
        policyVersion: "1.0.0"
      })
    }),
    factType: "DEALING_RANGE",
    dealingRangeId: factId,
    highSwingId: high.swingId,
    lowSwingId: low.swingId,
    highPrice: high.price,
    lowPrice: low.price,
    equilibrium: (high.price + low.price) / 2,
    context
  };
};

export const buildCanonicalPdLocation = ({
  input,
  range,
  price,
  equilibriumBandFraction = 0.04
}: {
  input: CanonicalFactBuildInput;
  range: CanonicalDealingRangeFact;
  price: number;
  equilibriumBandFraction?: number;
}): CanonicalPdLocationFact => {
  const width = range.highPrice - range.lowPrice;
  const location =
    Math.abs(price - range.equilibrium) <= width * equilibriumBandFraction
      ? "EQUILIBRIUM"
      : price > range.equilibrium
        ? "PREMIUM"
        : "DISCOUNT";
  const factId = canonicalFactId("PD_LOCATION", {
    dealingRangeId: range.dealingRangeId,
    price,
    equilibriumBandFraction
  });
  return {
    ...canonicalFactBase({
      factId,
      factType: "PD_LOCATION",
      symbol: range.symbol,
      timeframe: range.timeframe,
      occurredAt: input.asOf,
      confirmedAt: input.asOf,
      validFrom: input.asOf,
      state: "ACTIVE",
      lineage: canonicalLineage({
        sourceCandleIds: [],
        sourceFactIds: [range.factId],
        sourceFingerprint: input.sourceFingerprint ?? range.lineage.sourceFingerprint,
        policyId: "gotrader.canonical.pd-location.range-relative",
        policyVersion: "1.0.0"
      })
    }),
    factType: "PD_LOCATION",
    pdLocationId: factId,
    dealingRangeId: range.dealingRangeId,
    price,
    location,
    equilibriumBandFraction
  };
};

export const buildCanonicalOteZone = (
  range: CanonicalDealingRangeFact,
  direction: "bullish" | "bearish",
  policy: CanonicalOtePolicy
): CanonicalOteZoneFact => {
  const [near, far] = policy.retracementFractions;
  if (!(near > 0 && far > near && far < 1)) throw new Error("OTE fractions must satisfy 0 < near < far < 1.");
  const width = range.highPrice - range.lowPrice;
  const prices: [number, number] = direction === "bullish"
    ? [range.highPrice - width * near, range.highPrice - width * far]
    : [range.lowPrice + width * near, range.lowPrice + width * far];
  const factId = canonicalFactId("OTE_ZONE", {
    dealingRangeId: range.dealingRangeId,
    direction,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion
  });
  return {
    ...canonicalFactBase({
      factId,
      factType: "OTE_ZONE",
      symbol: range.symbol,
      timeframe: range.timeframe,
      occurredAt: range.occurredAt,
      confirmedAt: range.confirmedAt,
      validFrom: range.validFrom,
      state: "ACTIVE",
      lineage: canonicalLineage({
        sourceCandleIds: range.lineage.sourceCandleIds,
        sourceFactIds: [range.factId],
        sourceFingerprint: range.lineage.sourceFingerprint,
        policyId: policy.policyId,
        policyVersion: policy.policyVersion
      })
    }),
    factType: "OTE_ZONE",
    oteZoneId: factId,
    dealingRangeId: range.dealingRangeId,
    direction,
    proximalPrice: Math.max(...prices),
    distalPrice: Math.min(...prices),
    retracementPolicyId: policy.policyId,
    retracementFractions: policy.retracementFractions
  };
};

type CanonicalArraySource = CanonicalFvgFact | CanonicalFvgTransitionFact | CanonicalBprFact | CanonicalBlockFact | CanonicalOteZoneFact;

export const projectCanonicalPdArrays = (facts: readonly CanonicalArraySource[]): CanonicalPdArrayFact[] =>
  facts.map((source) => {
    const pdArrayType = source.factType === "FVG"
      ? "FVG"
      : source.factType === "FVG_TRANSITION"
        ? "IFVG"
        : source.factType === "BPR"
          ? "BPR"
          : source.factType === "OTE_ZONE"
            ? "OTE_ZONE"
            : source.blockType;
    const prices: [number, number] = source.factType === "BPR"
      ? [source.overlapLow, source.overlapHigh]
      : [source.distalPrice, source.proximalPrice];
    const direction = source.factType === "BPR" || source.factType === "OTE_ZONE"
      ? source.factType === "OTE_ZONE" ? source.direction : "neutral"
      : source.direction;
    const factId = canonicalFactId("PD_ARRAY", { sourceFactId: source.factId, pdArrayType });
    return {
      ...canonicalFactBase({
        factId,
        factType: "PD_ARRAY",
        symbol: source.symbol,
        timeframe: source.timeframe,
        occurredAt: source.occurredAt,
        confirmedAt: source.confirmedAt,
        validFrom: source.validFrom,
        state: source.state,
        lineage: canonicalLineage({
          sourceCandleIds: source.lineage.sourceCandleIds,
          sourceFactIds: [source.factId],
          sourceFingerprint: source.lineage.sourceFingerprint,
          policyId: "gotrader.canonical.pd-array.projection",
          policyVersion: "1.0.0"
        })
      }),
      factType: "PD_ARRAY",
      pdArrayId: factId,
      pdArrayType,
      direction,
      priceRange: [Math.min(...prices), Math.max(...prices)],
      sourceFactId: source.factId
    };
  });
