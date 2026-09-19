import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  BT_G1_3_IDENTITY,
  canonicalHash
} from "./bt-g1-3-certified-dataset.mjs";
import { loadVerifiedFoldAdmission, runVerifiedHistoricalFold } from "./p3-verified-fold-admission.mjs";
import { evaluateCapacityPreflight } from "./p4-capacity-preflight.mjs";
import { compileBtG13rRuntime } from "./bt-g1-3r-runtime.mjs";
import { buildExpandedEvaluationProtocol } from "./p4-expanded-evaluation-protocol.mjs";
import { bindExpandedPolicies, classifyScheduledObservations } from "./p4-expanded-admission.mjs";

export const BT_G1_3R_PILOT = Object.freeze({
  schemaVersion: "gotrader.bt-g1-3r.pilot-definition.v1",
  selectionPolicy: "First three regular New York sessions beginning Monday 2026-03-16; fixed 10:30 and 14:30 New York observations. Selected before outcome inspection.",
  startUtc: "2026-03-16T13:30:00.000Z",
  endUtc: "2026-03-19T20:00:00.000Z",
  warmupDays: 10,
  oneMinuteWarmupDays: 3,
  evaluationMinutesUtc: Object.freeze([14 * 60 + 30, 18 * 60 + 30]),
  costModelId: "bt-cost-ticks-v1",
  fillModelId: "bt2-conservative-stop-first-v1",
  tickSize: 0.25,
  spreadTicks: 1,
  slippageTicks: 1,
  commissionTicks: 1,
  maxBarsToResolveTrade: 48,
  checkpointEvery: 3
});

const datasetIdentity = Object.freeze({
  datasetId: BT_G1_3_IDENTITY.datasetId,
  datasetCertificateId: BT_G1_3_IDENTITY.certificateId,
  datasetChecksum: BT_G1_3_IDENTITY.datasetChecksum,
  sourceFingerprint: BT_G1_3_IDENTITY.sourceFingerprint
});

const inPilotSession = (timestamp) => {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const minute = date.getUTCHours() * 60 + date.getUTCMinutes();
  return day >= 1 && day <= 3 && BT_G1_3R_PILOT.evaluationMinutesUtc.includes(minute);
};

const atomicWrite = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
};

const peakSampler = () => {
  let peakRssBytes = process.memoryUsage().rss;
  let peakHeapUsedBytes = process.memoryUsage().heapUsed;
  let minimumFreeMemoryBytes = os.freemem();
  const timer = setInterval(() => {
    const memory = process.memoryUsage();
    peakRssBytes = Math.max(peakRssBytes, memory.rss);
    peakHeapUsedBytes = Math.max(peakHeapUsedBytes, memory.heapUsed);
    minimumFreeMemoryBytes = Math.min(minimumFreeMemoryBytes, os.freemem());
  }, 25);
  timer.unref();
  return () => {
    clearInterval(timer);
    const memory = process.memoryUsage();
    return {
      peakRssBytes: Math.max(peakRssBytes, memory.rss),
      peakHeapUsedBytes: Math.max(peakHeapUsedBytes, memory.heapUsed),
      minimumFreeMemoryBytes: Math.min(minimumFreeMemoryBytes, os.freemem())
    };
  };
};

export const runBtG13rPilot = async ({ mode = "pilot", resumeDirectory, interruptAfterCheckpoint = false, expandedQualification = false } = {}) => {
  if (expandedQualification && resumeDirectory) throw new Error("EXPANDED_QUALIFICATION_RESUME_NOT_ADMITTED");
  const protocol = expandedQualification ? buildExpandedEvaluationProtocol() : undefined;
  const definition = protocol ? { ...BT_G1_3R_PILOT,
    startUtc: protocol.evaluationTimes[0], endUtc: "2026-04-07T00:00:00.000Z",
    selectionPolicy: "Capacity qualification: first six observations of the expanded protocol; not full evaluation"
  } : BT_G1_3R_PILOT;
  const startedAt = new Date().toISOString();
  const wallStart = performance.now();
  const freeDiskBeforeBytes = fs.statfsSync(process.cwd()).bavail * fs.statfsSync(process.cwd()).bsize;
  const preflight = evaluateCapacityPreflight({ freeMemoryBytes: os.freemem(), freeDiskBytes: freeDiskBeforeBytes });
  if (preflight.status !== "BOUNDED_PROBE_ELIGIBLE") {
    throw new Error(`BT_G1_3R_CAPACITY_BLOCKED: ${preflight.blockers.join(",")}`);
  }
  const stopSampling = peakSampler();
  const outputDirectory = path.resolve(".gotrader", "bt-g1-3r", mode);
  const runtime = compileBtG13rRuntime({
    outputRoot: path.join(outputDirectory, "runtime"),
    entries: [
      "src/lib/historicalFold/historicalFoldStrategyAdapters.ts",
      "src/lib/historicalFold/runCanonicalHistoricalFold.ts",
      "src/lib/ownerValidationPolicy/ownerPerformancePolicyRegistry.ts"
    ]
  });
  const adaptersModule = await import(runtime.entryUrls["src/lib/historicalFold/historicalFoldStrategyAdapters.ts"]);
  const runnerModule = await import(runtime.entryUrls["src/lib/historicalFold/runCanonicalHistoricalFold.ts"]);
  const adapters = adaptersModule.CANONICAL_HISTORICAL_FOLD_ADAPTERS;
  const policyModule = await import(runtime.entryUrls["src/lib/ownerValidationPolicy/ownerPerformancePolicyRegistry.ts"]);
  const policyBinding = protocol ? bindExpandedPolicies({ protocol, adapters,
    policies: policyModule.canonicalOwnerPerformancePolicyRegistry }) : undefined;
  const requiredTimeframes = [...new Set(adapters.flatMap((adapter) => adapter.requiredTimeframes))];
  const admission = loadVerifiedFoldAdmission({
    requests: requiredTimeframes.map((timeframe) => ({
      timeframe,
      startUtc: definition.startUtc,
      endUtc: definition.endUtc,
      warmupDays: timeframe === "1m" ? BT_G1_3R_PILOT.oneMinuteWarmupDays : BT_G1_3R_PILOT.warmupDays
    }))
  });
  const { candlesByTimeframe } = admission;
  const pilotStartMs = Date.parse(definition.startUtc);
  const pilotEndMs = Date.parse(definition.endUtc);
  const scheduledObservations = protocol ? classifyScheduledObservations(protocol.evaluationTimes.slice(0, 6), candlesByTimeframe["5m"]) : undefined;
  if (scheduledObservations?.some((observation) => observation.status !== "AVAILABLE")) {
    atomicWrite(path.join(outputDirectory, "unavailable-observations.json"), scheduledObservations);
    throw new Error("EXPANDED_SCHEDULE_UNAVAILABLE");
  }
  const evaluationTimes = protocol ? scheduledObservations.map((observation) => observation.asOf) : candlesByTimeframe["5m"].map((candle) => candle.timestamp).filter((timestamp) => {
    const timestampMs = Date.parse(timestamp);
    return timestampMs >= pilotStartMs && timestampMs < pilotEndMs && inPilotSession(timestamp);
  });
  const results = [];
  for (const adapter of adapters) {
    const checkpointFile = path.join(outputDirectory, `${adapter.strategyId}.checkpoint.json`);
    const resumeFile = resumeDirectory ? path.join(path.resolve(resumeDirectory), `${adapter.strategyId}.checkpoint.json`) : undefined;
    const resumeFrom = resumeFile && fs.existsSync(resumeFile) ? JSON.parse(fs.readFileSync(resumeFile, "utf8")) : undefined;
    let checkpointCount = 0;
    let interrupted = false;
    try {
      const { result, provenance } = runVerifiedHistoricalFold(admission, runnerModule.runCanonicalHistoricalFold, {
        fold: {
          experimentFamilyId: protocol ? "p4-expanded-capacity-qualification-v1" : "bt-g1-3r-certified-pilot-v1",
          trialId: `pilot-${adapter.strategyId}`,
          foldId: "mechanical-three-session-pilot",
          partition: "oos",
          train: { startInclusive: "2024-08-01T00:00:00.000Z", endExclusive: "2025-08-01T00:00:00.000Z" },
          validation: { startInclusive: "2025-08-01T00:00:00.000Z", endExclusive: definition.startUtc },
          oos: { startInclusive: definition.startUtc, endExclusive: definition.endUtc },
          run: { startInclusive: definition.startUtc, endExclusive: definition.endUtc }
        },
        configurationId: policyBinding ? policyBinding.manifestHash : "bt-g1-3r-frozen-owner-defaults-v1",
        adapter,
        primaryTimeframe: "5m",
        evaluationTimes,
        costModelId: BT_G1_3R_PILOT.costModelId,
        fillModelId: BT_G1_3R_PILOT.fillModelId,
        tickSize: BT_G1_3R_PILOT.tickSize,
        spreadTicks: BT_G1_3R_PILOT.spreadTicks,
        slippageTicks: BT_G1_3R_PILOT.slippageTicks,
        commissionTicks: BT_G1_3R_PILOT.commissionTicks,
        maxBarsToResolveTrade: BT_G1_3R_PILOT.maxBarsToResolveTrade,
        checkpointEvery: BT_G1_3R_PILOT.checkpointEvery,
        resumeFrom,
        onCheckpoint(checkpoint) {
          checkpointCount += 1;
          atomicWrite(checkpointFile, checkpoint);
          if (interruptAfterCheckpoint && checkpointCount === 1) {
            interrupted = true;
            throw new Error("BT_G1_3R_CONTROLLED_INTERRUPT");
          }
        }
      });
      const resultFile = path.join(outputDirectory, `${adapter.strategyId}.result.json`);
      atomicWrite(resultFile, result);
      atomicWrite(path.join(outputDirectory, `${adapter.strategyId}.provenance.json`), provenance);
      results.push({ strategyId: adapter.strategyId, status: "completed", resultIdentityHash: result.resultIdentityHash, counts: result.counts, metrics: result.metrics, checkpointCount });
    } catch (error) {
      if (!interrupted) throw error;
      results.push({ strategyId: adapter.strategyId, status: "controlled_interruption", checkpointCount });
      break;
    }
    if (typeof global.gc === "function") global.gc();
  }
  const resources = stopSampling();
  const outputBytes = fs.readdirSync(outputDirectory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .reduce((total, entry) => total + fs.statSync(path.join(entry.parentPath ?? entry.path, entry.name)).size, 0);
  const freeDiskAfterBytes = fs.statfsSync(process.cwd()).bavail * fs.statfsSync(process.cwd()).bsize;
  const report = {
    schemaVersion: "gotrader.bt-g1-3r.pilot-report.v1",
    mode,
    startedAt,
    completedAt: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - wallStart),
    definition,
    ...(protocol ? { protocol, policyBinding, scheduledObservations } : {}),
    dataset: datasetIdentity,
    admission: admission.receipt,
    admissionHash: canonicalHash(admission.receipt),
    runtimeCompiledFiles: runtime.compiledFiles,
    candleCounts: Object.fromEntries(Object.entries(candlesByTimeframe).map(([timeframe, candles]) => [timeframe, candles.length])),
    evaluationCount: evaluationTimes.length,
    results,
    resources: {
      preflight,
      ...resources,
      freeDiskBeforeBytes,
      freeDiskAfterBytes,
      outputBytes,
      workerCount: 1,
      checkpointBatchSize: BT_G1_3R_PILOT.checkpointEvery
    },
    researchValidated: false,
    productionAdoptionAllowed: false,
    authority: "none/none/none"
  };
  atomicWrite(path.join(outputDirectory, "pilot-report.json"), report);
  return report;
};
