import {
  defaultMt5PushFeedStoreState,
  type Mt5CanonicalCandle,
  type Mt5PushFeedEventBus
} from "@/lib/mt5PushFeed";
import type { ForwardScenarioMap } from "@/lib/forwardScenario";
import {
  assessAsiaDisplacementFvgExternalTargetV2Observation,
  ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID,
  assessCmdLondonLongExternalTargetV2Observation,
  CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID,
  assessCmdLondonLongForwardScenario,
  CMD_LONDON_LONG_FROZEN_PROFILE_ID,
  reconstructMarketEpisodes,
  type MarketEpisodeOpportunity
} from "@/lib/marketEpisodes";
import type { Candle } from "@/lib/types";
import {
  evaluatePredictionCalibration,
  issuePredictionFromMarketOpportunity,
  issuePredictionFromScenarioMap,
  updatePredictionLedgerWithClosedCandle
} from "./predictionLedger";
import { loadPredictionLedger, recordPredictionLedgerEntry, savePredictionLedger } from "./predictionLedgerStorage";
import {
  PREDICTION_LEDGER_AUTHORITY,
  type PredictionIssueOptions,
  type CmdLondonLongV2Subscription,
  type FrozenMarketEpisodeProfileSubscription,
  type UniversalPredictionLedgerEntry,
  type PredictionLedgerMt5Subscription
} from "./predictionLedgerTypes";

export function recordForwardScenarioPrediction(map: ForwardScenarioMap, options: PredictionIssueOptions = {}) {
  const entry = issuePredictionFromScenarioMap(map, options);
  return recordPredictionLedgerEntry(entry);
}

export function recordCmdLondonLongForwardObservation(map: ForwardScenarioMap) {
  const eligibility = assessCmdLondonLongForwardScenario(map);
  if (!eligibility.eligible) return { recorded: false as const, eligibility };
  const entry = issuePredictionFromScenarioMap(map, {
    modelVersion: CMD_LONDON_LONG_FROZEN_PROFILE_ID,
    maxBarsToResolve: 48,
    probabilitySource: "heuristic_uncalibrated"
  });
  const observation = {
    ...entry,
    blockerSummary: [
      "Frozen CMD London-long v1 forward observation only; retrospective cost robustness is not established.",
      entry.blockerSummary
    ].filter(Boolean).join(" ").slice(0, 500)
  };
  return {
    recorded: true as const,
    eligibility,
    entry: recordPredictionLedgerEntry(observation)
  };
}

export interface CmdLondonLongV2ClosedCandleInput {
  candles: Candle[];
  closedCandleTimestamp: string;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
}

export type FrozenMarketEpisodeClosedCandleInput = CmdLondonLongV2ClosedCandleInput;

const detectOpportunitiesOnClosedCandle = (input: FrozenMarketEpisodeClosedCandleInput) => reconstructMarketEpisodes({
  candles: input.candles,
  sourceProvider: input.sourceProvider,
  requestedSymbol: input.requestedSymbol,
  brokerSymbol: input.brokerSymbol,
  timeframe: input.timeframe,
  sourceFingerprint: input.sourceFingerprint,
  minimumEpisodeCandles: 24,
  maxResolutionBars: 48
}).flatMap((episode) => episode.opportunities)
  .filter((opportunity) => Date.parse(opportunity.detectedAt) === Date.parse(input.closedCandleTimestamp));

export function recordCmdLondonLongExternalTargetV2Opportunity(
  opportunity: MarketEpisodeOpportunity,
  context: Omit<CmdLondonLongV2ClosedCandleInput, "candles">
) {
  const eligibility = assessCmdLondonLongExternalTargetV2Observation({ opportunity, ...context });
  if (!eligibility.eligible) return { recorded: false as const, eligibility };
  const entry = issuePredictionFromMarketOpportunity({
    opportunity,
    sourceProvider: context.sourceProvider,
    requestedSymbol: context.requestedSymbol,
    brokerSymbol: context.brokerSymbol,
    timeframe: context.timeframe,
    sourceFingerprint: context.sourceFingerprint,
    modelVersion: CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID,
    scenarioFamily: "cmd_london_long_external_target",
    maxBarsToResolve: 48
  });
  return {
    recorded: true as const,
    eligibility,
    entry: recordPredictionLedgerEntry(entry)
  };
}

export function recordCmdLondonLongExternalTargetV2FromClosedCandle(input: CmdLondonLongV2ClosedCandleInput) {
  const opportunities = detectOpportunitiesOnClosedCandle(input);
  if (!opportunities.length) {
    return {
      recorded: false as const,
      reason: "No causal CMD opportunity was detected on the current closed candle.",
      candidateCount: 0,
      profileId: CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID,
      authority: PREDICTION_LEDGER_AUTHORITY
    };
  }
  const attempts = opportunities.map((opportunity) => recordCmdLondonLongExternalTargetV2Opportunity(opportunity, input));
  const recorded = attempts.find((attempt) => attempt.recorded);
  return recorded ?? {
    recorded: false as const,
    reason: "Closed-candle opportunities did not match the frozen external-target v2 selector.",
    candidateCount: opportunities.length,
    blockers: Array.from(new Set(attempts.flatMap((attempt) => attempt.eligibility.blockers))),
    profileId: CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID,
    authority: PREDICTION_LEDGER_AUTHORITY
  };
}

export function recordAsiaDisplacementFvgExternalTargetV2Opportunity(
  opportunity: MarketEpisodeOpportunity,
  context: Omit<FrozenMarketEpisodeClosedCandleInput, "candles">
) {
  const eligibility = assessAsiaDisplacementFvgExternalTargetV2Observation({ opportunity, ...context });
  if (!eligibility.eligible) return { recorded: false as const, eligibility };
  const entry = issuePredictionFromMarketOpportunity({
    opportunity,
    sourceProvider: context.sourceProvider,
    requestedSymbol: context.requestedSymbol,
    brokerSymbol: context.brokerSymbol,
    timeframe: context.timeframe,
    sourceFingerprint: context.sourceFingerprint,
    modelVersion: ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID,
    scenarioFamily: "asia_displacement_fvg_external_target",
    maxBarsToResolve: 48
  });
  return {
    recorded: true as const,
    eligibility,
    entry: recordPredictionLedgerEntry(entry)
  };
}

export function recordAsiaDisplacementFvgExternalTargetV2FromClosedCandle(
  input: FrozenMarketEpisodeClosedCandleInput
) {
  const opportunities = detectOpportunitiesOnClosedCandle(input);
  if (!opportunities.length) {
    return {
      recorded: false as const,
      reason: "No causal market-episode opportunity was detected on the current closed candle.",
      candidateCount: 0,
      profileId: ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID,
      authority: PREDICTION_LEDGER_AUTHORITY
    };
  }
  const attempts = opportunities.map((opportunity) =>
    recordAsiaDisplacementFvgExternalTargetV2Opportunity(opportunity, input)
  );
  const recorded = attempts.find((attempt) => attempt.recorded);
  return recorded ?? {
    recorded: false as const,
    reason: "Closed-candle opportunities did not match the frozen Asia displacement/FVG external-target v2 selector.",
    candidateCount: opportunities.length,
    blockers: Array.from(new Set(attempts.flatMap((attempt) => attempt.eligibility.blockers))),
    profileId: ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID,
    authority: PREDICTION_LEDGER_AUTHORITY
  };
}

export function recordFrozenMarketEpisodeProfileObservationsFromClosedCandle(
  input: FrozenMarketEpisodeClosedCandleInput
) {
  const opportunities = detectOpportunitiesOnClosedCandle(input);
  const entries: UniversalPredictionLedgerEntry[] = [];
  for (const opportunity of opportunities) {
    const cmd = recordCmdLondonLongExternalTargetV2Opportunity(opportunity, input);
    if (cmd.recorded) entries.push(cmd.entry);
    const asiaDisplacement = recordAsiaDisplacementFvgExternalTargetV2Opportunity(opportunity, input);
    if (asiaDisplacement.recorded) entries.push(asiaDisplacement.entry);
  }
  return {
    recorded: entries.length > 0,
    entries,
    candidateCount: opportunities.length,
    profileIds: [CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID, ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID],
    authority: PREDICTION_LEDGER_AUTHORITY
  };
}

export function evaluateCmdLondonLongExternalTargetV2ForwardCohort(entries: UniversalPredictionLedgerEntry[]) {
  const freshV2 = entries.filter((entry) => entry.modelVersion === CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID);
  return {
    ...evaluatePredictionCalibration(freshV2, "cmd_london_long_external_target"),
    modelVersion: CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID,
    inheritedV1OutcomeCount: 0,
    paperDemoEligible: false as const,
    authority: PREDICTION_LEDGER_AUTHORITY
  };
}

export function evaluateAsiaDisplacementFvgExternalTargetV2ForwardCohort(
  entries: UniversalPredictionLedgerEntry[]
) {
  const freshV2 = entries.filter((entry) => entry.modelVersion === ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID);
  return {
    ...evaluatePredictionCalibration(freshV2, "asia_displacement_fvg_external_target"),
    modelVersion: ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID,
    inheritedHistoricalOutcomeCount: 0,
    paperDemoEligible: false as const,
    authority: PREDICTION_LEDGER_AUTHORITY
  };
}

export function subscribePredictionLedgerToMt5PushFeed(eventBus: Mt5PushFeedEventBus): PredictionLedgerMt5Subscription {
  let processed = 0;
  let updated = 0;
  const unsubscribe = eventBus.subscribe((event) => {
    if (event.type !== "canonical.candle_closed" || !event.candle) return;
    processed += 1;
    const state = loadPredictionLedger();
    const result = updatePredictionLedgerWithClosedCandle(state.entries, event.candle);
    if (result.updatedPredictionIds.length) {
      updated += result.updatedPredictionIds.length;
      savePredictionLedger(result.entries);
    }
  });
  return {
    unsubscribe,
    processedCandleCount: () => processed,
    updatedPredictionCount: () => updated
  };
}

const defaultHistoryProvider = (candle: Mt5CanonicalCandle): Candle[] => Object.values(
  defaultMt5PushFeedStoreState.candlesBySeries
).find((series) => series.some((item) =>
  item.brokerSymbol === candle.brokerSymbol && item.timeframe.toLowerCase() === candle.timeframe.toLowerCase()
)) ?? [];

export function subscribeCmdLondonLongV2ToMt5PushFeed(
  eventBus: Mt5PushFeedEventBus,
  historyProvider: (candle: Mt5CanonicalCandle) => Candle[] = defaultHistoryProvider
): CmdLondonLongV2Subscription {
  let processed = 0;
  let issued = 0;
  let blocked = 0;
  const unsubscribe = eventBus.subscribe((event) => {
    if (event.type !== "canonical.candle_closed" || !event.candle) return;
    processed += 1;
    const result = recordCmdLondonLongExternalTargetV2FromClosedCandle({
      candles: historyProvider(event.candle),
      closedCandleTimestamp: event.candle.timestamp,
      sourceProvider: "mt5_push_feed",
      requestedSymbol: event.candle.requestedSymbol,
      brokerSymbol: event.candle.brokerSymbol,
      timeframe: event.candle.timeframe,
      sourceFingerprint: event.candle.sourceFingerprint
    });
    if (result.recorded) issued += 1;
    else blocked += 1;
  });
  return {
    unsubscribe,
    processedCandleCount: () => processed,
    issuedObservationCount: () => issued,
    blockedObservationCount: () => blocked
  };
}

export function subscribeFrozenMarketEpisodeProfilesToMt5PushFeed(
  eventBus: Mt5PushFeedEventBus,
  historyProvider: (candle: Mt5CanonicalCandle) => Candle[] = defaultHistoryProvider
): FrozenMarketEpisodeProfileSubscription {
  let processed = 0;
  let issued = 0;
  let blocked = 0;
  const unsubscribe = eventBus.subscribe((event) => {
    if (event.type !== "canonical.candle_closed" || !event.candle) return;
    processed += 1;
    const result = recordFrozenMarketEpisodeProfileObservationsFromClosedCandle({
      candles: historyProvider(event.candle),
      closedCandleTimestamp: event.candle.timestamp,
      sourceProvider: "mt5_push_feed",
      requestedSymbol: event.candle.requestedSymbol,
      brokerSymbol: event.candle.brokerSymbol,
      timeframe: event.candle.timeframe,
      sourceFingerprint: event.candle.sourceFingerprint
    });
    if (result.recorded) issued += result.entries.length;
    else blocked += 1;
  });
  return {
    unsubscribe,
    processedCandleCount: () => processed,
    issuedObservationCount: () => issued,
    blockedObservationCount: () => blocked
  };
}

export const predictionLedgerIntegrationAuthority = PREDICTION_LEDGER_AUTHORITY;
