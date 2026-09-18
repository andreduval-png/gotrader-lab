import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import type { CanonicalPdArrayFact, CanonicalPdArrayType } from "@/lib/ictCanonical/canonicalIctTypes";
import { stableIctI4Id, visibleIctI4Facts } from "@/lib/ictI4/ictI4Identity";
import type { IctI4ContextInput, PdArrayExecutionPolicyContext } from "@/lib/ictI4/ictI4Types";

export const ICT_I4_PD_ARRAY_POLICY_TYPES: readonly CanonicalPdArrayType[] = Object.freeze([
  "FVG", "IFVG", "BPR", "ORDER_BLOCK", "BREAKER_BLOCK", "MITIGATION_BLOCK", "OTE_ZONE"
]);

export const evaluatePdArrayExecutionPolicy = (input: IctI4ContextInput & {
  direction: "bullish" | "bearish";
  observedPrice?: number;
  observedAt?: string;
  eligiblePdArrayTypes?: readonly CanonicalPdArrayType[];
}): PdArrayExecutionPolicyContext => {
  const facts = visibleIctI4Facts(input.facts, input.asOf);
  const eligible = input.eligiblePdArrayTypes ?? ICT_I4_PD_ARRAY_POLICY_TYPES;
  const arrays = facts.filter((fact): fact is CanonicalPdArrayFact =>
    fact.factType === "PD_ARRAY" && eligible.includes(fact.pdArrayType) && (fact.direction === input.direction || fact.direction === "neutral") && fact.state === "ACTIVE");
  const selected = arrays.at(-1);
  const observationVisible = input.observedPrice !== undefined && input.observedAt !== undefined && Date.parse(input.observedAt) <= Date.parse(input.asOf);
  const retraceObserved = Boolean(selected && observationVisible && input.observedPrice! >= selected.priceRange[0] && input.observedPrice! <= selected.priceRange[1]);
  const blockers = !selected
    ? ["No eligible directional canonical PD array is visible."]
    : retraceObserved
      ? ["PD-array retrace is context only; a named strategy must own confirmation, entry, stop, target, and expiry."]
      : ["Price has not causally retraced into the selected canonical PD array."];
  return Object.freeze({
    contextId: stableIctI4Id("pd-array-policy", [input.sourceFingerprint, input.direction, selected?.factId ?? "none", eligible.join(",")]),
    artifactId: "gotrader.ict.i4.pd-array-execution-policy.v1",
    taxonomy: "STRATEGY_PROFILE",
    decision: "ACCEPTED_EXECUTION_POLICY",
    executable: false,
    direction: input.direction,
    eligiblePdArrayTypes: [...eligible],
    selectedPdArrayId: selected?.pdArrayId,
    selectedPdArrayType: selected?.pdArrayType,
    priceRange: selected?.priceRange,
    retraceObserved,
    supportingFactIds: selected ? [selected.factId] : [],
    blockers,
    sourceFingerprint: input.sourceFingerprint,
    authority: CANONICAL_ICT_NONE_AUTHORITY,
    researchValidated: false
  });
};
