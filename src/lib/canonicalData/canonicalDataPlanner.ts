import { canonicalFingerprint, fingerprintCanonicalSource } from "@/lib/ictCanonical/canonicalIctIdentity";
import type { CanonicalIctFactSnapshot } from "@/lib/ictCanonical/canonicalFactBuilder";
import { buildCanonicalIctFactSnapshot } from "@/lib/ictCanonical/canonicalFactBuilder";
import type { Candle, FuturesSymbol, Timeframe } from "@/lib/types";
import type { IctAnalysisTimeframe } from "@/lib/ict-strategy-suite/ictMarketAnalysisContextTypes";
import type {
  CanonicalCompletedBarPartition,
  CanonicalContinuityGap,
  CanonicalContinuityPolicy,
  CanonicalContinuityReport,
  CanonicalDataRequirement,
  CanonicalDataSnapshot,
  CanonicalDataTier,
  CanonicalFetchPlan,
  CanonicalFetchPlanRequest,
  CanonicalStrategyDataView,
  CanonicalTimeframeDataSnapshot,
  CanonicalContinuityStatus
} from "./canonicalDataTypes";

export const CANONICAL_DATA_FETCH_CONCURRENCY = 3;

const TIMEFRAME_ORDER: IctAnalysisTimeframe[] = ["W1", "D1", "H4", "H1", "M15", "M5", "M1"];
const REQUEST_TIMEFRAME: Record<IctAnalysisTimeframe, string> = {
  W1: "1w", D1: "1d", H4: "4h", H1: "1h", M15: "15m", M5: "5m", M1: "1m"
};
const CANDLE_TIMEFRAME: Record<IctAnalysisTimeframe, Timeframe> = {
  W1: "1d", D1: "1d", H4: "4h", H1: "1h", M15: "15m", M5: "5m", M1: "1m"
};
const TIMEFRAME_MS: Record<IctAnalysisTimeframe, number> = {
  W1: 7 * 24 * 60 * 60_000,
  D1: 24 * 60 * 60_000,
  H4: 4 * 60 * 60_000,
  H1: 60 * 60_000,
  M15: 15 * 60_000,
  M5: 5 * 60_000,
  M1: 60_000
};

const continuityRank: Record<CanonicalContinuityPolicy, number> = { NONE: 0, REPORT_ONLY: 1, SESSION_AWARE_REQUIRED: 2 };
const strongerContinuity = (left: CanonicalContinuityPolicy, right: CanonicalContinuityPolicy) =>
  continuityRank[left] >= continuityRank[right] ? left : right;

const assertTierIsolation = (tier: CanonicalDataTier, requirements: readonly CanonicalDataRequirement[]) => {
  const mismatched = requirements.find((requirement) => requirement.tier !== tier);
  if (mismatched) throw new Error(`Canonical data tier ${tier} cannot inherit ${mismatched.tier} requirement ${mismatched.consumerId}.`);
};

export const resolveCanonicalFetchPlan = ({
  requirements,
  requestedSymbol,
  brokerSymbol,
  provider,
  sourceId,
  asOf,
  concurrencyLimit = CANONICAL_DATA_FETCH_CONCURRENCY
}: {
  requirements: readonly CanonicalDataRequirement[];
  requestedSymbol: string;
  brokerSymbol: string;
  provider: string;
  sourceId: string;
  asOf: string;
  concurrencyLimit?: number;
}): CanonicalFetchPlan => {
  if (!requirements.length) throw new Error("Canonical fetch planning requires at least one consumer.");
  const tier = requirements[0].tier;
  assertTierIsolation(tier, requirements);
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) throw new Error(`Canonical fetch plan has invalid asOf: ${asOf}`);
  const union = new Map<IctAnalysisTimeframe, CanonicalFetchPlanRequest>();
  for (const requirement of [...requirements].sort((left, right) => left.consumerId.localeCompare(right.consumerId))) {
    for (const item of requirement.requiredTimeframes) {
      const current = union.get(item.timeframe);
      union.set(item.timeframe, {
        timeframe: item.timeframe,
        requestTimeframe: REQUEST_TIMEFRAME[item.timeframe],
        minimumWarmupBars: Math.max(current?.minimumWarmupBars ?? 0, item.minimumWarmupBars),
        evaluationBars: Math.max(current?.evaluationBars ?? 0, item.evaluationBars),
        minimumCalendarDays: Math.max(current?.minimumCalendarDays ?? 0, item.minimumCalendarDays ?? 0),
        maximumHistoryBars: Math.max(current?.maximumHistoryBars ?? 0, item.optionalMaximumHistoryBars ?? 0) || undefined,
        requiresCompletedBars: Boolean(current?.requiresCompletedBars || requirement.requiresCompletedBars),
        continuityPolicy: strongerContinuity(current?.continuityPolicy ?? "NONE", requirement.continuityPolicy),
        consumerIds: [...new Set([...(current?.consumerIds ?? []), requirement.consumerId])].sort()
      });
    }
  }
  const requests = TIMEFRAME_ORDER.flatMap((timeframe) => union.get(timeframe) ?? []);
  const identity = {
    contractVersion: "1.0.0",
    tier,
    requestedSymbol,
    brokerSymbol,
    provider,
    sourceId,
    asOf: new Date(asOfMs).toISOString(),
    requests,
    sessionHistoryRequirements: [...new Set(requirements.flatMap((item) => item.sessionHistoryRequirements))].sort(),
    weekHistoryRequirements: Math.max(...requirements.map((item) => item.weekHistoryRequirements), 0),
    consumerIds: requirements.map((item) => item.consumerId).sort(),
    concurrencyLimit: Math.max(1, Math.min(4, Math.round(concurrencyLimit)))
  } as const;
  return { ...identity, planId: `data-plan:${canonicalFingerprint(identity)}` };
};

const validCandle = (candle: Candle) =>
  Number.isFinite(Date.parse(candle.timestamp)) &&
  [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) &&
  candle.high >= Math.max(candle.open, candle.close, candle.low) &&
  candle.low <= Math.min(candle.open, candle.close, candle.high);

const zonedNumericParts = (timestampMs: number) => Object.fromEntries(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestampMs))
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)])
) as Record<string, number>;

const addNewYorkCalendarDays = (timestampMs: number, calendarDays: number) => {
  const local = zonedNumericParts(timestampMs);
  const targetWallClock = Date.UTC(local.year, local.month - 1, local.day + calendarDays, local.hour, local.minute, local.second);
  let guess = targetWallClock;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = zonedNumericParts(guess);
    const observedWallClock = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
    const correction = targetWallClock - observedWallClock;
    guess += correction;
    if (correction === 0) break;
  }
  return guess;
};

export const canonicalCandleCloseTimestamp = ({
  openTimestamp,
  timeframe
}: {
  openTimestamp: string;
  timeframe: IctAnalysisTimeframe;
}) => {
  const openMs = Date.parse(openTimestamp);
  if (!Number.isFinite(openMs)) return undefined;
  if (timeframe === "D1") return new Date(addNewYorkCalendarDays(openMs, 1)).toISOString();
  if (timeframe === "W1") return new Date(addNewYorkCalendarDays(openMs, 7)).toISOString();
  return new Date(openMs + TIMEFRAME_MS[timeframe]).toISOString();
};

export const partitionCanonicalCompletedBars = ({
  candles,
  timeframe,
  asOf
}: {
  candles: readonly Candle[];
  timeframe: IctAnalysisTimeframe;
  asOf: string;
}): CanonicalCompletedBarPartition => {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) throw new Error(`Completed-bar policy has invalid asOf: ${asOf}`);
  const malformedCandles = candles.filter((candle) => !validCandle(candle));
  const seenTimestamps = new Set<string>();
  const normalized = [...candles]
    .filter(validCandle)
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp) || left.id.localeCompare(right.id))
    .filter((candle) => {
      if (seenTimestamps.has(candle.timestamp)) return false;
      seenTimestamps.add(candle.timestamp);
      return true;
    });
  const closeMs = (candle: Candle) => Date.parse(canonicalCandleCloseTimestamp({ openTimestamp: candle.timestamp, timeframe }) ?? "invalid");
  const closedCandles = normalized.filter((candle) => closeMs(candle) <= asOfMs);
  const formingCandles = normalized.filter((candle) => Date.parse(candle.timestamp) <= asOfMs && closeMs(candle) > asOfMs);
  return {
    timeframe,
    asOf: new Date(asOfMs).toISOString(),
    closedCandles,
    formingCandles,
    malformedCandles,
    providerTimestampConvention: "BAR_OPEN_TIME",
    policyId: "gotrader.canonical-data.completed-bars.v1"
  };
};

const nyParts = (timestamp: string) => Object.fromEntries(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value])
) as Record<string, string>;

const classifyGap = (previousTimestamp: string, nextTimestamp: string, missingBars: number, intervalMs: number): CanonicalContinuityGap["classification"] => {
  const previous = nyParts(previousTimestamp);
  const next = nyParts(nextTimestamp);
  if ((previous.weekday === "Fri" || previous.weekday === "Sat") && (next.weekday === "Sun" || next.weekday === "Mon")) {
    return "EXPECTED_SESSION_BREAK";
  }
  const previousHour = Number(previous.hour);
  const nextHour = Number(next.hour);
  const elapsed = Date.parse(nextTimestamp) - Date.parse(previousTimestamp);
  if (
    elapsed <= 3 * 60 * 60_000 &&
    ((previousHour >= 16 && previousHour <= 18) || (nextHour >= 17 && nextHour <= 19))
  ) return "MAINTENANCE";
  return missingBars >= 6 && intervalMs < TIMEFRAME_MS.D1 ? "PROVIDER_OUTAGE" : "GAPS_PRESENT";
};

export const classifyCanonicalContinuity = ({
  candles,
  timeframe,
  policy
}: {
  candles: readonly Candle[];
  timeframe: IctAnalysisTimeframe;
  policy: CanonicalContinuityPolicy;
}): CanonicalContinuityReport => {
  const interval = TIMEFRAME_MS[timeframe];
  if (policy === "NONE") {
    return { status: "UNKNOWN", timeframe, expectedIntervalMs: interval, observedBars: candles.length, gaps: [], safeForCanonicalFacts: true, policyId: "gotrader.canonical-data.continuity.session-aware.v1" };
  }
  if (candles.length < 2) {
    return { status: "UNKNOWN", timeframe, expectedIntervalMs: interval, observedBars: candles.length, gaps: [], safeForCanonicalFacts: false, policyId: "gotrader.canonical-data.continuity.session-aware.v1" };
  }
  const gaps: CanonicalContinuityGap[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const previousTimestamp = candles[index - 1].timestamp;
    const nextTimestamp = candles[index].timestamp;
    const delta = Date.parse(nextTimestamp) - Date.parse(previousTimestamp);
    if (delta <= interval * 1.5) continue;
    const missingBars = Math.max(1, Math.round(delta / interval) - 1);
    gaps.push({ previousTimestamp, nextTimestamp, missingBars, classification: classifyGap(previousTimestamp, nextTimestamp, missingBars, interval) });
  }
  const unsafe = gaps.filter((gap) => gap.classification === "GAPS_PRESENT" || gap.classification === "PROVIDER_OUTAGE");
  const status = unsafe.some((gap) => gap.classification === "PROVIDER_OUTAGE")
    ? "PROVIDER_OUTAGE"
    : unsafe.length
      ? "GAPS_PRESENT"
      : gaps.some((gap) => gap.classification === "MAINTENANCE")
        ? "MAINTENANCE"
        : gaps.some((gap) => gap.classification === "EXPECTED_SESSION_BREAK")
          ? "EXPECTED_SESSION_BREAK"
          : "VERIFIED";
  return {
    status,
    timeframe,
    expectedIntervalMs: interval,
    observedBars: candles.length,
    gaps,
    safeForCanonicalFacts: policy === "REPORT_ONLY" || unsafe.length === 0,
    policyId: "gotrader.canonical-data.continuity.session-aware.v1"
  };
};

export const createCanonicalTimeframeSnapshot = ({
  candles,
  request,
  asOf,
  sourceMethod
}: {
  candles: readonly Candle[];
  request: CanonicalFetchPlanRequest;
  asOf: string;
  sourceMethod: string;
}): CanonicalTimeframeDataSnapshot => {
  const partition = partitionCanonicalCompletedBars({ candles, timeframe: request.timeframe, asOf });
  const researchCandles = request.requiresCompletedBars ? partition.closedCandles : [...partition.closedCandles, ...partition.formingCandles];
  const bounded = request.maximumHistoryBars ? researchCandles.slice(-request.maximumHistoryBars) : researchCandles;
  const continuity = classifyCanonicalContinuity({ candles: bounded, timeframe: request.timeframe, policy: request.continuityPolicy });
  return {
    timeframe: request.timeframe,
    closedCandles: bounded,
    liveDisplayCandle: partition.formingCandles.at(-1),
    continuity,
    warmupBars: Math.min(request.minimumWarmupBars, bounded.length),
    evaluationBars: Math.min(request.evaluationBars, Math.max(0, bounded.length - Math.min(request.minimumWarmupBars, bounded.length))),
    firstEvaluationIndex: Math.max(0, bounded.length - request.evaluationBars),
    sourceMethod
  };
};

export const buildCanonicalDataSnapshot = ({
  plan,
  timeframes
}: {
  plan: CanonicalFetchPlan;
  timeframes: CanonicalDataSnapshot["timeframes"];
}): CanonicalDataSnapshot => {
  const identity = {
    fetchPlanId: plan.planId,
    asOf: plan.asOf,
    counts: Object.fromEntries(TIMEFRAME_ORDER.map((timeframe) => [timeframe, timeframes[timeframe]?.closedCandles.length ?? 0])),
    fingerprints: Object.fromEntries(TIMEFRAME_ORDER.map((timeframe) => [timeframe, fingerprintCanonicalSource(timeframes[timeframe]?.closedCandles ?? [])]))
  };
  return {
    snapshotId: `data-snapshot:${canonicalFingerprint(identity)}`,
    fetchPlanId: plan.planId,
    asOf: plan.asOf,
    requestedSymbol: plan.requestedSymbol,
    brokerSymbol: plan.brokerSymbol,
    tier: plan.tier,
    timeframes,
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }
  };
};

const FACT_DEPENDENCY_STATUS = Object.freeze({
  PD_LOCATION: "PRODUCED_AND_AVAILABLE",
  IRL_ERL_TRANSITION: "SOURCE_OR_SEMANTIC_BLOCKED"
} as const);

export const canonicalFactDependencyInventory = () => ({
  PD_LOCATION: FACT_DEPENDENCY_STATUS.PD_LOCATION,
  IRL_ERL_TRANSITION: FACT_DEPENDENCY_STATUS.IRL_ERL_TRANSITION,
  LIQUIDITY: "PRODUCED_AND_AVAILABLE" as const,
  DISPLACEMENT: "PRODUCED_AND_AVAILABLE" as const,
  MSS: "PRODUCED_AND_AVAILABLE" as const,
  FVG: "PRODUCED_AND_AVAILABLE" as const,
  PD_ARRAY: "PRODUCED_AND_AVAILABLE" as const,
  DEALING_RANGE: "PRODUCED_AND_AVAILABLE" as const,
  OPENING_GAP: "PRODUCED_AND_AVAILABLE" as const
});

export const buildCanonicalStrategyDataView = ({
  snapshot,
  requirement
}: {
  snapshot: CanonicalDataSnapshot;
  requirement: CanonicalDataRequirement;
}): CanonicalStrategyDataView => {
  if (snapshot.tier !== requirement.tier) throw new Error(`Strategy view tier mismatch: ${snapshot.tier} vs ${requirement.tier}.`);
  const inventory = canonicalFactDependencyInventory() as Record<string, string>;
  const missingFactTypes = (requirement.requiredFactTypes ?? []).filter((factType) => inventory[factType] !== "PRODUCED_AND_AVAILABLE");
  const timeframes: Partial<Record<IctAnalysisTimeframe, {
    candles: readonly Candle[];
    warmupEndIndex: number;
    evaluationStartIndex: number;
    evaluationEndIndex: number;
    continuityStatus: CanonicalContinuityStatus;
    completedBarsOnly: boolean;
  }>> = {};
  for (const requested of requirement.requiredTimeframes) {
    const source = snapshot.timeframes[requested.timeframe];
    if (!source) continue;
    const required = requested.minimumCalendarDays
      ? source.closedCandles.length
      : requested.minimumWarmupBars + requested.evaluationBars;
    const candles = source.closedCandles.slice(-Math.max(required, requested.minimumWarmupBars));
    const evaluationStartIndex = Math.max(0, candles.length - requested.evaluationBars);
    timeframes[requested.timeframe] = {
      candles,
      warmupEndIndex: Math.min(requested.minimumWarmupBars, candles.length),
      evaluationStartIndex,
      evaluationEndIndex: Math.max(-1, candles.length - 1),
      continuityStatus: source.continuity.status,
      completedBarsOnly: requirement.requiresCompletedBars
    };
  }
  return {
    viewId: `strategy-view:${canonicalFingerprint({ snapshotId: snapshot.snapshotId, consumerId: requirement.consumerId })}`,
    snapshotId: snapshot.snapshotId,
    consumerId: requirement.consumerId,
    ownerId: requirement.ownerId,
    tier: requirement.tier,
    asOf: snapshot.asOf,
    dependencyStatus: missingFactTypes.length ? "DEPENDENCY_UNAVAILABLE" : "AVAILABLE",
    missingFactTypes,
    timeframes
  };
};

export const buildSharedCanonicalFactSnapshots = ({
  snapshot,
  symbol,
  sourceFingerprint,
  candleLimitsByTimeframe = {}
}: {
  snapshot: CanonicalDataSnapshot;
  symbol: FuturesSymbol;
  sourceFingerprint: string;
  candleLimitsByTimeframe?: Partial<Record<IctAnalysisTimeframe, number>>;
}): Readonly<Partial<Record<IctAnalysisTimeframe, CanonicalIctFactSnapshot>>> => Object.fromEntries(
  TIMEFRAME_ORDER.flatMap((timeframe) => {
    const data = snapshot.timeframes[timeframe];
    if (!data?.closedCandles.length || !data.continuity.safeForCanonicalFacts) return [];
    const candles = candleLimitsByTimeframe[timeframe]
      ? data.closedCandles.slice(-candleLimitsByTimeframe[timeframe]!)
      : data.closedCandles;
    return [[timeframe, buildCanonicalIctFactSnapshot({
      candles,
      asOf: snapshot.asOf,
      symbol,
      timeframe: CANDLE_TIMEFRAME[timeframe],
      sourceFingerprint
    })]];
  })
);

export const runBoundedCanonicalTasks = async <T, R>(
  values: readonly T[],
  concurrencyLimit: number,
  task: (value: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> => {
  signal?.throwIfAborted();
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(values.length, Math.max(1, Math.min(4, Math.round(concurrencyLimit)))) }, async () => {
    while (cursor < values.length) {
      signal?.throwIfAborted();
      const index = cursor;
      cursor += 1;
      results[index] = await task(values[index], index);
      signal?.throwIfAborted();
    }
  });
  await Promise.all(workers);
  return results;
};
