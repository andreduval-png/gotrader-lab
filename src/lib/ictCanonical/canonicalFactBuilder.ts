import { buildCanonicalBlocks } from "@/lib/ictCanonical/canonicalBlocks";
import { fingerprintCanonicalSource, causalCandlesAt } from "@/lib/ictCanonical/canonicalIctIdentity";
import type { CanonicalFactBuildInput, CanonicalIctFact } from "@/lib/ictCanonical/canonicalIctTypes";
import { buildCanonicalBprs, buildCanonicalFvgs, buildCanonicalFvgTransitions } from "@/lib/ictCanonical/canonicalImbalance";
import { classifyCanonicalRangeLiquidity } from "@/lib/ictCanonical/canonicalIrlErl";
import { buildCanonicalOpeningGaps } from "@/lib/ictCanonical/canonicalOpeningGap";
import { buildCanonicalDealingRange, buildCanonicalPdLocation, projectCanonicalPdArrays } from "@/lib/ictCanonical/canonicalRangePd";
import { buildCanonicalDisplacements, buildCanonicalMss } from "@/lib/ictCanonical/canonicalStructure";
import { buildCanonicalEqualLevels, buildCanonicalSwingLiquidity, buildCanonicalSwings } from "@/lib/ictCanonical/canonicalSwingLiquidity";

export interface CanonicalIctFactSnapshot {
  asOf: string;
  sourceFingerprint: string;
  facts: readonly CanonicalIctFact[];
  diagnostics: CanonicalIctFactDiagnostics;
}

export interface CanonicalIctFactDiagnostics {
  ranges: number;
  pdLocations: number;
  irlFacts: number;
  erlFacts: number;
  transitions: number;
  confirmedTransitions: number;
  formingTransitions: number;
  consumedTransitions: number;
  invalidatedTransitions: number;
  dependencyFailures: readonly string[];
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
  const referenceCandle = causalCandles.at(-1);
  const pdLocation = range && referenceCandle
    ? buildCanonicalPdLocation({
      input: canonicalInput,
      range,
      price: referenceCandle.close,
      referenceTime: input.asOf,
      referenceCandleId: referenceCandle.id
    })
    : undefined;
  const fvgs = buildCanonicalFvgs(canonicalInput);
  const fvgTransitions = buildCanonicalFvgTransitions({ input: canonicalInput, fvgs });
  const bprs = buildCanonicalBprs(fvgs, sourceFingerprint);
  const displacements = buildCanonicalDisplacements(canonicalInput);
  const structureShifts = buildCanonicalMss({ input: canonicalInput, swings, displacements });
  const blocks = buildCanonicalBlocks({ input: canonicalInput, structureShifts });
  const pdArrays = projectCanonicalPdArrays(
    [...fvgs, ...fvgTransitions, ...bprs, ...blocks],
    range ? [range] : []
  );
  const openingGaps = buildCanonicalOpeningGaps(canonicalInput);
  const facts: CanonicalIctFact[] = [
    ...swings,
    ...equalLevels,
    ...swingLiquidity,
    ...rangeLiquidity,
    ...(range ? [range] : []),
    ...(pdLocation ? [pdLocation] : []),
    ...fvgs,
    ...fvgTransitions,
    ...bprs,
    ...displacements,
    ...structureShifts,
    ...blocks,
    ...pdArrays,
    ...openingGaps
  ];
  const transitions = facts.filter((fact) => fact.factType === "IRL_ERL_TRANSITION");
  const diagnostics: CanonicalIctFactDiagnostics = {
    ranges: range ? 1 : 0,
    pdLocations: pdLocation ? 1 : 0,
    irlFacts: rangeLiquidity.filter((fact) => fact.liquidityClass === "INTERNAL").length,
    erlFacts: rangeLiquidity.filter((fact) => fact.liquidityClass === "EXTERNAL").length,
    transitions: transitions.length,
    confirmedTransitions: transitions.filter((fact) => fact.currentState === "ACTIVE" || fact.currentState === "COMPLETED").length,
    formingTransitions: transitions.filter((fact) => fact.currentState === "FORMING").length,
    consumedTransitions: transitions.filter((fact) => fact.currentState === "COMPLETED").length,
    invalidatedTransitions: transitions.filter((fact) => fact.currentState === "INVALIDATED").length,
    dependencyFailures: [
      ...(!range ? ["PD_LOCATION:CANONICAL_DEALING_RANGE_UNAVAILABLE"] : []),
      ...(range && !pdLocation ? ["PD_LOCATION:REFERENCE_OUTSIDE_CANONICAL_RANGE_OR_NOT_CAUSAL"] : []),
      "IRL_ERL_TRANSITION:SOURCE_OR_SEMANTIC_BLOCKED"
    ]
  };
  return { asOf: input.asOf, sourceFingerprint, facts, diagnostics };
};
