#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCompactTimeVerificationArtifact,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";
import { collectCurrentLiveTimeEvidence } from "./gotrader-current-live-time-collector.mjs";
import {
  createTimeVerifierWatchEngine,
  TIME_VERIFIER_WATCH_SERVICE_VERSION
} from "./gotrader-time-verifier-watch-core.mjs";
import { readJsonFile, writeJsonAtomic } from "./gotrader-runtime-io.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileId =
  process.env.GOTRADER_RUNTIME_PROFILE_ID ||
  "always_on_shadow_context_verified";
const stateRoot = process.env.GOTRADER_RUNTIME_STATE_ROOT
  ? path.resolve(process.env.GOTRADER_RUNTIME_STATE_ROOT)
  : path.join(repoRoot, ".gotrader", "runtime");
const timeRoot = path.join(stateRoot, profileId, "time");
const artifactFile = path.join(timeRoot, "current-live-verification.json");
const watcherStateFile = path.join(timeRoot, "watcher-state.json");
const statusFile = path.join(timeRoot, "watcher-status.json");
const controlFile = path.join(timeRoot, "watcher-control.json");
const host = process.env.GOTRADER_TIME_VERIFIER_HOST || "127.0.0.1";
const port = Math.min(
  65_535,
  Math.max(1, Number(process.env.GOTRADER_TIME_VERIFIER_PORT || 7345))
);
const pollMs = Math.min(
  60_000,
  Math.max(1_000, Number(process.env.GOTRADER_TIME_VERIFIER_POLL_MS || 10_000))
);
const upstreamUrl = String(
  process.env.MT5_READONLY_UPSTREAM_URL ||
    process.env.MT5_READONLY_UPSTREAM_BASE_URL ||
    "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const bridgeUrl = String(
  process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341"
).replace(/\/+$/, "");
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";

await fs.mkdir(timeRoot, { recursive: true });
const savedState = await readJsonFile(watcherStateFile);
const engine = createTimeVerifierWatchEngine({ state: savedState });
let stopping = false;
let appliedControlRevision;
let lastStatus = {
  ...engine.status(),
  state: "starting",
  startedAt: new Date().toISOString(),
  lastHeartbeatAt: new Date().toISOString(),
  processId: process.pid,
  pollIntervalMs: pollMs,
  upstreamUrl,
  bridgeUrl,
  ...currentLiveVerificationAuthority
};

const persist = async (result) => {
  if (result?.persistArtifact && result.artifact) {
    const validation = assertCompactTimeVerificationArtifact(result.artifact);
    if (!validation.valid) {
      throw new Error(
        `unsafe_time_verification_artifact:${validation.errors.join(",")}`
      );
    }
    await writeJsonAtomic(artifactFile, result.artifact);
  }
  await writeJsonAtomic(watcherStateFile, result?.state ?? engine.snapshot());
  lastStatus = {
    ...(result?.status ?? engine.status()),
    startedAt: lastStatus.startedAt,
    lastHeartbeatAt: new Date().toISOString(),
    processId: process.pid,
    pollIntervalMs: pollMs,
    upstreamUrl,
    bridgeUrl,
    artifactFile,
    memoryRssBytes: process.memoryUsage().rss,
    cpuUserMicroseconds: process.cpuUsage().user,
    cpuSystemMicroseconds: process.cpuUsage().system,
    ...currentLiveVerificationAuthority
  };
  await writeJsonAtomic(statusFile, lastStatus);
};

const applyControl = async () => {
  const control = await readJsonFile(controlFile);
  if (!control?.revision || control.revision === appliedControlRevision) return;
  engine.setPaused(control.desiredState === "paused");
  appliedControlRevision = control.revision;
};

const poll = async () => {
  await applyControl();
  if (engine.status().state === "paused") {
    await persist({ state: engine.snapshot(), status: engine.status() });
    return;
  }
  try {
    const evidence = await collectCurrentLiveTimeEvidence({
      repoRoot,
      upstreamUrl,
      bridgeUrl,
      requestedSymbol,
      brokerSymbol,
      requireDirectProbe: true
    });
    await persist(
      engine.processEvidence({
        artifact: evidence.artifact,
        directProbe: evidence.directProbe
      })
    );
  } catch (error) {
    await persist(
      engine.recordFailure({
        blockers: [
          error instanceof Error ? error.message : String(error)
        ]
      })
    );
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
      message: "Time verifier status endpoints are read-only.",
      ...currentLiveVerificationAuthority
    });
    return;
  }
  if (url.pathname === "/health") {
    json(response, 200, {
      serviceVersion: TIME_VERIFIER_WATCH_SERVICE_VERSION,
      processStatus: "running",
      verifierState: lastStatus.state,
      lastHeartbeatAt: lastStatus.lastHeartbeatAt,
      ...currentLiveVerificationAuthority
    });
    return;
  }
  if (url.pathname === "/status") {
    json(response, 200, lastStatus);
    return;
  }
  json(response, 404, {
    message: "Time verifier endpoint not found.",
    ...currentLiveVerificationAuthority
  });
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopping = true;
  });
}

server.listen(port, host, async () => {
  await persist({ state: engine.snapshot(), status: engine.status() });
  console.log(
    JSON.stringify({
      event: "current_live_time_verifier_started",
      host,
      port,
      pollIntervalMs: pollMs,
      profileId,
      ...currentLiveVerificationAuthority
    })
  );
});

while (!stopping) {
  const started = Date.now();
  await poll();
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(100, pollMs - (Date.now() - started)))
  );
}

lastStatus = {
  ...lastStatus,
  state: "stopped",
  stoppedAt: new Date().toISOString(),
  ...currentLiveVerificationAuthority
};
await writeJsonAtomic(statusFile, lastStatus);
await new Promise((resolve) => server.close(resolve));
