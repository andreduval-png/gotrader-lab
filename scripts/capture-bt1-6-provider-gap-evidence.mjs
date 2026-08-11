#!/usr/bin/env node

import {
  authorityNone,
  loadBt15Modules,
  parseArguments,
  readJson,
  writeJsonAtomic
} from "./support/bt1-5-qualification-runtime.mjs";

const args = parseArguments(process.argv.slice(2));
if (!args.input || !args.output) {
  throw new Error("Usage: capture-bt1-6-provider-gap-evidence --input <input.json> --output <report.json>");
}

const input = readJson(args.input);
const modules = await loadBt15Modules("provider-gap-evidence");
const baseUrl = new URL(input.baseUrl);
if (baseUrl.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(baseUrl.hostname)) {
  throw new Error("BT1.6 provider-gap evidence requires a loopback-only HTTP source.");
}
if (!Number.isInteger(input.rounds) || input.rounds < 2 || input.rounds > 10) {
  throw new Error("BT1.6 provider-gap evidence requires between two and ten rounds.");
}
if (!Array.isArray(input.windows) || !input.windows.length) {
  throw new Error("BT1.6 provider-gap evidence requires at least one window.");
}

const providerOpenTime = (candle) => {
  const raw = Number(candle?.rawTime ?? candle?.raw_time ?? candle?.time);
  if (Number.isFinite(raw)) return new Date((Math.abs(raw) < 100_000_000_000 ? raw * 1000 : raw)).toISOString();
  const parsed = Date.parse(String(candle?.timestamp ?? candle?.datetime ?? ""));
  if (!Number.isFinite(parsed)) throw new Error("BT1.6 provider-gap response contained an invalid timestamp.");
  return new Date(parsed).toISOString();
};

const blockers = [];
const observations = [];
for (const window of input.windows) {
  const requestedFrom = new Date(Date.parse(window.requestedFrom)).toISOString();
  const requestedTo = new Date(Date.parse(window.requestedTo)).toISOString();
  const expectedMissingProviderTimes = (window.expectedMissingProviderTimes ?? []).map((value) =>
    new Date(Date.parse(value)).toISOString());
  const expectedMissingProviderRange = window.expectedMissingProviderRange
    ? Object.freeze({
        start: new Date(Date.parse(window.expectedMissingProviderRange.start)).toISOString(),
        end: new Date(Date.parse(window.expectedMissingProviderRange.end)).toISOString(),
        expectedCount: Number(window.expectedMissingProviderRange.expectedCount)
      })
    : undefined;
  if (
    !expectedMissingProviderTimes.length &&
    (!expectedMissingProviderRange ||
      Date.parse(expectedMissingProviderRange.end) <= Date.parse(expectedMissingProviderRange.start) ||
      !Number.isInteger(expectedMissingProviderRange.expectedCount) ||
      expectedMissingProviderRange.expectedCount <= 0)
  ) throw new Error(`BT1.6 ${window.windowId} requires a valid missing-time list or range.`);
  const expectedBoundaryProviderTimes = window.expectedBoundaryProviderTimes.map((value) =>
    new Date(Date.parse(value)).toISOString());
  const rounds = [];
  for (let round = 1; round <= input.rounds; round += 1) {
    const url = new URL("/candles/range", baseUrl);
    url.searchParams.set("requestedSymbol", input.requestedSymbol);
    url.searchParams.set("symbol", input.brokerSymbol);
    url.searchParams.set("timeframe", input.timeframe);
    url.searchParams.set("from", requestedFrom);
    url.searchParams.set("to", requestedTo);
    url.searchParams.set("limit", String(input.limit));
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`BT1.6 provider-gap evidence returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (
      payload.executionAuthority !== "none" ||
      payload.brokerAuthority !== "none" ||
      payload.readinessOverrideAuthority !== "none"
    ) blockers.push(`${window.windowId}_authority_invalid`);
    if (
      payload.requestedSymbol !== input.requestedSymbol ||
      payload.brokerSymbol !== input.brokerSymbol ||
      payload.requestedTimeframe !== input.timeframe ||
      new Date(Date.parse(payload.requestedFrom)).toISOString() !== requestedFrom ||
      new Date(Date.parse(payload.requestedTo)).toISOString() !== requestedTo
    ) blockers.push(`${window.windowId}_response_identity_mismatch`);
    if (!String(payload.sourceMethod ?? "").startsWith("upstream_http:")) {
      blockers.push(`${window.windowId}_source_not_live_upstream`);
    }
    const candles = Array.isArray(payload.candles) ? payload.candles : [];
    const returnedProviderOpenTimes = candles.map(providerOpenTime).sort();
    const returned = new Set(returnedProviderOpenTimes);
    if (expectedMissingProviderTimes.some((value) => returned.has(value))) {
      blockers.push(`${window.windowId}_expected_gap_not_stable`);
    }
    if (expectedMissingProviderRange && returnedProviderOpenTimes.some((value) => (
      Date.parse(value) >= Date.parse(expectedMissingProviderRange.start) &&
      Date.parse(value) < Date.parse(expectedMissingProviderRange.end)
    ))) blockers.push(`${window.windowId}_expected_gap_not_stable`);
    if (expectedBoundaryProviderTimes.some((value) => !returned.has(value))) {
      blockers.push(`${window.windowId}_boundary_evidence_missing`);
    }
    const responseFingerprint = await modules.canonical.canonicalHash({
      provider: payload.provider,
      requestedSymbol: payload.requestedSymbol,
      brokerSymbol: payload.brokerSymbol,
      requestedTimeframe: payload.requestedTimeframe,
      requestedFrom: payload.requestedFrom,
      requestedTo: payload.requestedTo,
      sourceMethod: payload.sourceMethod,
      candles: candles.map((candle) => ({
        providerOpenTime: providerOpenTime(candle),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        spread: candle.spread
      })),
      authority: authorityNone
    });
    rounds.push(Object.freeze({ round, returnedProviderOpenTimes, responseFingerprint }));
  }
  if (new Set(rounds.map((item) => item.responseFingerprint)).size !== 1) {
    blockers.push(`${window.windowId}_provider_drift_detected`);
  }
  observations.push(Object.freeze({
    windowId: window.windowId,
    requestedFrom,
    requestedTo,
    expectedMissingProviderTimes,
    ...(expectedMissingProviderRange ? { expectedMissingProviderRange } : {}),
    expectedBoundaryProviderTimes,
    normalizedOutageStartUtc: new Date(Date.parse(window.normalizedOutageStartUtc)).toISOString(),
    normalizedOutageEndUtc: new Date(Date.parse(window.normalizedOutageEndUtc)).toISOString(),
    rounds: Object.freeze(rounds)
  }));
}

const normalizedBlockers = Object.freeze([...new Set(blockers)].sort());
const core = Object.freeze({
  schemaVersion: "gotrader-bt1-6-provider-gap-evidence-v2",
  observedAtUtc: new Date().toISOString(),
  providerVersion: input.providerVersion,
  sourceIdentityFingerprint: input.sourceIdentityFingerprint,
  requestedSymbol: input.requestedSymbol,
  brokerSymbol: input.brokerSymbol,
  timeframe: input.timeframe,
  method: "GET",
  endpoint: "/candles/range",
  loopbackOnly: true,
  rawOhlcPersisted: false,
  observations: Object.freeze(observations),
  providerDriftDetected: normalizedBlockers.some((value) => value.endsWith("_provider_drift_detected")),
  status: normalizedBlockers.length ? "blocked" : "verified_stable_provider_outage",
  blockers: normalizedBlockers,
  authority: authorityNone
});
const report = Object.freeze({ ...core, evidenceId: await modules.canonical.canonicalHash(core) });
const output = writeJsonAtomic(args.output, report);
console.log(JSON.stringify({
  status: report.status,
  evidenceId: report.evidenceId,
  blockers: report.blockers,
  output,
  authority: report.authority
}, null, 2));
if (report.blockers.length) process.exitCode = 1;
