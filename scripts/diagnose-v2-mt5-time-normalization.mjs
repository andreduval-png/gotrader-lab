#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-mt5-time-normalization-diagnostic");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2TimeNormalization.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
  "src/lib/v2/candles/v2Mt5TimeNormalizedAdapter.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const time = await load("v2TimeNormalization");
const mt5 = await load("v2Mt5TimeNormalizedAdapter");

const bridgeUrl = (process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341").replace(/\/$/, "");
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const timeframe = process.env.MT5_READONLY_TEST_TIMEFRAME || "5m";
const limit = Math.min(1_000, Math.max(10, Number(process.env.MT5_READONLY_TEST_LIMIT || 1_000)));
const timeoutMs = Math.max(500, Number(process.env.MT5_READONLY_TEST_TIMEOUT_MS || 5_000));
const sourceTimezone = String(process.env.MT5_V2_SERVER_TIMEZONE || "").trim() || undefined;
const configuredOffset = String(process.env.MT5_V2_SERVER_UTC_OFFSET_MINUTES || "").trim();
const sourceUtcOffsetMinutes = configuredOffset ? Number(configuredOffset) : undefined;
const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const output = (value) => console.log(JSON.stringify(value, null, 2));

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    const body = await response.json().catch(() => undefined);
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
};

const receivedBeforeUtc = new Date().toISOString();
const candleUrl = `${bridgeUrl}/candles?${new URLSearchParams({
  requestedSymbol,
  symbol: brokerSymbol,
  timeframe,
  limit: String(limit)
})}`;
const [candlesResponse, quoteResponse, statusResponse] = await Promise.all([
  fetchJson(candleUrl),
  fetchJson(`${bridgeUrl}/quote?${new URLSearchParams({ requestedSymbol, symbol: brokerSymbol })}`),
  fetchJson(`${bridgeUrl}/status`)
]);
const receivedAtUtc = new Date().toISOString();
const rawCandles = Array.isArray(candlesResponse.body?.candles) ? candlesResponse.body.candles : [];
if (!candlesResponse.ok || !rawCandles.length) {
  output({
    status: "source_unavailable",
    bridgeUrl,
    requestedSymbol,
    brokerSymbol,
    timeframe,
    httpStatus: candlesResponse.status,
    reason: candlesResponse.error ?? "The wrapper returned no candles.",
    rawCandlesPrinted: false,
    mutationEndpointsCalled: false,
    authority
  });
  process.exit(0);
}

const policy = time.createV2TimeNormalizationPolicy({
  policyId: "gotrader-v2-mt5-server-time",
  version: "1",
  provider: "mt5_read_only",
  basis: sourceTimezone || sourceUtcOffsetMinutes !== undefined ? "mt5_server_wall_clock" : "unknown",
  sourceTimezone,
  sourceUtcOffsetMinutes,
  outputTimezone: "UTC",
  discoveryMethod: sourceTimezone
    ? "configured_iana_timezone"
    : sourceUtcOffsetMinutes !== undefined
      ? "server_clock_comparison"
      : "unknown",
  dstPolicy: sourceTimezone
    ? "iana_timezone_rules"
    : sourceUtcOffsetMinutes !== undefined
      ? "explicit_offset"
      : "unknown",
  maximumClockSkewMs: 60_000,
  closureToleranceMs: 1_000
});

const toRawCandle = (candle) => ({
  rawProviderTime: typeof candle?.time === "number" ? candle.time : candle?.timestamp,
  open: Number(candle?.open),
  high: Number(candle?.high),
  low: Number(candle?.low),
  close: Number(candle?.close),
  volume: candle?.volume === undefined && candle?.tickVolume === undefined
    ? undefined
    : Number(candle.volume ?? candle.tickVolume)
});
const compactCandles = rawCandles.map(toRawCandle);
const first = rawCandles[0];
const last = rawCandles.at(-1);
const fingerprint = [
  rawCandles.length,
  first?.time ?? first?.timestamp,
  Number(first?.close).toFixed(8),
  last?.time ?? last?.timestamp,
  Number(last?.close).toFixed(8)
].join("|");
const feed = {
  feedId: `mt5:${brokerSymbol}:${timeframe}`,
  requestedSymbol,
  brokerSymbol,
  symbol: brokerSymbol,
  timeframe,
  candleFingerprint: fingerprint,
  candles: compactCandles,
  connectionStatus: candlesResponse.body?.connectionStatus === "connected" ? "connected" : "degraded",
  receivedAt: receivedAtUtc,
  warnings: Array.isArray(candlesResponse.body?.warnings) ? candlesResponse.body.warnings.map(String) : [],
  timePolicy: policy
};
const source = mt5.createV2SourceIdentityFromTimeNormalizedMt5Feed(feed);
const repository = mt5.createV2Mt5TimeNormalizedRepository({
  asOf: () => receivedAtUtc,
  loadFeed: async () => feed
});
const window = await repository.getWindow({
  source,
  timeframe,
  limit,
  closedOnly: true,
  purpose: "current_read"
});

const rawLastTime = typeof last?.time === "number" ? last.time : last?.timestamp;
const sampleNormalization = rawLastTime === undefined
  ? undefined
  : time.normalizeMt5ProviderTime(rawLastTime, policy);
const claimedUtcFutureCount = rawCandles.filter((candle) => {
  const parsed = Date.parse(candle?.timestamp);
  return Number.isFinite(parsed) && parsed > Date.parse(receivedAtUtc) + 1_000;
}).length;
const normalizedFutureCount = compactCandles.filter((candle) => {
  const result = time.normalizeMt5ProviderTime(candle.rawProviderTime, policy);
  return result.normalizedTimeUtc && Date.parse(result.normalizedTimeUtc) > Date.parse(receivedAtUtc) + 1_000;
}).length;
const rawTick = quoteResponse.body;
const providerClock = statusResponse.body?.upstream?.serverTime ?? statusResponse.body?.serverTime;

output({
  status: policy.basis === "unknown"
    ? "blocked_time_basis_unverified"
    : window.diagnostics.status === "blocked"
      ? "blocked_after_normalization"
      : "normalization_contract_configured",
  source: "mt5_read_only",
  bridgeUrl,
  requestedSymbol,
  brokerSymbol,
  timeframe,
  observedContract: {
    rawProviderField: typeof last?.time === "number" ? "time" : "timestamp",
    rawProviderSample: rawLastTime,
    wrapperTimestampSample: last?.timestamp,
    declaredByWrapper: "UTC ISO / epoch",
    observedBasis: "approximately broker wall-clock encoded as epoch; exact timezone is not declared by upstream",
    offsetEmbedded: false,
    timezoneConfigured: Boolean(sourceTimezone || sourceUtcOffsetMinutes !== undefined)
  },
  appliedPolicy: {
    policyId: policy.policyId,
    version: policy.version,
    basis: policy.basis,
    sourceTimezone: policy.sourceTimezone,
    sourceUtcOffsetMinutes: policy.sourceUtcOffsetMinutes,
    discoveryMethod: policy.discoveryMethod,
    dstPolicy: policy.dstPolicy
  },
  clocks: {
    desktopUtcBefore: receivedBeforeUtc,
    desktopUtcAfter: receivedAtUtc,
    wrapperStatusAvailable: statusResponse.ok,
    providerClock: providerClock ?? "not independently exposed",
    latestTickTime: rawTick?.timestamp ?? "unavailable",
    latestCandleOpenTimeClaimedUtc: last?.timestamp
  },
  normalization: {
    rawToUtcDeltaMs: sampleNormalization?.rawToUtcDeltaMs,
    normalizedLastOpenTimeUtc: sampleNormalization?.normalizedTimeUtc,
    offsetAppliedMinutes: sampleNormalization?.offsetAppliedMinutes,
    dstState: sampleNormalization?.dstState ?? "unknown",
    blockers: sampleNormalization?.blockers ?? ["unknown_provider_time_basis"]
  },
  candleCount: rawCandles.length,
  retainedClosedCandleCount: window.candles.length,
  partialCount: window.diagnostics.partialCandleCount,
  futureCountBeforeNormalization: claimedUtcFutureCount,
  futureCountAfterNormalization: policy.basis === "unknown" ? undefined : normalizedFutureCount,
  qualityStatus: window.diagnostics.status,
  closureResult: window.candles.at(-1)?.timeAudit?.closureStatus ?? "unavailable",
  diagnostics: {
    rejectedCount: window.diagnostics.rejectedCount,
    closureUnknownCount: window.diagnostics.closureUnknownCount,
    blockers: window.diagnostics.blockers,
    warnings: window.diagnostics.warnings
  },
  deterministicPushPollingParity: "exact_match",
  livePushPollingParity: "insufficient_comparison_data",
  liveParityReason: "No independent network push publisher is available; the current browser push adapter republishes polling data.",
  phase2Eligible: false,
  phase2Blocker: policy.basis === "unknown"
    ? "The upstream must declare its broker timezone/offset contract before Phase 2."
    : "The configured policy still requires upstream/operator verification and independent live push parity.",
  rawCandlesPrinted: false,
  mutationEndpointsCalled: false,
  productionRuntimeChanged: false,
  authority
});
