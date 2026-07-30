#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID,
  buildRuntimeProfile,
  runtimeAuthority,
  serviceStartupOrder,
  validateRuntimeProfile
} from "./gotrader-runtime-core.mjs";
import {
  buildA3OperationalAcceptanceChecks,
  classifyA3MarketClosedPauseSample,
  managedRestartCountDelta
} from "./gotrader-a3-acceptance-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profile = buildRuntimeProfile({
  profileId: ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID,
  repoRoot,
  env: {}
});
const validation = validateRuntimeProfile(profile);
assert.equal(validation.valid, true, validation.errors.join(","));
assert.equal(profile.operationalMarketStateEnabled, true);
assert.equal(profile.historicalContextHydrationEnabled, true);
assert.equal(profile.shadowContextEnabled, true);
assert.equal(profile.strategySchedulerEnabled, false);
assert.equal(profile.productionAdoptionAllowed, false);
assert.deepEqual(profile.authority, runtimeAuthority);
const order = serviceStartupOrder(profile).map((service) => service.serviceId);
assert.deepEqual(order, [
  "mt5_terminal",
  "mt5_readonly_upstream",
  "mt5_readonly_bridge",
  "current_live_time_verifier",
  "market_data_feed",
  "autonomous_cycle_scheduler"
]);
for (const service of profile.services) {
  assert.deepEqual(service.authority, runtimeAuthority);
}
for (const serviceId of [
  "current_live_time_verifier",
  "market_data_feed",
  "autonomous_cycle_scheduler"
]) {
  const service = profile.services.find((item) => item.serviceId === serviceId);
  assert.equal(
    service.environment.GOTRADER_RUNTIME_PROFILE_ID,
    ALWAYS_ON_SHADOW_CONTEXT_OPERATIONAL_PROFILE_ID
  );
}

const passingAcceptanceInput = {
  elapsedSeconds: 4 * 3_600,
  marketHourSpan: 3,
  verifiedM5CloseCount: 3,
  completedContextCount: 3,
  blockedInsufficientContextCount: 0,
  duplicateCloseCount: 0,
  duplicateContextCount: 0,
  payloadConflictCount: 0,
  ledgerGapCount: 0,
  activeMarketSamples: 100,
  freshActiveMarketProofSamples: 100,
  marketClosedPauseSamples: 10,
  unsafeMarketClosedSamples: 0,
  marketResumeCountDelta: 1,
  freshProofAfterMarketClose: true,
  verificationFailureCount: 0,
  observerTransportFailures: 0,
  managedRestartDelta: 0,
  hydrationNotReadySamples: 0,
  historicalVerificationViolationSamples: 0,
  authorityViolationSamples: 0,
  finalRuntimeHealthy: true,
  finalHydrationReady: true,
  finalRuntimeBlockersClear: true
};
assert.ok(
  Object.values(
    buildA3OperationalAcceptanceChecks(passingAcceptanceInput)
  ).every(Boolean)
);
const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const marketPause = classifyA3MarketClosedPauseSample({
  verifierStatus: {
    marketState: "market_closed",
    currentLiveEligible: false,
    proofPausedForMarketClosed: true,
    ...authority
  },
  feedStatus: {
    state: "paused_market_closed",
    timeContractEligible: false,
    proofPausedForMarketClosed: true,
    ...authority
  },
  schedulerStatus: {
    state: "paused_market_closed",
    feedTimeContractEligible: false,
    proofPausedForMarketClosed: true,
    ...authority
  }
});
assert.equal(marketPause.safe, true);
assert.equal(marketPause.mode, "market_closed");

const disconnectedPause = classifyA3MarketClosedPauseSample({
  verifierStatus: {
    marketState: "market_closed",
    currentLiveEligible: false,
    proofPausedForTerminalDisconnected: true,
    ...authority
  },
  feedStatus: {
    state: "paused_terminal_disconnected",
    timeContractEligible: false,
    proofPausedForTerminalDisconnected: true,
    ...authority
  },
  schedulerStatus: {
    state: "paused_terminal_disconnected",
    feedTimeContractEligible: false,
    proofPausedForTerminalDisconnected: true,
    ...authority
  }
});
assert.equal(disconnectedPause.safe, true);
assert.equal(disconnectedPause.mode, "terminal_disconnected");

const mixedFailClosedPause = classifyA3MarketClosedPauseSample({
  verifierStatus: {
    marketState: "market_closed",
    currentLiveEligible: false,
    proofPausedForTerminalDisconnected: true,
    ...authority
  },
  feedStatus: {
    state: "paused_market_closed",
    timeContractEligible: false,
    proofPausedForMarketClosed: true,
    ...authority
  },
  schedulerStatus: {
    state: "paused_terminal_disconnected",
    feedTimeContractEligible: false,
    proofPausedForTerminalDisconnected: true,
    ...authority
  }
});
assert.equal(mixedFailClosedPause.safe, true);
assert.equal(mixedFailClosedPause.mode, "mixed_fail_closed");

assert.equal(
  classifyA3MarketClosedPauseSample({
    verifierStatus: {
      marketState: "market_closed",
      currentLiveEligible: false,
      proofPausedForMarketClosed: true,
      ...authority
    },
    feedStatus: {
      state: "healthy",
      timeContractEligible: true,
      proofPausedForMarketClosed: false,
      ...authority
    },
    schedulerStatus: {
      state: "healthy",
      feedTimeContractEligible: true,
      proofPausedForMarketClosed: false,
      ...authority
    }
  }).safe,
  false
);
for (const [field, value, expectedCheck] of [
  ["freshProofAfterMarketClose", false, "freshProofResumedAfterMarketBreak"],
  ["marketResumeCountDelta", 0, "freshProofResumedAfterMarketBreak"],
  ["managedRestartDelta", 1, "noManagedRestarts"],
  ["hydrationNotReadySamples", 1, "hydrationStayedReady"],
  [
    "historicalVerificationViolationSamples",
    1,
    "historicalVerificationStayedFalse"
  ],
  ["authorityViolationSamples", 1, "authorityStayedNone"],
  [
    "blockedInsufficientContextCount",
    1,
    "noInsufficientContextWindows"
  ],
  ["verificationFailureCount", 1, "noVerificationFailures"],
  ["finalRuntimeHealthy", false, "finalRuntimeHealthy"],
  ["finalHydrationReady", false, "finalHydrationReady"],
  ["finalRuntimeBlockersClear", false, "finalRuntimeBlockersClear"]
]) {
  const checks = buildA3OperationalAcceptanceChecks({
    ...passingAcceptanceInput,
    [field]: value
  });
  assert.equal(checks[expectedCheck], false, `${field} must block acceptance`);
}
assert.equal(
  managedRestartCountDelta({
    baseline: {
      market_data_feed: 5,
      autonomous_cycle_scheduler: 2,
      current_live_time_verifier: 1
    },
    current: {
      market_data_feed: 5,
      autonomous_cycle_scheduler: 2,
      current_live_time_verifier: 1
    }
  }),
  0
);
assert.equal(
  managedRestartCountDelta({
    baseline: {
      market_data_feed: 5,
      autonomous_cycle_scheduler: 2,
      current_live_time_verifier: 1
    },
    current: {
      market_data_feed: 6,
      autonomous_cycle_scheduler: 2,
      current_live_time_verifier: 2
    }
  }),
  2
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      profileId: profile.profileId,
      marketStateAware: true,
      boundedHistoricalHydration: true,
      operationalAcceptanceFailClosed: true,
      shadowContextOnly: true,
      strategySchedulerEnabled: false,
      productionAdoptionAllowed: false,
      ...runtimeAuthority
    },
    null,
    2
  )
);
