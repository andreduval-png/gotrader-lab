#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  buildCurrentLiveVerificationArtifact,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";
import {
  createTimeVerifierWatchEngine
} from "./gotrader-time-verifier-watch-core.mjs";
import {
  createContinuousFeedEngine
} from "./gotrader-continuous-feed-core.mjs";
import {
  buildSchedulerTaskRegistry,
  createAutonomousSchedulerEngine
} from "./gotrader-autonomous-scheduler-core.mjs";

const baseEpoch = Date.parse("2026-07-23T14:00:00.000Z");
const at = (seconds) => new Date(baseEpoch + seconds * 1_000).toISOString();

const directProbe = (sequence, generatedAtSeconds) => ({
  status: "complete",
  observationId: `A31TEST1-${sequence}`,
  probeInstanceId: "A31TEST1",
  probeVersion: "1.1.0",
  probeMode: "persistent_ea",
  probeState: "fresh",
  terminalConnected: true,
  terminalProbeCapturedAt: at(generatedAtSeconds),
  quoteObservedAt: at(generatedAtSeconds),
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
  authority: currentLiveVerificationAuthority
});

const contractFor = (probe) => ({
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
  timeVerificationExpiresAtUtc: new Date(
    Date.parse(probe.terminalProbeCapturedAt) + 180_000
  ).toISOString(),
  timeVerificationProofState: "fresh",
  currentLiveTimeBasisVerified: true,
  historicalDstPolicyVerified: false,
  readOnly: true,
  marketDataOnly: true,
  sourceMethod: "mt5_terminal_probe",
  ...currentLiveVerificationAuthority
});

const evidenceFor = (sequence, generatedAtSeconds) => {
  const probe = directProbe(sequence, generatedAtSeconds);
  const contract = contractFor(probe);
  return {
    probe,
    contract,
    artifact: buildCurrentLiveVerificationArtifact({
      upstream: contract,
      bridge: contract,
      directProbe: probe,
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      nowUtc: at(generatedAtSeconds + 1),
      requireDirectProbe: true
    })
  };
};

const quoteAt = (seconds) => ({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timestamp: at(seconds),
  bid: 20_000,
  ask: 20_001
});

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

const watcher = createTimeVerifierWatchEngine();
const firstEvidence = evidenceFor(1, 30);
const firstRenewal = watcher.processEvidence({
  artifact: firstEvidence.artifact,
  directProbe: firstEvidence.probe,
  nowUtc: at(31)
});
assert.equal(firstRenewal.action, "renewed");

let feed = createContinuousFeedEngine({
  requireVerificationArtifact: true,
  requireWatcherArtifact: true
});
const baseline = feed.processPoll({
  quotePayload: quoteAt(605),
  candlePayloads: [candlePayload(2)],
  timeContract: firstEvidence.contract,
  verificationArtifact: firstRenewal.artifact,
  receivedAt: at(31)
});
assert.equal(
  baseline.events.some((event) => event.type === "candle_closed"),
  false
);

const firstCloseResult = feed.processPoll({
  quotePayload: quoteAt(905),
  candlePayloads: [candlePayload(3)],
  timeContract: firstEvidence.contract,
  verificationArtifact: firstRenewal.artifact,
  receivedAt: at(32)
});
const firstCloses = firstCloseResult.events.filter(
  (event) => event.type === "candle_closed"
);
assert.equal(firstCloses.length, 1);

const contextCycles = [];
const registry = buildSchedulerTaskRegistry({ enableShadowContext: true });
const handlers = {
  shadow_context_refresh: async ({ event }) => {
    contextCycles.push(event.eventId);
    return {
      status: "completed",
      outputArtifactIds: [`context:${event.eventId}`],
      resultArtifact: {
        triggerEventId: event.eventId,
        status: "completed",
        rawCandlesPersisted: false,
        productionAdoptionAllowed: false,
        ...currentLiveVerificationAuthority
      }
    };
  }
};
let scheduler = createAutonomousSchedulerEngine({ registry, handlers });
const firstSchedule = await scheduler.processEvents(firstCloses, {
  feedStatus: firstCloseResult.status
});
assert.equal(contextCycles.length, 1);

const schedulerCheckpoint = firstSchedule.checkpoint;
scheduler = createAutonomousSchedulerEngine({
  checkpoint: schedulerCheckpoint,
  registry,
  handlers
});
const replayedSchedule = await scheduler.processEvents(firstCloses, {
  feedStatus: firstCloseResult.status
});
assert.equal(replayedSchedule.artifacts.length, 0);
assert.equal(contextCycles.length, 1);

const feedCheckpoint = firstCloseResult.checkpoint;
feed = createContinuousFeedEngine({
  checkpoint: feedCheckpoint,
  requireVerificationArtifact: true,
  requireWatcherArtifact: true
});
const replayedFeed = feed.processPoll({
  quotePayload: quoteAt(905),
  candlePayloads: [candlePayload(3)],
  timeContract: firstEvidence.contract,
  verificationArtifact: firstRenewal.artifact,
  receivedAt: at(33)
});
assert.equal(
  replayedFeed.events.filter((event) => event.type === "candle_closed").length,
  0
);

const restartedWatcher = createTimeVerifierWatchEngine({
  state: watcher.snapshot()
});
const secondEvidence = evidenceFor(2, 60);
const postRestartRenewal = restartedWatcher.processEvidence({
  artifact: secondEvidence.artifact,
  directProbe: secondEvidence.probe,
  nowUtc: at(61)
});
assert.equal(postRestartRenewal.action, "renewed");
assert.equal(postRestartRenewal.artifact.continuityStartedAtUtc, at(30));

const expiredStatus = restartedWatcher.status({ nowUtc: at(400) });
assert.equal(expiredStatus.currentLiveEligible, false);
const blockedClose = feed.processPoll({
  quotePayload: quoteAt(1_205),
  candlePayloads: [candlePayload(4)],
  timeContract: secondEvidence.contract,
  verificationArtifact: postRestartRenewal.artifact,
  receivedAt: at(400)
});
assert.equal(
  blockedClose.events.filter((event) => event.type === "candle_closed").length,
  0
);

const recoveredEvidence = evidenceFor(3, 420);
const recoveredRenewal = restartedWatcher.processEvidence({
  artifact: recoveredEvidence.artifact,
  directProbe: recoveredEvidence.probe,
  nowUtc: at(421)
});
assert.equal(recoveredRenewal.action, "renewed");
assert.equal(recoveredRenewal.artifact.continuityStartedAtUtc, at(420));
assert.equal(recoveredRenewal.status.continuityResetCount, 1);

const recoveryBaseline = feed.processPoll({
  quotePayload: quoteAt(1_205),
  candlePayloads: [candlePayload(4)],
  timeContract: recoveredEvidence.contract,
  verificationArtifact: recoveredRenewal.artifact,
  receivedAt: at(421)
});
assert.equal(
  recoveryBaseline.events.filter((event) => event.type === "candle_closed")
    .length,
  0
);

const secondCloseResult = feed.processPoll({
  quotePayload: quoteAt(1_505),
  candlePayloads: [candlePayload(5)],
  timeContract: recoveredEvidence.contract,
  verificationArtifact: recoveredRenewal.artifact,
  receivedAt: at(422)
});
const secondCloses = secondCloseResult.events.filter(
  (event) => event.type === "candle_closed"
);
assert.equal(secondCloses.length, 1);
const secondSchedule = await scheduler.processEvents(secondCloses, {
  feedStatus: secondCloseResult.status
});
assert.equal(contextCycles.length, 2);
assert.equal(secondSchedule.artifacts.length, 3);
assert.equal(new Set(contextCycles).size, 2);

const compact = JSON.stringify({
  watcher: restartedWatcher.snapshot(),
  feed: secondCloseResult.checkpoint,
  scheduler: secondSchedule.checkpoint,
  artifacts: [...firstSchedule.artifacts, ...secondSchedule.artifacts]
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
  assert.equal(compact.includes(forbidden), false, forbidden);
}
assert.equal(compact.includes("\"executionauthority\":\"none\""), true);
assert.equal(compact.includes("\"brokerauthority\":\"none\""), true);
assert.equal(compact.includes("\"readinessoverrideauthority\":\"none\""), true);

console.log(
  JSON.stringify(
    {
      status: "passed",
      automaticProofRenewal: true,
      verifierRestartContinuity: true,
      feedRestartDeduplicated: true,
      schedulerRestartDeduplicated: true,
      proofExpiryBlockedClose: true,
      retroactiveCloseSuppressed: true,
      recoveryRebaselined: true,
      verifiedCloseCount: 2,
      contextCycleCount: contextCycles.length,
      duplicateCloseCount: 0,
      duplicateContextCycleCount: 0,
      rawCandlesPersisted: false,
      productionAdoptionAllowed: false,
      ...currentLiveVerificationAuthority
    },
    null,
    2
  )
);
