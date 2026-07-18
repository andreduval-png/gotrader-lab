import type { MarketEpisodeOpportunity } from "./marketEpisodeTypes";

export const CMD_LONDON_LONG_PROFILE_AUTHORITY = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;

export const CMD_LONDON_LONG_FROZEN_PROFILE_ID = "cmd_london_long_episode_v1" as const;

export interface CmdLondonLongFrozenProfile {
  profileId: typeof CMD_LONDON_LONG_FROZEN_PROFILE_ID;
  profileVersion: "v1";
  frozenAt: string;
  validationCutoff: string;
  discoveryWindowDays: 90;
  sourceProvider: "mt5_read_only";
  requestedSymbol: "MNQ";
  brokerSymbol: "USTECH";
  timeframe: "5m";
  status: "retired_causal_reconstruction_leakage";
  retirementReason: string;
  selector: Readonly<{
    family: "consolidation_manipulation_distribution";
    session: "london";
    side: "long";
    requireCausalEntryInvalidationTarget: true;
  }>;
  discoveryEvidence: Readonly<{
    candidateCount: number;
    completedCount: number;
    targetFirstRate: number;
    averageRealizedR: number;
    profitFactor: number;
    independentDates: number;
    activeWindows: number;
  }>;
  researchOnly: true;
  mutationPolicy: "frozen_profile_no_mutation";
  autoPromotionAllowed: false;
  paperDemoEligible: false;
  authority: typeof CMD_LONDON_LONG_PROFILE_AUTHORITY;
}

export interface CmdLondonLongReturnSummary {
  candidateCount: number;
  completedCount: number;
  targetFirst: number;
  invalidationFirst: number;
  expired: number;
  targetFirstRate: number | null;
  averageR: number | null;
  medianR: number | null;
  profitFactor: number | null;
  maxDrawdownR: number | null;
  expectancyLower95: number | null;
  expectancyUpper95: number | null;
  independentDates: number;
}

export interface CmdLondonLongCostSensitivity extends CmdLondonLongReturnSummary {
  additionalCostR: 0 | 0.25 | 0.5 | 1;
}

export interface CmdLondonLongChronologicalWindow extends CmdLondonLongReturnSummary {
  windowIndex: number;
  from: string;
  to: string;
  passedUnstressed: boolean;
}

export type CmdLondonLongValidationVerdict =
  | "blocked_source"
  | "insufficient_data"
  | "retrospective_failed"
  | "retrospective_supported_needs_forward";

export interface CmdLondonLongFrozenValidationResult {
  profileId: typeof CMD_LONDON_LONG_FROZEN_PROFILE_ID;
  generatedAt: string;
  method: "frozen_profile_preselection_challenge";
  verdict: CmdLondonLongValidationVerdict;
  selectionBiasDisclosure: string;
  source: {
    provider: string;
    requestedSymbol: string;
    brokerSymbol: string;
    timeframe: string;
    sourceFingerprint: string;
    firstTimestamp: string;
    lastTimestamp: string;
  };
  discoveryWindowStart: string;
  preSelectionChallenge: CmdLondonLongReturnSummary;
  discoveryEra: CmdLondonLongReturnSummary;
  pooledHistory: CmdLondonLongReturnSummary;
  preSelectionCostSensitivity: CmdLondonLongCostSensitivity[];
  chronologicalWindows: CmdLondonLongChronologicalWindow[];
  activeChallengeWindows: number;
  positiveChallengeWindows: number;
  blockers: string[];
  forwardObservationEligible: boolean;
  forwardCalibrationEligible: false;
  paperDemoEligible: false;
  nextAction: string;
  authority: typeof CMD_LONDON_LONG_PROFILE_AUTHORITY;
  safety: {
    researchOnly: true;
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    executionIntentCreated: false;
    autoPromotionAllowed: false;
  };
}

export interface CmdLondonLongValidationInput {
  opportunities: MarketEpisodeOpportunity[];
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint: string;
  firstTimestamp: string;
  lastTimestamp: string;
  discoveryWindowDays?: number;
  chronologicalWindowDays?: number;
  minimumCompletedChallenge?: number;
  minimumIndependentDates?: number;
  minimumActiveWindows?: number;
}

export interface CmdLondonLongForwardEligibility {
  eligible: boolean;
  observationOnly: true;
  profileId: typeof CMD_LONDON_LONG_FROZEN_PROFILE_ID;
  profileStatus: CmdLondonLongFrozenProfile["status"];
  blockers: string[];
  probabilitySource: "heuristic_uncalibrated";
  paperDemoEligible: false;
  authority: typeof CMD_LONDON_LONG_PROFILE_AUTHORITY;
}
