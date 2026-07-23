#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";
import { readJsonFile, writeJsonAtomic } from "./gotrader-runtime-io.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = String(process.argv[2] || "status").toLowerCase();
const profileId =
  process.env.GOTRADER_RUNTIME_PROFILE_ID ||
  "always_on_shadow_context_verified";
const stateRoot = process.env.GOTRADER_RUNTIME_STATE_ROOT
  ? path.resolve(process.env.GOTRADER_RUNTIME_STATE_ROOT)
  : path.join(repoRoot, ".gotrader", "runtime");
const timeRoot = path.join(stateRoot, profileId, "time");
const statusFile = path.join(timeRoot, "watcher-status.json");
const controlFile = path.join(timeRoot, "watcher-control.json");

if (command === "status") {
  const status = await readJsonFile(statusFile);
  console.log(
    JSON.stringify(
      status ?? {
        state: "stopped",
        blockers: ["current_live_time_verifier_not_running"],
        ...currentLiveVerificationAuthority
      },
      null,
      2
    )
  );
  process.exit(status ? 0 : 2);
}

if (!["stop-watch", "resume"].includes(command)) {
  console.error(`Unsupported time-watch command: ${command}`);
  process.exit(1);
}
const control = {
  version: 1,
  revision: `${Date.now()}-${process.pid}`,
  desiredState: command === "stop-watch" ? "paused" : "running",
  requestedAt: new Date().toISOString(),
  ...currentLiveVerificationAuthority
};
await writeJsonAtomic(controlFile, control);
console.log(JSON.stringify({ status: "accepted", controlFile, ...control }, null, 2));
