#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const workspace = process.cwd();
const oneShotPath = path.join(workspace, "mt5", "GoTraderClockProbe.mq5");
const persistentPath = path.join(workspace, "mt5", "GoTraderClockProbeEA.mq5");
const oneShotSource = readFileSync(oneShotPath, "utf8");
const persistentSource = readFileSync(persistentPath, "utf8");
const oneShotHash = createHash("sha256").update(oneShotSource).digest("hex").toUpperCase();

assert.equal(
  oneShotHash,
  "93BAE2E37C95DCCEE8162F3EE6650A053DF346038ADA3FEFCB33781D12C95043",
  "The existing one-shot clock probe must remain unchanged."
);

assert.match(persistentSource, /input int InpHeartbeatIntervalSeconds\s*=\s*30\s*;/);
assert.match(persistentSource, /MINIMUM_INTERVAL_SECONDS\s*=\s*10\s*;/);
assert.match(persistentSource, /MAXIMUM_INTERVAL_SECONDS\s*=\s*60\s*;/);
assert.match(persistentSource, /MathMax\(MINIMUM_INTERVAL_SECONDS,MathMin\(MAXIMUM_INTERVAL_SECONDS,requested\)\)/);
assert.match(persistentSource, /\bint OnInit\s*\(/);
assert.match(persistentSource, /\bvoid OnTimer\s*\(/);
assert.match(persistentSource, /\bvoid OnDeinit\s*\(/);
assert.match(persistentSource, /\bEventSetTimer\s*\(/);
assert.match(persistentSource, /\bEventKillTimer\s*\(/);
assert.match(persistentSource, /TerminalInfoInteger\(TERMINAL_CONNECTED\)/);
assert.match(persistentSource, /relative_name\+"\.tmp"/);
assert.match(persistentSource, /\bFileFlush\s*\(/);
assert.match(persistentSource, /\bFileClose\s*\(/);
assert.match(persistentSource, /\bFileMove\s*\([^)]*FILE_REWRITE/);
assert.match(persistentSource, /WriteHeartbeat\("stopped"\)/);
assert.ok(persistentSource.includes('\\"probeState\\":'));
assert.ok(persistentSource.includes('\\"terminalDataPathFingerprint\\":'));
assert.ok(persistentSource.includes('\\"executionAuthority\\":\\"none\\"'));
assert.ok(persistentSource.includes('\\"brokerAuthority\\":\\"none\\"'));
assert.ok(persistentSource.includes('\\"readinessOverrideAuthority\\":\\"none\\"'));

for (const forbiddenCall of [
  /\bCTrade\b/,
  /\bMqlTradeRequest\b/,
  /\bOrderSend\s*\(/,
  /\bOrderCheck\s*\(/,
  /\bAccountInfo\w*\s*\(/,
  /\bPosition\w*\s*\(/,
  /\bHistoryDeal\w*\s*\(/,
  /\bHistoryOrder\w*\s*\(/,
  /\bWebRequest\s*\(/,
  /\bSocket\w*\s*\(/,
  /^\s*#import\b/m
]) {
  assert.doesNotMatch(persistentSource, forbiddenCall);
}

const python = spawnSync("python", [path.join("scripts", "test-v2-mt5-terminal-clock.py")], {
  cwd: workspace,
  encoding: "utf8"
});
assert.equal(python.status, 0, python.stderr || python.stdout);
const parserResult = JSON.parse(python.stdout);
for (const field of [
  "persistentSchemaAccepted",
  "duplicateRejected",
  "conflictingDuplicateRejected",
  "staleRejected",
  "futureTimestampRejected",
  "wrongSymbolRejected",
  "terminalInstanceMismatchRejected",
  "disconnectedRejected",
  "stoppedRejected",
  "malformedRejected",
  "sensitiveFieldsRejected"
]) {
  assert.equal(parserResult[field], true, `Expected parser validation result ${field}.`);
}
assert.deepEqual(parserResult.authority, {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

console.log(JSON.stringify({
  status: "passed",
  persistentProbe: {
    defaultHeartbeatSeconds: 30,
    boundedIntervalSeconds: [10, 60],
    timerDriven: true,
    atomicPerInstanceOutput: true,
    connectionSignal: "TERMINAL_CONNECTED",
    oneShotProbePreserved: true
  },
  parser: {
    v1BackwardCompatible: true,
    v11PersistentAccepted: true,
    staleRejected: true,
    disconnectedRejected: true,
    stoppedRejected: true,
    malformedRejected: true,
    futureTimestampRejected: true,
    wrongInstanceRejected: true,
    wrongSymbolRejected: true,
    conflictingObservationDetected: true,
    forbiddenFieldsRejected: true
  },
  mutationCapabilitiesPresent: false,
  authority: parserResult.authority
}, null, 2));
