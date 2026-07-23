import {
  assertCompactTimeVerificationArtifact,
  canonicalHash,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";

export const TIME_VERIFIER_WATCH_SERVICE_VERSION =
  "gotrader-current-live-time-verifier-v1";
export const TIME_VERIFIER_WATCH_STATE_VERSION = 1;
export const TIME_VERIFIER_MAX_CONTINUITY_GAP_MS = 180_000;

const unique = (values) => [...new Set(values.filter(Boolean))];

export const emptyTimeVerifierWatchState = () => ({
  version: TIME_VERIFIER_WATCH_STATE_VERSION,
  renewalCount: 0,
  failureCount: 0,
  duplicateObservationCount: 0,
  conflictCount: 0,
  continuityResetCount: 0,
  probeArtifactIds: {},
  rawProbePersisted: false,
  rawCandlesPersisted: false,
  ...currentLiveVerificationAuthority
});

const continuityKeyFor = (artifact) =>
  canonicalHash({
    requestedSymbol: artifact?.requestedSymbol,
    brokerSymbol: artifact?.brokerSymbol,
    probeInstanceFingerprint: artifact?.probeInstanceFingerprint,
    providerTimeBasis: artifact?.providerTimeBasis,
    observedOffsetMinutes: artifact?.observedOffsetMinutes,
    terminalClockClassificationVersion:
      artifact?.terminalClockClassificationVersion
  });

const hardBlocker = (blocker) =>
  /disconnected|stopped|malformed|conflict|mismatch|future|invalid|symbol|instance|authority/i.test(
    String(blocker)
  );

export function createTimeVerifierWatchEngine({
  state: savedState,
  maximumContinuityGapMs = TIME_VERIFIER_MAX_CONTINUITY_GAP_MS
} = {}) {
  let state = {
    ...emptyTimeVerifierWatchState(),
    ...(savedState && typeof savedState === "object" ? savedState : {}),
    probeArtifactIds:
      savedState?.probeArtifactIds &&
      typeof savedState.probeArtifactIds === "object"
        ? { ...savedState.probeArtifactIds }
        : {}
  };

  const status = ({ nowUtc = new Date().toISOString() } = {}) => {
    const activeGeneratedMs = Date.parse(
      state.activeArtifact?.generatedAtUtc ?? ""
    );
    const nowMs = Date.parse(nowUtc);
    const ageSeconds =
      Number.isFinite(activeGeneratedMs) && Number.isFinite(nowMs)
        ? Math.max(0, Math.round((nowMs - activeGeneratedMs) / 1_000))
        : undefined;
    const proofState =
      ageSeconds === undefined
        ? "missing"
        : ageSeconds <= 120
          ? "fresh"
          : ageSeconds <= 180
            ? "expiring"
            : "stale";
    return {
      serviceVersion: TIME_VERIFIER_WATCH_SERVICE_VERSION,
      state:
        state.paused === true
          ? "paused"
          : state.activeArtifact?.validationStatus === "accepted" &&
              proofState === "fresh"
            ? "healthy"
            : "degraded",
      probeState: state.lastProbeState ?? "missing",
      probeArtifactId: state.lastProbeArtifactId,
      probeGeneratedAtUtc: state.lastProbeGeneratedAtUtc,
      probeAgeSeconds: ageSeconds,
      terminalInstanceFingerprint: state.lastProbeInstanceFingerprint,
      verificationArtifactId: state.activeArtifact?.artifactId,
      verificationGeneratedAtUtc: state.activeArtifact?.generatedAtUtc,
      verificationExpiresAtUtc: state.activeArtifact?.expiresAtUtc,
      verificationProofState: proofState,
      verificationRenewalCount: state.renewalCount,
      verificationFailureCount: state.failureCount,
      duplicateObservationCount: state.duplicateObservationCount,
      conflictCount: state.conflictCount,
      continuityStartedAtUtc: state.continuityStartedAtUtc,
      continuityResetCount: state.continuityResetCount,
      lastRenewalResult: state.lastRenewalResult,
      providerTimeBasis: state.activeArtifact?.providerTimeBasis,
      observedOffsetMinutes: state.activeArtifact?.observedOffsetMinutes,
      currentLiveEligible:
        state.activeArtifact?.validationStatus === "accepted" &&
        proofState === "fresh",
      historicalEligible: false,
      blockers: unique([
        ...(state.lastRenewalResult?.blockers ?? []),
        ...(proofState !== "fresh" ? [`current_live_proof_${proofState}`] : [])
      ]),
      rawProbePersisted: false,
      rawCandlesPersisted: false,
      productionAdoptionAllowed: false,
      ...currentLiveVerificationAuthority
    };
  };

  const processEvidence = ({
    artifact,
    directProbe,
    nowUtc = new Date().toISOString()
  }) => {
    const probeId = directProbe?.observationId;
    const probeFingerprint = directProbe?.contentFingerprint;
    const probeGeneratedAtUtc = directProbe?.terminalProbeCapturedAt;
    const blockers = [...(artifact?.blockers ?? [])];
    state.lastProbeState =
      directProbe?.probeState ??
      (directProbe?.status === "complete" ? "fresh" : "invalid");
    state.lastProbeGeneratedAtUtc = probeGeneratedAtUtc;
    state.lastProbeInstanceFingerprint = directProbe?.probeInstanceId;

    if (probeId) {
      const priorFingerprint = state.probeArtifactIds[probeId];
      if (priorFingerprint && priorFingerprint !== probeFingerprint) {
        blockers.push("terminal_observation_conflicting_duplicate");
        state.conflictCount += 1;
      } else if (priorFingerprint === probeFingerprint) {
        state.duplicateObservationCount += 1;
        state.lastRenewalResult = {
          status: "no_change",
          observedAt: nowUtc,
          probeObservationId: probeId,
          blockers: []
        };
        return {
          action: "no_change",
          persistArtifact: false,
          state: { ...state },
          status: status({ nowUtc })
        };
      }
    }

    const priorGeneratedMs = Date.parse(state.lastAcceptedProbeGeneratedAtUtc ?? "");
    const nextGeneratedMs = Date.parse(probeGeneratedAtUtc ?? "");
    if (
      state.lastAcceptedProbeObservationId &&
      Number.isFinite(priorGeneratedMs) &&
      (!Number.isFinite(nextGeneratedMs) || nextGeneratedMs <= priorGeneratedMs)
    ) {
      blockers.push("terminal_observation_out_of_order");
    }

    const compactValidation = assertCompactTimeVerificationArtifact(artifact);
    blockers.push(...compactValidation.errors);
    const accepted =
      artifact?.validationStatus === "accepted" && blockers.length === 0;
    if (!accepted) {
      state.failureCount += 1;
      const hardFailure = blockers.some(hardBlocker);
      const blockedArtifact = hardFailure
        ? {
            ...artifact,
            validationStatus: "blocked",
            currentLiveTimeBasisVerified: false,
            blockers: unique(blockers),
            historicalDstPolicyVerified: false,
            rawProbePersisted: false,
            rawCandlesPersisted: false,
            productionAdoptionAllowed: false,
            authority: currentLiveVerificationAuthority
          }
        : undefined;
      if (blockedArtifact) {
        blockedArtifact.artifactId = canonicalHash({
          ...blockedArtifact,
          artifactId: undefined
        });
        state.activeArtifact = blockedArtifact;
      }
      state.lastRenewalResult = {
        status: hardFailure ? "blocked" : "failed_preserving_active_proof",
        observedAt: nowUtc,
        probeObservationId: probeId,
        blockers: unique(blockers)
      };
      return {
        action: hardFailure ? "blocked" : "preserved",
        persistArtifact: hardFailure,
        artifact: blockedArtifact,
        state: { ...state },
        status: status({ nowUtc })
      };
    }

    const continuityKey = continuityKeyFor(artifact);
    const sameContinuity = state.continuityKey === continuityKey;
    const gapMs =
      Number.isFinite(priorGeneratedMs) && Number.isFinite(nextGeneratedMs)
        ? nextGeneratedMs - priorGeneratedMs
        : Number.POSITIVE_INFINITY;
    const continuityStartedAtUtc =
      sameContinuity && gapMs <= maximumContinuityGapMs
        ? state.continuityStartedAtUtc
        : artifact.generatedAtUtc;
    if (state.continuityKey && continuityStartedAtUtc !== state.continuityStartedAtUtc) {
      state.continuityResetCount += 1;
    }
    const renewalSequence = Number(state.renewalCount ?? 0) + 1;
    const renewedCore = {
      ...artifact,
      continuityStartedAtUtc,
      renewalSequence
    };
    const renewedArtifact = {
      ...renewedCore,
      artifactId: canonicalHash({
        ...renewedCore,
        artifactId: undefined
      })
    };
    state.renewalCount = renewalSequence;
    state.continuityKey = continuityKey;
    state.continuityStartedAtUtc = continuityStartedAtUtc;
    state.lastAcceptedProbeObservationId = probeId;
    state.lastAcceptedProbeGeneratedAtUtc = probeGeneratedAtUtc;
    state.lastProbeArtifactId = probeFingerprint;
    state.probeArtifactIds[probeId] = probeFingerprint;
    if (Object.keys(state.probeArtifactIds).length > 1_000) {
      state.probeArtifactIds = Object.fromEntries(
        Object.entries(state.probeArtifactIds).slice(-500)
      );
    }
    state.activeArtifact = renewedArtifact;
    state.lastRenewalResult = {
      status: "renewed",
      observedAt: nowUtc,
      probeObservationId: probeId,
      verificationArtifactId: renewedArtifact.artifactId,
      blockers: []
    };
    return {
      action: "renewed",
      persistArtifact: true,
      artifact: renewedArtifact,
      state: { ...state },
      status: status({ nowUtc })
    };
  };

  const setPaused = (paused) => {
    state.paused = paused === true;
    return { ...state };
  };

  const recordFailure = ({
    blockers = ["current_live_time_verifier_poll_failed"],
    nowUtc = new Date().toISOString()
  } = {}) => {
    state.failureCount = Number(state.failureCount ?? 0) + 1;
    state.lastRenewalResult = {
      status: "failed_preserving_active_proof",
      observedAt: nowUtc,
      blockers: unique(blockers.map(String))
    };
    return {
      action: "preserved",
      persistArtifact: false,
      state: { ...state },
      status: status({ nowUtc })
    };
  };

  return Object.freeze({
    processEvidence,
    recordFailure,
    setPaused,
    status,
    snapshot: () => ({ ...state })
  });
}
