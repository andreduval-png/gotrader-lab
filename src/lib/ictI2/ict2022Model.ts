import type {
  CanonicalDisplacementFact,
  CanonicalDrawOnLiquidityFact,
  CanonicalFvgFact,
  CanonicalLiquidityFact,
  CanonicalMssFact
} from "@/lib/ictCanonical";
import { evaluateEntryLifecycle } from "@/lib/tradeGeometry/entryLifecycle";
import type { CompleteStrategyGeometryIntent } from "@/lib/tradeGeometry/strategyGeometryIntent";
import {
  candidateIdentity,
  canonicalGeometryFromIntent,
  contextIdentity,
  firstFactAfter,
  hierarchicalObjectiveDirection,
  ICT_CORE_AUTHORITY,
  supportingIds,
  transitionsFor,
  visibleFacts
} from "@/lib/ictI2/ictI2Shared";
import type { IctCoreDetectionInput, IctCoreStrategyCandidate } from "@/lib/ictI2/ictI2Types";

export type Ict2022State =
  | "SEARCHING"
  | "DIRECTIONAL_OBJECTIVE_ESTABLISHED"
  | "LIQUIDITY_RAID_CONFIRMED"
  | "DISPLACEMENT_CONFIRMED"
  | "MSS_CONFIRMED"
  | "FVG_CREATED"
  | "WAITING_FOR_RETRACE"
  | "ENTRY_ELIGIBLE"
  | "ACTIVE"
  | "ENTRY_MISSED"
  | "TARGET_CONSUMED"
  | "SOURCE_BLOCKED";

export const ICT_2022_MODEL_ID = "ict_2022_model_v1" as const;
export const ICT_2022_MODEL_VERSION = "2.0.0-int3a";
export const ICT_2022_PROFILE_ID = "ict_2022_canonical_research_v1";
export const ICT_2022_MINIMUM_RR = 2;

export const evaluateIct2022Model = (input: IctCoreDetectionInput): IctCoreStrategyCandidate<Ict2022State> => {
  const facts = visibleFacts(input.facts, input.asOf);
  const lifecycle = transitionsFor<Ict2022State>("SEARCHING", input.asOf);
  const blockers: string[] = [];
  const direction = hierarchicalObjectiveDirection(input.narrative);
  const side: "long" | "short" | "none" = direction === "bullish" ? "long" : direction === "bearish" ? "short" : "none";
  const base = (factIds: readonly string[]) => ({
    candidateId: candidateIdentity(ICT_2022_MODEL_ID, input.sourceFingerprint, factIds),
    strategyId: ICT_2022_MODEL_ID,
    strategyVersion: ICT_2022_MODEL_VERSION,
    profileId: ICT_2022_PROFILE_ID,
    role: "PRIMARY_EXECUTABLE_RESEARCH" as const,
    symbol: input.symbol,
    timeframe: input.timeframe,
    direction: side,
    supportingFactIds: factIds,
    transitions: lifecycle.transitions,
    contextIdentity: contextIdentity(input.narrative, factIds),
    sourceFingerprint: input.sourceFingerprint,
    marketTimestamp: input.asOf,
    researchValidated: false as const,
    authority: ICT_CORE_AUTHORITY
  });

  if (!direction) {
    blockers.push("hierarchical_structural_objective_unavailable");
    return { ...base([]), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }

  const draws = facts.filter((fact): fact is CanonicalDrawOnLiquidityFact =>
    fact.factType === "DRAW_ON_LIQUIDITY" && fact.direction === direction && fact.targetClass === "EXTERNAL" && fact.available && !fact.consumed
  );
  if (draws.length !== 1) {
    blockers.push(draws.length ? "multiple_primary_draws_source_blocked" : "primary_external_draw_missing");
    if (draws.length > 1) lifecycle.add("SOURCE_BLOCKED", input.asOf, draws.map((draw) => draw.factId), blockers[0]);
    return { ...base(draws.map((draw) => draw.factId)), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }
  const draw = draws[0];
  const target = facts.find((fact): fact is CanonicalLiquidityFact =>
    fact.factType === "LIQUIDITY" && fact.liquidityId === draw.targetLiquidityId
  );
  if (!target) {
    blockers.push("primary_draw_target_missing");
    return { ...base([draw.factId]), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }
  const objectiveAt = target.validFrom;
  lifecycle.add("DIRECTIONAL_OBJECTIVE_ESTABLISHED", objectiveAt, [draw.factId, target.factId], "The named canonical external draw existed before setup search.");

  const raidSide = direction === "bullish" ? "SELL_SIDE_LIQUIDITY" : "BUY_SIDE_LIQUIDITY";
  const raid = facts.find((fact): fact is CanonicalLiquidityFact =>
    fact.factType === "LIQUIDITY" && fact.side === raidSide && fact.status === "CONSUMED" &&
    Date.parse(fact.consumedAt ?? fact.validFrom) >= Date.parse(objectiveAt)
  );
  if (!raid) {
    blockers.push("opposite_liquidity_raid_missing");
    const ids = supportingIds([draw, target]);
    return { ...base(ids), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }
  const raidAt = raid.consumedAt ?? raid.validFrom;
  lifecycle.add("LIQUIDITY_RAID_CONFIRMED", raidAt, [raid.factId], "Canonical opposing liquidity was consumed.");
  const displacement = firstFactAfter<CanonicalDisplacementFact>(facts, "DISPLACEMENT", raidAt, (fact) => fact.direction === direction);
  if (!displacement) {
    blockers.push("post_raid_displacement_missing");
    const ids = supportingIds([draw, target, raid]);
    return { ...base(ids), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }
  lifecycle.add("DISPLACEMENT_CONFIRMED", displacement.validFrom, [displacement.factId], "Canonical same-direction displacement followed the raid.");
  const mss = firstFactAfter<CanonicalMssFact>(facts, "MSS", displacement.validFrom, (fact) =>
    fact.direction === direction && (!fact.displacementId || fact.displacementId === displacement.displacementId)
  );
  if (!mss) {
    blockers.push("post_displacement_mss_missing");
    const ids = supportingIds([draw, target, raid, displacement]);
    return { ...base(ids), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }
  lifecycle.add("MSS_CONFIRMED", mss.validFrom, [mss.factId], "Canonical MSS followed displacement.");
  const fvg = firstFactAfter<CanonicalFvgFact>(facts, "FVG", mss.validFrom, (fact) =>
    fact.direction === direction && ["OPEN", "PARTIALLY_FILLED"].includes(fact.fvgState)
  );
  if (!fvg) {
    blockers.push("post_mss_fvg_missing");
    const ids = supportingIds([draw, target, raid, displacement, mss]);
    return { ...base(ids), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }
  lifecycle.add("FVG_CREATED", fvg.validFrom, [fvg.factId], "A qualifying post-MSS canonical FVG became visible.");
  lifecycle.add("WAITING_FOR_RETRACE", fvg.validFrom, [fvg.factId], "The model waits for the source-native midpoint retracement.");
  const factIds = supportingIds([draw, target, raid, displacement, mss, fvg]);
  const candidateId = candidateIdentity(ICT_2022_MODEL_ID, input.sourceFingerprint, factIds);
  if (target.status === "CONSUMED") {
    lifecycle.add("TARGET_CONSUMED", target.consumedAt ?? input.asOf, [target.factId], "The named objective was consumed before plan eligibility.");
    blockers.push("target_consumed");
    return { ...base(factIds), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }

  const candles = [...(input.candlesByTimeframe[input.timeframe] ?? [])]
    .filter((candle) => Date.parse(candle.timestamp) >= Date.parse(fvg.validFrom) && Date.parse(candle.timestamp) <= Date.parse(input.asOf))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const intendedEntry = fvg.midpoint;
  const retrace = candles.find((candle) => candle.low <= intendedEntry && candle.high >= intendedEntry);
  const currentPrice = candles.at(-1)?.close;
  const entryStatus = retrace
    ? "ENTRY_FILLED" as const
    : currentPrice
      ? evaluateEntryLifecycle({
          direction: direction === "bullish" ? "LONG" : "SHORT",
          intendedPrice: intendedEntry,
          currentPrice,
          asOf: input.asOf,
          validFrom: fvg.validFrom
        })
      : "WAITING_FOR_ENTRY" as const;
  if (entryStatus === "ENTRY_MISSED") {
    lifecycle.add("ENTRY_MISSED", input.asOf, [fvg.factId], "Price passed the intended retracement without a causal fill.");
    blockers.push("entry_missed");
  } else if (!retrace) {
    blockers.push("waiting_for_causal_fvg_retracement");
  }

  const intent: CompleteStrategyGeometryIntent = {
    status: "COMPLETE",
    strategyId: ICT_2022_MODEL_ID,
    strategyVersion: ICT_2022_MODEL_VERSION,
    profileId: ICT_2022_PROFILE_ID,
    profileVersion: "1.0.0",
    direction: direction === "bullish" ? "LONG" : "SHORT",
    entry: {
      model: "POST_MSS_FVG_MIDPOINT_RETRACEMENT",
      intendedPrice: intendedEntry,
      sourceFactId: fvg.factId,
      ownerTimeframe: fvg.timeframe,
      validFrom: fvg.validFrom,
      lifecycleStatus: entryStatus
    },
    stop: {
      model: "OPPOSING_LIQUIDITY_RAID_EXTREME",
      price: raid.price,
      sourceFactId: raid.factId,
      ownerTimeframe: raid.ownerTimeframe,
      structuralInvalidation: true
    },
    primaryTarget: {
      targetId: draw.drawId,
      type: "PRIMARY_DRAW_ON_LIQUIDITY",
      direction: direction === "bullish" ? "LONG" : "SHORT",
      price: target.price,
      sourceFactId: target.factId,
      ownerTimeframe: target.ownerTimeframe,
      validFrom: target.validFrom,
      consumed: false,
      internalExternalClass: "EXTERNAL",
      liquidityClass: target.liquidityClass
    },
    intermediateTargets: [],
    supportingFactIds: factIds,
    sourceFingerprint: input.sourceFingerprint,
    geometryPolicyId: "gotrader.ict-2022.geometry.v1",
    geometryPolicyVersion: "1.0.0",
    entryPolicyId: "gotrader.ict-2022.entry.post-mss-fvg-midpoint.v1",
    stopPolicyId: "gotrader.ict-2022.stop.raid-extreme.v1",
    targetPolicyId: "gotrader.ict-2022.target.primary-external-draw.v1"
  };
  const geometry = canonicalGeometryFromIntent({ intent, candidateId, asOf: input.asOf, minimumRequiredRR: ICT_2022_MINIMUM_RR });
  if (entryStatus !== "ENTRY_MISSED" && retrace) {
    lifecycle.add("ENTRY_ELIGIBLE", retrace.timestamp, factIds, "The causal retracement completed the accepted model sequence.");
    if (geometry.actionable) lifecycle.add("ACTIVE", retrace.timestamp, factIds, "G1.1 accepted the complete source-native geometry.");
    else blockers.push(...geometry.blockers);
  }
  return {
    ...base(factIds),
    candidateId,
    state: lifecycle.state(),
    geometryEligible: geometry.geometryValid && entryStatus !== "ENTRY_MISSED",
    actionable: geometry.actionable && entryStatus !== "ENTRY_MISSED",
    geometryIntent: intent,
    canonicalGeometry: geometry,
    blockers: Array.from(new Set(blockers))
  };
};
