#!/usr/bin/env node

import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  B1_2_SHADOW_CANARY_CONTROL_VERSION,
  B1_2_SHADOW_CANARY_PREPARATION_BOUNDARY,
  CanonicalResearchShadowCanaryPreparationHarness
} from "./support/canonical-research-shadow-canary-harness.mjs";
import { createCanonicalResearchNodeStorage } from "./support/canonical-research-node-storage.mjs";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "b1-shadow-canary-harness-modules");
const testRoot = path.join(workspace, ".gotrader", "b1-shadow-canary-harness-test");
await fs.rm(testRoot, { recursive: true, force: true });

compileTypescriptModules({
  files: [path.join(workspace, "src/lib/v2/serialization/canonicalSerialization.ts")],
  outRoot
});
const serialization = await import(
  pathToFileURL(path.join(outRoot, "canonicalSerialization.mjs")).href
);

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const clock = (() => {
  let timestamp = Date.parse("2026-07-31T14:00:00.000Z");
  return () => {
    timestamp += 1_000;
    return new Date(timestamp).toISOString();
  };
})();

let adapterCalls = 0;
const adapter = {
  status: () => ({
    mode: "recorded_artifact_test",
    runtimeRegistered: false,
    schedulerRegistered: false,
    liveConsumptionEnabled: false,
    authority
  }),
  async run(input) {
    adapterCalls += 1;
    if (input.testDisposition === "identity_mismatch") {
      return {
        status: "blocked",
        blockers: ["accepted_context_identity_mismatch"],
        warnings: [],
        nextAction: "Preserve compact mismatch.",
        resumed: false,
        shadowOnly: true,
        rawCandlesPersisted: false,
        rawFactsPersisted: false,
        authority
      };
    }
    return {
      status: "completed",
      blockers: [],
      warnings: ["recorded_artifact_test_only"],
      nextAction: "Retain compact parity evidence.",
      contextArtifactId: `v2-context:${"a".repeat(64)}`,
      logicalJobId: `sha256:${"b".repeat(64)}`,
      resultArtifactId: `sha256:${"c".repeat(64)}`,
      admissionDisposition: input.testDisposition === "duplicate" ? "coalesced" : "created",
      resumed: input.testDisposition === "duplicate",
      shadowOnly: true,
      rawCandlesPersisted: false,
      rawFactsPersisted: false,
      authority
    };
  }
};

assert.throws(
  () => new CanonicalResearchShadowCanaryPreparationHarness({
    storage: createCanonicalResearchNodeStorage({
      root: path.join(testRoot, "unsafe-adapter")
    }).adapter,
    adapter: {
      ...adapter,
      status: () => ({
        mode: "live",
        runtimeRegistered: true,
        schedulerRegistered: true,
        liveConsumptionEnabled: true,
        authority
      })
    },
    canonicalHash: serialization.canonicalHash,
    now: clock
  }),
  /outside the recorded-test boundary/
);

const storage = createCanonicalResearchNodeStorage({ root: testRoot });
const harness = new CanonicalResearchShadowCanaryPreparationHarness({
  storage: storage.adapter,
  adapter,
  canonicalHash: serialization.canonicalHash,
  now: clock
});
const initial = await harness.initialize();
assert.equal(initial.state, "disabled");
assert.equal(initial.mode, "disabled");
assert.equal(initial.runtimeRegistered, false);
assert.equal(initial.schedulerRegistered, false);
assert.equal(initial.liveConsumptionEnabled, false);
assert.equal(initial.acceptedRuntimeLedgerMutationAllowed, false);
assert.deepEqual(initial.authority, authority);

const sensitiveInput = {
  testDisposition: "created",
  contextRequest: {
    windows: [{ candles: [{ open: 1, high: 2, low: 0.5, close: 1.5 }] }]
  },
  rawCandles: [{ open: 1, high: 2, low: 0.5, close: 1.5 }],
  secrets: { apiKey: "must-not-persist" }
};
const disabled = await harness.handleRecordedContext(sensitiveInput);
assert.equal(disabled.status, "disabled");
assert.equal(adapterCalls, 0, "Disabled profile must not invoke the adapter.");

const invalidLiveControl = await harness.applyControl({
  controlVersion: B1_2_SHADOW_CANARY_CONTROL_VERSION,
  revision: 1,
  desiredMode: "live",
  requestedAt: clock(),
  reason: "Attempt unsafe live activation.",
  operatorAcknowledged: true,
  authority
});
assert.equal(invalidLiveControl.applied, false);
assert.ok(invalidLiveControl.blockers.includes("b1_2_control_mode_not_allowlisted"));
assert.equal(harness.status().mode, "disabled");

const authorityDriftControl = await harness.applyControl({
  controlVersion: B1_2_SHADOW_CANARY_CONTROL_VERSION,
  revision: 2,
  desiredMode: "recorded_artifact_test",
  requestedAt: clock(),
  reason: "Attempt authority drift.",
  operatorAcknowledged: true,
  authority: { ...authority, brokerAuthority: "read_write" }
});
assert.equal(authorityDriftControl.applied, false);
assert.ok(authorityDriftControl.blockers.includes("b1_2_control_authority_invalid"));

const missingAcknowledgement = await harness.applyControl({
  controlVersion: B1_2_SHADOW_CANARY_CONTROL_VERSION,
  revision: 3,
  desiredMode: "recorded_artifact_test",
  requestedAt: clock(),
  reason: "Missing explicit operator acknowledgement.",
  operatorAcknowledged: false,
  authority
});
assert.equal(missingAcknowledgement.applied, false);
assert.ok(missingAcknowledgement.blockers.includes("b1_2_control_operator_acknowledgement_required"));

const enable = await harness.applyControl({
  controlVersion: B1_2_SHADOW_CANARY_CONTROL_VERSION,
  revision: 4,
  desiredMode: "recorded_artifact_test",
  requestedAt: clock(),
  reason: "Run isolated recorded-artifact parity tests only; apiKey=must-not-persist.",
  operatorAcknowledged: true,
  authority
});
assert.equal(enable.applied, true);
assert.equal(enable.status.state, "ready_for_recorded_test");

const first = await harness.handleRecordedContext(sensitiveInput);
assert.equal(first.status, "completed");
assert.equal(adapterCalls, 1);
const duplicate = await harness.handleRecordedContext({ testDisposition: "duplicate" });
assert.equal(duplicate.status, "completed");
assert.equal(duplicate.admissionDisposition, "coalesced");
const mismatch = await harness.handleRecordedContext({ testDisposition: "identity_mismatch" });
assert.equal(mismatch.status, "blocked");
assert.equal(harness.status().counters.identityMismatches, 1);

const stale = await harness.applyControl({
  controlVersion: B1_2_SHADOW_CANARY_CONTROL_VERSION,
  revision: 4,
  desiredMode: "disabled",
  requestedAt: clock(),
  reason: "Stale control should not alter state.",
  operatorAcknowledged: true,
  authority
});
assert.equal(stale.disposition, "stale_ignored");
assert.equal(harness.status().mode, "recorded_artifact_test");

const rollback = await harness.rollback({
  revision: 5,
  requestedAt: clock(),
  reason: "End recorded-artifact preparation test."
});
assert.equal(rollback.applied, true);
assert.equal(rollback.status.mode, "disabled");
assert.equal(rollback.status.counters.rollbacksApplied, 1);
const afterRollback = await harness.handleRecordedContext({ testDisposition: "created" });
assert.equal(afterRollback.status, "disabled");
assert.equal(adapterCalls, 3, "Rollback must stop future adapter calls immediately.");

const restartHarness = new CanonicalResearchShadowCanaryPreparationHarness({
  storage: storage.adapter,
  adapter,
  canonicalHash: serialization.canonicalHash,
  now: clock
});
const restarted = await restartHarness.initialize();
assert.equal(restarted.mode, "disabled");
assert.equal(restarted.counters.restarts, 1);
assert.equal(restarted.counters.completed, 2);
assert.equal(restarted.counters.blocked, 1);
assert.equal(restarted.counters.coalesced, 1);
assert.equal(restarted.counters.rollbacksApplied, 1);
assert.ok(restarted.recentAudit.length > 0 && restarted.recentAudit.length <= 100);
assert.ok(restarted.recentAudit.every((entry) => entry.authority.executionAuthority === "none"));

const persistedText = await storage.adapter.readText("state.json");
assert.doesNotMatch(persistedText, /must-not-persist|apiKey|rawCandles/i);
assert.doesNotMatch(persistedText, /"candles"\s*:|"open"\s*:|"high"\s*:|"low"\s*:|"close"\s*:/i);
assert.doesNotMatch(persistedText, /accountData|orderData|positionData|placeOrder|buyMarket|sellMarket/i);

const tampered = JSON.parse(persistedText);
tampered.state.mode = "recorded_artifact_test";
await storage.adapter.writeTextAtomic("state.json", `${JSON.stringify(tampered)}\n`);
const corruptHarness = new CanonicalResearchShadowCanaryPreparationHarness({
  storage: storage.adapter,
  adapter,
  canonicalHash: serialization.canonicalHash,
  now: clock
});
const corrupt = await corruptHarness.initialize();
assert.equal(corrupt.state, "blocked");
assert.deepEqual(corrupt.blockers, ["b1_2_preparation_state_integrity_failed"]);
const corruptOutcome = await corruptHarness.handleRecordedContext({ testDisposition: "created" });
assert.equal(corruptOutcome.status, "blocked");
assert.equal(adapterCalls, 3, "Corrupt state must fail closed before adapter invocation.");

const schedulerSource = await fs.readFile(
  path.join(workspace, "scripts", "gotrader-autonomous-scheduler-core.mjs"),
  "utf8"
);
const runtimeProfileSource = await fs.readFile(
  path.join(workspace, "src", "lib", "alwaysOnRuntime", "alwaysOnRuntimeProfile.ts"),
  "utf8"
);
assert.doesNotMatch(schedulerSource, /b1_2_shadow_context_canary|canonicalResearchShadowCanary/i);
assert.doesNotMatch(runtimeProfileSource, /b1_2_shadow_context_canary|canonicalResearchShadowCanary/i);
assert.equal(B1_2_SHADOW_CANARY_PREPARATION_BOUNDARY.runtimeRegistrationAllowed, false);
assert.equal(B1_2_SHADOW_CANARY_PREPARATION_BOUNDARY.schedulerRegistrationAllowed, false);
assert.equal(B1_2_SHADOW_CANARY_PREPARATION_BOUNDARY.liveEventConsumptionAllowed, false);
assert.deepEqual(B1_2_SHADOW_CANARY_PREPARATION_BOUNDARY.authority, authority);

console.log(JSON.stringify({
  status: "passed",
  profileId: B1_2_SHADOW_CANARY_PREPARATION_BOUNDARY.profileId,
  defaultMode: "disabled",
  explicitRecordedTestControlRequired: true,
  rollbackFailClosed: true,
  restartContinuity: true,
  corruptStateBlocked: true,
  boundedAuditCount: restarted.recentAudit.length,
  counters: restarted.counters,
  rawInputsPersisted: false,
  runtimeRegistered: false,
  schedulerRegistered: false,
  authority
}, null, 2));
