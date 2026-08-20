#!/usr/bin/env node

import { spawnSync } from "node:child_process";

for (const script of ["scripts/test-current-opportunity-scanner.mjs", "scripts/test-operator-console.mjs"]) {
  const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("trade geometry Current Read and Current Opportunity parity tests passed");

