#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourcePath = path.join(
  projectRoot,
  "src",
  "lib",
  "readiness",
  "readinessRequirementPriority.ts"
);
const outRoot = path.join(projectRoot, ".gotrader", "readiness-blocker-priority-test");
const outputPath = path.join(outRoot, "readinessRequirementPriority.mjs");

fs.mkdirSync(outRoot, { recursive: true });
const source = fs.readFileSync(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    verbatimModuleSyntax: false
  },
  fileName: sourcePath
}).outputText;
fs.writeFileSync(outputPath, output, "utf8");

const { prioritizeReadinessRequirements } = await import(pathToFileURL(outputPath).href);

const result = (id, passed) => ({
  id,
  label: id,
  passed,
  severity: "blocker",
  detail: id,
  currentValue: passed ? "passed" : "missing",
  requiredValue: "passed",
  explanation: id,
  suggestedFix: id
});

const requirements = ({
  validation = true,
  sample = true,
  quality = true,
  deterministic = true,
  llm = false,
  runbook = false
} = {}) => [
  result("validation-exists", validation),
  result("research-quality-exists", quality),
  result("simulated-trade-sample", sample),
  result("quality-candidate", deterministic),
  result("drawdown-threshold", deterministic),
  result("oos-edge-evidence", deterministic),
  result("llm-advisory-review", llm),
  result("runbook-complete", runbook)
];

const missingValidation = prioritizeReadinessRequirements(requirements({ validation: false, sample: false, quality: false }));
assert.deepEqual(missingValidation.activeFailedRequirements.map((item) => item.id), ["validation-exists"]);

const zeroTrades = prioritizeReadinessRequirements(requirements({ sample: false, deterministic: false }));
assert.deepEqual(zeroTrades.activeFailedRequirements.map((item) => item.id), ["simulated-trade-sample"]);
assert.ok(zeroTrades.deferredRequirements.some((item) => item.id === "quality-candidate"));
assert.ok(zeroTrades.deferredRequirements.some((item) => item.id === "llm-advisory-review"));
assert.ok(zeroTrades.deferredRequirements.some((item) => item.id === "runbook-complete"));

const missingQuality = prioritizeReadinessRequirements(requirements({ quality: false, deterministic: false }));
assert.deepEqual(missingQuality.activeFailedRequirements.map((item) => item.id), ["research-quality-exists"]);

const weakEvidence = prioritizeReadinessRequirements(requirements({ deterministic: false }));
assert.deepEqual(
  weakEvidence.activeFailedRequirements.map((item) => item.id),
  ["quality-candidate", "drawdown-threshold", "oos-edge-evidence"]
);
assert.ok(weakEvidence.deferredRequirements.every((item) => ["llm-advisory-review", "runbook-complete"].includes(item.id)));

const finalReview = prioritizeReadinessRequirements(requirements());
assert.deepEqual(
  finalReview.activeFailedRequirements.map((item) => item.id),
  ["llm-advisory-review", "runbook-complete"]
);
assert.equal(finalReview.deferredRequirements.length, 0);

const runtimeSource = fs.readFileSync(
  path.join(projectRoot, "src", "lib", "runtime", "resolveResearchRuntimeSnapshot.ts"),
  "utf8"
);
assert.match(runtimeSource, /activeDataSource:\s*activeResearchMode/);
assert.match(runtimeSource, /sourceLabel:\s*displaySource\.activeResearchSourceLabel/);
assert.match(runtimeSource, /activeFailedRequirements/);

const missionSource = fs.readFileSync(
  path.join(projectRoot, "src", "components", "dashboard", "MissionControlShell.tsx"),
  "utf8"
);
assert.match(
  missionSource,
  /!snapshot\.marketData\.isImportedDataActive\s*&&\s*!mt5IsActive\s*&&\s*!tradingViewIsSelected/
);

console.log("GoTrader readiness blocker priority test passed.");
console.log(JSON.stringify({
  zeroTradeActive: zeroTrades.activeFailedRequirements.map((item) => item.id),
  zeroTradeDeferred: zeroTrades.deferredRequirements.map((item) => item.id),
  finalReviewActive: finalReview.activeFailedRequirements.map((item) => item.id),
  authority: {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  }
}, null, 2));
