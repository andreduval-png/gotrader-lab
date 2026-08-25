import { canonicalFingerprint } from "@/lib/ictCanonical/canonicalIctIdentity";
import { CANONICAL_ICT_NONE_AUTHORITY, type CanonicalIctFact } from "@/lib/ictCanonical/canonicalIctTypes";
import { buildCanonicalTradeGeometry } from "@/lib/tradeGeometry/canonicalTradeGeometry";
import type { CompleteStrategyGeometryIntent } from "@/lib/tradeGeometry/strategyGeometryIntent";
import type { IctCoreStateTransition, IctHierarchicalNarrative } from "@/lib/ictI2/ictI2Types";

export const ICT_CORE_AUTHORITY = CANONICAL_ICT_NONE_AUTHORITY;

export const visibleFacts = (facts: readonly CanonicalIctFact[], asOf: string) => {
  const cutoff = Date.parse(asOf);
  return facts
    .filter((fact) => Number.isFinite(cutoff) && Date.parse(fact.validFrom) <= cutoff)
    .sort((left, right) => Date.parse(left.validFrom) - Date.parse(right.validFrom) || left.factId.localeCompare(right.factId));
};

export const firstFactAfter = <T extends CanonicalIctFact>(
  facts: readonly CanonicalIctFact[],
  factType: T["factType"],
  after: string,
  predicate: (fact: T) => boolean = () => true
) => facts.find((fact) =>
  fact.factType === factType && Date.parse(fact.validFrom) >= Date.parse(after) && predicate(fact as T)
) as T | undefined;

export const hierarchicalObjectiveDirection = (narrative: IctHierarchicalNarrative) => {
  if (narrative.structural === "bullish" && narrative.liquidityPath === "buyside") return "bullish" as const;
  if (narrative.structural === "bearish" && narrative.liquidityPath === "sellside") return "bearish" as const;
  return undefined;
};

export const supportingIds = (facts: Array<CanonicalIctFact | undefined>) =>
  Array.from(new Set(facts.filter((fact): fact is CanonicalIctFact => Boolean(fact)).map((fact) => fact.factId)));

export const candidateIdentity = (strategyId: string, sourceFingerprint: string, factIds: readonly string[]) =>
  canonicalFingerprint({ strategyId, sourceFingerprint, factIds: [...factIds].sort() });

export const contextIdentity = (narrative: IctHierarchicalNarrative, factIds: readonly string[]) =>
  canonicalFingerprint({ narrative, factIds: [...factIds].sort() });

export const transitionsFor = <State extends string>(initial: State, asOf: string) => {
  const transitions: IctCoreStateTransition<State>[] = [{
    sequence: 0,
    from: null,
    to: initial,
    validFrom: asOf,
    supportingFactIds: [],
    reason: "Evaluation began from the model initial state."
  }];
  let current = initial;
  return {
    transitions,
    add(to: State, validFrom: string, factIds: readonly string[], reason: string) {
      transitions.push({ sequence: transitions.length, from: current, to, validFrom, supportingFactIds: factIds, reason });
      current = to;
    },
    state: () => current
  };
};

export const canonicalGeometryFromIntent = ({
  intent,
  candidateId,
  asOf,
  minimumRequiredRR
}: {
  intent: CompleteStrategyGeometryIntent;
  candidateId: string;
  asOf: string;
  minimumRequiredRR: number;
}) => buildCanonicalTradeGeometry({
  strategyId: intent.strategyId,
  strategyVersion: intent.strategyVersion,
  profileId: intent.profileId,
  profileVersion: intent.profileVersion,
  candidateId,
  direction: intent.direction,
  entry: intent.entry,
  stop: intent.stop,
  targetCandidates: [intent.primaryTarget],
  targetPolicy: {
    policyId: intent.targetPolicyId,
    policyVersion: intent.geometryPolicyVersion,
    primaryTargetType: intent.primaryTarget.type,
    primaryTargetId: intent.primaryTarget.targetId,
    allowedFallbackTargetTypes: []
  },
  primaryDrawOnLiquidityId: intent.primaryTarget.targetId,
  minimumRequiredRR,
  sourceFingerprint: intent.sourceFingerprint,
  asOf
});
