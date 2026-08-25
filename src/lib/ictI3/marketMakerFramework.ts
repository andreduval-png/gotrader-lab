import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import type {
  CanonicalDealingRangeFact,
  CanonicalIctFact,
  CanonicalIrlErlTransitionFact,
  CanonicalLiquidityFact,
  CanonicalPdArrayFact
} from "@/lib/ictCanonical/canonicalIctTypes";
import type { MarketMakerDirection, MmxmDeliveryContext, MmxmDeliveryDirection } from "@/lib/ictI3/ictI3Types";

export const visibleIctI3Facts = (facts: readonly CanonicalIctFact[], asOf: string) => {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) throw new Error("I3 requires a valid asOf timestamp.");
  return facts
    .filter((fact) => Date.parse(fact.validFrom) <= cutoff)
    .sort((left, right) => Date.parse(left.validFrom) - Date.parse(right.validFrom) || left.factId.localeCompare(right.factId));
};

export const marketMakerDeliveryDirection = (
  direction: MarketMakerDirection,
  transition?: CanonicalIrlErlTransitionFact
): MmxmDeliveryDirection => {
  if (!transition) return direction === "BULLISH" ? "TRANSITIONING_BULLISH" : "TRANSITIONING_BEARISH";
  if (transition.currentState === "FORMING") {
    return direction === "BULLISH" ? "TRANSITIONING_BULLISH" : "TRANSITIONING_BEARISH";
  }
  if (transition.currentState === "INVALIDATED") return "UNRESOLVED";
  return direction === "BULLISH" ? "BULLISH_DELIVERY" : "BEARISH_DELIVERY";
};

export const buildMmxmDeliveryContext = ({
  direction,
  phase,
  range,
  liquidityEvent,
  transition,
  pdArray,
  objective,
  supportingFactIds,
  blockers
}: {
  direction: MarketMakerDirection;
  phase: MmxmDeliveryContext["phase"];
  range?: CanonicalDealingRangeFact;
  liquidityEvent?: CanonicalLiquidityFact;
  transition?: CanonicalIrlErlTransitionFact;
  pdArray?: CanonicalPdArrayFact;
  objective?: CanonicalLiquidityFact;
  supportingFactIds: readonly string[];
  blockers: readonly string[];
}): MmxmDeliveryContext => Object.freeze({
  frameworkId: "gotrader.ict.i3.mmxm-delivery-framework.v1",
  classification: "framework_context",
  phase,
  deliveryDirection: phase === "SEARCHING" ? "UNRESOLVED" : marketMakerDeliveryDirection(direction, transition),
  dealingRangeId: range?.dealingRangeId,
  liquidityEventId: liquidityEvent?.liquidityId,
  liquidityClass: liquidityEvent?.liquidityClass,
  liquidityOwnerTimeframe: liquidityEvent?.ownerTimeframe,
  liquidityConsumedAt: liquidityEvent?.consumedAt,
  transitionId: transition?.transitionId,
  transitionType: transition?.transitionType,
  pdArrayId: pdArray?.pdArrayId,
  objectiveLiquidityId: objective?.liquidityId,
  supportingFactIds: [...supportingFactIds],
  blockers: [...blockers],
  authority: CANONICAL_ICT_NONE_AUTHORITY
});
