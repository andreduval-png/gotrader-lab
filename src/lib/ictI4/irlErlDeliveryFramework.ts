import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import type { CanonicalIrlErlTransitionFact, CanonicalLiquidityFact } from "@/lib/ictCanonical/canonicalIctTypes";
import { stableIctI4Id, visibleIctI4Facts } from "@/lib/ictI4/ictI4Identity";
import type { DeliveryFrameworkPhase, IctI4ContextInput, IrlErlDeliveryContext } from "@/lib/ictI4/ictI4Types";

export const evaluateIrlErlDeliveryFramework = (
  input: IctI4ContextInput,
  transitionType: IrlErlDeliveryContext["transitionType"]
): IrlErlDeliveryContext => {
  const facts = visibleIctI4Facts(input.facts, input.asOf);
  const expectedOrigin = transitionType === "IRL_TO_ERL_DELIVERY" ? "INTERNAL" : "EXTERNAL";
  const expectedObjective = transitionType === "IRL_TO_ERL_DELIVERY" ? "EXTERNAL" : "INTERNAL";
  const liquidity = facts.filter((fact): fact is CanonicalLiquidityFact => fact.factType === "LIQUIDITY");
  const transitions = facts.filter((fact): fact is CanonicalIrlErlTransitionFact =>
    fact.factType === "IRL_ERL_TRANSITION" && fact.transitionType === transitionType);
  const transition = transitions.at(-1);
  const origin = transition
    ? liquidity.find((fact) => fact.liquidityId === transition.fromLiquidityId && fact.liquidityClass === expectedOrigin)
    : liquidity.slice().reverse().find((fact) => fact.liquidityClass === expectedOrigin);
  const objective = transition
    ? liquidity.find((fact) => fact.liquidityId === transition.toLiquidityId && fact.liquidityClass === expectedObjective)
    : undefined;
  const endpointIntegrity = Boolean(transition && origin && objective && origin.dealingRangeId === transition.dealingRangeId && objective.dealingRangeId === transition.dealingRangeId);
  let phase: DeliveryFrameworkPhase = "SEARCHING";
  const blockers: string[] = [];
  if (!origin) blockers.push(`A valid ${expectedOrigin} origin is missing.`);
  else if (!transition) {
    phase = "ORIGIN_ESTABLISHED";
    blockers.push(`A canonical ${transitionType} transition is missing.`);
  } else if (!endpointIntegrity) {
    phase = "INVALIDATED";
    blockers.push("Transition endpoints do not match their canonical liquidity classes and owning range.");
  } else if (transition.currentState === "INVALIDATED") {
    phase = "INVALIDATED";
    blockers.push("Canonical delivery transition is invalidated.");
  } else if (objective?.status === "CONSUMED") {
    phase = "OBJECTIVE_CONSUMED";
    blockers.push("The named delivery objective is already consumed; no farther fallback is inferred.");
  } else if (transition.currentState === "FORMING") {
    phase = "TRANSITION_FORMING";
    blockers.push("Canonical delivery transition remains forming.");
  } else if (transition.currentState === "COMPLETED") {
    phase = "DELIVERY_COMPLETED";
    blockers.push("Delivery completed as context; this framework creates no trade outcome.");
  } else {
    phase = "DELIVERY_ACTIVE";
    blockers.push("Delivery is active context; source-defined entry and stop semantics are absent.");
  }
  const supportingFactIds = [origin?.factId, transition?.factId, objective?.factId].filter((value): value is string => Boolean(value));
  return Object.freeze({
    contextId: stableIctI4Id("delivery", [input.sourceFingerprint, transitionType, ...supportingFactIds]),
    artifactId: transitionType === "IRL_TO_ERL_DELIVERY"
      ? "gotrader.ict.i4.irl-to-erl-framework.v1"
      : "gotrader.ict.i4.erl-to-irl-framework.v1",
    taxonomy: "CANONICAL_FACT_FRAMEWORK",
    decision: "ACCEPTED_FRAMEWORK",
    executable: false,
    transitionType,
    phase,
    direction: transition?.direction ?? "unresolved",
    dealingRangeId: transition?.dealingRangeId,
    originLiquidityId: origin?.liquidityId,
    originLiquidityClass: origin?.liquidityClass as "INTERNAL" | "EXTERNAL" | undefined,
    transitionId: transition?.transitionId,
    objectiveLiquidityId: objective?.liquidityId,
    objectiveLiquidityClass: objective?.liquidityClass as "INTERNAL" | "EXTERNAL" | undefined,
    supportingFactIds,
    blockers,
    mmxmFrameworkId: "gotrader.ict.i3.mmxm-delivery-framework.v1",
    sourceFingerprint: input.sourceFingerprint,
    authority: CANONICAL_ICT_NONE_AUTHORITY,
    researchValidated: false
  });
};
