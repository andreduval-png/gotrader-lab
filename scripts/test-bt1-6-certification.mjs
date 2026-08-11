#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildFixtureRequest, loadBt1Modules } from "./support/bt1-dataset-fixtures.mjs";
import { writeBt16JsonAtomic } from "./support/bt1-6-certification-runtime.mjs";

const root = path.resolve(process.cwd(), ".gotrader", "bt1-6-certification-test");
fs.rmSync(root, { recursive: true, force: true });
const modules = await loadBt1Modules({ outRoot: path.join(root, "compiled") });
const fixture = await buildFixtureRequest(modules);
const hash = (value) => modules.canonical.canonicalHash(value);
const auditedRequests = [];
const auditedProvider = modules.mt5Provider.createMt5ReadOnlyHistoricalProvider({
  baseUrl: "http://127.0.0.1:7341",
  providerVersion: "bt1-6-audit-fixture-v1",
  providerTimeBasis: "utc_iso",
  sourceIdentityFingerprint: fixture.terminalIdentityFingerprint,
  now: () => "2024-01-02T00:02:00.000Z",
  onRequest: (request) => auditedRequests.push(request),
  fetchImpl: async () => new Response(JSON.stringify({
    candles: [{ timestamp: "2024-01-02T00:00:00.000Z", open: 1, high: 2, low: 0.5, close: 1.5 }],
    sourceMethod: "upstream_http:/candles/range",
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  }), { status: 200 })
});
await auditedProvider.fetchPage({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "1m",
  startUtc: "2024-01-02T00:00:00.000Z",
  endUtc: "2024-01-02T00:01:00.000Z",
  limit: 1
});
assert.equal(auditedRequests.length, 1);
assert.equal(auditedRequests[0].method, "GET");
assert.equal(new URL(auditedRequests[0].url).hostname, "127.0.0.1");
assert.equal(new URL(auditedRequests[0].url).pathname, "/candles/range");
assert.equal(new URL(auditedRequests[0].url).searchParams.get("from"), "2024-01-02T00:00:00.000Z");
assert.equal(new URL(auditedRequests[0].url).searchParams.get("to"), "2024-01-02T00:01:00.000Z");
assert.equal(new URL(auditedRequests[0].url).searchParams.get("limit"), "1");
const wallClockRequests = [];
const wallClockProvider = modules.mt5Provider.createMt5ReadOnlyHistoricalProvider({
  baseUrl: "http://127.0.0.1:7341",
  providerVersion: "bt1-6-wall-clock-audit-v1",
  providerTimeBasis: "mt5_server_wall_clock",
  sourceTimezone: "Europe/Helsinki",
  sourceIdentityFingerprint: fixture.terminalIdentityFingerprint,
  onRequest: (request) => wallClockRequests.push(request),
  fetchImpl: async () => new Response(JSON.stringify({
    candles: [],
    sourceMethod: "upstream_http:/candles/range",
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  }), { status: 200 })
});
for (const range of [
  ["2025-01-15T14:30:00.000Z", "2025-01-15T14:31:00.000Z"],
  ["2025-07-15T13:30:00.000Z", "2025-07-15T13:31:00.000Z"]
]) {
  await wallClockProvider.fetchPage({
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "1m",
    startUtc: range[0],
    endUtc: range[1],
    limit: 1
  });
}
assert.equal(new URL(wallClockRequests[0].url).searchParams.get("from"), "2025-01-15T16:30:00.000Z");
assert.equal(new URL(wallClockRequests[0].url).searchParams.get("to"), "2025-01-15T16:31:00.000Z");
assert.equal(new URL(wallClockRequests[1].url).searchParams.get("from"), "2025-07-15T16:30:00.000Z");
assert.equal(new URL(wallClockRequests[1].url).searchParams.get("to"), "2025-07-15T16:31:00.000Z");
const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d", "1w"];
const timeframeEntries = [];
for (const [index, timeframe] of timeframes.entries()) {
  timeframeEntries.push(Object.freeze({
    timeframe,
    candleCount: Math.max(2, 700_000 >> index),
    firstCandleTimeUtc: "2024-08-01T00:00:00.000Z",
    lastCandleTimeUtc: "2026-07-31T23:59:00.000Z",
    partitionIds: Object.freeze([await hash({ timeframe, partition: 1 })]),
    timeframeChecksum: await hash({ timeframe, checksum: 1 }),
    integrityLedgerId: await hash({ timeframe, integrity: 1 }),
    ...(["5m", "15m", "1h", "4h"].includes(timeframe)
      ? { derivedLineageId: await hash({ timeframe, lineage: 1 }) }
      : {})
  }));
}
const capabilities = Object.freeze({
  productionAdoptionAllowed: false,
  canCreateEvidence: false,
  canApproveReadiness: false,
  canApplyCalibration: false,
  canCreateTradeIntent: false
});
const manifestCore = Object.freeze({
  schemaId: "gotrader-historical-dataset-manifest",
  version: "bt1-v1",
  requestId: await hash({ request: "bt1-6-fixture" }),
  providerId: fixture.description.providerId,
  providerVersion: fixture.description.providerVersion,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceTimeframes: Object.freeze(["1m", "1d", "1w"]),
  derivedTimeframes: Object.freeze(["5m", "15m", "1h", "4h"]),
  parentDatasetIds: Object.freeze([]),
  startUtc: "2024-08-01T00:00:00.000Z",
  endUtc: "2026-08-01T00:00:00.000Z",
  timeNormalizationPolicyId: fixture.request.timeNormalizationPolicy.policyId,
  timeNormalizationPolicyVersion: fixture.request.timeNormalizationPolicy.version,
  providerTimeBasis: "utc_iso",
  dstPolicy: "not_applicable",
  timeAuthorityId: fixture.timeAuthority.authorityId,
  historicalTimeVerified: true,
  historicalDstVerified: true,
  symbolSpecId: fixture.symbolSpec.symbolSpecId,
  calendarId: fixture.calendar.calendarId,
  timeframeAlignmentPolicyId: fixture.timeframeAlignment.policyId,
  normalizationVersion: "closed-ohlcv-utc-bt1-v1",
  sourceFingerprint: fixture.description.sourceFingerprint,
  creationPolicyId: "bt1-6-live-qualification",
  creationPolicyVersion: "1",
  timeframes: Object.freeze(timeframeEntries),
  datasetChecksum: await hash({ timeframes: timeframeEntries.map((item) => item.timeframeChecksum) }),
  integrityStatus: "accepted",
  authoritativeScope: "historical_ohlc_only",
  rawHistoricalOhlcPersisted: true,
  researchOnly: true,
  blockers: Object.freeze([]),
  warnings: Object.freeze([]),
  authority: fixture.description.authority,
  capabilities
});
const manifest = Object.freeze({ ...manifestCore, datasetId: await hash(manifestCore) });
const qualificationReportId = await hash({ report: "resumed-full-run" });
const comparison = async (mode, status = "passed") => {
  const core = Object.freeze({
    schemaVersion: "gotrader-bt1-5-reproduction-comparison-v1",
    comparisonMode: mode,
    leftReportId: qualificationReportId,
    rightReportId: await hash({ report: `${mode}-root-b` }),
    checks: Object.freeze({
      requestId: status === "passed",
      partitionIdentities: status === "passed",
      timeframeChecksums: status === "passed",
      datasetChecksum: status === "passed",
      datasetId: status === "passed",
      manifestHash: status === "passed",
      lineageNodeKey: status === "passed"
    }),
    status,
    blockers: Object.freeze(status === "passed" ? [] : ["historical_reproduction_datasetId_mismatch"]),
    authority: fixture.description.authority
  });
  return Object.freeze({ ...core, comparisonId: await hash(core) });
};
const deterministic = await comparison("deterministic_rematerialization");
const providerRequery = await comparison("provider_requery");
const evidence = Object.freeze({
  qualificationReportId,
  qualificationReportAction: "resumed",
  qualificationVerificationStatus: "verified",
  qualificationBlockers: Object.freeze([]),
  bundleId: await hash({ bundle: "bt1-6" }),
  capacityPlanId: await hash({ capacity: "bt1-6" }),
  evidencePackageId: fixture.evidencePackage.evidencePackageId,
  controlledInterruptionReportId: await hash({ interruption: "bt1-6" }),
  deterministicRematerialization: deterministic,
  providerRequery,
  readOnlySafetyReportId: await hash({ safety: "bt1-6" }),
  readOnlySafetyVerified: true,
  loopbackOnly: true,
  getOnly: true,
  forbiddenEndpointCallCount: 0,
  storageBytes: 120_000_000,
  peakMemoryBytes: 800_000_000,
  retrievalDurationMs: 120_000,
  normalizationDurationMs: 30_000,
  integrityDurationMs: 20_000,
  derivationDurationMs: 40_000,
  reproductionDurationMs: 110_000,
  createdAtUtc: "2026-08-08T00:00:00.000Z",
  verifiedAtUtc: "2026-08-08T01:00:00.000Z",
  verifierVersion: "bt1-6-fixture-v1"
});
const input = Object.freeze({
  manifest,
  manifestHash: await hash(manifest),
  lineageRoot: await hash({ lineage: manifest.datasetId }),
  evidence
});

assert.deepEqual(modules.certificate.evaluateHistoricalDatasetCertification(input), []);
const certificate = await modules.certificate.buildHistoricalDatasetCertificate(input);
assert.match(certificate.certificateId, /^sha256:[0-9a-f]{64}$/);
assert.equal(certificate.providerDriftStatus, "not_detected");
assert.equal(certificate.restartResumeVerified, true);
assert.equal(certificate.authoritativeScope, "historical_input_integrity_only");
assert.equal(JSON.stringify(certificate).includes("strategyId"), false);
assert.deepEqual(await modules.certificate.validateHistoricalDatasetCertificate(certificate), []);

const entry = await modules.certificate.buildHistoricalDatasetRegistryEntry(certificate);
const registry = await modules.certificate.buildHistoricalDatasetRegistry([entry]);
assert.match(registry.registryId, /^sha256:[0-9a-f]{64}$/);
assert.equal(registry.entries[0].status, "qualified");
await assert.rejects(
  () => modules.certificate.buildHistoricalDatasetRegistry([entry, entry]),
  /duplicate entries/i
);
const immutablePath = path.resolve(process.cwd(), ".gotrader", "bt1-6", "tests", "immutable.json");
writeBt16JsonAtomic(immutablePath, { value: "accepted" });
writeBt16JsonAtomic(immutablePath, { value: "accepted" });
assert.throws(
  () => writeBt16JsonAtomic(immutablePath, { value: "changed" }),
  /immutable artifact conflict/i
);

const driftedInput = Object.freeze({
  ...input,
  evidence: Object.freeze({
    ...evidence,
    providerRequery: await comparison("provider_requery", "blocked")
  })
});
assert.ok(
  modules.certificate.evaluateHistoricalDatasetCertification(driftedInput)
    .includes("historical_provider_drift_detected")
);
await assert.rejects(
  () => modules.certificate.buildHistoricalDatasetCertificate(driftedInput),
  /provider_drift_detected/i
);

assert.ok(
  modules.certificate.evaluateHistoricalDatasetCertification({
    ...input,
    evidence: { ...evidence, qualificationReportAction: "created" }
  }).includes("historical_certificate_live_resume_not_proven")
);
assert.ok(
  modules.certificate.evaluateHistoricalDatasetCertification({
    ...input,
    evidence: { ...evidence, forbiddenEndpointCallCount: 1 }
  }).includes("historical_certificate_read_only_safety_unverified")
);
assert.ok(
  modules.certificate.evaluateHistoricalDatasetCertification({
    ...input,
    manifest: { ...manifest, historicalDstVerified: false }
  }).includes("historical_certificate_dst_unverified")
);

const tamperedCertificate = Object.freeze({ ...certificate, verifierVersion: "tampered" });
assert.ok(
  (await modules.certificate.validateHistoricalDatasetCertificate(tamperedCertificate))
    .includes("historical_certificate_identity_mismatch")
);
const wrongManifestHash = await hash({ not: "the manifest" });
await assert.rejects(
  () => modules.certificate.buildHistoricalDatasetCertificate({
    ...input,
    manifestHash: wrongManifestHash
  }),
  /manifest_hash_mismatch/i
);
const wrongComparisonHash = await hash({ not: "the comparison" });
await assert.rejects(
  () => modules.certificate.buildHistoricalDatasetCertificate({
    ...input,
    evidence: {
      ...evidence,
      deterministicRematerialization: {
        ...deterministic,
        comparisonId: wrongComparisonHash
      }
    }
  }),
  /reproduction_identity_mismatch/i
);

console.log(JSON.stringify({
  status: "passed",
  certificateId: certificate.certificateId,
  datasetId: certificate.datasetId,
  registryId: registry.registryId,
  providerDriftBlocks: true,
  controlledResumeRequired: true,
  readOnlySafetyRequired: true,
  auditedGetRequests: auditedRequests.length,
  authority: certificate.authority
}, null, 2));
