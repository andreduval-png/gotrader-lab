import type { MarketEpisodeOutcome } from "./marketEpisodeTypes";
import type { CMD_LONDON_LONG_PROFILE_AUTHORITY } from "./cmdLondonLongProfileTypes";

export type CmdLondonLongRegimePeriod = "pre_selection_challenge" | "recent_discovery_era";

export interface CmdLondonLongCausalTelemetry {
  opportunityId: string;
  detectedAt: string;
  tradingDate: string;
  period: CmdLondonLongRegimePeriod;
  sessionMinute: number;
  targetBasis: "external_liquidity" | "minimum_2r_projection";
  rr: number;
  displacementQuality: number;
  sweepQuality: number;
  consolidationQuality: number;
  fvgPresent: boolean;
  fvgQuality: number;
  cisdPresent: boolean;
  cisdQuality: number;
  sweepLeadMinutes: number | null;
  consolidationLeadMinutes: number | null;
  outcome: MarketEpisodeOutcome;
  realizedR: number | null;
  sourceFingerprint: string;
  researchOnly: true;
  authority: typeof CMD_LONDON_LONG_PROFILE_AUTHORITY;
}

export interface CmdLondonLongRegimeSummary {
  candidateCount: number;
  completedCount: number;
  targetFirstRate: number | null;
  averageR: number | null;
  medianR: number | null;
  profitFactor: number | null;
  expectancyLower95: number | null;
  independentDates: number;
  activeWindows: number;
  averageRWithCost025: number | null;
  profitFactorWithCost025: number | null;
}

export interface CmdLondonLongFeatureComparison {
  feature: string;
  preSelectionValue: number | null;
  discoveryValue: number | null;
  difference: number | null;
  interpretation: string;
}

export type CmdLondonLongVariantClassification =
  | "rejected"
  | "insufficient_data"
  | "unstable"
  | "promising_needs_new_frozen_validation";

export interface CmdLondonLongVariantAudit {
  variantId: string;
  rule: string;
  preSelection: CmdLondonLongRegimeSummary;
  discovery: CmdLondonLongRegimeSummary;
  pooled: CmdLondonLongRegimeSummary;
  classification: CmdLondonLongVariantClassification;
  blockers: string[];
  mayCreateExecutableProfile: boolean;
}

export interface CmdLondonLongRegimeAudit {
  auditId: "cmd_london_long_causal_regime_difference_v1";
  generatedAt: string;
  discoveryWindowStart: string;
  profileStatus: "retired_causal_reconstruction_leakage";
  preSelection: CmdLondonLongRegimeSummary;
  discovery: CmdLondonLongRegimeSummary;
  featureComparisons: CmdLondonLongFeatureComparison[];
  variants: CmdLondonLongVariantAudit[];
  recommendedVariantId: string | null;
  recommendation: string;
  telemetry: CmdLondonLongCausalTelemetry[];
  authority: typeof CMD_LONDON_LONG_PROFILE_AUTHORITY;
  safety: {
    researchOnly: true;
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    autoPromotionAllowed: false;
    executableProfileCreated: false;
  };
}
