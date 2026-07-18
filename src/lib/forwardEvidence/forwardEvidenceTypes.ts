export const FORWARD_EVIDENCE_AUTHORITY = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;

export const IFVG_FRESH_RETEST_V3_PROFILE_ID = "ifvg_fresh_retest_v3_research" as const;
export const IFVG_FRESH_RETEST_V4_FORK_ID = "ifvg_fresh_retest_v4_candidate" as const;

export type ForwardEvidenceOutcome =
  | "pending"
  | "target_first"
  | "invalidation_first"
  | "partial"
  | "stalled"
  | "expired"
  | "rejected";

export type ForwardEvidenceRecommendation =
  | "keep_collecting"
  | "reassess_for_paper_demo"
  | "fork_new_profile"
  | "retire_profile";

export type ForwardEvidenceOrigin = "live_closed_candle" | "legacy_unverified";

export interface ForwardEvidencePriceZone {
  lower: number;
  upper: number;
}

export interface ForwardEvidenceTargetReference {
  label: string;
  price: number;
}

export interface FrozenProfileEvidenceSummary {
  candleCount: number;
  completedTrades: number;
  targetFirstRate: number;
  averageR: number;
  profitFactor: number;
  uniqueDates: number;
  positiveRollingWindows: number;
  totalRollingWindows: number;
  frozenOosWindowsPassed: number;
  frozenOosWindowCount: number;
  oosTrades: number;
  oosAverageR: number;
  oosProfitFactor: number;
  oosAdditionalCostR: number;
  monteCarloRobustness: "strong";
}

export interface FrozenResearchProfile {
  profileId: typeof IFVG_FRESH_RETEST_V3_PROFILE_ID;
  profileVersion: "v3";
  frozenAt: string;
  validationCutoff: string;
  validationSourceDescription: string;
  sourceProvider: "mt5_read_only";
  requestedSymbol: "MNQ";
  brokerSymbol: "USTECH";
  timeframe: "5m";
  historicalValidationDays: 180;
  evidence: FrozenProfileEvidenceSummary;
  frozenParameters: Readonly<{
    strategyProfile: typeof IFVG_FRESH_RETEST_V3_PROFILE_ID;
    warmupCandles: 100;
    decisionInterval: 1;
    maxBarsToResolveTrade: 48;
    visibleWindow: 80;
    minimumRR: 2;
    allowLong: true;
    allowShort: true;
    requireValidationEligibleBaseIfvg: true;
    requireUnusedZoneBeforeInversion: true;
    requireCleanRetest: true;
    requireLatestClosedCandleRetest: true;
    allowPostEntryConfirmation: false;
  }>;
  mutationPolicy: "frozen_profile_no_mutation";
  futureChangesPolicy: "fork_new_profile_version_only";
  suggestedForkProfileId: typeof IFVG_FRESH_RETEST_V4_FORK_ID;
  researchOnly: true;
  autoPromotionAllowed: false;
  authority: typeof FORWARD_EVIDENCE_AUTHORITY;
}

export interface ForwardEvidenceEntry {
  entryId: string;
  timestamp: string;
  profileId: typeof IFVG_FRESH_RETEST_V3_PROFILE_ID;
  profileVersion: "v3";
  frozenAt: string;
  validationCutoff: string;
  sourceProvider: "mt5_read_only";
  requestedSymbol: "MNQ";
  brokerSymbol: "USTECH";
  timeframe: "5m";
  sourceFingerprint: string;
  evidenceOrigin: ForwardEvidenceOrigin;
  causalAtIssue: boolean;
  forwardEligible: boolean;
  setupTimestamp: string;
  independentDate: string;
  forwardWindowId: string;
  direction: "long" | "short";
  scenarioFamily: string;
  entryZone?: ForwardEvidencePriceZone;
  stopReference?: number;
  targetReferences: ForwardEvidenceTargetReference[];
  triggerEvidence: string[];
  missingEvidence: string[];
  outcome: ForwardEvidenceOutcome;
  realizedR?: number;
  barsObserved: number;
  lastCheckedAt?: string;
  blockerSummary: string;
  notes: string;
  authority: typeof FORWARD_EVIDENCE_AUTHORITY;
}

export interface ForwardEvidenceEntryInput {
  entryId?: string;
  timestamp?: string;
  sourceFingerprint: string;
  evidenceOrigin?: ForwardEvidenceOrigin;
  causalAtIssue?: boolean;
  setupTimestamp: string;
  independentDate: string;
  forwardWindowId: string;
  direction: "long" | "short";
  scenarioFamily?: string;
  entryZone?: ForwardEvidencePriceZone;
  stopReference?: number;
  targetReferences?: ForwardEvidenceTargetReference[];
  triggerEvidence?: string[];
  missingEvidence?: string[];
  outcome?: ForwardEvidenceOutcome;
  realizedR?: number;
  barsObserved?: number;
  lastCheckedAt?: string;
  blockerSummary?: string;
  notes?: string;
  authority?: {
    executionAuthority?: string;
    brokerAuthority?: string;
    readinessOverrideAuthority?: string;
  };
}

export interface ForwardEvidenceLedgerEvaluation {
  profileId: typeof IFVG_FRESH_RETEST_V3_PROFILE_ID;
  profileVersion: "v3";
  cutoff: string;
  totalForwardOutcomes: number;
  completedForwardOutcomes: number;
  pendingOutcomes: number;
  rejectedOutcomes: number;
  unverifiedOutcomes: number;
  independentDates: number;
  forwardWindows: number;
  targetFirstRate: number | null;
  invalidationFirstRate: number | null;
  averageR: number | null;
  profitFactor: number | null;
  maxDrawdownR: number | null;
  reassessmentEligible: boolean;
  blockers: string[];
  recommendation: ForwardEvidenceRecommendation;
  autoPromotionAllowed: false;
  authority: typeof FORWARD_EVIDENCE_AUTHORITY;
}

export type ForwardEvidenceCycleSampleClassification =
  | "no_cycle_sample"
  | "different_profile"
  | "validation_only_backtest";

export interface ForwardEvidenceCycleSampleInput {
  cycleId?: string;
  strategyProfile?: string;
  totalTrades?: number;
  metricSource?: string;
}

export interface ForwardEvidenceCycleSampleAudit {
  classification: ForwardEvidenceCycleSampleClassification;
  cycleId?: string;
  strategyProfile: string;
  cycleTradeCount: number;
  creditedForwardOutcomes: 0;
  completedForwardOutcomes: number;
  pendingForwardOutcomes: number;
  reason: string;
  nextAction: string;
  authority: typeof FORWARD_EVIDENCE_AUTHORITY;
}

export interface FrozenProfileMutationReview {
  frozenProfileId?: typeof IFVG_FRESH_RETEST_V3_PROFILE_ID;
  blocked: boolean;
  directMutationAllowed: false;
  forkProposalAllowed: boolean;
  requiredForkProfileId?: typeof IFVG_FRESH_RETEST_V4_FORK_ID;
  reason?: string;
  authority: typeof FORWARD_EVIDENCE_AUTHORITY;
}

export interface FrozenProfileForkProposalIntent {
  sourceProfileId: typeof IFVG_FRESH_RETEST_V3_PROFILE_ID;
  proposedProfileId: typeof IFVG_FRESH_RETEST_V4_FORK_ID;
  status: "draft_only";
  validationRequired: true;
  forwardEvidenceRequired: true;
  autoApplyAllowed: false;
  authority: typeof FORWARD_EVIDENCE_AUTHORITY;
}
