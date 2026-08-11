#!/usr/bin/env node

import {
  loadBt15Modules,
  parseArguments,
  readJson,
  requireAuthorityNone,
  writeJsonAtomic
} from "./support/bt1-5-qualification-runtime.mjs";

const args = parseArguments(process.argv.slice(2));
if (!args.qualification || !args.evidence || !args.output || !args.version || !args["verification-version"]) {
  throw new Error("Usage: prepare-bt1-6-reviewed-calendar-input --qualification <input.json> --evidence <report.json> --output <input.json> --version <calendar-version> --verification-version <version>");
}

const qualification = readJson(args.qualification);
const evidence = readJson(args.evidence);
const modules = await loadBt15Modules("reviewed-calendar");
requireAuthorityNone(evidence.authority, "provider-gap evidence authority");
const { evidenceId, ...evidenceCore } = evidence;
if (await modules.canonical.canonicalHash(evidenceCore) !== evidenceId) {
  throw new Error("BT1.6 provider-gap evidence identity mismatch.");
}
if (
  evidence.schemaVersion !== "gotrader-bt1-6-provider-gap-evidence-v2" ||
  evidence.status !== "verified_stable_provider_outage" ||
  evidence.providerDriftDetected !== false ||
  evidence.blockers?.length
) throw new Error("BT1.6 reviewed calendar requires unblocked stable provider-gap evidence.");
if (
  evidence.providerVersion !== qualification.providerVersion ||
  evidence.sourceIdentityFingerprint !== qualification.sourceIdentityFingerprint ||
  evidence.requestedSymbol !== qualification.requestedSymbol ||
  evidence.brokerSymbol !== qualification.brokerSymbol ||
  evidence.timeframe !== "M1" ||
  evidence.method !== "GET" ||
  evidence.loopbackOnly !== true ||
  evidence.rawOhlcPersisted !== false
) throw new Error("BT1.6 provider-gap evidence does not match the reviewed qualification identity.");

const interval = (value) => Object.freeze({
  startUtc: new Date(Date.parse(value.startUtc)).toISOString(),
  endUtc: new Date(Date.parse(value.endUtc)).toISOString(),
  reason: value.reason,
  evidenceId: value.evidenceId
});
const existing = (qualification.calendar?.closedIntervals ?? [])
  .map(interval)
  .sort((left, right) => left.startUtc.localeCompare(right.startUtc) || left.endUtc.localeCompare(right.endUtc));
for (let index = 0; index < existing.length; index += 1) {
  const current = existing[index];
  if (Date.parse(current.endUtc) <= Date.parse(current.startUtc) || !current.evidenceId) {
    throw new Error("BT1.6 reviewed calendar contains an invalid existing closure.");
  }
  if (index && Date.parse(current.startUtc) < Date.parse(existing[index - 1].endUtc)) {
    throw new Error("BT1.6 reviewed calendar contains overlapping existing closures.");
  }
}

const additions = [];
for (const observation of evidence.observations ?? []) {
  if (!observation.expectedMissingProviderRange || observation.rounds?.length < 2) {
    throw new Error(`BT1.6 ${observation.windowId} lacks bounded range evidence.`);
  }
  if (new Set(observation.rounds.map((round) => round.responseFingerprint)).size !== 1) {
    throw new Error(`BT1.6 ${observation.windowId} contains provider drift.`);
  }
  const start = Date.parse(observation.normalizedOutageStartUtc);
  const end = Date.parse(observation.normalizedOutageEndUtc);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error(`BT1.6 ${observation.windowId} contains invalid normalized outage bounds.`);
  }
  let cursor = start;
  for (const closed of existing) {
    const closedStart = Date.parse(closed.startUtc);
    const closedEnd = Date.parse(closed.endUtc);
    if (closedEnd <= cursor || closedStart >= end) continue;
    if (closedStart > cursor) {
      additions.push(Object.freeze({
        startUtc: new Date(cursor).toISOString(),
        endUtc: new Date(Math.min(closedStart, end)).toISOString(),
        reason: "provider_outage",
        evidenceId
      }));
    }
    cursor = Math.max(cursor, closedEnd);
    if (cursor >= end) break;
  }
  if (cursor < end) additions.push(Object.freeze({
    startUtc: new Date(cursor).toISOString(),
    endUtc: new Date(end).toISOString(),
    reason: "provider_outage",
    evidenceId
  }));
}

const closedIntervals = [...existing, ...additions]
  .sort((left, right) => left.startUtc.localeCompare(right.startUtc) || left.endUtc.localeCompare(right.endUtc));
for (let index = 1; index < closedIntervals.length; index += 1) {
  if (Date.parse(closedIntervals[index].startUtc) < Date.parse(closedIntervals[index - 1].endUtc)) {
    throw new Error("BT1.6 reviewed calendar generation produced overlapping closures.");
  }
}

const output = Object.freeze({
  ...qualification,
  verificationVersion: String(args["verification-version"]),
  calendar: Object.freeze({
    ...qualification.calendar,
    version: String(args.version),
    verificationEvidenceId: evidenceId,
    closedIntervals: Object.freeze(closedIntervals)
  })
});
console.log(JSON.stringify({
  status: "reviewed",
  calendarVersion: output.calendar.version,
  verificationVersion: output.verificationVersion,
  providerGapEvidenceId: evidenceId,
  priorClosedIntervalCount: existing.length,
  addedProviderOutageCount: additions.length,
  closedIntervalCount: closedIntervals.length,
  output: writeJsonAtomic(args.output, output),
  authority: evidence.authority
}, null, 2));
