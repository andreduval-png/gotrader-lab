import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
export const readProcessRss = async (pid) => {
  if (process.platform === "win32") {
    const { stdout } = await execute("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      `(Get-Process -Id ${Number(pid)} -ErrorAction Stop).WorkingSet64`
    ], { windowsHide: true, timeout: 5000 });
    const value = Number(stdout.trim());
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error("P4_RSS_UNAVAILABLE");
    return value;
  }
  if (process.platform === "linux") {
    const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
    const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    if (!match) throw new Error("P4_RSS_UNAVAILABLE");
    return Number(match[1]) * 1024;
  }
  throw new Error("P4_RSS_PLATFORM_UNSUPPORTED");
};

export const superviseProbe = async ({
  lockPath, script, args = [], cwd, timeoutMs, maxRssBytes,
  pollMs = 1000, measureRss = readProcessRss, stdoutPath, stderrPath, inspectDisk
}) => {
  if (![timeoutMs, maxRssBytes, pollMs].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error("P4_INVALID_RESOURCE_LIMIT");
  }
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const token = randomUUID();
  // Never infer a stale owner or remove an existing lock automatically.
  const fd = fs.openSync(lockPath, "wx");
  fs.writeFileSync(fd, JSON.stringify({ token, supervisorPid: process.pid, startedAt: new Date().toISOString() }));
  const started = Date.now();
  let child;
  let closed = false;
  let reason;
  let peakRssBytes = 0;
  let samples = 0;
  let sampling = false;
  let interval;
  let deadline;
  let diskInterval;
  let diskSnapshot;
  const logHandles = [];
  const stop = (why) => {
    reason ??= why;
    if (child && !closed) child.kill("SIGKILL");
  };
  const interrupted = () => stop("SUPERVISOR_INTERRUPTED");
  process.on("SIGINT", interrupted);
  process.on("SIGTERM", interrupted);
  const checkDisk = () => {
    if (!inspectDisk || reason) return;
    try {
      diskSnapshot = inspectDisk();
      if (diskSnapshot.reason) stop(diskSnapshot.reason);
    } catch { stop("DISK_TELEMETRY_UNAVAILABLE"); }
  };
  try {
    checkDisk();
    if (reason) throw new Error(`P4_PREFLIGHT_${reason}`);
    const output = (file) => {
      if (!file) return "ignore";
      const handle = fs.openSync(file, "wx");
      logHandles.push(handle);
      return handle;
    };
    child = spawn(process.execPath, ["--max-old-space-size=512", script, ...args], {
      cwd, windowsHide: true, stdio: ["ignore", output(stdoutPath), output(stderrPath)]
    });
    const exit = new Promise((resolve) => {
      child.once("error", () => { reason ??= "SPAWN_FAILED"; });
      child.once("close", (code, signal) => {
        closed = true;
        resolve({ code, signal });
      });
    });
    const sample = async () => {
      if (sampling || closed || reason) return;
      sampling = true;
      try {
        const rss = await measureRss(child.pid);
        if (closed || reason) return;
        if (!Number.isSafeInteger(rss) || rss <= 0) throw new Error("invalid RSS");
        peakRssBytes = Math.max(peakRssBytes, rss);
        samples += 1;
        if (rss > maxRssBytes) stop("RSS_LIMIT");
      } catch {
        if (!closed) stop("RSS_UNAVAILABLE");
      } finally { sampling = false; }
    };
    deadline = setTimeout(() => stop("TIME_LIMIT"), timeoutMs);
    interval = setInterval(sample, pollMs);
    diskInterval = setInterval(checkDisk, pollMs);
    void sample();
    const terminal = await exit;
    checkDisk();
    return {
      status: reason ? "TERMINATED" : terminal.code !== 0 ? "FAILED" : samples ? "COMPLETED" : "UNMEASURED",
      reason: reason ?? (terminal.code !== 0 ? "CHILD_EXIT_FAILURE" : samples ? null : "NO_RSS_SAMPLE"),
      ...terminal, elapsedMs: Date.now() - started, peakRssBytes, samples, diskSnapshot,
      authority: "none/none/none"
    };
  } finally {
    process.off("SIGINT", interrupted);
    process.off("SIGTERM", interrupted);
    clearInterval(interval);
    clearInterval(diskInterval);
    clearTimeout(deadline);
    logHandles.forEach((handle) => fs.closeSync(handle));
    fs.closeSync(fd);
    // Keep the lock if child termination was not confirmed or ownership changed.
    if ((!child || closed) && JSON.parse(fs.readFileSync(lockPath, "utf8")).token === token) {
      fs.unlinkSync(lockPath);
    }
  }
};
