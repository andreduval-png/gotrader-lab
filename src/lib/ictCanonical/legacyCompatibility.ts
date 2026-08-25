import { buildCanonicalFvgs } from "@/lib/ictCanonical/canonicalImbalance";
import { buildCanonicalSwings } from "@/lib/ictCanonical/canonicalSwingLiquidity";
import type { CanonicalFactBuildInput, CanonicalFvgFact, CanonicalSwingFact } from "@/lib/ictCanonical/canonicalIctTypes";
import type { FairValueGap, SwingPoint } from "@/lib/types";

export interface LegacyCompatibilityResult<T> {
  canonical: T;
  legacyId: string;
  parity: "EXACT_IDENTITY_MATCH" | "STRUCTURAL_MATCH";
  limitations: readonly string[];
}

export const adaptLegacySwing = ({
  input,
  legacy,
  lookback = 2
}: {
  input: CanonicalFactBuildInput;
  legacy: SwingPoint;
  lookback?: number;
}): LegacyCompatibilityResult<CanonicalSwingFact> => {
  const canonical = buildCanonicalSwings(input, lookback).find(
    (fact) => fact.pivotCandleId === legacy.candleId && fact.direction === legacy.type
  );
  if (!canonical) throw new Error(`Legacy swing ${legacy.id} has no canonical causal match.`);
  return {
    canonical: { ...canonical, legacyStrength: legacy.strength },
    legacyId: legacy.id,
    parity: "STRUCTURAL_MATCH",
    limitations: ["Legacy swing timestamp denotes the pivot; canonical confirmedAt and validFrom include right-hand confirmation."]
  };
};

export const adaptLegacyFvg = ({
  input,
  legacy
}: {
  input: CanonicalFactBuildInput;
  legacy: FairValueGap;
}): LegacyCompatibilityResult<CanonicalFvgFact> => {
  const canonical = buildCanonicalFvgs(input).find(
    (fact) => fact.originCandleIds.includes(legacy.candleId) && fact.direction === legacy.direction
  );
  if (!canonical) throw new Error(`Legacy FVG ${legacy.id} has no canonical three-candle match.`);
  return {
    canonical,
    legacyId: legacy.id,
    parity: "STRUCTURAL_MATCH",
    limitations: [
      "Legacy start/end naming is not treated as canonical proximal/distal identity.",
      "Canonical fill state is recomputed causally at asOf rather than copied from legacy mitigated."
    ]
  };
};
