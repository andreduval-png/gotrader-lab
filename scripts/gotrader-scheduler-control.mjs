#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  continuousFeedAuthority,
  continuousFeedCapability
} from "./gotrader-continuous-feed-core.mjs";
import {
  isPidAlive,
  readJsonFile,
  writeJsonAtomic
} from "./gotrader-runtime-io.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.argv[2] || "status";
const profileArgumentIndex = process.argv.indexOf("--profile");
const allowed = new Set(["status", "pause", "resume"]);
if (!allowed.has(command)) {
  console.error(`Unsupported scheduler command: ${command}.`);
  process.exit(2);
}

const profileId =
  (profileArgumentIndex >= 0
    ? process.argv[profileArgumentIndex + 1]
    : undefined) ||
  process.env.GOTRADER_RUNTIME_PROFILE_ID ||
  "always_on_read_only_scheduler";
const stateRoot = process.env.GOTRADER_RUNTIME_STATE_ROOT
  ? path.resolve(process.env.GOTRADER_RUNTIME_STATE_ROOT)
  : path.join(repoRoot, ".gotrader", "runtime");
const schedulerRoot = path.join(stateRoot, profileId, "scheduler");
const statusFile = path.join(schedulerRoot, "status.json");
const controlFile = path.join(schedulerRoot, "control.json");

if (command === "status") {
  const status = await readJsonFile(statusFile);
  const processRunning = Boolean(status?.processId && isPidAlive(status.processId));
  const effectiveStatus =
    status && !processRunning
      ? {
          ...status,
          state: "stopped",
          blockers: [
            ...new Set([...(status.blockers ?? []), "scheduler_process_not_running"])
          ],
          warnings: status.warnings ?? []
        }
      : status;
  console.log(
    JSON.stringify(
      effectiveStatus ?? {
        state: "stopped",
        blockers: ["scheduler_not_started"],
        productionAdoptionAllowed: false,
        ...continuousFeedCapability,
        ...continuousFeedAuthority
      },
      null,
      2
    )
  );
  process.exit(processRunning ? 0 : 1);
}

await fs.mkdir(schedulerRoot, { recursive: true });
const desiredState = command === "pause" ? "paused" : "running";
const control = {
  version: 1,
  revision: `${Date.now()}-${process.pid}`,
  desiredState,
  requestedAt: new Date().toISOString(),
  requestedByPid: process.pid,
  productionAdoptionAllowed: false,
  ...continuousFeedAuthority
};
await writeJsonAtomic(controlFile, control);
console.log(
  JSON.stringify(
    {
      accepted: true,
      desiredState,
      message:
        desiredState === "paused"
          ? "Closed-candle task intake will pause after the scheduler reads this control."
          : "Closed-candle task intake will resume after the scheduler reads this control.",
      ...continuousFeedAuthority
    },
    null,
    2
  )
);
