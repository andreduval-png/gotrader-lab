#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-ifvg-geometry-shadow-test");
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
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
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
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3GeometryComparison.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const identity = await load("v2Identity");
const repository = await load("v2StaticCandleRepository");
const contextBuilder = await load("v2ContextBuilder");
const legacyDetector = await load("ictIfvg");
const legacyV3 = await load("ictIfvgFreshRetestV3");
const geometryAdapter = await load("v2IfvgV3GeometryAdapter");
const legacyGeometry = await load("v2IfvgV3LegacyGeometryObservation");
const geometryComparison = await load("v2IfvgV3GeometryComparison");

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
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

const noRetestCandles = () => Object.freeze([
  ...overlapFiller(-30, 6, 100),
  ...overlapFiller(0, 10, 100),
  candle(50, 101, 104, 96, 97),
  candle(55, 97, 99, 95.5, 96.8),
  candle(60, 93, 94, 90, 91),
  candle(65, 91, 93.4, 90.5, 92.2),
  candle(70, 92.5, 98.6, 92.2, 98),
  ...overlapFiller(75, 10, 99)
]);

const mirrorCandles = (candles, center = 200) => Object.freeze(candles.map((item) => Object.freeze({
  ...item,
  open: center - item.open,
  high: center - item.low,
  low: center - item.high,
  close: center - item.close
})));

const contextBullish = {
  "15m": [candle(-120, 90, 93, 89, 92), candle(-105, 92, 98, 91, 97), candle(-90, 97, 102, 96, 101)],
  "1h": [candle(-240, 88, 94, 87, 93), candle(-180, 93, 103, 92, 101)]
};
const contextBearish = Object.fromEntries(
  Object.entries(contextBullish).map(([timeframe, values]) => [timeframe, mirrorCandles(values)])
);

const endAfter = (candles) =>
  new Date(Date.parse(candles.at(-1).timestamp) + 5 * 60_000).toISOString();

const buildBundle = async ({ candles, fingerprint }) => {
  const source = identity.createV2SourceIdentity({
    sourceId: `fixture:USTECH:5m:${fingerprint}`,
    provider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    sourceFingerprint: fingerprint,
    sourceKind: "imported_historical"
  });
  const asOf = endAfter(candles);
  const staticRepository = repository.createV2StaticCandleRepository({
    adapterId: "phase-3b-ifvg-geometry-fixture",
    asOf: () => asOf,
    loadSource: async () => ({
      identity: source,
      timeframe: "5m",
      candles,
      closurePolicy: "historical_dataset"
    })
  });
  const primaryWindow = await staticRepository.getWindow({
    source,
    timeframe: "5m",
    end: asOf,
    limit: 500,
    closedOnly: true,
    purpose: "context_shadow"
  });
  const context = await contextBuilder.buildV2CanonicalMarketContext({
    source,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    asOfMarketTime: asOf,
    requiredTimeframes: ["5m"],
    windows: [primaryWindow],
    purpose: "deterministic_fixture",
    requestedFactFamilies: ["displacement", "fair_value_gap"],
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
    observation: await legacyGeometry.buildLegacyIfvgV3GeometryObservation({
      assessment,
      candidate,
      contextArtifactId,
      primaryWindowIdentityHash
    })
  };
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

const findMatchingArtifact = (legacy, v2) => {
  const candidateId = legacy.artifacts[0]?.normalizedCandidateId;
  return v2.artifacts.find((artifact) => artifact.normalizedCandidateId === candidateId);
};

const longCandles = validLongCandles();
const longFingerprint = "mt5|MNQ|USTECH|5m|phase3b-long";
const longBundle = await buildBundle({ candles: longCandles, fingerprint: longFingerprint });
const longLegacy = await runLegacy({
  candles: longCandles,
  contextCandles: contextBullish,
  contextArtifactId: longBundle.context.contextArtifactId,
  fingerprint: longFingerprint,
  primaryWindowIdentityHash: longBundle.primaryWindow.identity.identityHash
});
assert.equal(longLegacy.assessment.eligible, true, "legacy positive geometry canary must remain eligible");
const longV2 = await geometryAdapter.projectV2IfvgV3GeometryShadow(longBundle);
const longMatch = findMatchingArtifact(longLegacy.observation, longV2);
assert.ok(longMatch, "V2 geometry output must include the legacy-selected detection identity");
assert.equal(longMatch.artifactState, "constructed");
assert.equal(longMatch.retest.cleanRetest, true);
assert.equal(longMatch.retest.signalFresh, true);
assert.equal(longMatch.geometry.entry, 95);
assert.equal(longMatch.geometry.invalidation, 93.9095);
assert.equal(longMatch.geometry.target, 98.6);
assert.equal(longMatch.geometry.rr, 3.3012);
assert.equal(longMatch.constructionValid, true);
assert.equal(longMatch.geometryComplete, true);
assert.equal(longMatch.canCreateValidationChainEntry, false);
const longComparison = await geometryComparison.compareLegacyAndV2IfvgV3Geometry({
  legacy: longLegacy.observation,
  v2: longV2
});
assert.equal(longComparison.outcome, "acceptable_normalized_variance");
assert.equal(longComparison.selectedCandidateGeometryParityAchieved, true);
assert.equal(longComparison.fullCandidateSelectionParityAchieved, false);
assert.equal(longComparison.fullStrategyParityClaimed, false);
assert.ok(longComparison.documentedVariances.includes("legacy_single_ranked_candidate_vs_v2_geometry_set"));

const primaryFact = longBundle.context.facts.find((fact) =>
  fact.kind === "fair_value_gap" &&
  fact.payload.state === "inverted" &&
  fact.payload.lowerBound === 94 &&
  fact.payload.upperBound === 96
);
assert.ok(primaryFact, "fixture must expose the selected canonical FVG fact");
const supportingIds = new Set(primaryFact.derivation.inputFactIds);
const focusedContext = Object.freeze({
  ...longBundle.context,
  facts: Object.freeze(longBundle.context.facts.filter((fact) =>
    fact.factId === primaryFact.factId || supportingIds.has(fact.factId)
  ))
});
const focusedV2 = await geometryAdapter.projectV2IfvgV3GeometryShadow({
  context: focusedContext,
  primaryWindow: longBundle.primaryWindow
});
const focusedComparison = await geometryComparison.compareLegacyAndV2IfvgV3Geometry({
  legacy: longLegacy.observation,
  v2: focusedV2
});
assert.equal(focusedComparison.outcome, "exact_parity");
assert.equal(focusedComparison.selectedCandidateGeometryParityAchieved, true);

const shortCandles = mirrorCandles(longCandles);
const shortFingerprint = "mt5|MNQ|USTECH|5m|phase3b-short";
const shortBundle = await buildBundle({ candles: shortCandles, fingerprint: shortFingerprint });
const shortLegacy = await runLegacy({
  candles: shortCandles,
  contextCandles: contextBearish,
  contextArtifactId: shortBundle.context.contextArtifactId,
  fingerprint: shortFingerprint,
  primaryWindowIdentityHash: shortBundle.primaryWindow.identity.identityHash
});
const shortV2 = await geometryAdapter.projectV2IfvgV3GeometryShadow(shortBundle);
const shortMatch = findMatchingArtifact(shortLegacy.observation, shortV2);
assert.ok(shortMatch, "bearish mirror must retain its selected geometry identity");
assert.equal(shortMatch.direction, "short");
assert.equal(shortMatch.artifactState, "constructed");
assert.equal(shortMatch.geometryComplete, true);

const missingRetestCandles = noRetestCandles();
const missingRetestFingerprint = "mt5|MNQ|USTECH|5m|phase3b-no-retest";
const missingRetestBundle = await buildBundle({
  candles: missingRetestCandles,
  fingerprint: missingRetestFingerprint
});
const missingRetestLegacy = await runLegacy({
  candles: missingRetestCandles,
  contextCandles: contextBullish,
  contextArtifactId: missingRetestBundle.context.contextArtifactId,
  fingerprint: missingRetestFingerprint,
  primaryWindowIdentityHash: missingRetestBundle.primaryWindow.identity.identityHash
});
const missingRetestV2 = await geometryAdapter.projectV2IfvgV3GeometryShadow(missingRetestBundle);
const missingRetestMatch = findMatchingArtifact(missingRetestLegacy.observation, missingRetestV2);
assert.ok(missingRetestMatch, "forming fixture must retain its detection identity");
assert.equal(missingRetestMatch.artifactState, "blocked");
assert.ok(missingRetestMatch.blockerIds.includes("ifvg_retest_missing"));
assert.equal(missingRetestMatch.geometry.entry, undefined);

const staleCandles = Object.freeze([...longCandles, ...overlapFiller(90, 3, 98)]);
const staleFingerprint = "mt5|MNQ|USTECH|5m|phase3b-stale";
const staleBundle = await buildBundle({ candles: staleCandles, fingerprint: staleFingerprint });
const staleLegacy = await runLegacy({
  candles: staleCandles,
  contextCandles: contextBullish,
  contextArtifactId: staleBundle.context.contextArtifactId,
  fingerprint: staleFingerprint,
  primaryWindowIdentityHash: staleBundle.primaryWindow.identity.identityHash
});
const staleV2 = await geometryAdapter.projectV2IfvgV3GeometryShadow(staleBundle);
const staleMatch = findMatchingArtifact(staleLegacy.observation, staleV2);
assert.ok(staleMatch, "stale fixture must retain its detection identity");
assert.equal(staleMatch.retest.signalFresh, false);
assert.ok(staleMatch.blockerIds.includes("stale_retest_signal"));

const mismatchedWindow = Object.freeze({
  ...longBundle.primaryWindow,
  identity: Object.freeze({
    ...longBundle.primaryWindow.identity,
    identityHash: "mismatched-window-identity"
  })
});
const identityBlocked = await geometryAdapter.projectV2IfvgV3GeometryShadow({
  context: longBundle.context,
  primaryWindow: mismatchedWindow
});
assert.equal(identityBlocked.diagnostics.status, "blocked");
assert.ok(identityBlocked.diagnostics.blockers.includes("primary_window_identity_mismatch"));
assert.equal(identityBlocked.artifacts.length, 0);

const alteredV2 = Object.freeze({
  ...focusedV2,
  artifacts: Object.freeze(focusedV2.artifacts.map((artifact) =>
    artifact.normalizedCandidateId === longLegacy.observation.artifacts[0].normalizedCandidateId
      ? Object.freeze({
          ...artifact,
          geometry: Object.freeze({
            ...artifact.geometry,
            target: artifact.geometry.target + 1
          })
        })
      : artifact
  ))
});
const alteredComparison = await geometryComparison.compareLegacyAndV2IfvgV3Geometry({
  legacy: longLegacy.observation,
  v2: alteredV2
});
assert.equal(alteredComparison.outcome, "regression");
assert.ok(alteredComparison.differences.includes("target_mismatch"));

assertCompactSafety(longV2, "V2 geometry result");
assertCompactSafety(longComparison, "V2 geometry comparison");
assert.ok(longV2.artifacts.every((artifact) =>
  artifact.researchOnly === true &&
  artifact.shadowOnly === true &&
  artifact.canCreateValidationChainEntry === false
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
      /projectV2IfvgV3GeometryShadow|compareLegacyAndV2IfvgV3Geometry/.test(fs.readFileSync(fullPath, "utf8"))
    ) {
      forbiddenProductionImports.push(path.relative(workspace, fullPath));
    }
  }
};
scan(path.join(workspace, "src"));
assert.deepEqual(forbiddenProductionImports, []);

console.log(JSON.stringify({
  status: "passed",
  phase: "3B",
  scope: "ifvg_v3_fresh_retest_and_geometry_shadow_only",
  positiveCanaryOutcome: longComparison.outcome,
  focusedCandidateOutcome: focusedComparison.outcome,
  selectedCandidateGeometryParityAchieved: longComparison.selectedCandidateGeometryParityAchieved,
  fullCandidateSelectionParityAchieved: false,
  fullStrategyParityClaimed: false,
  documentedVariances: longComparison.documentedVariances,
  expectedGeometry: {
    side: longMatch.direction,
    entry: longMatch.geometry.entry,
    invalidation: longMatch.geometry.invalidation,
    target: longMatch.geometry.target,
    rr: longMatch.geometry.rr
  },
  bullishGeometryConstructed: longMatch.artifactState === "constructed",
  bearishGeometryConstructed: shortMatch.artifactState === "constructed",
  missingRetestBlocked: missingRetestMatch.blockerIds.includes("ifvg_retest_missing"),
  staleRetestBlocked: staleMatch.blockerIds.includes("stale_retest_signal"),
  identityMismatchBlocked: identityBlocked.diagnostics.status === "blocked",
  geometryDriftDetected: alteredComparison.outcome === "regression",
  productionAdoptions: forbiddenProductionImports.length,
  rawCandlesSerialized: false,
  validationChainEntryCreated: false,
  frozenHashes: {
    ifvgV3: hashManifest.hashes["ifvg-v3-positive-canary.snapshot.json"],
    ifvgV2: hashManifest.hashes["ifvg-v2-negative-control.snapshot.json"]
  },
  authority
}, null, 2));
