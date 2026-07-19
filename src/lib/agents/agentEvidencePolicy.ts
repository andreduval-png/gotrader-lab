import type {
  InternalAgentEvidenceStatus,
  InternalAgentOpinion,
  InternalAgentRawOpinion,
  InternalAgentRunContext,
  InternalAgentSynthesisRole
} from "@/lib/agents/agentTypes";

const MINIMUM_AGENT_CANDLES = 20;

const unavailableModuleStatuses = new Set(["available_mock", "missing", "planned", "later_advanced"]);

const abstain = (
  opinion: InternalAgentRawOpinion,
  configuredWeight: number,
  reason: string
): InternalAgentOpinion => ({
  ...opinion,
  bias: "neutral",
  confidence: 0,
  weight: 0,
  configuredWeight,
  evidenceStatus: "unavailable",
  synthesisRole: "abstain",
  abstentionReason: reason,
  reasoning: `${opinion.name} abstained: ${reason}`,
  supportingFactors: [],
  warningFactors: [reason],
  recommendation: "Evidence is unavailable; this agent did not participate in CIO synthesis."
});

const participate = (
  opinion: InternalAgentRawOpinion,
  configuredWeight: number,
  activeWeight: number,
  evidenceStatus: InternalAgentEvidenceStatus,
  role: InternalAgentSynthesisRole = "vote",
  evidenceFactor = 1
): InternalAgentOpinion => ({
  ...opinion,
  configuredWeight,
  evidenceStatus,
  synthesisRole: role,
  weight: Number((activeWeight * evidenceFactor).toFixed(6))
});

export function applyInternalAgentEvidencePolicy(
  opinion: InternalAgentRawOpinion,
  context: InternalAgentRunContext,
  activeWeight = opinion.weight
): InternalAgentOpinion {
  const configuredWeight = opinion.weight;
  const candleCount = context.marketContext.priceVolume.ohlcv.candles.length;

  if (candleCount < MINIMUM_AGENT_CANDLES) {
    return abstain(opinion, configuredWeight, `Only ${candleCount} candles are available; at least ${MINIMUM_AGENT_CANDLES} are required.`);
  }

  switch (opinion.agentId) {
    case "grinch-smt-intermarket-agent":
      return abstain(opinion, configuredWeight, "Correlated ES/YM candle evidence is not present in the agent context.");
    case "session-levels-agent": {
      const hasDerivedLevels = context.marketContext.priceVolume.levels.some((level) => level.source !== "mock");
      return hasDerivedLevels
        ? participate(opinion, configuredWeight, activeWeight, "derived")
        : abstain(opinion, configuredWeight, "Session reference levels are placeholders rather than canonical candle-derived levels.");
    }
    case "auction-volume-profile-agent": {
      const status = context.marketContext.priceVolume.volumeProfile.volumeProfileStatus;
      return unavailableModuleStatuses.has(status)
        ? abstain(opinion, configuredWeight, "Verified VWAP and volume-profile evidence is not connected.")
        : participate(opinion, configuredWeight, activeWeight, "verified");
    }
    case "macro-event-risk-agent":
      return unavailableModuleStatuses.has(context.marketContext.macro.status)
        ? abstain(opinion, configuredWeight, "Verified macro calendar, VIX, DXY, and yield evidence is not connected.")
        : participate(opinion, configuredWeight, activeWeight, "verified");
    case "intermarket-confirmation-agent":
      return unavailableModuleStatuses.has(context.marketContext.intermarket.status)
        ? abstain(opinion, configuredWeight, "Verified ES/NQ/YM, DXY, VIX, and cross-asset evidence is not connected.")
        : participate(opinion, configuredWeight, activeWeight, "verified");
    case "positioning-gamma-agent":
      return unavailableModuleStatuses.has(context.marketContext.positioning.status)
        ? abstain(opinion, configuredWeight, "Verified positioning, COT, put/call, and gamma evidence is not connected.")
        : participate(opinion, configuredWeight, activeWeight, "verified");
    case "order-flow-agent": {
      const orderFlow = context.marketContext.orderFlow;
      const unavailable = unavailableModuleStatuses.has(orderFlow.domStatus) || unavailableModuleStatuses.has(orderFlow.footprintStatus);
      return unavailable
        ? abstain(opinion, configuredWeight, "Verified DOM, footprint, and cumulative-delta evidence is not connected.")
        : participate(opinion, configuredWeight, activeWeight, "verified");
    }
    case "composite-regime-agent":
    case "volatility-regime-agent": {
      const quality = context.regimeClassification?.dataQuality;
      if (!quality || quality === "insufficient") {
        return abstain(opinion, configuredWeight, "Candle-derived regime evidence is insufficient.");
      }
      return quality === "limited"
        ? participate(opinion, configuredWeight, activeWeight, "limited", "vote", 0.5)
        : participate(opinion, configuredWeight, activeWeight, "derived");
    }
    default:
      return context.marketContext.mode === "mock"
        ? participate(opinion, configuredWeight, activeWeight, "limited", "vote", 0.5)
        : participate(opinion, configuredWeight, activeWeight, "derived");
  }
}

export function summarizeInternalAgentParticipation(opinions: InternalAgentOpinion[]) {
  const activeOpinions = opinions.filter((opinion) => opinion.synthesisRole !== "abstain" && opinion.weight > 0);
  const abstainingOpinions = opinions.filter((opinion) => opinion.synthesisRole === "abstain" || opinion.weight <= 0);
  const totalConfiguredWeight = opinions.reduce((sum, opinion) => sum + Math.max(0, opinion.configuredWeight), 0);
  const activeConfiguredWeight = activeOpinions.reduce((sum, opinion) => sum + Math.max(0, opinion.configuredWeight), 0);
  const evidenceCoverage = totalConfiguredWeight > 0 ? activeConfiguredWeight / totalConfiguredWeight : 0;

  return {
    activeOpinions,
    abstainingOpinions,
    activeAgentCount: activeOpinions.length,
    abstainingAgentCount: abstainingOpinions.length,
    totalConfiguredWeight,
    activeConfiguredWeight,
    evidenceCoverage
  };
}
