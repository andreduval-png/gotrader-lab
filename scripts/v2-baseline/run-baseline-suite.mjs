#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workspace = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(workspace, "scripts", "v2-baseline", "test-manifest.json"), "utf8")
);
const suiteName = process.argv[2];

if (!suiteName || !manifest.suites[suiteName]) {
  console.error(`Unknown baseline suite: ${suiteName || "<missing>"}`);
  console.error(`Available suites: ${Object.keys(manifest.suites).join(", ")}`);
  process.exit(2);
}

const packageScripts = JSON.parse(fs.readFileSync(path.join(workspace, "package.json"), "utf8")).scripts;
const results = [];
for (const scriptName of manifest.suites[suiteName]) {
  if (!packageScripts[scriptName]) {
    results.push({ scriptName, status: "missing" });
    console.error(`Missing npm script required by ${suiteName}: ${scriptName}`);
    continue;
  }
  const startedAt = Date.now();
  const command = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm.cmd run ${scriptName}`]
    : ["run", scriptName];
  const result = spawnSync(command, args, {
    cwd: workspace,
    stdio: "inherit",
    shell: false,
    env: process.env
  });
  results.push({
    scriptName,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    error: result.error?.message,
    durationMs: Date.now() - startedAt
  });
  if (result.status !== 0) break;
}

const failed = results.find((result) => result.status !== "passed");
console.log(JSON.stringify({ suite: suiteName, status: failed ? "failed" : "passed", results }, null, 2));
process.exit(failed ? 1 : 0);
