import { canonicalFingerprint } from "@/lib/ictCanonical/canonicalIctIdentity";
import { ifvgFreshRetestV3FrozenProfile } from "@/lib/forwardEvidence/frozenProfileRegistry";
import { findResearchCoverage, type CanonicalLiveResearchOwnerId } from "@/lib/researchCoverage";
import {
  OWNER_PERFORMANCE_POLICY_SCHEMA,
  type CanonicalOwnerPerformancePolicy,
  type OwnerPerformanceThresholdDecision
} from "./ownerValidationPolicyTypes";

const SYMBOL_SCOPE = Object.freeze(["MNQ", "USTECH"] as const);
const EFFECTIVE_FROM = "2026-08-28T00:00:00.000Z";

const decision = (
  metric: string,
  value: number | string | boolean,
  rationale: string,
  basis: OwnerPerformanceThresholdDecision["basis"]
): OwnerPerformanceThresholdDecision => Object.freeze({
  metric,
  value,
  rationale,
  basis,
  definedBeforeEvidence: true as const
});

type PolicyDraft = Omit<CanonicalOwnerPerformancePolicy, "schemaVersion" | "policyHash" | "ownerStrategyVersion" | "symbolScope" | "effectiveFrom" | "immutableAfterEvidenceBegins">;

const freezePolicy = (draft: PolicyDraft): CanonicalOwnerPerformancePolicy => {
  const coverage = findResearchCoverage(draft.ownerStrategyId);
  if (!coverage || coverage.runtimeAdmissionStatus !== "LIVE_OWNER") {
    throw new Error(`Live owner coverage unavailable for ${draft.ownerStrategyId}.`);
  }
  const hashInput = {
    schemaVersion: OWNER_PERFORMANCE_POLICY_SCHEMA,
    ...draft,
    forwardEvidenceRequirement: Object.freeze({ ...draft.forwardEvidenceRequirement }),
    ownerStrategyVersion: coverage.ownerStrategyVersion,
    symbolScope: SYMBOL_SCOPE,
    effectiveFrom: EFFECTIVE_FROM,
    immutableAfterEvidenceBegins: true as const
  };
  return Object.freeze({ ...hashInput, policyHash: canonicalFingerprint(hashInput) });
};

const COMMON_DENOMINATOR = "Win rate, expectancy, average R, and R-based profit factor use resolved filled outcomes only. Detections, candidates, blocked/below-RR cases, no-fills, missed entries, consumed targets, partials, stalled, open, and unresolved records are excluded.";
const COMMON_UNRESOLVED = "Partial, stalled, open, or otherwise unresolved fills remain diagnostic until deterministically resolved; they are never silently classified as wins or losses.";
const COMMON_STRESS = "Apply the existing deterministic 0.5R adverse execution-cost perturbation per resolved outcome; use it to assess robustness, never to select parameters.";

const commonDecisions = (minimumResolvedOutcomes: number, minimumWindows: number, minimumPerWindow: number) => Object.freeze([
  decision("symbolScope", "MNQ|USTECH", "Evidence is instrument-bound to the canonical owner scope; cross-symbol generalization is not claimed.", "STRATEGY_STRUCTURE"),
  decision("performanceDenominator", "RESOLVED_FILLED_OUTCOMES_ONLY", "Only deterministically resolved fills carry realized R and can enter win rate, expectancy, or profit factor.", "STATISTICAL_GOVERNANCE_DECISION"),
  decision("unresolvedHandling", "DIAGNOSTIC_UNTIL_RESOLVED", "No-fill, missed, consumed, partial, stalled, open, and unresolved records cannot be silently treated as wins or losses.", "ENGINEERING_SAFETY"),
  decision("minimumResolvedOutcomes", minimumResolvedOutcomes, "Forty resolved outcomes is the accepted GoTrader minimum evidence floor; owner-specific temporal and independence requirements prevent it from standing alone.", "STATISTICAL_GOVERNANCE_DECISION"),
  decision("minimumOosWindows", minimumWindows, "Three chronological windows permit a two-of-three stability rule without dependence on one favorable window.", "STATISTICAL_GOVERNANCE_DECISION"),
  decision("minimumResolvedOutcomesPerWindow", minimumPerWindow, "Each chronological window must carry a non-trivial resolved sample before its result can vote on stability.", "STATISTICAL_GOVERNANCE_DECISION"),
  decision("minimumWindowPassRate", 2 / 3, "At least two of three windows must pass, preventing a single-window result from establishing validation.", "STATISTICAL_GOVERNANCE_DECISION"),
  decision("pooledEdgeRequirement", "POSITIVE_EDGE", "Research validation requires positive pooled expectancy after exact identity binding.", "STATISTICAL_GOVERNANCE_DECISION"),
  decision("stressedAverageRMinimumExclusive", 0, "A strategy must retain positive expectancy under the pre-declared adverse-cost stress.", "STATISTICAL_GOVERNANCE_DECISION"),
  decision("stressedProfitFactorMinimumExclusive", 1, "Gross positive R must remain greater than gross negative R under stress.", "STATISTICAL_GOVERNANCE_DECISION"),
  decision("stressPolicy", "DETERMINISTIC_0.5R_ADVERSE_COST", "Reuses the accepted GoTrader research perturbation as a robustness test, not a parameter-selection input.", "EXISTING_GOVERNANCE"),
  decision("drawdownPolicy", "DIAGNOSTIC_ONLY_R_UNITS", "No accepted owner-specific R drawdown budget exists, so drawdown is reported but cannot be outcome-fitted into a gate here.", "EXISTING_GOVERNANCE")
]);

const ifvg = ifvgFreshRetestV3FrozenProfile.walkForwardRequirements;

const ifvgPolicy = freezePolicy({
  performancePolicyId: "gotrader.owner-performance.ifvg-v3-frozen",
  performancePolicyVersion: "1.0.0-frozen-ifvg-v3",
  policyFamily: "IFVG_V3_FROZEN",
  ownerStrategyId: "ifvg_fresh_retest_v3_research",
  sampleUnit: "RESOLVED_FILLED_TRADE",
  minimumResolvedOutcomes: ifvg.minimumOosTrades,
  minimumOosWindows: ifvg.minimumOosWindows,
  minimumResolvedOutcomesPerWindow: ifvg.minimumTradesPerWindow,
  minimumWindowPassRate: ifvg.minimumWindowPassRate,
  minimumDistinctDates: ifvg.minimumUniqueDates,
  independentUnit: "NOT_APPLICABLE",
  maximumSingleDateShare: ifvg.maximumSingleDateShare,
  pooledEdgeRequirement: "POSITIVE_EDGE",
  stressedAverageRMinimumExclusive: 0,
  stressedProfitFactorMinimumExclusive: 1,
  stressPolicy: COMMON_STRESS,
  drawdownPolicy: "DIAGNOSTIC_ONLY_R_UNITS",
  forwardEvidenceRequirement: { status: "REQUIRED", unit: "EXACT_PROFILE_RESOLVED_FILLED_TRADE" },
  denominatorPolicy: COMMON_DENOMINATOR,
  unresolvedPolicy: COMMON_UNRESOLVED,
  governanceDecisions: Object.freeze([
    decision("allPerformanceThresholds", "FROZEN_UNCHANGED", "References the accepted IFVG v3 frozen policy without redefining or extending its performance thresholds.", "EXISTING_GOVERNANCE"),
    decision("symbolScope", "MNQ|USTECH", "Preserves the exact frozen owner instrument scope.", "EXISTING_GOVERNANCE"),
    decision("performanceDenominator", "FROZEN_IFVG_OOS_TRADES", "Preserves the accepted IFVG OOS-trade denominator and candidate/resolved-presence checks.", "EXISTING_GOVERNANCE"),
    decision("unresolvedHandling", "DIAGNOSTIC_UNTIL_RESOLVED", "Unresolved lifecycle records do not become synthetic wins or losses.", "EXISTING_GOVERNANCE"),
    decision("stressPolicy", "DETERMINISTIC_0.5R_ADVERSE_COST", "Preserves the accepted IFVG stress definition.", "EXISTING_GOVERNANCE")
  ])
});

const ict2022Policy = freezePolicy({
  performancePolicyId: "gotrader.owner-performance.ict-2022-v1",
  performancePolicyVersion: "1.0.0",
  policyFamily: "ICT_2022",
  ownerStrategyId: "ict_2022_model_v1",
  sampleUnit: "RESOLVED_FILLED_TRADE",
  minimumResolvedOutcomes: 40,
  minimumOosWindows: 3,
  minimumResolvedOutcomesPerWindow: 10,
  minimumWindowPassRate: 2 / 3,
  minimumDistinctDates: 30,
  minimumDistinctWeeks: 12,
  minimumDistinctMonths: 3,
  independentUnit: "NOT_APPLICABLE",
  maximumSingleDateShare: 0.1,
  pooledEdgeRequirement: "POSITIVE_EDGE",
  pooledAverageRMinimumExclusive: 0,
  pooledProfitFactorMinimumExclusive: 1,
  stressedAverageRMinimumExclusive: 0,
  stressedProfitFactorMinimumExclusive: 1,
  stressPolicy: COMMON_STRESS,
  drawdownPolicy: "DIAGNOSTIC_ONLY_R_UNITS",
  forwardEvidenceRequirement: { status: "REQUIRED", minimumResolvedOutcomes: 12, minimumDistinctDates: 10, minimumDistinctWeeks: 6, unit: "EXACT_PROFILE_RESOLVED_FILLED_TRADE" },
  denominatorPolicy: COMMON_DENOMINATOR,
  unresolvedPolicy: COMMON_UNRESOLVED,
  governanceDecisions: Object.freeze([
    ...commonDecisions(40, 3, 10),
    decision("minimumDistinctDates", 30, "The session-dependent model must span many independent trading dates rather than repeated intraday observations.", "STRATEGY_STRUCTURE"),
    decision("minimumDistinctWeeks", 12, "Twelve weeks supplies objective calendar diversity across multiple monthly periods without subjective regime labels.", "STRATEGY_STRUCTURE"),
    decision("minimumDistinctMonths", 3, "Multi-timeframe context must be observed across at least three calendar months.", "STRATEGY_STRUCTURE"),
    decision("maximumSingleDateShare", 0.1, "No trading date may dominate more than one tenth of resolved evidence.", "STATISTICAL_GOVERNANCE_DECISION"),
    decision("forwardEvidence", "12 outcomes / 10 dates / 6 weeks", "Exact-profile closed-bar forward evidence is required separately before research readiness.", "ENGINEERING_SAFETY")
  ])
});

const marketMakerPolicy = (ownerStrategyId: Extract<CanonicalLiveResearchOwnerId, "ict_market_maker_buy_model_v1" | "ict_market_maker_sell_model_v1">) => freezePolicy({
  performancePolicyId: `gotrader.owner-performance.${ownerStrategyId === "ict_market_maker_buy_model_v1" ? "mmbm" : "mmsm"}-v1`,
  performancePolicyVersion: "1.0.0",
  policyFamily: "MARKET_MAKER",
  ownerStrategyId,
  sampleUnit: "RESOLVED_DELIVERY_SEQUENCE",
  minimumResolvedOutcomes: 40,
  minimumOosWindows: 3,
  minimumResolvedOutcomesPerWindow: 8,
  minimumWindowPassRate: 2 / 3,
  minimumDistinctDates: 24,
  minimumDistinctWeeks: 16,
  minimumDistinctMonths: 4,
  minimumIndependentUnits: 40,
  independentUnit: "QUALIFYING_DELIVERY_SEQUENCE",
  maximumSingleDateShare: 0.1,
  maximumSingleIndependentUnitShare: 0.025,
  pooledEdgeRequirement: "POSITIVE_EDGE",
  pooledAverageRMinimumExclusive: 0,
  pooledProfitFactorMinimumExclusive: 1,
  stressedAverageRMinimumExclusive: 0,
  stressedProfitFactorMinimumExclusive: 1,
  stressPolicy: COMMON_STRESS,
  drawdownPolicy: "DIAGNOSTIC_ONLY_R_UNITS",
  forwardEvidenceRequirement: { status: "REQUIRED", minimumResolvedOutcomes: 10, minimumDistinctDates: 10, minimumDistinctWeeks: 8, unit: "EXACT_OWNER_RESOLVED_DELIVERY_SEQUENCE" },
  denominatorPolicy: `${COMMON_DENOMINATOR} At most one resolved outcome per qualifying DH4 delivery-sequence identity enters the denominator.`,
  unresolvedPolicy: COMMON_UNRESOLVED,
  governanceDecisions: Object.freeze([
    ...commonDecisions(40, 3, 8),
    decision("sharedMarketMakerPolicy", true, "DH4 buy and sell owners use direction-mirrored delivery-sequence facts, geometry, and lifecycle semantics, so the statistical contract is symmetric while owner identities remain distinct.", "STRATEGY_STRUCTURE"),
    decision("minimumIndependentUnits", 40, "Every counted outcome must come from a distinct qualifying delivery sequence to avoid treating correlated observations from one setup as independent.", "STRATEGY_STRUCTURE"),
    decision("minimumDistinctDates", 24, "Lower structural cadence requires calendar breadth, not a reduced quality standard.", "STRATEGY_STRUCTURE"),
    decision("minimumDistinctWeeks", 16, "Sixteen weeks gives the low-frequency sequence model objective temporal diversity.", "STRATEGY_STRUCTURE"),
    decision("minimumDistinctMonths", 4, "Four calendar months prevent a short delivery regime from dominating evidence.", "STRATEGY_STRUCTURE"),
    decision("maximumSingleDateShare", 0.1, "No date may dominate the sequence evidence.", "STATISTICAL_GOVERNANCE_DECISION"),
    decision("maximumSingleIndependentUnitShare", 0.025, "With forty required sequences, each sequence contributes no more than one fortieth of the denominator.", "STRATEGY_STRUCTURE"),
    decision("forwardEvidence", "10 sequences / 10 dates / 8 weeks", "Exact-owner forward delivery sequences remain a separate readiness gate.", "ENGINEERING_SAFETY")
  ])
});

const londonPolicy = freezePolicy({
  performancePolicyId: "gotrader.owner-performance.london-raid-v1",
  performancePolicyVersion: "1.0.0",
  policyFamily: "LONDON_RAID",
  ownerStrategyId: "nasdaq_london_raid_ny_reversal_v1",
  sampleUnit: "RESOLVED_LONDON_SESSION_TRADE",
  minimumResolvedOutcomes: 40,
  minimumOosWindows: 3,
  minimumResolvedOutcomesPerWindow: 8,
  minimumWindowPassRate: 2 / 3,
  minimumDistinctDates: 30,
  minimumDistinctWeeks: 16,
  minimumDistinctMonths: 4,
  minimumIndependentUnits: 40,
  independentUnit: "LONDON_SESSION",
  maximumSingleDateShare: 0.025,
  maximumSingleIndependentUnitShare: 0.025,
  pooledEdgeRequirement: "POSITIVE_EDGE",
  pooledAverageRMinimumExclusive: 0,
  pooledProfitFactorMinimumExclusive: 1,
  stressedAverageRMinimumExclusive: 0,
  stressedProfitFactorMinimumExclusive: 1,
  stressPolicy: COMMON_STRESS,
  drawdownPolicy: "DIAGNOSTIC_ONLY_R_UNITS",
  forwardEvidenceRequirement: { status: "REQUIRED", minimumResolvedOutcomes: 12, minimumDistinctDates: 12, minimumDistinctWeeks: 8, unit: "EXACT_OWNER_RESOLVED_LONDON_SESSION_TRADE" },
  denominatorPolicy: `${COMMON_DENOMINATOR} At most one resolved trade per canonical London-session identity enters the denominator; VALID_BELOW_RR_THRESHOLD remains diagnostic only.`,
  unresolvedPolicy: COMMON_UNRESOLVED,
  governanceDecisions: Object.freeze([
    ...commonDecisions(40, 3, 8),
    decision("minimumIndependentUnits", 40, "The session-specific strategy counts at most one resolved trade per canonical London session.", "STRATEGY_STRUCTURE"),
    decision("minimumDistinctDates", 30, "Session evidence must span at least thirty trading dates.", "STRATEGY_STRUCTURE"),
    decision("minimumDistinctWeeks", 16, "Sixteen weeks prevents a narrow session/calendar period from establishing validation.", "STRATEGY_STRUCTURE"),
    decision("minimumDistinctMonths", 4, "Four calendar months exercise session and DST handling across objective temporal periods.", "STRATEGY_STRUCTURE"),
    decision("maximumSingleDateShare", 0.025, "One trade per date/session caps each observation at one fortieth of the required denominator.", "STRATEGY_STRUCTURE"),
    decision("VALID_BELOW_RR_THRESHOLD", "EXCLUDED_FROM_OUTCOMES", "A correctly rejected below-RR candidate is not a historical loss.", "EXISTING_GOVERNANCE"),
    decision("forwardEvidence", "12 sessions / 12 dates / 8 weeks", "Exact-owner forward London sessions remain a separate readiness gate.", "ENGINEERING_SAFETY")
  ])
});

export const canonicalOwnerPerformancePolicyRegistry: readonly CanonicalOwnerPerformancePolicy[] = Object.freeze([
  ifvgPolicy,
  ict2022Policy,
  marketMakerPolicy("ict_market_maker_buy_model_v1"),
  marketMakerPolicy("ict_market_maker_sell_model_v1"),
  londonPolicy
]);

export const findOwnerPerformancePolicy = (ownerStrategyId: string) =>
  canonicalOwnerPerformancePolicyRegistry.find((policy) => policy.ownerStrategyId === ownerStrategyId);
