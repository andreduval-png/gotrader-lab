#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeJsonAtomic } from "./gotrader-runtime-io.mjs";
import { continuousFeedAuthority } from "./gotrader-continuous-feed-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const feedUrl = String(
  process.env.GOTRADER_OBSERVE_FEED_URL || "http://127.0.0.1:7343"
).replace(/\/+$/, "");
const schedulerUrl = String(
  process.env.GOTRADER_OBSERVE_SCHEDULER_URL || "http://127.0.0.1:7344"
).replace(/\/+$/, "");
const durationSeconds = Math.max(
  1,
  Number(process.env.GOTRADER_OBSERVE_DURATION_SECONDS || process.argv[2] || 360)
);
const pollMs = Math.max(
  250,
  Number(process.env.GOTRADER_OBSERVE_POLL_MS || 2_000)
);
const stateRoot = process.env.GOTRADER_RUNTIME_STATE_ROOT
  ? path.resolve(process.env.GOTRADER_RUNTIME_STATE_ROOT)
  : path.join(repoRoot, ".gotrader", "runtime");
const profileId =
  process.env.GOTRADER_RUNTIME_PROFILE_ID || "always_on_shadow_context";
const outputFile = path.join(
  stateRoot,
  profileId,
  "observations",
  `verified-close-${Date.now()}.json`
);
const startedAt = new Date().toISOString();
const startMs = Date.now();
let afterSequence = 0;
const closeIds = new Set();
const proofIds = new Set();
const blockers = new Set();
let lastFeedStatus;
let firstFeedStatus;
let lastSchedulerStatus;
let firstSchedulerStatus;
let transportFailures = 0;
let proofRefreshCount = 0;
let proofExpirationCount = 0;
let priorProofId;
let priorProofState;
let maximumFeedMemoryBytes = 0;
let maximumSchedulerMemoryBytes = 0;
let maximumQueueDepth = 0;

while (Date.now() - startMs < durationSeconds * 1_000) {
  try {
    const [statusResponse, eventsResponse, schedulerResponse] = await Promise.all([
      fetch(`${feedUrl}/status`, { cache: "no-store" }),
      fetch(`${feedUrl}/events?afterSequence=${afterSequence}&limit=500`, {
        cache: "no-store"
      }),
      fetch(`${schedulerUrl}/status`, { cache: "no-store" })
    ]);
    if (!statusResponse.ok || !eventsResponse.ok || !schedulerResponse.ok) {
      throw new Error(
        `HTTP status=${statusResponse.status} events=${eventsResponse.status} scheduler=${schedulerResponse.status}`
      );
    }
    lastFeedStatus = await statusResponse.json();
    lastSchedulerStatus = await schedulerResponse.json();
    firstFeedStatus ??= lastFeedStatus;
    firstSchedulerStatus ??= lastSchedulerStatus;
    const proofId = lastFeedStatus.verificationArtifactId;
    const proofState = lastFeedStatus.verificationProofState;
    if (priorProofId && proofId && priorProofId !== proofId) proofRefreshCount += 1;
    if (
      priorProofState &&
      priorProofState !== proofState &&
      ["expiring", "stale", "conflicting"].includes(proofState)
    ) {
      proofExpirationCount += 1;
    }
    priorProofId = proofId;
    priorProofState = proofState;
    maximumFeedMemoryBytes = Math.max(
      maximumFeedMemoryBytes,
      Number(lastFeedStatus.memoryRssBytes ?? 0)
    );
    maximumSchedulerMemoryBytes = Math.max(
      maximumSchedulerMemoryBytes,
      Number(lastSchedulerStatus.memoryRssBytes ?? 0)
    );
    maximumQueueDepth = Math.max(
      maximumQueueDepth,
      Number(lastSchedulerStatus.queueDepth ?? 0)
    );
    const page = await eventsResponse.json();
    for (const event of page.events ?? []) {
      afterSequence = Math.max(afterSequence, Number(event.sequence ?? 0));
      if (
        event.type === "candle_closed" &&
        event.requestedSymbol === "MNQ" &&
        event.brokerSymbol === "USTECH" &&
        event.timeframe === "5m"
      ) {
        closeIds.add(event.eventId);
        if (event.timeVerificationArtifactId) {
          proofIds.add(event.timeVerificationArtifactId);
        } else {
          blockers.add("verified_close_missing_time_artifact");
        }
      }
    }
  } catch (error) {
    transportFailures += 1;
    blockers.add(
      `observation_transport_failure:${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}

if (!closeIds.size) blockers.add("no_verified_live_m5_close_observed");
if (lastFeedStatus?.verificationProofState !== "fresh") {
  blockers.add("current_live_time_proof_not_fresh");
}
const status = blockers.size
  ? "blocked"
  : closeIds.size >= 2
    ? "passed"
    : "passed_with_limited_observation";
const artifact = {
  version: 1,
  status,
  startedAt,
  completedAt: new Date().toISOString(),
  durationSeconds,
  feedUrl,
  schedulerUrl,
  runtimeUptimeSeconds: firstFeedStatus?.startedAt
    ? Math.max(
        0,
        Math.round(
          (Date.now() - Date.parse(firstFeedStatus.startedAt)) / 1_000
        )
      )
    : undefined,
  observedCloseCount: closeIds.size,
  uniqueProofArtifactCount: proofIds.size,
  proofRefreshCount,
  proofExpirationCount,
  quoteUpdateCount:
    Number(lastFeedStatus?.quoteUpdateCount ?? 0) -
    Number(firstFeedStatus?.quoteUpdateCount ?? 0),
  formingCandleUpdateCount:
    Number(lastFeedStatus?.formingCandleUpdateCount ?? 0) -
    Number(firstFeedStatus?.formingCandleUpdateCount ?? 0),
  rejectedCloseCount:
    Number(lastFeedStatus?.rejectedCloseEventCount ?? 0) -
    Number(firstFeedStatus?.rejectedCloseEventCount ?? 0),
  duplicateCloseAttempts:
    Number(lastFeedStatus?.duplicateCloseEventCount ?? 0) -
    Number(firstFeedStatus?.duplicateCloseEventCount ?? 0),
  payloadConflicts:
    Number(lastFeedStatus?.conflictingCandleCount ?? 0) -
    Number(firstFeedStatus?.conflictingCandleCount ?? 0),
  reconciliationCount:
    Number(lastFeedStatus?.recoveredEventCount ?? 0) -
    Number(firstFeedStatus?.recoveredEventCount ?? 0),
  contextCycleCount:
    Number(lastSchedulerStatus?.shadowContext?.completedCount ?? 0) -
    Number(firstSchedulerStatus?.shadowContext?.completedCount ?? 0),
  contextBlockedCount:
    Number(lastSchedulerStatus?.shadowContext?.blockedCount ?? 0) -
    Number(firstSchedulerStatus?.shadowContext?.blockedCount ?? 0),
  droppedEvents:
    Number(lastSchedulerStatus?.droppedEventCount ?? 0) -
    Number(firstSchedulerStatus?.droppedEventCount ?? 0),
  coalescedEvents:
    Number(lastSchedulerStatus?.coalescedEventCount ?? 0) -
    Number(firstSchedulerStatus?.coalescedEventCount ?? 0),
  maximumQueueDepth,
  maximumFeedMemoryBytes,
  maximumSchedulerMemoryBytes,
  feedCpuUserMicroseconds:
    Number(lastFeedStatus?.cpuUserMicroseconds ?? 0) -
    Number(firstFeedStatus?.cpuUserMicroseconds ?? 0),
  schedulerCpuUserMicroseconds:
    Number(lastSchedulerStatus?.cpuUserMicroseconds ?? 0) -
    Number(firstSchedulerStatus?.cpuUserMicroseconds ?? 0),
  ledgerGapCount: lastSchedulerStatus?.blockers?.includes(
    "durable_event_ledger_gap_reconciliation_required"
  )
    ? 1
    : 0,
  lastSequence: afterSequence,
  transportFailures,
  feedState: lastFeedStatus?.state,
  verificationProofState: lastFeedStatus?.verificationProofState,
  verificationArtifactId: lastFeedStatus?.verificationArtifactId,
  blockers: [...blockers],
  rawCandlesPersisted: false,
  productionAdoptionAllowed: false,
  ...continuousFeedAuthority
};
await writeJsonAtomic(outputFile, artifact);
console.log(JSON.stringify({ ...artifact, outputFile }, null, 2));
process.exit(status === "blocked" ? 2 : 0);
