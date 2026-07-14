import type { IctCurrentRead } from "../ict-strategy-suite/ictCurrentReadTypes";
import type { ResearchRuntimeSnapshot } from "../runtime/researchRuntimeTypes";
import type {
  ForwardDecisionState,
  ForwardMarketPhase,
  ForwardScenario,
  ForwardScenarioDirection,
  ForwardScenarioFamily,
  ForwardScenarioMap,
  ForwardScenarioMapInput,
  ForwardScenarioProbabilityBand,
  ForwardScenarioResearchRecommendation,
  ForwardScenarioSetupType
} from "./forwardScenarioTypes";

const authority = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

const safety = {
  researchOnly: true as const,
  rawCandlesExcluded: true as const,
  rawSnapshotsExcluded: true as const,
  autoApplyAllowed: false as const,
  autoPromotionAllowed: false as const
};

const unconfirmedNotice = "Research-only scenario forecast. Not a confirmed setup. No execution authority." as const;
const confirmedNotice = "Research-only confirmed setup. Paper-demo/live execution still blocked unless readiness gates pass." as const;
const validations = ["replay", "walk_forward", "evidence", "maturity", "regime_consistency"] as const;

const unique = (values: Array<string | undefined>, limit = 8) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))).slice(0, limit);

const clampConfidence = (value: number) => Number(Math.max(0, Math.min(1, value)).toFixed(2));

const stableId = (...parts: Array<string | number | undefined>) => {
  const value = parts.filter((part) => part !== undefined).join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
};

const sessionFor = (timestamp: string) => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(timestamp));
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
    const clock = hour * 60 + minute;
    if (clock >= 120 && clock < 300) return "London";
    if (clock >= 510 && clock < 720) return "New York AM";
    if (clock >= 720 && clock < 810) return "New York Lunch";
    if (clock >= 810 && clock < 960) return "New York PM";
    return "Globex / Asia";
  } catch {
    return "unknown";
  }
};

const textIncludes = (input: ForwardScenarioMapInput, pattern: RegExp) =>
  [...(input.missingConfirmations ?? []), ...(input.blockers ?? []), ...(input.warnings ?? [])].some((item) => pattern.test(item));

const directionFrom = (input: ForwardScenarioMapInput): ForwardScenarioDirection =>
  input.direction && input.direction !== "neutral"
    ? input.direction
    : input.ifvgDirection && input.ifvgDirection !== "neutral"
      ? input.ifvgDirection
      : input.liquidityDrawDirection ?? "neutral";

const oppositeDirection = (direction: ForwardScenarioDirection): ForwardScenarioDirection =>
  direction === "bullish" ? "bearish" : direction === "bearish" ? "bullish" : "neutral";

const probabilityFor = (score: number, confirmed: boolean): ForwardScenarioProbabilityBand =>
  confirmed && score >= 78 ? "high" : score >= 48 ? "moderate" : "low";

const entryPlanFor = (input: ForwardScenarioMapInput, trigger: string) => ({
  status: input.conditionalEntryZone ? "conditional" as const : "unavailable" as const,
  label: "Conditional entry zone if confirmation appears" as const,
  zone: input.conditionalEntryZone,
  trigger,
  researchOnly: true as const
});

const stopPlanFor = (input: ForwardScenarioMapInput, condition: string) => ({
  status: typeof input.conditionalStopReference === "number" ? "conditional" as const : "unavailable" as const,
  label: "Conditional stop reference" as const,
  referencePrice: input.conditionalStopReference,
  condition,
  researchOnly: true as const
});

const targetPlanFor = (input: ForwardScenarioMapInput, fallbackLabel: string) => ({
  status: input.conditionalTargets?.length ? "conditional" as const : "unavailable" as const,
  label: "Conditional target references" as const,
  references: input.conditionalTargets?.slice(0, 4) ?? [{ label: fallbackLabel }],
  condition: "Targets become research-valid only after the scenario confirmation sequence completes.",
  researchOnly: true as const
});

interface ScenarioDraft {
  family: ForwardScenarioFamily;
  direction: ForwardScenarioDirection;
  setupType: ForwardScenarioSetupType;
  score: number;
  thesis: string;
  liquidityDraw: string;
  expectedSequence: string[];
  requiredConfirmations: string[];
  invalidationConditions: string[];
  upgrade: string[];
  downgrade: string[];
  entryTrigger: string;
  stopCondition: string;
  targetFallback: string;
  confirmed?: boolean;
}

const scenarioFrom = (input: ForwardScenarioMapInput, draft: ScenarioDraft): ForwardScenario => {
  const requiredConfirmations = unique(draft.requiredConfirmations, 6);
  const confirmed = Boolean(draft.confirmed && requiredConfirmations.length === 0);
  return {
    scenarioId: `forward_${draft.family}_${stableId(input.sourceFingerprint, input.timestamp, draft.family, draft.direction)}`,
    scenarioFamily: draft.family,
    direction: draft.direction,
    setupType: draft.setupType,
    probabilityBand: probabilityFor(draft.score, confirmed),
    confidence: clampConfidence(draft.score / 100),
    thesis: draft.thesis,
    liquidityDraw: draft.liquidityDraw,
    expectedSequence: unique(draft.expectedSequence, 6),
    requiredConfirmations,
    invalidationConditions: unique(draft.invalidationConditions, 6),
    conditionalEntryPlan: entryPlanFor(input, draft.entryTrigger),
    conditionalStopPlan: stopPlanFor(input, draft.stopCondition),
    conditionalTargetPlan: targetPlanFor(input, draft.targetFallback),
    whyNotConfirmedYet: requiredConfirmations.length ? requiredConfirmations : ["Deterministic confirmation is complete; readiness gates still remain."],
    whatWouldUpgradeThis: unique(draft.upgrade, 6),
    whatWouldDowngradeThis: unique(draft.downgrade, 6),
    safetyNotice: confirmed ? confirmedNotice : unconfirmedNotice
  };
};

const fallbackScenario = (input: ForwardScenarioMapInput, reasons: string[]): ScenarioDraft => ({
  family: "no_trade_waiting_for_liquidity",
  direction: "neutral",
  setupType: "no_trade",
  score: 24,
  thesis: "No sufficiently clear liquidity draw and confirmation sequence is present, so the correct forecast is to wait.",
  liquidityDraw: input.liquidityDraw ?? "No clean external liquidity objective resolved.",
  expectedSequence: ["A clear liquidity pool forms", "Price raids or rejects the pool", "A registered setup supplies confirmation"],
  requiredConfirmations: unique([...(reasons.length ? reasons : ["A clean liquidity draw is required."]), "A registered trade setup must confirm."], 6),
  invalidationConditions: ["Context remains balanced without displacement or a usable source zone."],
  upgrade: ["Resolve a nearby liquidity pool and directional reaction.", "Confirm a registered setup with causal entry evidence."],
  downgrade: ["Source becomes stale or incomplete.", "Price remains in noisy range-bound delivery."],
  entryTrigger: "No conditional entry is prepared until a registered setup confirms.",
  stopCondition: "No stop reference is available without a valid setup structure.",
  targetFallback: "No conditional target is available without a clean liquidity draw."
});

const draftScenarios = (input: ForwardScenarioMapInput) => {
  const drafts: ScenarioDraft[] = [];
  const direction = directionFrom(input);
  const missing = unique(input.missingConfirmations ?? [], 10);
  const sweepMissing = !input.liquiditySwept || textIncludes(input, /no .*sweep|sweep .*missing|liquidity .*not.*swept/i);
  const mitigationMissing = !input.mitigationDetected || textIncludes(input, /mitigation .*missing|mitigation .*could not|source zone .*missing/i);
  const displacementMissing = !input.displacementConfirmed || textIncludes(input, /no clean .*expansion|displacement .*missing|expansion .*missing/i);
  const hasLiquidityDraw = Boolean(input.liquidityDraw || input.conditionalTargets?.length || input.recentRange?.high || input.recentRange?.low);
  const hasLondonContext = Boolean(input.londonRange?.high || input.londonRange?.low || input.twelveAmOpen || textIncludes(input, /london|12am|midnight/i));

  if (input.ifvgFreshRetestState && input.ifvgFreshRetestState !== "absent") {
    const ifvgDirection = input.ifvgDirection ?? direction;
    const family: ForwardScenarioFamily = input.ifvgFreshRetestState === "invalidated" || textIncludes(input, /ifvg.*reversal|inversion.*reversal/i)
      ? "ifvg_fresh_retest_reversal"
      : "ifvg_fresh_retest_continuation";
    const ifvgMissing = unique([
      input.ifvgFreshRetestState === "partial" ? "Fresh IFVG retest must occur on the latest closed candle." : undefined,
      displacementMissing ? "Directional displacement must remain clean after the retest." : undefined,
      ...missing.filter((item) => /ifvg|retest|displacement|target|invalidation/i.test(item))
    ], 6);
    drafts.push({
      family,
      direction: ifvgDirection,
      setupType: "intraday_expansion",
      score: 58 + (input.ifvgProfileStrength === "frozen_validated" ? 12 : input.ifvgProfileStrength === "promising" ? 6 : 0) + (input.ifvgZone ? 5 : 0) + (input.ifvgFreshRetestState === "confirmed" ? 12 : 0),
      thesis: family === "ifvg_fresh_retest_continuation"
        ? "A fresh IFVG zone may support continuation if the clean causal retest and displacement sequence completes."
        : "An inverted FVG may support reversal only after rejection, fresh retest, and displacement confirm the new delivery state.",
      liquidityDraw: input.liquidityDraw ?? "Next opposing external liquidity after the IFVG retest.",
      expectedSequence: ["Fresh IFVG remains unused", "Latest closed candle retests the zone", "Clean displacement confirms direction", "Price seeks external liquidity"],
      requiredConfirmations: ifvgMissing,
      invalidationConditions: ["IFVG zone is invalidated before a clean retest.", "Price closes through the conditional stop reference.", "Retest becomes stale or occurs after extension."],
      upgrade: ["Clean latest-candle retest completes.", "Displacement closes away from the zone.", "External liquidity target remains available."],
      downgrade: ["Zone is reused before entry evidence.", "Retest is stale or choppy.", "Target or invalidation structure disappears."],
      entryTrigger: "Use the IFVG zone only if the fresh clean retest and directional displacement complete.",
      stopCondition: "Reference the far side of the causal IFVG structure; no broker order is created.",
      targetFallback: "Next opposing external liquidity pool.",
      confirmed: input.confirmedSetup && input.ifvgFreshRetestState === "confirmed"
    });
  }

  if (hasLiquidityDraw && sweepMissing) {
    drafts.push({
      family: hasLondonContext ? "post_london_liquidity_sweep_reversal" : "ny_am_mitigation_reversal",
      direction: oppositeDirection(input.liquidityDrawDirection ?? direction),
      setupType: "intraday_expansion",
      score: 52 + (hasLondonContext ? 5 : 0) + (input.currentSession?.includes("New York") ? 5 : 0),
      thesis: "A nearby liquidity pool is unresolved. The scenario remains anticipatory until a sweep, reclaim, and rejection establish reversal intent.",
      liquidityDraw: input.liquidityDraw ?? "Nearby unresolved liquidity pool.",
      expectedSequence: ["Price reaches the liquidity pool", "Sweep and reclaim occur", "Rejection or delivery shift confirms", "Price rotates toward opposing liquidity"],
      requiredConfirmations: ["Liquidity sweep is required.", "Reclaim or rejection must close back through the reference.", ...missing.filter((item) => /sweep|reclaim|reject/i.test(item))],
      invalidationConditions: ["Price accepts beyond the swept pool without reclaim.", "Session timing expires without a delivery shift."],
      upgrade: ["Sweep and reclaim print in the active session.", "CISD, displacement, or IFVG confirms the reversal."],
      downgrade: ["Price expands through the pool without rejection.", "No opposing target remains."],
      entryTrigger: "Wait for a sweep, reclaim, and registered reversal confirmation before considering the conditional zone.",
      stopCondition: "Reference beyond the swept liquidity extreme after confirmation.",
      targetFallback: "Opposing session or external liquidity."
    });
  }

  if (input.liquiditySwept && mitigationMissing) {
    drafts.push({
      family: "ny_am_mitigation_reversal",
      direction,
      setupType: "intraday_expansion",
      score: 62 + (input.currentSession?.includes("New York") ? 6 : 0),
      thesis: "Liquidity has been swept, but price has not yet returned to a valid mitigation source zone.",
      liquidityDraw: input.liquidityDraw ?? "Opposing external liquidity after mitigation.",
      expectedSequence: ["Liquidity sweep holds", "Price returns to IFVG/order block/source zone", "Mitigation rejects", "Displacement resumes toward target"],
      requiredConfirmations: ["Return to a valid IFVG, order block, or source zone is required.", ...missing.filter((item) => /mitigation|ifvg|order block|source zone/i.test(item))],
      invalidationConditions: ["Sweep extreme fails before mitigation.", "Mitigation zone is traded through without rejection."],
      upgrade: ["Valid source zone is tagged and respected.", "Lower-timeframe rejection confirms direction."],
      downgrade: ["No source zone can be resolved.", "Price chops through both sides of the range."],
      entryTrigger: "Prepare the conditional zone only after price mitigates a resolved source area.",
      stopCondition: "Reference beyond the sweep or source-zone invalidation after confirmation.",
      targetFallback: "Opposing external liquidity."
    });
  }

  if (input.mitigationDetected && displacementMissing) {
    drafts.push({
      family: input.ifvgFreshRetestState && input.ifvgFreshRetestState !== "absent" ? "ifvg_fresh_retest_continuation" : "ny_am_mitigation_reversal",
      direction,
      setupType: "intraday_expansion",
      score: 67,
      thesis: "Mitigation has occurred, but clean directional displacement has not confirmed that delivery changed or resumed.",
      liquidityDraw: input.liquidityDraw ?? "Opposing external liquidity after displacement.",
      expectedSequence: ["Mitigation zone holds", "Displacement closes away", "Fresh imbalance remains", "Price expands toward liquidity"],
      requiredConfirmations: ["Clean directional displacement is required.", ...missing.filter((item) => /displacement|expansion|fvg/i.test(item))],
      invalidationConditions: ["Mitigation zone fails before displacement.", "Price returns to balanced chop around the source zone."],
      upgrade: ["Body-close displacement clears local structure.", "A fresh FVG or IFVG supports continuation."],
      downgrade: ["Repeated overlap signals chop.", "No clean external target remains."],
      entryTrigger: "The conditional entry becomes valid only after displacement confirms the mitigation reaction.",
      stopCondition: "Reference beyond the mitigation structure after displacement.",
      targetFallback: "External liquidity in the displacement direction."
    });
  }

  if (input.consolidationDetected) {
    drafts.push({
      family: "consolidation_raid_displacement",
      direction,
      setupType: "intraday_expansion",
      score: 48 + (input.liquiditySwept ? 10 : 0) + (input.displacementConfirmed ? 10 : 0),
      thesis: "A defined consolidation may produce a raid-and-displacement sequence, but range context alone is not a trade candidate.",
      liquidityDraw: input.liquidityDraw ?? "Consolidation high or low followed by opposing external liquidity.",
      expectedSequence: ["Range boundary is raided", "Price rejects back through the range", "Displacement confirms distribution", "External liquidity becomes the draw"],
      requiredConfirmations: unique([!input.liquiditySwept ? "A consolidation boundary raid is required." : undefined, !input.displacementConfirmed ? "Displacement away from the raid is required." : undefined]),
      invalidationConditions: ["Price accepts outside the range without reclaim.", "Both boundaries are repeatedly raided without displacement."],
      upgrade: ["Single-sided raid and reclaim completes.", "Displacement leaves a usable FVG or IFVG."],
      downgrade: ["Two-sided chop continues.", "Range boundaries are not structurally clear."],
      entryTrigger: "Wait for a boundary raid, reclaim, and displacement before using a conditional entry zone.",
      stopCondition: "Reference beyond the raid extreme after confirmation.",
      targetFallback: "Opposing range boundary or external liquidity."
    });
  }

  if (input.model1State && input.model1State !== "absent") {
    drafts.push({
      family: "model_1_continuation",
      direction,
      setupType: "larger_setup",
      score: input.model1State === "confirmed" ? 76 : input.model1State === "invalidated" ? 25 : 50,
      thesis: "Model 1 continuation remains conditional on timing, opening-price alignment, and a valid displacement/retest sequence.",
      liquidityDraw: input.liquidityDraw ?? "Higher-timeframe external liquidity.",
      expectedSequence: ["Opening-price context aligns", "Displacement confirms delivery", "Retest holds", "Expansion seeks external liquidity"],
      requiredConfirmations: unique([input.model1State === "partial" ? "Model 1 timing and entry confirmation remain incomplete." : undefined, ...missing.filter((item) => /model 1|timing|open|alignment/i.test(item))]),
      invalidationConditions: ["Model 1 timing expires.", "Opening-price or PD-array alignment fails."],
      upgrade: ["Timing remains valid.", "Entry confirmation and external target align."],
      downgrade: ["Timing expires.", "Grinch profile becomes invalid."],
      entryTrigger: "Use the conditional Model 1 zone only after timing and entry confirmation pass.",
      stopCondition: "Reference the confirmed Model 1 invalidation structure.",
      targetFallback: "Higher-timeframe external liquidity.",
      confirmed: input.confirmedSetup && input.model1State === "confirmed"
    });
  }

  if (hasLondonContext && !drafts.some((draft) => draft.family === "london_12am_open_expansion")) {
    drafts.push({
      family: "london_12am_open_expansion",
      direction,
      setupType: "intraday_expansion",
      score: 40 + (input.displacementConfirmed ? 15 : 0),
      thesis: "London and 12AM Open context define a possible expansion path, but price must interact and displace cleanly away.",
      liquidityDraw: input.liquidityDraw ?? "External liquidity away from the 12AM Open context.",
      expectedSequence: ["London interacts with the 12AM Open context", "Price establishes direction", "Clean displacement expands away", "External liquidity is targeted"],
      requiredConfirmations: unique([sweepMissing ? "London interaction or liquidity event is required." : undefined, displacementMissing ? "Clean expansion away from the 12AM Open is required." : undefined]),
      invalidationConditions: ["Price chops repeatedly around the 12AM Open.", "Expansion timing expires without distance."],
      upgrade: ["London interaction is followed by clean displacement.", "Price holds one side of the 12AM Open."],
      downgrade: ["Repeated crossings increase chop score.", "Required expansion distance is not reached."],
      entryTrigger: "Wait for clean expansion and a registered retest before considering a conditional zone.",
      stopCondition: "Reference the failed side of the opening-price context after confirmation.",
      targetFallback: "External liquidity away from the 12AM Open."
    });
  }

  if (input.rangeBound && !input.consolidationDetected) {
    drafts.push({
      family: "range_reversion_scalp",
      direction: "neutral",
      setupType: "scalp",
      score: 34,
      thesis: "Range reversion is context only until a boundary raid and rejection define direction.",
      liquidityDraw: input.liquidityDraw ?? "Nearest range boundary.",
      expectedSequence: ["Price reaches a range boundary", "Boundary raid rejects", "Short-horizon delivery shifts", "Price rotates toward equilibrium"],
      requiredConfirmations: ["Boundary raid and rejection are required.", "A registered scalp model must define direction."],
      invalidationConditions: ["Price accepts outside the range.", "Range width or volatility makes the target uneconomic."],
      upgrade: ["Clear single-sided rejection forms.", "Conditional RR reaches the registered minimum."],
      downgrade: ["Two-sided chop continues.", "No usable target exists before equilibrium."],
      entryTrigger: "No conditional entry exists until a boundary rejection confirms direction.",
      stopCondition: "Reference beyond the rejected boundary only after confirmation.",
      targetFallback: "Range equilibrium or opposing internal liquidity."
    });
  }

  return drafts.length ? drafts : [fallbackScenario(input, unique([...missing, ...(input.blockers ?? [])], 5))];
};

const recommendationFor = (scenario: ForwardScenario): ForwardScenarioResearchRecommendation => {
  const candidateFamily = scenario.scenarioFamily.startsWith("ifvg_fresh_retest")
    ? "ifvg_fresh_retest_v3_research" as const
    : scenario.scenarioFamily === "post_london_liquidity_sweep_reversal" || scenario.scenarioFamily === "ny_am_mitigation_reversal"
      ? "reversal_expansion_confirmation" as const
      : undefined;
  const frozenIfvg = candidateFamily === "ifvg_fresh_retest_v3_research";
  return {
    action: candidateFamily ? "evaluate_candidate_family" : "collect_more_evidence",
    scenarioFamily: scenario.scenarioFamily,
    candidateFamily,
    reason: candidateFamily
      ? `Evaluate ${candidateFamily.replace(/_/g, " ")} against the developing ${scenario.scenarioFamily.replace(/_/g, " ")} scenario. Prediction is not confirmation.`
      : `Collect the missing confirmations for ${scenario.scenarioFamily.replace(/_/g, " ")} before creating a new executable candidate family.`,
    requiredValidations: [...validations],
    mutateFrozenProfile: false,
    suggestedProfileFork: frozenIfvg ? "ifvg_fresh_retest_v4_candidate" : undefined,
    autoApplyAllowed: false,
    autoPromotionAllowed: false
  };
};

const marketPhaseFor = (input: ForwardScenarioMapInput): ForwardMarketPhase => {
  if (input.marketPhase) return input.marketPhase;
  if (input.displacementConfirmed) return input.mitigationDetected ? "expansion" : "displacement";
  if (input.mitigationDetected || input.ifvgFreshRetestState === "partial") return "retracement";
  if (input.liquiditySwept) return "manipulation";
  if (input.consolidationDetected || input.rangeBound) return "consolidation";
  return "unknown";
};

const decisionStateFor = (input: ForwardScenarioMapInput, primary: ForwardScenario): ForwardDecisionState => {
  if (input.invalidated) return "invalidated";
  if (input.confirmedSetup && primary.requiredConfirmations.length === 0) return "confirmed_setup";
  if (input.liquiditySwept || input.mitigationDetected || input.ifvgFreshRetestState === "partial") return "developing_setup";
  if (primary.scenarioFamily === "no_trade_waiting_for_liquidity" || primary.setupType === "no_trade") return "no_trade";
  if (primary.confidence >= 0.48) return "anticipated_scenario";
  return "wait_for_confirmation";
};

export const buildForwardScenarioMap = (rawInput: ForwardScenarioMapInput): ForwardScenarioMap => {
  const timestamp = rawInput.timestamp ?? new Date().toISOString();
  const input: ForwardScenarioMapInput = { ...rawInput, timestamp, currentSession: rawInput.currentSession ?? sessionFor(timestamp) };
  const mockSource = /mock|sample/i.test(input.sourceProvider);
  const drafts = mockSource
    ? [fallbackScenario(input, ["A non-mock canonical research source is required."])]
    : draftScenarios(input);
  const ranked = drafts
    .slice()
    .sort((left, right) => right.score - left.score || left.family.localeCompare(right.family))
    .map((draft) => scenarioFrom(input, draft));
  const primaryScenario = ranked[0] ?? scenarioFrom(input, fallbackScenario(input, ["No scenario context is available."]));
  const secondaryScenario = ranked[1];
  const invalidationScenario = scenarioFrom(input, {
    ...fallbackScenario(input, primaryScenario.invalidationConditions),
    direction: oppositeDirection(primaryScenario.direction),
    thesis: `If ${primaryScenario.invalidationConditions[0] ?? "the primary structure fails"}, invalidate the primary forecast and return to observation.`,
    score: 20
  });
  const currentDecisionState = mockSource ? "no_trade" : decisionStateFor(input, primaryScenario);
  const missingConfirmations = unique([
    ...primaryScenario.requiredConfirmations,
    ...(secondaryScenario?.requiredConfirmations ?? []),
    ...(input.missingConfirmations ?? [])
  ], 10);
  const nextEvidenceToWatch = unique([
    ...primaryScenario.whatWouldUpgradeThis,
    ...primaryScenario.expectedSequence.slice(0, 3),
    ...(secondaryScenario?.whatWouldUpgradeThis.slice(0, 2) ?? [])
  ], 8);
  return {
    scenarioMapId: `scenario_map_${stableId(input.sourceFingerprint, timestamp, primaryScenario.scenarioFamily)}`,
    timestamp,
    sourceProvider: input.sourceProvider,
    requestedSymbol: input.requestedSymbol,
    brokerSymbol: input.brokerSymbol,
    timeframe: input.timeframe,
    sourceFingerprint: input.sourceFingerprint,
    currentSession: input.currentSession ?? "unknown",
    marketPhase: marketPhaseFor(input),
    currentDecisionState,
    primaryScenario,
    secondaryScenario,
    invalidationScenario,
    missingConfirmations,
    nextEvidenceToWatch,
    recommendedResearchTest: recommendationFor(primaryScenario),
    authority,
    safety
  };
};

const parseEntryZone = (value?: string) => {
  const values = value?.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
  return values.length >= 2 ? { lower: Math.min(values[0], values[1]), upper: Math.max(values[0], values[1]) } : undefined;
};

const directionForCurrentRead = (read: IctCurrentRead): ForwardScenarioDirection =>
  read.side === "long" ? "bullish" : read.side === "short" ? "bearish" : read.opportunityDirection ?? "neutral";

export const buildForwardScenarioMapFromCurrentRead = (read: IctCurrentRead): ForwardScenarioMap => {
  const ifvgOpportunity = read.currentOpportunities?.find((item) => item.strategyId === "ifvg_fresh_retest_v3_research");
  const text = [...read.topReasons, ...read.opportunityMissingEvidence, ...read.opportunityBlockers].join(" ");
  const ifvgState = ifvgOpportunity
    ? ifvgOpportunity.status === "valid_candidate"
      ? "confirmed" as const
      : /invalid|reject/i.test(ifvgOpportunity.status)
        ? "invalidated" as const
        : "partial" as const
    : /ifvg|fresh retest|retest/i.test(text)
      ? "partial" as const
      : "absent" as const;
  const tradeIdea = read.opportunityTradeIdea;
  const entry = parseEntryZone(read.entryZone);
  const targets = typeof read.target === "number"
    ? [{ label: read.drawOnLiquidity ?? "Conditional external liquidity target", price: read.target }]
    : read.drawOnLiquidity
      ? [{ label: read.drawOnLiquidity }]
      : undefined;
  return buildForwardScenarioMap({
    timestamp: read.debug.lastEvaluationAt,
    sourceProvider: read.packetSource === "live_mt5" ? "mt5_read_only" : read.packetSource,
    requestedSymbol: read.requestedSymbol,
    brokerSymbol: read.brokerSymbol,
    timeframe: read.primaryTimeframe,
    sourceFingerprint: read.debug.sourceFingerprint,
    regime: read.sessionNarrativeProfile,
    evidenceQuality: read.approvalScore,
    direction: directionForCurrentRead(read),
    confirmedSetup: read.approvedStatus === "approved_research_candidate" && read.side !== "flat",
    invalidated: read.opportunityStage === "failed" || read.modelState === "invalidated",
    liquidityDraw: read.drawOnLiquidity,
    liquidityDrawDirection: directionForCurrentRead(read),
    liquiditySwept: Boolean(read.liquiditySwept && !/missing|none|unknown/i.test(read.liquiditySwept)),
    mitigationDetected: Boolean(read.sessionMitigationDetected),
    displacementConfirmed: Boolean(read.displacementStatus && !/missing|none|unknown/i.test(read.displacementStatus)),
    consolidationDetected: read.sessionNarrativeProfile === "consolidation_manipulation_distribution" || read.modelName === "consolidation_manipulation_distribution",
    rangeBound: read.sessionNarrativeProfile === "range_bound" || read.opportunityType === "range_liquidity_sweep",
    premiumDiscountContext: read.dealingRangeLocation,
    ifvgFreshRetestState: ifvgState,
    ifvgDirection: directionForCurrentRead(read),
    ifvgZone: entry,
    ifvgProfileStrength: ifvgState === "absent" ? "unvalidated" : "frozen_validated",
    model1State: /model 1/i.test(text) ? (/expired|invalid/i.test(text) ? "invalidated" : "partial") : "absent",
    grinchProfile: read.bestSetup,
    conditionalEntryZone: entry,
    conditionalStopReference: tradeIdea?.invalidation ?? read.invalidation,
    conditionalTargets: tradeIdea?.target ? [{ label: read.drawOnLiquidity ?? "Conditional target", price: tradeIdea.target }] : targets,
    missingConfirmations: unique([...read.opportunityMissingEvidence, ...(read.modelMissingEvidence ?? []), ...read.topReasons], 10),
    blockers: unique([...read.opportunityBlockers, read.paperSimAllowed ? undefined : read.paperSimEligibilityReason], 8),
    warnings: unique([read.smtReason, read.riskReason, read.weeklyBiasReason], 6)
  });
};

export const buildForwardScenarioMapFromRuntime = (snapshot: ResearchRuntimeSnapshot): ForwardScenarioMap => {
  const latest = snapshot.latestResearchCycle;
  const thesis = latest.latestThesisSummary;
  const thesisBias = thesis && "finalBias" in thesis ? thesis.finalBias : thesis?.bias;
  const bias = thesisBias === "bullish" ? "bullish" : thesisBias === "bearish" ? "bearish" : "neutral";
  const thesisInvalidation = thesis && "invalidation" in thesis ? thesis.invalidation : undefined;
  const thesisTarget = thesis && "target" in thesis ? thesis.target : undefined;
  const grinch = latest.activeGrinchProfileSummary;
  const blockers = unique([
    ...snapshot.readiness.actualBlockers,
    grinch?.primaryRuleBlock,
    grinch?.hardGateReason,
    ...snapshot.walkForward.warnings
  ], 10);
  return buildForwardScenarioMap({
    timestamp: latest.latestCycleTimestamp ?? snapshot.generatedAt,
    sourceProvider: String(snapshot.marketData.activeResearchSource.provider),
    requestedSymbol: String(snapshot.marketData.symbol),
    brokerSymbol: snapshot.marketData.activeResearchSource.provenance.providerSymbol ?? snapshot.marketData.activeResearchSource.symbol,
    timeframe: snapshot.marketData.activeResearchSource.timeframe,
    sourceFingerprint: snapshot.marketData.activeResearchSource.fingerprint,
    regime: snapshot.regime.label,
    evidenceQuality: snapshot.evidence.evidenceQualityScore,
    direction: bias,
    confirmedSetup: false,
    liquidityDraw: latest.grinchPhase1Summary?.htfDrawOnLiquidity,
    liquidityDrawDirection: bias,
    liquiditySwept: /sweep.*(detected|confirmed)|liquidity.*swept/i.test(blockers.join(" ")),
    mitigationDetected: /mitigation.*detected|mitigation.*complete/i.test(blockers.join(" ")),
    displacementConfirmed: /displacement.*confirmed|clean.*expansion/i.test(blockers.join(" ")) && !/missing|no clean/i.test(blockers.join(" ")),
    consolidationDetected: grinch?.profile === "consolidation",
    rangeBound: /range/i.test(snapshot.regime.label),
    model1State: grinch?.profile === "model_1" ? (grinch.noValidProfile ? "invalidated" : "partial") : "absent",
    grinchProfile: grinch?.profile,
    conditionalStopReference: thesisInvalidation,
    conditionalTargets: typeof thesisTarget === "number" ? [{ label: "Conditional thesis target", price: thesisTarget }] : undefined,
    missingConfirmations: blockers,
    blockers,
    warnings: unique([
      ...snapshot.diagnostics.staleStateWarnings,
      ...snapshot.diagnostics.mismatchWarnings
    ], 8)
  });
};

export const recommendedAutoResearchCandidateFamilyForScenarioMap = (map?: ForwardScenarioMap) =>
  map?.recommendedResearchTest?.candidateFamily;

export const assertForwardScenarioMapIsSafe = (map: ForwardScenarioMap) => {
  const serialized = JSON.stringify(map);
  const forbidden = /"(?:candles|rawCandles|rawSnapshot|snapshot|account|accounts|order|orders|position|positions|password|secret|token|apiKey|api_key|base64)"\s*:/i;
  return {
    ok:
      map.authority.executionAuthority === "none" &&
      map.authority.brokerAuthority === "none" &&
      map.authority.readinessOverrideAuthority === "none" &&
      map.safety.autoApplyAllowed === false &&
      map.safety.autoPromotionAllowed === false &&
      !forbidden.test(serialized),
    serializedBytes: new TextEncoder().encode(serialized).byteLength
  };
};
