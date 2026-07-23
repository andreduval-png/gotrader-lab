#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadLocalEnvironment } from "./local-env.mjs";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import {
  acquireV2IfvgLiveShadowLock,
  fetchV2IfvgLiveShadowInputs,
  loadV2IfvgLiveShadowLedger,
  loadV2IfvgOffsetRegimeLedger,
  resolveV2IfvgLiveShadowMode,
  saveV2IfvgLiveShadowLedger
} from "./v2-ifvg-live-shadow-collector-core.mjs";

await loadLocalEnvironment();

const workspace = process.cwd();
const bridgeUrl = process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341";
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const primaryTimeframe = "5m";
const timeframes = Object.freeze(["5m", "15m", "1h", "4h", "1d"]);
const limits = Object.freeze({ "5m": 1_000, "15m": 500, "1h": 300, "4h": 200, "1d": 120 });
const timeoutMs = Math.max(500, Math.min(15_000, Number(process.env.V2_IFVG_LIVE_SHADOW_TIMEOUT_MS || 5_000)));
const intervalMs = Math.max(60_000, Math.min(15 * 60_000, Number(process.env.V2_IFVG_LIVE_SHADOW_INTERVAL_MS || 5 * 60_000)));
const watch = process.argv.includes("--watch");
const safeSymbol = brokerSymbol.replace(/[^a-z0-9._-]/gi, "_");
const stateFile = path.resolve(
  process.env.V2_IFVG_LIVE_SHADOW_STATE_FILE ||
  path.join(workspace, ".gotrader", "v2", `ifvg-v3-live-shadow-${safeSymbol}-${primaryTimeframe}.json`)
);
const offsetRegimeFile = path.resolve(
  process.env.V2_MT5_OFFSET_REGIME_STATE_FILE ||
  path.join(workspace, ".gotrader", "v2", `mt5-offset-regime-${safeSymbol}.json`)
);
const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const canaryMode = resolveV2IfvgLiveShadowMode(process.env.V2_IFVG_LIVE_SHADOW_MODE);

if (canaryMode === "disabled") {
  console.log(JSON.stringify({
    status: "disabled",
    migrationMode: "legacy_authoritative",
    reason: "IFVG v3 live shadow collection is disabled by the canary rollback switch.",
    networkRequestsMade: 0,
    observationPersisted: false,
    productionAdoptionAllowed: false,
    authority
  }, null, 2));
  process.exit(0);
}

const outRoot = path.join(workspace, ".gotrader", "v2-ifvg-live-shadow-runtime");
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
  "src/lib/v2/time/v2TimeNormalization.ts",
  "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContract.ts",
  "src/lib/v2/time/v2Mt5OffsetRegimeTypes.ts",
  "src/lib/v2/time/v2Mt5OffsetRegimeLedger.ts",
  "src/lib/v2/time/v2Mt5OffsetRegimeValidation.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/candles/v2Timeframe.ts",
  "src/lib/v2/candles/v2CandleValidation.ts",
  "src/lib/v2/candles/v2CandleWindowBuilder.ts",
  "src/lib/v2/candles/v2StaticCandleRepository.ts",
  "src/lib/v2/candles/v2Mt5TimeNormalizedAdapter.ts",
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
const canonical = await load("canonicalSerialization");
const mt5Adapter = await load("v2Mt5TimeNormalizedAdapter");
const contextBuilder = await load("v2ContextBuilder");
const legacyDetector = await load("ictIfvg");
const legacyV3 = await load("ictIfvgFreshRetestV3");
const legacySelection = await load("v2IfvgV3LegacySelectionObservation");
const liveCollector = await load("v2IfvgV3LiveShadowCollector");
const liveLedger = await load("v2IfvgV3LiveShadowLedger");
const liveValidation = await load("v2IfvgV3LiveShadowValidation");
const offsetValidation = await load("v2Mt5OffsetRegimeValidation");
const ledgerApi = Object.freeze({ ...liveLedger, ...liveValidation });

const rawProviderTime = (candle) =>
  typeof candle?.time === "number" ? candle.time : candle?.openTime ?? candle?.timestamp;
const compactFingerprint = (timeframe, feed) => ({
  timeframe,
  candleCount: feed.candles.length,
  firstTime: rawProviderTime(feed.candles[0]),
  firstClose: Number(feed.candles[0]?.close),
  lastTime: rawProviderTime(feed.candles.at(-1)),
  lastClose: Number(feed.candles.at(-1)?.close)
});
const toFeedCandles = (candles) => Object.freeze(candles.map((candle) => Object.freeze({
  rawProviderTime: rawProviderTime(candle),
  open: Number(candle.open),
  high: Number(candle.high),
  low: Number(candle.low),
  close: Number(candle.close),
  volume: candle.volume === undefined && candle.tickVolume === undefined
    ? undefined
    : Number(candle.volume ?? candle.tickVolume)
})));
const toLegacyCandles = (window) => Object.freeze(window.candles.map((candle) => Object.freeze({
  timestamp: candle.openTime,
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
  volume: candle.volume
})));

const runCycle = async () => {
  const collectedAtUtc = new Date().toISOString();
  let inputs;
  try {
    inputs = await fetchV2IfvgLiveShadowInputs({
      bridgeUrl,
      brokerSymbol,
      requestedSymbol,
      timeoutMs,
      timeframes,
      limits
    });
  } catch (error) {
    return Object.freeze({
      status: "source_unavailable",
      reason: error instanceof Error ? error.message : String(error),
      statePreserved: true,
      rawCandlesPrinted: false,
      mutationEndpointsCalled: false,
      productionAdoptionAllowed: false,
      authority
    });
  }

  let offsetRegimeLedger;
  try {
    offsetRegimeLedger = await loadV2IfvgOffsetRegimeLedger({
      stateFile: offsetRegimeFile,
      validationApi: offsetValidation
    });
  } catch (error) {
    return Object.freeze({
      status: "blocked_offset_regime_state",
      reason: error instanceof Error ? error.message : String(error),
      statePreserved: true,
      rawCandlesPrinted: false,
      mutationEndpointsCalled: false,
      productionAdoptionAllowed: false,
      authority
    });
  }

  const provisionalFingerprint = await canonical.canonicalHash({
    provider: "mt5_read_only",
    requestedSymbol,
    brokerSymbol,
    windows: timeframes.map((timeframe) => compactFingerprint(timeframe, inputs.feeds[timeframe]))
  });
  const buildFeeds = (fingerprint) => Object.fromEntries(timeframes.map((timeframe) => [timeframe, Object.freeze({
    feedId: `mt5:${brokerSymbol}:phase3d-live-shadow`,
    requestedSymbol,
    brokerSymbol,
    symbol: brokerSymbol,
    timeframe,
    candleFingerprint: fingerprint,
    candles: toFeedCandles(inputs.feeds[timeframe].candles),
    connectionStatus: inputs.feeds[timeframe].connectionStatus,
    receivedAt: collectedAtUtc,
    providerClockUtc: inputs.timeContract?.serverTimeUtc,
    warnings: inputs.feeds[timeframe].warnings,
    timeContract: inputs.timeContract,
    offsetRegimeLedger
  })]));
  const buildWindows = async (fingerprint) => {
    const feeds = buildFeeds(fingerprint);
    const source = mt5Adapter.createV2SourceIdentityFromTimeNormalizedMt5Feed(feeds[primaryTimeframe]);
    const windows = [];
    for (const timeframe of timeframes) {
      const repository = mt5Adapter.createV2Mt5TimeNormalizedRepository({
        asOf: () => collectedAtUtc,
        loadFeed: async () => feeds[timeframe]
      });
      windows.push(await repository.getWindow({
        source,
        timeframe,
        limit: limits[timeframe],
        closedOnly: true,
        purpose: "context_shadow"
      }));
    }
    return { feeds, source, windows };
  };
  let normalized;
  try {
    const provisional = await buildWindows(provisionalFingerprint);
    const closedWindowFingerprint = provisional.windows.every((window) => window.candles.length)
      ? await canonical.canonicalHash({
          provider: "mt5_read_only",
          requestedSymbol,
          brokerSymbol,
          closedWindows: provisional.windows.map((window, index) => ({
            timeframe: timeframes[index],
            candleCount: window.candles.length,
            firstOpenTime: window.candles[0]?.openTime,
            firstClose: window.candles[0]?.close,
            lastOpenTime: window.candles.at(-1)?.openTime,
            lastClose: window.candles.at(-1)?.close
          }))
        })
      : provisionalFingerprint;
    normalized = closedWindowFingerprint === provisionalFingerprint
      ? provisional
      : await buildWindows(closedWindowFingerprint);
  } catch (error) {
    return Object.freeze({
      status: "blocked_canonical_window",
      reason: error instanceof Error ? error.message : String(error),
      sourceFingerprint: provisionalFingerprint,
      statePreserved: true,
      rawCandlesPrinted: false,
      mutationEndpointsCalled: false,
      productionAdoptionAllowed: false,
      authority
    });
  }
  const { source, windows } = normalized;
  const combinedFingerprint = source.sourceFingerprint;
  const primaryWindow = windows[0];
  const context = await contextBuilder.buildV2CanonicalMarketContext({
    source,
    requestedSymbol,
    brokerSymbol,
    asOfMarketTime: collectedAtUtc,
    requiredTimeframes: timeframes,
    windows,
    purpose: "current_live_shadow",
    requestedFactFamilies: ["displacement", "fair_value_gap", "higher_timeframe_bias"],
    builtAt: collectedAtUtc
  });
  const candles = toLegacyCandles(primaryWindow);
  const contextCandles = Object.freeze(Object.fromEntries(
    windows.slice(1).map((window, index) => [timeframes[index + 1], toLegacyCandles(window)])
  ));
  const legacyInput = Object.freeze({
    candles,
    contextCandles,
    sourceProvider: "mt5_read_only",
    sourceFingerprint: combinedFingerprint,
    requestedSymbol,
    brokerSymbol,
    timeframe: primaryTimeframe,
    generatedAt: collectedAtUtc
  });
  const candidate = legacyDetector.evaluateIctIfvg(legacyInput);
  const assessment = legacyV3.assessIctIfvgFreshRetestV3(legacyInput, candidate);
  const legacyObservation = await legacySelection.buildLegacyIfvgV3SelectionObservation({
    assessment,
    candidate,
    contextArtifactId: context.contextArtifactId,
    primaryWindowIdentityHash: primaryWindow.identity.identityHash
  });
  const observation = await liveCollector.collectV2IfvgV3LiveShadowObservation({
    context,
    primaryWindow,
    legacyObservation,
    collectedAtUtc
  });
  if (observation.status === "blocked_context") {
    return Object.freeze({
      status: observation.status,
      observationId: observation.observationId,
      source: observation.source,
      blockers: observation.blockers,
      warnings: observation.warnings,
      statePreserved: true,
      observationPersisted: false,
      rawCandlesPrinted: false,
      mutationEndpointsCalled: false,
      productionAdoptionAllowed: false,
      authority
    });
  }
  const ledger = await loadV2IfvgLiveShadowLedger({
    stateFile,
    requestedSymbol,
    brokerSymbol,
    timeframe: primaryTimeframe,
    ledgerApi
  });
  const append = liveLedger.appendV2IfvgV3LiveShadowObservation({ ledger, observation });
  if (append.action === "added") {
    await saveV2IfvgLiveShadowLedger({
      stateFile,
      ledger: append.ledger,
      ledgerApi,
      savedAtUtc: collectedAtUtc
    });
  }
  return Object.freeze({
    status: observation.status,
    action: append.action,
    observationId: observation.observationId,
    source: observation.source,
    parity: observation.parity,
    ledgerSummary: Object.freeze({
      exactParityCount: append.ledger.exactParityCount,
      regressionCount: append.ledger.regressionCount,
      insufficientComparisonCount: append.ledger.insufficientComparisonCount,
      distinctClosedWindowCount: append.ledger.distinctClosedWindowCount,
      distinctMarketDateCount: append.ledger.distinctMarketDateCount,
      compactedObservationCount: append.ledger.compactedObservationCount
    }),
    blockers: append.blockers,
    observationPersisted: append.action === "added",
    rawCandlesPrinted: false,
    mutationEndpointsCalled: false,
    statisticallyIndependentWindowClaimed: false,
    productionAdoptionAllowed: false,
    authority
  });
};

const lock = await acquireV2IfvgLiveShadowLock(stateFile);
let stopping = false;
const stop = () => { stopping = true; };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
  do {
    console.log(JSON.stringify(await runCycle(), null, watch ? 0 : 2));
    if (!watch || stopping) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (!stopping);
} finally {
  await lock.release();
}
