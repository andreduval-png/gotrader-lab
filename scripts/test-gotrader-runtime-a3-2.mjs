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

console.log(
  JSON.stringify(
    {
      status: "passed",
      profileId: profile.profileId,
      marketStateAware: true,
      boundedHistoricalHydration: true,
      shadowContextOnly: true,
      strategySchedulerEnabled: false,
      productionAdoptionAllowed: false,
      ...runtimeAuthority
    },
    null,
    2
  )
);
