import { canonicalFingerprint } from "@/lib/ictCanonical/canonicalIctIdentity";
import type {
  CanonicalDealingRangeFact,
  CanonicalDisplacementFact,
  CanonicalIctFact,
  CanonicalLiquidityFact,
  CanonicalPdArrayFact,
  CanonicalPdLocationFact,
  CanonicalPdArrayType
} from "@/lib/ictCanonical/canonicalIctTypes";
import type {
  MarketMakerDeliverySequence,
  MarketMakerDeliverySequenceStatus,
  MarketMakerDirection
} from "@/lib/ictI3/ictI3Types";
import { visibleIctI3Facts } from "@/lib/ictI3/marketMakerFramework";

export const MARKET_MAKER_DELIVERY_SEQUENCE_POLICY = Object.freeze({
  policyId: "gotrader.ict.i3.market-maker-delivery-sequence" as const,
  policyVersion: "1.0.0" as const
});

const at = (value?: string) => value === undefined ? undefined : Date.parse(value);
const strictlyAfter = (later: string, earlier: string) => Date.parse(later) > Date.parse(earlier);
const latestBy = <T>(items: readonly T[], timestamp: (item: T) => string) =>
  [...items].sort((left, right) => Date.parse(timestamp(left)) - Date.parse(timestamp(right))).at(-1);

const identityFor = (direction: MarketMakerDirection) => direction === "BULLISH"
  ? {
      factDirection: "bullish" as const,
      engineeringSide: "SELL_SIDE_LIQUIDITY" as const,
      objectiveSide: "BUY_SIDE_LIQUIDITY" as const,
      requiredLocation: "DISCOUNT" as const,
      engineeringAnchor: "lowSwingId" as const,
      objectiveAnchor: "highSwingId" as const
    }
  : {
      factDirection: "bearish" as const,
      engineeringSide: "BUY_SIDE_LIQUIDITY" as const,
      objectiveSide: "SELL_SIDE_LIQUIDITY" as const,
      requiredLocation: "PREMIUM" as const,
      engineeringAnchor: "highSwingId" as const,
      objectiveAnchor: "lowSwingId" as const
    };

const arrayInsideRange = (array: CanonicalPdArrayFact, range: CanonicalDealingRangeFact) => {
  const [low, high] = array.priceRange;
  return array.dealingRangeId === range.dealingRangeId &&
    array.lineage.sourceFingerprint === range.lineage.sourceFingerprint &&
    low >= range.lowPrice && high <= range.highPrice;
};

export const marketMakerSelectionHasSameRange = (
  selection: MarketMakerDeliverySequenceSelection
) => {
  const dealingRangeId = selection.range?.dealingRangeId;
  if (!dealingRangeId) return false;
  const sourceFingerprint = selection.range?.lineage.sourceFingerprint;
  return [selection.pdLocation, selection.engineering, selection.pdArray, selection.objective]
    .every((fact) => fact?.dealingRangeId === dealingRangeId && fact.lineage.sourceFingerprint === sourceFingerprint) &&
    selection.displacement?.lineage.sourceFingerprint === sourceFingerprint;
};

export interface MarketMakerDeliverySequenceSelection {
  range?: CanonicalDealingRangeFact;
  pdLocation?: CanonicalPdLocationFact;
  engineering?: CanonicalLiquidityFact;
  displacement?: CanonicalDisplacementFact;
  pdArray?: CanonicalPdArrayFact;
  objective?: CanonicalLiquidityFact;
}

export interface MarketMakerDeliveryQualificationResult {
  sequence: MarketMakerDeliverySequence;
  selection: MarketMakerDeliverySequenceSelection;
}

export const qualifyMarketMakerDeliverySequence = ({
  facts,
  asOf,
  sourceFingerprint,
  direction,
  eligiblePdArrayTypes
}: {
  facts: readonly CanonicalIctFact[];
  asOf: string;
  sourceFingerprint: string;
  direction: MarketMakerDirection;
  eligiblePdArrayTypes: readonly CanonicalPdArrayType[];
}): MarketMakerDeliveryQualificationResult => {
  const visible = visibleIctI3Facts(facts, asOf);
  const identity = identityFor(direction);
  const selection: MarketMakerDeliverySequenceSelection = {};
  let status: MarketMakerDeliverySequenceStatus = "QUALIFIED";
  const blockers: string[] = [];

  selection.range = latestBy(
    visible.filter((fact): fact is CanonicalDealingRangeFact =>
      fact.factType === "DEALING_RANGE" &&
      fact.state === "ACTIVE" &&
      fact.lineage.sourceFingerprint === sourceFingerprint
    ),
    (fact) => fact.validFrom
  );
  const range = selection.range;
  if (!range) {
    status = "WAITING_FOR_RANGE";
    blockers.push("An active canonical dealing range is required.");
  }

  if (range) {
    selection.pdLocation = latestBy(
      visible.filter((fact): fact is CanonicalPdLocationFact => fact.factType === "PD_LOCATION" && fact.dealingRangeId === range.dealingRangeId),
      (fact) => fact.validFrom
    );
    if (!selection.pdLocation || selection.pdLocation.location !== identity.requiredLocation) {
      status = "PD_LOCATION_INVALID";
      blockers.push(`${identity.requiredLocation} context is not confirmed for dealing range ${range.dealingRangeId}.`);
    }
  }

  if (range && selection.pdLocation?.location === identity.requiredLocation) {
    const anchorId = range[identity.engineeringAnchor];
    selection.engineering = latestBy(
      visible.filter((fact): fact is CanonicalLiquidityFact =>
        fact.factType === "LIQUIDITY" &&
        fact.dealingRangeId === range.dealingRangeId &&
        fact.liquidityClass === "EXTERNAL" &&
        fact.side === identity.engineeringSide &&
        fact.sourceStructureIds.includes(anchorId) &&
        fact.status === "CONSUMED" &&
        (at(fact.consumedAt ?? fact.validFrom) ?? Number.NEGATIVE_INFINITY) > Date.parse(range.validFrom)
      ),
      (fact) => fact.consumedAt ?? fact.validFrom
    );
    if (!selection.engineering) {
      status = "WAITING_FOR_LIQUIDITY_EVENT";
      blockers.push(`No consumed same-range ${identity.engineeringSide} range-anchor liquidity event is causally visible.`);
    }
  }

  const eventAt = selection.engineering?.consumedAt ?? selection.engineering?.validFrom;
  if (range && eventAt) {
    const directionalDisplacements = visible.filter((fact): fact is CanonicalDisplacementFact =>
      fact.factType === "DISPLACEMENT" &&
      fact.direction === identity.factDirection &&
      fact.lineage.sourceFingerprint === range.lineage.sourceFingerprint
    );
    selection.displacement = directionalDisplacements.find((fact) => strictlyAfter(fact.validFrom, eventAt));
    if (!selection.displacement) {
      status = directionalDisplacements.length ? "SEQUENCE_ORDER_INVALID" : "WAITING_FOR_DISPLACEMENT";
      blockers.push(`No ${identity.factDirection} canonical displacement is causally visible after liquidity consumption.`);
    }
  }

  if (range && selection.displacement) {
    const eligible = visible.filter((fact): fact is CanonicalPdArrayFact =>
      fact.factType === "PD_ARRAY" &&
      eligiblePdArrayTypes.includes(fact.pdArrayType) &&
      (fact.direction === identity.factDirection || fact.direction === "neutral") &&
      ["FORMING", "ACTIVE"].includes(fact.state)
    );
    const later = eligible.filter((fact) => strictlyAfter(fact.validFrom, selection.displacement!.validFrom));
    selection.pdArray = later.find((fact) => arrayInsideRange(fact, range));
    if (!selection.pdArray) {
      if (later.length) {
        status = "PD_ARRAY_RANGE_INVALID";
        blockers.push(`The later eligible PD array is not contained in dealing range ${range.dealingRangeId}.`);
      } else {
        status = eligible.length ? "SEQUENCE_ORDER_INVALID" : "WAITING_FOR_PD_ARRAY";
        blockers.push("No eligible canonical PD array is causally visible after displacement.");
      }
    }
  }

  if (range && selection.pdArray) {
    const objectiveAnchorId = range[identity.objectiveAnchor];
    selection.objective = latestBy(
      visible.filter((fact): fact is CanonicalLiquidityFact =>
        fact.factType === "LIQUIDITY" &&
        fact.dealingRangeId === range.dealingRangeId &&
        fact.liquidityClass === "EXTERNAL" &&
        fact.side === identity.objectiveSide &&
        fact.sourceStructureIds.includes(objectiveAnchorId) &&
        fact.liquidityId !== selection.engineering?.liquidityId
      ),
      (fact) => fact.validFrom
    );
    if (!selection.objective) {
      status = "OBJECTIVE_UNAVAILABLE";
      blockers.push("The opposite same-range external-liquidity objective is unavailable.");
    }
  }

  if (status === "QUALIFIED" && !marketMakerSelectionHasSameRange(selection)) {
    status = "PD_ARRAY_RANGE_INVALID";
    blockers.push(`Every range-relative Market Maker primitive must belong to dealing range ${range?.dealingRangeId}.`);
  }

  const supportingFactIds = [
    selection.range,
    selection.pdLocation,
    selection.engineering,
    selection.displacement,
    selection.pdArray,
    selection.objective
  ].flatMap((fact) => fact?.factId ?? []);
  const identityMaterial = {
    policyId: MARKET_MAKER_DELIVERY_SEQUENCE_POLICY.policyId,
    policyVersion: MARKET_MAKER_DELIVERY_SEQUENCE_POLICY.policyVersion,
    direction,
    sourceFingerprint,
    dealingRangeId: selection.range?.dealingRangeId,
    pdLocationFactId: selection.pdLocation?.factId,
    engineeringLiquidityId: selection.engineering?.liquidityId,
    displacementId: selection.displacement?.displacementId,
    pdArrayId: selection.pdArray?.pdArrayId,
    objectiveLiquidityId: selection.objective?.liquidityId,
    status,
    blockers
  };
  const sequence: MarketMakerDeliverySequence = {
    schemaId: "gotrader.ict.i3.market-maker-delivery-sequence",
    schemaVersion: "1.0.0",
    sequenceId: canonicalFingerprint(identityMaterial),
    strategyFamily: "MARKET_MAKER",
    direction,
    sourceFingerprint,
    dealingRangeId: selection.range?.dealingRangeId,
    pdLocationFactId: selection.pdLocation?.factId,
    engineeringLiquidityId: selection.engineering?.liquidityId,
    displacementId: selection.displacement?.displacementId,
    pdArrayId: selection.pdArray?.pdArrayId,
    objectiveLiquidityId: selection.objective?.liquidityId,
    orderedTimestamps: {
      rangeValidFrom: selection.range?.validFrom,
      pdLocationValidFrom: selection.pdLocation?.validFrom,
      liquidityConsumedAt: eventAt,
      displacementValidFrom: selection.displacement?.validFrom,
      pdArrayValidFrom: selection.pdArray?.validFrom,
      objectiveValidFrom: selection.objective?.validFrom
    },
    status,
    blockers,
    supportingFactIds,
    asOf,
    ...MARKET_MAKER_DELIVERY_SEQUENCE_POLICY
  };
  return { sequence, selection };
};
