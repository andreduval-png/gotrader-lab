#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  assertCompactTimeVerificationArtifact,
  buildCurrentLiveVerificationArtifact,
  compareCurrentLiveContractSurfaces,
  currentLiveVerificationAuthority
} from "./gotrader-current-live-time-verification-core.mjs";

const now = "2026-07-23T14:02:00.000Z";
const contract = {
  contractId: "mt5-terminal-clock",
  version: "mt5-time-contract-v2",
  timeVerificationArtifactId: "sha256:fixture-proof",
  timeVerificationScope: "current_live",
  verificationStatus: "verified",
  providerTimeBasis: "broker_server_wall_clock",
  terminalObservedOffsetMinutes: -240,
  terminalClockClassificationVersion: "v2-terminal-clock-classifier-v1",
  terminalProbeFingerprint: "sha256:terminal",
  quoteObservationFingerprint: "sha256:quote",
  candleObservationFingerprint: "sha256:candle",
  timeVerificationGeneratedAtUtc: "2026-07-23T14:01:00.000Z",
  timeVerificationExpiresAtUtc: "2026-07-23T14:04:00.000Z",
  timeVerificationProofState: "fresh",
  currentLiveTimeBasisVerified: true,
  historicalDstPolicyVerified: false,
  readOnly: true,
  marketDataOnly: true,
  sourceMethod: "mt5_terminal_probe"
};

const accepted = compareCurrentLiveContractSurfaces({
  upstream: contract,
  bridge: { ...contract },
  nowUtc: now
});
assert.equal(accepted.status, "accepted");
assert.equal(accepted.proofState, "fresh");

const artifact = buildCurrentLiveVerificationArtifact({
  upstream: contract,
  bridge: { ...contract },
  nowUtc: now
});
assert.equal(artifact.currentLiveTimeBasisVerified, true);
assert.equal(artifact.historicalDstPolicyVerified, false);
assert.deepEqual(artifact.authority, currentLiveVerificationAuthority);
assert.deepEqual(assertCompactTimeVerificationArtifact(artifact), {
  valid: true,
  errors: []
});
assert.equal(JSON.stringify(artifact).includes("\"candles\":["), false);

const expiring = compareCurrentLiveContractSurfaces({
  upstream: {
    ...contract,
    timeVerificationGeneratedAtUtc: "2026-07-23T13:59:30.000Z",
    timeVerificationProofState: "expiring"
  },
  bridge: {
    ...contract,
    timeVerificationGeneratedAtUtc: "2026-07-23T13:59:30.000Z",
    timeVerificationProofState: "expiring"
  },
  nowUtc: now
});
assert.equal(expiring.status, "blocked");
assert.equal(expiring.blockers.includes("current_live_proof_expiring"), true);

const mismatch = compareCurrentLiveContractSurfaces({
  upstream: contract,
  bridge: { ...contract, timeVerificationArtifactId: "sha256:other" },
  nowUtc: now
});
assert.equal(
  mismatch.blockers.includes("upstream_bridge_verificationArtifactId_mismatch"),
  true
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      freshProofAccepted: true,
      expiringProofFailsClosed: true,
      surfaceMismatchBlocked: true,
      historicalVerificationRemainsFalse: true,
      compactArtifact: true,
      ...currentLiveVerificationAuthority
    },
    null,
    2
  )
);
