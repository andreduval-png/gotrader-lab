#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";
import { validScenario5m, validScenario15m } from "./test-session-raid-reversal.mjs";

const server = await createServer({ cacheDir: ".gotrader/p2-vite-cache", server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });

try {
  const london = await server.ssrLoadModule("/src/lib/ict-strategy-suite/ictSessionRaidReversal.ts");
  const folds = await server.ssrLoadModule("/src/lib/historicalFold/historicalFoldStrategyAdapters.ts");
  const contextBuilder = await server.ssrLoadModule("/src/lib/currentOpportunity/buildCurrentOpportunityContext.ts");
  const scanner = await server.ssrLoadModule("/src/lib/currentOpportunity/detectCurrentOpportunities.ts");
  const currentReadApi = await server.ssrLoadModule("/src/lib/ict-strategy-suite/ictCurrentRead.ts");
  const signalApi = await server.ssrLoadModule("/src/lib/ict-strategy-suite/ictSignalContract.ts");

  const sourceFingerprint = "mt5|USTECH|MNQ|5m|london-policy-v2-fixture";
  const base = {
    candles5m: validScenario5m(),
    candles15m: validScenario15m(),
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    sourceProvider: "mt5_read_only",
    sourceFingerprint,
    primaryTimeframe: "5m",
    entryTimeframe: "15m",
    htfContext: { H1: [{}], H4: [{}], D1: [{}] },
    weeklyBiasDirection: "bearish",
    timingZone: "America/New_York",
    generatedAt: "2026-06-10T17:00:00.000Z"
  };

  const live = london.evaluateIctSessionRaidReversal(base);
  const invalidAsOf = london.evaluateIctSessionRaidReversal({ ...base, generatedAt: "invalid" });
  assert.equal(invalidAsOf.geometry, undefined);
  assert.equal(invalidAsOf.canCreateValidationChainEntry, false);
  assert.ok(invalidAsOf.blockers.includes("invalid_evaluation_timestamp"));
  assert.equal(live.status, "context_only");
  assert.equal(live.rr, 0.4402);
  assert.ok(Math.abs(live.geometry?.theoreticalRR - 0.4402) < 0.00001);
  assert.equal(live.geometry?.status, "VALID_BELOW_RR_THRESHOLD");
  assert.equal(live.geometry?.actionable, false);
  assert.equal(live.canCreateValidationChainEntry, false);
  assert.equal(live.validationChainSeed, undefined);
  assert.equal(live.geometry?.target?.targetId, live.selectedTargetObjective?.objectiveId);
  assert.equal(live.geometry?.targetPolicy.policyVersion, london.LONDON_RAID_V1_TARGET_POLICY_VERSION);
  assert.equal(live.geometry?.entry.intendedPrice, live.entry);
  assert.equal(live.geometry?.stop.price, live.invalidation);
  assert.equal(live.geometry?.target?.price, live.target);

  const risk = live.invalidation - live.entry;
  const farTargets = live.referenceLevels.sellSideLiquidityTargets.filter((objective) =>
    objective.price < live.entry && (live.entry - objective.price) / risk > 2
  );
  assert.ok(farTargets.length > 0, "fixture must contain farther >2R liquidity");
  assert.notEqual(live.selectedTargetObjective?.objectiveId, farTargets[0].objectiveId);

  const selectorInput = {
    objectives: live.referenceLevels.sellSideLiquidityTargets,
    entry: live.entry,
    asOf: live.selectedTargetObjective.asOf
  };
  const selected = london.selectLondonRaidPrimaryTarget(selectorInput);
  const reordered = london.selectLondonRaidPrimaryTarget({ ...selectorInput, objectives: [...selectorInput.objectives].reverse() });
  assert.equal(selected?.objectiveId, live.selectedTargetObjective.objectiveId);
  assert.equal(reordered?.objectiveId, selected?.objectiveId, "far-target order must not affect the nearest objective");

  const consumedObjectives = selectorInput.objectives.map((objective) =>
    objective.objectiveId === selected.objectiveId ? { ...objective, consumed: true } : objective
  );
  assert.equal(
    london.selectLondonRaidPrimaryTarget({ ...selectorInput, objectives: consumedObjectives }),
    undefined,
    "a consumed primary must fail closed because London v1 declares no fallback class"
  );
  const invalidCloser = {
    ...selected,
    objectiveId: "wrong-session-objective",
    targetClass: "wrong_session_objective",
    price: live.entry - 0.01
  };
  assert.equal(
    london.selectLondonRaidPrimaryTarget({ ...selectorInput, objectives: [invalidCloser, ...selectorInput.objectives] })?.objectiveId,
    selected.objectiveId,
    "wrong-class liquidity must never become primary"
  );
  const futureCloser = {
    ...selected,
    objectiveId: "future-objective",
    price: live.entry - 0.01,
    validFrom: "2026-06-11T00:00:00.000Z"
  };
  assert.equal(
    london.selectLondonRaidPrimaryTarget({ ...selectorInput, objectives: [futureCloser, ...selectorInput.objectives] })?.objectiveId,
    selected.objectiveId,
    "future objectives must not be selected"
  );

  const repeated = london.evaluateIctSessionRaidReversal(base);
  assert.equal(repeated.geometry?.geometryId, live.geometry?.geometryId);
  assert.equal(repeated.selectedTargetObjective?.objectiveId, live.selectedTargetObjective?.objectiveId);
  const futureExtended = london.evaluateIctSessionRaidReversal({
    ...base,
    candles5m: [...base.candles5m, {
      timestamp: "2026-06-10T20:30:00.000Z",
      open: 85,
      high: 86,
      low: 70,
      close: 71,
      volume: 100
    }]
  });
  assert.equal(futureExtended.geometry?.geometryId, live.geometry?.geometryId);
  assert.equal(futureExtended.selectedTargetObjective?.objectiveId, live.selectedTargetObjective?.objectiveId);

  const candleForFold = (candle, index, timeframe) => ({
    ...candle,
    id: `london-${timeframe}-${index}`,
    symbol: "MNQ",
    timeframe
  });
  const historical = folds.LONDON_RAID_FOLD_ADAPTER.detect({
    asOf: base.generatedAt,
    sourceFingerprint,
    candlesByTimeframe: {
      "5m": base.candles5m.map((candle, index) => candleForFold(candle, index, "5m")),
      "15m": base.candles15m.map((candle, index) => candleForFold(candle, index, "15m"))
    },
    canonicalFacts: [],
    dataset: {
      datasetId: "london-policy-v2-dataset",
      datasetCertificateId: "london-policy-v2-certificate",
      datasetChecksum: "london-policy-v2-checksum",
      sourceFingerprint
    }
  });
  assert.ok(historical.geometry);
  for (const key of ["strategyId", "strategyVersion", "direction", "geometryId", "theoreticalRR", "status", "actionable"]) {
    assert.deepEqual(historical.geometry[key], live.geometry[key], `live/historical mismatch: ${key}`);
  }
  assert.deepEqual(historical.geometry.entry, live.geometry.entry);
  assert.deepEqual(historical.geometry.stop, live.geometry.stop);
  assert.deepEqual(historical.geometry.target, live.geometry.target);
  assert.deepEqual(historical.geometry.targetPolicy, live.geometry.targetPolicy);
  assert.deepEqual(historical.geometry.blockers, live.geometry.blockers);

  const packet = {
    generatedAt: base.generatedAt,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    primaryTimeframe: "5m",
    htfTimeframes: ["15m", "1h", "4h", "1d"],
    activeSource: {
      provider: "mt5_read_only",
      candleCount: base.candles5m.length,
      sourceFingerprint,
      sourceLabel: "MT5 read-only USTECH",
      sourceStatus: { isMockOrSample: false, isResearchActive: true, isProxyInstrument: true, statusLabel: "MT5 read-only research active" }
    },
    marketAnalysisContext: {
      analysisDepthStatus: "sufficient",
      analysisTimeframesUsed: ["M5", "M15", "H1", "H4", "D1"],
      missingTimeframes: [],
      analysisTimeframes: [{ timeframe: "M5", candleCount: 17799, availableLookbackDays: 88.95 }]
    },
    compactSummary: {},
    signals: [],
    sessionRaidReversal: live,
    recommendedSignal: {
      strategyId: "ict_liquidity_reversal_v1",
      phase: "phase_1",
      symbol: "MNQ",
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      primaryTimeframe: "5m",
      htfTimeframes: ["15m", "1h", "4h", "1d"],
      researchOnly: true,
      setup: "no_trade",
      side: "flat",
      decision: "no_trade",
      confidence: 0,
      bias: { primary: "neutral", htf: {}, composite: "neutral" },
      summary: "No generic signal.",
      noTradeReasons: [],
      riskNotes: [],
      provenance: { methodology: "ICT", phase: "phase_1", sourceSet: "ICT Mentorship Core Content", researchOnly: true }
    },
    approvedProfileDecision: {
      status: "no_trade",
      approvalScore: 0,
      rejectionReasons: ["London native objective is below minimum R:R."],
      watchlistReasons: [],
      htfAlignment: "partial"
    }
  };
  const context = contextBuilder.buildCurrentOpportunityContext({ packet });
  const scan = scanner.detectCurrentOpportunities(context);
  const opportunity = scan.opportunities.find((item) => item.strategyId === "nasdaq_london_raid_ny_reversal_v1");
  assert.equal(opportunity?.status, "near_miss");
  assert.equal(opportunity?.geometry?.geometryId, live.geometry.geometryId);
  assert.equal(opportunity?.geometry?.target?.targetId, live.geometry.target.targetId);
  assert.equal(opportunity?.actionable, false);
  assert.equal(scan.canonicalCandidates.find((item) => item.strategyId === opportunity.strategyId)?.geometryId, live.geometry.geometryId);
  assert.equal(scan.summary.actionableCanonicalCandidateCount, 0);
  assert.equal(scan.summary.canonicalSetupConflict, "NONE");

  const currentRead = currentReadApi.buildIctCurrentReadFromPacket(packet);
  const readLondon = currentRead.currentOpportunities?.find((item) => item.strategyId === "nasdaq_london_raid_ny_reversal_v1");
  assert.equal(readLondon?.geometry?.geometryId, live.geometry.geometryId);
  assert.equal(readLondon?.geometry?.target?.targetId, live.geometry.target.targetId);
  assert.equal(currentRead.canonicalGeometry, undefined, "non-actionable London geometry must not become the selected plan");
  const signal = signalApi.buildIctResearchSignalFromCurrentRead(currentRead);
  assert.equal(signal.actionable, false);
  assert.notEqual(signal.status, "approved_research_signal");

  const ownerSource = fs.readFileSync("src/lib/ict-strategy-suite/ictSessionRaidReversal.ts", "utf8");
  const selectorSource = ownerSource.slice(ownerSource.indexOf("export const selectLondonRaidPrimaryTarget"), ownerSource.indexOf("const targetCandidatesForShort"));
  assert.doesNotMatch(selectorSource, /minimumRR|requiredRR|reward threshold|>=\s*2|availableRR/i);
  assert.doesNotMatch(ownerSource, /sellSideLiquidityTargets\.find\([^\n]*>=\s*2|sellSideLiquidityTargets\.at\(-1\)/);
  const activateSource = fs.readFileSync("src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts", "utf8");
  assert.match(activateSource, /matchingCandidate\.geometry/);
  assert.doesNotMatch(activateSource, /matchingCandidate\.geometry[\s\S]{0,250}selectCanonicalTarget/);

  console.log(JSON.stringify({
    status: "passed",
    target: live.target,
    targetId: live.selectedTargetObjective.objectiveId,
    targetClass: live.selectedTargetObjective.targetClass,
    rr: live.rr,
    geometryStatus: live.geometry.status,
    liveHistoricalParity: true,
    currentOpportunityStatus: opportunity.status,
    signalStatus: signal.status,
    authority: live.authority
  }, null, 2));
} finally {
  await server.close();
}
