#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "currentOpportunity");
const ictSourceRoot = path.join(projectRoot, "src", "lib", "ict-strategy-suite");
const outRoot = path.join(projectRoot, ".gotrader", "current-opportunity-scanner-test");
const sourceFiles = [
  { root: path.join(projectRoot, "src", "lib", "ictCanonical"), file: "canonicalIctTypes.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictCanonical"), file: "canonicalIctIdentity.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictCanonical"), file: "canonicalIctModelContract.ts" },
  { root: path.join(projectRoot, "src", "lib", "tradeGeometry"), file: "tradeGeometryTypes.ts" },
  { root: path.join(projectRoot, "src", "lib", "tradeGeometry"), file: "targetSelection.ts" },
  { root: path.join(projectRoot, "src", "lib", "tradeGeometry"), file: "canonicalTradeGeometry.ts" },
  { root: path.join(projectRoot, "src", "lib", "tradeGeometry"), file: "entryLifecycle.ts" },
  { root: path.join(projectRoot, "src", "lib", "tradeGeometry"), file: "strategyGeometryIntent.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI2"), file: "ictI2Types.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI2"), file: "ictI2Shared.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI2"), file: "ict2022Model.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI2"), file: "ictI2Collection.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI3"), file: "ictI3Types.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI3"), file: "marketMakerFramework.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI3"), file: "marketMakerDeliverySequence.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI3"), file: "marketMakerParameters.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI3"), file: "marketMakerModelCore.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI3"), file: "marketMakerBuyModel.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictI3"), file: "marketMakerSellModel.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictCharterProfiles"), file: "ictCharterProfileTypes.ts" },
  { root: path.join(projectRoot, "src", "lib", "ictCharterProfiles"), file: "ictCharterProfileRuntime.ts" },
  { root: sourceRoot, file: "currentOpportunityTypes.ts" },
  { root: sourceRoot, file: "canonicalRuntimeCandidateSet.ts" },
  { root: sourceRoot, file: "buildCurrentOpportunityContext.ts" },
  { root: ictSourceRoot, file: "ictTradeConstructionTypes.ts" },
  { root: ictSourceRoot, file: "ictTradeConstruction.ts" },
  { root: ictSourceRoot, file: "ictIfvgProducerPolicy.ts" },
  { root: ictSourceRoot, file: "ictIfvgTypes.ts" },
  { root: ictSourceRoot, file: "ictIfvg.ts" },
  { root: ictSourceRoot, file: "ictDetectorCanonicalGeometry.ts" },
  { root: ictSourceRoot, file: "ictIfvgFreshRetestV3.ts" },
  { root: ictSourceRoot, file: "ictSignalContract.ts" },
  { root: sourceRoot, file: "detectCurrentOpportunities.ts" },
  { root: sourceRoot, file: "currentOpportunityStore.ts" },
  { root: sourceRoot, file: "index.ts" }
];

function compileForNode() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });
  for (const { root, file } of sourceFiles) {
    const sourcePath = path.join(root, file);
    const source = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText;
    const rewritten = transpiled
      .replace(/from\s+"\.\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'\.\/([^']+)'/g, "from './$1.mjs'")
      .replace(/from\s+"..\/ict-strategy-suite\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'..\/ict-strategy-suite\/([^']+)'/g, "from './$1.mjs'");
    const dependenciesRewritten = rewritten
      .replace(/from\s+"\.\.\/ictCharterProfiles"/g, 'from "./ictCharterProfileRuntime.mjs"')
      .replace(/from\s+'\.\.\/ictCharterProfiles'/g, "from './ictCharterProfileRuntime.mjs'")
      .replace(/from\s+"@\/lib\/ictCanonical\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/tradeGeometry\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/tradeGeometry"/g, 'from "./canonicalTradeGeometry.mjs"')
      .replace(/from\s+"@\/lib\/ictI2\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/ictI3\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/ictCanonical"/g, 'from "./canonicalIctTypes.mjs"')
      .replace(/from\s+"..\/tradeGeometry\/canonicalTradeGeometry"/g, 'from "./canonicalTradeGeometry.mjs"');
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), dependenciesRewritten, "utf8");
  }
  fs.appendFileSync(
    path.join(outRoot, "canonicalTradeGeometry.mjs"),
    '\nexport { evaluateEntryLifecycle } from "./entryLifecycle.mjs";\n',
    "utf8"
  );
}

const basePacket = {
  generatedAt: "2026-06-14T14:00:00.000Z",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  primaryTimeframe: "5m",
  htfTimeframes: ["15m", "1h"],
  activeSource: {
    provider: "mt5_read_only",
    candleCount: 1000,
    sourceFingerprint: "mt5_fp_current",
    sourceLabel: "MT5 read-only USTECH",
    sourceStatus: {
      isMockOrSample: false,
      isResearchActive: true,
      isProxyInstrument: true,
      statusLabel: "MT5 read-only research active"
    }
  },
  marketAnalysisContext: {
    analysisDepthStatus: "limited",
    analysisTimeframesUsed: ["M5", "M15"],
    missingTimeframes: ["H1", "H4", "D1", "W1"],
    analysisTimeframes: [
      { timeframe: "M5", candleCount: 1000, availableLookbackDays: 3.4 },
      { timeframe: "M15", candleCount: 1000, availableLookbackDays: 10.2 }
    ]
  },
  compactSummary: {},
  recommendedSignal: {
    setup: "no_trade",
    side: "flat",
    confidence: 0,
    summary: "No compact signal.",
    noTradeReasons: ["No model confirmed."]
  },
  approvedProfileDecision: { status: "no_trade" }
};

const canonicalGeometry = ({ strategyId, direction, entry, stop, target, rr = 2.5, actionable = true }) => ({
  schemaVersion: "gotrader.trade-geometry.v1",
  geometryVersion: "g2.1.0",
  geometryId: `${strategyId}-geometry-fixture`,
  logicalGeometryKey: `${strategyId}-logical-fixture`,
  strategyId,
  strategyVersion: "test",
  candidateId: `${strategyId}-candidate-fixture`,
  direction,
  entry: { model: "NATIVE_TEST_ENTRY", intendedPrice: entry, lifecycleStatus: "WAITING_FOR_ENTRY" },
  stop: { model: "NATIVE_TEST_STOP", price: stop, structuralInvalidation: true },
  target: { model: "NATIVE_TEST_TARGET", price: target, targetId: "target-fixture", targetType: "DRAW_ON_LIQUIDITY", selectionRole: "PRIMARY", policyId: "native-test", policyVersion: "1" },
  targetPolicy: { policyId: "native-test", policyVersion: "1", primaryTargetType: "DRAW_ON_LIQUIDITY", primaryTargetId: "target-fixture", allowedFallbackTargetTypes: [] },
  riskDistance: Math.abs(entry - stop), rewardDistance: Math.abs(target - entry), theoreticalRR: rr, minimumRequiredRR: 2,
  geometryValid: true, actionable, status: actionable ? "VALID_ACTIONABLE" : "VALID_BELOW_RR_THRESHOLD", blockers: [], warnings: [],
  sourceFingerprint: "mt5_fp_current", authority: { execution: "none", broker: "none", production: "none" }
});

const marketMakerCollection = ({ buy = false, sell = false } = {}) => {
  const candidate = (direction) => {
    const bullish = direction === "long";
    const strategyId = bullish ? "ict_market_maker_buy_model_v1" : "ict_market_maker_sell_model_v1";
    const geometry = canonicalGeometry({
      strategyId,
      direction: bullish ? "LONG" : "SHORT",
      entry: bullish ? 99 : 101,
      stop: bullish ? 90 : 110,
      target: bullish ? 120 : 80,
      rr: 21 / 9
    });
    geometry.geometryId = `${strategyId}-g1-1-geometry`;
    geometry.candidateId = `${strategyId}-candidate`;
    return {
      candidateId: geometry.candidateId,
      strategyId,
      strategyVersion: "1.0.0",
      profileId: bullish ? "ict_mmbm_base_research_v1" : "ict_mmsm_base_research_v1",
      parameterHash: `${strategyId}-parameters`,
      sourceFingerprint: "mt5|ES|ES|5m|int-1-1-live",
      symbol: "ES",
      timeframe: "5m",
      marketTimestamp: ifvgIso(25),
      direction,
      state: "ACTIVE_DELIVERY",
      deliverySequence: {
        schemaId: "gotrader.ict.i3.market-maker-delivery-sequence",
        schemaVersion: "1.0.0",
        sequenceId: `${strategyId}-sequence`,
        strategyFamily: "MARKET_MAKER",
        direction: bullish ? "BULLISH" : "BEARISH",
        sourceFingerprint: "mt5|ES|ES|5m|int-1-1-live",
        dealingRangeId: "range-1",
        pdLocationFactId: bullish ? "discount-location" : "premium-location",
        engineeringLiquidityId: bullish ? "sellside-engineering" : "buyside-engineering",
        displacementId: bullish ? "bullish-displacement" : "bearish-displacement",
        pdArrayId: bullish ? "bullish-pd-array" : "bearish-pd-array",
        objectiveLiquidityId: bullish ? "buyside-objective" : "sellside-objective",
        orderedTimestamps: {}, status: "QUALIFIED", blockers: [],
        supportingFactIds: ["range-1", "engineering", "displacement", "pd-array", "objective"],
        asOf: ifvgIso(25),
        policyId: "gotrader.ict.i3.market-maker-delivery-sequence",
        policyVersion: "1.0.0"
      },
      context: {
        frameworkId: "gotrader.ict.i3.mmxm-delivery-framework.v1",
        classification: "framework_context",
        phase: "ACTIVE_DELIVERY",
        deliveryDirection: bullish ? "BULLISH_DELIVERY" : "BEARISH_DELIVERY",
        dealingRangeId: "range-1",
        liquidityEventId: bullish ? "sellside-engineering" : "buyside-engineering",
        sequenceId: `${strategyId}-sequence`,
        displacementId: bullish ? "bullish-displacement" : "bearish-displacement",
        pdArrayId: bullish ? "bullish-pd-array" : "bearish-pd-array",
        objectiveLiquidityId: bullish ? "buyside-objective" : "sellside-objective",
        supportingFactIds: ["range-1", "engineering", "displacement", "pd-array", "objective"],
        blockers: [], authority: ictAuthority
      },
      supportingFactIds: ["range-1", "engineering", "displacement", "pd-array", "objective"],
      transitions: [], geometry, blockers: [], warnings: [], authority: ictAuthority,
      researchValidated: false, productionAdoptionAllowed: false
    };
  };
  const candidates = [buy ? candidate("long") : undefined, sell ? candidate("short") : undefined].filter(Boolean);
  return {
    version: "gotrader.ict-market-maker-candidates.v1",
    generatedAt: ifvgIso(25), sourceFingerprint: "mt5|ES|ES|5m|int-1-1-live",
    frameworks: candidates.map((item) => item.context), candidates,
    researchValidated: false, authority: ictAuthority
  };
};

const baseRead = {
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  primaryTimeframe: "5m",
  packetSource: "live_mt5",
  dataStatus: "ready",
  candleCount: 1000,
  side: "short",
  bestSetup: "session_reversal",
  modelQualityLane: "watchlist",
  modelName: "consolidation_manipulation_distribution",
  opportunityDetected: true,
  opportunityType: "expansion_from_consolidation",
  opportunityStage: "forming",
  opportunityQuality: "medium",
  opportunityDirection: "bearish",
  opportunityNextAction: "Wait for FVG return and replay validation.",
  opportunityMissingEvidence: ["fvg_return"],
  opportunityBlockers: [],
  topReasons: ["Sweep and displacement present; FVG return missing."],
  analysisTimeframesUsed: ["M5", "M15"],
  missingTimeframes: ["H1", "H4", "D1", "W1"],
  analysisDepthStatus: "limited",
  availableLookbackDays: 10.2,
  fvgStatus: "missing",
  displacementStatus: "bearish_with_fvg",
  liquiditySwept: "buyside @ 30500",
  debug: {
    lastEvaluationAt: "2026-06-14T14:00:00.000Z",
    sourceFingerprint: "mt5_fp_current"
  }
};

function assertSafe(suite, scan) {
  const compact = suite.assertCurrentOpportunityScanIsCompact(scan);
  assert.equal(compact.ok, true, "scan must be compact and safe");
  assert.equal(scan.authority.executionAuthority, "none");
  assert.equal(scan.authority.brokerAuthority, "none");
  assert.equal(scan.authority.readinessOverrideAuthority, "none");
  assert.doesNotMatch(JSON.stringify(scan), /"candles"\s*:|"rawSnapshot"\s*:|"snapshot"\s*:|"password"\s*:|"secret"\s*:|"api[_-]?key"\s*:|"account(Data|Number|Id)?"\s*:|"position(Data|s|Id)?"\s*:|"order(Data|s|Id)?"\s*:/i);
}

const tradeCandidateOnlyBlockers = [
  "entry_missing",
  "target_missing",
  "invalidation_missing",
  "rr_unavailable",
  "invalid_price_order",
  "target_too_close",
  "rr_below_minimum"
];

function assertDiagnosticContextOnly(item) {
  assert.equal(item.classification, "diagnostic", "diagnostic row should be classified separately from trade candidates");
  assert.ok(
    ["diagnostic_context", "market_map_only", "regime_context", "no_trade_context"].includes(item.status),
    `diagnostic row should use a context-only status, got ${item.status}`
  );
  const labels = [...item.blockers, ...item.missingConditions];
  for (const blocker of tradeCandidateOnlyBlockers) {
    assert.equal(labels.includes(blocker), false, `diagnostic row must not show trade-construction blocker ${blocker}`);
  }
  assert.match(item.nextAction, /context only|registered trade setup|bias\/context/i);
  assert.equal(item.requiredValidation.length, 0, "diagnostic rows should not require replay validation by themselves");
  assert.equal(item.entry, undefined, "diagnostic rows should not expose an entry");
  assert.equal(item.target, undefined, "diagnostic rows should not expose a target");
  assert.equal(item.invalidation, undefined, "diagnostic rows should not expose an invalidation");
  assert.equal(item.rrEstimate, undefined, "diagnostic rows should not expose RR");
}

const ifvgIso = (minute) => new Date(Date.UTC(2026, 5, 12, 13, 30 + minute)).toISOString();
const ifvgCandle = (minute, open, high, low, close, volume = 100) => ({
  timestamp: ifvgIso(minute), open, high, low, close, volume
});
const ifvgOverlap = (startMinute, count, base = 100) => Array.from({ length: count }, (_, index) => {
  const open = base + (index % 3) * 0.12;
  const close = base + ((index + 1) % 3) * 0.12;
  return ifvgCandle(startMinute + index * 5, open, base + 1.2, base - 1.2, close, 150 + index);
});
const liveIfvgCandles = () => [
  ...ifvgOverlap(-30, 6),
  ...ifvgOverlap(0, 10),
  ifvgCandle(50, 101, 104, 96, 97),
  ifvgCandle(55, 97, 99, 95.5, 96.8),
  ifvgCandle(60, 93, 94, 90, 91),
  ifvgCandle(65, 91, 93.4, 90.5, 92.2),
  ifvgCandle(70, 92.5, 98.6, 92.2, 98),
  ifvgCandle(75, 98, 99.2, 97.2, 98.8),
  ifvgCandle(80, 98.8, 100.2, 98.2, 99.8),
  ifvgCandle(85, 99.6, 100, 94.8, 95.6)
];
const liveIfvgContext = {
  "15m": [ifvgCandle(-120, 90, 93, 89, 92), ifvgCandle(-105, 92, 98, 91, 97), ifvgCandle(-90, 97, 102, 96, 101)],
  "1h": [ifvgCandle(-240, 88, 94, 87, 93), ifvgCandle(-180, 93, 103, 92, 101)]
};

const ictAuthority = {
  executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none",
  productionAdoptionAllowed: false, canCreateEvidence: false, canApproveReadiness: false,
  canApplyCalibration: false, canCreateTradeIntent: false
};
const ictFactBase = (factId, factType, minute, timeframe = "5m") => ({
  factId, factType, symbol: "ES", timeframe, occurredAt: ifvgIso(minute), confirmedAt: ifvgIso(minute), validFrom: ifvgIso(minute), state: "ACTIVE",
  lineage: { sourceCandleIds: [`ict-${minute}`], sourceFactIds: [], sourceFingerprint: "mt5|ES|ES|5m|int-3a-1", policyId: "int-3a-1-fixture", policyVersion: "1" },
  authority: ictAuthority
});
const ict2022Fixture = (direction) => {
  const long = direction === "bullish";
  return {
    facts: [
      { ...ictFactBase("ict-target", "LIQUIDITY", 0, "1h"), liquidityId: "ict-target-liquidity", side: long ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", sourceStructureIds: ["target-swing"], ownerTimeframe: "1h", price: long ? 112 : 89, status: "AVAILABLE" },
      { ...ictFactBase("ict-draw", "DRAW_ON_LIQUIDITY", 0, "1h"), drawId: "ict-primary-draw", direction, targetLiquidityId: "ict-target-liquidity", targetClass: "EXTERNAL", ownerTimeframe: "1h", distance: 10, structuralRelevance: 75, available: true, consumed: false, selectionPolicyVersion: "1", nearestLiquidityId: "ict-target-liquidity" },
      { ...ictFactBase("ict-raid", "LIQUIDITY", 5, "15m"), liquidityId: "ict-raid-liquidity", side: long ? "SELL_SIDE_LIQUIDITY" : "BUY_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", sourceStructureIds: ["raid-swing"], ownerTimeframe: "15m", price: long ? 95 : 105, status: "CONSUMED", consumedAt: ifvgIso(5), consumingCandleId: "ict-5" },
      { ...ictFactBase("ict-displacement", "DISPLACEMENT", 10), displacementId: "ict-displacement", direction, startCandleId: "ict-5", endCandleId: "ict-10", bodySize: 4, baselineBodySize: 2, bodyMultiple: 2, measurementPolicyId: "int-3a-1-fixture" },
      { ...ictFactBase("ict-mss", "MSS", 15), mssId: "ict-mss", direction, brokenStructureId: "ict-swing", breakCandleId: "ict-15", displacementId: "ict-displacement", breakPrice: 100 },
      { ...ictFactBase("ict-fvg", "FVG", 20), fvgId: "ict-fvg", direction, proximalPrice: long ? 100 : 101, distalPrice: long ? 101 : 100, midpoint: 100.5, originCandleIds: ["ict-10", "ict-15", "ict-20"], fvgState: "OPEN", filledPercentage: 0 }
    ],
    candlesByTimeframe: { "5m": [{ id: "ict-retrace", symbol: "ES", timeframe: "5m", timestamp: ifvgIso(25), open: 101, high: 101.2, low: 100.4, close: 100.8, volume: 100 }] },
    asOf: ifvgIso(25), sourceFingerprint: "mt5|ES|ES|5m|int-3a-1",
    narrative: { structural: direction, intermediate: long ? "bearish" : "bullish", execution: long ? "bearish" : "bullish", liquidityPath: long ? "buyside" : "sellside", structuralTimeframe: "1h", intermediateTimeframe: "15m", executionTimeframe: "5m", policyId: "gotrader.ict.c1-1.hierarchical-roles.v1", policyVersion: "1.0.0" },
    symbol: "ES", timeframe: "5m"
  };
};

const marketMakerProducerFixture = (direction) => {
  const bullish = direction === "BULLISH";
  const factDirection = bullish ? "bullish" : "bearish";
  const objectiveSide = bullish ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY";
  const facts = [
    { ...ictFactBase("mm-range", "DEALING_RANGE", 0, "1h"), dealingRangeId: "mm-range-1", highSwingId: "mm-range-high", lowSwingId: "mm-range-low", highPrice: 110, lowPrice: 90, equilibrium: 100, context: "balanced_range" },
    { ...ictFactBase("mm-pd-location", "PD_LOCATION", 1), pdLocationId: "mm-pd-location", dealingRangeId: "mm-range-1", price: bullish ? 96 : 104, location: bullish ? "DISCOUNT" : "PREMIUM", equilibriumBandFraction: 0.04 },
    { ...ictFactBase("mm-engineering", "LIQUIDITY", 5, "1h"), liquidityId: "mm-engineering", side: bullish ? "SELL_SIDE_LIQUIDITY" : "BUY_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", sourceStructureIds: [bullish ? "mm-range-low" : "mm-range-high"], ownerTimeframe: "1h", dealingRangeId: "mm-range-1", price: bullish ? 90 : 110, status: "CONSUMED", consumedAt: ifvgIso(5), consumingCandleId: "mm-c5" },
    { ...ictFactBase("mm-displacement", "DISPLACEMENT", 15), displacementId: "mm-displacement", direction: factDirection, startCandleId: "mm-c10", endCandleId: "mm-c15", bodySize: 5, baselineBodySize: 2, bodyMultiple: 2.5, measurementPolicyId: "int-3b-fixture" },
    { ...ictFactBase("mm-mss", "MSS", 16), mssId: "mm-mss", direction: factDirection, brokenStructureId: "mm-internal-swing", breakCandleId: "mm-c16", displacementId: "mm-displacement", breakPrice: bullish ? 101 : 99 },
    { ...ictFactBase("mm-pd-array", "PD_ARRAY", 20), pdArrayId: "mm-pd-array", pdArrayType: "FVG", direction: factDirection, priceRange: bullish ? [98, 100] : [100, 102], sourceFactId: "mm-source-fvg", dealingRangeId: "mm-range-1" },
    { ...ictFactBase("mm-objective", "LIQUIDITY", 0, "1h"), liquidityId: "mm-objective", side: objectiveSide, liquidityClass: "EXTERNAL", sourceStructureIds: [bullish ? "mm-range-high" : "mm-range-low"], ownerTimeframe: "1h", dealingRangeId: "mm-range-1", price: bullish ? 120 : 80, status: "AVAILABLE" }
  ];
  const entry = bullish ? 99 : 101;
  return {
    facts,
    candlesByTimeframe: { "5m": [{ id: "mm-entry-touch", symbol: "ES", timeframe: "5m", timestamp: ifvgIso(25), open: entry, high: entry + 1, low: entry - 1, close: entry, volume: 100 }] },
    asOf: ifvgIso(25),
    sourceFingerprint: "mt5|ES|ES|5m|int-3a-1",
    narrative: { structural: factDirection, intermediate: bullish ? "bearish" : "bullish", execution: factDirection, liquidityPath: bullish ? "buyside" : "sellside", structuralTimeframe: "1h", intermediateTimeframe: "15m", executionTimeframe: "5m", policyId: "gotrader.ict.c1-1.hierarchical-roles.v1", policyVersion: "1.0.0" },
    symbol: "ES",
    timeframe: "5m"
  };
};

async function main() {
  compileForNode();
  const suite = await import(pathToFileURL(path.join(outRoot, "index.mjs")));
  const ifvgV3 = await import(pathToFileURL(path.join(outRoot, "ictIfvgFreshRetestV3.mjs")));
  const signalContract = await import(pathToFileURL(path.join(outRoot, "ictSignalContract.mjs")));
  const ict2022 = await import(pathToFileURL(path.join(outRoot, "ict2022Model.mjs")));
  const ictCollection = await import(pathToFileURL(path.join(outRoot, "ictI2Collection.mjs")));
  const marketMakerBuy = await import(pathToFileURL(path.join(outRoot, "marketMakerBuyModel.mjs")));
  const marketMakerSell = await import(pathToFileURL(path.join(outRoot, "marketMakerSellModel.mjs")));
  const realMarketMakerCollection = ({ buy = false, sell = false } = {}) => {
    const candidates = [
      ...(buy ? [marketMakerBuy.evaluateMarketMakerBuyModel(marketMakerProducerFixture("BULLISH"))] : []),
      ...(sell ? [marketMakerSell.evaluateMarketMakerSellModel(marketMakerProducerFixture("BEARISH"))] : [])
    ];
    return {
      version: "gotrader.ict-market-maker-candidates.v1",
      generatedAt: ifvgIso(25),
      sourceFingerprint: "mt5|ES|ES|5m|int-3a-1",
      frameworks: candidates.map((candidate) => candidate.context),
      candidates,
      researchValidated: false,
      authority: ictAuthority
    };
  };

  const tacticalContext = suite.buildCurrentOpportunityContext({ packet: basePacket, currentRead: baseRead });
  const tacticalScan = suite.detectCurrentOpportunities(tacticalContext);
  assert.equal(tacticalScan.summary.depthStatus, "swing_context_ready", "limited context should not pretend full 90-day validation is ready");
  assert.ok(tacticalScan.opportunities.some((item) => item.status === "near_miss" || item.status === "forming"), "one missing condition should surface forming/near-miss opportunity");
  assert.match(tacticalScan.summary.topBlocker ?? tacticalScan.summary.nextAction, /fvg|history|context|validation/i);
  const marketMapDiagnostic = tacticalScan.opportunities.find((item) => item.strategyId === "market_map_only_diagnostic_v1");
  assert.ok(marketMapDiagnostic, "scanner should still include a market-map diagnostic row");
  assertDiagnosticContextOnly(marketMapDiagnostic);
  assert.equal(tacticalScan.summary.diagnosticCount >= 1, true, "summary should count diagnostic rows");
  assertSafe(suite, tacticalScan);

  const shallowPacket = {
    ...basePacket,
    activeSource: { ...basePacket.activeSource, candleCount: 1000 },
    marketAnalysisContext: undefined
  };
  const shallowRead = {
    ...baseRead,
    analysisTimeframesUsed: ["M5"],
    missingTimeframes: ["M15", "H1", "H4", "D1", "W1"],
    availableLookbackDays: 0,
    analysisDepthStatus: "limited"
  };
  const shallowScan = suite.detectCurrentOpportunities(suite.buildCurrentOpportunityContext({ packet: shallowPacket, currentRead: shallowRead }));
  assert.ok(["tactical_only", "insufficient"].includes(shallowScan.summary.depthStatus), "latest 1000 only should be called tactical/insufficient");
  assert.equal(shallowScan.summary.rangeHistoryAvailable, false, "shallow latest window should not be labeled range history");
  assertDiagnosticContextOnly(shallowScan.opportunities.find((item) => item.strategyId === "market_map_only_diagnostic_v1"));
  assertSafe(suite, shallowScan);

  const deepRead = {
    ...baseRead,
    modelQualityLane: "approved",
    opportunityMissingEvidence: [],
    entryZone: "30500-30520",
    target: 30200,
    invalidation: 30560,
    rrEstimate: 2.4,
    confidence: 0.71,
    sessionNarrativeProfile: "consolidation_manipulation_distribution",
    sessionDirectionalRead: "bearish",
    analysisTimeframesUsed: ["W1", "D1", "H4", "H1", "M15", "M5"],
    missingTimeframes: [],
    analysisDepthStatus: "sufficient",
    availableLookbackDays: 3.59
  };
  const deepPacket = {
    ...basePacket,
    recommendedSignal: {
      ...basePacket.recommendedSignal,
      entryZone: {
        low: 30500,
        high: 30520,
        midpoint: 30510,
        type: "compact_test_entry"
      }
    },
    marketAnalysisContext: {
      analysisDepthStatus: "sufficient",
      analysisTimeframesUsed: ["W1", "D1", "H4", "H1", "M15", "M5"],
      missingTimeframes: [],
      analysisTimeframes: [
        { timeframe: "M5", candleCount: 17799, availableLookbackDays: 88.95 },
        { timeframe: "M15", candleCount: 5933, availableLookbackDays: 88.95 }
      ]
    }
  };
  const deepScan = suite.detectCurrentOpportunities(suite.buildCurrentOpportunityContext({ packet: deepPacket, currentRead: deepRead }));
  assert.equal(deepScan.summary.rangeHistoryAvailable, true, "90-day range metadata should be used");
  assert.equal(deepScan.summary.depthStatus, "validation_context_ready");
  assert.equal(deepScan.summary.validationLookbackDays, 88.95, "compact chart depth must not mask deeper validated range history");
  assert.equal(deepScan.summary.validCandidateCount, 0, "raw compact geometry must not become a valid candidate");
  assertSafe(suite, deepScan);

  const liveIfvgInput = {
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5|ES|ES|5m|int-1-1-live",
    requestedSymbol: "ES",
    brokerSymbol: "ES",
    timeframe: "5m",
    candles: liveIfvgCandles(),
    contextCandles: liveIfvgContext
  };
  const liveIfvgAssessment = ifvgV3.assessIctIfvgFreshRetestV3(liveIfvgInput);
  const liveIfvgCompact = ifvgV3.compactIctIfvgFreshRetestV3Assessment(liveIfvgAssessment);
  assert.equal(liveIfvgAssessment.candidate.strategyId, "ifvg_v1", "the actual base detector must execute");
  assert.ok(liveIfvgCompact.geometry?.actionable, "the live compact v3 assessment must retain canonical geometry");
  const liveIfvgPacket = {
    ...deepPacket,
    requestedSymbol: "ES",
    brokerSymbol: "ES",
    activeSource: {
      ...deepPacket.activeSource,
      sourceFingerprint: liveIfvgInput.sourceFingerprint,
      sourceStatus: { ...deepPacket.activeSource.sourceStatus, isProxyInstrument: false }
    },
    compactSummary: {
      ...deepPacket.compactSummary,
      ifvgFreshRetestV3: liveIfvgCompact
    }
  };
  const liveIfvgReadContext = {
    ...deepRead,
    requestedSymbol: "ES",
    brokerSymbol: "ES",
    side: "long",
    debug: { ...deepRead.debug, sourceFingerprint: liveIfvgInput.sourceFingerprint }
  };
  const liveIfvgScan = suite.detectCurrentOpportunities(
    suite.buildCurrentOpportunityContext({ packet: liveIfvgPacket, currentRead: liveIfvgReadContext })
  );
  const liveIfvgOpportunity = liveIfvgScan.opportunities.find((item) => item.strategyId === "ifvg_fresh_retest_v3_research");
  assert.equal(liveIfvgOpportunity?.status, "valid_candidate");
  assert.equal(liveIfvgOpportunity?.geometry?.geometryId, liveIfvgCompact.geometry.geometryId);
  assert.equal(liveIfvgOpportunity?.entry, liveIfvgCompact.geometry.entry.intendedPrice);
  assert.equal(liveIfvgOpportunity?.invalidation, liveIfvgCompact.geometry.stop.price);
  assert.equal(liveIfvgOpportunity?.target, liveIfvgCompact.geometry.target.price);
  assert.equal(liveIfvgOpportunity?.rrEstimate, liveIfvgCompact.geometry.theoreticalRR);

  const ict2022Short = ict2022.evaluateIct2022Model(ict2022Fixture("bearish"));
  const crossFamilyConflictPacket = {
    ...liveIfvgPacket,
    compactSummary: {
      ...liveIfvgPacket.compactSummary,
      coreIctCandidates: ictCollection.buildIctCoreCandidateCollection({
        generatedAt: ifvgIso(25),
        sourceFingerprint: liveIfvgInput.sourceFingerprint,
        candidates: [ict2022Short]
      })
    }
  };
  const crossFamilyConflictScan = suite.detectCurrentOpportunities(
    suite.buildCurrentOpportunityContext({ packet: crossFamilyConflictPacket, currentRead: liveIfvgReadContext })
  );
  const conflictActionable = crossFamilyConflictScan.canonicalCandidates.filter((candidate) => candidate.actionability);
  assert.equal(conflictActionable.length, 2, "real IFVG and ICT 2022 producers must both survive aggregation");
  assert.equal(crossFamilyConflictScan.summary.canonicalSetupConflict, "CONFLICTING_CANONICAL_SETUPS");
  assert.equal(crossFamilyConflictScan.summary.canonicalCandidateSetDisposition, "CONFLICTING_CANONICAL_SETUPS");
  assert.equal(crossFamilyConflictScan.summary.selectedCanonicalCandidateId, undefined);
  assert.equal(crossFamilyConflictScan.summary.topOpportunity, undefined);
  assert.deepEqual(conflictActionable.map((candidate) => candidate.direction), ["long", "short"]);
  assert.notEqual(conflictActionable[0].geometryId, conflictActionable[1].geometryId);
  assert.equal(conflictActionable.find((candidate) => candidate.strategyId === "ict_2022_model_v1")?.charterProfile?.charterModelNumber, 1);
  assert.equal(crossFamilyConflictScan.charterProfiles.length, 12);
  assert.equal(crossFamilyConflictScan.charterProfiles.some((profile) => profile.emitsGeometry), false);

  const ict2022Long = ict2022.evaluateIct2022Model(ict2022Fixture("bullish"));
  const sameDirectionPacket = {
    ...liveIfvgPacket,
    compactSummary: {
      ...liveIfvgPacket.compactSummary,
      coreIctCandidates: ictCollection.buildIctCoreCandidateCollection({
        generatedAt: ifvgIso(25),
        sourceFingerprint: liveIfvgInput.sourceFingerprint,
        candidates: [ict2022Long]
      })
    }
  };
  const sameDirectionScan = suite.detectCurrentOpportunities(
    suite.buildCurrentOpportunityContext({ packet: sameDirectionPacket, currentRead: liveIfvgReadContext })
  );
  const alignedActionable = sameDirectionScan.canonicalCandidates.filter((candidate) => candidate.actionability);
  assert.equal(sameDirectionScan.summary.canonicalSetupConflict, "NONE");
  assert.equal(sameDirectionScan.summary.canonicalCandidateSetDisposition, "MULTIPLE_ALIGNED_CANONICAL_SETUPS");
  assert.equal(sameDirectionScan.summary.selectedCanonicalCandidateId, undefined);
  assert.equal(alignedActionable.length, 2);
  assert.deepEqual(alignedActionable.map((candidate) => candidate.direction), ["long", "long"]);
  assert.notEqual(alignedActionable[0].geometryId, alignedActionable[1].geometryId);

  const threeFamilyAlignedPacket = {
    ...sameDirectionPacket,
    compactSummary: {
      ...sameDirectionPacket.compactSummary,
      marketMakerCandidates: realMarketMakerCollection({ buy: true })
    }
  };
  const threeFamilyAlignedScan = suite.detectCurrentOpportunities(
    suite.buildCurrentOpportunityContext({ packet: threeFamilyAlignedPacket, currentRead: liveIfvgReadContext })
  );
  const threeAligned = threeFamilyAlignedScan.canonicalCandidates.filter((candidate) => candidate.actionability);
  assert.equal(threeAligned.length, 3, "IFVG, ICT 2022, and MMBM must all survive aligned aggregation");
  assert.equal(threeFamilyAlignedScan.summary.canonicalCandidateSetDisposition, "MULTIPLE_ALIGNED_CANONICAL_SETUPS");
  assert.equal(threeFamilyAlignedScan.summary.selectedCanonicalCandidateId, undefined);
  assert.equal(new Set(threeAligned.map((candidate) => candidate.candidateId)).size, 3);
  assert.equal(new Set(threeAligned.map((candidate) => candidate.geometryId)).size, 3);
  const alignedMmbm = threeAligned.find((candidate) => candidate.strategyId === "ict_market_maker_buy_model_v1");
  assert.equal(alignedMmbm?.charterProfile?.charterModelNumber, 6);
  assert.match(alignedMmbm?.prerequisiteIdentity?.sequenceId ?? "", /^fnv1a128:/);
  assert.equal(alignedMmbm?.prerequisiteIdentity?.sequenceId, alignedMmbm?.opportunity.prerequisiteIdentity?.sequenceId);
  assert.equal(alignedMmbm?.opportunity.prerequisiteIdentity?.displacementId, "mm-displacement");

  const threeFamilyConflictPacket = {
    ...sameDirectionPacket,
    compactSummary: {
      ...sameDirectionPacket.compactSummary,
      marketMakerCandidates: realMarketMakerCollection({ sell: true })
    }
  };
  const threeFamilyConflictScan = suite.detectCurrentOpportunities(
    suite.buildCurrentOpportunityContext({ packet: threeFamilyConflictPacket, currentRead: liveIfvgReadContext })
  );
  const threeConflict = threeFamilyConflictScan.canonicalCandidates.filter((candidate) => candidate.actionability);
  assert.equal(threeConflict.length, 3);
  assert.equal(threeFamilyConflictScan.summary.canonicalSetupConflict, "CONFLICTING_CANONICAL_SETUPS");
  assert.equal(threeFamilyConflictScan.summary.selectedCanonicalCandidateId, undefined);

  const simultaneousMarketMakerPacket = {
    ...liveIfvgPacket,
    compactSummary: {
      ...liveIfvgPacket.compactSummary,
      ifvgFreshRetestV3: undefined,
      marketMakerCandidates: realMarketMakerCollection({ buy: true, sell: true })
    }
  };
  const simultaneousMarketMakerScan = suite.detectCurrentOpportunities(
    suite.buildCurrentOpportunityContext({ packet: simultaneousMarketMakerPacket, currentRead: liveIfvgReadContext })
  );
  assert.equal(simultaneousMarketMakerScan.summary.canonicalSetupConflict, "CONFLICTING_CANONICAL_SETUPS");
  assert.equal(simultaneousMarketMakerScan.summary.selectedCanonicalCandidateId, undefined);
  assert.deepEqual(
    simultaneousMarketMakerScan.canonicalCandidates.map((candidate) => candidate.charterProfile?.charterModelNumber),
    [6, 7]
  );

  const frameworkOnlyPacket = {
    ...liveIfvgPacket,
    compactSummary: {
      ...liveIfvgPacket.compactSummary,
      marketMakerCandidates: {
        ...marketMakerCollection(),
        frameworks: [{
          frameworkId: "gotrader.ict.i3.mmxm-delivery-framework.v1",
          classification: "framework_context",
          phase: "DELIVERY_SEQUENCE_FORMING",
          deliveryDirection: "BEARISH_DELIVERY",
          dealingRangeId: "range-1",
          supportingFactIds: ["range-1"], blockers: [], authority: ictAuthority
        }]
      }
    }
  };
  const frameworkOnlyScan = suite.detectCurrentOpportunities(
    suite.buildCurrentOpportunityContext({ packet: frameworkOnlyPacket, currentRead: liveIfvgReadContext })
  );
  assert.equal(frameworkOnlyScan.summary.canonicalSetupConflict, "NONE", "MMXM context must not create a false conflict");
  assert.equal(frameworkOnlyScan.opportunities.find((item) => item.strategyId === "mmxm_delivery_framework_v1")?.classification, "diagnostic");

  const blockedDirectionalContexts = ["ict_power_of_three_v1", "ict_judas_swing_v1"].map((strategyId) => ({
    ...liveIfvgOpportunity,
    id: `${strategyId}-blocked`,
    strategyId,
    candidateId: `${strategyId}-blocked`,
    side: "short",
    status: "needs_more_data",
    classification: "diagnostic",
    candidateState: "SOURCE_BLOCKED",
    actionable: false,
    geometry: undefined,
    geometryId: undefined,
    blockers: [`${strategyId.toUpperCase()}_SOURCE_BLOCKED`]
  }));
  const blockedContextSet = suite.buildCanonicalRuntimeCandidateSet({
    opportunities: [liveIfvgOpportunity, ...blockedDirectionalContexts],
    generatedAt: ifvgIso(25),
    sourceFingerprint: liveIfvgInput.sourceFingerprint,
    authority: tacticalScan.authority
  });
  assert.equal(blockedContextSet.conflict, "NONE", "source-blocked PO3/Judas must not create directional conflict");
  assert.equal(blockedContextSet.disposition, "SINGLE_ACTIONABLE_CANDIDATE");
  assert.equal(blockedContextSet.selectedCandidateId, liveIfvgOpportunity.candidateId);
  const liveIfvgCurrentRead = {
    ...liveIfvgReadContext,
    approvedStatus: "approved_research_candidate",
    modelQualityLane: "approved",
    bestSetup: "ifvg_fresh_retest_v3_research",
    side: "long",
    canonicalGeometry: liveIfvgOpportunity.geometry,
    geometryMode: "canonical",
    geometryStatus: liveIfvgOpportunity.geometry.status,
    entryReference: liveIfvgOpportunity.entry,
    invalidation: liveIfvgOpportunity.invalidation,
    target: liveIfvgOpportunity.target,
    rrEstimate: liveIfvgOpportunity.rrEstimate,
    confidence: 0.74,
    riskStatus: "allow",
    topReasons: ["Live canonical IFVG v3 candidate."],
    opportunityBlockers: [],
    opportunityMissingEvidence: [],
    currentOpportunitySummary: liveIfvgScan.summary,
    currentOpportunities: liveIfvgScan.opportunities
  };
  const liveIfvgSignal = signalContract.buildIctResearchSignalFromCurrentRead(liveIfvgCurrentRead);
  assert.equal(liveIfvgSignal.canonicalGeometryId, liveIfvgCompact.geometry.geometryId);
  assert.equal(liveIfvgSignal.entryReference, liveIfvgCompact.geometry.entry.intendedPrice);
  assert.equal(liveIfvgSignal.invalidation, liveIfvgCompact.geometry.stop.price);
  assert.equal(liveIfvgSignal.target, liveIfvgCompact.geometry.target.price);
  assert.equal(liveIfvgSignal.rrEstimate, liveIfvgCompact.geometry.theoreticalRR);
  assert.equal(liveIfvgSignal.executionAllowed, false);
  assert.deepEqual(liveIfvgSignal.authority, {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  });
  assertSafe(suite, liveIfvgScan);

  const lowRrRead = {
    ...deepRead,
    target: 30450,
    rrEstimate: 1.2
  };
  const lowRrScan = suite.detectCurrentOpportunities(suite.buildCurrentOpportunityContext({ packet: deepPacket, currentRead: lowRrRead }));
  const lowRrCandidate = lowRrScan.opportunities.find((item) => item.strategyId === "ict_cmd_short_paper_watchlist_v1");
  assert.ok(lowRrCandidate, "low-RR CMD opportunity should remain visible for diagnosis");
  assert.equal(lowRrCandidate.status, "near_miss", "source-blocked CMD remains a non-actionable research thesis");
  assert.equal(lowRrCandidate.geometry, undefined);
  assert.equal(lowRrScan.summary.validCandidateCount, 0, "low-RR opportunity must not become promotable");
  assertSafe(suite, lowRrScan);

  const detectorPacket = {
    ...deepPacket,
    detectorAssessments: {
      activeIfvgProfileId: "ifvg_fresh_retest_v3_research",
      silverBulletV1: {
        strategyId: "silver_bullet_v1",
        status: "blocked_no_context_alignment",
        side: "flat",
        timeframe: "1m",
        blockers: ["blocked_no_context_alignment"],
        missingConditions: ["context_alignment"],
        compactSummary: "Silver Bullet detector blocked: no context alignment.",
        canCreateValidationChainEntry: false
      },
      cisdV1: {
        strategyId: "cisd_v1",
        status: "candidate",
        side: "short",
        timeframe: "5m",
        entry: 30500,
        stop: 30550,
        target: 30400,
        rr: 2,
        geometry: canonicalGeometry({ strategyId: "cisd_v1", direction: "SHORT", entry: 30500, stop: 30550, target: 30400, rr: 2 }),
        blockers: [],
        missingConditions: [],
        compactSummary: "CISD detector candidate with complete geometry.",
        canCreateValidationChainEntry: true
      }
    }
  };
  const detectorScan = suite.detectCurrentOpportunities(suite.buildCurrentOpportunityContext({ packet: detectorPacket, currentRead: deepRead }));
  const blockedSilverBullet = detectorScan.opportunities.find((item) => item.strategyId === "silver_bullet_v1");
  assert.equal(blockedSilverBullet.status, "near_miss", "later Silver Bullet detector packets remain outside INT-1 runtime ownership");
  assert.equal(blockedSilverBullet.entry, undefined, "blocked detector must not inherit generic market-read entry");
  assert.equal(blockedSilverBullet.target, undefined, "blocked detector must not inherit generic market-read target");
  const cisdCandidate = detectorScan.opportunities.find((item) => item.strategyId === "cisd_v1");
  assert.equal(cisdCandidate.status, "forming", "later CISD detector packets remain diagnostic/forming in INT-1");
  assert.equal(cisdCandidate.entry, undefined);
  assert.equal(cisdCandidate.invalidation, undefined);
  assert.equal(cisdCandidate.target, undefined);
  assertSafe(suite, detectorScan);

  const tightStopPacket = {
    ...deepPacket,
    detectorAssessments: {
      activeIfvgProfileId: "ifvg_fresh_retest_v3_research",
      cisdV1: {
        strategyId: "cisd_v1",
        status: "candidate",
        side: "short",
        timeframe: "5m",
        entry: 30500,
        stop: 30500.75,
        target: 30490,
        rr: 13.3333,
        blockers: [],
        missingConditions: [],
        compactSummary: "CISD detector candidate with a sub-point stop.",
        canCreateValidationChainEntry: true
      }
    }
  };
  const tightStopScan = suite.detectCurrentOpportunities(
    suite.buildCurrentOpportunityContext({ packet: tightStopPacket, currentRead: deepRead })
  );
  const tightStopCandidate = tightStopScan.opportunities.find((item) => item.strategyId === "cisd_v1");
  assert.equal(tightStopCandidate.status, "forming", "out-of-scope raw detector geometry must remain non-actionable");
  assert.ok(tightStopCandidate.missingConditions.includes("canonical_geometry_unavailable"));
  assert.equal(tightStopCandidate.geometry, undefined, "invalid risk must not become canonical geometry");
  assert.equal(tightStopCandidate.entry, undefined, "invalid risk must not publish an entry plan");
  assert.equal(tightStopCandidate.invalidation, undefined, "invalid risk must not publish a stop plan");
  assert.equal(tightStopCandidate.target, undefined, "invalid risk must not publish a target plan");
  assert.equal(tightStopCandidate.rrEstimate, undefined, "invalid risk must not publish inflated RR");
  assert.equal(
    tightStopScan.opportunities.some((item) => item.strategyId === "cisd_v1" && item.status === "valid_candidate"),
    false
  );
  assertSafe(suite, tightStopScan);

  const v4Packet = {
    ...deepPacket,
    detectorAssessments: {
      activeIfvgProfileId: "ifvg_fresh_retest_v4_candidate",
      ifvgShallowRetestV4: {
        strategyId: "ifvg_fresh_retest_v4_candidate",
        candidate: {
          status: "candidate",
          side: "short",
          timeframe: "5m",
          entry: 30500,
          stop: 30540,
          target: 30400,
          rr: 2.5,
          blockers: [],
          missingConditions: []
        },
        eligible: true,
        geometry: canonicalGeometry({ strategyId: "ifvg_fresh_retest_v4_candidate", direction: "SHORT", entry: 30500, stop: 30540, target: 30400, rr: 2.5 }),
        blockers: [],
        nextAction: "Queue deterministic replay for the active v4 profile."
      }
    }
  };
  const v4Scan = suite.detectCurrentOpportunities(suite.buildCurrentOpportunityContext({ packet: v4Packet, currentRead: deepRead }));
  const activeV4 = v4Scan.opportunities.find((item) => item.strategyId === "ifvg_fresh_retest_v4_candidate");
  const comparativeV3 = v4Scan.opportunities.find((item) => item.strategyId === "ifvg_fresh_retest_v3_research");
  assert.equal(activeV4, undefined, "v4 research packets must not be promoted into the live v3 opportunity lane");
  assert.ok(comparativeV3, "the authoritative v3 lane remains separately identified");
  assert.equal(v4Scan.summary.validCandidateCount, 0);
  assertSafe(suite, v4Scan);

  const chasingV4Packet = {
    ...v4Packet,
    activeSource: { ...v4Packet.activeSource, currentPrice: 30520 },
    detectorAssessments: {
      ...v4Packet.detectorAssessments,
      ifvgShallowRetestV4: {
        ...v4Packet.detectorAssessments.ifvgShallowRetestV4,
        candidate: {
          ...v4Packet.detectorAssessments.ifvgShallowRetestV4.candidate,
          entry: 30500,
          stop: 30540,
          target: 30400,
          rr: 2.5
        }
      }
    }
  };
  const chasingV4Scan = suite.detectCurrentOpportunities(
    suite.buildCurrentOpportunityContext({ packet: chasingV4Packet, currentRead: deepRead })
  );
  const chasingV4 = chasingV4Scan.opportunities.find((item) => item.strategyId === "ifvg_fresh_retest_v4_candidate");
  assert.equal(chasingV4, undefined, "v4 research geometry must not enter the live opportunity path");
  assertSafe(suite, chasingV4Scan);

  const missingTargetRead = {
    ...deepRead,
    target: undefined,
    rrEstimate: undefined
  };
  const missingTargetScan = suite.detectCurrentOpportunities(suite.buildCurrentOpportunityContext({ packet: deepPacket, currentRead: missingTargetRead }));
  const missingTargetPrimary = missingTargetScan.opportunities.find((item) => item.strategyId === "ict_cmd_short_paper_watchlist_v1");
  assert.ok(missingTargetPrimary, "missing-target CMD opportunity should still be diagnosable");
  assert.notEqual(missingTargetPrimary.classification, "diagnostic", "real CMD candidate should still use trade-candidate classification");
  assert.ok(missingTargetPrimary.missingConditions.includes("target_missing"), "missing target should be explicit");
  assert.ok(missingTargetPrimary.missingConditions.includes("rr_unavailable"), "RR should be unavailable until entry/target/invalidation exist");
  assert.equal(missingTargetPrimary.blockers.includes("target_too_close"), false, "target_too_close must not appear without a target");
  assertSafe(suite, missingTargetScan);

  const mockPacket = {
    ...basePacket,
    activeSource: {
      ...basePacket.activeSource,
      provider: "mock",
      sourceStatus: {
        isMockOrSample: true,
        isResearchActive: false,
        isProxyInstrument: false,
        statusLabel: "mock/sample"
      }
    }
  };
  const mockScan = suite.detectCurrentOpportunities(suite.buildCurrentOpportunityContext({ packet: mockPacket, currentRead: deepRead }));
  assert.equal(mockScan.summary.validCandidateCount, 0, "mock/sample source cannot produce a valid candidate");
  assert.ok(mockScan.opportunities.some((item) => item.blockers.some((blocker) => /mock\/sample/i.test(blocker))));
  assertSafe(suite, mockScan);

  const packetWithSummary = {
    ...basePacket,
    compactSummary: {
      currentOpportunitySummary: tacticalScan.summary
    }
  };
  assert.equal(packetWithSummary.compactSummary.currentOpportunitySummary?.sourceProvider, "mt5_read_only", "advisor packet can carry compact opportunity summary");

  console.log(JSON.stringify({
    ok: true,
    scans: {
      tactical: tacticalScan.summary,
      shallow: shallowScan.summary,
      deep: deepScan.summary,
      mockValidCandidates: mockScan.summary.validCandidateCount
    },
    liveIfvgV3: {
      candidateId: liveIfvgCompact.candidateId,
      geometryId: liveIfvgCompact.geometry.geometryId,
      producer: {
        entry: liveIfvgCompact.geometry.entry.intendedPrice,
        stop: liveIfvgCompact.geometry.stop.price,
        target: liveIfvgCompact.geometry.target.price,
        theoreticalRR: liveIfvgCompact.geometry.theoreticalRR
      },
      currentOpportunity: {
        entry: liveIfvgOpportunity.entry,
        stop: liveIfvgOpportunity.invalidation,
        target: liveIfvgOpportunity.target,
        theoreticalRR: liveIfvgOpportunity.rrEstimate
      },
      signal: {
        entry: liveIfvgSignal.entryReference,
        stop: liveIfvgSignal.invalidation,
        target: liveIfvgSignal.target,
        theoreticalRR: liveIfvgSignal.rrEstimate
      }
    },
    crossFamily: {
      ifvg: {
        strategyId: conflictActionable[0].strategyId,
        candidateId: conflictActionable[0].candidateId,
        geometryId: conflictActionable[0].geometryId,
        direction: conflictActionable[0].direction
      },
      ict2022: {
        strategyId: conflictActionable[1].strategyId,
        candidateId: conflictActionable[1].candidateId,
        geometryId: conflictActionable[1].geometryId,
        direction: conflictActionable[1].direction
      },
      conflict: crossFamilyConflictScan.summary.canonicalSetupConflict,
      selectedCandidateId: crossFamilyConflictScan.summary.selectedCanonicalCandidateId ?? null,
      sameDirectionDisposition: sameDirectionScan.summary.canonicalCandidateSetDisposition
    },
    authority: tacticalScan.authority
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
