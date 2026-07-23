#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-ifvg-shadow-test");
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
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3Comparison.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const identity = await load("v2Identity");
const repository = await load("v2StaticCandleRepository");
const contextBuilder = await load("v2ContextBuilder");
const legacyDetector = await load("ictIfvg");
const legacyV3 = await load("ictIfvgFreshRetestV3");
const adapter = await load("v2IfvgV3Adapter");
const legacyObservation = await load("v2IfvgV3LegacyObservation");
const comparator = await load("v2IfvgV3Comparison");

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

const mirrorCandles = (candles, center = 200) => Object.freeze(candles.map((item) => Object.freeze({
  ...item,
  open: center - item.open,
  high: center - item.low,
  low: center - item.high,
  close: center - item.close
})));

const noGapCandles = () => Object.freeze(Array.from({ length: 30 }, (_, index) => {
  const base = 100 + (index % 4) * 0.1;
  return candle(index * 5, base, base + 1, base - 1, base + 0.05, 100 + index);
}));

const contextBullish = {
  "15m": [candle(-120, 90, 93, 89, 92), candle(-105, 92, 98, 91, 97), candle(-90, 97, 102, 96, 101)],
  "1h": [candle(-240, 88, 94, 87, 93), candle(-180, 93, 103, 92, 101)]
};
const contextBearish = Object.fromEntries(
  Object.entries(contextBullish).map(([timeframe, values]) => [timeframe, mirrorCandles(values)])
);

const endAfter = (candles) =>
  new Date(Date.parse(candles.at(-1).timestamp) + 5 * 60_000).toISOString();

const buildContext = async ({ candles, fingerprint }) => {
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
    adapterId: "phase-3a-ifvg-shadow-fixture",
    asOf: () => asOf,
    loadSource: async () => ({
      identity: source,
      timeframe: "5m",
      candles,
      closurePolicy: "historical_dataset"
    })
  });
  const window = await staticRepository.getWindow({
    source,
    timeframe: "5m",
    end: asOf,
    limit: 500,
    closedOnly: true,
    purpose: "context_shadow"
  });
  return contextBuilder.buildV2CanonicalMarketContext({
    source,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    asOfMarketTime: asOf,
    requiredTimeframes: ["5m"],
    windows: [window],
    purpose: "deterministic_fixture",
    requestedFactFamilies: ["displacement", "fair_value_gap"],
    builtAt: "2026-06-12T20:00:00.000Z"
  });
};

const runLegacy = async ({ candles, contextCandles, contextArtifactId, fingerprint }) => {
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
    observation: await legacyObservation.buildLegacyIfvgV3DetectionObservation({
      assessment,
      candidate,
      contextArtifactId
    })
  };
};

const detectedArtifacts = (result) =>
  result.artifacts.filter((artifact) => artifact.detectionFlowState === "inversion_confirmed");

const compactSafety = (value, label) => {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /"candles"\s*:|rawCandles|rawRuntimeSnapshot|rawSnapshot|accountData|orderData|positionData|password|secret|apiKey|token|mt5Credentials|base64/i,
    `${label} must remain compact`
  );
  assert.doesNotMatch(serialized, /"entry"\s*:|"stop"\s*:|"target"\s*:|"rr"\s*:/i, `${label} must not contain trade geometry`);
  assert.deepEqual(value.authority, authority, `${label} authority must remain none`);
};

const longCandles = validLongCandles();
const longFingerprint = "mt5|MNQ|USTECH|5m|phase3a-long";
const longContext = await buildContext({ candles: longCandles, fingerprint: longFingerprint });
const longLegacy = await runLegacy({
  candles: longCandles,
  contextCandles: contextBullish,
  contextArtifactId: longContext.contextArtifactId,
  fingerprint: longFingerprint
});
assert.equal(longLegacy.assessment.eligible, true, "positive legacy IFVG v3 canary must remain valid");
const longV2 = await adapter.detectV2IfvgV3Shadow(longContext);
const longDetected = detectedArtifacts(longV2);
assert.ok(longDetected.some((artifact) => artifact.direction === "long"), "V2 must detect the bullish IFVG direction");
assert.ok(longDetected.every((artifact) => artifact.causalClosedCandleTime === artifact.ifvgReference.inversionTime));
assert.equal(longV2.diagnostics.status, "insufficient_data");
assert.ok(longV2.diagnostics.limitations.includes("pre_inversion_usage_history_unavailable"));
const longComparison = await comparator.compareLegacyAndV2IfvgV3Detection({
  legacy: longLegacy.observation,
  v2: longV2
});
if (process.argv.includes("--diagnostic")) {
  console.error(JSON.stringify({
    legacyCandidate: longLegacy.observation.artifacts.map((artifact) => ({
      normalizedCandidateId: artifact.normalizedCandidateId,
      direction: artifact.direction,
      confirmationCandleTime: artifact.fvgReference.confirmationCandleTime,
      inversionTime: artifact.ifvgReference?.inversionTime,
      semanticIdentityHash: artifact.fvgReference.semanticIdentityHash
    })),
    v2Candidates: detectedArtifacts(longV2).map((artifact) => ({
      normalizedCandidateId: artifact.normalizedCandidateId,
      direction: artifact.direction,
      confirmationCandleTime: artifact.fvgReference.confirmationCandleTime,
      inversionTime: artifact.ifvgReference?.inversionTime,
      semanticIdentityHash: artifact.fvgReference.semanticIdentityHash
    })),
    comparison: longComparison
  }, null, 2));
}
assert.equal(
  longComparison.outcome,
  "v2_only",
  "full context must expose the selected-candidate ambiguity instead of hiding the extra inversion"
);
assert.equal(longComparison.detectionParityAchieved, false);
assert.equal(longComparison.fullStrategyParityClaimed, false);

const shortCandles = mirrorCandles(longCandles);
const shortFingerprint = "mt5|MNQ|USTECH|5m|phase3a-short";
const shortContext = await buildContext({ candles: shortCandles, fingerprint: shortFingerprint });
const shortLegacy = await runLegacy({
  candles: shortCandles,
  contextCandles: contextBearish,
  contextArtifactId: shortContext.contextArtifactId,
  fingerprint: shortFingerprint
});
const shortV2 = await adapter.detectV2IfvgV3Shadow(shortContext);
assert.ok(detectedArtifacts(shortV2).some((artifact) => artifact.direction === "short"));
assert.equal(shortLegacy.candidate.side, "short");

const emptyCandles = noGapCandles();
const emptyFingerprint = "mt5|MNQ|USTECH|5m|phase3a-empty";
const emptyContext = await buildContext({ candles: emptyCandles, fingerprint: emptyFingerprint });
const emptyLegacy = await runLegacy({
  candles: emptyCandles,
  contextCandles: {},
  contextArtifactId: emptyContext.contextArtifactId,
  fingerprint: emptyFingerprint
});
const emptyV2 = await adapter.detectV2IfvgV3Shadow(emptyContext);
const emptyComparison = await comparator.compareLegacyAndV2IfvgV3Detection({
  legacy: emptyLegacy.observation,
  v2: emptyV2
});
assert.equal(detectedArtifacts(emptyV2).length, 0);
assert.equal(emptyComparison.outcome, "exact_parity", "no-IFVG fixture should have exact detection parity");

const primaryInvertedFact = longContext.facts.find((fact) =>
  fact.kind === "fair_value_gap" &&
  fact.payload.state === "inverted" &&
  fact.payload.lowerBound === 94 &&
  fact.payload.upperBound === 96
);
assert.ok(primaryInvertedFact, "fixture must expose its canonical inverted FVG fact");
const supportingIds = new Set(primaryInvertedFact.derivation.inputFactIds);
const focusedFacts = longContext.facts.filter((fact) =>
  fact.factId === primaryInvertedFact.factId || supportingIds.has(fact.factId)
);
const focusedContext = Object.freeze({ ...longContext, facts: Object.freeze(focusedFacts) });
const focusedV2 = await adapter.detectV2IfvgV3Shadow(focusedContext);
assert.equal(detectedArtifacts(focusedV2).length, 1);
assert.equal(detectedArtifacts(focusedV2)[0].fvgReference.factId, primaryInvertedFact.factId);
const focusedComparison = await comparator.compareLegacyAndV2IfvgV3Detection({
  legacy: longLegacy.observation,
  v2: focusedV2
});
assert.equal(
  focusedComparison.outcome,
  "insufficient_comparison_data",
  "matching inversion identity must remain blocked until pre-inversion use history is available"
);

const lifecycleContext = (state, extras = {}) => Object.freeze({
  ...focusedContext,
  facts: Object.freeze(focusedContext.facts.map((fact) =>
    fact.kind === "fair_value_gap"
      ? Object.freeze({
          ...fact,
          ...extras,
          payload: Object.freeze({
            ...fact.payload,
            state,
            ...(state === "inverted" ? {} : { inversionTime: undefined })
          })
        })
      : fact
  ))
});
for (const state of ["fresh", "touched", "partially_filled", "filled"]) {
  const result = await adapter.detectV2IfvgV3Shadow(lifecycleContext(state));
  assert.equal(detectedArtifacts(result).length, 0, `${state} FVG must not become an IFVG detection`);
  assert.ok(result.artifacts.some((artifact) => artifact.artifactState === "rejected"));
}
const invalidated = await adapter.detectV2IfvgV3Shadow(lifecycleContext("invalidated"));
assert.ok(invalidated.artifacts.some((artifact) =>
  artifact.artifactState === "expired" && artifact.detectionFlowState === "invalidated"
));
const stale = await adapter.detectV2IfvgV3Shadow(lifecycleContext("inverted", {
  expiresAt: "2026-06-12T15:00:00.000Z"
}));
assert.ok(stale.artifacts.some((artifact) => artifact.artifactState === "expired"));

const blockedContext = Object.freeze({
  ...focusedContext,
  diagnostics: Object.freeze({ ...focusedContext.diagnostics, status: "blocked", blockers: ["fixture_context_blocked"] })
});
const blocked = await adapter.detectV2IfvgV3Shadow(blockedContext);
assert.equal(blocked.diagnostics.status, "blocked");
assert.ok(blocked.diagnostics.blockers.includes("context_blocked"));

const mockContext = Object.freeze({
  ...focusedContext,
  identity: Object.freeze({
    ...focusedContext.identity,
    source: Object.freeze({ ...focusedContext.identity.source, sourceKind: "mock_sample" })
  })
});
const mock = await adapter.detectV2IfvgV3Shadow(mockContext);
assert.equal(mock.diagnostics.status, "blocked");
assert.ok(mock.diagnostics.blockers.includes("mock_sample_source_not_eligible"));

const reordered = await adapter.detectV2IfvgV3Shadow(Object.freeze({
  ...longContext,
  facts: Object.freeze([...longContext.facts].reverse())
}));
assert.deepEqual(
  reordered.artifacts.map((artifact) => artifact.artifactId),
  longV2.artifacts.map((artifact) => artifact.artifactId),
  "fact ordering must not change deterministic artifacts"
);

const duplicateFact = Object.freeze({ ...primaryInvertedFact, factId: `${primaryInvertedFact.factId}:duplicate` });
const ambiguousContext = Object.freeze({
  ...focusedContext,
  facts: Object.freeze([...focusedContext.facts, duplicateFact])
});
const ambiguous = await adapter.detectV2IfvgV3Shadow(ambiguousContext);
assert.equal(ambiguous.diagnostics.status, "insufficient_data");
assert.ok(ambiguous.diagnostics.limitations.includes("multiple_inverted_fvg_selection_requires_legacy_geometry"));

const mismatchedLegacy = Object.freeze({
  ...longLegacy.observation,
  sourceFingerprint: "different-source"
});
const mismatch = await comparator.compareLegacyAndV2IfvgV3Detection({
  legacy: mismatchedLegacy,
  v2: longV2
});
assert.equal(mismatch.outcome, "regression");
assert.ok(mismatch.differences.includes("source_fingerprint_mismatch"));

compactSafety(longV2, "V2 IFVG shadow result");
compactSafety(longComparison, "V2 IFVG comparison report");
assert.ok(longV2.artifacts.every((artifact) => artifact.shadowOnly === true));

const v3SnapshotPath = path.join(workspace, "tests", "fixtures", "v2-baseline", "ifvg-v3-positive-canary.snapshot.json");
const v2SnapshotPath = path.join(workspace, "tests", "fixtures", "v2-baseline", "ifvg-v2-negative-control.snapshot.json");
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
const negativeControl = JSON.parse(fs.readFileSync(v2SnapshotPath, "utf8"));
assert.ok(negativeControl.payload.every((fixture) => fixture.identity.classification === "negative_control"));
assert.ok(negativeControl.payload.every((fixture) => fixture.expectedResearchLifecycleState !== "paper_demo_candidate"));

const forbiddenProductionImports = [];
const scan = (directory) => {
  if (directory === path.join(workspace, "src", "lib", "v2")) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(fullPath);
    else if (/\.(?:ts|tsx)$/.test(entry.name) && /V2IfvgV3Adapter|detectV2IfvgV3Shadow/.test(fs.readFileSync(fullPath, "utf8"))) {
      forbiddenProductionImports.push(path.relative(workspace, fullPath));
    }
  }
};
scan(path.join(workspace, "src"));
assert.deepEqual(forbiddenProductionImports, []);

const output = {
  status: "passed",
  phase: "3A",
  scope: "ifvg_v3_detection_parity_only",
  bullishDetection: detectedArtifacts(longV2).some((artifact) => artifact.direction === "long"),
  bearishDetection: detectedArtifacts(shortV2).some((artifact) => artifact.direction === "short"),
  noIfvgParity: emptyComparison.outcome,
  positiveCanaryOutcome: longComparison.outcome,
  focusedCandidateOutcome: focusedComparison.outcome,
  positiveCanaryLimitations: [
    "multiple_inverted_fvg_selection_requires_legacy_geometry",
    "pre_inversion_usage_history_unavailable"
  ],
  detectionParityAchieved: longComparison.detectionParityAchieved,
  fullStrategyParityClaimed: false,
  negativeControlPreserved: true,
  productionAdoptions: forbiddenProductionImports.length,
  rawCandlesSerialized: false,
  tradeGeometrySerialized: false,
  frozenHashes: {
    ifvgV3: hashManifest.hashes["ifvg-v3-positive-canary.snapshot.json"],
    ifvgV2: hashManifest.hashes["ifvg-v2-negative-control.snapshot.json"]
  },
  authority
};
console.log(JSON.stringify(output, null, 2));
