export const ICT_CORE_STRATEGY_REGISTRY = Object.freeze([
  { strategyId: "ifvg_fresh_retest_v3_research", status: "PRIMARY_EXECUTABLE_RESEARCH" },
  { strategyId: "ict_2022_model_v1", status: "PRIMARY_EXECUTABLE_RESEARCH" },
  { strategyId: "ict_power_of_three_v1", status: "PRIMARY_STATE_MODEL", geometryStatus: "PO3_TARGET_PRECEDENCE_SOURCE_BLOCKED" },
  { strategyId: "ict_judas_swing_v1", status: "SOURCE_BLOCKED_CONTEXT" },
  { strategyId: "ifvg_shallow_retest_v4_research", status: "EXPERIMENTAL_RESEARCH_ONLY" },
  { strategyId: "amd_power_of_three_research_v1", status: "LEGACY_PLACEHOLDER_SUPERSEDED", supersededBy: "ict_power_of_three_v1" }
] as const);

