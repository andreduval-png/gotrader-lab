import { MARKET_EPISODE_AUTHORITY, type MarketEpisodeOpportunity } from "./marketEpisodeTypes";

export const ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID =
  "asia_displacement_fvg_short_external_target_v2_research" as const;

export const asiaDisplacementFvgExternalTargetV2ResearchHypothesis = Object.freeze({
  profileId: ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID,
  profileVersion: "v2",
  status: "frozen_research_hypothesis_requires_forward_validation",
  createdAt: "2026-07-18T10:20:00.000Z",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  selector: Object.freeze({
    family: "displacement_fvg_continuation",
    session: "asia",
    side: "short",
    targetBasis: "external_liquidity",
    minimumRewardRisk: 1.5
  }),
  retrospectiveEvidence: Object.freeze({
    earlierCompleted: 23,
    earlierAverageRWithCost025: 0.3517,
    earlierAverageRWithCost05: 0.1017,
    recentCompleted: 37,
    recentAverageRWithCost025: 0.2812,
    recentAverageRWithCost05: 0.0312,
    pooledCompleted: 60,
    pooledAverageR: 0.5583,
    pooledAverageRWithCost025: 0.3082,
    pooledAverageRWithCost05: 0.0582,
    pooledProfitFactorWithCost05: 1.0896,
    pooledExpectancyLower95: 0.1985,
    independentDates: 38,
    activeWindows: 6
  }),
  limitation:
    "The external-target filter was selected after inspecting the same historical sample. These metrics are selection-contaminated and cannot be counted as untouched OOS or forward evidence.",
  nextAction:
    "Collect a zero-inheritance cohort from exact post-freeze detector matches on newly closed MT5 candles.",
  executable: false,
  forwardObservationPolicy: "closed_candle_detector_only",
  genericScenarioObservationEligible: false,
  detectorSpecificForwardObservationEligible: true,
  inheritedOutcomeCount: 0,
  paperDemoEligible: false,
  autoPromotionAllowed: false,
  mutationPolicy: "frozen_hypothesis_new_version_required",
  authority: MARKET_EPISODE_AUTHORITY,
  safety: Object.freeze({
    researchOnly: true,
    rawCandlesExcluded: true,
    rawSnapshotsExcluded: true,
    executionIntentCreated: false
  })
});

export interface AsiaDisplacementFvgExternalTargetV2ObservationInput {
  opportunity: MarketEpisodeOpportunity;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
  closedCandleTimestamp: string;
}

export interface AsiaDisplacementFvgExternalTargetV2ObservationEligibility {
  eligible: boolean;
  profileId: typeof ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID;
  blockers: string[];
  freshCohort: true;
  inheritedOutcomeCount: 0;
  paperDemoEligible: false;
  authority: typeof MARKET_EPISODE_AUTHORITY;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const trustedMt5Provider = (value: string) => value === "mt5_read_only" || value === "mt5_push_feed";

export function assessAsiaDisplacementFvgExternalTargetV2Observation(
  input: AsiaDisplacementFvgExternalTargetV2ObservationInput
): AsiaDisplacementFvgExternalTargetV2ObservationEligibility {
  const opportunity = input.opportunity;
  const blockers = [
    !trustedMt5Provider(input.sourceProvider) ? "A trusted MT5 read-only or MT5 push-feed source is required." : undefined,
    input.requestedSymbol !== "MNQ" || input.brokerSymbol !== "USTECH"
      ? "Asia displacement/FVG external-target v2 is frozen to MNQ-style research using USTECH."
      : undefined,
    input.timeframe.toLowerCase() !== "5m" ? "The frozen v2 timeframe is 5m." : undefined,
    !input.sourceFingerprint || /missing|mock|sample|fixture|demo/i.test(input.sourceFingerprint)
      ? "A non-mock MT5 source fingerprint is required."
      : undefined,
    opportunity.family !== "displacement_fvg_continuation"
      ? "Opportunity family is not displacement/FVG continuation."
      : undefined,
    opportunity.session !== "asia" ? "Opportunity did not form during the Asia session." : undefined,
    opportunity.side !== "short" ? "Opportunity direction is not short." : undefined,
    opportunity.targetBasis !== "external_liquidity" ? "The target was not causal external liquidity." : undefined,
    !finite(opportunity.entryReference) || !finite(opportunity.invalidationReference) || !finite(opportunity.targetReference)
      ? "A complete causal entry, invalidation, and target are required."
      : undefined,
    !finite(opportunity.rr) || opportunity.rr < 1.5 ? "Causal reward/risk must be at least 1.5R." : undefined,
    !opportunity.researchOnly ? "Only research-only opportunities may enter the forward ledger." : undefined,
    Date.parse(opportunity.detectedAt) !== Date.parse(input.closedCandleTimestamp)
      ? "The opportunity was not detected on the current closed candle."
      : undefined,
    Date.parse(input.closedCandleTimestamp) <= Date.parse(asiaDisplacementFvgExternalTargetV2ResearchHypothesis.createdAt)
      ? "The closed candle predates the frozen v2 research hypothesis."
      : undefined
  ].filter((value): value is string => Boolean(value));
  return {
    eligible: blockers.length === 0,
    profileId: ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID,
    blockers,
    freshCohort: true,
    inheritedOutcomeCount: 0,
    paperDemoEligible: false,
    authority: MARKET_EPISODE_AUTHORITY
  };
}
