import {
  TRADE_PLAN_OUTCOME_AUTHORITY,
  type TradePlanCycleResultRecord,
  type TradePlanResultsSnapshot
} from "./tradePlanOutcomeTypes";

const rounded = (value: number) => Number(value.toFixed(2));
const resolvedStatuses = new Set(["passed_target_first", "failed_stop_first", "ambiguous_stop_first"]);
const pendingStatuses = new Set(["pending_entry", "active"]);

const calibrationSuggestionsFor = (records: TradePlanCycleResultRecord[]) => {
  const plans = records.filter((record) => record.plan?.evaluable);
  const resolved = plans.filter((record) => resolvedStatuses.has(record.outcome.status));
  if (!plans.length) return ["No evaluable plans exist in this four-week window; preserve current settings and collect identity-matched plan observations."];
  if (!resolved.length) return ["No plan has resolved target-first or stop-first yet; collect later closed candles before calibrating trade management."];
  const suggestions: string[] = [];
  const failed = resolved.filter((record) => record.outcome.status !== "passed_target_first");
  const notTriggered = plans.filter((record) => record.outcome.status === "not_triggered");
  const ambiguous = plans.filter((record) => record.outcome.status === "ambiguous_stop_first");
  const averageR = resolved.reduce((sum, record) => sum + (record.outcome.realizedR ?? 0), 0) / resolved.length;
  if (failed.length > resolved.length / 2) {
    suggestions.push("Stop-first outcomes exceed target-first outcomes. Review entry timing and invalidation placement by model and horizon; do not widen stops automatically.");
  }
  if (notTriggered.length / plans.length >= 0.3) {
    suggestions.push("At least 30% of plans expired without entry. Compare saved entry placement with first-touch distance before changing entry logic.");
  }
  if (ambiguous.length) {
    suggestions.push("Same-bar stop/target ambiguity exists. Use a finer closed-candle source for those records before calibrating exits.");
  }
  if (averageR < 0) {
    suggestions.push("Average resolved R is negative. Require stronger target distance and risk/reward evidence before considering any parameter proposal.");
  }
  return suggestions.length ? suggestions : ["Observed plan management is positive in this window. Freeze settings and collect more independent dates before proposing calibration."];
};

export function buildTradePlanResultsSnapshot(
  records: TradePlanCycleResultRecord[],
  generatedAt = new Date().toISOString()
): TradePlanResultsSnapshot {
  const now = new Date(generatedAt);
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const fourWeeksAgo = now.getTime() - 28 * 24 * 60 * 60 * 1_000;
  const windowStartMs = Math.max(monthStart, fourWeeksAgo);
  const windowRecords = records
    .filter((record) => Date.parse(record.completedAt) >= windowStartMs && Date.parse(record.completedAt) <= now.getTime())
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  const plans = windowRecords.filter((record) => record.plan);
  const resolved = plans.filter((record) => resolvedStatuses.has(record.outcome.status));
  const dailyMap = new Map<string, TradePlanCycleResultRecord[]>();
  windowRecords.forEach((record) => {
    const date = record.completedAt.slice(0, 10);
    dailyMap.set(date, [...(dailyMap.get(date) ?? []), record]);
  });
  const daily = [...dailyMap.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([date, rows]) => ({
    date,
    cycleCount: rows.length,
    planCount: rows.filter((record) => record.plan).length,
    passedCount: rows.filter((record) => record.outcome.status === "passed_target_first").length,
    failedCount: rows.filter((record) => record.outcome.status === "failed_stop_first").length,
    ambiguousCount: rows.filter((record) => record.outcome.status === "ambiguous_stop_first").length,
    pendingCount: rows.filter((record) => pendingStatuses.has(record.outcome.status)).length,
    notTriggeredCount: rows.filter((record) => record.outcome.status === "not_triggered").length,
    realizedPoints: rounded(rows.reduce((sum, record) => sum + (record.outcome.realizedPoints ?? 0), 0))
  }));
  const realizedR = resolved.map((record) => record.outcome.realizedR).filter((value): value is number => typeof value === "number");
  const passedCount = resolved.filter((record) => record.outcome.status === "passed_target_first").length;
  return {
    generatedAt,
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: generatedAt,
    cycleCount: windowRecords.length,
    planCount: plans.length,
    evaluatedCount: resolved.length,
    passedCount,
    failedCount: resolved.filter((record) => record.outcome.status === "failed_stop_first").length,
    ambiguousCount: resolved.filter((record) => record.outcome.status === "ambiguous_stop_first").length,
    pendingCount: plans.filter((record) => pendingStatuses.has(record.outcome.status)).length,
    notTriggeredCount: plans.filter((record) => record.outcome.status === "not_triggered").length,
    notEvaluableCount: windowRecords.filter((record) => record.outcome.status === "not_evaluable").length,
    plannedTargetPoints: rounded(plans.reduce((sum, record) => sum + (record.plan?.plannedTargetPoints ?? 0), 0)),
    realizedPoints: rounded(plans.reduce((sum, record) => sum + (record.outcome.realizedPoints ?? 0), 0)),
    averageRealizedR: realizedR.length ? rounded(realizedR.reduce((sum, value) => sum + value, 0) / realizedR.length) : null,
    passRate: resolved.length ? passedCount / resolved.length : null,
    daily,
    records: windowRecords,
    calibrationSuggestions: calibrationSuggestionsFor(windowRecords),
    authority: TRADE_PLAN_OUTCOME_AUTHORITY
  };
}
