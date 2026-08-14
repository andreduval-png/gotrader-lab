import { canonicalHash } from "../../../canonical/canonicalValueSerialization";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../../../backtestSimulation/simulationAuthority";
import type { V2CanonicalMarketState, V2DealingRangeFactPayload, V2DisplacementFactPayload, V2FactEnvelope,
  V2FairValueGapFactPayload, V2LiquidityPoolFactPayload, V2LiquiditySweepFactPayload, V2MarketFact } from "../../context/v2ContextTypes";
import { buildLrsBaseProfile } from "../../../strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperParameters";
import { buildLrsTransition } from "../../../strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperStateMachine";
import { V2_IFVG_V3_MAX_INVERSION_BARS } from "../ifvg/v2IfvgV3Types";
import { LRS_CANDIDATE_SCHEMA_VERSION, LRS_PROFILE_ID, LRS_STRATEGY_ID, LRS_STRATEGY_VERSION,
  type LrsBlocker, type LrsCandidate, type LrsDirection, type LrsParameters, type LrsSetupState, type LrsTransition } from "../../../strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperTypes";

type PoolFact = Readonly<V2FactEnvelope<"liquidity_pool", V2LiquidityPoolFactPayload>>;
type SweepFact = Readonly<V2FactEnvelope<"liquidity_sweep", V2LiquiditySweepFactPayload>>;
type DisplacementFact = Readonly<V2FactEnvelope<"displacement", V2DisplacementFactPayload>>;
type FvgFact = Readonly<V2FactEnvelope<"fair_value_gap", V2FairValueGapFactPayload>>;
type RangeFact = Readonly<V2FactEnvelope<"dealing_range", V2DealingRangeFactPayload>>;
const HASH = /^sha256:[0-9a-f]{64}$/;
const unique = <T extends string>(values: readonly T[]) => Object.freeze([...new Set(values)].sort());
const factAvailable = (fact: Readonly<V2MarketFact>, asOfMs: number) => Date.parse(fact.causalClosedCandleTime) <= asOfMs && Date.parse(fact.validFrom) <= asOfMs;

export interface LrsDetectionRequest {
  readonly context: Readonly<V2CanonicalMarketState>; readonly datasetCertificateId: string;
  readonly triggerCandleId: string; readonly setupCreatedAt: string; readonly expiresAt: string;
  readonly parameters?: Readonly<LrsParameters>;
}

const objectiveFor = (facts: readonly Readonly<V2MarketFact>[], direction: LrsDirection) => facts
  .filter((fact): fact is PoolFact => fact.kind === "liquidity_pool" && fact.payload.side === (direction === "long" ? "buy_side" : "sell_side"))
  .filter((fact) => fact.payload.state === "active" || fact.payload.state === "touched")
  .sort((a, b) => Math.abs(Date.parse(b.payload.confirmedAt)) - Math.abs(Date.parse(a.payload.confirmedAt)) || a.factId.localeCompare(b.factId))[0];
const raidFor = (facts: readonly Readonly<V2MarketFact>[], direction: LrsDirection) => facts
  .filter((fact): fact is SweepFact => fact.kind === "liquidity_sweep" && fact.payload.side === (direction === "long" ? "sell_side" : "buy_side"))
  .filter((fact) => fact.payload.confirmationState === "confirmed" || fact.payload.confirmationState === "wick_through")
  .sort((a, b) => Date.parse(a.causalClosedCandleTime) - Date.parse(b.causalClosedCandleTime))[0];
const displacementFor = (facts: readonly Readonly<V2MarketFact>[], direction: LrsDirection, raid?: SweepFact) => facts
  .filter((fact): fact is DisplacementFact => fact.kind === "displacement" && fact.payload.direction === (direction === "long" ? "bullish" : "bearish"))
  .filter((fact) => !raid || Date.parse(fact.causalClosedCandleTime) >= Date.parse(raid.causalClosedCandleTime))
  .sort((a, b) => Date.parse(a.causalClosedCandleTime) - Date.parse(b.causalClosedCandleTime))[0];
const ifvgTradeDirection = (fact: FvgFact): LrsDirection | undefined => {
  if (fact.payload.gapType === "ifvg") return fact.payload.direction === "bullish" ? "long" : "short";
  if (fact.payload.state !== "inverted" || !fact.payload.inversionTime || fact.payload.preInversionUsage !== "unused" ||
    fact.payload.inversionBarsAfterConfirmation === undefined ||
    fact.payload.inversionBarsAfterConfirmation > V2_IFVG_V3_MAX_INVERSION_BARS) return undefined;
  return fact.payload.direction === "bearish" ? "long" : "short";
};
const ifvgFor = (facts: readonly Readonly<V2MarketFact>[], direction: LrsDirection, displacement?: DisplacementFact) => facts
  .filter((fact): fact is FvgFact => fact.kind === "fair_value_gap" &&
    (fact.payload.gapType === "ifvg" || (fact.payload.gapType === "fvg" && fact.payload.state === "inverted" && Boolean(fact.payload.inversionTime))) &&
    ifvgTradeDirection(fact) === direction)
  .filter((fact) => ["fresh", "touched", "partially_filled", "inverted"].includes(fact.payload.state))
  .filter((fact) => !displacement || Date.parse(fact.causalClosedCandleTime) >= Date.parse(displacement.causalClosedCandleTime))
  .sort((a, b) => Date.parse(a.causalClosedCandleTime) - Date.parse(b.causalClosedCandleTime))[0];

const executionBarMs = (timeframe: string) => ({ "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000,
  "4h": 14_400_000, "1d": 86_400_000, "1w": 604_800_000 }[timeframe]);

const entryFor = (direction: LrsDirection, fvg: FvgFact, displacement: DisplacementFact, parameters: Readonly<LrsParameters>) => {
  if (parameters.entryModel === "IFVG_MIDPOINT") return fvg.payload.midpoint;
  if (parameters.entryModel === "DISPLACEMENT_RETRACE") {
    const distance = displacement.payload.fullRange * parameters.entryRetracementRatio;
    return direction === "long" ? fvg.payload.upperBound - distance : fvg.payload.lowerBound + distance;
  }
  if (parameters.entryModel === "CONFIRMATION_CLOSE") return direction === "long" ? fvg.payload.upperBound : fvg.payload.lowerBound;
  return direction === "long" ? fvg.payload.upperBound : fvg.payload.lowerBound;
};
const stopFor = (direction: LrsDirection, raid: SweepFact, fvg: FvgFact, displacement: DisplacementFact, parameters: Readonly<LrsParameters>) => {
  if (parameters.stopModel === "IFVG_INVALIDATION") return direction === "long" ? fvg.payload.lowerBound : fvg.payload.upperBound;
  if (parameters.stopModel === "DISPLACEMENT_ORIGIN") return direction === "long"
    ? Math.min(fvg.payload.lowerBound, displacement.payload.baselineValue)
    : Math.max(fvg.payload.upperBound, displacement.payload.baselineValue);
  const buffer = parameters.stopModel === "RAID_EXTREME_BUFFER" ? parameters.stopBufferPoints : 0;
  return direction === "long" ? raid.payload.extremePrice - buffer : raid.payload.extremePrice + buffer;
};
const targetFor = (direction: LrsDirection, objective: PoolFact, entry: number, stop: number, parameters: Readonly<LrsParameters>) => {
  if (parameters.targetModel === "STANDARDIZED_R" && parameters.standardizedRR !== null) {
    const risk = Math.abs(entry - stop); return direction === "long" ? entry + risk * parameters.standardizedRR : entry - risk * parameters.standardizedRR;
  }
  return objective.payload.price;
};

const completeSequenceFor = (facts: readonly Readonly<V2MarketFact>[], direction: LrsDirection, parameters: Readonly<LrsParameters>) => {
  const ifvgs = facts.filter((fact): fact is FvgFact => fact.kind === "fair_value_gap" && ifvgTradeDirection(fact) === direction)
    .filter((fact) => ["fresh", "touched", "partially_filled", "inverted"].includes(fact.payload.state))
    .sort((a, b) => Date.parse(b.causalClosedCandleTime) - Date.parse(a.causalClosedCandleTime) || a.factId.localeCompare(b.factId));
  const maximumAgeMs = (executionBarMs(parameters.executionTimeframe) ?? 0) * parameters.maximumSetupAgeBars;
  for (const ifvg of ifvgs) {
    const displacements = facts.filter((fact): fact is DisplacementFact => fact.kind === "displacement" &&
      fact.payload.direction === (direction === "long" ? "bullish" : "bearish") &&
      Date.parse(fact.causalClosedCandleTime) <= Date.parse(ifvg.causalClosedCandleTime))
      .sort((a, b) => Date.parse(b.causalClosedCandleTime) - Date.parse(a.causalClosedCandleTime));
    for (const displacement of displacements) {
      const raids = facts.filter((fact): fact is SweepFact => fact.kind === "liquidity_sweep" &&
        fact.payload.side === (direction === "long" ? "sell_side" : "buy_side") &&
        (fact.payload.confirmationState === "confirmed" || fact.payload.confirmationState === "wick_through") &&
        Date.parse(fact.causalClosedCandleTime) <= Date.parse(displacement.causalClosedCandleTime) &&
        Date.parse(ifvg.causalClosedCandleTime) - Date.parse(fact.causalClosedCandleTime) <= maximumAgeMs)
        .sort((a, b) => Date.parse(b.causalClosedCandleTime) - Date.parse(a.causalClosedCandleTime));
      for (const raid of raids) {
        const objectives = facts.filter((fact): fact is PoolFact => fact.kind === "liquidity_pool" &&
          fact.payload.side === (direction === "long" ? "buy_side" : "sell_side") &&
          (fact.payload.state === "active" || fact.payload.state === "touched") &&
          Date.parse(fact.causalClosedCandleTime) <= Date.parse(raid.causalClosedCandleTime))
          .sort((a, b) => Date.parse(b.payload.confirmedAt) - Date.parse(a.payload.confirmedAt));
        for (const objective of objectives) {
          const entryPrice = entryFor(direction, ifvg, displacement, parameters);
          const stopPrice = stopFor(direction, raid, ifvg, displacement, parameters);
          const targetPrice = targetFor(direction, objective, entryPrice, stopPrice, parameters);
          const ordered = direction === "long" ? stopPrice < entryPrice && entryPrice < targetPrice : targetPrice < entryPrice && entryPrice < stopPrice;
          if (ordered) return { objective, raid, displacement, ifvg, entryPrice, stopPrice, targetPrice };
        }
      }
    }
  }
  return undefined;
};

async function transitionsFor(input: { objective?: PoolFact; raid?: SweepFact; displacement?: DisplacementFact; ifvg?: FvgFact; marketTime: string }) {
  const transitions: Readonly<LrsTransition>[] = []; let state: LrsSetupState = "SEARCHING";
  const move = async (nextState: LrsSetupState, ids: readonly string[]) => { const transition = await buildLrsTransition({ previousState: state, nextState, marketTime: input.marketTime, triggerFactIds: ids, blockers: [] }); transitions.push(transition); state = nextState; };
  if (input.objective) { await move("LIQUIDITY_OBJECTIVE_IDENTIFIED", [input.objective.factId]); await move("WAITING_FOR_RAID", [input.objective.factId]); }
  if (input.objective && input.raid) await move("RAID_CONFIRMED", [input.raid.factId]);
  if (input.objective && input.raid && input.displacement) await move("DISPLACEMENT_CONFIRMED", [input.displacement.factId]);
  if (input.objective && input.raid && input.displacement && input.ifvg) { await move("IFVG_RECLAIMED", [input.ifvg.factId]); await move("WAITING_FOR_ENTRY", [input.ifvg.factId]); await move("ENTRY_ELIGIBLE", [input.ifvg.factId]); }
  return { state: state as LrsSetupState, transitions: Object.freeze(transitions) };
}

export async function detectLiquidityReclaimScalper(request: Readonly<LrsDetectionRequest>): Promise<Readonly<LrsCandidate>> {
  const profile = await buildLrsBaseProfile(); const parameters = request.parameters ?? profile.parameters;
  const asOfMs = Date.parse(request.context.identity.asOfMarketTime);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(Date.parse(request.setupCreatedAt)) || !Number.isFinite(Date.parse(request.expiresAt))) throw new Error("LRS request times are invalid.");
  const facts = request.context.facts.filter((fact) => factAvailable(fact, asOfMs));
  const sourceBlocked = request.context.diagnostics.status === "blocked" || request.context.shadowOnly !== true;
  const datasetVerified = HASH.test(request.datasetCertificateId);
  const attempts = await Promise.all((["long", "short"] as const).map(async (direction) => {
    const complete = completeSequenceFor(facts, direction, parameters);
    const objective = complete?.objective ?? objectiveFor(facts, direction); const raid = complete?.raid ?? raidFor(facts, direction);
    const displacement = complete?.displacement ?? displacementFor(facts, direction, raid);
    const ifvg = complete?.ifvg ?? ifvgFor(facts, direction, displacement);
    const chain = await transitionsFor({ objective, raid, displacement, ifvg: complete?.ifvg, marketTime: request.context.identity.asOfMarketTime });
    return { direction, objective, raid, displacement, ifvg, chain, complete };
  }));
  const selected = attempts.sort((a, b) => Number(Boolean(b.complete)) - Number(Boolean(a.complete)) ||
    b.chain.transitions.length - a.chain.transitions.length || a.direction.localeCompare(b.direction))[0];
  const blockers: LrsBlocker[] = [];
  if (sourceBlocked) blockers.push("source_blocked"); if (!datasetVerified) blockers.push("dataset_unverified");
  if (!selected.objective) blockers.push("external_liquidity_missing"); if (!selected.raid) blockers.push("raid_missing");
  if (!selected.displacement) blockers.push("displacement_missing"); if (!selected.ifvg && parameters.ifvgRequired) blockers.push("ifvg_missing");
  if (selected.objective && selected.raid && selected.displacement && selected.ifvg && !selected.complete) blockers.push("sequence_invalid");
  let entryPrice: number | undefined; let stopPrice: number | undefined; let targetPrice: number | undefined; let theoreticalRR: number | undefined;
  if (selected.complete) {
    entryPrice = selected.complete.entryPrice; stopPrice = selected.complete.stopPrice; targetPrice = selected.complete.targetPrice;
    const ordered = selected.direction === "long" ? stopPrice < entryPrice && entryPrice < targetPrice : targetPrice < entryPrice && entryPrice < stopPrice;
    if (!ordered) blockers.push("geometry_invalid"); else { theoreticalRR = Math.abs(targetPrice - entryPrice) / Math.abs(entryPrice - stopPrice);
      if (parameters.minimumTheoreticalRR !== null && theoreticalRR < parameters.minimumTheoreticalRR) blockers.push("minimum_rr_not_met"); }
  }
  const factIds = unique([selected.objective?.factId, selected.raid?.factId, selected.displacement?.factId, selected.ifvg?.factId].filter((v): v is string => Boolean(v)));
  const identityCore = { strategyId: LRS_STRATEGY_ID, strategyVersion: LRS_STRATEGY_VERSION, direction: selected.direction,
    sourceFingerprint: request.context.identity.source.sourceFingerprint, datasetCertificateId: request.datasetCertificateId,
    contextIdentityHash: request.context.identity.identityHash, triggerCandleId: request.triggerCandleId,
    ...(selected.objective ? { liquidityObjectiveId: selected.objective.factId } : {}),
    ...(selected.raid ? { raidEventId: selected.raid.factId } : {}),
    ...(selected.displacement ? { displacementFactId: selected.displacement.factId } : {}),
    ...(selected.ifvg ? { ifvgId: selected.ifvg.factId } : {}), profileId: LRS_PROFILE_ID,
    parameterHash: profile.parameterHash, ...(entryPrice !== undefined ? { entryPrice } : {}),
    ...(stopPrice !== undefined ? { stopPrice } : {}), ...(targetPrice !== undefined ? { targetPrice } : {}) };
  const achieved = selected.chain.state; const explanation = `${selected.direction === "long" ? "Bullish" : "Bearish"} Liquidity Reclaim Scalper ${achieved === "ENTRY_ELIGIBLE" ? "entry eligible" : "forming"}. ` +
    `${selected.objective ? "External liquidity remains available." : "External liquidity objective is missing."} ` +
    `${selected.raid ? "Opposite-side liquidity was raided." : "Waiting for opposite-side liquidity raid."} ` +
    `${selected.displacement ? "Directional displacement confirmed." : "Waiting for directional displacement."} ` +
    `${selected.ifvg ? "Canonical IFVG reclaim confirmed." : "Waiting for canonical IFVG reclaim."}`;
  const candidate: LrsCandidate = Object.freeze({ schemaVersion: LRS_CANDIDATE_SCHEMA_VERSION, strategyId: LRS_STRATEGY_ID,
    strategyVersion: LRS_STRATEGY_VERSION, candidateId: await canonicalHash(identityCore), direction: selected.direction,
    state: sourceBlocked ? "SOURCE_BLOCKED" : achieved, requestedSymbol: request.context.identity.source.requestedSymbol,
    brokerSymbol: request.context.identity.source.brokerSymbol, contextTimeframe: parameters.contextTimeframe,
    structureTimeframe: parameters.structureTimeframe, executionTimeframe: parameters.executionTimeframe,
    triggerCandleId: request.triggerCandleId, ...(selected.objective ? { liquidityObjectiveId: selected.objective.factId } : {}),
    ...(selected.raid ? { raidEventId: selected.raid.factId } : {}), ...(selected.displacement ? { displacementFactId: selected.displacement.factId } : {}),
    ...(selected.ifvg ? { ifvgId: selected.ifvg.factId } : {}), ...(facts.find((fact): fact is RangeFact => fact.kind === "dealing_range") ? { dealingRangeId: facts.find((fact) => fact.kind === "dealing_range")!.factId } : {}),
    entryModel: parameters.entryModel, ...(entryPrice !== undefined ? { entryPrice } : {}), stopModel: parameters.stopModel,
    ...(stopPrice !== undefined ? { stopPrice } : {}), targetModel: parameters.targetModel, ...(targetPrice !== undefined ? { targetPrice } : {}),
    ...(theoreticalRR !== undefined ? { theoreticalRR } : {}), setupCreatedAt: request.setupCreatedAt,
    ...(achieved === "ENTRY_ELIGIBLE" ? { entryEligibleAt: request.context.identity.asOfMarketTime } : {}), expiresAt: request.expiresAt,
    supportingFactIds: factIds, blockers: unique(blockers), transitions: selected.chain.transitions, explanation,
    profileId: LRS_PROFILE_ID, profileVersion: "v1", parameterHash: profile.parameterHash,
    sourceFingerprint: request.context.identity.source.sourceFingerprint, datasetCertificateId: request.datasetCertificateId,
    authority: SIMULATION_AUTHORITY_NONE, capabilities: SIMULATION_CAPABILITIES_DISABLED });
  return candidate;
}
