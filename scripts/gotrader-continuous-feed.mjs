#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTINUOUS_FEED_SERVICE_VERSION,
  compactDurableMarketEvent,
  continuousFeedAuthority,
  continuousFeedCapability,
  createContinuousFeedEngine,
  defaultRollingStoreCapacities,
  evaluateRuntimeTimeContract,
  normalizeRuntimeProviderTimestamp,
  normalizeRuntimeTimeframe,
  runtimeTimeVerificationSnapshotCoherent,
  selectRuntimeContextWindows
} from "./gotrader-continuous-feed-core.mjs";
import {
  buildHistoricalContextHydrationArtifact,
  validateHistoricalContextHydrationArtifact
} from "./gotrader-historical-context-hydrator-core.mjs";
import { readJsonFile, writeJsonAtomic } from "./gotrader-runtime-io.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileId =
  process.env.GOTRADER_RUNTIME_PROFILE_ID || "always_on_read_only_scheduler";
const requireVerificationArtifact = [
  "always_on_shadow_context",
  "always_on_shadow_context_verified",
  "always_on_shadow_context_operational"
].includes(profileId);
const requireWatcherArtifact = [
  "always_on_shadow_context_verified",
  "always_on_shadow_context_operational"
].includes(profileId);
const requireHistoricalContextHydration =
  profileId === "always_on_shadow_context_operational";
const stateRoot = process.env.GOTRADER_RUNTIME_STATE_ROOT
  ? path.resolve(process.env.GOTRADER_RUNTIME_STATE_ROOT)
  : path.join(repoRoot, ".gotrader", "runtime");
const runtimeRoot = path.join(stateRoot, profileId);
const verificationArtifactFile =
  process.env.GOTRADER_TIME_VERIFICATION_ARTIFACT_FILE
    ? path.resolve(process.env.GOTRADER_TIME_VERIFICATION_ARTIFACT_FILE)
    : path.join(
        runtimeRoot,
        "time",
        "current-live-verification.json"
      );
const verifierStatusFile = path.join(
  runtimeRoot,
  "time",
  "watcher-status.json"
);
const feedRoot = path.join(runtimeRoot, "feed");
const checkpointFile = path.join(feedRoot, "checkpoint.json");
const eventLedgerFile = path.join(feedRoot, "events.json");
const statusFile = path.join(feedRoot, "status.json");
const hydrationArtifactFile = path.join(
  feedRoot,
  "historical-context-hydration.json"
);

const host = process.env.GOTRADER_FEED_HOST || "127.0.0.1";
const port = Math.min(
  65_535,
  Math.max(1, Number(process.env.GOTRADER_FEED_PORT || 7343))
);
const bridgeUrl = String(
  process.env.GOTRADER_FEED_BRIDGE_URL || "http://127.0.0.1:7341"
).replace(/\/+$/, "");
const quotePollMs = Math.min(
  10_000,
  Math.max(500, Number(process.env.GOTRADER_FEED_QUOTE_POLL_MS || 1_000))
);
const candlePollMs = Math.min(
  60_000,
  Math.max(2_000, Number(process.env.GOTRADER_FEED_CANDLE_POLL_MS || 5_000))
);
const timeContractPollMs = Math.min(
  120_000,
  Math.max(5_000, Number(process.env.GOTRADER_FEED_TIME_CONTRACT_POLL_MS || 10_000))
);
const requestTimeoutMs = Math.min(
  10_000,
  Math.max(500, Number(process.env.GOTRADER_FEED_REQUEST_TIMEOUT_MS || 3_000))
);
const maximumDurableEvents = Math.min(
  20_000,
  Math.max(100, Number(process.env.GOTRADER_FEED_MAXIMUM_EVENTS || 5_000))
);
const bootstrapLimit = Math.min(
  2_000,
  Math.max(3, Number(process.env.GOTRADER_FEED_BOOTSTRAP_LIMIT || 300))
);
const liveLimit = Math.min(
  24,
  Math.max(3, Number(process.env.GOTRADER_FEED_LIVE_LIMIT || 3))
);
const closeFinalizationDelayMs = Math.min(
  60_000,
  Math.max(
    0,
    Number(process.env.GOTRADER_FEED_CLOSE_FINALIZATION_DELAY_MS || 15_000)
  )
);
const requestedSymbol = process.env.GOTRADER_FEED_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.GOTRADER_FEED_BROKER_SYMBOL || "USTECH";
const timeframes = [
  ...new Set(
    String(process.env.GOTRADER_FEED_TIMEFRAMES || "1m,5m,15m,1h,4h,1d")
      .split(",")
      .map(normalizeRuntimeTimeframe)
      .filter(Boolean)
  )
];

await fs.mkdir(feedRoot, { recursive: true });
const checkpointExists = await fs
  .access(checkpointFile)
  .then(() => true)
  .catch(() => false);
const savedCheckpoint = await readJsonFile(checkpointFile);
let durableEvents = (await readJsonFile(eventLedgerFile))?.events;
if (!Array.isArray(durableEvents)) durableEvents = [];
let nextSequence = Math.max(
  0,
  ...durableEvents.map((event) => Number(event.sequence ?? 0))
);
let checkpointStatus = checkpointExists
  ? savedCheckpoint
    ? "loaded"
    : "corrupt"
  : "missing";
const engine = createContinuousFeedEngine({
  capacities: defaultRollingStoreCapacities,
  checkpoint: savedCheckpoint,
  knownEvents: durableEvents,
  maximumCloseEventIds: maximumDurableEvents,
  closeFinalizationDelayMs,
  requireVerificationArtifact,
  requireWatcherArtifact
});

let stopping = false;
let lastStatus = {
  ...engine.status(),
  state: "starting",
  bridgeUrl,
  activeSymbols: [brokerSymbol],
  activeTimeframes: timeframes,
  checkpointStatus,
  startedAt: new Date().toISOString(),
  lastHeartbeatAt: new Date().toISOString(),
  processId: process.pid,
  durableEventCount: durableEvents.length,
  pollIntervalsMs: {
    quote: quotePollMs,
    candle: candlePollMs,
    timeContract: timeContractPollMs,
    closeFinalizationDelay: closeFinalizationDelayMs
  },
  ...continuousFeedCapability,
  ...continuousFeedAuthority
};
let latestTimeContract;
let latestVerificationArtifact;
let latestVerifierStatus;
const readCoherentWatcherSnapshot = async () => {
  let verificationArtifact;
  let verifierStatus;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    // The verifier commits artifact before status. Reading status first means a
    // matching pair is always one bounded retry away during renewal.
    verifierStatus = await readJsonFile(verifierStatusFile);
    verificationArtifact = await readJsonFile(verificationArtifactFile);
    if (
      runtimeTimeVerificationSnapshotCoherent({
        verificationArtifact,
        verifierStatus
      })
    ) {
      return { verificationArtifact, verifierStatus };
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  return { verificationArtifact, verifierStatus };
};
let latestCandlePayloads = [];
let hydrationArtifact;
let hydrationReady = !requireHistoricalContextHydration;
let consecutiveFailures = 0;
let lastCandlePollAt = 0;
let lastTimeContractPollAt = 0;
const processResources = () => ({
  memoryRssBytes: process.memoryUsage().rss,
  cpuUserMicroseconds: process.cpuUsage().user,
  cpuSystemMicroseconds: process.cpuUsage().system
});

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const persistResult = async (result) => {
  const durableTypes = new Set([
    "candle_closed",
    "feed_stale",
    "feed_recovered",
    "source_blocked"
  ]);
  const knownIds = new Set(durableEvents.map((event) => event.eventId));
  let changed = false;
  for (const event of result.events.filter((item) => durableTypes.has(item.type))) {
    if (knownIds.has(event.eventId)) continue;
    nextSequence += 1;
    durableEvents.push({
      ...compactDurableMarketEvent(event),
      sequence: nextSequence
    });
    knownIds.add(event.eventId);
    changed = true;
  }
  if (durableEvents.length > maximumDurableEvents) {
    durableEvents = durableEvents.slice(-maximumDurableEvents);
    changed = true;
  }
  if (changed) {
    await writeJsonAtomic(eventLedgerFile, {
      version: 1,
      events: durableEvents,
      updatedAt: new Date().toISOString(),
      ...continuousFeedAuthority
    });
  }
  await writeJsonAtomic(checkpointFile, result.checkpoint);
  checkpointStatus = "healthy";
  lastStatus = {
    ...result.status,
    bridgeUrl,
    activeSymbols: [brokerSymbol],
    activeTimeframes: timeframes,
    checkpointStatus,
    startedAt: lastStatus.startedAt,
    lastHeartbeatAt: new Date().toISOString(),
    processId: process.pid,
    durableEventCount: durableEvents.length,
    historicalContextHydration: hydrationArtifact ?? {
      status: requireHistoricalContextHydration ? "pending" : "not_required",
      rawCandlesPersisted: false
    },
    lastSequence: nextSequence,
    pollIntervalsMs: lastStatus.pollIntervalsMs,
    ...processResources(),
    ...continuousFeedCapability,
    ...continuousFeedAuthority
  };
  await writeJsonAtomic(statusFile, lastStatus);
};

const poll = async () => {
  const now = Date.now();
  try {
    let candlePayloadsForPoll = [];
    const candlePollDue =
      !latestCandlePayloads.length || now - lastCandlePollAt >= candlePollMs;
    if (
      !latestTimeContract ||
      now - lastTimeContractPollAt >= timeContractPollMs ||
      candlePollDue
    ) {
      latestTimeContract = await fetchJson(
        `${bridgeUrl}/time-contract?symbol=${encodeURIComponent(brokerSymbol)}`
      );
      lastTimeContractPollAt = now;
      if (requireWatcherArtifact) {
        const watcherSnapshot = await readCoherentWatcherSnapshot();
        latestVerificationArtifact = watcherSnapshot.verificationArtifact;
        latestVerifierStatus = watcherSnapshot.verifierStatus;
      } else {
        latestVerificationArtifact = undefined;
        latestVerifierStatus = undefined;
      }
    }
    const quotePayload = await fetchJson(
      `${bridgeUrl}/quote?requestedSymbol=${encodeURIComponent(
        requestedSymbol
      )}&symbol=${encodeURIComponent(brokerSymbol)}`
    );
    if (candlePollDue) {
      latestCandlePayloads = await Promise.all(
        timeframes.map((timeframe) =>
          fetchJson(
            `${bridgeUrl}/candles?requestedSymbol=${encodeURIComponent(
              requestedSymbol
            )}&symbol=${encodeURIComponent(
              brokerSymbol
            )}&timeframe=${encodeURIComponent(timeframe)}&limit=${
              hydrationReady ? liveLimit : bootstrapLimit
            }`
          )
        )
      );
      candlePayloadsForPoll = latestCandlePayloads;
      lastCandlePollAt = now;
    }
    if (requireHistoricalContextHydration && !hydrationReady) {
      const hydrationTimeContract = evaluateRuntimeTimeContract(
        latestTimeContract,
        {
          requireVerificationArtifact,
          requireWatcherArtifact,
          verificationArtifact: latestVerificationArtifact,
          verifierStatus: latestVerifierStatus,
          nowUtc: new Date().toISOString()
        }
      );
      if (!hydrationTimeContract.eligible) {
        throw new Error(
          `historical_context_hydration_waiting_for_verified_time:${hydrationTimeContract.blockers.join(",")}`
        );
      }
      const hydrationAsOf = normalizeRuntimeProviderTimestamp(
        quotePayload?.timestamp ??
          quotePayload?.serverTimestamp ??
          quotePayload?.rawTime,
        hydrationTimeContract
      );
      hydrationArtifact = buildHistoricalContextHydrationArtifact({
        candlePayloads: latestCandlePayloads,
        asOfUtc:
          hydrationAsOf.normalizedTimeUtc ?? new Date().toISOString(),
        timeContractVersion:
          latestTimeContract?.version ??
          latestTimeContract?.wrapperContractVersion ??
          "unknown",
        timeContractIdentityVersion:
          hydrationTimeContract.identityVersion,
        timeContract: hydrationTimeContract
      });
      const validation =
        validateHistoricalContextHydrationArtifact(hydrationArtifact);
      if (!validation.valid) {
        throw new Error(
          `historical_context_hydration_invalid:${validation.errors.join(",")}`
        );
      }
      await writeJsonAtomic(hydrationArtifactFile, hydrationArtifact);
      hydrationReady = hydrationArtifact.status === "ready";
    }
    const result = engine.processPoll({
      quotePayload,
      candlePayloads: candlePayloadsForPoll,
      timeContract: latestTimeContract,
      verificationArtifact: latestVerificationArtifact,
      verifierStatus: latestVerifierStatus,
      receivedAt: new Date().toISOString()
    });
    consecutiveFailures = 0;
    await persistResult(result);
  } catch (error) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= 3) {
      const result = engine.markFeedStale({
        reason: `market_data_transport_stale:${error instanceof Error ? error.message : String(error)}`
      });
      await persistResult(result);
    } else {
      lastStatus = {
        ...lastStatus,
        state: "degraded",
        lastHeartbeatAt: new Date().toISOString(),
        warnings: [
          ...new Set([
            ...(lastStatus.warnings ?? []),
            error instanceof Error ? error.message : String(error)
          ])
        ],
        ...processResources(),
        ...continuousFeedCapability,
        ...continuousFeedAuthority
      };
      await writeJsonAtomic(statusFile, lastStatus);
    }
  }
};

const json = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (request.method !== "GET") {
    json(response, 405, {
      message: "Continuous feed status endpoints are read-only.",
      ...continuousFeedAuthority
    });
    return;
  }
  if (url.pathname === "/health") {
    json(response, 200, {
      serviceVersion: CONTINUOUS_FEED_SERVICE_VERSION,
      processStatus: "running",
      feedState: lastStatus.state,
      lastHeartbeatAt: lastStatus.lastHeartbeatAt,
      ...continuousFeedCapability,
      ...continuousFeedAuthority
    });
    return;
  }
  if (url.pathname === "/status") {
    json(response, 200, lastStatus);
    return;
  }
  if (url.pathname === "/events") {
    const afterSequence = Math.max(0, Number(url.searchParams.get("afterSequence") ?? 0));
    const limit = Math.min(
      500,
      Math.max(1, Number(url.searchParams.get("limit") ?? 100))
    );
    json(response, 200, {
      events: durableEvents
        .filter((event) => Number(event.sequence ?? 0) > afterSequence)
        .slice(0, limit),
      earliestSequence: Number(durableEvents.at(0)?.sequence ?? nextSequence),
      latestSequence: nextSequence,
      ...continuousFeedAuthority
    });
    return;
  }
  if (url.pathname === "/windows") {
    const requested = url.searchParams.get("requestedSymbol") || requestedSymbol;
    const broker = url.searchParams.get("brokerSymbol") || brokerSymbol;
    const requestedTimeframes = [
      ...new Set(
        String(url.searchParams.get("timeframes") || "5m,15m,1h,4h,1d")
          .split(",")
          .map(normalizeRuntimeTimeframe)
          .filter(Boolean)
      )
    ];
    const asOf =
      new Date(url.searchParams.get("asOf") || Date.now()).toISOString();
    const limit = Math.min(
      500,
      Math.max(3, Number(url.searchParams.get("limit") ?? 300))
    );
    const snapshot = engine.rollingStoreSnapshot();
    const windows = selectRuntimeContextWindows({
      snapshot,
      requestedSymbol: requested,
      brokerSymbol: broker,
      timeframes: requestedTimeframes,
      asOf,
      continuityStartedAtUtc: lastStatus.offsetRegimeStartUtc,
      hydrationArtifact: hydrationReady ? hydrationArtifact : undefined,
      limit
    });
    json(response, 200, {
      requestedSymbol: requested,
      brokerSymbol: broker,
      asOf,
      windows,
      timeContract: {
        version: lastStatus.timeContractVersion,
        eligible: lastStatus.timeContractEligible,
        verificationArtifactId: lastStatus.verificationArtifactId,
        verificationScope: lastStatus.verificationScope,
        verificationGeneratedAtUtc: lastStatus.verificationGeneratedAtUtc,
        verificationExpiresAtUtc: lastStatus.verificationExpiresAtUtc,
        verificationProofState: lastStatus.verificationProofState,
        offsetRegimeStartUtc: lastStatus.offsetRegimeStartUtc,
        providerTimeBasis: lastStatus.providerTimeBasis,
        observedOffsetMinutes: lastStatus.observedOffsetMinutes
      },
      hydration: hydrationArtifact ?? {
        status: requireHistoricalContextHydration ? "pending" : "not_required",
        boundedHistoricalContextEligible: false,
        historicalEligible: false,
        historicalDstPolicyVerified: false,
        rawCandlesPersisted: false
      },
      sourceProvider: "mt5_read_only",
      rawCandlesPersisted: false,
      ...continuousFeedAuthority
    });
    return;
  }
  json(response, 404, {
    message: "Continuous feed endpoint not found.",
    ...continuousFeedAuthority
  });
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopping = true;
  });
}

server.listen(port, host, async () => {
  await writeJsonAtomic(statusFile, lastStatus);
  console.log(
    JSON.stringify({
      event: "continuous_feed_started",
      host,
      port,
      bridgeUrl,
      timeframes,
      requireVerificationArtifact,
      requireWatcherArtifact,
      ...continuousFeedAuthority
    })
  );
});

while (!stopping) {
  const started = Date.now();
  await poll();
  const delay = Math.max(50, quotePollMs - (Date.now() - started));
  await new Promise((resolve) => setTimeout(resolve, delay));
}

lastStatus = {
  ...lastStatus,
  state: "stopped",
  stoppedAt: new Date().toISOString(),
  ...continuousFeedCapability,
  ...continuousFeedAuthority
};
await writeJsonAtomic(statusFile, lastStatus);
await new Promise((resolve) => server.close(resolve));
