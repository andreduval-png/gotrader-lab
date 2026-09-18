#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, ".gotrader", "int-3a-core-model-tests");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const files = [
  ["src/lib/ictCanonical/canonicalIctIdentity.ts", "canonicalIctIdentity.mjs"],
  ["src/lib/ictCanonical/canonicalIctTypes.ts", "canonicalIctTypes.mjs"],
  ["src/lib/tradeGeometry/tradeGeometryTypes.ts", "tradeGeometryTypes.mjs"],
  ["src/lib/tradeGeometry/targetSelection.ts", "targetSelection.mjs"],
  ["src/lib/tradeGeometry/canonicalTradeGeometry.ts", "canonicalTradeGeometry.mjs"],
  ["src/lib/tradeGeometry/entryLifecycle.ts", "entryLifecycle.mjs"],
  ["src/lib/tradeGeometry/strategyGeometryIntent.ts", "strategyGeometryIntent.mjs"],
  ["src/lib/ictI2/ictI2Types.ts", "ictI2Types.mjs"],
  ["src/lib/ictI2/ictI2Shared.ts", "ictI2Shared.mjs"],
  ["src/lib/ictI2/ict2022Model.ts", "ict2022Model.mjs"],
  ["src/lib/ictI2/ictPowerOfThreeModel.ts", "ictPowerOfThreeModel.mjs"],
  ["src/lib/ictI2/ictJudasSwingModel.ts", "ictJudasSwingModel.mjs"],
  ["src/lib/ictI2/ictI2Collection.ts", "ictI2Collection.mjs"],
  ["src/lib/ictCharterProfiles/ictCharterProfileTypes.ts", "ictCharterProfileTypes.mjs"],
  ["src/lib/ictCharterProfiles/ictCharterProfileRuntime.ts", "ictCharterProfileRuntime.mjs"],
  ["src/lib/currentOpportunity/currentOpportunityTypes.ts", "currentOpportunityTypes.mjs"],
  ["src/lib/currentOpportunity/canonicalRuntimeCandidateSet.ts", "canonicalRuntimeCandidateSet.mjs"],
  ["src/lib/currentOpportunity/detectCurrentOpportunities.ts", "detectCurrentOpportunities.mjs"]
];

for (const [sourceName, outputName] of files) {
  const source = fs.readFileSync(path.join(root, sourceName), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove }
  }).outputText
    .replace(/from\s+["']@\/lib\/ictCanonical\/canonicalIctIdentity["']/g, 'from "./canonicalIctIdentity.mjs"')
    .replace(/from\s+["']@\/lib\/ictCanonical\/canonicalIctTypes["']/g, 'from "./canonicalIctTypes.mjs"')
    .replace(/from\s+["']@\/lib\/tradeGeometry\/tradeGeometryTypes["']/g, 'from "./tradeGeometryTypes.mjs"')
    .replace(/from\s+["']@\/lib\/tradeGeometry\/targetSelection["']/g, 'from "./targetSelection.mjs"')
    .replace(/from\s+["']@\/lib\/tradeGeometry\/canonicalTradeGeometry["']/g, 'from "./canonicalTradeGeometry.mjs"')
    .replace(/from\s+["']@\/lib\/tradeGeometry\/entryLifecycle["']/g, 'from "./entryLifecycle.mjs"')
    .replace(/from\s+["']@\/lib\/tradeGeometry\/strategyGeometryIntent["']/g, 'from "./strategyGeometryIntent.mjs"')
    .replace(/from\s+["']@\/lib\/ictI2\/([^"']+)["']/g, (_match, name) => `from "./${name}.mjs"`)
    .replace(/from\s+["']\.\/ictCharterProfileTypes["']/g, 'from "./ictCharterProfileTypes.mjs"')
    .replace(/from\s+["']\.\.\/ictCharterProfiles["']/g, 'from "./ictCharterProfileRuntime.mjs"')
    .replace(/from\s+["']\.\.\/tradeGeometry\/canonicalTradeGeometry["']/g, 'from "./canonicalTradeGeometry.mjs"')
    .replace(/from\s+["']\.\/currentOpportunityTypes["']/g, 'from "./currentOpportunityTypes.mjs"');
  const runtimeRewritten = js.replace(/from\s+["']\.\/canonicalRuntimeCandidateSet["']/g, 'from "./canonicalRuntimeCandidateSet.mjs"');
  fs.writeFileSync(path.join(out, outputName), runtimeRewritten, "utf8");
}

const model2022 = await import(`${pathToFileURL(path.join(out, "ict2022Model.mjs")).href}?v=${Date.now()}`);
const po3 = await import(`${pathToFileURL(path.join(out, "ictPowerOfThreeModel.mjs")).href}?v=${Date.now()}`);
const judas = await import(`${pathToFileURL(path.join(out, "ictJudasSwingModel.mjs")).href}?v=${Date.now()}`);
const collection = await import(`${pathToFileURL(path.join(out, "ictI2Collection.mjs")).href}?v=${Date.now()}`);
const currentOpportunity = await import(`${pathToFileURL(path.join(out, "detectCurrentOpportunities.mjs")).href}?v=${Date.now()}`);

const authority = {
  executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none",
  productionAdoptionAllowed: false, canCreateEvidence: false, canApproveReadiness: false,
  canApplyCalibration: false, canCreateTradeIntent: false
};
const at = (minute) => new Date(Date.UTC(2026, 0, 5, 14, minute)).toISOString();
const factBase = (factId, factType, minute, timeframe = "5m") => ({
  factId, factType, symbol: "NQ", timeframe, occurredAt: at(minute), confirmedAt: at(minute), validFrom: at(minute),
  state: "ACTIVE", lineage: { sourceCandleIds: [`c${minute}`], sourceFactIds: [], sourceFingerprint: "fixture-source", policyId: "fixture", policyVersion: "1" }, authority
});
const narrative = (direction) => ({
  structural: direction, intermediate: direction === "bullish" ? "bearish" : "bullish", execution: direction === "bullish" ? "bearish" : "bullish",
  liquidityPath: direction === "bullish" ? "buyside" : "sellside", structuralTimeframe: "1h", intermediateTimeframe: "15m", executionTimeframe: "5m",
  policyId: "gotrader.ict.c1-1.hierarchical-roles.v1", policyVersion: "1.0.0"
});

const ictFixture = (direction = "bullish", targetPrice = direction === "bullish" ? 112 : 89) => {
  const long = direction === "bullish";
  const facts = [
    { ...factBase("target", "LIQUIDITY", 0, "1h"), liquidityId: "target-liquidity", side: long ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", sourceStructureIds: ["target-swing"], ownerTimeframe: "1h", price: targetPrice, status: "AVAILABLE" },
    { ...factBase("draw", "DRAW_ON_LIQUIDITY", 0, "1h"), drawId: "primary-draw", direction, targetLiquidityId: "target-liquidity", targetClass: "EXTERNAL", ownerTimeframe: "1h", distance: 10, structuralRelevance: 75, available: true, consumed: false, selectionPolicyVersion: "1", nearestLiquidityId: "target-liquidity" },
    { ...factBase("raid", "LIQUIDITY", 5, "15m"), liquidityId: "raid-liquidity", side: long ? "SELL_SIDE_LIQUIDITY" : "BUY_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", sourceStructureIds: ["raid-swing"], ownerTimeframe: "15m", price: long ? 95 : 105, status: "CONSUMED", consumedAt: at(5), consumingCandleId: "c5" },
    { ...factBase("displacement", "DISPLACEMENT", 10), displacementId: "displacement", direction, startCandleId: "c5", endCandleId: "c10", bodySize: 4, baselineBodySize: 2, bodyMultiple: 2, measurementPolicyId: "fixture" },
    { ...factBase("mss", "MSS", 15), mssId: "mss", direction, brokenStructureId: "swing", breakCandleId: "c15", displacementId: "displacement", breakPrice: 100 },
    { ...factBase("fvg", "FVG", 20), fvgId: "fvg", direction, proximalPrice: long ? 100 : 101, distalPrice: long ? 101 : 100, midpoint: 100.5, originCandleIds: ["c10", "c15", "c20"], fvgState: "OPEN", filledPercentage: 0 }
  ];
  return {
    facts, candlesByTimeframe: { "5m": [{ id: "retrace", symbol: "NQ", timeframe: "5m", timestamp: at(25), open: 101, high: 101.2, low: 100.4, close: 100.8, volume: 100 }] },
    asOf: at(25), sourceFingerprint: "fixture-source", narrative: narrative(direction), symbol: "NQ", timeframe: "5m"
  };
};

for (const direction of ["bullish", "bearish"]) {
  const result = model2022.evaluateIct2022Model(ictFixture(direction));
  assert.equal(result.state, "ACTIVE");
  assert.equal(result.direction, direction === "bullish" ? "long" : "short");
  assert.equal(result.canonicalGeometry.strategyId, "ict_2022_model_v1");
  assert.equal(result.canonicalGeometry.entry.intendedPrice, 100.5);
  assert.equal(result.canonicalGeometry.stop.price, direction === "bullish" ? 95 : 105);
  assert.equal(result.canonicalGeometry.target.price, direction === "bullish" ? 112 : 89);
  assert.equal(result.canonicalGeometry.geometryId, result.canonicalGeometry.geometryId);
}

const ict2022Freeze = model2022.evaluateIct2022Model(ictFixture("bearish"));
assert.equal(ict2022Freeze.canonicalGeometry.entry.intendedPrice, 100.5);
assert.equal(ict2022Freeze.canonicalGeometry.stop.price, 105);
assert.equal(ict2022Freeze.canonicalGeometry.target.price, 89);
assert(Math.abs(ict2022Freeze.canonicalGeometry.theoreticalRR - (11.5 / 4.5)) < 1e-12);

const lowRr = model2022.evaluateIct2022Model(ictFixture("bullish", 102));
assert.equal(lowRr.canonicalGeometry.status, "VALID_BELOW_RR_THRESHOLD");
assert.equal(lowRr.canonicalGeometry.target.price, 102, "native target must not stretch for R:R");
assert.equal(lowRr.actionable, false);

const missed = ictFixture("bullish");
missed.candlesByTimeframe["5m"] = [{ ...missed.candlesByTimeframe["5m"][0], id: "passed", low: 104, high: 106, close: 105 }];
assert.equal(model2022.evaluateIct2022Model(missed).state, "ENTRY_MISSED");

const consumed = ictFixture();
consumed.facts[0].status = "CONSUMED";
consumed.facts[0].consumedAt = at(22);
assert.equal(model2022.evaluateIct2022Model(consumed).state, "TARGET_CONSUMED");

const future = ictFixture();
future.candlesByTimeframe["5m"].push({ ...future.candlesByTimeframe["5m"][0], id: "future", timestamp: at(55), high: 120, low: 80 });
assert.deepEqual(model2022.evaluateIct2022Model(future), model2022.evaluateIct2022Model(ictFixture()), "fixed asOf must ignore future candles");

const po3Facts = [
  { ...factBase("range", "DEALING_RANGE", 0, "15m"), dealingRangeId: "range-1", highSwingId: "high", lowSwingId: "low", highPrice: 105, lowPrice: 95, equilibrium: 100, context: "balanced_range" },
  { ...factBase("manipulation", "LIQUIDITY", 5, "15m"), liquidityId: "manipulation", side: "SELL_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", sourceStructureIds: ["low"], ownerTimeframe: "15m", dealingRangeId: "range-1", price: 94, status: "CONSUMED", consumedAt: at(5), consumingCandleId: "c5" },
  { ...factBase("po3-displacement", "DISPLACEMENT", 10), displacementId: "po3-displacement", direction: "bullish", startCandleId: "c5", endCandleId: "c10", bodySize: 5, baselineBodySize: 2, bodyMultiple: 2.5, measurementPolicyId: "fixture" },
  { ...factBase("po3-mss", "MSS", 15), mssId: "po3-mss", direction: "bullish", brokenStructureId: "high", breakCandleId: "c15", displacementId: "po3-displacement", breakPrice: 103 }
];
const shared = { candlesByTimeframe: {}, asOf: at(25), sourceFingerprint: "fixture-source", narrative: narrative("bullish"), symbol: "NQ", timeframe: "5m" };
const po3Result = po3.evaluateIctPowerOfThree({ ...shared, facts: po3Facts });
assert.equal(po3Result.state, "SOURCE_BLOCKED");
assert.equal(po3Result.geometryEligible, false);
assert(po3Result.blockers.includes("PO3_TARGET_PRECEDENCE_SOURCE_BLOCKED"));

const judasResult = judas.evaluateIctJudasSwing({ ...shared, facts: [] });
assert.equal(judasResult.state, "SOURCE_BLOCKED");
assert.equal(judasResult.canonicalGeometry, undefined);

const long = model2022.evaluateIct2022Model(ictFixture("bullish"));
const short = model2022.evaluateIct2022Model(ictFixture("bearish"));
const conflict = collection.buildIctCoreCandidateCollection({ generatedAt: at(25), sourceFingerprint: "fixture-source", candidates: [long, short] });
assert.equal(conflict.candidates.length, 2);
assert.equal(conflict.conflict, "CONFLICTING_CANONICAL_SETUPS");

const opportunityContext = (coreIctCandidates) => ({
  generatedAt: at(25), requestedSymbol: "NQ", brokerSymbol: "USTECH", primaryTimeframe: "5m",
  contextTimeframes: ["1h", "15m", "5m"], sourceProvider: "mt5_read_only", sourceFingerprint: "fixture-source",
  isMockOrSample: false, isResearchActive: true, isProxyInstrument: true,
  opportunityBlockers: [], opportunityMissingEvidence: [], topReasons: [], confidence: 0.8,
  timeframeRoleSummary: [
    { timeframe: "H1", role: "structural", status: "loaded" },
    { timeframe: "M15", role: "intermediate", status: "loaded" },
    { timeframe: "M5", role: "execution", status: "loaded" }
  ],
  coreIctCandidates, analysisTimeframesUsed: ["H1", "M15", "M5"], missingTimeframes: [],
  sourceDepth: {
    tacticalLatestCandleCount: 1000, sessionContextAvailable: true, swingContextDays: 90,
    validationLookbackDays: 90, validationContextAvailable: true, rangeHistoryAvailable: true,
    analysisDepthStatus: "sufficient", depthPolicyStatus: "validation_context_ready", depthWarnings: []
  }
});
const conflictScan = currentOpportunity.detectCurrentOpportunities(opportunityContext(conflict));
assert.equal(conflictScan.summary.canonicalSetupConflict, "CONFLICTING_CANONICAL_SETUPS");
assert.equal(conflictScan.summary.topOpportunity, undefined);
assert.deepEqual(
  conflictScan.opportunities.slice(0, 2).map((candidate) => [candidate.candidateId, candidate.geometry?.geometryId]),
  [[long.candidateId, long.canonicalGeometry.geometryId], [short.candidateId, short.canonicalGeometry.geometryId]]
);

const sameDirection = collection.buildIctCoreCandidateCollection({ generatedAt: at(25), sourceFingerprint: "fixture-source", candidates: [long, { ...long, candidateId: `${long.candidateId}-second` }] });
const sameDirectionScan = currentOpportunity.detectCurrentOpportunities(opportunityContext(sameDirection));
assert.equal(sameDirectionScan.summary.canonicalSetupConflict, "NONE");
assert.equal(sameDirectionScan.opportunities.filter((candidate) => candidate.strategyId === "ict_2022_model_v1").length, 2);

console.log(JSON.stringify({
  status: "passed",
  ict2022Directions: 2,
  ict2022Freeze: {
    entry: ict2022Freeze.canonicalGeometry.entry.intendedPrice,
    stop: ict2022Freeze.canonicalGeometry.stop.price,
    target: ict2022Freeze.canonicalGeometry.target.price,
    theoreticalRR: ict2022Freeze.canonicalGeometry.theoreticalRR
  },
  po3: po3Result.state,
  judas: judasResult.state,
  conflict: conflict.conflict
}, null, 2));
