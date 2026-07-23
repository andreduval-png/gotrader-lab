#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isPidAlive,
  readJsonFile,
  writeJsonAtomic
} from "./gotrader-runtime-io.mjs";
import { shadowContextAuthority } from "./gotrader-shadow-context-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] || "status";
if (!new Set(["status", "pause", "resume"]).has(command)) {
  console.error(`Unsupported shadow-context command: ${command}.`);
  process.exit(2);
}
const profileId =
  process.env.GOTRADER_RUNTIME_PROFILE_ID || "always_on_shadow_context";
const stateRoot = process.env.GOTRADER_RUNTIME_STATE_ROOT
  ? path.resolve(process.env.GOTRADER_RUNTIME_STATE_ROOT)
  : path.join(repoRoot, ".gotrader", "runtime");
const contextRoot = path.join(stateRoot, profileId, "context");
const statusFile = path.join(
  stateRoot,
  profileId,
  "scheduler",
  "status.json"
);
const controlFile = path.join(contextRoot, "control.json");

if (command === "status") {
  const schedulerStatus = await readJsonFile(statusFile);
  const running = Boolean(
    schedulerStatus?.processId && isPidAlive(schedulerStatus.processId)
  );
  console.log(
    JSON.stringify(
      schedulerStatus?.shadowContext ?? {
        enabled: true,
        state: running ? "starting" : "stopped",
        blockers: running ? [] : ["shadow_context_scheduler_not_running"],
        ...shadowContextAuthority
      },
      null,
      2
    )
  );
  process.exit(running ? 0 : 1);
}

await fs.mkdir(contextRoot, { recursive: true });
await writeJsonAtomic(controlFile, {
  version: 1,
  revision: `${Date.now()}-${process.pid}`,
  desiredState: command === "pause" ? "paused" : "running",
  requestedAt: new Date().toISOString(),
  requestedByPid: process.pid,
  productionAdoptionAllowed: false,
  ...shadowContextAuthority
});
console.log(
  JSON.stringify(
    {
      accepted: true,
      desiredState: command === "pause" ? "paused" : "running",
      message:
        "Shadow context intake control recorded. Strategy, evidence, readiness, paper-demo, and execution remain disabled.",
      ...shadowContextAuthority
    },
    null,
    2
  )
);
