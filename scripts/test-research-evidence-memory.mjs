#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "research-evidence-memory-test");

const compile = (sourceRelative, outputName, replacements = []) => {
  const sourcePath = path.join(root, sourceRelative);
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  fs.mkdirSync(path.dirname(path.join(outRoot, outputName)), { recursive: true });
  fs.writeFileSync(
    path.join(outRoot, outputName),
    replacements.reduce((value, [from, to]) => value.replaceAll(from, to), output),
    "utf8"
  );
};

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

const runFixture = (cycleId, completedAt, options = {}) => ({
  cycleId,
  startedAt: new Date(new Date(completedAt).getTime() - 60_000).toISOString(),
  completedAt,
  status: "completed_with_warnings",
  steps: [],
  llmBridgeAvailable: false,
  llmAdvisoryUnavailable: true,
  dataSourceMode: "mt5_read_only",
  dataSourceLabel: "MT5 read-only / USTECH",
  rawCandleCount: 17_799,
  processedCandleCount: 17_799,
  validationEvidenceCandleCount: 17_799,
  validationEvidenceLookbackDays: 88.95,
  validationEvidenceRequestedLookbackDays: 90,
  validationSummary: {
    validationId: `validation_${cycleId}`,
    generatedAt: completedAt,
    readinessStatus: "yellow",
    readinessScore: 79,
    strongestScenario: "balanced",
    weakestScenario: "conservative",
    recommendedConfluenceThreshold: 0.7,
    recommendedConfidenceThreshold: 0.72,
    provenance: {
      strategyProfile: "ifvg_fresh_retest_v3_research",
      strategyProfileVersion: "v3",
      sourceProvider: "mt5_read_only",
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      timeframe: "5m",
      sourceFingerprint: options.fingerprint ?? `mt5_${cycleId}`,
      parameterFingerprint: "ifvg_v3_frozen_params",
      dataRangeStart: "2026-01-01T00:00:00.000Z",
      dataRangeEnd: completedAt,
      walkForwardRunId: `wf_${cycleId}`
    }
  },
  researchQualitySummary: {
    reviewId: `quality_${cycleId}`,
    generatedAt: completedAt,
    readinessGrade: "research_ready",
    readinessScore: 79,
    topWeaknesses: [],
    topStrengths: [],
    recommendedNextStep: "Collect forward evidence."
  },
  canonicalMetrics: {
    sourceCycleId: cycleId,
    dataSource: "MT5 read-only / USTECH",
    symbol: "MNQ",
    timeframe: "5m",
    candleWindow: "17799 raw / 17799 processed",
    rawCandleCount: 17_799,
    processedCandleCount: 17_799,
    startingBalance: 100_000,
    currentBalance: 110_000,
    realizedPnL: 10_000,
    realizedPnLPercent: 0.1,
    riskDollarsPerR: 100,
    totalTrades: options.trades ?? 30,
    winningTrades: options.wins ?? 18,
    losingTrades: options.losses ?? 12,
    winRate: options.winRate ?? 0.6,
    averageR: options.averageR ?? 1.2,
    realizedR: options.realizedR ?? 36,
    maxDrawdownR: options.maxDrawdownR ?? 4.2,
    maxDrawdownDollars: 420,
    profitFactor: options.profitFactor ?? 2.4,
    bestTradeR: 3,
    worstTradeR: -1,
    falsePositiveCount: 1,
    skippedSignals: 2,
    confidenceCalibration: 0.8,
    readinessScore: 79,
    stabilityScore: 75,
    generatedAt: completedAt,
    metricSourceLabel: cycleId,
    pnlAssumption: "simulation"
  },
  edgeAuditorSummary: {
    verdict: options.edgeVerdict ?? "positive_edge",
    overfitFlags: [],
    summary: "Deterministic edge audit.",
    confidence: 0.82,
    source: "deterministic"
  },
  automatedEvidenceSummary: {
    replayOutcomeCount: 30,
    replayTargetFirstRate: 0.6,
    monteCarloUsableOutcomes: 30,
    monteCarloRobustness: "strong",
    walkForwardVerdict: "robust_research",
    walkForwardOosTrades: 24,
    walkForwardWindowsPassed: 3,
    walkForwardWindowsTested: 3,
    sourceFingerprint: options.fingerprint ?? `mt5_${cycleId}`,
    researchOnly: true,
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }
  },
  regimeSummary: {
    label: "range_high_volatility",
    instantaneousLabel: "range_high_volatility",
    stableLabel: "range_high_volatility",
    confidence: 0.7,
    dataQuality: "sufficient",
    transitionPending: false,
    candleCount: 1000,
    requiredCandleCount: 300,
    missingInputs: [],
    supportingFactors: [],
    warnings: [],
    sourceFingerprint: options.fingerprint ?? `mt5_${cycleId}`
  },
  evidenceSummary: { evidenceScore: 72, realEvidenceCoverage: 0.8, weakestEvidenceCategories: [], readinessEvidenceWarnings: [], nextDataImprovement: "Forward sample" },
  maturitySummary: { maturityScore: 68, maturityGrade: "developing", missingRequirements: [], maturityWarnings: [], nextMaturityRequirement: "More cycles" },
  readinessSnapshot: { state: "Research Ready" },
  blockers: ["Forward sample incomplete."],
  promotionBlockers: ["Paper-Demo independent evidence incomplete."],
  nextRecommendedAction: "Collect untouched forward evidence.",
  resultSummary: "Positive research cycle; promotion remains blocked.",
  safetyNotice: "Research cycle only. Broker execution remains disabled."
});

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/researchMemory/researchMemoryTypes.ts", "researchMemoryTypes.mjs");
  compile("src/lib/researchEvidenceLedger/researchEvidenceLedgerTypes.ts", "researchEvidenceLedgerTypes.mjs");
  compile("src/lib/researchEvidenceLedger/aggregateResearchEvidence.ts", "aggregateResearchEvidence.mjs", [
    ["./researchEvidenceLedgerTypes", "./researchEvidenceLedgerTypes.mjs"]
  ]);
  compile("src/lib/researchEvidenceLedger/buildResearchEvidenceRecord.ts", "buildResearchEvidenceRecord.mjs", [
    ["@/lib/researchMemory/researchMemoryTypes", "./researchMemoryTypes.mjs"],
    ["./researchEvidenceLedgerTypes", "./researchEvidenceLedgerTypes.mjs"]
  ]);
  compile("src/lib/researchEvidenceLedger/researchEvidenceLedgerStorage.ts", "researchEvidenceLedgerStorage.mjs", [
    ["./aggregateResearchEvidence", "./aggregateResearchEvidence.mjs"],
    ["./buildResearchEvidenceRecord", "./buildResearchEvidenceRecord.mjs"],
    ["./researchEvidenceLedgerTypes", "./researchEvidenceLedgerTypes.mjs"]
  ]);
  compile("src/lib/researchMemory/gbrainMemoryOutbox.ts", "gbrainMemoryOutbox.mjs", [
    ["./researchMemoryTypes", "./researchMemoryTypes.mjs"]
  ]);

  globalThis.window = {
    localStorage: new MemoryStorage(),
    dispatchEvent() {}
  };
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };

  const builder = await import(pathToFileURL(path.join(outRoot, "buildResearchEvidenceRecord.mjs")).href);
  const aggregate = await import(pathToFileURL(path.join(outRoot, "aggregateResearchEvidence.mjs")).href);
  const storage = await import(pathToFileURL(path.join(outRoot, "researchEvidenceLedgerStorage.mjs")).href);
  const gbrain = await import(pathToFileURL(path.join(outRoot, "gbrainMemoryOutbox.mjs")).href);

  const first = builder.buildResearchEvidenceRecord(runFixture("cycle_1", "2026-07-18T14:00:00.000Z"));
  const second = builder.buildResearchEvidenceRecord(runFixture("cycle_2", "2026-07-19T14:00:00.000Z", {
    fingerprint: "mt5_cycle_2",
    trades: 10,
    wins: 4,
    losses: 6,
    winRate: 0.4,
    averageR: -0.2,
    realizedR: -2,
    profitFactor: 0.8,
    edgeVerdict: "overfit_risk"
  }));
  assert.equal(first.resultClass, "positive_edge");
  assert.equal(second.resultClass, "negative_edge");
  assert.equal(builder.assertResearchEvidenceRecordIsCompact(first), true);
  assert.doesNotMatch(JSON.stringify(first), /"(?:candles|rawCandles|accountData|orderData|positionData|password|secret|apiKey)"\s*:/i);

  const directAggregate = aggregate.aggregateResearchEvidence([first, second], "2026-07-19T15:00:00.000Z");
  assert.equal(directAggregate.totalRecords, 2);
  assert.equal(directAggregate.totalProfiles, 1);
  assert.equal(directAggregate.aggregates[0].cycleCount, 2);
  assert.equal(directAggregate.aggregates[0].independentCycleDates, 2);
  assert.equal(directAggregate.aggregates[0].totalTrades, 40);
  assert.equal(directAggregate.aggregates[0].positiveEdgeCycles, 1);
  assert.equal(directAggregate.aggregates[0].negativeEdgeCycles, 1);

  const firstAppend = await storage.appendResearchEvidenceRecord(first);
  const duplicateAppend = await storage.appendResearchEvidenceRecord(first);
  const secondAppend = await storage.appendResearchEvidenceRecord(second);
  assert.equal(firstAppend.status, "appended");
  assert.equal(duplicateAppend.status, "duplicate");
  assert.equal(secondAppend.aggregateIndex.totalRecords, 2);
  assert.equal(storage.loadResearchEvidenceAggregateIndex().totalRecords, 2);
  const backfilled = await storage.backfillResearchEvidenceFromCycleRuns([
    runFixture("cycle_1", "2026-07-18T14:00:00.000Z"),
    runFixture("cycle_3", "2026-07-20T14:00:00.000Z", { fingerprint: "mt5_cycle_3" })
  ]);
  assert.equal(backfilled.totalRecords, 3, "backfill should add missing completed cycles and ignore duplicates");

  const packet = builder.buildResearchEvidenceMemoryPacket(first);
  assert.deepEqual(gbrain.validateGbrainMemoryPacket(packet), { valid: true, blockedFields: [] });
  const document = gbrain.buildGbrainMemoryDocument(packet);
  assert.equal(document.path, "gotrader/research-cycle/cycle_1.md");
  assert.match(document.markdown, /executionAuthority: none/);
  assert.doesNotMatch(document.markdown, /(?:password|api key|account data|order data|position data):/i);
  const queued = gbrain.queueGbrainMemoryPacket(packet);
  assert.equal(gbrain.loadGbrainMemoryOutbox().deliveryEnabled, false);
  assert.equal(queued.status, "pending");
  assert.deepEqual(await gbrain.deliverPendingGbrainMemory({ endpoint: "http://127.0.0.1:8799/ingest" }), {
    status: "disabled", delivered: 0, failed: 0
  });

  window.localStorage.setItem(gbrain.GBRAIN_MEMORY_OUTBOX_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, entries: [] }));
  assert.equal(gbrain.loadGbrainMemoryOutbox().deliveryEnabled, false, "missing persisted flag must fail closed");
  gbrain.queueGbrainMemoryPacket(packet);
  gbrain.setGbrainMemoryDeliveryEnabled(true, "http://user:secret@127.0.0.1:8799/ingest?token=hidden");
  assert.equal(gbrain.loadGbrainMemoryOutbox().endpointHost, "127.0.0.1:8799");
  assert.equal((await gbrain.deliverPendingGbrainMemory({ endpoint: "https://example.com/ingest" })).status, "blocked_non_loopback_endpoint");
  const delivered = await gbrain.deliverPendingGbrainMemory({
    endpoint: "http://127.0.0.1:8799/ingest",
    fetchImpl: async () => ({ ok: true, status: 200 })
  });
  assert.equal(delivered.status, "completed");
  assert.equal(delivered.delivered, 1);

  const unsafePacket = structuredClone(packet);
  unsafePacket.authority.brokerAuthority = "read_only";
  assert.equal(gbrain.validateGbrainMemoryPacket(unsafePacket).valid, false);
  const secretPacket = structuredClone(packet);
  secretPacket.resultSummary = "OPENAI_API_KEY=must_not_leave_browser";
  assert.equal(gbrain.validateGbrainMemoryPacket(secretPacket).valid, false);

  const cycleSource = fs.readFileSync(path.join(root, "src/lib/researchCycle/runResearchCycle.ts"), "utf8");
  const proposalSource = fs.readFileSync(path.join(root, "src/lib/selfImprovement/createCalibrationProposal.ts"), "utf8");
  assert.match(cycleSource, /appendResearchEvidenceRecord/);
  assert.match(cycleSource, /queueGbrainMemoryPacket/);
  assert.match(proposalSource, /lifetimeEvidenceFor/);
  assert.match(proposalSource, /historical_context_only/);

  console.log(JSON.stringify({
    status: "passed",
    records: backfilled.totalRecords,
    profiles: backfilled.totalProfiles,
    gbrainDefault: "disabled",
    gbrainDelivery: delivered.status,
    authority: first.authority
  }, null, 2));
}

main().catch((error) => {
  console.error("Research evidence memory test failed:", error);
  process.exitCode = 1;
});
