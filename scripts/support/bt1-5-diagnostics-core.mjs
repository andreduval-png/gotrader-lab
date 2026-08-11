import { authorityNone, compactJson, requireAuthorityNone } from "./bt1-5-qualification-runtime.mjs";

const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const firstDefined = (value, keys) => {
  const source = record(value);
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
};

const compactAuthority = (payload) => {
  const source = record(payload);
  const nested = record(source.authority);
  const result = Object.freeze(compactJson({
    executionAuthority: source.executionAuthority ?? nested.executionAuthority,
    brokerAuthority: source.brokerAuthority ?? nested.brokerAuthority,
    readinessOverrideAuthority: source.readinessOverrideAuthority ?? nested.readinessOverrideAuthority
  }));
  requireAuthorityNone(result, "diagnostic response authority");
  return result;
};

async function fetchJson(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { method: "GET", signal: controller.signal });
    const payload = record(await response.json());
    if (!response.ok) throw new Error(`BT1.5 diagnostic GET ${new URL(url).pathname} returned HTTP ${response.status}.`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

const compactService = (payload) => {
  const connectionState = String(firstDefined(payload, [
    "terminalConnectionState",
    "connectionState",
    "connectionStatus"
  ]) ?? "unknown");
  return Object.freeze({
    status: String(firstDefined(payload, ["status", "state", "processHealth", "connectionStatus"]) ?? "unknown"),
    connected: firstDefined(payload, ["connected", "terminalConnected"]) === true || connectionState === "connected",
    terminalConnectionState: connectionState,
    sourceMethod: String(firstDefined(payload, ["sourceMethod", "source", "upstreamSource"]) ?? "unknown"),
    authority: compactAuthority(payload)
  });
};

const compactTimeContract = (payload) => {
  const verificationStatus = String(firstDefined(payload, ["verificationStatus"]) ?? "unknown");
  const verificationScope = String(firstDefined(payload, ["timeVerificationScope", "verificationScope"]) ?? "none");
  const historicalDstVerified = firstDefined(payload, [
    "historicalDstVerified",
    "historicalDstPolicyVerified"
  ]) === true;
  return Object.freeze({
    providerTimeBasis: String(firstDefined(payload, ["providerTimeBasis", "basis", "historicalTimeBasis"]) ?? "unknown"),
    timezone: firstDefined(payload, ["timezone", "providerTimezone", "sourceTimezone"]) ?? null,
    fixedOffsetMinutes: firstDefined(payload, ["fixedOffsetMinutes", "observedOffsetMinutes"]) ?? null,
    historicalTimeVerified: firstDefined(payload, ["historicalTimeVerified"]) === true ||
      (verificationStatus === "verified" && verificationScope === "historical"),
    historicalDstVerified,
    verificationVersion: String(firstDefined(payload, ["verificationVersion", "contractVersion", "version"]) ?? "unknown"),
    sourceMethod: String(firstDefined(payload, ["sourceMethod", "source"]) ?? "unknown"),
    authority: compactAuthority(payload)
  });
};

const symbolList = (payload) => Array.isArray(payload)
  ? payload
  : Array.isArray(payload.symbols) ? payload.symbols : [];

const compactSymbol = (symbolsPayload, symbolInfoPayload, brokerSymbol) => {
  const listedItem = symbolList(symbolsPayload).find((candidate) =>
    String(record(candidate).symbol ?? record(candidate).name ?? candidate) === brokerSymbol);
  const listed = listedItem !== undefined;
  const listedMetadata = record(listedItem);
  const observedMetadata = record(record(symbolInfoPayload).symbolInfo);
  const item = Object.keys(observedMetadata).length ? observedMetadata : listedMetadata;
  const digits = firstDefined(item, ["digits"]);
  const pointSize = firstDefined(item, ["point", "pointSize"]);
  return Object.freeze({
    found: listed && Object.keys(item).length > 0 && digits !== undefined && pointSize !== undefined,
    brokerSymbol,
    digits: digits ?? null,
    pointSize: pointSize ?? null,
    tickSize: firstDefined(item, ["trade_tick_size", "tickSize"]) ?? null,
    tickValue: firstDefined(item, ["trade_tick_value", "tickValue"]) ?? null,
    tradeContractSize: firstDefined(item, ["trade_contract_size", "tradeContractSize"]) ?? null,
    volumeMinLots: firstDefined(item, ["volume_min", "volumeMin"]) ?? null,
    volumeMaxLots: firstDefined(item, ["volume_max", "volumeMax"]) ?? null,
    volumeStepLots: firstDefined(item, ["volume_step", "volumeStep"]) ?? null,
    spreadPoints: firstDefined(item, ["spread", "spreadPoints"]) ?? null,
    spreadFloat: firstDefined(item, ["spread_float", "spreadFloat"]) ?? null,
    authority: compactAuthority(symbolInfoPayload)
  });
};

const rawTime = (value) => {
  const item = record(value);
  return firstDefined(item, ["rawTime", "raw_time", "timestamp", "datetime", "date", "time"]);
};

const timestampMilliseconds = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
  }
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const compactWindow = (payload, window) => {
  const candles = Array.isArray(payload.candles) ? payload.candles : [];
  const requestedFrom = new Date(window.fromUtc).toISOString();
  const requestedTo = new Date(window.toUtc).toISOString();
  const requestedFromMs = Date.parse(requestedFrom);
  const requestedToMs = Date.parse(requestedTo);
  const outOfRangeCandleCount = candles.filter((candle) => {
    const observed = timestampMilliseconds(rawTime(candle));
    return !Number.isFinite(observed) || observed < requestedFromMs || observed >= requestedToMs;
  }).length;
  return Object.freeze({
    period: window.period,
    requestedFromUtc: requestedFrom,
    requestedToUtc: requestedTo,
    candleCount: candles.length,
    outOfRangeCandleCount,
    firstRawProviderTime: candles.length ? rawTime(candles[0]) ?? null : null,
    lastRawProviderTime: candles.length ? rawTime(candles.at(-1)) ?? null : null,
    sourceMethod: String(firstDefined(payload, ["sourceMethod", "source"]) ?? "unknown"),
    warnings: Object.freeze(Array.isArray(payload.warnings) ? payload.warnings.map(String).sort() : []),
    missingEvidence: Object.freeze(Array.isArray(payload.missingEvidence) ? payload.missingEvidence.map(String).sort() : []),
    authority: compactAuthority(payload)
  });
};

export async function collectBt15Diagnostics({
  baseUrl,
  requestedSymbol,
  brokerSymbol,
  timeframe,
  windows,
  fetchImpl = globalThis.fetch.bind(globalThis),
  timeoutMs = 10_000
}) {
  const parsedBase = new URL(baseUrl);
  if (parsedBase.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsedBase.hostname)) {
    throw new Error("BT1.5 diagnostics require a loopback-only HTTP endpoint.");
  }
  if (!Array.isArray(windows) || windows.length !== 5) {
    throw new Error("BT1.5 diagnostics require exactly five historical evidence windows.");
  }
  const root = parsedBase.toString().replace(/\/$/, "");
  const healthPayload = await fetchJson(fetchImpl, `${root}/health`, timeoutMs);
  const statusPayload = await fetchJson(fetchImpl, `${root}/status`, timeoutMs);
  const timePayload = await fetchJson(fetchImpl, `${root}/time-contract`, timeoutMs);
  const symbolsPayload = await fetchJson(fetchImpl, `${root}/symbols`, timeoutMs);
  const symbolInfoUrl = new URL(`${root}/symbol-info`);
  symbolInfoUrl.searchParams.set("symbol", brokerSymbol);
  const symbolInfoPayload = await fetchJson(fetchImpl, symbolInfoUrl, timeoutMs);
  const evidence = [];
  for (const window of windows) {
    const url = new URL(`${root}/candles/range`);
    url.searchParams.set("requestedSymbol", requestedSymbol);
    url.searchParams.set("symbol", brokerSymbol);
    url.searchParams.set("timeframe", timeframe);
    url.searchParams.set("from", new Date(window.fromUtc).toISOString());
    url.searchParams.set("to", new Date(window.toUtc).toISOString());
    url.searchParams.set("limit", String(window.limit ?? 500));
    evidence.push(compactWindow(await fetchJson(fetchImpl, url, timeoutMs), window));
  }
  const result = Object.freeze({
    health: compactService(healthPayload),
    status: compactService(statusPayload),
    timeContract: compactTimeContract(timePayload),
    symbol: compactSymbol(symbolsPayload, symbolInfoPayload, brokerSymbol),
    evidence: Object.freeze(evidence),
    requestedSymbol,
    brokerSymbol,
    timeframe,
    authority: authorityNone
  });
  requireAuthorityNone(result.authority);
  return result;
}
