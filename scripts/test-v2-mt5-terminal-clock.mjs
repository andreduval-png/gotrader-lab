#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createServer } from "node:http";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { evaluateV2Mt5TerminalContractAgreement } from "./v2-mt5-terminal-contract-agreement.mjs";

const workspace = process.cwd();
const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const python = spawnSync("python", [path.join("scripts", "test-v2-mt5-terminal-clock.py")], {
  cwd: workspace,
  encoding: "utf8"
});
assert.equal(python.status, 0, python.stderr || python.stdout);
const probeSource = fs.readFileSync(path.join(workspace, "mt5", "GoTraderClockProbe.mq5"), "utf8");
for (const forbiddenCall of [
  /\bCTrade\b/,
  /\bOrderSend\s*\(/,
  /\bAccountInfo\w*\s*\(/,
  /\bPosition\w*\s*\(/,
  /\bHistoryDeal\w*\s*\(/,
  /\bWebRequest\s*\(/,
  /\bSocket\w*\s*\(/,
  /^\s*#import\b/m
]) assert.doesNotMatch(probeSource, forbiddenCall);

const outRoot = path.join(workspace, ".gotrader", "v2-mt5-terminal-clock-test");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2TimeNormalization.ts",
  "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
  "src/lib/v2/time/v2Mt5TerminalClock.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContract.ts"
].map((file) => path.join(workspace, file));
compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const clock = await load("v2Mt5TerminalClock");
const contracts = await load("v2Mt5UpstreamTimeContract");
const identity = await load("v2Identity");

const observation = ({ offsetSeconds = 0, overrides = {} } = {}) => {
  const utcRaw = 1_800_000_000;
  const serverRaw = utcRaw + offsetSeconds;
  return Object.freeze({
    schemaId: "gotrader-mt5-terminal-clock-observation",
    version: "1.0.0",
    observationId: `ABCDEF12-100-${serverRaw}`,
    sequence: 100,
    probeInstanceId: "ABCDEF12",
    symbol: "USTECH",
    timeframe: "M5",
    captureDurationMs: 2,
    timeCurrentRaw: serverRaw,
    timeTradeServerRaw: serverRaw + 1,
    timeGmtRaw: utcRaw,
    timeLocalRaw: utcRaw - 14_400,
    timeGmtOffsetSeconds: 14_400,
    timeDaylightSavingsSeconds: -3_600,
    symbolTimeRaw: serverRaw,
    symbolTimeMscRaw: serverRaw * 1_000 + 250,
    latestBarOpenRaw: serverRaw - serverRaw % 300,
    latestBarIndex: 0,
    symbolSynchronized: true,
    tickReadSucceeded: true,
    barReadSucceeded: true,
    terminalBuild: 5836,
    authority,
    ...authority,
    ...overrides
  });
};
const compare = (terminalObservation, historicalDstPolicyVerified = false) => {
  const systemMs = terminalObservation.timeGmtRaw * 1_000;
  return clock.classifyV2Mt5TerminalClock({
    observation: terminalObservation,
    systemUtcBeforeMs: systemMs,
    systemUtcAfterMs: systemMs + 500,
    pythonTickRaw: terminalObservation.symbolTimeRaw,
    pythonTickMscRaw: terminalObservation.symbolTimeMscRaw,
    pythonLatestM5BarRaw: terminalObservation.latestBarOpenRaw,
    wrapperTickRaw: terminalObservation.symbolTimeRaw,
    wrapperLatestM5BarRaw: terminalObservation.latestBarOpenRaw,
    historicalDstPolicyVerified
  });
};

assert.equal(clock.validateV2Mt5TerminalClockObservation(observation()).status, "accepted");
assert.equal(clock.validateV2Mt5TerminalClockObservation({ ...observation(), orderData: [] }).status, "blocked");
assert.equal(clock.validateV2Mt5TerminalClockObservation({ ...observation(), brokerAuthority: "trade" }).status, "blocked");
assert.equal(clock.validateV2Mt5TerminalClockObservation({ ...observation(), sequence: "100" }).status, "blocked");
assert.equal(clock.validateV2Mt5TerminalClockObservation({ ...observation(), timeCurrentRaw: null }).status, "blocked");

const utc = compare(observation(), true);
assert.equal(utc.basisClassification, "verified_utc_epoch");
assert.equal(utc.phase2Eligible, true);
const wall = compare(observation({ offsetSeconds: 10_800 }));
assert.equal(wall.basisClassification, "verified_trade_server_wall_clock");
assert.equal(wall.pythonTransportBasis, "matches_symbol_quote_time");
assert.equal(wall.currentLiveTimeBasisVerified, true);
assert.equal(wall.historicalDstPolicyVerified, false);
assert.equal(wall.phase2Eligible, false);
assert.equal(wall.terminalObservedOffsetMinutes, 180);
assert.equal(wall.deltas.pythonCandleMinusLatestM5BarMs, 0);
const stale = clock.classifyV2Mt5TerminalClock({
  observation: observation({ offsetSeconds: 10_800 }),
  systemUtcBeforeMs: (1_800_000_000 + 500) * 1_000,
  systemUtcAfterMs: (1_800_000_000 + 501) * 1_000,
  pythonTickRaw: 1_800_010_800,
  pythonLatestM5BarRaw: 1_800_010_800
});
assert.equal(stale.currentLiveTimeBasisVerified, false);
assert.ok(stale.blockers.includes("terminal_observation_stale"));
const partial = clock.classifyV2Mt5TerminalClock({
  observation: observation({ offsetSeconds: 10_800, overrides: { barReadSucceeded: false } }),
  systemUtcBeforeMs: 1_800_000_000_000,
  systemUtcAfterMs: 1_800_000_000_500,
  pythonTickRaw: 1_800_010_800,
  pythonLatestM5BarRaw: 1_800_010_800
});
assert.equal(partial.phase2Eligible, false);
assert.ok(partial.blockers.includes("terminal_bar_unavailable"));
const staleQuote = compare(observation({
  offsetSeconds: 10_800,
  overrides: { timeTradeServerRaw: 1_800_010_800 + 1_800 }
}));
assert.equal(staleQuote.currentLiveTimeBasisVerified, false);
assert.ok(staleQuote.blockers.includes("terminal_quote_stale"));

const liveOnlyContract = Object.freeze({
  contractId: "gotrader-mt5-readonly-time-contract",
  version: "1.1.0",
  providerTimeBasis: "mt5_server_wall_clock",
  providerUtcOffsetMinutes: 180,
  dstPolicy: "fixed_offset",
  configurationSource: "operator_config",
  verificationStatus: "observed_candidate",
  verificationSources: ["terminal_clock_probe_current_live", "tick_candle_basis_comparison"],
  rawServerTime: 1_800_010_800,
  systemTimeUtc: "2027-01-15T08:00:00.000Z",
  rawLatestCandleTime: 1_800_010_700,
  tickCandleBasisAgreement: true,
  observationSummary: {
    observationCount: 0,
    acceptedObservationCount: 0,
    winterObservationCount: 0,
    summerObservationCount: 0,
    fixedOffsetObservationCount: 0
  },
  terminalProbeSchemaVersion: "1.0.0",
  terminalProbeObservationId: "ABCDEF12-100-1800010800",
  terminalProbeCapturedAt: "2027-01-15T08:00:00.000Z",
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
const liveValidation = contracts.validateV2Mt5UpstreamTimeContract(liveOnlyContract);
assert.equal(liveValidation.status, "accepted");
assert.equal(liveValidation.phase2Eligible, false);
const acceptedAgreement = evaluateV2Mt5TerminalContractAgreement({
  responseStatus: 200,
  contract: { ...liveOnlyContract, sourceMethod: "upstream_http:/time-contract" },
  classification: wall
});
assert.equal(acceptedAgreement.status, "accepted");
assert.equal(acceptedAgreement.phase2Eligible, false);
const stubAgreement = evaluateV2Mt5TerminalContractAgreement({
  responseStatus: 200,
  contract: {
    ...liveOnlyContract,
    version: "0",
    verificationStatus: "unknown",
    currentLiveTimeBasisVerified: false,
    timeVerificationScope: "none",
    sourceMethod: "contract_stub:/time-contract"
  },
  classification: wall
});
assert.equal(stubAgreement.status, "blocked");
assert.ok(stubAgreement.blockers.includes("time_contract_version_mismatch"));
assert.ok(stubAgreement.blockers.includes("time_contract_stub_returned"));
assert.equal(contracts.validateV2Mt5UpstreamTimeContract({
  ...liveOnlyContract,
  verificationStatus: "verified"
}).status, "blocked");
assert.equal(contracts.validateV2Mt5UpstreamTimeContract({
  ...liveOnlyContract,
  phase2Eligible: true
}).status, "blocked");

const getFreePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const mockUpstream = createServer((request, response) => {
  response.writeHead(request.url?.startsWith("/time-contract") ? 200 : 404, { "content-type": "application/json" });
  response.end(JSON.stringify(request.url?.startsWith("/time-contract") ? liveOnlyContract : { error: "not_found" }));
});
await new Promise((resolve) => mockUpstream.listen(0, "127.0.0.1", resolve));
const mockPort = mockUpstream.address().port;
const wrapperPort = await getFreePort();
const wrapper = spawn(process.execPath, [path.join(workspace, "scripts", "start-mt5-readonly-bridge.mjs")], {
  cwd: workspace,
  env: {
    ...process.env,
    MT5_READONLY_BRIDGE_HOST: "127.0.0.1",
    MT5_READONLY_BRIDGE_PORT: String(wrapperPort),
    MT5_READONLY_UPSTREAM_BASE_URL: `http://127.0.0.1:${mockPort}`,
    MT5_READONLY_UPSTREAM_TIMEOUT_MS: "1000"
  },
  stdio: ["ignore", "pipe", "pipe"]
});
try {
  let wrapped;
  for (let attempt = 0; attempt < 30 && !wrapped; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    wrapped = await fetch(`http://127.0.0.1:${wrapperPort}/time-contract`)
      .then((response) => response.ok ? response.json() : undefined)
      .catch(() => undefined);
  }
  assert.ok(wrapped, "MT5 wrapper did not expose the terminal-clock contract fixture.");
  assert.equal(wrapped.terminalProbeObservationId, liveOnlyContract.terminalProbeObservationId);
  assert.equal(wrapped.terminalBasisClassification, liveOnlyContract.terminalBasisClassification);
  assert.equal(wrapped.currentLiveTimeBasisVerified, true);
  assert.equal(wrapped.historicalDstPolicyVerified, false);
  assert.equal(wrapped.phase2Eligible, false);
  assert.equal(wrapped.timeVerificationScope, "current_live");
  assert.equal(wrapped.executionAuthority, "none");
} finally {
  wrapper.kill();
  await new Promise((resolve) => mockUpstream.close(resolve));
}

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
  dataWindowStart: "2027-01-15T07:45:00.000Z",
  dataWindowEnd: "2027-01-15T08:00:00.000Z",
  lastClosedCandle: "2027-01-15T08:00:00.000Z",
  candleCountByTimeframe: { "5m": 3 },
  timeNormalizationPolicyId: liveOnlyContract.contractId,
  timeNormalizationPolicyVersion: liveOnlyContract.version,
  timeContractId: liveOnlyContract.contractId,
  timeContractVersion: liveOnlyContract.version,
  timeContractVerificationStatus: liveOnlyContract.verificationStatus,
  terminalClockClassificationVersion: "1.0.0"
};
const currentIdentity = await identity.buildV2MarketDataIdentity({ ...identityInput, timeVerificationScope: "current_live" });
const historicalIdentity = await identity.buildV2MarketDataIdentity({ ...identityInput, timeVerificationScope: "historical" });
const volatileObservationIdentity = await identity.buildV2MarketDataIdentity({
  ...identityInput,
  timeVerificationScope: "current_live",
  terminalProbeObservationId: "DIFFERENT-OBSERVATION",
  terminalProbeCapturedAt: "2030-01-01T00:00:00.000Z",
  observationAgeMs: 99_999
});
assert.notEqual(currentIdentity.identityHash, historicalIdentity.identityHash);
assert.equal(currentIdentity.identityHash, volatileObservationIdentity.identityHash);

const output = {
  status: "passed",
  pythonReaderTests: "passed",
  utcClassification: utc.basisClassification,
  wallClockClassification: wall.basisClassification,
  currentLiveVerified: wall.currentLiveTimeBasisVerified,
  historicalDstVerified: wall.historicalDstPolicyVerified,
  phase2Eligible: wall.phase2Eligible,
  exactBarParityMs: wall.deltas.pythonCandleMinusLatestM5BarMs,
  staleRejected: stale.blockers.includes("terminal_observation_stale"),
  partialRejected: partial.blockers.includes("terminal_bar_unavailable"),
  staleQuoteRejected: staleQuote.blockers.includes("terminal_quote_stale"),
  identitySensitiveToVerificationScope: currentIdentity.identityHash !== historicalIdentity.identityHash,
  wrapperPassThrough: "passed",
  endpointAgreement: acceptedAgreement.status,
  stubMismatchBlocked: stubAgreement.status === "blocked",
  identityExcludesVolatileObservationFields: currentIdentity.identityHash === volatileObservationIdentity.identityHash,
  rawCandleArraysSerialized: false,
  sensitiveFieldsAbsent: true,
  mql5MutationCapabilitiesAbsent: true,
  partialCurrentBarCreatesEvidence: false,
  strategySessionTimezone: "America/New_York",
  authority
};
const serialized = JSON.stringify(output);
assert.doesNotMatch(serialized, /"candles"\s*:/i);
assert.doesNotMatch(serialized, /accountData|orderData|positionData|password|secret|apiKey|token/i);
console.log(JSON.stringify(output, null, 2));
