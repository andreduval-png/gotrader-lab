#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";

const workspace = process.cwd();
const bridgeUrl = (process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341").replace(/\/$/, "");
const symbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const python = spawnSync("python", [
  path.join("scripts", "read-v2-mt5-terminal-clock.py"),
  "--symbol",
  symbol
], { cwd: workspace, encoding: "utf8" });
if (python.status !== 0) {
  console.log(JSON.stringify({
    status: "probe_reader_failed",
    reason: (python.stderr || python.stdout || "Python clock reader failed.").trim(),
    phase2Eligible: false,
    rawCandlesPrinted: false,
    mutationEndpointsCalled: false,
    authority
  }, null, 2));
  process.exit(0);
}
let direct;
try {
  direct = JSON.parse(python.stdout);
} catch {
  direct = { status: "probe_reader_failed", reason: "Python clock reader returned invalid JSON." };
}
if (direct.status !== "complete") {
  console.log(JSON.stringify({
    status: "blocked_terminal_probe_unavailable",
    reason: direct.reason,
    nextAction: "Compile and manually run GoTraderClockProbe in the connected MT5 terminal, then rerun this diagnostic immediately.",
    phase2Eligible: false,
    rawCandlesPrinted: false,
    mutationEndpointsCalled: false,
    authority
  }, null, 2));
  process.exit(0);
}

const fetchJson = async (pathname) => {
  try {
    const response = await fetch(`${bridgeUrl}${pathname}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000)
    });
    return { status: response.status, body: await response.json().catch(() => undefined) };
  } catch (error) {
    return { status: 0, error: error instanceof Error ? error.message : String(error) };
  }
};
const [timeContract, quote, candles] = await Promise.all([
  fetchJson("/time-contract"),
  fetchJson(`/quote?${new URLSearchParams({ requestedSymbol, symbol })}`),
  fetchJson(`/candles?${new URLSearchParams({ requestedSymbol, symbol, timeframe: "5m", limit: "2" })}`)
]);
const candleItems = Array.isArray(candles.body?.candles) ? candles.body.candles : [];
const wrapperCandleRaw = Number(candleItems.at(-1)?.rawTime);
const wrapperTickRaw = Number(quote.body?.rawTime);
const pythonTickMs = Number(direct.python.tickMscRaw || direct.python.tickRaw * 1_000);
const wrapperDeltas = {
  wrapperTickMinusPythonTickMs: Number.isFinite(wrapperTickRaw) ? wrapperTickRaw * 1_000 - pythonTickMs : undefined,
  wrapperCandleMinusPythonCandleMs: Number.isFinite(wrapperCandleRaw)
    ? (wrapperCandleRaw - Number(direct.python.latestM5BarRaw)) * 1_000
    : undefined
};
const timeService = spawnSync("w32tm", ["/query", "/status"], { encoding: "utf8" });
const timeSource = timeService.status === 0
  ? timeService.stdout.split(/\r?\n/).find((line) => /^Source:/i.test(line.trim()))?.split(":").slice(1).join(":").trim()
  : undefined;
const classification = direct.classification;
const finalStatus = classification.currentLiveTimeBasisVerified
  ? classification.historicalDstPolicyVerified
    ? "terminal_time_basis_verified"
    : "current_live_time_verified_historical_dst_unverified"
  : classification.basisClassification === "conflicting_terminal_evidence"
    ? "blocked_conflicting_terminal_evidence"
    : "blocked_terminal_evidence_inconclusive";
console.log(JSON.stringify({
  status: finalStatus,
  bridgeUrl,
  requestedSymbol,
  brokerSymbol: symbol,
  observation: {
    schemaVersion: direct.observation.version,
    observationId: direct.observation.observationId,
    probeInstanceId: direct.observation.probeInstanceId,
    sequence: direct.observation.sequence,
    symbol: direct.observation.symbol,
    timeframe: direct.observation.timeframe,
    symbolSynchronized: direct.observation.symbolSynchronized,
    tickReadSucceeded: direct.observation.tickReadSucceeded,
    barReadSucceeded: direct.observation.barReadSucceeded,
    timeCurrentRaw: direct.observation.timeCurrentRaw,
    timeTradeServerRaw: direct.observation.timeTradeServerRaw,
    timeGmtRaw: direct.observation.timeGmtRaw,
    timeLocalRaw: direct.observation.timeLocalRaw,
    localComputerGmtOffsetSeconds: direct.observation.timeGmtOffsetSeconds,
    localComputerDaylightSavingsSeconds: direct.observation.timeDaylightSavingsSeconds,
    symbolTimeRaw: direct.observation.symbolTimeRaw,
    symbolTimeMscRaw: direct.observation.symbolTimeMscRaw,
    latestBarOpenRaw: direct.observation.latestBarOpenRaw,
    terminalBuild: direct.observation.terminalBuild
  },
  python: direct.python,
  wrapper: {
    timeContractStatus: timeContract.status,
    quoteStatus: quote.status,
    candlesStatus: candles.status,
    tickRaw: Number.isFinite(wrapperTickRaw) ? wrapperTickRaw : undefined,
    latestM5BarRaw: Number.isFinite(wrapperCandleRaw) ? wrapperCandleRaw : undefined,
    ...wrapperDeltas
  },
  systemClock: {
    windowsTimeServiceAvailable: timeService.status === 0,
    source: timeSource
  },
  classification: {
    ...classification,
    deltas: { ...classification.deltas, ...wrapperDeltas }
  },
  timeContract: {
    version: timeContract.body?.version,
    verificationStatus: timeContract.body?.verificationStatus,
    currentLiveTimeBasisVerified: timeContract.body?.currentLiveTimeBasisVerified,
    historicalDstPolicyVerified: timeContract.body?.historicalDstPolicyVerified,
    timeVerificationScope: timeContract.body?.timeVerificationScope,
    phase2Eligible: timeContract.body?.verificationStatus === "verified" &&
      timeContract.body?.historicalDstPolicyVerified === true
  },
  strategySessionTimezone: "America/New_York",
  rawCandlesPrinted: false,
  mutationEndpointsCalled: false,
  authority
}, null, 2));
