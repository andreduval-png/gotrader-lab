import { buildCanonicalBlocks } from "@/lib/ictCanonical/canonicalBlocks";
import { fingerprintCanonicalSource, causalCandlesAt } from "@/lib/ictCanonical/canonicalIctIdentity";
import type { CanonicalFactBuildInput, CanonicalIctFact } from "@/lib/ictCanonical/canonicalIctTypes";
import { buildCanonicalBprs, buildCanonicalFvgs, buildCanonicalFvgTransitions } from "@/lib/ictCanonical/canonicalImbalance";
import { classifyCanonicalRangeLiquidity } from "@/lib/ictCanonical/canonicalIrlErl";
import { buildCanonicalOpeningGaps } from "@/lib/ictCanonical/canonicalOpeningGap";
import { buildCanonicalDealingRange, projectCanonicalPdArrays } from "@/lib/ictCanonical/canonicalRangePd";
import { buildCanonicalDisplacements, buildCanonicalMss } from "@/lib/ictCanonical/canonicalStructure";
import { buildCanonicalEqualLevels, buildCanonicalSwingLiquidity, buildCanonicalSwings } from "@/lib/ictCanonical/canonicalSwingLiquidity";

export interface CanonicalIctFactSnapshot {
  asOf: string;
  sourceFingerprint: string;
  facts: readonly CanonicalIctFact[];
}

export const buildCanonicalIctFactSnapshot = (input: CanonicalFactBuildInput): CanonicalIctFactSnapshot => {
  const causalCandles = causalCandlesAt(input.candles, input.asOf);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(causalCandles);
  const canonicalInput = { ...input, candles: causalCandles, sourceFingerprint };
  const swings = buildCanonicalSwings(canonicalInput);
  const equalLevels = buildCanonicalEqualLevels({ input: canonicalInput, swings });
  const swingLiquidity = buildCanonicalSwingLiquidity({ input: canonicalInput, swings, equalLevels });
  const range = buildCanonicalDealingRange({ input: canonicalInput, swings });
  const rangeLiquidity = range ? classifyCanonicalRangeLiquidity({ dealingRange: range, liquidity: swingLiquidity }) : [];
  const fvgs = buildCanonicalFvgs(canonicalInput);
  const fvgTransitions = buildCanonicalFvgTransitions({ input: canonicalInput, fvgs });
  const bprs = buildCanonicalBprs(fvgs, sourceFingerprint);
  const displacements = buildCanonicalDisplacements(canonicalInput);
  const structureShifts = buildCanonicalMss({ input: canonicalInput, swings, displacements });
  const blocks = buildCanonicalBlocks({ input: canonicalInput, structureShifts });
  const pdArrays = projectCanonicalPdArrays([...fvgs, ...fvgTransitions, ...bprs, ...blocks]);
  const openingGaps = buildCanonicalOpeningGaps(canonicalInput);
  const facts: CanonicalIctFact[] = [
    ...swings,
    ...equalLevels,
    ...swingLiquidity,
    ...rangeLiquidity,
    ...(range ? [range] : []),
    ...fvgs,
    ...fvgTransitions,
    ...bprs,
    ...displacements,
    ...structureShifts,
    ...blocks,
    ...pdArrays,
    ...openingGaps
  ];
  return { asOf: input.asOf, sourceFingerprint, facts };
};
