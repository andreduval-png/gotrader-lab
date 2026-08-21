import {
  CANONICAL_WALK_FORWARD_MIN_CANDLES,
  type CanonicalCandleProvider,
  type CanonicalCandleSource,
  createCanonicalCandleSource,
  canonicalSourceFromMt5ReadOnlyFeed,
  canonicalSourceFromPreparedSource
} from "@/lib/candleSources";
import {
  fetchMt5CandlesInChunks,
  hydrateActiveMt5ReadOnlyCandleFeed,
  loadActiveMt5ReadOnlyCandleFeed,
  loadMt5ReadOnlySettings,
  mt5ReadOnlyCandlesToGoTraderCandles
} from "@/lib/integrations/mt5";
import {
  loadPreparedWalkForwardCandleSource,
  loadWalkForwardCandleWindowSettings,
  prepareCandlesForResearch,
  prepareCandleSourceForResearch,
  type CandleWindowSettings,
  type PreparedCandleSource
} from "@/lib/marketData";
import type { CandleDataSourceMode } from "@/lib/marketData/historicalCandleImport";

export interface ResolvedWalkForwardCandleSource extends PreparedCandleSource {
  brokerSymbol?: string;
  dataQuality: CanonicalCandleSource["dataQuality"];
  provider: CanonicalCandleProvider;
  sourceFingerprint: string;
  sourceWarnings: string[];
  walkForwardEligible: boolean;
  walkForwardEligibilityReasons: string[];
}

export interface LoadWalkForwardCandleSourceOptions {
  allowMt5DeepHistory?: boolean;
  requestedLookbackDays?: number;
  signal?: AbortSignal;
}

const SOURCE_RESOLUTION_TIMEOUT_MS = 8_000;

const withSourceTimeout = <T>(promise: Promise<T>, label: string) =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(
      () => reject(new Error(`${label} exceeded ${SOURCE_RESOLUTION_TIMEOUT_MS / 1000} seconds.`)),
      SOURCE_RESOLUTION_TIMEOUT_MS
    );
    promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });

const asWalkForwardSource = (
  source: PreparedCandleSource,
  canonical: CanonicalCandleSource,
  warnings: string[] = []
): ResolvedWalkForwardCandleSource => ({
  ...source,
  brokerSymbol: canonical.provenance.providerSymbol,
  dataQuality: canonical.dataQuality,
  provider: canonical.provider,
  sourceFingerprint: canonical.fingerprint,
  sourceWarnings: [...canonical.warnings, ...warnings],
  walkForwardEligible: canonical.eligibility.walkForward,
  walkForwardEligibilityReasons: canonical.eligibilityReasons
});

const sourceModeForProvider = (provider: CanonicalCandleProvider): CandleDataSourceMode =>
  provider === "imported_historical"
    ? "imported"
    : provider === "tradingview_mcp"
      ? "tradingview_mcp_chart"
      : provider === "mt5_read_only"
        ? "mt5_read_only"
        : "mock";

const preparedFromCanonical = (
  canonical: CanonicalCandleSource,
  settings: Partial<CandleWindowSettings>
): PreparedCandleSource => {
  const prepared = prepareCandleSourceForResearch(
    {
      mode: sourceModeForProvider(canonical.provider),
      label: canonical.provenance.sourceLabel,
      candles: canonical.candles
    },
    settings
  );
  return {
    ...prepared,
    warnings: [...prepared.warnings, ...canonical.warnings]
  };
};

const preparedDeepMt5Source = async (
  mt5Feed: NonNullable<ReturnType<typeof loadActiveMt5ReadOnlyCandleFeed>>,
  settingsInput: Partial<CandleWindowSettings>,
  options: LoadWalkForwardCandleSourceOptions
): Promise<ResolvedWalkForwardCandleSource | undefined> => {
  const settings = loadMt5ReadOnlySettings();
  const requestedSymbol = mt5Feed.requestedSymbol ?? settings.requestedSymbol ?? "MNQ";
  const brokerSymbol = mt5Feed.brokerSymbol ?? settings.brokerSymbolOverride ?? requestedSymbol;
  const timeframe = settingsInput.targetTimeframe ?? mt5Feed.timeframe ?? settings.timeframe ?? "5m";
  const requestedLookbackDays = options.requestedLookbackDays ?? 90;
  const history = await fetchMt5CandlesInChunks({
    brokerSymbol,
    chunkDays: 10,
    limitPerChunk: 5000,
    lookbackDays: requestedLookbackDays,
    symbol: requestedSymbol,
    timeframe,
    signal: options.signal
  }, settings);

  if (!history.candles.length || history.summary.depthStatus !== "sufficient") {
    return undefined;
  }

  const gotraderCandles = mt5ReadOnlyCandlesToGoTraderCandles({
    brokerSymbol,
    candles: history.candles,
    symbol: requestedSymbol,
    timeframe
  });
  const prepared = prepareCandlesForResearch(
    gotraderCandles,
    {
      ...settingsInput,
      advancedMode: true,
      targetTimeframe: timeframe === "15m" || timeframe === "1m" ? timeframe : "5m",
      windowSize: Math.min(50000, gotraderCandles.length)
    },
    true,
    {
      // Explicit operator-started detector validation needs the complete
      // chronological range. Dashboard and Advisor tactical reads keep their
      // existing browser caps and never use this override.
      maximumWindowSize: 50000
    }
  );
  const label = `MT5 read-only explicit ${requestedLookbackDays}-day range / ${prepared.processedCandleCount.toLocaleString()} ${prepared.appliedSettings.targetTimeframe}`;
  const preparedSource: PreparedCandleSource = {
    mode: "mt5_read_only",
    label,
    candles: prepared.candles,
    rawCandleCount: prepared.rawCandleCount,
    researchWindowCandles: prepared.researchWindowCandles,
    processedCandleCount: prepared.processedCandleCount,
    estimatedProcessedCandles: prepared.estimatedProcessedCandles,
    appliedSettings: prepared.appliedSettings,
    aggregationApplied: prepared.aggregationApplied,
    performanceMode: prepared.performanceMode,
    warnings: [
      ...prepared.warnings,
      ...history.warnings,
      "MT5 explicit range history is used only after an operator starts walk-forward; it is not fetched on Dashboard/Advisor load."
    ]
  };
  const canonical = createCanonicalCandleSource({
    candles: prepared.candles,
    provider: "mt5_read_only",
    providerSymbol: brokerSymbol,
    roles: ["walk_forward", "research", "available"],
    sourceId: `mt5_read_only:${requestedSymbol}:${timeframe}:${requestedLookbackDays}d_walk_forward`,
    sourceLabel: label,
    storageBackend: "memory",
    symbol: requestedSymbol,
    timeframe: prepared.appliedSettings.targetTimeframe,
    userSelectedForResearch: true,
    userSelectedForWalkForward: true,
    warnings: preparedSource.warnings,
    fetchedAt: new Date().toISOString()
  });

  return asWalkForwardSource(preparedSource, canonical, [
    `MT5 range endpoint supplied ${history.summary.candleCount.toLocaleString()} compact candles across ${history.summary.availableLookbackDays.toFixed(1)} days for walk-forward.`,
    "Raw MT5 range candles stay internal to the run; stored walk-forward results remain compact."
  ]);
};

export async function loadPreparedCanonicalWalkForwardCandleSource(
  settingsInput: Partial<CandleWindowSettings> = loadWalkForwardCandleWindowSettings(),
  options: LoadWalkForwardCandleSourceOptions = {}
): Promise<ResolvedWalkForwardCandleSource> {
  const cachedMt5Feed = loadActiveMt5ReadOnlyCandleFeed();
  const mt5Feed = cachedMt5Feed?.candles.length
    ? cachedMt5Feed
    : await withSourceTimeout(hydrateActiveMt5ReadOnlyCandleFeed(), "MT5 walk-forward source hydration")
        .catch(() => cachedMt5Feed);
  const mt5Canonical = canonicalSourceFromMt5ReadOnlyFeed(mt5Feed);
  if (mt5Feed?.activeForResearch && mt5Canonical?.eligibility.walkForward) {
    if (options.allowMt5DeepHistory && mt5Feed) {
      let deepSource: ResolvedWalkForwardCandleSource | undefined;
      try {
        deepSource = await preparedDeepMt5Source(mt5Feed, settingsInput, options);
      } catch (error) {
        if (options.signal?.aborted) throw error;
      }
      if (deepSource) {
        return deepSource;
      }
    }
    return asWalkForwardSource(
      preparedFromCanonical(mt5Canonical, settingsInput),
      mt5Canonical,
      [
        "MT5 read-only walk-forward uses provider/proxy candle data. Imported historical remains preferred for deep CME futures validation.",
        "MT5 read-only has no execution authority, broker authority, or readiness override authority."
      ]
    );
  }

  const importedOrMockSource = await withSourceTimeout(
    loadPreparedWalkForwardCandleSource(settingsInput),
    "Historical walk-forward source resolution"
  );
  const preparedCanonical = canonicalSourceFromPreparedSource(importedOrMockSource);

  if (preparedCanonical.provider === "imported_historical") {
    return asWalkForwardSource(importedOrMockSource, preparedCanonical);
  }

  const mt5Reasons = mt5Feed
    ? mt5Feed.researchEligibility.walkForwardEligible
      ? ["MT5 read-only is depth-eligible but must be selected as the active research source before walk-forward can use it."]
      : mt5Feed.researchEligibility.reasons
    : [`MT5 read-only source does not have enough depth for walk-forward. Target at least ${CANONICAL_WALK_FORWARD_MIN_CANDLES.toLocaleString()} valid candles.`];

  return asWalkForwardSource(importedOrMockSource, preparedCanonical, mt5Reasons);
}
