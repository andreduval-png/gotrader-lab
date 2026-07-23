#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALWAYS_ON_READ_ONLY_PROFILE_ID,
  buildRuntimeProfile,
  classifyRuntimeState,
  compactRuntimeStatus,
  runtimeAuthority,
  serviceShutdownOrder
} from "./gotrader-runtime-core.mjs";
import {
  buildRuntimePaths,
  collectServiceStatus,
  ensureRuntimePaths,
  getRepositoryIdentity,
  isPidAlive,
  readJsonFile,
  sleep,
  stopManagedService,
  writeJsonAtomic
} from "./gotrader-runtime-io.mjs";
import { loadLocalEnvironment } from "./local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] || "status";
const profileArgumentIndex = process.argv.indexOf("--profile");
const selectedProfileId =
  (profileArgumentIndex >= 0 ? process.argv[profileArgumentIndex + 1] : undefined) ??
  process.env.GOTRADER_RUNTIME_PROFILE ??
  ALWAYS_ON_READ_ONLY_PROFILE_ID;
const allowedCommands = new Set(["status", "health", "stop"]);
if (!allowedCommands.has(command)) {
  console.error(`Unsupported runtime command: ${command}.`);
  process.exit(2);
}

await loadLocalEnvironment();
const repositoryIdentity = await getRepositoryIdentity(repoRoot);
const profile = buildRuntimeProfile({
  profileId: selectedProfileId,
  repoRoot,
  env: process.env
});
const paths = buildRuntimePaths(repoRoot, profile.profileId);
await ensureRuntimePaths(paths);

const printStatus = async ({ performLiveChecks }) => {
  const saved = await readJsonFile(paths.stateFile);
  if (!performLiveChecks) {
    const lock = await readJsonFile(paths.lockFile);
    const supervisorRunning = Boolean(lock?.pid && isPidAlive(lock.pid));
    const result = {
      ...(saved ?? {
        state: "stopped",
        blockers: ["runtime_not_started"],
        warnings: []
      }),
      supervisor: {
        running: supervisorRunning,
        pid: supervisorRunning ? lock.pid : undefined
      },
      authority: runtimeAuthority
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  const serviceStatuses = [];
  for (const service of profile.services) {
    serviceStatuses.push(
      await collectServiceStatus({
        service,
        paths,
        repositoryRoot: repositoryIdentity.repositoryRoot
      })
    );
  }
  const classified = classifyRuntimeState({ profile, serviceStatuses });
  const result = compactRuntimeStatus({
    runtimeId: saved?.runtimeId ?? "runtime_not_started",
    repositoryIdentity,
    profile,
    state: classified.state,
    startedAt: saved?.startedAt,
    lastHealthyAt: saved?.lastHealthyAt,
    serviceStatuses,
    blockers: classified.blockers,
    warnings: classified.warnings
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
};

if (command === "status") {
  await printStatus({ performLiveChecks: false });
  process.exit(0);
}

if (command === "health") {
  const result = await printStatus({ performLiveChecks: true });
  process.exit(result.state === "blocked" ? 2 : 0);
}

const lock = await readJsonFile(paths.lockFile);
if (lock?.pid && isPidAlive(lock.pid)) {
  await writeJsonAtomic(paths.stopRequestFile, {
    requestedAt: new Date().toISOString(),
    requestedByPid: process.pid,
    repositoryRoot: repositoryIdentity.repositoryRoot,
    authority: runtimeAuthority
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && isPidAlive(lock.pid)) {
    await sleep(250);
  }
  if (isPidAlive(lock.pid)) {
    console.error(`Runtime supervisor PID ${lock.pid} did not stop within 20 seconds.`);
    process.exit(2);
  }
} else {
  for (const service of serviceShutdownOrder(profile)) {
    await stopManagedService({
      service,
      paths,
      repositoryRoot: repositoryIdentity.repositoryRoot
    });
  }
}

await fs.rm(paths.stopRequestFile, { force: true });
await fs.rm(paths.lockFile, { force: true });
await writeJsonAtomic(paths.stateFile, {
  ...(await readJsonFile(paths.stateFile)),
  state: "stopped",
  stoppedAt: new Date().toISOString(),
  blockers: [],
  warnings: [],
  browserRequired: false,
  continuousFeedEnabled: profile.continuousFeedEnabled === true,
  closedCandleSchedulerEnabled: profile.closedCandleSchedulerEnabled === true,
  strategySchedulerEnabled: false,
  paperDemoEnabled: false,
  executionEnabled: false,
  aiSupervisorEnabled: false,
  productionAdoptionAllowed: false,
  authority: runtimeAuthority
});
console.log("GoTrader always-on read-only runtime stopped. MT5 Desktop was left running.");
