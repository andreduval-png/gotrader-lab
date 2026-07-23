#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalHash,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";
import {
  eventsAfterAcceptanceBaseline,
  resolveAcceptanceBaselineSequence
} from "./gotrader-a3-acceptance-core.mjs";
import { readJsonFile, writeJsonAtomic } from "./gotrader-runtime-io.mjs";

const args = process.argv.slice(2);
const argument = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileId =
  process.env.GOTRADER_RUNTIME_PROFILE_ID ||
  "always_on_shadow_context_verified";
const stateRoot = process.env.GOTRADER_RUNTIME_STATE_ROOT
  ? path.resolve(process.env.GOTRADER_RUNTIME_STATE_ROOT)
  : path.join(repoRoot, ".gotrader", "runtime");
const runtimeRoot = path.join(stateRoot, profileId);
const feedUrl = String(
  process.env.GOTRADER_OBSERVE_FEED_URL || "http://127.0.0.1:7343"
).replace(/\/+$/, "");
const schedulerUrl = String(
  process.env.GOTRADER_OBSERVE_SCHEDULER_URL || "http://127.0.0.1:7344"
).replace(/\/+$/, "");
const verifierUrl = String(
  process.env.GOTRADER_OBSERVE_VERIFIER_URL || "http://127.0.0.1:7345"
).replace(/\/+$/, "");
const durationHours = Number(
  argument("--duration-hours") ??
    process.env.GOTRADER_OBSERVE_DURATION_HOURS ??
    4
);
const durationSeconds = Math.max(
  1,
  Number(
    argument("--duration-seconds") ??
      process.env.GOTRADER_OBSERVE_DURATION_SECONDS ??
      durationHours * 3_600
  )
);
const pollMs = Math.min(
  30_000,
  Math.max(
    500,
    Number(
      argument("--poll-ms") ??
        process.env.GOTRADER_OBSERVE_POLL_MS ??
        5_000
    )
  )
);
const observationId = `a3_1_acceptance_${Date.now()}`;
const observationsRoot = path.join(runtimeRoot, "observations");
const checkpointFile = path.join(
  observationsRoot,
  `${observationId}.checkpoint.json`
);
const reportFile = path.join(observationsRoot, `${observationId}.json`);
const contextArtifactsFile = path.join(
  runtimeRoot,
  "context",
  "artifacts.json"
);
const supervisorFile = path.join(runtimeRoot, "supervisor.json");
const startedAt = new Date().toISOString();
const startMs = Date.now();
let stopping = false;
let afterSequence = 0;
let baselineSequence;
let totalSamples = 0;
let freshProofSamples = 0;
let transportFailures = 0;
let maximumFeedMemoryBytes = 0;
let maximumSchedulerMemoryBytes = 0;
let maximumVerifierMemoryBytes = 0;
let maximumQueueDepth = 0;
let firstFeed;
let lastFeed;
let firstScheduler;
let lastScheduler;
let firstVerifier;
let lastVerifier;
const verifiedCloses = new Map();
const contextCycles = new Map();
const blockers = new Set();

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopping = true;
  });
}

const fetchJson = async (url) => {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(4_000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
};
const compactCheckpoint = async ({ final = false } = {}) => {
  const closeEntries = [...verifiedCloses.values()];
  const contextEntries = [...contextCycles.values()];
  const marketTimes = closeEntries
    .map((item) => Date.parse(item.observedMarketTime ?? ""))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const marketHourSpan =
    marketTimes.length > 1
      ? Number(
          (
            (marketTimes.at(-1) - marketTimes[0]) /
            3_600_000
          ).toFixed(3)
        )
      : 0;
  const completedContextCount = contextEntries.filter(
    (item) => item.status === "completed"
  ).length;
  const blockedInsufficientContextCount = contextEntries.filter(
    (item) =>
      item.status === "blocked" &&
      item.blockers?.some((blocker) =>
        String(blocker).startsWith("insufficient_context_window:")
      )
  ).length;
  const elapsedSeconds = Math.round((Date.now() - startMs) / 1_000);
  const proofUptimePercentage = totalSamples
      ? Number(((freshProofSamples / totalSamples) * 100).toFixed(2))
      : 0;
  const proofRenewalCount = Math.max(
    0,
    Number(lastVerifier?.verificationRenewalCount ?? 0) -
      Number(firstVerifier?.verificationRenewalCount ?? 0)
  );
  const verificationFailureCount = Math.max(
    0,
    Number(lastVerifier?.verificationFailureCount ?? 0) -
      Number(firstVerifier?.verificationFailureCount ?? 0)
  );
  const feedRestartCount = Number(
    (await readJsonFile(supervisorFile))?.services?.find?.(
      (service) => service.serviceId === "market_data_feed"
    )?.restartCount ?? 0
  );
  const schedulerRestartCount = Number(
    (await readJsonFile(supervisorFile))?.services?.find?.(
      (service) => service.serviceId === "autonomous_cycle_scheduler"
    )?.restartCount ?? 0
  );
  const verifierRestartCount = Number(
    (await readJsonFile(supervisorFile))?.services?.find?.(
      (service) => service.serviceId === "current_live_time_verifier"
    )?.restartCount ?? 0
  );
  const duplicateCloseCount =
    Number(lastFeed?.duplicateCloseEventCount ?? 0) -
    Number(firstFeed?.duplicateCloseEventCount ?? 0);
  const payloadConflictCount =
    Number(lastFeed?.conflictingCandleCount ?? 0) -
    Number(firstFeed?.conflictingCandleCount ?? 0);
  const ledgerGapCount = lastScheduler?.blockers?.includes(
    "durable_event_ledger_gap_reconciliation_required"
  )
    ? 1
    : 0;
  const duplicateContextCount =
    contextEntries.length -
    new Set(contextEntries.map((item) => item.cycleId)).size;
  const acceptanceChecks = {
    observationDurationPassed: elapsedSeconds >= 4 * 3_600,
    marketHourSpanPassed: marketHourSpan >= 2,
    verifiedM5CloseCountPassed: closeEntries.length >= 3,
    completedContextCycleCountPassed: completedContextCount >= 3,
    noDuplicateCloses: duplicateCloseCount === 0,
    noDuplicateContextArtifacts: duplicateContextCount === 0,
    noPayloadConflicts: payloadConflictCount === 0,
    noLedgerGaps: ledgerGapCount === 0,
    proofFreshnessMaintained:
      totalSamples > 0 && freshProofSamples === totalSamples,
    noVerificationFailures: verificationFailureCount === 0,
    noObserverTransportFailures: transportFailures === 0,
    noVerificationBlockersObserved: blockers.size === 0
  };
  const acceptancePassed = Object.values(acceptanceChecks).every(Boolean);
  const core = {
    version: 1,
    observationId,
    status: final
      ? acceptancePassed
        ? "operationally_accepted"
        : "observation_incomplete"
      : "observing",
    startedAt,
    lastCheckpointAt: new Date().toISOString(),
    requiredDurationSeconds: 4 * 3_600,
    requestedDurationSeconds: durationSeconds,
    elapsedSeconds,
    marketHourSpan,
    verifiedCloseIds: closeEntries.map((item) => item.eventId),
    contextCycleIds: contextEntries.map((item) => item.cycleId),
    verifiedM5CloseCount: closeEntries.length,
    contextTaskTriggeredCount: contextEntries.length,
    completedContextCycleCount: completedContextCount,
    blockedInsufficientContextCount,
    duplicateCloseCount,
    duplicateContextCount,
    payloadConflictCount,
    ledgerGapCount,
    feedRestartCount,
    schedulerRestartCount,
    verifierRestartCount,
    proofRenewalCount,
    proofUptimePercentage,
    verificationFailureCount,
    transportFailures,
    maximumQueueDepth,
    maximumFeedMemoryBytes,
    maximumSchedulerMemoryBytes,
    maximumVerifierMemoryBytes,
    feedCpuUserMicroseconds:
      Number(lastFeed?.cpuUserMicroseconds ?? 0) -
      Number(firstFeed?.cpuUserMicroseconds ?? 0),
    schedulerCpuUserMicroseconds:
      Number(lastScheduler?.cpuUserMicroseconds ?? 0) -
      Number(firstScheduler?.cpuUserMicroseconds ?? 0),
    verifierCpuUserMicroseconds:
      Number(lastVerifier?.cpuUserMicroseconds ?? 0) -
      Number(firstVerifier?.cpuUserMicroseconds ?? 0),
    acceptanceChecks,
    blockers: [...blockers],
    shadowIfvgComparisonEnabled: false,
    rawCandlesPersisted: false,
    rawContextFactsPersisted: false,
    productionAdoptionAllowed: false,
    ...currentLiveVerificationAuthority
  };
  return {
    ...core,
    integrityHash: canonicalHash(core)
  };
};

let nextProgressAt = 0;
while (!stopping && Date.now() - startMs < durationSeconds * 1_000) {
  try {
    const [feedStatus, schedulerStatus, verifierStatus, events] =
      await Promise.all([
        fetchJson(`${feedUrl}/status`),
        fetchJson(`${schedulerUrl}/status`),
        fetchJson(`${verifierUrl}/status`),
        fetchJson(`${feedUrl}/events?afterSequence=${afterSequence}&limit=500`)
      ]);
    totalSamples += 1;
    if (
      verifierStatus.currentLiveEligible === true &&
      verifierStatus.verificationProofState === "fresh"
    ) {
      freshProofSamples += 1;
    }
    firstFeed ??= feedStatus;
    firstScheduler ??= schedulerStatus;
    firstVerifier ??= verifierStatus;
    lastFeed = feedStatus;
    lastScheduler = schedulerStatus;
    lastVerifier = verifierStatus;
    maximumFeedMemoryBytes = Math.max(
      maximumFeedMemoryBytes,
      Number(feedStatus.memoryRssBytes ?? 0)
    );
    maximumSchedulerMemoryBytes = Math.max(
      maximumSchedulerMemoryBytes,
      Number(schedulerStatus.memoryRssBytes ?? 0)
    );
    maximumVerifierMemoryBytes = Math.max(
      maximumVerifierMemoryBytes,
      Number(verifierStatus.memoryRssBytes ?? 0)
    );
    maximumQueueDepth = Math.max(
      maximumQueueDepth,
      Number(schedulerStatus.queueDepth ?? 0)
    );
    const receivedEvents = events.events ?? [];
    if (baselineSequence === undefined) {
      baselineSequence = resolveAcceptanceBaselineSequence({
        feedLastSequence: feedStatus.lastSequence,
        events: receivedEvents
      });
      afterSequence = baselineSequence;
    }
    for (const event of eventsAfterAcceptanceBaseline({
      events: receivedEvents,
      baselineSequence
    })) {
      afterSequence = Math.max(afterSequence, Number(event.sequence ?? 0));
      if (
        event.type === "candle_closed" &&
        event.requestedSymbol === "MNQ" &&
        event.brokerSymbol === "USTECH" &&
        event.timeframe === "5m" &&
        event.timeVerificationArtifactId
      ) {
        verifiedCloses.set(event.eventId, {
          eventId: event.eventId,
          observedMarketTime: event.observedMarketTime
        });
      }
    }
    const contextArtifactFile = await readJsonFile(contextArtifactsFile);
    for (const artifact of contextArtifactFile?.artifacts ?? []) {
      if (!verifiedCloses.has(artifact.triggerEventId)) continue;
      contextCycles.set(artifact.artifactId, {
        artifactId: artifact.artifactId,
        cycleId: artifact.cycleId,
        status: artifact.status,
        blockers: artifact.blockers ?? []
      });
    }
    for (const blocker of verifierStatus.blockers ?? []) blockers.add(blocker);
    if (Date.now() >= nextProgressAt) {
      const checkpoint = await compactCheckpoint();
      await writeJsonAtomic(checkpointFile, checkpoint);
      console.log(
        JSON.stringify({
          observationId,
          elapsedSeconds: checkpoint.elapsedSeconds,
          proofUptimePercentage: checkpoint.proofUptimePercentage,
          verifiedM5CloseCount: checkpoint.verifiedM5CloseCount,
          contextTaskTriggeredCount: checkpoint.contextTaskTriggeredCount,
          completedContextCycleCount: checkpoint.completedContextCycleCount,
          blockedInsufficientContextCount:
            checkpoint.blockedInsufficientContextCount,
          duplicateCloseCount: checkpoint.duplicateCloseCount,
          payloadConflictCount: checkpoint.payloadConflictCount,
          ledgerGapCount: checkpoint.ledgerGapCount,
          authority: currentLiveVerificationAuthority
        })
      );
      nextProgressAt = Date.now() + 30_000;
    }
  } catch (error) {
    transportFailures += 1;
    blockers.add(
      `acceptance_observer_transport_failure:${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}

const finalReport = await compactCheckpoint({ final: true });
await writeJsonAtomic(checkpointFile, finalReport);
await writeJsonAtomic(reportFile, finalReport);
console.log(JSON.stringify({ ...finalReport, reportFile }, null, 2));
process.exit(finalReport.status === "operationally_accepted" ? 0 : 2);
