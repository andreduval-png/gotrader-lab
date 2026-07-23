#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-ifvg-selection-shadow-test");
const sourceFiles = [
  "src/lib/ict-strategy-suite/ictTradeConstructionTypes.ts",
  "src/lib/ict-strategy-suite/ictTradeConstruction.ts",
  "src/lib/ict-strategy-suite/ictIfvgTypes.ts",
  "src/lib/ict-strategy-suite/ictIfvg.ts",
  "src/lib/ict-strategy-suite/ictIfvgFreshRetestV3.ts",
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/identity/v2Identity.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/context/v2ContextTypes.ts",
  "src/lib/v2/context/v2ContextIdentity.ts",
  "src/lib/v2/context/v2ContextEligibility.ts",
  "src/lib/v2/context/v2SessionOpeningFactEngine.ts",
  "src/lib/v2/context/v2DealingRangeLiquidityFactEngine.ts",
  "src/lib/v2/context/v2DisplacementFvgFactEngine.ts",
  "src/lib/v2/context/v2HigherTimeframeBiasFactEngine.ts",
  "src/lib/v2/context/v2ContextBuilder.ts",
  "src/lib/v2/strategyAdapters/v2StrategyAdapter.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3Types.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3Identity.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3Adapter.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3LegacyObservation.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3GeometryTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3GeometryAdapter.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3LegacyGeometryObservation.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3SelectionTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3SelectionAdapter.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3LegacySelectionObservation.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3SelectionComparison.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const identity = await load("v2Identity");
const candleWindow = await load("v2CandleWindowBuilder");
const contextBuilder = await load("v2ContextBuilder");
const legacyDetector = await load("ictIfvg");
const legacyV3 = await load("ictIfvgFreshRetestV3");
const legacySelection = await load("v2IfvgV3LegacySelectionObservation");
const selectionAdapter = await load("v2IfvgV3SelectionAdapter");
const selectionComparison = await load("v2IfvgV3SelectionComparison");

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const timeframeMs = Object.freeze({
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000
});

const iso = (minute) => new Date(Date.UTC(2026, 5, 12, 13, 30 + minute)).toISOString();
const candle = (minute, open, high, low, close, volume = 100) =>
  Object.freeze({ timestamp: iso(minute), open, high, low, close, volume, closed: true });
const overlapFiller = (startMinute, count, base = 98) =>
  Array.from({ length: count }, (_, index) => {
    const open = base + (index % 3) * 0.12;
    const close = base + ((index + 1) % 3) * 0.12;
    return candle(startMinute + index * 5, open, base + 1.2, base - 1.2, close, 150 + index);
  });

const validLongCandles = () => Object.freeze([
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
]);

const noCandidateCandles = () => Object.freeze(overlapFiller(-30, 32, 100));

const endAfter = (candles) =>
  new Date(Date.parse(candles.at(-1).timestamp) + 5 * 60_000).toISOString();

const directionalContext = ({ asOf, direction }) => Object.freeze(
  Object.fromEntries(["15m", "1h", "4h", "1d"].map((timeframe, timeframeIndex) => {
    const interval = timeframeMs[timeframe];
    const base = 90 + timeframeIndex * 10;
    const rows = Array.from({ length: 12 }, (_, index) => {
      const timestamp = new Date(Date.parse(asOf) - (12 - index) * interval).toISOString();
      const signedStep = direction === "bullish" ? index : -index;
      const open = base + signedStep;
      const close = open + (direction === "bullish" ? 0.8 : -0.8);
      return Object.freeze({
        timestamp,
        open,
        high: Math.max(open, close) + 1,
        low: Math.min(open, close) - 1,
        close,
        volume: 500 + index,
        closed: true
      });
    });
    return [timeframe, Object.freeze(rows)];
  }))
);

const buildWindow = ({ source, timeframe, candles, asOf }) =>
  candleWindow.buildV2CanonicalCandleWindow({
    adapterId: "phase-3c-ifvg-selection-fixture",
    adapterVersion: "phase-3c-fixture-v1",
    asOf,
    closurePolicy: "historical_dataset",
    legacyCandles: candles,
    query: {
      source,
      timeframe,
      end: asOf,
      limit: 500,
      closedOnly: true,
      purpose: "context_shadow"
    },
    source
  });

const buildBundle = async ({
  candles,
  contextCandles,
  fingerprint,
  sourceKind = "imported_historical"
}) => {
  const source = identity.createV2SourceIdentity({
    sourceId: `fixture:USTECH:phase3c:${fingerprint}`,
    provider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    sourceFingerprint: fingerprint,
    sourceKind
  });
  const asOf = endAfter(candles);
  const primaryWindow = await buildWindow({ source, timeframe: "5m", candles, asOf });
  const htfWindows = await Promise.all(
    Object.entries(contextCandles).map(([timeframe, values]) =>
      buildWindow({ source, timeframe, candles: values, asOf })
    )
  );
  const context = await contextBuilder.buildV2CanonicalMarketContext({
    source,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    asOfMarketTime: asOf,
    requiredTimeframes: ["5m", "15m", "1h", "4h", "1d"],
    windows: [primaryWindow, ...htfWindows],
    purpose: "deterministic_fixture",
    requestedFactFamilies: ["displacement", "fair_value_gap", "higher_timeframe_bias"],
    builtAt: "2026-06-12T20:00:00.000Z"
  });
  return { context, primaryWindow };
};

const runLegacy = async ({
  candles,
  contextCandles,
  contextArtifactId,
  fingerprint,
  primaryWindowIdentityHash
}) => {
  const input = {
    candles,
    contextCandles,
    sourceProvider: "mt5_read_only",
    sourceFingerprint: fingerprint,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    generatedAt: endAfter(candles)
  };
  const candidate = legacyDetector.evaluateIctIfvg(input);
  const assessment = legacyV3.assessIctIfvgFreshRetestV3(input, candidate);
  return {
    candidate,
    assessment,
    observation: await legacySelection.buildLegacyIfvgV3SelectionObservation({
      assessment,
      candidate,
      contextArtifactId,
      primaryWindowIdentityHash
    })
  };
};

const runCanary = async ({ candles, contextCandles, fingerprint, sourceKind }) => {
  const bundle = await buildBundle({ candles, contextCandles, fingerprint, sourceKind });
  const legacy = await runLegacy({
    candles,
    contextCandles,
    contextArtifactId: bundle.context.contextArtifactId,
    fingerprint,
    primaryWindowIdentityHash: bundle.primaryWindow.identity.identityHash
  });
  const v2 = await selectionAdapter.selectV2IfvgV3ShadowCandidate(bundle);
  const comparison = await selectionComparison.compareLegacyAndV2IfvgV3Selection({
    legacy: legacy.observation,
    v2
  });
  return { bundle, legacy, v2, comparison };
};

const assertCompactSafety = (value, label) => {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /"candles"\s*:|rawCandles|rawRuntimeSnapshot|rawSnapshot|accountData|orderData|positionData|password|secret|apiKey|token|mt5Credentials|base64/i,
    `${label} must remain compact`
  );
  assert.deepEqual(value.authority, authority, `${label} authority must remain none`);
};

const longCandles = validLongCandles();
const longAsOf = endAfter(longCandles);
const bullishContext = directionalContext({ asOf: longAsOf, direction: "bullish" });
const positive = await runCanary({
  candles: longCandles,
  contextCandles: bullishContext,
  fingerprint: "mt5|MNQ|USTECH|5m|phase3c-positive"
});
assert.equal(positive.legacy.assessment.eligible, true);
assert.equal(positive.comparison.outcome, "exact_parity");
assert.equal(positive.comparison.selectedCandidateIdentityParityAchieved, true);
assert.equal(positive.comparison.selectedCandidateBlockerParityAchieved, true);
assert.equal(positive.comparison.htfAlignmentParityAchieved, true);
assert.equal(positive.comparison.volumeBlockerParityAchieved, true);
assert.equal(positive.comparison.sessionContextParityAchieved, true);
assert.equal(positive.comparison.selectedCandidateRankingParityAchieved, true);
assert.equal(positive.comparison.fullCandidateSetOrderingParityAchieved, false);
assert.equal(positive.comparison.fullStrategyParityClaimed, false);
assert.ok(positive.v2.candidates.length > 1, "positive canary must exercise candidate ranking");
assert.equal(positive.v2.candidates[0].selected, true);
assert.equal(positive.v2.candidates[0].htfAlignment, "aligned");
assert.equal(positive.v2.candidates[0].volumeContext.lowVolume, false);
assert.equal(positive.v2.candidates[0].sessionContext.id, "new_york_open");
assert.equal(positive.v2.candidates[0].canCreateValidationChainEntry, false);

const lowVolumeCandles = Object.freeze(longCandles.map((item) => Object.freeze({
  ...item,
  volume: item.timestamp === iso(70) ? 5 : 1_000
})));
const lowVolumeContext = directionalContext({
  asOf: endAfter(lowVolumeCandles),
  direction: "bullish"
});
const lowVolume = await runCanary({
  candles: lowVolumeCandles,
  contextCandles: lowVolumeContext,
  fingerprint: "mt5|MNQ|USTECH|5m|phase3c-low-volume"
});
assert.equal(lowVolume.comparison.outcome, "exact_parity");
assert.equal(lowVolume.legacy.candidate.status, "blocked_low_volume");
assert.equal(lowVolume.v2.candidates[0].volumeContext.lowVolume, true);
assert.ok(lowVolume.v2.candidates[0].rankingBlockerIds.includes("low_volume_inversion"));

const bearishContext = directionalContext({ asOf: longAsOf, direction: "bearish" });
const againstHtf = await runCanary({
  candles: longCandles,
  contextCandles: bearishContext,
  fingerprint: "mt5|MNQ|USTECH|5m|phase3c-against-htf"
});
assert.equal(againstHtf.comparison.outcome, "exact_parity");
assert.equal(againstHtf.legacy.candidate.status, "blocked_against_htf");
assert.equal(againstHtf.v2.candidates[0].htfAlignment, "against_htf");
assert.ok(againstHtf.v2.candidates[0].rankingBlockerIds.includes("against_htf"));

const flatCandles = noCandidateCandles();
const noCandidate = await runCanary({
  candles: flatCandles,
  contextCandles: directionalContext({ asOf: endAfter(flatCandles), direction: "bullish" }),
  fingerprint: "mt5|MNQ|USTECH|5m|phase3c-no-candidate"
});
assert.equal(noCandidate.legacy.candidate.status, "no_trade");
assert.equal(noCandidate.v2.selectionState, "no_candidate");
assert.equal(noCandidate.comparison.outcome, "exact_parity");
assert.equal(noCandidate.v2.candidates.length, 0);

const mismatchedWindow = Object.freeze({
  ...positive.bundle.primaryWindow,
  identity: Object.freeze({
    ...positive.bundle.primaryWindow.identity,
    identityHash: "phase3c-mismatched-window"
  })
});
const identityBlocked = await selectionAdapter.selectV2IfvgV3ShadowCandidate({
  context: positive.bundle.context,
  primaryWindow: mismatchedWindow
});
assert.equal(identityBlocked.selectionState, "blocked");
assert.equal(identityBlocked.candidates.length, 0);
assert.ok(identityBlocked.diagnostics.blockers.includes("geometry_projection_blocked"));

const alteredSelection = Object.freeze({
  ...positive.v2,
  selectedCandidateId: positive.v2.candidates[1].normalizedCandidateId,
  candidates: Object.freeze(positive.v2.candidates.map((candidate, index) => Object.freeze({
    ...candidate,
    selected: index === 1
  })))
});
const alteredComparison = await selectionComparison.compareLegacyAndV2IfvgV3Selection({
  legacy: positive.legacy.observation,
  v2: alteredSelection
});
assert.equal(alteredComparison.outcome, "regression");
assert.ok(alteredComparison.differences.includes("selected_candidate_identity_mismatch"));

const htfDriftLegacy = await runLegacy({
  candles: longCandles,
  contextCandles: bearishContext,
  contextArtifactId: positive.bundle.context.contextArtifactId,
  fingerprint: "mt5|MNQ|USTECH|5m|phase3c-positive",
  primaryWindowIdentityHash: positive.bundle.primaryWindow.identity.identityHash
});
const htfDriftComparison = await selectionComparison.compareLegacyAndV2IfvgV3Selection({
  legacy: htfDriftLegacy.observation,
  v2: positive.v2
});
assert.equal(htfDriftComparison.outcome, "regression");
assert.ok(htfDriftComparison.differences.includes("selected_candidate_htf_alignment_mismatch"));

assertCompactSafety(positive.v2, "V2 selection result");
assertCompactSafety(positive.comparison, "V2 selection comparison");
assert.ok(positive.v2.candidates.every((candidate) =>
  candidate.researchOnly === true &&
  candidate.shadowOnly === true &&
  candidate.canCreateValidationChainEntry === false
));

const hashManifest = JSON.parse(fs.readFileSync(
  path.join(workspace, "tests", "fixtures", "v2-baseline", "baseline-snapshot-hashes.json"),
  "utf8"
));
assert.equal(
  hashManifest.hashes["ifvg-v3-positive-canary.snapshot.json"],
  "1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a"
);
assert.equal(
  hashManifest.hashes["ifvg-v2-negative-control.snapshot.json"],
  "3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224"
);

const forbiddenProductionImports = [];
const scan = (directory) => {
  if (directory === path.join(workspace, "src", "lib", "v2")) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(fullPath);
    else if (
      /\.(?:ts|tsx)$/.test(entry.name) &&
      /selectV2IfvgV3ShadowCandidate|compareLegacyAndV2IfvgV3Selection/.test(fs.readFileSync(fullPath, "utf8"))
    ) {
      forbiddenProductionImports.push(path.relative(workspace, fullPath));
    }
  }
};
scan(path.join(workspace, "src"));
assert.deepEqual(forbiddenProductionImports, []);

console.log(JSON.stringify({
  status: "passed",
  phase: "3C",
  scope: "ifvg_v3_selected_candidate_ranking_and_blocker_shadow_only",
  positiveCanaryOutcome: positive.comparison.outcome,
  selectedCandidateRankingParityAchieved: positive.comparison.selectedCandidateRankingParityAchieved,
  selectedCandidateBlockerParityAchieved: positive.comparison.selectedCandidateBlockerParityAchieved,
  htfAlignmentParityAchieved: positive.comparison.htfAlignmentParityAchieved,
  volumeBlockerParityAchieved: positive.comparison.volumeBlockerParityAchieved,
  sessionContextParityAchieved: positive.comparison.sessionContextParityAchieved,
  fullCandidateSetOrderingParityAchieved: false,
  fullStrategyParityClaimed: false,
  evaluatedV2Candidates: positive.v2.candidates.length,
  selectedSession: positive.v2.candidates[0].sessionContext.id,
  lowVolumeBlockerParity: lowVolume.comparison.outcome,
  againstHtfBlockerParity: againstHtf.comparison.outcome,
  noCandidateParity: noCandidate.comparison.outcome,
  identityMismatchBlocked: identityBlocked.selectionState === "blocked",
  alteredSelectionDetected: alteredComparison.outcome === "regression",
  htfDriftDetected: htfDriftComparison.outcome === "regression",
  productionAdoptions: forbiddenProductionImports.length,
  rawCandlesSerialized: false,
  validationChainEntryCreated: false,
  frozenHashes: {
    ifvgV3: hashManifest.hashes["ifvg-v3-positive-canary.snapshot.json"],
    ifvgV2: hashManifest.hashes["ifvg-v2-negative-control.snapshot.json"]
  },
  authority
}, null, 2));
