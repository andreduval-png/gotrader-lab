#!/usr/bin/env node

const baseUrl = (process.env.MT5_READONLY_UPSTREAM_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const request = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000)
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

const health = await request("/health");
const candles = await request("/api/v1/market/candles/latest?symbol_name=USTECH&timeframe=M5&count=3");
const blockedGetPaths = ["/account", "/orders", "/positions", "/deals", "/trade/history"];
const blockedGetResults = await Promise.all(blockedGetPaths.map((path) => request(path)));
const blockedMutationResults = await Promise.all(
  ["POST", "PUT", "PATCH", "DELETE"].map((method) => request("/api/v1/market/candles/latest", { method }))
);

const healthAuthority = Object.entries(authority).every(([key, value]) => health.payload?.[key] === value);
const healthIsNonBlocking =
  health.payload?.processHealth === "healthy" &&
  health.payload?.terminalProbe === "cached";
const candlesValid =
  Array.isArray(candles.payload) &&
  candles.payload.length > 0 &&
  candles.payload.every(
    (candle) =>
      candle &&
      typeof candle.timestamp === "string" &&
      Number.isFinite(Number(candle.open)) &&
      Number.isFinite(Number(candle.high)) &&
      Number.isFinite(Number(candle.low)) &&
      Number.isFinite(Number(candle.close))
  );
const blockedGet = blockedGetResults.every(({ response, payload }) => response.status === 403 && payload?.executionAuthority === "none");
const blockedMutation = blockedMutationResults.every(
  ({ response, payload }) => response.status === 403 && payload?.executionAuthority === "none"
);
const serialized = JSON.stringify({ health: health.payload, candleSample: candles.payload?.slice?.(0, 1) });
const sensitiveFieldsAbsent = !/(password|apiKey|token|account|order|position|deal)/i.test(serialized);

const result = {
  passed:
    health.response.ok &&
    health.payload?.connectionStatus === "connected" &&
    health.payload?.readOnly === true &&
    health.payload?.marketDataOnly === true &&
    healthIsNonBlocking &&
    healthAuthority &&
    candles.response.ok &&
    candlesValid &&
    blockedGet &&
    blockedMutation &&
    sensitiveFieldsAbsent,
  baseUrl,
  connectionStatus: health.payload?.connectionStatus,
  candleCount: Array.isArray(candles.payload) ? candles.payload.length : 0,
  checks: {
    healthAuthority,
    healthIsNonBlocking,
    candlesValid,
    blockedGet,
    blockedMutation,
    sensitiveFieldsAbsent
  },
  authority
};

console.log(JSON.stringify(result, null, 2));
process.exitCode = result.passed ? 0 : 1;
