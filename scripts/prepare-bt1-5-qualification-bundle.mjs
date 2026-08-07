#!/usr/bin/env node

import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  authorityNone,
  bt15RuntimeRoot,
  loadBt15Modules,
  parseArguments,
  readJson,
  requireHash,
  writeJsonAtomic
} from "./support/bt1-5-qualification-runtime.mjs";

const args = parseArguments(process.argv.slice(2));
if (!args.input) throw new Error("Usage: prepare-bt1-5-qualification-bundle --input <reviewed-input.json> [--output <bundle.json>]");
const input = readJson(args.input);
const modules = await loadBt15Modules("prepare-bundle");

requireHash(input.sourceIdentityFingerprint, "sourceIdentityFingerprint");
const provider = modules.mt5Provider.createMt5ReadOnlyHistoricalProvider({
  baseUrl: input.baseUrl,
  providerVersion: input.providerVersion,
  providerTimeBasis: input.providerTimeBasis,
  sourceIdentityFingerprint: input.sourceIdentityFingerprint,
  maximumPageCandles: input.maximumPageCandles ?? 5000
});
const providerDescription = await provider.describe();

const records = [];
for (const record of input.evidenceRecords ?? []) {
  records.push(await modules.qualification.buildHistoricalTimeEvidenceRecord({
    ...record,
    providerId: providerDescription.providerId,
    providerVersion: providerDescription.providerVersion,
    terminalIdentityFingerprint: input.sourceIdentityFingerprint,
    requestedSymbol: input.requestedSymbol,
    brokerSymbol: input.brokerSymbol,
    providerTimeBasis: input.providerTimeBasis,
    sourceFingerprint: providerDescription.sourceFingerprint,
    normalizationPolicyId: input.timeNormalizationPolicy.policyId,
    normalizationPolicyVersion: input.timeNormalizationPolicy.version
  }));
}
const evidencePackage = await modules.qualification.buildHistoricalTimeEvidencePackage({
  providerId: providerDescription.providerId,
  providerVersion: providerDescription.providerVersion,
  terminalIdentityFingerprint: input.sourceIdentityFingerprint,
  requestedSymbol: input.requestedSymbol,
  brokerSymbol: input.brokerSymbol,
  providerTimeBasis: input.providerTimeBasis,
  timestampDstPolicy: input.timeNormalizationPolicy.dstPolicy,
  sessionTimezone: input.sessionTimezone,
  sourceFingerprint: providerDescription.sourceFingerprint,
  normalizationPolicyId: input.timeNormalizationPolicy.policyId,
  normalizationPolicyVersion: input.timeNormalizationPolicy.version,
  verificationVersion: input.verificationVersion,
  records,
  warnings: input.evidenceWarnings ?? []
});
const calendar = await modules.qualification.buildHistoricalMarketCalendarSnapshot({
  version: input.calendar.version,
  providerId: providerDescription.providerId,
  brokerSymbol: input.brokerSymbol,
  timezone: input.calendar.timezone,
  dstPolicy: input.calendar.dstPolicy,
  evidencePackageId: evidencePackage.evidencePackageId,
  verificationVersion: input.verificationVersion,
  verificationEvidenceId: input.calendar.verificationEvidenceId ?? records.find(
    (record) => record.period === input.calendar.verificationEvidencePeriod
  )?.evidenceId,
  verificationStatus: input.calendar.verificationStatus,
  closedIntervals: input.calendar.closedIntervals ?? [],
  sourceFingerprint: providerDescription.sourceFingerprint
});
const alignment = await modules.qualification.buildHistoricalTimeframeAlignmentPolicy({
  version: input.alignment.version,
  anchorOffsetMinutes: input.alignment.anchorOffsetMinutes,
  weekStartsOn: "monday",
  calendarId: calendar.calendarId,
  evidencePackageId: evidencePackage.evidencePackageId,
  verificationVersion: input.verificationVersion,
  supportedDerivedTimeframes: input.alignment.supportedDerivedTimeframes,
  verificationStatus: input.alignment.verificationStatus
});
const timeAuthority = await modules.contracts.buildHistoricalTimeAuthority({
  providerId: providerDescription.providerId,
  providerVersion: providerDescription.providerVersion,
  providerTimeBasis: input.providerTimeBasis,
  dstPolicy: input.timeNormalizationPolicy.dstPolicy,
  timeNormalizationPolicy: input.timeNormalizationPolicy,
  evidencePackage,
  calendar,
  verificationVersion: input.verificationVersion,
  warnings: input.timeAuthorityWarnings ?? []
});
const symbolSpec = await modules.contracts.buildHistoricalSymbolSpecSnapshot({
  ...input.symbolSpec,
  providerId: providerDescription.providerId,
  requestedSymbol: input.requestedSymbol,
  brokerSymbol: input.brokerSymbol,
  sourceFingerprint: providerDescription.sourceFingerprint
});
const request = Object.freeze({
  requestedSymbol: input.requestedSymbol,
  brokerSymbol: input.brokerSymbol,
  sourceTimeframes: Object.freeze([...(input.request.sourceTimeframes ?? [])]),
  derivedTimeframes: Object.freeze([...(input.request.derivedTimeframes ?? [])]),
  parentDatasetIds: Object.freeze([...(input.request.parentDatasetIds ?? [])]),
  startUtc: new Date(input.request.startUtc).toISOString(),
  endUtc: new Date(input.request.endUtc).toISOString(),
  pageSize: input.request.pageSize,
  timeNormalizationPolicy: Object.freeze(input.timeNormalizationPolicy),
  timeAuthority,
  symbolSpec,
  calendar,
  timeframeAlignment: alignment,
  creationPolicyId: input.request.creationPolicyId,
  creationPolicyVersion: input.request.creationPolicyVersion
});
const requestIdentity = await modules.contracts.deriveHistoricalDatasetRequestIdentity(request, providerDescription);
const candidateHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const candidateBranch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const pilot = Object.freeze({
  startUtc: new Date(input.pilot.startUtc).toISOString(),
  endUtc: new Date(input.pilot.endUtc).toISOString()
});
if (
  Date.parse(pilot.startUtc) < Date.parse(request.startUtc) ||
  Date.parse(pilot.endUtc) > Date.parse(request.endUtc) ||
  Date.parse(pilot.startUtc) >= Date.parse(pilot.endUtc)
) throw new Error("BT1.5 pilot range must be a positive subset of the target request.");
const bounds = Object.freeze({
  maximumSourceBars: Number(input.bounds.maximumSourceBars),
  maximumPartitionCount: Number(input.bounds.maximumPartitionCount),
  maximumStorageBytes: Number(input.bounds.maximumStorageBytes),
  maximumPeakMemoryBytes: Number(input.bounds.maximumPeakMemoryBytes),
  safetyMultiplier: Number(input.bounds.safetyMultiplier ?? 1.25)
});
for (const [name, value] of Object.entries(bounds)) {
  if (name === "safetyMultiplier") {
    if (!Number.isFinite(value) || value < 1) throw new Error("BT1.5 safetyMultiplier must be at least one.");
  } else if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`BT1.5 ${name} must be a positive safe integer.`);
  }
}
const requiredTimeframes = Object.freeze(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]);
const availableTimeframes = new Set([
  ...requestIdentity.normalizedRequest.sourceTimeframes,
  ...requestIdentity.normalizedRequest.derivedTimeframes
]);
const blockers = Object.freeze([
  ...evidencePackage.blockers,
  ...timeAuthority.blockers,
  ...symbolSpec.blockers,
  ...requiredTimeframes.filter((timeframe) => !availableTimeframes.has(timeframe)).map(
    (timeframe) => `historical_required_${timeframe}_coverage_missing`
  ),
  ...requestIdentity.normalizedRequest.derivedTimeframes.filter((timeframe) => ["1d", "1w"].includes(timeframe)).map(
    (timeframe) => `historical_${timeframe}_must_be_source_native`
  )
].filter(Boolean).sort());
const core = Object.freeze({
  schemaVersion: "gotrader-bt1-5-qualification-bundle-v1",
  candidateHead,
  candidateBranch,
  instrumentMapping: Object.freeze({
    requestedSymbol: input.requestedSymbol,
    brokerSymbol: input.brokerSymbol,
    semantics: "research_alias_only_no_futures_equivalence"
  }),
  provider: Object.freeze({
    baseUrl: input.baseUrl,
    providerDescription,
    sourceIdentityFingerprint: input.sourceIdentityFingerprint,
    providerTimeBasis: input.providerTimeBasis
  }),
  evidencePackage,
  calendar,
  alignment,
  timeAuthority,
  symbolSpec,
  request: requestIdentity.normalizedRequest,
  requestId: requestIdentity.requestId,
  pilot,
  bounds,
  qualificationStatus: blockers.length ? "blocked" : "ready_for_bounded_pilot",
  blockers,
  authority: authorityNone
});
const bundle = Object.freeze({ ...core, bundleId: await modules.canonical.canonicalHash(core) });
const output = args.output
  ? path.resolve(args.output)
  : path.join(bt15RuntimeRoot(), "qualification", `${bundle.bundleId.replace(":", "_")}.json`);
const written = writeJsonAtomic(output, bundle);
console.log(JSON.stringify({
  status: bundle.qualificationStatus,
  bundleId: bundle.bundleId,
  requestId: bundle.requestId,
  evidencePackageId: evidencePackage.evidencePackageId,
  timeAuthorityId: timeAuthority.authorityId,
  calendarId: calendar.calendarId,
  symbolSpecId: symbolSpec.symbolSpecId,
  blockers,
  output: written,
  authority: bundle.authority
}, null, 2));
