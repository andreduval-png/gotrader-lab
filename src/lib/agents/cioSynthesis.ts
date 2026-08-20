import type { CIOSynthesisResult, InternalAgentOpinion } from "@/lib/agents/agentTypes";
import { summarizeInternalAgentParticipation } from "@/lib/agents/agentEvidencePolicy";
import type { FuturesSymbol, ICTContext, MarketBias, ThesisInput } from "@/lib/types";
import { clamp } from "@/lib/utils";

const biasToScore = (bias: MarketBias) => (bias === "bullish" ? 1 : bias === "bearish" ? -1 : 0);

const scoreToBias = (score: number): MarketBias => {
  if (score > 0.12) {
    return "bullish";
  }
  if (score < -0.12) {
    return "bearish";
  }
  return "neutral";
};

const latestUnmitigatedGapMidpoint = (ictContext: ICTContext, bias: MarketBias, fallback: number) => {
  const gap = [...ictContext.fairValueGaps].reverse().find((item) => item.direction === bias && !item.mitigated);
  return gap?.midpoint ?? fallback;
};

const canonicalCurrentPrice = (ictContext: ICTContext) => {
  const value = ictContext.premiumDiscountZone.currentPrice;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
};

function buildLevels(input: ThesisInput, finalBias: MarketBias, ictContext: ICTContext) {
  const rawCurrentPrice = canonicalCurrentPrice(ictContext);
  if (rawCurrentPrice === undefined) {
    return undefined;
  }
  const unit = input.symbol.includes("NQ") ? 16 : input.symbol === "EURUSD" ? 0.001 : input.symbol === "XAUUSD" ? 2 : input.symbol === "BTCUSD" ? 100 : 5;
  const scaleLevel = (value: number | undefined, fallback: number) => Number((value ?? fallback).toFixed(2));
  const currentPrice = scaleLevel(rawCurrentPrice, rawCurrentPrice);
  const equilibrium = scaleLevel(ictContext.premiumDiscountZone.equilibrium, currentPrice);
  const latestSwingHigh = scaleLevel(ictContext.latestSwingHigh?.price, currentPrice + unit * 2);
  const latestSwingLow = scaleLevel(ictContext.latestSwingLow?.price, currentPrice - unit * 2);
  const rangeHigh = scaleLevel(ictContext.premiumDiscountZone.rangeHigh, latestSwingHigh);
  const rangeLow = scaleLevel(ictContext.premiumDiscountZone.rangeLow, latestSwingLow);
  const gapMidpoint = scaleLevel(
    finalBias === "bullish"
      ? latestUnmitigatedGapMidpoint(ictContext, "bullish", equilibrium)
      : finalBias === "bearish"
        ? latestUnmitigatedGapMidpoint(ictContext, "bearish", equilibrium)
        : equilibrium,
    equilibrium
  );
  const entryMid =
    finalBias === "neutral" ? currentPrice : finalBias === "bullish" ? Math.min(currentPrice, gapMidpoint) : Math.max(currentPrice, gapMidpoint);
  const entryZone: [number, number] =
    finalBias === "neutral" ? [currentPrice - unit, currentPrice + unit] : [entryMid - unit * 0.35, entryMid + unit * 0.35];
  const invalidation =
    finalBias === "neutral"
      ? rangeLow
      : finalBias === "bullish"
        ? Math.min(latestSwingLow, rangeLow) - unit * 0.25
        : Math.max(latestSwingHigh, rangeHigh) + unit * 0.25;
  const targetLiquidity =
    finalBias === "neutral"
      ? equilibrium
      : finalBias === "bullish"
        ? Math.max(latestSwingHigh, rangeHigh) + unit * 0.5
        : Math.min(latestSwingLow, rangeLow) - unit * 0.5;
  const risk = Math.max(unit * 0.5, Math.abs(entryMid - invalidation));
  const reward = Math.abs(targetLiquidity - entryMid);

  return {
    entryZone: [Number(entryZone[0].toFixed(2)), Number(entryZone[1].toFixed(2))] as [number, number],
    invalidationLevel: Number(invalidation.toFixed(2)),
    targetLiquidity: Number(targetLiquidity.toFixed(2)),
    riskReward: finalBias === "neutral" ? 0 : Number((reward / risk).toFixed(2))
  };
}

export function synthesizeCIO(input: ThesisInput, ictContext: ICTContext, opinions: InternalAgentOpinion[]): CIOSynthesisResult {
  const participation = summarizeInternalAgentParticipation(opinions);
  const activeOpinions = participation.activeOpinions;
  const totalWeight = activeOpinions.reduce((sum, opinion) => sum + opinion.weight, 0) || 1;
  const weightedDirectionalScore =
    activeOpinions.reduce((sum, opinion) => sum + biasToScore(opinion.bias) * opinion.confidence * opinion.weight, 0) / totalWeight;
  const priceEvidenceAvailable = canonicalCurrentPrice(ictContext) !== undefined;
  const finalBias = activeOpinions.length && priceEvidenceAvailable ? scoreToBias(weightedDirectionalScore) : "neutral";
  const avgConfidence = activeOpinions.reduce((sum, opinion) => sum + opinion.confidence * opinion.weight, 0) / totalWeight;
  const rawConfidence = 0.38 + Math.abs(weightedDirectionalScore) * 0.46 + avgConfidence * 0.24;
  const evidenceCoverageCap = 0.3 + participation.evidenceCoverage * 0.58;
  const confidence = activeOpinions.length && priceEvidenceAvailable
    ? clamp(Math.min(rawConfidence, evidenceCoverageCap), 0.2, 0.88)
    : 0.2;
  const pricePlan = buildLevels(input, finalBias, ictContext);
  const aligned = activeOpinions.filter((opinion) => opinion.bias === finalBias);
  const warnings = [...new Set(opinions.flatMap((opinion) => opinion.warningFactors))];
  const topFactors = aligned.flatMap((opinion) => opinion.supportingFactors).slice(0, 5);
  const thesisSummary =
    finalBias === "neutral"
      ? priceEvidenceAvailable
        ? `${input.symbol} ${input.timeframe} remains neutral because evidence-participating agents do not show enough weighted directional agreement.`
        : `${input.symbol} ${input.timeframe} remains neutral because canonical current-price evidence is unavailable.`
      : `${input.symbol} ${input.timeframe} CIO thesis is ${finalBias}; ${aligned.length} evidence-participating agent(s) align with the weighted synthesis.`;
  const riskNotes =
    finalBias === "neutral"
      ? priceEvidenceAvailable
        ? "Simulation remains neutral until internal agents agree on structure, timing, and risk/reward."
        : "Simulation remains neutral and price levels are unavailable until canonical current-price evidence is present."
      : `Simulation invalidates at ${pricePlan?.invalidationLevel}; warnings: ${warnings.slice(0, 3).join("; ") || "no major internal-agent veto"}. No order execution.`;
  const targetLogic =
    !pricePlan
      ? "Target logic is unavailable because canonical price evidence is missing."
      : finalBias === "neutral"
        ? `Target logic remains balance-oriented near ${pricePlan.targetLiquidity}.`
        : `Target logic uses the next ICT liquidity reference at ${pricePlan.targetLiquidity}.`;
  const invalidationLogic =
    !pricePlan
      ? "Invalidation logic is unavailable because canonical price evidence is missing."
      : finalBias === "neutral"
        ? `Invalidation logic references the lower dealing range at ${pricePlan.invalidationLevel}.`
        : `Invalidation logic uses the opposite ICT structure level at ${pricePlan.invalidationLevel}.`;

  return {
    finalBias,
    confidence,
    thesisSummary,
    reasoningSummary: `CIO synthesized ${participation.activeAgentCount} active agent(s); ${participation.abstainingAgentCount} abstained. Evidence coverage ${Math.round(participation.evidenceCoverage * 100)}%. Weighted score ${weightedDirectionalScore.toFixed(2)}. ${invalidationLogic} ${targetLogic}`,
    riskNotes,
    pricePlan,
    ...(pricePlan
      ? {
          invalidationLevel: pricePlan.invalidationLevel,
          targetLiquidity: pricePlan.targetLiquidity,
          entryZone: pricePlan.entryZone,
          riskReward: pricePlan.riskReward
        }
      : {}),
    activeAgentCount: participation.activeAgentCount,
    abstainingAgentCount: participation.abstainingAgentCount,
    evidenceCoverage: Number(participation.evidenceCoverage.toFixed(4)),
    cioOpinion: {
      agentId: "cio-agent",
      name: "CIO Agent",
      layer: "cio",
      bias: finalBias,
      confidence,
      weight: 1,
      configuredWeight: 1,
      evidenceStatus: participation.evidenceCoverage >= 0.75 ? "derived" : participation.activeAgentCount ? "limited" : "unavailable",
      synthesisRole: participation.activeAgentCount ? "vote" : "abstain",
      abstentionReason: participation.activeAgentCount ? undefined : "No internal agent had eligible evidence for synthesis.",
      reasoning: `${thesisSummary} ${ictContext.narrativeSummary}`,
      supportingFactors: topFactors.length ? topFactors : ["No dominant directional factor; preserving neutral research posture"],
      warningFactors: warnings.slice(0, 5),
      recommendation: finalBias === "neutral" ? "Do not form a directional simulated thesis yet." : `Use ${finalBias} CIO thesis with defined simulated invalidation and target.`,
      ictTags: ["liquidity sweep", "market structure shift", "fair value gap", "premium/discount", "session timing"]
    }
  };
}
