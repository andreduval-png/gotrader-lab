import type { CurrentOpportunity, CurrentOpportunityAuthority } from "@/lib/currentOpportunity/currentOpportunityTypes";
import type {
  CharterCandidateAttribution,
  CharterModelNumber,
  CharterProfileDefinition,
  CharterProfileRuntimeItem,
  CharterProfileRuntimeSnapshot
} from "./ictCharterProfileTypes";

const authority: CurrentOpportunityAuthority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

export const CHARTER_PROFILE_REGISTRY: readonly CharterProfileDefinition[] = Object.freeze([
  { charterModelNumber: 1, charterIdentityId: "gotrader.ict.charter.model-1.v1", charterProfileId: "charter_model_1_intraday_profile_v1", label: "Charter 1 Intraday", classification: "owner_profile", ownerStrategyId: "ict_2022_model_v1", reason: "ICT 2022 owns the intraday raid-displacement-retracement candidate.", researchValidated: false },
  { charterModelNumber: 2, charterIdentityId: "gotrader.ict.charter.model-2.v1", charterProfileId: "charter_model_2_short_term_profile_v1", label: "Charter 2 Short Term", classification: "owner_profile", ownerStrategyId: "ict_2022_model_v1", reason: "ICT 2022 owns short-term executable delivery; MMXM remains context.", researchValidated: false },
  { charterModelNumber: 3, charterIdentityId: "gotrader.ict.charter.model-3.v1", charterProfileId: "charter_model_3_mmxm_swing_context_v1", label: "Charter 3 Swing", classification: "framework_only", ownerFrameworkId: "mmxm_delivery_framework_v1", reason: "Swing MMXM context cannot select a directional engine.", researchValidated: false },
  { charterModelNumber: 4, charterIdentityId: "gotrader.ict.charter.model-4.v1", charterProfileId: "charter_model_4_mmxm_position_context_v1", label: "Charter 4 Position", classification: "framework_only", ownerFrameworkId: "mmxm_delivery_framework_v1", reason: "Position horizon changes context, not MMXM actionability.", researchValidated: false },
  { charterModelNumber: 5, charterIdentityId: "gotrader.ict.charter.model-5.v1", charterProfileId: "charter_model_5_source_blocked_v1", label: "Charter 5", classification: "source_blocked", reason: "CBDR, Asian-range, FLOUT, and terminal geometry remain source-limited.", researchValidated: false },
  { charterModelNumber: 6, charterIdentityId: "gotrader.ict.charter.model-6.v1", charterProfileId: "charter_model_6_mmbm_profile_v1", label: "Charter 6 MMBM", classification: "owner_profile", ownerStrategyId: "ict_market_maker_buy_model_v1", reason: "MMBM owns the buy-side universal model candidate.", researchValidated: false },
  { charterModelNumber: 7, charterIdentityId: "gotrader.ict.charter.model-7.v1", charterProfileId: "charter_model_7_mmsm_profile_v1", label: "Charter 7 MMSM", classification: "owner_profile", ownerStrategyId: "ict_market_maker_sell_model_v1", reason: "MMSM owns the sell-side universal model candidate.", researchValidated: false },
  { charterModelNumber: 8, charterIdentityId: "gotrader.ict.charter.model-8.v1", charterProfileId: "charter_model_8_weekly_planning_context_v1", label: "Charter 8 Planning", classification: "framework_only", ownerFrameworkId: "gotrader.ict.charter.model8-context.v1", reason: "Weekly planning and risk context only.", researchValidated: false },
  { charterModelNumber: 9, charterIdentityId: "gotrader.ict.charter.model-9.v1", charterProfileId: "charter_model_9_osok_mapping_v1", label: "Charter 9 OSOK", classification: "source_blocked", ownerStrategyId: "ict-one-shot-one-kill", reason: "OSOK remains source-blocked in the converged runtime; Charter 9 cannot revive it.", researchValidated: false },
  { charterModelNumber: 10, charterIdentityId: "gotrader.ict.charter.model-10.v1", charterProfileId: "charter_model_10_turtle_soup_erl_profile_v1", label: "Charter 10 Turtle Soup", classification: "source_blocked", ownerStrategyId: "turtle_soup_v1", reason: "Turtle Soup is not admitted as an ordinary canonical runtime citizen.", researchValidated: false },
  { charterModelNumber: 11, charterIdentityId: "gotrader.ict.charter.model-11.v1", charterProfileId: "charter_model_11_bread_and_butter_day_profile_v1", label: "Charter 11 B&B Day", classification: "source_blocked", ownerFrameworkId: "ict-bread-and-butter-directional-owner.v1", reason: "Bread & Butter remains source-blocked in the converged runtime.", researchValidated: false },
  { charterModelNumber: 12, charterIdentityId: "gotrader.ict.charter.model-12.v1", charterProfileId: "charter_model_12_bread_and_butter_scalp_profile_v1", label: "Charter 12 B&B Scalp", classification: "source_blocked", ownerFrameworkId: "ict-bread-and-butter-directional-owner.v1", reason: "Bread & Butter remains source-blocked in the converged runtime.", researchValidated: false }
]);

const intradayTimeframes = new Set(["1m", "2m", "3m", "5m", "10m", "15m", "30m"]);

const selectedOwnerProfile = (opportunity: CurrentOpportunity): CharterProfileDefinition | undefined => {
  if (opportunity.strategyId === "ict_2022_model_v1") {
    const modelNumber: CharterModelNumber = intradayTimeframes.has(opportunity.timeframe.toLowerCase()) ? 1 : 2;
    return CHARTER_PROFILE_REGISTRY.find((profile) => profile.charterModelNumber === modelNumber);
  }
  return CHARTER_PROFILE_REGISTRY.find(
    (profile) => profile.classification === "owner_profile" && profile.ownerStrategyId === opportunity.strategyId
  );
};

const attributionFor = (
  opportunity: CurrentOpportunity,
  profile: CharterProfileDefinition
): CharterCandidateAttribution => ({
  charterModelNumber: profile.charterModelNumber,
  charterIdentityId: profile.charterIdentityId,
  charterProfileId: profile.charterProfileId,
  ownerStrategyId: opportunity.strategyId,
  ownerCandidateId: opportunity.candidateId,
  attributionMode: "owner_candidate_metadata",
  researchValidated: false,
  productionAdoptionAllowed: false,
  authority
});

export const attributeCharterOwnerCandidates = (
  opportunities: readonly CurrentOpportunity[]
): CurrentOpportunity[] => opportunities.map((opportunity) => {
  if (!opportunity.canonicalCandidate) return opportunity;
  const profile = selectedOwnerProfile(opportunity);
  if (!profile || profile.ownerStrategyId !== opportunity.strategyId) return opportunity;
  return {
    ...opportunity,
    charterProfile: attributionFor(opportunity, profile)
  };
});

const runtimeItem = (
  definition: CharterProfileDefinition,
  ownerCandidate?: CurrentOpportunity
): CharterProfileRuntimeItem => {
  const ownerActive = definition.classification === "owner_profile" && Boolean(ownerCandidate);
  const runtimeStatus = definition.classification === "framework_only"
    ? "framework_only" as const
    : definition.classification === "source_blocked"
      ? "source_blocked" as const
      : ownerActive
        ? "owner_candidate_active" as const
        : "owner_candidate_unavailable" as const;
  return {
    charterModelNumber: definition.charterModelNumber,
    charterIdentityId: definition.charterIdentityId,
    charterProfileId: definition.charterProfileId,
    label: definition.label,
    classification: definition.classification,
    runtimeStatus,
    ownerStrategyId: definition.ownerStrategyId,
    ownerFrameworkId: definition.ownerFrameworkId,
    ownerCandidateId: ownerCandidate?.candidateId,
    detail: ownerActive
      ? `Attributed to existing ${ownerCandidate?.strategyId} candidate; owner-native geometry and actionability are unchanged.`
      : definition.reason,
    blocker: runtimeStatus === "source_blocked"
      ? definition.reason
      : runtimeStatus === "owner_candidate_unavailable"
        ? "No matching canonical owner candidate is present in this read."
        : undefined,
    candidateCapability: definition.classification === "owner_profile" ? "owner_attribution_only" : "none",
    geometryCapability: definition.classification === "owner_profile" ? "owner_native_only" : "none",
    executableStrategyAdded: false,
    emitsGeometry: false,
    researchValidated: false,
    productionAdoptionAllowed: false,
    authority
  };
};

export const buildCharterProfileRuntimeSnapshot = ({
  opportunities,
  generatedAt,
  sourceFingerprint
}: {
  opportunities: readonly CurrentOpportunity[];
  generatedAt: string;
  sourceFingerprint?: string;
}): CharterProfileRuntimeSnapshot => {
  const attributedByProfile = new Map(
    opportunities
      .filter((opportunity) => opportunity.charterProfile)
      .map((opportunity) => [opportunity.charterProfile!.charterProfileId, opportunity])
  );
  const profiles = CHARTER_PROFILE_REGISTRY.map((profile) => runtimeItem(profile, attributedByProfile.get(profile.charterProfileId)));
  return {
    version: "gotrader.ict-charter-profile-runtime.v1",
    generatedAt,
    sourceFingerprint,
    profiles,
    ownerAttributionCount: attributedByProfile.size,
    executableStrategiesAdded: 0,
    geometryProduced: 0,
    researchValidated: false,
    productionAdoptionAllowed: false,
    authority
  };
};

export const assertCharterProfileRuntimeSnapshot = (snapshot: CharterProfileRuntimeSnapshot) => {
  const serialized = JSON.stringify(snapshot);
  return {
    ok:
      snapshot.profiles.length === 12 &&
      new Set(snapshot.profiles.map((profile) => profile.charterModelNumber)).size === 12 &&
      snapshot.executableStrategiesAdded === 0 &&
      snapshot.geometryProduced === 0 &&
      snapshot.profiles.every((profile) =>
        profile.executableStrategyAdded === false &&
        profile.emitsGeometry === false &&
        profile.researchValidated === false &&
        profile.productionAdoptionAllowed === false &&
        profile.authority.executionAuthority === "none" &&
        profile.authority.brokerAuthority === "none" &&
        profile.authority.readinessOverrideAuthority === "none"
      ) &&
      !/"(entry|stop|target|riskReward|canonicalGeometry|proposedGeometry)"\s*:/i.test(serialized),
    ownerAttributionCount: snapshot.ownerAttributionCount
  };
};
