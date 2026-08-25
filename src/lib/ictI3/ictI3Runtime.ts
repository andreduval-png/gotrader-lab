import type { IctCoreDetectionInput } from "@/lib/ictI2/ictI2Types";
import { evaluateMarketMakerBuyModel } from "@/lib/ictI3/marketMakerBuyModel";
import { evaluateMarketMakerSellModel } from "@/lib/ictI3/marketMakerSellModel";
import type { MarketMakerCandidateCollection } from "@/lib/ictI3/ictI3Types";
import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";

export const evaluateIctMarketMakerRuntimeCandidates = (
  input: IctCoreDetectionInput
): MarketMakerCandidateCollection => {
  const candidates = [
    evaluateMarketMakerBuyModel(input),
    evaluateMarketMakerSellModel(input)
  ] as const;
  return {
    version: "gotrader.ict-market-maker-candidates.v1",
    generatedAt: input.asOf,
    sourceFingerprint: input.sourceFingerprint,
    frameworks: candidates.map((candidate) => candidate.context),
    candidates,
    researchValidated: false,
    authority: CANONICAL_ICT_NONE_AUTHORITY
  };
};
