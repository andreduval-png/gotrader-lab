import type { ForwardScenarioMap } from "@/lib/forwardScenario";
import {
  CMD_LONDON_LONG_FROZEN_PROFILE_ID,
  CMD_LONDON_LONG_PROFILE_AUTHORITY,
  type CmdLondonLongForwardEligibility,
  type CmdLondonLongFrozenProfile
} from "./cmdLondonLongProfileTypes";
import type { MarketEpisodeOpportunity } from "./marketEpisodeTypes";

export const cmdLondonLongFrozenProfile: CmdLondonLongFrozenProfile = Object.freeze({
  profileId: CMD_LONDON_LONG_FROZEN_PROFILE_ID,
  profileVersion: "v1",
  frozenAt: "2026-07-18T13:30:00.000Z",
  validationCutoff: "2026-07-17T23:55:00.000Z",
  discoveryWindowDays: 90,
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  status: "retired_causal_reconstruction_leakage",
  retirementReason:
    "The v1 discovery cohort used full-day volatility normalization that included candles after each historical signal. Causal rolling normalization removed the reported edge, so v1 cannot issue forward observations.",
  selector: Object.freeze({
    family: "consolidation_manipulation_distribution",
    session: "london",
    side: "long",
    requireCausalEntryInvalidationTarget: true
  }),
  discoveryEvidence: Object.freeze({
    candidateCount: 60,
    completedCount: 32,
    targetFirstRate: 0.4063,
    averageRealizedR: 0.0942,
    profitFactor: 1.1586,
    independentDates: 35,
    activeWindows: 3
  }),
  researchOnly: true,
  mutationPolicy: "frozen_profile_no_mutation",
  autoPromotionAllowed: false,
  paperDemoEligible: false,
  authority: CMD_LONDON_LONG_PROFILE_AUTHORITY
});

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const mockSource = (value: string) => /mock|sample|fixture|demo/i.test(value);

export function matchesCmdLondonLongFrozenProfile(opportunity: MarketEpisodeOpportunity) {
  return opportunity.family === cmdLondonLongFrozenProfile.selector.family &&
    opportunity.session === cmdLondonLongFrozenProfile.selector.session &&
    opportunity.side === cmdLondonLongFrozenProfile.selector.side &&
    finite(opportunity.entryReference) &&
    finite(opportunity.invalidationReference) &&
    finite(opportunity.targetReference) &&
    finite(opportunity.rr);
}

export function assessCmdLondonLongForwardScenario(map: ForwardScenarioMap): CmdLondonLongForwardEligibility {
  const scenario = map.primaryScenario;
  const entryZone = scenario.conditionalEntryPlan.zone;
  const stop = scenario.conditionalStopPlan.referencePrice;
  const target = scenario.conditionalTargetPlan.references.find((item) => finite(item.price))?.price;
  const blockers = [
    cmdLondonLongFrozenProfile.retirementReason,
    mockSource(map.sourceProvider) ? "Mock/sample sources cannot create CMD forward observations." : undefined,
    map.sourceProvider !== cmdLondonLongFrozenProfile.sourceProvider
      ? `Source must be ${cmdLondonLongFrozenProfile.sourceProvider}.`
      : undefined,
    map.requestedSymbol !== cmdLondonLongFrozenProfile.requestedSymbol || map.brokerSymbol !== cmdLondonLongFrozenProfile.brokerSymbol
      ? "CMD London-long v1 is frozen to MNQ-style research using USTECH."
      : undefined,
    map.timeframe.toLowerCase() !== cmdLondonLongFrozenProfile.timeframe
      ? `Timeframe must be ${cmdLondonLongFrozenProfile.timeframe}.`
      : undefined,
    !map.sourceFingerprint ? "Source fingerprint is required." : undefined,
    Date.parse(map.timestamp) <= Date.parse(cmdLondonLongFrozenProfile.validationCutoff)
      ? "The scenario is not after the frozen validation cutoff."
      : undefined,
    map.currentSession.toLowerCase() !== "london" ? "Current session is not London." : undefined,
    scenario.scenarioFamily !== "consolidation_raid_displacement"
      ? "Primary scenario is not consolidation raid/displacement."
      : undefined,
    scenario.direction !== "bullish" ? "Primary scenario is not bullish." : undefined,
    map.currentDecisionState !== "confirmed_setup"
      ? "A confirmed closed-candle setup is required for forward observation."
      : undefined,
    !entryZone || !finite(stop) || !finite(target)
      ? "A complete causal entry zone, invalidation, and target are required."
      : undefined
  ].filter((value): value is string => Boolean(value));

  return {
    eligible: blockers.length === 0,
    observationOnly: true,
    profileId: CMD_LONDON_LONG_FROZEN_PROFILE_ID,
    profileStatus: cmdLondonLongFrozenProfile.status,
    blockers,
    probabilitySource: "heuristic_uncalibrated",
    paperDemoEligible: false,
    authority: CMD_LONDON_LONG_PROFILE_AUTHORITY
  };
}
