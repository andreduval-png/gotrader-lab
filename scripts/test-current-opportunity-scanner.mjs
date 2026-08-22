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
  { root: path.join(projectRoot, "src", "lib", "tradeGeometry"), file: "tradeGeometryTypes.ts" },
  { root: path.join(projectRoot, "src", "lib", "tradeGeometry"), file: "targetSelection.ts" },
  { root: path.join(projectRoot, "src", "lib", "tradeGeometry"), file: "canonicalTradeGeometry.ts" },
  { root: sourceRoot, file: "currentOpportunityTypes.ts" },
  { root: sourceRoot, file: "buildCurrentOpportunityContext.ts" },
  { root: ictSourceRoot, file: "ictTradeConstructionTypes.ts" },
  { root: ictSourceRoot, file: "ictTradeConstruction.ts" },
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
      .replace(/from\s+"@\/lib\/ictCanonical\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/tradeGeometry\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+"@\/lib\/tradeGeometry"/g, 'from "./canonicalTradeGeometry.mjs"');
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), dependenciesRewritten, "utf8");
  }
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

async function main() {
  compileForNode();
  const suite = await import(pathToFileURL(path.join(outRoot, "index.mjs")));

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
  assert.equal(blockedSilverBullet.status, "rejected", "detector blocker must control Silver Bullet status");
  assert.equal(blockedSilverBullet.entry, undefined, "blocked detector must not inherit generic market-read entry");
  assert.equal(blockedSilverBullet.target, undefined, "blocked detector must not inherit generic market-read target");
  const cisdCandidate = detectorScan.opportunities.find((item) => item.strategyId === "cisd_v1");
  assert.equal(cisdCandidate.status, "valid_candidate", "complete detector-owned CISD geometry should surface as a research candidate");
  assert.equal(cisdCandidate.entry, 30500);
  assert.equal(cisdCandidate.invalidation, 30550);
  assert.equal(cisdCandidate.target, 30400);
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
  assert.equal(tightStopCandidate.status, "near_miss", "raw sub-point geometry must fail closed");
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
  assert.equal(activeV4.status, "valid_candidate", "complete eligible v4 geometry should own the active IFVG research lane");
  assert.equal(activeV4.geometry?.actionable, true);
  assert.equal(activeV4.entry, 30500);
  assert.equal(activeV4.invalidation, 30540);
  assert.equal(activeV4.target, 30400);
  assert.equal(comparativeV3.classification, "diagnostic", "v3 must remain comparative context when v4 is active");
  assert.ok(v4Scan.summary.validCandidateCount >= 1);
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
  assert.equal(chasingV4.status, "valid_candidate", "downstream projection must preserve producer-owned canonical geometry");
  assert.equal(chasingV4.geometry?.geometryId, "ifvg_fresh_retest_v4_candidate-geometry-fixture");
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
    authority: tacticalScan.authority
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
