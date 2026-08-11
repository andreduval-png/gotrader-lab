#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHistoricalDatasetNodeStorage } from "./support/historical-dataset-node-storage.mjs";
import { collectBt15Diagnostics } from "./support/bt1-5-diagnostics-core.mjs";
import {
  authorityNone,
  canonicalHashStreaming
} from "./support/bt1-5-qualification-runtime.mjs";
import {
  buildFixtureRequest,
  createFixtureProvider,
  loadBt1Modules
} from "./support/bt1-dataset-fixtures.mjs";

const workspace = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(workspace, "package.json"), "utf8"));
const liveRunnerSource = fs.readFileSync(
  path.join(workspace, "scripts", "run-bt1-5-dataset-qualification.mjs"),
  "utf8"
);
assert.match(packageJson.scripts["bt1-5:run"], /--expose-gc/);
assert.match(packageJson.scripts["bt1-5:run"], /--max-old-space-size=512/);
assert.match(packageJson.scripts["bt1-6:prepare-gap-evidence"], /prepare-bt1-6-provider-gap-evidence-input/);
assert.match(liveRunnerSource, /onProgress\(event\) \{\s+latestProgress = event;\s+globalThis\.gc\(\);/);
assert.match(liveRunnerSource, /canonicalHash: canonicalHashStreaming/);
assert.match(liveRunnerSource, /bounded page handoffs/);
assert.match(liveRunnerSource, /historical_runtime_peak_memory_bound_exceeded/);
const testRoot = path.join(workspace, ".gotrader", "bt1-5", "operational-test");
fs.rmSync(testRoot, { recursive: true, force: true });
fs.mkdirSync(testRoot, { recursive: true });
const modules = await loadBt1Modules({ outRoot: path.join(testRoot, "compiled") });
const canonicalSamples = [
  null,
  true,
  -0,
  "line one\r\nline two",
  { z: 2, a: ["value", { workspace: "C:\\repo\\dataset" }] }
];
for (const sample of canonicalSamples) {
  assert.equal(await canonicalHashStreaming(sample), await modules.canonical.canonicalHash(sample));
}
const fixture = await buildFixtureRequest(modules);

const gapQualificationPath = path.join(testRoot, "gap-qualification.json");
const gapLedgerPath = path.join(testRoot, "gap-ledger.json");
const gapInputPath = path.join(testRoot, "gap-input.json");
fs.writeFileSync(gapQualificationPath, JSON.stringify({
  baseUrl: "http://127.0.0.1:7341",
  providerVersion: "fixture-provider-v1",
  sourceIdentityFingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeNormalizationPolicy: { sourceTimezone: "Europe/Helsinki" }
}), "utf8");
fs.writeFileSync(gapLedgerPath, JSON.stringify({
  payload: {
    authority: authorityNone,
    events: [
      {
        eventId: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        kind: "unclassified_gap",
        timeframe: "1m",
        openTimeUtc: "2025-07-17T14:50:00.000Z",
        endTimeUtc: "2025-07-17T14:51:00.000Z",
        blocking: true
      },
      {
        eventId: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        kind: "unclassified_gap",
        timeframe: "1m",
        openTimeUtc: "2025-01-17T14:50:00.000Z",
        endTimeUtc: "2025-01-17T14:52:00.000Z",
        blocking: true
      }
    ]
  }
}), "utf8");
const gapPrepared = spawnSync(process.execPath, [
  "scripts/prepare-bt1-6-provider-gap-evidence-input.mjs",
  "--qualification", gapQualificationPath,
  "--ledger", gapLedgerPath,
  "--output", gapInputPath
], { cwd: workspace, encoding: "utf8" });
assert.equal(gapPrepared.status, 0, gapPrepared.stderr || gapPrepared.stdout);
const gapInput = JSON.parse(fs.readFileSync(gapInputPath, "utf8"));
assert.equal(gapInput.windows.length, 2);
assert.equal(gapInput.windows[0].expectedMissingProviderRange.start, "2025-07-17T17:50:00.000Z");
assert.equal(gapInput.windows[1].expectedMissingProviderRange.start, "2025-01-17T16:50:00.000Z");
assert.equal(gapInput.windows[1].expectedMissingProviderRange.expectedCount, 2);

const progress = [];
const firstSource = createFixtureProvider(fixture.description);
const firstStorage = createHistoricalDatasetNodeStorage({ root: path.join(testRoot, "progress-dataset") });
const repository = new modules.repository.HistoricalDatasetRepository({
  storage: firstStorage.adapter,
  maximumPagesPerTimeframe: 8,
  maximumPartitions: 8,
  maximumAcceptedCandles: 32,
  onProgress(event) {
    progress.push(event);
  },
  now: () => "2024-01-03T00:00:00.000Z"
});
const created = await repository.createDataset(fixture.request, firstSource.provider);
assert.equal(created.verification.status, "verified");
assert.deepEqual(progress.map((event) => event.eventType), [
  "page_committed",
  "page_committed",
  "sealing_started",
  "dataset_complete"
]);
assert.equal(progress.at(-1).barsAccepted, 16);
assert.equal(progress.at(-1).barsRejected, 0);
assert.equal(created.manifest.timeframes.find((item) => item.timeframe === "1m")?.candleCount, 15);

const boundedStorage = createHistoricalDatasetNodeStorage({ root: path.join(testRoot, "bounded-dataset") });
const boundedRepository = new modules.repository.HistoricalDatasetRepository({
  storage: boundedStorage.adapter,
  maximumAcceptedCandles: 10,
  now: () => "2024-01-03T00:00:00.000Z"
});
await assert.rejects(
  () => boundedRepository.createDataset(fixture.request, createFixtureProvider(fixture.description).provider),
  /historical_candle_bound_exceeded/
);

const resumeStorage = createHistoricalDatasetNodeStorage({ root: path.join(testRoot, "resume-dataset") });
const resumeSource = createFixtureProvider(fixture.description);
const interruptedRepository = new modules.repository.HistoricalDatasetRepository({
  storage: resumeStorage.adapter,
  now: () => "2024-01-03T00:00:00.000Z",
  onProgress(event) {
    if (event.eventType === "page_committed" && event.pagesCompleted === 1) {
      throw new Error("controlled_test_interruption");
    }
  }
});
await assert.rejects(
  () => interruptedRepository.createDataset(fixture.request, resumeSource.provider),
  /controlled_test_interruption/
);
const legacyCheckpointFile = (await resumeStorage.adapter.listFiles("checkpoints"))[0];
const legacyCheckpointPath = `checkpoints/${legacyCheckpointFile}`;
const legacyCheckpointEnvelope = JSON.parse(await resumeStorage.adapter.readText(legacyCheckpointPath));
legacyCheckpointEnvelope.payload.version = "bt1-v1";
for (const state of legacyCheckpointEnvelope.payload.timeframes) {
  delete state.acceptedCandleCount;
  delete state.rejectedEventCount;
}
legacyCheckpointEnvelope.integrityHash = await modules.canonical.canonicalHash(legacyCheckpointEnvelope.payload);
fs.writeFileSync(
  resumeStorage.resolveSafe(legacyCheckpointPath),
  modules.canonical.canonicalSerialize(legacyCheckpointEnvelope),
  "utf8"
);
const resumed = await new modules.repository.HistoricalDatasetRepository({
  storage: resumeStorage.adapter,
  now: () => "2024-01-03T00:00:00.000Z"
}).createDataset(fixture.request, resumeSource.provider);
assert.equal(resumed.action, "resumed");
assert.equal(resumed.verification.status, "verified");
assert.equal(resumeSource.fetchCount, 2, "A committed first page must not be fetched after resume.");

const periods = ["winter", "summer", "spring_transition", "fall_transition", "maintenance_boundary"];
const requests = [];
const fakeFetch = async (url, init) => {
  requests.push({ url: String(url), method: init?.method });
  const parsed = new URL(url);
  const common = { ...authorityNone, account: "not-persisted" };
  let payload;
  if (parsed.pathname === "/health") payload = { ...common, status: "healthy", connected: true, sourceMethod: "mt5_terminal_session" };
  else if (parsed.pathname === "/status") payload = { ...common, state: "healthy", terminalConnectionState: "connected", source: "mt5_terminal_session" };
  else if (parsed.pathname === "/time-contract") payload = {
    ...common,
    providerTimeBasis: "utc_iso",
    verificationStatus: "verified",
    timeVerificationScope: "historical",
    historicalDstPolicyVerified: true,
    verificationVersion: "test-v1",
    sourceMethod: "verified_terminal_metadata"
  };
  else if (parsed.pathname === "/symbols") payload = {
    ...common,
    symbols: ["USTECH"]
  };
  else if (parsed.pathname === "/symbol-info") payload = {
    ...common,
    symbol: "USTECH",
    symbolInfo: {
      symbol: "USTECH",
      digits: 2,
      point: 0.01,
      trade_tick_size: 0.01,
      trade_tick_value: 0.1
    }
  };
  else payload = {
    ...common,
    sourceMethod: "upstream_http:/candles/range",
    candles: [
      { timestamp: parsed.searchParams.get("from"), open: 1, high: 2, low: 0, close: 1 },
      {
        timestamp: new Date(Date.parse(parsed.searchParams.get("to")) - 60_000).toISOString(),
        open: 1,
        high: 2,
        low: 0,
        close: 1
      }
    ]
  };
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
};
const windows = periods.map((period, index) => ({
  period,
  fromUtc: new Date(Date.UTC(2024, index * 2, 1)).toISOString(),
  toUtc: new Date(Date.UTC(2024, index * 2, 1, 1)).toISOString(),
  limit: 100
}));
const diagnostics = await collectBt15Diagnostics({
  baseUrl: "http://127.0.0.1:7341",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "M1",
  windows,
  fetchImpl: fakeFetch
});
assert.equal(diagnostics.evidence.length, 5);
assert.equal(diagnostics.evidence.every((item) => item.candleCount === 2), true);
assert.equal(diagnostics.evidence.every((item) => item.outOfRangeCandleCount === 0), true);
assert.equal(diagnostics.symbol.found, true);
assert.equal(diagnostics.health.connected, true);
assert.equal(diagnostics.timeContract.historicalTimeVerified, true);
assert.equal(diagnostics.timeContract.historicalDstVerified, true);
assert.equal(diagnostics.symbol.volumeMinLots, null);
assert.equal(JSON.stringify(diagnostics).includes("undefined"), false);
assert.equal(requests.every((request) => request.method === "GET"), true);
assert.doesNotMatch(JSON.stringify(diagnostics), /not-persisted|account/i);

const sourceIdentityFingerprint = await modules.canonical.canonicalHash({ test: "bt1-5-source" });
const evidenceRecords = periods.map((period, index) => ({
  period,
  timeframe: "1m",
  rawProviderTime: windows[index].fromUtc,
  normalizedTimeUtc: windows[index].fromUtc,
  expectedSessionInterpretation: `${period} verified fixture`,
  timestampStatus: "verified",
  sessionStatus: "verified"
}));
const bundleInput = {
  baseUrl: "http://127.0.0.1:7341",
  providerVersion: "bt1-5-test-v1",
  providerTimeBasis: "utc_iso",
  sourceIdentityFingerprint,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sessionTimezone: "America/New_York",
  verificationVersion: "bt1-5-test-v1",
  evidenceRecords,
  timeNormalizationPolicy: {
    policyId: "bt1-5-test-utc",
    version: "1",
    provider: "mt5_read_only_historical",
    basis: "utc_iso",
    outputTimezone: "UTC",
    discoveryMethod: "explicit_utc_contract",
    dstPolicy: "not_applicable",
    maximumClockSkewMs: 1000,
    closureToleranceMs: 0
  },
  calendar: {
    version: "1",
    timezone: "America/New_York",
    dstPolicy: "iana_timezone_rules",
    verificationEvidencePeriod: "maintenance_boundary",
    verificationStatus: "verified",
    closedIntervals: []
  },
  alignment: {
    version: "1",
    anchorOffsetMinutes: 0,
    supportedDerivedTimeframes: ["5m", "15m", "1h", "4h"],
    verificationStatus: "verified"
  },
  symbolSpec: {
    digits: 2,
    pointSize: 0.01,
    pipSize: 0.1,
    pipInPoints: 10,
    spreadUnit: "broker_points",
    tickSize: 0.01,
    tickValue: 0.1,
    tickValueCurrency: "USD",
    tradeContractSize: 1,
    volumeMinLots: 0.01,
    volumeMaxLots: 100,
    volumeStepLots: 0.01,
    verificationStatus: "verified_provider_metadata"
  },
  request: {
    sourceTimeframes: ["1m", "1d", "1w"],
    derivedTimeframes: ["5m", "15m", "1h", "4h"],
    parentDatasetIds: [],
    startUtc: "2024-01-01T00:00:00.000Z",
    endUtc: "2025-12-31T00:00:00.000Z",
    pageSize: 5000,
    creationPolicyId: "bt1-5-test-closed-bars",
    creationPolicyVersion: "1"
  },
  pilot: {
    startUtc: "2024-01-01T00:00:00.000Z",
    endUtc: "2024-01-08T00:00:00.000Z"
  },
  bounds: {
    maximumSourceBars: 1_100_000,
    maximumPartitionCount: 1000,
    maximumStorageBytes: 8_000_000_000,
    maximumPeakMemoryBytes: 2_000_000_000,
    safetyMultiplier: 1.25
  }
};
const inputPath = path.join(testRoot, "bundle-input.json");
const outputPath = path.join(testRoot, "bundle.json");
fs.writeFileSync(inputPath, `${JSON.stringify(bundleInput, null, 2)}\n`, "utf8");
const prepared = spawnSync(process.execPath, [
  "scripts/prepare-bt1-5-qualification-bundle.mjs",
  "--input", inputPath,
  "--output", outputPath
], { cwd: workspace, encoding: "utf8" });
assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
const bundle = JSON.parse(fs.readFileSync(outputPath, "utf8"));
const { bundleId, ...bundleCore } = bundle;
assert.equal(await modules.canonical.canonicalHash(bundleCore), bundleId);
assert.equal(bundle.qualificationStatus, "ready_for_bounded_pilot");
assert.equal(bundle.authority.executionAuthority, "none");
const blockedPreflight = spawnSync(process.execPath, [
  "scripts/prepare-bt1-5-live-preflight.mjs", "--bundle", outputPath
], { cwd: workspace, encoding: "utf8" });
assert.notEqual(blockedPreflight.status, 0, "The live preflight must block this intentionally offline dirty test state.");
assert.match(blockedPreflight.stdout, /"status": "blocked"/);
assert.doesNotMatch(blockedPreflight.stdout, /password|secret|account/i);
const blockedPreflightSummary = JSON.parse(blockedPreflight.stdout);
const blockedRun = spawnSync(process.execPath, [
  "scripts/run-bt1-5-dataset-qualification.mjs",
  "--bundle", outputPath,
  "--preflight", blockedPreflightSummary.output,
  "--mode", "pilot"
], { cwd: workspace, encoding: "utf8" });
assert.notEqual(blockedRun.status, 0);
assert.match(blockedRun.stderr, /requires a current safe live preflight/i);
const reproductionIdentities = {
  requestId: fixture.requestId ?? bundle.requestId,
  datasetId: created.manifest.datasetId,
  datasetChecksum: created.manifest.datasetChecksum,
  manifestHash: await modules.canonical.canonicalHash(created.manifest),
  lineageNodeKey: (await modules.lineage.buildHistoricalDatasetLineageNode(created.manifest)).lineageNodeKey,
  timeAuthorityId: created.manifest.timeAuthorityId,
  symbolSpecId: created.manifest.symbolSpecId,
  calendarId: created.manifest.calendarId,
  timeframes: created.manifest.timeframes
};
const reproductionCore = {
  schemaVersion: "gotrader-bt1-5-dataset-qualification-v1",
  mode: "pilot",
  bundleId,
  preflightId: sourceIdentityFingerprint,
  requestId: reproductionIdentities.requestId,
  action: "created",
  verificationStatus: "verified",
  identities: reproductionIdentities,
  blockers: [],
  authority: authorityNone
};
const reproductionReport = {
  ...reproductionCore,
  reportId: await modules.canonical.canonicalHash(reproductionCore)
};
const leftReportPath = path.join(testRoot, "reproduction-left.json");
const rightReportPath = path.join(testRoot, "reproduction-right.json");
const comparisonPath = path.join(testRoot, "reproduction-comparison.json");
fs.writeFileSync(leftReportPath, JSON.stringify(reproductionReport), "utf8");
fs.writeFileSync(rightReportPath, JSON.stringify(reproductionReport), "utf8");
const compared = spawnSync(process.execPath, [
  "scripts/compare-bt1-5-dataset-reproduction.mjs",
  "--left", leftReportPath,
  "--right", rightReportPath,
  "--mode", "deterministic_rematerialization",
  "--output", comparisonPath
], { cwd: workspace, encoding: "utf8" });
assert.equal(compared.status, 0, compared.stderr || compared.stdout);
assert.equal(JSON.parse(fs.readFileSync(comparisonPath, "utf8")).status, "passed");

console.log(JSON.stringify({
  status: "passed",
  progressEvents: progress.length,
  streamingCanonicalHashSamples: canonicalSamples.length,
  preparedGapWindows: gapInput.windows.length,
  candleBoundBlocked: true,
  resumeAction: resumed.action,
  legacyCheckpointUpgraded: true,
  resumedSourceFetches: resumeSource.fetchCount,
  diagnosticGetCount: requests.length,
  diagnosticEvidenceWindows: diagnostics.evidence.length,
  bundleId,
  offlineLivePreflightBlocked: true,
  reproductionComparisonPassed: true,
  authority: bundle.authority
}, null, 2));
