#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildCurrentLiveVerificationArtifact,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";
import {
  createTimeVerifierWatchEngine,
  emptyTimeVerifierWatchState
} from "./gotrader-time-verifier-watch-core.mjs";
import {
  collectCurrentLiveTimeEvidence,
  compactTerminalProbeResult
} from "./gotrader-current-live-time-collector.mjs";
import {
  createContinuousFeedEngine,
  evaluateRuntimeTimeContract
} from "./gotrader-continuous-feed-core.mjs";

const baseEpoch = Date.parse("2026-07-23T14:00:00.000Z");
const at = (seconds) => new Date(baseEpoch + seconds * 1_000).toISOString();
const directProbe = (sequence, overrides = {}) => ({
  status: "complete",
  observationId: `ABCDEF12-${sequence}`,
  probeInstanceId: "ABCDEF12",
  probeVersion: "1.1.0",
  probeMode: "persistent_ea",
  probeState: "fresh",
  terminalConnected: true,
  terminalProbeCapturedAt: at(sequence * 30),
  quoteObservedAt: at(sequence * 30),
  latestM5BarAt: at(0),
  terminalBuild: 5836,
  symbol: "USTECH",
  timeframe: "M5",
  chartSymbol: "USTECH",
  chartTimeframe: "M5",
  providerTimeBasis: "verified_trade_server_wall_clock",
  pythonTransportBasis: "matches_symbol_quote_time",
  observedOffsetMinutes: -240,
  terminalClockClassificationVersion: "1.0.0",
  currentLiveTimeBasisVerified: true,
  blockers: [],
  warnings: [],
  contentFingerprint: `sha256:probe-${sequence}`,
  authority: currentLiveVerificationAuthority,
  ...overrides
});
const contractFor = (probe, overrides = {}) => ({
  contractId: "mt5-terminal-clock",
  version: "mt5-time-contract-v2",
  timeVerificationArtifactId: `sha256:contract-${probe.observationId}`,
  timeVerificationScope: "current_live",
  verificationStatus: "verified",
  providerTimeBasis: "broker_server_wall_clock",
  terminalBasisClassification: probe.providerTimeBasis,
  terminalObservedOffsetMinutes: probe.observedOffsetMinutes,
  terminalClockClassificationVersion:
    probe.terminalClockClassificationVersion,
  terminalProbeObservationId: probe.observationId,
  terminalProbeInstanceId: probe.probeInstanceId,
  terminalProbeFingerprint: probe.contentFingerprint,
  quoteObservationFingerprint: "sha256:quote",
  candleObservationFingerprint: "sha256:candle",
  timeVerificationGeneratedAtUtc: probe.terminalProbeCapturedAt,
  timeVerificationExpiresAtUtc: at(
    Number(probe.observationId.split("-").at(-1)) * 30 + 180
  ),
  timeVerificationProofState: "fresh",
  currentLiveTimeBasisVerified: true,
  historicalDstPolicyVerified: false,
  readOnly: true,
  marketDataOnly: true,
  sourceMethod: "mt5_terminal_probe",
  ...overrides
});
const evidenceFor = (sequence, options = {}) => {
  const probe = directProbe(sequence, options.probe);
  const contract = contractFor(probe, options.contract);
  const bridge = { ...contract, ...(options.bridge ?? {}) };
  const artifact = buildCurrentLiveVerificationArtifact({
    upstream: contract,
    bridge,
    directProbe: probe,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    nowUtc: at(sequence * 30 + 1),
    requireDirectProbe: true
  });
  return { probe, contract, artifact };
};

const immutableObservationFingerprint = `sha256:${"a".repeat(64)}`;
const compactProbeA = compactTerminalProbeResult({
  status: "complete",
  observationFingerprint: immutableObservationFingerprint,
  observation: {
    observationId: "ABCDEF12-immutable",
    probeInstanceId: "ABCDEF12",
    version: "1.1.0",
    probeVersion: "1.1.0",
    probeMode: "persistent_ea",
    probeState: "fresh",
    terminalConnected: true,
    timeGmtRaw: baseEpoch / 1_000,
    symbolTimeRaw: baseEpoch / 1_000,
    latestBarOpenRaw: baseEpoch / 1_000,
    terminalBuild: 5836,
    symbol: "USTECH",
    timeframe: "M5",
    chartSymbol: "USTECH",
    chartTimeframe: "M5"
  },
  classification: {
    basisClassification: "verified_trade_server_wall_clock",
    terminalObservedOffsetMinutes: -240,
    classificationVersion: "1.0.0",
    currentLiveTimeBasisVerified: true,
    warnings: []
  }
});
const compactProbeB = compactTerminalProbeResult({
  status: "complete",
  observationFingerprint: immutableObservationFingerprint,
  observation: {
    observationId: "ABCDEF12-immutable",
    probeInstanceId: "ABCDEF12",
    version: "1.1.0",
    probeVersion: "1.1.0",
    probeMode: "persistent_ea",
    probeState: "fresh",
    terminalConnected: true,
    timeGmtRaw: baseEpoch / 1_000,
    symbolTimeRaw: baseEpoch / 1_000,
    latestBarOpenRaw: baseEpoch / 1_000,
    terminalBuild: 5836,
    symbol: "USTECH",
    timeframe: "M5",
    chartSymbol: "USTECH",
    chartTimeframe: "M5"
  },
  classification: {
    basisClassification: "current_offset_verified_only",
    terminalObservedOffsetMinutes: -240,
    classificationVersion: "1.0.0",
    currentLiveTimeBasisVerified: true,
    warnings: ["Dynamic correlation details changed."]
  }
});
assert.equal(compactProbeA.contentFingerprint, immutableObservationFingerprint);
assert.equal(compactProbeB.contentFingerprint, immutableObservationFingerprint);

const correlatedProbe = directProbe(5);
const correlatedContract = contractFor(correlatedProbe);
const correlationResponses = [
  correlatedContract,
  {
    ...correlatedContract,
    timeVerificationArtifactId: "sha256:race-window"
  },
  correlatedContract,
  correlatedContract
];
let correlationFetchCount = 0;
const correlationDelays = [];
const correlatedEvidence = await collectCurrentLiveTimeEvidence({
  repoRoot: ".",
  upstreamUrl: "http://upstream.test",
  bridgeUrl: "http://bridge.test",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  nowUtc: at(151),
  requireDirectProbe: true,
  readProbe: async () => correlatedProbe,
  fetchJson: async () => {
    const response = correlationResponses[correlationFetchCount];
    correlationFetchCount += 1;
    return response;
  },
  maximumCorrelationAttempts: 2,
  correlationRetryDelayMs: 25,
  delay: async (milliseconds) => {
    correlationDelays.push(milliseconds);
  }
});
assert.equal(correlatedEvidence.artifact.validationStatus, "accepted");
assert.equal(correlatedEvidence.correlationAttemptCount, 2);
assert.equal(correlationFetchCount, 4);
assert.deepEqual(correlationDelays, [25]);

const engine = createTimeVerifierWatchEngine();
const first = evidenceFor(1);
const firstResult = engine.processEvidence({
  artifact: first.artifact,
  directProbe: first.probe,
  nowUtc: at(31)
});
assert.equal(firstResult.action, "renewed");
assert.equal(firstResult.artifact.renewalSequence, 1);
assert.equal(firstResult.artifact.continuityStartedAtUtc, at(30));
assert.equal(firstResult.status.currentLiveEligible, true);

const duplicate = engine.processEvidence({
  artifact: first.artifact,
  directProbe: first.probe,
  nowUtc: at(40)
});
assert.equal(duplicate.action, "no_change");
assert.equal(duplicate.persistArtifact, false);
assert.equal(duplicate.status.verificationRenewalCount, 1);

const second = evidenceFor(2);
const renewed = engine.processEvidence({
  artifact: second.artifact,
  directProbe: second.probe,
  nowUtc: at(61)
});
assert.equal(renewed.action, "renewed");
assert.equal(renewed.artifact.renewalSequence, 2);
assert.equal(renewed.artifact.continuityStartedAtUtc, at(30));

const restartedEngine = createTimeVerifierWatchEngine({
  state: engine.snapshot()
});
const third = evidenceFor(3);
const afterRestart = restartedEngine.processEvidence({
  artifact: third.artifact,
  directProbe: third.probe,
  nowUtc: at(91)
});
assert.equal(afterRestart.action, "renewed");
assert.equal(afterRestart.artifact.continuityStartedAtUtc, at(30));
assert.equal(afterRestart.artifact.renewalSequence, 3);

const transientProbe = directProbe(4);
const transientArtifact = {
  ...evidenceFor(4).artifact,
  validationStatus: "blocked",
  currentLiveTimeBasisVerified: false,
  blockers: ["upstream_transport_unavailable"]
};
const transient = restartedEngine.processEvidence({
  artifact: transientArtifact,
  directProbe: transientProbe,
  nowUtc: at(121)
});
assert.equal(transient.action, "preserved");
assert.equal(transient.persistArtifact, false);
assert.equal(
  transient.status.verificationArtifactId,
  afterRestart.artifact.artifactId
);

const renewalRaceEngine = createTimeVerifierWatchEngine();
const renewalRaceAccepted = renewalRaceEngine.processEvidence({
  artifact: first.artifact,
  directProbe: first.probe,
  nowUtc: at(31)
});
const renewalRace = evidenceFor(2, {
  bridge: { timeVerificationGeneratedAtUtc: at(61) }
});
assert.equal(renewalRace.artifact.validationStatus, "blocked");
assert.ok(
  renewalRace.artifact.blockers.includes(
    "upstream_bridge_generatedAtUtc_mismatch"
  )
);
const preservedRenewalRace = renewalRaceEngine.processEvidence({
  artifact: renewalRace.artifact,
  directProbe: renewalRace.probe,
  nowUtc: at(61)
});
assert.equal(preservedRenewalRace.action, "preserved");
assert.equal(preservedRenewalRace.persistArtifact, false);
assert.equal(preservedRenewalRace.status.currentLiveEligible, true);
assert.equal(
  preservedRenewalRace.status.verificationArtifactId,
  renewalRaceAccepted.artifact.artifactId
);

const activeDisconnect = evidenceFor(2, {
  probe: {
    probeState: "disconnected",
    terminalConnected: false,
    contentFingerprint: "sha256:active-disconnected"
  }
});
const activeDisconnectResult = renewalRaceEngine.processEvidence({
  artifact: activeDisconnect.artifact,
  directProbe: activeDisconnect.probe,
  nowUtc: at(61)
});
assert.equal(activeDisconnectResult.action, "blocked");
assert.equal(activeDisconnectResult.persistArtifact, true);
assert.equal(activeDisconnectResult.status.currentLiveEligible, false);

const conflictingProbe = {
  ...third.probe,
  contentFingerprint: "sha256:changed-content"
};
const conflict = restartedEngine.processEvidence({
  artifact: third.artifact,
  directProbe: conflictingProbe,
  nowUtc: at(125)
});
assert.equal(conflict.action, "blocked");
assert.ok(
  conflict.artifact.blockers.includes(
    "terminal_observation_conflicting_duplicate"
  )
);
assert.equal(conflict.status.currentLiveEligible, false);

const mismatchEngine = createTimeVerifierWatchEngine();
const mismatch = evidenceFor(1, {
  bridge: { terminalObservedOffsetMinutes: -300 }
});
const mismatchResult = mismatchEngine.processEvidence({
  artifact: mismatch.artifact,
  directProbe: mismatch.probe,
  nowUtc: at(31)
});
assert.equal(mismatchResult.action, "blocked");
assert.ok(
  mismatchResult.artifact.blockers.some((blocker) =>
    blocker.includes("observedOffsetMinutes_mismatch")
  )
);

const disconnectedEngine = createTimeVerifierWatchEngine();
const disconnected = evidenceFor(1, {
  probe: {
    probeState: "disconnected",
    terminalConnected: false,
    contentFingerprint: "sha256:disconnected"
  }
});
const disconnectedResult = disconnectedEngine.processEvidence({
  artifact: disconnected.artifact,
  directProbe: disconnected.probe,
  nowUtc: at(31)
});
assert.equal(disconnectedResult.action, "blocked");
assert.equal(disconnectedResult.status.currentLiveEligible, false);

const expired = restartedEngine.status({ nowUtc: at(400) });
assert.equal(expired.verificationProofState, "stale");
assert.equal(expired.currentLiveEligible, false);

const marketPauseEngine = createTimeVerifierWatchEngine();
const marketProof = marketPauseEngine.processEvidence({
  artifact: first.artifact,
  directProbe: first.probe,
  marketSnapshot: {
    marketState: "market_open",
    operationalState: "market_open",
    observedAtUtc: at(31),
    proofPauseEligible: false
  },
  nowUtc: at(31)
});
assert.equal(marketProof.status.currentLiveEligible, true);
const marketPaused = marketPauseEngine.processEvidence({
  artifact: {
    ...second.artifact,
    validationStatus: "blocked",
    blockers: ["fixture_market_break_conflict"]
  },
  directProbe: second.probe,
  marketSnapshot: {
    marketState: "market_closed",
    operationalState: "market_closed",
    observedAtUtc: at(61),
    reason: "configured_daily_maintenance_break",
    schedule: { scheduleId: "fixture-schedule" },
    proofPauseEligible: true
  },
  nowUtc: at(61)
});
assert.equal(marketPaused.action, "paused_market_closed");
assert.equal(marketPaused.status.state, "healthy_paused_market_closed");
assert.equal(marketPaused.status.currentLiveEligible, false);
assert.equal(marketPaused.status.verificationFailureCount, 0);
const resumePending = marketPauseEngine.processEvidence({
  artifact: transientArtifact,
  directProbe: transientProbe,
  marketSnapshot: {
    marketState: "market_open",
    operationalState: "market_open",
    observedAtUtc: at(121),
    proofPauseEligible: false
  },
  nowUtc: at(121)
});
assert.equal(resumePending.status.currentLiveEligible, false);
assert.equal(
  resumePending.status.awaitingFreshProofAfterMarketResume,
  true
);
const resumed = marketPauseEngine.processEvidence({
  artifact: third.artifact,
  directProbe: third.probe,
  marketSnapshot: {
    marketState: "market_open",
    operationalState: "market_open",
    observedAtUtc: at(91),
    proofPauseEligible: false
  },
  nowUtc: at(91)
});
assert.equal(resumed.action, "renewed");
assert.equal(resumed.status.currentLiveEligible, true);
assert.equal(resumed.status.marketResumeCount, 1);

const strictEvaluation = evaluateRuntimeTimeContract(third.contract, {
  requireVerificationArtifact: true,
  requireWatcherArtifact: true,
  verificationArtifact: afterRestart.artifact,
  nowUtc: at(91)
});
assert.equal(strictEvaluation.eligible, true);
assert.equal(
  strictEvaluation.artifactId,
  afterRestart.artifact.artifactId
);
assert.equal(strictEvaluation.continuityStartedAtUtc, at(30));
const dynamicRequestArtifact = evaluateRuntimeTimeContract(
  {
    ...third.contract,
    timeVerificationArtifactId: "sha256:request-level-artifact"
  },
  {
    requireVerificationArtifact: true,
    requireWatcherArtifact: true,
    verificationArtifact: afterRestart.artifact,
    nowUtc: at(91)
  }
);
assert.equal(dynamicRequestArtifact.eligible, true);
const newerPendingRenewal = evaluateRuntimeTimeContract(
  evidenceFor(4).contract,
  {
    requireVerificationArtifact: true,
    requireWatcherArtifact: true,
    verificationArtifact: afterRestart.artifact,
    nowUtc: at(121)
  }
);
assert.equal(newerPendingRenewal.eligible, true);
const mismatchedProbeObservation = evaluateRuntimeTimeContract(
  {
    ...third.contract,
    terminalProbeObservationId: "ABCDEF12-unverified-new-observation"
  },
  {
    requireVerificationArtifact: true,
    requireWatcherArtifact: true,
    verificationArtifact: afterRestart.artifact,
    nowUtc: at(91)
  }
);
assert.equal(mismatchedProbeObservation.eligible, false);
assert.ok(
  mismatchedProbeObservation.blockers.includes(
    "current_live_watcher_probe_observation_conflict"
  )
);
const outOfOrderProbeObservation = evaluateRuntimeTimeContract(
  second.contract,
  {
    requireVerificationArtifact: true,
    requireWatcherArtifact: true,
    verificationArtifact: afterRestart.artifact,
    nowUtc: at(91)
  }
);
assert.equal(outOfOrderProbeObservation.eligible, false);
assert.ok(
  outOfOrderProbeObservation.blockers.includes(
    "current_live_contract_probe_out_of_order"
  )
);
const missingWatcher = evaluateRuntimeTimeContract(third.contract, {
  requireVerificationArtifact: true,
  requireWatcherArtifact: true,
  nowUtc: at(91)
});
assert.equal(missingWatcher.eligible, false);
assert.ok(
  missingWatcher.blockers.includes("current_live_watcher_artifact_missing")
);

const feed = createContinuousFeedEngine({
  requireVerificationArtifact: true,
  requireWatcherArtifact: true
});
const quote = {
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timestamp: at(605),
  bid: 20_000,
  ask: 20_001
};
const candlePayload = (count) => ({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  candles: Array.from({ length: count }, (_, index) => ({
    time: at(index * 300),
    open: 20_000 + index,
    high: 20_010 + index,
    low: 19_990 + index,
    close: 20_005 + index,
    tick_volume: 100
  }))
});
const baseline = feed.processPoll({
  quotePayload: quote,
  candlePayloads: [candlePayload(2)],
  timeContract: third.contract,
  verificationArtifact: afterRestart.artifact,
  receivedAt: at(91)
});
assert.equal(
  baseline.events.some((event) => event.type === "candle_closed"),
  false
);
const nextClose = feed.processPoll({
  quotePayload: { ...quote, timestamp: at(905) },
  candlePayloads: [candlePayload(3)],
  timeContract: third.contract,
  verificationArtifact: afterRestart.artifact,
  receivedAt: at(92)
});
assert.equal(
  nextClose.events.filter((event) => event.type === "candle_closed").length,
  1
);

const serialized = JSON.stringify({
  state: restartedEngine.snapshot(),
  artifact: afterRestart.artifact
}).toLowerCase();
for (const forbidden of [
  "\"candles\"",
  "\"account\"",
  "\"order\"",
  "\"position\"",
  "\"deal\"",
  "\"password\"",
  "\"token\""
]) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}
assert.deepEqual(afterRestart.artifact.authority, currentLiveVerificationAuthority);
const emptyState = emptyTimeVerifierWatchState();
assert.equal(emptyState.executionAuthority, "none");
assert.equal(emptyState.brokerAuthority, "none");
assert.equal(emptyState.readinessOverrideAuthority, "none");

console.log(
  JSON.stringify(
    {
      status: "passed",
      initialProof: true,
      renewalBindsNewProbe: true,
      duplicateDoesNotRenew: true,
      conflictingDuplicateBlocked: true,
      transientFailurePreservesOnlyExistingProof: true,
      restartContinuityPreserved: true,
      expiryFailsClosed: true,
      mismatchBlocked: true,
      disconnectedBlocked: true,
      strictFeedEligibility: true,
      strictFeedClosedCandleTrigger: true,
      compactPersistence: true,
      historicalEligible: false,
      ...currentLiveVerificationAuthority
    },
    null,
    2
  )
);
