import type { ActiveMt5ReadOnlyCandleFeed, Mt5ReadOnlyCandle } from "@/lib/integrations/mt5/mt5ReadOnlyTypes";
import { createMt5PushFeedGateway, type Mt5PushFeedGateway } from "./mt5PushFeedGateway";
import { loadMt5PushFeedStatusSnapshot } from "./mt5PushFeedStore";

const timeframeMilliseconds = (timeframe: string) => {
  const normalized = timeframe.trim().toLowerCase();
  const match = normalized.match(/^(\d+)(m|h|d|w)$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "m"
    ? 60_000
    : unit === "h"
      ? 3_600_000
      : unit === "d"
        ? 86_400_000
        : 604_800_000;
  return amount * multiplier;
};

const candleIsClosed = (candle: Mt5ReadOnlyCandle, timeframe: string, referenceTime: number) => {
  const duration = timeframeMilliseconds(timeframe);
  const openedAt = Date.parse(candle.timestamp);
  return Boolean(duration && Number.isFinite(openedAt) && openedAt + duration <= referenceTime);
};

export interface Mt5ReadOnlyClosedCandlePublishResult {
  publishedCount: number;
  skippedCount: number;
  lastPublishedTimestamp?: string;
  transport: "readonly_refresh_adapter";
}
/**
 * Turns the guarded MT5 read-only refresh result into closed-candle events.
 * The first call publishes only the latest closed candle, so mounting the app
 * never replays historical bars as new forward evidence.
 */
export function publishClosedMt5ReadOnlyCandles(
  feed: ActiveMt5ReadOnlyCandleFeed,
  options: {
    gateway?: Pick<Mt5PushFeedGateway, "receiveEvent">;
    previousTimestamp?: string;
    referenceTime?: string | number;
    maximumCatchUpCandles?: number;
  } = {}
): Mt5ReadOnlyClosedCandlePublishResult {
  const gateway = options.gateway ?? createMt5PushFeedGateway();
  const status = loadMt5PushFeedStatusSnapshot();
  const brokerSymbol = feed.brokerSymbol ?? feed.symbol;
  const sameSeries =
    status.activeSymbols.includes(brokerSymbol) &&
    status.activeTimeframes.some((timeframe) => timeframe.toLowerCase() === feed.timeframe.toLowerCase());
  const previousTimestamp = options.previousTimestamp ?? (sameSeries ? status.lastCandleTimestamp : undefined);
  const referenceCandidate = options.referenceTime ?? feed.latestQuote?.timestamp ?? Date.now();
  const referenceTime = typeof referenceCandidate === "number"
    ? referenceCandidate
    : Date.parse(referenceCandidate);
  const closed = feed.candles
    .filter((candle) => candleIsClosed(candle, feed.timeframe, Number.isFinite(referenceTime) ? referenceTime : Date.now()))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const eligible = previousTimestamp
    ? closed.filter((candle) => Date.parse(candle.timestamp) > Date.parse(previousTimestamp))
    : closed.slice(-1);
  const maximum = Math.max(1, Math.min(24, options.maximumCatchUpCandles ?? 12));
  const selected = eligible.slice(-maximum);
  let publishedCount = 0;
  let skippedCount = Math.max(0, eligible.length - selected.length);
  let lastPublishedTimestamp: string | undefined;

  for (const candle of selected) {
    const result = gateway.receiveEvent({
      type: "mt5.candle_closed",
      source: "mt5",
      brokerSymbol,
      requestedSymbol: feed.requestedSymbol,
      normalizedSymbol: feed.requestedSymbol,
      timeframe: feed.timeframe,
      serverTimestamp: candle.timestamp,
      candle: {
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        tickVolume: candle.tickVolume,
        spread: candle.spread
      }
    });
    if (result.accepted) {
      publishedCount += 1;
      lastPublishedTimestamp = candle.timestamp;
    } else {
      skippedCount += 1;
    }
  }

  return {
    publishedCount,
    skippedCount,
    lastPublishedTimestamp,
    transport: "readonly_refresh_adapter"
  };
}
