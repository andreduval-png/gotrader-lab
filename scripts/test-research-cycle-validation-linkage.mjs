#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const libRoot = path.join(root, "src", "lib");
const outRoot = path.join(root, ".gotrader", "research-cycle-validation-linkage-test");
const sourceFiles = [
  "validationProvenance/validationProvenanceTypes.ts",
  "validationProvenance/validationProvenance.ts",
  "validationProvenance/index.ts",
  "validationChain/validationChainTypes.ts",
  "validationChain/buildValidationChain.ts",
  "validationChain/validationChainStore.ts",
  "validationChain/researchCycleValidationChain.ts"
];

const rewriteImports = (source) =>
  source
    .replace(/from\s+"@\/lib\/validationProvenance"/g, 'from "../validationProvenance/index.mjs"')
    .replace(/from\s+'@\/lib\/validationProvenance'/g, "from '../validationProvenance/index.mjs'")
    .replace(/from\s+"\.\/([^".]+)"/g, 'from "./$1.mjs"')
    .replace(/from\s+'\.\/([^'.]+)'/g, "from './$1.mjs'")
    .replace(/from\s+"\.\.\/validationProvenance"/g, 'from "../validationProvenance/index.mjs"')
    .replace(/from\s+'\.\.\/validationProvenance'/g, "from '../validationProvenance/index.mjs'");

fs.rmSync(outRoot, { recursive: true, force: true });
for (const file of sourceFiles) {
  const sourcePath = path.join(libRoot, file);
  const outputPath = path.join(outRoot, file.replace(/\.ts$/, ".mjs"));
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rewriteImports(output), "utf8");
}

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  dispatchEvent: () => true
};

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const provenance = {
  strategyProfile: "ifvg_fresh_retest_v3_research",
  strategyProfileVersion: "v3",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "mt5_read_only|ifvg_v3_frozen|MNQ|5m|34989|start|1|end|2",
  parameterFingerprint: "params_ifvg_v3",
  detectorProfileFingerprint: "detector_ifvg_v3",
  validationRunId: "validation_cycle_link_test",
  validationCutoff: "2026-07-14T04:40:00.000Z",
  dataRangeStart: "2026-01-16T00:00:00.000Z",
  dataRangeEnd: "2026-07-14T04:40:00.000Z"
};

const cycle = {
  cycleId: "cycle_link_test",
  startedAt: "2026-07-19T12:00:00.000Z",
  completedAt: "2026-07-19T12:05:00.000Z",
  status: "completed_with_warnings",
  steps: [],
  llmBridgeAvailable: true,
  validationSummary: {
    validationId: provenance.validationRunId,
    generatedAt: "2026-07-19T12:02:00.000Z",
    provenance,
    readinessStatus: "yellow",
    readinessScore: 79,
    strongestScenario: "short-only",
    weakestScenario: "london-only",
    recommendedConfluenceThreshold: 0.55,
    recommendedConfidenceThreshold: 0.55
  },
  canonicalMetrics: {
    totalTrades: 172,
    winRate: 0.5523,
    averageR: 2.805,
    maxDrawdownR: 8.97,
    falsePositiveCount: 0
  },
  automatedEvidenceSummary: {
    replayOutcomeCount: 172,
    replayTargetFirstRate: 0.5523,
    monteCarloUsableOutcomes: 172,
    monteCarloRobustness: "strong",
    walkForwardVerdict: "robust_research",
    walkForwardOosTrades: 64,
    walkForwardWindowsPassed: 2,
    walkForwardWindowsTested: 2,
    marketAnalysisDepthStatus: "sufficient",
    marketAnalysisTimeframesLoaded: ["W1", "D1", "H4", "H1", "M15", "M5"],
    sourceFingerprint: provenance.sourceFingerprint,
    validationSourceFingerprint: provenance.sourceFingerprint,
    researchOnly: true,
    authority
  },
  evidenceSummary: {
    evidenceScore: 79,
    realEvidenceCoverage: 0.8,
    weakestEvidenceCategories: [],
    readinessEvidenceWarnings: [],
    nextDataImprovement: "Collect forward outcomes."
  },
  maturitySummary: {
    maturityScore: 67,
    maturityGrade: "developing",
    missingRequirements: [],
    maturityWarnings: [],
    nextMaturityRequirement: "Collect forward outcomes."
  },
  dataSourceMode: "mt5_read_only",
  researchTimeframe: "5m",
  validationEvidenceSourceFingerprint: provenance.sourceFingerprint,
  nextRecommendedAction: "Continue research.",
  resultSummary: "Deterministic research completed.",
  safetyNotice: "Research cycle only. Broker execution remains disabled."
};

const walkForwardRun = {
  runId: "wf_cycle_link_test",
  startedAt: "2026-07-19T12:03:00.000Z",
  completedAt: "2026-07-19T12:04:00.000Z",
  status: "completed",
  actualWindowsGenerated: 2,
  provenance: { ...provenance, walkForwardRunId: "wf_cycle_link_test" },
  windows: [
    { metricsBySplit: { out_of_sample: { totalTrades: 32 } } },
    { metricsBySplit: { out_of_sample: { totalTrades: 32 } } }
  ],
  stability: {
    verdict: "robust_research",
    stabilityScore: 92,
    outOfSampleWindowsPassed: 2,
    summary: "2/2 frozen OOS windows passed.",
    failReasons: []
  },
  warnings: []
};

const { linkResearchCycleValidationChain } = await import(
  pathToFileURL(path.join(outRoot, "validationChain", "researchCycleValidationChain.mjs")).href
);

const linked = linkResearchCycleValidationChain({ cycle, walkForwardRun, persist: true });
assert.equal(linked.status, "linked");
assert.equal(linked.entry.hypothesisStatus, "evidence_updated");
assert.equal(linked.entry.sourceCycleId, cycle.cycleId);
assert.equal(linked.entry.replayResult.verdict, "passed");
assert.equal(linked.entry.walkForwardResult.verdict, "passed");
assert.equal(linked.entry.walkForwardResult.tradeCount, 64);
assert.equal(linked.entry.evidenceQuality.evidenceQualityScore, 79);
assert.equal(linked.entry.evidenceQuality.maturityScore, 67);
assert.deepEqual(linked.entry.authority, authority);

const mismatched = linkResearchCycleValidationChain({
  cycle: { ...cycle, cycleId: "cycle_mismatch" },
  walkForwardRun: {
    ...walkForwardRun,
    provenance: { ...walkForwardRun.provenance, sourceFingerprint: "different_source" }
  },
  persist: false
});
assert.equal(mismatched.entry.hypothesisStatus, "walk_forward_required");
assert.match(mismatched.entry.blockers.join(" "), /does not match/i);
assert.equal(mismatched.entry.evidenceQuality, undefined);

const lowSample = linkResearchCycleValidationChain({
  cycle: {
    ...cycle,
    cycleId: "cycle_low_sample",
    automatedEvidenceSummary: {
      ...cycle.automatedEvidenceSummary,
      replayOutcomeCount: 3,
      replayTargetFirstRate: 1
    },
    canonicalMetrics: { ...cycle.canonicalMetrics, totalTrades: 3 }
  },
  walkForwardRun,
  persist: false
});
assert.equal(lowSample.entry.replayResult.verdict, "needs_more_data");
assert.equal(lowSample.entry.walkForwardResult, undefined);
assert.equal(lowSample.entry.evidenceQuality, undefined);

const serialized = JSON.stringify(linked.entry);
assert.doesNotMatch(serialized, /"candles"\s*:|"rawCandles"\s*:|"account(Data)?"\s*:|"order(Data)?"\s*:|"position(Data)?"\s*:/i);
assert.equal(linked.entry.executionIntent, "none");

console.log("Research-cycle validation-chain linkage tests passed.");
console.log(JSON.stringify({
  replay: linked.entry.replayResult.verdict,
  walkForward: linked.entry.walkForwardResult.verdict,
  evidence: linked.entry.evidenceQuality.evidenceQualityScore,
  maturity: linked.entry.evidenceQuality.maturityScore,
  mismatchedOos: mismatched.entry.hypothesisStatus,
  lowSampleReplay: lowSample.entry.replayResult.verdict,
  authority: linked.entry.authority
}, null, 2));
