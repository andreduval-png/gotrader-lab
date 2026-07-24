const sequenceFor = (value) => {
  const sequence = Number(value);
  return Number.isSafeInteger(sequence) && sequence >= 0
    ? sequence
    : undefined;
};

export function resolveAcceptanceBaselineSequence({
  feedLastSequence,
  events = []
} = {}) {
  const statusSequence = sequenceFor(feedLastSequence);
  if (statusSequence !== undefined) return statusSequence;
  return events.reduce(
    (maximum, event) =>
      Math.max(maximum, sequenceFor(event?.sequence) ?? maximum),
    0
  );
}

export function eventsAfterAcceptanceBaseline({
  events = [],
  baselineSequence
} = {}) {
  const baseline = sequenceFor(baselineSequence) ?? 0;
  return events.filter((event) => {
    const sequence = sequenceFor(event?.sequence);
    return sequence !== undefined && sequence > baseline;
  });
}

const finiteCount = (value) => {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
};

export function managedRestartCountDelta({
  baseline = {},
  current = {}
} = {}) {
  return [
    "market_data_feed",
    "autonomous_cycle_scheduler",
    "current_live_time_verifier"
  ].reduce(
    (total, serviceId) =>
      total +
      Math.max(
        0,
        finiteCount(current?.[serviceId]) -
          finiteCount(baseline?.[serviceId])
      ),
    0
  );
}

export function buildA3OperationalAcceptanceChecks({
  elapsedSeconds,
  marketHourSpan,
  verifiedM5CloseCount,
  completedContextCount,
  blockedInsufficientContextCount,
  duplicateCloseCount,
  duplicateContextCount,
  payloadConflictCount,
  ledgerGapCount,
  activeMarketSamples,
  freshActiveMarketProofSamples,
  marketClosedPauseSamples,
  unsafeMarketClosedSamples,
  marketResumeCountDelta,
  freshProofAfterMarketClose,
  verificationFailureCount,
  observerTransportFailures,
  managedRestartDelta,
  hydrationNotReadySamples,
  historicalVerificationViolationSamples,
  authorityViolationSamples,
  finalRuntimeHealthy,
  finalHydrationReady,
  finalRuntimeBlockersClear
} = {}) {
  return Object.freeze({
    observationDurationPassed: finiteCount(elapsedSeconds) >= 4 * 3_600,
    marketHourSpanPassed: finiteCount(marketHourSpan) >= 2,
    verifiedM5CloseCountPassed: finiteCount(verifiedM5CloseCount) >= 3,
    completedContextCycleCountPassed: finiteCount(completedContextCount) >= 3,
    noInsufficientContextWindows:
      finiteCount(blockedInsufficientContextCount) === 0,
    noDuplicateCloses: finiteCount(duplicateCloseCount) === 0,
    noDuplicateContextArtifacts: finiteCount(duplicateContextCount) === 0,
    noPayloadConflicts: finiteCount(payloadConflictCount) === 0,
    noLedgerGaps: finiteCount(ledgerGapCount) === 0,
    proofFreshnessMaintained:
      finiteCount(activeMarketSamples) > 0 &&
      finiteCount(freshActiveMarketProofSamples) ===
        finiteCount(activeMarketSamples),
    marketBreakHandledSafely:
      finiteCount(marketClosedPauseSamples) > 0 &&
      finiteCount(unsafeMarketClosedSamples) === 0,
    freshProofResumedAfterMarketBreak:
      finiteCount(marketResumeCountDelta) > 0 &&
      freshProofAfterMarketClose === true,
    noVerificationFailures: finiteCount(verificationFailureCount) === 0,
    noObserverTransportFailures:
      finiteCount(observerTransportFailures) === 0,
    noManagedRestarts: finiteCount(managedRestartDelta) === 0,
    hydrationStayedReady: finiteCount(hydrationNotReadySamples) === 0,
    historicalVerificationStayedFalse:
      finiteCount(historicalVerificationViolationSamples) === 0,
    authorityStayedNone: finiteCount(authorityViolationSamples) === 0,
    finalRuntimeHealthy: finalRuntimeHealthy === true,
    finalHydrationReady: finalHydrationReady === true,
    finalRuntimeBlockersClear: finalRuntimeBlockersClear === true
  });
}
