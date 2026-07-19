import { createAgentDecisionTrace } from "@/lib/agentAudit/createAgentDecisionTrace";
import type { AgentDecisionTrace } from "@/lib/agentAudit/agentAuditTypes";
import { safeArray } from "@/lib/utils";
import type { AgentDebateMessage, TradeThesis } from "@/lib/types";

export function auditCioSynthesis(thesis?: TradeThesis, debateMessages: AgentDebateMessage[] = []): AgentDecisionTrace[] {
  if (!thesis) {
    return [];
  }
  const active = safeArray(debateMessages).filter((message) => message.synthesisRole !== "abstain" && (message.weight ?? 1) > 0);
  const abstaining = safeArray(debateMessages).filter((message) => message.synthesisRole === "abstain" || (message.weight ?? 1) <= 0);
  const aligned = active.filter((message) => message.stance === thesis.finalBias);
  const warnings = safeArray(debateMessages).flatMap((message) => safeArray(message.warningFactors));

  return [
    createAgentDecisionTrace({
      agentId: "cio-agent",
      agentName: "CIO Synthesis",
      decisionType: "cio_synthesis",
      inputFacts: [
        `${thesis.symbol} ${thesis.timeframe}`,
        `final bias ${thesis.finalBias}`,
        `ICT bias ${thesis.ictContext.bias}`,
        `ICT confluence ${(thesis.ictContext.confluenceScore * 100).toFixed(0)}%`,
        `aligned active agents ${aligned.length}/${active.length}`,
        `abstaining agents ${abstaining.length}`,
        `agent evidence coverage ${Math.round((thesis.agentEvidenceCoverage ?? 0) * 100)}%`
      ],
      evidenceUsed: [
        thesis.reasoningSummary,
        thesis.ictContext.narrativeSummary,
        ...aligned.flatMap((message) => safeArray(message.supportingFactors))
      ].filter((item): item is string => Boolean(item)),
      evidenceMissing: aligned.length ? warnings : ["No deterministic agents aligned with final CIO bias."],
      evidenceIgnored: thesis.finalBias !== thesis.ictContext.bias && thesis.finalBias !== "neutral"
        ? [`CIO final bias ${thesis.finalBias} differs from ICT context bias ${thesis.ictContext.bias}.`]
        : [],
      assumptions: ["CIO synthesis combines only evidence-participating internal agent weights.", "All output remains simulation research."],
      thresholdsUsed: [
        `confidence ${(thesis.confidence * 100).toFixed(0)}%`,
        `risk/reward ${thesis.simulatedTradePlan.riskReward.toFixed(2)}R`
      ],
      confidenceAfter: thesis.confidence,
      finalBias: thesis.finalBias,
      finalRecommendation: thesis.thesisSummary,
      riskWarnings: [thesis.riskNotes, ...warnings],
      decisionRulesApplied: [
        "Synthesize weighted evidence-participating internal agent views.",
        "Exclude abstaining agents from the directional denominator.",
        "Require invalidation, target, and risk notes.",
        "Keep output in simulation mode."
      ],
      safetyConstraintsChecked: [
        "Execution authority none",
        "Broker authority none",
        "Readiness override authority none",
        `trade plan mode ${thesis.simulatedTradePlan.mode}`
      ],
      possibleFailureModes: [
        "Agent agreement may be fragile.",
        "Available evidence may not contain enough regime diversity.",
        "Risk/reward can be valid but still fail validation."
      ],
      relatedEntityId: thesis.id,
      relatedPage: "/research"
    })
  ];
}
