import { evaluateOpeningGapContext } from "@/lib/ictI5/openingGapModelCore";
import type { IctI5OpeningGapInput } from "@/lib/ictI5/ictI5Types";

export const evaluateNwogContext = (input: IctI5OpeningGapInput) => {
  if (input.gap.gapType !== "NWOG") throw new Error("NWOG context requires a canonical NWOG fact.");
  return evaluateOpeningGapContext(input);
};

export const evaluateNwogContexts = (inputs: readonly IctI5OpeningGapInput[]) => inputs
  .map(evaluateNwogContext)
  .sort((left, right) => left.marketDateOrWeekIdentity.localeCompare(right.marketDateOrWeekIdentity) || left.gapId.localeCompare(right.gapId));
