import type { CanonicalSessionWindowFact } from "@/lib/ictCanonical";
import { candidateIdentity, contextIdentity, ICT_CORE_AUTHORITY, transitionsFor, visibleFacts } from "@/lib/ictI2/ictI2Shared";
import type { IctCoreDetectionInput, IctCoreStrategyCandidate } from "@/lib/ictI2/ictI2Types";

export type IctJudasState = "WAITING_FOR_SESSION" | "SESSION_CONTEXT_AVAILABLE" | "SOURCE_BLOCKED";
export const ICT_JUDAS_MODEL_ID = "ict_judas_swing_v1" as const;

export const evaluateIctJudasSwing = (input: IctCoreDetectionInput): IctCoreStrategyCandidate<IctJudasState> => {
  const facts = visibleFacts(input.facts, input.asOf);
  const lifecycle = transitionsFor<IctJudasState>("WAITING_FOR_SESSION", input.asOf);
  const sessions = facts.filter((fact): fact is CanonicalSessionWindowFact => fact.factType === "SESSION_WINDOW");
  if (sessions.length) lifecycle.add("SESSION_CONTEXT_AVAILABLE", input.asOf, sessions.map((session) => session.factId), "Accepted New York and Asian session context is available.");
  lifecycle.add("SOURCE_BLOCKED", input.asOf, sessions.map((session) => session.factId), "Deterministic reversal, entry, stop, and target semantics remain unresolved.");
  const ids = sessions.map((session) => session.factId);
  return {
    candidateId: candidateIdentity(ICT_JUDAS_MODEL_ID, input.sourceFingerprint, ids), strategyId: ICT_JUDAS_MODEL_ID,
    strategyVersion: "1.0.0-source-blocked", profileId: "judas_source_blocked_context_v1", role: "SOURCE_BLOCKED_CONTEXT",
    symbol: input.symbol, timeframe: input.timeframe, direction: "none", state: lifecycle.state(), geometryEligible: false,
    actionable: false, supportingFactIds: ids, blockers: ["BLOCKED_SOURCE_SEMANTICS", "judas_reversal_entry_stop_target_unresolved"],
    transitions: lifecycle.transitions, contextIdentity: contextIdentity(input.narrative, ids), sourceFingerprint: input.sourceFingerprint,
    marketTimestamp: input.asOf, researchValidated: false, authority: ICT_CORE_AUTHORITY
  };
};

