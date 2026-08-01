#!/usr/bin/env node

import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanonicalResearchNodeStorage } from "./support/canonical-research-node-storage.mjs";
import {
  CANONICAL_RESEARCH_B1_2_PREPARATION_BOUNDARY,
  CanonicalResearchShadowContextAdapter
} from "./support/canonical-research-shadow-context-adapter.mjs";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "b1-shadow-adapter-modules");
const testRoot = path.join(workspace, ".gotrader", "b1-shadow-adapter-test");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/context/v2ContextTypes.ts",
  "src/lib/v2/context/v2ContextIdentity.ts",
  "src/lib/v2/context/v2ContextEligibility.ts",
  "src/lib/v2/context/v2SessionOpeningFactEngine.ts",
  "src/lib/v2/context/v2DealingRangeLiquidityFactEngine.ts",
  "src/lib/v2/context/v2DisplacementFvgFactEngine.ts",
  "src/lib/v2/context/v2HigherTimeframeBiasFactEngine.ts",
  "src/lib/v2/context/v2ContextBuilder.ts",
  "src/lib/canonicalResearch/contracts/canonicalResearchTypes.ts",
  "src/lib/canonicalResearch/authority/canonicalResearchAuthority.ts",
  "src/lib/canonicalResearch/contracts/canonicalLineageTypes.ts",
  "src/lib/canonicalResearch/contracts/canonicalResearchValidation.ts",
  "src/lib/canonicalResearch/identity/canonicalResearchIdentity.ts",
  "src/lib/canonicalResearch/identity/canonicalResearchArtifactIdentity.ts",
  "src/lib/canonicalResearch/repository/canonicalResearchRepositoryTypes.ts",
  "src/lib/canonicalResearch/repository/canonicalResearchFileRepository.ts",
  "src/lib/canonicalResearch/engine/canonicalResearchEngine.ts"
].map((file) => path.join(workspace, file));

const clone = (value) => JSON.parse(JSON.stringify(value));
const walkFiles = async (root) => {
  const output = [];
  const visit = async (directory) => {
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else output.push(target);
    }
  };
  await visit(root);
  return output;
};

await fs.rm(testRoot, { recursive: true, force: true });
compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) =>
  import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const authority = await load("canonicalResearchAuthority");
const identity = await load("v2Identity");
const candleWindow = await load("v2CandleWindowBuilder");
const contextBuilder = await load("v2ContextBuilder");
const serialization = await load("canonicalSerialization");
const researchTypes = await load("canonicalResearchTypes");
const repositoryModule = await load("canonicalResearchFileRepository");
const engineModule = await load("canonicalResearchEngine");

const sourceFingerprint = "a3-recorded-source-fingerprint-20260730";
const timeVerificationArtifactId = "a3-time-proof-20260730";
const source = identity.createV2SourceIdentity({
  sourceId: "mt5:USTECH:runtime-a3-recorded",
  provider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint,
  sourceKind: "mt5_read_only"
});
const asOf = "2026-07-30T18:30:00.000Z";
const receivedAt = "2026-07-30T18:30:05.000Z";
const verification = Object.freeze({
  currentLiveEligible: true,
  historicalEligible: false,
  boundedHistoricalContextEligible: true,
  boundedHistoricalContextArtifactId: "a3-bounded-hydration-20260730",
  verificationScope: "current_live",
  verifiedAtUtc: "2026-07-30T18:29:30.000Z",
  currentLiveValidUntilUtc: "2026-07-30T18:35:00.000Z",
  offsetRegimeStartUtc: "2026-07-30T12:00:00.000Z",
  offsetRegimeId: "a3-offset-regime-20260730",
  blockers: Object.freeze([]),
  warnings: Object.freeze(["historical_dst_policy_unverified"])
});
const timeframeMilliseconds = Object.freeze({
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000
});
const requiredTimeframes = Object.freeze(["5m", "15m", "1h", "4h", "1d"]);

const buildWindow = async (timeframe, index) => {
  const interval = timeframeMilliseconds[timeframe];
  const end = Date.parse(asOf);
  const candles = Array.from({ length: 8 }, (_, candleIndex) => {
    const closeTime = end - (7 - candleIndex) * interval;
    const openTime = closeTime - interval;
    const price = 20_000 + index * 100 + candleIndex * 4;
    return Object.freeze({
      openTime: new Date(openTime).toISOString(),
      closeTime: new Date(closeTime).toISOString(),
      open: price,
      high: price + 8,
      low: price - 5,
      close: price + 3,
      volume: 100 + candleIndex,
      isClosed: true
    });
  });
  return candleWindow.buildV2CanonicalCandleWindow({
    adapterId: "gotrader-runtime-a3-recorded-fixture",
    adapterVersion: "a3-recorded-context-v1",
    asOf,
    closurePolicy: "explicit_closed",
    legacyCandles: candles,
    query: {
      source,
      timeframe,
      limit: candles.length,
      closedOnly: true,
      purpose: "context_shadow"
    },
    source,
    sourceStale: false,
    sourceWarnings: [],
    timeNormalizationPolicyId: "gotrader-a3-current-live-normalization-v1",
    timeNormalizationPolicyVersion: "1",
    timeContractId: timeVerificationArtifactId,
    timeContractVersion: "1.1.0",
    timeContractVerificationStatus: "verified",
    terminalClockClassificationVersion: "1.0.0",
    timeVerificationScope: "current_live",
    sourceTimeEligibility: verification
  });
};

const windows = [];
for (const [index, timeframe] of requiredTimeframes.entries()) {
  windows.push(await buildWindow(timeframe, index));
}
const contextRequest = Object.freeze({
  source,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: asOf,
  requiredTimeframes,
  windows: Object.freeze(windows),
  purpose: "current_live_shadow",
  requestedFactFamilies: Object.freeze([
    "session",
    "opening_price",
    "dealing_range",
    "liquidity",
    "displacement",
    "fair_value_gap",
    "higher_timeframe_bias"
  ]),
  builtAt: receivedAt
});
const accepted = await contextBuilder.buildV2CanonicalMarketContext(contextRequest);
assert.notEqual(accepted.diagnostics.status, "blocked");

const event = Object.freeze({
  type: "candle_closed",
  eventId: "mt5-candle-closed:USTECH:5m:2026-07-30T18:30:00.000Z",
  candleIdentity: "mt5-close:USTECH:5m:2026-07-30T18:30:00.000Z",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceProvider: "mt5_read_only",
  sourceFingerprint,
  timeVerificationArtifactId,
  timeContractVersion: "1.1.0",
  observedMarketTime: asOf,
  receivedAt,
  currentLiveEligible: true,
  verificationProofState: "fresh"
});
const acceptedContext = Object.freeze({
  artifactId: "shadow_context_recorded_20260730",
  contextArtifactId: accepted.contextArtifactId,
  contextSchemaVersion: accepted.contextSchemaVersion,
  triggerEventId: event.eventId,
  triggerCloseId: event.candleIdentity,
  requestedSymbol: event.requestedSymbol,
  brokerSymbol: event.brokerSymbol,
  triggerTimeframe: event.timeframe,
  sourceFingerprint,
  timeVerificationArtifactId,
  inputWindowIdentityHashes: Object.freeze(
    windows.map((window) => window.identity.identityHash)
  ),
  status: "completed",
  shadowOnly: true,
  rawCandlesPersisted: false,
  rawFactsPersisted: false,
  canCreateEvidence: false,
  evidenceCreated: false,
  readinessChanged: false,
  productionAdoptionAllowed: false,
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const storageRoot = path.join(testRoot, "repository");
const storage = createCanonicalResearchNodeStorage({ root: storageRoot });
const repository = new repositoryModule.CanonicalResearchFileRepository({
  storage: storage.adapter,
  profileId: "b1_2_recorded_context_test"
});
const engine = new engineModule.CanonicalResearchEngine({
  repository,
  leaseOwner: "b1-2-recorded-worker"
});

const adapterDependencies = Object.freeze({
  contextBuilder: contextBuilder.buildV2CanonicalMarketContext,
  canonicalHash: serialization.canonicalHash,
  jobSchemaVersion: researchTypes.CANONICAL_RESEARCH_JOB_SCHEMA_VERSION
});
const disabledAdapter = new CanonicalResearchShadowContextAdapter({
  engine,
  ...adapterDependencies
});
const disabled = await disabledAdapter.run({ event, contextRequest, acceptedContext });
assert.equal(disabled.status, "disabled");
assert.deepEqual(disabled.blockers, ["b1_2_shadow_adapter_not_activated"]);
assert.equal((await walkFiles(storageRoot)).length, 0);
assert.equal(disabledAdapter.status().runtimeRegistered, false);
assert.equal(disabledAdapter.status().schedulerRegistered, false);
assert.equal(disabledAdapter.status().liveConsumptionEnabled, false);

const adapter = new CanonicalResearchShadowContextAdapter({
  engine,
  mode: "recorded_artifact_test",
  ...adapterDependencies
});
const first = await adapter.run({ event, contextRequest, acceptedContext });
assert.equal(first.status, "completed");
assert.equal(first.admissionDisposition, "created");
assert.equal(first.contextArtifactId, accepted.contextArtifactId);
assert.equal(first.contextIdentity, accepted.identity.identityHash);
assert.deepEqual(first.authority, authority.CANONICAL_RESEARCH_AUTHORITY_NONE);
assert.deepEqual(first.capabilities, authority.CANONICAL_RESEARCH_CAPABILITIES_DISABLED);

const duplicate = await adapter.run({
  event,
  contextRequest: { ...contextRequest, windows: [...windows].reverse() },
  acceptedContext
});
assert.equal(duplicate.status, "completed");
assert.equal(duplicate.admissionDisposition, "coalesced");
assert.equal(duplicate.logicalJobId, first.logicalJobId);
assert.equal(duplicate.resultArtifactId, first.resultArtifactId);
assert.equal(adapter.status().counters.coalesced, 1);

const mismatch = await adapter.run({
  event,
  contextRequest,
  acceptedContext: {
    ...acceptedContext,
    contextArtifactId: `v2-context:${"f".repeat(64)}`
  }
});
assert.equal(mismatch.status, "blocked");
assert.ok(mismatch.blockers.includes("accepted_context_identity_mismatch"));
assert.equal(adapter.status().counters.identityMismatches, 1);

const stale = await adapter.run({
  event: { ...event, verificationProofState: "stale" },
  contextRequest,
  acceptedContext
});
assert.equal(stale.status, "blocked");
assert.ok(stale.blockers.includes("current_live_time_verification_not_fresh"));

const wrongScope = await adapter.run({
  event: { ...event, brokerSymbol: "US500" },
  contextRequest,
  acceptedContext
});
assert.equal(wrongScope.status, "blocked");
assert.ok(wrongScope.blockers.includes("b1_2_trigger_scope_invalid"));

const unsafeContext = await adapter.run({
  event,
  contextRequest,
  acceptedContext: { ...acceptedContext, canCreateEvidence: true }
});
assert.equal(unsafeContext.status, "blocked");
assert.ok(unsafeContext.blockers.includes("accepted_context_safety_boundary_invalid"));

const restartStorage = createCanonicalResearchNodeStorage({ root: storageRoot });
const restartRepository = new repositoryModule.CanonicalResearchFileRepository({
  storage: restartStorage.adapter,
  profileId: "b1_2_recorded_context_test"
});
const restartEngine = new engineModule.CanonicalResearchEngine({
  repository: restartRepository,
  leaseOwner: "b1-2-restart-worker"
});
const restartAdapter = new CanonicalResearchShadowContextAdapter({
  engine: restartEngine,
  mode: "recorded_artifact_test",
  ...adapterDependencies
});
const restarted = await restartAdapter.run({ event, contextRequest, acceptedContext });
assert.equal(restarted.status, "completed");
assert.equal(restarted.admissionDisposition, "coalesced");
assert.equal(restarted.resumed, true);
assert.equal(restarted.resultArtifactId, first.resultArtifactId);
assert.equal((await restartRepository.loadLineageNodes()).length, 3);
assert.equal((await restartRepository.loadRelationships()).length, 2);

const persistedFiles = await walkFiles(storageRoot);
const persistedText = (
  await Promise.all(persistedFiles.map((file) => fs.readFile(file, "utf8")))
).join("\n");
assert.doesNotMatch(persistedText, /"candles"\s*:/i);
assert.doesNotMatch(persistedText, /"facts"\s*:/i);
assert.doesNotMatch(
  persistedText,
  /rawProvider|apiKey|password|secret|accountData|orderData|positionData|placeOrder|buyMarket|sellMarket/i
);
assert.doesNotMatch(persistedText, /"open"\s*:|"high"\s*:|"low"\s*:|"close"\s*:/i);

const schedulerSource = await fs.readFile(
  path.join(workspace, "scripts", "gotrader-autonomous-scheduler-core.mjs"),
  "utf8"
);
const runtimeProfileSource = await fs.readFile(
  path.join(workspace, "src", "lib", "alwaysOnRuntime", "alwaysOnRuntimeProfile.ts"),
  "utf8"
);
assert.doesNotMatch(schedulerSource, /b1[_-].*context|canonicalResearchShadowContext/i);
assert.doesNotMatch(runtimeProfileSource, /b1[_-].*context|canonicalResearchShadowContext/i);
assert.equal(
  CANONICAL_RESEARCH_B1_2_PREPARATION_BOUNDARY.runtimeRegistrationAllowed,
  false
);
assert.equal(
  CANONICAL_RESEARCH_B1_2_PREPARATION_BOUNDARY.liveEventConsumptionAllowed,
  false
);
assert.deepEqual(
  CANONICAL_RESEARCH_B1_2_PREPARATION_BOUNDARY.authority,
  authority.CANONICAL_RESEARCH_AUTHORITY_NONE
);

console.log(JSON.stringify({
  status: "passed",
  profile: "b1_2_recorded_context_test",
  contextArtifactId: accepted.contextArtifactId,
  logicalJobId: first.logicalJobId,
  resultArtifactId: first.resultArtifactId,
  counters: adapter.status().counters,
  persistedArtifactCount: persistedFiles.length,
  liveRuntimeRegistered: false,
  schedulerRegistered: false,
  authority: first.authority
}, null, 2));
