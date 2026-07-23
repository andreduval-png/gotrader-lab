#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-context-foundation-test");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2TimeNormalization.ts",
  "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContract.ts",
  "src/lib/v2/time/v2Mt5OffsetRegimeTypes.ts",
  "src/lib/v2/time/v2Mt5OffsetRegimeLedger.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
  "src/lib/v2/candles/v2Mt5TimeNormalizedAdapter.ts",
  "src/lib/v2/context/v2ContextTypes.ts",
  "src/lib/v2/context/v2ContextIdentity.ts",
  "src/lib/v2/context/v2ContextEligibility.ts",
  "src/lib/v2/context/v2SessionOpeningFactEngine.ts",
  "src/lib/v2/context/v2ContextBuilder.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const authorityModule = await load("v2Authority");
const identityModule = await load("v2Identity");
const mt5Module = await load("v2Mt5TimeNormalizedAdapter");
const contextTypes = await load("v2ContextTypes");
const contextIdentity = await load("v2ContextIdentity");
const contextBuilder = await load("v2ContextBuilder");

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
assert.deepEqual(authorityModule.V2_AUTHORITY_NONE, authority);

const mt5Source = identityModule.createV2SourceIdentity({
  sourceId: "mt5:USTECH:1m",
  provider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "mt5-live-fingerprint",
  sourceKind: "mt5_read_only"
});
const liveContract = Object.freeze({
  contractId: "gotrader-mt5-readonly-time-contract",
  version: "1.1.0",
  providerTimeBasis: "mt5_server_wall_clock",
  dstPolicy: "unknown",
  configurationSource: "provider_metadata",
  verificationStatus: "observed_candidate",
  verificationSources: ["terminal_clock_probe_current_live", "tick_candle_basis_comparison"],
  rawServerTime: Date.UTC(2026, 6, 22, 21, 1) / 1_000,
  systemTimeUtc: "2026-07-22T18:01:30.000Z",
  rawLatestCandleTime: Date.UTC(2026, 6, 22, 21, 0) / 1_000,
  tickCandleBasisAgreement: true,
  observationSummary: {
    observationCount: 0,
    acceptedObservationCount: 0,
    winterObservationCount: 0,
    summerObservationCount: 0,
    fixedOffsetObservationCount: 0
  },
  terminalProbeSchemaVersion: "1.0.0",
  terminalProbeObservationId: "PHASE2A0-1",
  terminalProbeInstanceId: "ABCDEF12",
  terminalProbeCapturedAt: "2026-07-22T18:00:00.000Z",
  terminalBasisClassification: "verified_trade_server_wall_clock",
  pythonTransportBasis: "matches_symbol_quote_time",
  terminalObservedOffsetMinutes: 180,
  terminalEvidenceStatus: "verified_current_live",
  terminalClockClassificationVersion: "1.0.0",
  timeVerificationScope: "current_live",
  currentLiveTimeBasisVerified: true,
  historicalDstPolicyVerified: false,
  phase2Eligible: false,
  strategySessionTimezone: "America/New_York",
  readOnly: true,
  marketDataOnly: true,
  blockers: [],
  warnings: [],
  authority,
  ...authority
});
const liveFeed = Object.freeze({
  feedId: mt5Source.sourceId,
  requestedSymbol: mt5Source.requestedSymbol,
  brokerSymbol: mt5Source.brokerSymbol,
  symbol: mt5Source.brokerSymbol,
  timeframe: "1m",
  candleFingerprint: mt5Source.sourceFingerprint,
  candles: Object.freeze([{
    rawProviderTime: Date.UTC(2026, 6, 22, 21, 0) / 1_000,
    open: 20_000,
    high: 20_010,
    low: 19_995,
    close: 20_005,
    volume: 100,
    closed: true
  }]),
  connectionStatus: "connected",
  receivedAt: "2026-07-22T18:01:30.000Z",
  timeContract: liveContract
});
const liveRepository = mt5Module.createV2Mt5TimeNormalizedRepository({
  asOf: () => "2026-07-22T18:01:30.000Z",
  loadFeed: async () => liveFeed
});
const liveWindow = await liveRepository.getWindow({
  source: mt5Source,
  timeframe: "1m",
  limit: 5,
  closedOnly: true,
  purpose: "context_shadow"
});
assert.equal(liveWindow.diagnostics.status, "eligible");
assert.equal(liveWindow.timeEligibility.currentLiveEligible, true);
assert.equal(liveWindow.timeEligibility.historicalEligible, false);
assert.equal(liveWindow.timeEligibility.offsetRegimeStartUtc, "2026-07-22T18:00:00.000Z");
assert.equal(liveWindow.identity.timeVerificationScope, "current_live");
const historicalQueryFromCurrentLive = await liveRepository.getWindow({
  source: mt5Source,
  timeframe: "1m",
  limit: 5,
  closedOnly: true,
  purpose: "replay"
});
assert.equal(historicalQueryFromCurrentLive.diagnostics.status, "blocked");
assert.equal(historicalQueryFromCurrentLive.evidencePolicy.mayCreateEvidence, false);
assert.ok(historicalQueryFromCurrentLive.diagnostics.warnings.some((warning) =>
  warning.includes("historically verified time normalization")
));

const liveRequest = {
  source: mt5Source,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: "2026-07-22T18:01:30.000Z",
  requiredTimeframes: ["1m"],
  windows: [liveWindow],
  purpose: "current_live_shadow",
  builtAt: "2026-07-22T18:01:31.000Z"
};
const liveContext = await contextBuilder.buildV2CanonicalMarketContext(liveRequest);
assert.equal(liveContext.diagnostics.status, "eligible");
assert.equal(liveContext.shadowOnly, true);
assert.equal(liveContext.facts.length, 0, "Phase 2A.0 must not invent market facts before fact engines exist.");
assert.equal(liveContext.diagnostics.factEngineStatus, "not_implemented_phase_2a0");
assert.deepEqual(liveContext.authority, authority);
assert.equal(liveContext.contextSchemaVersion, contextTypes.V2_CONTEXT_SCHEMA_VERSION);

const rebuilt = await contextBuilder.buildV2CanonicalMarketContext({
  ...liveRequest,
  builtAt: "2026-07-22T18:01:59.000Z"
});
assert.equal(liveContext.contextArtifactId, rebuilt.contextArtifactId, "Operational build time must not affect stable context identity.");
assert.notEqual(liveContext.builtAt, rebuilt.builtAt);
assert.equal(Object.isFrozen(liveContext), true);
assert.equal(Object.isFrozen(liveContext.identity.inputWindows), true);
assert.equal(Object.isFrozen(liveContext.facts), true);

const expired = await contextBuilder.buildV2CanonicalMarketContext({
  ...liveRequest,
  asOfMarketTime: "2026-07-22T18:02:01.000Z"
});
assert.equal(expired.diagnostics.status, "blocked");
assert.ok(expired.diagnostics.blockers.includes("current_live_verification_expired:1m"));

const preVerificationWindow = Object.freeze({
  ...liveWindow,
  identity: Object.freeze({ ...liveWindow.identity, dataWindowStart: "2026-07-22T17:59:00.000Z" })
});
const preVerification = await contextBuilder.buildV2CanonicalMarketContext({
  ...liveRequest,
  windows: [preVerificationWindow]
});
assert.equal(preVerification.diagnostics.status, "blocked");
assert.ok(preVerification.diagnostics.blockers.includes("window_precedes_verified_offset_regime:1m"));

const fixtureSource = identityModule.createV2SourceIdentity({
  sourceId: "import:fixture",
  provider: "imported_historical",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "fixture-fingerprint",
  sourceKind: "imported_historical"
});
const diagnostics = Object.freeze({
  status: "eligible",
  inputCount: 1,
  candleCount: 1,
  rejectedCount: 0,
  duplicateCount: 0,
  conflictingDuplicateCount: 0,
  outOfOrderCount: 0,
  invalidOhlcCount: 0,
  invalidVolumeCount: 0,
  invalidTimestampCount: 0,
  partialCandleCount: 0,
  closureUnknownCount: 0,
  futureTimestampCount: 0,
  gapCount: 0,
  stale: false,
  missingTimeframes: Object.freeze([]),
  warnings: Object.freeze([]),
  blockers: Object.freeze([]),
  repairPolicy: "reject_invalid_sort_ascending_deduplicate_identical"
});
const fixtureWindow = async (timeframe, start, end) => {
  const identity = await identityModule.buildV2MarketDataIdentity({
    source: fixtureSource,
    timeframeFingerprints: { [timeframe]: `${fixtureSource.sourceFingerprint}:${timeframe}` },
    dataWindowStart: start,
    dataWindowEnd: end,
    lastClosedCandle: end,
    candleCountByTimeframe: { [timeframe]: 1 }
  });
  return Object.freeze({
    identity,
    candles: Object.freeze([Object.freeze({
      openTime: start,
      closeTime: end,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      isClosed: true,
      closureSource: "historical_dataset"
    })]),
    diagnostics,
    capability: authorityModule.V2_MARKET_DATA_READ_ONLY,
    evidencePolicy: Object.freeze({
      evidencePurpose: false,
      sourceEligible: true,
      dataQualityEligible: true,
      mayCreateEvidence: false,
      repositoryCreatesEvidence: false,
      reason: "Shadow fixture creates no evidence."
    }),
    adapterId: "fixture",
    adapterVersion: "1",
    shadowOnly: true
  });
};
const fixture5m = await fixtureWindow("5m", "2026-06-12T14:00:00.000Z", "2026-06-12T14:05:00.000Z");
const fixture15m = await fixtureWindow("15m", "2026-06-12T14:00:00.000Z", "2026-06-12T14:15:00.000Z");
const fixtureRequest = {
  source: fixtureSource,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: "2026-06-12T14:30:00.000Z",
  requiredTimeframes: ["5m", "15m"],
  windows: [fixture5m, fixture15m],
  purpose: "deterministic_fixture",
  builtAt: "2026-06-12T14:31:00.000Z"
};
const fixtureA = await contextBuilder.buildV2CanonicalMarketContext(fixtureRequest);
const fixtureB = await contextBuilder.buildV2CanonicalMarketContext({ ...fixtureRequest, windows: [fixture15m, fixture5m] });
assert.equal(fixtureA.diagnostics.status, "eligible");
assert.equal(fixtureA.contextArtifactId, fixtureB.contextArtifactId, "Input window ordering must not affect context identity.");
assert.deepEqual(fixtureA.identity.inputWindows.map((item) => item.timeframe), ["15m", "5m"]);

const missingTimeframe = await contextBuilder.buildV2CanonicalMarketContext({
  ...fixtureRequest,
  windows: [fixture5m]
});
assert.equal(missingTimeframe.diagnostics.status, "blocked");
assert.ok(missingTimeframe.diagnostics.missingTimeframes.includes("15m"));

const factCore = {
  kind: "session",
  identityRef: fixtureA.identity.identityHash,
  payload: {
    sessionType: "new_york_morning",
    sessionDate: "2026-06-12",
    timezone: "America/New_York",
    startUtc: "2026-06-12T13:30:00.000Z",
    endUtc: "2026-06-12T16:00:00.000Z",
    complete: true,
    sourceTimeframes: ["5m"]
  },
  timeframe: "5m",
  observedMarketTime: "2026-06-12T16:00:00.000Z",
  causalClosedCandleTime: "2026-06-12T16:00:00.000Z",
  validFrom: "2026-06-12T16:00:00.000Z",
  quality: { status: "eligible", confidenceClass: "exact", warnings: [], blockers: [] },
  derivation: {
    policyId: "session-fixture",
    policyVersion: "1",
    inputWindowIdentityHashes: [fixture5m.identity.identityHash],
    inputFactIds: []
  },
  authority
};
const factIdA = await contextIdentity.buildV2MarketFactId(factCore);
const factIdB = await contextIdentity.buildV2MarketFactId({ ...factCore });
const factIdChanged = await contextIdentity.buildV2MarketFactId({
  ...factCore,
  payload: { ...factCore.payload, complete: false }
});
assert.equal(factIdA, factIdB);
assert.notEqual(factIdA, factIdChanged);

const serialized = JSON.stringify({ liveContext, fixtureA });
assert.doesNotMatch(serialized, /"candles"\s*:/i);
assert.doesNotMatch(serialized, /rawProvider|password|secret|apiKey|accountData|orderData|positionData/i);

const sourceFilesOutsideV2 = [];
const collect = (directory) => {
  if (directory === path.join(workspace, "src", "lib", "v2")) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else if (/\.(?:ts|tsx)$/.test(entry.name)) sourceFilesOutsideV2.push(fullPath);
  }
};
for (const entry of fs.readdirSync(path.join(workspace, "src"), { withFileTypes: true })) {
  const fullPath = path.join(workspace, "src", entry.name);
  if (entry.isDirectory()) collect(fullPath);
}
const productionAdoptions = sourceFilesOutsideV2.filter((file) =>
  /(?:@\/lib\/v2\/context|lib\/v2\/context|V2CanonicalMarketContext)/.test(fs.readFileSync(file, "utf8"))
);
assert.deepEqual(productionAdoptions, [], `Unexpected V2 context production adoption: ${productionAdoptions.join(", ")}`);

const contextSource = fs.readdirSync(path.join(workspace, "src", "lib", "v2", "context"))
  .filter((file) => file.endsWith(".ts"))
  .map((file) => fs.readFileSync(path.join(workspace, "src", "lib", "v2", "context", file), "utf8"))
  .join("\n");
assert.doesNotMatch(contextSource, /ict-strategy-suite|researchCycle|validationChain|paperDemo|components\//i);
assert.doesNotMatch(contextSource, /placeOrder|buyMarket|sellMarket|executeTrade|readinessOverrideAuthority:\s*"(?!none)/i);

console.log(JSON.stringify({
  status: "passed",
  contextSchemaVersion: contextTypes.V2_CONTEXT_SCHEMA_VERSION,
  contextPolicyVersion: contextTypes.V2_CONTEXT_POLICY_VERSION,
  currentLiveShadowEligible: liveContext.diagnostics.status === "eligible",
  historicalEligibilityRequiredForCurrentLive: false,
  currentLiveContractBlockedFromReplay: historicalQueryFromCurrentLive.diagnostics.status === "blocked",
  expiredObservationBlocked: expired.diagnostics.status === "blocked",
  preVerificationWindowBlocked: preVerification.diagnostics.status === "blocked",
  multiWindowIdentityStable: fixtureA.contextArtifactId === fixtureB.contextArtifactId,
  defaultFactFamiliesRequested: false,
  defaultFactCount: liveContext.facts.length,
  productionAdoptions: productionAdoptions.length,
  rawCandleArraysSerialized: false,
  authority
}, null, 2));
