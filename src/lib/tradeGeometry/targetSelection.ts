import type {
  CanonicalTargetCandidate,
  CanonicalTargetPolicy,
  CanonicalTargetSelection,
  TradeDirection
} from "@/lib/tradeGeometry/tradeGeometryTypes";

export interface SelectCanonicalTargetInput {
  direction: TradeDirection;
  entryPrice: number;
  stopPrice: number;
  asOf: string;
  candidates: readonly CanonicalTargetCandidate[];
  policy: CanonicalTargetPolicy;
}

const directionalReward = (direction: TradeDirection, entry: number, target: number) =>
  direction === "LONG" ? target - entry : entry - target;

const directionalRisk = (direction: TradeDirection, entry: number, stop: number) =>
  direction === "LONG" ? entry - stop : stop - entry;

const enrich = (
  candidate: CanonicalTargetCandidate,
  direction: TradeDirection,
  entryPrice: number,
  stopPrice: number
): CanonicalTargetCandidate => {
  const reward = directionalReward(direction, entryPrice, candidate.price);
  const risk = directionalRisk(direction, entryPrice, stopPrice);
  return {
    ...candidate,
    distanceFromEntry: reward,
    availableRR: risk > 0 && reward > 0 ? reward / risk : undefined
  };
};

const byDirectionalDistanceThenId = (left: CanonicalTargetCandidate, right: CanonicalTargetCandidate) =>
  (left.distanceFromEntry ?? Number.POSITIVE_INFINITY) - (right.distanceFromEntry ?? Number.POSITIVE_INFINITY) ||
  left.targetId.localeCompare(right.targetId);

export const selectCanonicalTarget = ({
  direction,
  entryPrice,
  stopPrice,
  asOf,
  candidates,
  policy
}: SelectCanonicalTargetInput): CanonicalTargetSelection => {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) throw new Error(`Invalid target-selection asOf timestamp: ${asOf}`);

  const evaluatedCandidates = candidates
    .filter((candidate) => candidate.direction === direction)
    .filter((candidate) => candidate.validFrom === undefined || Date.parse(candidate.validFrom) <= asOfMs)
    .map((candidate) => enrich(candidate, direction, entryPrice, stopPrice))
    .sort(byDirectionalDistanceThenId);

  const primaryMatches = evaluatedCandidates.filter(
    (candidate) =>
      candidate.type === policy.primaryTargetType &&
      (policy.primaryTargetId === undefined || candidate.targetId === policy.primaryTargetId)
  );
  const consumedPrimary = primaryMatches.find((candidate) => candidate.consumed);
  const primary = primaryMatches.find((candidate) => !candidate.consumed || policy.allowConsumedTargetReuse === true);
  if (primary) return { selected: primary, selectionRole: "PRIMARY", evaluatedCandidates };

  for (const fallbackType of policy.allowedFallbackTargetTypes) {
    const fallback = evaluatedCandidates.find(
      (candidate) => candidate.type === fallbackType && (!candidate.consumed || policy.allowConsumedTargetReuse === true)
    );
    if (fallback) return { selected: fallback, selectionRole: "EXPLICIT_FALLBACK", evaluatedCandidates };
  }

  if (consumedPrimary) {
    return { failure: "TARGET_CONSUMED", blocker: "target_consumed", evaluatedCandidates };
  }
  if (evaluatedCandidates.length > 0) {
    return { failure: "GEOMETRY_POLICY_MISMATCH", blocker: "target_policy_mismatch", evaluatedCandidates };
  }
  return { failure: "NO_VALID_TARGET", blocker: "no_valid_target", evaluatedCandidates };
};

