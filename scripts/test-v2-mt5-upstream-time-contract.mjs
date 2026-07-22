#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const python = spawnSync("python", [path.join("scripts", "test-v2-mt5-upstream-time-contract.py")], {
  cwd: workspace,
  encoding: "utf8"
});
assert.equal(python.status, 0, python.stderr || python.stdout);

const outRoot = path.join(workspace, ".gotrader", "v2-mt5-upstream-time-contract-test");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2TimeNormalization.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContract.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
  "src/lib/v2/candles/v2Mt5TimeNormalizedAdapter.ts"
].map((file) => path.join(workspace, file));
compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const contracts = await load("v2Mt5UpstreamTimeContract");
const identity = await load("v2Identity");
const mt5Adapter = await load("v2Mt5TimeNormalizedAdapter");

const observation = ({ id, state, offset, timezone = "Europe/Helsinki" }) => Object.freeze({
  observationId: id,
  observedAtUtc: state === "standard" ? "2026-01-15T14:30:00.000Z" : "2026-07-15T13:30:00.000Z",
  rawProviderTime: state === "standard" ? 1_768_494_600 : 1_784_125_800,
  normalizedProviderTimeUtc: state === "standard" ? "2026-01-15T14:30:00.000Z" : "2026-07-15T13:30:00.000Z",
  systemUtc: state === "standard" ? "2026-01-15T14:30:01.000Z" : "2026-07-15T13:30:01.000Z",
  appliedTimezone: timezone,
  appliedOffsetMinutes: offset,
  expectedOffsetMinutes: offset,
  dstState: state,
  withinTolerance: true,
  source: "historical_capture"
});
const contract = (overrides = {}) => Object.freeze({
  contractId: "gotrader-mt5-readonly-time-contract",
  version: "1.0.0",
  providerTimeBasis: "mt5_server_wall_clock",
  providerTimezone: "Europe/Helsinki",
  dstPolicy: "iana_timezone_rules",
  configurationSource: "operator_config",
  verificationStatus: "verified",
  verificationSources: ["winter_summer_observations", "tick_candle_basis_comparison"],
  rawServerTime: 1_784_755_786,
  rawServerTimeMsc: 1_784_755_786_250,
  interpretedServerTimeUtc: "2026-07-22T21:29:46.000Z",
  normalizedProviderTimeUtc: "2026-07-22T18:29:46.000Z",
  serverTimeUtc: "2026-07-22T18:29:46.000Z",
  systemTimeUtc: "2026-07-22T18:29:50.000Z",
  observedOffsetMinutes: 180,
  rawLatestCandleTime: 1_784_755_500,
  tickCandleBasisAgreement: true,
  libraryTimeClaim: "epoch_utc",
  libraryTimeClaimAgreement: false,
  observationSummary: {
    observationCount: 2,
    acceptedObservationCount: 2,
    winterObservationCount: 1,
    summerObservationCount: 1,
    fixedOffsetObservationCount: 0
  },
  verificationObservations: [
    observation({ id: "winter", state: "standard", offset: 120 }),
    observation({ id: "summer", state: "daylight", offset: 180 })
  ],
  terminalBuild: 5836,
  terminalVersion: "500.5836.28 Apr 2026",
  mt5PackageVersion: "5.0.5735",
  readOnly: true,
  marketDataOnly: true,
  blockers: [],
  warnings: [],
  authority,
  ...authority,
  ...overrides
});

const unknown = contracts.validateV2Mt5UpstreamTimeContract(contract({
  providerTimeBasis: "unknown",
  providerTimezone: undefined,
  dstPolicy: "unknown",
  verificationStatus: "unknown",
  verificationSources: [],
  verificationObservations: []
}));
assert.equal(unknown.status, "accepted");
assert.equal(unknown.phase2Eligible, false);

const configured = contracts.validateV2Mt5UpstreamTimeContract(contract({
  verificationStatus: "configured_unverified",
  verificationSources: [],
  verificationObservations: []
}));
assert.equal(configured.status, "accepted");
assert.equal(configured.phase2Eligible, false);

const observed = contracts.validateV2Mt5UpstreamTimeContract(contract({
  providerTimeBasis: "unknown",
  providerTimezone: undefined,
  dstPolicy: "unknown",
  verificationStatus: "observed_candidate",
  verificationSources: ["tick_candle_basis_comparison"],
  verificationObservations: []
}));
assert.equal(observed.phase2Eligible, false);

const verifiedIana = contracts.validateV2Mt5UpstreamTimeContract(contract());
assert.equal(verifiedIana.status, "accepted");
assert.equal(verifiedIana.phase2Eligible, true);
assert.equal(verifiedIana.policy.sourceTimezone, "Europe/Helsinki");
assert.equal(verifiedIana.policy.discoveryMethod, "verified_upstream_contract");

const fixedObservations = [
  observation({ id: "fixed-1", state: "not_applicable", offset: 180, timezone: undefined }),
  observation({ id: "fixed-2", state: "not_applicable", offset: 180, timezone: undefined })
].map((item) => ({ ...item, appliedTimezone: undefined }));
const verifiedFixed = contracts.validateV2Mt5UpstreamTimeContract(contract({
  providerTimezone: undefined,
  providerUtcOffsetMinutes: 180,
  dstPolicy: "fixed_offset",
  verificationSources: ["provider_documentation", "repeated_fixed_offset_observations", "tick_candle_basis_comparison"],
  providerDeclarationId: "provider-time-contract-v1",
  observationSummary: {
    observationCount: 2,
    acceptedObservationCount: 2,
    winterObservationCount: 0,
    summerObservationCount: 0,
    fixedOffsetObservationCount: 2
  },
  verificationObservations: fixedObservations
}));
assert.equal(verifiedFixed.phase2Eligible, true);
assert.equal(verifiedFixed.policy.sourceUtcOffsetMinutes, 180);

assert.equal(contracts.validateV2Mt5UpstreamTimeContract(contract({ providerTimezone: "Mars/Olympus" })).status, "blocked");
assert.equal(contracts.validateV2Mt5UpstreamTimeContract(contract({
  providerTimezone: undefined,
  providerUtcOffsetMinutes: 900,
  dstPolicy: "fixed_offset"
})).status, "blocked");
assert.equal(contracts.validateV2Mt5UpstreamTimeContract(contract({ tickCandleBasisAgreement: false })).phase2Eligible, false);
assert.equal(contracts.validateV2Mt5UpstreamTimeContract({ ...contract(), accountData: { login: 1 } }).status, "blocked");

const source = identity.createV2SourceIdentity({
  sourceId: "mt5:USTECH:5m",
  provider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "legacy-fingerprint-unchanged",
  sourceKind: "mt5_read_only"
});
const identityInput = {
  source,
  timeframeFingerprints: { "5m": source.sourceFingerprint },
  dataWindowStart: "2026-07-22T18:15:00.000Z",
  dataWindowEnd: "2026-07-22T18:25:00.000Z",
  lastClosedCandle: "2026-07-22T18:25:00.000Z",
  candleCountByTimeframe: { "5m": 2 },
  timeNormalizationPolicyId: contract().contractId,
  timeNormalizationPolicyVersion: contract().version,
  timeContractId: contract().contractId,
  timeContractVersion: contract().version
};
const verifiedIdentity = await identity.buildV2MarketDataIdentity({
  ...identityInput,
  timeContractVerificationStatus: "verified"
});
const candidateIdentity = await identity.buildV2MarketDataIdentity({
  ...identityInput,
  timeContractVerificationStatus: "observed_candidate"
});
assert.notEqual(verifiedIdentity.identityHash, candidateIdentity.identityHash);

const rawCandles = [
  { rawProviderTime: Date.UTC(2026, 6, 22, 21, 15) / 1_000, open: 20_000, high: 20_010, low: 19_995, close: 20_005, volume: 100 },
  { rawProviderTime: Date.UTC(2026, 6, 22, 21, 20) / 1_000, open: 20_005, high: 20_015, low: 20_000, close: 20_012, volume: 120 }
];
const feed = {
  feedId: source.sourceId,
  requestedSymbol: source.requestedSymbol,
  brokerSymbol: source.brokerSymbol,
  symbol: source.brokerSymbol,
  timeframe: "5m",
  candleFingerprint: source.sourceFingerprint,
  candles: rawCandles,
  connectionStatus: "connected",
  receivedAt: "2026-07-22T18:29:59.900Z",
  timeContract: contract()
};
const query = { source, timeframe: "5m", limit: 10, closedOnly: true, purpose: "current_read" };
const verifiedRepository = mt5Adapter.createV2Mt5TimeNormalizedRepository({
  asOf: () => "2026-07-22T18:30:00.000Z",
  loadFeed: async () => feed
});
const verifiedWindow = await verifiedRepository.getWindow(query);
assert.equal(verifiedWindow.diagnostics.status, "eligible");
assert.equal(verifiedWindow.candles.length, 2);
assert.equal(verifiedWindow.identity.timeContractVerificationStatus, "verified");

const configuredRepository = mt5Adapter.createV2Mt5TimeNormalizedRepository({
  asOf: () => "2026-07-22T18:30:00.000Z",
  loadFeed: async () => ({ ...feed, timeContract: contract({ verificationStatus: "configured_unverified" }) })
});
const blockedWindow = await configuredRepository.getWindow(query);
assert.equal(blockedWindow.diagnostics.status, "blocked");
assert.equal(blockedWindow.candles.length, 0);
assert.equal(blockedWindow.evidencePolicy.mayCreateEvidence, false);

const getFreePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const upstream = createServer((request, response) => {
  response.writeHead(request.url?.startsWith("/time-contract") ? 200 : 404, { "content-type": "application/json" });
  response.end(JSON.stringify(request.url?.startsWith("/time-contract") ? contract() : { error: "not_found" }));
});
await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const upstreamPort = upstream.address().port;
const wrapperPort = await getFreePort();
const wrapper = spawn(process.execPath, [path.join(workspace, "scripts", "start-mt5-readonly-bridge.mjs")], {
  cwd: workspace,
  env: {
    ...process.env,
    MT5_READONLY_BRIDGE_HOST: "127.0.0.1",
    MT5_READONLY_BRIDGE_PORT: String(wrapperPort),
    MT5_READONLY_UPSTREAM_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    MT5_READONLY_UPSTREAM_TIMEOUT_MS: "1000"
  },
  stdio: ["ignore", "pipe", "pipe"]
});
try {
  let wrapperPayload;
  for (let attempt = 0; attempt < 30 && !wrapperPayload; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    wrapperPayload = await fetch(`http://127.0.0.1:${wrapperPort}/time-contract`)
      .then((response) => response.ok ? response.json() : undefined)
      .catch(() => undefined);
  }
  assert.ok(wrapperPayload, "Wrapper time-contract route did not start.");
  assert.equal(wrapperPayload.contractId, contract().contractId);
  assert.equal(wrapperPayload.verificationStatus, "verified");
  assert.equal(wrapperPayload.rawServerTime, contract().rawServerTime);
  assert.equal(wrapperPayload.wrapperContractVersion, "gotrader-mt5-readonly-wrapper-time-contract-v1");
  assert.equal(wrapperPayload.executionAuthority, "none");
} finally {
  wrapper.kill();
  await new Promise((resolve) => upstream.close(resolve));
}

const output = {
  status: "passed",
  pythonContractTests: "passed",
  unknownContract: unknown.verificationStatus,
  configuredContract: configured.verificationStatus,
  observedContract: observed.verificationStatus,
  verifiedIanaContract: verifiedIana.verificationStatus,
  verifiedFixedContract: verifiedFixed.verificationStatus,
  identitySensitiveToContractStatus: verifiedIdentity.identityHash !== candidateIdentity.identityHash,
  unverifiedAdapterStatus: blockedWindow.diagnostics.status,
  wrapperPassThrough: "passed",
  rawTimePreserved: true,
  rawCandleArraysSerialized: false,
  sensitiveFieldsAbsent: true,
  authority
};
const serialized = JSON.stringify(output);
assert.doesNotMatch(serialized, /"candles"\s*:/i);
assert.doesNotMatch(serialized, /accountData|orderData|positionData|password|secret|apiKey|token/i);
console.log(JSON.stringify(output, null, 2));
