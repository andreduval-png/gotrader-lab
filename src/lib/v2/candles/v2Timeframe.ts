import { V2CandleRepositoryError } from "./v2CandleTypes";

const aliases: Record<string, string> = {
  "1": "1m",
  M1: "1m",
  "1M": "1m",
  "1MIN": "1m",
  "1MINUTE": "1m",
  "5": "5m",
  M5: "5m",
  "5M": "5m",
  "5MIN": "5m",
  "5MINUTE": "5m",
  "15": "15m",
  M15: "15m",
  "15M": "15m",
  "15MIN": "15m",
  "15MINUTE": "15m",
  "30": "30m",
  M30: "30m",
  "30M": "30m",
  "60": "1h",
  H1: "1h",
  "1H": "1h",
  "240": "4h",
  H4: "4h",
  "4H": "4h",
  D1: "1d",
  "1D": "1d",
  W1: "1w",
  "1W": "1w"
};

const milliseconds: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000
};

export function normalizeV2Timeframe(value: string) {
  const raw = String(value ?? "").trim();
  const normalized = milliseconds[raw] ? raw : aliases[raw] ?? aliases[raw.toUpperCase()];
  if (!normalized || !milliseconds[normalized]) {
    throw new V2CandleRepositoryError("timeframe_unavailable", `Unsupported V2 timeframe: ${raw || "missing"}`);
  }
  return normalized;
}

export function v2TimeframeMilliseconds(value: string) {
  return milliseconds[normalizeV2Timeframe(value)];
}
