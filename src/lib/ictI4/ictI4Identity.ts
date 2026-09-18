import type { CanonicalIctFact } from "@/lib/ictCanonical/canonicalIctTypes";

export const visibleIctI4Facts = (facts: readonly CanonicalIctFact[], asOf: string) => {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) throw new Error("I4 requires a valid asOf timestamp.");
  return facts
    .filter((fact) => Date.parse(fact.validFrom) <= cutoff)
    .sort((left, right) => Date.parse(left.validFrom) - Date.parse(right.validFrom) || left.factId.localeCompare(right.factId));
};

export const stableIctI4Id = (namespace: string, values: readonly string[]) => {
  let hash = 2166136261;
  for (const char of `${namespace}|${values.join("|")}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${namespace}:fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};
