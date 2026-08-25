import type { OperatorConsoleSnapshot } from "./operatorConsoleTypes";

export const buildInt3a1ConflictAcceptanceFixture = (
  snapshot: OperatorConsoleSnapshot
): OperatorConsoleSnapshot => ({
  ...snapshot,
  researchPlan: {
    status: "no_trade",
    planIdentityStatus: "current",
    cycleId: "int-3a-1-browser-conflict",
    currentReadEvaluatedAt: "2026-08-25T12:00:00.000Z",
    setup: "Conflicting canonical setups",
    side: "flat",
    setupDirection: "neutral",
    signal: "NO_TRADE",
    planSource: "unavailable",
    planCoherence: "incomplete",
    planCoherenceReason: "Actionable canonical strategies disagree. No singular plan or geometry is selected.",
    riskScreeningStatus: "conflict",
    riskScreeningReason: "Actionable canonical strategies disagree. No singular plan or geometry is selected.",
    accountRiskEvaluation: "external_simulation_required",
    sourceFingerprint: "int-3a-1-browser-fixture",
    generatedAt: "2026-08-25T12:00:00.000Z",
    informationalOnly: true,
    executionAllowed: false
  },
  canonicalSetupConflict: "CONFLICTING_CANONICAL_SETUPS",
  candidatePlans: [
    {
      strategyId: "ifvg_fresh_retest_v3_research",
      strategyVersion: "v3",
      profileId: "ifvg_fresh_retest_v3_research",
      candidateId: "ifvg|ES|ES|5m|2026-06-12T14:30:00.000Z|2026-06-12T14:40:00.000Z|2026-06-12T14:55:00.000Z|long",
      setup: "IFVG fresh retest v3",
      side: "long",
      status: "valid_candidate",
      signal: "NO_TRADE",
      geometryId: "fnv1a128:51bed382147c310eac6a997059cebd92",
      entryPrice: 95,
      stopLoss: 93.9095,
      takeProfit: 98.6,
      riskReward: 3.30124,
      actionable: true
    },
    {
      strategyId: "ict_2022_model_v1",
      strategyVersion: "1.0.0",
      profileId: "ict_2022_model_v1_research",
      candidateId: "fnv1a128:eac6d79df3dddc39798c1467a0d8d8ad",
      setup: "ICT 2022 Model",
      side: "short",
      status: "valid_candidate",
      signal: "NO_TRADE",
      geometryId: "fnv1a128:ad3788d9cd05a23dcaa3691bffb4a7e9",
      entryPrice: 100.5,
      stopLoss: 105,
      takeProfit: 89,
      riskReward: 2.3,
      actionable: true
    }
  ]
});

