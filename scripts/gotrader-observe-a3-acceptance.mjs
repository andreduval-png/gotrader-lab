#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalHash,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";
import {
  buildA3OperationalAcceptanceChecks,
  eventsAfterAcceptanceBaseline,
  managedRestartCountDelta,
  resolveAcceptanceBaselineSequence
} from "./gotrader-a3-acceptance-core.mjs";
import { readJsonFile, writeJsonAtomic } from "./gotrader-runtime-io.mjs";
import { fetchObserverJsonWithRetry } from "./gotrader-observer-transport-core.mjs";

const args = process.argv.slice(2);
const argument = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileId =
  argument("--profile") ||
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
const observationTrack = profileId === "always_on_shadow_context_operational"
  ? "a3_2"
  : "a3_1";
const observationId = `${observationTrack}_acceptance_${Date.now()}`;
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
let activeMarketSamples = 0;
let freshActiveMarketProofSamples = 0;
let marketClosedPauseSamples = 0;
let unsafeMarketClosedSamples = 0;
let resumePendingSamples = 0;
let marketClosedSeen = false;
let freshProofAfterMarketClose = false;
let hydrationNotReadySamples = 0;
let historicalVerificationViolationSamples = 0;
let authorityViolationSamples = 0;
let ledgerGapSamples = 0;
let transportFailures = 0;
let observerTransportWarnings = 0;
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
const restartCountSnapshot = (supervisor) =>
  Object.fromEntries(
    [
      "market_data_feed",
      "autonomous_cycle_scheduler",
      "current_live_time_verifier"
    ].map((serviceId) => [
      serviceId,
      Number(
        supervisor?.services?.find?.(
          (service) => service.serviceId === serviceId
        )?.restartCount ?? 0
      )
    ])
  );
const baselineManagedRestartCounts = restartCountSnapshot(
  await readJsonFile(supervisorFile)
);
const verifiedCloses = new Map();
const contextCycles = new Map();
const blockers = new Set();
const transientResumeBlockers = new Set();

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopping = true;
  });
}

const fetchJson = async (url) => {
  const result = await fetchObserverJsonWithRetry(url);
  if (result.recovered) observerTransportWarnings += 1;
  return result.payload;
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
  const proofUptimePercentage = activeMarketSamples
      ? Number(
          (
            (freshActiveMarketProofSamples / activeMarketSamples) *
            100
          ).toFixed(2)
        )
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
  const currentManagedRestartCounts = restartCountSnapshot(
    await readJsonFile(supervisorFile)
  );
  const feedRestartCount =
    Math.max(
      0,
      currentManagedRestartCounts.market_data_feed -
        baselineManagedRestartCounts.market_data_feed
    );
  const schedulerRestartCount =
    Math.max(
      0,
      currentManagedRestartCounts.autonomous_cycle_scheduler -
        baselineManagedRestartCounts.autonomous_cycle_scheduler
    );
  const verifierRestartCount =
    Math.max(
      0,
      currentManagedRestartCounts.current_live_time_verifier -
        baselineManagedRestartCounts.current_live_time_verifier
    );
  const managedRestartDelta = managedRestartCountDelta({
    baseline: baselineManagedRestartCounts,
    current: currentManagedRestartCounts
  });
  const duplicateCloseCount =
    Number(lastFeed?.duplicateCloseEventCount ?? 0) -
    Number(firstFeed?.duplicateCloseEventCount ?? 0);
  const payloadConflictCount =
    Number(lastFeed?.conflictingCandleCount ?? 0) -
    Number(firstFeed?.conflictingCandleCount ?? 0);
  const ledgerGapCount = ledgerGapSamples;
  const duplicateContextCount =
    contextEntries.length -
    new Set(contextEntries.map((item) => item.cycleId)).size;
  const finalHydrationReady =
    lastFeed?.historicalContextHydration?.status === "ready";
  const finalRuntimeHealthy =
    lastVerifier?.state === "healthy" &&
    lastFeed?.state === "healthy" &&
    lastScheduler?.state === "healthy";
  const finalRuntimeBlockersClear = [
    lastVerifier,
    lastFeed,
    lastScheduler
  ].every((status) => (status?.blockers ?? []).length === 0);
  const marketResumeCountDelta = Math.max(
    0,
    Number(lastVerifier?.marketResumeCount ?? 0) -
      Number(firstVerifier?.marketResumeCount ?? 0)
  );
  const acceptanceChecks = buildA3OperationalAcceptanceChecks({
    elapsedSeconds,
    marketHourSpan,
    verifiedM5CloseCount: closeEntries.length,
    completedContextCount,
    blockedInsufficientContextCount,
    duplicateCloseCount,
    duplicateContextCount,
    payloadConflictCount,
    ledgerGapCount,
    activeMarketSamples,
    freshActiveMarketProofSamples,
    marketClosedPauseSamples,
    unsafeMarketClosedSamples,
    resumePendingSamples,
    marketResumeCountDelta,
    freshProofAfterMarketClose,
    verificationFailureCount,
    observerTransportFailures: transportFailures,
    managedRestartDelta,
    hydrationNotReadySamples,
    historicalVerificationViolationSamples,
    authorityViolationSamples,
    finalRuntimeHealthy,
    finalHydrationReady,
    finalRuntimeBlockersClear
  });
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
    totalSamples,
    activeMarketSamples,
    freshActiveMarketProofSamples,
    marketClosedPauseSamples,
    unsafeMarketClosedSamples,
    marketResumeCountDelta,
    freshProofAfterMarketClose,
    verificationFailureCount,
    transportFailures,
    observerTransportWarnings,
    hydrationNotReadySamples,
    historicalVerificationViolationSamples,
    authorityViolationSamples,
    ledgerGapSamples,
    managedRestartDelta,
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
    transientResumeBlockers: [...transientResumeBlockers],
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
      verifierStatus.marketState === "market_open" ||
      verifierStatus.marketState === "market_quiet"
    ) {
      activeMarketSamples += 1;
      if (
        verifierStatus.currentLiveEligible === true &&
        verifierStatus.verificationProofState === "fresh"
      ) {
        freshActiveMarketProofSamples += 1;
        if (marketClosedSeen) freshProofAfterMarketClose = true;
      }
    }
    if (verifierStatus.marketState === "market_closed") {
      marketClosedSeen = true;
      marketClosedPauseSamples += 1;
      if (
        verifierStatus.proofPausedForMarketClosed !== true ||
        verifierStatus.currentLiveEligible !== false ||
        feedStatus.state !== "paused_market_closed" ||
        schedulerStatus.state !== "paused_market_closed"
      ) {
        unsafeMarketClosedSamples += 1;
      }
    }
    if (verifierStatus.awaitingFreshProofAfterMarketResume === true) {
      resumePendingSamples += 1;
      for (const blocker of verifierStatus.blockers ?? []) {
        transientResumeBlockers.add(blocker);
      }
      for (const blocker of verifierStatus.resumeTransientBlockers ?? []) {
        transientResumeBlockers.add(blocker);
      }
    }
    if (feedStatus.historicalContextHydration?.status !== "ready") {
      hydrationNotReadySamples += 1;
    }
    if (
      verifierStatus.historicalEligible !== false ||
      feedStatus.historicalContextHydration?.historicalEligible !== false ||
      feedStatus.historicalContextHydration?.historicalDstPolicyVerified !==
        false
    ) {
      historicalVerificationViolationSamples += 1;
    }
    if (
      [
        feedStatus,
        schedulerStatus,
        verifierStatus,
        feedStatus.historicalContextHydration
      ].some(
        (status) =>
          status?.executionAuthority !== "none" ||
          status?.brokerAuthority !== "none" ||
          status?.readinessOverrideAuthority !== "none"
      )
    ) {
      authorityViolationSamples += 1;
    }
    if (
      schedulerStatus.blockers?.includes(
        "durable_event_ledger_gap_reconciliation_required"
      )
    ) {
      ledgerGapSamples += 1;
    }
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
    if (verifierStatus.awaitingFreshProofAfterMarketResume !== true) {
      for (const blocker of verifierStatus.blockers ?? []) blockers.add(blocker);
    }
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
          marketClosedPauseSamples: checkpoint.marketClosedPauseSamples,
          resumePendingSamples: checkpoint.resumePendingSamples,
          freshProofAfterMarketClose:
            checkpoint.freshProofAfterMarketClose,
          managedRestartDelta: checkpoint.managedRestartDelta,
          hydrationNotReadySamples:
            checkpoint.hydrationNotReadySamples,
          observerTransportWarnings:
            checkpoint.observerTransportWarnings,
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
