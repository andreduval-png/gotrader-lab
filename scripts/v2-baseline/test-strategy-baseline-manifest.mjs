#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { compileTypescriptModules } from "./compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-strategy-manifest-test");
const sourceRoot = path.join(workspace, "src", "lib");
compileTypescriptModules({
  outRoot,
  files: [
    "strategyLibrary/strategyLibraryTypes.ts",
    "strategyLibrary/strategyRegistry.ts",
    "v2Baseline/baselineTypes.ts",
    "v2Baseline/strategyBaselineManifest.ts"
  ].map((file) => path.join(sourceRoot, file))
});

const module = await import(`${pathToFileURL(path.join(outRoot, "strategyBaselineManifest.mjs")).href}?t=${Date.now()}`);
const packageScripts = JSON.parse(fs.readFileSync(path.join(workspace, "package.json"), "utf8")).scripts;
const validation = module.validateStrategyBaselineManifest();
assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));
assert.ok(validation.entryCount >= 27, `Expected at least 27 catalog and legacy entries, got ${validation.entryCount}.`);

for (const entry of module.STRATEGY_BASELINE_MANIFEST) {
  for (const filePath of [
    ...entry.detectorPaths,
    ...entry.typePaths,
    ...entry.tradeConstructionPaths,
    ...entry.validationProfilePaths,
    ...entry.evidencePaths,
    ...entry.uiConsumers
  ]) {
    assert.equal(fs.existsSync(path.join(workspace, filePath)), true, `${entry.strategyId} references missing path ${filePath}`);
  }
  for (const command of entry.testCommands) {
    assert.ok(packageScripts[command], `${entry.strategyId} references missing npm script ${command}`);
  }
}

const counts = Object.fromEntries(
  [...new Set(module.STRATEGY_BASELINE_MANIFEST.map((entry) => entry.classification))]
    .sort()
    .map((classification) => [
      classification,
      module.STRATEGY_BASELINE_MANIFEST.filter((entry) => entry.classification === classification).length
    ])
);
assert.equal(module.STRATEGY_BASELINE_MANIFEST.every((entry) => entry.authority.executionAuthority === "none"), true);
console.log(JSON.stringify({ status: "passed", entryCount: validation.entryCount, classifications: counts }, null, 2));
