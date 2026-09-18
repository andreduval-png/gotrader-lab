import type { CanonicalTradeGeometry } from "../tradeGeometry";
import type { CurrentOpportunity, CurrentOpportunityAuthority, CurrentOpportunitySide } from "./currentOpportunityTypes";

export type CanonicalCandidateSetConflict = "NONE" | "CONFLICTING_CANONICAL_SETUPS";
export type CanonicalCandidateSetDisposition =
  | "NO_ACTIONABLE_CANDIDATE"
  | "SINGLE_ACTIONABLE_CANDIDATE"
  | "MULTIPLE_ALIGNED_CANONICAL_SETUPS"
  | "CONFLICTING_CANONICAL_SETUPS";

export interface CanonicalRuntimeCandidate {
  opportunityId: string;
  strategyId: CurrentOpportunity["strategyId"];
  strategyVersion?: string;
  profileId?: string;
  charterProfile?: CurrentOpportunity["charterProfile"];
  candidateId: string;
  direction: CurrentOpportunitySide;
  setupState: string;
  actionability: boolean;
  blockers: string[];
  canonicalGeometry?: CanonicalTradeGeometry;
  geometryId?: string;
  sourceIdentity: string;
  evaluationAsOf: string;
  contextIdentity?: string;
  prerequisiteIdentity?: CurrentOpportunity["prerequisiteIdentity"];
  opportunity: CurrentOpportunity;
}

export interface CanonicalRuntimeCandidateSet {
  version: "gotrader.canonical-runtime-candidates.v1";
  generatedAt: string;
  sourceFingerprint?: string;
  candidates: CanonicalRuntimeCandidate[];
  actionableCandidates: CanonicalRuntimeCandidate[];
  conflict: CanonicalCandidateSetConflict;
  disposition: CanonicalCandidateSetDisposition;
  selectedCandidateId?: string;
  authority: CurrentOpportunityAuthority;
}

const strategyOrder = new Map([
  ["ifvg_fresh_retest_v3_research", 0],
  ["ict_2022_model_v1", 1],
  ["ict_power_of_three_v1", 2],
  ["ict_judas_swing_v1", 3],
  ["ict_market_maker_buy_model_v1", 4],
  ["ict_market_maker_sell_model_v1", 5]
]);

const stableCandidateOrder = (left: CanonicalRuntimeCandidate, right: CanonicalRuntimeCandidate) =>
  (strategyOrder.get(left.strategyId) ?? 100) - (strategyOrder.get(right.strategyId) ?? 100) ||
  left.strategyId.localeCompare(right.strategyId) ||
  left.candidateId.localeCompare(right.candidateId);

const isActionableCanonicalCandidate = (candidate: CanonicalRuntimeCandidate) => {
  const geometry = candidate.canonicalGeometry;
  return Boolean(
    candidate.opportunity.status === "valid_candidate" &&
    candidate.opportunity.classification !== "diagnostic" &&
    candidate.opportunity.actionable &&
    (candidate.direction === "long" || candidate.direction === "short") &&
    geometry?.geometryValid &&
    geometry.actionable &&
    geometry.geometryId === candidate.geometryId
  );
};

export const buildCanonicalRuntimeCandidateSet = ({ opportunities, generatedAt, sourceFingerprint, authority }: {
  opportunities: readonly CurrentOpportunity[];
  generatedAt: string;
  sourceFingerprint?: string;
  authority: CurrentOpportunityAuthority;
}): CanonicalRuntimeCandidateSet => {
  const candidates = opportunities
    .filter((opportunity) => opportunity.canonicalCandidate)
    .map((opportunity): CanonicalRuntimeCandidate => ({
      opportunityId: opportunity.id,
      strategyId: opportunity.strategyId,
      strategyVersion: opportunity.strategyVersion,
      profileId: opportunity.profileId,
      charterProfile: opportunity.charterProfile,
      candidateId: opportunity.candidateId,
      direction: opportunity.side,
      setupState: opportunity.candidateState ?? opportunity.status,
      actionability: opportunity.actionable,
      blockers: [...new Set([...opportunity.blockers, ...opportunity.missingConditions])],
      canonicalGeometry: opportunity.geometry,
      geometryId: opportunity.geometry?.geometryId,
      sourceIdentity: opportunity.contextIdentity ?? sourceFingerprint ?? "source-unavailable",
      evaluationAsOf: generatedAt,
      contextIdentity: opportunity.contextIdentity,
      prerequisiteIdentity: opportunity.prerequisiteIdentity,
      opportunity
    }))
    .sort(stableCandidateOrder);
  const actionableCandidates = candidates.filter(isActionableCanonicalCandidate);
  const directions = new Set(actionableCandidates.map((candidate) => candidate.direction));
  const conflict = directions.has("long") && directions.has("short")
    ? "CONFLICTING_CANONICAL_SETUPS" as const
    : "NONE" as const;
  const disposition: CanonicalCandidateSetDisposition = conflict === "CONFLICTING_CANONICAL_SETUPS"
    ? "CONFLICTING_CANONICAL_SETUPS"
    : actionableCandidates.length === 1
      ? "SINGLE_ACTIONABLE_CANDIDATE"
      : actionableCandidates.length > 1
        ? "MULTIPLE_ALIGNED_CANONICAL_SETUPS"
        : "NO_ACTIONABLE_CANDIDATE";
  return {
    version: "gotrader.canonical-runtime-candidates.v1",
    generatedAt,
    sourceFingerprint,
    candidates,
    actionableCandidates,
    conflict,
    disposition,
    selectedCandidateId: disposition === "SINGLE_ACTIONABLE_CANDIDATE" ? actionableCandidates[0]?.candidateId : undefined,
    authority
  };
};

