#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "src/lib/strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperTypes.ts",
  "src/lib/strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperParameters.ts",
  "src/lib/strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperR1.ts",
  "src/lib/strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperR1TrialControls.ts",
  "src/lib/strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperStateMachine.ts",
  "src/lib/v2/strategyAdapters/liquidityReclaimScalper/liquidityReclaimScalperDetector.ts",
  "src/lib/backtestStrategyAdapters/liquidityReclaimScalperCanonicalAdapter.ts",
  "scripts/support/liquidity-reclaim-scalper-baseline-runner.mjs",
  "scripts/support/liquidity-reclaim-scalper-r1-executor.mjs",
  "scripts/run-liquidity-reclaim-scalper-r1-trial.mjs",
  "scripts/run-liquidity-reclaim-scalper-r1-bounded.mjs"
];
const source = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
for (const pattern of [/\/execute\b/i, /\bplaceOrder\s*\(/i, /canPlaceOrder:\s*true/i, /orderSend/i, /account mutation/i, /broker mutation/i,
  /position management/i, /readiness override/i, /applyCalibration/i, /productionAdoptionAllowed:\s*true/i]) {
  assert.equal(pattern.test(source), false, `Forbidden LRS capability matched ${pattern}.`);
}
for (const pattern of [/\bfetch\s*\(/i, /\bWebSocket\b/i, /\bXMLHttpRequest\b/i,
  /mt5Contacted:\s*true/i, /rawCandlesSerialized:\s*true/i, /holdoutUsed:\s*true/i]) {
  assert.equal(pattern.test(source), false, `Forbidden R1 executor capability matched ${pattern}.`);
}
assert.equal(source.includes("SIMULATION_AUTHORITY_NONE"), true);
assert.equal(source.includes("SIMULATION_CAPABILITIES_DISABLED"), true);
console.log(JSON.stringify({ status: "passed", scannedFiles: files.length, authority: "none/none/none", executionImports: 0 }, null, 2));
