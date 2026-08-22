#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "operatorConsole");
const outRoot = path.join(projectRoot, ".gotrader", "operator-console-test");
const sourceFiles = [
  "operatorConsoleTypes.ts",
  "operatorCycleStorage.ts",
  "operatorSourceIdentity.ts",
  "operatorPlanFreshness.ts",
  "buildOperatorConsoleSnapshot.ts",
  "operatorForwardScenario.ts",
  "operatorMemorySummary.ts"
];

function compileForNode() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });
  const dependencyFiles = [
    [path.join(projectRoot, "src/lib/candleSources"), "candleSourceTypes.ts"],
    [path.join(projectRoot, "src/lib/candleSources"), "candleSourceFingerprint.ts"],
    [path.join(projectRoot, "src/lib/candleSources"), "candleSourceIdentity.ts"],
    [path.join(projectRoot, "src/lib/ict-strategy-suite"), "ictActivateMarketSummaryStorage.ts"],
    [path.join(projectRoot, "src/lib/ictCanonical"), "canonicalIctTypes.ts"],
    [path.join(projectRoot, "src/lib/ictCanonical"), "canonicalIctIdentity.ts"],
    [path.join(projectRoot, "src/lib/tradeGeometry"), "tradeGeometryTypes.ts"],
    [path.join(projectRoot, "src/lib/tradeGeometry"), "targetSelection.ts"],
    [path.join(projectRoot, "src/lib/tradeGeometry"), "canonicalTradeGeometry.ts"]
  ];
  for (const [root, file] of dependencyFiles) {
    const sourcePath = path.join(root, file);
    const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
    }).outputText
      .replace(/from\s+"@\/lib\/ictCanonical\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/tradeGeometry\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/tradeGeometry"/g, 'from "./canonicalTradeGeometry.mjs"')
      .replace(/from\s+"@\/lib\/candleSources\/([^\"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/candleSources"/g, 'from "./candleSourceIdentity.mjs"');
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), output, "utf8");
  }
  for (const file of sourceFiles) {
    const sourcePath = path.join(sourceRoot, file);
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
    const rewritten = output
      .replace(/from\s+"\.\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'\.\/([^']+)'/g, "from './$1.mjs'")
      .replace(/from\s+"@\/lib\/tradeGeometry"/g, 'from "./canonicalTradeGeometry.mjs"')
      .replace(/from\s+"@\/lib\/candleSources"/g, 'from "./candleSourceIdentity.mjs"');
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), rewritten, "utf8");
  }
}

const sourceSummary = ({
  provider = "mt5_read_only",
  candles = 1000,
  fingerprint = "mt5-fingerprint",
  sourceLineageId = "source-lineage:v1:mt5-fixture",
  sourceSnapshotId = "source-snapshot:v1:mt5-fixture",
  lastTimestamp = "2026-08-21T11:00:00.000Z"
} = {}) => ({
  sourceId: "mt5-readonly-fixture",
  sourceLineageId,
  sourceSnapshotId,
  provider,
  symbol: "MNQ",
  normalizedSymbol: "MNQ",
  timeframe: "5m",
  candleCount: candles,
  fingerprint,
  lastTimestamp,
  eligibility: { researchCycle: provider !== "mock" && candles >= 500 },
  authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
  provenance: { providerSymbol: "USTECH", sourceVersion: "canonical-candle-source-manager-v1" }
});

const runtime = ({ provider = "mt5_read_only", candles = 1000, fingerprint = "mt5-fingerprint", readiness = "Research Ready", ...sourceOverrides } = {}) => ({
  marketData: {
    activeResearchSource: sourceSummary({ provider, candles, fingerprint, ...sourceOverrides }),
    activeResearchSourceLabel: provider === "mt5_read_only" ? "MNQ via USTECH" : "Mock candles",
    activeDataSource: provider,
    symbol: "MNQ",
    contract: "USTECH",
    timeframe: "5m",
    rawCandleCount: candles,
    isMockDataActive: provider === "mock",
    fallbackToMock: provider === "mock",
    researchDataFingerprint: fingerprint,
    chartDisplayLastTimestamp: "2026-07-12T14:00:00.000Z"
  },
  latestResearchCycle: {
    latestThesisSummary: {
      bias: "bullish",
      confidence: 62,
      summary: "Bullish research thesis with guarded confidence."
    }
  },
  performance: {
    canonicalPerformanceMetrics: {
      totalTrades: 24,
      winRate: 0.58,
      averageR: 0.44,
      maxDrawdownR: 3.2,
      profitFactor: 1.35,
      generatedAt: "2026-07-12T13:00:00.000Z"
    }
  },
  readiness: {
    readinessState: readiness,
    nextAction: "Collect more independent evidence."
  },
  evidence: { evidenceQualityScore: 52 },
  maturity: { maturityScore: 47 },
  walkForward: { latestRun: { stability: { verdict: "passed" } } },
  proposal: {
    latestProposalIsCurrent: false,
    latestProposalId: undefined
  }
});

const activationIdentity = (overrides = {}) => ({
  activationTimestamp: "2026-08-21T11:00:05.000Z",
  cycleId: "operator-cycle-fixture",
  sourceLineageId: "source-lineage:v1:mt5-fixture",
  activationSnapshotId: "source-snapshot:v1:mt5-fixture",
  sourceFingerprint: "mt5-fingerprint",
  activationCandleCount: 1000,
  activationLastClosedCandleTimestamp: "2026-08-21T11:00:00.000Z",
  currentReadEvaluatedAt: "2026-08-21T11:00:04.000Z",
  ...overrides
});

async function main() {
  compileForNode();
  const { buildOperatorConsoleSnapshot: buildOperatorConsoleSnapshotRaw } = await import(
    pathToFileURL(path.join(outRoot, "buildOperatorConsoleSnapshot.mjs")).href
  );
  const fixtureNow = "2026-08-21T11:10:00.000Z";
  const buildOperatorConsoleSnapshot = (input = {}) => buildOperatorConsoleSnapshotRaw({
    ...input,
    runtime: input.runtime ?? runtime(),
    now: input.now ?? fixtureNow
  });
  const { prepareOperatorForwardScenario } = await import(
    pathToFileURL(path.join(outRoot, "operatorForwardScenario.mjs")).href
  );
  const { buildOperatorMemorySummary } = await import(
    pathToFileURL(path.join(outRoot, "operatorMemorySummary.mjs")).href
  );
  const { createCandleSourceLineageId } = await import(
    pathToFileURL(path.join(outRoot, "candleSourceIdentity.mjs")).href
  );
  const { persistSerializedOperatorCycleState, readOperatorStorageValue } = await import(
    pathToFileURL(path.join(outRoot, "operatorCycleStorage.mjs")).href
  );
  const { persistActivateMarketSummary, readActivateMarketSummary } = await import(
    pathToFileURL(path.join(outRoot, "ictActivateMarketSummaryStorage.mjs")).href
  );
  const { bindCanonicalOperatorSource } = await import(
    pathToFileURL(path.join(outRoot, "operatorSourceIdentity.mjs")).href
  );

  const sessionValues = new Map();
  const sessionStorage = {
    getItem: (key) => sessionValues.get(key) ?? null,
    removeItem: (key) => sessionValues.delete(key),
    setItem: (key, value) => sessionValues.set(key, value)
  };
  const quotaStorage = {
    getItem: () => null,
    removeItem: () => undefined,
    setItem: () => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    }
  };
  const quotaFallback = persistSerializedOperatorCycleState({
    legacyLocalKeys: ["legacy-v2", "legacy-v1"],
    localKey: "cycle-v3",
    localStorage: quotaStorage,
    serialized: '{"status":"running"}',
    sessionKey: "cycle-session-v1",
    sessionStorage
  });
  assert.deepEqual(quotaFallback, { localPersisted: false, sessionPersisted: true });
  assert.equal(sessionValues.get("cycle-session-v1"), '{"status":"running"}', "session fallback must preserve live cycle state");

  const retryValues = new Map([["legacy-v2", "old"]]);
  const retryStorage = {
    getItem: (key) => retryValues.get(key) ?? null,
    removeItem: (key) => retryValues.delete(key),
    setItem: (key, value) => {
      if (retryValues.has("legacy-v2")) throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      retryValues.set(key, value);
    }
  };
  const localRetry = persistSerializedOperatorCycleState({
    legacyLocalKeys: ["legacy-v2"],
    localKey: "cycle-v3",
    localStorage: retryStorage,
    serialized: '{"status":"completed"}',
    sessionKey: "cycle-session-v1",
    sessionStorage
  });
  assert.equal(localRetry.localPersisted, true, "local persistence should retry after obsolete cycle cleanup");
  assert.equal(retryValues.get("cycle-v3"), '{"status":"completed"}');
  assert.equal(readOperatorStorageValue({ ...quotaStorage, getItem: () => { throw new Error("blocked"); } }, "cycle-v3"), null);

  const activationSessionValues = new Map();
  const activationSessionStorage = {
    getItem: (key) => activationSessionValues.get(key) ?? null,
    removeItem: (key) => activationSessionValues.delete(key),
    setItem: (key, value) => activationSessionValues.set(key, value)
  };
  const activationFallback = persistActivateMarketSummary({
    key: "activation-v3",
    localStorage: quotaStorage,
    serialized: '{"cycleId":"current-cycle"}',
    sessionStorage: activationSessionStorage
  });
  assert.deepEqual(activationFallback, { localPersisted: false, sessionPersisted: true });
  assert.equal(
    readActivateMarketSummary({
      key: "activation-v3",
      legacyLocalKeys: [],
      localStorage: { ...sessionStorage, getItem: () => '{"cycleId":"stale-cycle"}' },
      sessionStorage: activationSessionStorage
    }),
    '{"cycleId":"current-cycle"}',
    "the quota fallback must outrank a stale local activation plan"
  );

  const feedFingerprint = "17749|2026-05-25T01:00:00.000Z|18870.1|2026-08-21T20:00:00.000Z|25320.5";
  const canonicalFingerprint = "mt5_read_only|mt5-readonly-active|MNQ|5m|17749|2026-05-25T01:00:00.000Z|2026-08-21T20:00:00.000Z";
  const identityBoundSource = bindCanonicalOperatorSource(
    { requestedSymbol: "MNQ", brokerSymbol: "USTECH", sourceFingerprint: feedFingerprint },
    canonicalFingerprint
  );
  assert.equal(identityBoundSource.sourceFingerprint, canonicalFingerprint, "feed hashes must be replaced by canonical plan identity");

  const lineageInput = {
    provider: "mt5_read_only",
    sourceId: "mt5-readonly-fixture",
    symbol: "MNQ",
    timeframe: "5m",
    providerSymbol: "USTECH",
    sourceVersion: "canonical-candle-source-manager-v1"
  };
  const stableLineage = createCandleSourceLineageId(lineageInput);
  assert.equal(stableLineage, createCandleSourceLineageId({ ...lineageInput }), "mutable candle values must not participate in lineage identity");
  assert.notEqual(stableLineage, createCandleSourceLineageId({ ...lineageInput, provider: "twelve_data" }));
  assert.notEqual(stableLineage, createCandleSourceLineageId({ ...lineageInput, sourceId: "different-source" }));
  assert.notEqual(stableLineage, createCandleSourceLineageId({ ...lineageInput, providerSymbol: "NQ-CFD" }));
  assert.notEqual(stableLineage, createCandleSourceLineageId({ ...lineageInput, sourceVersion: "different-time-contract" }));

  const memory = buildOperatorMemorySummary(
    {
      schemaVersion: 1,
      generatedAt: "2026-07-12T14:00:00.000Z",
      totalRecords: 12,
      totalProfiles: 2,
      aggregates: [
        {
          identity: { strategyProfile: "ifvg_fresh_retest_v3_research" },
          independentCycleDates: 5,
          positiveEdgeCycles: 3,
          lastCompletedAt: "2026-07-12T13:30:00.000Z"
        }
      ]
    },
    {
      schemaVersion: 1,
      deliveryEnabled: false,
      entries: [
        { status: "pending" },
        { status: "delivered" },
        { status: "failed" }
      ],
      safetyNotice: "gbrain memory is advisory only. GoTrader remains the research and readiness authority."
    }
  );

  const active = buildOperatorConsoleSnapshot({
    runtime: runtime(),
    activation: activationIdentity({
      modelName: "ifvg_v1",
      modelLane: "watchlist",
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      primaryTimeframe: "5m",
      researchSide: "short",
      proposedEntryZone: { lower: 22850.25, upper: 22856.5 },
      proposedStopLoss: 22882.25,
      proposedTakeProfit: 22765.75,
      proposedTargetProvenance: {
        type: "previous_day_low",
        sourceTimeframe: "daily",
        selectionReason: "Advisor signal selected directional liquidity: previous_day_low",
        distancePoints: 79.75,
        rr: 3.1,
        minimumRR: 2,
        gateStatus: "accepted",
        rejectionReasons: []
      },
      proposedRiskReward: 3.1,
      proposedGeometry: {
        schemaVersion: "gotrader.trade-geometry.v1", geometryVersion: "g2.1.0", geometryId: "active-plan-geometry",
        logicalGeometryKey: "active-plan-logical", strategyId: "ifvg_v1", strategyVersion: "test", candidateId: "active-plan-candidate",
        direction: "SHORT", entry: { model: "IFVG_NATIVE_MIDPOINT_RETEST", intendedPrice: 22853.375, lifecycleStatus: "WAITING_FOR_ENTRY" },
        stop: { model: "IFVG_NATIVE_FULL_GAP_INVALIDATION", price: 22882.25, structuralInvalidation: true },
        target: { model: "EXTERNAL_LIQUIDITY", price: 22765.75, targetId: "pdl", targetType: "EXTERNAL_LIQUIDITY", selectionRole: "PRIMARY", policyId: "ifvg.native", policyVersion: "1" },
        targetPolicy: { policyId: "ifvg.native", policyVersion: "1", primaryTargetType: "EXTERNAL_LIQUIDITY", primaryTargetId: "pdl", allowedFallbackTargetTypes: [] },
        riskDistance: 28.875, rewardDistance: 87.625, theoreticalRR: 3.1, minimumRequiredRR: 2,
        geometryValid: true, actionable: true, status: "VALID_ACTIONABLE", blockers: [], warnings: [], sourceFingerprint: "mt5-fingerprint",
        authority: { execution: "none", broker: "none", production: "none" }
      },
      riskScreeningStatus: "clear",
      riskScreeningReason: "Session/news risk screen is clear.",
      recommendedMaxRiskPerTradePct: 0.5,
      nextAction: "Run independent-date validation."
    }),
    memory,
    cycle: {
      cycleId: "operator-cycle-fixture",
      status: "completed",
      stage: "complete",
      progressPercent: 100,
      message: "Research cycle completed.",
      authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
      autoApplyAllowed: false,
      researchOnly: true
    }
  });
  assert.equal(active.source.researchEligible, true);
  assert.equal(active.source.provider, "mt5_read_only");
  assert.equal(active.source.brokerSymbol, "USTECH");
  assert.equal(active.results.totalTrades, 24);
  assert.equal(active.results.walkForwardStatus, "passed");
  assert.equal(active.results.evidenceScope, "active_profile");
  assert.equal(active.results.evidenceIdentityStatus, "profile_only");
  assert.equal(active.statusLayers.cycleExecution.status, "completed");
  assert.equal(active.statusLayers.candidateDisposition.status, "qualified research");
  assert.equal(active.statusLayers.hypothesisValidation.status, "not validated for current candidate");
  assert.match(active.statusLayers.hypothesisValidation.detail, /does not validate this market read/i);
  assert.equal(active.decisions.length, 0);
  assert.equal(active.memory.storedEvidenceRecords, 12);
  assert.equal(active.memory.gbrainPending, 1);
  assert.equal(active.memory.gbrainDelivered, 1);
  assert.equal(active.memory.gbrainFailed, 1);
  assert.equal(active.researchPlan.status, "complete");
  assert.equal(active.researchPlan.planMode, "qualified_geometry");
  assert.equal(active.researchPlan.planIdentityStatus, "current");
  assert.equal(active.researchPlan.side, "short");
  assert.equal(active.researchPlan.setupDirection, "bearish");
  assert.equal(active.researchPlan.signal, "SELL");
  assert.equal(active.researchPlan.planCoherence, "coherent");
  assert.equal(active.researchPlan.entryPrice, 22853.375);
  assert.equal(active.researchPlan.entryPriceMethod, "canonical_geometry");
  assert.equal(active.researchPlan.stopLoss, 22882.25);
  assert.equal(active.researchPlan.takeProfit, 22765.75);
  assert.equal(active.researchPlan.targetProvenance?.type, "EXTERNAL_LIQUIDITY");
  assert.equal(active.researchPlan.targetProvenance?.gateStatus, "accepted");
  assert.equal(active.researchPlan.riskReward, 3.1);
  assert.equal(active.researchPlan.accountRiskEvaluation, "external_simulation_required");
  assert.equal(active.researchPlan.executionAllowed, false);

  const bullish = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "bullish_test",
      researchSide: "long",
      proposedEntryZone: { lower: 101, upper: 99 },
      proposedStopLoss: 97,
      proposedTakeProfit: 107,
      proposedRiskReward: 2.33
    })
  });
  assert.equal(bullish.researchPlan.setupDirection, "neutral");
  assert.equal(bullish.researchPlan.signal, "NO_TRADE");
  assert.equal(bullish.researchPlan.planCoherence, "incomplete");
  assert.equal(bullish.researchPlan.entryZone, undefined);
  assert.equal(bullish.researchPlan.entryPrice, undefined);

  const namedCandidateWithoutDetectedModel = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      researchSide: "long",
      proposedEntryPrice: 100,
      proposedStopLoss: 97,
      proposedTakeProfit: 106,
      proposedRiskReward: 2,
      currentOpportunitySummary: {
        topOpportunity: { side: "long", status: "valid_candidate", setupName: "liquidity sweep reversal" }
      }
    })
  });
  assert.equal(namedCandidateWithoutDetectedModel.researchPlan.status, "no_trade");
  assert.equal(namedCandidateWithoutDetectedModel.researchPlan.setup, "liquidity sweep reversal");
  assert.notEqual(namedCandidateWithoutDetectedModel.researchPlan.setup, "No qualified research plan");

  const flatPlan = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "flat_test",
      researchSide: "flat",
      proposedEntryZone: { lower: 99, upper: 101 },
      proposedStopLoss: 97,
      proposedTakeProfit: 107,
      proposedRiskReward: 2.33
    })
  });
  assert.equal(flatPlan.researchPlan.status, "no_trade");
  assert.equal(flatPlan.researchPlan.setupDirection, "neutral");
  assert.equal(flatPlan.researchPlan.signal, "NO_TRADE");
  assert.equal(flatPlan.researchPlan.entryPrice, undefined);

  const incomplete = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "daily_range_projection",
      researchSide: "short",
      nextAction: "Wait for clean expansion confirmation and invalidation.",
      currentOpportunitySummary: {
        topNearMiss: {
          id: "candidate-watch-a",
          side: "short",
          status: "near_miss",
          setupName: "daily range projection",
          thesis: "Previous-day low remains the bearish research draw.",
          blockers: ["confidence_below_threshold"],
          missingConditions: ["displacement_missing", "fair_value_gap", "entry_missing", "invalidation_missing", "minimum_2r"],
          nextAction: "Wait for clean expansion confirmation and invalidation."
        }
      }
    }),
    validation: {
      setupLabel: "daily range projection",
      sourceFingerprint: "mt5-fingerprint",
      hypothesisStatus: "replay_failed",
      blockers: ["replay_failed"],
      nextAction: "Revise or discard the hypothesis before walk-forward."
    }
  });
  assert.equal(incomplete.researchPlan.status, "no_trade");
  assert.equal(incomplete.researchPlan.planMode, "conditional_watch");
  assert.equal(incomplete.researchPlan.signal, "NO_TRADE");
  assert.equal(incomplete.researchPlan.entryPrice, undefined);
  assert.equal(incomplete.researchPlan.conditionalWatch?.thesis, "Previous-day low remains the bearish research draw.");
  assert.match(incomplete.researchPlan.conditionalWatch?.triggerConditions.join(" ") ?? "", /displacement/i);
  assert.match(incomplete.researchPlan.conditionalWatch?.triggerConditions.join(" ") ?? "", /FVG/i);
  assert.match(incomplete.researchPlan.conditionalWatch?.blockers.join(" ") ?? "", /replay/i);
  assert.match(incomplete.researchPlan.conditionalWatch?.nextAction ?? "", /revise or discard/i);

  const rejectedShort = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "order_block_retracement",
      researchSide: "short",
      proposedCandidateStatus: "rejected",
      proposedEntryPrice: 23124.75,
      proposedStopLoss: 23156.25,
      proposedTakeProfit: 23088.5,
      proposedRiskReward: 1.15,
      riskScreeningStatus: "unsuitable_after_hours"
    })
  });
  assert.equal(rejectedShort.researchPlan.status, "no_trade");
  assert.equal(rejectedShort.researchPlan.setupDirection, "neutral");
  assert.equal(rejectedShort.researchPlan.entryPrice, undefined);
  assert.equal(rejectedShort.researchPlan.entryPriceMethod, undefined);
  assert.equal(rejectedShort.researchPlan.signal, "NO_TRADE");

  const persistedRejectedShort = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "order_block_retracement",
      researchSide: "short",
      proposedStopLoss: 23156.25,
      proposedTakeProfit: 23088.5,
      proposedRiskReward: 1.15,
      currentOpportunitySummary: {
        topRejected: { status: "rejected", entry: 23124.75 }
      }
    })
  });
  assert.equal(persistedRejectedShort.researchPlan.entryPrice, undefined);
  assert.equal(persistedRejectedShort.researchPlan.entryPriceMethod, undefined);
  assert.equal(persistedRejectedShort.researchPlan.status, "no_trade");
  assert.equal(persistedRejectedShort.researchPlan.signal, "NO_TRADE");

  const impliedEntry = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "one_shot_one_kill",
      researchSide: "long",
      proposedCandidateStatus: "rejected",
      proposedStopLoss: 23000,
      proposedTakeProfit: 23150,
      proposedRiskReward: 2
    })
  });
  assert.equal(impliedEntry.researchPlan.entryPrice, undefined);
  assert.equal(impliedEntry.researchPlan.entryPriceMethod, undefined);
  assert.equal(impliedEntry.researchPlan.setupDirection, "neutral");
  assert.equal(impliedEntry.researchPlan.status, "no_trade");
  assert.equal(impliedEntry.researchPlan.signal, "NO_TRADE");

  const canonicalResearchGeometry = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "order_block_retracement",
      researchSide: "long",
      proposedCandidateStatus: "near_miss",
      proposedGeometry: {
        schemaVersion: "gotrader.trade-geometry.v1",
        geometryVersion: "g1.1.0",
        geometryId: "geometry-fixture-a",
        logicalGeometryKey: "logical-fixture-a",
        strategyId: "order_block_retracement",
        strategyVersion: "1.0.0",
        candidateId: "candidate-fixture-a",
        direction: "LONG",
        entry: { model: "OB_MIDPOINT", intendedPrice: 100, lifecycleStatus: "WAITING_FOR_ENTRY" },
        stop: { model: "OB_INVALIDATION", price: 96, structuralInvalidation: true },
        target: {
          model: "DRAW_ON_LIQUIDITY",
          price: 110,
          targetId: "draw-a",
          targetType: "DRAW_ON_LIQUIDITY",
          selectionRole: "PRIMARY",
          policyId: "order-block.native-draw",
          policyVersion: "1.0.0"
        },
        targetPolicy: {
          policyId: "order-block.native-draw",
          policyVersion: "1.0.0",
          primaryTargetType: "DRAW_ON_LIQUIDITY",
          primaryTargetId: "draw-a",
          allowedFallbackTargetTypes: []
        },
        riskDistance: 4,
        rewardDistance: 10,
        theoreticalRR: 2.5,
        minimumRequiredRR: 2,
        geometryValid: true,
        actionable: true,
        status: "VALID_ACTIONABLE",
        blockers: [],
        warnings: [],
        sourceFingerprint: "mt5-fingerprint",
        authority: { execution: "none", broker: "none", production: "none" }
      }
    })
  });
  assert.equal(canonicalResearchGeometry.researchPlan.entryPrice, 100);
  assert.equal(canonicalResearchGeometry.researchPlan.stopLoss, 96);
  assert.equal(canonicalResearchGeometry.researchPlan.takeProfit, 110);
  assert.equal(canonicalResearchGeometry.researchPlan.riskReward, 2.5);
  assert.equal(canonicalResearchGeometry.researchPlan.actionable, false, "a rejected candidate must not be labeled actionable");
  assert.equal(canonicalResearchGeometry.researchPlan.displayKind, "RESEARCH_GEOMETRY");
  assert.equal(canonicalResearchGeometry.researchPlan.signal, "NO_TRADE");
  assert.notEqual(canonicalResearchGeometry.researchPlan.setup, "No qualified research plan");

  const legacyFlatLong = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "one_shot_one_kill",
      researchSide: "flat",
      proposedStopLoss: 23000,
      proposedTakeProfit: 23150,
      proposedRiskReward: 2,
      currentOpportunitySummary: {
        topRejected: { status: "rejected", side: "long" }
      }
    })
  });
  assert.equal(legacyFlatLong.researchPlan.side, "long");
  assert.equal(legacyFlatLong.researchPlan.setupDirection, "bullish");
  assert.equal(legacyFlatLong.researchPlan.entryPrice, undefined);
  assert.equal(legacyFlatLong.researchPlan.signal, "NO_TRADE");

  const legacyMissingSideShort = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "order_block_retracement",
      proposedStopLoss: 23150,
      proposedTakeProfit: 23000,
      proposedRiskReward: 2
    })
  });
  assert.equal(legacyMissingSideShort.researchPlan.side, "flat");
  assert.equal(legacyMissingSideShort.researchPlan.setupDirection, "neutral");
  assert.equal(legacyMissingSideShort.researchPlan.entryPrice, undefined);
  assert.equal(legacyMissingSideShort.researchPlan.signal, "NO_TRADE");

  const conflictingBullishPlan = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      modelName: "direction_conflict",
      researchSide: "long",
      proposedEntryPrice: 23100,
      proposedStopLoss: 23150,
      proposedTakeProfit: 23000,
      proposedRiskReward: 2,
      riskScreeningStatus: "clear"
    })
  });
  assert.equal(conflictingBullishPlan.researchPlan.side, "flat");
  assert.equal(conflictingBullishPlan.researchPlan.setupDirection, "neutral");
  assert.equal(conflictingBullishPlan.researchPlan.planCoherence, "incomplete");
  assert.match(conflictingBullishPlan.researchPlan.planCoherenceReason, /Canonical source-native/);
  assert.equal(conflictingBullishPlan.researchPlan.status, "no_trade");
  assert.equal(conflictingBullishPlan.researchPlan.signal, "NO_TRADE");

  const staleSellDuringNewLongCycle = buildOperatorConsoleSnapshot({
    runtime: runtime(),
    cycle: {
      cycleId: "current-long-cycle",
      status: "completed",
      stage: "complete",
      progressPercent: 100,
      message: "Current long cycle completed.",
      authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
      autoApplyAllowed: false,
      researchOnly: true
    },
    activation: activationIdentity({
      cycleId: "older-sell-cycle",
      modelName: "stale_sell",
      researchSide: "short",
      proposedEntryPrice: 23100,
      proposedStopLoss: 23150,
      proposedTakeProfit: 23000,
      proposedRiskReward: 2
    })
  });
  assert.equal(staleSellDuringNewLongCycle.researchPlan.planIdentityStatus, "current");
  assert.equal(staleSellDuringNewLongCycle.researchPlan.cycleStatus, "complete");
  assert.equal(staleSellDuringNewLongCycle.researchPlan.signal, "NO_TRADE");
  assert.equal(staleSellDuringNewLongCycle.researchPlan.side, "flat");
  assert.equal(staleSellDuringNewLongCycle.researchPlan.entryPrice, undefined);

  const marketAdvanced = buildOperatorConsoleSnapshot({
    runtime: runtime({ fingerprint: "new-live-snapshot", lastTimestamp: "2026-08-21T11:05:00.000Z" }),
    activation: activationIdentity({ sourceFingerprint: "older-source-fingerprint" })
  });
  assert.equal(marketAdvanced.researchPlan.planIdentityStatus, "current_market_advanced");
  assert.equal(marketAdvanced.researchPlan.snapshotAdvanced, true);
  assert.equal(marketAdvanced.researchPlan.closedCandleAdvance, 1);

  const crossEncodingCycle = buildOperatorConsoleSnapshot({
    runtime: runtime({ fingerprint: canonicalFingerprint }),
    activation: activationIdentity({
      sourceFingerprint: canonicalFingerprint,
      modelName: "cross_encoding_plan",
      researchSide: "short",
      proposedEntryZone: { lower: 22849.5, upper: 22857.25 },
      proposedStopLoss: 22882.25,
      proposedTakeProfit: 22765.75,
      proposedRiskReward: 3.1
    }),
    cycle: {
      cycleId: "cross-encoding-cycle",
      sourceFingerprint: identityBoundSource.sourceFingerprint,
      status: "completed",
      stage: "complete",
      progressPercent: 100,
      message: "Cross-encoding cycle completed.",
      authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
      autoApplyAllowed: false,
      researchOnly: true
    }
  });
  assert.equal(crossEncodingCycle.researchPlan.planIdentityStatus, "current");
  assert.equal(crossEncodingCycle.researchPlan.entryPrice, undefined, "identity binding must not restore noncanonical levels");

  const stalePlan = buildOperatorConsoleSnapshot({
    runtime: runtime({ fingerprint: "new-live-snapshot", lastTimestamp: "2026-08-21T12:05:00.000Z" }),
    activation: activationIdentity({ sourceFingerprint: "older-source-fingerprint" }),
    now: "2026-08-21T13:00:05.000Z"
  });
  assert.equal(stalePlan.researchPlan.planIdentityStatus, "stale_by_policy");
  assert.equal(stalePlan.researchPlan.signal, "NO_TRADE");

  const visibleWhileRefreshing = buildOperatorConsoleSnapshot({
    runtime: runtime(),
    activation: activationIdentity({
      modelName: "refreshing_plan",
      researchSide: "short",
      proposedEntryPrice: 23100,
      proposedStopLoss: 23150,
      proposedTakeProfit: 23000,
      proposedRiskReward: 2
    }),
    cycle: {
      cycleId: "new-refresh-cycle",
      status: "running",
      stage: "building_market_read",
      progressPercent: 35,
      message: "Refreshing current market context.",
      authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
      autoApplyAllowed: false,
      researchOnly: true
    }
  });
  assert.equal(visibleWhileRefreshing.researchPlan.cycleStatus, "refreshing");
  assert.equal(visibleWhileRefreshing.researchPlan.setup, "refreshing plan");
  assert.notEqual(visibleWhileRefreshing.researchPlan.status, "unavailable");

  const trueSourceChange = buildOperatorConsoleSnapshot({
    runtime: runtime({ sourceLineageId: "source-lineage:v1:different-feed" }),
    activation: activationIdentity()
  });
  assert.equal(trueSourceChange.researchPlan.planIdentityStatus, "source_changed");
  assert.equal(trueSourceChange.researchPlan.signal, "NO_TRADE");

  const candidateMismatch = buildOperatorConsoleSnapshot({
    activation: activationIdentity({
      currentCandidateId: "candidate-old",
      currentOpportunitySummary: {
        topRejected: { id: "candidate-current", status: "rejected", side: "long", entry: 100 }
      },
      researchSide: "long",
      proposedStopLoss: 97,
      proposedTakeProfit: 107,
      proposedRiskReward: 2.33
    })
  });
  assert.equal(candidateMismatch.researchPlan.planIdentityStatus, "current");
  assert.equal(candidateMismatch.researchPlan.candidateBindingStatus, "mismatch");
  assert.equal(candidateMismatch.researchPlan.entryPrice, undefined);

  const legacyUnbound = buildOperatorConsoleSnapshot({
    activation: {
      modelName: "legacy_sell",
      researchSide: "short",
      proposedEntryPrice: 23100,
      proposedStopLoss: 23150,
      proposedTakeProfit: 23000,
      proposedRiskReward: 2
    }
  });
  assert.equal(legacyUnbound.researchPlan.planIdentityStatus, "legacy_unbound");
  assert.equal(legacyUnbound.researchPlan.signal, "NO_TRADE");
  assert.equal(legacyUnbound.researchPlan.entryPrice, undefined);

  const currentRejectedLong = buildOperatorConsoleSnapshot({
    runtime: runtime(),
    cycle: {
      cycleId: "operator-cycle-fixture",
      status: "completed",
      stage: "complete",
      progressPercent: 100,
      message: "Current rejected long cycle completed.",
      authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
      autoApplyAllowed: false,
      researchOnly: true
    },
    activation: activationIdentity({
      modelName: "daily_range_projection",
      researchSide: "long",
      proposedCandidateStatus: "rejected",
      proposedEntryPrice: 30060,
      proposedStopLoss: 30024.34,
      proposedTakeProfit: 30167.15,
      proposedRiskReward: 3,
      riskScreeningStatus: "rejected_candidate"
    })
  });
  assert.equal(currentRejectedLong.researchPlan.planIdentityStatus, "current");
  assert.equal(currentRejectedLong.researchPlan.setupDirection, "neutral");
  assert.equal(currentRejectedLong.researchPlan.signal, "NO_TRADE");
  assert.equal(currentRejectedLong.researchPlan.entryPrice, undefined);

  const unavailable = buildOperatorConsoleSnapshot({ runtime: runtime({ provider: "mock", candles: 48, fingerprint: "" }) });
  assert.equal(unavailable.source.researchEligible, false);
  assert.equal(unavailable.decisions[0]?.kind, "source_attention");

  const paperReview = buildOperatorConsoleSnapshot({ runtime: runtime({ readiness: "Paper-Demo Candidate" }) });
  assert.ok(paperReview.decisions.some((decision) => decision.kind === "paper_demo_review"));

  for (const item of [active, unavailable, paperReview]) {
    assert.deepEqual(item.authority, {
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none"
    });
    assert.equal(item.autoApplyAllowed, false);
    const serialized = JSON.stringify(item);
    assert.doesNotMatch(serialized, /"candles"\s*:/i);
    assert.doesNotMatch(serialized, /rawCandles|accountNumber|orderId|positionId|password|secret|api[_-]?key/i);
  }

  const scenarioMap = {
    scenarioMapId: "scenario-map-operator-fixture",
    timestamp: "2026-07-12T14:00:00.000Z",
    sourceProvider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "M5",
    sourceFingerprint: "canonical-manager-fingerprint",
    currentSession: "new_york",
    marketPhase: "retracement",
    currentDecisionState: "anticipated_scenario",
    primaryScenario: {},
    invalidationScenario: {},
    missingConfirmations: [],
    nextEvidenceToWatch: [],
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" },
    safety: { researchOnly: true, rawCandlesExcluded: true, rawSnapshotsExcluded: true, autoApplyAllowed: false, autoPromotionAllowed: false }
  };
  const source = {
    provider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    candleLimit: 1000,
    candleCount: 1000,
    sourceFingerprint: "activated-feed-fingerprint",
    activeForChart: true,
    activeForResearch: true,
    researchEligibilityReasons: [],
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }
  };
  const preparedScenario = prepareOperatorForwardScenario(scenarioMap, source);
  assert.equal(preparedScenario.ok, true);
  assert.equal(preparedScenario.reason, "ready");
  assert.equal(preparedScenario.scenarioMap?.sourceFingerprint, "activated-feed-fingerprint");
  assert.equal(preparedScenario.scenarioMap?.timeframe, "5m");
  assert.equal(prepareOperatorForwardScenario({ ...scenarioMap, brokerSymbol: "US30" }, source).reason, "source_identity_mismatch");
  assert.equal(prepareOperatorForwardScenario({ ...scenarioMap, sourceProvider: "mock" }, source).reason, "unsafe_source_provider");
  assert.doesNotMatch(JSON.stringify(preparedScenario), /"candles"\s*:/i);

  const cycleSource = fs.readFileSync(path.join(sourceRoot, "operatorCycle.ts"), "utf8");
  const researchCycleSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "researchCycle", "runResearchCycle.ts"),
    "utf8"
  );
  const dashboardCycleSource = fs.readFileSync(
    path.join(projectRoot, "src", "components", "dashboard", "ResearchCycleControl.tsx"),
    "utf8"
  );
  const activateMarketSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "ict-strategy-suite", "ictActivateMarketPipeline.ts"),
    "utf8"
  );
  const candleSourceManagerSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "candleSources", "candleSourceManager.ts"),
    "utf8"
  );
  const operatorStoreSource = fs.readFileSync(path.join(sourceRoot, "operatorConsoleStore.ts"), "utf8");
  assert.doesNotMatch(cycleSource, /runAutonomousResearchLoop/, "fast operator cycles must not launch autonomous research");
  assert.doesNotMatch(cycleSource, /runLlmAdvisory/, "fast operator cycles must not wait for an LLM advisory");
  assert.doesNotMatch(cycleSource, /researchStrategyProfile|maxResearchCandles|validationDepth/, "fast cycles must not configure backtest or validation work");
  assert.match(cycleSource, /OPERATOR_CYCLE_MAX_DURATION_MS\s*=\s*90_000/, "operator cycles must have a 90-second absolute budget");
  assert.match(cycleSource, /OPERATOR_ADVISOR_PACKET_TIMEOUT_MS\s*=\s*45_000/, "advisor packet analysis must stop before the overall cycle deadline");
  assert.match(cycleSource, /OPERATOR_DEADLINE_ABORT_REASON\s*=\s*"operator_deadline"/, "deadline exits must remain distinct from operator cancellation");
  assert.match(cycleSource, /Use Advanced Research Lab for deep-history validation/, "deadline guidance must route deep validation to the correct surface");
  assert.match(cycleSource, /withinDeadline\s*=\s*<T>\(work:\s*Promise<T>\)\s*=>\s*Promise\.race\(\[work, deadlinePromise\]\)/, "each fast-path stage must remain inside the hard deadline");
  assert.match(cycleSource, /clearTimeout\(deadlineTimer\)/, "the absolute deadline timer must be released on every terminal path");
  assert.match(dashboardCycleSource, /DASHBOARD_TACTICAL_CYCLE_MAX_DURATION_MS\s*=\s*300_000/, "dashboard tactical cycles must stop within five minutes");
  assert.match(dashboardCycleSource, /DASHBOARD_ADVANCED_CYCLE_MAX_DURATION_MS\s*=\s*1_200_000/, "explicit advanced dashboard cycles must stop within twenty minutes");
  assert.match(
    dashboardCycleSource,
    /validationDepth:\s*advancedFullResearchMode\s*\?\s*"frozen_profile"\s*:\s*"tactical"/,
    "normal dashboard cycles must not silently expand into frozen-profile deep history"
  );
  assert.match(dashboardCycleSource, /Promise\.race\(\[cyclePromise, deadlinePromise\]\)/, "dashboard deadlines must settle the UI even when nested work is still returning");
  assert.match(dashboardCycleSource, /saveResearchCycleRun\(terminalRun\)/, "dashboard deadline results must be persisted instead of leaving a running checkpoint");
  assert.match(dashboardCycleSource, /loadBoundedResearchCycleState/, "dashboard load must recover a stale running cycle");
  assert.match(dashboardCycleSource, /run\?\.status !== "running"/, "stale recovery must leave terminal results unchanged");
  assert.match(
    cycleSource,
    /publishClosedMt5ReadOnlyCandles\(activatedFeed\)/,
    "source activation must publish the latest confirmed closed candle into the forward-evidence bus"
  );
  assert.match(
    cycleSource,
    /recordForwardScenarioPrediction\(preparedScenario\.scenarioMap/,
    "operator cycles must persist their compact research-only forward scenario"
  );
  assert.match(
    cycleSource,
    /modelVersion:\s*"operator_market_scenario:v1"/,
    "operator scenario watches need an explicit non-execution model version"
  );
  assert.doesNotMatch(cycleSource, /OPERATOR_RESEARCH_STALL_TIMEOUT_MS|resetResearchStallWatchdog/, "the fast path must not retain an autonomous-research stall watchdog");
  assert.match(
    cycleSource,
    /activeController\.abort\(OPERATOR_STOP_ABORT_REASON\)/,
    "the Stop button must record explicit operator-stop provenance"
  );
  assert.match(
    cycleSource,
    /controller\.abort\(OPERATOR_DEADLINE_ABORT_REASON\)/,
    "the hard deadline must record distinct deadline provenance"
  );
  assert.match(
    cycleSource,
    /stoppedByOperator\s*=\s*controller\.signal\.reason\s*===\s*OPERATOR_STOP_ABORT_REASON/,
    "terminal cycle labeling must derive operator cancellation from the abort reason"
  );
  assert.match(
    cycleSource,
    /deadlineReached\s*=\s*controller\.signal\.reason\s*===\s*OPERATOR_DEADLINE_ABORT_REASON/,
    "terminal cycle labeling must preserve deadline failures separately"
  );
  assert.match(
    researchCycleSource,
    /backtestResult\s*=\s*await runDetectorProfileBacktest\(\{[\s\S]*?candles:\s*researchCandles,[\s\S]*?signal,/,
    "the baseline research backtest must run off the browser main thread"
  );
  assert.match(
    activateMarketSource,
    /notify\(callbacks, id, steps\);\s*await new Promise<void>\(\(resolve\) => globalThis\.setTimeout\(resolve, 0\)\);/,
    "activate-market stages must yield before synchronous analysis work"
  );
  assert.match(
    activateMarketSource,
    /runIctAdvisorPacket\(\{[\s\S]*?snapshot,[\s\S]*?signal:\s*config\.signal,[\s\S]*?timeoutMs:\s*config\.advisorPacketTimeoutMs[\s\S]*?\}\)/,
    "multi-strategy advisor analysis must run off the browser main thread"
  );
  assert.match(
    cycleSource,
    /canonicalSourceFingerprint\s*=\s*activation\.snapshot\.marketData\.activeResearchSource\.fingerprint/,
    "successful cycle state must use the same canonical fingerprint encoding as the saved plan"
  );
  assert.match(
    cycleSource,
    /sourceFingerprint:\s*canonicalSourceFingerprint/,
    "cycle and forward-scenario identity must not reuse the MT5 feed candle hash"
  );
  assert.match(
    candleSourceManagerSource,
    /sourceId\s*=\s*sourceIdFor\("mt5_read_only",\s*feed\.symbol,\s*feed\.timeframe,\s*"active"\)/,
    "MT5 canonical lineage must remain stable across fetch instances"
  );
  assert.doesNotMatch(
    candleSourceManagerSource,
    /canonicalSourceFromMt5ReadOnlyFeed[\s\S]*?sourceId:\s*feed\.feedId/,
    "ephemeral MT5 feed ids must not become canonical source lineage"
  );
  assert.match(activateMarketSource, /gotrader\.ict-activate-market\.latest\.v3/, "trade plans must use the lineage-bound v3 summary protocol");
  assert.match(activateMarketSource, /cycleId:\s*config\.cycleId/, "activation summaries must bind to the operator cycle");
  assert.match(activateMarketSource, /sourceFingerprint:\s*sourceFingerprint\(snapshot\)/, "activation summaries must bind to the active source");
  assert.match(activateMarketSource, /sourceLineageId:\s*snapshot\.marketData\.activeResearchSource\.sourceLineageId/, "activation summaries must bind to stable source lineage");
  assert.match(activateMarketSource, /activationSnapshotId:\s*snapshot\.marketData\.activeResearchSource\.sourceSnapshotId/, "activation summaries must preserve the evaluated snapshot identity");
  assert.match(activateMarketSource, /currentReadEvaluatedAt/, "activation summaries must preserve current-read time identity");
  assert.match(activateMarketSource, /currentCandidateId/, "activation summaries must preserve current candidate identity");
  assert.match(cycleSource, /cycleId,\s*\n\s*signal:\s*controller\.signal/, "operator pipeline calls must carry cycle identity and cancellation lineage");
  assert.doesNotMatch(operatorStoreSource, /pendingResearchPlan|pending_cycle/, "refreshing a cycle must not erase the prior research plan");
  assert.match(operatorStoreSource, /researchPlan:\s*\{\s*\.\.\.snapshot\.researchPlan/, "cycle updates must preserve the plan while marking refresh state");
  assert.match(cycleSource, /recoverInterruptedState/, "orphaned running state must recover after a reload");
  assert.match(cycleSource, /status:\s*"canceled"/, "interrupted cycles must become terminal");
  assert.match(cycleSource, /ownerInstanceId/, "cycle state must bind a running cycle to one page owner");
  assert.match(cycleSource, /gotrader\.operator-cycle\.v3/, "corrected cycle ownership must use an isolated v3 storage protocol");
  assert.match(cycleSource, /LEGACY_OPERATOR_CYCLE_STORAGE_KEYS/, "legacy cycle state must migrate fail-closed");
  assert.match(cycleSource, /window\.sessionStorage\.getItem\(OPERATOR_CYCLE_TAB_STORAGE_KEY\)/, "reload detection must use a tab-stable identity");
  assert.match(cycleSource, /__gotraderOperatorCycleOwnerInstanceId/, "document ownership must survive development hot-module replacement");
  assert.match(cycleSource, /heartbeatIsFresh/, "foreign tabs must distinguish a fresh owner from an abandoned cycle");
  assert.match(
    cycleSource,
    /state\.ownerInstanceId && state\.ownerInstanceId !== ownerInstanceId && heartbeatIsFresh\(state\)/,
    "a fresh foreign owner must be observed without canceling its cycle"
  );
  assert.match(cycleSource, /OPERATOR_CYCLE_STALE_AFTER_MS\s*=\s*90_000/, "abandoned owner recovery must remain bounded");
  assert.match(cycleSource, /options:\s*\{ notify\?: boolean \}/, "heartbeat writes must support quiet persistence");
  assert.doesNotMatch(cycleSource, /window\.addEventListener\("pagehide"/, "transient page lifecycle events must not cancel a cycle");
  assert.match(cycleSource, /state\.ownerTabId === ownerTabId/, "same-tab document replacement must recover abandoned work");

  const autonomousSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "autonomousResearch", "runAutonomousResearchLoop.ts"),
    "utf8"
  );
  assert.match(
    autonomousSource,
    /reason === "llm_advisory_offline" \|\| reason === "llm_advisory_unavailable"[\s\S]*?\? "completed_with_warnings"/,
    "an optional LLM advisory outage must preserve completed deterministic results as a warning"
  );
  assert.match(
    autonomousSource,
    /frozenProfile\s*\?\s*1000\s*:\s*settings\.advancedFullResearchMode\s*\?\s*undefined\s*:\s*500/,
    "bounded autonomous cycles must use 1,000 candles only for a frozen profile and 500 otherwise"
  );
  assert.match(
    autonomousSource,
    /skipLlmAdvisory:\s*!\(settings\.runLlmAdvisory\s*\|\|\s*settings\.advancedFullResearchMode\)/,
    "LLM advisory must be independently selectable from the full autonomous search mode"
  );
  assert.doesNotMatch(
    researchCycleSource,
    /else if \(!llmAdvisoryRequiredNow\)/,
    "an explicitly requested post-validation advisory must not be deferred behind candidate readiness blockers"
  );

  const validationSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "validation", "runValidationSuite.ts"),
    "utf8"
  );
  assert.match(validationSource, /runValidationSuiteAsync/, "research validation must expose a cooperative runner");
  assert.match(validationSource, /setTimeout\(resolve, 0\)/, "cooperative validation must yield between scenarios");

  assert.match(
    researchCycleSource,
    /validationDepth\s*===\s*"frozen_profile"/,
    "deep MT5 history must require an explicit frozen-profile validation scope"
  );
  assert.match(
    researchCycleSource,
    /Tactical validation used the bounded/,
    "tactical validation must report that deep history was intentionally deferred"
  );

  const walkForwardResolver = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "walkForward", "walkForwardSourceResolver.ts"),
    "utf8"
  );
  const cachedMt5Position = walkForwardResolver.indexOf("const cachedMt5Feed");
  const importedPosition = walkForwardResolver.indexOf("const importedOrMockSource");
  assert(cachedMt5Position >= 0 && importedPosition > cachedMt5Position, "walk-forward must resolve active MT5 before imported history");
  assert.match(walkForwardResolver, /SOURCE_RESOLUTION_TIMEOUT_MS\s*=\s*8_000/, "walk-forward source resolution must be bounded");
  assert.match(walkForwardResolver, /signal\?:\s*AbortSignal/, "deep-history source resolution must accept cooperative cancellation");
  assert.match(walkForwardResolver, /if \(options\.signal\?\.aborted\) throw error/, "deep-history cancellation must not be swallowed as a tactical fallback");

  const mt5ClientSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "integrations", "mt5", "mt5ReadOnlyClient.ts"),
    "utf8"
  );
  assert.match(mt5ClientSource, /request\.signal\?\.throwIfAborted\(\)/, "chunked MT5 history must stop between date windows");
  assert.match(mt5ClientSource, /signal\?\.addEventListener\("abort", abortFromCaller/, "an active MT5 range request must inherit cycle cancellation");

  const operatorViewSource = fs.readFileSync(
    path.join(projectRoot, "src", "components", "operator", "OperatorConsoleView.tsx"),
    "utf8"
  );
  assert.match(operatorViewSource, /operator-source-preflight-note/, "the operator UI must explain source preflight before a blocked cycle");
  assert.match(operatorViewSource, /mock data can be reviewed, but it cannot qualify a research plan/, "profitable mock outcomes must not be presented as qualified research evidence");
  assert.match(
    operatorViewSource,
    /data-testid="operator-cycle-heartbeat"/,
    "the Overview cycle-status section must expose the live heartbeat"
  );
  assert.match(operatorViewSource, /data-testid="operator-cycle-elapsed"/, "cycle status must expose elapsed time");
  assert.match(operatorViewSource, /window\.setInterval\(\(\) => setClockNow\(Date\.now\(\)\), 1000\)/, "active cycle elapsed time must update every second");
  assert.match(operatorViewSource, /elapsedTime\(snapshot\.cycle\.startedAt, snapshot\.cycle\.completedAt, clockNow\)/, "elapsed time must bind to recorded cycle timestamps");
  assert.match(operatorViewSource, /data-testid="operator-gbrain-memory-summary"/, "operator console must show memory counts");
  assert.match(operatorViewSource, /data-testid="operator-research-risk-preview"/, "operator console must show research levels and risk context");
  assert.match(operatorViewSource, /data-testid="operator-status-layers"/, "operator console must separate execution, candidate, hypothesis, and readiness status");
  assert.match(operatorViewSource, /active profile/, "historical performance must be labeled as profile evidence rather than current-cycle output");
  assert.match(operatorViewSource, /"Research entry"[\s\S]*?price\(snapshot\.researchPlan\.entryPrice\)/, "operator console must distinguish research entry geometry");
  assert.match(operatorViewSource, /data-testid="operator-conditional-research-watch"/, "conditional watch must remain a compact status strip");
  assert.match(operatorViewSource, /data-testid="operator-plan-identity-reason"/, "identity failures must be visible on the plan card");
  assert.ok(
    operatorViewSource.indexOf('label: snapshot.researchPlan.actionable ? "Entry price" : "Research entry"')
      < operatorViewSource.indexOf('data-testid="operator-conditional-research-watch"'),
    "research price metrics must remain visible before conditional-watch status"
  );
  assert.match(operatorViewSource, /snapshot\.researchPlan\.setupDirection/, "operator console must show bullish, bearish, or neutral setup direction");
  assert.match(operatorViewSource, /snapshot\.researchPlan\.signal/, "operator console must show BUY, SELL, or NO TRADE");
  assert.match(operatorViewSource, /snapshot\.researchPlan\.signal === "NO_TRADE" \? "muted" : "success"/, "BUY and SELL signals must use the positive action color");
  assert.match(operatorViewSource, /"Research stop"[\s\S]*?"negative"/, "research stop must use the negative color");
  assert.match(operatorViewSource, /"Research target"[\s\S]*?"positive"/, "research target must use the positive color");
  assert.doesNotMatch(operatorViewSource, /rr_implied_recovery/, "UI must not describe algebraically recovered entries");
  assert.match(operatorViewSource, /label: "Probability"/, "trade plan must display probability classification");
  assert.match(operatorViewSource, /data-testid="operator-target-provenance"/, "trade plan must display target provenance");
  assert.match(operatorViewSource, /Target gate only; overall candidate and readiness gates remain separate/, "target acceptance must not imply candidate readiness");
  assert.match(
    operatorViewSource,
    /uppercase tracking-\[0\.12em\] text-white">\{label\}/,
    "trade-plan level labels must remain readable at full contrast"
  );
  assert.match(operatorViewSource, /percentage: percent\(normalized\)/, "probability decimals must render as percentages");
  assert.match(operatorViewSource, /data-testid=\{label === "Probability" \? "operator-plan-probability-value"/, "probability must expose its rendered value for clipping checks");
  assert.doesNotMatch(
    operatorViewSource,
    /mt-2 truncate font-mono text-base font-semibold tabular-nums/,
    "trade-plan values must not hide source-of-truth values behind ellipsis"
  );
  assert.match(operatorViewSource, /normalized >= 0\.7/, "high probability must begin at 70 percent");
  assert.match(operatorViewSource, /normalized >= 0\.5/, "medium probability must begin at 50 percent");
  assert.match(operatorViewSource, /Informational only/, "research levels must be explicitly non-executable");
  assert.doesNotMatch(operatorViewSource, /Place Order|Buy Market|Sell Market|Enable Live Trading|Connect Live Broker/);
  assert.match(
    operatorViewSource,
    /cycleActive\s*&&\s*"cycle-status-running"/,
    "the Overview cycle-status panel must radiate only while the cycle is active"
  );
  for (const stage of ["activating_source", "building_market_read", "running_research", "finalizing"]) {
    assert.match(
      operatorViewSource,
      new RegExp(`case ["']${stage}["']`),
      `the Overview heartbeat must distinguish the ${stage} stage`
    );
  }

  console.log("GoTrader operator console snapshot test passed.");
  console.log(JSON.stringify({ source: active.source, results: active.results, authority: active.authority }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
