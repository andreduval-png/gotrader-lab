import { identifyWeakestAgent } from "@/lib/scoring";
import { runAgents, synthesizeCIO } from "@/lib/agents";
import { buildICTContext } from "@/lib/ict";
import { buildMarketContext } from "@/lib/marketData";
import { mockCandles } from "@/lib/mockData/mockCandles";
import { classifyMarketRegime } from "@/lib/regime";
import type {
  AgentDebateMessage,
  DebateSession,
  LabState,
  PromptMutation,
  Recommendation,
  SimulatedTradePlan,
  ThesisInput,
  TradeThesis,
  Candle
} from "@/lib/types";
import { clamp, uid } from "@/lib/utils";

export function generateThesis(input: ThesisInput, state: LabState, candles: Candle[] = mockCandles) {
  const ictContext = buildICTContext(candles, input);
  const marketContext = buildMarketContext({
    symbol: input.symbol,
    timeframe: input.timeframe,
    mode: candles?.length ? "imported" : "mock",
    candles
  });
  const regimeClassification = classifyMarketRegime({
    candles,
    marketContext,
    symbol: input.symbol,
    timeframe: input.timeframe
  });
  const researchAgentOpinions = runAgents(input, ictContext, candles);
  const cioSynthesis = synthesizeCIO(input, ictContext, researchAgentOpinions);
  const agentOpinions = [...researchAgentOpinions, cioSynthesis.cioOpinion];
  const plan: SimulatedTradePlan | undefined = cioSynthesis.pricePlan
    ? {
        id: uid("plan"),
        symbol: input.symbol,
        timeframe: input.timeframe,
        bias: cioSynthesis.finalBias,
        entryZone: cioSynthesis.pricePlan.entryZone,
        invalidation: cioSynthesis.pricePlan.invalidationLevel,
        targetLiquidity: cioSynthesis.pricePlan.targetLiquidity,
        stopRiskNotes: cioSynthesis.riskNotes,
        riskReward: cioSynthesis.pricePlan.riskReward,
        mode: "simulation"
      }
    : undefined;
  const createdAt = new Date().toISOString();
  const debateId = uid("debate");

  const messages: AgentDebateMessage[] = agentOpinions.map((opinion) => ({
      id: uid("msg"),
      agentId: opinion.agentId,
      agentName: opinion.name,
      layer: opinion.layer,
      stance: opinion.bias,
      confidence: opinion.confidence,
      weight: opinion.weight,
      configuredWeight: opinion.configuredWeight,
      evidenceStatus: opinion.evidenceStatus,
      synthesisRole: opinion.synthesisRole,
      abstentionReason: opinion.abstentionReason,
      message: opinion.reasoning,
      supportingFactors: opinion.supportingFactors,
      warningFactors: opinion.warningFactors,
      recommendation: opinion.recommendation,
      ictTags: opinion.ictTags,
      createdAt
  }));

  const recommendations: Recommendation[] = messages.map((message) => ({
    id: uid("rec"),
    agentId: message.agentId,
    debateSessionId: debateId,
    symbol: input.symbol,
    timeframe: input.timeframe,
    bias: message.stance,
    confidence: message.confidence,
    reasoning: message.message,
    entryZone: plan?.entryZone,
    invalidation: plan?.invalidation,
    target: plan?.targetLiquidity,
    ictTags: message.ictTags,
    createdAt
  }));

  const thesis: TradeThesis = {
    id: uid("thesis"),
    symbol: input.symbol,
    timeframe: input.timeframe,
    session: input.session,
    marketRegime: input.marketRegime,
    regimeClassification,
    notes: input.notes,
    finalBias: cioSynthesis.finalBias,
    confidence: cioSynthesis.confidence,
    thesisSummary: cioSynthesis.thesisSummary,
    invalidationLevel: plan?.invalidation,
    targetLiquidity: plan?.targetLiquidity,
    riskNotes: plan?.stopRiskNotes ?? cioSynthesis.riskNotes,
    reasoningSummary: cioSynthesis.reasoningSummary,
    activeAgentCount: cioSynthesis.activeAgentCount,
    abstainingAgentCount: cioSynthesis.abstainingAgentCount,
    agentEvidenceCoverage: cioSynthesis.evidenceCoverage,
    ictContext,
    simulatedTradePlan: plan,
    createdAt,
    disclaimer: "Research only. Simulation output, not financial advice."
  };

  const debateSession: DebateSession = {
    id: debateId,
    createdAt,
    symbol: input.symbol,
    timeframe: input.timeframe,
    session: input.session,
    marketRegime: input.marketRegime,
    regimeClassification,
    notes: input.notes,
    messages,
    recommendationIds: recommendations.map((recommendation) => recommendation.id),
    cioThesisId: thesis.id
  };

  return {
    debateSession,
    thesis,
    recommendations
  };
}

export function proposePromptMutation(state: LabState): LabState {
  const weakest = identifyWeakestAgent(state);
  if (!weakest) {
    return state;
  }

  const hasPendingMutation = state.promptMutations.some(
    (mutation) => mutation.agentId === weakest.id && mutation.status === "pending"
  );
  if (hasPendingMutation) {
    return state;
  }

  const activePrompt = state.promptVersions.find((prompt) => prompt.id === weakest.currentPromptVersionId);
  if (!activePrompt) {
    return state;
  }

  const versionNumber = state.promptVersions.filter((prompt) => prompt.agentId === weakest.id).length + 1;
  const candidateId = uid("prompt");
  const mutationId = uid("mutation");
  const oldPerformance = {
    hitRate: weakest.hitRate,
    drawdown: weakest.drawdown,
    sharpeLike: weakest.sharpeLike,
    confidenceCalibration: weakest.confidenceCalibration,
    sampleSize: weakest.wins + weakest.losses
  };

  return {
    ...state,
    promptVersions: [
      ...state.promptVersions,
      {
        id: candidateId,
        agentId: weakest.id,
        version: `1.${versionNumber}.0-candidate`,
        prompt: `${activePrompt.prompt} Add a pre-decision checklist: state the invalidation, one opposing scenario, and why confidence should not be reduced before issuing a bias.`,
        createdAt: new Date().toISOString(),
        mutationReason: "Auto-proposed after simulated scoring identified this as the weakest active agent.",
        status: "candidate",
        approvedByUser: false,
        supersedesVersionId: activePrompt.id,
        performanceBefore: oldPerformance
      }
    ],
    promptMutations: [
      ...state.promptMutations,
      {
        id: mutationId,
        agentId: weakest.id,
        fromPromptVersionId: activePrompt.id,
        candidatePromptVersionId: candidateId,
        createdAt: new Date().toISOString(),
        reason: "Weakest agent after simulated outcome scoring.",
        proposedDiffSummary: "Adds invalidation, opposing scenario, and confidence-reduction checklist.",
        status: "pending",
        requiresUserConfirmation: true,
        oldPerformance
      } satisfies PromptMutation
    ]
  };
}
