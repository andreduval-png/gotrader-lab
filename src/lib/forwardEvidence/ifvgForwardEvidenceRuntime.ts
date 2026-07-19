import { assessIctIfvgFreshRetestV3 } from "@/lib/ict-strategy-suite/ictIfvgFreshRetestV3";
import { assessIctIfvgShallowRetestV4 } from "@/lib/ict-strategy-suite/ictIfvgShallowRetestV4";
import { loadActiveMt5ReadOnlyCandleFeed } from "@/lib/integrations/mt5/mt5ReadOnlyClient";
import type { Mt5PushFeedEventBus } from "@/lib/mt5PushFeed/mt5PushFeedEventBus";
import type { Mt5CanonicalCandle } from "@/lib/mt5PushFeed/mt5PushFeedTypes";
import type { Candle, Timeframe } from "@/lib/types";
import {
  ifvgFreshRetestV3FrozenProfile,
  ifvgShallowRetestV4FrozenProfile
} from "./frozenProfileRegistry";
import {
  buildIfvgV3ForwardObservation,
  buildIfvgV4ForwardObservation,
  resolveIfvgV3ForwardEvidenceWithClosedCandle
} from "./ifvgForwardEvidencePolicy";
import { loadForwardEvidenceLedger, saveForwardEvidenceLedger } from "./forwardEvidenceStorage";
import {
  createForwardEvidenceCollectorStatus,
  loadForwardEvidenceCollectorStatuses,
  saveForwardEvidenceCollectorStatus,
  validateForwardEvidenceCandleIdentity,
  type ForwardEvidenceCollectorState
} from "./forwardEvidenceCollectorStatus";
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

type IfvgForwardAssessment = Parameters<typeof buildIfvgV3ForwardObservation>[0];
type IfvgForwardProfile = typeof ifvgFreshRetestV3FrozenProfile | typeof ifvgShallowRetestV4FrozenProfile;

const processIfvgForwardEvidenceClosedCandle = (
  closedCandle: Mt5CanonicalCandle,
  profile: IfvgForwardProfile,
  assess: (input: Parameters<typeof assessIctIfvgFreshRetestV3>[0]) => IfvgForwardAssessment,
  buildObservation: typeof buildIfvgV3ForwardObservation,
  historyProvider: (candle: Mt5CanonicalCandle) => Candle[]
) => {
  const identity = validateForwardEvidenceCandleIdentity(closedCandle, profile);
  if (!identity.valid) {
    return {
      issued: false,
      duplicate: false,
      updatedEntryIds: [] as string[],
      historyCandleCount: 0,
      assessmentEligible: false,
      assessmentBlockers: [identity.reason],
      blockerReason: identity.reason,
      authority: FORWARD_EVIDENCE_AUTHORITY
    };
  }
  const history = historyProvider(closedCandle)
    .filter((candle) => Date.parse(candle.timestamp) <= Date.parse(closedCandle.timestamp))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const current = loadForwardEvidenceLedger();
  const observedBarsByEntryId = Object.fromEntries(
    current
      .filter((entry) => entry.profileId === profile.profileId && entry.outcome === "pending")
      .map((entry) => [
        entry.entryId,
        history.filter((candle) =>
          Date.parse(candle.timestamp) > Date.parse(entry.setupTimestamp) &&
          Date.parse(candle.timestamp) <= Date.parse(closedCandle.timestamp)
        ).length
      ])
  );
  const resolved = resolveIfvgV3ForwardEvidenceWithClosedCandle(current, closedCandle, {
    profileId: profile.profileId,
    observedBarsByEntryId,
    maximumBars: profile.frozenParameters.maxBarsToResolveTrade,
    checkedAt: closedCandle.receivedAt
  });

  let observation;
  let assessmentEligible = false;
  let assessmentBlockers: string[] = [];
  if (history.length >= profile.frozenParameters.warmupCandles) {
    const assessment = assess({
      candles: history,
      sourceProvider: "mt5_read_only",
      sourceFingerprint: closedCandle.sourceFingerprint,
      requestedSymbol: closedCandle.requestedSymbol,
      brokerSymbol: closedCandle.brokerSymbol,
      timeframe: closedCandle.timeframe,
      generatedAt: closedCandle.receivedAt
    });
    assessmentEligible = assessment.eligible;
    assessmentBlockers = assessment.blockers;
    observation = buildObservation(assessment, {
      sourceFingerprint: closedCandle.sourceFingerprint,
      observedAt: closedCandle.receivedAt
    });
  }

  const observationIsLatestClosedCandle = observation
    ? Date.parse(observation.setupTimestamp) === Date.parse(closedCandle.timestamp)
    : true;
  if (!observationIsLatestClosedCandle) {
    observation = undefined;
    assessmentEligible = false;
    assessmentBlockers = [...assessmentBlockers, "setup_not_latest_closed_candle"];
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
    assessmentEligible,
    assessmentBlockers,
    blockerReason: history.length < profile.frozenParameters.warmupCandles
      ? "insufficient_history"
      : assessmentBlockers[0],
    authority: FORWARD_EVIDENCE_AUTHORITY
  };
};

const collectorStateFor = (result: ReturnType<typeof processIfvgForwardEvidenceClosedCandle>): ForwardEvidenceCollectorState => {
  if (result.blockerReason?.includes("mismatch") || result.blockerReason?.startsWith("source_") || result.blockerReason?.startsWith("candle_")) {
    return "blocked_source_identity";
  }
  if (result.historyCandleCount === 0 || result.blockerReason === "insufficient_history") {
    return "insufficient_history";
  }
  if (result.updatedEntryIds.length) return "outcome_updated";
  if (result.issued) return "observation_recorded";
  if (result.duplicate) return "duplicate_observation";
  return "no_eligible_setup";
};

const recordCollectorResult = (
  profile: IfvgForwardProfile,
  candle: Mt5CanonicalCandle,
  result: ReturnType<typeof processIfvgForwardEvidenceClosedCandle>,
  counters: { processed: number; issued: number; resolved: number }
) => {
  const previous = loadForwardEvidenceCollectorStatuses()[profile.profileId];
  saveForwardEvidenceCollectorStatus({
    ...createForwardEvidenceCollectorStatus(profile, previous),
    state: collectorStateFor(result),
    subscriptionActive: true,
    processedClosedCandles: counters.processed,
    issuedObservations: counters.issued,
    resolvedOutcomes: counters.resolved,
    lastProcessedAt: candle.receivedAt,
    lastCandleTimestamp: candle.timestamp,
    lastSourceFingerprint: candle.sourceFingerprint,
    lastHistoryCandleCount: result.historyCandleCount,
    blockerReason: result.blockerReason
  });
};

const recordSubscriptionState = (profile: IfvgForwardProfile, subscriptionActive: boolean) => {
  const previous = loadForwardEvidenceCollectorStatuses()[profile.profileId];
  saveForwardEvidenceCollectorStatus({
    ...createForwardEvidenceCollectorStatus(profile, previous),
    state: previous?.state ?? "waiting_for_closed_candle",
    subscriptionActive
  });
};

export function processIfvgV3ForwardEvidenceClosedCandle(
  closedCandle: Mt5CanonicalCandle,
  historyProvider: (candle: Mt5CanonicalCandle) => Candle[] = defaultHistoryProvider
) {
  return processIfvgForwardEvidenceClosedCandle(
    closedCandle,
    ifvgFreshRetestV3FrozenProfile,
    assessIctIfvgFreshRetestV3,
    buildIfvgV3ForwardObservation,
    historyProvider
  );
}

export function processIfvgV4ForwardEvidenceClosedCandle(
  closedCandle: Mt5CanonicalCandle,
  historyProvider: (candle: Mt5CanonicalCandle) => Candle[] = defaultHistoryProvider
) {
  return processIfvgForwardEvidenceClosedCandle(
    closedCandle,
    ifvgShallowRetestV4FrozenProfile,
    assessIctIfvgShallowRetestV4,
    buildIfvgV4ForwardObservation,
    historyProvider
  );
}

export function subscribeIfvgV3ForwardEvidenceToMt5PushFeed(
  eventBus: Mt5PushFeedEventBus,
  historyProvider: (candle: Mt5CanonicalCandle) => Candle[] = defaultHistoryProvider
): IfvgV3ForwardEvidenceSubscription {
  let processed = 0;
  let issued = 0;
  let resolved = 0;
  recordSubscriptionState(ifvgFreshRetestV3FrozenProfile, true);
  const unsubscribe = eventBus.subscribe((event) => {
    if (event.type !== "canonical.candle_closed" || !event.candle) return;
    if (event.candle.timeframe.toLowerCase() !== ifvgFreshRetestV3FrozenProfile.timeframe) return;
    processed += 1;
    const result = processIfvgV3ForwardEvidenceClosedCandle(event.candle, historyProvider);
    if (result.issued) issued += 1;
    resolved += result.updatedEntryIds.length;
    recordCollectorResult(ifvgFreshRetestV3FrozenProfile, event.candle, result, { processed, issued, resolved });
  });
  return {
    unsubscribe: () => {
      unsubscribe();
      recordSubscriptionState(ifvgFreshRetestV3FrozenProfile, false);
    },
    processedCandleCount: () => processed,
    issuedObservationCount: () => issued,
    resolvedOutcomeCount: () => resolved
  };
}

export function subscribeIfvgV4ForwardEvidenceToMt5PushFeed(
  eventBus: Mt5PushFeedEventBus,
  historyProvider: (candle: Mt5CanonicalCandle) => Candle[] = defaultHistoryProvider
): IfvgV3ForwardEvidenceSubscription {
  let processed = 0;
  let issued = 0;
  let resolved = 0;
  recordSubscriptionState(ifvgShallowRetestV4FrozenProfile, true);
  const unsubscribe = eventBus.subscribe((event) => {
    if (event.type !== "canonical.candle_closed" || !event.candle) return;
    if (event.candle.timeframe.toLowerCase() !== ifvgShallowRetestV4FrozenProfile.timeframe) return;
    processed += 1;
    const result = processIfvgV4ForwardEvidenceClosedCandle(event.candle, historyProvider);
    if (result.issued) issued += 1;
    resolved += result.updatedEntryIds.length;
    recordCollectorResult(ifvgShallowRetestV4FrozenProfile, event.candle, result, { processed, issued, resolved });
  });
  return {
    unsubscribe: () => {
      unsubscribe();
      recordSubscriptionState(ifvgShallowRetestV4FrozenProfile, false);
    },
    processedCandleCount: () => processed,
    issuedObservationCount: () => issued,
    resolvedOutcomeCount: () => resolved
  };
}
