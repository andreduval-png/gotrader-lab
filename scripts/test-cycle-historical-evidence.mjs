#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourcePath = path.join(root, "src", "lib", "researchEvidence", "cycleHistoricalEvidenceContract.ts");
const outRoot = path.join(root, ".gotrader", "cycle-historical-evidence-test");
const outputPath = path.join(outRoot, "cycleHistoricalEvidenceContract.mjs");
fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });
fs.writeFileSync(
  outputPath,
  ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText,
  "utf8"
);

const { evaluateCycleHistoricalEvidence } = await import(pathToFileURL(outputPath).href);

const tactical = {
  strategyProfile: "liquidity_reclaim_scalper_v1_base_research",
  parameterFingerprint: "sha256:parameters",
  sourceProvider: "certified_dataset",
  requestedSymbol: "MNQ",
  brokerSymbol: "MNQ",
  timeframe: "5m",
  activeSourceFingerprint: "sha256:current-window"
};
const historical = {
  strategyProfile: tactical.strategyProfile,
  parameterFingerprint: tactical.parameterFingerprint,
  sourceProvider: tactical.sourceProvider,
  requestedSymbol: tactical.requestedSymbol,
  brokerSymbol: tactical.brokerSymbol,
  timeframe: tactical.timeframe,
  sourceFingerprint: "sha256:certified-source",
  validationRunId: "sha256:validation"
};
const certificate = {
  datasetCertificateId: "sha256:certificate",
  datasetId: "sha256:dataset",
  reportId: "sha256:report",
  coverageStart: "2024-08-01T00:00:00.000Z",
  coverageEnd: "2026-08-01T00:00:00.000Z",
  strategyProfile: tactical.strategyProfile,
  parameterFingerprint: tactical.parameterFingerprint,
  sourceFingerprint: historical.sourceFingerprint
};

const matched = evaluateCycleHistoricalEvidence({ tacticalIdentity: tactical, historicalIdentity: historical, certificate });
assert.equal(matched.status, "matched_certified");
assert.equal(matched.supportScope, "candidate_support");
assert.deepEqual(matched.mismatchReasons, []);

const uncertified = evaluateCycleHistoricalEvidence({ tacticalIdentity: tactical, historicalIdentity: historical });
assert.equal(uncertified.status, "matched_uncertified");
assert.equal(uncertified.supportScope, "profile_context_only");
assert.match(uncertified.mismatchReasons.join(" "), /certified_dataset_binding/);

const mismatched = evaluateCycleHistoricalEvidence({
  tacticalIdentity: { ...tactical, strategyProfile: "order_block_retracement" },
  historicalIdentity: historical,
  certificate
});
assert.equal(mismatched.status, "mismatched");
assert.equal(mismatched.supportScope, "none");
assert.match(mismatched.mismatchReasons.join(" "), /strategy_profile_mismatch/);

const unavailable = evaluateCycleHistoricalEvidence({
  tacticalIdentity: { ...tactical, parameterFingerprint: undefined }
});
assert.equal(unavailable.status, "unavailable");
assert.equal(unavailable.supportScope, "none");

const invalidCertificate = evaluateCycleHistoricalEvidence({
  tacticalIdentity: tactical,
  historicalIdentity: historical,
  certificate: { ...certificate, coverageEnd: certificate.coverageStart }
});
assert.equal(invalidCertificate.status, "matched_uncertified");
assert.match(invalidCertificate.mismatchReasons.join(" "), /coverage_invalid/);

for (const result of [matched, uncertified, mismatched, unavailable, invalidCertificate]) {
  assert.deepEqual(result.authority, {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  });
  assert.doesNotMatch(JSON.stringify(result), /"candles"|"rawCandles"|"orders"|"positions"/i);
}

const cycleSource = fs.readFileSync(path.join(root, "src", "lib", "researchCycle", "runResearchCycle.ts"), "utf8");
assert.match(cycleSource, /historicalEvidenceContract:\s*run\.historicalEvidenceContract/);
assert.match(cycleSource, /supportScope === "candidate_support"/);
const cycleView = fs.readFileSync(path.join(root, "src", "components", "dashboard", "ResearchCycleControl.tsx"), "utf8");
assert.match(cycleView, /cycle-historical-evidence-contract/);
assert.match(cycleView, /matched_certified/);

console.log("Cycle historical-evidence contract tests passed.");
console.log(JSON.stringify({
  matched: matched.status,
  uncertified: uncertified.status,
  mismatched: mismatched.status,
  unavailable: unavailable.status,
  authority: matched.authority
}, null, 2));
