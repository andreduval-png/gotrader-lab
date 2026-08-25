import type { CanonicalDealingRangeFact, CanonicalDisplacementFact, CanonicalLiquidityFact, CanonicalMssFact } from "@/lib/ictCanonical";
import { candidateIdentity, contextIdentity, firstFactAfter, ICT_CORE_AUTHORITY, supportingIds, transitionsFor, visibleFacts } from "@/lib/ictI2/ictI2Shared";
import type { IctCoreDetectionInput, IctCoreStrategyCandidate } from "@/lib/ictI2/ictI2Types";

export type IctPo3State = "SEARCHING" | "ACCUMULATION_FORMING" | "ACCUMULATION_CONFIRMED" | "MANIPULATION_CONFIRMED" | "DISTRIBUTION_FORMING" | "DISTRIBUTION_CONFIRMED" | "SOURCE_BLOCKED";
export const ICT_PO3_MODEL_ID = "ict_power_of_three_v1" as const;

export const evaluateIctPowerOfThree = (input: IctCoreDetectionInput): IctCoreStrategyCandidate<IctPo3State> => {
  const facts = visibleFacts(input.facts, input.asOf);
  const lifecycle = transitionsFor<IctPo3State>("SEARCHING", input.asOf);
  const blockers: string[] = [];
  const range = facts.find((fact): fact is CanonicalDealingRangeFact => fact.factType === "DEALING_RANGE" && fact.state === "ACTIVE");
  const base = (ids: readonly string[], direction: "long" | "short" | "none") => ({
    candidateId: candidateIdentity(ICT_PO3_MODEL_ID, input.sourceFingerprint, ids), strategyId: ICT_PO3_MODEL_ID,
    strategyVersion: "2.0.0-int3a", profileId: "po3_canonical_state_v1", role: "PRIMARY_STATE_MODEL" as const,
    symbol: input.symbol, timeframe: input.timeframe, direction, supportingFactIds: ids, transitions: lifecycle.transitions,
    contextIdentity: contextIdentity(input.narrative, ids), sourceFingerprint: input.sourceFingerprint, marketTimestamp: input.asOf,
    researchValidated: false as const, authority: ICT_CORE_AUTHORITY
  });
  if (!range) {
    lifecycle.add("ACCUMULATION_FORMING", input.asOf, [], "No active canonical dealing range has matured.");
    blockers.push("canonical_accumulation_range_missing");
    return { ...base([], "none"), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }
  lifecycle.add("ACCUMULATION_FORMING", range.occurredAt, [range.factId], "A canonical range began forming accumulation context.");
  lifecycle.add("ACCUMULATION_CONFIRMED", range.validFrom, [range.factId], "The canonical range established accumulation.");
  const manipulation = facts.find((fact): fact is CanonicalLiquidityFact =>
    fact.factType === "LIQUIDITY" && fact.dealingRangeId === range.dealingRangeId && fact.status === "CONSUMED" &&
    Date.parse(fact.consumedAt ?? fact.validFrom) >= Date.parse(range.validFrom)
  );
  if (!manipulation) {
    blockers.push("canonical_range_manipulation_missing");
    return { ...base([range.factId], "none"), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }
  const direction = manipulation.side === "SELL_SIDE_LIQUIDITY" ? "bullish" : "bearish";
  const side = direction === "bullish" ? "long" : "short";
  const manipulationAt = manipulation.consumedAt ?? manipulation.validFrom;
  lifecycle.add("MANIPULATION_CONFIRMED", manipulationAt, [manipulation.factId], "A canonical range side was consumed.");
  lifecycle.add("DISTRIBUTION_FORMING", manipulationAt, [manipulation.factId], "The model waits for ordered delivery away from manipulation.");
  const displacement = firstFactAfter<CanonicalDisplacementFact>(facts, "DISPLACEMENT", manipulationAt, (fact) => fact.direction === direction);
  const mss = displacement ? firstFactAfter<CanonicalMssFact>(facts, "MSS", displacement.validFrom, (fact) => fact.direction === direction) : undefined;
  const ids = supportingIds([range, manipulation, displacement, mss]);
  if (!displacement || !mss) {
    blockers.push("ordered_distribution_incomplete");
    return { ...base(ids, side), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
  }
  lifecycle.add("DISTRIBUTION_CONFIRMED", mss.validFrom, [displacement.factId, mss.factId], "Canonical displacement and MSS confirmed distribution.");
  lifecycle.add("SOURCE_BLOCKED", mss.validFrom, ids, "Accepted objective precedence remains unresolved.");
  blockers.push("PO3_TARGET_PRECEDENCE_SOURCE_BLOCKED");
  return { ...base(ids, side), state: lifecycle.state(), geometryEligible: false, actionable: false, blockers };
};

