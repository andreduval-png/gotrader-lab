#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTONOMOUS_SCHEDULER_SERVICE_VERSION,
  buildSchedulerTaskRegistry,
  createAutonomousSchedulerEngine,
  disabledSchedulerCapabilities,
} from "./gotrader-autonomous-scheduler-core.mjs";
import {
  continuousFeedAuthority,
  continuousFeedCapability
} from "./gotrader-continuous-feed-core.mjs";
import { readJsonFile, writeJsonAtomic } from "./gotrader-runtime-io.mjs";
import {
  createShadowContextController,
  loadShadowContextDependencies
} from "./gotrader-shadow-context-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileId =
  process.env.GOTRADER_RUNTIME_PROFILE_ID || "always_on_read_only_scheduler";
const stateRoot = process.env.GOTRADER_RUNTIME_STATE_ROOT
  ? path.resolve(process.env.GOTRADER_RUNTIME_STATE_ROOT)
  : path.join(repoRoot, ".gotrader", "runtime");
const schedulerRoot = path.join(stateRoot, profileId, "scheduler");
const checkpointFile = path.join(schedulerRoot, "checkpoint.json");
const artifactFile = path.join(schedulerRoot, "artifacts.json");
const statusFile = path.join(schedulerRoot, "status.json");
const controlFile = path.join(schedulerRoot, "control.json");
const contextRoot = path.join(stateRoot, profileId, "context");

const host = process.env.GOTRADER_SCHEDULER_HOST || "127.0.0.1";
const port = Math.min(
  65_535,
  Math.max(1, Number(process.env.GOTRADER_SCHEDULER_PORT || 7344))
);
const feedUrl = String(
  process.env.GOTRADER_SCHEDULER_FEED_URL || "http://127.0.0.1:7343"
).replace(/\/+$/, "");
const pollMs = Math.min(
  10_000,
  Math.max(250, Number(process.env.GOTRADER_SCHEDULER_POLL_MS || 1_000))
);
const requestTimeoutMs = Math.min(
  10_000,
  Math.max(500, Number(process.env.GOTRADER_SCHEDULER_REQUEST_TIMEOUT_MS || 3_000))
);
const maximumArtifacts = Math.min(
  10_000,
  Math.max(100, Number(process.env.GOTRADER_SCHEDULER_MAXIMUM_ARTIFACTS || 1_000))
);

await fs.mkdir(schedulerRoot, { recursive: true });
const shadowContextEnabled = [
  "always_on_shadow_context",
  "always_on_shadow_context_verified",
  "always_on_shadow_context_operational"
].includes(profileId);
const activeTaskRegistry = buildSchedulerTaskRegistry({
  enableShadowContext: shadowContextEnabled
});
const checkpointExists = await fs
  .access(checkpointFile)
  .then(() => true)
  .catch(() => false);
const savedCheckpoint = await readJsonFile(checkpointFile);
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
let contextController;
if (shadowContextEnabled) {
  const dependencies = await loadShadowContextDependencies({
    repoRoot,
    outRoot: path.join(contextRoot, "compiled")
  });
  contextController = await createShadowContextController({
    contextRoot,
    dependencies,
    fetchWindows: ({ requestedSymbol, brokerSymbol, timeframes, asOf }) =>
      fetchJson(
        `${feedUrl}/windows?requestedSymbol=${encodeURIComponent(
          requestedSymbol
        )}&brokerSymbol=${encodeURIComponent(
          brokerSymbol
        )}&timeframes=${encodeURIComponent(
          timeframes.join(",")
        )}&asOf=${encodeURIComponent(asOf)}&limit=300`
      )
  });
}
const engine = createAutonomousSchedulerEngine({
  checkpoint: savedCheckpoint,
  registry: activeTaskRegistry,
  handlers: contextController
    ? { shadow_context_refresh: contextController.handler }
    : {},
  maximumArtifacts
});
let durableArtifacts = (await readJsonFile(artifactFile))?.artifacts;
if (!Array.isArray(durableArtifacts)) durableArtifacts = [];
let stopping = false;
let appliedControlRevision;
let lastFeedStatus;
let consecutiveFeedFailures = 0;
let reconciliationBlocker;
let checkpointStatus = checkpointExists
  ? savedCheckpoint
    ? "loaded"
    : "corrupt"
  : "missing";
const startedAt = new Date().toISOString();
let lastStatusWriteAt = 0;

const buildStatus = () => {
  const engineStatus = engine.status();
  const feedState = lastFeedStatus?.state ?? "unknown";
  const marketClosedPause = feedState === "paused_market_closed";
  const terminalDisconnectedPause =
    feedState === "paused_terminal_disconnected";
  const feedBlockers = Array.isArray(lastFeedStatus?.blockers)
    ? lastFeedStatus.blockers
    : [];
  const blockers = [
    ...(reconciliationBlocker ? [reconciliationBlocker] : []),
    ...(lastFeedStatus?.timeContractEligible === false &&
    !marketClosedPause &&
    !terminalDisconnectedPause
      ? ["closed_candle_feed_not_eligible"]
      : []),
    ...feedBlockers
  ];
  const warnings = [
    ...(Array.isArray(lastFeedStatus?.warnings) ? lastFeedStatus.warnings : []),
    ...(consecutiveFeedFailures ? ["continuous_feed_transport_unavailable"] : [])
  ];
  const schedulerState =
    engineStatus.state === "paused"
      ? "paused"
      : marketClosedPause
        ? "paused_market_closed"
      : terminalDisconnectedPause
        ? "paused_terminal_disconnected"
      : reconciliationBlocker
        ? "blocked"
        : consecutiveFeedFailures >= 3
          ? "stale"
          : blockers.length || warnings.length
            ? "degraded"
            : "healthy";
  return {
    ...engineStatus,
    serviceVersion: AUTONOMOUS_SCHEDULER_SERVICE_VERSION,
    state: schedulerState,
    feedUrl,
    feedState,
    feedTimeContractEligible: lastFeedStatus?.timeContractEligible === true,
    marketState: lastFeedStatus?.marketState,
    proofPausedForMarketClosed:
      lastFeedStatus?.proofPausedForMarketClosed === true,
    proofPausedForTerminalDisconnected:
      lastFeedStatus?.proofPausedForTerminalDisconnected === true,
    checkpointStatus,
    durableArtifactCount: durableArtifacts.length,
    lastHeartbeatAt: new Date().toISOString(),
    startedAt,
    processId: process.pid,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    disabledCapabilities: disabledSchedulerCapabilities,
    eventDeliverySemantics: "at_least_once_effectively_once_artifacts",
    memoryRssBytes: process.memoryUsage().rss,
    cpuUserMicroseconds: process.cpuUsage().user,
    cpuSystemMicroseconds: process.cpuUsage().system,
    shadowContext: contextController?.status() ?? {
      enabled: false,
      state: "disabled"
    },
    rawCandlesPersisted: false,
    ...continuousFeedCapability,
    ...continuousFeedAuthority
  };
};

let lastStatus = buildStatus();

const persistStatus = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && now - lastStatusWriteAt < 5_000) return;
  lastStatus = buildStatus();
  await writeJsonAtomic(statusFile, lastStatus);
  lastStatusWriteAt = now;
};

const persistArtifacts = async (newArtifacts) => {
  if (!newArtifacts.length) return;
  durableArtifacts.push(...newArtifacts);
  if (durableArtifacts.length > maximumArtifacts) {
    durableArtifacts = durableArtifacts.slice(-maximumArtifacts);
  }
  await writeJsonAtomic(artifactFile, {
    version: 1,
    artifacts: durableArtifacts,
    updatedAt: new Date().toISOString(),
    rawCandlesPersisted: false,
    productionAdoptionAllowed: false,
    ...continuousFeedAuthority
  });
};

const persistCheckpoint = async (checkpoint) => {
  await writeJsonAtomic(checkpointFile, checkpoint);
  checkpointStatus = "healthy";
};

const applyControl = async () => {
  const control = await readJsonFile(controlFile);
  if (!control?.revision || control.revision === appliedControlRevision) return false;
  if (control.desiredState === "paused") engine.pause();
  else if (control.desiredState === "running") engine.resume();
  else return false;
  appliedControlRevision = control.revision;
  await writeJsonAtomic(controlFile, {
    ...control,
    appliedAt: new Date().toISOString(),
    appliedByPid: process.pid,
    ...continuousFeedAuthority
  });
  await persistCheckpoint(engine.checkpoint());
  return true;
};

const poll = async () => {
  const controlChanged = await applyControl();
  try {
    const [feedStatus, eventPage] = await Promise.all([
      fetchJson(`${feedUrl}/status`),
      fetchJson(
        `${feedUrl}/events?afterSequence=${encodeURIComponent(
          engine.status().lastProcessedSequence
        )}&limit=100`
      )
    ]);
    lastFeedStatus = feedStatus;
    consecutiveFeedFailures = 0;
    const lastProcessedSequence = engine.status().lastProcessedSequence;
    const earliestSequence = Number(eventPage?.earliestSequence ?? 0);
    if (
      earliestSequence > 0 &&
      earliestSequence > Number(lastProcessedSequence) + 1
    ) {
      reconciliationBlocker = "durable_event_ledger_gap_reconciliation_required";
      await persistStatus({ force: true });
      return;
    }
    reconciliationBlocker = undefined;
    const events = Array.isArray(eventPage?.events) ? eventPage.events : [];
    const result = await engine.processEvents(events, { feedStatus });
    if (events.length || controlChanged) {
      await persistArtifacts(result.artifacts);
      await persistCheckpoint(result.checkpoint);
      await persistStatus({ force: true });
    } else {
      await persistStatus();
    }
  } catch (error) {
    consecutiveFeedFailures += 1;
    lastStatus = {
      ...buildStatus(),
      warnings: [
        ...new Set([
          ...(lastStatus.warnings ?? []),
          `continuous_feed_request_failed:${
            error instanceof Error ? error.message : String(error)
          }`
        ])
      ]
    };
    await writeJsonAtomic(statusFile, lastStatus);
    lastStatusWriteAt = Date.now();
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
      message: "Scheduler endpoints are status-only and read-only.",
      ...continuousFeedAuthority
    });
    return;
  }
  if (url.pathname === "/health") {
    json(response, 200, {
      serviceVersion: AUTONOMOUS_SCHEDULER_SERVICE_VERSION,
      processStatus: "running",
      schedulerState: lastStatus.state,
      lastHeartbeatAt: lastStatus.lastHeartbeatAt,
      productionAdoptionAllowed: false,
      ...continuousFeedCapability,
      ...continuousFeedAuthority
    });
    return;
  }
  if (url.pathname === "/status") {
    json(response, 200, lastStatus);
    return;
  }
  if (url.pathname === "/context/status") {
    json(
      response,
      200,
      contextController?.status() ?? {
        enabled: false,
        state: "disabled",
        ...continuousFeedAuthority
      }
    );
    return;
  }
  json(response, 404, {
    message: "Scheduler endpoint not found.",
    ...continuousFeedAuthority
  });
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopping = true;
    engine.cancel();
  });
}

server.listen(port, host, async () => {
  await persistCheckpoint(engine.checkpoint());
  await persistStatus({ force: true });
  console.log(
    JSON.stringify({
      event: "autonomous_scheduler_started",
      host,
      port,
      feedUrl,
      enabledTaskTypes: activeTaskRegistry
        .filter((task) => task.enabled)
        .map((task) => task.taskType),
      ...continuousFeedAuthority
    })
  );
});

while (!stopping) {
  const started = Date.now();
  await poll();
  const delay = Math.max(50, pollMs - (Date.now() - started));
  await new Promise((resolve) => setTimeout(resolve, delay));
}

await persistCheckpoint(engine.checkpoint());
lastStatus = {
  ...buildStatus(),
  state: "stopped",
  stoppedAt: new Date().toISOString()
};
await writeJsonAtomic(statusFile, lastStatus);
await new Promise((resolve) => server.close(resolve));
