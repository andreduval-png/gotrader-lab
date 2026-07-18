#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import {
  buildGoTraderSupervisorSnapshot,
  classifyGoTraderReadiness,
  findRecoverableServices,
  gotraderCoreServiceIds,
  gotraderSupervisorAuthority,
  resolveGoTraderSupervisorOptions
} from "./gotrader-supervisor-core.mjs";
import { loadLocalEnvironment } from "./local-env.mjs";
import {
  diagnoseService,
  ensureStackDirs,
  isPidAlive,
  loadStackState,
  mt5UpstreamEnvStatus,
  repoRoot,
  serviceDefinitions,
  sleep,
  stackDir,
  stopTrackedProcess
} from "./local-stack-utils.mjs";

const execFileAsync = promisify(execFile);
const supervisorStatePath = path.join(stackDir, "supervisor.json");
const supervisorLockPath = path.join(stackDir, "supervisor.lock");
const startedAt = new Date().toISOString();

await loadLocalEnvironment();
const options = resolveGoTraderSupervisorOptions(process.env);

const readSupervisorState = async () => {
  try {
    return JSON.parse(await fs.readFile(supervisorStatePath, "utf8"));
  } catch {
    return undefined;
  }
};

const saveSupervisorState = async (state) => {
  await ensureStackDirs();
  await fs.writeFile(supervisorStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};

const runNodeScript = (relativePath) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repoRoot, relativePath)], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true
    });
    child.on("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`${relativePath} exited with code ${code}.`));
        return;
      }
      resolve();
    });
    child.on("error", reject);
  });

const openDashboard = async () => {
  if (!options.openBrowser) return false;
  const command = process.platform === "win32" ? "rundll32.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", options.dashboardUrl] : [options.dashboardUrl];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: false });
  child.unref();
  return true;
};

const isMt5Running = async () => {
  if (process.platform !== "win32") return false;
  try {
    const { stdout } = await execFileAsync(
      "tasklist.exe",
      ["/FI", "IMAGENAME eq terminal64.exe", "/FO", "CSV", "/NH"],
      { windowsHide: true, timeout: 5_000 }
    );
    return /terminal64\.exe/i.test(stdout);
  } catch {
    return false;
  }
};

const ensureMt5Desktop = async () => {
  const envStatus = mt5UpstreamEnvStatus(process.env);
  const terminalPath = envStatus.terminalPath;
  const running = await isMt5Running();
  if (running || !options.autoLaunchMt5) {
    return { running, launched: false, terminalPath };
  }
  try {
    await fs.access(terminalPath);
  } catch {
    return { running: false, launched: false, terminalPath, error: "mt5_terminal_not_found" };
  }

  const child = spawn(terminalPath, [], {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();
  await sleep(2_000);
  return { running: await isMt5Running(), launched: true, terminalPath };
};

const collectDiagnostics = async () => {
  const diagnostics = [];
  for (const service of serviceDefinitions) {
    diagnostics.push(await diagnoseService(service));
  }
  return diagnostics;
};

const existingSupervisor = await readSupervisorState();
if (existingSupervisor?.pid && isPidAlive(existingSupervisor.pid)) {
  console.log(`GoTrader supervisor is already running with PID ${existingSupervisor.pid}.`);
  await openDashboard();
  process.exit(0);
}

await ensureStackDirs();
try {
  const lock = await fs.open(supervisorLockPath, "wx");
  await lock.close();
} catch (error) {
  if (error?.code !== "EEXIST") throw error;
  const current = await readSupervisorState();
  if (current?.pid && isPidAlive(current.pid)) {
    console.log(`GoTrader supervisor is already starting with PID ${current.pid}.`);
    await openDashboard();
    process.exit(0);
  }
  await fs.rm(supervisorLockPath, { force: true });
  const lock = await fs.open(supervisorLockPath, "wx");
  await lock.close();
}

await saveSupervisorState({
  version: 1,
  pid: process.pid,
  startedAt,
  updatedAt: new Date().toISOString(),
  status: "starting",
  ...gotraderSupervisorAuthority
});

let shuttingDown = false;
let recoveryAttempts = 0;
let lastRecoveryAt;
let lastError;
let browserOpened = false;
let mt5 = await ensureMt5Desktop();
const consecutiveHealthFailures = {};

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    shuttingDown = true;
  });
}

console.log("Starting GoTrader local services...");
await runNodeScript("scripts/start-local-stack.mjs");

const startupDeadline = Date.now() + options.startupTimeoutMs;
let diagnostics = [];
let readiness = { status: "blocked", blockers: ["startup_pending"], warnings: [] };

while (Date.now() < startupDeadline && !shuttingDown) {
  diagnostics = await collectDiagnostics();
  readiness = classifyGoTraderReadiness(diagnostics);
  if (readiness.status !== "blocked") break;
  await sleep(1_000);
}

if (diagnostics.find((item) => item.id === "app")?.status === "healthy") {
  browserOpened = await openDashboard();
}

console.log(
  `GoTrader supervisor ready state: ${readiness.status}. Dashboard: ${options.dashboardUrl}`
);

while (!shuttingDown) {
  try {
    mt5 = { ...mt5, running: await isMt5Running() };
    diagnostics = await collectDiagnostics();
    readiness = classifyGoTraderReadiness(diagnostics);
    for (const diagnostic of diagnostics) {
      consecutiveHealthFailures[diagnostic.id] = diagnostic.health?.ok
        ? 0
        : Number(consecutiveHealthFailures[diagnostic.id] ?? 0) + 1;
    }
    const recoverable = findRecoverableServices(
      diagnostics,
      gotraderCoreServiceIds,
      consecutiveHealthFailures,
      options.unhealthyRestartThreshold
    );
    const recoveryDue = !lastRecoveryAt || Date.now() - new Date(lastRecoveryAt).getTime() >= options.recoveryCooldownMs;

    if (recoverable.length && recoveryDue && recoveryAttempts < options.maxRecoveryAttempts) {
      recoveryAttempts += 1;
      lastRecoveryAt = new Date().toISOString();
      console.warn(`Recovering unavailable GoTrader services: ${recoverable.join(", ")}.`);
      const stackState = await loadStackState();
      for (const id of recoverable) {
        const tracked = stackState.services.find((service) => service.id === id);
        if (tracked && isPidAlive(tracked.pid)) {
          await stopTrackedProcess(tracked);
        }
        consecutiveHealthFailures[id] = 0;
      }
      await runNodeScript("scripts/start-local-stack.mjs");
      diagnostics = await collectDiagnostics();
      readiness = classifyGoTraderReadiness(diagnostics);
    } else if (readiness.status === "ready") {
      recoveryAttempts = 0;
    }

    if (!browserOpened && diagnostics.find((item) => item.id === "app")?.status === "healthy") {
      browserOpened = await openDashboard();
    }

    lastError = undefined;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    console.warn(`GoTrader supervisor health check failed: ${lastError}`);
  }

  await saveSupervisorState(
    buildGoTraderSupervisorSnapshot({
      pid: process.pid,
      startedAt,
      status: readiness,
      diagnostics,
      recoveryAttempts,
      lastRecoveryAt,
      lastError,
      mt5
    })
  );
  await sleep(options.healthIntervalMs);
}

await saveSupervisorState({
  ...(await readSupervisorState()),
  pid: undefined,
  status: "stopped",
  stoppedAt: new Date().toISOString()
});
await fs.rm(supervisorLockPath, { force: true });
console.log("GoTrader supervisor stopped. Run npm.cmd run gotrader:stop to stop tracked services.");
