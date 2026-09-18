import {
  canonicalFactBase,
  canonicalFactId,
  canonicalLineage
} from "@/lib/ictCanonical/canonicalIctIdentity";
import type {
  CanonicalDealingRangeFact,
  CanonicalIrlErlTransitionFact,
  CanonicalLiquidityFact
} from "@/lib/ictCanonical/canonicalIctTypes";

export const classifyCanonicalRangeLiquidity = ({
  dealingRange,
  liquidity
}: {
  dealingRange: CanonicalDealingRangeFact;
  liquidity: readonly CanonicalLiquidityFact[];
}): CanonicalLiquidityFact[] =>
  liquidity.flatMap((fact) => {
    const isRangeAnchor =
      fact.sourceStructureIds.includes(dealingRange.highSwingId) ||
      fact.sourceStructureIds.includes(dealingRange.lowSwingId);
    const insideRange = fact.price > dealingRange.lowPrice && fact.price < dealingRange.highPrice;
    if (!isRangeAnchor && !insideRange) return [];
    const liquidityClass = isRangeAnchor ? "EXTERNAL" : "INTERNAL";
    const factId = canonicalFactId("LIQUIDITY", {
      sourceLiquidityId: fact.liquidityId,
      dealingRangeId: dealingRange.dealingRangeId,
      liquidityClass
    });
    return [{
      ...fact,
      factId,
      liquidityId: factId,
      liquidityClass,
      dealingRangeId: dealingRange.dealingRangeId,
      lineage: canonicalLineage({
        sourceCandleIds: fact.lineage.sourceCandleIds,
        sourceFactIds: [fact.factId, dealingRange.factId],
        sourceFingerprint: fact.lineage.sourceFingerprint,
        policyId: "gotrader.canonical.irl-erl.range-relative",
        policyVersion: "1.0.0"
      })
    }];
  });

export const createCanonicalIrlErlTransition = ({
  transitionType,
  direction,
  fromLiquidity,
  toLiquidity,
  dealingRange,
  startedAt,
  confirmedAt,
  currentState
}: {
  transitionType: CanonicalIrlErlTransitionFact["transitionType"];
  direction: CanonicalIrlErlTransitionFact["direction"];
  fromLiquidity: CanonicalLiquidityFact;
  toLiquidity: CanonicalLiquidityFact;
  dealingRange: CanonicalDealingRangeFact;
  startedAt: string;
  confirmedAt: string;
  currentState: CanonicalIrlErlTransitionFact["currentState"];
}): CanonicalIrlErlTransitionFact => {
  const expectedFrom = transitionType === "IRL_TO_ERL_DELIVERY" ? "INTERNAL" : "EXTERNAL";
  const expectedTo = transitionType === "IRL_TO_ERL_DELIVERY" ? "EXTERNAL" : "INTERNAL";
  const startedAtMs = Date.parse(startedAt);
  const confirmedAtMs = Date.parse(confirmedAt);
  const earliestStartMs = Math.max(Date.parse(dealingRange.validFrom), Date.parse(fromLiquidity.validFrom));
  const earliestConfirmationMs = Math.max(startedAtMs, Date.parse(toLiquidity.validFrom));
  if (
    fromLiquidity.liquidityClass !== expectedFrom ||
    toLiquidity.liquidityClass !== expectedTo ||
    fromLiquidity.dealingRangeId !== dealingRange.dealingRangeId ||
    toLiquidity.dealingRangeId !== dealingRange.dealingRangeId ||
    fromLiquidity.symbol !== dealingRange.symbol ||
    toLiquidity.symbol !== dealingRange.symbol ||
    fromLiquidity.timeframe !== dealingRange.timeframe ||
    toLiquidity.timeframe !== dealingRange.timeframe
  ) {
    throw new Error("IRL/ERL transition endpoints must match the transition type and canonical dealing range.");
  }
  if (
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(confirmedAtMs) ||
    !Number.isFinite(earliestStartMs) ||
    !Number.isFinite(earliestConfirmationMs) ||
    startedAtMs < earliestStartMs ||
    confirmedAtMs < earliestConfirmationMs
  ) {
    throw new Error("IRL/ERL transition timestamps must be causal relative to the range and endpoint facts.");
  }
  const factId = canonicalFactId("IRL_ERL_TRANSITION", {
    transitionType,
    direction,
    fromLiquidityId: fromLiquidity.liquidityId,
    toLiquidityId: toLiquidity.liquidityId,
    dealingRangeId: dealingRange.dealingRangeId,
    startedAt
  });
  const baseState =
    currentState === "COMPLETED"
      ? "COMPLETED"
      : currentState === "INVALIDATED"
        ? "INVALIDATED"
        : currentState === "FORMING"
          ? "FORMING"
          : "ACTIVE";
  return {
    ...canonicalFactBase({
      factId,
      factType: "IRL_ERL_TRANSITION",
      symbol: dealingRange.symbol,
      timeframe: dealingRange.timeframe,
      occurredAt: startedAt,
      confirmedAt,
      validFrom: confirmedAt,
      state: baseState,
      lineage: canonicalLineage({
        sourceCandleIds: [
          ...new Set([
            ...fromLiquidity.lineage.sourceCandleIds,
            ...toLiquidity.lineage.sourceCandleIds,
            ...dealingRange.lineage.sourceCandleIds
          ])
        ],
        sourceFactIds: [fromLiquidity.factId, toLiquidity.factId, dealingRange.factId],
        sourceFingerprint: dealingRange.lineage.sourceFingerprint,
        policyId: "gotrader.canonical.irl-erl.transition",
        policyVersion: "1.0.0"
      })
    }),
    factType: "IRL_ERL_TRANSITION",
    transitionId: factId,
    transitionType,
    direction,
    fromLiquidityId: fromLiquidity.liquidityId,
    toLiquidityId: toLiquidity.liquidityId,
    dealingRangeId: dealingRange.dealingRangeId,
    startedAt,
    currentState
  };
};
