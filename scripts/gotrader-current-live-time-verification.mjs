#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCompactTimeVerificationArtifact,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";
import { collectCurrentLiveTimeEvidence } from "./gotrader-current-live-time-collector.mjs";
import { writeJsonAtomic } from "./gotrader-runtime-io.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileId =
  process.env.GOTRADER_RUNTIME_PROFILE_ID || "always_on_shadow_context";
const stateRoot = process.env.GOTRADER_RUNTIME_STATE_ROOT
  ? path.resolve(process.env.GOTRADER_RUNTIME_STATE_ROOT)
  : path.join(repoRoot, ".gotrader", "runtime");
const artifactFile = path.join(
  stateRoot,
  profileId,
  "time",
  "current-live-verification.json"
);
const upstreamUrl = String(
  process.env.MT5_READONLY_UPSTREAM_URL ||
    process.env.MT5_READONLY_UPSTREAM_BASE_URL ||
    "http://127.0.0.1:8000"
).replace(/\/+$/, "");
const bridgeUrl = String(
  process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341"
).replace(/\/+$/, "");
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";

const { artifact } = await collectCurrentLiveTimeEvidence({
  repoRoot,
  upstreamUrl,
  bridgeUrl,
  requestedSymbol,
  brokerSymbol,
  requireDirectProbe: false
});
const compactValidation = assertCompactTimeVerificationArtifact(artifact);
if (!compactValidation.valid) {
  console.log(
    JSON.stringify(
      {
        status: "blocked_unsafe_artifact",
        blockers: compactValidation.errors,
        artifactPersisted: false,
        nextAction:
          "Repair the compact verification contract before accepting live close events.",
        authority: currentLiveVerificationAuthority
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} else {
  await fs.mkdir(path.dirname(artifactFile), { recursive: true });
  await writeJsonAtomic(artifactFile, artifact);
  console.log(
    JSON.stringify(
      {
        status:
          artifact.validationStatus === "accepted"
            ? "current_live_time_verified"
            : "blocked_current_live_time_verification",
        artifactFile,
        artifact,
        nextAction:
          artifact.validationStatus === "accepted"
            ? "Start or continue the always_on_shadow_context profile."
            : "Run the compiled GoTraderClockProbe on the connected USTECH chart, then rerun this command immediately.",
        authority: currentLiveVerificationAuthority
      },
      null,
      2
    )
  );
  if (artifact.validationStatus !== "accepted") process.exitCode = 2;
}
