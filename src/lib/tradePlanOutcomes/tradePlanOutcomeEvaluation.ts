import type { ResearchCycleRun } from "@/lib/researchCycle/researchCycleTypes";
import type { Candle } from "@/lib/types";
import {
  TRADE_PLAN_OUTCOME_AUTHORITY,
  TRADE_PLAN_OUTCOME_SAFETY,
  type SavedResearchTradePlan,
  type TradePlanCycleResultRecord,
  type TradePlanHorizon,
  type TradePlanIdentity,
  type TradePlanObservedOutcome
} from "./tradePlanOutcomeTypes";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const rounded = (value: number) => Number(value.toFixed(5));
const safeText = (value: unknown, fallback: string) => String(value ?? "").trim() || fallback;
const uniqueText = (values: Array<string | undefined>, limit = 12) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].slice(0, limit);

const timeframeMinutes = (timeframe: string) => {
  const normalized = timeframe.trim().toLowerCase();
  const match = normalized.match(/^(\d+)(m|h|d)$/);
  if (!match) return 5;
  const value = Number(match[1]);
  return match[2] === "d" ? value * 1_440 : match[2] === "h" ? value * 60 : value;
};

const horizonDurationMs = (horizon: TradePlanHorizon) => {
  if (horizon === "scalp") return 6 * 60 * 60 * 1_000;
  if (horizon === "intraday") return 24 * 60 * 60 * 1_000;
  return 28 * 24 * 60 * 60 * 1_000;
};

export function classifyTradePlanHorizon(input: {
  timeframe?: string;
  scalpStatus?: string;
  setup?: string;
}): { horizon: TradePlanHorizon; reason: string } {
  const scalpStatus = safeText(input.scalpStatus, "").toLowerCase();
  const setup = safeText(input.setup, "").toLowerCase();
  if (/scalp_candidate|scalp_watchlist|scalp_rejected/.test(scalpStatus) || /scalp/.test(setup)) {
    return { horizon: "scalp", reason: `Advisor scalp classification: ${scalpStatus || setup}.` };
  }
  const minutes = timeframeMinutes(input.timeframe ?? "");
  if (minutes <= 30) {
    return { horizon: "intraday", reason: `${input.timeframe ?? "Lower timeframe"} plan evaluated as intraday.` };
  }
  if (minutes >= 60) {
    return { horizon: "swing", reason: `${input.timeframe ?? "Higher timeframe"} plan evaluated as swing.` };
  }
  return { horizon: "unspecified", reason: "No explicit trade horizon was available." };
}

const identityFor = (run: ResearchCycleRun, candles: Candle[]): TradePlanIdentity => {
  const provenance = run.validationSummary?.provenance ?? run.validationReport?.provenance;
  const requestedSymbol = provenance?.requestedSymbol ?? run.thesisSummary?.symbol ?? "unknown";
  const brokerSymbol = provenance?.brokerSymbol;
  const candleSymbol = candles[0]?.symbol ?? brokerSymbol ?? requestedSymbol;
  const timeframe = provenance?.timeframe ?? run.researchTimeframe ?? candles[0]?.timeframe ?? "unknown";
  const sourceProvider = provenance?.sourceProvider ?? run.dataSourceMode ?? "unknown";
  const sourceFingerprint = provenance?.sourceFingerprint
    ?? run.validationEvidenceSourceFingerprint
    ?? run.sourceMetadata?.activeSourceFingerprint
    ?? run.automatedEvidenceSummary?.sourceFingerprint
    ?? "missing";
  const lineageKey = [sourceProvider, requestedSymbol, brokerSymbol ?? "none", candleSymbol, timeframe]
    .map((value) => String(value).trim().toLowerCase())
    .join("|");
  return { lineageKey, sourceFingerprint, sourceProvider, requestedSymbol, brokerSymbol, candleSymbol, timeframe };
};

const planFor = (run: ResearchCycleRun, identity: TradePlanIdentity): SavedResearchTradePlan | undefined => {
  const signal = run.ictAdvisorSignalSummary;
  if (!signal) return undefined;
  const entryPrice = signal.entryZoneMidpoint;
  const stopLoss = signal.invalidation;
  const takeProfit = signal.target;
  const directional = signal.side === "long" || signal.side === "short";
  const geometry = directional && finite(entryPrice) && finite(stopLoss) && finite(takeProfit)
    ? { entryPrice, stopLoss, takeProfit }
    : undefined;
  const complete = Boolean(geometry);
  const coherent = geometry
    ? signal.side === "long"
      ? geometry.stopLoss < geometry.entryPrice && geometry.entryPrice < geometry.takeProfit
      : geometry.takeProfit < geometry.entryPrice && geometry.entryPrice < geometry.stopLoss
    : false;
  const calculatedRiskReward = coherent && geometry
    ? rounded(Math.abs(geometry.takeProfit - geometry.entryPrice) / Math.abs(geometry.entryPrice - geometry.stopLoss))
    : undefined;
  const statedRiskReward = finite(signal.rrEstimate) ? signal.rrEstimate : undefined;
  const riskRewardCoherent = !coherent || !finite(statedRiskReward) || !finite(calculatedRiskReward)
    ? coherent
    : Math.abs(calculatedRiskReward - statedRiskReward) <= Math.max(0.15, statedRiskReward * 0.1);
  const evaluable = signal.decision === "research_only" && coherent && riskRewardCoherent;
  const evaluationReason = signal.decision !== "research_only"
    ? "Advisor decision was no_trade; levels are retained but not scored as a trade idea."
    : !complete
      ? "Directional entry, stop, and target were not all available."
      : !coherent
        ? "Direction conflicts with entry, stop, and target geometry."
        : !riskRewardCoherent
          ? "Stated risk/reward conflicts with the saved price geometry."
          : "Complete research-only plan is eligible for closed-candle observation.";
  const horizon = classifyTradePlanHorizon({
    timeframe: identity.timeframe,
    scalpStatus: signal.scalpStatus,
    setup: signal.setup
  });
  const generatedAt = signal.generatedAt || run.completedAt || run.startedAt;
  return {
    planId: `trade_plan_${run.cycleId}`,
    generatedAt,
    expiresAt: new Date(Date.parse(generatedAt) + horizonDurationMs(horizon.horizon)).toISOString(),
    strategyId: safeText(signal.strategyId, "unclassified_strategy"),
    tradeModel: safeText(signal.setup, "unclassified_setup"),
    side: signal.side === "long" || signal.side === "short" ? signal.side : "flat",
    signal: evaluable ? (signal.side === "long" ? "BUY" : "SELL") : "NO_TRADE",
    decision: signal.decision,
    confidence: finite(signal.confidence) ? signal.confidence : 0,
    horizon: horizon.horizon,
    horizonReason: horizon.reason,
    entryPrice,
    stopLoss,
    takeProfit,
    statedRiskReward,
    calculatedRiskReward,
    plannedTargetPoints: coherent && geometry ? rounded(Math.abs(geometry.takeProfit - geometry.entryPrice)) : undefined,
    plannedStopPoints: coherent && geometry ? rounded(Math.abs(geometry.entryPrice - geometry.stopLoss)) : undefined,
    coherent,
    evaluable,
    evaluationReason
  };
};

const initialOutcomeFor = (plan?: SavedResearchTradePlan): TradePlanObservedOutcome => ({
  status: plan?.evaluable ? "pending_entry" : "not_evaluable",
  observationRevision: 0,
  barsObserved: 0,
  resultReason: plan?.evaluable
    ? "Waiting for a later closed candle to reach the saved entry price."
    : plan?.evaluationReason ?? "No research trade plan was produced for this cycle."
});

export function buildTradePlanCycleResult(run: ResearchCycleRun, candles: Candle[]): TradePlanCycleResultRecord {
  const identity = identityFor(run, candles);
  const plan = planFor(run, identity);
  return {
    schemaVersion: 1,
    cycleId: run.cycleId,
    startedAt: run.startedAt,
    completedAt: run.completedAt ?? new Date().toISOString(),
    cycleStatus: run.status,
    identity,
    plan,
    outcome: initialOutcomeFor(plan),
    cycleResult: {
      summary: run.resultSummary,
      readinessState: run.readinessSnapshot?.state ?? "Not Ready",
      blockers: uniqueText([...(run.blockers ?? []), ...(run.promotionBlockers ?? [])])
    },
    researchOnly: true,
    authority: TRADE_PLAN_OUTCOME_AUTHORITY,
    safety: TRADE_PLAN_OUTCOME_SAFETY
  };
}

const closedBefore = (candle: Candle, observedAtMs: number) =>
  Date.parse(candle.timestamp) + timeframeMinutes(candle.timeframe) * 60_000 <= observedAtMs;

const observationMatches = (record: TradePlanCycleResultRecord, candles: Candle[]) => {
  const first = candles[0];
  return Boolean(first && first.symbol === record.identity.candleSymbol && first.timeframe === record.identity.timeframe);
};

export function evaluateTradePlanOutcome(
  record: TradePlanCycleResultRecord,
  candles: Candle[],
  observedAt = new Date().toISOString()
): TradePlanCycleResultRecord {
  const plan = record.plan;
  if (!plan?.evaluable || !finite(plan.entryPrice) || !finite(plan.stopLoss) || !finite(plan.takeProfit)) return record;
  if (!observationMatches(record, candles)) return record;
  if (["passed_target_first", "failed_stop_first", "ambiguous_stop_first", "not_triggered", "expired_open"].includes(record.outcome.status)) {
    return record;
  }

  const observedAtMs = Date.parse(observedAt);
  const generatedAtMs = Date.parse(plan.generatedAt);
  const expiresAtMs = Date.parse(plan.expiresAt);
  const relevant = candles
    .filter((candle) => {
      const timestamp = Date.parse(candle.timestamp);
      return timestamp > generatedAtMs && timestamp <= expiresAtMs && closedBefore(candle, observedAtMs);
    })
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  let entryReachedAt: string | undefined;
  let maximumFavorableExcursionPoints = 0;
  let maximumAdverseExcursionPoints = 0;
  let lastClose: number | undefined;
  let lastTimestamp: string | undefined;
  const long = plan.side === "long";
  const riskPoints = Math.abs(plan.entryPrice - plan.stopLoss);

  for (const candle of relevant) {
    if (!entryReachedAt) {
      if (candle.low <= plan.entryPrice && candle.high >= plan.entryPrice) entryReachedAt = candle.timestamp;
      else continue;
    }
    const favorable = long ? candle.high - plan.entryPrice : plan.entryPrice - candle.low;
    const adverse = long ? plan.entryPrice - candle.low : candle.high - plan.entryPrice;
    maximumFavorableExcursionPoints = Math.max(maximumFavorableExcursionPoints, favorable);
    maximumAdverseExcursionPoints = Math.max(maximumAdverseExcursionPoints, adverse);
    lastClose = candle.close;
    lastTimestamp = candle.timestamp;
    const stopTouched = long ? candle.low <= plan.stopLoss : candle.high >= plan.stopLoss;
    const targetTouched = long ? candle.high >= plan.takeProfit : candle.low <= plan.takeProfit;
    if (stopTouched && targetTouched) {
      return {
        ...record,
        outcome: {
          status: "ambiguous_stop_first",
          observationRevision: record.outcome.observationRevision + 1,
          observedThrough: candle.timestamp,
          entryReachedAt,
          resolvedAt: candle.timestamp,
          barsObserved: relevant.indexOf(candle) + 1,
          realizedPoints: rounded(-riskPoints),
          realizedR: -1,
          maximumFavorableExcursionPoints: rounded(maximumFavorableExcursionPoints),
          maximumAdverseExcursionPoints: rounded(maximumAdverseExcursionPoints),
          resultReason: "Stop and target were both touched in one closed candle; conservative stop-first accounting applied."
        }
      };
    }
    if (stopTouched || targetTouched) {
      const passed = targetTouched;
      const realizedPoints = passed ? Math.abs(plan.takeProfit - plan.entryPrice) : -riskPoints;
      return {
        ...record,
        outcome: {
          status: passed ? "passed_target_first" : "failed_stop_first",
          observationRevision: record.outcome.observationRevision + 1,
          observedThrough: candle.timestamp,
          entryReachedAt,
          resolvedAt: candle.timestamp,
          barsObserved: relevant.indexOf(candle) + 1,
          realizedPoints: rounded(realizedPoints),
          realizedR: riskPoints > 0 ? rounded(realizedPoints / riskPoints) : undefined,
          maximumFavorableExcursionPoints: rounded(maximumFavorableExcursionPoints),
          maximumAdverseExcursionPoints: rounded(maximumAdverseExcursionPoints),
          resultReason: passed ? "Saved take-profit was reached before the saved stop-loss." : "Saved stop-loss was reached before the saved take-profit."
        }
      };
    }
  }

  const expired = observedAtMs >= expiresAtMs;
  if (!entryReachedAt) {
    return {
      ...record,
      outcome: {
        status: expired ? "not_triggered" : "pending_entry",
        observationRevision: record.outcome.observationRevision + 1,
        observedThrough: relevant.at(-1)?.timestamp,
        barsObserved: relevant.length,
        resultReason: expired
          ? "The saved entry was not reached before the plan horizon expired."
          : "Waiting for a later closed candle to reach the saved entry price."
      }
    };
  }

  const directionalPoints = finite(lastClose) ? (long ? lastClose - plan.entryPrice : plan.entryPrice - lastClose) : undefined;
  return {
    ...record,
    outcome: {
      status: expired ? "expired_open" : "active",
      observationRevision: record.outcome.observationRevision + 1,
      observedThrough: lastTimestamp,
      entryReachedAt,
      barsObserved: relevant.length,
      realizedPoints: finite(directionalPoints) ? rounded(directionalPoints) : undefined,
      realizedR: finite(directionalPoints) && riskPoints > 0 ? rounded(directionalPoints / riskPoints) : undefined,
      maximumFavorableExcursionPoints: rounded(maximumFavorableExcursionPoints),
      maximumAdverseExcursionPoints: rounded(maximumAdverseExcursionPoints),
      resultReason: expired
        ? "Entry was reached, but neither target nor stop resolved before the saved trade horizon expired."
        : "Entry was reached; the plan remains unresolved on later closed candles."
    }
  };
}
