import type { MARKET_EPISODE_AUTHORITY } from "./marketEpisodeTypes";

export const ASIA_DISPLACEMENT_FVG_SHORT_V1_ID =
  "asia_displacement_fvg_short_v1_research" as const;

export type AsiaDisplacementFvgStabilityClassification =
  | "promising_for_forward_freeze"
  | "unstable"
  | "negative_after_costs"
  | "insufficient_data";

export interface AsiaDisplacementFvgPeriodSummary {
  candidateCount: number;
  completedCount: number;
  targetFirstRate: number | null;
  averageR: number | null;
  profitFactor: number | null;
  expectancyLower95: number | null;
  averageRWithCost025: number | null;
  profitFactorWithCost025: number | null;
  averageRWithCost05: number | null;
  profitFactorWithCost05: number | null;
  independentDates: number;
  activeWindows: number;
  externalTargetRate: number | null;
}

export interface AsiaDisplacementFvgStabilityAudit {
  profileId: typeof ASIA_DISPLACEMENT_FVG_SHORT_V1_ID;
  generatedAt: string;
  splitTimestamp: string;
  preSelection: AsiaDisplacementFvgPeriodSummary;
  discovery: AsiaDisplacementFvgPeriodSummary;
  pooled: AsiaDisplacementFvgPeriodSummary;
  classification: AsiaDisplacementFvgStabilityClassification;
  blockers: string[];
  selectionContaminated: true;
  untouchedOosEvidence: false;
  forwardObservationEligible: false;
  paperDemoEligible: false;
  nextAction: string;
  authority: typeof MARKET_EPISODE_AUTHORITY;
  safety: {
    researchOnly: true;
    rawCandlesExcluded: true;
    autoPromotionAllowed: false;
    executionIntentCreated: false;
  };
}
