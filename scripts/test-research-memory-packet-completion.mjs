#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "research-memory-packet-completion-test");

const compile = (source, output, replacements = []) => {
  const sourcePath = path.join(root, source);
  const transpiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove },
    fileName: sourcePath
  }).outputText;
  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(path.join(outRoot, output), replacements.reduce((text, [from, to]) => text.replaceAll(from, to), transpiled), "utf8");
};

const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const safety = {
  rawCandlesExcluded: true,
  rawRuntimeSnapshotsExcluded: true,
  importedOhlcvArraysExcluded: true,
  accountDataExcluded: true,
  orderDataExcluded: true,
  positionDataExcluded: true,
  secretsExcluded: true,
  screenshotsBase64Excluded: true,
  readinessPromotionAllowed: false
};

const record = {
  schemaVersion: 1,
  evidenceId: "research_evidence_cycle_complete",
  cycleId: "cycle_complete",
  startedAt: "2026-08-17T14:00:00.000Z",
  completedAt: "2026-08-17T14:05:00.000Z",
  cycleStatus: "completed_with_warnings",
  identity: {
    identityKey: "ifvg|v3|params|mnq|ustech|5m|mt5",
    strategyProfile: "ifvg_fresh_retest_v3_research",
    strategyProfileVersion: "v3",
    parameterFingerprint: "params_v3",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceProvider: "mt5_read_only"
  },
  source: {
    provider: "mt5_read_only",
    label: "MT5 read-only USTECH",
    sourceFingerprint: "mt5_ustech_5m_frozen",
    candleCount: 17000,
    processedCandleCount: 17000,
    dataRangeStart: "2026-05-01T00:00:00.000Z",
    dataRangeEnd: "2026-08-17T14:00:00.000Z",
    eligibility: "research_eligible",
    warnings: []
  },
  context: { regime: "range", regimeConfidence: 0.7, regimeDataQuality: "ready", setup: "ifvg", side: "short", thesisBias: "bearish", advisoryStatus: "available" },
  performance: { tradeCount: 24, winningTrades: 14, losingTrades: 10, winRate: 0.583, averageR: 0.8, realizedR: 19.2, profitFactor: 1.6, maxDrawdownR: 3.1, falsePositiveCount: 2, skippedSignals: 4 },
  validation: { validationId: "validation_complete", walkForwardRunId: "wf_complete", walkForwardVerdict: "research_candidate", walkForwardOosTrades: 12, walkForwardWindowsPassed: 2, walkForwardWindowsTested: 3, edgeVerdict: "positive_edge", edgeFlags: ["one weak OOS window"], monteCarloUsableOutcomes: 24 },
  evidenceMaturity: { evidenceScore: 72, maturityScore: 66, maturityGrade: "developing", readinessState: "Research Ready" },
  proposal: { proposalId: "proposal_complete", proposalStatus: "testing" },
  agentMetrics: [
    { agentId: "ict-liquidity-agent", agentLabel: "ICT Liquidity", averageConfidence: 0.72, averageWeight: 0.15, totalOpinions: 24, cioAlignmentRate: 0.75 }
  ],
  resultClass: "positive_edge",
  blockers: ["Session consistency remains weak."],
  promotionBlockers: ["Missing independent forward sample."],
  nextAction: "Collect an independent forward sample.",
  resultSummary: "Positive cycle with promotion blockers.",
  researchOnly: true,
  authority,
  safety
};

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/researchMemory/researchMemoryTypes.ts", "researchMemoryTypes.mjs");
  compile("src/lib/researchMemory/supplementalResearchMemoryPackets.ts", "supplemental.mjs", [
    ['"./researchMemoryTypes"', '"./researchMemoryTypes.mjs"']
  ]);
  compile("src/lib/researchMemory/gbrainMemoryOutbox.ts", "outbox.mjs", [
    ['"./researchMemoryTypes"', '"./researchMemoryTypes.mjs"']
  ]);
  const supplemental = await import(pathToFileURL(path.join(outRoot, "supplemental.mjs")).href);
  const outbox = await import(pathToFileURL(path.join(outRoot, "outbox.mjs")).href);
  const packets = supplemental.buildSupplementalEvidenceMemoryPackets(record);
  assert.deepEqual(new Set(packets.map((packet) => packet.memoryType)), new Set(["walk_forward", "self_improvement", "gap_analysis", "agent_metric"]));
  const agentPacket = packets.find((packet) => packet.memoryType === "agent_metric");
  assert.equal(agentPacket.averageConfidence, 0.72);
  assert.equal(agentPacket.cioAlignmentRate, 0.75);
  assert.equal(agentPacket.metrics.averageR, null);
  assert.equal(agentPacket.metrics.winRate, null);
  for (const packet of packets) {
    assert.equal(outbox.validateGbrainMemoryPacket(packet).valid, true, packet.memoryType);
    assert.equal(packet.authority.executionAuthority, "none");
    assert.equal(packet.memoryIdentity.researchCycleId, record.cycleId);
    const document = outbox.buildGbrainMemoryDocument(packet);
    assert.match(document.path, new RegExp(`gotrader/${packet.memoryType.replaceAll("_", "-")}/`));
    assert.match(document.markdown, /executionAuthority: none/);
  }
  assert.match(outbox.buildGbrainMemoryDocument(packets.find((packet) => packet.memoryType === "walk_forward")).markdown, /OOS windows passed: 2 \/ 3/);
  assert.match(outbox.buildGbrainMemoryDocument(packets.find((packet) => packet.memoryType === "gap_analysis")).markdown, /Missing independent forward sample/);
  assert.match(outbox.buildGbrainMemoryDocument(agentPacket).markdown, /ICT Liquidity/);
  assert.match(outbox.buildGbrainMemoryDocument(agentPacket).markdown, /CIO alignment rate: 0.75/);

  const proposalPacket = supplemental.buildSelfImprovementMemoryPacket({
    proposalId: "proposal_direct",
    timestamp: "2026-08-17T15:00:00.000Z",
    source: "internal",
    status: "proposed",
    proposalIntent: "ict_research_hypothesis_intent",
    mode: "simulation",
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none",
    reason: "Identity-bound ICT draft.",
    targetProblem: "trade_generation_blocked",
    proposedChanges: {},
    expectedImprovement: "Replay the hypothesis.",
    safetyNotes: [],
    beforeMetrics: { totalTrades: 24, winRate: 0.58, averageR: 0.8, maxDrawdown: 3.1, profitFactor: 1.6, skippedSignals: 4, falsePositiveCount: 2, confidenceCalibration: 0.7, readinessScore: 66, readinessStatus: "yellow", stabilityScore: 64, conservativeScenarioStable: false, provenance: { strategyProfile: "ifvg_fresh_retest_v3_research", sourceProvider: "mt5_read_only", requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m", sourceFingerprint: "mt5_ustech_5m_frozen", parameterFingerprint: "params_v3" } },
    baselineConfig: { strategyProfile: "ifvg_fresh_retest_v3_research", symbol: "MNQ", timeframe: "5m", sessionFilter: "all", marketRegime: "range", minimumConfluenceThreshold: 0.7, minimumConfidenceThreshold: 0.7, targetRMultiple: 2, stopModel: "latest swing", fixedTickStopSize: 48, maxBarsToResolveTrade: 8, allowLong: true, allowShort: true, agentWeights: {}, warmupCandles: 14, decisionInterval: 4, lookaheadCandles: 8, visibleWindow: 18, spreadTicks: 1, slippageTicks: 1, commissionTicks: 1 },
    proposedConfig: {},
    approvalRequired: true,
    autoApplyStatus: "blocked"
  });
  assert.equal(proposalPacket.memoryType, "self_improvement");
  assert.equal(outbox.validateGbrainMemoryPacket(proposalPacket).valid, true);
  assert.match(outbox.buildGbrainMemoryDocument(proposalPacket).markdown, /Draft or untested proposal/);
  process.stdout.write(JSON.stringify({ status: "passed", packetTypes: packets.map((packet) => packet.memoryType), authority }, null, 2) + "\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
