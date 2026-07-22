#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-candle-repository-diagnostic");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
  "src/lib/v2/candles/v2Mt5ReadOnlyAdapter.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });

const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const { createV2SourceIdentityFromMt5Feed, createV2Mt5ReadOnlyRepository } = await load("v2Mt5ReadOnlyAdapter");

const bridgeUrl = (process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341").replace(/\/$/, "");
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || process.env.MT5_READONLY_DEFAULT_SYMBOL || "USTECH";
const timeframe = process.env.MT5_READONLY_TEST_TIMEFRAME || "5m";
const requestedLimit = Math.min(1000, Math.max(1, Number(process.env.MT5_READONLY_TEST_LIMIT || 1000)));
const timeoutMs = Math.max(250, Number(process.env.MT5_READONLY_TEST_TIMEOUT_MS || 3000));
const endpoint = `${bridgeUrl}/candles?${new URLSearchParams({
  requestedSymbol,
  symbol: brokerSymbol,
  timeframe,
  limit: String(requestedLimit)
})}`;

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const output = (value) => console.log(JSON.stringify(value, null, 2));
const failClosed = (reason, details) => {
  output({
    status: "source_unavailable",
    bridgeUrl,
    requestedSymbol,
    brokerSymbol,
    timeframe,
    reason,
    details,
    rawCandlesPrinted: false,
    mutationEndpointsCalled: false,
    productionRuntimeChanged: false,
    authority
  });
  process.exit(0);
};

const toIso = (value) => {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const parsed = new Date(milliseconds);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
};

const toLegacyCandle = (candle) => {
  const timestamp = toIso(candle?.timestamp ?? candle?.time ?? candle?.openTime);
  if (!timestamp) return undefined;
  return {
    timestamp,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: candle.volume === undefined && candle.tickVolume === undefined
      ? undefined
      : Number(candle.volume ?? candle.tickVolume),
    providerTime: toIso(candle.providerTime ?? candle.serverTimestamp),
    receivedAt: toIso(candle.receivedAt)
  };
};

const fingerprintFor = (candles) => {
  if (candles.length === 0) return undefined;
  const first = candles[0];
  const last = candles.at(-1);
  return [
    candles.length,
    first.timestamp,
    Number(first.close).toFixed(8),
    last.timestamp,
    Number(last.close).toFixed(8)
  ].join("|");
};

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);
let response;
try {
  response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
} catch (error) {
  clearTimeout(timeout);
  failClosed("The local MT5 read-only wrapper did not respond.", error instanceof Error ? error.message : String(error));
}

if (!response) process.exit();
clearTimeout(timeout);

let payload;
try {
  payload = await response.json();
} catch {
  failClosed("The local MT5 read-only wrapper returned a non-JSON response.", `HTTP ${response.status}`);
}

if (!response.ok || !payload || typeof payload !== "object") {
  failClosed("The local MT5 read-only wrapper did not return usable market data.", `HTTP ${response.status}`);
}

const rawCandles = Array.isArray(payload.candles)
  ? payload.candles
  : Array.isArray(payload.candles?.candles)
    ? payload.candles.candles
    : [];
const candles = rawCandles.map(toLegacyCandle).filter(Boolean);
const candleFingerprint = fingerprintFor(candles);

if (!candleFingerprint) {
  failClosed("The local MT5 read-only wrapper returned no normalizable candles.", payload.connectionStatus ?? "unknown");
}

const feed = Object.freeze({
  feedId: `mt5:${brokerSymbol}:${timeframe}`,
  requestedSymbol,
  brokerSymbol,
  symbol: brokerSymbol,
  timeframe,
  candleFingerprint,
  candles,
  connectionStatus: payload.connectionStatus === "connected" ? "connected" : "degraded",
  fetchedAt: new Date().toISOString(),
  warnings: Array.isArray(payload.warnings) ? payload.warnings.map(String) : []
});
const source = createV2SourceIdentityFromMt5Feed(feed);
const repository = createV2Mt5ReadOnlyRepository({
  loadFeed: async (requestedSource) => requestedSource.sourceFingerprint === source.sourceFingerprint ? feed : undefined
});

try {
  const window = await repository.getWindow({
    source,
    timeframe,
    limit: requestedLimit,
    closedOnly: true,
    purpose: "current_read"
  });
  output({
    status: "available",
    bridgeUrl,
    requestedSymbol,
    brokerSymbol,
    timeframe,
    sourceFingerprint: window.identity.source.sourceFingerprint,
    candleCount: window.candles.length,
    firstCandleOpenTime: window.candles[0]?.openTime,
    lastCandleCloseTime: window.candles.at(-1)?.closeTime,
    dataQualityStatus: window.diagnostics.status,
    inputCount: window.diagnostics.inputCount,
    rejectedCount: window.diagnostics.rejectedCount,
    partialCandleCount: window.diagnostics.partialCandleCount,
    futureTimestampCount: window.diagnostics.futureTimestampCount,
    closureUnknownCount: window.diagnostics.closureUnknownCount,
    stale: window.diagnostics.stale,
    blockers: window.diagnostics.blockers,
    warnings: window.diagnostics.warnings,
    comparisonStatus: "insufficient_comparison_data",
    comparisonReason: "No independent push-feed snapshot was supplied to this bounded polling diagnostic.",
    shadowOnly: window.shadowOnly,
    repositoryCreatesEvidence: window.evidencePolicy.repositoryCreatesEvidence,
    rawCandlesPrinted: false,
    mutationEndpointsCalled: false,
    productionRuntimeChanged: false,
    authority: window.capability.authority
  });
} catch (error) {
  failClosed(
    "The V2 candle repository rejected the MT5 snapshot.",
    error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  );
}
