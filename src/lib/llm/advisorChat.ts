import { runLocalBridgeChat } from "@/lib/llm/localBridgeClient";
import type { IctAdvisorPacket } from "@/lib/ict-strategy-suite";
import type { IctCurrentRead } from "@/lib/ict-strategy-suite/ictCurrentReadTypes";
import type { ResearchRuntimeSnapshot } from "@/lib/runtime";
import { latestValidationChainEntry } from "@/lib/validationChain";

export interface AdvisorChatContext {
  prompt: string;
  conversation?: Array<{
    role: "assistant" | "user";
    content: string;
  }>;
  packet?: IctAdvisorPacket;
  currentRead: IctCurrentRead;
  snapshot: ResearchRuntimeSnapshot;
  manualReplayStatus: string;
  marketScorecardStatus: string;
  profileOptimizationStatus: string;
}

export interface AdvisorChatReply {
  text: string;
  source: "llm-online" | "deterministic-fallback";
  model?: string;
  fallbackReason?: string;
}

export const buildAdvisorChatPacket = (context: AdvisorChatContext) => {
  const chain = latestValidationChainEntry();
  const activeSource = context.snapshot.marketData.activeResearchSource;
  return {
    packetId: `advisor_chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    source: "gotrader_ai_lab" as const,
    mode: "advisory_only" as const,
    executionAuthority: "none" as const,
    brokerAuthority: "none" as const,
    readinessOverrideAuthority: "none" as const,
    safetyConstraints: [
      "Research commentary only",
      "No execution or broker mutation",
      "No readiness override",
      "No account, order, position, credential, or raw candle data"
    ],
    chatMessage: context.prompt,
    prompt: context.prompt,
    conversation: (context.conversation ?? []).slice(-8).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 1_500)
    })),
    sourceContext: {
      provider: activeSource.provider,
      requestedSymbol: context.snapshot.marketData.symbol,
      brokerSymbol: activeSource.provenance.providerSymbol,
      timeframe: context.snapshot.marketData.timeframe,
      candleCount: activeSource.candleCount,
      sourceFingerprint: activeSource.fingerprint,
      chartEligible: activeSource.eligibility.chartDisplay,
      researchEligible: activeSource.eligibility.researchCycle,
      authority: "none"
    },
    currentRead: {
      dataStatus: context.currentRead.dataStatus,
      side: context.currentRead.side,
      setup: context.currentRead.bestSetup ?? context.packet?.recommendedSignal.setup,
      approvedStatus: context.currentRead.approvedStatus,
      riskStatus: context.currentRead.riskStatus,
      smtStatus: context.currentRead.smtStatus,
      topReasons: context.currentRead.topReasons.slice(0, 5),
      nextAction: context.currentRead.nextAction,
      opportunityDetected: context.currentRead.opportunityDetected,
      opportunityBlockers: context.currentRead.opportunityBlockers.slice(0, 4)
    },
    recommendedSignal: context.packet
      ? {
          setup: context.packet.recommendedSignal.setup,
          side: context.packet.recommendedSignal.side,
          decision: context.packet.recommendedSignal.decision,
          confidence: context.packet.recommendedSignal.confidence,
          summary: context.packet.recommendedSignal.summary,
          invalidation: context.packet.recommendedSignal.invalidation,
          target: context.packet.recommendedSignal.target
        }
      : undefined,
    validationChain: chain
      ? {
          hypothesisStatus: chain.hypothesisStatus,
          replayVerdict: chain.replayResult?.verdict,
          walkForwardVerdict: chain.walkForwardResult?.verdict,
          nextAction: chain.nextAction
        }
      : undefined,
    readiness: context.snapshot.readiness,
    walkForward: context.snapshot.walkForward,
    evidenceQualityScore: context.snapshot.evidence.evidenceQualityScore
  };
};

export async function runAdvisorChatWithFallback(
  context: AdvisorChatContext,
  fallback: () => string
): Promise<AdvisorChatReply> {
  let fallbackReason: string | undefined;
  try {
    const bridgeResult = await runLocalBridgeChat(buildAdvisorChatPacket(context));
    if (bridgeResult.advisoryStatus === "available") {
      if (bridgeResult.result?.reply?.trim()) {
        return {
          text: bridgeResult.result.reply.trim(),
          source: "llm-online",
          model: bridgeResult.model
        };
      }
      fallbackReason = "Local LLM bridge returned an empty chat reply.";
    } else {
      fallbackReason = bridgeResult.warnings[0] ?? bridgeResult.details?.[0];
    }
  } catch (error) {
    fallbackReason = error instanceof Error ? error.message : "Local LLM bridge request failed.";
  }

  return {
    text: fallback(),
    source: "deterministic-fallback",
    fallbackReason
  };
}
