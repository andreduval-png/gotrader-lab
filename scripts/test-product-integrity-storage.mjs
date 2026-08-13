#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", "product-integrity-storage-test");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const compile = (source, target, replacements = []) => {
  const sourcePath = path.join(root, source);
  let output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove },
    fileName: sourcePath
  }).outputText;
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement);
  fs.writeFileSync(path.join(out, target), output, "utf8");
};

compile("src/lib/utils.ts", "utils.mjs");
compile("src/lib/predictionLedger/predictionLedgerTypes.ts", "predictionLedgerTypes.mjs");
compile("src/lib/predictionLedger/predictionLedgerStorage.ts", "predictionLedgerStorage.mjs", [
  [/from\s+"\.\/predictionLedgerTypes"/g, 'from "./predictionLedgerTypes.mjs"']
]);
compile("src/lib/llm/llmProvider.ts", "llmProvider.mjs", [
  [/from\s+"@\/lib\/utils"/g, 'from "./utils.mjs"']
]);

class QuotaStorage {
  constructor(limit) { this.limit = limit; this.values = new Map(); this.attempts = 0; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    this.attempts += 1;
    if (String(value).length > this.limit) throw Object.assign(new Error("quota exceeded"), { name: "QuotaExceededError" });
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

const localStorage = new QuotaStorage(2_500);
const sessionStorage = new QuotaStorage(50_000);
const events = [];
globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
globalThis.window = { localStorage, sessionStorage, dispatchEvent: (event) => events.push(event) };

const prediction = await import(pathToFileURL(path.join(out, "predictionLedgerStorage.mjs")));
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const entries = Array.from({ length: 80 }, (_, index) => ({
  predictionId: `prediction-${index}`, scenarioMapId: "map", scenarioId: `scenario-${index}`,
  scenarioFamily: "fixture", modelVersion: "test", issuedAt: new Date(index * 1000).toISOString(),
  asOfTimestamp: new Date(index * 1000).toISOString(), expiresAt: new Date(index * 1000 + 60_000).toISOString(),
  requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m", sourceProvider: "mt5_read_only",
  sourceFingerprint: "fingerprint", direction: "bullish", lifecycleState: "anticipated",
  probabilityBand: "moderate", probabilityEstimate: 0.6, probabilitySource: "heuristic_uncalibrated",
  calibrationSampleSize: 0, thesis: "research ".repeat(20), liquidityDraw: "external liquidity",
  expectedSequence: ["one"], requiredConfirmations: ["two"], invalidationConditions: ["three"],
  targetReferences: [{ label: "target", price: 102 }], resolution: "pending", barsObserved: 0,
  maxBarsToResolve: 48, independentDate: "2026-08-13", blockerSummary: "none", authority,
  safety: { researchOnly: true, rawCandlesExcluded: true, rawSnapshotsExcluded: true, autoPromotionAllowed: false, executionIntentCreated: false }
}));
assert.doesNotThrow(() => prediction.savePredictionLedger(entries));
assert.ok(localStorage.attempts > 1, "prediction ledger should retry bounded compact histories");
const recoveredPredictions = prediction.loadPredictionLedger().entries.length;
assert.ok(recoveredPredictions >= 5 && recoveredPredictions <= 20, "reload should recover the largest bounded history that fits");

localStorage.limit = 10;
const llm = await import(pathToFileURL(path.join(out, "llmProvider.mjs")));
const llmState = {
  researchMode: "llm_required", providerMode: "local_command",
  runs: Array.from({ length: 20 }, (_, index) => ({ runId: `run-${index}`, payload: "advisory ".repeat(300) })),
  totalContextExports: 1, totalResponseImports: 1, unsafeResponseRejections: 0,
  deterministicFallbackEnabled: true, mockModeAllowed: true, safetyNotice: "advisory only"
};
assert.doesNotThrow(() => llm.saveLLMResearchState(llmState));
assert.ok(sessionStorage.getItem(llm.LLM_RESEARCH_STORAGE_KEY), "LLM state should fall back to bounded session storage");
assert.equal(llm.loadLLMResearchState().runs.length, 1, "LLM reload should recover one bounded advisory run");
assert.ok(events.length >= 2, "storage updates should still notify subscribers");

console.log(JSON.stringify({ status: "passed", predictionLocalAttempts: localStorage.attempts, llmSessionFallback: true, authority }, null, 2));
