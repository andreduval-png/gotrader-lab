import { evaluateOpeningGapContext } from "@/lib/ictI5/openingGapModelCore";
import type { IctI5OpeningGapInput } from "@/lib/ictI5/ictI5Types";

export const evaluateNdogContext = (input: IctI5OpeningGapInput) => {
  if (input.gap.gapType !== "NDOG") throw new Error("NDOG context requires a canonical NDOG fact.");
  return evaluateOpeningGapContext(input);
};
