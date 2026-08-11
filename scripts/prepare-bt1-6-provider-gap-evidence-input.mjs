#!/usr/bin/env node

import {
  authorityNone,
  parseArguments,
  readJson,
  requireAuthorityNone,
  writeJsonAtomic
} from "./support/bt1-5-qualification-runtime.mjs";

const args = parseArguments(process.argv.slice(2));
if (!args.qualification || !args.ledger || !args.output) {
  throw new Error("Usage: prepare-bt1-6-provider-gap-evidence-input --qualification <input.json> --ledger <ledger.json> --output <input.json> [--rounds <count>] [--boundary-minutes <count>]");
}

const qualification = readJson(args.qualification);
const ledgerEnvelope = readJson(args.ledger);
const ledger = ledgerEnvelope.payload ?? ledgerEnvelope;
requireAuthorityNone(ledger.authority, "integrity ledger authority");
const sourceTimezone = qualification.timeNormalizationPolicy?.sourceTimezone;
if (!sourceTimezone) throw new Error("BT1.6 gap preparation requires a source timezone.");
const rounds = Number(args.rounds ?? 3);
const boundaryMinutes = Number(args["boundary-minutes"] ?? 5);
if (!Number.isInteger(rounds) || rounds < 2 || rounds > 10) {
  throw new Error("BT1.6 gap preparation requires between two and ten rounds.");
}
if (!Number.isInteger(boundaryMinutes) || boundaryMinutes < 1 || boundaryMinutes > 30) {
  throw new Error("BT1.6 gap preparation requires between one and thirty boundary minutes.");
}

const sourceFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: sourceTimezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});
const providerWallClock = (normalizedUtc) => {
  const parts = Object.fromEntries(sourceFormatter.formatToParts(new Date(normalizedUtc))
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));
  return new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )).toISOString();
};
const shift = (value, minutes) => new Date(Date.parse(value) + minutes * 60_000).toISOString();

const events = (ledger.events ?? []).filter((event) => (
  event.kind === "unclassified_gap" &&
  event.blocking === true &&
  event.timeframe === "1m"
));
if (!events.length) throw new Error("BT1.6 integrity ledger contains no unresolved 1m gaps.");
const limit = 5000;
const windows = events.map((event, index) => {
  const start = new Date(Date.parse(event.openTimeUtc)).toISOString();
  const end = new Date(Date.parse(event.endTimeUtc)).toISOString();
  const expectedCount = (Date.parse(end) - Date.parse(start)) / 60_000;
  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    throw new Error(`BT1.6 unresolved gap ${event.eventId} is not minute aligned.`);
  }
  if (expectedCount + boundaryMinutes * 2 > limit) {
    throw new Error(`BT1.6 unresolved gap ${event.eventId} exceeds the bounded provider query limit.`);
  }
  return Object.freeze({
    windowId: `unclassified-${String(index + 1).padStart(3, "0")}-${event.eventId.slice(-8)}`,
    sourceEventId: event.eventId,
    requestedFrom: providerWallClock(shift(start, -boundaryMinutes)),
    requestedTo: providerWallClock(shift(end, boundaryMinutes)),
    expectedMissingProviderRange: Object.freeze({
      start: providerWallClock(start),
      end: providerWallClock(end),
      expectedCount
    }),
    expectedBoundaryProviderTimes: Object.freeze([
      providerWallClock(shift(start, -1)),
      providerWallClock(end)
    ]),
    normalizedOutageStartUtc: start,
    normalizedOutageEndUtc: end
  });
});

const output = Object.freeze({
  schemaVersion: "gotrader-bt1-6-provider-gap-evidence-input-v2",
  baseUrl: qualification.baseUrl,
  providerVersion: qualification.providerVersion,
  sourceIdentityFingerprint: qualification.sourceIdentityFingerprint,
  requestedSymbol: qualification.requestedSymbol,
  brokerSymbol: qualification.brokerSymbol,
  timeframe: "M1",
  sourceTimezone,
  rounds,
  limit,
  windows: Object.freeze(windows),
  authority: authorityNone
});
console.log(JSON.stringify({
  status: "prepared",
  unresolvedGapCount: windows.length,
  maximumExpectedMissingCount: Math.max(...windows.map((window) => window.expectedMissingProviderRange.expectedCount)),
  output: writeJsonAtomic(args.output, output),
  authority: output.authority
}, null, 2));
