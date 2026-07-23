#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-mt5-offset-regime-test");
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
  "src/lib/v2/context/v2DealingRangeLiquidityFactEngine.ts",
  "src/lib/v2/context/v2ContextBuilder.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const ledgerModule = await load("v2Mt5OffsetRegimeLedger");
const identityModule = await load("v2Identity");
const mt5Module = await load("v2Mt5TimeNormalizedAdapter");
const contextModule = await load("v2ContextBuilder");

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const contractAt = ({
  capturedAt,
  observationId,
  probeInstanceId = "ABCDEF12",
  offsetMinutes = 180,
  terminalBuild = 5836,
  currentLiveVerified = true,
  terminalProbeBlockers = []
}) => Object.freeze({
  contractId: "gotrader-mt5-readonly-time-contract",
  version: "1.1.0",
  providerTimeBasis: "mt5_server_wall_clock",
  dstPolicy: "unknown",
  configurationSource: "provider_metadata",
  verificationStatus: currentLiveVerified ? "observed_candidate" : "unknown",
  verificationSources: currentLiveVerified
    ? ["terminal_clock_probe_current_live", "tick_candle_basis_comparison"]
    : [],
  systemTimeUtc: capturedAt,
  tickCandleBasisAgreement: true,
  observationSummary: {
    observationCount: 0,
    acceptedObservationCount: 0,
    winterObservationCount: 0,
    summerObservationCount: 0,
    fixedOffsetObservationCount: 0
  },
  terminalBuild,
  terminalProbeSchemaVersion: "1.0.0",
  terminalProbeObservationId: observationId,
  terminalProbeInstanceId: probeInstanceId,
  terminalProbeCapturedAt: capturedAt,
  terminalBasisClassification: currentLiveVerified ? "verified_trade_server_wall_clock" : "insufficient_evidence",
  pythonTransportBasis: currentLiveVerified ? "matches_symbol_quote_time" : "unresolved",
  terminalObservedOffsetMinutes: offsetMinutes,
  terminalEvidenceStatus: currentLiveVerified ? "verified_current_live" : "missing",
  terminalClockClassificationVersion: "1.0.0",
  terminalProbeBlockers,
  terminalProbeWarnings: [],
  timeVerificationScope: currentLiveVerified ? "current_live" : "none",
  currentLiveTimeBasisVerified: currentLiveVerified,
  historicalDstPolicyVerified: false,
  phase2Eligible: false,
  strategySessionTimezone: "America/New_York",
  readOnly: true,
  marketDataOnly: true,
  blockers: terminalProbeBlockers,
  warnings: [],
  authority,
  ...authority
});

const appendContract = async (ledger, contract) => ledgerModule.appendV2Mt5OffsetRegimeObservation({
  ledger,
  observation: ledgerModule.v2Mt5OffsetRegimeObservationFromContract({ brokerSymbol: "USTECH", contract })
});

let ledger = ledgerModule.createV2Mt5OffsetRegimeLedger({ brokerSymbol: "USTECH" });
const firstContract = contractAt({ capturedAt: "2026-07-22T18:00:00.000Z", observationId: "ABCDEF12-1" });
let result = await appendContract(ledger, firstContract);
assert.equal(result.action, "created");
ledger = result.ledger;
assert.equal(result.activeRegime.observationCount, 1);
assert.equal(result.activeRegime.startedAtUtc, "2026-07-22T18:00:00.000Z");

const secondContract = contractAt({ capturedAt: "2026-07-22T18:01:30.000Z", observationId: "ABCDEF12-2" });
result = await appendContract(ledger, secondContract);
assert.equal(result.action, "extended");
ledger = result.ledger;
assert.equal(result.activeRegime.observationCount, 2);
const secondHash = result.activeRegime.continuityHash;

const idempotent = await appendContract(ledger, secondContract);
assert.equal(idempotent.action, "idempotent");
assert.equal(idempotent.ledger, ledger);

const thirdContract = contractAt({ capturedAt: "2026-07-22T18:03:00.000Z", observationId: "ABCDEF12-3" });
result = await appendContract(ledger, thirdContract);
assert.equal(result.action, "extended");
ledger = result.ledger;
assert.equal(result.activeRegime.observationCount, 3);
assert.notEqual(result.activeRegime.continuityHash, secondHash);
assert.equal(ledger.processedObservationCount, 3);

const coverage = ledgerModule.resolveV2Mt5OffsetRegimeCoverage({
  ledger,
  brokerSymbol: "USTECH",
  contract: thirdContract,
  systemUtc: "2026-07-22T18:03:30.000Z"
});
assert.equal(coverage.eligible, true);
assert.equal(coverage.regimeStartUtc, "2026-07-22T18:00:00.000Z");
assert.equal(coverage.validUntilUtc, "2026-07-22T18:05:00.000Z");
let repeatedLedger = ledgerModule.createV2Mt5OffsetRegimeLedger({ brokerSymbol: "USTECH" });
for (const contract of [firstContract, secondContract, thirdContract]) {
  repeatedLedger = (await appendContract(repeatedLedger, contract)).ledger;
}
assert.equal(repeatedLedger.regimes[0].regimeId, ledger.regimes[0].regimeId);
assert.equal(repeatedLedger.regimes[0].continuityHash, ledger.regimes[0].continuityHash);
const mismatchedCoverage = ledgerModule.resolveV2Mt5OffsetRegimeCoverage({
  ledger,
  brokerSymbol: "USTECH",
  contract: secondContract,
  systemUtc: "2026-07-22T18:03:30.000Z"
});
assert.equal(mismatchedCoverage.eligible, false);
assert.ok(mismatchedCoverage.blockers.includes("offset_regime_contract_not_latest_observation"));

const source = identityModule.createV2SourceIdentity({
  sourceId: "mt5:USTECH:1m",
  provider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  sourceFingerprint: "offset-regime-fixture",
  sourceKind: "mt5_read_only"
});
const feedFor = (offsetRegimeLedger) => Object.freeze({
  feedId: source.sourceId,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  symbol: "USTECH",
  timeframe: "1m",
  candleFingerprint: source.sourceFingerprint,
  candles: Object.freeze([{
    rawProviderTime: Date.UTC(2026, 6, 22, 21, 1) / 1_000,
    open: 20_000,
    high: 20_010,
    low: 19_995,
    close: 20_005,
    volume: 100,
    closed: true
  }]),
  connectionStatus: "connected",
  receivedAt: "2026-07-22T18:03:30.000Z",
  timeContract: thirdContract,
  ...(offsetRegimeLedger ? { offsetRegimeLedger } : {})
});
const repositoryWithLedger = mt5Module.createV2Mt5TimeNormalizedRepository({
  asOf: () => "2026-07-22T18:03:30.000Z",
  loadFeed: async () => feedFor(ledger)
});
const ledgerWindow = await repositoryWithLedger.getWindow({
  source,
  timeframe: "1m",
  limit: 5,
  closedOnly: true,
  purpose: "context_shadow"
});
assert.equal(ledgerWindow.timeEligibility.currentLiveEligible, true);
assert.equal(ledgerWindow.timeEligibility.historicalEligible, false);
assert.equal(ledgerWindow.timeEligibility.offsetRegimeStartUtc, "2026-07-22T18:00:00.000Z");
assert.equal(ledgerWindow.timeEligibility.offsetRegimeId, coverage.regimeId);
const contextWithLedger = await contextModule.buildV2CanonicalMarketContext({
  source,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: "2026-07-22T18:03:30.000Z",
  requiredTimeframes: ["1m"],
  windows: [ledgerWindow],
  purpose: "current_live_shadow"
});
assert.equal(contextWithLedger.diagnostics.status, "eligible");
assert.equal(contextWithLedger.facts.length, 0);
assert.equal(contextWithLedger.identity.inputWindows[0].offsetRegimeId, coverage.regimeId);

const repositoryWithoutLedger = mt5Module.createV2Mt5TimeNormalizedRepository({
  asOf: () => "2026-07-22T18:03:30.000Z",
  loadFeed: async () => feedFor(undefined)
});
const singleObservationWindow = await repositoryWithoutLedger.getWindow({
  source,
  timeframe: "1m",
  limit: 5,
  closedOnly: true,
  purpose: "context_shadow"
});
const contextWithoutLedger = await contextModule.buildV2CanonicalMarketContext({
  source,
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  asOfMarketTime: "2026-07-22T18:03:30.000Z",
  requiredTimeframes: ["1m"],
  windows: [singleObservationWindow],
  purpose: "current_live_shadow"
});
assert.equal(contextWithoutLedger.diagnostics.status, "blocked");
assert.ok(contextWithoutLedger.diagnostics.blockers.includes("window_precedes_verified_offset_regime:1m"));

const replayWindow = await repositoryWithLedger.getWindow({
  source,
  timeframe: "1m",
  limit: 5,
  closedOnly: true,
  purpose: "replay"
});
assert.equal(replayWindow.diagnostics.status, "blocked");
assert.equal(replayWindow.timeEligibility.historicalEligible, false);

const expiredCoverage = ledgerModule.resolveV2Mt5OffsetRegimeCoverage({
  ledger,
  brokerSymbol: "USTECH",
  contract: thirdContract,
  systemUtc: "2026-07-22T18:05:00.001Z"
});
assert.equal(expiredCoverage.eligible, false);
assert.ok(expiredCoverage.blockers.includes("offset_regime_coverage_expired"));

const gapContract = contractAt({ capturedAt: "2026-07-22T18:10:00.000Z", observationId: "ABCDEF12-4" });
const gapRestart = await appendContract(ledger, gapContract);
assert.equal(gapRestart.action, "restarted");
assert.equal(gapRestart.ledger.regimes[0].terminationReason, "observation_gap");
assert.equal(gapRestart.activeRegime.startedAtUtc, "2026-07-22T18:10:00.000Z");

const instanceContract = contractAt({
  capturedAt: "2026-07-22T18:11:00.000Z",
  observationId: "1234ABCD-1",
  probeInstanceId: "1234ABCD"
});
const instanceRestart = await appendContract(gapRestart.ledger, instanceContract);
assert.equal(instanceRestart.action, "restarted");
assert.equal(instanceRestart.ledger.regimes.at(-2).terminationReason, "terminal_instance_changed");

const offsetContract = contractAt({
  capturedAt: "2026-07-22T18:12:00.000Z",
  observationId: "1234ABCD-2",
  probeInstanceId: "1234ABCD",
  offsetMinutes: 120
});
const offsetRestart = await appendContract(instanceRestart.ledger, offsetContract);
assert.equal(offsetRestart.action, "restarted");
assert.equal(offsetRestart.ledger.regimes.at(-2).terminationReason, "provider_offset_changed");

const rejectedContract = contractAt({
  capturedAt: "2026-07-22T18:13:00.000Z",
  observationId: "1234ABCD-3",
  probeInstanceId: "1234ABCD",
  offsetMinutes: 120,
  currentLiveVerified: false,
  terminalProbeBlockers: ["terminal_quote_stale"]
});
const rejected = await appendContract(offsetRestart.ledger, rejectedContract);
assert.equal(rejected.action, "terminated");
assert.equal(rejected.ledger.activeRegimeId, undefined);
assert.equal(rejected.ledger.regimes.at(-1).terminationReason, "stale_quote");
assert.ok(rejected.blockers.includes("terminal_quote_stale"));

const missingInstance = ledgerModule.v2Mt5OffsetRegimeObservationFromContract({
  brokerSymbol: "USTECH",
  contract: { ...thirdContract, terminalProbeInstanceId: undefined }
});
assert.equal(missingInstance.accepted, false);
assert.ok(missingInstance.blockers.includes("offset_regime_probe_instance_missing"));

const serialized = JSON.stringify({ ledger, coverage, contextWithLedger });
assert.doesNotMatch(serialized, /"candles"\s*:/i);
assert.doesNotMatch(serialized, /rawServer|rawProvider|timeCurrentRaw|password|secret|apiKey|accountData|orderData|positionData/i);
assert.deepEqual(ledger.authority, authority);
assert.deepEqual(contextWithLedger.authority, authority);

const productionAdoptions = [];
const scan = (directory) => {
  if (directory === path.join(workspace, "src", "lib", "v2")) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(fullPath);
    else if (/\.(?:ts|tsx)$/.test(entry.name) && /V2Mt5OffsetRegime|v2Mt5OffsetRegime/.test(fs.readFileSync(fullPath, "utf8"))) {
      productionAdoptions.push(fullPath);
    }
  }
};
scan(path.join(workspace, "src"));
assert.deepEqual(productionAdoptions, []);

console.log(JSON.stringify({
  status: "passed",
  continuityObservationCount: ledger.regimes[0].observationCount,
  continuityStartUtc: coverage.regimeStartUtc,
  currentLiveContextEligible: contextWithLedger.diagnostics.status === "eligible",
  singleObservationPrehistoryBlocked: contextWithoutLedger.diagnostics.status === "blocked",
  replayStillRequiresHistoricalVerification: replayWindow.diagnostics.status === "blocked",
  gapRestartsRegime: gapRestart.action === "restarted",
  terminalInstanceRestartsRegime: instanceRestart.action === "restarted",
  offsetChangeRestartsRegime: offsetRestart.action === "restarted",
  staleObservationTerminatesRegime: rejected.action === "terminated",
  rawCandleArraysSerialized: false,
  productionAdoptions: productionAdoptions.length,
  authority
}, null, 2));
