#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const vite = await createServer({
  configFile: false,
  root,
  resolve: { alias: { "@": path.resolve(root, "src") } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent"
});

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const safety = {
  rawCandlesExcluded: true,
  rawSnapshotsExcluded: true,
  accountDataExcluded: true,
  orderDataExcluded: true,
  positionDataExcluded: true,
  secretsExcluded: true
};

const safetyLocks = {
  rawCandlesIncluded: false,
  rawSnapshotsIncluded: false,
  secretsIncluded: false,
  accountDataIncluded: false,
  orderDataIncluded: false,
  positionDataIncluded: false
};

const start = Date.UTC(2026, 1, 3, 14, 0);
const at = (index) => new Date(start + index * 5 * 60_000).toISOString();
const candle = (index, open, high, low, close, timeframe = "5m", prefix = "natural") => ({
  id: `${prefix}-${timeframe}-${index}`,
  symbol: "MNQ",
  timeframe,
  timestamp: at(index),
  open,
  high,
  low,
  close,
  volume: 100
});

const bullishPrices = [
  [100, 102, 99, 101],
  [101, 103, 100, 102],
  [102, 104, 101, 103],
  [104, 106, 103, 105],
  [108, 110, 107, 109],
  [107, 108, 105, 106],
  [105, 106, 103, 104],
  [100, 101, 95, 96],
  [92, 94, 90, 91],
  [94, 96, 93, 95],
  [95, 97, 94, 96],
  [91, 92, 89, 91.5],
  [91, 100, 89, 99],
  [99, 102, 98, 100],
  [98, 99, 95, 96]
];

const candlesFor = (direction, timeframe, prefix = "natural") =>
  bullishPrices.map(([open, high, low, close], index) => {
    const prices = direction === "BULLISH"
      ? [open, high, low, close]
      : [200 - open, 200 - low, 200 - high, 200 - close];
    return candle(index, ...prices, timeframe, prefix);
  });

const marketContextBundle = (generatedAt) => ({
  context: {
    displayTimeframe: "5m",
    analysisTimeframesRequested: ["W1", "D1", "H4", "H1", "M15", "M5"],
    analysisTimeframesLoaded: ["H1", "M5"],
    requiredTimeframesLoaded: false,
    analysisTimeframesUsed: ["H1", "M5"],
    missingTimeframes: ["W1", "D1", "H4", "M15"],
    analysisDepthStatus: "limited",
    multiTimeframeContextStatus: "partial",
    analysisTimeframes: [
      { timeframe: "M5", candleCount: 15, availableLookbackDays: 1 },
      { timeframe: "H1", candleCount: 15, availableLookbackDays: 1 }
    ],
    htfBiasSource: ["H1"],
    sessionModelSourceTimeframe: "M5",
    confirmationSourceTimeframe: "M5",
    weeklyBiasStatus: "unavailable",
    weeklyBiasDirection: "unknown",
    weeklyBiasReason: "Weekly context is intentionally outside this bounded DH4 fixture.",
    warnings: ["Bounded DH4 fixture uses H1 and M5 only."],
    generatedAt,
    authority,
    safety
  },
  displayCandles: [],
  analysisCandlesByTimeframe: {},
  depthSummariesByTimeframe: {}
});

const approvedDecision = (direction) => ({
  profileId: "dh4-natural-production-e2e",
  status: "approved_research_candidate",
  researchOnly: true,
  symbol: "MNQ",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  primaryTimeframe: "5m",
  htfTimeframes: ["1h"],
  strategyId: direction === "BULLISH" ? "ict_market_maker_buy_model_v1" : "ict_market_maker_sell_model_v1",
  setup: "market_maker_delivery",
  side: direction === "BULLISH" ? "long" : "short",
  confidence: 0.8,
  compositeBias: direction === "BULLISH" ? "bullish" : "bearish",
  approvalScore: 80,
  approvedReasons: ["Natural canonical Market Maker owner fixture."],
  rejectionReasons: [],
  watchlistReasons: [],
  authority,
  safety
});

const advisorSignal = (direction, decision) => ({
  strategyId: "dh4_context_only_signal",
  phase: "phase_2",
  symbol: "MNQ",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  primaryTimeframe: "5m",
  htfTimeframes: ["1h"],
  researchOnly: true,
  side: direction === "BULLISH" ? "long" : "short",
  decision: "research_only",
  confidence: 0.8,
  bias: {
    primary: direction === "BULLISH" ? "bullish" : "bearish",
    htf: { "1h": direction === "BULLISH" ? "bullish" : "bearish" },
    composite: direction === "BULLISH" ? "bullish" : "bearish"
  },
  setup: "market_maker_delivery",
  summary: "Context carrier only; canonical owner geometry is produced upstream from facts.",
  noTradeReasons: [],
  riskNotes: ["Research-only; no execution authority."],
  approvedProfileDecision: decision,
  provenance: {
    methodology: "ICT",
    phase: "phase_2",
    sourceSet: "DH4 deterministic canonical candles",
    researchOnly: true,
    generatedAt: at(14)
  }
});

const packetFromCollection = (direction, sourceFingerprint, collection) => {
  const decision = approvedDecision(direction);
  const recommendedSignal = advisorSignal(direction, decision);
  const contextBundle = marketContextBundle(at(14));
  return {
    packetId: `dh4-${direction.toLowerCase()}-packet`,
    source: "gotrader_ict_strategy_suite",
    mode: "advisory_only",
    generatedAt: at(14),
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    primaryTimeframe: "5m",
    htfTimeframes: ["1h"],
    activeSource: {
      provider: "mt5_read_only",
      candleCount: 15,
      firstTimestamp: at(0),
      lastTimestamp: at(14),
      sourceFingerprint,
      sourceLabel: "DH4 deterministic MT5 read-only provider fixture",
      sourceStatus: {
        isMockOrSample: false,
        isResearchActive: true,
        isProxyInstrument: true,
        statusLabel: "MT5 read-only research active"
      }
    },
    signals: [recommendedSignal],
    recommendedSignal,
    compactSummary: {
      compositeBias: recommendedSignal.bias.composite,
      setup: recommendedSignal.setup,
      decision: recommendedSignal.decision,
      side: recommendedSignal.side,
      confidence: recommendedSignal.confidence,
      approvedProfileStatus: decision.status,
      approvalScore: decision.approvalScore,
      marketMakerCandidates: collection,
      hydrationSource: "active_mt5_readonly_feed",
      noTradeReasonCount: 0
    },
    marketAnalysisContext: contextBundle.context,
    approvedProfileDecision: decision,
    journalEvents: [],
    indexSmtJournalEvents: [],
    newsSessionRiskJournalEvents: [],
    journalStatus: "memory_only",
    safetyLocks,
    authority
  };
};

const runtimeSnapshot = (sourceFingerprint) => ({
  marketData: {
    symbol: "MNQ",
    contract: "MNQ",
    timeframe: "5m",
    activeResearchSource: {
      provider: "mt5_read_only",
      symbol: "MNQ",
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      timeframe: "5m",
      candleCount: 15,
      fingerprint: sourceFingerprint,
      authority,
      provenance: { providerSymbol: "USTECH" }
    }
  },
  mt5ReadOnly: { brokerSymbol: "USTECH", higherTimeframeSources: [] }
});

try {
  const canonical = await vite.ssrLoadModule("/src/lib/ictCanonical/index.ts");
  const ictI2 = await vite.ssrLoadModule("/src/lib/ictI2/ictI2Runtime.ts");
  const ictI3 = await vite.ssrLoadModule("/src/lib/ictI3/ictI3Runtime.ts");
  const currentReadModule = await vite.ssrLoadModule("/src/lib/ict-strategy-suite/ictCurrentRead.ts");
  const signalModule = await vite.ssrLoadModule("/src/lib/ict-strategy-suite/ictSignalContract.ts");
  const activateModule = await vite.ssrLoadModule("/src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts");

  const records = [];
  for (const direction of ["BULLISH", "BEARISH"]) {
    const sourceFingerprint = `dh4-production-e2e-${direction.toLowerCase()}`;
    const candles5m = candlesFor(direction, "5m");
    const candles1h = candlesFor(direction, "1h");
    const snapshots = {
      "5m": canonical.buildCanonicalIctFactSnapshot({
        candles: candles5m,
        asOf: at(14),
        symbol: "MNQ",
        timeframe: "5m",
        sourceFingerprint
      }),
      "1h": canonical.buildCanonicalIctFactSnapshot({
        candles: candles1h,
        asOf: at(14),
        symbol: "MNQ",
        timeframe: "1h",
        sourceFingerprint
      })
    };
    const runtimeInput = ictI2.buildIctCanonicalRuntimeInput({
      candlesByTimeframe: { "5m": candles5m, "1h": candles1h },
      symbol: "MNQ",
      asOf: at(14),
      sourceFingerprint,
      factSnapshotsByTimeframe: snapshots
    });
    const collection = ictI3.evaluateIctMarketMakerRuntimeCandidates(runtimeInput);
    const strategyId = direction === "BULLISH"
      ? "ict_market_maker_buy_model_v1"
      : "ict_market_maker_sell_model_v1";
    const owner = collection.candidates.find((candidate) => candidate.strategyId === strategyId);
    assert(owner);
    assert.equal(owner.state, "ACTIVE_DELIVERY");
    assert.equal(owner.deliverySequence.status, "QUALIFIED");
    assert.equal(owner.geometry?.status, "VALID_ACTIONABLE");
    assert.equal(owner.geometry?.theoreticalRR, 3);

    const packet = packetFromCollection(direction, sourceFingerprint, collection);
    const currentRead = currentReadModule.buildIctCurrentReadFromPacket(packet);
    const currentCandidate = currentRead.canonicalCandidates.find((candidate) => candidate.candidateId === owner.candidateId);
    assert(currentCandidate);
    assert.equal(currentRead.currentOpportunitySummary.selectedCanonicalCandidateId, owner.candidateId);
    assert.deepEqual(currentCandidate.opportunity.geometry, owner.geometry);
    assert.equal(currentCandidate.charterProfile.charterModelNumber, direction === "BULLISH" ? 6 : 7);
    assert.equal(currentCandidate.prerequisiteIdentity.sequenceId, owner.deliverySequence.sequenceId);
    assert.equal(currentRead.activeCandidateId, owner.candidateId);
    assert.equal(currentRead.canonicalGeometry.geometryId, owner.geometry.geometryId);

    const compactOwnerGeometry = JSON.parse(JSON.stringify(owner.geometry));
    const signal = signalModule.buildIctResearchSignalFromCurrentRead(currentRead);
    assert.equal(signal.candidateId, owner.candidateId);
    assert.deepEqual(signal.canonicalGeometry, compactOwnerGeometry);
    assert.equal(signal.canonicalGeometryId, owner.geometry.geometryId);
    assert.equal(signal.executionAllowed, false);

    const saved = [];
    const activation = await activateModule.runIctActivateMarketPipeline(
      {
        snapshot: runtimeSnapshot(sourceFingerprint),
        dataAsOf: at(14),
        cycleId: `dh4-${direction.toLowerCase()}-cycle`,
        saveLatestSummary: true
      },
      undefined,
      {
        buildMarketAnalysisContext: async () => marketContextBundle(at(14)),
        buildAdvisorPacketFromRuntime: async () => packet,
        queueResearchHypothesis: () => ({ ok: false, reason: "Bounded DH4 E2E does not queue research." }),
        evaluateCmdPaperEligibility: () => ({ eligible: false, reasons: ["Not a CMD candidate."] }),
        saveLatestSummary: (summary) => saved.push(summary)
      }
    );
    const plan = activation.summary.candidatePlans.find((candidate) => candidate.candidateId === owner.candidateId);
    assert(plan);
    assert.equal(plan.charterProfile.charterModelNumber, direction === "BULLISH" ? 6 : 7);
    assert.deepEqual(JSON.parse(JSON.stringify(plan.geometry)), compactOwnerGeometry);
    assert.deepEqual(JSON.parse(JSON.stringify(activation.summary.proposedGeometry)), compactOwnerGeometry);
    assert.equal(activation.signalContract.canonicalGeometryId, owner.geometry.geometryId);
    assert.equal(activation.summary.proposedEntryPrice, owner.geometry.entry.intendedPrice);
    assert.equal(activation.summary.proposedStopLoss, owner.geometry.stop.price);
    assert.equal(activation.summary.proposedTakeProfit, owner.geometry.target.price);
    assert.equal(activation.summary.proposedRiskReward, owner.geometry.theoreticalRR);
    assert.equal(saved[0].currentCandidateId, owner.candidateId);
    assert.equal(saved[0].executionAllowed, false);

    records.push({
      direction,
      strategyId,
      candidateId: owner.candidateId,
      sequenceId: owner.deliverySequence.sequenceId,
      geometryId: owner.geometry.geometryId,
      dealingRangeId: owner.deliverySequence.dealingRangeId,
      pdLocationFactId: owner.deliverySequence.pdLocationFactId,
      engineeringLiquidityId: owner.deliverySequence.engineeringLiquidityId,
      displacementId: owner.deliverySequence.displacementId,
      fvgId: owner.deliverySequence.pdArrayId,
      targetLiquidityId: owner.deliverySequence.objectiveLiquidityId,
      charterProfileId: currentCandidate.charterProfile.charterProfileId,
      entry: owner.geometry.entry.intendedPrice,
      stop: owner.geometry.stop.price,
      target: owner.geometry.target.price,
      rr: owner.geometry.theoreticalRR
    });
  }

  const positive = records[0];
  const negativeFingerprint = "dh4-production-e2e-foreign-range";
  const negative5m = candlesFor("BULLISH", "5m", "foreign");
  const negative1h = candlesFor("BULLISH", "1h", "foreign");
  const negativeSnapshots = {
    "5m": canonical.buildCanonicalIctFactSnapshot({ candles: negative5m, asOf: at(14), symbol: "MNQ", timeframe: "5m", sourceFingerprint: negativeFingerprint }),
    "1h": canonical.buildCanonicalIctFactSnapshot({ candles: negative1h, asOf: at(14), symbol: "MNQ", timeframe: "1h", sourceFingerprint: negativeFingerprint })
  };
  const foreignPdArray = negativeSnapshots["1h"].facts.find((fact) =>
    fact.factType === "PD_ARRAY" && fact.pdArrayType === "FVG" && Boolean(fact.dealingRangeId)
  );
  assert(foreignPdArray?.dealingRangeId);
  const sourceFingerprint = "dh4-production-e2e-bullish";
  const source5m = candlesFor("BULLISH", "5m");
  const source1h = candlesFor("BULLISH", "1h");
  const sourceSnapshots = {
    "5m": canonical.buildCanonicalIctFactSnapshot({ candles: source5m, asOf: at(14), symbol: "MNQ", timeframe: "5m", sourceFingerprint }),
    "1h": canonical.buildCanonicalIctFactSnapshot({ candles: source1h, asOf: at(14), symbol: "MNQ", timeframe: "1h", sourceFingerprint })
  };
  for (const timeframe of ["5m", "1h"]) {
    sourceSnapshots[timeframe] = {
      ...sourceSnapshots[timeframe],
      facts: [...sourceSnapshots[timeframe].facts.filter((fact) => fact.factType !== "PD_ARRAY"), foreignPdArray]
    };
  }
  const negativeRuntime = ictI2.buildIctCanonicalRuntimeInput({
    candlesByTimeframe: { "5m": source5m, "1h": source1h },
    symbol: "MNQ",
    asOf: at(14),
    sourceFingerprint,
    factSnapshotsByTimeframe: sourceSnapshots
  });
  const negativeCollection = ictI3.evaluateIctMarketMakerRuntimeCandidates(negativeRuntime);
  const negativeOwner = negativeCollection.candidates.find((candidate) => candidate.strategyId === positive.strategyId);
  assert.equal(negativeOwner.deliverySequence.status, "WAITING_FOR_PD_ARRAY");
  assert.equal(negativeOwner.geometry, undefined);
  const negativePacket = packetFromCollection("BULLISH", sourceFingerprint, negativeCollection);
  const negativeRead = currentReadModule.buildIctCurrentReadFromPacket(negativePacket);
  assert.equal(negativeRead.canonicalCandidates.some((candidate) => candidate.strategyId === positive.strategyId && candidate.actionability), false);
  assert.equal(negativeRead.charterProfiles.find((profile) => profile.charterModelNumber === 6).ownerCandidateIds?.length ?? 0, 0);
  const negativeActivation = await activateModule.runIctActivateMarketPipeline(
    { snapshot: runtimeSnapshot(sourceFingerprint), dataAsOf: at(14), saveLatestSummary: false },
    undefined,
    {
      buildMarketAnalysisContext: async () => marketContextBundle(at(14)),
      buildAdvisorPacketFromRuntime: async () => negativePacket,
      queueResearchHypothesis: () => ({ ok: false, reason: "Bounded DH4 negative E2E." }),
      evaluateCmdPaperEligibility: () => ({ eligible: false, reasons: ["Not a CMD candidate."] })
    }
  );
  assert.equal(negativeActivation.summary.candidatePlans.some((candidate) => candidate.strategyId === positive.strategyId && candidate.actionable), false);
  assert.equal(negativeActivation.summary.proposedGeometry, undefined);

  console.log(JSON.stringify({
    status: "passed",
    quality: "REAL_PRODUCTION_PATH",
    chain: [
      "deterministic candles",
      "canonical facts",
      "market maker sequence",
      "MMBM/MMSM owner",
      "G1.1",
      "buildCanonicalRuntimeCandidateSet",
      "Current Opportunity",
      "Current Read",
      "signal contract",
      "Activate Market",
      "Charter 6/7"
    ],
    records,
    negative: {
      sequenceStatus: negativeOwner.deliverySequence.status,
      canonicalOwnerActionable: false,
      proposedGeometry: false,
      charterRevived: false
    },
    authority: "none/none/none"
  }, null, 2));
} finally {
  await vite.close();
}
