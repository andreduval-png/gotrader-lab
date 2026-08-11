#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  authorityNone,
  bt15RuntimeRoot,
  compactJson,
  loadBt15Modules,
  parseArguments,
  readJson,
  requireAuthorityNone,
  writeJsonAtomic
} from "./support/bt1-5-qualification-runtime.mjs";

const args = parseArguments(process.argv.slice(2));
if (!args.bundle) throw new Error("Usage: prepare-bt1-5-live-preflight --bundle <bundle.json> [--output <preflight.json>]");
const bundle = readJson(args.bundle);
requireAuthorityNone(bundle.authority, "bundle authority");
const modules = await loadBt15Modules("live-preflight");
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const worktreeStatus = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
const observedAtUtc = new Date().toISOString();
const local = new Date();
const weekday = local.getDay();
const localMinutes = local.getHours() * 60 + local.getMinutes();
const b12PriorityWindow = weekday >= 1 && weekday <= 4 && localMinutes >= 14 * 60 + 15 && localMinutes <= 19 * 60 + 30;
const processesRaw = execFileSync("powershell.exe", [
  "-NoProfile",
  "-Command",
  "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"
], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const parsedProcesses = processesRaw.trim() ? JSON.parse(processesRaw) : [];
const processes = Array.isArray(parsedProcesses) ? parsedProcesses : [parsedProcesses];
const lowerCommand = (item) => String(item.CommandLine ?? "").toLowerCase();
const observerProcesses = processes.filter((item) => /gotrader-observe|b1-2-canary/.test(lowerCommand(item)));
const competingRuntimeProcesses = processes.filter((item) =>
  /gotrader-runtime-supervisor|gotrader-supervisor\.mjs/.test(lowerCommand(item)));
const historicalProcesses = processes.filter((item) =>
  /run-bt1-5-dataset-qualification|diagnose-bt1-5-mt5-source/.test(lowerCommand(item)));
const competingHeavyProcesses = processes.filter((item) =>
  /playwright|deep-research|parameter-search|parameter-sweep/.test(lowerCommand(item)));
const mt5Processes = processes.filter((item) => String(item.Name ?? "").toLowerCase() === "terminal64.exe");
let pressure;
let pressureError;
try {
  const pressureRaw = execFileSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    "$cpu=(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average; $disk=(Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk | Where-Object Name -eq '_Total' | Select-Object -First 1 -ExpandProperty PercentDiskTime); [pscustomobject]@{cpuPercent=[double]$cpu;diskBusyPercent=[double]$disk}|ConvertTo-Json -Compress"
  ], { encoding: "utf8" });
  pressure = JSON.parse(pressureRaw);
} catch (error) {
  pressureError = String(error?.message ?? error);
}
const netstat = execFileSync("netstat.exe", ["-ano", "-p", "tcp"], { encoding: "utf8" });
const listeners = netstat.split(/\r?\n/).flatMap((line) => {
  const match = line.trim().match(/^TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
  return match ? [{ port: Number(match[2]), processId: Number(match[3]) }] : [];
});
const endpointPort = Number(new URL(bundle.provider.baseUrl).port || 80);
const requiredPorts = Object.freeze([...new Set([endpointPort, ...(endpointPort === 8000 ? [] : [8000])])]);
const portOwnership = Object.freeze(requiredPorts.map((port) => Object.freeze({
  port,
  processIds: Object.freeze([...new Set(listeners.filter((item) => item.port === port).map((item) => item.processId))].sort((a, b) => a - b))
})));

const fetchCompact = async (endpoint) => {
  const response = await fetch(new URL(endpoint, `${bundle.provider.baseUrl}/`), { method: "GET", signal: AbortSignal.timeout(10_000) });
  const payload = await response.json();
  if (!response.ok) throw new Error(`BT1.5 preflight ${endpoint} returned HTTP ${response.status}.`);
  const nested = payload?.authority ?? {};
  const result = Object.freeze({
    ok: true,
    status: String(
      payload?.status ?? payload?.state ?? payload?.connectionStatus ?? payload?.connectionState ?? "unknown"
    ),
    connected:
      payload?.connected === true ||
      payload?.terminalConnected === true ||
      payload?.terminalConnectionState === "connected" ||
      payload?.connectionStatus === "connected" ||
      payload?.connectionState === "connected",
    sourceMethod: String(payload?.sourceMethod ?? payload?.source ?? "unknown"),
    authority: Object.freeze({
      executionAuthority: payload?.executionAuthority ?? nested.executionAuthority,
      brokerAuthority: payload?.brokerAuthority ?? nested.brokerAuthority,
      readinessOverrideAuthority: payload?.readinessOverrideAuthority ?? nested.readinessOverrideAuthority
    })
  });
  requireAuthorityNone(result.authority, `${endpoint} authority`);
  return result;
};

let endpointStatus;
let endpointError;
try {
  endpointStatus = Object.freeze({
    health: await fetchCompact("health"),
    status: await fetchCompact("status"),
    timeContract: await fetchCompact("time-contract")
  });
} catch (error) {
  endpointError = String(error?.message ?? error);
}
const stat = fs.statfsSync(process.cwd());
const freeDiskBytes = stat.bavail * stat.bsize;
const freeMemoryBytes = os.freemem();
const minimumDiskBytes = Math.max(8 * 1024 ** 3, Math.ceil(bundle.bounds.maximumStorageBytes * 1.25));
const minimumMemoryBytes = Math.max(4 * 1024 ** 3, Math.ceil(bundle.bounds.maximumPeakMemoryBytes * 1.25));
const blockers = Object.freeze([
  ...(head !== bundle.candidateHead ? ["bt1_5_candidate_head_mismatch"] : []),
  ...(branch !== bundle.candidateBranch ? ["bt1_5_candidate_branch_mismatch"] : []),
  ...(worktreeStatus ? ["bt1_5_worktree_not_clean"] : []),
  ...(b12PriorityWindow ? ["bt1_5_b1_2_priority_window_active"] : []),
  ...(observerProcesses.length ? ["bt1_5_observer_already_running"] : []),
  ...(competingRuntimeProcesses.length ? ["bt1_5_competing_runtime_running"] : []),
  ...(historicalProcesses.length ? ["bt1_5_historical_job_already_running"] : []),
  ...(competingHeavyProcesses.length ? ["bt1_5_competing_heavy_job_running"] : []),
  ...(mt5Processes.length !== 1 ? ["bt1_5_mt5_process_not_unique"] : []),
  ...(portOwnership.some((item) => item.processIds.length !== 1) ? ["bt1_5_port_ownership_incoherent"] : []),
  ...(endpointError ? ["bt1_5_read_only_endpoint_unhealthy"] : []),
  ...(endpointStatus && !endpointStatus.status.connected ? ["bt1_5_mt5_not_connected"] : []),
  ...(freeDiskBytes < minimumDiskBytes ? ["bt1_5_disk_headroom_insufficient"] : []),
  ...(freeMemoryBytes < minimumMemoryBytes ? ["bt1_5_memory_headroom_insufficient"] : []),
  ...(pressureError ? ["bt1_5_resource_pressure_unknown"] : []),
  ...(Number(pressure?.cpuPercent) > 85 ? ["bt1_5_cpu_pressure_too_high"] : []),
  ...(Number(pressure?.diskBusyPercent) > 90 ? ["bt1_5_disk_pressure_too_high"] : [])
].sort());
const core = Object.freeze(compactJson({
  schemaVersion: "gotrader-bt1-5-live-preflight-v1",
  bundleId: bundle.bundleId,
  candidateHead: head,
  candidateBranch: branch,
  observedAtUtc,
  expiresAtUtc: new Date(Date.parse(observedAtUtc) + 15 * 60_000).toISOString(),
  checks: Object.freeze({
    worktreeClean: !worktreeStatus,
    b12PriorityWindow: b12PriorityWindow,
    observerProcessCount: observerProcesses.length,
    competingRuntimeProcessCount: competingRuntimeProcesses.length,
    historicalProcessCount: historicalProcesses.length,
    competingHeavyProcessCount: competingHeavyProcesses.length,
    mt5ProcessCount: mt5Processes.length,
    mt5ProcessIds: Object.freeze(mt5Processes.map((item) => Number(item.ProcessId)).sort((a, b) => a - b)),
    endpointStatus,
    endpointError,
    portOwnership,
    pressure,
    pressureError,
    freeDiskBytes,
    minimumDiskBytes,
    freeMemoryBytes,
    minimumMemoryBytes
  }),
  status: blockers.length ? "blocked" : "safe_to_start",
  blockers,
  authority: authorityNone
}));
const preflight = Object.freeze({ ...core, preflightId: await modules.canonical.canonicalHash(core) });
const output = args.output
  ? path.resolve(args.output)
  : path.join(bt15RuntimeRoot(), "preflight", `${preflight.preflightId.replace(":", "_")}.json`);
const written = writeJsonAtomic(output, preflight);
console.log(JSON.stringify({
  status: preflight.status,
  preflightId: preflight.preflightId,
  candidateHead: preflight.candidateHead,
  expiresAtUtc: preflight.expiresAtUtc,
  blockers,
  output: written,
  authority: preflight.authority
}, null, 2));
if (blockers.length) process.exitCode = 2;
