#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const commands = [
  ["producer_to_current_read_signal", "scripts/test-current-opportunity-scanner.mjs"],
  ["signal_to_activate_market_plan", "scripts/test-ict-activate-market-pipeline.mjs"],
  ["activate_market_to_operator_plan", "scripts/test-operator-console.mjs"]
];

for (const [name, script] of commands) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `${name} regression failed`);
}

console.log(JSON.stringify({
  status: "passed",
  chain: [
    "evaluateIctIfvg",
    "assessIctIfvgFreshRetestV3",
    "adaptIfvgNativeGeometry",
    "compactIctIfvgFreshRetestV3Assessment",
    "detectCurrentOpportunities",
    "buildIctResearchSignalFromCurrentRead",
    "runIctActivateMarketPipeline",
    "buildOperatorConsoleSnapshot"
  ],
  authority: "none/none/none"
}, null, 2));
