#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertCompactTimeVerificationArtifact,
  buildCurrentLiveVerificationArtifact,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";
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

const fetchJson = async (url) => {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000)
    });
    return response.ok
      ? await response.json()
      : { sourceMethod: "unavailable", blockers: [`http_${response.status}`] };
  } catch (error) {
    return {
      sourceMethod: "unavailable",
      blockers: [error instanceof Error ? error.message : String(error)]
    };
  }
};

const python = spawnSync(
  process.env.PYTHON || "python",
  [
    path.join("scripts", "read-v2-mt5-terminal-clock.py"),
    "--symbol",
    brokerSymbol
  ],
  { cwd: repoRoot, encoding: "utf8" }
);
let directProbe = {};
if (python.status === 0) {
  try {
    const result = JSON.parse(python.stdout);
    if (result?.status === "complete") {
      directProbe = {
        observationId: result.observation?.observationId,
        probeInstanceId: result.observation?.probeInstanceId,
        terminalProbeCapturedAt: result.observation?.timeGmtRaw
          ? new Date(Number(result.observation.timeGmtRaw) * 1_000).toISOString()
          : undefined,
        quoteObservedAt: result.observation?.symbolTimeRaw
          ? new Date(Number(result.observation.symbolTimeRaw) * 1_000).toISOString()
          : undefined,
        pythonTransportBasis: result.classification?.pythonTransportBasis
      };
    }
  } catch {
    directProbe = {};
  }
}

const [upstream, bridge] = await Promise.all([
  fetchJson(
    `${upstreamUrl}/time-contract?symbol_name=${encodeURIComponent(brokerSymbol)}`
  ),
  fetchJson(
    `${bridgeUrl}/time-contract?symbol=${encodeURIComponent(brokerSymbol)}`
  )
]);
const artifact = buildCurrentLiveVerificationArtifact({
  upstream,
  bridge,
  directProbe,
  requestedSymbol,
  brokerSymbol
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
