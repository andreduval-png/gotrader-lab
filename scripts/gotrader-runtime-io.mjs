import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  buildProcessFingerprint,
  classifyProbe,
  classifyProcessOwnership,
  redactRuntimeText,
  runtimeAuthority
} from "./gotrader-runtime-core.mjs";
import {
  getListenerProcesses,
  getProcessInfo
} from "./tradingview-bridge-port-utils.mjs";

const execFileAsync = promisify(execFile);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function buildRuntimePaths(repoRoot, profileId) {
  const runtimeRoot = path.join(path.resolve(repoRoot), ".gotrader", "runtime", profileId);
  return {
    runtimeRoot,
    servicesRoot: path.join(runtimeRoot, "services"),
    logsRoot: path.join(runtimeRoot, "logs"),
    stateFile: path.join(runtimeRoot, "supervisor.json"),
    lockFile: path.join(runtimeRoot, "supervisor.lock"),
    stopRequestFile: path.join(runtimeRoot, "stop.request")
  };
}

export async function ensureRuntimePaths(paths) {
  await fs.mkdir(paths.servicesRoot, { recursive: true });
  await fs.mkdir(paths.logsRoot, { recursive: true });
}

export async function getRepositoryIdentity(repoRoot) {
  const runGit = async (args) => {
    const { stdout } = await execFileAsync("git", args, {
      cwd: repoRoot,
      windowsHide: true,
      timeout: 10_000
    });
    return stdout.trim();
  };
  return {
    repositoryRoot: path.resolve(await runGit(["rev-parse", "--show-toplevel"])),
    branch: await runGit(["branch", "--show-current"]),
    headCommit: await runGit(["rev-parse", "HEAD"])
  };
}

export function serviceRecordPath(paths, serviceId) {
  return path.join(paths.servicesRoot, `${serviceId}.json`);
}

export async function readJsonFile(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

export async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, filePath);
}

export function isPidAlive(pid) {
  const normalized = Number(pid);
  if (!Number.isInteger(normalized) || normalized <= 0) return false;
  try {
    process.kill(normalized, 0);
    return true;
  } catch {
    return false;
  }
}

export async function acquireRuntimeLock({ paths, repositoryIdentity }) {
  await ensureRuntimePaths(paths);
  const lockValue = {
    version: 1,
    pid: process.pid,
    createdAt: new Date().toISOString(),
    repositoryRoot: repositoryIdentity.repositoryRoot,
    branch: repositoryIdentity.branch,
    headCommit: repositoryIdentity.headCommit
  };

  try {
    const handle = await fs.open(paths.lockFile, "wx");
    await handle.writeFile(`${JSON.stringify(lockValue, null, 2)}\n`, "utf8");
    await handle.close();
    return { acquired: true, staleRecovered: false, lock: lockValue };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  const existing = await readJsonFile(paths.lockFile);
  if (existing?.pid && isPidAlive(existing.pid)) {
    return { acquired: false, staleRecovered: false, lock: existing };
  }

  await fs.rm(paths.lockFile, { force: true });
  const handle = await fs.open(paths.lockFile, "wx");
  await handle.writeFile(`${JSON.stringify(lockValue, null, 2)}\n`, "utf8");
  await handle.close();
  return { acquired: true, staleRecovered: true, lock: lockValue };
}

export async function releaseRuntimeLock(paths) {
  const existing = await readJsonFile(paths.lockFile);
  if (!existing || existing.pid === process.pid || !isPidAlive(existing.pid)) {
    await fs.rm(paths.lockFile, { force: true });
  }
}

async function runPowerShell(command) {
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { windowsHide: true, timeout: 8_000, maxBuffer: 1024 * 1024 }
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function findProcessByExecutable(executablePath) {
  if (process.platform !== "win32") return undefined;
  const escaped = String(path.resolve(executablePath)).replaceAll("'", "''");
  const output = await runPowerShell(
    `$p = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${escaped}' } | Select-Object -First 1 ProcessId,Name,ExecutablePath,CommandLine; if ($p) { $p | ConvertTo-Json -Compress }`
  );
  if (!output) return undefined;
  try {
    const parsed = JSON.parse(output);
    return {
      pid: Number(parsed.ProcessId),
      name: parsed.Name,
      executablePath: parsed.ExecutablePath,
      commandLine: parsed.CommandLine
    };
  } catch {
    return undefined;
  }
}

export async function inspectServicePortOwnership({ service, repositoryRoot }) {
  const results = [];
  for (const port of service.expectedPorts) {
    const listeners = await getListenerProcesses(port);
    if (!listeners.length) {
      results.push({ port, status: "free" });
      continue;
    }
    for (const listener of listeners) {
      const classification = classifyProcessOwnership({
        processInfo: listener.process,
        service,
        repositoryRoot
      });
      results.push({
        port,
        pid: listener.pid,
        processName: listener.process?.name,
        executablePath: listener.process?.executablePath,
        commandLine: listener.process?.commandLine,
        ...classification
      });
    }
  }
  return results;
}

export async function rotateRuntimeLog(logFile, {
  maximumBytes = 1024 * 1024,
  retainedFiles = 5
} = {}) {
  let size = 0;
  try {
    size = (await fs.stat(logFile)).size;
  } catch {
    return;
  }
  if (size < maximumBytes) return;

  for (let index = retainedFiles - 1; index >= 1; index -= 1) {
    const source = `${logFile}.${index}`;
    const destination = `${logFile}.${index + 1}`;
    try {
      await fs.rename(source, destination);
    } catch {
      // Missing retained files are expected.
    }
  }
  try {
    await fs.rename(logFile, `${logFile}.1`);
  } catch {
    // A concurrently rotated file is harmless.
  }
}

export async function appendRuntimeLog(paths, event, details = {}) {
  await ensureRuntimePaths(paths);
  const logFile = path.join(paths.logsRoot, "supervisor.log");
  await rotateRuntimeLog(logFile);
  const safeDetails = JSON.parse(
    JSON.stringify(details, (key, value) =>
      /password|token|secret|api[_-]?key|authorization|login/i.test(key)
        ? "[redacted]"
        : typeof value === "string"
          ? redactRuntimeText(value)
          : value
    )
  );
  await fs.appendFile(
    logFile,
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      details: safeDetails
    })}\n`,
    "utf8"
  );
}

export async function startManagedService({
  service,
  paths,
  repositoryIdentity,
  environment = process.env
}) {
  if (service.runtime === "external") {
    throw new Error(`External service ${service.serviceId} cannot be started as a child.`);
  }
  await ensureRuntimePaths(paths);
  const logFile = path.join(paths.logsRoot, `${service.serviceId}.log`);
  await rotateRuntimeLog(logFile);
  const logHandle = await fs.open(logFile, "a");
  const child = spawn(service.command, service.args, {
    cwd: service.workingDirectory,
    env: { ...environment, ...(service.environment ?? {}) },
    detached: true,
    stdio: ["ignore", logHandle.fd, logHandle.fd],
    windowsHide: true
  });
  child.unref();
  await logHandle.close();

  const record = {
    version: 1,
    serviceId: service.serviceId,
    pid: child.pid,
    command: service.command,
    args: service.args,
    scriptPath: service.scriptPath,
    workingDirectory: service.workingDirectory,
    startedAt: new Date().toISOString(),
    expectedPorts: service.expectedPorts,
    restartCount: 0,
    restartAttempts: [],
    processFingerprint: buildProcessFingerprint({
      service,
      ...repositoryIdentity
    }),
    repositoryRoot: repositoryIdentity.repositoryRoot,
    branch: repositoryIdentity.branch,
    headCommit: repositoryIdentity.headCommit,
    logFile,
    authority: runtimeAuthority
  };
  await writeJsonAtomic(serviceRecordPath(paths, service.serviceId), record);
  return record;
}

export async function adoptManagedService({
  service,
  processInfo,
  paths,
  repositoryIdentity
}) {
  const record = {
    version: 1,
    serviceId: service.serviceId,
    pid: processInfo.pid,
    command: service.command,
    args: service.args,
    scriptPath: service.scriptPath,
    workingDirectory: service.workingDirectory,
    startedAt: undefined,
    adoptedAt: new Date().toISOString(),
    expectedPorts: service.expectedPorts,
    restartCount: 0,
    restartAttempts: [],
    processFingerprint: buildProcessFingerprint({
      service,
      ...repositoryIdentity
    }),
    repositoryRoot: repositoryIdentity.repositoryRoot,
    branch: repositoryIdentity.branch,
    headCommit: repositoryIdentity.headCommit,
    authority: runtimeAuthority
  };
  await writeJsonAtomic(serviceRecordPath(paths, service.serviceId), record);
  return record;
}

export async function stopManagedService({
  service,
  paths,
  repositoryRoot
}) {
  if (service.runtime === "external") {
    return { stopped: false, reason: "external_service_left_running" };
  }
  const recordFile = serviceRecordPath(paths, service.serviceId);
  const record = await readJsonFile(recordFile);
  if (!record?.pid || !isPidAlive(record.pid)) {
    await fs.rm(recordFile, { force: true });
    return { stopped: false, reason: "service_not_running" };
  }
  const processInfo = await getProcessInfo(record.pid);
  const ownership = classifyProcessOwnership({
    processInfo,
    service,
    repositoryRoot
  });
  if (ownership.status !== "owned_current_worktree") {
    return {
      stopped: false,
      reason: "process_identity_mismatch",
      pid: record.pid,
      ownership: ownership.status
    };
  }

  if (process.platform === "win32") {
    await execFileAsync("taskkill.exe", ["/PID", String(record.pid), "/T", "/F"], {
      windowsHide: true,
      timeout: 12_000
    }).catch(() => undefined);
  } else {
    process.kill(record.pid, "SIGTERM");
  }
  for (let attempt = 0; attempt < 20 && isPidAlive(record.pid); attempt += 1) {
    await sleep(250);
  }
  await fs.rm(recordFile, { force: true });
  return { stopped: !isPidAlive(record.pid), pid: record.pid };
}

export async function probeRuntimeEndpoint(url, timeoutMs = 2_500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    return { ok: response.ok, status: response.status, payload };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function waitForServiceHealth(service, timeoutMs = 20_000) {
  const healthProbe = service.healthProbes.find(
    (probe) => probe.kind === "health" && probe.url
  );
  if (!healthProbe) return { ok: true };
  const deadline = Date.now() + timeoutMs;
  let latest;
  while (Date.now() < deadline) {
    latest = await probeRuntimeEndpoint(healthProbe.url);
    if (latest.ok) return latest;
    await sleep(500);
  }
  return latest ?? { ok: false, status: "timeout" };
}

export async function collectServiceStatus({
  service,
  paths,
  repositoryRoot
}) {
  const blockers = [];
  const warnings = [];
  const ports = await inspectServicePortOwnership({ service, repositoryRoot });
  let processInfo;
  let record;

  if (service.runtime === "external") {
    processInfo = await findProcessByExecutable(service.scriptPath);
    if (!processInfo) blockers.push(`${service.serviceId}_not_running`);
  } else {
    record = await readJsonFile(serviceRecordPath(paths, service.serviceId));
    if (record?.pid && isPidAlive(record.pid)) {
      processInfo = await getProcessInfo(record.pid);
    } else {
      const owned = ports.find((port) => port.status === "owned_current_worktree");
      if (owned?.pid) processInfo = await getProcessInfo(owned.pid);
    }
    if (!processInfo) blockers.push(`${service.serviceId}_not_running`);
  }

  for (const port of ports) {
    if (port.status === "blocked_foreign_worktree") {
      blockers.push(`${service.serviceId}_port_owned_by_foreign_worktree`);
    }
    if (port.status === "blocked_unknown_owner") {
      blockers.push(`${service.serviceId}_port_owned_by_unknown_process`);
    }
  }

  const probes = [];
  if (processInfo) {
    for (const descriptor of service.healthProbes) {
      if (descriptor.kind === "process") {
        probes.push({
          probeId: descriptor.probeId,
          kind: descriptor.kind,
          ok: true,
          status: "running",
          classification: "healthy",
          checkedAt: new Date().toISOString(),
          restartRelevant: false,
          warnings: []
        });
        continue;
      }
      const result = await probeRuntimeEndpoint(descriptor.url);
      const probe = classifyProbe({ descriptor, result });
      probes.push(probe);
      warnings.push(...probe.warnings);
      if (descriptor.restartRelevant && !probe.ok) {
        blockers.push(`${service.serviceId}_${descriptor.probeId}_failed`);
      }
    }
  }

  let state = "healthy";
  if (blockers.length) state = processInfo ? "failed" : "stopped";
  else if (warnings.length) state = "degraded";

  return {
    serviceId: service.serviceId,
    state,
    pid: processInfo?.pid,
    startedAt: record?.startedAt,
    lastHeartbeatAt: new Date().toISOString(),
    lastHealthyAt: state === "healthy" ? new Date().toISOString() : record?.lastHealthyAt,
    restartCount: Number(record?.restartCount ?? 0),
    restartAttempts: Array.isArray(record?.restartAttempts) ? record.restartAttempts : [],
    ports: ports.map((port) => ({
      port: port.port,
      state:
        port.status === "free"
          ? "free"
          : port.status === "owned_current_worktree"
            ? "owned"
            : port.status === "blocked_foreign_worktree"
              ? "foreign"
              : "unknown",
      pid: port.pid
    })),
    probes: probes.map(({ warnings: _warnings, restartRelevant: _restartRelevant, ...probe }) => probe),
    restartRelevantFailure: probes.some((probe) => probe.restartRelevant && !probe.ok),
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    authority: runtimeAuthority
  };
}

export async function updateServiceRestartRecord({
  serviceId,
  paths,
  restartAttempts,
  restartCount
}) {
  const file = serviceRecordPath(paths, serviceId);
  const record = (await readJsonFile(file)) ?? {};
  await writeJsonAtomic(file, {
    ...record,
    restartAttempts,
    restartCount,
    lastRestartAt: new Date().toISOString()
  });
}

export { sleep };
