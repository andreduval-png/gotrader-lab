import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import type { CanonicalBlockFact, CanonicalFvgFact } from "@/lib/ictCanonical/canonicalIctTypes";
import { stableIctI4Id, visibleIctI4Facts } from "@/lib/ictI4/ictI4Identity";
import type { IctI4ContextInput, UnicornContext, UnicornPhase } from "@/lib/ictI4/ictI4Types";

const bounds = (fact: CanonicalBlockFact | CanonicalFvgFact): readonly [number, number] =>
  [Math.min(fact.distalPrice, fact.proximalPrice), Math.max(fact.distalPrice, fact.proximalPrice)];

const intersection = (left: readonly [number, number], right: readonly [number, number]): readonly [number, number] | undefined => {
  const low = Math.max(left[0], right[0]);
  const high = Math.min(left[1], right[1]);
  return low <= high ? [low, high] : undefined;
};

export const evaluateUnicornContext = (input: IctI4ContextInput): UnicornContext => {
  const facts = visibleIctI4Facts(input.facts, input.asOf);
  const breakers = facts.filter((fact): fact is CanonicalBlockFact =>
    fact.factType === "BLOCK" && fact.blockType === "BREAKER_BLOCK" && fact.state !== "INVALIDATED");
  const fvgs = facts.filter((fact): fact is CanonicalFvgFact =>
    fact.factType === "FVG" && fact.fvgState !== "INVALIDATED" && fact.state !== "INVALIDATED");

  let selectedBreaker: CanonicalBlockFact | undefined;
  let selectedFvg: CanonicalFvgFact | undefined;
  let overlap: readonly [number, number] | undefined;
  for (const breaker of breakers) {
    const fvg = fvgs.find((candidate) => candidate.direction === breaker.direction && intersection(bounds(breaker), bounds(candidate)));
    if (!fvg) continue;
    selectedBreaker = breaker;
    selectedFvg = fvg;
    overlap = intersection(bounds(breaker), bounds(fvg));
    break;
  }

  const phase: UnicornPhase = overlap
    ? "SOURCE_BLOCKED"
    : breakers.length && fvgs.length
      ? "QUALIFYING_FVG_CONFIRMED"
      : breakers.length
        ? "BREAKER_CONFIRMED"
        : "SEARCHING";
  const supportingFactIds = [selectedBreaker?.factId ?? breakers.at(-1)?.factId, selectedFvg?.factId ?? fvgs.at(-1)?.factId]
    .filter((value): value is string => Boolean(value));
  const blockers = overlap
    ? ["Unicorn entry confirmation, structural invalidation, native objective, and expiry remain source-unresolved."]
    : breakers.length && fvgs.length
      ? ["Visible Breaker and FVG facts do not form a same-direction overlap region."]
      : breakers.length
        ? ["A qualifying same-direction canonical FVG is missing."]
        : ["A valid canonical Breaker Block is missing."];

  return Object.freeze({
    contextId: stableIctI4Id("unicorn", [input.sourceFingerprint, ...supportingFactIds]),
    artifactId: "gotrader.ict.i4.unicorn-context.v1",
    displayName: "ICT Unicorn / Breaker+FVG Context",
    aliases: ["breaker_fvg_model"] as const,
    taxonomy: "COMPOSITE_SETUP",
    decision: "BLOCKED_SOURCE_SEMANTICS",
    executable: false,
    phase,
    direction: selectedBreaker?.direction ?? "unresolved",
    breakerFactId: selectedBreaker?.factId,
    fvgFactId: selectedFvg?.factId,
    overlap,
    supportingFactIds,
    blockers,
    sourceFingerprint: input.sourceFingerprint,
    authority: CANONICAL_ICT_NONE_AUTHORITY,
    researchValidated: false
  });
};
