#!/usr/bin/env node

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { isPidAlive, repoRoot, stackDir } from "./local-stack-utils.mjs";

const execFileAsync = promisify(execFile);
const supervisorStatePath = path.join(stackDir, "supervisor.json");
const supervisorLockPath = path.join(stackDir, "supervisor.lock");
let supervisor;
try {
  supervisor = JSON.parse(await fs.readFile(supervisorStatePath, "utf8"));
} catch {
  supervisor = undefined;
}

if (supervisor?.pid && isPidAlive(supervisor.pid)) {
  if (process.platform === "win32") {
    await execFileAsync("taskkill.exe", ["/PID", String(supervisor.pid), "/T", "/F"], {
      windowsHide: true,
      timeout: 10_000
    });
  } else {
    process.kill(Number(supervisor.pid), "SIGTERM");
  }
  console.log(`Stopped GoTrader supervisor PID ${supervisor.pid}.`);
}

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(repoRoot, "scripts/stop-local-stack.mjs")], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });
  child.on("exit", (code) => (code && code !== 0 ? reject(new Error(`stop-local-stack exited with ${code}.`)) : resolve()));
  child.on("error", reject);
});

await fs.mkdir(stackDir, { recursive: true });
await fs.rm(supervisorLockPath, { force: true });
await fs.writeFile(
  supervisorStatePath,
  `${JSON.stringify({ version: 1, status: "stopped", stoppedAt: new Date().toISOString() }, null, 2)}\n`,
  "utf8"
);
console.log("GoTrader and all tracked local services are stopped.");
