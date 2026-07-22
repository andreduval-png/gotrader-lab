#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { compileTypescriptModules } from "./compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-baseline-snapshot-test");
const fixtureRoot = path.join(workspace, "tests", "fixtures", "v2-baseline");
const sourceRoot = path.join(workspace, "src", "lib");
const writeMode = process.argv.includes("--write");
const sourceCommit = "f6dbe33489a122d36995c5eb260d763917d186b3";

const sourceFiles = [
  "strategyLibrary/strategyLibraryTypes.ts",
  "strategyLibrary/strategyRegistry.ts",
  "v2Baseline/baselineTypes.ts",
  "v2Baseline/baselineSafetyAssertions.ts",
  "v2Baseline/normalizeBaselineSnapshot.ts",
  "v2Baseline/strategyBaselineManifest.ts",
  "ict-strategy-suite/ictTradeConstructionTypes.ts",
  "ict-strategy-suite/ictTradeConstruction.ts",
  "ict-strategy-suite/ictIfvgTypes.ts",
  "ict-strategy-suite/ictIfvg.ts",
  "ict-strategy-suite/ictIfvgFilteredV2.ts",
  "ict-strategy-suite/ictIfvgFreshRetestV3.ts"
].map((file) => path.join(sourceRoot, file));

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const iso = (minute) => new Date(Date.UTC(2026, 5, 12, 13, 30 + minute)).toISOString();
const candle = (minute, open, high, low, close, volume = 100) => ({
  timestamp: iso(minute), open, high, low, close, volume
});

const overlapFiller = (startMinute, count, base = 98) =>
  Array.from({ length: count }, (_, index) => {
    const open = base + (index % 3) * 0.12;
    const close = base + ((index + 1) % 3) * 0.12;
    return candle(startMinute + index * 5, open, base + 1.2, base - 1.2, close, 150 + index);
  });

const validFilteredLongIfvg = () => [
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

const noRetest = () => [
  ...overlapFiller(0, 10, 100),
  candle(50, 101, 104, 96, 97),
  candle(55, 97, 99, 95.5, 96.8),
  candle(60, 93, 94, 90, 91),
  candle(65, 91, 93.4, 90.5, 92.2),
  candle(70, 92.5, 98.6, 92.2, 98),
  ...overlapFiller(75, 10, 99)
];

const contextBullish = {
  "15m": [candle(-120, 90, 93, 89, 92), candle(-105, 92, 98, 91, 97), candle(-90, 97, 102, 96, 101)],
  "1h": [candle(-240, 88, 94, 87, 93), candle(-180, 93, 103, 92, 101)]
};

const contextBearish = {
  "15m": [candle(-120, 110, 111, 104, 105), candle(-105, 105, 106, 99, 100), candle(-90, 100, 101, 94, 95)],
  "1h": [candle(-240, 112, 113, 103, 104), candle(-180, 104, 105, 92, 95)]
};

const compactGeometry = (candidate) => candidate.entry && candidate.stop && candidate.target && candidate.rr
  ? { side: candidate.side, entry: candidate.entry, stop: candidate.stop, target: candidate.target, rr: candidate.rr }
  : undefined;

const fixtureIdentity = (fixtureId, strategyId, profileVersion, classification, values) => ({
  fixtureId,
  strategyId,
  profileVersion,
  classification,
  sourceProvider: "mt5_read_only",
  sourceFingerprint: "mt5|MNQ|USTECH|5m|ifvg_fixture",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframeSet: ["5m", "15m", "1h"],
  dataWindowStart: values[0]?.timestamp ?? null,
  dataWindowEnd: values.at(-1)?.timestamp ?? null,
  lastClosedCandle: values.at(-1)?.timestamp ?? null,
  detectorVersion: profileVersion,
  sourceCommit,
  parameterFingerprint: `${strategyId}|default_frozen_parameters`,
  costModel: "historical_audit_cost_model; additional_0.5R sensitivity where stated"
});

const makeFixture = ({ identity, resultType, detectionState, lifecycleState, blockers, geometry, replay, oos, notes }) => ({
  schemaVersion: "gotrader-v2-baseline-fixture-v1",
  identity,
  expectedResultType: resultType,
  expectedDetectionState: detectionState,
  expectedResearchLifecycleState: lifecycleState,
  expectedBlockers: blockers,
  ...(geometry ? { expectedTradeGeometry: geometry } : {}),
  ...(replay ? { expectedReplaySummary: replay } : {}),
  ...(oos ? { expectedOosSummary: oos } : {}),
  provenanceNotes: notes,
  authority
});

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function buildSnapshots() {
  compileTypescriptModules({ files: sourceFiles, outRoot });
  const importModule = (file) => import(pathToFileURL(path.join(outRoot, file)).href);
  const ifvg = await importModule("ictIfvg.mjs");
  const filteredV2 = await importModule("ictIfvgFilteredV2.mjs");
  const freshV3 = await importModule("ictIfvgFreshRetestV3.mjs");
  const manifestModule = await importModule("strategyBaselineManifest.mjs");
  const normalizeModule = await importModule("normalizeBaselineSnapshot.mjs");
  const safetyModule = await importModule("baselineSafetyAssertions.mjs");

  const base = {
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5|MNQ|USTECH|5m|ifvg_fixture",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m"
  };
  const validCandles = validFilteredLongIfvg();
  const baseCandidate = ifvg.evaluateIctIfvg({ ...base, candles: validCandles, contextCandles: contextBullish });
  const validV3 = freshV3.assessIctIfvgFreshRetestV3(
    { ...base, candles: validCandles, contextCandles: contextBullish },
    baseCandidate
  );
  assert.equal(validV3.eligible, true, "Positive canary fixture must remain eligible for replay validation.");

  const formingCandles = noRetest();
  const formingBase = ifvg.evaluateIctIfvg({ ...base, candles: formingCandles, contextCandles: contextBullish });
  const formingV3 = freshV3.assessIctIfvgFreshRetestV3(
    { ...base, candles: formingCandles, contextCandles: contextBullish },
    formingBase
  );
  assert.equal(formingV3.eligible, false);

  const rejectedBase = ifvg.evaluateIctIfvg({ ...base, candles: validCandles, contextCandles: contextBearish });
  const rejectedV3 = freshV3.assessIctIfvgFreshRetestV3(
    { ...base, candles: validCandles, contextCandles: contextBearish },
    rejectedBase
  );
  assert.equal(rejectedV3.eligible, false);

  const v2 = filteredV2.assessIctIfvgFilteredV2(
    { ...base, candles: validCandles, contextCandles: contextBullish },
    baseCandidate
  );

  const v3Fixtures = [
    makeFixture({
      identity: fixtureIdentity("ifvg_v3_valid", "ifvg_fresh_retest_v3_research", "v3", "positive_canary", validCandles),
      resultType: "trade_candidate",
      detectionState: "trade_plan_constructed",
      lifecycleState: "evidence_building",
      blockers: validV3.blockers,
      geometry: compactGeometry(baseCandidate),
      replay: {
        historicalReference: "docs/ifvg-fresh-retest-v3-validation-audit.md",
        sourceFingerprintRecordedInAudit: false,
        completedResearchTrades: 172,
        targetFirstRate: 0.5523,
        averageR: 2.805,
        profitFactor: 5.979,
        maximumDrawdownR: 8.966,
        uniqueTradingDates: 95,
        positiveRollingWindows: 11,
        totalRollingWindows: 11
      },
      oos: {
        verdict: "passed",
        windowsPassed: 2,
        totalWindows: 2,
        trades: 64,
        uniqueDates: 34,
        averageR: 3.458,
        profitFactor: 8.081,
        additionalHalfRCostAverageR: 2.958,
        authorityCreated: false
      },
      notes: [
        "Detector geometry is generated from the bounded deterministic fixture in this script.",
        "Historical replay/OOS metrics are transcribed from the committed validation audit; that audit did not record its source fingerprint.",
        "The positive canary remains research-only and is not a readiness or execution claim."
      ]
    }),
    makeFixture({
      identity: fixtureIdentity("ifvg_v3_forming", "ifvg_fresh_retest_v3_research", "v3", "positive_canary", formingCandles),
      resultType: "forming_candidate",
      detectionState: "forming",
      lifecycleState: "replay_required",
      blockers: formingV3.blockers,
      notes: ["No clean current retest exists; the fixture must not create a validation-chain entry."]
    }),
    makeFixture({
      identity: fixtureIdentity("ifvg_v3_rejected", "ifvg_fresh_retest_v3_research", "v3", "positive_canary", validCandles),
      resultType: "rejected_trade_candidate",
      detectionState: "rejected",
      lifecycleState: "replay_required",
      blockers: rejectedV3.blockers,
      notes: ["Opposing higher-timeframe context remains an explicit blocker."]
    })
  ];

  const v2Fixtures = [
    makeFixture({
      identity: fixtureIdentity("ifvg_v2_negative_control", "ifvg_filtered_v2_research", "v2", "negative_control", validCandles),
      resultType: "trade_candidate",
      detectionState: v2.eligible ? "trade_plan_constructed" : "rejected",
      lifecycleState: "replay_required",
      blockers: v2.blockers,
      geometry: compactGeometry(baseCandidate),
      replay: {
        currentWindowCandidates: 16,
        currentWindowTargetFirstRate: 0.6875,
        currentWindowUniqueDates: 15,
        independentWindowCandidates: 6,
        independentWindowTargetFirstRate: 0.3333,
        independentWindowInvalidationFirstRate: 0.6667
      },
      oos: { verdict: "insufficient_data", independentBehavior: "degraded", promotionAllowed: false },
      notes: [
        "Independent-window behavior is transcribed from docs/ifvg-v2-causal-validation-audit.md.",
        "A locally valid detector candidate does not convert this negative control into a positive model."
      ]
    })
  ];

  const catalogSnapshot = {
    schemaVersion: "gotrader-v2-strategy-catalog-baseline-v1",
    sourceCommit,
    entries: manifestModule.STRATEGY_BASELINE_MANIFEST.map((entry) => ({
      strategyId: entry.strategyId,
      profileVersion: entry.profileVersion,
      classification: entry.classification,
      detectorStatus: entry.detectorStatus,
      currentResearchStatus: entry.currentResearchStatus,
      baselineFixtureIds: entry.baselineFixtureIds,
      authority: entry.authority
    })),
    authority
  };

  const snapshots = {
    "ifvg-v3-positive-canary.snapshot.json": v3Fixtures,
    "ifvg-v2-negative-control.snapshot.json": v2Fixtures,
    "strategy-catalog-behavior.snapshot.json": catalogSnapshot
  };

  const serialized = {};
  for (const [name, value] of Object.entries(snapshots)) {
    const payloads = Array.isArray(value) ? value : [value];
    payloads.forEach((payload, index) => safetyModule.assertCompactBaselineArtifact(payload, `${name}[${index}]`));
    serialized[name] = normalizeModule.canonicalSerializeBaselineSnapshot(value);
  }
  return serialized;
}

const first = await buildSnapshots();
const second = await buildSnapshots();
assert.deepEqual(second, first, "Two consecutive in-memory generations must be byte-stable.");
fs.mkdirSync(fixtureRoot, { recursive: true });
const readCanonicalText = (filePath) => fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");

for (const [name, value] of Object.entries(first)) {
  const fixturePath = path.join(fixtureRoot, name);
  if (writeMode) {
    fs.writeFileSync(fixturePath, value, "utf8");
  } else {
    assert.equal(readCanonicalText(fixturePath), value, `${name} drifted from the preserved baseline.`);
  }
}

const hashes = Object.fromEntries(Object.entries(first).map(([name, value]) => [name, sha256(value)]));
const hashPayload = `${JSON.stringify({ schemaVersion: "gotrader-v2-baseline-hashes-v1", hashes }, null, 2)}\n`;
const hashPath = path.join(fixtureRoot, "baseline-snapshot-hashes.json");
if (writeMode) {
  fs.writeFileSync(hashPath, hashPayload, "utf8");
} else {
  assert.equal(readCanonicalText(hashPath), hashPayload, "Baseline snapshot hash manifest drifted.");
}

console.log(JSON.stringify({
  status: writeMode ? "written" : "passed",
  generationCount: 2,
  byteStable: true,
  fixtureCount: Object.keys(first).length,
  hashes,
  authority
}, null, 2));
