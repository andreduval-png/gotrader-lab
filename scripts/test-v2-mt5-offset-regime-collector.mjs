#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import {
  acquireV2Mt5OffsetRegimeCollectorLock,
  loadV2Mt5OffsetRegimeState,
  normalizeV2Mt5CollectorBridgeUrl,
  runV2Mt5OffsetRegimeCollectorCycle
} from "./v2-mt5-offset-regime-collector-core.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-mt5-offset-regime-collector-test");
const sourceFiles = [
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2TimeNormalization.ts",
  "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContract.ts",
  "src/lib/v2/time/v2Mt5OffsetRegimeTypes.ts",
  "src/lib/v2/time/v2Mt5OffsetRegimeLedger.ts",
  "src/lib/v2/time/v2Mt5OffsetRegimeValidation.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const ledgerApi = Object.freeze({
  ...(await load("v2Mt5OffsetRegimeLedger")),
  ...(await load("v2Mt5OffsetRegimeValidation"))
});

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const contractAt = ({
  capturedAt,
  observationId,
  probeInstanceId = "ABCDEF12",
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
  terminalBuild: 5836,
  terminalProbeSchemaVersion: "1.0.0",
  terminalProbeObservationId: observationId,
  terminalProbeInstanceId: probeInstanceId,
  terminalProbeCapturedAt: capturedAt,
  terminalBasisClassification: currentLiveVerified ? "verified_trade_server_wall_clock" : "insufficient_evidence",
  pythonTransportBasis: currentLiveVerified ? "matches_symbol_quote_time" : "unresolved",
  terminalObservedOffsetMinutes: 180,
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

const temporaryRoot = await fsPromises.mkdtemp(path.join(os.tmpdir(), "gotrader-v2-offset-collector-"));
const stateFile = path.join(temporaryRoot, "mt5-offset-regime-USTECH.json");
const requests = [];
const contracts = [
  contractAt({ capturedAt: "2026-07-22T18:00:00.000Z", observationId: "ABCDEF12-1" }),
  contractAt({ capturedAt: "2026-07-22T18:01:00.000Z", observationId: "ABCDEF12-2" }),
  contractAt({
    capturedAt: "2026-07-22T18:02:00.000Z",
    observationId: "ABCDEF12-3",
    currentLiveVerified: false,
    terminalProbeBlockers: ["terminal_quote_stale"]
  })
];
const server = http.createServer((request, response) => {
  requests.push({ method: request.method, url: request.url });
  if (request.method !== "GET" || request.url !== "/time-contract") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }
  const contract = contracts.shift();
  if (!contract) {
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "fixture_exhausted" }));
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(contract));
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
assert.ok(address && typeof address !== "string");
const bridgeUrl = `http://127.0.0.1:${address.port}`;

try {
  const first = await runV2Mt5OffsetRegimeCollectorCycle({
    bridgeUrl,
    brokerSymbol: "USTECH",
    stateFile,
    ledgerApi,
    now: () => "2026-07-22T18:00:01.000Z"
  });
  assert.equal(first.status, "observed");
  assert.equal(first.action, "created");
  assert.equal(first.activeObservationCount, 1);
  assert.deepEqual(first.authority, authority);

  const firstFile = JSON.parse(await fsPromises.readFile(stateFile, "utf8"));
  const firstValidation = await ledgerApi.validateV2Mt5OffsetRegimeLedgerFile(firstFile);
  assert.equal(firstValidation.status, "accepted");
  assert.equal(firstValidation.ledger.regimes[0].observationCount, 1);

  // A new collector process loads the persisted ledger and extends the same regime.
  const second = await runV2Mt5OffsetRegimeCollectorCycle({
    bridgeUrl,
    brokerSymbol: "USTECH",
    stateFile,
    ledgerApi,
    now: () => "2026-07-22T18:01:01.000Z"
  });
  assert.equal(second.status, "observed");
  assert.equal(second.action, "extended");
  assert.equal(second.activeObservationCount, 2);

  const persistedBeforeOffline = await fsPromises.readFile(stateFile, "utf8");
  const unavailable = await runV2Mt5OffsetRegimeCollectorCycle({
    bridgeUrl: "http://127.0.0.1:1",
    brokerSymbol: "USTECH",
    stateFile,
    ledgerApi,
    timeoutMs: 250
  });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.action, "none");
  assert.equal(unavailable.statePreserved, true);
  assert.equal(await fsPromises.readFile(stateFile, "utf8"), persistedBeforeOffline);

  const blocked = await runV2Mt5OffsetRegimeCollectorCycle({
    bridgeUrl,
    brokerSymbol: "USTECH",
    stateFile,
    ledgerApi,
    now: () => "2026-07-22T18:02:01.000Z"
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.action, "terminated");
  const terminatedFile = JSON.parse(await fsPromises.readFile(stateFile, "utf8"));
  assert.equal(terminatedFile.ledger.activeRegimeId, undefined);
  assert.equal(terminatedFile.ledger.regimes.at(-1).terminationReason, "stale_quote");

  const safeSerialization = JSON.stringify(terminatedFile);
  assert.doesNotMatch(safeSerialization, /"candles"\s*:|rawServer|rawProvider|timeCurrentRaw|accountData|orderData|positionData|password|secret|apiKey|token/i);
  assert.deepEqual(terminatedFile.ledger.authority, authority);
  assert.deepEqual(requests, [
    { method: "GET", url: "/time-contract" },
    { method: "GET", url: "/time-contract" },
    { method: "GET", url: "/time-contract" }
  ]);

  const untampered = await fsPromises.readFile(stateFile, "utf8");
  const tampered = JSON.parse(untampered);
  tampered.ledger.processedObservationCount = 999;
  await fsPromises.writeFile(stateFile, JSON.stringify(tampered), "utf8");
  await assert.rejects(
    () => loadV2Mt5OffsetRegimeState({ stateFile, brokerSymbol: "USTECH", ledgerApi }),
    /checksum_mismatch/
  );
  assert.equal(JSON.parse(await fsPromises.readFile(stateFile, "utf8")).ledger.processedObservationCount, 999);

  await fsPromises.writeFile(stateFile, "{invalid-json", "utf8");
  await assert.rejects(
    () => loadV2Mt5OffsetRegimeState({ stateFile, brokerSymbol: "USTECH", ledgerApi }),
    /not valid JSON/
  );
  assert.equal(await fsPromises.readFile(stateFile, "utf8"), "{invalid-json");

  assert.equal(normalizeV2Mt5CollectorBridgeUrl("http://localhost:7341/anything"), "http://localhost:7341");
  assert.throws(() => normalizeV2Mt5CollectorBridgeUrl("https://127.0.0.1:7341"), /loopback HTTP/);
  assert.throws(() => normalizeV2Mt5CollectorBridgeUrl("http://10.0.0.8:7341"), /non-loopback/);
  assert.throws(() => normalizeV2Mt5CollectorBridgeUrl("http://user:pass@127.0.0.1:7341"), /Credentials/);

  const lockStateFile = path.join(temporaryRoot, "lock-fixture.json");
  const lock = await acquireV2Mt5OffsetRegimeCollectorLock(lockStateFile);
  await assert.rejects(() => acquireV2Mt5OffsetRegimeCollectorLock(lockStateFile), /already running/);
  await lock.release();
  await fsPromises.writeFile(`${lockStateFile}.lock`, JSON.stringify({ pid: 2_147_483_647 }), "utf8");
  const recoveredLock = await acquireV2Mt5OffsetRegimeCollectorLock(lockStateFile);
  await recoveredLock.release();
  assert.equal(fs.existsSync(`${lockStateFile}.lock`), false);

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
    loopbackTimeContractRequests: requests.length,
    restartContinuityPreserved: second.activeObservationCount === 2,
    corruptStateRejectedWithoutOverwrite: true,
    offlineStatePreserved: unavailable.statePreserved,
    staleContractTerminatesCoverage: blocked.action === "terminated",
    singleCollectorLockEnforced: true,
    rawCandleArraysSerialized: false,
    productionAdoptions: productionAdoptions.length,
    shadowOnly: true,
    authority
  }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fsPromises.rm(temporaryRoot, { recursive: true, force: true });
}
