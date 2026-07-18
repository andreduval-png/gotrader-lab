import type {
  MarketEpisodeOpportunityFamily,
  MarketEpisodeSession
} from "./marketEpisodeTypes";

export const MARKET_EPISODE_VARIANT_AUTHORITY = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;

export type MarketEpisodeVariantClassification =
  | "promising_for_validation"
  | "weak_edge_needs_filtering"
  | "negative_expectancy"
  | "duplicate_cohort"
  | "insufficient_data";

export interface MarketEpisodeVariantCandidate {
  variantId: string;
  candidateProfileName: string;
  cohortFingerprint: string;
  duplicateCohortOf?: string;
  family: MarketEpisodeOpportunityFamily;
  session?: MarketEpisodeSession;
  side?: "long" | "short";
  candidateCount: number;
  completedCount: number;
  targetFirstRate: number | null;
  averageRealizedR: number | null;
  profitFactor: number | null;
  independentDates: number;
  activeWindows: number;
  classification: MarketEpisodeVariantClassification;
  blockers: string[];
  recommendation: string;
  requiredValidations: ["chronological_replay", "walk_forward", "cost_model", "forward_prediction"];
  autoPromotionAllowed: false;
  authority: typeof MARKET_EPISODE_VARIANT_AUTHORITY;
}

export interface MarketEpisodeVariantDiscovery {
  generatedAt: string;
  evaluatedVariantCount: number;
  promisingVariantCount: number;
  variants: MarketEpisodeVariantCandidate[];
  nextAction: string;
  safety: {
    researchOnly: true;
    rawCandlesExcluded: true;
    proposalsAreDraftOnly: true;
    autoPromotionAllowed: false;
  };
  authority: typeof MARKET_EPISODE_VARIANT_AUTHORITY;
}
