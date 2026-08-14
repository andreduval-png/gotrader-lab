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
  "src/lib/backtestStrategyAdapters/liquidityReclaimScalperCanonicalAdapter.ts"
];
const source = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
for (const pattern of [/\/execute\b/i, /placeOrder/i, /orderSend/i, /account mutation/i, /broker mutation/i,
  /position management/i, /readiness override/i, /applyCalibration/i, /productionAdoptionAllowed:\s*true/i]) {
  assert.equal(pattern.test(source), false, `Forbidden LRS capability matched ${pattern}.`);
}
assert.equal(source.includes("SIMULATION_AUTHORITY_NONE"), true);
assert.equal(source.includes("SIMULATION_CAPABILITIES_DISABLED"), true);
console.log(JSON.stringify({ status: "passed", scannedFiles: files.length, authority: "none/none/none", executionImports: 0 }, null, 2));
