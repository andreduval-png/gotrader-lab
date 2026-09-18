import type {
  CurrentOpportunity,
  CurrentOpportunityClassification,
  CurrentOpportunityContext,
  CurrentOpportunityScan,
  CurrentOpportunitySide,
  CurrentOpportunityStatus,
  CurrentOpportunityStrategyId,
  CurrentOpportunitySummary
} from "./currentOpportunityTypes";
import { projectCanonicalTradeGeometry } from "../tradeGeometry/canonicalTradeGeometry";
import { buildCanonicalRuntimeCandidateSet, type CanonicalRuntimeCandidateSet } from "./canonicalRuntimeCandidateSet";
import { attributeCharterOwnerCandidates, buildCharterProfileRuntimeSnapshot } from "../ictCharterProfiles";

const authority = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

const safety = {
  rawCandlesExcluded: true as const,
  rawSnapshotsExcluded: true as const,
  accountDataExcluded: true as const,
  orderDataExcluded: true as const,
  positionDataExcluded: true as const,
  secretsExcluded: true as const
};

const createId = (prefix: string, seed: string) =>
  `${prefix}_${Math.abs([...seed].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7)).toString(36)}`;

const token = (value?: string) => (value?.trim() ? value : "unknown").replace(/_/g, " ");
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const unique = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).slice(0, 8);

const statusRank: Record<CurrentOpportunityStatus, number> = {
  valid_candidate: 8,
  forming: 7,
  near_miss: 6,
  rejected: 5,
  needs_more_data: 4,
  diagnostic_context: 3,
  market_map_only: 3,
  regime_context: 3,
  no_trade_context: 2,
  no_trade: 1
};

const statusForPrimaryContext = (context: CurrentOpportunityContext): CurrentOpportunityStatus => {
  if (context.isMockOrSample) return "rejected";
  if (context.sourceDepth.depthPolicyStatus === "insufficient") return "needs_more_data";
  if (context.currentOpportunityDetected && finite(context.target) && finite(context.invalidation) && finite(context.rrEstimate)) {
    if (context.modelLane === "approved" && context.sourceDepth.validationContextAvailable) return "valid_candidate";
    if (context.modelLane === "paper_watchlist") return "near_miss";
    return "forming";
  }
  if (context.currentOpportunityDetected) return "forming";
  if (context.opportunityMissingEvidence.length || context.opportunityBlockers.length) return "near_miss";
  return "no_trade";
};

const tradeConstructionMissingBlockers = new Set([
  "entry_missing",
  "target_missing",
  "invalidation_missing",
  "structure_bounds_missing",
  "rr_unavailable"
]);

const tradeConstructionBlockerLabels = new Set([
  ...tradeConstructionMissingBlockers,
  "entry",
  "target",
  "invalidation",
  "stop",
  "rr",
  "risk_reward",
  "rr_below_minimum",
  "target_too_close",
  "stop_too_wide",
  "stop_not_beyond_structure",
  "invalid_price_order",
  "unrealistic_rr",
  "source_missing",
  "authority_not_none"
]);

const diagnosticStatuses = new Set<CurrentOpportunityStatus>([
  "diagnostic_context",
  "market_map_only",
  "regime_context",
  "no_trade_context"
]);

const diagnosticStrategyIds = new Set<CurrentOpportunityStrategyId>(["market_map_only_diagnostic_v1"]);

const isDiagnosticOpportunity = (status: CurrentOpportunityStatus, strategyId: CurrentOpportunityStrategyId) =>
  diagnosticStatuses.has(status) || diagnosticStrategyIds.has(strategyId);

const classificationFor = (
  status: CurrentOpportunityStatus,
  strategyId: CurrentOpportunityStrategyId
): CurrentOpportunityClassification => {
  if (isDiagnosticOpportunity(status, strategyId)) return "diagnostic";
  if (status === "valid_candidate") return "trade_candidate";
  if (status === "forming" || status === "near_miss" || status === "needs_more_data") return "forming_candidate";
  if (status === "rejected") return "rejected_trade_candidate";
  return "no_trade";
};

const filterDiagnosticTradeLabels = (values: Array<string | undefined>, classification: CurrentOpportunityClassification) =>
  classification === "diagnostic" ? values.filter((value) => !tradeConstructionBlockerLabels.has(value ?? "")) : values;

const validationFor = (status: CurrentOpportunityStatus) =>
  status === "valid_candidate"
    ? ["replay_required", "walk_forward_required", "evidence_required", "paper_demo_gate_required"] as const
    : status === "forming" || status === "near_miss"
      ? ["replay_required"] as const
      : [] as const;

const opportunity = (
  context: CurrentOpportunityContext,
  patch: Omit<Partial<CurrentOpportunity>, "blockers" | "missingConditions"> & {
    strategyId: CurrentOpportunityStrategyId;
    model: string;
    status: CurrentOpportunityStatus;
    classification?: CurrentOpportunityClassification;
    setupName: string;
    thesis: string;
    geometryMode?: CurrentOpportunity["geometryMode"];
    blockers?: Array<string | undefined>;
    missingConditions?: Array<string | undefined>;
  }
): CurrentOpportunity => {
  const initialClassification = patch.classification ?? classificationFor(patch.status, patch.strategyId);
  const geometry = initialClassification === "diagnostic" ? undefined : patch.geometry;
  const geometryProjection = geometry ? projectCanonicalTradeGeometry(geometry) : undefined;
  const geometryMode = patch.geometryMode ?? (geometry ? "canonical" : "unavailable");
  const finalStatus = patch.status === "valid_candidate" && !geometry
    ? "near_miss"
    : patch.status === "valid_candidate" && geometry?.geometryValid !== true
      ? "near_miss"
      : patch.status;
  const finalClassification = patch.classification ?? classificationFor(finalStatus, patch.strategyId);
  const missingConditions = filterDiagnosticTradeLabels([
    ...(patch.missingConditions ?? []),
    finalClassification !== "diagnostic" && !geometry ? "canonical_geometry_unavailable" : undefined
  ], finalClassification);
  const blockers = filterDiagnosticTradeLabels([
    ...(patch.blockers ?? []),
    ...(geometry?.blockers ?? []),
    geometryMode === "source_blocked" ? "source_native_geometry_unresolved" : undefined
  ], finalClassification);
  const publishGeometry = Boolean(geometryProjection && finalClassification !== "diagnostic");
  const generatedId = createId("current_opp", `${patch.strategyId}:${patch.setupName}:${context.generatedAt}:${finalStatus}`);
  return {
    id: patch.id ?? generatedId,
    candidateId: patch.candidateId ?? patch.id ?? generatedId,
    strategyId: patch.strategyId,
    strategyVersion: patch.strategyVersion,
    profileId: patch.profileId,
    candidateState: patch.candidateState,
    contextIdentity: patch.contextIdentity,
    prerequisiteIdentity: patch.prerequisiteIdentity,
    model: patch.model,
    symbol: context.requestedSymbol,
    brokerSymbol: context.brokerSymbol,
    side: geometry ? (geometry.direction === "LONG" ? "long" : "short") : patch.side ?? "flat",
    timeframe: patch.timeframe ?? context.primaryTimeframe,
    contextTimeframes: context.contextTimeframes,
    status: finalStatus,
    classification: finalClassification,
    setupName: patch.setupName,
    thesis: patch.thesis,
    entry: publishGeometry ? geometryProjection?.intendedEntry : undefined,
    invalidation: publishGeometry ? geometryProjection?.intendedStop : undefined,
    target: publishGeometry ? geometryProjection?.intendedTarget : undefined,
    rrEstimate: publishGeometry ? geometryProjection?.theoreticalRR : undefined,
    geometry,
    geometryMode,
    geometryStatus: geometry?.status,
    canonicalCandidate: patch.canonicalCandidate ?? Boolean(geometry),
    actionable: Boolean(
      geometry?.actionable &&
      geometry.geometryValid &&
      finalStatus === "valid_candidate" &&
      finalClassification !== "diagnostic"
    ),
    confidence: patch.confidence ?? context.confidence ?? 0,
    requiredValidation: patch.requiredValidation ?? [...validationFor(finalStatus)],
    blockers: unique(blockers),
    missingConditions: unique(missingConditions),
    nextAction: finalClassification === "diagnostic"
      ? patch.nextAction ?? "Context only - not a trade candidate. Wait for a registered trade setup before validation."
      : patch.status === "valid_candidate" && !geometry
      ? "No trade - canonical source-native geometry is unavailable."
      : patch.status === "valid_candidate" && geometry && !geometry.geometryValid
      ? `No trade - ${geometry.status.toLowerCase().replace(/_/g, " ")}. Native geometry remains research-visible.`
      : patch.nextAction ?? context.opportunityNextAction ?? "Keep monitoring; no approved research candidate is available.",
    sourceDepth: context.sourceDepth,
    researchOnly: true,
    executionIntentCreated: false,
    authority
  };
};

const coreIctOpportunities = (context: CurrentOpportunityContext): CurrentOpportunity[] =>
  (context.coreIctCandidates?.candidates ?? []).map((candidate) => {
    const executable = candidate.role === "PRIMARY_EXECUTABLE_RESEARCH";
    const status: CurrentOpportunityStatus = candidate.actionable
      ? "valid_candidate"
      : candidate.canonicalGeometry
        ? "rejected"
        : executable && !["SEARCHING", "SOURCE_BLOCKED"].includes(candidate.state)
          ? "forming"
          : "diagnostic_context";
    const label = candidate.strategyId === "ict_2022_model_v1"
      ? "ICT 2022 Model"
      : candidate.strategyId === "ict_power_of_three_v1"
        ? "Power of Three"
        : "Judas Swing";
    return opportunity(context, {
      id: candidate.candidateId,
      candidateId: candidate.candidateId,
      strategyId: candidate.strategyId,
      strategyVersion: candidate.strategyVersion,
      profileId: candidate.profileId,
      candidateState: candidate.state,
      contextIdentity: candidate.contextIdentity,
      canonicalCandidate: true,
      model: label,
      status,
      classification: executable ? undefined : "diagnostic",
      setupName: candidate.strategyId,
      thesis: executable
        ? `Canonical ${label} state ${candidate.state}; geometry remains owned by ${candidate.strategyId}.`
        : `${label} context state ${candidate.state}; no source-complete trade geometry is authorized.`,
      side: candidate.direction === "none" ? "flat" : candidate.direction,
      timeframe: candidate.timeframe,
      geometry: candidate.canonicalGeometry,
      geometryMode: candidate.canonicalGeometry ? "canonical" : candidate.role === "PRIMARY_EXECUTABLE_RESEARCH" ? "unavailable" : "source_blocked",
      blockers: [...candidate.blockers],
      missingConditions: candidate.geometryEligible ? [] : [candidate.blockers[0]],
      nextAction: candidate.actionable
        ? "Preserve this research candidate for replay and evidence validation."
        : candidate.role === "PRIMARY_EXECUTABLE_RESEARCH"
          ? `Wait for the next causal ${label} state; do not complete missing geometry downstream.`
          : "Context only; source-blocked geometry cannot create a plan or BT2 request."
    });
  });

const marketMakerTerminalStates = new Set([
  "INVALIDATED",
  "ENTRY_MISSED",
  "SETUP_EXPIRED",
  "SOURCE_BLOCKED",
  "NO_VALID_TARGET",
  "TARGET_CONSUMED",
  "GEOMETRY_NON_ACTIONABLE"
]);

const marketMakerOpportunities = (context: CurrentOpportunityContext): CurrentOpportunity[] => {
  const collection = context.marketMakerCandidates;
  if (!collection) return [];
  const framework = collection.frameworks
    .slice()
    .sort((left, right) => right.supportingFactIds.length - left.supportingFactIds.length)[0];
  const frameworkOpportunity = framework
    ? opportunity(context, {
        id: `mmxm:${collection.sourceFingerprint}:${framework.deliveryDirection}`,
        candidateId: `mmxm:${collection.sourceFingerprint}:${framework.deliveryDirection}`,
        strategyId: "mmxm_delivery_framework_v1",
        candidateState: framework.phase,
        canonicalCandidate: false,
        model: "MMXM Delivery Framework",
        status: "diagnostic_context",
        classification: "diagnostic",
        setupName: "MMXM delivery context",
        thesis: "Range-owned liquidity engineering, directional delivery, and repricing context only; MMXM cannot create geometry or a signal.",
        side: "flat",
        geometryMode: "unavailable",
        blockers: [...framework.blockers],
        missingConditions: [],
        nextAction: "Context only. MMBM or MMSM must independently complete canonical geometry."
      })
    : undefined;
  const candidates = collection.candidates.map((candidate) => {
    const qualified = candidate.state === "ACTIVE_DELIVERY" && candidate.geometry?.geometryValid === true && candidate.geometry.actionable;
    const rejected = marketMakerTerminalStates.has(candidate.state);
    const label = candidate.direction === "long" ? "Market Maker Buy Model" : "Market Maker Sell Model";
    return opportunity(context, {
      id: candidate.candidateId,
      candidateId: candidate.candidateId,
      strategyId: candidate.strategyId,
      strategyVersion: candidate.strategyVersion,
      profileId: candidate.profileId,
      candidateState: candidate.state,
      contextIdentity: candidate.context.dealingRangeId,
      prerequisiteIdentity: {
        sequenceId: candidate.deliverySequence.sequenceId,
        dealingRangeId: candidate.deliverySequence.dealingRangeId,
        pdLocationFactId: candidate.deliverySequence.pdLocationFactId,
        engineeringLiquidityId: candidate.deliverySequence.engineeringLiquidityId,
        displacementId: candidate.deliverySequence.displacementId,
        pdArrayId: candidate.deliverySequence.pdArrayId,
        objectiveLiquidityId: candidate.deliverySequence.objectiveLiquidityId
      },
      canonicalCandidate: true,
      model: label,
      status: qualified ? "valid_candidate" : rejected ? "rejected" : "forming",
      setupName: label,
      thesis: qualified
        ? `Canonical ${label} causal state and G1.1 geometry are complete for research validation.`
        : `${label} remains non-actionable until its range-owned causal state and native geometry are complete.`,
      side: candidate.direction,
      timeframe: candidate.timeframe,
      geometry: candidate.geometry,
      geometryMode: candidate.geometry ? "canonical" : "unavailable",
      blockers: [...candidate.blockers],
      missingConditions: qualified ? [] : [...candidate.blockers],
      nextAction: qualified
        ? "Preserve the unchanged canonical geometry for replay and evidence validation."
        : "Wait for the missing causal fact or lifecycle condition; do not repair geometry downstream."
    });
  });
  return frameworkOpportunity ? [frameworkOpportunity, ...candidates] : candidates;
};

const baseBlockersFor = (context: CurrentOpportunityContext) =>
  unique([
    context.isMockOrSample ? "Mock/sample source cannot produce a valid live opportunity." : undefined,
    !context.isResearchActive ? "Active source is not MT5 read-only research-active." : undefined,
    !context.sourceFingerprint ? "Source fingerprint is missing." : undefined,
    ...context.sourceDepth.depthWarnings
  ]);

const contextTextFor = (context: CurrentOpportunityContext) =>
  [
    context.modelName,
    context.modelState,
    context.modelLane,
    context.opportunityType,
    context.opportunityStage,
    context.opportunityQuality,
    context.opportunityDirection,
    context.opportunityNextAction,
    context.setupName,
    context.thesis,
    context.htfAlignmentStatus,
    context.htfConflictReason,
    context.weeklyBiasDirection,
    context.sessionNarrativeProfile,
    context.sessionDirectionalRead,
    context.fvgStatus,
    context.displacementStatus,
    context.drawOnLiquidity,
    context.liquiditySwept,
    ...context.opportunityBlockers,
    ...context.opportunityMissingEvidence,
    ...context.topReasons
  ].filter(Boolean).join(" ").toLowerCase();

const hasLoadedHtfContext = (context: CurrentOpportunityContext) => {
  const loaded = new Set([
    ...context.contextTimeframes,
    ...context.analysisTimeframesUsed,
    ...context.timeframeRoleSummary.filter((item) => item.status === "loaded").map((item) => item.timeframe)
  ].map((item) => item.toUpperCase()));
  return loaded.has("M15") && (loaded.has("H1") || loaded.has("H4") || loaded.has("D1"));
};

const ifvgFilteredV2Opportunity = (context: CurrentOpportunityContext): CurrentOpportunity => {
  const sharedBlockers = baseBlockersFor(context);
  const text = contextTextFor(context);
  const hasIfvg =
    /\bifvg\b|inversion\s+fvg|inverted\s+fvg|inverse\s+fair\s+value|inversion\s+fair\s+value|full[_\s-]*inversion/.test(text);
  const retestBlocked = /no[_\s-]*clean[_\s-]*retest|missing[_\s-]*clean[_\s-]*retest|no[_\s-]*retest|retest[_\s-]*(missing|failed)|reused[_\s-]*ifvg/.test(text);
  const hasCleanRetest =
    !retestBlocked &&
    (/clean[_\s-]*retest|retest[_\s-]*(respected|confirmed)|ifvg[_\s-]*retest|return[_\s-]*(to|into)[_\s-]*ifvg/.test(text) ||
      (hasIfvg && finite(context.entry)));
  const displacementBlocked = /no[_\s-]*displacement[_\s-]*confirmation|missing[_\s-]*displacement|displacement[_\s-]*(missing|failed)|weak[_\s-]*displacement/.test(text);
  const hasDisplacement =
    !displacementBlocked &&
    (/displacement[_\s-]*confirmation|confirmed[_\s-]*displacement|post[_\s-]*inversion[_\s-]*delivery|displacement|expansion/.test(text) ||
      /with_fvg|bullish|bearish/.test(context.displacementStatus ?? ""));
  const firstUseBlocked = /reused[_\s-]*ifvg|already[_\s-]*used|used[_\s-]*before[_\s-]*inversion/.test(text);
  const htfMissing = !hasLoadedHtfContext(context);
  const rr = context.rrEstimate;
  const missingConditions = unique([
    hasIfvg ? undefined : "no_inverted_fvg",
    firstUseBlocked ? "reused_ifvg" : undefined,
    hasCleanRetest ? undefined : "no_clean_retest",
    hasDisplacement ? undefined : "no_displacement_confirmation",
    finite(context.entry) ? undefined : "entry_missing",
    finite(context.target) ? undefined : "target_missing",
    finite(context.invalidation) ? undefined : "invalidation_missing",
    finite(rr) ? undefined : "rr_unavailable",
    finite(rr) && rr < 2 ? "rr_below_minimum" : undefined,
    htfMissing ? "missing_htf_context" : undefined
  ]);
  const hardBlockers = unique([
    ...sharedBlockers,
    context.isMockOrSample ? "source_mock_sample" : undefined,
    firstUseBlocked ? "reused_ifvg" : undefined,
    context.sourceDepth.depthPolicyStatus === "insufficient" || context.sourceDepth.depthPolicyStatus === "tactical_only"
      ? "needs_explicit_validation_depth"
      : undefined,
    htfMissing ? "missing_htf_context" : undefined,
    finite(rr) && rr < 2 ? "rr_below_minimum" : undefined
  ]);
  const status: CurrentOpportunityStatus = context.isMockOrSample
    ? "rejected"
    : context.sourceDepth.depthPolicyStatus === "insufficient" || context.sourceDepth.depthPolicyStatus === "tactical_only"
      ? "needs_more_data"
      : !hasIfvg
        ? "no_trade"
        : !hasCleanRetest || !hasDisplacement
          ? "forming"
          : hardBlockers.length || !finite(context.entry) || !finite(context.target) || !finite(context.invalidation) || !finite(rr) || rr < 2
            ? "near_miss"
            : "valid_candidate";
  const nextAction =
    status === "valid_candidate"
      ? "Queue replay validation for IFVG filtered v2; recognition is not evidence."
      : !hasIfvg
        ? "Wait for a fully inverted FVG before considering filtered v2."
        : !hasCleanRetest
          ? "Wait for clean IFVG retest."
          : !hasDisplacement
            ? "Wait for displacement confirmation."
            : hardBlockers.includes("missing_htf_context")
              ? "Load HTF context before queueing IFVG filtered v2 validation."
              : missingConditions.includes("target_missing")
                ? "Define the draw-on-liquidity target before calling the target too close."
                : missingConditions.includes("invalidation_missing")
                  ? "Define structure invalidation before replay validation."
                  : missingConditions.includes("rr_below_minimum")
                    ? "Wait for a cleaner target or tighter invalidation so RR meets 2R."
                    : "Run walk-forward after replay; Paper-Demo remains gated.";

  return opportunity(context, {
    strategyId: "ifvg_filtered_v2_research",
    model: "IFVG filtered v2",
    status: "diagnostic_context",
    classification: "diagnostic",
    setupName: "IFVG filtered v2 - clean retest displacement",
    thesis:
      "Filtered IFVG v2 is the current best IFVG research profile: clean retest plus displacement confirmation, then replay and walk-forward before any Paper-Demo consideration.",
    side: context.side ?? "flat",
    entry: context.entry,
    invalidation: context.invalidation,
    target: context.target,
    rrEstimate: context.rrEstimate,
    confidence: context.confidence,
    blockers: hardBlockers,
    missingConditions,
    nextAction,
    requiredValidation: status === "valid_candidate"
      ? ["replay_required", "walk_forward_required", "evidence_required", "paper_demo_gate_required"]
      : [...validationFor(status)]
  });
};

const ifvgFreshRetestV3Opportunity = (context: CurrentOpportunityContext): CurrentOpportunity => {
  const assessment = context.ifvgFreshRetestV3;
  const sharedBlockers = baseBlockersFor(context);
  const shallowDepth =
    context.sourceDepth.depthPolicyStatus === "insufficient" ||
    context.sourceDepth.depthPolicyStatus === "tactical_only";
  const completeTrade = Boolean(assessment?.geometry?.geometryValid && assessment.geometry.actionable);
  const status: CurrentOpportunityStatus = context.isMockOrSample
    ? "rejected"
    : !assessment
      ? "no_trade"
      : shallowDepth
        ? "needs_more_data"
        : assessment.eligible && completeTrade
          ? "valid_candidate"
          : !assessment.inversionDetected
            ? "no_trade"
            : assessment.cleanRetest && !assessment.signalFresh
              ? "near_miss"
              : assessment.cleanRetest && assessment.signalFresh
                ? "near_miss"
              : "forming";
  const missingConditions = unique([
    assessment ? undefined : "ifvg_v3_assessment_unavailable",
    assessment && !assessment.inversionDetected ? "no_inverted_fvg" : undefined,
    assessment && !assessment.cleanRetest ? "no_clean_retest" : undefined,
    assessment && !assessment.signalFresh ? "stale_retest_signal" : undefined,
    assessment && !finite(assessment.entry) ? "entry_missing" : undefined,
    assessment && !finite(assessment.target) ? "target_missing" : undefined,
    assessment && !finite(assessment.invalidation) ? "invalidation_missing" : undefined,
    assessment && !finite(assessment.rr) ? "rr_unavailable" : undefined,
    assessment && finite(assessment.rr) && assessment.rr < 2 ? "rr_below_minimum" : undefined,
    ...(assessment?.missingConditions ?? [])
  ]);
  const blockers = unique([
    ...sharedBlockers,
    shallowDepth ? "needs_explicit_validation_depth" : undefined,
    ...(assessment?.blockers ?? [])
  ]);

  const nextAction = !assessment
    ? "Run Activate Market so the compact IFVG v3 detector can evaluate the latest closed candle."
    : !finite(assessment.target)
      ? "Define the draw-on-liquidity target before replay validation."
      : !finite(assessment.invalidation)
        ? "Define structure invalidation before replay validation."
        : !finite(assessment.rr) || assessment.rr < 2
          ? "Wait for a clean IFVG construction with at least 2R."
          : assessment.nextAction;

  return opportunity(context, {
    id: assessment?.candidateId,
    candidateId: assessment?.candidateId,
    strategyId: "ifvg_fresh_retest_v3_research",
    strategyVersion: "v3",
    profileId: "ifvg_fresh_retest_v3_research",
    candidateState: assessment?.baseStatus,
    contextIdentity: assessment?.sourceFingerprint
      ? `${assessment.sourceFingerprint}|${assessment.candidateDetectedAt}`
      : undefined,
    model: "IFVG fresh retest v3",
    status,
    setupName: "IFVG fresh-retest v3",
    thesis:
      "Causal IFVG v3 requires a validation-eligible inversion and a clean retest on the latest closed candle. Current recognition can only queue deterministic replay and walk-forward validation.",
    side: assessment?.side ?? "flat",
    timeframe: assessment?.timeframe ?? context.primaryTimeframe,
    entry: assessment?.entry,
    invalidation: assessment?.invalidation,
    target: assessment?.target,
    rrEstimate: assessment?.rr,
    geometry: assessment?.geometry,
    confidence: assessment?.eligible ? Math.max(context.confidence ?? 0, 0.6) : context.confidence,
    blockers,
    missingConditions,
    nextAction,
    requiredValidation: status === "valid_candidate"
      ? ["replay_required", "walk_forward_required", "evidence_required", "paper_demo_gate_required"]
      : [...validationFor(status)]
  });
};

const sessionRaidReversalOpportunity = (context: CurrentOpportunityContext): CurrentOpportunity | undefined => {
  const narrative = context.sessionRaidReversal;
  if (!narrative) return undefined;
  const sharedBlockers = baseBlockersFor(context);
  const canonicalContextGeometry = narrative.status === "context_only" && narrative.geometry?.geometryValid === true;
  const status: CurrentOpportunityStatus =
    narrative.status === "complete_bearish_reversal_candidate" && narrative.canCreateValidationChainEntry
      ? "valid_candidate"
      : narrative.status === "forming"
        ? "forming"
        : narrative.status === "needs_more_data"
          ? "needs_more_data"
          : narrative.status === "rejected"
            ? "rejected"
            : canonicalContextGeometry
              ? "near_miss"
              : narrative.status === "context_only"
                ? "diagnostic_context"
              : "near_miss";
  const diagnostic = narrative.status === "context_only" && !canonicalContextGeometry;
  const detectedSteps = narrative.steps.filter((item) => item.detected).length;
  const stepSummary = `${detectedSteps}/${narrative.steps.length} narrative steps detected`;
  const missing = narrative.missingConditions.length ? narrative.missingConditions : narrative.steps.filter((item) => !item.detected).map((item) => item.step);
  return opportunity(context, {
    strategyId: "nasdaq_london_raid_ny_reversal_v1",
    model: "NASDAQ London Raid -> NY Reversal",
    status,
    classification: diagnostic ? "diagnostic" : undefined,
    setupName: "nasdaq_london_raid_ny_reversal",
    thesis:
      narrative.status === "complete_bearish_reversal_candidate"
        ? `London buy-side raid into NY bearish reversal candidate. ${stepSummary}.`
        : `Session raid reversal narrative is ${narrative.status.replace(/_/g, " ")}. ${stepSummary}.`,
    side: narrative.side === "short" ? "short" : "flat",
    timeframe: narrative.primaryTimeframe,
    entry: narrative.entry,
    invalidation: narrative.invalidation,
    target: narrative.target,
    rrEstimate: narrative.rr,
    geometry: narrative.geometry,
    confidence: narrative.confidence,
    blockers: [...sharedBlockers, ...narrative.blockers],
    missingConditions: missing,
    nextAction: narrative.nextAction,
    requiredValidation: status === "valid_candidate"
      ? ["replay_required", "walk_forward_required", "evidence_required", "paper_demo_gate_required"]
      : [...validationFor(status)]
  });
};

const primaryOpportunity = (context: CurrentOpportunityContext) => {
  const status = statusForPrimaryContext(context);
  const isCmd = /consolidation|cmd/i.test(`${context.modelName ?? ""} ${context.sessionNarrativeProfile ?? ""} ${context.opportunityType ?? ""}`);
  const cmdBlocked = isCmd && context.cmdIndependentDateGateStatus && context.cmdIndependentDateGateStatus !== "passed";
  const isDiagnostic = !isCmd;
  return opportunity(context, {
    strategyId: isCmd ? "ict_cmd_short_paper_watchlist_v1" : "market_map_only_diagnostic_v1",
    model: context.modelName ?? context.opportunityType ?? "current_market_read",
    status: isDiagnostic ? (context.currentOpportunityDetected ? "diagnostic_context" : "no_trade_context") : cmdBlocked ? "near_miss" : status,
    classification: isDiagnostic ? "diagnostic" : undefined,
    setupName: context.setupName ?? context.opportunityType ?? "current_market_context",
    thesis: isDiagnostic
      ? "Context only - not a trade candidate. Use this as bias/context only until a registered trade setup appears."
      : context.thesis ?? "Current market read is waiting for a structured ICT setup.",
    geometryMode: isCmd ? "source_blocked" : "unavailable",
    blockers: [
      ...baseBlockersFor(context),
      cmdBlocked ? context.cmdIndependentDateGateReason ?? "CMD needs independent-date validation." : undefined,
      ...context.opportunityBlockers
    ],
    missingConditions: [
      ...context.opportunityMissingEvidence,
      isDiagnostic ? "registered_trade_setup_required" : !finite(context.entry) ? "entry_missing" : undefined,
      isDiagnostic ? undefined : !finite(context.target) ? "target_missing" : undefined,
      isDiagnostic ? undefined : !finite(context.invalidation) ? "invalidation_missing" : undefined,
      isDiagnostic ? undefined : !finite(context.rrEstimate) ? "rr_unavailable" : undefined
    ],
    nextAction: cmdBlocked
      ? "Run independent-date CMD validation over 90-day history."
      : isDiagnostic
        ? "Use this as bias/context only. Requires a registered trade setup before replay validation."
        : context.opportunityNextAction ?? "Run Activate Market with explicit MT5 90-day context."
  });
};

const strategyDiagnostics = (context: CurrentOpportunityContext): CurrentOpportunity[] => {
  const sharedBlockers = baseBlockersFor(context);
  const outsideDeepContext = context.sourceDepth.depthPolicyStatus === "tactical_only" || context.sourceDepth.depthPolicyStatus === "insufficient";
  const hasSweep = /sweep|liquidity|raid/i.test(`${context.liquiditySwept ?? ""} ${context.opportunityType ?? ""} ${context.topReasons.join(" ")}`);
  const hasFvg = /fvg|fair value/i.test(`${context.fvgStatus ?? ""} ${context.drawOnLiquidity ?? ""} ${context.opportunityMissingEvidence.join(" ")}`);
  const hasDisplacement = /displacement|expansion/i.test(`${context.displacementStatus ?? ""} ${context.opportunityType ?? ""} ${context.topReasons.join(" ")}`);
  const htfBlocked = /conflicted|missing|mixed/i.test(context.htfAlignmentStatus ?? "");

  return [
    opportunity(context, {
      strategyId: "silver_bullet_v1",
      model: "Silver Bullet v1",
      status: outsideDeepContext ? "needs_more_data" : hasSweep && hasFvg ? "forming" : "near_miss",
      setupName: "sweep_fvg_return",
      thesis: "Silver Bullet needs a session sweep, displacement/FVG, and return-to-FVG entry inside a valid kill zone.",
      blockers: sharedBlockers,
      missingConditions: [
        hasSweep ? undefined : "liquidity_sweep",
        hasFvg ? undefined : "fvg_return",
        context.missingTimeframes.length ? `missing_timeframes:${context.missingTimeframes.join("/")}` : undefined
      ],
      nextAction: hasSweep && !hasFvg ? "Watch for FVG creation and return; do not infer an entry from the sweep alone." : "Run Silver Bullet replay validation when sweep/FVG conditions align."
    }),
    opportunity(context, {
      strategyId: "silver_bullet_v2_refined_research",
      model: "Silver Bullet v2 refined",
      status: hasSweep && hasFvg && !htfBlocked ? "forming" : "near_miss",
      setupName: "refined_sweep_displacement_fvg",
      thesis: "Refined Silver Bullet requires cleaner sweep quality, displacement, FVG respect, and model-aware context.",
      blockers: [...sharedBlockers, htfBlocked ? `HTF alignment ${context.htfAlignmentStatus}: ${context.htfConflictReason ?? "not aligned"}` : undefined],
      missingConditions: [
        hasSweep ? undefined : "session_liquidity_sweep",
        hasDisplacement ? undefined : "displacement",
        hasFvg ? undefined : "fvg_respected"
      ],
      nextAction: "Keep as research-only until replay/OOS improves across independent dates."
    }),
    opportunity(context, {
      strategyId: "cisd_v1",
      model: "CISD v1",
      status: hasDisplacement ? "forming" : "near_miss",
      setupName: "change_in_state_of_delivery",
      thesis: "CISD needs a clear prior delivery leg, a strong opposite close through a prior body, and a clean retest of the body zone.",
      blockers: sharedBlockers,
      missingConditions: [
        /trend|delivery|direction/i.test(context.topReasons.join(" ")) ? undefined : "prior_delivery_direction",
        hasDisplacement ? undefined : "strong_cisd_candle",
        finite(context.rrEstimate) ? undefined : "rr_minimum"
      ],
      nextAction: "If CISD forms, queue replay validation; recognition alone is not evidence."
    }),
    opportunity(context, {
      strategyId: "turtle_soup_v1",
      model: "Turtle Soup v1",
      status: hasSweep && !hasDisplacement ? "near_miss" : "no_trade",
      setupName: "range_sweep_reversal",
      thesis: "Turtle Soup needs a setup-range sweep, rejection, MSS/shift, retest, and RR.",
      blockers: sharedBlockers,
      missingConditions: [
        hasSweep ? undefined : "setup_range_sweep",
        hasDisplacement ? undefined : "rejection_or_mss",
        finite(context.rrEstimate) ? undefined : "rr_minimum"
      ],
      nextAction: "Do not relax Turtle Soup until sweep/rejection blockers repeat across replay diagnostics."
    }),
    opportunity(context, {
      strategyId: "ifvg_v1",
      model: "IFVG v1",
      status: hasFvg ? "forming" : "no_trade",
      setupName: "inversion_fvg_retest",
      thesis: "Broad IFVG v1 has positive expectancy but invalidation-first is too high; filtering is required before paper-watchlist consideration.",
      blockers: sharedBlockers,
      missingConditions: [
        hasFvg ? undefined : "fair_value_gap",
        /inversion|inverse|ifvg/i.test(context.topReasons.join(" ")) ? undefined : "full_inversion",
        "retest_confirmation"
      ],
      nextAction: "Use the causal IFVG fresh-retest v3 profile instead of promoting raw IFVG v1."
    }),
    ifvgFilteredV2Opportunity(context),
    ifvgFreshRetestV3Opportunity(context),
    opportunity(context, {
      strategyId: "market_map_only_diagnostic_v1",
      model: "Market map diagnostic",
      status: context.currentOpportunityDetected ? "market_map_only" : "no_trade_context",
      classification: "diagnostic",
      setupName: "market_map_only",
      thesis: "Market-map context can explain bias, liquidity, and session state but cannot become a standalone trade idea.",
      blockers: sharedBlockers,
      missingConditions: context.currentOpportunityDetected ? ["registered_trade_setup_required"] : ["no_registered_trade_setup"],
      nextAction: context.currentOpportunityDetected
        ? "Context only - not a trade candidate. Use this as bias/context only; wait for a detector-backed model before validation."
        : "No entry model expected. Requires a registered trade setup before validation."
    })
  ];
};

const summarize = (
  context: CurrentOpportunityContext,
  opportunities: CurrentOpportunity[],
  canonicalCandidateSet: CanonicalRuntimeCandidateSet
): CurrentOpportunitySummary => {
  const sorted = opportunities.slice().sort((left, right) => statusRank[right.status] - statusRank[left.status] || right.confidence - left.confidence);
  const count = (status: CurrentOpportunityStatus) => opportunities.filter((item) => item.status === status).length;
  const canonicalSetupConflict = canonicalCandidateSet.conflict;
  const selectedCanonicalOpportunity = canonicalCandidateSet.selectedCandidateId
    ? opportunities.find((item) => item.candidateId === canonicalCandidateSet.selectedCandidateId)
    : undefined;
  const topOpportunity = canonicalCandidateSet.disposition === "SINGLE_ACTIONABLE_CANDIDATE"
    ? selectedCanonicalOpportunity
    : canonicalCandidateSet.disposition === "NO_ACTIONABLE_CANDIDATE"
      ? sorted.find((item) => item.classification !== "diagnostic" && item.status === "forming")
      : undefined;
  const topNearMiss = sorted.find((item) => item.status === "near_miss");
  const topRejected = sorted.find((item) => item.status === "rejected");
  const topDiagnostic = sorted.find((item) => item.classification === "diagnostic");
  const topBlocker =
    topOpportunity?.blockers[0] ??
    topNearMiss?.missingConditions[0] ??
    topNearMiss?.blockers[0] ??
    topDiagnostic?.missingConditions[0] ??
    topDiagnostic?.blockers[0] ??
    context.sourceDepth.depthWarnings[0] ??
    context.topReasons[0];
  return {
    generatedAt: context.generatedAt,
    requestedSymbol: context.requestedSymbol,
    brokerSymbol: context.brokerSymbol,
    primaryTimeframe: context.primaryTimeframe,
    sourceProvider: context.sourceProvider,
    sourceFingerprint: context.sourceFingerprint,
    depthStatus: context.sourceDepth.depthPolicyStatus,
    topDownBiasStatus: context.topDownBiasStatus,
    timeframeRoleSummary: context.timeframeRoleSummary,
    validCandidateCount: count("valid_candidate"),
    formingCount: count("forming"),
    nearMissCount: count("near_miss"),
    rejectedCount: count("rejected"),
    noTradeCount: count("no_trade"),
    needsMoreDataCount: count("needs_more_data"),
    diagnosticCount: opportunities.filter((item) => item.classification === "diagnostic").length,
    marketMapOnlyCount: count("market_map_only"),
    regimeContextCount: count("regime_context"),
    noTradeContextCount: count("no_trade_context"),
    canonicalSetupConflict,
    canonicalCandidateSetDisposition: canonicalCandidateSet.disposition,
    canonicalCandidateCount: canonicalCandidateSet.candidates.length,
    actionableCanonicalCandidateCount: canonicalCandidateSet.actionableCandidates.length,
    selectedCanonicalCandidateId: canonicalCandidateSet.selectedCandidateId,
    topOpportunity,
    topNearMiss,
    topRejected,
    topBlocker,
    nextAction: canonicalSetupConflict === "CONFLICTING_CANONICAL_SETUPS"
      ? "Conflicting canonical setups are preserved; no automatic trade selector is authorized."
      : canonicalCandidateSet.disposition === "MULTIPLE_ALIGNED_CANONICAL_SETUPS"
        ? "Aligned canonical setups are preserved separately; no automatic trade selector is authorized."
      : topOpportunity?.nextAction ?? topNearMiss?.nextAction ?? topDiagnostic?.nextAction ?? "Run Activate Market with explicit MT5 90-day context.",
    rangeHistoryAvailable: context.sourceDepth.rangeHistoryAvailable,
    validationLookbackDays: context.sourceDepth.validationLookbackDays,
    authority,
    safety
  };
};

export const detectCurrentOpportunities = (context: CurrentOpportunityContext): CurrentOpportunityScan => {
  const sessionRaid = sessionRaidReversalOpportunity(context);
  const detectedOpportunities = [
    ...coreIctOpportunities(context),
    ...marketMakerOpportunities(context),
    primaryOpportunity(context),
    ...(sessionRaid ? [sessionRaid] : []),
    ...strategyDiagnostics(context)
  ].sort(
    (left, right) => statusRank[right.status] - statusRank[left.status] || right.confidence - left.confidence
  );
  const opportunities = attributeCharterOwnerCandidates(detectedOpportunities);
  const charterProfileRuntime = buildCharterProfileRuntimeSnapshot({
    opportunities,
    generatedAt: context.generatedAt,
    sourceFingerprint: context.sourceFingerprint
  });
  const canonicalCandidateSet = buildCanonicalRuntimeCandidateSet({
    opportunities,
    generatedAt: context.generatedAt,
    sourceFingerprint: context.sourceFingerprint,
    authority
  });
  const summary = summarize(context, opportunities, canonicalCandidateSet);
  return {
    scanId: createId("current_scan", `${context.generatedAt}:${context.sourceFingerprint ?? "no_fp"}:${opportunities.length}`),
    generatedAt: context.generatedAt,
    context: {
      ...context,
      topReasonCount: context.topReasons.length,
      opportunityBlockerCount: context.opportunityBlockers.length,
      opportunityMissingEvidenceCount: context.opportunityMissingEvidence.length
    },
    opportunities,
    canonicalCandidates: canonicalCandidateSet.candidates,
    charterProfiles: charterProfileRuntime.profiles,
    summary,
    researchOnly: true,
    authority,
    safety
  };
};

export const assertCurrentOpportunityScanIsCompact = (scan: CurrentOpportunityScan) => {
  const serialized = JSON.stringify(scan);
  return {
    ok:
      scan.researchOnly === true &&
      scan.authority.executionAuthority === "none" &&
      scan.authority.brokerAuthority === "none" &&
      scan.authority.readinessOverrideAuthority === "none" &&
      scan.safety.rawCandlesExcluded === true &&
      scan.opportunities.every((item) => item.researchOnly === true && item.executionIntentCreated === false) &&
      !/"candles"\s*:/i.test(serialized) &&
      !/"rawSnapshot"\s*:|"snapshot"\s*:|"password"\s*:|"secret"\s*:|"api[_-]?key"\s*:|"token"\s*:|"account(Data|Number|Id)?"\s*:|"position(Data|s|Id)?"\s*:|"order(Data|s|Id)?"\s*:/i.test(serialized),
    serializedBytes: new Blob([serialized]).size
  };
};

export const summarizeCurrentOpportunityScan = (scan?: CurrentOpportunityScan) => {
  if (!scan) return "Current opportunity scanner has not run.";
  if (scan.summary.canonicalSetupConflict === "CONFLICTING_CANONICAL_SETUPS") {
    return `Conflicting canonical setups / no trade. Next: ${scan.summary.nextAction}`;
  }
  if (scan.summary.canonicalCandidateSetDisposition === "MULTIPLE_ALIGNED_CANONICAL_SETUPS") {
    return `Multiple aligned canonical setups / no singular selection. Next: ${scan.summary.nextAction}`;
  }
  const top =
    scan.summary.topOpportunity ??
    scan.summary.topNearMiss ??
    scan.summary.topRejected ??
    scan.opportunities.find((item) => item.classification === "diagnostic");
  return top
    ? `${token(top.model)} / ${token(top.status)} / ${token(top.side)}. Next: ${top.nextAction}`
    : `No current opportunity. Next: ${scan.summary.nextAction}`;
};
