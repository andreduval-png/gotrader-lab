import {
  FORWARD_EVIDENCE_AUTHORITY,
  IFVG_FRESH_RETEST_V3_PROFILE_ID,
  IFVG_FRESH_RETEST_V4_FORK_ID,
  type FrozenProfileForkProposalIntent,
  type FrozenProfileMutationReview,
  type FrozenResearchProfile
} from "./forwardEvidenceTypes";

export const ifvgFreshRetestV3FrozenProfile: FrozenResearchProfile = Object.freeze({
  profileId: IFVG_FRESH_RETEST_V3_PROFILE_ID,
  profileVersion: "v3",
  frozenAt: "2026-07-14T05:50:00.000Z",
  validationCutoff: "2026-07-14T04:40:00.000Z",
  validationSourceDescription:
    "MT5 read-only USTECH CFD/proxy candles for MNQ-style research; explicit 180-day 5m causal validation.",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  historicalValidationDays: 180,
  evidence: Object.freeze({
    candleCount: 34_989,
    completedTrades: 172,
    targetFirstRate: 0.5523,
    averageR: 2.805,
    profitFactor: 5.979,
    uniqueDates: 95,
    positiveRollingWindows: 11,
    totalRollingWindows: 11,
    frozenOosWindowsPassed: 2,
    frozenOosWindowCount: 2,
    oosTrades: 64,
    oosAverageR: 3.458,
    oosProfitFactor: 8.081,
    oosAdditionalCostR: 2.958,
    monteCarloRobustness: "strong"
  }),
  frozenParameters: Object.freeze({
    strategyProfile: IFVG_FRESH_RETEST_V3_PROFILE_ID,
    warmupCandles: 100,
    decisionInterval: 1,
    maxBarsToResolveTrade: 48,
    visibleWindow: 80,
    minimumRR: 2,
    allowLong: true,
    allowShort: true,
    requireValidationEligibleBaseIfvg: true,
    requireUnusedZoneBeforeInversion: true,
    requireCleanRetest: true,
    requireLatestClosedCandleRetest: true,
    allowPostEntryConfirmation: false
  }),
  mutationPolicy: "frozen_profile_no_mutation",
  futureChangesPolicy: "fork_new_profile_version_only",
  suggestedForkProfileId: IFVG_FRESH_RETEST_V4_FORK_ID,
  researchOnly: true,
  autoPromotionAllowed: false,
  authority: FORWARD_EVIDENCE_AUTHORITY
});

export const frozenResearchProfileRegistry = Object.freeze({
  [IFVG_FRESH_RETEST_V3_PROFILE_ID]: ifvgFreshRetestV3FrozenProfile
});

export const getFrozenResearchProfile = (profileId: string) =>
  profileId === IFVG_FRESH_RETEST_V3_PROFILE_ID
    ? ifvgFreshRetestV3FrozenProfile
    : undefined;

export const isFrozenResearchProfile = (profileId?: string) =>
  profileId === IFVG_FRESH_RETEST_V3_PROFILE_ID;

export const reviewFrozenProfileMutation = (input: {
  baseProfileId?: string;
  targetProfileId?: string;
  parameterMutationRequested: boolean;
}): FrozenProfileMutationReview => {
  const touchesFrozenProfile =
    isFrozenResearchProfile(input.baseProfileId) || isFrozenResearchProfile(input.targetProfileId);

  if (!touchesFrozenProfile) {
    return {
      blocked: false,
      directMutationAllowed: false,
      forkProposalAllowed: false,
      authority: FORWARD_EVIDENCE_AUTHORITY
    };
  }

  return {
    frozenProfileId: IFVG_FRESH_RETEST_V3_PROFILE_ID,
    blocked: input.parameterMutationRequested || isFrozenResearchProfile(input.targetProfileId),
    directMutationAllowed: false,
    forkProposalAllowed: true,
    requiredForkProfileId: IFVG_FRESH_RETEST_V4_FORK_ID,
    reason:
      "IFVG v3 is frozen. Further changes require a new profile version and forward evidence.",
    authority: FORWARD_EVIDENCE_AUTHORITY
  };
};

export const buildFrozenProfileForkProposalIntent = (): FrozenProfileForkProposalIntent => ({
  sourceProfileId: IFVG_FRESH_RETEST_V3_PROFILE_ID,
  proposedProfileId: IFVG_FRESH_RETEST_V4_FORK_ID,
  status: "draft_only",
  validationRequired: true,
  forwardEvidenceRequired: true,
  autoApplyAllowed: false,
  authority: FORWARD_EVIDENCE_AUTHORITY
});
