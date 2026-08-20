import type { CanonicalIctFact } from "@/lib/ictCanonical/canonicalIctTypes";
import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import type { IctI2NarrativeContext, IctI2StateTransition } from "@/lib/ictI2/ictI2Types";

export const ICT_I2_AUTHORITY = CANONICAL_ICT_NONE_AUTHORITY;

export const visibleIctFacts = (facts: readonly CanonicalIctFact[], asOf: string) => {
  const cutoff = Date.parse(asOf);
  return facts
    .filter((fact) => Number.isFinite(cutoff) && Date.parse(fact.validFrom) <= cutoff)
    .sort((left, right) => Date.parse(left.validFrom) - Date.parse(right.validFrom) || left.factId.localeCompare(right.factId));
};

export const factsAfter = <T extends CanonicalIctFact>(
  facts: readonly CanonicalIctFact[],
  factType: T["factType"],
  after: string,
  predicate: (fact: T) => boolean = () => true
) => facts.find((fact) => fact.factType === factType && Date.parse(fact.validFrom) >= Date.parse(after) && predicate(fact as T)) as T | undefined;

export const narrativeDirection = (narrative: IctI2NarrativeContext) => {
  const bullish = [narrative.structuralBias, narrative.currentFlowDirection, narrative.setupMaturationDirection]
    .filter((value) => value === "bullish").length;
  const bearish = [narrative.structuralBias, narrative.currentFlowDirection, narrative.setupMaturationDirection]
    .filter((value) => value === "bearish").length;
  if (bullish >= 2 && narrative.liquidityPath === "buyside") return "bullish" as const;
  if (bearish >= 2 && narrative.liquidityPath === "sellside") return "bearish" as const;
  return undefined;
};

export const parameterHash = (schemaId: string, parameters: unknown) => {
  const source = `${schemaId}|${stableSerialize(parameters)}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export const transitionAppender = <State extends string>(initial: State, asOf: string) => {
  const transitions: IctI2StateTransition<State>[] = [{
    sequence: 0,
    from: null,
    to: initial,
    occurredAt: asOf,
    validFrom: asOf,
    supportingFactIds: [],
    reason: "Evaluation began from the model initial state."
  }];
  let current = initial;
  return {
    transitions,
    add(to: State, validFrom: string, supportingFactIds: readonly string[], reason: string) {
      transitions.push({ sequence: transitions.length, from: current, to, occurredAt: validFrom, validFrom, supportingFactIds, reason });
      current = to;
    },
    state: () => current
  };
};

export const compactFactIds = (facts: Array<CanonicalIctFact | undefined>) =>
  Array.from(new Set(facts.filter((fact): fact is CanonicalIctFact => Boolean(fact)).map((fact) => fact.factId)));
