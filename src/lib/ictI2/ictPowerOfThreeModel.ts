import { assertCanonicalModelContract, type CanonicalIctModel } from "@/lib/ictCanonical/canonicalIctModelContract";
import type {
  CanonicalDealingRangeFact,
  CanonicalDisplacementFact,
  CanonicalFvgFact,
  CanonicalLiquidityFact,
  CanonicalMssFact
} from "@/lib/ictCanonical/canonicalIctTypes";
import {
  compactFactIds,
  factsAfter,
  ICT_I2_AUTHORITY,
  parameterHash,
  transitionAppender,
  visibleIctFacts
} from "@/lib/ictI2/ictI2Shared";
import type { IctI2CurrentReadProjection, IctI2DetectionInput, IctI2ModelCandidate } from "@/lib/ictI2/ictI2Types";

export type IctPo3State =
  | "SEARCHING"
  | "ACCUMULATION_FORMING"
  | "ACCUMULATION_CONFIRMED"
  | "MANIPULATION_FORMING"
  | "MANIPULATION_CONFIRMED"
  | "DISTRIBUTION_FORMING"
  | "DISTRIBUTION_CONFIRMED"
  | "ENTRY_ELIGIBLE"
  | "ACTIVE"
  | "MODEL_INVALIDATED"
  | "RANGE_BROKEN_INVALID"
  | "SESSION_EXPIRED"
  | "NO_DISTRIBUTION"
  | "ENTRY_MISSED"
  | "TARGET_REACHED";

export interface IctPo3Parameters {
  sessionPolicy: "ANY_CANONICAL_SESSION" | "LONDON" | "NEW_YORK_AM";
  distributionConfirmation: "DISPLACEMENT_AND_MSS";
  objectiveProfile: "EXTERNAL_LIQUIDITY" | "HOD_LOD_RESEARCH";
  entryMode: "FVG_MIDPOINT" | "CONFIRMATION_CLOSE";
  stopMode: "MANIPULATION_EXTREME";
  maximumLifecycleMinutes: number;
  minimumRR: number;
}

export const ICT_PO3_BASE_PARAMETERS: IctPo3Parameters = Object.freeze({
  sessionPolicy: "ANY_CANONICAL_SESSION",
  distributionConfirmation: "DISPLACEMENT_AND_MSS",
  objectiveProfile: "EXTERNAL_LIQUIDITY",
  entryMode: "FVG_MIDPOINT",
  stopMode: "MANIPULATION_EXTREME",
  maximumLifecycleMinutes: 720,
  minimumRR: 1
});

const baseCandidate = (input: IctI2DetectionInput, parameters: IctPo3Parameters) => ({
  candidateId: `ict_power_of_three_v1|${input.sourceFingerprint}|${input.asOf}`,
  strategyId: "ict_power_of_three_v1",
  strategyVersion: "1.0.0",
  profileId: parameters.objectiveProfile === "HOD_LOD_RESEARCH" ? "po3_hod_lod_research_v1" : "po3_external_liquidity_base_v1",
  parameterHash: parameterHash("gotrader.ict.i2.po3.parameters.v1", parameters),
  sourceFingerprint: input.sourceFingerprint,
  datasetCertificateId: input.dataset?.datasetCertificateId,
  marketTimestamp: input.asOf,
  authority: ICT_I2_AUTHORITY,
  researchValidated: false as const
});

export const evaluateIctPowerOfThree = (
  input: IctI2DetectionInput,
  parameters: IctPo3Parameters = ICT_PO3_BASE_PARAMETERS
): IctI2ModelCandidate<IctPo3State> => {
  const facts = visibleIctFacts(input.facts, input.asOf);
  const lifecycle = transitionAppender<IctPo3State>("SEARCHING", input.asOf);
  const blockers: string[] = [];
  const range = facts.find((fact): fact is CanonicalDealingRangeFact => fact.factType === "DEALING_RANGE" && fact.state === "ACTIVE");
  if (!range) {
    lifecycle.add("ACCUMULATION_FORMING", input.asOf, [], "No active canonical dealing range has matured.");
    blockers.push("Canonical accumulation range is not confirmed.");
    return { ...baseCandidate(input, parameters), direction: "none", state: lifecycle.state(), supportingFactIds: [], transitions: lifecycle.transitions, blockers };
  }
  lifecycle.add("ACCUMULATION_FORMING", range.occurredAt, [range.factId], "Canonical range began forming accumulation context.");
  lifecycle.add("ACCUMULATION_CONFIRMED", range.validFrom, [range.factId], "The canonical dealing range established bounded accumulation.");
  lifecycle.add("MANIPULATION_FORMING", range.validFrom, [range.factId], "The model waits for one range side to be consumed.");

  const manipulation = facts.find((fact): fact is CanonicalLiquidityFact =>
    fact.factType === "LIQUIDITY" && fact.dealingRangeId === range.dealingRangeId && fact.status === "CONSUMED" &&
    Date.parse(fact.consumedAt ?? fact.validFrom) >= Date.parse(range.validFrom)
  );
  if (!manipulation) {
    blockers.push("Accumulation exists but no canonical range-side manipulation is confirmed.");
    return { ...baseCandidate(input, parameters), direction: "none", state: lifecycle.state(), supportingFactIds: [range.factId], transitions: lifecycle.transitions, blockers };
  }
  const manipulationAt = manipulation.consumedAt ?? manipulation.validFrom;
  const distributionDirection = manipulation.side === "SELL_SIDE_LIQUIDITY" ? "bullish" : "bearish";
  const side = distributionDirection === "bullish" ? "long" : "short";
  lifecycle.add("MANIPULATION_CONFIRMED", manipulationAt, [manipulation.factId], `${manipulation.side} was consumed relative to the accumulation range.`);
  lifecycle.add("DISTRIBUTION_FORMING", manipulationAt, [manipulation.factId], "The model waits for delivery away from manipulation.");

  const displacement = factsAfter<CanonicalDisplacementFact>(facts, "DISPLACEMENT", manipulationAt, (fact) => fact.direction === distributionDirection);
  const mss = displacement
    ? factsAfter<CanonicalMssFact>(facts, "MSS", displacement.validFrom, (fact) => fact.direction === distributionDirection)
    : undefined;
  if (!displacement || !mss) {
    blockers.push("Manipulation is confirmed but ordered displacement and MSS distribution are incomplete.");
    return { ...baseCandidate(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: compactFactIds([range, manipulation, displacement]), transitions: lifecycle.transitions, blockers };
  }
  lifecycle.add("DISTRIBUTION_CONFIRMED", mss.validFrom, compactFactIds([displacement, mss]), "Directional displacement and MSS confirmed distribution away from manipulation.");

  const fvg = factsAfter<CanonicalFvgFact>(facts, "FVG", mss.validFrom, (fact) => fact.direction === distributionDirection && ["OPEN", "PARTIALLY_FILLED"].includes(fact.fvgState));
  const targetSide = distributionDirection === "bullish" ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY";
  const target = facts.find((fact): fact is CanonicalLiquidityFact =>
    fact.factType === "LIQUIDITY" && fact.side === targetSide && fact.status === "AVAILABLE" && fact.liquidityId !== manipulation.liquidityId &&
    (fact.dealingRangeId === range.dealingRangeId || fact.liquidityClass === "EXTERNAL")
  );
  if (!fvg || !target) {
    blockers.push(!fvg ? "Distribution is confirmed but no eligible directional FVG exists." : "Opposing external liquidity objective is unavailable.");
    return { ...baseCandidate(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: compactFactIds([range, manipulation, displacement, mss, fvg, target]), transitions: lifecycle.transitions, blockers };
  }

  const execution = [...(input.candlesByTimeframe["5m"] ?? [])]
    .filter((candle) => Date.parse(candle.timestamp) >= Date.parse(fvg.validFrom) && Date.parse(candle.timestamp) <= Date.parse(input.asOf))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const retrace = execution.find((candle) => candle.high >= Math.min(fvg.proximalPrice, fvg.distalPrice) && candle.low <= Math.max(fvg.proximalPrice, fvg.distalPrice));
  const expiresAt = new Date(Date.parse(range.validFrom) + parameters.maximumLifecycleMinutes * 60_000).toISOString();
  if (!retrace) {
    if (Date.parse(input.asOf) > Date.parse(expiresAt)) {
      lifecycle.add("SESSION_EXPIRED", expiresAt, compactFactIds([range, manipulation, mss]), "The preregistered PO3 lifecycle expired before entry retracement.");
      blockers.push("PO3 lifecycle expired without an entry retracement.");
    } else blockers.push("Distribution is confirmed; waiting for an eligible FVG retracement.");
    return { ...baseCandidate(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: compactFactIds([range, manipulation, displacement, mss, fvg, target]), transitions: lifecycle.transitions, blockers };
  }

  const entry = parameters.entryMode === "FVG_MIDPOINT" ? fvg.midpoint : retrace.close;
  const stop = manipulation.price;
  const targetPrice = target.price;
  const risk = side === "long" ? entry - stop : stop - entry;
  const reward = side === "long" ? targetPrice - entry : entry - targetPrice;
  if (risk <= 0 || reward <= 0) {
    lifecycle.add("MODEL_INVALIDATED", retrace.timestamp, compactFactIds([manipulation, fvg, target]), "Native PO3 structural geometry is invalid.");
    blockers.push("Native PO3 geometry is directionally invalid.");
    return { ...baseCandidate(input, parameters), direction: side, state: lifecycle.state(), triggerCandleId: retrace.id, supportingFactIds: compactFactIds([range, manipulation, displacement, mss, fvg, target]), transitions: lifecycle.transitions, blockers };
  }
  const rr = reward / risk;
  lifecycle.add("ENTRY_ELIGIBLE", retrace.timestamp, compactFactIds([range, manipulation, displacement, mss, fvg, target]), "The complete AMD sequence retraced into its directional FVG.");
  if (rr < parameters.minimumRR) blockers.push(`Valid PO3 structure is non-actionable at ${rr.toFixed(2)}R below ${parameters.minimumRR.toFixed(2)}R.`);
  else lifecycle.add("ACTIVE", retrace.timestamp, compactFactIds([range, manipulation, displacement, mss, fvg, target]), "BT2 exclusively owns fill and outcome from this geometry intent.");
  return {
    ...baseCandidate(input, parameters),
    direction: side,
    state: lifecycle.state(),
    triggerCandleId: retrace.id,
    supportingFactIds: compactFactIds([range, manipulation, displacement, mss, fvg, target]),
    transitions: lifecycle.transitions,
    geometry: { entry, stop, target: targetPrice, expiresAt },
    blockers
  };
};

export const projectIctPo3CurrentRead = (candidate: IctI2ModelCandidate<IctPo3State>): IctI2CurrentReadProjection => ({
  strategyId: candidate.strategyId,
  state: candidate.state,
  headline: "Power of Three",
  detail:
    candidate.state === "DISTRIBUTION_FORMING"
      ? "Accumulation and manipulation are confirmed. Directional distribution is forming."
      : candidate.state === "DISTRIBUTION_CONFIRMED"
        ? "Accumulation, manipulation, and distribution are confirmed. Waiting for entry retracement."
        : candidate.blockers[0] ?? `Model state: ${candidate.state}.`,
  blockers: candidate.blockers,
  authority: candidate.authority
});

export const ICT_PO3_CMD_COMPARISON = Object.freeze({
  sharedVocabulary: ["accumulation/consolidation", "manipulation", "distribution", "liquidity"],
  po3: "Bidirectional canonical range lifecycle with profile-level objectives and ordered distribution confirmation.",
  cmd: "Existing narrow short-only high-displacement profile with distinct 5m freshness, FVG, and RR gates.",
  behaviorallyIdentical: false,
  mergeAllowed: false
});

export const ICT_PO3_CANONICAL_MODEL: CanonicalIctModel = assertCanonicalModelContract({
  strategyId: "ict_power_of_three_v1",
  strategyVersion: "1.0.0",
  classification: "research_only",
  requiredTimeframes: ["15m", "5m"],
  preferredTimeframes: ["1h", "4h"],
  optionalTimeframes: ["1m", "1d"],
  requiredFactTypes: ["DEALING_RANGE", "LIQUIDITY", "DISPLACEMENT", "MSS", "FVG", "SESSION_WINDOW"],
  factDependencyIds: ["i1.dealing-range", "i1.liquidity", "i1.displacement", "i1.mss", "i1.fvg", "i1.session-window"],
  narrativePolicyId: "c1.i2.po3-delivery-context.v1",
  smtPolicy: "optional",
  parameterSchema: {
    parameterSchemaId: "gotrader.ict.i2.po3.parameters.v1",
    version: "1.0.0",
    parameters: [
      { name: "sessionPolicy", classification: "RESEARCH_PARAMETER", allowedValues: ["ANY_CANONICAL_SESSION", "LONDON", "NEW_YORK_AM"] },
      { name: "distributionConfirmation", classification: "SOURCE_DEFINED", allowedValues: ["DISPLACEMENT_AND_MSS"] },
      { name: "objectiveProfile", classification: "RESEARCH_PARAMETER", allowedValues: ["EXTERNAL_LIQUIDITY", "HOD_LOD_RESEARCH"] },
      { name: "entryMode", classification: "RESEARCH_PARAMETER", allowedValues: ["FVG_MIDPOINT", "CONFIRMATION_CLOSE"] },
      { name: "stopMode", classification: "SOURCE_DEFINED", allowedValues: ["MANIPULATION_EXTREME"] },
      { name: "maximumLifecycleMinutes", classification: "RESEARCH_PARAMETER", minimum: 60, maximum: 1440, defaultValue: 720 },
      { name: "minimumRR", classification: "RESEARCH_PARAMETER", minimum: 0, maximum: 10, defaultValue: 1 }
    ]
  },
  authority: ICT_I2_AUTHORITY,
  detect: () => []
});
