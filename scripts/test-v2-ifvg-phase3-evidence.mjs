#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const fixtureRoot = path.join(workspace, "tests", "fixtures", "v2-baseline");
const outRoot = path.join(workspace, ".gotrader", "v2-ifvg-phase3-evidence-test");
const sourceFiles = [
  "src/lib/v2Baseline/baselineTypes.ts",
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/evidence/v2HistoricalDatasetManifestTypes.ts",
  "src/lib/v2/evidence/v2HistoricalDatasetManifest.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3CanaryTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3BaselineAdapter.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3EvidenceTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3Evidence.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3CanaryGate.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const serialization = await load("canonicalSerialization");
const manifestModule = await load("v2HistoricalDatasetManifest");
const adapter = await load("v2IfvgPhase3BaselineAdapter");
const evidence = await load("v2IfvgPhase3Evidence");
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

const startMs = Date.parse("2026-01-15T00:00:00.000Z");
const candles = Array.from({ length: 180 }, (_, index) => {
  const openTime = new Date(startMs + index * 300_000).toISOString();
  const closeTime = new Date(startMs + (index + 1) * 300_000).toISOString();
  const open = 20_000 + index * 2;
  const close = open + (index % 2 ? -1 : 1);
  return Object.freeze({
    openTime,
    closeTime,
    open,
    high: Math.max(open, close) + 2,
    low: Math.min(open, close) - 2,
    close,
    volume: 100 + index,
    isClosed: true,
    closureSource: "historical_dataset"
  });
});
const manifestInput = Object.freeze({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  provider: "mt5_read_only",
  timeframe: "5m",
  timeNormalizationPolicyId: "gotrader-v2-mt5-verified-utc",
  timeNormalizationPolicyVersion: "1",
  timeContractId: "gotrader-mt5-readonly-time-contract",
  timeContractVersion: "1.1.0",
  timeContractVerificationStatus: "verified",
  offsetRegimeVersion: "terminal-verified-historical-v1",
  historicalTimeEligible: true,
  warnings: ["USTECH is an MT5 CFD/proxy source for MNQ-style research."]
});
const manifest = await manifestModule.buildV2HistoricalDatasetManifest(manifestInput, candles);
const reordered = await manifestModule.buildV2HistoricalDatasetManifest(
  manifestInput,
  [...candles].reverse()
);
assert.equal(manifest.datasetChecksum, reordered.datasetChecksum);
assert.equal(manifest.datasetId, reordered.datasetId);
assert.equal(manifest.candleCount, candles.length);
assert.equal((await manifestModule.validateV2HistoricalDatasetManifest(manifest)).status, "accepted");
await assert.rejects(
  () => manifestModule.buildV2HistoricalDatasetManifest(manifestInput, [...candles, candles[0]]),
  /duplicate/
);
const changed = candles.map((candle, index) =>
  index === 20 ? Object.freeze({ ...candle, close: candle.close + 0.25, high: candle.high + 0.25 }) : candle
);
const changedManifest = await manifestModule.buildV2HistoricalDatasetManifest(manifestInput, changed);
assert.notEqual(manifest.datasetChecksum, changedManifest.datasetChecksum);
assert.notEqual(manifest.canonicalSourceFingerprint, changedManifest.canonicalSourceFingerprint);
const ineligibleManifest = await manifestModule.buildV2HistoricalDatasetManifest(
  {
    ...manifestInput,
    timeContractVerificationStatus: "observed_candidate",
    historicalTimeEligible: false
  },
  candles
);
assert.equal(
  (await manifestModule.validateV2HistoricalDatasetManifest(ineligibleManifest)).status,
  "blocked"
);

const iso = (index) => candles[index].openTime;
const endIso = (index) => candles[index].closeTime;
const buildInput = ({
  positiveParameterFingerprint = positive.parameterFingerprint,
  positiveCostModel = positive.costModel,
  negativeParameterFingerprint = negative.parameterFingerprint,
  negativeCostModel = negative.costModel,
  v3ReplayActual = positive.replay,
  v3OosActual = positive.oos,
  v2ReplayActual = negative.replay,
  v2OosActual = negative.oos
} = {}) => ({
  generatedAtUtc: "2026-07-23T16:00:00.000Z",
  datasetManifest: manifest,
  positiveCanary: {
    baselineSnapshotHash: positive.baselineSnapshotHash,
    parameterFingerprint: positiveParameterFingerprint,
    costModel: positiveCostModel,
    replayExpected: positive.replay,
    replayActual: v3ReplayActual,
    oosExpected: positive.oos,
    oosActual: v3OosActual,
    replayBoundaries: [{
      boundaryId: "v3-full-replay",
      role: "full_replay",
      startTimeUtc: iso(0),
      endTimeUtc: endIso(179)
    }],
    oosBoundaries: [{
      boundaryId: "v3-trailing-third-oos",
      role: "oos",
      startTimeUtc: iso(120),
      endTimeUtc: endIso(179)
    }]
  },
  negativeControl: {
    baselineSnapshotHash: negative.baselineSnapshotHash,
    parameterFingerprint: negativeParameterFingerprint,
    costModel: negativeCostModel,
    replayExpected: negative.replay,
    replayActual: v2ReplayActual,
    oosExpected: negative.oos,
    oosActual: v2OosActual,
    replayBoundaries: [
      {
        boundaryId: "v2-independent-window",
        role: "independent_window",
        startTimeUtc: iso(0),
        endTimeUtc: endIso(89)
      },
      {
        boundaryId: "v2-current-window",
        role: "current_window",
        startTimeUtc: iso(90),
        endTimeUtc: endIso(179)
      }
    ],
    oosBoundaries: [{
      boundaryId: "v2-independent-oos",
      role: "oos",
      startTimeUtc: iso(0),
      endTimeUtc: endIso(89)
    }]
  }
});

const bundle = await evidence.buildV2IfvgPhase3EvidenceBundle(buildInput());
const file = await evidence.buildV2IfvgPhase3EvidenceFile(bundle);
const accepted = await evidence.validateV2IfvgPhase3EvidenceFile(file);
assert.equal(accepted.status, "accepted");
assert.equal(accepted.summary.sourceIdentityMatches, true);
assert.equal(accepted.summary.parameterIdentityMatches, true);
assert.equal(accepted.summary.costModelIdentityMatches, true);
assert.equal(accepted.summary.boundaryIdentityComplete, true);
assert.equal(accepted.summary.metricsExact, true);
assert.equal(new Set(Object.values(bundle.artifacts).map((item) => item.dataset.datasetId)).size, 1);
assert.notEqual(
  bundle.artifacts.v3Replay.parameterFingerprint,
  bundle.artifacts.v2Replay.parameterFingerprint
);

const wrongParameterBundle = await evidence.buildV2IfvgPhase3EvidenceBundle(
  buildInput({ positiveParameterFingerprint: "ifvg_fresh_retest_v3_research|drifted" })
);
const wrongParameter = await evidence.validateV2IfvgPhase3EvidenceFile(
  await evidence.buildV2IfvgPhase3EvidenceFile(wrongParameterBundle)
);
assert.equal(wrongParameter.status, "blocked");
assert.ok(wrongParameter.summary.blockers.includes("ifvg_phase3_parameter_fingerprint_mismatch"));

const rehashArtifact = async (artifact) => {
  const { artifactId, ...core } = artifact;
  return Object.freeze({ ...core, artifactId: await serialization.canonicalHash(core) });
};
const rehashBundle = async (original, artifacts) => {
  const core = {
    ...original,
    artifacts
  };
  delete core.bundleId;
  return Object.freeze({ ...core, bundleId: await serialization.canonicalHash(core) });
};
const refile = async (mutatedBundle) => evidence.buildV2IfvgPhase3EvidenceFile(mutatedBundle);

const badCostV3Oos = await rehashArtifact({
  ...bundle.artifacts.v3Oos,
  costModel: `${bundle.artifacts.v3Oos.costModel}; drift`
});
const badCostBundle = await rehashBundle(bundle, {
  ...bundle.artifacts,
  v3Oos: badCostV3Oos
});
const badCost = await evidence.validateV2IfvgPhase3EvidenceFile(await refile(badCostBundle));
assert.equal(badCost.status, "blocked");
assert.ok(badCost.summary.blockers.includes("ifvg_phase3_cost_model_mismatch"));

const mismatchedV2Replay = await rehashArtifact({
  ...bundle.artifacts.v2Replay,
  dataset: {
    ...bundle.artifacts.v2Replay.dataset,
    timeNormalizationPolicyVersion: "drifted"
  }
});
const mismatchedV2Oos = await rehashArtifact({
  ...bundle.artifacts.v2Oos,
  parentReplayArtifactId: mismatchedV2Replay.artifactId,
  dataset: {
    ...bundle.artifacts.v2Oos.dataset,
    timeNormalizationPolicyVersion: "drifted"
  }
});
const mismatchedDatasetBundle = await rehashBundle(bundle, {
  ...bundle.artifacts,
  v2Replay: mismatchedV2Replay,
  v2Oos: mismatchedV2Oos
});
const mismatchedDataset = await evidence.validateV2IfvgPhase3EvidenceFile(
  await refile(mismatchedDatasetBundle)
);
assert.equal(mismatchedDataset.status, "blocked");
assert.ok(
  mismatchedDataset.summary.blockers.includes("ifvg_phase3_replay_oos_source_identity_mismatch")
);

const regressionBundle = await evidence.buildV2IfvgPhase3EvidenceBundle(
  buildInput({
    v3ReplayActual: { ...positive.replay, averageR: positive.replay.averageR - 0.01 }
  })
);
const regression = await evidence.validateV2IfvgPhase3EvidenceFile(
  await evidence.buildV2IfvgPhase3EvidenceFile(regressionBundle)
);
assert.equal(regression.status, "regression");
assert.ok(regression.summary.blockers.includes("ifvg_phase3_regenerated_metrics_regression"));
assert.equal(regressionBundle.regressionReport.baselineModified, false);

const tamperedFile = {
  ...file,
  bundle: {
    ...file.bundle,
    generatedAtUtc: "2026-07-23T16:01:00.000Z"
  }
};
assert.equal((await evidence.validateV2IfvgPhase3EvidenceFile(tamperedFile)).status, "regression");

const deterministicParity = Object.freeze({
  detection: "exact_parity",
  geometry: "exact_parity",
  selection: "exact_parity"
});
const historicalOnlyGate = await gate.evaluateV2IfvgPhase3CanaryGate({
  canaryMode: "shadow",
  evaluatedAtUtc: "2026-07-23T16:00:00.000Z",
  deterministicParity,
  positiveCanary: positive,
  negativeControl: negative,
  historicalEvidence: accepted.summary
});
assert.equal(historicalOnlyGate.historicalEvidenceValidated, true);
assert.equal(historicalOnlyGate.researchLifecycleParity, "exact_parity");
assert.equal(historicalOnlyGate.liveShadowParity, "insufficient_comparison_data");
assert.equal(historicalOnlyGate.phase3CompletionReviewReady, false);
assert.ok(historicalOnlyGate.blockers.includes("ifvg_v3_live_shadow_ledger_missing"));

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
  canaryMode: "shadow",
  evaluatedAtUtc: "2026-07-23T16:00:00.000Z",
  deterministicParity,
  positiveCanary: positive,
  negativeControl: negative,
  historicalEvidence: accepted.summary,
  liveShadow
});
assert.equal(ready.status, "ready_for_completion_review");
assert.equal(ready.phase3CompletionReviewReady, true);
assert.equal(ready.phase4ImplementationAuthorized, false);
assert.equal(ready.productionAdoptionAllowed, false);
assert.equal(ready.canCreateEvidence, false);

const serialized = JSON.stringify({ manifest, bundle, accepted: accepted.summary, ready });
assert.doesNotMatch(
  serialized,
  /"(?:candles|rawCandles|rawRuntimeSnapshot|rawSnapshot|accountData|orderData|positionData|password|secret|apiKey|token|mt5Credentials|base64)"\s*:/i
);
assert.deepEqual(ready.authority, authority);
assert.equal(bundle.rawCandlesPersisted, false);

console.log(JSON.stringify({
  status: "passed",
  phase: "3F",
  scope: "ifvg_historical_dataset_and_lifecycle_evidence",
  dataset: {
    deterministicAcrossInputOrder: manifest.datasetId === reordered.datasetId,
    checksumChangesWithCandleContent: manifest.datasetChecksum !== changedManifest.datasetChecksum,
    candleCount: manifest.candleCount,
    rawCandlesPersisted: false
  },
  artifacts: {
    count: Object.keys(bundle.artifacts).length,
    sharedDatasetIdentity: accepted.summary.sourceIdentityMatches,
    frozenProfileParametersExact: accepted.summary.parameterIdentityMatches,
    costModelsExactWithinProfiles: accepted.summary.costModelIdentityMatches,
    boundariesComplete: accepted.summary.boundaryIdentityComplete,
    metricsExact: accepted.summary.metricsExact
  },
  regressionReporting: regression.status,
  historicalEvidenceGate: historicalOnlyGate.status,
  syntheticCompletionReviewGate: ready.status,
  liveLedgerCoverage: "test:v2-ifvg-live-shadow",
  phase4ImplementationAuthorized: false,
  productionAdoptionAllowed: false,
  authority
}, null, 2));
