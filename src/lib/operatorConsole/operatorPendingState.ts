import type {
  OperatorCycleState,
  OperatorInsightSummary,
  OperatorResearchPlanSummary
} from "./operatorConsoleTypes";

export const operatorCycleIsActive = (cycle: OperatorCycleState) =>
  cycle.status === "running" || cycle.status === "stopping";

export const pendingOperatorInsight = (cycle: OperatorCycleState): OperatorInsightSummary => ({
  bias: "pending",
  setup: "Current cycle in progress",
  modelLane: "pending",
  summary: cycle.message || "The current cycle is still assembling its identity-bound research facts.",
  nextAction: "Wait for the cycle to complete before interpreting its confidence or trade-plan facts."
});

export const pendingOperatorResearchPlan = (
  sourceFingerprint: string | undefined
): OperatorResearchPlanSummary => ({
  status: "unavailable",
  setup: "Current cycle in progress",
  side: "flat",
  setupDirection: "neutral",
  signal: "NO_TRADE",
  planSource: "unavailable",
  planCoherence: "incomplete",
  planCoherenceReason: "The current cycle has not published a complete identity-bound trade plan yet.",
  riskScreeningStatus: "pending current cycle",
  riskScreeningReason: "Wait for the current market read and risk screen to complete.",
  accountRiskEvaluation: "not_evaluated",
  sourceFingerprint,
  informationalOnly: true,
  executionAllowed: false
});
