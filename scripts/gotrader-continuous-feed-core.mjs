import crypto from "node:crypto";
import { assertCompactTimeVerificationArtifact } from "./gotrader-current-live-time-verification-core.mjs";

export const continuousFeedAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const continuousFeedCapability = Object.freeze({
  marketDataCapability: "read_only"
});

export const CONTINUOUS_FEED_SERVICE_VERSION = "gotrader-continuous-feed-v1";
export const RUNTIME_MARKET_EVENT_VERSION = "gotrader-runtime-market-event-v1";
export const RUNTIME_TIME_NORMALIZATION_VERSION =
  "mt5-provider-wall-clock-to-utc-v1";

export const defaultRollingStoreCapacities = Object.freeze({
  "1m": 2_000,
  "5m": 2_000,
  "15m": 1_500,
  "1h": 1_000,
  "4h": 750,
  "1d": 500,
  "1w": 260
});

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
};

export const stableHash = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");

const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export function normalizeRuntimeTimeframe(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const aliases = {
    m1: "1m",
    m5: "5m",
    m15: "15m",
    h1: "1h",
    h4: "4h",
    d1: "1d",
    w1: "1w"
  };
  return aliases[normalized] ?? normalized;
}

export function runtimeTimeframeMilliseconds(value) {
  const timeframe = normalizeRuntimeTimeframe(value);
  const match = timeframe.match(/^(\d+)(m|h|d|w)$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const multiplier =
    match[2] === "m"
      ? 60_000
      : match[2] === "h"
        ? 3_600_000
        : match[2] === "d"
          ? 86_400_000
          : 604_800_000;
  return amount * multiplier;
}

const isoTime = (value) => {
  const parsed =
    typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1_000)
      : new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

export function normalizeRuntimeProviderTimestamp(value, timeContract) {
  const providerTime = isoTime(value);
  if (!providerTime) {
    return {
      providerTime: undefined,
      normalizedTimeUtc: undefined,
      blocker: "provider_timestamp_invalid"
    };
  }
  if (timeContract?.providerTimeBasis !== "mt5_server_wall_clock") {
    return {
      providerTime,
      normalizedTimeUtc: providerTime,
      offsetAppliedMinutes: 0
    };
  }
  const offsetMinutes = finiteNumber(timeContract?.observedOffsetMinutes);
  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > 840) {
    return {
      providerTime,
      normalizedTimeUtc: undefined,
      blocker: "provider_wall_clock_offset_invalid"
    };
  }
  return {
    providerTime,
    normalizedTimeUtc: new Date(
      Date.parse(providerTime) - offsetMinutes * 60_000
    ).toISOString(),
    offsetAppliedMinutes: offsetMinutes
  };
}

export function buildRuntimeSourceIdentity({
  sourceProvider = "mt5_read_only",
  requestedSymbol,
  brokerSymbol,
  timeframe,
  timeContractVersion
}) {
  return `sha256:${stableHash({
    sourceProvider,
    requestedSymbol,
    brokerSymbol,
    timeframe: timeframe ? normalizeRuntimeTimeframe(timeframe) : undefined,
    timeContractVersion: timeContractVersion || "unknown"
  })}`;
}

export function buildRuntimeCandleIdentity({
  sourceIdentity,
  requestedSymbol,
  brokerSymbol,
  timeframe,
  candleOpenTime,
  candleCloseTime
}) {
  return `sha256:${stableHash({
    sourceIdentity,
    requestedSymbol,
    brokerSymbol,
    timeframe: normalizeRuntimeTimeframe(timeframe),
    candleOpenTime,
    candleCloseTime
  })}`;
}

export function buildRuntimeCandlePayloadHash(candle) {
  return `sha256:${stableHash({
    open: finiteNumber(candle?.open),
    high: finiteNumber(candle?.high),
    low: finiteNumber(candle?.low),
    close: finiteNumber(candle?.close),
    volume: finiteNumber(candle?.volume),
    tickVolume: finiteNumber(candle?.tickVolume),
    spread: finiteNumber(candle?.spread)
  })}`;
}

export function buildRuntimeTimeIdentityVersion(timeContract) {
  const version = String(timeContract?.version ?? "unknown");
  if (timeContract?.providerTimeBasis !== "mt5_server_wall_clock") {
    return `${version}|provider:${timeContract?.providerTimeBasis ?? "unknown"}`;
  }
  const offsetMinutes = finiteNumber(timeContract?.observedOffsetMinutes);
  return `${version}|provider:mt5_server_wall_clock|offset:${
    Number.isInteger(offsetMinutes) ? offsetMinutes : "unknown"
  }|normalization:${RUNTIME_TIME_NORMALIZATION_VERSION}`;
}

export function evaluateRuntimeTimeContract(
  contract,
  {
    requireVerificationArtifact = false,
    requireWatcherArtifact = false,
    verificationArtifact,
    verifierStatus,
    nowUtc = new Date().toISOString()
  } = {}
) {
  const version = String(contract?.version ?? contract?.wrapperContractVersion ?? "unknown");
  const artifactId = String(contract?.timeVerificationArtifactId ?? "");
  const generatedAtUtc =
    contract?.timeVerificationGeneratedAtUtc ?? contract?.terminalProbeCapturedAt;
  const expiresAtUtc = contract?.timeVerificationExpiresAtUtc;
  const generatedMs = Date.parse(generatedAtUtc ?? "");
  const nowMs = Date.parse(nowUtc);
  const proofAgeSeconds =
    Number.isFinite(generatedMs) && Number.isFinite(nowMs)
      ? Math.max(0, Math.round((nowMs - generatedMs) / 1_000))
      : undefined;
  const derivedProofState =
    proofAgeSeconds === undefined || nowMs < generatedMs - 5_000
      ? "conflicting"
      : proofAgeSeconds <= 120
        ? "fresh"
        : proofAgeSeconds <= 180
          ? "expiring"
          : "stale";
  const proofState = contract?.timeVerificationProofState ?? derivedProofState;
  const currentLiveVerified =
    contract?.currentLiveTimeBasisVerified === true ||
    (contract?.verificationStatus === "verified" &&
      contract?.providerTimeBasis &&
      contract.providerTimeBasis !== "unknown");
  const stale =
    contract?.terminalEvidenceStatus === "stale" ||
    (Array.isArray(contract?.terminalProbeBlockers) &&
      contract.terminalProbeBlockers.some((item) => String(item).includes("stale")));
  const blockers = [];
  if (!currentLiveVerified) blockers.push("current_live_time_basis_not_verified");
  if (stale) blockers.push("terminal_time_evidence_stale");
  if (requireVerificationArtifact) {
    if (!artifactId) blockers.push("current_live_verification_artifact_missing");
    if (contract?.timeVerificationScope !== "current_live") {
      blockers.push("current_live_verification_scope_invalid");
    }
    if (proofState !== "fresh") blockers.push(`current_live_proof_${proofState}`);
    if (
      !generatedAtUtc ||
      !expiresAtUtc ||
      !Number.isFinite(Date.parse(expiresAtUtc))
    ) {
      blockers.push("current_live_verification_expiry_missing");
    }
  }
  let effectiveArtifactId = artifactId || undefined;
  let continuityStartedAtUtc;
  let watcherArtifactProofState;
  if (requireWatcherArtifact) {
    const compactValidation = assertCompactTimeVerificationArtifact(
      verificationArtifact
    );
    if (!verificationArtifact) {
      blockers.push("current_live_watcher_artifact_missing");
    } else {
      if (!compactValidation.valid) {
        blockers.push(...compactValidation.errors);
      }
      const watcherGeneratedMs = Date.parse(
        verificationArtifact?.generatedAtUtc ?? ""
      );
      const watcherAgeSeconds =
        Number.isFinite(watcherGeneratedMs) && Number.isFinite(nowMs)
          ? Math.max(0, Math.round((nowMs - watcherGeneratedMs) / 1_000))
          : undefined;
      watcherArtifactProofState =
        watcherAgeSeconds === undefined || nowMs < watcherGeneratedMs - 5_000
          ? "conflicting"
          : watcherAgeSeconds <= 120
            ? "fresh"
            : watcherAgeSeconds <= 180
              ? "expiring"
              : "stale";
      if (verificationArtifact?.validationStatus !== "accepted") {
        blockers.push("current_live_watcher_artifact_not_accepted");
      }
      if (watcherArtifactProofState !== "fresh") {
        blockers.push(`current_live_watcher_proof_${watcherArtifactProofState}`);
      }
      if (verificationArtifact?.currentLiveTimeBasisVerified !== true) {
        blockers.push("current_live_watcher_basis_not_verified");
      }
      if (verificationArtifact?.historicalDstPolicyVerified !== false) {
        blockers.push("historical_verification_must_remain_false");
      }
      if (verificationArtifact?.terminalConnected !== true) {
        blockers.push("current_live_watcher_terminal_not_connected");
      }
      const contractProbeObservationId =
        contract?.terminalProbeObservationId;
      const contractProbeInstanceId = contract?.terminalProbeInstanceId;
      const contractProbeGeneratedMs = Date.parse(
        contract?.timeVerificationGeneratedAtUtc ??
          contract?.generatedAtUtc ??
          ""
      );
      if (!contractProbeObservationId) {
        blockers.push("current_live_contract_probe_observation_missing");
      } else if (
        Number.isFinite(watcherGeneratedMs) &&
        Number.isFinite(contractProbeGeneratedMs)
      ) {
        if (contractProbeGeneratedMs < watcherGeneratedMs) {
          blockers.push("current_live_contract_probe_out_of_order");
        } else if (
          contractProbeGeneratedMs === watcherGeneratedMs &&
          verificationArtifact?.probeObservationId !==
            contractProbeObservationId
        ) {
          blockers.push("current_live_watcher_probe_observation_conflict");
        }
      } else {
        blockers.push("current_live_probe_time_missing");
      }
      if (
        !contractProbeInstanceId ||
        verificationArtifact?.probeInstanceFingerprint !==
          contractProbeInstanceId
      ) {
        blockers.push("current_live_watcher_probe_instance_mismatch");
      }
      if (
        verificationArtifact?.providerTimeBasis !==
        contract?.providerTimeBasis
      ) {
        blockers.push("current_live_watcher_provider_basis_mismatch");
      }
      if (
        verificationArtifact?.observedOffsetMinutes !==
        finiteNumber(
          contract?.terminalObservedOffsetMinutes ??
            contract?.observedOffsetMinutes
        )
      ) {
        blockers.push("current_live_watcher_observed_offset_mismatch");
      }
      if (
        verificationArtifact?.terminalClockClassificationVersion !==
        contract?.terminalClockClassificationVersion
      ) {
        blockers.push("current_live_watcher_classifier_version_mismatch");
      }
      if (
        verificationArtifact?.requestedSymbol !== "MNQ" ||
        verificationArtifact?.brokerSymbol !== "USTECH"
      ) {
        blockers.push("current_live_watcher_symbol_scope_invalid");
      }
      if (!verificationArtifact?.continuityStartedAtUtc) {
        blockers.push("current_live_continuity_start_missing");
      }
      effectiveArtifactId = verificationArtifact?.artifactId;
      continuityStartedAtUtc =
        verificationArtifact?.continuityStartedAtUtc;
    }
  }
  const pausedForTerminalDisconnected =
    requireWatcherArtifact &&
    ["terminal_disconnected", "transport_disconnected"].includes(
      verifierStatus?.operationalMarketState
    ) &&
    verifierStatus?.proofPausedForTerminalDisconnected === true &&
    verifierStatus?.currentLiveEligible === false &&
    verifierStatus?.executionAuthority === "none" &&
    verifierStatus?.brokerAuthority === "none" &&
    verifierStatus?.readinessOverrideAuthority === "none";
  if (pausedForTerminalDisconnected) {
    const pausedProviderTimeBasis =
      verificationArtifact?.providerTimeBasis ??
      contract?.providerTimeBasis ??
      "unknown";
    const pausedObservedOffsetMinutes =
      verificationArtifact?.observedOffsetMinutes ??
      finiteNumber(
        contract?.terminalObservedOffsetMinutes ??
          contract?.observedOffsetMinutes
      );
    return {
      eligible: false,
      pausedForMarketClosed: false,
      pausedForTerminalDisconnected: true,
      version,
      identityVersion: buildRuntimeTimeIdentityVersion({
        version,
        providerTimeBasis: pausedProviderTimeBasis,
        observedOffsetMinutes: pausedObservedOffsetMinutes
      }),
      artifactId: verificationArtifact?.artifactId ?? effectiveArtifactId,
      contractArtifactId: artifactId || undefined,
      verificationScope: "current_live",
      generatedAtUtc: verificationArtifact?.generatedAtUtc ?? generatedAtUtc,
      expiresAtUtc: verificationArtifact?.expiresAtUtc ?? expiresAtUtc,
      proofState: "paused_terminal_disconnected",
      proofAgeSeconds,
      terminalClockClassificationVersion:
        verificationArtifact?.terminalClockClassificationVersion ??
        contract?.terminalClockClassificationVersion,
      providerTimeBasis: pausedProviderTimeBasis,
      observedOffsetMinutes: pausedObservedOffsetMinutes,
      continuityStartedAtUtc:
        verificationArtifact?.continuityStartedAtUtc ??
        continuityStartedAtUtc,
      watcherArtifactRequired: true,
      marketState: verifierStatus?.marketState ?? "time_unverified",
      operationalMarketState: verifierStatus.operationalMarketState,
      blockers: [],
      warnings: ["terminal_disconnected_fail_closed_pause"]
    };
  }
  const pausedForMarketClosed =
    requireWatcherArtifact &&
    verifierStatus?.marketState === "market_closed" &&
    verifierStatus?.proofPausedForMarketClosed === true &&
    verifierStatus?.currentLiveEligible === false &&
    verifierStatus?.executionAuthority === "none" &&
    verifierStatus?.brokerAuthority === "none" &&
    verifierStatus?.readinessOverrideAuthority === "none";
  if (pausedForMarketClosed) {
    const pausedProviderTimeBasis =
      verificationArtifact?.providerTimeBasis ??
      contract?.providerTimeBasis ??
      "unknown";
    const pausedObservedOffsetMinutes =
      verificationArtifact?.observedOffsetMinutes ??
      finiteNumber(
        contract?.terminalObservedOffsetMinutes ??
          contract?.observedOffsetMinutes
      );
    return {
      eligible: false,
      pausedForMarketClosed: true,
      pausedForTerminalDisconnected: false,
      version,
      identityVersion: buildRuntimeTimeIdentityVersion({
        version,
        providerTimeBasis: pausedProviderTimeBasis,
        observedOffsetMinutes: pausedObservedOffsetMinutes
      }),
      artifactId: verificationArtifact?.artifactId ?? effectiveArtifactId,
      contractArtifactId: artifactId || undefined,
      verificationScope: "current_live",
      generatedAtUtc: verificationArtifact?.generatedAtUtc ?? generatedAtUtc,
      expiresAtUtc: verificationArtifact?.expiresAtUtc ?? expiresAtUtc,
      proofState: "paused_market_closed",
      proofAgeSeconds,
      terminalClockClassificationVersion:
        verificationArtifact?.terminalClockClassificationVersion ??
        contract?.terminalClockClassificationVersion,
      providerTimeBasis: pausedProviderTimeBasis,
      observedOffsetMinutes: pausedObservedOffsetMinutes,
      continuityStartedAtUtc:
        verificationArtifact?.continuityStartedAtUtc ??
        continuityStartedAtUtc,
      watcherArtifactRequired: true,
      marketState: "market_closed",
      operationalMarketState:
        verifierStatus?.operationalMarketState ?? "market_closed",
      blockers: [],
      warnings: ["market_closed_verified_pause"]
    };
  }
  const effectiveObservedOffsetMinutes = finiteNumber(
    contract?.terminalObservedOffsetMinutes ?? contract?.observedOffsetMinutes
  );
  return {
    eligible: currentLiveVerified && !stale && blockers.length === 0,
    version,
    identityVersion: buildRuntimeTimeIdentityVersion({
      version,
      providerTimeBasis: contract?.providerTimeBasis,
      observedOffsetMinutes: effectiveObservedOffsetMinutes
    }),
    artifactId: effectiveArtifactId,
    contractArtifactId: artifactId || undefined,
    verificationScope: contract?.timeVerificationScope ?? "none",
    generatedAtUtc,
    expiresAtUtc,
    proofState: requireWatcherArtifact
      ? watcherArtifactProofState ?? "missing"
      : proofState,
    proofAgeSeconds,
    terminalClockClassificationVersion:
      contract?.terminalClockClassificationVersion,
    providerTimeBasis: contract?.providerTimeBasis ?? "unknown",
    observedOffsetMinutes: effectiveObservedOffsetMinutes,
    continuityStartedAtUtc,
    watcherArtifactRequired: requireWatcherArtifact,
    pausedForMarketClosed: false,
    pausedForTerminalDisconnected: false,
    marketState: verifierStatus?.marketState ?? "time_unverified",
    operationalMarketState:
      verifierStatus?.operationalMarketState ?? "time_unverified",
    blockers,
    warnings: []
  };
}

export function runtimeTimeVerificationSnapshotCoherent({
  verificationArtifact,
  verifierStatus
}) {
  if (!verificationArtifact || !verifierStatus) return false;
  const artifactId = String(verificationArtifact.artifactId ?? "");
  const statusArtifactId = String(verifierStatus.verificationArtifactId ?? "");
  if (!artifactId || artifactId !== statusArtifactId) return false;
  const artifactGeneratedMs = Date.parse(
    verificationArtifact.generatedAtUtc ?? ""
  );
  const statusGeneratedMs = Date.parse(
    verifierStatus.verificationGeneratedAtUtc ?? ""
  );
  return (
    Number.isFinite(artifactGeneratedMs) &&
    Number.isFinite(statusGeneratedMs) &&
    artifactGeneratedMs === statusGeneratedMs
  );
}

const renewalHandoffBlockers = new Set([
  "current_live_time_basis_not_verified",
  "current_live_verification_scope_invalid",
  "current_live_watcher_provider_basis_mismatch"
]);

export function retainFreshRuntimeTimeContractDuringRenewal({
  previous,
  candidate,
  verificationArtifact,
  verifierStatus,
  nowUtc = new Date().toISOString()
}) {
  if (
    previous?.eligible !== true ||
    candidate?.eligible !== false ||
    candidate?.pausedForMarketClosed === true ||
    candidate?.pausedForTerminalDisconnected === true ||
    !candidate?.blockers?.length ||
    candidate.blockers.some(
      (blocker) => !renewalHandoffBlockers.has(blocker)
    )
  ) {
    return undefined;
  }
  const nowMs = Date.parse(nowUtc);
  const artifactGeneratedMs = Date.parse(
    verificationArtifact?.generatedAtUtc ?? ""
  );
  const artifactExpiresMs = Date.parse(
    verificationArtifact?.expiresAtUtc ?? ""
  );
  const artifactAgeMs = nowMs - artifactGeneratedMs;
  const authority = verificationArtifact?.authority ?? {};
  const verifierHealthy =
    verifierStatus?.state === "healthy" &&
    verifierStatus?.currentLiveEligible === true &&
    verifierStatus?.verificationProofState === "fresh" &&
    ["market_open", "market_quiet"].includes(verifierStatus?.marketState) &&
    verifierStatus?.verificationArtifactId === verificationArtifact?.artifactId &&
    verifierStatus?.providerTimeBasis === verificationArtifact?.providerTimeBasis &&
    verifierStatus?.observedOffsetMinutes ===
      verificationArtifact?.observedOffsetMinutes &&
    verifierStatus?.terminalInstanceFingerprint ===
      verificationArtifact?.probeInstanceFingerprint &&
    verifierStatus?.executionAuthority === "none" &&
    verifierStatus?.brokerAuthority === "none" &&
    verifierStatus?.readinessOverrideAuthority === "none";
  const artifactHealthy =
    verificationArtifact?.validationStatus === "accepted" &&
    verificationArtifact?.currentLiveTimeBasisVerified === true &&
    verificationArtifact?.historicalDstPolicyVerified === false &&
    verificationArtifact?.terminalConnected === true &&
    verificationArtifact?.providerTimeBasis === previous?.providerTimeBasis &&
    verificationArtifact?.observedOffsetMinutes ===
      previous?.observedOffsetMinutes &&
    verificationArtifact?.terminalClockClassificationVersion ===
      previous?.terminalClockClassificationVersion &&
    verificationArtifact?.continuityStartedAtUtc ===
      previous?.continuityStartedAtUtc &&
    authority.executionAuthority === "none" &&
    authority.brokerAuthority === "none" &&
    authority.readinessOverrideAuthority === "none" &&
    Number.isFinite(nowMs) &&
    Number.isFinite(artifactGeneratedMs) &&
    Number.isFinite(artifactExpiresMs) &&
    artifactAgeMs >= -5_000 &&
    artifactAgeMs <= 120_000 &&
    nowMs < artifactExpiresMs;
  if (!verifierHealthy || !artifactHealthy) return undefined;
  return {
    ...previous,
    artifactId: verificationArtifact.artifactId,
    generatedAtUtc: verificationArtifact.generatedAtUtc,
    expiresAtUtc: verificationArtifact.expiresAtUtc,
    proofState: "fresh",
    proofAgeSeconds: Math.max(0, Math.round(artifactAgeMs / 1_000)),
    marketState: verifierStatus.marketState,
    operationalMarketState: verifierStatus.operationalMarketState,
    retainedDuringRenewalHandoff: true,
    blockers: [],
    warnings: ["current_live_contract_renewal_handoff_retained"]
  };
}

export function normalizeRuntimeQuote(
  payload,
  receivedAt = new Date().toISOString(),
  timeContract
) {
  const requestedSymbol = String(payload?.requestedSymbol ?? "MNQ");
  const brokerSymbol = String(payload?.brokerSymbol ?? payload?.symbol ?? "USTECH");
  const normalizedTimestamp = normalizeRuntimeProviderTimestamp(
    payload?.timestamp ?? payload?.serverTimestamp ?? payload?.rawTime,
    timeContract
  );
  const observedMarketTime =
    normalizedTimestamp.normalizedTimeUtc ?? receivedAt;
  const bid = finiteNumber(payload?.bid);
  const ask = finiteNumber(payload?.ask);
  const mid =
    finiteNumber(payload?.mid) ??
    (bid !== undefined && ask !== undefined ? Number(((bid + ask) / 2).toFixed(8)) : undefined);
  return {
    requestedSymbol,
    brokerSymbol,
    observedMarketTime,
    providerObservedMarketTime: normalizedTimestamp.providerTime,
    offsetAppliedMinutes: normalizedTimestamp.offsetAppliedMinutes,
    bid,
    ask,
    mid,
    spread: finiteNumber(payload?.spread),
    receivedAt
  };
}

export function normalizeRuntimeCandleResponse(
  payload,
  receivedAt = new Date().toISOString(),
  timeContract
) {
  const requestedSymbol = String(payload?.requestedSymbol ?? "MNQ");
  const brokerSymbol = String(payload?.brokerSymbol ?? payload?.symbol ?? "USTECH");
  const timeframe = normalizeRuntimeTimeframe(payload?.timeframe ?? payload?.requestedTimeframe);
  const durationMs = runtimeTimeframeMilliseconds(timeframe);
  if (!durationMs) {
    return {
      requestedSymbol,
      brokerSymbol,
      timeframe,
      candles: [],
      blockers: ["unsupported_timeframe"]
    };
  }
  const normalizationBlockers = new Set();
  const candles = (Array.isArray(payload?.candles) ? payload.candles : [])
    .map((candle) => {
      const normalizedTimestamp = normalizeRuntimeProviderTimestamp(
        candle?.timestamp ?? candle?.time ?? candle?.rawTime,
        timeContract
      );
      if (normalizedTimestamp.blocker) {
        normalizationBlockers.add(normalizedTimestamp.blocker);
      }
      const candleOpenTime = normalizedTimestamp.normalizedTimeUtc;
      const open = finiteNumber(candle?.open);
      const high = finiteNumber(candle?.high);
      const low = finiteNumber(candle?.low);
      const close = finiteNumber(candle?.close);
      if (
        !candleOpenTime ||
        open === undefined ||
        high === undefined ||
        low === undefined ||
        close === undefined ||
        high < Math.max(open, close) ||
        low > Math.min(open, close)
      ) {
        return undefined;
      }
      return {
        candleOpenTime,
        candleCloseTime: new Date(Date.parse(candleOpenTime) + durationMs).toISOString(),
        providerCandleOpenTime: normalizedTimestamp.providerTime,
        providerCandleCloseTime: normalizedTimestamp.providerTime
          ? new Date(
              Date.parse(normalizedTimestamp.providerTime) + durationMs
            ).toISOString()
          : undefined,
        offsetAppliedMinutes: normalizedTimestamp.offsetAppliedMinutes,
        open,
        high,
        low,
        close,
        volume: finiteNumber(candle?.volume),
        tickVolume: finiteNumber(candle?.tickVolume),
        spread: finiteNumber(candle?.spread),
        receivedAt
      };
    })
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.candleOpenTime) - Date.parse(right.candleOpenTime));
  return {
    requestedSymbol,
    brokerSymbol,
    timeframe,
    candles,
    blockers: [
      ...normalizationBlockers,
      ...(candles.length ? [] : ["candle_data_unavailable"])
    ]
  };
}

const boundedUnique = (values, maximum) =>
  [...new Set(values.filter(Boolean))].slice(-Math.max(1, maximum));

const seriesKeyFor = ({ requestedSymbol, brokerSymbol, timeframe }) =>
  `${requestedSymbol}:${brokerSymbol}:${normalizeRuntimeTimeframe(timeframe)}`;

const eventBase = ({
  eventId,
  type,
  sourceIdentity,
  requestedSymbol,
  brokerSymbol,
  timeframe,
  observedMarketTime,
  receivedAt,
  timeContractVersion,
  timeVerificationArtifactId
}) => ({
  eventId,
  eventVersion: RUNTIME_MARKET_EVENT_VERSION,
  type,
  sourceProvider: "mt5_read_only",
  sourceIdentity,
  requestedSymbol,
  brokerSymbol,
  ...(timeframe ? { timeframe } : {}),
  observedMarketTime,
  receivedAt,
  sourceFingerprint: sourceIdentity,
  timeContractVersion,
  ...(timeVerificationArtifactId ? { timeVerificationArtifactId } : {}),
  ...continuousFeedCapability,
  ...continuousFeedAuthority
});

export function createContinuousFeedEngine({
  capacities = defaultRollingStoreCapacities,
  checkpoint,
  knownEvents = [],
  maximumCloseEventIds = 5_000,
  maximumCatchUpCandles = 24,
  closeFinalizationDelayMs = 15_000,
  requireVerificationArtifact = false,
  requireWatcherArtifact = false
} = {}) {
  const boundedCloseFinalizationDelayMs = Math.min(
    60_000,
    Math.max(0, Number(closeFinalizationDelayMs) || 0)
  );
  const stores = new Map();
  const formingHashes = new Map();
  const knownEventIds = new Set([
    ...(checkpoint?.emittedCloseEventIds ?? []),
    ...knownEvents
      .filter((event) => event?.type === "candle_closed")
      .map((event) => event.eventId)
  ]);
  const closedPayloadHashes = new Map(
    Object.entries(checkpoint?.closedPayloadHashesByIdentity ?? {})
  );
  const conflictingIdentities = new Set(checkpoint?.conflictingCandleIdentities ?? []);
  const rejectedCloseIdentities = new Set(
    checkpoint?.rejectedCloseIdentities ?? []
  );
  const establishedSeries = new Set(checkpoint?.establishedSeries ?? []);
  const lastClosedBySeries = new Map(
    Object.entries(checkpoint?.lastClosedBySeries ?? {})
  );
  let quote;
  let lastEligibility = checkpoint?.lastTimeContractEligible === true;
  let timeContractStateObserved = checkpoint?.timeContractStateObserved === true;
  let stale = checkpoint?.feedStale === true;
  let emittedCloseEventCount = Number(checkpoint?.emittedCloseEventCount ?? 0);
  let duplicateCloseEventCount = Number(checkpoint?.duplicateCloseEventCount ?? 0);
  let conflictingCandleCount = Number(checkpoint?.conflictingCandleCount ?? 0);
  let recoveredEventCount = Number(checkpoint?.recoveredEventCount ?? 0);
  let quoteUpdateCount = Number(checkpoint?.quoteUpdateCount ?? 0);
  let formingCandleUpdateCount = Number(
    checkpoint?.formingCandleUpdateCount ?? 0
  );
  let rejectedCloseEventCount = Number(
    checkpoint?.rejectedCloseEventCount ?? 0
  );
  let renewalHandoffRetentionCount = Number(
    checkpoint?.renewalHandoffRetentionCount ?? 0
  );
  let lastRejectedClose;
  let lastFormingCandleUpdate;
  let lastClosedCandleEvent;
  let latestTimeContract = evaluateRuntimeTimeContract(undefined, {
    requireVerificationArtifact,
    requireWatcherArtifact
  });
  const blockers = new Set();
  const warnings = new Set();
  const transportWarnings = new Set();
  let priorTimeContractBlockers = new Set();

  const status = () => ({
    serviceVersion: CONTINUOUS_FEED_SERVICE_VERSION,
    state: stale
      ? "stale"
      : latestTimeContract.pausedForMarketClosed
        ? "paused_market_closed"
      : latestTimeContract.pausedForTerminalDisconnected
        ? "paused_terminal_disconnected"
      : blockers.size
        ? "blocked"
        : latestTimeContract.eligible
          ? "healthy"
          : "degraded",
    activeSymbols: boundedUnique(
      [...stores.keys()].map((key) => key.split(":")[1]),
      32
    ),
    activeTimeframes: boundedUnique(
      [...stores.keys()].map((key) => key.split(":")[2]),
      32
    ),
    lastQuoteTime: quote?.observedMarketTime,
    lastFormingCandleUpdate,
    lastClosedCandleEvent,
    rollingStoreCounts: Object.fromEntries(
      [...stores.entries()].map(([key, candles]) => [key, candles.length])
    ),
    emittedCloseEventCount,
    duplicateCloseEventCount,
    conflictingCandleCount,
    recoveredEventCount,
    quoteUpdateCount,
    formingCandleUpdateCount,
    rejectedCloseEventCount,
    renewalHandoffRetentionCount,
    closeFinalizationDelayMs: boundedCloseFinalizationDelayMs,
    renewalHandoffRetained:
      latestTimeContract.retainedDuringRenewalHandoff === true,
    lastRejectedClose,
    timeContractEligible: latestTimeContract.eligible,
    marketState: latestTimeContract.marketState,
    operationalMarketState: latestTimeContract.operationalMarketState,
    proofPausedForMarketClosed:
      latestTimeContract.pausedForMarketClosed === true,
    proofPausedForTerminalDisconnected:
      latestTimeContract.pausedForTerminalDisconnected === true,
    timeContractVersion: latestTimeContract.version,
    timeIdentityVersion:
      latestTimeContract.identityVersion ?? latestTimeContract.version,
    verificationArtifactRequired: requireVerificationArtifact,
    watcherArtifactRequired: requireWatcherArtifact,
    verificationArtifactId: latestTimeContract.artifactId,
    contractVerificationArtifactId: latestTimeContract.contractArtifactId,
    verificationScope: latestTimeContract.verificationScope,
    verificationGeneratedAtUtc: latestTimeContract.generatedAtUtc,
    verificationExpiresAtUtc: latestTimeContract.expiresAtUtc,
    verificationProofState: latestTimeContract.proofState,
    verificationProofAgeSeconds: latestTimeContract.proofAgeSeconds,
    providerTimeBasis: latestTimeContract.providerTimeBasis,
    observedOffsetMinutes: latestTimeContract.observedOffsetMinutes,
    terminalClockClassificationVersion:
      latestTimeContract.terminalClockClassificationVersion,
    offsetRegimeStartUtc: latestTimeContract.continuityStartedAtUtc,
    blockers: [...blockers],
    warnings: [...new Set([...warnings, ...(latestTimeContract.warnings ?? [])])],
    ...continuousFeedCapability,
    ...continuousFeedAuthority
  });

  const checkpointSnapshot = () => ({
    version: 1,
    establishedSeries: [...establishedSeries],
    lastClosedBySeries: Object.fromEntries(lastClosedBySeries),
    emittedCloseEventIds: boundedUnique([...knownEventIds], maximumCloseEventIds),
    closedPayloadHashesByIdentity: Object.fromEntries(
      [...closedPayloadHashes.entries()].slice(-maximumCloseEventIds)
    ),
    conflictingCandleIdentities: boundedUnique(
      [...conflictingIdentities],
      maximumCloseEventIds
    ),
    rejectedCloseIdentities: boundedUnique(
      [...rejectedCloseIdentities],
      maximumCloseEventIds
    ),
    lastTimeContractEligible: latestTimeContract.eligible,
    lastTimeVerificationArtifactId: latestTimeContract.artifactId,
    timeContractStateObserved,
    feedStale: stale,
    emittedCloseEventCount,
    duplicateCloseEventCount,
    conflictingCandleCount,
    recoveredEventCount,
    quoteUpdateCount,
    formingCandleUpdateCount,
    rejectedCloseEventCount,
    renewalHandoffRetentionCount,
    checkpointedAt: new Date().toISOString(),
    ...continuousFeedAuthority
  });

  const createStateEvent = ({
    type,
    reason,
    receivedAt,
    sourceIdentity,
    requestedSymbol = "MNQ",
    brokerSymbol = "USTECH",
    timeframe
  }) => {
    const observedMarketTime = quote?.observedMarketTime ?? receivedAt;
    const eventId = `runtime_${type}_${stableHash({
      type,
      reason,
      sourceIdentity,
      requestedSymbol,
      brokerSymbol,
      timeframe,
      eligibility: latestTimeContract.eligible
    })}`;
    return {
      ...eventBase({
        eventId,
        type,
        sourceIdentity,
        requestedSymbol,
        brokerSymbol,
        timeframe,
        observedMarketTime,
        receivedAt,
        timeContractVersion: latestTimeContract.version,
        timeVerificationArtifactId: latestTimeContract.artifactId
      }),
      reason
    };
  };

  const processPoll = ({
    quotePayload,
    candlePayloads = [],
    timeContract,
    verificationArtifact,
    verifierStatus,
    receivedAt = new Date().toISOString()
  }) => {
    const eligibilityBeforePoll = latestTimeContract.eligible;
    const evaluatedTimeContract = evaluateRuntimeTimeContract(timeContract, {
      requireVerificationArtifact,
      requireWatcherArtifact,
      verificationArtifact,
      verifierStatus,
      nowUtc: receivedAt
    });
    const retainedTimeContract =
      retainFreshRuntimeTimeContractDuringRenewal({
        previous: latestTimeContract,
        candidate: evaluatedTimeContract,
        verificationArtifact,
        verifierStatus,
        nowUtc: receivedAt
      });
    latestTimeContract = retainedTimeContract ?? evaluatedTimeContract;
    if (retainedTimeContract) renewalHandoffRetentionCount += 1;
    for (const blocker of priorTimeContractBlockers) blockers.delete(blocker);
    priorTimeContractBlockers = new Set(latestTimeContract.blockers);
    const eligibilityRecoveredThisPoll =
      latestTimeContract.eligible &&
      timeContractStateObserved &&
      !eligibilityBeforePoll;
    const events = [];
    const nextQuote = normalizeRuntimeQuote(
      quotePayload,
      receivedAt,
      latestTimeContract
    );
    const quoteChanged =
      !quote ||
      quote.observedMarketTime !== nextQuote.observedMarketTime ||
      quote.bid !== nextQuote.bid ||
      quote.ask !== nextQuote.ask;
    quote = nextQuote;
    const quoteSourceIdentity = buildRuntimeSourceIdentity({
      requestedSymbol: quote.requestedSymbol,
      brokerSymbol: quote.brokerSymbol,
      timeContractVersion:
        latestTimeContract.identityVersion ?? latestTimeContract.version
    });
    if (quoteChanged) {
      quoteUpdateCount += 1;
      events.push({
        ...eventBase({
          eventId: `runtime_quote_${stableHash({
            sourceIdentity: quoteSourceIdentity,
            observedMarketTime: quote.observedMarketTime,
            bid: quote.bid,
            ask: quote.ask
          })}`,
          type: "quote_updated",
          sourceIdentity: quoteSourceIdentity,
          requestedSymbol: quote.requestedSymbol,
          brokerSymbol: quote.brokerSymbol,
          observedMarketTime: quote.observedMarketTime,
          receivedAt,
          timeContractVersion: latestTimeContract.version,
          timeVerificationArtifactId: latestTimeContract.artifactId
        }),
        bid: quote.bid,
        ask: quote.ask,
        mid: quote.mid
      });
    }

    if (!latestTimeContract.eligible) {
      if (latestTimeContract.pausedForMarketClosed) {
        warnings.add("market_closed_verified_pause");
        warnings.delete(
          "closed_candle_events_paused_until_time_contract_is_verified"
        );
        warnings.delete("terminal_disconnected_fail_closed_pause");
      } else if (latestTimeContract.pausedForTerminalDisconnected) {
        warnings.add("terminal_disconnected_fail_closed_pause");
        warnings.delete(
          "closed_candle_events_paused_until_time_contract_is_verified"
        );
        warnings.delete("market_closed_verified_pause");
      } else {
        for (const blocker of latestTimeContract.blockers) blockers.add(blocker);
        warnings.add("closed_candle_events_paused_until_time_contract_is_verified");
        if (!timeContractStateObserved || lastEligibility) {
          events.push(
            createStateEvent({
              type: "source_blocked",
              reason: latestTimeContract.blockers.join(","),
              receivedAt,
              sourceIdentity: quoteSourceIdentity
            })
          );
        }
      }
    } else {
      for (const blocker of latestTimeContract.blockers) blockers.delete(blocker);
      blockers.delete("current_live_time_basis_not_verified");
      blockers.delete("terminal_time_evidence_stale");
      warnings.delete("closed_candle_events_paused_until_time_contract_is_verified");
      warnings.delete("market_closed_verified_pause");
      warnings.delete("terminal_disconnected_fail_closed_pause");
      if (!lastEligibility) {
        recoveredEventCount += 1;
        events.push(
          createStateEvent({
            type: "feed_recovered",
            reason: "current_live_time_contract_verified",
            receivedAt,
            sourceIdentity: quoteSourceIdentity
          })
        );
      }
    }
    lastEligibility = latestTimeContract.eligible;
    timeContractStateObserved = true;

    let candleDataUnavailable = false;
    for (const payload of candlePayloads) {
      const normalized = normalizeRuntimeCandleResponse(
        payload,
        receivedAt,
        latestTimeContract
      );
      if (!normalized.timeframe || normalized.blockers.length) {
        candleDataUnavailable = true;
        for (const blocker of normalized.blockers) {
          if (blocker !== "candle_data_unavailable") blockers.add(blocker);
        }
        continue;
      }
      const key = seriesKeyFor(normalized);
      const capacity = Number(capacities[normalized.timeframe] ?? 500);
      const existing = stores.get(key) ?? [];
      const mergedByOpenTime = new Map(
        [...existing, ...normalized.candles].map((candle) => [
          candle.candleOpenTime,
          candle
        ])
      );
      const merged = [...mergedByOpenTime.values()]
        .sort((left, right) => Date.parse(left.candleOpenTime) - Date.parse(right.candleOpenTime))
        .slice(-Math.max(1, capacity));
      stores.set(key, merged);

      const sourceIdentity = buildRuntimeSourceIdentity({
        requestedSymbol: normalized.requestedSymbol,
        brokerSymbol: normalized.brokerSymbol,
        timeframe: normalized.timeframe,
        timeContractVersion:
          latestTimeContract.identityVersion ?? latestTimeContract.version
      });
      const marketReferenceMs = Date.parse(quote.observedMarketTime);
      const finalizedMarketReferenceMs =
        marketReferenceMs - boundedCloseFinalizationDelayMs;
      const eligibleByMarketTime = merged.filter(
        (candle) =>
          Date.parse(candle.candleCloseTime) <= finalizedMarketReferenceMs &&
          Date.parse(candle.candleOpenTime) <= marketReferenceMs
      );
      const closed = latestTimeContract.eligible
        ? eligibleByMarketTime
        : [];
      if (
        !latestTimeContract.eligible &&
        !latestTimeContract.pausedForMarketClosed &&
        !latestTimeContract.pausedForTerminalDisconnected
      ) {
        for (const candle of eligibleByMarketTime.slice(-maximumCatchUpCandles)) {
          const rejectedIdentity = `${key}:${candle.candleOpenTime}`;
          if (rejectedCloseIdentities.has(rejectedIdentity)) continue;
          rejectedCloseIdentities.add(rejectedIdentity);
          rejectedCloseEventCount += 1;
          lastRejectedClose = {
            candleOpenTime: candle.candleOpenTime,
            candleCloseTime: candle.candleCloseTime,
            timeframe: normalized.timeframe,
            reason: latestTimeContract.blockers.join(",")
          };
        }
      }
      const conflictEvents = [];
      for (const candle of closed) {
        const candleIdentity = buildRuntimeCandleIdentity({
          sourceIdentity,
          requestedSymbol: normalized.requestedSymbol,
          brokerSymbol: normalized.brokerSymbol,
          timeframe: normalized.timeframe,
          candleOpenTime: candle.candleOpenTime,
          candleCloseTime: candle.candleCloseTime
        });
        const payloadHash = buildRuntimeCandlePayloadHash(candle);
        const existingHash = closedPayloadHashes.get(candleIdentity);
        if (
          existingHash &&
          existingHash !== payloadHash &&
          !conflictingIdentities.has(candleIdentity)
        ) {
          conflictingIdentities.add(candleIdentity);
          conflictingCandleCount += 1;
          blockers.add("conflicting_closed_candle");
          conflictEvents.push(
            createStateEvent({
              type: "source_blocked",
              reason: "conflicting_closed_candle",
              receivedAt,
              sourceIdentity,
              requestedSymbol: normalized.requestedSymbol,
              brokerSymbol: normalized.brokerSymbol,
              timeframe: normalized.timeframe
            })
          );
        }
      }
      events.push(...conflictEvents);
      const forming = merged.find(
        (candle) => Date.parse(candle.candleCloseTime) > marketReferenceMs
      );

      if (forming) {
        const payloadHash = buildRuntimeCandlePayloadHash(forming);
        if (formingHashes.get(key) !== payloadHash) {
          formingCandleUpdateCount += 1;
          formingHashes.set(key, payloadHash);
          lastFormingCandleUpdate = receivedAt;
          events.push({
            ...eventBase({
              eventId: `runtime_forming_${stableHash({
                sourceIdentity,
                candleOpenTime: forming.candleOpenTime,
                payloadHash
              })}`,
              type: "forming_candle_updated",
              sourceIdentity,
              requestedSymbol: normalized.requestedSymbol,
              brokerSymbol: normalized.brokerSymbol,
              timeframe: normalized.timeframe,
              observedMarketTime: quote.observedMarketTime,
              receivedAt,
              timeContractVersion: latestTimeContract.version,
              timeVerificationArtifactId: latestTimeContract.artifactId
            }),
            candleOpenTime: forming.candleOpenTime,
            candleCloseTime: forming.candleCloseTime,
            payloadHash
          });
        }
      }

      if (!latestTimeContract.eligible || !closed.length) continue;

      if (!establishedSeries.has(key) || eligibilityRecoveredThisPoll) {
        const baseline = closed.at(-1);
        establishedSeries.add(key);
        lastClosedBySeries.set(key, baseline.candleOpenTime);
        for (const candle of closed.slice(-maximumCatchUpCandles)) {
          const candleIdentity = buildRuntimeCandleIdentity({
            sourceIdentity,
            requestedSymbol: normalized.requestedSymbol,
            brokerSymbol: normalized.brokerSymbol,
            timeframe: normalized.timeframe,
            candleOpenTime: candle.candleOpenTime,
            candleCloseTime: candle.candleCloseTime
          });
          closedPayloadHashes.set(
            candleIdentity,
            buildRuntimeCandlePayloadHash(candle)
          );
        }
        continue;
      }

      const previousOpenTime = lastClosedBySeries.get(key);
      const candidates = closed
        .filter(
          (candle) =>
            !previousOpenTime ||
            Date.parse(candle.candleOpenTime) > Date.parse(previousOpenTime)
        )
        .slice(-maximumCatchUpCandles);
      for (const candle of candidates) {
        const candleIdentity = buildRuntimeCandleIdentity({
          sourceIdentity,
          requestedSymbol: normalized.requestedSymbol,
          brokerSymbol: normalized.brokerSymbol,
          timeframe: normalized.timeframe,
          candleOpenTime: candle.candleOpenTime,
          candleCloseTime: candle.candleCloseTime
        });
        const payloadHash = buildRuntimeCandlePayloadHash(candle);
        if (conflictingIdentities.has(candleIdentity)) continue;
        const existingHash = closedPayloadHashes.get(candleIdentity);
        if (existingHash && existingHash !== payloadHash) {
          conflictingCandleCount += 1;
          blockers.add("conflicting_closed_candle");
          events.push(
            createStateEvent({
              type: "source_blocked",
              reason: "conflicting_closed_candle",
              receivedAt,
              sourceIdentity,
              requestedSymbol: normalized.requestedSymbol,
              brokerSymbol: normalized.brokerSymbol,
              timeframe: normalized.timeframe
            })
          );
          continue;
        }
        closedPayloadHashes.set(candleIdentity, payloadHash);
        const eventId = `runtime_close_${stableHash({ candleIdentity })}`;
        if (knownEventIds.has(eventId)) {
          duplicateCloseEventCount += 1;
          continue;
        }
        knownEventIds.add(eventId);
        emittedCloseEventCount += 1;
        lastClosedCandleEvent = receivedAt;
        events.push({
          ...eventBase({
            eventId,
            type: "candle_closed",
            sourceIdentity,
            requestedSymbol: normalized.requestedSymbol,
            brokerSymbol: normalized.brokerSymbol,
            timeframe: normalized.timeframe,
            observedMarketTime: candle.candleCloseTime,
            receivedAt,
            timeContractVersion: latestTimeContract.version,
            timeVerificationArtifactId: latestTimeContract.artifactId
          }),
          candleOpenTime: candle.candleOpenTime,
          candleCloseTime: candle.candleCloseTime,
          candleIdentity,
          payloadHash
        });
        lastClosedBySeries.set(key, candle.candleOpenTime);
      }
    }
    if (candlePayloads.length) {
      if (candleDataUnavailable) blockers.add("candle_data_unavailable");
      else blockers.delete("candle_data_unavailable");
    }

    if (stale && latestTimeContract.eligible) {
      stale = false;
      for (const warning of transportWarnings) {
        warnings.delete(warning);
      }
      transportWarnings.clear();
      recoveredEventCount += 1;
      events.push(
        createStateEvent({
          type: "feed_recovered",
          reason: "market_data_transport_recovered",
          receivedAt,
          sourceIdentity: quoteSourceIdentity
        })
      );
    }
    return {
      events,
      status: status(),
      checkpoint: checkpointSnapshot()
    };
  };

  const markFeedStale = ({
    reason = "market_data_transport_stale",
    receivedAt = new Date().toISOString()
  } = {}) => {
    stale = true;
    warnings.add(reason);
    transportWarnings.add(reason);
    const sourceIdentity = buildRuntimeSourceIdentity({
      requestedSymbol: quote?.requestedSymbol ?? "MNQ",
      brokerSymbol: quote?.brokerSymbol ?? "USTECH",
      timeContractVersion:
        latestTimeContract.identityVersion ?? latestTimeContract.version
    });
    const event = createStateEvent({
      type: "feed_stale",
      reason,
      receivedAt,
      sourceIdentity,
      requestedSymbol: quote?.requestedSymbol,
      brokerSymbol: quote?.brokerSymbol
    });
    return {
      events: [event],
      status: status(),
      checkpoint: checkpointSnapshot()
    };
  };

  return {
    processPoll,
    markFeedStale,
    status,
    checkpoint: checkpointSnapshot,
    rollingStoreSnapshot() {
      return Object.freeze(
        Object.fromEntries(
          [...stores.entries()].map(([key, candles]) => [
            key,
            Object.freeze(candles.map((candle) => Object.freeze({ ...candle })))
          ])
        )
      );
    }
  };
}

export function compactDurableMarketEvent(event) {
  const {
    bid: _bid,
    ask: _ask,
    mid: _mid,
    ...compact
  } = event;
  return compact;
}

export function selectRuntimeContextWindows({
  snapshot,
  requestedSymbol,
  brokerSymbol,
  timeframes,
  asOf,
  continuityStartedAtUtc,
  hydrationArtifact,
  limit = 300
}) {
  const asOfMs = Date.parse(String(asOf ?? ""));
  const continuityStartMs = Date.parse(
    String(continuityStartedAtUtc ?? "")
  );
  const boundedLimit = Math.min(500, Math.max(3, Number(limit ?? 300)));
  return Object.fromEntries(
    timeframes.map((timeframeValue) => {
      const timeframe = normalizeRuntimeTimeframe(timeframeValue);
      const key = `${requestedSymbol}:${brokerSymbol}:${timeframe}`;
      const hydratedTimeframeReady =
        hydrationArtifact?.status === "ready" &&
        hydrationArtifact?.boundedHistoricalContextEligible === true &&
        hydrationArtifact?.timeframeSummaries?.some(
          (summary) => summary.timeframe === timeframe && summary.ready
        );
      const candles = (snapshot?.[key] ?? [])
        .filter(
          (candle) =>
            Number.isFinite(asOfMs) &&
            Date.parse(candle.candleCloseTime) <= asOfMs
        )
        .filter(
          (candle) =>
            hydratedTimeframeReady ||
            !Number.isFinite(continuityStartMs) ||
            Date.parse(candle.candleOpenTime) >= continuityStartMs
        )
        .slice(-boundedLimit)
        .map((candle) => ({
          candleOpenTime: candle.candleOpenTime,
          candleCloseTime: candle.candleCloseTime,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          tickVolume: candle.tickVolume,
          spread: candle.spread
        }));
      return [timeframe, candles];
    })
  );
}
