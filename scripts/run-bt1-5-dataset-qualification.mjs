#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createHistoricalDatasetNodeStorage } from "./support/historical-dataset-node-storage.mjs";
import {
  authorityNone,
  bt15RuntimeRoot,
  compactJson,
  directorySize,
  loadBt15Modules,
  parseArguments,
  readJson,
  requireAuthorityNone,
  requireHash,
  resolveBt15Path,
  writeJsonAtomic
} from "./support/bt1-5-qualification-runtime.mjs";

const args = parseArguments(process.argv.slice(2));
if (!args.bundle || !args.preflight || !["pilot", "full"].includes(args.mode)) {
  throw new Error("Usage: run-bt1-5-dataset-qualification --bundle <bundle.json> --preflight <preflight.json> --mode <pilot|full> [--capacity-plan <plan.json>] [--interrupt-after-pages <count>]");
}
const bundle = readJson(args.bundle);
const modules = await loadBt15Modules(`dataset-${args.mode}`);
requireAuthorityNone(bundle.authority, "bundle authority");
requireHash(bundle.bundleId, "bundleId");
const { bundleId, ...bundleCore } = bundle;
if (await modules.canonical.canonicalHash(bundleCore) !== bundleId) throw new Error("BT1.5 bundle integrity mismatch.");
if (bundle.qualificationStatus !== "ready_for_bounded_pilot" || bundle.blockers?.length) {
  throw new Error("BT1.5 bundle is blocked and cannot start ingestion.");
}
const preflight = readJson(args.preflight);
requireAuthorityNone(preflight.authority, "preflight authority");
requireHash(preflight.preflightId, "preflightId");
const { preflightId, ...preflightCore } = preflight;
if (await modules.canonical.canonicalHash(preflightCore) !== preflightId) throw new Error("BT1.5 preflight integrity mismatch.");
if (
  preflight.status !== "safe_to_start" ||
  preflight.blockers?.length ||
  preflight.bundleId !== bundleId ||
  Date.parse(preflight.expiresAtUtc) < Date.now()
) throw new Error("BT1.5 requires a current safe live preflight for this bundle.");

const requestAudit = [];
const provider = modules.mt5Provider.createMt5ReadOnlyHistoricalProvider({
  baseUrl: bundle.provider.baseUrl,
  providerVersion: bundle.provider.providerDescription.providerVersion,
  providerTimeBasis: bundle.provider.providerTimeBasis,
  sourceTimezone: bundle.request.timeNormalizationPolicy.sourceTimezone,
  sourceUtcOffsetMinutes: bundle.request.timeNormalizationPolicy.sourceUtcOffsetMinutes,
  sourceIdentityFingerprint: bundle.provider.sourceIdentityFingerprint,
  maximumPageCandles: bundle.provider.providerDescription.maximumPageCandles,
  onRequest(request) {
    const url = new URL(request.url);
    requestAudit.push(Object.freeze({
      method: request.method,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || "80",
      pathname: url.pathname
    }));
  }
});
const providerDescription = await provider.describe();
if (await modules.canonical.canonicalHash(providerDescription) !== await modules.canonical.canonicalHash(bundle.provider.providerDescription)) {
  throw new Error("BT1.5 runtime provider identity differs from the sealed bundle.");
}

const request = Object.freeze({
  ...bundle.request,
  ...(args.mode === "pilot" ? { startUtc: bundle.pilot.startUtc, endUtc: bundle.pilot.endUtc } : {})
});
const identity = await modules.contracts.deriveHistoricalDatasetRequestIdentity(request, providerDescription);
if (args.mode === "full" && identity.requestId !== bundle.requestId) throw new Error("BT1.5 full request identity mismatch.");
const durationDays = (Date.parse(request.endUtc) - Date.parse(request.startUtc)) / 86_400_000;
if (args.mode === "full" && (durationDays < 700 || durationDays > 740)) {
  throw new Error("BT1.5 full request must cover an explicit 700-740 day interval.");
}
const sourceIntervalMs = Math.min(...request.sourceTimeframes.map(modules.contracts.historicalTimeframeMilliseconds));
if (Date.parse(request.endUtc) > Date.now() - sourceIntervalMs - 1_000) {
  throw new Error("BT1.5 request end must be a fully closed historical boundary.");
}

let capacityPlan;
if (args.mode === "full") {
  if (!args["capacity-plan"]) throw new Error("BT1.5 full mode requires a sealed capacity plan.");
  capacityPlan = readJson(args["capacity-plan"]);
  requireAuthorityNone(capacityPlan.authority, "capacity authority");
  requireHash(capacityPlan.capacityPlanId, "capacityPlanId");
  const { capacityPlanId, ...capacityCore } = capacityPlan;
  if (await modules.canonical.canonicalHash(capacityCore) !== capacityPlanId || capacityPlan.status !== "within_bounds") {
    throw new Error("BT1.5 capacity plan is invalid or blocked.");
  }
  if (capacityPlan.targetStartUtc !== request.startUtc || capacityPlan.targetEndUtc !== request.endUtc) {
    throw new Error("BT1.5 capacity plan does not bind the full request range.");
  }
}

const runRoot = resolveBt15Path(args.root
  ? path.resolve(args.root)
  : path.join(bt15RuntimeRoot(), "datasets", bundleId.replace(":", "_"), args.mode), "dataset root");
const storageRoot = path.join(runRoot, "repository");
const reportPath = path.join(runRoot, "qualification-report.json");
const progressPath = path.join(runRoot, "progress.jsonl");
fs.mkdirSync(runRoot, { recursive: true });
const storage = createHistoricalDatasetNodeStorage({ root: storageRoot });
const interruptAfterPages = args["interrupt-after-pages"] === undefined
  ? undefined
  : Number(args["interrupt-after-pages"]);
if (interruptAfterPages !== undefined && (!Number.isInteger(interruptAfterPages) || interruptAfterPages <= 0)) {
  throw new Error("BT1.5 interrupt-after-pages must be a positive integer.");
}

let latestProgress;
let peakRssBytes = process.memoryUsage().rss;
const memoryTimer = setInterval(() => {
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
}, 100);
memoryTimer.unref();
const startedAtUtc = new Date().toISOString();
const started = performance.now();
const cpuStarted = process.cpuUsage();
const progressEvents = [];
const repository = new modules.repository.HistoricalDatasetRepository({
  storage: storage.adapter,
  maximumPagesPerTimeframe: bundle.bounds.maximumPartitionCount,
  maximumPartitions: bundle.bounds.maximumPartitionCount,
  maximumAcceptedCandles: bundle.bounds.maximumSourceBars,
  onProgress(event) {
    latestProgress = event;
    const compact = Object.freeze({ ...event, recordedAtUtc: new Date().toISOString() });
    progressEvents.push(compact);
    fs.appendFileSync(progressPath, `${JSON.stringify(compact)}\n`, "utf8");
    console.log(JSON.stringify(compact));
    if (interruptAfterPages !== undefined && event.eventType === "page_committed" && event.pagesCompleted >= interruptAfterPages) {
      const error = new Error("BT1.5 controlled interruption after committed checkpoint.");
      error.code = "BT15_CONTROLLED_INTERRUPTION";
      throw error;
    }
  }
});

let result;
let failure;
try {
  result = await repository.createDataset(request, provider);
} catch (error) {
  failure = error;
} finally {
  clearInterval(memoryTimer);
  peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
}
if (peakRssBytes > bundle.bounds.maximumPeakMemoryBytes) {
  failure ??= new Error("historical_runtime_peak_memory_bound_exceeded");
}
const elapsedMs = Math.round(performance.now() - started);
const cpu = process.cpuUsage(cpuStarted);
const storageUsage = directorySize(storageRoot);
const manifest = result?.manifest;
const lineageNode = manifest ? await modules.lineage.buildHistoricalDatasetLineageNode(manifest) : undefined;
const identitySummary = manifest ? Object.freeze({
  requestId: manifest.requestId,
  datasetId: manifest.datasetId,
  datasetChecksum: manifest.datasetChecksum,
  manifestHash: await modules.canonical.canonicalHash(manifest),
  lineageNodeKey: lineageNode.lineageNodeKey,
  timeAuthorityId: manifest.timeAuthorityId,
  symbolSpecId: manifest.symbolSpecId,
  calendarId: manifest.calendarId,
  timeframes: Object.freeze(manifest.timeframes.map((item) => Object.freeze({
    timeframe: item.timeframe,
    candleCount: item.candleCount,
    partitionIds: item.partitionIds,
    timeframeChecksum: item.timeframeChecksum,
    integrityLedgerId: item.integrityLedgerId,
    derivedLineageId: item.derivedLineageId
  })))
}) : undefined;
if (identitySummary && /strategyId|profileId|parameterFingerprint|riskModel|rrModel/i.test(JSON.stringify(manifest))) {
  failure ??= new Error("BT1.5 dataset manifest is not strategy neutral.");
}

let generatedCapacityPlan;
if (args.mode === "pilot" && result && latestProgress) {
  const sourceTimeframes = new Set(request.sourceTimeframes);
  const observedSourcePartitionCount = result.manifest.timeframes
    .filter((item) => sourceTimeframes.has(item.timeframe))
    .reduce((sum, item) => sum + item.partitionIds.length, 0);
  const observedDerivedPartitionCount = result.manifest.timeframes
    .filter((item) => !sourceTimeframes.has(item.timeframe))
    .reduce((sum, item) => sum + item.partitionIds.length, 0);
  generatedCapacityPlan = await modules.qualification.buildHistoricalDatasetCapacityPlan({
    sourceTimeframes: request.sourceTimeframes,
    pilotStartUtc: request.startUtc,
    pilotEndUtc: request.endUtc,
    targetStartUtc: bundle.request.startUtc,
    targetEndUtc: bundle.request.endUtc,
    observedSourceBars: Math.max(1, latestProgress.barsAccepted),
    observedPartitionCount: observedSourcePartitionCount + observedDerivedPartitionCount,
    observedSourcePartitionCount,
    observedDerivedPartitionCount,
    observedStorageBytes: Math.max(1, storageUsage.bytes),
    observedPeakMemoryBytes: Math.max(1, peakRssBytes),
    ...bundle.bounds
  });
  writeJsonAtomic(path.join(runRoot, "capacity-plan.json"), generatedCapacityPlan);
}

const controlledInterruption = failure?.code === "BT15_CONTROLLED_INTERRUPTION";
const blockers = Object.freeze([
  ...(result?.verification?.blockers ?? []),
  ...(generatedCapacityPlan?.blockers ?? []),
  ...(failure && !controlledInterruption ? [String(failure.message ?? failure)] : [])
].sort());
const reportCore = Object.freeze(compactJson({
  schemaVersion: "gotrader-bt1-5-dataset-qualification-v1",
  mode: args.mode,
  bundleId,
  preflightId,
  requestId: identity.requestId,
  startedAtUtc,
  completedAtUtc: new Date().toISOString(),
  elapsedMs,
  cpuUserMicros: cpu.user,
  cpuSystemMicros: cpu.system,
  peakRssBytes,
  storageBytes: storageUsage.bytes,
  storageFiles: storageUsage.files,
  progressEventCount: progressEvents.length,
  finalProgress: latestProgress,
  action: result?.action ?? (controlledInterruption ? "controlled_interruption" : "failed"),
  verificationStatus: result?.verification?.status ?? "incomplete",
  identities: identitySummary,
  capacityPlanId: generatedCapacityPlan?.capacityPlanId ?? capacityPlan?.capacityPlanId,
  strategyNeutral: Boolean(identitySummary),
  blockers,
  authority: authorityNone
}));
const report = Object.freeze({ ...reportCore, reportId: await modules.canonical.canonicalHash(reportCore) });
writeJsonAtomic(reportPath, report);
const allowedLoopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const forbiddenRequests = requestAudit.filter((request) =>
  request.method !== "GET" ||
  request.protocol !== "http:" ||
  !allowedLoopbackHosts.has(request.hostname) ||
  request.pathname !== "/candles/range"
);
const safetyCore = Object.freeze({
  schemaVersion: "gotrader-bt1-6-read-only-safety-v1",
  qualificationReportId: report.reportId,
  verifiedAtUtc: new Date().toISOString(),
  verifierVersion: "bt1-6-read-only-request-audit-v1",
  loopbackOnly: requestAudit.every((request) =>
    request.protocol === "http:" && allowedLoopbackHosts.has(request.hostname)),
  getOnly: requestAudit.every((request) => request.method === "GET"),
  endpointCallCount: requestAudit.length,
  observedMethods: Object.freeze([...new Set(requestAudit.map((request) => request.method))].sort()),
  observedPaths: Object.freeze([...new Set(requestAudit.map((request) => request.pathname))].sort()),
  forbiddenEndpointCallCount: forbiddenRequests.length,
  status: requestAudit.length > 0 && forbiddenRequests.length === 0 ? "passed" : "blocked",
  blockers: Object.freeze([
    ...(requestAudit.length ? [] : ["historical_read_only_request_audit_empty"]),
    ...(forbiddenRequests.length ? ["historical_forbidden_request_observed"] : [])
  ]),
  authority: authorityNone
});
const safetyReport = Object.freeze({
  ...safetyCore,
  safetyReportId: await modules.canonical.canonicalHash(safetyCore)
});
const safetyReportPath = writeJsonAtomic(path.join(runRoot, "read-only-safety-report.json"), safetyReport);
console.log(JSON.stringify({
  status: controlledInterruption ? "controlled_interruption" : blockers.length ? "blocked" : "passed",
  reportId: report.reportId,
  action: report.action,
  datasetId: identitySummary?.datasetId,
  capacityPlanId: report.capacityPlanId,
  elapsedMs,
  peakRssBytes,
  storageBytes: storageUsage.bytes,
  safetyReportId: safetyReport.safetyReportId,
  safetyReportPath,
  blockers,
  reportPath,
  authority: report.authority
}, null, 2));
if (failure) {
  if (controlledInterruption) process.exitCode = 75;
  else throw failure;
}
