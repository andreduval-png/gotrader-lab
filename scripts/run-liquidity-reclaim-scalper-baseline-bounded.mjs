#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outputRoot = process.env.GOTRADER_LRS_BASELINE_ROOT;
if (!outputRoot) throw new Error("GOTRADER_LRS_BASELINE_ROOT is required.");
const maximumChildren = 40;
for (let ordinal = 0; ordinal < maximumChildren; ordinal += 1) {
  const child = spawnSync(process.execPath, ["scripts/run-liquidity-reclaim-scalper-baseline.mjs"], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, GOTRADER_LRS_MAX_SEGMENTS: "25" }, maxBuffer: 4 * 1024 * 1024
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.status !== 0) process.exit(child.status ?? 1);
  if (fs.existsSync(path.join(outputRoot, "baseline-report.json"))) process.exit(0);
}
throw new Error("Bounded LRS operator exhausted its child-process limit without a final report.");
