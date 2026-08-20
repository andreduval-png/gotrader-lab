import { assertCanonicalModelContract, type CanonicalIctModel } from "@/lib/ictCanonical/canonicalIctModelContract";
import type {
  CanonicalDisplacementFact,
  CanonicalDrawOnLiquidityFact,
  CanonicalFvgFact,
  CanonicalLiquidityFact,
  CanonicalMssFact
} from "@/lib/ictCanonical/canonicalIctTypes";
import {
  compactFactIds,
  factsAfter,
  ICT_I2_AUTHORITY,
  narrativeDirection,
  parameterHash,
  transitionAppender,
  visibleIctFacts
} from "@/lib/ictI2/ictI2Shared";
import type { IctI2CurrentReadProjection, IctI2DetectionInput, IctI2ModelCandidate } from "@/lib/ictI2/ictI2Types";

export type Ict2022State =
  | "SEARCHING"
  | "DIRECTIONAL_OBJECTIVE_ESTABLISHED"
  | "WAITING_FOR_LIQUIDITY_RAID"
  | "LIQUIDITY_RAID_CONFIRMED"
  | "DISPLACEMENT_CONFIRMED"
  | "MSS_CONFIRMED"
  | "FVG_CREATED"
  | "WAITING_FOR_RETRACE"
  | "ENTRY_ELIGIBLE"
  | "ACTIVE"
  | "TARGET_REACHED"
  | "INVALIDATED"
  | "ENTRY_MISSED"
  | "NO_FILL"
  | "SETUP_EXPIRED"
  | "LIQUIDITY_OBJECTIVE_CONSUMED"
  | "SOURCE_BLOCKED";

export interface Ict2022Parameters {
  structuralTimeframe: "1h" | "4h";
  directionalTimeframe: "15m";
  setupTimeframe: "5m";
  executionTimeframe: "1m" | "5m";
  entryMode: "FVG_PROXIMAL" | "FVG_MIDPOINT" | "CONFIRMATION_ENTRY";
  stopMode: "RAID_EXTREME" | "DISPLACEMENT_ORIGIN" | "STRUCTURAL_SWING";
  targetMode: "EXTERNAL_DRAW";
  maximumSetupAgeMinutes: number;
  minimumRR: number;
}

export const ICT_2022_BASE_PARAMETERS: Ict2022Parameters = Object.freeze({
  structuralTimeframe: "1h",
  directionalTimeframe: "15m",
  setupTimeframe: "5m",
  executionTimeframe: "5m",
  entryMode: "FVG_MIDPOINT",
  stopMode: "RAID_EXTREME",
  targetMode: "EXTERNAL_DRAW",
  maximumSetupAgeMinutes: 180,
  minimumRR: 1
});

const directionMatches = (direction: "bullish" | "bearish", factDirection: "bullish" | "bearish") => direction === factDirection;

const candidateBase = (input: IctI2DetectionInput, parameters: Ict2022Parameters) => ({
  candidateId: `ict_2022_model_v1|${input.sourceFingerprint}|${input.asOf}`,
  strategyId: "ict_2022_model_v1",
  strategyVersion: "1.0.0",
  profileId: "ict_2022_base_research_v1",
  parameterHash: parameterHash("gotrader.ict.i2.2022.parameters.v1", parameters),
  sourceFingerprint: input.sourceFingerprint,
  datasetCertificateId: input.dataset?.datasetCertificateId,
  marketTimestamp: input.asOf,
  authority: ICT_I2_AUTHORITY,
  researchValidated: false as const
});

export const evaluateIct2022Model = (
  input: IctI2DetectionInput,
  parameters: Ict2022Parameters = ICT_2022_BASE_PARAMETERS
): IctI2ModelCandidate<Ict2022State> => {
  const facts = visibleIctFacts(input.facts, input.asOf);
  const lifecycle = transitionAppender<Ict2022State>("SEARCHING", input.asOf);
  const direction = narrativeDirection(input.narrative);
  const side = direction === "bullish" ? "long" : direction === "bearish" ? "short" : "none";
  const blockers: string[] = [];

  if (!direction) {
    blockers.push("C1/C1.1 directional objective is unavailable or internally mixed.");
    return { ...candidateBase(input, parameters), direction: "none", state: lifecycle.state(), supportingFactIds: [], transitions: lifecycle.transitions, blockers };
  }

  const draw = facts.find((fact): fact is CanonicalDrawOnLiquidityFact =>
    fact.factType === "DRAW_ON_LIQUIDITY" && fact.direction === direction && fact.available && !fact.consumed
  );
  if (!draw) {
    blockers.push("Canonical external draw on liquidity is missing.");
    return { ...candidateBase(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: [], transitions: lifecycle.transitions, blockers };
  }
  lifecycle.add("DIRECTIONAL_OBJECTIVE_ESTABLISHED", draw.validFrom, [draw.factId], "C1/C1.1 narrative agrees with an available canonical draw.");
  lifecycle.add("WAITING_FOR_LIQUIDITY_RAID", draw.validFrom, [draw.factId], "The model requires opposite-side liquidity consumption.");

  const raidSide = direction === "bullish" ? "SELL_SIDE_LIQUIDITY" : "BUY_SIDE_LIQUIDITY";
  const raid = facts.find((fact): fact is CanonicalLiquidityFact =>
    fact.factType === "LIQUIDITY" && fact.side === raidSide && fact.status === "CONSUMED" &&
    Date.parse(fact.consumedAt ?? fact.validFrom) >= Date.parse(draw.validFrom)
  );
  if (!raid) {
    blockers.push("Opposite-side canonical liquidity raid has not been confirmed.");
    return { ...candidateBase(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: [draw.factId], transitions: lifecycle.transitions, blockers };
  }
  const raidAt = raid.consumedAt ?? raid.validFrom;
  lifecycle.add("LIQUIDITY_RAID_CONFIRMED", raidAt, [raid.factId], "Opposite-side canonical liquidity was consumed.");

  const displacement = factsAfter<CanonicalDisplacementFact>(facts, "DISPLACEMENT", raidAt, (fact) => directionMatches(direction, fact.direction));
  if (!displacement) {
    blockers.push("Directional displacement after the raid is missing.");
    return { ...candidateBase(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: compactFactIds([draw, raid]), transitions: lifecycle.transitions, blockers };
  }
  lifecycle.add("DISPLACEMENT_CONFIRMED", displacement.validFrom, [displacement.factId], "Canonical displacement confirmed delivery away from the raid.");

  const mss = factsAfter<CanonicalMssFact>(facts, "MSS", displacement.validFrom, (fact) => directionMatches(direction, fact.direction));
  if (!mss) {
    blockers.push("Canonical MSS after displacement is missing.");
    return { ...candidateBase(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: compactFactIds([draw, raid, displacement]), transitions: lifecycle.transitions, blockers };
  }
  lifecycle.add("MSS_CONFIRMED", mss.validFrom, [mss.factId], "Canonical MSS confirmed the structural delivery transition.");

  const fvg = factsAfter<CanonicalFvgFact>(facts, "FVG", mss.validFrom, (fact) => directionMatches(direction, fact.direction) && ["OPEN", "PARTIALLY_FILLED"].includes(fact.fvgState));
  if (!fvg) {
    blockers.push("Fresh directional FVG after MSS is missing.");
    return { ...candidateBase(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: compactFactIds([draw, raid, displacement, mss]), transitions: lifecycle.transitions, blockers };
  }
  lifecycle.add("FVG_CREATED", fvg.validFrom, [fvg.factId], "A directional canonical FVG became causally visible after MSS.");
  lifecycle.add("WAITING_FOR_RETRACE", fvg.validFrom, [fvg.factId], "The model does not chase price and waits for an eligible retracement.");

  const targetLiquidity = facts.find((fact): fact is CanonicalLiquidityFact => fact.factType === "LIQUIDITY" && fact.liquidityId === draw.targetLiquidityId);
  if (!targetLiquidity || targetLiquidity.status === "CONSUMED") {
    lifecycle.add("LIQUIDITY_OBJECTIVE_CONSUMED", targetLiquidity?.consumedAt ?? input.asOf, compactFactIds([draw, targetLiquidity]), "The directional objective was unavailable before entry.");
    blockers.push("Canonical target liquidity is missing or already consumed.");
    return { ...candidateBase(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: compactFactIds([draw, raid, displacement, mss, fvg, targetLiquidity]), transitions: lifecycle.transitions, blockers };
  }

  const candles = [...(input.candlesByTimeframe[parameters.executionTimeframe] ?? [])]
    .filter((candle) => Date.parse(candle.timestamp) >= Date.parse(fvg.validFrom) && Date.parse(candle.timestamp) <= Date.parse(input.asOf))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const retrace = candles.find((candle) => candle.high >= fvg.proximalPrice && candle.low <= fvg.distalPrice || candle.high >= fvg.distalPrice && candle.low <= fvg.proximalPrice);
  const expiresAt = new Date(Date.parse(fvg.validFrom) + parameters.maximumSetupAgeMinutes * 60_000).toISOString();
  if (!retrace) {
    if (Date.parse(input.asOf) > Date.parse(expiresAt)) {
      lifecycle.add("SETUP_EXPIRED", expiresAt, [fvg.factId], "No eligible FVG retracement occurred before profile expiry.");
      blockers.push("Setup expired before retracement.");
    } else {
      blockers.push("Waiting for retracement into the qualifying FVG.");
    }
    return { ...candidateBase(input, parameters), direction: side, state: lifecycle.state(), supportingFactIds: compactFactIds([draw, raid, displacement, mss, fvg, targetLiquidity]), transitions: lifecycle.transitions, blockers };
  }

  const entry = parameters.entryMode === "FVG_PROXIMAL" ? fvg.proximalPrice : parameters.entryMode === "CONFIRMATION_ENTRY" ? retrace.close : fvg.midpoint;
  const stop = raid.price;
  const target = targetLiquidity.price;
  const risk = direction === "bullish" ? entry - stop : stop - entry;
  const reward = direction === "bullish" ? target - entry : entry - target;
  if (risk <= 0 || reward <= 0) {
    lifecycle.add("INVALIDATED", retrace.timestamp, compactFactIds([raid, fvg, targetLiquidity]), "Structural geometry is directionally invalid.");
    blockers.push("Structural entry, stop, and target geometry is invalid.");
    return { ...candidateBase(input, parameters), direction: side, state: lifecycle.state(), triggerCandleId: retrace.id, supportingFactIds: compactFactIds([draw, raid, displacement, mss, fvg, targetLiquidity]), transitions: lifecycle.transitions, blockers };
  }
  const rr = reward / risk;
  lifecycle.add("ENTRY_ELIGIBLE", retrace.timestamp, compactFactIds([raid, displacement, mss, fvg, draw]), "FVG retracement completed the ordered model sequence.");
  if (rr < parameters.minimumRR) blockers.push(`Valid structural setup is non-actionable at ${rr.toFixed(2)}R below ${parameters.minimumRR.toFixed(2)}R.`);
  else lifecycle.add("ACTIVE", retrace.timestamp, compactFactIds([raid, displacement, mss, fvg, draw]), "Structural geometry is valid; BT2 exclusively owns fill and outcome.");

  return {
    ...candidateBase(input, parameters),
    direction: side,
    state: lifecycle.state(),
    triggerCandleId: retrace.id,
    supportingFactIds: compactFactIds([draw, raid, displacement, mss, fvg, targetLiquidity]),
    transitions: lifecycle.transitions,
    geometry: { entry, stop, target, expiresAt },
    blockers
  };
};

export const projectIct2022CurrentRead = (candidate: IctI2ModelCandidate<Ict2022State>): IctI2CurrentReadProjection => ({
  strategyId: candidate.strategyId,
  state: candidate.state,
  headline: "ICT 2022 Model",
  detail:
    candidate.state === "WAITING_FOR_RETRACE"
      ? "Liquidity raid, directional displacement, and MSS are confirmed. Waiting for retracement into the qualifying FVG."
      : candidate.state === "ACTIVE"
        ? "The ordered setup is entry-eligible with structural geometry delegated to BT2."
        : candidate.blockers[0] ?? `Model state: ${candidate.state}.`,
  blockers: candidate.blockers,
  authority: candidate.authority
});

export const ICT_2022_CANONICAL_MODEL: CanonicalIctModel = assertCanonicalModelContract({
  strategyId: "ict_2022_model_v1",
  strategyVersion: "1.0.0",
  classification: "research_only",
  requiredTimeframes: ["1h", "15m", "5m"],
  preferredTimeframes: ["4h", "1m"],
  optionalTimeframes: ["1d"],
  requiredFactTypes: ["LIQUIDITY", "DRAW_ON_LIQUIDITY", "DISPLACEMENT", "MSS", "FVG", "DEALING_RANGE"],
  factDependencyIds: ["i1.liquidity", "i1.draw-on-liquidity", "i1.displacement", "i1.mss", "i1.fvg"],
  narrativePolicyId: "c1.i2.ict-2022-directional-objective.v1",
  smtPolicy: "optional",
  parameterSchema: {
    parameterSchemaId: "gotrader.ict.i2.2022.parameters.v1",
    version: "1.0.0",
    parameters: [
      { name: "roleTimeframes", classification: "RESEARCH_PARAMETER" },
      { name: "entryMode", classification: "RESEARCH_PARAMETER", allowedValues: ["FVG_PROXIMAL", "FVG_MIDPOINT", "CONFIRMATION_ENTRY"] },
      { name: "stopMode", classification: "RESEARCH_PARAMETER", allowedValues: ["RAID_EXTREME", "DISPLACEMENT_ORIGIN", "STRUCTURAL_SWING"] },
      { name: "targetMode", classification: "SOURCE_DEFINED", allowedValues: ["EXTERNAL_DRAW"] },
      { name: "maximumSetupAgeMinutes", classification: "RESEARCH_PARAMETER", minimum: 15, maximum: 1440, defaultValue: 180 },
      { name: "minimumRR", classification: "RESEARCH_PARAMETER", minimum: 0, maximum: 10, defaultValue: 1 }
    ]
  },
  authority: ICT_I2_AUTHORITY,
  detect(input) {
    const result = evaluateIct2022Model({
      ...input,
      narrative: {
        structuralBias: "unavailable",
        currentFlowDirection: "unavailable",
        setupMaturationDirection: "unavailable",
        retracementState: "unavailable",
        continuationState: "unavailable",
        liquidityPath: "unavailable",
        policyId: "missing-c1-adapter",
        policyVersion: "0"
      }
    });
    if (result.state !== "ACTIVE" || !result.geometry || result.direction === "none") return [];
    return [{
      candidateId: result.candidateId,
      strategyId: result.strategyId,
      strategyVersion: result.strategyVersion,
      profileId: result.profileId,
      parameterFingerprint: result.parameterHash,
      sourceFingerprint: result.sourceFingerprint,
      symbol: result.symbol ?? "NQ",
      timeframe: result.timeframe ?? "5m",
      marketTimestamp: result.marketTimestamp,
      direction: result.direction,
      geometry: result.geometry,
      requiredFactIds: result.supportingFactIds,
      blockers: result.blockers,
      authority: result.authority
    }];
  }
});
