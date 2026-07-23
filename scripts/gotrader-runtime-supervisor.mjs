#!/usr/bin/env node

import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  ALWAYS_ON_READ_ONLY_PROFILE_ID,
  buildRuntimeProfile,
  classifyRuntimeState,
  compactRuntimeStatus,
  registerRestartAttempt,
  runtimeAuthority,
  serviceShutdownOrder,
  serviceStartupOrder,
  validateRuntimeProfile
} from "./gotrader-runtime-core.mjs";
import {
  acquireRuntimeLock,
  adoptManagedService,
  appendRuntimeLog,
  buildRuntimePaths,
  collectServiceStatus,
  ensureRuntimePaths,
  findProcessByExecutable,
  getRepositoryIdentity,
  inspectServicePortOwnership,
  readJsonFile,
  releaseRuntimeLock,
  serviceRecordPath,
  sleep,
  startManagedService,
  stopManagedService,
  updateServiceRestartRecord,
  waitForServiceHealth,
  writeJsonAtomic
} from "./gotrader-runtime-io.mjs";
import { loadLocalEnvironment } from "./local-env.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launchUi = process.argv.includes("--launch-ui");
const profileArgumentIndex = process.argv.indexOf("--profile");
const selectedProfileId =
  (profileArgumentIndex >= 0 ? process.argv[profileArgumentIndex + 1] : undefined) ??
  process.env.GOTRADER_RUNTIME_PROFILE ??
  ALWAYS_ON_READ_ONLY_PROFILE_ID;
const heartbeatIntervalMs = Math.min(
  60_000,
  Math.max(2_000, Number(process.env.GOTRADER_RUNTIME_HEARTBEAT_MS || 5_000))
);
const endpointIntervalMs = Math.min(
  120_000,
  Math.max(5_000, Number(process.env.GOTRADER_RUNTIME_ENDPOINT_INTERVAL_MS || 10_000))
);

await loadLocalEnvironment();

const repositoryIdentity = await getRepositoryIdentity(repoRoot);
const profile = buildRuntimeProfile({
  profileId: selectedProfileId,
  repoRoot,
  env: process.env
});
const paths = buildRuntimePaths(repoRoot, profile.profileId);
const runtimeId = crypto.randomUUID();
const startedAt = new Date().toISOString();
const profileValidation = validateRuntimeProfile(profile);

const saveStatus = async (status) => {
  await writeJsonAtomic(paths.stateFile, {
    ...status,
    supervisorPid: process.pid
  });
};

const blockedStatus = async (blockers, warnings = [], serviceStatuses = []) => {
  const status = compactRuntimeStatus({
    runtimeId,
    repositoryIdentity,
    profile,
    state: "blocked",
    startedAt,
    serviceStatuses,
    blockers,
    warnings
  });
  await saveStatus(status);
  return status;
};

const commandAvailable = async (command, args) => {
  try {
    await execFileAsync(command, args, {
      cwd: repoRoot,
      windowsHide: true,
      timeout: 10_000
    });
    return true;
  } catch {
    return false;
  }
};

const runPreflight = async () => {
  const blockers = [];
  const warnings = [];
  if (!profileValidation.valid) blockers.push(...profileValidation.errors);

  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(nodeMajor) || nodeMajor < 20) blockers.push("node_20_or_newer_required");

  for (const service of profile.services) {
    try {
      await fs.access(service.scriptPath);
    } catch {
      blockers.push(`${service.serviceId}_script_missing`);
    }
    if (path.resolve(service.workingDirectory) !== path.resolve(repoRoot)) {
      blockers.push(`${service.serviceId}_working_directory_mismatch`);
    }
  }

  const python = profile.services.find((service) => service.runtime === "python");
  if (!(await commandAvailable(python.command, ["--version"]))) blockers.push("python_unavailable");
  if (
    !(await commandAvailable(python.command, [
      "-c",
      "import MetaTrader5; print('MetaTrader5 available')"
    ]))
  ) {
    blockers.push("python_metatrader5_package_unavailable");
  }

  const terminal = profile.services.find((service) => service.serviceId === "mt5_terminal");
  const terminalProcess = await findProcessByExecutable(terminal.scriptPath);
  if (!terminalProcess) blockers.push("mt5_terminal_not_running");

  for (const service of profile.services.filter((item) => item.runtime !== "external")) {
    const ownership = await inspectServicePortOwnership({
      service,
      repositoryRoot: repositoryIdentity.repositoryRoot
    });
    for (const port of ownership) {
      if (port.status === "blocked_foreign_worktree") {
        blockers.push(`${service.serviceId}_port_${port.port}_owned_by_foreign_worktree`);
        warnings.push(
          `${service.serviceId} listener PID ${port.pid} belongs to another worktree and was left untouched.`
        );
      }
      if (port.status === "blocked_unknown_owner") {
        blockers.push(`${service.serviceId}_port_${port.port}_owned_by_unknown_process`);
        warnings.push(
          `${service.serviceId} port ${port.port} is owned by unapproved PID ${port.pid} and was left untouched.`
        );
      }
    }
  }

  return {
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)]
  };
};

await ensureRuntimePaths(paths);
const lock = await acquireRuntimeLock({ paths, repositoryIdentity });
if (!lock.acquired) {
  console.log(`GoTrader read-only runtime is already supervised by PID ${lock.lock?.pid ?? "unknown"}.`);
  process.exit(0);
}

let shuttingDown = false;
let lastEndpointCheckAt = 0;
let lastHealthyAt;
let serviceStatuses = [];
let runtimeBlockers = [];
let runtimeWarnings = lock.staleRecovered ? ["stale_supervisor_lock_recovered"] : [];
const failureCounts = new Map();
const restartAttempts = new Map();

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    shuttingDown = true;
  });
}

const requestUiLaunch = async () => {
  if (!launchUi) return;
  try {
    const response = await fetch("http://127.0.0.1:5173/", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const child = spawn(
      "rundll32.exe",
      ["url.dll,FileProtocolHandler", "http://127.0.0.1:5173/dashboard"],
      { detached: true, stdio: "ignore", windowsHide: false }
    );
    child.unref();
  } catch {
    runtimeWarnings.push("optional_ui_not_running");
  }
};

const startOrAdoptService = async (service) => {
  const ownership = await inspectServicePortOwnership({
    service,
    repositoryRoot: repositoryIdentity.repositoryRoot
  });
  const owned = ownership.find((item) => item.status === "owned_current_worktree");
  if (owned?.pid) {
    const processInfo = {
      pid: owned.pid,
      name: owned.processName,
      executablePath: owned.executablePath,
      commandLine: owned.commandLine
    };
    await adoptManagedService({
      service,
      processInfo,
      paths,
      repositoryIdentity
    });
    await appendRuntimeLog(paths, "service_adopted", {
      serviceId: service.serviceId,
      pid: owned.pid
    });
    return;
  }
  if (ownership.some((item) => item.status !== "free")) {
    throw new Error(`${service.serviceId}_port_ownership_blocked`);
  }
  const record = await startManagedService({
    service,
    paths,
    repositoryIdentity
  });
  await appendRuntimeLog(paths, "service_started", {
    serviceId: service.serviceId,
    pid: record.pid
  });
  const health = await waitForServiceHealth(service, 25_000);
  if (!health.ok) throw new Error(`${service.serviceId}_startup_health_failed`);
};

const stopServices = async () => {
  const results = [];
  for (const service of serviceShutdownOrder(profile)) {
    const result = await stopManagedService({
      service,
      paths,
      repositoryRoot: repositoryIdentity.repositoryRoot
    });
    results.push({ serviceId: service.serviceId, ...result });
    await appendRuntimeLog(paths, "service_stop", {
      serviceId: service.serviceId,
      stopped: result.stopped,
      reason: result.reason
    });
  }
  return results;
};

const collectStatuses = async () => {
  const statuses = [];
  for (const service of profile.services) {
    statuses.push(
      await collectServiceStatus({
        service,
        paths,
        repositoryRoot: repositoryIdentity.repositoryRoot
      })
    );
  }
  return statuses;
};

const writeCurrentStatus = async () => {
  const classified = classifyRuntimeState({ profile, serviceStatuses });
  const blockers = [...classified.blockers, ...runtimeBlockers];
  const warnings = [...classified.warnings, ...runtimeWarnings];
  const state = blockers.length ? "blocked" : classified.state;
  if (state === "healthy") lastHealthyAt = new Date().toISOString();
  const status = compactRuntimeStatus({
    runtimeId,
    repositoryIdentity,
    profile,
    state,
    startedAt,
    lastHealthyAt,
    serviceStatuses,
    blockers,
    warnings
  });
  await saveStatus(status);
  return status;
};

const restartServiceWithDependents = async (service) => {
  const currentIdentity = await getRepositoryIdentity(repoRoot);
  if (
    currentIdentity.branch !== repositoryIdentity.branch ||
    currentIdentity.headCommit !== repositoryIdentity.headCommit ||
    path.resolve(currentIdentity.repositoryRoot) !== path.resolve(repositoryIdentity.repositoryRoot)
  ) {
    runtimeBlockers.push("worktree_identity_changed");
    return false;
  }

  const previousAttempts = restartAttempts.get(service.serviceId) ?? [];
  const decision = registerRestartAttempt({
    attempts: previousAttempts,
    policy: service.restartPolicy
  });
  restartAttempts.set(service.serviceId, decision.attempts);
  if (!decision.allowed) {
    runtimeBlockers.push(`${service.serviceId}_${decision.blocker}`);
    return false;
  }

  await sleep(decision.delayMs);
  const startupOrder = serviceStartupOrder(profile);
  const affected = startupOrder.filter(
    (item) =>
      item.serviceId === service.serviceId ||
      item.dependencies.includes(service.serviceId)
  );
  for (const affectedService of [...affected].reverse()) {
    if (affectedService.runtime === "external") continue;
    await stopManagedService({
      service: affectedService,
      paths,
      repositoryRoot: repositoryIdentity.repositoryRoot
    });
  }
  for (const affectedService of affected) {
    if (affectedService.runtime === "external") continue;
    await startOrAdoptService(affectedService);
    const record = (await readJsonFile(serviceRecordPath(paths, affectedService.serviceId))) ?? {};
    await updateServiceRestartRecord({
      serviceId: affectedService.serviceId,
      paths,
      restartAttempts: restartAttempts.get(service.serviceId) ?? [],
      restartCount: Number(record.restartCount ?? 0) + 1
    });
  }
  await appendRuntimeLog(paths, "service_restarted", {
    serviceId: service.serviceId,
    affected: affected.map((item) => item.serviceId),
    attemptCount: decision.attempts.length
  });
  return true;
};

try {
  await appendRuntimeLog(paths, "supervisor_starting", {
    runtimeId,
    repositoryIdentity,
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    authority: runtimeAuthority
  });
  await saveStatus(
    compactRuntimeStatus({
      runtimeId,
      repositoryIdentity,
      profile,
      state: "starting",
      startedAt,
      serviceStatuses: [],
      blockers: [],
      warnings: runtimeWarnings
    })
  );

  const preflight = await runPreflight();
  runtimeWarnings.push(...preflight.warnings);
  if (preflight.blockers.length) {
    runtimeBlockers.push(...preflight.blockers);
    const status = await blockedStatus(runtimeBlockers, runtimeWarnings);
    await appendRuntimeLog(paths, "preflight_blocked", {
      blockers: status.blockers,
      warnings: status.warnings
    });
    console.error(JSON.stringify(status, null, 2));
    process.exitCode = 2;
    shuttingDown = true;
  } else {
    for (const service of serviceStartupOrder(profile)) {
      if (service.runtime === "external") continue;
      await startOrAdoptService(service);
    }
    serviceStatuses = await collectStatuses();
    const status = await writeCurrentStatus();
    await requestUiLaunch();
    console.log("GoTrader always-on read-only runtime started.");
    console.log(JSON.stringify(status, null, 2));
  }

  while (!shuttingDown) {
    if (await readJsonFile(paths.stopRequestFile)) {
      shuttingDown = true;
      break;
    }
    const now = Date.now();
    if (now - lastEndpointCheckAt >= endpointIntervalMs) {
      serviceStatuses = await collectStatuses();
      lastEndpointCheckAt = now;
      for (const service of profile.services.filter((item) => item.runtime !== "external")) {
        const status = serviceStatuses.find((item) => item.serviceId === service.serviceId);
        const failed = status?.restartRelevantFailure || !status?.pid;
        const count = failed ? Number(failureCounts.get(service.serviceId) ?? 0) + 1 : 0;
        failureCounts.set(service.serviceId, count);
        if (count >= 3 && !runtimeBlockers.some((item) => item.includes("restart_budget_exhausted"))) {
          try {
            await restartServiceWithDependents(service);
            failureCounts.set(service.serviceId, 0);
            serviceStatuses = await collectStatuses();
          } catch (error) {
            runtimeWarnings.push(
              `${service.serviceId}_restart_failed:${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
      await writeCurrentStatus();
    }
    await sleep(heartbeatIntervalMs);
  }
} catch (error) {
  runtimeBlockers.push("runtime_supervisor_failure");
  runtimeWarnings.push(error instanceof Error ? error.message : String(error));
  await blockedStatus(runtimeBlockers, runtimeWarnings, serviceStatuses);
  await appendRuntimeLog(paths, "supervisor_failure", {
    message: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
} finally {
  if (!runtimeBlockers.some((item) => item.includes("port_"))) {
    await stopServices().catch(() => undefined);
  }
  await fs.rm(paths.stopRequestFile, { force: true });
  const finalState = {
    ...(await readJsonFile(paths.stateFile)),
    state: runtimeBlockers.length ? "blocked" : "stopped",
    stoppedAt: new Date().toISOString(),
    authority: runtimeAuthority
  };
  await saveStatus(finalState);
  await releaseRuntimeLock(paths);
  await appendRuntimeLog(paths, "supervisor_stopped", {
    state: finalState.state,
    blockers: finalState.blockers
  });
}
