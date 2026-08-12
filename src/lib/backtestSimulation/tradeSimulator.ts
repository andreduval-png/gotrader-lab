import { buildTradeSimulationRecord, validateCanonicalOpportunity } from "./simulationContracts";
import type {
  CanonicalOpportunity,
  SimulationCandle,
  SimulationCostModel,
  SimulationIntrabarPolicy,
  SimulationTransition,
  TradeSimulationRecord
} from "./simulationTypes";

export interface SimulateTradeInput {
  readonly opportunity: Readonly<CanonicalOpportunity>;
  readonly candles: readonly Readonly<SimulationCandle>[];
  readonly intrabarPolicy: SimulationIntrabarPolicy;
  readonly costModel: Readonly<SimulationCostModel>;
  readonly lowerTimeframeCandles?: readonly Readonly<SimulationCandle>[];
}

const finiteCandle = (candle: Readonly<SimulationCandle>) =>
  [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) &&
  candle.high >= Math.max(candle.open, candle.close, candle.low) &&
  candle.low <= Math.min(candle.open, candle.close, candle.high) &&
  Number.isFinite(Date.parse(candle.openTimeUtc)) &&
  Number.isFinite(Date.parse(candle.closeTimeUtc)) &&
  Date.parse(candle.closeTimeUtc) > Date.parse(candle.openTimeUtc);

const orderedCandles = (candles: readonly Readonly<SimulationCandle>[]) =>
  [...candles].sort((left, right) => left.openTimeUtc.localeCompare(right.openTimeUtc));

const triggerFill = (
  opportunity: Readonly<CanonicalOpportunity>,
  candle: Readonly<SimulationCandle>
) => {
  if (opportunity.orderPolicy === "market_at_next_open") return candle.open;
  if (opportunity.direction === "long") {
    if (opportunity.orderPolicy === "limit_at_price" && candle.low <= opportunity.entryPrice) {
      return candle.open < opportunity.entryPrice ? candle.open : opportunity.entryPrice;
    }
    if (opportunity.orderPolicy === "stop_at_price" && candle.high >= opportunity.entryPrice) {
      return candle.open > opportunity.entryPrice ? candle.open : opportunity.entryPrice;
    }
  } else {
    if (opportunity.orderPolicy === "limit_at_price" && candle.high >= opportunity.entryPrice) {
      return candle.open > opportunity.entryPrice ? candle.open : opportunity.entryPrice;
    }
    if (opportunity.orderPolicy === "stop_at_price" && candle.low <= opportunity.entryPrice) {
      return candle.open < opportunity.entryPrice ? candle.open : opportunity.entryPrice;
    }
  }
  return undefined;
};

const touched = (
  opportunity: Readonly<CanonicalOpportunity>,
  candle: Readonly<SimulationCandle>
) => ({
  stop: opportunity.direction === "long"
    ? candle.low <= opportunity.stopPrice
    : candle.high >= opportunity.stopPrice,
  target: opportunity.direction === "long"
    ? candle.high >= opportunity.targetPrices[0]
    : candle.low <= opportunity.targetPrices[0]
});

const gapExitPrice = (
  opportunity: Readonly<CanonicalOpportunity>,
  candle: Readonly<SimulationCandle>,
  reason: "stop" | "target"
) => {
  const level = reason === "stop" ? opportunity.stopPrice : opportunity.targetPrices[0];
  if (opportunity.direction === "long") {
    if (reason === "stop" && candle.open < level) return candle.open;
    if (reason === "target" && candle.open > level) return candle.open;
  } else {
    if (reason === "stop" && candle.open > level) return candle.open;
    if (reason === "target" && candle.open < level) return candle.open;
  }
  return level;
};

const lowerTimeframeResolution = (
  opportunity: Readonly<CanonicalOpportunity>,
  parent: Readonly<SimulationCandle>,
  children: readonly Readonly<SimulationCandle>[]
) => {
  const covered = orderedCandles(children).filter((child) =>
    child.openTimeUtc >= parent.openTimeUtc && child.closeTimeUtc <= parent.closeTimeUtc
  );
  for (const child of covered) {
    const events = touched(opportunity, child);
    if (events.stop && events.target) return undefined;
    if (events.stop) return { reason: "stop" as const, price: gapExitPrice(opportunity, child, "stop") };
    if (events.target) return { reason: "target" as const, price: gapExitPrice(opportunity, child, "target") };
  }
  return null;
};

export async function simulateTrade(input: Readonly<SimulateTradeInput>): Promise<Readonly<TradeSimulationRecord>> {
  const { opportunity, intrabarPolicy, costModel } = input;
  const blockers = await validateCanonicalOpportunity(opportunity);
  if (!/^sha256:[0-9a-f]{64}$/.test(costModel.modelId)) blockers.push("bt2_cost_model_id_invalid");
  const candles = orderedCandles(input.candles);
  if (candles.some((candle) => !finiteCandle(candle))) blockers.push("bt2_simulation_candle_invalid");
  if (candles.some((candle, index) => index > 0 && candle.openTimeUtc < candles[index - 1].closeTimeUtc)) {
    blockers.push("bt2_simulation_candle_overlap");
  }
  const transitions: SimulationTransition[] = [{
    ordinal: 0,
    state: "received",
    atUtc: opportunity.decisionAtUtc,
    reason: "opportunity_received"
  }];
  const push = (state: SimulationTransition["state"], atUtc: string, reason: string, candle?: Readonly<SimulationCandle>, price?: number) =>
    transitions.push(Object.freeze({
      ordinal: transitions.length,
      state,
      atUtc,
      reason,
      ...(candle ? { candleOpenTimeUtc: candle.openTimeUtc } : {}),
      ...(price === undefined ? {} : { price })
    }));

  if (blockers.length || !opportunity.eligible) {
    push("blocked", opportunity.decisionAtUtc, "validation_blocked");
    return buildTradeSimulationRecord({
      opportunityId: opportunity.opportunityId,
      datasetCertificateId: opportunity.datasetCertificateId,
      datasetId: opportunity.datasetId,
      intrabarPolicy,
      costModelId: costModel.modelId,
      terminalState: "blocked",
      exitReason: "validation_blocked",
      transitions,
      blockers: [...blockers, ...opportunity.blockers]
    });
  }

  push("activation_pending", opportunity.decisionAtUtc, "awaiting_activation");
  let fillPrice: number | undefined;
  let fillIndex = -1;
  for (const [index, candle] of candles.entries()) {
    if (candle.openTimeUtc < opportunity.activatesAtUtc) continue;
    if (candle.openTimeUtc >= opportunity.expiresAtUtc) break;
    if (transitions.at(-1)?.state !== "active_order") {
      push("active_order", opportunity.activatesAtUtc, "order_activated");
    }
    fillPrice = triggerFill(opportunity, candle);
    if (fillPrice !== undefined) {
      fillIndex = index;
      push("filled", candle.openTimeUtc, "entry_filled", candle, fillPrice);
      push("open", candle.openTimeUtc, "position_open", candle, fillPrice);
      break;
    }
  }
  if (fillPrice === undefined) {
    const terminalAt = candles.at(-1)?.closeTimeUtc ?? opportunity.expiresAtUtc;
    const enoughData = candles.some((candle) => candle.closeTimeUtc >= opportunity.expiresAtUtc);
    const state = enoughData ? "expired_unfilled" : "insufficient_data";
    push(state, terminalAt, enoughData ? "order_expired_unfilled" : "future_data_unavailable");
    return buildTradeSimulationRecord({
      opportunityId: opportunity.opportunityId,
      datasetCertificateId: opportunity.datasetCertificateId,
      datasetId: opportunity.datasetId,
      intrabarPolicy,
      costModelId: costModel.modelId,
      terminalState: state,
      exitReason: transitions.at(-1)!.reason,
      transitions,
      blockers: []
    });
  }

  const risk = Math.abs(fillPrice - opportunity.stopPrice);
  if (!(risk > 0)) blockers.push("bt2_simulation_fill_risk_invalid");
  let favorable = 0;
  let adverse = 0;
  let exitPrice: number | undefined;
  let exitReason = "future_data_unavailable";
  let terminalState: TradeSimulationRecord["terminalState"] = "insufficient_data";
  for (let index = fillIndex; index < candles.length; index += 1) {
    const candle = candles[index];
    favorable = Math.max(favorable, opportunity.direction === "long" ? candle.high - fillPrice : fillPrice - candle.low);
    adverse = Math.max(adverse, opportunity.direction === "long" ? fillPrice - candle.low : candle.high - fillPrice);
    const events = touched(opportunity, candle);
    const fillCandle = index === fillIndex;
    if (!events.stop && !events.target) continue;
    if (fillCandle && events.target && !events.stop) {
      if (intrabarPolicy === "ambiguous_no_result_v1") {
        terminalState = "ambiguous";
        exitReason = "entry_target_order_ambiguous";
        push("ambiguous", candle.closeTimeUtc, exitReason, candle);
        break;
      }
      if (intrabarPolicy !== "lower_timeframe_resolution_v1") continue;
      const resolution = lowerTimeframeResolution(opportunity, candle, input.lowerTimeframeCandles ?? []);
      if (!resolution) {
        terminalState = "ambiguous";
        exitReason = "lower_timeframe_resolution_unavailable";
        push("ambiguous", candle.closeTimeUtc, exitReason, candle);
        break;
      }
      exitReason = resolution.reason;
      exitPrice = resolution.price;
      terminalState = "exited";
      push("exited", candle.closeTimeUtc, exitReason, candle, exitPrice);
      break;
    }
    if (events.stop && events.target) {
      if (intrabarPolicy === "ambiguous_no_result_v1") {
        terminalState = "ambiguous";
        exitReason = "stop_target_order_ambiguous";
        push("ambiguous", candle.closeTimeUtc, exitReason, candle);
        break;
      }
      if (intrabarPolicy === "lower_timeframe_resolution_v1") {
        const resolution = lowerTimeframeResolution(opportunity, candle, input.lowerTimeframeCandles ?? []);
        if (!resolution) {
          terminalState = "ambiguous";
          exitReason = "lower_timeframe_resolution_unavailable";
          push("ambiguous", candle.closeTimeUtc, exitReason, candle);
          break;
        }
        exitReason = resolution.reason;
        exitPrice = resolution.price;
      } else {
        exitReason = "stop";
        exitPrice = gapExitPrice(opportunity, candle, "stop");
      }
    } else {
      const singleReason: "stop" | "target" = events.stop ? "stop" : "target";
      exitReason = singleReason;
      exitPrice = gapExitPrice(opportunity, candle, singleReason);
    }
    terminalState = "exited";
    push("exited", candle.closeTimeUtc, exitReason, candle, exitPrice);
    break;
  }

  if (blockers.length) {
    terminalState = "blocked";
    exitReason = "simulation_blocked";
    push("blocked", candles.at(-1)?.closeTimeUtc ?? opportunity.expiresAtUtc, exitReason);
  }
  const grossR = exitPrice === undefined || !(risk > 0)
    ? undefined
    : (opportunity.direction === "long" ? exitPrice - fillPrice : fillPrice - exitPrice) / risk;
  const fillCandle = candles[fillIndex];
  const spreadPoints = costModel.spreadMode === "none"
    ? 0
    : costModel.spreadMode === "static"
      ? costModel.staticSpreadPoints!
      : fillCandle.spreadPoints;
  if (spreadPoints === undefined && terminalState === "exited") blockers.push("bt2_cost_spread_missing");
  if (blockers.length && transitions.at(-1)?.state !== "blocked") {
    terminalState = "blocked";
    exitReason = "simulation_blocked";
    push("blocked", candles.at(-1)?.closeTimeUtc ?? opportunity.expiresAtUtc, exitReason);
  }
  const frictionPrice = ((spreadPoints ?? 0) + costModel.slippagePoints * 2) * costModel.pointSize;
  const costR = risk > 0 ? frictionPrice / risk + costModel.commissionR + costModel.swapR : undefined;
  return buildTradeSimulationRecord({
    opportunityId: opportunity.opportunityId,
    datasetCertificateId: opportunity.datasetCertificateId,
    datasetId: opportunity.datasetId,
    intrabarPolicy,
    costModelId: costModel.modelId,
    terminalState: blockers.length ? "blocked" : terminalState,
    exitReason: blockers.length ? "simulation_blocked" : exitReason,
    ...(fillPrice === undefined ? {} : { fillPrice }),
    ...(exitPrice === undefined ? {} : { exitPrice }),
    ...(grossR === undefined ? {} : { grossR }),
    ...(costR === undefined ? {} : { costR }),
    ...(costR === undefined || grossR === undefined ? {} : { netR: grossR - costR }),
    ...(risk > 0 ? {
      maePrice: adverse,
      mfePrice: favorable,
      maePoints: adverse / costModel.pointSize,
      mfePoints: favorable / costModel.pointSize,
      maeR: adverse / risk,
      mfeR: favorable / risk
    } : {}),
    transitions,
    blockers
  });
}
