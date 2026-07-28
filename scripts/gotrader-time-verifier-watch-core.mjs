import {
  assertCompactTimeVerificationArtifact,
  canonicalHash,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";

export const TIME_VERIFIER_WATCH_SERVICE_VERSION =
  "gotrader-current-live-time-verifier-v1";
export const TIME_VERIFIER_WATCH_STATE_VERSION = 1;
export const TIME_VERIFIER_MAX_CONTINUITY_GAP_MS = 180_000;
export const TIME_VERIFIER_RESUME_GRACE_MS = 120_000;

const unique = (values) => [...new Set(values.filter(Boolean))];
const isoAfter = (value, milliseconds) => {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed)
    ? new Date(parsed + milliseconds).toISOString()
    : undefined;
};

export const emptyTimeVerifierWatchState = () => ({
  version: TIME_VERIFIER_WATCH_STATE_VERSION,
  renewalCount: 0,
  failureCount: 0,
  marketClosedPauseCount: 0,
  marketResumeCount: 0,
  marketStateTransitionCount: 0,
  duplicateObservationCount: 0,
  conflictCount: 0,
  continuityResetCount: 0,
  transientCorrelationPreservationCount: 0,
  resumePendingAttemptCount: 0,
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

const requiresImmediateProofRevocation = (blocker) =>
  /terminal_observation_conflicting_duplicate|direct_terminal_probe_.*(?:disconnected|stopped|malformed|future|symbol_mismatch|instance_mismatch|authority|forbidden|version_invalid|mode_invalid|path_outside)|authority_not_none|raw_payload_persistence_not_false/i.test(
    String(blocker)
  );

const expectedResumeContractBlockerPattern =
  /^(?:upstream_bridge_.+_mismatch|direct_upstream_(?:probe_observation|probe_instance|probe_generated_time|classifier|observed_offset|provider_basis)_mismatch|verification_artifact_id_missing|verification_scope_not_current_live|current_live_time_basis_not_verified|current_live_proof_(?:missing|expiring|stale|conflicting)|time_contract_proof_state_mismatch|terminal_observation_out_of_order)$/;
const expectedResumeProbeBlockerPattern =
  /^(?:terminal_observation_stale|terminal_quote_stale|terminal_python_basis_conflict)$/;

const isExpectedResumeTransientBlocker = (blocker) => {
  const text = String(blocker);
  if (expectedResumeContractBlockerPattern.test(text)) return true;
  if (!text.startsWith("direct_terminal_probe_")) return false;
  return text
    .slice("direct_terminal_probe_".length)
    .split(",")
    .every((token) => expectedResumeProbeBlockerPattern.test(token));
};

const activeProofIsFresh = ({ state, nowUtc }) => {
  const generatedMs = Date.parse(state.activeArtifact?.generatedAtUtc ?? "");
  const expiresMs = Date.parse(state.activeArtifact?.expiresAtUtc ?? "");
  const nowMs = Date.parse(nowUtc);
  const authority = state.activeArtifact?.authority ?? {};
  return (
    state.activeArtifact?.validationStatus === "accepted" &&
    state.activeArtifact?.currentLiveTimeBasisVerified === true &&
    state.activeArtifact?.historicalDstPolicyVerified === false &&
    state.activeArtifact?.terminalConnected === true &&
    authority.executionAuthority === "none" &&
    authority.brokerAuthority === "none" &&
    authority.readinessOverrideAuthority === "none" &&
    Number.isFinite(generatedMs) &&
    Number.isFinite(expiresMs) &&
    Number.isFinite(nowMs) &&
    nowMs >= generatedMs - 5_000 &&
    nowMs - generatedMs <= 120_000 &&
    nowMs < expiresMs
  );
};

const resumeGraceActive = ({
  state,
  nowUtc,
  resumeGraceMs = TIME_VERIFIER_RESUME_GRACE_MS
}) => {
  if (state.awaitingFreshProofAfterMarketResume !== true) return false;
  const startedMs = Date.parse(state.resumeAwaitingStartedAtUtc ?? "");
  const nowMs = Date.parse(nowUtc);
  return (
    Number.isFinite(startedMs) &&
    Number.isFinite(nowMs) &&
    nowMs - startedMs <= resumeGraceMs
  );
};

export function createTimeVerifierWatchEngine({
  state: savedState,
  maximumContinuityGapMs = TIME_VERIFIER_MAX_CONTINUITY_GAP_MS,
  resumeGraceMs = TIME_VERIFIER_RESUME_GRACE_MS
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
    const proofState = state.pausedForMarketClosed
      ? "paused_market_closed"
      : ageSeconds === undefined
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
          : state.pausedForMarketClosed === true
            ? "healthy_paused_market_closed"
            : state.awaitingFreshProofAfterMarketResume === true
              ? "degraded_awaiting_fresh_market_proof"
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
      marketState: state.marketSnapshot?.marketState ?? "time_unverified",
      operationalMarketState:
        state.marketSnapshot?.operationalState ?? "time_unverified",
      marketStateReason: state.marketSnapshot?.reason,
      marketStateObservedAtUtc: state.marketSnapshot?.observedAtUtc,
      marketScheduleId: state.marketSnapshot?.schedule?.scheduleId,
      marketClosedPauseCount: state.marketClosedPauseCount,
      marketResumeCount: state.marketResumeCount,
      marketStateTransitionCount: state.marketStateTransitionCount,
      proofPausedForMarketClosed: state.pausedForMarketClosed === true,
      awaitingFreshProofAfterMarketResume:
        state.awaitingFreshProofAfterMarketResume === true,
      proofPausedAtUtc: state.proofPausedAtUtc,
      proofResumedAtUtc: state.proofResumedAtUtc,
      duplicateObservationCount: state.duplicateObservationCount,
      conflictCount: state.conflictCount,
      continuityStartedAtUtc: state.continuityStartedAtUtc,
      continuityResetCount: state.continuityResetCount,
      transientCorrelationPreservationCount:
        state.transientCorrelationPreservationCount,
      resumePendingAttemptCount: state.resumePendingAttemptCount,
      resumeAwaitingStartedAtUtc: state.resumeAwaitingStartedAtUtc,
      resumeGraceExpiresAtUtc: isoAfter(
        state.resumeAwaitingStartedAtUtc,
        resumeGraceMs
      ),
      resumeTransientBlockers:
        state.lastRenewalResult?.status === "awaiting_fresh_market_proof"
          ? state.lastRenewalResult.transientBlockers ?? []
          : [],
      transientCorrelationBlockers:
        state.lastRenewalResult?.status ===
        "transient_correlation_preserved"
          ? state.lastRenewalResult.transientBlockers ?? []
          : [],
      lastRenewalResult: state.lastRenewalResult,
      providerTimeBasis: state.activeArtifact?.providerTimeBasis,
      observedOffsetMinutes: state.activeArtifact?.observedOffsetMinutes,
      currentLiveEligible:
        state.pausedForMarketClosed !== true &&
        state.awaitingFreshProofAfterMarketResume !== true &&
        state.activeArtifact?.validationStatus === "accepted" &&
        proofState === "fresh",
      historicalEligible: false,
      blockers: unique([
        ...(state.lastRenewalResult?.blockers ?? []),
        ...(state.pausedForMarketClosed
          ? []
          : proofState !== "fresh"
            ? [`current_live_proof_${proofState}`]
            : []),
        ...(state.awaitingFreshProofAfterMarketResume
          ? ["fresh_market_correlation_required_after_resume"]
          : [])
      ]),
      warnings: unique([
        ...(state.pausedForMarketClosed
          ? ["market_closed_verified_pause"]
          : [])
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
    marketSnapshot,
    nowUtc = new Date().toISOString()
  }) => {
    const priorMarketSnapshot = state.marketSnapshot;
    const priorProbeState = state.lastProbeState;
    const priorProbeGeneratedAtUtc = state.lastProbeGeneratedAtUtc;
    const priorProbeInstanceFingerprint =
      state.lastProbeInstanceFingerprint;
    const priorMarketState = state.marketSnapshot?.marketState;
    const nextMarketState = marketSnapshot?.marketState;
    let marketStateTransitionRecorded = false;
    if (marketSnapshot) {
      state.marketSnapshot = marketSnapshot;
      if (priorMarketState && priorMarketState !== nextMarketState) {
        state.marketStateTransitionCount += 1;
        marketStateTransitionRecorded = true;
      }
    }
    if (marketSnapshot?.proofPauseEligible === true) {
      if (state.pausedForMarketClosed !== true) {
        state.marketClosedPauseCount += 1;
        state.proofPausedAtUtc = nowUtc;
      }
      state.pausedForMarketClosed = true;
      state.awaitingFreshProofAfterMarketResume = false;
      state.resumeAwaitingStartedAtUtc = undefined;
      state.lastRenewalResult = {
        status: "paused_market_closed",
        observedAt: nowUtc,
        blockers: []
      };
      return {
        action: "paused_market_closed",
        persistArtifact: false,
        state: { ...state },
        status: status({ nowUtc })
      };
    }
    if (
      state.pausedForMarketClosed === true &&
      marketSnapshot?.marketState !== "market_closed"
    ) {
      state.pausedForMarketClosed = false;
      state.awaitingFreshProofAfterMarketResume = true;
      state.resumeAwaitingStartedAtUtc = nowUtc;
    }
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
        if (
          state.awaitingFreshProofAfterMarketResume === true &&
          resumeGraceActive({ state, nowUtc, resumeGraceMs })
        ) {
          state.resumePendingAttemptCount += 1;
          state.lastRenewalResult = {
            status: "awaiting_fresh_market_proof",
            observedAt: nowUtc,
            probeObservationId: probeId,
            blockers: ["fresh_market_correlation_required_after_resume"],
            transientBlockers: ["terminal_observation_unchanged_after_resume"]
          };
          return {
            action: "awaiting",
            persistArtifact: false,
            state: { ...state },
            status: status({ nowUtc })
          };
        }
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
      const transientCorrelation =
        blockers.length > 0 &&
        blockers.every(isExpectedResumeTransientBlocker);
      const expectedResumePending =
        transientCorrelation &&
        resumeGraceActive({ state, nowUtc, resumeGraceMs });
      if (expectedResumePending) {
        state.resumePendingAttemptCount += 1;
        state.lastRenewalResult = {
          status: "awaiting_fresh_market_proof",
          observedAt: nowUtc,
          probeObservationId: probeId,
          blockers: ["fresh_market_correlation_required_after_resume"],
          transientBlockers: unique(blockers)
        };
        return {
          action: "awaiting",
          persistArtifact: false,
          state: { ...state },
          status: status({ nowUtc })
        };
      }
      if (
        transientCorrelation &&
        state.awaitingFreshProofAfterMarketResume !== true &&
        activeProofIsFresh({ state, nowUtc })
      ) {
        state.marketSnapshot = priorMarketSnapshot;
        state.lastProbeState = priorProbeState;
        state.lastProbeGeneratedAtUtc = priorProbeGeneratedAtUtc;
        state.lastProbeInstanceFingerprint =
          priorProbeInstanceFingerprint;
        if (marketStateTransitionRecorded) {
          state.marketStateTransitionCount = Math.max(
            0,
            state.marketStateTransitionCount - 1
          );
        }
        state.transientCorrelationPreservationCount += 1;
        state.lastRenewalResult = {
          status: "transient_correlation_preserved",
          observedAt: nowUtc,
          probeObservationId: probeId,
          blockers: [],
          transientBlockers: unique(blockers)
        };
        return {
          action: "preserved_transient_correlation",
          persistArtifact: false,
          state: { ...state },
          status: status({ nowUtc })
        };
      }
      state.failureCount += 1;
      const activeProofAccepted =
        state.activeArtifact?.validationStatus === "accepted" &&
        state.activeArtifact?.currentLiveTimeBasisVerified === true;
      const hardFailure =
        !activeProofAccepted ||
        blockers.some(requiresImmediateProofRevocation);
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
    if (state.awaitingFreshProofAfterMarketResume === true) {
      state.marketResumeCount += 1;
      state.proofResumedAtUtc = nowUtc;
    }
    state.awaitingFreshProofAfterMarketResume = false;
    state.resumeAwaitingStartedAtUtc = undefined;
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
    marketSnapshot,
    nowUtc = new Date().toISOString()
  } = {}) => {
    if (marketSnapshot?.proofPauseEligible === true) {
      return processEvidence({
        artifact: state.activeArtifact,
        directProbe: undefined,
        marketSnapshot,
        nowUtc
      });
    }
    if (
      blockers.length > 0 &&
      blockers.every(isExpectedResumeTransientBlocker) &&
      resumeGraceActive({ state, nowUtc, resumeGraceMs })
    ) {
      state.resumePendingAttemptCount += 1;
      state.lastRenewalResult = {
        status: "awaiting_fresh_market_proof",
        observedAt: nowUtc,
        blockers: ["fresh_market_correlation_required_after_resume"],
        transientBlockers: unique(blockers.map(String))
      };
      return {
        action: "awaiting",
        persistArtifact: false,
        state: { ...state },
        status: status({ nowUtc })
      };
    }
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
