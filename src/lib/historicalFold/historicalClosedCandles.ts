import type { Candle, Timeframe } from "@/lib/types";

const durationMs: Partial<Record<Timeframe, number>> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000, "1h": 3_600_000,
  "4h": 14_400_000, "1d": 86_400_000
};

// Certified timestamps are bar opens. A bar is usable only after its full period.
export const historicalClosedCandlesAt = (candles: readonly Candle[], timeframe: Timeframe, asOf: string) => {
  const duration = durationMs[timeframe];
  const time = Date.parse(asOf);
  if (!duration || !Number.isFinite(time)) throw new Error("HISTORICAL_CLOSE_TIME_UNAVAILABLE");
  return candles.filter((bar) => {
    const open = Date.parse(bar.timestamp);
    const explicitClose = (bar as Candle & { closeTimeUtc?: string }).closeTimeUtc;
    const close = explicitClose === undefined ? open + duration : Date.parse(explicitClose);
    if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) {
      throw new Error("HISTORICAL_CLOSE_TIME_INVALID");
    }
    return close <= time;
  });
};
