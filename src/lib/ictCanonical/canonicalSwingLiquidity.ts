import type { Candle } from "@/lib/types";
import {
  canonicalFactBase,
  canonicalFactId,
  canonicalLineage,
  causalCandlesAt,
  fingerprintCanonicalSource,
  resolveFactMarket
} from "@/lib/ictCanonical/canonicalIctIdentity";
import type {
  CanonicalDrawOnLiquidityFact,
  CanonicalEqualLevelFact,
  CanonicalFactBuildInput,
  CanonicalLiquidityFact,
  CanonicalSwingFact
} from "@/lib/ictCanonical/canonicalIctTypes";

export const CANONICAL_SWING_POLICY = Object.freeze({
  policyId: "gotrader.canonical.swing.symmetric",
  policyVersion: "1.0.0",
  defaultLookback: 2
});

export interface CanonicalEqualLevelTolerancePolicy {
  policyId: string;
  policyVersion: string;
  toleranceBps: number;
  minimumPriceTolerance: number;
}

export const LEGACY_EQUAL_LEVEL_TOLERANCE_POLICY: CanonicalEqualLevelTolerancePolicy = Object.freeze({
  policyId: "gotrader.canonical.equal-level.legacy-suite",
  policyVersion: "1.0.0",
  toleranceBps: 4,
  minimumPriceTolerance: 0.01
});

const round = (value: number, digits = 8) => Number(value.toFixed(digits));

export const buildCanonicalSwings = (
  input: CanonicalFactBuildInput,
  lookback = CANONICAL_SWING_POLICY.defaultLookback
): CanonicalSwingFact[] => {
  const window = Math.max(1, Math.floor(lookback));
  const candles = causalCandlesAt(input.candles, input.asOf);
  if (!candles.length) return [];
  const { symbol, timeframe } = resolveFactMarket(candles, input.symbol, input.timeframe);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);
  const facts: CanonicalSwingFact[] = [];

  for (let index = window; index < candles.length - window; index += 1) {
    const pivot = candles[index];
    const left = candles.slice(index - window, index);
    const right = candles.slice(index + 1, index + window + 1);
    const neighbors = [...left, ...right];
    const direction = neighbors.every((candle) => pivot.high > candle.high)
      ? "high"
      : neighbors.every((candle) => pivot.low < candle.low)
        ? "low"
        : undefined;
    if (!direction) continue;

    const confirmation = right[right.length - 1];
    const price = direction === "high" ? pivot.high : pivot.low;
    const factId = canonicalFactId("SWING", {
      symbol,
      timeframe,
      pivotCandleId: pivot.id,
      direction,
      policyId: CANONICAL_SWING_POLICY.policyId,
      policyVersion: CANONICAL_SWING_POLICY.policyVersion,
      lookback: window
    });
    const legacyStrength =
      direction === "high"
        ? round(pivot.high - Math.max(...neighbors.map((candle) => candle.high)))
        : round(Math.min(...neighbors.map((candle) => candle.low)) - pivot.low);

    facts.push({
      ...canonicalFactBase({
        factId,
        factType: "SWING",
        symbol,
        timeframe,
        occurredAt: pivot.timestamp,
        confirmedAt: confirmation.timestamp,
        validFrom: confirmation.timestamp,
        state: "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: [...left, pivot, ...right].map((candle) => candle.id),
          sourceFingerprint,
          policyId: CANONICAL_SWING_POLICY.policyId,
          policyVersion: CANONICAL_SWING_POLICY.policyVersion
        })
      }),
      factType: "SWING",
      swingId: factId,
      direction,
      price,
      pivotCandleId: pivot.id,
      confirmationCandleId: confirmation.id,
      legacyStrength
    });
  }

  return facts.sort(
    (left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.factId.localeCompare(right.factId)
  );
};

const toleranceFor = (price: number, policy: CanonicalEqualLevelTolerancePolicy) =>
  Math.max(policy.minimumPriceTolerance, Math.abs(price) * (policy.toleranceBps / 10_000));

const firstConsumption = (
  candles: readonly Candle[],
  validFrom: string,
  direction: "highs" | "lows",
  price: number
) =>
  candles.find(
    (candle) =>
      Date.parse(candle.timestamp) > Date.parse(validFrom) &&
      (direction === "highs" ? candle.high > price : candle.low < price)
  );

export const buildCanonicalEqualLevels = ({
  input,
  swings,
  policy = LEGACY_EQUAL_LEVEL_TOLERANCE_POLICY
}: {
  input: CanonicalFactBuildInput;
  swings: readonly CanonicalSwingFact[];
  policy?: CanonicalEqualLevelTolerancePolicy;
}): CanonicalEqualLevelFact[] => {
  const candles = causalCandlesAt(input.candles, input.asOf);
  if (!candles.length) return [];
  const { symbol, timeframe } = resolveFactMarket(candles, input.symbol, input.timeframe);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);
  const facts: CanonicalEqualLevelFact[] = [];

  for (const direction of ["highs", "lows"] as const) {
    const matching = swings.filter((swing) => swing.direction === (direction === "highs" ? "high" : "low"));
    for (let index = 1; index < matching.length; index += 1) {
      const prior = matching[index - 1];
      const current = matching[index];
      const tolerance = toleranceFor(current.price, policy);
      if (Math.abs(prior.price - current.price) > tolerance) continue;
      const price = round((prior.price + current.price) / 2);
      const validFrom = current.validFrom;
      const consumed = firstConsumption(candles, validFrom, direction, price);
      const factId = canonicalFactId("EQUAL_LEVEL", {
        symbol,
        timeframe,
        direction,
        memberSwingIds: [prior.swingId, current.swingId],
        tolerancePolicyId: policy.policyId,
        tolerancePolicyVersion: policy.policyVersion
      });
      facts.push({
        ...canonicalFactBase({
          factId,
          factType: "EQUAL_LEVEL",
          symbol,
          timeframe,
          occurredAt: current.occurredAt,
          confirmedAt: current.confirmedAt,
          validFrom,
          state: consumed ? "CONSUMED" : "ACTIVE",
          lineage: canonicalLineage({
            sourceCandleIds: [...new Set([...prior.lineage.sourceCandleIds, ...current.lineage.sourceCandleIds])],
            sourceFactIds: [prior.factId, current.factId],
            sourceFingerprint,
            policyId: policy.policyId,
            policyVersion: policy.policyVersion
          })
        }),
        factType: "EQUAL_LEVEL",
        equalLevelId: factId,
        direction,
        memberSwingIds: [prior.swingId, current.swingId],
        price,
        tolerance,
        tolerancePolicyId: policy.policyId,
        liquidityStatus: consumed ? "CONSUMED" : "AVAILABLE",
        consumedAt: consumed?.timestamp
      });
    }
  }
  return facts;
};

const liquidityConsumption = (
  candles: readonly Candle[],
  validFrom: string,
  side: CanonicalLiquidityFact["side"],
  price: number
) =>
  candles.find(
    (candle) =>
      Date.parse(candle.timestamp) > Date.parse(validFrom) &&
      (side === "BUY_SIDE_LIQUIDITY" ? candle.high > price : candle.low < price)
  );

export const buildCanonicalSwingLiquidity = ({
  input,
  swings,
  equalLevels = []
}: {
  input: CanonicalFactBuildInput;
  swings: readonly CanonicalSwingFact[];
  equalLevels?: readonly CanonicalEqualLevelFact[];
}): CanonicalLiquidityFact[] => {
  const candles = causalCandlesAt(input.candles, input.asOf);
  if (!candles.length) return [];
  const { symbol, timeframe } = resolveFactMarket(candles, input.symbol, input.timeframe);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);

  const fromSwing = swings.map<CanonicalLiquidityFact>((swing) => {
    const side = swing.direction === "high" ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY";
    const consumed = liquidityConsumption(candles, swing.validFrom, side, swing.price);
    const factId = canonicalFactId("LIQUIDITY", {
      symbol,
      timeframe,
      side,
      liquidityClass: "SWING",
      sourceStructureIds: [swing.swingId]
    });
    return {
      ...canonicalFactBase({
        factId,
        factType: "LIQUIDITY",
        symbol,
        timeframe,
        occurredAt: swing.occurredAt,
        confirmedAt: swing.confirmedAt,
        validFrom: swing.validFrom,
        state: consumed ? "CONSUMED" : "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: swing.lineage.sourceCandleIds,
          sourceFactIds: [swing.factId],
          sourceFingerprint,
          policyId: "gotrader.canonical.liquidity.swing",
          policyVersion: "1.0.0"
        })
      }),
      factType: "LIQUIDITY",
      liquidityId: factId,
      side,
      liquidityClass: "SWING",
      sourceStructureIds: [swing.swingId],
      ownerTimeframe: timeframe,
      price: swing.price,
      status: consumed ? "CONSUMED" : "AVAILABLE",
      consumedAt: consumed?.timestamp,
      consumingCandleId: consumed?.id
    };
  });

  const fromEqual = equalLevels.map<CanonicalLiquidityFact>((level) => {
    const side = level.direction === "highs" ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY";
    const consumed = liquidityConsumption(candles, level.validFrom, side, level.price);
    const factId = canonicalFactId("LIQUIDITY", {
      symbol,
      timeframe,
      side,
      liquidityClass: "EQUAL_HIGH_LOW",
      sourceStructureIds: [level.equalLevelId]
    });
    return {
      ...canonicalFactBase({
        factId,
        factType: "LIQUIDITY",
        symbol,
        timeframe,
        occurredAt: level.occurredAt,
        confirmedAt: level.confirmedAt,
        validFrom: level.validFrom,
        state: consumed ? "CONSUMED" : "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: level.lineage.sourceCandleIds,
          sourceFactIds: [level.factId],
          sourceFingerprint,
          policyId: "gotrader.canonical.liquidity.equal-level",
          policyVersion: "1.0.0"
        })
      }),
      factType: "LIQUIDITY",
      liquidityId: factId,
      side,
      liquidityClass: "EQUAL_HIGH_LOW",
      sourceStructureIds: [level.equalLevelId],
      ownerTimeframe: timeframe,
      price: level.price,
      status: consumed ? "CONSUMED" : "AVAILABLE",
      consumedAt: consumed?.timestamp,
      consumingCandleId: consumed?.id
    };
  });

  return [...fromSwing, ...fromEqual];
};

const timeframeWeight = (timeframe: CanonicalLiquidityFact["ownerTimeframe"]) =>
  ({ "1d": 7, "4h": 6, "1h": 5, "30m": 4, "15m": 3, "5m": 2, "1m": 1 })[timeframe];

const classWeight = (liquidityClass: CanonicalLiquidityFact["liquidityClass"]) =>
  ({ EXTERNAL: 7, SESSION: 6, EQUAL_HIGH_LOW: 5, SWING: 4, INTERNAL: 3 })[liquidityClass];

export const selectCanonicalDrawOnLiquidity = ({
  liquidity,
  currentPrice,
  direction,
  asOf,
  sourceFingerprint
}: {
  liquidity: readonly CanonicalLiquidityFact[];
  currentPrice: number;
  direction: "bullish" | "bearish";
  asOf: string;
  sourceFingerprint: string;
}): CanonicalDrawOnLiquidityFact | undefined => {
  const candidates = liquidity.filter(
    (fact) =>
      fact.status === "AVAILABLE" &&
      (direction === "bullish"
        ? fact.side === "BUY_SIDE_LIQUIDITY" && fact.price > currentPrice
        : fact.side === "SELL_SIDE_LIQUIDITY" && fact.price < currentPrice)
  );
  if (!candidates.length) return undefined;
  const nearest = [...candidates].sort(
    (left, right) => Math.abs(left.price - currentPrice) - Math.abs(right.price - currentPrice)
  )[0];
  const ranked = [...candidates].sort((left, right) => {
    const leftScore = classWeight(left.liquidityClass) * 10 + timeframeWeight(left.ownerTimeframe);
    const rightScore = classWeight(right.liquidityClass) * 10 + timeframeWeight(right.ownerTimeframe);
    return rightScore - leftScore || Math.abs(left.price - currentPrice) - Math.abs(right.price - currentPrice);
  });
  const target = ranked[0];
  const structuralRelevance = classWeight(target.liquidityClass) * 10 + timeframeWeight(target.ownerTimeframe);
  const factId = canonicalFactId("DRAW_ON_LIQUIDITY", {
    direction,
    targetLiquidityId: target.liquidityId,
    asOf,
    selectionPolicyVersion: "1.0.0"
  });
  return {
    ...canonicalFactBase({
      factId,
      factType: "DRAW_ON_LIQUIDITY",
      symbol: target.symbol,
      timeframe: target.timeframe,
      occurredAt: asOf,
      confirmedAt: asOf,
      validFrom: asOf,
      state: "ACTIVE",
      lineage: canonicalLineage({
        sourceCandleIds: target.lineage.sourceCandleIds,
        sourceFactIds: candidates.map((candidate) => candidate.factId),
        sourceFingerprint,
        policyId: "gotrader.canonical.draw.structural",
        policyVersion: "1.0.0"
      })
    }),
    factType: "DRAW_ON_LIQUIDITY",
    drawId: factId,
    direction,
    targetLiquidityId: target.liquidityId,
    targetClass: target.liquidityClass,
    ownerTimeframe: target.ownerTimeframe,
    distance: round(Math.abs(target.price - currentPrice)),
    structuralRelevance,
    available: true,
    consumed: false,
    selectionPolicyVersion: "1.0.0",
    nearestLiquidityId: nearest.liquidityId
  };
};
