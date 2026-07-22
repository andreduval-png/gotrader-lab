#!/usr/bin/env node

const bridgeUrl = (process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341").replace(/\/$/, "");
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const timeframe = process.env.MT5_READONLY_TEST_TIMEFRAME || "5m";
const timeoutMs = Math.max(500, Number(process.env.MT5_READONLY_TEST_TIMEOUT_MS || 5_000));
const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const fetchJson = async (pathname) => {
  const response = await fetch(`${bridgeUrl}${pathname}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => undefined) };
};

const systemBeforeUtc = new Date().toISOString();
const params = new URLSearchParams({ requestedSymbol, symbol: brokerSymbol, timeframe, limit: "1000" });
let responses;
try {
  responses = await Promise.all([
    fetchJson("/health"),
    fetchJson("/time-contract"),
    fetchJson(`/quote?${new URLSearchParams({ requestedSymbol, symbol: brokerSymbol })}`),
    fetchJson(`/candles?${params}`),
    fetchJson(`/candles/range?${new URLSearchParams({
      requestedSymbol,
      symbol: brokerSymbol,
      timeframe,
      limit: "10",
      from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString()
    })}`)
  ]);
} catch (error) {
  console.log(JSON.stringify({
    status: "source_unavailable",
    bridgeUrl,
    reason: error instanceof Error ? error.message : String(error),
    rawCandlesPrinted: false,
    mutationEndpointsCalled: false,
    authority
  }, null, 2));
  process.exit(0);
}
const [health, timeContract, quote, latest, range] = responses;
const candles = Array.isArray(latest.body?.candles) ? latest.body.candles : [];
const first = candles[0];
const last = candles.at(-1);
const contract = timeContract.body ?? {};
const timeframeMinutes = ({ "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "1d": 1440 })[timeframe] ?? 5;
const rawLast = Number(last?.rawTime);
const rawServer = Number(contract.rawServerTime);
const rawPartialCount = Number.isFinite(rawLast) && Number.isFinite(rawServer) && rawLast + timeframeMinutes * 60 > rawServer ? 1 : 0;
const futureLegacyCount = candles.filter((candle) => Date.parse(candle?.timestamp) > Date.parse(contract.systemTimeUtc ?? systemBeforeUtc) + 1_000).length;

const output = {
  status: contract.verificationStatus === "verified"
    ? "verified_upstream_time_contract"
    : "blocked_provider_contract_unverified",
  source: "mt5_read_only",
  bridgeUrl,
  requestedSymbol,
  brokerSymbol,
  timeframe,
  endpointStatus: {
    health: health.status,
    timeContract: timeContract.status,
    quote: quote.status,
    latestCandles: latest.status,
    rangeCandles: range.status
  },
  contract: {
    contractId: contract.contractId,
    version: contract.version,
    providerTimeBasis: contract.providerTimeBasis,
    providerTimezone: contract.providerTimezone,
    providerUtcOffsetMinutes: contract.providerUtcOffsetMinutes,
    dstPolicy: contract.dstPolicy,
    configurationSource: contract.configurationSource,
    verificationStatus: contract.verificationStatus,
    verificationSources: contract.verificationSources,
    blockers: contract.blockers,
    warnings: contract.warnings
  },
  clocks: {
    systemBeforeUtc,
    systemTimeUtc: contract.systemTimeUtc,
    rawServerTime: contract.rawServerTime,
    rawServerTimeMsc: contract.rawServerTimeMsc,
    interpretedServerTimeUtc: contract.interpretedServerTimeUtc,
    normalizedProviderTimeUtc: contract.normalizedProviderTimeUtc,
    verifiedServerTimeUtc: contract.serverTimeUtc,
    observedOffsetMinutes: contract.observedOffsetMinutes,
    quoteRawTime: quote.body?.rawTime,
    quoteLegacyTimestamp: quote.body?.timestamp,
    latestCandleRawTime: last?.rawTime,
    latestCandleLegacyTimestamp: last?.timestamp
  },
  data: {
    latestCandleCount: candles.length,
    rangeCandleCount: Number(range.body?.returnedCount ?? range.body?.candles?.length ?? 0),
    firstRawTime: first?.rawTime,
    lastRawTime: last?.rawTime,
    futureCountUnderLegacyUtcLabel: futureLegacyCount,
    rawCurrentPartialCount: rawPartialCount,
    retainedClosedCountEligibleForV2: contract.verificationStatus === "verified" ? Math.max(0, candles.length - rawPartialCount) : 0,
    tickCandleBasisAgreement: contract.tickCandleBasisAgreement
  },
  phase2Eligible: contract.verificationStatus === "verified" && futureLegacyCount === 0,
  independentPushParity: "insufficient_comparison_data",
  rawCandlesPrinted: false,
  mutationEndpointsCalled: false,
  authority
};
console.log(JSON.stringify(output, null, 2));
