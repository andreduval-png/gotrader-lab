#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const profileId = "always_on_read_only_scheduler";
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "gotrader-runtime-a2-"));
const fixtureState = path.join(temporary, "fixture-state.json");
const children = [];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close(() => resolve(port));
    });
  });

const bridgePort = await freePort();
const feedPort = await freePort();
const schedulerPort = await freePort();
const commonEnvironment = {
  ...process.env,
  GOTRADER_RUNTIME_PROFILE_ID: profileId,
  GOTRADER_RUNTIME_STATE_ROOT: temporary
};

const spawnNode = async (script, args = [], environment = {}) => {
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, [path.join(scriptRoot, script), ...args], {
    cwd: path.resolve(scriptRoot, ".."),
    env: { ...commonEnvironment, ...environment },
    stdio: "ignore",
    windowsHide: true
  });
  children.push(child);
  return child;
};

const stopChild = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(3_000)
  ]);
  if (child.exitCode === null) child.kill();
};

const fetchJson = async (url, options) => {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = await response.json();
  return { response, payload };
};

const waitFor = async (description, predicate, timeoutMs = 12_000) => {
  const deadline = Date.now() + timeoutMs;
  let latestError;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) {
      latestError = error;
    }
    await sleep(150);
  }
  throw new Error(
    `${description} did not become ready.${latestError ? ` ${latestError.message}` : ""}`
  );
};

const candle = (time, close) => ({
  time,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  tickVolume: 10
});

const stateFor = (minute, { timeVerified = true } = {}) => ({
  timeVerified,
  marketTime: `2026-07-23T10:${String(minute).padStart(2, "0")}:30.000Z`,
  candlesByTimeframe: {
    "1m": Array.from({ length: minute + 1 }, (_, index) =>
      candle(
        `2026-07-23T10:${String(index).padStart(2, "0")}:00.000Z`,
        100 + index
      )
    )
  }
});

const writeState = async (minute, options) =>
  fs.writeFile(fixtureState, JSON.stringify(stateFor(minute, options)), "utf8");

const artifactFile = path.join(
  temporary,
  profileId,
  "scheduler",
  "artifacts.json"
);
const readArtifacts = async () => {
  try {
    const parsed = JSON.parse(await fs.readFile(artifactFile, "utf8"));
    return parsed.artifacts ?? [];
  } catch {
    return [];
  }
};

try {
  await writeState(1);
  await spawnNode("gotrader-runtime-test-market-source.mjs", [
    "--port",
    String(bridgePort),
    "--state",
    fixtureState
  ]);
  await waitFor("fixture source", async () => {
    const { response } = await fetchJson(`http://127.0.0.1:${bridgePort}/health`);
    return response.ok;
  });

  await spawnNode("gotrader-continuous-feed.mjs", [], {
    GOTRADER_FEED_PORT: String(feedPort),
    GOTRADER_FEED_BRIDGE_URL: `http://127.0.0.1:${bridgePort}`,
    GOTRADER_FEED_TIMEFRAMES: "1m",
    GOTRADER_FEED_QUOTE_POLL_MS: "500",
    GOTRADER_FEED_CANDLE_POLL_MS: "2000",
    GOTRADER_FEED_TIME_CONTRACT_POLL_MS: "5000"
  });
  await waitFor("continuous feed", async () => {
    const { response } = await fetchJson(`http://127.0.0.1:${feedPort}/health`);
    return response.ok;
  });

  let scheduler = await spawnNode("gotrader-autonomous-scheduler.mjs", [], {
    GOTRADER_SCHEDULER_PORT: String(schedulerPort),
    GOTRADER_SCHEDULER_FEED_URL: `http://127.0.0.1:${feedPort}`,
    GOTRADER_SCHEDULER_POLL_MS: "250"
  });
  await waitFor("scheduler", async () => {
    const { response } = await fetchJson(`http://127.0.0.1:${schedulerPort}/health`);
    return response.ok;
  });

  await writeState(2);
  const firstClosePage = await waitFor("first close event", async () => {
    const { payload } = await fetchJson(
      `http://127.0.0.1:${feedPort}/events?afterSequence=0`
    );
    return payload.events?.some((event) => event.type === "candle_closed")
      ? payload
      : undefined;
  });
  assert.equal(
    firstClosePage.events.filter((event) => event.type === "candle_closed").length,
    1
  );
  await waitFor("first scheduler artifacts", async () => {
    const artifacts = await readArtifacts();
    return artifacts.length === 2 ? artifacts : undefined;
  });

  await stopChild(scheduler);
  scheduler = await spawnNode("gotrader-autonomous-scheduler.mjs", [], {
    GOTRADER_SCHEDULER_PORT: String(schedulerPort),
    GOTRADER_SCHEDULER_FEED_URL: `http://127.0.0.1:${feedPort}`,
    GOTRADER_SCHEDULER_POLL_MS: "250"
  });
  await waitFor("restarted scheduler", async () => {
    const { response } = await fetchJson(`http://127.0.0.1:${schedulerPort}/health`);
    return response.ok;
  });
  await sleep(750);
  assert.equal((await readArtifacts()).length, 2);

  await execFileAsync(
    process.execPath,
    [path.join(scriptRoot, "gotrader-scheduler-control.mjs"), "pause"],
    { env: commonEnvironment, windowsHide: true }
  );
  await waitFor("paused scheduler", async () => {
    const { payload } = await fetchJson(`http://127.0.0.1:${schedulerPort}/status`);
    return payload.state === "paused";
  });
  await writeState(3);
  await waitFor("second durable close event", async () => {
    const { payload } = await fetchJson(
      `http://127.0.0.1:${feedPort}/events?afterSequence=0`
    );
    return payload.events?.filter((event) => event.type === "candle_closed").length >= 2;
  });
  assert.equal((await readArtifacts()).length, 2);

  await execFileAsync(
    process.execPath,
    [path.join(scriptRoot, "gotrader-scheduler-control.mjs"), "resume"],
    { env: commonEnvironment, windowsHide: true }
  );
  await waitFor("resumed scheduler artifacts", async () => {
    const artifacts = await readArtifacts();
    return artifacts.length === 4 ? artifacts : undefined;
  });

  await writeState(4, { timeVerified: false });
  await waitFor("time-contract source block", async () => {
    const { payload } = await fetchJson(`http://127.0.0.1:${feedPort}/status`);
    return payload.timeContractEligible === false;
  });
  await sleep(2_250);
  assert.equal((await readArtifacts()).length, 4);

  await writeState(4, { timeVerified: true });
  await waitFor("verified time recovery artifacts", async () => {
    const artifacts = await readArtifacts();
    return artifacts.length === 6 ? artifacts : undefined;
  }, 15_000);

  const { response: feedMutation } = await fetchJson(
    `http://127.0.0.1:${feedPort}/status`,
    { method: "POST" }
  );
  const { response: schedulerMutation } = await fetchJson(
    `http://127.0.0.1:${schedulerPort}/status`,
    { method: "POST" }
  );
  assert.equal(feedMutation.status, 405);
  assert.equal(schedulerMutation.status, 405);

  const artifactsText = await fs.readFile(artifactFile, "utf8");
  assert.equal(artifactsText.includes("\"candles\":["), false);
  assert.equal(artifactsText.includes("\"open\":"), false);
  assert.equal(artifactsText.includes("\"high\":"), false);
  assert.equal(artifactsText.includes("\"low\":"), false);
  assert.equal(artifactsText.includes("\"close\":"), false);
  const artifacts = JSON.parse(artifactsText).artifacts;
  assert.equal(artifacts.every((artifact) => artifact.productionAdoptionAllowed === false), true);
  assert.equal(artifacts.every((artifact) => artifact.executionAuthority === "none"), true);
  assert.equal(artifacts.every((artifact) => artifact.brokerAuthority === "none"), true);
  assert.equal(artifacts.every((artifact) => artifact.readinessOverrideAuthority === "none"), true);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        closeEventsObserved: 3,
        schedulerArtifacts: artifacts.length,
        schedulerRestartDeduplicated: true,
        pauseResumeDurable: true,
        unverifiedTimeBlockedCloseEvents: true,
        rawCandlesPersisted: false,
        productionAdoptionAllowed: false,
        executionAuthority: "none",
        brokerAuthority: "none",
        readinessOverrideAuthority: "none"
      },
      null,
      2
    )
  );
} finally {
  for (const child of [...children].reverse()) {
    await stopChild(child);
  }
  await fs.rm(temporary, { recursive: true, force: true });
}
