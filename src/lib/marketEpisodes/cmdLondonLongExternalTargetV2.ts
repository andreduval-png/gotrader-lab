import { CMD_LONDON_LONG_PROFILE_AUTHORITY } from "./cmdLondonLongProfileTypes";
import type { MarketEpisodeOpportunity } from "./marketEpisodeTypes";

export const CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID = "cmd_london_long_external_target_v2_research" as const;

export const cmdLondonLongExternalTargetV2ResearchHypothesis = Object.freeze({
  profileId: CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID,
  profileVersion: "v2",
  status: "frozen_research_hypothesis_requires_forward_validation",
  createdAt: "2026-07-18T00:00:00.000Z",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  selector: Object.freeze({
    family: "consolidation_manipulation_distribution",
    session: "london",
    side: "long",
    targetBasis: "external_liquidity",
    requireCausalEntryInvalidationTarget: true
  }),
  evidence: Object.freeze({
    preSelectionCompleted: 19,
    preSelectionAverageR: 0.3372,
    preSelectionAverageRWithCost025: 0.0872,
    preSelectionProfitFactorWithCost025: 1.1472,
    discoveryCompleted: 19,
    discoveryAverageR: 0.527,
    discoveryAverageRWithCost025: 0.277,
    discoveryProfitFactorWithCost025: 1.5263,
    pooledCompleted: 38,
    pooledAverageR: 0.4321,
    pooledAverageRWithCost025: 0.1821,
    pooledProfitFactorWithCost025: 1.3256,
    pooledExpectancyLower95: 0.0157,
    independentDates: 35,
    activeWindows: 6
  }),
  limitation:
    "This variant was selected after a causal regime-difference audit. Period-level lower 95% expectancy bounds remain below zero, so untouched forward outcomes are required before any progression review.",
  nextAction:
    "Collect untouched detector-specific observations from closed-candle CMD opportunities whose targetBasis is external_liquidity. Do not infer eligibility from a generic scenario map.",
  executable: false,
  forwardObservationPolicy: "closed_candle_detector_only",
  genericScenarioObservationEligible: false,
  detectorSpecificForwardObservationEligible: true,
  inheritedOutcomeCount: 0,
  paperDemoEligible: false,
  autoPromotionAllowed: false,
  mutationPolicy: "frozen_hypothesis_new_version_required",
  authority: CMD_LONDON_LONG_PROFILE_AUTHORITY,
  safety: Object.freeze({
    researchOnly: true,
    rawCandlesExcluded: true,
    rawSnapshotsExcluded: true,
    executionIntentCreated: false
  })
});

export interface CmdLondonLongExternalTargetV2ObservationInput {
  opportunity: MarketEpisodeOpportunity;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
  closedCandleTimestamp: string;
}

export interface CmdLondonLongExternalTargetV2ObservationEligibility {
  eligible: boolean;
  profileId: typeof CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID;
  blockers: string[];
  freshCohort: true;
  inheritedOutcomeCount: 0;
  paperDemoEligible: false;
  authority: typeof CMD_LONDON_LONG_PROFILE_AUTHORITY;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const trustedMt5Provider = (value: string) => value === "mt5_read_only" || value === "mt5_push_feed";

export function assessCmdLondonLongExternalTargetV2Observation(
  input: CmdLondonLongExternalTargetV2ObservationInput
): CmdLondonLongExternalTargetV2ObservationEligibility {
  const opportunity = input.opportunity;
  const blockers = [
    !trustedMt5Provider(input.sourceProvider) ? "A trusted MT5 read-only or MT5 push-feed source is required." : undefined,
    input.requestedSymbol !== "MNQ" || input.brokerSymbol !== "USTECH"
      ? "CMD London-long external-target v2 is frozen to MNQ-style research using USTECH."
      : undefined,
    input.timeframe.toLowerCase() !== "5m" ? "The frozen v2 timeframe is 5m." : undefined,
    !input.sourceFingerprint || /missing|mock|sample|fixture|demo/i.test(input.sourceFingerprint)
      ? "A non-mock MT5 source fingerprint is required."
      : undefined,
    opportunity.family !== "consolidation_manipulation_distribution" ? "Opportunity family is not CMD." : undefined,
    opportunity.session !== "london" ? "Opportunity did not form during the London session." : undefined,
    opportunity.side !== "long" ? "Opportunity direction is not long." : undefined,
    opportunity.targetBasis !== "external_liquidity" ? "The target was not causal external liquidity." : undefined,
    !finite(opportunity.entryReference) || !finite(opportunity.invalidationReference) || !finite(opportunity.targetReference)
      ? "A complete causal entry, invalidation, and target are required."
      : undefined,
    !finite(opportunity.rr) || opportunity.rr < 1.5 ? "Causal reward/risk must be at least 1.5R." : undefined,
    !opportunity.researchOnly ? "Only research-only opportunities may enter the forward ledger." : undefined,
    Date.parse(opportunity.detectedAt) !== Date.parse(input.closedCandleTimestamp)
      ? "The opportunity was not detected on the current closed candle."
      : undefined,
    Date.parse(input.closedCandleTimestamp) <= Date.parse(cmdLondonLongExternalTargetV2ResearchHypothesis.createdAt)
      ? "The closed candle predates the frozen v2 research hypothesis."
      : undefined
  ].filter((value): value is string => Boolean(value));
  return {
    eligible: blockers.length === 0,
    profileId: CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID,
    blockers,
    freshCohort: true,
    inheritedOutcomeCount: 0,
    paperDemoEligible: false,
    authority: CMD_LONDON_LONG_PROFILE_AUTHORITY
  };
}
