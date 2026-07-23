#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const outRoot = path.join(workspace, ".gotrader", "v2-ifvg-live-shadow-test");
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
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3SelectionComparison.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3LiveShadowTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3LiveShadowCollector.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3LiveShadowLedger.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3LiveShadowValidation.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const identity = await load("v2Identity");
const candleWindow = await load("v2CandleWindowBuilder");
const contextBuilder = await load("v2ContextBuilder");
const legacyDetector = await load("ictIfvg");
const legacyV3 = await load("ictIfvgFreshRetestV3");
const legacySelection = await load("v2IfvgV3LegacySelectionObservation");
const liveCollector = await load("v2IfvgV3LiveShadowCollector");
const liveLedger = await load("v2IfvgV3LiveShadowLedger");
const liveValidation = await load("v2IfvgV3LiveShadowValidation");

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
const iso = (day, minute) => new Date(Date.UTC(2026, 5, day, 13, 30 + minute)).toISOString();
const candle = (day, minute, open, high, low, close, volume = 100) =>
  Object.freeze({ timestamp: iso(day, minute), open, high, low, close, volume, closed: true });
const overlapFiller = (day, startMinute, count, base = 98) =>
  Array.from({ length: count }, (_, index) => {
    const open = base + (index % 3) * 0.12;
    const close = base + ((index + 1) % 3) * 0.12;
    return candle(day, startMinute + index * 5, open, base + 1.2, base - 1.2, close, 150 + index);
  });
const validLongCandles = (day) => Object.freeze([
  ...overlapFiller(day, -30, 6, 100),
  ...overlapFiller(day, 0, 10, 100),
  candle(day, 50, 101, 104, 96, 97),
  candle(day, 55, 97, 99, 95.5, 96.8),
  candle(day, 60, 93, 94, 90, 91),
  candle(day, 65, 91, 93.4, 90.5, 92.2),
  candle(day, 70, 92.5, 98.6, 92.2, 98),
  candle(day, 75, 98, 99.2, 97.2, 98.8),
  candle(day, 80, 98.8, 100.2, 98.2, 99.8),
  candle(day, 85, 99.6, 100, 94.8, 95.6)
]);
const noCandidateCandles = (day) => Object.freeze(overlapFiller(day, -30, 32, 100));
const endAfter = (candles) => new Date(Date.parse(candles.at(-1).timestamp) + 5 * 60_000).toISOString();
const directionalContext = ({ asOf, direction }) => Object.freeze(
  Object.fromEntries(["15m", "1h", "4h", "1d"].map((timeframe, timeframeIndex) => {
    const interval = timeframeMs[timeframe];
    const base = 90 + timeframeIndex * 10;
    return [timeframe, Object.freeze(Array.from({ length: 12 }, (_, index) => {
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
    }))];
  }))
);
const sourceTimeEligibility = (asOf) => Object.freeze({
  currentLiveEligible: true,
  historicalEligible: false,
  verificationScope: "current_live",
  verifiedAtUtc: new Date(Date.parse(asOf) - 24 * 60 * 60_000).toISOString(),
  currentLiveValidUntilUtc: new Date(Date.parse(asOf) + 60_000).toISOString(),
  offsetRegimeStartUtc: new Date(Date.parse(asOf) - 30 * 24 * 60 * 60_000).toISOString(),
  offsetRegimeId: "v2-mt5-offset-regime:fixture",
  blockers: Object.freeze([]),
  warnings: Object.freeze([])
});
const buildWindow = ({ source, timeframe, candles, asOf }) =>
  candleWindow.buildV2CanonicalCandleWindow({
    adapterId: "phase-3d-ifvg-live-shadow-fixture",
    adapterVersion: "phase-3d-fixture-v1",
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
    source,
    sourceTimeEligibility: sourceTimeEligibility(asOf),
    timeContractId: "gotrader-mt5-readonly-time-contract",
    timeContractVersion: "1.1.0",
    timeContractVerificationStatus: "configured_unverified",
    timeVerificationScope: "current_live"
  });
const buildBundle = async ({ candles, contextCandles, fingerprint }) => {
  const source = identity.createV2SourceIdentity({
    sourceId: `mt5:USTECH:phase3d:${fingerprint}`,
    provider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    sourceFingerprint: fingerprint,
    sourceKind: "mt5_read_only"
  });
  const asOf = endAfter(candles);
  const primaryWindow = await buildWindow({ source, timeframe: "5m", candles, asOf });
  const htfWindows = await Promise.all(Object.entries(contextCandles).map(([timeframe, values]) =>
    buildWindow({ source, timeframe, candles: values, asOf })
  ));
  const context = await contextBuilder.buildV2CanonicalMarketContext({
    source,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    asOfMarketTime: asOf,
    requiredTimeframes: ["5m", "15m", "1h", "4h", "1d"],
    windows: [primaryWindow, ...htfWindows],
    purpose: "current_live_shadow",
    requestedFactFamilies: ["displacement", "fair_value_gap", "higher_timeframe_bias"],
    builtAt: asOf
  });
  return { context, primaryWindow, contextCandles };
};
const buildLegacy = async ({ bundle, candles, fingerprint }) => {
  const input = {
    candles,
    contextCandles: bundle.contextCandles,
    sourceProvider: "mt5_read_only",
    sourceFingerprint: fingerprint,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    generatedAt: endAfter(candles)
  };
  const candidate = legacyDetector.evaluateIctIfvg(input);
  const assessment = legacyV3.assessIctIfvgFreshRetestV3(input, candidate);
  return legacySelection.buildLegacyIfvgV3SelectionObservation({
    assessment,
    candidate,
    contextArtifactId: bundle.context.contextArtifactId,
    primaryWindowIdentityHash: bundle.primaryWindow.identity.identityHash
  });
};
const run = async ({ day, candles, direction = "bullish", fingerprint }) => {
  const contextCandles = directionalContext({ asOf: endAfter(candles), direction });
  const bundle = await buildBundle({ candles, contextCandles, fingerprint });
  const legacyObservation = await buildLegacy({ bundle, candles, fingerprint });
  const observation = await liveCollector.collectV2IfvgV3LiveShadowObservation({
    ...bundle,
    legacyObservation,
    collectedAtUtc: new Date(Date.parse(endAfter(candles)) + day * 1_000).toISOString()
  });
  return { bundle, legacyObservation, observation };
};
const assertCompact = (value, label) => {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(
    serialized,
    /"candles"\s*:|rawCandles|rawRuntimeSnapshot|rawSnapshot|accountData|orderData|positionData|password|secret|apiKey|token|mt5Credentials|base64/i,
    `${label} must remain compact`
  );
  assert.deepEqual(value.authority ?? value.ledger?.authority, authority);
};

const positiveCandles = validLongCandles(12);
const positive = await run({
  day: 12,
  candles: positiveCandles,
  fingerprint: "mt5|MNQ|USTECH|5m|phase3d-positive"
});
assert.equal(positive.observation.status, "exact_parity");
assert.equal(positive.observation.parity.selectedCandidateRankingParityAchieved, true);
assert.equal(positive.observation.statisticallyIndependentWindowClaimed, false);
assert.equal(positive.observation.productionAdoptionAllowed, false);

const noCandidateCandlesValue = noCandidateCandles(13);
const noCandidate = await run({
  day: 13,
  candles: noCandidateCandlesValue,
  fingerprint: "mt5|MNQ|USTECH|5m|phase3d-no-candidate"
});
assert.equal(noCandidate.observation.status, "exact_parity");
assert.equal(noCandidate.observation.parity.legacySelectionState, "no_candidate");
assert.equal(noCandidate.observation.parity.v2SelectionState, "no_candidate");

const alteredLegacy = Object.freeze({
  ...positive.legacyObservation,
  selectedCandidateId: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  selectedCandidate: Object.freeze({
    ...positive.legacyObservation.selectedCandidate,
    normalizedCandidateId: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  })
});
const regression = await liveCollector.collectV2IfvgV3LiveShadowObservation({
  context: positive.bundle.context,
  primaryWindow: positive.bundle.primaryWindow,
  legacyObservation: alteredLegacy,
  collectedAtUtc: "2026-06-12T20:01:00.000Z"
});
assert.equal(regression.status, "regression");
assert.ok(regression.parity.differences.includes("selected_candidate_identity_mismatch"));

const blockedPrimary = Object.freeze({
  ...positive.bundle.primaryWindow,
  timeEligibility: Object.freeze({
    ...positive.bundle.primaryWindow.timeEligibility,
    currentLiveEligible: false,
    blockers: Object.freeze(["offset_regime_coverage_expired"])
  })
});
const blocked = await liveCollector.collectV2IfvgV3LiveShadowObservation({
  context: positive.bundle.context,
  primaryWindow: blockedPrimary,
  legacyObservation: positive.legacyObservation,
  collectedAtUtc: "2026-06-12T20:02:00.000Z"
});
assert.equal(blocked.status, "blocked_context");
assert.equal(blocked.parity, undefined);
assert.ok(blocked.blockers.includes("live_shadow_current_time_eligibility_missing"));

let ledger = liveLedger.createV2IfvgV3LiveShadowLedger({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m"
});
const firstAppend = liveLedger.appendV2IfvgV3LiveShadowObservation({
  ledger,
  observation: positive.observation
});
assert.equal(firstAppend.action, "added");
ledger = firstAppend.ledger;
const duplicate = liveLedger.appendV2IfvgV3LiveShadowObservation({
  ledger,
  observation: positive.observation
});
assert.equal(duplicate.action, "idempotent");
const conflict = liveLedger.appendV2IfvgV3LiveShadowObservation({
  ledger,
  observation: regression
});
assert.equal(conflict.action, "rejected_conflict");
assert.ok(conflict.blockers.includes("live_shadow_closed_window_result_conflict"));
const secondAppend = liveLedger.appendV2IfvgV3LiveShadowObservation({
  ledger,
  observation: noCandidate.observation
});
assert.equal(secondAppend.action, "added");
ledger = secondAppend.ledger;
assert.equal(ledger.exactParityCount, 2);
assert.equal(ledger.regressionCount, 0);
assert.equal(ledger.distinctClosedWindowCount, 2);
assert.equal(ledger.distinctMarketDateCount, 2);

const file = await liveValidation.buildV2IfvgV3LiveShadowLedgerFile({
  ledger,
  savedAtUtc: "2026-06-14T00:00:00.000Z"
});
const acceptedFile = await liveValidation.validateV2IfvgV3LiveShadowLedgerFile(file);
assert.equal(acceptedFile.status, "accepted");
const tampered = await liveValidation.validateV2IfvgV3LiveShadowLedgerFile({
  ...file,
  ledger: { ...file.ledger, exactParityCount: 99 }
});
assert.equal(tampered.status, "blocked");
assert.ok(tampered.blockers.some((item) =>
  item === "live_shadow_exactParityCount_mismatch" ||
  item === "live_shadow_file_checksum_mismatch"
));
const forbidden = liveValidation.validateV2IfvgV3LiveShadowLedger({
  ...ledger,
  rawCandles: [{ open: 1 }]
});
assert.equal(forbidden.status, "blocked");
assert.ok(forbidden.blockers.some((item) => item.includes("live_shadow_forbidden_field")));

assertCompact(positive.observation, "positive observation");
assertCompact(noCandidate.observation, "no-candidate observation");
assertCompact(blocked, "blocked observation");
assertCompact(ledger, "live shadow ledger");
assertCompact(file, "live shadow file");
assert.equal(ledger.productionAdoptionAllowed, false);
assert.equal(ledger.shadowOnly, true);

const collectorScript = fs.readFileSync(
  path.join(workspace, "scripts", "collect-v2-ifvg-live-shadow.mjs"),
  "utf8"
);
assert.doesNotMatch(collectorScript, /\/(?:account|orders?|positions?|deals?|execute|trade)(?:[/?\"'`]|$)/i);
assert.doesNotMatch(collectorScript, /method:\s*[\"'](?:POST|PUT|PATCH|DELETE)[\"']/i);

console.log(JSON.stringify({
  status: "passed",
  phase: "3D",
  scope: "ifvg_v3_live_read_only_shadow_collection",
  exactParityClosedWindows: ledger.exactParityCount,
  distinctClosedWindows: ledger.distinctClosedWindowCount,
  distinctMarketDates: ledger.distinctMarketDateCount,
  repeatRunAction: duplicate.action,
  conflictingSameWindowAction: conflict.action,
  staleTimeContextBlocked: blocked.status === "blocked_context",
  tamperDetected: acceptedFile.status === "accepted" && tampered.status === "blocked",
  statisticallyIndependentWindowClaimed: false,
  rawCandlesSerialized: false,
  validationChainEntryCreated: false,
  productionAdoptionAllowed: false,
  authority
}, null, 2));
