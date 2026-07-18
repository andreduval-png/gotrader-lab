import { runLocalBridgeChat } from "@/lib/llm/localBridgeClient";
import type { IctAdvisorPacket } from "@/lib/ict-strategy-suite";
import type { IctCurrentRead } from "@/lib/ict-strategy-suite/ictCurrentReadTypes";
import type { ResearchRuntimeSnapshot } from "@/lib/runtime";
import { latestValidationChainEntry } from "@/lib/validationChain";

export interface AdvisorChatContext {
  prompt: string;
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
}

const compactPacketForChat = (context: AdvisorChatContext) => {
  const chain = latestValidationChainEntry();
  return {
    executionAuthority: "none" as const,
    brokerAuthority: "none" as const,
    readinessOverrideAuthority: "none" as const,
    chatMessage: context.prompt,
    prompt: context.prompt,
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
  try {
    const bridgeResult = await runLocalBridgeChat(compactPacketForChat(context));
    if (bridgeResult.advisoryStatus === "available" && bridgeResult.result?.reply?.trim()) {
      return {
        text: bridgeResult.result.reply.trim(),
        source: "llm-online",
        model: bridgeResult.model
      };
    }
  } catch {
    // Fall through to deterministic advisor reply.
  }

  return {
    text: fallback(),
    source: "deterministic-fallback"
  };
}
