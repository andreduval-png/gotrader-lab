#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const suiteRoot = path.join(projectRoot, "src", "lib", "ict-strategy-suite");
const canonicalRoot = path.join(projectRoot, "src", "lib", "ictCanonical");
const geometryRoot = path.join(projectRoot, "src", "lib", "tradeGeometry");
const outRoot = path.join(projectRoot, ".gotrader", "ict-ifvg-test");
const sourceFiles = [
  { root: canonicalRoot, file: "canonicalIctTypes.ts" },
  { root: canonicalRoot, file: "canonicalIctIdentity.ts" },
  { root: geometryRoot, file: "tradeGeometryTypes.ts" },
  { root: geometryRoot, file: "targetSelection.ts" },
  { root: geometryRoot, file: "canonicalTradeGeometry.ts" },
  { root: suiteRoot, file: "ictTradeConstructionTypes.ts" },
  { root: suiteRoot, file: "ictTradeConstruction.ts" },
  { root: suiteRoot, file: "ictIfvgProducerPolicy.ts" },
  { root: suiteRoot, file: "ictIfvgTypes.ts" },
  { root: suiteRoot, file: "ictIfvg.ts" },
  { root: suiteRoot, file: "ictIfvgFilteredV2.ts" },
  { root: suiteRoot, file: "ictDetectorCanonicalGeometry.ts" },
  { root: suiteRoot, file: "ictIfvgFreshRetestV3.ts" },
  { root: suiteRoot, file: "ictIfvgShallowRetestV4.ts" }
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
      .replace(/from\s+"@\/lib\/ictCanonical\/canonicalIctTypes"/g, 'from "./canonicalIctTypes"')
      .replace(/from\s+"@\/lib\/ictCanonical\/canonicalIctIdentity"/g, 'from "./canonicalIctIdentity"')
      .replace(/from\s+"@\/lib\/tradeGeometry\/canonicalTradeGeometry"/g, 'from "./canonicalTradeGeometry"')
      .replace(/from\s+"@\/lib\/tradeGeometry\/tradeGeometryTypes"/g, 'from "./tradeGeometryTypes"')
      .replace(/from\s+"@\/lib\/tradeGeometry\/targetSelection"/g, 'from "./targetSelection"')
      .replace(/from\s+"\.\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'\.\/([^']+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), rewritten, "utf8");
  }
}

const iso = (minute) => new Date(Date.UTC(2026, 5, 12, 13, 30 + minute)).toISOString();
const candle = (minute, open, high, low, close, volume = 100) => ({
  timestamp: iso(minute),
  open,
  high,
  low,
  close,
  volume
});

const contextBullish = {
  "15m": [candle(-120, 90, 93, 89, 92), candle(-105, 92, 98, 91, 97), candle(-90, 97, 102, 96, 101)],
  "1h": [candle(-240, 88, 94, 87, 93), candle(-180, 93, 103, 92, 101)]
};

const contextBearish = {
  "15m": [candle(-120, 110, 111, 104, 105), candle(-105, 105, 106, 99, 100), candle(-90, 100, 101, 94, 95)],
  "1h": [candle(-240, 112, 113, 103, 104), candle(-180, 104, 105, 92, 95)]
};

function filler(startMinute, count, base = 100) {
  return Array.from({ length: count }, (_, index) => {
    const value = base + Math.sin(index / 2) * 0.4;
    return candle(startMinute + index * 5, value, value + 0.8, value - 0.8, value + (index % 2 ? 0.2 : -0.2), 100 + index);
  });
}

function overlapFiller(startMinute, count, base = 98) {
  return Array.from({ length: count }, (_, index) => {
    const open = base + (index % 3) * 0.12;
    const close = base + ((index + 1) % 3) * 0.12;
    return candle(startMinute + index * 5, open, base + 1.2, base - 1.2, close, 150 + index);
  });
}

function wideOverlapFiller(startMinute, count, base = 100) {
  return Array.from({ length: count }, (_, index) => {
    const open = base + (index % 2 ? 0.4 : -0.4);
    const close = base + (index % 2 ? -0.4 : 0.4);
    return candle(startMinute + index * 5, open, base + 20, base - 80, close, 180 + index);
  });
}

function validLongIfvg() {
  return [
    ...overlapFiller(0, 10, 100),
    candle(50, 101, 104, 96, 97),
    candle(55, 97, 99, 95.5, 96.8),
    candle(60, 93, 94, 90, 91),
    candle(65, 91, 93.4, 90.5, 92.2),
    candle(70, 92.5, 98.6, 92.2, 98),
    candle(75, 97.8, 98.2, 94.8, 95.6),
    candle(80, 95.7, 99, 95.2, 98.5),
    candle(85, 98.5, 101, 98, 100),
    ...overlapFiller(90, 10, 98)
  ];
}

function validFilteredLongIfvg() {
  return [
    ...overlapFiller(-30, 6, 100),
    ...overlapFiller(0, 10, 100),
    candle(50, 101, 104, 96, 97),
    candle(55, 97, 99, 95.5, 96.8),
    candle(60, 93, 94, 90, 91),
    candle(65, 91, 93.4, 90.5, 92.2),
    candle(70, 92.5, 98.6, 92.2, 98),
    candle(75, 98, 99.2, 97.2, 98.8),
    candle(80, 98.8, 100.2, 98.2, 99.8),
    candle(85, 99.6, 100, 94.8, 95.6)
  ];
}

function validShortIfvg() {
  return [
    ...overlapFiller(0, 10, 100),
    candle(50, 99, 104, 98, 103),
    candle(55, 103, 104.5, 102, 103.5),
    candle(60, 107, 110, 106, 109),
    candle(65, 109, 110.2, 106.4, 108.2),
    candle(70, 108, 108.4, 100.8, 101.2),
    candle(75, 101, 107.2, 99.2, 105.6),
    candle(80, 105.4, 105.9, 98.4, 99.2),
    candle(85, 99, 100, 96, 97.4),
    ...overlapFiller(90, 10, 99)
  ];
}

function notInverted() {
  return [
    ...overlapFiller(0, 10, 100),
    candle(50, 101, 104, 96, 97),
    candle(55, 97, 99, 95.5, 96.8),
    candle(60, 93, 94, 90, 91),
    candle(65, 91, 93.4, 90.5, 92.2),
    ...overlapFiller(70, 14, 92)
  ];
}

function reusedBeforeInversion() {
  return [
    ...overlapFiller(0, 10, 100),
    candle(50, 101, 104, 96, 97),
    candle(55, 97, 99, 95.5, 96.8),
    candle(60, 93, 94, 90, 91),
    candle(65, 94.6, 95.2, 93.8, 94.4),
    candle(70, 92.5, 98.6, 92.2, 98),
    ...overlapFiller(75, 10, 97)
  ];
}

function noRetest() {
  return [
    ...overlapFiller(0, 10, 100),
    candle(50, 101, 104, 96, 97),
    candle(55, 97, 99, 95.5, 96.8),
    candle(60, 93, 94, 90, 91),
    candle(65, 91, 93.4, 90.5, 92.2),
    candle(70, 92.5, 98.6, 92.2, 98),
    ...overlapFiller(75, 10, 99)
  ];
}

function lowRr() {
  return [
    ...overlapFiller(0, 10, 95),
    candle(50, 96.4, 96.6, 96, 96.2),
    candle(55, 96.2, 96.4, 95.6, 96),
    candle(60, 93, 94, 90, 91),
    candle(65, 91, 93.4, 90.5, 92.2),
    candle(70, 92.5, 96.4, 92.2, 96.2),
    candle(75, 95.6, 95.8, 94.8, 95.6),
    ...overlapFiller(80, 10, 95.6)
  ];
}

function missingTarget() {
  return [
    ...wideOverlapFiller(0, 10, 100),
    candle(50, 101, 104, 96, 97),
    candle(55, 97, 99, 95.5, 96.8),
    candle(60, 93, 94, 90, 91),
    candle(65, 91, 93.4, 90.5, 92.2),
    candle(70, 92.5, 98.6, 92.2, 98),
    candle(75, 97.8, 98.2, 94.8, 95.6),
    candle(80, 95.7, 99, 95.2, 98.5),
    ...overlapFiller(85, 10, 96)
  ];
}

function lowVolume() {
  const candles = validLongIfvg();
  return candles.map((item, index) => index === 14 ? { ...item, volume: 5 } : { ...item, volume: 1000 });
}

const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const assertSafe = (value) => {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /"candles"\s*:|"rawCandles"\s*:|"rawRuntimeSnapshot"\s*:/i);
  assert.doesNotMatch(serialized, /"account(Data|Number|Id)?"\s*:|"order(Data|s|Id|Route)?"\s*:|"position(Data|s|Id)?"\s*:/i);
  assert.doesNotMatch(serialized, /"apiKey"\s*:|"token"\s*:|"password"\s*:|"secret"\s*:|"mt5Credentials"\s*:/i);
  assert.deepEqual(value.authority, authorityNone);
};

async function main() {
  compileForNode();
  const ifvg = await import(pathToFileURL(path.join(outRoot, "ictIfvg.mjs")).href);
  const filteredV2 = await import(pathToFileURL(path.join(outRoot, "ictIfvgFilteredV2.mjs")).href);
  const freshRetestV3 = await import(pathToFileURL(path.join(outRoot, "ictIfvgFreshRetestV3.mjs")).href);
  const shallowRetestV4 = await import(pathToFileURL(path.join(outRoot, "ictIfvgShallowRetestV4.mjs")).href);
  const producerPolicy = await import(pathToFileURL(path.join(outRoot, "ictIfvgProducerPolicy.mjs")).href);

  const base = {
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5|ES|ES|5m|ifvg_fixture",
    requestedSymbol: "ES",
    brokerSymbol: "ES",
    timeframe: "5m"
  };

  const mnqBase = {
    ...base,
    sourceFingerprint: "mt5|MNQ|USTECH|5m|ifvg_fixture",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH"
  };

  const long = ifvg.evaluateIctIfvg({ ...base, candles: validLongIfvg(), contextCandles: contextBullish });
  assert.equal(long.status, "replay_required");
  assert.equal(long.strategyId, "ifvg_v1");
  assert.equal(long.side, "long");
  assert.equal(long.originalFvgDirection, "bearish");
  assert.ok(long.entry);
  assert.ok(long.stop);
  assert.ok(long.target);
  assert.ok(long.rr >= 2);
  assert.equal(long.tradeConstruction.valid, true);
  assert.equal(long.tradeConstruction.entryModelType, "ifvg");
  assert.equal(long.geometryPolicyId, "ifvg_distal_edge_buffer_and_retracement_limit_v1");
  assert.equal(long.stopSource, "ifvg_distal_edge_plus_buffer");
  assert.equal(long.setupDetected, true);
  assert.equal(long.geometryEligible, true);
  assert.equal(long.entryLifecycleStatus, "waiting_for_entry");
  assert.ok(long.stop < long.ifvgBounds.low, "long IFVG stop must be below IFVG bottom");
  assert.equal(long.canCreateValidationChainEntry, true);
  assert.equal(ifvg.ictIfvgCanQueueValidation(long), true);
  assertSafe(long);

  const tightMnq = ifvg.evaluateIctIfvg({ ...mnqBase, candles: validLongIfvg(), contextCandles: contextBullish });
  assert.equal(tightMnq.setupDetected, true);
  assert.equal(tightMnq.geometryEligible, false);
  assert.equal(tightMnq.actionable, false);
  assert.equal(tightMnq.blockers.includes("STOP_DISTANCE_TOO_SMALL"), true);
  assert.equal(tightMnq.stopDistance < 4, true);
  assert.equal(tightMnq.stopSource, "ifvg_distal_edge_plus_buffer");
  assert.equal(tightMnq.stop, long.stop, "MNQ viability must not widen the source-native stop");
  assert.equal(tightMnq.target, long.target, "MNQ viability must not stretch the source-native target");
  assertSafe(tightMnq);

  assert.equal(producerPolicy.resolveIctIfvgEntryLifecycle({ side: "short", entry: 100, currentPrice: 101.29 }), "entry_missed");
  assert.equal(producerPolicy.resolveIctIfvgEntryLifecycle({ side: "short", entry: 100, currentPrice: 99 }), "waiting_for_entry");
  assert.equal(producerPolicy.resolveIctIfvgEntryLifecycle({ side: "long", entry: 100, currentPrice: 98.71 }), "entry_missed");
  assert.equal(producerPolicy.resolveIctIfvgEntryLifecycle({ side: "long", entry: 100, currentPrice: 101 }), "waiting_for_entry");
  assert.equal(producerPolicy.findIctIfvgRetracementFillOffset({
    side: "short",
    entry: 100,
    candles: [{ high: 99.5, low: 98 }, { high: 100.25, low: 99 }]
  }), 1);
  assert.equal(producerPolicy.findIctIfvgRetracementFillOffset({
    side: "long",
    entry: 100,
    candles: [{ high: 102, low: 100.5 }, { high: 101, low: 99.75 }]
  }), 1);

  const filteredLongCandles = validFilteredLongIfvg();
  const filteredLongBase = ifvg.evaluateIctIfvg({ ...base, candles: filteredLongCandles, contextCandles: contextBullish });
  const filteredLong = filteredV2.assessIctIfvgFilteredV2(
    { ...base, candles: filteredLongCandles, contextCandles: contextBullish },
    filteredLongBase
  );
  assert.equal(filteredLong.strategyId, "ifvg_filtered_v2_research");
  assert.equal(filteredLong.cleanRetest, true);
  assert.equal(filteredLong.displacementConfirmed, true);
  assert.equal(filteredLong.signalAgeBars, 0);
  assert.equal(filteredLong.signalFresh, true);
  assert.equal(filteredLong.eligible, true);
  assert.equal(filteredLong.researchOnly, true);
  assertSafe(filteredLong);

  const freshLong = freshRetestV3.assessIctIfvgFreshRetestV3(
    { ...base, candles: filteredLongCandles, contextCandles: contextBullish },
    filteredLongBase
  );
  assert.equal(freshLong.strategyId, "ifvg_fresh_retest_v3_research");
  assert.equal(freshLong.cleanRetest, true);
  assert.equal(freshLong.signalFresh, true);
  assert.equal(freshLong.eligible, true);
  assert.ok(freshLong.geometry, "live v3 assessment must attach canonical geometry");
  assert.equal(freshLong.geometry.strategyId, "ifvg_fresh_retest_v3_research");
  assert.equal(freshLong.geometry.profileId, "ifvg_fresh_retest_v3_research");
  assert.equal(freshLong.geometry.profileVersion, "v3");
  assert.equal(freshLong.geometry.candidateId, filteredLongBase.candidateId);
  assert.equal(freshLong.geometry.entry.intendedPrice, filteredLongBase.entry);
  assert.equal(freshLong.geometry.stop.price, filteredLongBase.stop);
  assert.equal(freshLong.geometry.target.price, filteredLongBase.target);
  assert.ok(Math.abs(freshLong.geometry.theoreticalRR - filteredLongBase.rr) < 0.0001);
  assert.equal(freshLong.geometry.status, "VALID_ACTIONABLE");
  assert.equal(freshLong.geometry.actionable, true);
  assertSafe(freshLong);
  const compactFreshLong = freshRetestV3.compactIctIfvgFreshRetestV3Assessment(freshLong);
  assert.equal(compactFreshLong.strategyId, "ifvg_fresh_retest_v3_research");
  assert.equal(compactFreshLong.candidateId, filteredLongBase.candidateId);
  assert.equal(compactFreshLong.geometryPolicyId, "ifvg_distal_edge_buffer_and_retracement_limit_v1");
  assert.equal(compactFreshLong.canCreateValidationChainEntry, true);
  assert.equal(compactFreshLong.sourceFingerprint, base.sourceFingerprint);
  assert.equal(compactFreshLong.geometry?.geometryId, freshLong.geometry.geometryId);
  assert.equal(compactFreshLong.actionable, true);
  assert.doesNotMatch(JSON.stringify(compactFreshLong), /"candles"\s*:|"rawCandles"\s*:|"retestCandle"\s*:/i);
  assertSafe(compactFreshLong);

  const mnqBoundaryCandidate = (riskDistance) => ({
    ...filteredLongBase,
    candidateId: `${filteredLongBase.candidateId}|mnq|${riskDistance}`,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    sourceFingerprint: `${mnqBase.sourceFingerprint}|${riskDistance}`,
    entry: 100,
    stop: 100 - riskDistance,
    target: 110,
    rr: Number((10 / riskDistance).toFixed(4)),
    stopDistance: riskDistance,
    blockers: riskDistance < 4 ? ["STOP_DISTANCE_TOO_SMALL"] : [],
    missingConditions: riskDistance < 4 ? ["source-native stop below minimum"] : [],
    geometryEligible: riskDistance >= 4,
    canCreateValidationChainEntry: riskDistance >= 4,
    tradeConstruction: {
      ...filteredLongBase.tradeConstruction,
      entry: 100,
      stop: 100 - riskDistance,
      target: 110,
      riskDistance,
      rewardDistance: 10,
      theoreticalRR: Number((10 / riskDistance).toFixed(4)),
      valid: riskDistance >= 4,
      blockers: riskDistance < 4 ? ["stop_too_tight"] : []
    }
  });
  const boundaryInput = { ...mnqBase, candles: filteredLongCandles, contextCandles: contextBullish };
  const belowBoundary = freshRetestV3.assessIctIfvgFreshRetestV3(boundaryInput, mnqBoundaryCandidate(3.999));
  const exactBoundary = freshRetestV3.assessIctIfvgFreshRetestV3(boundaryInput, mnqBoundaryCandidate(4));
  const aboveBoundary = freshRetestV3.assessIctIfvgFreshRetestV3(boundaryInput, mnqBoundaryCandidate(4.001));
  assert.equal(belowBoundary.geometry, undefined, "3.999-point MNQ stop must remain blocked");
  assert.equal(exactBoundary.geometry?.riskDistance, 4, "4.000-point MNQ stop must pass unchanged");
  assert.equal(exactBoundary.geometry?.actionable, true);
  assert.ok(Math.abs(aboveBoundary.geometry?.riskDistance - 4.001) < 1e-9, "4.001-point MNQ stop must pass unchanged");

  const lowRrCandidate = {
    ...mnqBoundaryCandidate(5),
    candidateId: `${filteredLongBase.candidateId}|mnq|low-rr`,
    target: 105,
    rr: 1,
    blockers: ["RR_BELOW_MINIMUM"],
    missingConditions: ["minimum reward-to-risk not met"],
    canCreateValidationChainEntry: false
  };
  const lowRrAssessment = freshRetestV3.assessIctIfvgFreshRetestV3(boundaryInput, lowRrCandidate);
  assert.equal(lowRrAssessment.geometry?.status, "VALID_BELOW_RR_THRESHOLD");
  assert.equal(lowRrAssessment.geometry?.actionable, false);
  assert.equal(lowRrAssessment.geometry?.entry.intendedPrice, 100);
  assert.equal(lowRrAssessment.geometry?.stop.price, 95);
  assert.equal(lowRrAssessment.geometry?.target.price, 105);

  const missedCandidate = {
    ...mnqBoundaryCandidate(5),
    candidateId: `${filteredLongBase.candidateId}|mnq|entry-missed`,
    entryLifecycleStatus: "entry_missed",
    entryMissedAt: filteredLongBase.currentMarketTimestamp,
    blockers: ["ENTRY_MISSED"],
    missingConditions: ["retracement entry was missed"],
    canCreateValidationChainEntry: false
  };
  const missedAssessment = freshRetestV3.assessIctIfvgFreshRetestV3(boundaryInput, missedCandidate);
  assert.equal(missedAssessment.geometry?.entry.lifecycleStatus, "ENTRY_MISSED");
  assert.equal(missedAssessment.geometry?.status, "ENTRY_MISSED");
  assert.equal(missedAssessment.geometry?.actionable, false);
  assert.equal(missedAssessment.geometry?.target, undefined, "missed entries must not project a plan target");

  const bounds = filteredLongBase.ifvgBounds;
  assert.ok(bounds, "fixture must include IFVG bounds");
  const zoneSize = bounds.high - bounds.low;
  const shallowCandidate = {
    ...filteredLongBase,
    retestCandle: {
      ...filteredLongBase.retestCandle,
      low: bounds.high - zoneSize * 0.6,
      close: Math.max(filteredLongBase.retestCandle.close, bounds.midpoint)
    }
  };
  const shallowV4 = shallowRetestV4.assessIctIfvgShallowRetestV4(
    { ...base, candles: filteredLongCandles, contextCandles: contextBullish },
    shallowCandidate
  );
  assert.equal(shallowV4.strategyId, "ifvg_fresh_retest_v4_candidate");
  assert.equal(shallowV4.baseV3Eligible, true);
  assert.equal(shallowV4.shallowRetest, true);
  assert.equal(shallowV4.eligible, true);
  assert.equal(shallowV4.paperDemoEligible, false);
  assertSafe(shallowV4);

  const deepCandidate = {
    ...filteredLongBase,
    retestCandle: {
      ...filteredLongBase.retestCandle,
      low: bounds.high - zoneSize * 0.9,
      close: Math.max(filteredLongBase.retestCandle.close, bounds.midpoint)
    }
  };
  const deepV4 = shallowRetestV4.assessIctIfvgShallowRetestV4(
    { ...base, candles: filteredLongCandles, contextCandles: contextBullish },
    deepCandidate
  );
  assert.equal(deepV4.eligible, false);
  assert.equal(deepV4.blockers.includes("shallow_retest_depth_required"), true);
  assertSafe(deepV4);

  const staleFilteredCandles = [...filteredLongCandles, ...overlapFiller(90, 3, 98)];
  const staleFilteredBase = ifvg.evaluateIctIfvg({ ...base, candles: staleFilteredCandles, contextCandles: contextBullish });
  const staleFiltered = filteredV2.assessIctIfvgFilteredV2(
    { ...base, candles: staleFilteredCandles, contextCandles: contextBullish },
    staleFilteredBase
  );
  assert.equal(staleFiltered.signalFresh, false);
  assert.ok((staleFiltered.signalAgeBars ?? 0) > 0);
  assert.equal(staleFiltered.eligible, false);
  assert.ok(staleFiltered.blockers.includes("stale_retest_signal"));
  assertSafe(staleFiltered);
  const staleFreshV3 = freshRetestV3.assessIctIfvgFreshRetestV3(
    { ...base, candles: staleFilteredCandles, contextCandles: contextBullish },
    staleFilteredBase
  );
  assert.equal(staleFreshV3.geometry?.actionable, false, "stale v3 context must not carry plan-actionable geometry");
  assert.equal(staleFreshV3.eligible, false);
  assert.ok(staleFreshV3.blockers.includes("stale_retest_signal"));
  assertSafe(staleFreshV3);

  const postEntryConfirmationOnly = filteredV2.assessIctIfvgFilteredV2(
    { ...base, candles: validLongIfvg(), contextCandles: contextBullish },
    long
  );
  assert.equal(postEntryConfirmationOnly.postInversionDeliveryConfirmed, false);
  assert.equal(postEntryConfirmationOnly.eligible, false);
  assert.ok(postEntryConfirmationOnly.blockers.includes("pre_retest_displacement_confirmation_required"));
  assertSafe(postEntryConfirmationOnly);

  const short = ifvg.evaluateIctIfvg({ ...base, candles: validShortIfvg(), contextCandles: contextBearish, timeframe: "15m" });
  assert.equal(short.status, "replay_required");
  assert.equal(short.side, "short");
  assert.equal(short.originalFvgDirection, "bullish");
  assert.ok(short.rr >= 2);
  assert.equal(short.tradeConstruction.valid, true);
  assert.ok(short.stop > short.ifvgBounds.high, "short IFVG stop must be above IFVG top");
  assertSafe(short);

  const filteredShort = filteredV2.assessIctIfvgFilteredV2(
    { ...base, candles: validShortIfvg(), contextCandles: contextBearish, timeframe: "15m" },
    short
  );
  assert.equal(filteredShort.cleanRetest, false);
  assert.equal(filteredShort.displacementConfirmed, false);
  assert.equal(filteredShort.eligible, false);
  assert.ok(filteredShort.blockers.includes("clean_retest_required"));
  assert.ok(filteredShort.blockers.includes("pre_retest_displacement_confirmation_required"));
  assertSafe(filteredShort);

  const blockedHtf = ifvg.evaluateIctIfvg({ ...base, candles: validLongIfvg(), contextCandles: contextBearish });
  assert.equal(blockedHtf.status, "blocked_against_htf");
  assert.match(blockedHtf.blockers.join(" "), /HTF/i);
  assertSafe(blockedHtf);

  const unavailableHtf = ifvg.evaluateIctIfvg({ ...base, candles: validLongIfvg() });
  assert.equal(unavailableHtf.status, "replay_required");
  assert.equal(unavailableHtf.htfAlignment, "unavailable");
  assert.match(unavailableHtf.warnings.join(" "), /HTF context unavailable/i);
  assertSafe(unavailableHtf);

  const notFullyInverted = ifvg.evaluateIctIfvg({ ...base, candles: notInverted(), contextCandles: contextBullish });
  assert.equal(notFullyInverted.status, "blocked_not_inverted");
  assert.match(notFullyInverted.blockers.join(" "), /never fully inverted/i);
  assertSafe(notFullyInverted);

  const reused = ifvg.evaluateIctIfvg({ ...base, candles: reusedBeforeInversion(), contextCandles: contextBullish });
  assert.equal(reused.status, "blocked_reused_ifvg");
  assert.match(reused.blockers.join(" "), /already used/i);
  assertSafe(reused);

  const missingRetest = ifvg.evaluateIctIfvg({ ...base, candles: noRetest(), contextCandles: contextBullish });
  assert.equal(missingRetest.status, "blocked_no_retest");
  assert.match(missingRetest.blockers.join(" "), /retest/i);
  assert.ok(missingRetest.blockers.includes("entry_missing"));
  assert.ok(missingRetest.blockers.includes("invalidation_missing"));
  assertSafe(missingRetest);

  const noTarget = ifvg.evaluateIctIfvg({ ...base, candles: missingTarget(), contextCandles: contextBullish });
  assert.equal(noTarget.status, "blocked_rr");
  assert.ok(noTarget.blockers.includes("target_missing"));
  assert.ok(noTarget.blockers.includes("rr_unavailable"));
  assert.ok(!noTarget.blockers.includes("target_too_close"));
  assertSafe(noTarget);

  const rr = ifvg.evaluateIctIfvg({ ...base, candles: lowRr(), contextCandles: contextBullish });
  assert.equal(rr.status, "blocked_rr");
  assert.match(rr.blockers.join(" "), /2R|liquidity|rr_below_minimum|target_too_close/i);
  assertSafe(rr);

  const lowVol = ifvg.evaluateIctIfvg({ ...base, candles: lowVolume(), contextCandles: contextBullish });
  assert.equal(lowVol.status, "blocked_low_volume");
  assert.match(lowVol.blockers.join(" "), /low-volume/i);
  assertSafe(lowVol);

  const mock = ifvg.evaluateIctIfvg({ ...base, sourceProvider: "mock", candles: validLongIfvg(), contextCandles: contextBullish });
  assert.equal(mock.status, "blocked_mock_source");
  assert.equal(mock.canCreateValidationChainEntry, false);
  assertSafe(mock);

  const unsupported = ifvg.evaluateIctIfvg({ ...base, timeframe: "1m", candles: validLongIfvg(), contextCandles: contextBullish });
  assert.equal(unsupported.status, "needs_more_data");
  assert.match(unsupported.blockers.join(" "), /5m or 15m/i);
  assertSafe(unsupported);

  const report = {
    status: "passed",
    longStatus: long.status,
    shortStatus: short.status,
    htfBlockStatus: blockedHtf.status,
    missingHtfWarningStatus: unavailableHtf.status,
    notInvertedStatus: notFullyInverted.status,
    reusedStatus: reused.status,
    noRetestStatus: missingRetest.status,
    missingTargetStatus: noTarget.status,
    lowRrStatus: rr.status,
    lowVolumeStatus: lowVol.status,
    mockStatus: mock.status,
    filteredV2: {
      longEligible: filteredLong.eligible,
      shortEligible: filteredShort.eligible,
      researchOnly: filteredLong.researchOnly
    },
    freshRetestV3: {
      longEligible: freshLong.eligible,
      staleBlocked: !staleFreshV3.eligible,
      researchOnly: freshLong.researchOnly
    },
    shallowRetestV4: {
      shallowEligible: shallowV4.eligible,
      deepBlocked: !deepV4.eligible,
      paperDemoEligible: shallowV4.paperDemoEligible,
      researchOnly: shallowV4.researchOnly
    },
    mnqTightStopRegression: {
      candidateId: tightMnq.candidateId,
      entry: tightMnq.entry,
      stop: tightMnq.stop,
      target: tightMnq.target,
      stopDistance: tightMnq.stopDistance,
      rr: tightMnq.rr,
      stopSource: tightMnq.stopSource,
      blockers: tightMnq.blockers
    },
    authority: authorityNone,
    safety: {
      rawCandlesSerialized: false,
      accountOrderPositionSerialized: false,
      secretsSerialized: false
    }
  };
  assertSafe(report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`ICT IFVG tests failed: ${error?.stack ?? error?.message ?? error}`);
  process.exitCode = 1;
});
