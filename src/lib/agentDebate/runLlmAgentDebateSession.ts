import { moderateDebateConsensus } from "@/lib/agentDebate/moderateDebateConsensus";
import { runAgentDebateSession } from "@/lib/agentDebate/runAgentDebateSession";
import type { AgentDebateSession, DebateMessage } from "@/lib/agentDebate/debateTypes";
import { validateDebateMessage } from "@/lib/agentDebate/validateDebateMessage";
import { runLocalBridgeDebate, type LocalBridgeDebateTurn } from "@/lib/llm/localBridgeClient";
import type { AgentDebateMessage, DebateSession, TradeThesis } from "@/lib/types";
import { clamp, safeArray, uid } from "@/lib/utils";

const llmDebateAgents: Record<LocalBridgeDebateTurn["role"], { agentId: string; agentName: string }> = {
  bull: { agentId: "llm-bull-debater", agentName: "LLM Bull Debater" },
  bear: { agentId: "llm-bear-debater", agentName: "LLM Bear Debater" },
  risk: { agentId: "llm-risk-debater", agentName: "LLM Risk Debater" }
};

const debateSafetyNotes = [
  "No execution authority.",
  "No broker control.",
  "No readiness override.",
  "Deterministic facts remain immutable."
];

const messageFromTurn = (turn: LocalBridgeDebateTurn, round: number): DebateMessage => {
  const agent = llmDebateAgents[turn.role];
  const message: DebateMessage = {
    messageId: uid("debate_msg"),
    round,
    fromAgent: agent.agentId,
    fromAgentName: agent.agentName,
    toAgent: "all",
    messageType: turn.role === "risk" ? "qualify" : turn.role === "bull" ? "support" : "challenge",
    content: turn.argument,
    evidenceReferenced: [...safeArray(turn.citedFacts).slice(0, 3), ...safeArray(turn.keyPoints).slice(0, 2)],
    updatedProbability: clamp(turn.confidence, 0.05, 0.95),
    convictionChange: "same",
    safetyNotes: debateSafetyNotes
  };
  const validation = validateDebateMessage(message);
  return validation.valid
    ? message
    : {
        ...message,
        messageType: "qualify",
        content: `${agent.agentName} message was constrained after safety validation; advisory-only interpretation remains.`,
        safetyNotes: [...message.safetyNotes, `Validation adjusted: ${validation.errors.join("; ")}`]
      };
};

/**
 * LLM-driven Bull/Bear/Risk debate over the immutable packet facts.
 *
 * The deterministic session always runs first and stays the labeled fallback.
 * When the local LLM bridge answers, the three role turns are appended as an
 * extra round and consensus is re-derived by the deterministic moderator, so
 * the final consensus rule stays rule-based.
 */
export async function runLlmAgentDebateSession({
  thesis,
  sourceDebate,
  messages,
  roundCount = 2,
  consensusThreshold = 3
}: {
  thesis: TradeThesis;
  sourceDebate?: DebateSession;
  messages?: AgentDebateMessage[];
  roundCount?: number;
  consensusThreshold?: number;
}): Promise<{ session: AgentDebateSession; llmDebateUsed: boolean; fallbackReason?: string }> {
  const deterministicSession = runAgentDebateSession({
    thesis,
    sourceDebate,
    messages,
    mode: "deterministic_fallback",
    roundCount,
    consensusThreshold
  });

  const packet = {
    packetId: uid("llm_debate"),
    timestamp: new Date().toISOString(),
    source: "gotrader_ai_lab",
    mode: "advisory_only",
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none",
    safetyConstraints: [
      "Debate turns are research commentary only.",
      "Argue strictly from the immutable facts below; do not invent evidence.",
      "No execution, broker, or readiness language."
    ],
    immutableFacts: deterministicSession.immutableFacts,
    openingStatements: deterministicSession.openingStatements.map((statement) => ({
      agentName: statement.agentName,
      initialBias: statement.initialBias,
      confidence: statement.confidence,
      evidence: safeArray(statement.evidence).slice(0, 3),
      warnings: safeArray(statement.warnings).slice(0, 3)
    }))
  };

  const bridgeResult = await runLocalBridgeDebate(packet);
  if (bridgeResult.advisoryStatus === "unavailable") {
    return {
      session: deterministicSession,
      llmDebateUsed: false,
      fallbackReason: bridgeResult.warnings[0] ?? "Local LLM bridge is unavailable; deterministic debate fallback was used."
    };
  }

  const llmRound = deterministicSession.roundCount + 1;
  const llmMessages = safeArray(bridgeResult.result.turns).map((turn) => messageFromTurn(turn, llmRound));
  const rounds = [...deterministicSession.rounds, { round: llmRound, messages: llmMessages }];
  const moderatorOutput = moderateDebateConsensus({
    thesis,
    openingStatements: deterministicSession.openingStatements,
    rounds,
    consensusThreshold
  });

  return {
    session: {
      ...deterministicSession,
      sessionId: uid("agent_debate"),
      mode: "local_command",
      roundCount: llmRound,
      rounds,
      moderatorOutput
    },
    llmDebateUsed: true
  };
}
