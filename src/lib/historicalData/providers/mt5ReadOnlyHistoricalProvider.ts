import { canonicalHash } from "../../canonical/canonicalValueSerialization";
import { HISTORICAL_DATASET_AUTHORITY_NONE } from "../historicalDatasetAuthority";
import type { HistoricalProviderTimeBasis } from "../historicalTimeNormalization";
import { historicalTimeframeMilliseconds } from "../historicalDatasetContracts";
import type {
  HistoricalDatasetProvider,
  HistoricalProviderDescription,
  HistoricalSourceCandle,
  HistoricalSourcePage,
  HistoricalSourcePageRequest,
  HistoricalTimeframe
} from "../historicalDatasetTypes";

const supportedTimeframes = Object.freeze<HistoricalTimeframe[]>([
  "1m", "5m", "15m", "1h", "4h", "1d", "1w"
]);

const mt5Timeframe: Record<HistoricalTimeframe, string> = {
  "1m": "M1",
  "5m": "M5",
  "15m": "M15",
  "1h": "H1",
  "4h": "H4",
  "1d": "D1",
  "1w": "W1"
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface Mt5ReadOnlyHistoricalProviderOptions {
  readonly baseUrl: string;
  readonly providerVersion: string;
  readonly providerTimeBasis: HistoricalProviderTimeBasis;
  readonly sourceIdentityFingerprint: string;
  readonly fetchImpl?: FetchLike;
  readonly requestTimeoutMs?: number;
  readonly maximumPageCandles?: number;
  readonly closedBarSafetyLagMs?: number;
  readonly now?: () => string;
}

const hashPattern = /^sha256:[0-9a-f]{64}$/;

const numberOrUndefined = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const assertLoopback = (value: string) => {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname)) {
    throw new Error("BT1 MT5 historical provider requires a loopback-only HTTP endpoint.");
  }
  return parsed.toString().replace(/\/$/, "");
};

const assertAuthorityNone = (payload: Record<string, unknown>) => {
  const nested = recordOrEmpty(payload.authority);
  const execution = payload.executionAuthority ?? nested.executionAuthority;
  const broker = payload.brokerAuthority ?? nested.brokerAuthority;
  const readiness = payload.readinessOverrideAuthority ?? nested.readinessOverrideAuthority;
  if (execution !== "none" || broker !== "none" || readiness !== "none") {
    throw new Error("BT1 MT5 historical response did not prove authority none/none/none.");
  }
};

const providerTime = (item: Record<string, unknown>, basis: HistoricalProviderTimeBasis) => {
  const rawTime = numberOrUndefined(item.rawTime ?? item.raw_time ?? item.time);
  const timestamp = item.timestamp ?? item.datetime ?? item.date;
  if (basis === "utc_iso" || basis === "iso_with_offset") return String(timestamp ?? "");
  return rawTime ?? String(timestamp ?? "");
};

const sourceCandle = (
  value: unknown,
  basis: HistoricalProviderTimeBasis,
  timeframeMs: number,
  closedCutoffMs: number
): HistoricalSourceCandle => {
  const item = recordOrEmpty(value);
  const openTime = providerTime(item, basis);
  const open = numberOrUndefined(item.open ?? item.o);
  const high = numberOrUndefined(item.high ?? item.h);
  const low = numberOrUndefined(item.low ?? item.l);
  const close = numberOrUndefined(item.close ?? item.c);
  if ([open, high, low, close].some((itemValue) => itemValue === undefined)) {
    throw new Error("BT1 MT5 historical response contained a candle without finite OHLC values.");
  }
  const normalizedOpenMs = typeof openTime === "number"
    ? (Math.abs(openTime) < 100_000_000_000 ? openTime * 1000 : openTime)
    : Date.parse(openTime);
  return Object.freeze({
    providerOpenTime: openTime,
    ...(Number.isFinite(normalizedOpenMs)
      ? { providerCloseTime: basis === "epoch_utc"
        ? Math.floor((normalizedOpenMs + timeframeMs) / 1000)
        : new Date(normalizedOpenMs + timeframeMs).toISOString() }
      : {}),
    open: open!,
    high: high!,
    low: low!,
    close: close!,
    ...(numberOrUndefined(item.volume ?? item.real_volume ?? item.tickVolume ?? item.tick_volume) === undefined
      ? {}
      : { volume: numberOrUndefined(item.volume ?? item.real_volume ?? item.tickVolume ?? item.tick_volume)! }),
    ...(numberOrUndefined(item.spread ?? item.spread_points) === undefined
      ? {}
      : { spreadPoints: numberOrUndefined(item.spread ?? item.spread_points)! }),
    isClosed: Number.isFinite(normalizedOpenMs) && normalizedOpenMs + timeframeMs <= closedCutoffMs
  });
};

export function createMt5ReadOnlyHistoricalProvider(
  options: Readonly<Mt5ReadOnlyHistoricalProviderOptions>
): Readonly<HistoricalDatasetProvider> {
  const baseUrl = assertLoopback(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  const maximumPageCandles = Math.min(5000, options.maximumPageCandles ?? 5000);
  const closedBarSafetyLagMs = options.closedBarSafetyLagMs ?? 1_000;
  const now = options.now ?? (() => new Date().toISOString());
  if (!options.providerVersion || options.providerTimeBasis === "unknown") {
    throw new Error("BT1 MT5 historical provider requires explicit version and time basis.");
  }
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error("BT1 MT5 historical provider timeout must be a positive integer.");
  }
  if (!Number.isInteger(maximumPageCandles) || maximumPageCandles <= 0) {
    throw new Error("BT1 MT5 historical provider page bound must be a positive integer.");
  }
  if (!hashPattern.test(options.sourceIdentityFingerprint)) {
    throw new Error("BT1 MT5 historical provider requires a canonical sourceIdentityFingerprint.");
  }
  if (!Number.isInteger(closedBarSafetyLagMs) || closedBarSafetyLagMs < 0) {
    throw new Error("BT1 MT5 historical provider closedBarSafetyLagMs must be a non-negative integer.");
  }
  let description: Promise<Readonly<HistoricalProviderDescription>> | undefined;

  const describe = () => description ??= (async () => Object.freeze({
    providerId: "mt5_read_only_historical",
    providerVersion: options.providerVersion,
    sourceFingerprint: await canonicalHash({
      adapter: "gotrader-bt1-mt5-read-only-provider-v1",
      baseUrl,
      endpoint: "/candles/range",
      providerTimeBasis: options.providerTimeBasis,
      sourceIdentityFingerprint: options.sourceIdentityFingerprint,
      supportedTimeframes,
      maximumPageCandles
    }),
    readOnly: true,
    marketDataOnly: true,
    supportedTimeframes,
    maximumPageCandles,
    authority: HISTORICAL_DATASET_AUTHORITY_NONE
  }))();

  const fetchPage = async (
    request: Readonly<HistoricalSourcePageRequest>
  ): Promise<Readonly<HistoricalSourcePage>> => {
    if (!supportedTimeframes.includes(request.timeframe)) {
      throw new Error(`BT1 MT5 historical timeframe is unsupported: ${request.timeframe}`);
    }
    if (!Number.isInteger(request.limit) || request.limit <= 0 || request.limit > maximumPageCandles) {
      throw new Error("BT1 MT5 historical page request exceeds the configured bound.");
    }
    const intervalMs = historicalTimeframeMilliseconds(request.timeframe);
    const startMs = Date.parse(request.cursor ?? request.startUtc);
    const endMs = Date.parse(request.endUtc);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
      throw new Error("BT1 MT5 historical page range is invalid.");
    }
    const lastEligibleOpenMs = endMs - intervalMs;
    const windowLastOpenMs = Math.min(lastEligibleOpenMs, startMs + (request.limit - 1) * intervalMs);
    const nextStartMs = startMs + request.limit * intervalMs;
    const url = new URL(`${baseUrl}/candles/range`);
    url.searchParams.set("requestedSymbol", request.requestedSymbol);
    url.searchParams.set("symbol", request.brokerSymbol);
    url.searchParams.set("timeframe", mt5Timeframe[request.timeframe]);
    url.searchParams.set("from", new Date(startMs).toISOString());
    url.searchParams.set("to", new Date(Math.max(startMs, windowLastOpenMs)).toISOString());
    url.searchParams.set("limit", String(request.limit));
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(url, Object.freeze({ method: "GET", signal: controller.signal }));
      if (!response.ok) throw new Error(`BT1 MT5 historical provider returned HTTP ${response.status}.`);
      const payload = recordOrEmpty(await response.json());
      assertAuthorityNone(payload);
      const sourceMethod = String(payload.sourceMethod ?? "");
      if (sourceMethod.includes("contract_stub") || sourceMethod.includes("disconnected")) {
        throw new Error("BT1 MT5 historical provider rejected a non-live historical source response.");
      }
      const rawCandles = Array.isArray(payload.candles) ? payload.candles : [];
      const closedCutoffMs = Date.parse(now()) - closedBarSafetyLagMs;
      if (!Number.isFinite(closedCutoffMs)) {
        throw new Error("BT1 MT5 historical provider reference clock is invalid.");
      }
      const candles = Object.freeze(rawCandles.map((item) =>
        sourceCandle(item, options.providerTimeBasis, intervalMs, closedCutoffMs)));
      const provider = await describe();
      const warnings = Object.freeze([
        ...(Array.isArray(payload.warnings) ? payload.warnings.map(String) : []),
        ...(Array.isArray(payload.missingEvidence) ? payload.missingEvidence.map(String) : [])
      ].sort());
      return Object.freeze({
        providerId: provider.providerId,
        providerVersion: provider.providerVersion,
        requestedSymbol: request.requestedSymbol,
        brokerSymbol: request.brokerSymbol,
        timeframe: request.timeframe,
        ...(request.cursor ? { cursor: request.cursor } : {}),
        ...(nextStartMs < endMs ? { nextCursor: new Date(nextStartMs).toISOString() } : {}),
        candles,
        warnings,
        authority: HISTORICAL_DATASET_AUTHORITY_NONE
      });
    } finally {
      globalThis.clearTimeout(timeout);
    }
  };

  return Object.freeze({ describe, fetchPage });
}
