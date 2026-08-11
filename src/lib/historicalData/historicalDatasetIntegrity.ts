import { canonicalHash, canonicalSerialize } from "../canonical/canonicalValueSerialization";
import { HISTORICAL_DATASET_AUTHORITY_NONE } from "./historicalDatasetAuthority";
import {
  normalizeHistoricalProviderTime,
  type HistoricalTimeNormalizationPolicy
} from "./historicalTimeNormalization";
import { historicalTimeframeMilliseconds } from "./historicalDatasetContracts";
import {
  HISTORICAL_INTEGRITY_SCHEMA_ID,
  HISTORICAL_INTEGRITY_SCHEMA_VERSION,
  type HistoricalClosedInterval,
  type HistoricalIntegrityEvent,
  type HistoricalIntegrityEventKind,
  type HistoricalIntegrityLedger,
  type HistoricalIntegritySummary,
  type HistoricalMarketCalendarSnapshot,
  type HistoricalNormalizedCandle,
  type HistoricalSourceCandle,
  type HistoricalTimeframe
} from "./historicalDatasetTypes";

const unique = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const event = async (input: Omit<HistoricalIntegrityEvent, "eventId">) =>
  Object.freeze({ ...input, eventId: await canonicalHash(input) });

const finitePositive = (value: number) => Number.isFinite(value) && value > 0;

export async function normalizeHistoricalSourceCandles(input: {
  readonly candles: readonly HistoricalSourceCandle[];
  readonly timeframe: HistoricalTimeframe;
  readonly timePolicy: Readonly<HistoricalTimeNormalizationPolicy>;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly nowUtc: string;
}): Promise<{
  readonly candles: readonly Readonly<HistoricalNormalizedCandle>[];
  readonly events: readonly Readonly<HistoricalIntegrityEvent>[];
}> {
  const accepted: HistoricalNormalizedCandle[] = [];
  const events: HistoricalIntegrityEvent[] = [];
  const intervalMs = historicalTimeframeMilliseconds(input.timeframe);
  const startMs = Date.parse(input.startUtc);
  const endMs = Date.parse(input.endUtc);
  const nowMs = Date.parse(input.nowUtc);
  for (const source of input.candles) {
    const normalizedOpen = normalizeHistoricalProviderTime(source.providerOpenTime, input.timePolicy);
    const normalizedClose = source.providerCloseTime === undefined
      ? undefined
      : normalizeHistoricalProviderTime(source.providerCloseTime, input.timePolicy);
    if (
      normalizedOpen.status !== "normalized" ||
      !normalizedOpen.normalizedTimeUtc ||
      (normalizedClose && (normalizedClose.status !== "normalized" || !normalizedClose.normalizedTimeUtc))
    ) {
      events.push(await event({
        kind: "time_normalization_blocked",
        timeframe: input.timeframe,
        blocking: true,
        details: unique([
          ...normalizedOpen.blockers,
          ...(normalizedClose?.blockers ?? [])
        ])
      }));
      continue;
    }
    const openMs = Date.parse(normalizedOpen.normalizedTimeUtc);
    const closeMs = normalizedClose?.normalizedTimeUtc
      ? Date.parse(normalizedClose.normalizedTimeUtc)
      : openMs + intervalMs;
    const openTimeUtc = new Date(openMs).toISOString();
    const closeTimeUtc = new Date(closeMs).toISOString();
    if (!Number.isFinite(openMs) || !Number.isFinite(closeMs) || closeMs <= openMs) {
      events.push(await event({
        kind: "invalid_timestamp",
        timeframe: input.timeframe,
        openTimeUtc,
        endTimeUtc: closeTimeUtc,
        blocking: true,
        details: Object.freeze(["Historical candle close must follow open."])
      }));
      continue;
    }
    if (source.isClosed !== true) {
      events.push(await event({
        kind: "partial_bar",
        timeframe: input.timeframe,
        openTimeUtc,
        endTimeUtc: closeTimeUtc,
        blocking: true,
        details: Object.freeze(["Historical candle lacked explicit closed status."])
      }));
      continue;
    }
    if (closeMs > nowMs) {
      events.push(await event({
        kind: "future_bar",
        timeframe: input.timeframe,
        openTimeUtc,
        endTimeUtc: closeTimeUtc,
        blocking: true,
        details: Object.freeze(["Historical candle closes after the repository reference clock."])
      }));
      continue;
    }
    if (openMs < startMs || openMs >= endMs || closeMs > endMs + intervalMs) {
      events.push(await event({
        kind: "out_of_range_bar",
        timeframe: input.timeframe,
        openTimeUtc,
        endTimeUtc: closeTimeUtc,
        blocking: false,
        details: Object.freeze(["Provider candle was outside the requested half-open range."])
      }));
      continue;
    }
    if (
      ![source.open, source.high, source.low, source.close].every(finitePositive) ||
      source.high < Math.max(source.open, source.close) ||
      source.low > Math.min(source.open, source.close) ||
      source.low > source.high
    ) {
      events.push(await event({
        kind: "invalid_ohlc",
        timeframe: input.timeframe,
        openTimeUtc,
        endTimeUtc: closeTimeUtc,
        blocking: true,
        details: Object.freeze(["Historical candle failed finite positive OHLC geometry."])
      }));
      continue;
    }
    if (source.volume !== undefined && (!Number.isFinite(source.volume) || source.volume < 0)) {
      events.push(await event({
        kind: "invalid_volume",
        timeframe: input.timeframe,
        openTimeUtc,
        endTimeUtc: closeTimeUtc,
        blocking: true,
        details: Object.freeze(["Historical candle volume must be finite and non-negative."])
      }));
      continue;
    }
    if (source.spreadPoints !== undefined && (!Number.isFinite(source.spreadPoints) || source.spreadPoints < 0)) {
      events.push(await event({
        kind: "invalid_spread",
        timeframe: input.timeframe,
        openTimeUtc,
        endTimeUtc: closeTimeUtc,
        blocking: true,
        details: Object.freeze(["Historical candle spread must be finite and non-negative."])
      }));
      continue;
    }
    accepted.push(Object.freeze({
      openTimeUtc,
      closeTimeUtc,
      open: source.open,
      high: source.high,
      low: source.low,
      close: source.close,
      ...(source.volume === undefined ? {} : { volume: source.volume }),
      ...(source.spreadPoints === undefined ? {} : { spreadPoints: source.spreadPoints })
    }));
  }
  return Object.freeze({ candles: Object.freeze(accepted), events: Object.freeze(events) });
}

const intervalBounds = (value: HistoricalClosedInterval) => ({
  value,
  start: Date.parse(value.startUtc),
  end: Date.parse(value.endUtc)
});

const classifyExpectedClosure = (
  startMs: number,
  endMs: number,
  calendar: Readonly<HistoricalMarketCalendarSnapshot>
) => {
  if (calendar.verificationStatus !== "verified") return undefined;
  const intervals = calendar.closedIntervals
    .map(intervalBounds)
    .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > startMs && entry.start < endMs)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let cursor = startMs;
  const reasons = new Set<HistoricalClosedInterval["reason"]>();
  for (const entry of intervals) {
    if (entry.start > cursor) return undefined;
    if (entry.end > cursor) {
      cursor = entry.end;
      reasons.add(entry.value.reason);
    }
    if (cursor >= endMs) break;
  }
  if (cursor < endMs) return undefined;
  return reasons.size === 1 ? [...reasons][0] : "maintenance";
};

const countKinds = (
  events: readonly Readonly<HistoricalIntegrityEvent>[],
  kind: HistoricalIntegrityEventKind
) => events.filter((item) => item.kind === kind).length;

export async function buildHistoricalIntegrityLedger(input: {
  readonly requestId: string;
  readonly timeframe: HistoricalTimeframe;
  readonly candles: readonly Readonly<HistoricalNormalizedCandle>[];
  readonly sourceEvents: readonly Readonly<HistoricalIntegrityEvent>[];
  readonly calendar: Readonly<HistoricalMarketCalendarSnapshot>;
}): Promise<{
  readonly candles: readonly Readonly<HistoricalNormalizedCandle>[];
  readonly ledger: Readonly<HistoricalIntegrityLedger>;
}> {
  const events: HistoricalIntegrityEvent[] = [...input.sourceEvents];
  const alreadyOrdered = input.candles.every((candle, index) =>
    index === 0 || Date.parse(input.candles[index - 1].openTimeUtc) <= Date.parse(candle.openTimeUtc));
  const sorted = alreadyOrdered
    ? input.candles
    : [...input.candles].sort(
      (left, right) => Date.parse(left.openTimeUtc) - Date.parse(right.openTimeUtc)
    );
  const canonical: HistoricalNormalizedCandle[] = [];
  for (const candle of sorted) {
    const previous = canonical.at(-1);
    if (previous?.openTimeUtc === candle.openTimeUtc) {
      const same = canonicalSerialize(previous) === canonicalSerialize(candle);
      events.push(await event({
        kind: same ? "duplicate" : "conflicting_duplicate",
        timeframe: input.timeframe,
        openTimeUtc: candle.openTimeUtc,
        endTimeUtc: candle.closeTimeUtc,
        blocking: !same,
        details: Object.freeze([same
          ? "Identical duplicate was coalesced."
          : "Duplicate open time contained conflicting normalized values."])
      }));
      continue;
    }
    canonical.push(candle);
  }
  const intervalMs = historicalTimeframeMilliseconds(input.timeframe);
  let missingBarCount = 0;
  for (let index = 1; index < canonical.length; index += 1) {
    const previous = canonical[index - 1];
    const current = canonical[index];
    const previousOpen = Date.parse(previous.openTimeUtc);
    const currentOpen = Date.parse(current.openTimeUtc);
    const distance = currentOpen - previousOpen;
    if (distance <= intervalMs) continue;
    const missing = Math.max(1, Math.round(distance / intervalMs) - 1);
    missingBarCount += missing;
    const gapStart = previousOpen + intervalMs;
    const reason = classifyExpectedClosure(gapStart, currentOpen, input.calendar);
    events.push(await event({
      kind: reason ? "expected_closure_gap" : "unclassified_gap",
      timeframe: input.timeframe,
      openTimeUtc: new Date(gapStart).toISOString(),
      endTimeUtc: current.openTimeUtc,
      blocking: !reason,
      ...(reason ? { classification: reason } : { classification: "unclassified" as const }),
      details: Object.freeze([`${missing} expected interval(s) contain no candle.`])
    }));
  }
  const orderedEvents = Object.freeze([...events].sort((left, right) =>
    String(left.openTimeUtc ?? "").localeCompare(String(right.openTimeUtc ?? "")) ||
    left.kind.localeCompare(right.kind) ||
    left.eventId.localeCompare(right.eventId)
  ));
  const blockingEvents = orderedEvents.filter((item) => item.blocking);
  const warnings = unique([
    countKinds(orderedEvents, "duplicate") ? "identical_duplicates_coalesced" : "",
    countKinds(orderedEvents, "expected_closure_gap") ? "verified_market_closures_present" : "",
    countKinds(orderedEvents, "out_of_range_bar") ? "out_of_range_provider_bars_excluded" : "",
    input.calendar.verificationStatus !== "verified" ? "market_calendar_unverified" : ""
  ]);
  const blockers = unique([
    ...blockingEvents.map((item) => `integrity_${item.kind}`),
    input.calendar.verificationStatus !== "verified" && countKinds(orderedEvents, "unclassified_gap")
      ? "unclassified_gaps_with_unverified_calendar"
      : ""
  ]);
  const summary: HistoricalIntegritySummary = Object.freeze({
    status: blockers.length ? "blocked" : warnings.length ? "accepted_with_warnings" : "accepted",
    inputCandleCount: input.candles.length + input.sourceEvents.length,
    canonicalCandleCount: canonical.length,
    duplicateCount: countKinds(orderedEvents, "duplicate"),
    conflictingDuplicateCount: countKinds(orderedEvents, "conflicting_duplicate"),
    missingBarCount,
    expectedClosureGapCount: countKinds(orderedEvents, "expected_closure_gap"),
    unclassifiedGapCount: countKinds(orderedEvents, "unclassified_gap"),
    futureBarCount: countKinds(orderedEvents, "future_bar"),
    outOfRangeBarCount: countKinds(orderedEvents, "out_of_range_bar"),
    invalidTimestampCount: countKinds(orderedEvents, "invalid_timestamp"),
    invalidOhlcCount: countKinds(orderedEvents, "invalid_ohlc"),
    invalidVolumeCount: countKinds(orderedEvents, "invalid_volume"),
    invalidSpreadCount: countKinds(orderedEvents, "invalid_spread"),
    partialBarCount: countKinds(orderedEvents, "partial_bar"),
    timeNormalizationBlockedCount: countKinds(orderedEvents, "time_normalization_blocked"),
    blockers,
    warnings
  });
  const core = {
    schemaId: HISTORICAL_INTEGRITY_SCHEMA_ID as typeof HISTORICAL_INTEGRITY_SCHEMA_ID,
    version: HISTORICAL_INTEGRITY_SCHEMA_VERSION as typeof HISTORICAL_INTEGRITY_SCHEMA_VERSION,
    requestId: input.requestId,
    events: orderedEvents,
    summary,
    authority: HISTORICAL_DATASET_AUTHORITY_NONE
  };
  const ledger = Object.freeze({ ...core, ledgerId: await canonicalHash(core) });
  return Object.freeze({ candles: Object.freeze(canonical), ledger });
}
