#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourcePath = path.join(root, "src", "lib", "researchQuality", "researchQualityFailureAttribution.ts");
const outDir = path.join(root, ".gotrader", "research-quality-failure-attribution-test");
const outPath = path.join(outDir, "researchQualityFailureAttribution.mjs");

fs.mkdirSync(outDir, { recursive: true });
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    verbatimModuleSyntax: false
  },
  fileName: sourcePath
}).outputText;
fs.writeFileSync(outPath, compiled, "utf8");

const { buildResearchQualityFailureAttribution, buildValidationScenarioQualityTelemetry } =
  await import(`${pathToFileURL(outPath).href}?v=${Date.now()}`);

const trade = ({ id, r, outcome, session, qualityContext, at }) => ({
  id,
  decisionId: `decision_${id}`,
  thesisId: `thesis_${id}`,
  symbol: "MNQ",
  timeframe: "5m",
  session,
  marketRegime: "trending",
  bias: "bearish",
  confidence: 0.75,
  decisionIndex: Number(id.replace(/\D/g, "")),
  exitIndex: Number(id.replace(/\D/g, "")) + 1,
  openedAt: at,
  resolvedAt: at,
  entryZone: [100, 100],
  entryPrice: 100,
  invalidation: 101,
  target: 97,
  targetHit: outcome === "target_hit",
  stopHit: outcome === "stop_hit",
  expired: outcome === "expired",
  outcome,
  maxFavorableExcursion: 1,
  maxAdverseExcursion: 1,
  rMultiple: r,
  riskReward: 3,
  reason: "synthetic compact research outcome",
  simulatedTradePlan: {
    id: `plan_${id}`,
    symbol: "MNQ",
    timeframe: "5m",
    bias: "bearish",
    entryZone: [100, 100],
    invalidation: 101,
    targetLiquidity: 97,
    stopRiskNotes: "simulation",
    riskReward: 3,
    mode: "simulation"
  },
  agentAttribution: [],
  qualityContext
});

const trades = [
  trade({ id: "t1", r: 2, outcome: "target_hit", session: "NY AM Kill Zone", at: "2026-07-01T14:00:00.000Z" }),
  trade({
    id: "t2",
    r: -1.2,
    outcome: "stop_hit",
    session: "NY AM Kill Zone",
    at: "2026-07-02T14:00:00.000Z",
    qualityContext: { setupFamily: "ifvg", htfAlignment: "against_htf", sessionPreferred: true }
  }),
  trade({
    id: "t3",
    r: -3,
    outcome: "stop_hit",
    session: "London",
    at: "2026-07-03T08:00:00.000Z",
    qualityContext: { setupFamily: "ifvg", htfAlignment: "aligned", sessionPreferred: false }
  }),
  trade({ id: "t4", r: 5, outcome: "target_hit", session: "London", at: "2026-07-04T08:00:00.000Z" }),
  trade({ id: "t5", r: 0, outcome: "expired", session: "NY AM Kill Zone", at: "2026-07-05T14:00:00.000Z" }),
  trade({ id: "t6", r: -1, outcome: "stop_hit", session: "New York", at: "2026-07-06T17:00:00.000Z" })
];

const result = {
  config: { strategyProfile: "ifvg_fresh_retest_v3_research" },
  candles: [{ id: "must_not_serialize" }],
  decisions: [],
  skippedSignals: [{ id: "skip", reason: "diagnostic context only" }],
  trades,
  summary: {
    skipReasons: [{ reason: "diagnostic context only", count: 9 }]
  }
};

const telemetry = buildValidationScenarioQualityTelemetry(result);
assert.equal(telemetry.stopHitCount, 3, "only completed stop-hit trades count as stop hits");
assert.equal(telemetry.attributedStopHitCount, 0, "small context cohorts are not misreported as causal");
assert.equal(telemetry.unattributedStopHitCount, 3, "stops without a sufficient comparator remain honestly unattributed");
assert.equal(telemetry.contextEvaluatedStopHitCount, 2, "only stop hits carrying compact pre-entry context count as evaluated");
assert.equal(telemetry.contextEvaluationCoverage, 0.667);
assert.equal(telemetry.rejectedContexts[0].count, 9, "rejected context is retained separately");
assert.equal(
  telemetry.failureCauses.reduce((sum, item) => sum + item.stopHitCount, 0),
  3,
  "diagnostic/skipped rows cannot inflate stop-hit outcomes"
);
assert.ok(telemetry.sessionOutcomes.some((item) => item.session === "London"), "session matrix is emitted");
assert.ok(telemetry.drawdownClusters.some((item) => item.maxDrawdownR >= 4), "chronological red drawdown is detected");
assert.equal(telemetry.authority.executionAuthority, "none");
assert.equal(telemetry.authority.brokerAuthority, "none");
assert.equal(telemetry.authority.readinessOverrideAuthority, "none");

const sharedHtfTrades = Array.from({ length: 20 }, (_, index) => trade({
  id: `shared${index}`,
  r: index < 10 ? -1 : 3,
  outcome: index < 10 ? "stop_hit" : "target_hit",
  session: index % 2 ? "London" : "NY AM Kill Zone",
  at: `2026-06-${String(index + 1).padStart(2, "0")}T14:00:00.000Z`,
  qualityContext: { setupFamily: "ifvg", htfAlignment: "unavailable", sessionPreferred: index % 2 === 0 }
}));
const sharedHtfTelemetry = buildValidationScenarioQualityTelemetry({
  ...result,
  trades: sharedHtfTrades
});
assert.equal(sharedHtfTelemetry.attributedStopHitCount, 0, "HTF unavailable on winners and losers is not a causal failure");
assert.equal(sharedHtfTelemetry.contextEvaluationCoverage, 1, "shared HTF context is evaluated even though it is not causal");
assert.equal(
  sharedHtfTelemetry.contextAssociations.find((item) => item.causeCode === "missing_htf_context")?.status,
  "insufficient_comparator",
  "a universal context flag must report that no independent comparator exists"
);

const discriminatingTrades = [
  ...Array.from({ length: 10 }, (_, index) => trade({
    id: `exposed${index}`,
    r: index < 8 ? -1 : 3,
    outcome: index < 8 ? "stop_hit" : "target_hit",
    session: "Outside preferred window",
    at: `2026-05-${String(index + 1).padStart(2, "0")}T17:00:00.000Z`,
    qualityContext: { setupFamily: "ifvg", htfAlignment: "aligned", sessionPreferred: false }
  })),
  ...Array.from({ length: 10 }, (_, index) => trade({
    id: `comparator${index}`,
    r: index === 0 ? -1 : 3,
    outcome: index === 0 ? "stop_hit" : "target_hit",
    session: "Preferred window",
    at: `2026-04-${String(index + 1).padStart(2, "0")}T14:00:00.000Z`,
    qualityContext: { setupFamily: "ifvg", htfAlignment: "aligned", sessionPreferred: true }
  }))
];
const discriminatingTelemetry = buildValidationScenarioQualityTelemetry({
  ...result,
  trades: discriminatingTrades
});
const sessionAssociation = discriminatingTelemetry.contextAssociations.find(
  (item) => item.causeCode === "session_window_mismatch"
);
assert.equal(sessionAssociation?.status, "qualified_causal_hypothesis");
assert.equal(sessionAssociation?.directlyAttributed, true);
assert.equal(sessionAssociation?.exposedStopHitRate, 0.8);
assert.equal(sessionAssociation?.comparatorStopHitRate, 0.1);
assert.equal(discriminatingTelemetry.attributedStopHitCount, 8, "only exposed stopped trades receive the qualified cause");
assert.equal(discriminatingTelemetry.unattributedStopHitCount, 1, "the comparator loss remains an ordinary model loss");

const scenario = {
  id: "conservative-confluence",
  name: "Conservative confluence threshold",
  config: { strategyProfile: "ifvg_fresh_retest_v3_research" },
  qualityTelemetry: telemetry
};
const attribution = buildResearchQualityFailureAttribution({
  id: "validation_quality_fixture",
  generatedAt: "2026-07-07T00:00:00.000Z",
  provenance: {
    strategyProfile: "ifvg_fresh_retest_v3_research",
    strategyProfileVersion: "v3",
    sourceProvider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceFingerprint: "mt5_fixture_fingerprint",
    parameterFingerprint: "params_fixture"
  },
  scenarios: [scenario],
  calibration: {},
  safetyNotice: "Simulation validation only. No broker connection. No real trades."
});

assert.equal(attribution.strategyProfile, "ifvg_fresh_retest_v3_research");
assert.equal(attribution.sourceFingerprint, "mt5_fixture_fingerprint");
assert.equal(attribution.canonicalScenarioId, "conservative-confluence");
assert.ok(attribution.blockers.includes("false_positive_context_coverage_below_90_percent"));
assert.ok(attribution.blockers.includes("red_chronological_drawdown_cluster_present"));
assert.equal(attribution.topFailureCause, undefined, "small non-discriminating context must not become the top causal family");
assert.equal(attribution.safety.evidenceCreationAllowed, false);
assert.equal(attribution.safety.readinessPromotionAllowed, false);
assert.equal(attribution.safety.profileMutationAllowed, false);

const serialized = JSON.stringify(attribution);
for (const forbidden of ["candles", "entryPrice", "simulatedTradePlan", "accountData", "orderData", "positionData", "secret", "apiKey"]) {
  assert.equal(serialized.includes(`\"${forbidden}\"`), false, `${forbidden} must not be serialized`);
}

console.log(JSON.stringify({
  status: "passed",
  completedTradeCount: attribution.completedTradeCount,
  stopHitCount: attribution.stopHitCount,
  attributedStopHitCount: attribution.attributedStopHitCount,
  contextEvaluationCoverage: attribution.contextEvaluationCoverage,
  attributionCoverage: attribution.attributionCoverage,
  failureCauses: attribution.failureCauses.map((item) => ({ causeCode: item.causeCode, count: item.stopHitCount })),
  drawdownClusters: attribution.drawdownClusters.map((item) => ({ id: item.clusterId, maxDrawdownR: item.maxDrawdownR, risk: item.risk })),
  rejectedContextCount: attribution.rejectedContexts.reduce((sum, item) => sum + item.count, 0),
  authority: attribution.authority,
  safety: attribution.safety
}, null, 2));
