import { canonicalFingerprint } from "@/lib/ictCanonical/canonicalIctIdentity";
import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import type {
  CanonicalDealingRangeFact,
  CanonicalDisplacementFact,
  CanonicalIctFact,
  CanonicalIrlErlTransitionFact,
  CanonicalLiquidityFact,
  CanonicalMssFact,
  CanonicalPdArrayFact,
  CanonicalPdLocationFact
} from "@/lib/ictCanonical/canonicalIctTypes";
import { parameterHash, transitionAppender } from "@/lib/ictI2/ictI2Shared";
import { buildMmxmDeliveryContext, visibleIctI3Facts } from "@/lib/ictI3/marketMakerFramework";
import type {
  IctI3DetectionInput,
  MarketMakerDirection,
  MarketMakerModelCandidate,
  MarketMakerModelParameters,
  MmxmPhase
} from "@/lib/ictI3/ictI3Types";
import { buildCanonicalTradeGeometry, evaluateEntryLifecycle } from "@/lib/tradeGeometry";

const modelIdentity = (direction: MarketMakerDirection) => direction === "BULLISH"
  ? {
      strategyId: "ict_market_maker_buy_model_v1" as const,
      profileId: "ict_mmbm_base_research_v1" as const,
      side: "long" as const,
      tradeDirection: "LONG" as const,
      factDirection: "bullish" as const,
      engineeringSide: "SELL_SIDE_LIQUIDITY" as const,
      objectiveSide: "BUY_SIDE_LIQUIDITY" as const,
      requiredPdLocation: "DISCOUNT" as const
    }
  : {
      strategyId: "ict_market_maker_sell_model_v1" as const,
      profileId: "ict_mmsm_base_research_v1" as const,
      side: "short" as const,
      tradeDirection: "SHORT" as const,
      factDirection: "bearish" as const,
      engineeringSide: "BUY_SIDE_LIQUIDITY" as const,
      objectiveSide: "SELL_SIDE_LIQUIDITY" as const,
      requiredPdLocation: "PREMIUM" as const
    };

const compactIds = (facts: Array<CanonicalIctFact | undefined>) =>
  [...new Set(facts.filter((fact): fact is CanonicalIctFact => Boolean(fact)).map((fact) => fact.factId))];

const latest = <T extends CanonicalIctFact>(facts: readonly T[]) => facts.at(-1);

const after = (fact: CanonicalIctFact, timestamp: string) => Date.parse(fact.validFrom) >= Date.parse(timestamp);

const narrativeSupports = (input: IctI3DetectionInput, direction: MarketMakerDirection) => {
  const expected = direction === "BULLISH" ? "bullish" : "bearish";
  const opposite = direction === "BULLISH" ? "bearish" : "bullish";
  const expectedPath = direction === "BULLISH" ? "buyside" : "sellside";
  const maturation = input.narrative.setupMaturationDirection === expected;
  const structuralContinuation =
    input.narrative.structuralBias === expected && input.narrative.currentFlowDirection !== opposite;
  return (maturation || structuralContinuation) && input.narrative.liquidityPath === expectedPath;
};

const parameterMaterial = (parameters: MarketMakerModelParameters, direction: MarketMakerDirection) => ({
  ...parameters,
  direction,
  eligiblePdArrayTypes: [...parameters.eligiblePdArrayTypes]
});

export const evaluateMarketMakerModelCore = (
  input: IctI3DetectionInput,
  direction: MarketMakerDirection,
  parameters: MarketMakerModelParameters
): MarketMakerModelCandidate => {
  const identity = modelIdentity(direction);
  const facts = visibleIctI3Facts(input.facts, input.asOf);
  const lifecycle = transitionAppender<MmxmPhase>("SEARCHING", input.asOf);
  const blockers: string[] = [];
  const warnings: string[] = [];
  let range: CanonicalDealingRangeFact | undefined;
  let engineering: CanonicalLiquidityFact | undefined;
  let transition: CanonicalIrlErlTransitionFact | undefined;
  let pdArray: CanonicalPdArrayFact | undefined;
  let objective: CanonicalLiquidityFact | undefined;

  const candidate = (): MarketMakerModelCandidate => {
    const supportingFactIds = compactIds([range, engineering, transition, pdArray, objective]);
    const candidateId = canonicalFingerprint({
      strategyId: identity.strategyId,
      profileId: identity.profileId,
      sourceFingerprint: input.sourceFingerprint,
      dealingRangeId: range?.dealingRangeId,
      liquidityEventId: engineering?.liquidityId,
      direction
    });
    return {
      candidateId,
      strategyId: identity.strategyId,
      strategyVersion: "1.0.0",
      profileId: identity.profileId,
      parameterHash: parameterHash("gotrader.ict.i3.market-maker.parameters.v1", parameterMaterial(parameters, direction)),
      sourceFingerprint: input.sourceFingerprint,
      datasetCertificateId: input.dataset?.datasetCertificateId,
      symbol: range?.symbol ?? facts[0]?.symbol,
      timeframe: range?.timeframe ?? facts[0]?.timeframe,
      marketTimestamp: input.asOf,
      direction: identity.side,
      state: lifecycle.state(),
      context: buildMmxmDeliveryContext({
        direction,
        phase: lifecycle.state(),
        range,
        liquidityEvent: engineering,
        transition,
        pdArray,
        objective,
        supportingFactIds,
        blockers
      }),
      supportingFactIds,
      transitions: lifecycle.transitions,
      blockers: [...blockers],
      warnings: [...warnings],
      authority: CANONICAL_ICT_NONE_AUTHORITY,
      researchValidated: false,
      productionAdoptionAllowed: false
    };
  };

  range = latest(facts.filter((fact): fact is CanonicalDealingRangeFact =>
    fact.factType === "DEALING_RANGE" && fact.state === "ACTIVE"
  ));
  if (!range) {
    blockers.push("An active canonical dealing range is required.");
    return candidate();
  }
  lifecycle.add("RANGE_CONTEXT_ESTABLISHED", range.validFrom, [range.factId], "A named canonical dealing range owns the model context.");

  if (!narrativeSupports(input, direction)) {
    blockers.push("C1/C1.1 narrative does not support this directional setup-maturation path.");
    return candidate();
  }

  if (parameters.premiumDiscountPolicy !== "DISABLED") {
    const pdLocation = latest(facts.filter((fact): fact is CanonicalPdLocationFact =>
      fact.factType === "PD_LOCATION" && fact.dealingRangeId === range?.dealingRangeId
    ));
    if (!pdLocation || pdLocation.location !== identity.requiredPdLocation) {
      const message = `${identity.requiredPdLocation} context is not confirmed for dealing range ${range.dealingRangeId}.`;
      if (parameters.premiumDiscountPolicy === "REQUIRED") {
        blockers.push(message);
        return candidate();
      }
      warnings.push(message);
    }
  }

  if (input.smt?.rejectsCandidate) {
    const message = `Opposing S1 SMT: ${input.smt.reason}`;
    if (parameters.opposingSmtBehavior === "BLOCK") {
      lifecycle.add("INVALIDATED", input.asOf, [], message);
      blockers.push(message);
      return candidate();
    }
    warnings.push(message);
  }
  lifecycle.add("LIQUIDITY_ENGINEERING_FORMING", range.validFrom, [range.factId], "The model waits for opposite external liquidity engineering.");

  engineering = facts.find((fact): fact is CanonicalLiquidityFact =>
    fact.factType === "LIQUIDITY" &&
    fact.dealingRangeId === range?.dealingRangeId &&
    fact.liquidityClass === "EXTERNAL" &&
    fact.side === identity.engineeringSide &&
    fact.status === "CONSUMED" &&
    Date.parse(fact.consumedAt ?? fact.validFrom) >= Date.parse(range?.validFrom ?? input.asOf)
  );
  if (!engineering) {
    blockers.push(`No consumed ${identity.engineeringSide} external-liquidity event exists in the active range.`);
    return candidate();
  }
  const eventAt = engineering.consumedAt ?? engineering.validFrom;
  lifecycle.add("LIQUIDITY_EVENT_CONFIRMED", eventAt, [engineering.factId], "Opposite external liquidity was consumed with canonical lineage.");
  lifecycle.add("DELIVERY_TRANSITION_FORMING", eventAt, [engineering.factId], "The framework waits for the canonical directional delivery transition.");

  transition = facts.find((fact): fact is CanonicalIrlErlTransitionFact =>
    fact.factType === "IRL_ERL_TRANSITION" &&
    fact.dealingRangeId === range?.dealingRangeId &&
    fact.transitionType === parameters.transitionPolicy &&
    fact.direction === identity.factDirection &&
    Date.parse(fact.startedAt) >= Date.parse(eventAt) &&
    fact.currentState !== "INVALIDATED"
  );
  if (!transition || transition.currentState === "FORMING") {
    blockers.push("Canonical ERL-to-IRL delivery transition is not confirmed.");
    return candidate();
  }
  lifecycle.add("DELIVERY_TRANSITION_CONFIRMED", transition.validFrom, [transition.factId], "I1 confirmed directional ERL-to-IRL delivery.");

  const displacement = facts.find((fact): fact is CanonicalDisplacementFact =>
    fact.factType === "DISPLACEMENT" && fact.direction === identity.factDirection && after(fact, transition?.validFrom ?? eventAt)
  );
  if (!displacement) {
    blockers.push("Directional canonical displacement after delivery confirmation is missing.");
    return candidate();
  }
  const mss = facts.find((fact): fact is CanonicalMssFact =>
    fact.factType === "MSS" && fact.direction === identity.factDirection && after(fact, displacement.validFrom)
  );
  if (parameters.mssPolicy === "REQUIRED" && !mss) {
    blockers.push("The selected profile requires canonical MSS after displacement.");
    return candidate();
  }

  lifecycle.add("PD_ARRAY_REPRICE_FORMING", displacement.validFrom, compactIds([displacement, mss]), "Delivery is confirmed; the model waits for an eligible canonical PD array.");
  pdArray = facts.find((fact): fact is CanonicalPdArrayFact =>
    fact.factType === "PD_ARRAY" &&
    parameters.eligiblePdArrayTypes.includes(fact.pdArrayType) &&
    (fact.direction === identity.factDirection || fact.direction === "neutral") &&
    ["FORMING", "ACTIVE"].includes(fact.state) &&
    after(fact, displacement.validFrom)
  );
  if (!pdArray) {
    blockers.push("No eligible canonical PD array is causally visible after displacement.");
    return candidate();
  }

  objective = facts.find((fact): fact is CanonicalLiquidityFact =>
    fact.factType === "LIQUIDITY" &&
    fact.dealingRangeId === range?.dealingRangeId &&
    fact.liquidityClass === "EXTERNAL" &&
    fact.side === identity.objectiveSide &&
    fact.liquidityId !== engineering?.liquidityId
  );
  if (!objective) {
    lifecycle.add("NO_VALID_TARGET", input.asOf, [range.factId], "The opposite external objective is missing.");
    blockers.push("No opposite external-liquidity objective exists for the active dealing range.");
    return candidate();
  }

  const [low, high] = pdArray.priceRange;
  const entry = parameters.entryMode === "PD_ARRAY_MIDPOINT"
    ? (low + high) / 2
    : identity.tradeDirection === "LONG" ? high : low;
  const expiresAt = new Date(Date.parse(pdArray.validFrom) + parameters.maximumSetupAgeMinutes * 60_000).toISOString();
  const executionCandles = [...(input.candlesByTimeframe[parameters.executionTimeframe] ?? [])]
    .filter((candle) => Date.parse(candle.timestamp) >= Date.parse(pdArray?.validFrom ?? input.asOf) && Date.parse(candle.timestamp) <= Date.parse(input.asOf))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const touch = executionCandles.find((candle) => candle.low <= entry && candle.high >= entry);
  const currentPrice = executionCandles.at(-1)?.close;
  const lifecycleStatus = currentPrice === undefined
    ? "WAITING_FOR_ENTRY" as const
    : evaluateEntryLifecycle({
        direction: identity.tradeDirection,
        intendedPrice: entry,
        currentPrice,
        asOf: input.asOf,
        validFrom: pdArray.validFrom,
        expiresAt,
        allowCausalRetrace: false,
        observedStatus: touch ? "ENTRY_TOUCHED_NOT_FILLED" : undefined
      });
  const geometry = buildCanonicalTradeGeometry({
    strategyId: identity.strategyId,
    strategyVersion: "1.0.0",
    profileId: identity.profileId,
    profileVersion: "1.0.0",
    parameterHash: parameterHash("gotrader.ict.i3.market-maker.parameters.v1", parameterMaterial(parameters, direction)),
    candidateId: canonicalFingerprint({
      strategyId: identity.strategyId,
      profileId: identity.profileId,
      sourceFingerprint: input.sourceFingerprint,
      dealingRangeId: range.dealingRangeId,
      liquidityEventId: engineering.liquidityId,
      direction
    }),
    direction: identity.tradeDirection,
    entry: {
      model: parameters.entryMode,
      intendedPrice: entry,
      sourceFactId: pdArray.factId,
      ownerTimeframe: pdArray.timeframe,
      validFrom: pdArray.validFrom,
      expiresAt,
      lifecycleStatus
    },
    stop: {
      model: parameters.stopMode,
      price: engineering.price,
      sourceFactId: engineering.factId,
      ownerTimeframe: engineering.ownerTimeframe,
      structuralInvalidation: true
    },
    targetCandidates: [{
      targetId: objective.liquidityId,
      type: "EXTERNAL_LIQUIDITY",
      direction: identity.tradeDirection,
      price: objective.price,
      sourceFactId: objective.factId,
      ownerTimeframe: objective.ownerTimeframe,
      validFrom: objective.validFrom,
      consumed: objective.status === "CONSUMED",
      internalExternalClass: "EXTERNAL",
      liquidityClass: objective.liquidityClass
    }],
    targetPolicy: {
      policyId: `${identity.strategyId}.opposite-external-objective`,
      policyVersion: "1.0.0",
      primaryTargetType: "EXTERNAL_LIQUIDITY",
      primaryTargetId: objective.liquidityId,
      allowedFallbackTargetTypes: []
    },
    primaryDrawOnLiquidityId: objective.liquidityId,
    minimumRequiredRR: parameters.minimumRR,
    sourceFingerprint: input.sourceFingerprint,
    asOf: input.asOf,
    researchOnly: true
  });

  if (geometry.status === "TARGET_CONSUMED") {
    lifecycle.add("TARGET_CONSUMED", objective.consumedAt ?? input.asOf, [objective.factId], "The native objective was consumed before entry.");
    blockers.push("Native external objective was consumed before entry.");
  } else if (geometry.status === "ENTRY_MISSED") {
    lifecycle.add("ENTRY_MISSED", input.asOf, [pdArray.factId], "Price passed the immutable native entry; no chase is allowed.");
    blockers.push("Native PD-array entry was missed; current price was not substituted.");
  } else if (geometry.status === "ENTRY_EXPIRED") {
    lifecycle.add("SETUP_EXPIRED", expiresAt, [pdArray.factId], "The preregistered setup age elapsed before entry.");
    blockers.push("Market Maker setup expired before entry.");
  } else if (!geometry.geometryValid || geometry.status === "VALID_BELOW_RR_THRESHOLD") {
    lifecycle.add("GEOMETRY_NON_ACTIONABLE", input.asOf, compactIds([engineering, pdArray, objective]), "G1.1 rejected actionability without changing native geometry.");
    blockers.push(...geometry.blockers);
  } else if (touch) {
    lifecycle.add("ENTRY_ELIGIBLE", touch.timestamp, compactIds([engineering, transition, pdArray, objective]), "Price touched the immutable PD-array entry intent.");
    lifecycle.add("ACTIVE_DELIVERY", touch.timestamp, compactIds([engineering, transition, pdArray, objective]), "The research model is active; BT2 exclusively owns fill and outcome.");
  }

  const result = candidate();
  return { ...result, geometry };
};
