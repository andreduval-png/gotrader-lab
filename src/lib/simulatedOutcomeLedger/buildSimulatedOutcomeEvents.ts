import type { BacktestResult, SimulatedTradeRecord } from "@/lib/backtesting";
import type { IctPaperSignal } from "@/lib/ict-strategy-suite/ictPaperSignalSimulatorTypes";
import type { ResearchCycleRun } from "@/lib/researchCycle";
import type { SimulatedTradePlan } from "@/lib/types";
import type { ValidationProvenanceIdentity } from "@/lib/validationProvenance";
import { createSimulatedOutcomeEvent } from "./simulatedOutcomeIntegrity";
import {
  simulatedOutcomeAuthorityNone,
  simulatedOutcomeSafety,
  type SimulatedOutcomeEvent,
  type SimulatedOutcomeEventPayload,
  type SimulatedOutcomeIdentity,
  type SimulatedOutcomeStatus,
  type SimulatedOutcomeTargetProvenance
} from "./simulatedOutcomeLedgerTypes";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const midpoint = (zone?: [number, number]) => zone && finite(zone[0]) && finite(zone[1])
  ? Number(((zone[0] + zone[1]) / 2).toFixed(6))
  : undefined;

const horizonFor = (timeframe: string) => {
  const normalized = timeframe.trim().toLowerCase();
  if (["1m", "m1", "3m", "m3", "5m", "m5"].includes(normalized)) return "scalp" as const;
  if (["15m", "m15", "30m", "m30", "1h", "h1", "4h", "h4"].includes(normalized)) return "intraday" as const;
  if (["1d", "d1", "1w", "w1", "1mo", "mn1"].includes(normalized)) return "swing" as const;
  return "unclassified" as const;
};

const identityFrom = ({
  cycleId,
  tradeId,
  provenance,
  fallback
}: {
  cycleId: string;
  tradeId: string;
  provenance?: ValidationProvenanceIdentity;
  fallback: {
    sourceFingerprint?: string;
    strategyProfile?: string;
    requestedSymbol?: string;
    brokerSymbol?: string;
    timeframe?: string;
    sourceProvider?: string;
    parameterFingerprint?: string;
  };
}): SimulatedOutcomeIdentity => ({
  cycleId,
  tradeId,
  sourceFingerprint: provenance?.sourceFingerprint ?? fallback.sourceFingerprint ?? "",
  strategyProfile: provenance?.strategyProfile ?? fallback.strategyProfile ?? "",
  strategyProfileVersion: provenance?.strategyProfileVersion,
  parameterFingerprint: provenance?.parameterFingerprint ?? fallback.parameterFingerprint ?? "",
  requestedSymbol: provenance?.requestedSymbol ?? fallback.requestedSymbol ?? "",
  brokerSymbol: provenance?.brokerSymbol ?? fallback.brokerSymbol,
  timeframe: provenance?.timeframe ?? fallback.timeframe ?? "",
  sourceProvider: provenance?.sourceProvider ?? fallback.sourceProvider
});

const outcomeKeyFor = (identity: SimulatedOutcomeIdentity, sourceKind: string) =>
  [identity.cycleId, sourceKind, identity.tradeId].join(":");

const basePayload = (
  identity: SimulatedOutcomeIdentity,
  sourceKind: SimulatedOutcomeEventPayload["sourceKind"],
  status: SimulatedOutcomeStatus,
  recordedAt: string
) => ({
  schemaVersion: 1 as const,
  outcomeKey: outcomeKeyFor(identity, sourceKind),
  sourceKind,
  status,
  recordedAt,
  identity,
  researchOnly: true as const,
  authority: simulatedOutcomeAuthorityNone,
  safety: simulatedOutcomeSafety
});

const backtestStatus = (trade: SimulatedTradeRecord): SimulatedOutcomeStatus => {
  if (trade.outcome === "target_hit") return "target_hit";
  if (trade.outcome === "stop_hit") return "stop_hit";
  return "expired";
};

const realizedPoints = (trade: SimulatedTradeRecord) => {
  const direction = trade.bias === "bearish" ? -1 : 1;
  if (trade.targetHit) return Number(((trade.target - trade.entryPrice) * direction).toFixed(6));
  if (trade.stopHit) return Number(((trade.invalidation - trade.entryPrice) * direction).toFixed(6));
  return undefined;
};

const backtestTargetProvenance = (trade: SimulatedTradeRecord): SimulatedOutcomeTargetProvenance => ({
  type: "backtest_trade_plan",
  sourceTimeframe: trade.timeframe,
  selectionReason: trade.reason || "Target persisted from the canonical simulated trade plan.",
  distancePoints: finite(trade.entryPrice) && finite(trade.target)
    ? Number(Math.abs(trade.target - trade.entryPrice).toFixed(6))
    : undefined,
  rr: finite(trade.riskReward) ? trade.riskReward : undefined,
  minimumRR: undefined,
  gateStatus: "accepted",
  rejectionReasons: []
});

export const buildBacktestOutcomeEvents = async ({
  cycle,
  result,
  recordedAt = cycle.completedAt ?? new Date().toISOString()
}: {
  cycle: ResearchCycleRun;
  result: BacktestResult;
  recordedAt?: string;
}) => {
  const provenance = cycle.validationSummary?.provenance ?? cycle.validationReport?.provenance;
  const events: SimulatedOutcomeEvent[] = [];
  for (const trade of result.trades) {
    if (trade.outcome === "neutral") continue;
    const identity = identityFrom({
      cycleId: cycle.cycleId,
      tradeId: trade.id,
      provenance,
      fallback: {
        sourceFingerprint: cycle.validationEvidenceSourceFingerprint ?? cycle.sourceMetadata?.activeSourceFingerprint,
        strategyProfile: result.config.strategyProfile,
        requestedSymbol: trade.symbol,
        timeframe: trade.timeframe,
        sourceProvider: cycle.dataSourceMode
      }
    });
    events.push(await createSimulatedOutcomeEvent({
      ...basePayload(identity, "backtest", backtestStatus(trade), recordedAt),
      openedAt: trade.openedAt,
      resolvedAt: trade.resolvedAt,
      plan: {
        side: trade.bias === "bullish" ? "long" : trade.bias === "bearish" ? "short" : "flat",
        tradeModel: result.config.strategyProfile,
        tradeHorizon: horizonFor(trade.timeframe),
        session: trade.session,
        entryZone: trade.entryZone,
        entryPrice: trade.entryPrice,
        stopLoss: trade.invalidation,
        takeProfit: trade.target,
        targetProvenance: backtestTargetProvenance(trade)
      },
      result: {
        rMultiple: trade.rMultiple,
        maxFavorableExcursion: trade.maxFavorableExcursion,
        maxAdverseExcursion: trade.maxAdverseExcursion,
        points: realizedPoints(trade),
        targetHit: trade.targetHit,
        stopHit: trade.stopHit,
        reason: trade.reason
      }
    }));
  }
  return events;
};

const currentPlanTargetProvenance = (
  cycle: ResearchCycleRun,
  plan: SimulatedTradePlan
): SimulatedOutcomeTargetProvenance => cycle.ictAdvisorSignalSummary?.targetProvenance ?? ({
  type: "thesis_target_liquidity",
  sourceTimeframe: plan.timeframe,
  selectionReason: "Target persisted from the current cycle simulated trade plan.",
  distancePoints: Number(Math.abs(plan.targetLiquidity - midpoint(plan.entryZone)!).toFixed(6)),
  rr: plan.riskReward,
  minimumRR: undefined,
  gateStatus: finite(plan.targetLiquidity) ? "accepted" : "unavailable",
  rejectionReasons: finite(plan.targetLiquidity) ? [] : ["Target was unavailable."]
});

export const buildCurrentCyclePlanEvent = async ({
  cycle,
  plan,
  recordedAt = cycle.completedAt ?? new Date().toISOString()
}: {
  cycle: ResearchCycleRun;
  plan: SimulatedTradePlan;
  recordedAt?: string;
}) => {
  const provenance = cycle.validationSummary?.provenance ?? cycle.validationReport?.provenance;
  const identity = identityFrom({
    cycleId: cycle.cycleId,
    tradeId: plan.id,
    provenance,
    fallback: {
      sourceFingerprint: cycle.sourceMetadata?.activeSourceFingerprint,
      strategyProfile: cycle.backtestSummary?.config ? String(cycle.validationSummary?.provenance?.strategyProfile ?? "") : undefined,
      requestedSymbol: plan.symbol,
      timeframe: plan.timeframe,
      sourceProvider: cycle.dataSourceMode
    }
  });
  const targetProvenance = currentPlanTargetProvenance(cycle, plan);
  const directional = plan.bias === "bullish" || plan.bias === "bearish";
  const geometryAvailable = finite(midpoint(plan.entryZone)) && finite(plan.invalidation) && finite(plan.targetLiquidity);
  const rejectedByAdvisor = /reject|no[_ ]trade|flat/i.test(cycle.ictAdvisorSignalSummary?.decision ?? "");
  const status: SimulatedOutcomeStatus = directional && geometryAvailable && !rejectedByAdvisor && targetProvenance.gateStatus === "accepted"
    ? "pending"
    : "rejected";
  return createSimulatedOutcomeEvent({
    ...basePayload(identity, "current_cycle", status, recordedAt),
    openedAt: status === "pending" ? recordedAt : undefined,
    resolvedAt: status === "rejected" ? recordedAt : undefined,
    plan: {
      side: plan.bias === "bullish" ? "long" : plan.bias === "bearish" ? "short" : "flat",
      tradeModel: cycle.ictAdvisorSignalSummary?.setup,
      tradeHorizon: horizonFor(plan.timeframe),
      entryZone: plan.entryZone,
      entryPrice: midpoint(plan.entryZone),
      stopLoss: plan.invalidation,
      takeProfit: plan.targetLiquidity,
      targetProvenance
    },
    result: status === "rejected"
      ? {
          reason: cycle.ictAdvisorSignalSummary?.noTradeReasons.join("; ") || cycle.blockers?.join("; ") || "Current-cycle plan did not pass its evidence gates."
        }
      : undefined
  });
};

export const buildPaperOutcomeEvent = async ({
  paperSignal,
  identity,
  previousEvent,
  recordedAt
}: {
  paperSignal: IctPaperSignal;
  identity: Omit<SimulatedOutcomeIdentity, "tradeId">;
  previousEvent?: SimulatedOutcomeEvent;
  recordedAt?: string;
}) => {
  const boundIdentity: SimulatedOutcomeIdentity = { ...identity, tradeId: paperSignal.paperSignalId };
  const status: SimulatedOutcomeStatus = paperSignal.outcome === "target_hit"
    ? "target_hit"
    : paperSignal.outcome === "invalidation_hit"
      ? "stop_hit"
      : paperSignal.outcome === "expired"
        ? "expired"
        : paperSignal.outcome === "cancelled" || paperSignal.outcome === "not_started"
          ? "rejected"
          : "pending";
  const eventRecordedAt = recordedAt ?? paperSignal.lifecycle.at(-1)?.at ?? paperSignal.generatedAt;
  const resolvedAt = status === "pending" ? undefined : paperSignal.lifecycle.at(-1)?.at ?? eventRecordedAt;
  return createSimulatedOutcomeEvent({
    ...basePayload(boundIdentity, "paper", status, eventRecordedAt),
    openedAt: paperSignal.generatedAt,
    resolvedAt,
    previousEventHash: previousEvent?.evidenceHash,
    plan: {
      side: paperSignal.side,
      tradeHorizon: horizonFor(paperSignal.primaryTimeframe),
      entryPrice: paperSignal.simulatedEntry.price,
      stopLoss: paperSignal.invalidation,
      takeProfit: paperSignal.target,
      targetProvenance: {
        type: "paper_signal_target",
        sourceTimeframe: paperSignal.primaryTimeframe,
        selectionReason: "Target persisted from the identity-bound research signal used to create the paper simulation.",
        distancePoints: Number(Math.abs(paperSignal.target - paperSignal.simulatedEntry.price).toFixed(6)),
        rr: paperSignal.rrEstimate,
        minimumRR: undefined,
        gateStatus: paperSignal.status === "not_eligible" ? "rejected" : "accepted",
        rejectionReasons: paperSignal.status === "not_eligible" ? paperSignal.notes : []
      }
    },
    result: status === "pending" ? undefined : {
      rMultiple: status === "target_hit" ? paperSignal.rrEstimate : status === "stop_hit" ? -1 : 0,
      points: status === "target_hit"
        ? Math.abs(paperSignal.target - paperSignal.simulatedEntry.price)
        : status === "stop_hit"
          ? -Math.abs(paperSignal.invalidation - paperSignal.simulatedEntry.price)
          : 0,
      targetHit: status === "target_hit",
      stopHit: status === "stop_hit",
      reason: paperSignal.lifecycle.at(-1)?.note ?? paperSignal.notes.join("; ")
    }
  });
};
