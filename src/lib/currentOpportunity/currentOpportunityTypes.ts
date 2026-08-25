import type { IctSessionRaidReversalNarrative } from "../ict-strategy-suite/ictSessionRaidReversalTypes";
import type { IctIfvgFreshRetestV3CompactAssessment } from "../ict-strategy-suite/ictIfvgFreshRetestV3";
import type { CanonicalTradeGeometry } from "../tradeGeometry";
import type { IctCoreCandidateCollection } from "@/lib/ictI2";
import type { MarketMakerCandidateCollection } from "@/lib/ictI3";
import type { CanonicalCandidateSetDisposition, CanonicalRuntimeCandidate } from "./canonicalRuntimeCandidateSet";

export type CurrentOpportunityStatus =
  | "valid_candidate"
  | "forming"
  | "near_miss"
  | "rejected"
  | "no_trade"
  | "needs_more_data"
  | "diagnostic_context"
  | "market_map_only"
  | "regime_context"
  | "no_trade_context";

export type CurrentOpportunityClassification =
  | "diagnostic"
  | "forming_candidate"
  | "trade_candidate"
  | "rejected_trade_candidate"
  | "no_trade";

export type CurrentOpportunitySide = "long" | "short" | "flat";

export type CurrentOpportunityRequiredValidation =
  | "replay_required"
  | "walk_forward_required"
  | "evidence_required"
  | "paper_demo_gate_required";

export type CurrentOpportunityStrategyId =
  | "ict_cmd_short_paper_watchlist_v1"
  | "cmd_variant_research"
  | "silver_bullet_v1"
  | "silver_bullet_v2_refined_research"
  | "turtle_soup_v1"
  | "cisd_v1"
  | "ifvg_v1"
  | "ifvg_filtered_v2_research"
  | "ifvg_fresh_retest_v3_research"
  | "ict_2022_model_v1"
  | "ict_power_of_three_v1"
  | "ict_judas_swing_v1"
  | "mmxm_delivery_framework_v1"
  | "ict_market_maker_buy_model_v1"
  | "ict_market_maker_sell_model_v1"
  | "nasdaq_london_raid_ny_reversal_v1"
  | "market_map_only_diagnostic_v1";

export type CurrentOpportunityDepthPolicyStatus =
  | "validation_context_ready"
  | "swing_context_ready"
  | "tactical_only"
  | "insufficient";

export type CurrentOpportunityTopDownBiasStatus =
  | "aligned"
  | "mixed"
  | "conflicted"
  | "insufficient_data"
  | "unavailable";

export interface CurrentOpportunityTimeframeRole {
  timeframe: string;
  role: string;
  status: "loaded" | "missing";
}

export interface CurrentOpportunityAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface CurrentOpportunitySourceDepth {
  tacticalLatestCandleCount: number;
  sessionContextAvailable: boolean;
  swingContextDays: number;
  validationLookbackDays: number;
  validationContextAvailable: boolean;
  rangeHistoryAvailable: boolean;
  rangeHistoryCandleCount?: number;
  analysisDepthStatus?: string;
  depthPolicyStatus: CurrentOpportunityDepthPolicyStatus;
  depthWarnings: string[];
}

export interface CurrentOpportunityContext {
  generatedAt: string;
  requestedSymbol: string;
  brokerSymbol: string;
  primaryTimeframe: string;
  contextTimeframes: string[];
  sourceProvider: string;
  sourceFingerprint?: string;
  sourceLabel?: string;
  isMockOrSample: boolean;
  isResearchActive: boolean;
  isProxyInstrument: boolean;
  modelName?: string;
  modelState?: string;
  modelLane?: string;
  opportunityType?: string;
  opportunityStage?: string;
  opportunityQuality?: string;
  opportunityDirection?: string;
  opportunityNextAction?: string;
  opportunityBlockers: string[];
  opportunityMissingEvidence: string[];
  topReasons: string[];
  side?: CurrentOpportunitySide;
  setupName?: string;
  thesis?: string;
  entry?: number;
  invalidation?: number;
  target?: number;
  rrEstimate?: number;
  confidence?: number;
  htfAlignmentStatus?: string;
  htfConflictReason?: string;
  topDownBiasStatus?: CurrentOpportunityTopDownBiasStatus;
  timeframeRoleSummary: CurrentOpportunityTimeframeRole[];
  weeklyBiasDirection?: string;
  sessionNarrativeProfile?: string;
  sessionDirectionalRead?: string;
  sessionRaidReversal?: IctSessionRaidReversalNarrative;
  ifvgFreshRetestV3?: IctIfvgFreshRetestV3CompactAssessment;
  coreIctCandidates?: IctCoreCandidateCollection;
  marketMakerCandidates?: MarketMakerCandidateCollection;
  fvgStatus?: string;
  displacementStatus?: string;
  drawOnLiquidity?: string;
  liquiditySwept?: string;
  currentOpportunityDetected?: boolean;
  paperWatchlistEligible?: boolean;
  cmdIndependentDateGateStatus?: string;
  cmdIndependentDateGateReason?: string;
  analysisTimeframesUsed: string[];
  missingTimeframes: string[];
  sourceDepth: CurrentOpportunitySourceDepth;
}

export interface CurrentOpportunity {
  id: string;
  candidateId: string;
  strategyId: CurrentOpportunityStrategyId;
  strategyVersion?: string;
  profileId?: string;
  candidateState?: string;
  contextIdentity?: string;
  model: string;
  symbol: string;
  brokerSymbol: string;
  side: CurrentOpportunitySide;
  timeframe: string;
  contextTimeframes: string[];
  status: CurrentOpportunityStatus;
  classification: CurrentOpportunityClassification;
  setupName: string;
  thesis: string;
  entry?: number;
  invalidation?: number;
  target?: number;
  rrEstimate?: number;
  geometry?: CanonicalTradeGeometry;
  geometryMode: "canonical" | "source_blocked" | "unavailable";
  geometryStatus?: CanonicalTradeGeometry["status"];
  canonicalCandidate: boolean;
  actionable: boolean;
  confidence: number;
  requiredValidation: CurrentOpportunityRequiredValidation[];
  blockers: string[];
  missingConditions: string[];
  nextAction: string;
  sourceDepth: CurrentOpportunitySourceDepth;
  researchOnly: true;
  executionIntentCreated: false;
  authority: CurrentOpportunityAuthority;
}

export interface CurrentOpportunitySummary {
  generatedAt: string;
  requestedSymbol: string;
  brokerSymbol: string;
  primaryTimeframe: string;
  sourceProvider: string;
  sourceFingerprint?: string;
  depthStatus: CurrentOpportunityDepthPolicyStatus;
  topDownBiasStatus?: CurrentOpportunityTopDownBiasStatus;
  timeframeRoleSummary: CurrentOpportunityTimeframeRole[];
  validCandidateCount: number;
  formingCount: number;
  nearMissCount: number;
  rejectedCount: number;
  noTradeCount: number;
  needsMoreDataCount: number;
  diagnosticCount: number;
  marketMapOnlyCount: number;
  regimeContextCount: number;
  noTradeContextCount: number;
  canonicalSetupConflict: "NONE" | "CONFLICTING_CANONICAL_SETUPS";
  canonicalCandidateSetDisposition: CanonicalCandidateSetDisposition;
  canonicalCandidateCount: number;
  actionableCanonicalCandidateCount: number;
  selectedCanonicalCandidateId?: string;
  topOpportunity?: CurrentOpportunity;
  topNearMiss?: CurrentOpportunity;
  topRejected?: CurrentOpportunity;
  topBlocker?: string;
  nextAction: string;
  rangeHistoryAvailable: boolean;
  validationLookbackDays: number;
  authority: CurrentOpportunityAuthority;
  safety: {
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    accountDataExcluded: true;
    orderDataExcluded: true;
    positionDataExcluded: true;
    secretsExcluded: true;
  };
}

export interface CurrentOpportunityScan {
  scanId: string;
  generatedAt: string;
  context: Omit<CurrentOpportunityContext, "topReasons" | "opportunityBlockers" | "opportunityMissingEvidence"> & {
    topReasonCount: number;
    opportunityBlockerCount: number;
    opportunityMissingEvidenceCount: number;
  };
  opportunities: CurrentOpportunity[];
  canonicalCandidates: CanonicalRuntimeCandidate[];
  summary: CurrentOpportunitySummary;
  researchOnly: true;
  authority: CurrentOpportunityAuthority;
  safety: CurrentOpportunitySummary["safety"];
}
