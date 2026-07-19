#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", "autonomous-storage-resilience-test");

function transpile(source, target, replacements = []) {
  const sourcePath = path.join(root, source);
  let output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement);
  fs.writeFileSync(path.join(out, target), output, "utf8");
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
transpile("src/lib/utils.ts", "utils.mjs");
transpile(
  "src/lib/autonomousResearch/autonomousResearchStorage.ts",
  "autonomousResearchStorage.mjs",
  [[/from\s+"@\/lib\/utils"/g, 'from "./utils.mjs"']]
);
transpile("src/lib/researchCycle/safeResearchCycleObserver.ts", "safeResearchCycleObserver.mjs");
transpile("src/lib/validation/validationReportStorage.ts", "validationReportStorage.mjs");

class MemoryStorage {
  constructor(alwaysThrow = false) {
    this.alwaysThrow = alwaysThrow;
    this.values = new Map();
    this.setAttempts = 0;
    this.removeAttempts = 0;
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    this.setAttempts += 1;
    if (this.alwaysThrow) {
      const error = new Error(`Setting ${key} exceeded the quota.`);
      error.name = "QuotaExceededError";
      throw error;
    }
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.removeAttempts += 1;
    this.values.delete(key);
  }
}

const localStorage = new MemoryStorage(true);
const sessionStorage = new MemoryStorage(false);
const events = [];
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
};
globalThis.window = {
  localStorage,
  sessionStorage,
  dispatchEvent(event) { events.push(event); }
};

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const hooks = {
  status: "planned",
  openClawMemory: "not_connected",
  packets: {},
  safetyLocks: {
    ...authority,
    brokerExecutionDisabled: true,
    liveTradingDisabled: true,
    goTraderHandoffAuthority: "none",
    paperDemoApprovalAuthority: "none"
  }
};
const hermes = {
  status: "planned",
  hermesNotifications: "not_connected",
  safetyLocks: hooks.safetyLocks
};

const longText = "quota-regression ".repeat(300);
const run = {
  runId: "autonomous_quota_test",
  startedAt: "2026-07-19T12:00:00.000Z",
  status: "running",
  settings: {
    maxIterations: 1,
    noImprovementStop: 1,
    safeImportedDataMode: true,
    advancedFullResearchMode: false,
    runLlmAdvisory: false,
    autoApplyPolicyEnabled: false
  },
  currentIteration: 1,
  progress: {
    status: "running",
    activeStage: "backtest",
    activeStageLabel: "Backtest / validation",
    currentIteration: 1,
    maxIterations: 1,
    progressPercent: 30,
    startedAt: "2026-07-19T12:00:00.000Z",
    updatedAt: "2026-07-19T12:00:01.000Z",
    currentTask: longText,
    events: Array.from({ length: 40 }, (_, index) => ({
      eventId: `event_${index}`,
      timestamp: "2026-07-19T12:00:01.000Z",
      stage: "backtest",
      title: `Validation ${index}`,
      detail: longText
    }))
  },
  iterations: [{
    iteration: 1,
    startedAt: "2026-07-19T12:00:00.000Z",
    blockerDiagnosis: ["insufficient_trades"],
    status: "running",
    notes: Array.from({ length: 20 }, () => longText)
  }],
  readinessTrend: "not_ready",
  maturityTrend: longText,
  goTraderHandoffGate: {
    eligibleForReview: false,
    reasons: [longText],
    brokerExecutionDisabled: true
  },
  calibrationDriftHistory: [],
  openClawHooks: hooks,
  hermesNotifications: hermes,
  safetyNotice: "Autonomous research is simulation-only. It cannot execute trades, approve Paper-Demo Candidate, send go-trader handoffs, or override readiness.",
  rawCandles: Array.from({ length: 5000 }, () => ({ open: 1, high: 2, low: 0, close: 1 })),
  accountData: { id: "must_be_removed" }
};

const storage = await import(pathToFileURL(path.join(out, "autonomousResearchStorage.mjs")));
const saved = storage.saveAutonomousResearchRun(run);
assert.equal(saved.activeRun.runId, run.runId);
assert.equal(saved.runs.some((item) => item.runId === run.runId), false, "active run must not be duplicated in history");
assert.ok(localStorage.setAttempts >= 4, "local persistence should retry compact modes");
assert.ok(sessionStorage.getItem(storage.AUTONOMOUS_RESEARCH_STORAGE_KEY), "session fallback should preserve checkpoint");
assert.equal(storage.latestAutonomousResearchRun().runId, run.runId);
assert.ok(storage.estimateAutonomousResearchStateBytes(saved) < 100_000, "minimal checkpoint should remain compact");
const serializedRun = JSON.stringify(saved);
assert.doesNotMatch(serializedRun, /"(?:rawCandles|candles|accountData|orderData|positionData)"\s*:/i);
assert.equal(saved.activeRun.settings.autoApplyPolicyEnabled, false);

const observer = await import(pathToFileURL(path.join(out, "safeResearchCycleObserver.mjs")));
let validationCompleted = false;
const observerAccepted = observer.notifyResearchCycleObserver(() => {
  throw Object.assign(new Error("Storage quota exceeded"), { name: "QuotaExceededError" });
}, { step: "validation" });
validationCompleted = true;
assert.equal(observerAccepted, false);
assert.equal(validationCompleted, true, "observer failure must not interrupt deterministic validation");

const validationStorage = await import(pathToFileURL(path.join(out, "validationReportStorage.mjs")));
const report = {
  id: "validation_quota_test",
  generatedAt: "2026-07-19T12:01:00.000Z",
  scenarios: [{
    id: "conservative-confluence",
    name: "Conservative confluence",
    description: longText,
    category: "threshold",
    config: {},
    totalTrades: 30,
    winRate: 0.6,
    averageR: 0.5,
    maxDrawdown: 2,
    bestTrade: { id: "large_best", decisionContext: { rawCandles: run.rawCandles } },
    worstTrade: { id: "large_worst", decisionContext: { rawCandles: run.rawCandles } },
    bestTradeR: 2,
    worstTradeR: -1,
    skippedSignals: 0,
    skipReasons: [],
    profitFactor: 2,
    confidenceCalibration: { score: 80, averageConfidence: 0.7, realizedWinRate: 0.6, calibrationGap: 0.1, sampleSize: 30 },
    agentContributionSummary: [],
    score: 80,
    readiness: "yellow"
  }],
  calibration: {
    strongestScenario: "Conservative confluence",
    weakestScenario: "Conservative confluence",
    bestSession: "n/a",
    worstSession: "n/a",
    bestBiasDirection: "n/a",
    worstBiasDirection: "n/a",
    recommendedConfluenceThreshold: 0.5,
    recommendedConfidenceThreshold: 0.6,
    agentWeightsToIncrease: [],
    agentWeightsToDecrease: [],
    weakICTRules: [],
    readinessStatus: "yellow",
    readinessScore: 80,
    recommendedNextStep: "Collect OOS evidence.",
    generatedAt: "2026-07-19T12:01:00.000Z"
  },
  safetyNotice: "Simulation validation only. No broker connection. No real trades."
};
assert.doesNotThrow(() => validationStorage.saveLatestValidationReport(report));
assert.equal(validationStorage.loadLatestValidationReport().id, report.id);
const storedValidation = sessionStorage.getItem(validationStorage.VALIDATION_REPORT_STORAGE_KEY);
assert.ok(storedValidation, "validation should fall back to session storage");
assert.doesNotMatch(storedValidation, /"(?:bestTrade|worstTrade|rawCandles|candles)"\s*:/i);

assert.equal(saved.activeRun.goTraderHandoffGate.brokerExecutionDisabled, true);
assert.deepEqual(authority, {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

console.log(JSON.stringify({
  status: "passed",
  autonomousCheckpointBytes: storage.estimateAutonomousResearchStateBytes(saved),
  localWriteAttempts: localStorage.setAttempts,
  sessionFallback: true,
  validationObserverIsolated: true,
  validationReportRecovered: true,
  authority
}, null, 2));
