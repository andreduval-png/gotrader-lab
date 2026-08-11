import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { historicalTimeframeMilliseconds } from "./historicalDatasetContracts";
import {
  HISTORICAL_TIMEFRAME_LINEAGE_SCHEMA_VERSION,
  type HistoricalDerivedTimeframeLineage,
  type HistoricalMarketCalendarSnapshot,
  type HistoricalNormalizedCandle,
  type HistoricalTimeframe,
  type HistoricalTimeframeAlignmentPolicy
} from "./historicalDatasetTypes";

const unique = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const bucketStartFor = (
  timestamp: number,
  target: HistoricalTimeframe,
  policy: Readonly<HistoricalTimeframeAlignmentPolicy>
) => {
  const anchorMs = policy.anchorOffsetMinutes * 60_000;
  if (target === "1w") {
    const mondayEpoch = Date.UTC(1970, 0, 5) + anchorMs;
    return Math.floor((timestamp - mondayEpoch) / historicalTimeframeMilliseconds("1w")) *
      historicalTimeframeMilliseconds("1w") + mondayEpoch;
  }
  const duration = historicalTimeframeMilliseconds(target);
  return Math.floor((timestamp - anchorMs) / duration) * duration + anchorMs;
};

const intervalCovered = (
  startMs: number,
  endMs: number,
  calendar: Readonly<HistoricalMarketCalendarSnapshot>
) => {
  if (calendar.verificationStatus !== "verified") return false;
  const intervals = calendar.closedIntervals
    .map((value) => ({ start: Date.parse(value.startUtc), end: Date.parse(value.endUtc) }))
    .filter((value) => Number.isFinite(value.start) && Number.isFinite(value.end) && value.end > startMs && value.start < endMs)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let cursor = startMs;
  for (const interval of intervals) {
    if (interval.start > cursor) return false;
    cursor = Math.max(cursor, interval.end);
    if (cursor >= endMs) return true;
  }
  return cursor >= endMs;
};

export async function deriveHistoricalTimeframe(input: {
  readonly parentDatasetRequestId: string;
  readonly parentTimeframe: HistoricalTimeframe;
  readonly parentPartitionIds: readonly string[];
  readonly targetTimeframe: HistoricalTimeframe;
  readonly candles: readonly Readonly<HistoricalNormalizedCandle>[];
  readonly rangeStartUtc: string;
  readonly rangeEndUtc: string;
  readonly calendar: Readonly<HistoricalMarketCalendarSnapshot>;
  readonly alignment: Readonly<HistoricalTimeframeAlignmentPolicy>;
}): Promise<{
  readonly candles: readonly Readonly<HistoricalNormalizedCandle>[];
  readonly lineage: Readonly<HistoricalDerivedTimeframeLineage>;
}> {
  const parentMs = historicalTimeframeMilliseconds(input.parentTimeframe);
  const targetMs = historicalTimeframeMilliseconds(input.targetTimeframe);
  if (parentMs >= targetMs || targetMs % parentMs !== 0) {
    throw new Error("Derived timeframe must be an integer multiple of its parent timeframe.");
  }
  if (input.alignment.weekStartsOn !== "monday") {
    throw new Error("BT1 supports Monday-aligned weekly candles only.");
  }
  if (!input.alignment.supportedDerivedTimeframes.includes(input.targetTimeframe)) {
    throw new Error(
      `Historical alignment policy does not qualify derived ${input.targetTimeframe}; use a verified native source timeframe.`
    );
  }
  const rangeStart = Date.parse(input.rangeStartUtc);
  const rangeEnd = Date.parse(input.rangeEndUtc);
  const derived: HistoricalNormalizedCandle[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  let calendarAdjusted = false;

  const finalizeBucket = (bucketStart: number, candles: readonly HistoricalNormalizedCandle[]) => {
    const bucketEnd = bucketStart + targetMs;
    if (bucketStart < rangeStart || bucketEnd > rangeEnd) {
      warnings.push("derived_boundary_bucket_excluded");
      return;
    }
    const byOpen = new Map(candles.map((candle) => [Date.parse(candle.openTimeUtc), candle]));
    const missing: number[] = [];
    for (let expected = bucketStart; expected < bucketEnd; expected += parentMs) {
      if (!byOpen.has(expected)) missing.push(expected);
    }
    const unexpected = missing.filter((timestamp) => !intervalCovered(timestamp, timestamp + parentMs, input.calendar));
    if (unexpected.length) {
      blockers.push(`derived_${input.targetTimeframe}_incomplete_bucket`);
      return;
    }
    if (missing.length) {
      calendarAdjusted = true;
      warnings.push("derived_bucket_adjusted_for_verified_market_closure");
    }
    const ordered = [...byOpen.values()].sort(
      (left, right) => Date.parse(left.openTimeUtc) - Date.parse(right.openTimeUtc)
    );
    if (!ordered.length) return;
    const volumeValues = ordered.map((candle) => candle.volume).filter((value): value is number => value !== undefined);
    const spreadValues = ordered.map((candle) => candle.spreadPoints).filter((value): value is number => value !== undefined);
    derived.push(Object.freeze({
      openTimeUtc: new Date(bucketStart).toISOString(),
      closeTimeUtc: new Date(bucketEnd).toISOString(),
      open: ordered[0].open,
      high: Math.max(...ordered.map((candle) => candle.high)),
      low: Math.min(...ordered.map((candle) => candle.low)),
      close: ordered.at(-1)!.close,
      ...(volumeValues.length ? { volume: volumeValues.reduce((sum, value) => sum + value, 0) } : {}),
      ...(spreadValues.length ? { spreadPoints: Math.max(...spreadValues) } : {})
    }));
  };

  let currentBucketStart: number | undefined;
  let currentBucket: HistoricalNormalizedCandle[] = [];
  const alreadyOrdered = input.candles.every((candle, index) =>
    index === 0 || Date.parse(input.candles[index - 1].openTimeUtc) <= Date.parse(candle.openTimeUtc));
  const orderedInput = alreadyOrdered
    ? input.candles
    : [...input.candles].sort(
      (left, right) => Date.parse(left.openTimeUtc) - Date.parse(right.openTimeUtc)
    );
  for (const candle of orderedInput) {
    const bucketStart = bucketStartFor(Date.parse(candle.openTimeUtc), input.targetTimeframe, input.alignment);
    if (currentBucketStart !== undefined && bucketStart !== currentBucketStart) {
      finalizeBucket(currentBucketStart, currentBucket);
      currentBucket = [];
    }
    currentBucketStart = bucketStart;
    currentBucket.push(candle);
  }
  if (currentBucketStart !== undefined) finalizeBucket(currentBucketStart, currentBucket);
  const normalizedBlockers = unique(blockers);
  const normalizedWarnings = unique(warnings);
  const lineageCore = {
    schemaVersion:
      HISTORICAL_TIMEFRAME_LINEAGE_SCHEMA_VERSION as typeof HISTORICAL_TIMEFRAME_LINEAGE_SCHEMA_VERSION,
    parentDatasetRequestId: input.parentDatasetRequestId,
    parentTimeframe: input.parentTimeframe,
    parentPartitionIds: Object.freeze([...input.parentPartitionIds].sort()),
    targetTimeframe: input.targetTimeframe,
    alignmentPolicyId: input.alignment.policyId,
    alignmentPolicyVersion: input.alignment.version,
    completeness: normalizedBlockers.length
      ? "blocked" as const
      : calendarAdjusted
        ? "calendar_adjusted" as const
        : "complete" as const,
    blockers: normalizedBlockers,
    warnings: normalizedWarnings
  };
  return Object.freeze({
    candles: Object.freeze(derived),
    lineage: Object.freeze({ ...lineageCore, lineageId: await canonicalHash(lineageCore) })
  });
}

export function selectHistoricalParentTimeframe(
  sources: readonly HistoricalTimeframe[],
  target: HistoricalTimeframe
) {
  const targetMs = historicalTimeframeMilliseconds(target);
  return [...sources]
    .filter((source) => {
      const sourceMs = historicalTimeframeMilliseconds(source);
      return sourceMs < targetMs && targetMs % sourceMs === 0;
    })
    .sort((left, right) => historicalTimeframeMilliseconds(left) - historicalTimeframeMilliseconds(right))[0];
}
