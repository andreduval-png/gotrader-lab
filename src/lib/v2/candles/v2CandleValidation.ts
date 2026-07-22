import type {
  V2CandleCandidate,
  V2CanonicalCandle,
  V2DataQualityDiagnostics
} from "./v2CandleTypes";

const iso = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
};

const sameCandle = (left: V2CandleCandidate, right: V2CandleCandidate) =>
  left.open === right.open &&
  left.high === right.high &&
  left.low === right.low &&
  left.close === right.close &&
  left.volume === right.volume &&
  left.closeTime === right.closeTime;

const freezeStrings = (values: string[]) => Object.freeze([...values]);

export function validateAndNormalizeV2Candles({
  asOf,
  candidates,
  expectedIntervalMs,
  futureToleranceMs = 1_000,
  missingTimeframes = [],
  sourceStale = false,
  staleAfterMs
}: {
  asOf: string;
  candidates: readonly V2CandleCandidate[];
  expectedIntervalMs: number;
  futureToleranceMs?: number;
  missingTimeframes?: readonly string[];
  sourceStale?: boolean;
  staleAfterMs?: number;
}): {
  candles: readonly Readonly<V2CanonicalCandle>[];
  diagnostics: Readonly<V2DataQualityDiagnostics>;
} {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) {
    throw new Error("V2 candle validation requires a valid asOf timestamp.");
  }

  let duplicateCount = 0;
  let conflictingDuplicateCount = 0;
  let outOfOrderCount = 0;
  let invalidOhlcCount = 0;
  let invalidVolumeCount = 0;
  let invalidTimestampCount = 0;
  let partialCandleCount = 0;
  let closureUnknownCount = 0;
  let futureTimestampCount = 0;
  let previousInputOpen = Number.NEGATIVE_INFINITY;
  const acceptedByOpenTime = new Map<string, V2CandleCandidate>();

  for (const candidate of candidates) {
    const openTime = iso(candidate.openTime);
    const closeTime = iso(candidate.closeTime);
    if (!openTime || !closeTime || Date.parse(closeTime) <= Date.parse(openTime)) {
      invalidTimestampCount += 1;
      continue;
    }
    const openMs = Date.parse(openTime);
    const closeMs = Date.parse(closeTime);
    if (openMs < previousInputOpen) {
      outOfOrderCount += 1;
    }
    previousInputOpen = openMs;
    if (openMs > asOfMs + futureToleranceMs) {
      futureTimestampCount += 1;
      continue;
    }
    if (candidate.isClosed === undefined) {
      closureUnknownCount += 1;
      continue;
    }
    if (candidate.isClosed === false) {
      partialCandleCount += 1;
      continue;
    }
    if (closeMs > asOfMs + futureToleranceMs) {
      futureTimestampCount += 1;
      continue;
    }
    if (
      ![candidate.open, candidate.high, candidate.low, candidate.close].every(
        (value) => Number.isFinite(value) && value > 0
      ) ||
      candidate.high < Math.max(candidate.open, candidate.close, candidate.low) ||
      candidate.low > Math.min(candidate.open, candidate.close, candidate.high)
    ) {
      invalidOhlcCount += 1;
      continue;
    }
    if (candidate.volume !== undefined && (!Number.isFinite(candidate.volume) || candidate.volume < 0)) {
      invalidVolumeCount += 1;
      continue;
    }

    const normalizedCandidate = { ...candidate, openTime, closeTime };
    const existing = acceptedByOpenTime.get(openTime);
    if (existing) {
      duplicateCount += 1;
      if (!sameCandle(existing, normalizedCandidate)) {
        conflictingDuplicateCount += 1;
      }
      continue;
    }
    acceptedByOpenTime.set(openTime, normalizedCandidate);
  }

  const sortedCandidates = [...acceptedByOpenTime.values()].sort(
    (left, right) => Date.parse(left.openTime) - Date.parse(right.openTime)
  );
  let gapCount = 0;
  for (let index = 1; index < sortedCandidates.length; index += 1) {
    const distance = Date.parse(sortedCandidates[index].openTime) - Date.parse(sortedCandidates[index - 1].openTime);
    if (distance > expectedIntervalMs * 1.5) {
      gapCount += 1;
    }
  }

  const frozenCandles = Object.freeze(
    sortedCandidates.map((candidate) => Object.freeze({
      openTime: candidate.openTime,
      closeTime: candidate.closeTime,
      open: candidate.open,
      high: candidate.high,
      low: candidate.low,
      close: candidate.close,
      volume: candidate.volume,
      isClosed: true as const,
      closureSource: candidate.closureSource,
      providerTime: candidate.providerTime,
      receivedAt: candidate.receivedAt,
      timeAudit: candidate.timeAudit
        ? Object.freeze({
            ...candidate.timeAudit,
            warnings: Object.freeze([...candidate.timeAudit.warnings]),
            blockers: Object.freeze([...candidate.timeAudit.blockers])
          })
        : undefined
    }))
  );

  const computedStale = Boolean(
    frozenCandles.length &&
    staleAfterMs &&
    asOfMs - Date.parse(frozenCandles[frozenCandles.length - 1].closeTime) > staleAfterMs
  );
  const stale = sourceStale || computedStale;
  const warnings: string[] = [];
  const blockers: string[] = [];
  if (duplicateCount) warnings.push(`${duplicateCount} duplicate candle timestamp(s) were rejected.`);
  if (outOfOrderCount) warnings.push(`${outOfOrderCount} out-of-order candle transition(s) were sorted ascending.`);
  if (partialCandleCount) warnings.push(`${partialCandleCount} open or partial candle(s) were excluded.`);
  if (gapCount) warnings.push(`${gapCount} time gap(s) were detected; session-calendar classification is deferred.`);
  if (invalidOhlcCount) blockers.push(`${invalidOhlcCount} candle(s) failed finite positive OHLC validation.`);
  if (invalidVolumeCount) blockers.push(`${invalidVolumeCount} candle(s) failed volume validation.`);
  if (invalidTimestampCount) blockers.push(`${invalidTimestampCount} candle(s) had invalid or reversed timestamps.`);
  if (closureUnknownCount) blockers.push(`${closureUnknownCount} candle(s) lacked proof of closure.`);
  if (futureTimestampCount) blockers.push(`${futureTimestampCount} closed candle(s) exceeded the future-time tolerance.`);
  if (conflictingDuplicateCount) blockers.push(`${conflictingDuplicateCount} duplicate timestamp(s) had conflicting values.`);
  if (sourceStale) blockers.push("The source reported a stale feed state.");
  else if (computedStale) warnings.push("The last closed candle is stale for this query reference time.");
  if (!frozenCandles.length) blockers.push("No valid closed candles remain after validation.");
  if (missingTimeframes.length) warnings.push(`Missing timeframes: ${missingTimeframes.join(", ")}.`);

  const rejectedCount = candidates.length - frozenCandles.length;
  const degraded = duplicateCount > 0 ||
    outOfOrderCount > 0 ||
    partialCandleCount > 0 ||
    computedStale ||
    missingTimeframes.length > 0;
  const status = blockers.length
    ? "blocked" as const
    : degraded
      ? "degraded" as const
      : "eligible" as const;
  const diagnostics: Readonly<V2DataQualityDiagnostics> = Object.freeze({
    status,
    inputCount: candidates.length,
    candleCount: frozenCandles.length,
    rejectedCount,
    duplicateCount,
    conflictingDuplicateCount,
    outOfOrderCount,
    invalidOhlcCount,
    invalidVolumeCount,
    invalidTimestampCount,
    partialCandleCount,
    closureUnknownCount,
    futureTimestampCount,
    gapCount,
    stale,
    missingTimeframes: freezeStrings([...missingTimeframes]),
    warnings: freezeStrings(warnings),
    blockers: freezeStrings(blockers),
    repairPolicy: "reject_invalid_sort_ascending_deduplicate_identical" as const
  });
  return { candles: frozenCandles, diagnostics };
}
