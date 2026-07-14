export type ForwardMarketPhase =
  | "accumulation"
  | "manipulation"
  | "displacement"
  | "retracement"
  | "consolidation"
  | "expansion"
  | "unknown";

export type ForwardDecisionState =
  | "confirmed_setup"
  | "developing_setup"
  | "anticipated_scenario"
  | "wait_for_confirmation"
  | "invalidated"
  | "no_trade";

export type ForwardScenarioFamily =
  | "post_london_liquidity_sweep_reversal"
  | "ny_am_mitigation_reversal"
  | "ifvg_fresh_retest_continuation"
  | "ifvg_fresh_retest_reversal"
  | "london_12am_open_expansion"
  | "consolidation_raid_displacement"
  | "range_reversion_scalp"
  | "model_1_continuation"
  | "no_trade_waiting_for_liquidity";

export type ForwardScenarioDirection = "bullish" | "bearish" | "neutral";
export type ForwardScenarioSetupType = "scalp" | "intraday_expansion" | "larger_setup" | "no_trade";
export type ForwardScenarioProbabilityBand = "low" | "moderate" | "high";

export interface ForwardConditionalEntryPlan {
  status: "conditional" | "unavailable";
  label: "Conditional entry zone if confirmation appears";
  zone?: { lower: number; upper: number };
  trigger: string;
  researchOnly: true;
}

export interface ForwardConditionalStopPlan {
  status: "conditional" | "unavailable";
  label: "Conditional stop reference";
  referencePrice?: number;
  condition: string;
  researchOnly: true;
}

export interface ForwardConditionalTargetPlan {
  status: "conditional" | "unavailable";
  label: "Conditional target references";
  references: Array<{ label: string; price?: number }>;
  condition: string;
  researchOnly: true;
}

export interface ForwardScenario {
  scenarioId: string;
  scenarioFamily: ForwardScenarioFamily;
  direction: ForwardScenarioDirection;
  setupType: ForwardScenarioSetupType;
  probabilityBand: ForwardScenarioProbabilityBand;
  confidence: number;
  thesis: string;
  liquidityDraw: string;
  expectedSequence: string[];
  requiredConfirmations: string[];
  invalidationConditions: string[];
  conditionalEntryPlan: ForwardConditionalEntryPlan;
  conditionalStopPlan: ForwardConditionalStopPlan;
  conditionalTargetPlan: ForwardConditionalTargetPlan;
  whyNotConfirmedYet: string[];
  whatWouldUpgradeThis: string[];
  whatWouldDowngradeThis: string[];
  safetyNotice:
    | "Research-only scenario forecast. Not a confirmed setup. No execution authority."
    | "Research-only confirmed setup. Paper-demo/live execution still blocked unless readiness gates pass.";
}

export interface ForwardScenarioMap {
  scenarioMapId: string;
  timestamp: string;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint?: string;
  currentSession: string;
  marketPhase: ForwardMarketPhase;
  currentDecisionState: ForwardDecisionState;
  primaryScenario: ForwardScenario;
  secondaryScenario?: ForwardScenario;
  invalidationScenario: ForwardScenario;
  missingConfirmations: string[];
  nextEvidenceToWatch: string[];
  recommendedResearchTest?: ForwardScenarioResearchRecommendation;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
  safety: {
    researchOnly: true;
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    autoApplyAllowed: false;
    autoPromotionAllowed: false;
  };
}

export interface ForwardScenarioMapInput {
  timestamp?: string;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  sourceFingerprint?: string;
  currentSession?: string;
  regime?: string;
  evidenceQuality?: number;
  marketPhase?: ForwardMarketPhase;
  direction?: ForwardScenarioDirection;
  confirmedSetup?: boolean;
  invalidated?: boolean;
  liquidityDraw?: string;
  liquidityDrawDirection?: ForwardScenarioDirection;
  liquiditySwept?: boolean;
  mitigationDetected?: boolean;
  displacementConfirmed?: boolean;
  consolidationDetected?: boolean;
  rangeBound?: boolean;
  twelveAmOpen?: number;
  sundayOpen?: number;
  londonRange?: { high?: number; low?: number };
  recentRange?: { high?: number; low?: number };
  premiumDiscountContext?: string;
  ifvgFreshRetestState?: "absent" | "partial" | "confirmed" | "invalidated";
  ifvgDirection?: ForwardScenarioDirection;
  ifvgZone?: { lower: number; upper: number };
  ifvgProfileStrength?: "unvalidated" | "promising" | "frozen_validated";
  model1State?: "absent" | "partial" | "confirmed" | "invalidated";
  grinchProfile?: string;
  conditionalEntryZone?: { lower: number; upper: number };
  conditionalStopReference?: number;
  conditionalTargets?: Array<{ label: string; price?: number }>;
  missingConfirmations?: string[];
  blockers?: string[];
  warnings?: string[];
}

export interface ForwardScenarioResearchRecommendation {
  action: "evaluate_candidate_family" | "collect_more_evidence" | "fork_new_profile";
  scenarioFamily: ForwardScenarioFamily;
  candidateFamily?: "ifvg_fresh_retest_v3_research" | "reversal_expansion_confirmation";
  reason: string;
  requiredValidations: ["replay", "walk_forward", "evidence", "maturity", "regime_consistency"];
  mutateFrozenProfile: false;
  suggestedProfileFork?: "ifvg_fresh_retest_v4_candidate";
  autoApplyAllowed: false;
  autoPromotionAllowed: false;
}
