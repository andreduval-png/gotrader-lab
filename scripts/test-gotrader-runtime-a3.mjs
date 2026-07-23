#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import {
  ALWAYS_ON_SHADOW_CONTEXT_PROFILE_ID,
  ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID,
  buildRuntimeProfile,
  runtimeAuthority,
  serviceStartupOrder,
  validateRuntimeProfile
} from "./gotrader-runtime-core.mjs";
import {
  buildSchedulerTaskRegistry,
  createAutonomousSchedulerEngine,
  validateSchedulerTaskRegistry
} from "./gotrader-autonomous-scheduler-core.mjs";
import { createContinuousFeedEngine } from "./gotrader-continuous-feed-core.mjs";

const repoRoot = path.resolve(".");
const profile = buildRuntimeProfile({
  profileId: ALWAYS_ON_SHADOW_CONTEXT_PROFILE_ID,
  repoRoot,
  env: {
    ...process.env,
    GOTRADER_RUNTIME_UPSTREAM_PORT: "18010",
    GOTRADER_RUNTIME_BRIDGE_PORT: "17351",
    GOTRADER_RUNTIME_FEED_PORT: "17353",
    GOTRADER_RUNTIME_SCHEDULER_PORT: "17354"
  }
});
assert.deepEqual(validateRuntimeProfile(profile), { valid: true, errors: [] });
assert.equal(profile.shadowContextEnabled, true);
assert.equal(profile.strategySchedulerEnabled, false);
assert.equal(profile.executionEnabled, false);

const verifiedProfile = buildRuntimeProfile({
  profileId: ALWAYS_ON_SHADOW_CONTEXT_VERIFIED_PROFILE_ID,
  repoRoot,
  env: {
    ...process.env,
    GOTRADER_RUNTIME_UPSTREAM_PORT: "18010",
    GOTRADER_RUNTIME_BRIDGE_PORT: "17351",
    GOTRADER_RUNTIME_FEED_PORT: "17353",
    GOTRADER_RUNTIME_SCHEDULER_PORT: "17354",
    GOTRADER_RUNTIME_TIME_VERIFIER_PORT: "17355"
  }
});
assert.deepEqual(validateRuntimeProfile(verifiedProfile), {
  valid: true,
  errors: []
});
assert.equal(verifiedProfile.persistentTimeVerifierEnabled, true);
assert.deepEqual(
  serviceStartupOrder(verifiedProfile).map((service) => service.serviceId),
  [
    "mt5_terminal",
    "mt5_readonly_upstream",
    "mt5_readonly_bridge",
    "current_live_time_verifier",
    "market_data_feed",
    "autonomous_cycle_scheduler"
  ]
);
assert.deepEqual(
  verifiedProfile.services.find(
    (service) => service.serviceId === "market_data_feed"
  ).dependencies,
  ["current_live_time_verifier"]
);
assert.equal(verifiedProfile.executionEnabled, false);
assert.equal(verifiedProfile.strategySchedulerEnabled, false);

const registry = buildSchedulerTaskRegistry({ enableShadowContext: true });
assert.deepEqual(validateSchedulerTaskRegistry(registry), {
  valid: true,
  errors: []
});
assert.equal(
  registry.find((task) => task.taskType === "shadow_context_refresh").enabled,
  true
);
assert.equal(
  registry.find((task) => task.taskType === "shadow_ifvg_comparison").enabled,
  false
);

const proof = {
  version: "v2",
  currentLiveTimeBasisVerified: true,
  historicalDstPolicyVerified: false,
  providerTimeBasis: "broker_server_wall_clock",
  terminalEvidenceStatus: "fresh",
  timeVerificationArtifactId: "sha256:proof",
  timeVerificationScope: "current_live",
  timeVerificationGeneratedAtUtc: "2026-07-23T14:04:00.000Z",
  timeVerificationExpiresAtUtc: "2026-07-23T14:07:00.000Z",
  timeVerificationProofState: "fresh"
};
const feed = createContinuousFeedEngine({
  requireVerificationArtifact: true
});
const candle = (time) => ({
  time,
  open: 100,
  high: 102,
  low: 99,
  close: 101
});
const poll = ({ observed, candles }) =>
  feed.processPoll({
    quotePayload: {
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      timestamp: observed,
      bid: 100,
      ask: 101
    },
    candlePayloads: [
      {
        requestedSymbol: "MNQ",
        brokerSymbol: "USTECH",
        timeframe: "5m",
        candles
      }
    ],
    timeContract: proof,
    receivedAt: observed
  });
poll({
  observed: "2026-07-23T14:05:00.000Z",
  candles: [candle("2026-07-23T13:55:00.000Z")]
});
const closeResult = poll({
  observed: "2026-07-23T14:06:00.000Z",
  candles: [
    candle("2026-07-23T13:55:00.000Z"),
    candle("2026-07-23T14:00:00.000Z")
  ]
});
const closeEvent = closeResult.events.find(
  (event) => event.type === "candle_closed"
);
assert.ok(closeEvent);
assert.equal(closeEvent.timeVerificationArtifactId, "sha256:proof");

let contextRuns = 0;
const scheduler = createAutonomousSchedulerEngine({
  registry,
  handlers: {
    shadow_context_refresh: async () => {
      contextRuns += 1;
      return {
        status: "completed",
        outputArtifactIds: ["shadow-context-fixture"]
      };
    }
  }
});
const scheduled = await scheduler.processEvents([
  { ...closeEvent, sequence: 1 }
]);
assert.equal(
  scheduled.artifacts.some(
    (artifact) => artifact.taskType === "shadow_context_refresh"
  ),
  true
);
assert.equal(contextRuns, 1);
assert.deepEqual(profile.authority, runtimeAuthority);
assert.equal(JSON.stringify(scheduled).includes("\"candles\":["), false);

console.log(
  JSON.stringify(
    {
      status: "passed",
      profileId: profile.profileId,
      strictTimeArtifactRequired: true,
      closeProofPropagated: true,
      shadowContextTriggered: true,
      shadowIfvgDisabled: true,
      rawCandlesPersisted: false,
      ...runtimeAuthority
    },
    null,
    2
  )
);
