import { assessIctIfvgFreshRetestV3 } from "@/lib/ict-strategy-suite/ictIfvgFreshRetestV3";
import { loadActiveMt5ReadOnlyCandleFeed } from "@/lib/integrations/mt5/mt5ReadOnlyClient";
import type { Mt5PushFeedEventBus } from "@/lib/mt5PushFeed/mt5PushFeedEventBus";
import type { Mt5CanonicalCandle } from "@/lib/mt5PushFeed/mt5PushFeedTypes";
import type { Candle, Timeframe } from "@/lib/types";
import { ifvgFreshRetestV3FrozenProfile } from "./frozenProfileRegistry";
import {
  buildIfvgV3ForwardObservation,
  resolveIfvgV3ForwardEvidenceWithClosedCandle
} from "./ifvgForwardEvidencePolicy";
import { loadForwardEvidenceLedger, saveForwardEvidenceLedger } from "./forwardEvidenceStorage";
import { FORWARD_EVIDENCE_AUTHORITY } from "./forwardEvidenceTypes";

const defaultHistoryProvider = (closedCandle: Mt5CanonicalCandle): Candle[] => {
  const feed = loadActiveMt5ReadOnlyCandleFeed();
  if (
    !feed?.candles.length ||
    (feed.brokerSymbol ?? feed.symbol) !== closedCandle.brokerSymbol ||
    feed.timeframe.toLowerCase() !== closedCandle.timeframe.toLowerCase()
  ) {
    return [];
  }
  const cutoff = Date.parse(closedCandle.timestamp);
  return feed.candles
    .filter((candle) => Date.parse(candle.timestamp) <= cutoff)
    .map((candle) => ({
      id: candle.id,
      symbol: closedCandle.requestedSymbol,
      timeframe: closedCandle.timeframe as Timeframe,
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }));
};

export interface IfvgV3ForwardEvidenceSubscription {
  unsubscribe: () => void;
  processedCandleCount: () => number;
  issuedObservationCount: () => number;
  resolvedOutcomeCount: () => number;
}

export function processIfvgV3ForwardEvidenceClosedCandle(
  closedCandle: Mt5CanonicalCandle,
  historyProvider: (candle: Mt5CanonicalCandle) => Candle[] = defaultHistoryProvider
) {
  const history = historyProvider(closedCandle)
    .filter((candle) => Date.parse(candle.timestamp) <= Date.parse(closedCandle.timestamp))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const current = loadForwardEvidenceLedger();
  const observedBarsByEntryId = Object.fromEntries(
    current
      .filter((entry) => entry.outcome === "pending")
      .map((entry) => [
        entry.entryId,
        history.filter((candle) =>
          Date.parse(candle.timestamp) > Date.parse(entry.setupTimestamp) &&
          Date.parse(candle.timestamp) <= Date.parse(closedCandle.timestamp)
        ).length
      ])
  );
  const resolved = resolveIfvgV3ForwardEvidenceWithClosedCandle(current, closedCandle, {
    observedBarsByEntryId,
    maximumBars: ifvgFreshRetestV3FrozenProfile.frozenParameters.maxBarsToResolveTrade,
    checkedAt: closedCandle.receivedAt
  });

  let observation;
  if (history.length >= ifvgFreshRetestV3FrozenProfile.frozenParameters.warmupCandles) {
    const assessment = assessIctIfvgFreshRetestV3({
      candles: history,
      sourceProvider: "mt5_read_only",
      sourceFingerprint: closedCandle.sourceFingerprint,
      requestedSymbol: closedCandle.requestedSymbol,
      brokerSymbol: closedCandle.brokerSymbol,
      timeframe: closedCandle.timeframe,
      generatedAt: closedCandle.receivedAt
    });
    observation = buildIfvgV3ForwardObservation(assessment, {
      sourceFingerprint: closedCandle.sourceFingerprint,
      observedAt: closedCandle.receivedAt
    });
  }

  const duplicate = observation
    ? resolved.entries.some((entry) =>
        entry.profileId === observation?.profileId &&
        entry.setupTimestamp === observation?.setupTimestamp &&
        entry.direction === observation?.direction
      )
    : false;
  const entries = observation && !duplicate
    ? [...resolved.entries, observation]
    : resolved.entries;
  if (resolved.updatedEntryIds.length || (observation && !duplicate)) {
    saveForwardEvidenceLedger(entries);
  }

  return {
    issued: Boolean(observation && !duplicate),
    observation,
    duplicate,
    updatedEntryIds: resolved.updatedEntryIds,
    historyCandleCount: history.length,
    authority: FORWARD_EVIDENCE_AUTHORITY
  };
}

export function subscribeIfvgV3ForwardEvidenceToMt5PushFeed(
  eventBus: Mt5PushFeedEventBus,
  historyProvider: (candle: Mt5CanonicalCandle) => Candle[] = defaultHistoryProvider
): IfvgV3ForwardEvidenceSubscription {
  let processed = 0;
  let issued = 0;
  let resolved = 0;
  const unsubscribe = eventBus.subscribe((event) => {
    if (event.type !== "canonical.candle_closed" || !event.candle) return;
    if (event.candle.timeframe.toLowerCase() !== ifvgFreshRetestV3FrozenProfile.timeframe) return;
    processed += 1;
    const result = processIfvgV3ForwardEvidenceClosedCandle(event.candle, historyProvider);
    if (result.issued) issued += 1;
    resolved += result.updatedEntryIds.length;
  });
  return {
    unsubscribe,
    processedCandleCount: () => processed,
    issuedObservationCount: () => issued,
    resolvedOutcomeCount: () => resolved
  };
}
