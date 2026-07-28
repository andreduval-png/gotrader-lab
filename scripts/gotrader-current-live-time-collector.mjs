import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildCurrentLiveVerificationArtifact,
  canonicalHash,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";

const isoFromSeconds = (value) => {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return undefined;
  return new Date(seconds * 1_000).toISOString();
};

const defaultFetchJson = async (url, timeoutMs = 5_000) => {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs)
    });
    return response.ok
      ? await response.json()
      : {
          sourceMethod: "unavailable",
          blockers: [`http_${response.status}`]
        };
  } catch (error) {
    return {
      sourceMethod: "unavailable",
      blockers: [error instanceof Error ? error.message : String(error)]
    };
  }
};

const correlationRaceBlockerPattern =
  /^(?:upstream_bridge_.+_mismatch|direct_upstream_(?:probe_observation|probe_instance|probe_generated_time|classifier|observed_offset|provider_basis)_mismatch|verification_artifact_id_missing|verification_scope_not_current_live|current_live_time_basis_not_verified|time_contract_proof_state_mismatch)$/;

const isCorrelationRace = (artifact) =>
  artifact?.validationStatus === "blocked" &&
  Array.isArray(artifact.blockers) &&
  artifact.blockers.length > 0 &&
  artifact.blockers.every((blocker) =>
    correlationRaceBlockerPattern.test(String(blocker))
  );

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function compactTerminalProbeResult(result = {}) {
  const observation = result?.observation ?? {};
  const classification = result?.classification ?? {};
  const status = String(result?.status ?? "probe_unavailable");
  const compact = {
    status,
    reason: result?.reason,
    observationId: observation?.observationId,
    probeInstanceId: observation?.probeInstanceId,
    probeVersion: observation?.probeVersion ?? observation?.version,
    probeMode: observation?.probeMode ?? "one_shot_script",
    probeState:
      observation?.probeState ??
      (status === "complete" ? "fresh" : "invalid"),
    terminalConnected:
      typeof observation?.terminalConnected === "boolean"
        ? observation.terminalConnected
        : status === "complete",
    terminalProbeCapturedAt: isoFromSeconds(observation?.timeGmtRaw),
    quoteObservedAt: isoFromSeconds(observation?.symbolTimeRaw),
    latestM5BarAt: isoFromSeconds(observation?.latestBarOpenRaw),
    terminalBuild: Number.isFinite(Number(observation?.terminalBuild))
      ? Number(observation.terminalBuild)
      : undefined,
    symbol: observation?.symbol,
    timeframe: observation?.timeframe,
    chartSymbol: observation?.chartSymbol,
    chartTimeframe: observation?.chartTimeframe,
    providerTimeBasis: classification?.basisClassification,
    pythonTransportBasis: classification?.pythonTransportBasis,
    observedOffsetMinutes: Number.isFinite(
      Number(classification?.terminalObservedOffsetMinutes)
    )
      ? Number(classification.terminalObservedOffsetMinutes)
      : undefined,
    terminalClockClassificationVersion:
      classification?.classificationVersion,
    currentLiveTimeBasisVerified:
      classification?.currentLiveTimeBasisVerified === true,
    blockers: Array.isArray(classification?.blockers)
      ? classification.blockers.map(String)
      : result?.reason
        ? [String(result.reason)]
        : [],
    warnings: Array.isArray(classification?.warnings)
      ? classification.warnings.map(String)
      : [],
    authority: currentLiveVerificationAuthority
  };
  const observationFingerprint =
    /^sha256:[a-f0-9]{64}$/i.test(String(result?.observationFingerprint ?? ""))
      ? String(result.observationFingerprint).toLowerCase()
      : canonicalHash({
          observationId: compact.observationId,
          probeInstanceId: compact.probeInstanceId,
          probeVersion: compact.probeVersion,
          probeMode: compact.probeMode,
          probeState: compact.probeState,
          terminalConnected: compact.terminalConnected,
          terminalProbeCapturedAt: compact.terminalProbeCapturedAt,
          quoteObservedAt: compact.quoteObservedAt,
          latestM5BarAt: compact.latestM5BarAt,
          terminalBuild: compact.terminalBuild,
          symbol: compact.symbol,
          timeframe: compact.timeframe,
          chartSymbol: compact.chartSymbol,
          chartTimeframe: compact.chartTimeframe,
          authority: compact.authority
        });
  return Object.freeze({
    ...compact,
    contentFingerprint: observationFingerprint
  });
}

export function readTerminalProbe({
  repoRoot,
  brokerSymbol = "USTECH",
  environment = process.env,
  spawn = spawnSync
}) {
  const python = spawn(
    environment.PYTHON || "python",
    [
      path.join("scripts", "read-v2-mt5-terminal-clock.py"),
      "--symbol",
      brokerSymbol
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 25_000
    }
  );
  if (python.error) {
    return compactTerminalProbeResult({
      status: "probe_unavailable",
      reason: python.error.message
    });
  }
  try {
    return compactTerminalProbeResult(JSON.parse(python.stdout || "{}"));
  } catch {
    return compactTerminalProbeResult({
      status: "probe_unavailable",
      reason: "terminal_probe_reader_output_invalid"
    });
  }
}

export async function collectCurrentLiveTimeEvidence({
  repoRoot,
  upstreamUrl,
  bridgeUrl,
  requestedSymbol = "MNQ",
  brokerSymbol = "USTECH",
  nowUtc,
  currentTime = () => new Date().toISOString(),
  environment = process.env,
  fetchJson = defaultFetchJson,
  readProbe = readTerminalProbe,
  requireDirectProbe = false,
  maximumCorrelationAttempts = 5,
  correlationRetryDelayMs = 250,
  delay = wait
}) {
  const attempts = Math.min(
    5,
    Math.max(1, Number(maximumCorrelationAttempts) || 1)
  );
  let latestEvidence;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const directProbe = await readProbe({
      repoRoot,
      brokerSymbol,
      environment
    });
    const [upstream, bridge] = await Promise.all([
      fetchJson(
        `${String(upstreamUrl).replace(/\/+$/, "")}/time-contract?symbol_name=${encodeURIComponent(
          brokerSymbol
        )}`
      ),
      fetchJson(
        `${String(bridgeUrl).replace(/\/+$/, "")}/time-contract?symbol=${encodeURIComponent(
          brokerSymbol
        )}`
      )
    ]);
    const artifact = buildCurrentLiveVerificationArtifact({
      upstream,
      bridge,
      directProbe,
      requestedSymbol,
      brokerSymbol,
      nowUtc: nowUtc ?? currentTime(),
      requireDirectProbe
    });
    latestEvidence = Object.freeze({
      artifact,
      directProbe,
      correlationAttemptCount: attempt,
      surfaces: Object.freeze({
        upstreamAvailable: upstream?.sourceMethod !== "unavailable",
        bridgeAvailable: bridge?.sourceMethod !== "unavailable"
      }),
      authority: currentLiveVerificationAuthority
    });
    if (!isCorrelationRace(artifact) || attempt === attempts) {
      return latestEvidence;
    }
    await delay(
      Math.min(
        Math.max(0, Number(correlationRetryDelayMs) || 0) * attempt,
        1_000
      )
    );
  }
  return latestEvidence;
}
