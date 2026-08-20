#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src", "lib", "simulatedOutcomeLedger");
const outRoot = path.join(root, ".gotrader", "simulated-outcome-ledger-test");
const files = [
  "simulatedOutcomeLedgerTypes.ts",
  "simulatedOutcomeIntegrity.ts",
  "simulatedOutcomeStorage.ts",
  "buildSimulatedOutcomeEvents.ts",
  "persistPaperSignalOutcome.ts"
];

function compile() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });
  for (const file of files) {
    const sourcePath = path.join(sourceRoot, file);
    const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText.replace(/from\s+"\.\/([^\"]+)"/g, 'from "./$1.mjs"');
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), output, "utf8");
  }
}

const provenance = {
  strategyProfile: "liquidity_reclaim_scalper_v1_base_research",
  strategyProfileVersion: "r1",
  sourceProvider: "certified_dataset",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "sha256:source",
  parameterFingerprint: "sha256:parameters",
  validationRunId: "validation_1"
};

const cycle = {
  cycleId: "cycle_1",
  startedAt: "2026-08-17T12:00:00.000Z",
  completedAt: "2026-08-17T12:05:00.000Z",
  status: "completed_with_warnings",
  steps: [],
  validationSummary: { provenance },
  validationReport: { provenance },
  dataSourceMode: "imported",
  sourceMetadata: { activeSourceFingerprint: provenance.sourceFingerprint },
  ictAdvisorSignalSummary: {
    decision: "watchlist_signal",
    setup: "liquidity_reclaim",
    noTradeReasons: [],
    targetProvenance: {
      type: "external_liquidity",
      sourceTimeframe: "H1",
      selectionReason: "Nearest unswept external liquidity above entry.",
      distancePoints: 24,
      rr: 2,
      minimumRR: 1.5,
      gateStatus: "accepted",
      rejectionReasons: []
    }
  },
  blockers: [],
  nextRecommendedAction: "Continue research.",
  resultSummary: "fixture",
  safetyNotice: "Research cycle only. Broker execution remains disabled."
};

const trade = (id, outcome) => ({
  id,
  decisionId: `decision_${id}`,
  thesisId: "thesis_1",
  symbol: "MNQ",
  timeframe: "5m",
  session: "new_york",
  marketRegime: "trending",
  bias: "bullish",
  confidence: 0.75,
  decisionIndex: 10,
  entryIndex: 11,
  exitIndex: 20,
  openedAt: "2026-08-17T13:00:00.000Z",
  resolvedAt: "2026-08-17T13:30:00.000Z",
  entryZone: [100, 102],
  entryPrice: 101,
  invalidation: 96,
  target: 111,
  targetHit: outcome === "target_hit",
  stopHit: outcome === "stop_hit",
  expired: outcome === "expired",
  outcome,
  maxFavorableExcursion: 11,
  maxAdverseExcursion: 2,
  rMultiple: outcome === "target_hit" ? 2 : outcome === "stop_hit" ? -1 : 0,
  riskReward: 2,
  reason: `${outcome} fixture`,
  simulatedTradePlan: {
    id: `plan_${id}`,
    symbol: "MNQ",
    timeframe: "5m",
    bias: "bullish",
    entryZone: [100, 102],
    invalidation: 96,
    targetLiquidity: 111,
    stopRiskNotes: "fixture",
    riskReward: 2,
    mode: "simulation"
  },
  agentAttribution: []
});

async function main() {
  compile();
  const builders = await import(pathToFileURL(path.join(outRoot, "buildSimulatedOutcomeEvents.mjs")));
  const integrity = await import(pathToFileURL(path.join(outRoot, "simulatedOutcomeIntegrity.mjs")));
  const storage = await import(pathToFileURL(path.join(outRoot, "simulatedOutcomeStorage.mjs")));
  const paperPersistence = await import(pathToFileURL(path.join(outRoot, "persistPaperSignalOutcome.mjs")));

  const plan = {
    id: "current_plan_1",
    symbol: "MNQ",
    timeframe: "5m",
    bias: "bullish",
    entryZone: [100, 102],
    invalidation: 96,
    targetLiquidity: 111,
    stopRiskNotes: "fixture",
    riskReward: 2,
    mode: "simulation"
  };
  const pending = await builders.buildCurrentCyclePlanEvent({ cycle, plan });
  assert.equal(pending.status, "pending");
  assert.equal(pending.plan.targetProvenance.type, "external_liquidity");
  assert.equal(pending.plan.targetProvenance.sourceTimeframe, "H1");
  assert.equal(pending.plan.targetProvenance.gateStatus, "accepted");
  assert.equal(await integrity.verifySimulatedOutcomeEvent(pending), true);

  const result = {
    config: { strategyProfile: provenance.strategyProfile, timeframe: "5m" },
    trades: [trade("winner", "target_hit"), trade("loser", "stop_hit"), trade("expired", "expired")]
  };
  const backtestEvents = await builders.buildBacktestOutcomeEvents({ cycle, result });
  assert.deepEqual(backtestEvents.map((event) => event.status), ["target_hit", "stop_hit", "expired"]);
  assert.deepEqual(backtestEvents.map((event) => event.result.points), [10, -5, undefined]);

  const firstAppend = await storage.appendSimulatedOutcomeEvent(pending);
  const duplicateAppend = await storage.appendSimulatedOutcomeEvent(pending);
  assert.equal(firstAppend.status, "appended");
  assert.equal(duplicateAppend.status, "duplicate");
  await storage.appendSimulatedOutcomeEvents(backtestEvents);

  const paperSignal = {
    paperSignalId: "paper_1",
    sourceSignalId: "signal_1",
    generatedAt: "2026-08-17T14:00:00.000Z",
    researchOnly: true,
    paperOnly: true,
    status: "paper_open",
    outcome: "open",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    primaryTimeframe: "5m",
    side: "long",
    simulatedEntry: { type: "entry_zone_midpoint", price: 101 },
    invalidation: 96,
    target: 111,
    rrEstimate: 2,
    confidence: 0.75,
    simulatedRisk: { riskPerIdeaPct: 0.1, maxLossR: 1, targetR: 2 },
    lifecycle: [{ at: "2026-08-17T14:00:00.000Z", event: "created", note: "fixture" }],
    notes: [],
    authority: pending.authority,
    safety: { ...pending.safety, realOrderPlaced: false, brokerMutation: false }
  };
  const paperIdentity = { ...pending.identity, cycleId: "cycle_1" };
  delete paperIdentity.tradeId;
  const paperPending = await builders.buildPaperOutcomeEvent({ paperSignal, identity: paperIdentity });
  await storage.appendSimulatedOutcomeEvent(paperPending);
  const paperResolvedAppend = await paperPersistence.persistPaperSignalOutcome({
    paperSignal: {
      ...paperSignal,
      status: "paper_target_hit",
      outcome: "target_hit",
      lifecycle: [...paperSignal.lifecycle, { at: "2026-08-17T14:30:00.000Z", event: "target_hit", price: 111, note: "Target reached." }]
    },
    recordedAt: "2026-08-17T14:30:00.000Z"
  });
  const paperResolved = paperResolvedAppend.event;
  assert.equal(paperResolved.previousEventHash, paperPending.evidenceHash);

  const ledger = await storage.listSimulatedOutcomeEvents();
  assert.equal(ledger.events.length, 6);
  assert.equal(ledger.latest.length, 5);
  assert.equal(ledger.latest.find((event) => event.outcomeKey === paperPending.outcomeKey).status, "target_hit");
  assert.equal(ledger.rejectedEventCount, 0);

  await assert.rejects(
    storage.appendSimulatedOutcomeEvent({ ...pending, status: "target_hit" }),
    /integrity verification/
  );
  await assert.rejects(
    integrity.createSimulatedOutcomeEvent({
      ...pending,
      eventId: undefined,
      evidenceHash: undefined,
      identity: { ...pending.identity, parameterFingerprint: "" }
    }),
    /identity is incomplete/
  );

  const serialized = JSON.stringify(ledger);
  assert.doesNotMatch(serialized, /"candles"\s*:/i);
  assert.doesNotMatch(serialized, /"(?:accountData|orderData|positionData|apiKey|token|password|secret)"\s*:/i);

  console.log(JSON.stringify({
    status: "passed",
    immutableEvents: ledger.events.length,
    latestOutcomes: ledger.latest.length,
    paperChain: [paperPending.evidenceHash, paperResolved.evidenceHash],
    statuses: ledger.latest.map((event) => event.status),
    authority: pending.authority
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
