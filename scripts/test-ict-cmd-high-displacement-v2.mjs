#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "ict-strategy-suite");
const outRoot = path.join(projectRoot, ".gotrader", "ict-cmd-high-displacement-v2-test");
const sourceFiles = [
  "ictStrategySuiteTypes.ts",
  "ictStrategySuiteHelpers.ts",
  "ictSessionNarrativeTypes.ts",
  "ictSessionNarrative.ts",
  "ictCmdHighDisplacementV2Types.ts",
  "ictCmdHighDisplacementV2.ts"
];

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });
for (const file of sourceFiles) {
  const sourcePath = path.join(sourceRoot, file);
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText
    .replace(/from\s+"\.\/([^"]+)"/g, 'from "./$1.mjs"')
    .replace(/from\s+'\.\/([^']+)'/g, "from './$1.mjs'");
  fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), output, "utf8");
}

const detector = await import(`${pathToFileURL(path.join(outRoot, "ictCmdHighDisplacementV2.mjs")).href}?v=${Date.now()}`);

const base = {
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceProvider: "mt5_read_only",
  sourceFingerprint: "mt5|MNQ|USTECH|5m|fixture",
  signalTime: "2026-06-12T14:35:00.000Z",
  modelProfile: "consolidation_manipulation_distribution",
  modelState: "confirmed",
  modelDirection: "bearish",
  side: "short",
  displacementDirection: "bearish",
  displacementAgeBars: 0,
  displacementScore: 1.8,
  fvgPresentAtSignal: true,
  fvgAgeBars: 1,
  externalLiquidityTargetPresent: true,
  externalLiquidityTargetType: "previous_day_low",
  entry: 100,
  stop: 102,
  target: 94,
  rr: 3
};

const valid = detector.assessIctCmdHighDisplacementV2Evidence(base);
assert.equal(valid.eligible, true);
assert.equal(valid.status, "candidate");
assert.equal(valid.researchOnly, true);
assert.deepEqual(valid.authority, {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
assert.equal(detector.assertIctCmdHighDisplacementV2IsCompact(valid).ok, true);

assert.equal(detector.assessIctCmdHighDisplacementV2Evidence({ ...base, sourceProvider: "mock" }).eligible, false);
assert.equal(detector.assessIctCmdHighDisplacementV2Evidence({ ...base, displacementAgeBars: 5 }).status, "blocked_stale_signal");
assert.equal(detector.assessIctCmdHighDisplacementV2Evidence({ ...base, displacementScore: 1.24 }).status, "blocked_displacement");
assert.equal(detector.assessIctCmdHighDisplacementV2Evidence({ ...base, fvgPresentAtSignal: false }).status, "blocked_fvg");
assert.equal(detector.assessIctCmdHighDisplacementV2Evidence({ ...base, target: undefined, externalLiquidityTargetPresent: false }).status, "blocked_target");
assert.equal(detector.assessIctCmdHighDisplacementV2Evidence({ ...base, rr: 1.99 }).status, "blocked_rr");
assert.equal(detector.assessIctCmdHighDisplacementV2Evidence({ ...base, modelState: "triggered" }).status, "blocked_model");

const serialized = JSON.stringify(valid);
for (const forbidden of ["rawCandles", "candles", "accountData", "orderData", "positionData", "password", "apiKey"]) {
  assert.equal(serialized.includes(`\"${forbidden}\"`), false, `${forbidden} must not be serialized`);
}

console.log(JSON.stringify({
  status: "passed",
  strategyId: valid.strategyId,
  validCandidate: { status: valid.status, rr: valid.rr, displacementScore: valid.displacementScore },
  blockedCases: ["mock_source", "stale_signal", "weak_displacement", "missing_fvg", "missing_target", "rr_below_2", "unconfirmed_model"],
  researchOnly: valid.researchOnly,
  authority: valid.authority,
  compact: detector.assertIctCmdHighDisplacementV2IsCompact(valid)
}, null, 2));
