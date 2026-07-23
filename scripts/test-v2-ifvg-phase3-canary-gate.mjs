#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const fixtureRoot = path.join(workspace, "tests", "fixtures", "v2-baseline");
const outRoot = path.join(workspace, ".gotrader", "v2-ifvg-phase3-canary-gate-test");
const sourceFiles = [
  "src/lib/v2Baseline/baselineTypes.ts",
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3CanaryTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3BaselineAdapter.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3CanaryGate.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const adapter = await load("v2IfvgPhase3BaselineAdapter");
const gate = await load("v2IfvgPhase3CanaryGate");

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const readSnapshot = (name) =>
  JSON.parse(fs.readFileSync(path.join(fixtureRoot, name), "utf8")).payload;
const hashes = JSON.parse(
  fs.readFileSync(path.join(fixtureRoot, "baseline-snapshot-hashes.json"), "utf8")
).hashes;
const positiveFixture = readSnapshot("ifvg-v3-positive-canary.snapshot.json")
  .find((fixture) => fixture.identity.fixtureId === "ifvg_v3_valid");
const negativeFixture = readSnapshot("ifvg-v2-negative-control.snapshot.json")
  .find((fixture) => fixture.identity.fixtureId === "ifvg_v2_negative_control");
assert.ok(positiveFixture);
assert.ok(negativeFixture);

const positive = await adapter.buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
  fixture: positiveFixture,
  baselineSnapshotHash: hashes["ifvg-v3-positive-canary.snapshot.json"]
});
const negative = await adapter.buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
  fixture: negativeFixture,
  baselineSnapshotHash: hashes["ifvg-v2-negative-control.snapshot.json"]
});
const deterministicParity = Object.freeze({
  detection: "exact_parity",
  geometry: "exact_parity",
  selection: "exact_parity"
});
const baseInput = Object.freeze({
  canaryMode: "shadow",
  evaluatedAtUtc: "2026-07-23T12:00:00.000Z",
  deterministicParity,
  positiveCanary: positive,
  negativeControl: negative
});

const missingIdentity = await gate.evaluateV2IfvgPhase3CanaryGate(baseInput);
assert.equal(missingIdentity.status, "blocked_insufficient_comparison_data");
assert.equal(missingIdentity.researchLifecycleParity, "insufficient_comparison_data");
assert.equal(missingIdentity.liveShadowParity, "insufficient_comparison_data");
assert.ok(missingIdentity.blockers.includes("ifvg_v3_replay_oos_source_identity_missing"));
assert.ok(missingIdentity.blockers.includes("ifvg_v3_live_shadow_ledger_missing"));
assert.equal(missingIdentity.phase3CompletionReviewReady, false);

const identityMatchedPositive = await adapter.buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
  fixture: positiveFixture,
  baselineSnapshotHash: hashes["ifvg-v3-positive-canary.snapshot.json"],
  historicalSourceFingerprint: `sha256:${"a".repeat(64)}`
});
const identityMatchedNegative = await adapter.buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
  fixture: negativeFixture,
  baselineSnapshotHash: hashes["ifvg-v2-negative-control.snapshot.json"],
  historicalSourceFingerprint: `sha256:${"a".repeat(64)}`
});
const liveShadow = Object.freeze({
  validationStatus: "accepted",
  exactParityCount: 3,
  regressionCount: 0,
  insufficientComparisonCount: 0,
  distinctClosedWindowCount: 3,
  distinctMarketDateCount: 2,
  statisticallyIndependentWindowClaimed: false,
  authority
});
const ready = await gate.evaluateV2IfvgPhase3CanaryGate({
  ...baseInput,
  positiveCanary: identityMatchedPositive,
  negativeControl: identityMatchedNegative,
  liveShadow
});
assert.equal(ready.status, "ready_for_completion_review");
assert.equal(ready.researchLifecycleParity, "exact_parity");
assert.equal(ready.liveShadowParity, "exact_parity");
assert.equal(ready.phase3CompletionReviewReady, true);
assert.equal(ready.phase4ImplementationAuthorized, false);
assert.equal(ready.productionAdoptionAllowed, false);
assert.equal(ready.canCreateEvidence, false);

const sourceMismatchNegative = await adapter.buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
  fixture: negativeFixture,
  baselineSnapshotHash: hashes["ifvg-v2-negative-control.snapshot.json"],
  historicalSourceFingerprint: `sha256:${"b".repeat(64)}`
});
const sourceMismatch = await gate.evaluateV2IfvgPhase3CanaryGate({
  ...baseInput,
  positiveCanary: identityMatchedPositive,
  negativeControl: sourceMismatchNegative,
  liveShadow
});
assert.equal(sourceMismatch.status, "blocked_insufficient_comparison_data");
assert.ok(sourceMismatch.blockers.includes("ifvg_phase3_replay_oos_source_identity_mismatch"));

const positiveRegression = await gate.evaluateV2IfvgPhase3CanaryGate({
  ...baseInput,
  positiveCanary: Object.freeze({
    ...identityMatchedPositive,
    replay: Object.freeze({ ...identityMatchedPositive.replay, averageR: 2.804 })
  }),
  negativeControl: identityMatchedNegative,
  liveShadow
});
assert.equal(positiveRegression.status, "blocked_regression");
assert.ok(positiveRegression.blockers.includes("ifvg_v3_positive_canary_baseline_regression"));

const negativeControlRegression = await gate.evaluateV2IfvgPhase3CanaryGate({
  ...baseInput,
  positiveCanary: identityMatchedPositive,
  negativeControl: Object.freeze({
    ...identityMatchedNegative,
    promotionAllowed: true,
    oos: Object.freeze({ ...identityMatchedNegative.oos, promotionAllowed: true })
  }),
  liveShadow
});
assert.equal(negativeControlRegression.status, "blocked_regression");
assert.ok(negativeControlRegression.blockers.includes("ifvg_v2_negative_control_regression"));

const liveRegression = await gate.evaluateV2IfvgPhase3CanaryGate({
  ...baseInput,
  positiveCanary: identityMatchedPositive,
  negativeControl: identityMatchedNegative,
  liveShadow: Object.freeze({ ...liveShadow, exactParityCount: 2, regressionCount: 1 })
});
assert.equal(liveRegression.status, "blocked_regression");
assert.ok(liveRegression.blockers.includes("ifvg_v3_live_shadow_regression_present"));

const forbidden = await gate.evaluateV2IfvgPhase3CanaryGate({
  ...baseInput,
  rawCandles: [{ open: 1, close: 2 }]
});
assert.equal(forbidden.status, "blocked_regression");
assert.ok(forbidden.blockers.some((blocker) => blocker.includes("ifvg_phase3_forbidden_field")));

const disabled = await gate.evaluateV2IfvgPhase3CanaryGate({
  ...baseInput,
  canaryMode: "disabled"
});
assert.equal(disabled.status, "disabled");
assert.equal(disabled.migrationMode, "legacy_authoritative");
assert.equal(disabled.phase3CompletionReviewReady, false);

const disabledCollector = spawnSync(
  process.execPath,
  [path.join(workspace, "scripts", "collect-v2-ifvg-live-shadow.mjs")],
  {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      V2_IFVG_LIVE_SHADOW_MODE: "disabled",
      MT5_READONLY_BRIDGE_URL: "http://127.0.0.1:1"
    }
  }
);
assert.equal(disabledCollector.status, 0, disabledCollector.stderr);
const disabledCollectorResult = JSON.parse(disabledCollector.stdout);
assert.equal(disabledCollectorResult.status, "disabled");
assert.equal(disabledCollectorResult.networkRequestsMade, 0);
assert.equal(disabledCollectorResult.observationPersisted, false);

const assertCompact = (value, label) => {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /"candles"\s*:|rawCandles|rawRuntimeSnapshot|rawSnapshot|accountData|orderData|positionData|password|secret|apiKey|token|mt5Credentials|base64/i,
    `${label} must remain compact`
  );
  assert.deepEqual(value.authority, authority);
};
assertCompact(positive, "positive lifecycle artifact");
assertCompact(negative, "negative lifecycle artifact");
assertCompact(missingIdentity, "blocked canary gate");
assertCompact(ready, "ready canary gate");

console.log(JSON.stringify({
  status: "passed",
  phase: "3E",
  scope: "ifvg_phase3_research_lifecycle_and_completion_gate",
  frozenPositiveCanaryPreserved: missingIdentity.positiveCanaryPreserved,
  negativeControlPreserved: missingIdentity.negativeControlPreserved,
  currentBaselineGateStatus: missingIdentity.status,
  currentResearchLifecycleParity: missingIdentity.researchLifecycleParity,
  identityMatchedFixtureCanReachReview: ready.phase3CompletionReviewReady,
  mismatchedHistoricalSourceBlocked: sourceMismatch.status === "blocked_insufficient_comparison_data",
  negativeControlPromotionBlocked: negativeControlRegression.status === "blocked_regression",
  liveRegressionBlocked: liveRegression.status === "blocked_regression",
  rollbackSwitchNetworkRequests: disabledCollectorResult.networkRequestsMade,
  productionAdoptionAllowed: false,
  phase4ImplementationAuthorized: false,
  rawCandlesSerialized: false,
  authority
}, null, 2));
