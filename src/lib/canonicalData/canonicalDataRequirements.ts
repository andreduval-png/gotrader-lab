import type { CanonicalDataRequirement, CanonicalRequirementBasis } from "./canonicalDataTypes";

const liveFrames = (
  entries: Array<["W1" | "D1" | "H4" | "H1" | "M15" | "M5", number, number, number, CanonicalRequirementBasis, string]>
) => entries.map(([timeframe, minimumWarmupBars, evaluationBars, minimumCalendarDays, basis, reason]) => ({
  timeframe,
  minimumWarmupBars,
  evaluationBars,
  minimumCalendarDays,
  basis,
  reason
}));

const live = (draft: Omit<CanonicalDataRequirement, "contractVersion" | "tier" | "requiresCompletedBars" | "continuityPolicy">): CanonicalDataRequirement => ({
  contractVersion: "1.0.0",
  tier: "LIVE_CONTEXT",
  requiresCompletedBars: true,
  continuityPolicy: "SESSION_AWARE_REQUIRED",
  ...draft
});

export const CANONICAL_LIVE_DATA_REQUIREMENTS = Object.freeze({
  IFVG_V3: live({
    ownerId: "ict_ifvg_fresh_retest_v3",
    consumerId: "live.ifvg_v3",
    purpose: "Preserve the compact certified IFVG v3 live detector views.",
    requiredTimeframes: liveFrames([
      ["M5", 100, 200, 0, "COMPATIBILITY_BASELINE", "Current 300-bar live detector slice, separated into warmup and evaluation."],
      ["M15", 80, 80, 0, "COMPATIBILITY_BASELINE", "Current 160-bar IFVG context slice."],
      ["H1", 60, 60, 0, "COMPATIBILITY_BASELINE", "Current 120-bar IFVG context slice."],
      ["H4", 45, 45, 90, "COMPATIBILITY_BASELINE", "Preserve the current 90-day context fetch."],
      ["D1", 45, 45, 90, "COMPATIBILITY_BASELINE", "Preserve the current 90-day context fetch."]
    ]),
    sessionHistoryRequirements: [],
    weekHistoryRequirements: 0
  }),
  ICT_2022: live({
    ownerId: "ict_2022_model",
    consumerId: "live.ict_2022",
    purpose: "Canonical top-down narrative and execution sequence.",
    requiredTimeframes: liveFrames([
      ["W1", 2, 2, 90, "COMPATIBILITY_BASELINE", "Current weekly bias context."],
      ["D1", 20, 20, 90, "COMPATIBILITY_BASELINE", "Current daily context."],
      ["H4", 40, 40, 90, "COMPATIBILITY_BASELINE", "Current structural context."],
      ["H1", 120, 120, 90, "COMPATIBILITY_BASELINE", "Current role timeframe."],
      ["M15", 160, 160, 90, "COMPATIBILITY_BASELINE", "Current role timeframe."],
      ["M5", 300, 300, 90, "COMPATIBILITY_BASELINE", "Current execution slice."]
    ]),
    sessionHistoryRequirements: ["America/New_York current and prior trading sessions"],
    weekHistoryRequirements: 2,
    requiredFactTypes: ["LIQUIDITY", "DISPLACEMENT", "MSS", "FVG", "PD_ARRAY"]
  }),
  MMBM: live({
    ownerId: "ict_market_maker_buy_model",
    consumerId: "live.mmbm",
    purpose: "C1/C1.1 market-maker structural and delivery context.",
    requiredTimeframes: liveFrames([
      ["D1", 20, 20, 90, "COMPATIBILITY_BASELINE", "Current higher-timeframe context."],
      ["H4", 40, 40, 90, "COMPATIBILITY_BASELINE", "Current higher-timeframe context."],
      ["H1", 120, 120, 90, "COMPATIBILITY_BASELINE", "Structural role."],
      ["M15", 160, 160, 90, "COMPATIBILITY_BASELINE", "Intermediate role."],
      ["M5", 300, 300, 90, "COMPATIBILITY_BASELINE", "Execution role."]
    ]),
    sessionHistoryRequirements: ["America/New_York current and prior trading sessions"],
    weekHistoryRequirements: 1,
    requiredFactTypes: ["DEALING_RANGE", "PD_LOCATION", "LIQUIDITY", "DISPLACEMENT", "PD_ARRAY"]
  }),
  MMSM: live({
    ownerId: "ict_market_maker_sell_model",
    consumerId: "live.mmsm",
    purpose: "C1/C1.1 market-maker structural and delivery context.",
    requiredTimeframes: liveFrames([
      ["D1", 20, 20, 90, "COMPATIBILITY_BASELINE", "Current higher-timeframe context."],
      ["H4", 40, 40, 90, "COMPATIBILITY_BASELINE", "Current higher-timeframe context."],
      ["H1", 120, 120, 90, "COMPATIBILITY_BASELINE", "Structural role."],
      ["M15", 160, 160, 90, "COMPATIBILITY_BASELINE", "Intermediate role."],
      ["M5", 300, 300, 90, "COMPATIBILITY_BASELINE", "Execution role."]
    ]),
    sessionHistoryRequirements: ["America/New_York current and prior trading sessions"],
    weekHistoryRequirements: 1,
    requiredFactTypes: ["DEALING_RANGE", "PD_LOCATION", "LIQUIDITY", "DISPLACEMENT", "PD_ARRAY"]
  }),
  LONDON_RAID_V1: live({
    ownerId: "nasdaq_london_raid_ny_reversal_v1",
    consumerId: "live.london_raid_v1",
    purpose: "Session ranges, prior-day liquidity, Sunday open, and bounded latest-session evaluation.",
    requiredTimeframes: liveFrames([
      ["W1", 2, 2, 90, "COMPATIBILITY_BASELINE", "Current weekly bias compatibility."],
      ["D1", 10, 10, 90, "COMPATIBILITY_BASELINE", "Prior-day context."],
      ["H4", 40, 40, 90, "COMPATIBILITY_BASELINE", "Current HTF context."],
      ["H1", 120, 120, 90, "COMPATIBILITY_BASELINE", "Current HTF context."],
      ["M15", 160, 160, 90, "COMPATIBILITY_BASELINE", "Session/FVG context."],
      ["M5", 300, 300, 90, "CODE_REQUIRED", "Detector requires at least 48 bars; 300 preserves live compatibility."]
    ]),
    sessionHistoryRequirements: ["Asia", "London", "New York AM", "prior trading day", "latest Sunday open"],
    weekHistoryRequirements: 2
  }),
  MMXM_CONTEXT: live({
    ownerId: "ict_mmxm_framework",
    consumerId: "context.mmxm",
    purpose: "Context-only MMXM classification; never contributes geometry or arbitration.",
    requiredTimeframes: liveFrames([
      ["H1", 120, 120, 90, "COMPATIBILITY_BASELINE", "Structural role compatibility."],
      ["M15", 160, 160, 90, "COMPATIBILITY_BASELINE", "Intermediate role compatibility."],
      ["M5", 300, 300, 90, "COMPATIBILITY_BASELINE", "Execution role compatibility."]
    ]),
    sessionHistoryRequirements: [],
    weekHistoryRequirements: 0,
    requiredFactTypes: ["LIQUIDITY", "DEALING_RANGE", "DISPLACEMENT", "MSS"]
  }),
  I4_I5_CONTEXT: live({
    ownerId: "ict_i4_i5_context",
    consumerId: "context.i4_i5",
    purpose: "Unicorn/OTE/delivery/opening-gap/TGIF context without candidate authority.",
    requiredTimeframes: liveFrames([
      ["W1", 2, 2, 90, "COMPATIBILITY_BASELINE", "NWOG and weekly-state compatibility."],
      ["D1", 20, 20, 90, "COMPATIBILITY_BASELINE", "NDOG and daily-state compatibility."],
      ["H4", 40, 40, 90, "COMPATIBILITY_BASELINE", "PD-array context."],
      ["H1", 120, 120, 90, "COMPATIBILITY_BASELINE", "Delivery context."],
      ["M15", 160, 160, 90, "COMPATIBILITY_BASELINE", "Composite context."],
      ["M5", 300, 300, 90, "COMPATIBILITY_BASELINE", "Execution-time context."]
    ]),
    sessionHistoryRequirements: ["America/New_York calendar evidence"],
    weekHistoryRequirements: 2,
    requiredFactTypes: ["PD_ARRAY", "OPENING_GAP"]
  })
});

export const CANONICAL_TACTICAL_IFVG_V4_REQUIREMENT: CanonicalDataRequirement = {
  contractVersion: "1.0.0",
  ownerId: "ict_ifvg_shallow_retest_v4",
  consumerId: "research.ifvg_v4",
  tier: "TACTICAL_RESEARCH",
  purpose: "Frozen tactical IFVG v4 research sample; not a live-context horizon.",
  requiredTimeframes: [{ timeframe: "M5", minimumWarmupBars: 100, evaluationBars: 900, optionalMaximumHistoryBars: 1000, basis: "RESEARCH_PARAMETER", reason: "Preserved maxResearchCandles=1000." }],
  sessionHistoryRequirements: [],
  weekHistoryRequirements: 0,
  requiresCompletedBars: true,
  continuityPolicy: "REPORT_ONLY",
  researchWindow: { maximumCandles: 1000, basis: "RESEARCH_PARAMETER" }
};

export const CANONICAL_IFVG_V4_VALIDATION_REQUIREMENT: CanonicalDataRequirement = {
  ...CANONICAL_TACTICAL_IFVG_V4_REQUIREMENT,
  consumerId: "validation.ifvg_v4",
  tier: "HISTORICAL_VALIDATION",
  purpose: "Frozen validation-only 180-day source; never inherited by live context.",
  requiredTimeframes: [{ timeframe: "M5", minimumWarmupBars: 100, evaluationBars: 49_900, minimumCalendarDays: 180, optionalMaximumHistoryBars: 50_000, basis: "RESEARCH_PARAMETER", reason: "Existing frozen validation source." }],
  validationWindow: { calendarDays: 180, maximumCandles: 50_000, basis: "RESEARCH_PARAMETER" }
};

export const canonicalLiveRequirements = () => Object.values(CANONICAL_LIVE_DATA_REQUIREMENTS);

export const canonicalCharterRequirement = (owner: CanonicalDataRequirement, profileId: string): CanonicalDataRequirement => ({
  ...owner,
  consumerId: `charter.${profileId}`,
  purpose: `Charter profile ${profileId} inherits ${owner.ownerId}; no duplicate fetch requirement.`,
  inheritsOwnerId: owner.ownerId
});
