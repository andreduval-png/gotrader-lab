import type { AutonomousResearchRun } from "@/lib/autonomousResearch";
import type { IctActivateMarketLatestSummary } from "@/lib/ict-strategy-suite/ictActivateMarketPipelineTypes";
import type { ResearchRuntimeSnapshot } from "@/lib/runtime";
import type { ValidationChainEntry } from "@/lib/validationChain";
import { projectCanonicalTradeGeometry } from "@/lib/tradeGeometry";
import { CANONICAL_LIVE_RESEARCH_OWNER_ORDER, type CanonicalLiveResearchOwnerId } from "@/lib/researchCoverage";

import {
  OPERATOR_AUTHORITY,
  type OperatorConsoleSnapshot,
  type OperatorCycleState,
  type OperatorDecision,
  type OperatorInsightSummary,
  type OperatorMemorySummary,
  type OperatorPredictionSummary
} from "./operatorConsoleTypes";

export interface BuildOperatorConsoleSnapshotInput {
  runtime?: ResearchRuntimeSnapshot;
  activation?: IctActivateMarketLatestSummary;
  autonomousRun?: AutonomousResearchRun;
  validation?: ValidationChainEntry;
  prediction?: OperatorPredictionSummary;
  memory?: OperatorMemorySummary;
  cycle?: OperatorCycleState;
  now?: string;
}

const idleCycle = (): OperatorCycleState => ({
  status: "idle",
  stage: "idle",
  progressPercent: 0,
  message: "Ready to start a supervised research cycle.",
  authority: OPERATOR_AUTHORITY,
  autoApplyAllowed: false,
  researchOnly: true
});

const clean = (value: unknown, fallback: string) => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const roundedPrice = (value: number) => Number(value.toFixed(5));

const providerFor = (runtime?: ResearchRuntimeSnapshot) =>
  clean(runtime?.marketData.activeResearchSource.provider, runtime?.marketData.activeDataSource ?? "unavailable");

const brokerSymbolFor = (runtime?: ResearchRuntimeSnapshot) =>
  runtime?.marketData.activeResearchSource.provenance.providerSymbol ?? runtime?.marketData.contract;

const sourceIsEligible = (runtime?: ResearchRuntimeSnapshot) =>
  Boolean(
    runtime &&
      runtime.marketData.activeResearchSource.provider !== "mock" &&
      runtime.marketData.activeResearchSource.candleCount > 0 &&
      runtime.marketData.activeResearchSource.eligibility.researchCycle &&
      runtime.marketData.activeResearchSource.fingerprint &&
      runtime.marketData.activeResearchSource.authority.executionAuthority === "none" &&
      runtime.marketData.activeResearchSource.authority.brokerAuthority === "none" &&
      runtime.marketData.activeResearchSource.authority.readinessOverrideAuthority === "none"
  );

const emptyMemory = (): OperatorMemorySummary => ({
  storedEvidenceRecords: 0,
  profileIdentities: 0,
  independentCycleDates: 0,
  positiveEdgeCycles: 0,
  gbrainTotal: 0,
  gbrainPending: 0,
  gbrainDelivered: 0,
  gbrainFailed: 0,
  gbrainDeliveryEnabled: false
});

const OWNER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  ifvg_fresh_retest_v3_research: "IFVG v3",
  ict_2022_model_v1: "ICT 2022",
  ict_market_maker_buy_model_v1: "MMBM",
  ict_market_maker_sell_model_v1: "MMSM",
  nasdaq_london_raid_ny_reversal_v1: "London Raid v1",
  ifvg_fresh_retest_v4_candidate: "IFVG v4"
});

const researchCoverageFor = (cycle: OperatorCycleState): OperatorConsoleSnapshot["researchCoverage"] => {
  const summary = cycle.ownerResearch;
  const validation = summary?.ownerValidation;
  const policySummary = validation?.policySummary;
  const validationByOwner = new Map(validation?.owners.map((owner) => [owner.ownerStrategyId, owner]) ?? []);
  const readinessByOwner = new Map(validation?.readiness.map((owner) => [owner.ownerStrategyId, owner]) ?? []);
  const policyByOwner = new Map(policySummary?.owners.map((owner) => [owner.ownerStrategyId, owner]) ?? []);
  const rowFor = (
    task: NonNullable<OperatorCycleState["ownerResearch"]>["tasks"][number],
    lane: "live_owner" | "research_only"
  ) => {
    const ownerValidation = validationByOwner.get(task.ownerStrategyId);
    const ownerReadiness = readinessByOwner.get(task.ownerStrategyId);
    const ownerPolicy = lane === "live_owner"
      ? policyByOwner.get(task.ownerStrategyId as CanonicalLiveResearchOwnerId)
      : undefined;
    return ({
    strategyId: task.ownerStrategyId,
    label: task.ownerLabel,
    lane,
    tier: task.tier,
    status: task.status,
    blocker: task.blocker,
    evidenceStatus: task.evidenceIds.length ? "CURRENT" as const : task.blocker ? "BLOCKED" as const : "NO_EVIDENCE" as const,
    lastRunAt: task.completedAt ?? task.lastProgressAt ?? task.startedAt,
    durationMs: task.runDurationMs,
    evaluationsCompleted: task.progress.evaluationsCompleted,
    candidateCount: task.progress.candidateCount,
    fillCount: task.progress.fillCount,
    outcomeCount: task.progress.outcomeCount,
    currentPartition: task.progress.currentPartition,
    validationStatus: lane === "research_only" ? "RESEARCH_ONLY" as const : ownerValidation?.status ?? "NOT_EVALUATED" as const,
    readinessStatus: lane === "research_only" ? "NOT_APPLICABLE" as const : ownerReadiness?.status ?? "VALIDATION_REQUIRED" as const,
    technicalStatus: lane === "research_only" ? "TECHNICAL_SOURCE_BLOCKED" as const : ownerPolicy?.technicalStatus ?? "TECHNICAL_EVIDENCE_REQUIRED" as const,
    performanceStatus: lane === "research_only" ? "NOT_APPLICABLE" as const : ownerPolicy?.performanceStatus ?? "INSUFFICIENT_PERFORMANCE_EVIDENCE" as const,
    policyEvidenceStatus: lane === "research_only" ? "NO_EVIDENCE" as const : ownerPolicy?.evidenceStatus ?? "NO_EVIDENCE" as const,
    validationBlocker: ownerPolicy?.blocker ?? ownerValidation?.blocker,
    evidenceAgeMs: ownerValidation?.evidenceAgeMs
  });
  };
  if (!summary) {
    return {
      globalStatus: "NOT_STARTED",
      validationGlobalStatus: "NONE_VALIDATED",
      technicallyValidatedCount: 5,
      performanceValidatedCount: 0,
      performancePolicyDefinedCount: 5,
      policyRequiredCount: 0,
      researchReadyCount: 0,
      liveOwnerCount: 5,
      rows: CANONICAL_LIVE_RESEARCH_OWNER_ORDER.map((strategyId) => ({
        strategyId,
        label: OWNER_LABELS[strategyId],
        lane: "live_owner" as const,
        tier: "HISTORICAL_VALIDATION",
        status: "NOT_STARTED" as const,
        evidenceStatus: "NO_EVIDENCE" as const,
        evaluationsCompleted: 0,
        candidateCount: 0,
        fillCount: 0,
        outcomeCount: 0,
        validationStatus: "NOT_EVALUATED" as const,
        readinessStatus: "VALIDATION_REQUIRED" as const,
        technicalStatus: "TECHNICALLY_VALIDATED" as const,
        performanceStatus: "INSUFFICIENT_PERFORMANCE_EVIDENCE" as const,
        policyEvidenceStatus: "NO_EVIDENCE" as const
      })),
      researchOnlyRows: [{
        strategyId: "ifvg_fresh_retest_v4_candidate",
        label: "IFVG v4",
        lane: "research_only" as const,
        tier: "TACTICAL_RESEARCH",
        status: "NOT_STARTED" as const,
        evidenceStatus: "NO_EVIDENCE" as const,
        evaluationsCompleted: 0,
        candidateCount: 0,
        fillCount: 0,
        outcomeCount: 0,
        validationStatus: "RESEARCH_ONLY" as const,
        readinessStatus: "NOT_APPLICABLE" as const,
        technicalStatus: "TECHNICAL_SOURCE_BLOCKED" as const,
        performanceStatus: "NOT_APPLICABLE" as const,
        policyEvidenceStatus: "NO_EVIDENCE" as const
      }],
      livePlanPublished: false
    };
  }
  return {
    globalStatus: summary.globalStatus,
    validationGlobalStatus: validation?.globalStatus ?? "NONE_VALIDATED",
    technicallyValidatedCount: policySummary?.technicallyValidatedCount ?? 5,
    performanceValidatedCount: policySummary?.performanceValidatedCount ?? 0,
    performancePolicyDefinedCount: policySummary?.performancePolicyDefinedCount ?? 5,
    policyRequiredCount: policySummary?.policyRequiredCount ?? 0,
    researchReadyCount: policySummary?.researchReadyCount ?? 0,
    liveOwnerCount: 5,
    rows: summary.tasks.map((task) => rowFor(task, "live_owner")),
    researchOnlyRows: summary.researchOnlyTasks.map((task) => rowFor(task, "research_only")),
    livePlanPublished: summary.livePlanPublished,
    timeToLivePlanMs: summary.performance.timeToLivePlanMs
  };
};

const researchPlanFor = (
  activation: IctActivateMarketLatestSummary | undefined,
  sourceFingerprint: string | undefined,
  cycle: OperatorCycleState
): OperatorConsoleSnapshot["researchPlan"] => {
  // Display the immutable cycle result; tape freshness is not plan identity.
  const expectedSourceFingerprint = cycle.sourceFingerprint || sourceFingerprint;
  const currentCandidate = activation?.currentOpportunitySummary?.selectedCanonicalCandidateId
    ? activation.currentOpportunitySummary.topOpportunity
    : activation?.currentOpportunitySummary?.canonicalCandidateSetDisposition
      ? undefined
      : activation?.currentOpportunitySummary?.topOpportunity
        ?? activation?.currentOpportunitySummary?.topNearMiss
        ?? activation?.currentOpportunitySummary?.topRejected;
  const identityComplete = Boolean(
    activation?.cycleId &&
    activation.sourceFingerprint &&
    activation.currentReadEvaluatedAt
  );
  const planIdentityStatus = !activation
    ? "unavailable" as const
    : !identityComplete
      ? "legacy_unbound" as const
      : cycle.cycleId && activation.cycleId !== cycle.cycleId
        ? "stale_cycle" as const
        : expectedSourceFingerprint && activation.sourceFingerprint !== expectedSourceFingerprint
          ? "source_mismatch" as const
          : activation.currentCandidateId && currentCandidate?.id && activation.currentCandidateId !== currentCandidate.id
            ? "candidate_mismatch" as const
            : "current" as const;
  if (planIdentityStatus !== "current") {
    const identityReason = planIdentityStatus === "legacy_unbound"
      ? "The saved trade plan predates cycle and source identity binding. Run a new research cycle to replace it."
      : planIdentityStatus === "stale_cycle"
        ? "The saved trade plan belongs to an earlier research cycle and has been hidden."
        : planIdentityStatus === "source_mismatch"
          ? "The saved trade plan belongs to a different market-data source and has been hidden."
          : planIdentityStatus === "candidate_mismatch"
            ? "The saved trade plan candidate does not match the current opportunity and has been hidden."
            : "No identity-bound current trade plan is available.";
    return {
      status: "unavailable",
      planIdentityStatus,
      cycleId: activation?.cycleId,
      currentReadEvaluatedAt: activation?.currentReadEvaluatedAt,
      currentCandidateId: activation?.currentCandidateId,
      setup: "No current identity-bound research plan",
      side: "flat",
      setupDirection: "neutral",
      signal: "NO_TRADE",
      planSource: "unavailable",
      planCoherence: "incomplete",
      planCoherenceReason: identityReason,
      riskScreeningStatus: "not evaluated",
      riskScreeningReason: identityReason,
      accountRiskEvaluation: "external_simulation_required",
      sourceFingerprint: activation?.sourceFingerprint,
      generatedAt: activation?.activationTimestamp,
      informationalOnly: true,
      executionAllowed: false
    };
  }
  const currentActivation = activation!;
  if (activation?.canonicalSetupConflict === "CONFLICTING_CANONICAL_SETUPS") {
    const reason = "Actionable canonical strategies disagree. No singular plan or geometry is selected.";
    return {
      status: "no_trade",
      planIdentityStatus,
      cycleId: currentActivation.cycleId,
      currentReadEvaluatedAt: currentActivation.currentReadEvaluatedAt,
      setup: "Conflicting canonical setups",
      side: "flat",
      setupDirection: "neutral",
      signal: "NO_TRADE",
      planSource: "unavailable",
      planCoherence: "incomplete",
      planCoherenceReason: reason,
      riskScreeningStatus: "conflict",
      riskScreeningReason: reason,
      accountRiskEvaluation: "external_simulation_required",
      sourceFingerprint: currentActivation.sourceFingerprint,
      generatedAt: currentActivation.activationTimestamp,
      informationalOnly: true,
      executionAllowed: false
    };
  }
  const canonicalGeometry = activation?.proposedGeometry;
  const canonicalProjection = canonicalGeometry ? projectCanonicalTradeGeometry(canonicalGeometry) : undefined;
  const stopLoss = canonicalProjection?.intendedStop;
  const takeProfit = canonicalProjection?.intendedTarget;
  const candidateSide = currentCandidate?.side;
  const side = canonicalGeometry
    ? canonicalGeometry.direction === "LONG" ? "long" as const : "short" as const
    : candidateSide === "long" || candidateSide === "short" ? candidateSide : "flat" as const;
  const entryZone = canonicalProjection
    ? { lower: canonicalProjection.intendedEntry, upper: canonicalProjection.intendedEntry }
    : undefined;
  const directional = side === "long" || side === "short";
  const riskReward = canonicalProjection?.theoreticalRR;
  const candidateMatchesSide = candidateSide === side || candidateSide === undefined;
  const entryPrice = directional && finite(canonicalProjection?.intendedEntry)
    ? roundedPrice(canonicalProjection.intendedEntry)
    : undefined;
  const complete =
    directional &&
    finite(entryPrice) &&
    finite(stopLoss) &&
    finite(takeProfit) &&
    finite(riskReward);
  const geometryCoherent = canonicalProjection?.geometryValid;
  const planCoherence = geometryCoherent === false
    ? "incoherent" as const
    : complete
      ? "coherent" as const
      : "incomplete" as const;
  const planCoherenceReason = geometryCoherent === false
    ? `${side === "long" ? "Bullish" : "Bearish"} direction conflicts with entry, stop-loss, and take-profit geometry.`
    : complete
        ? "Direction, entry, stop-loss, take-profit, and risk/reward are mutually coherent."
        : "A complete directional price structure is not available.";
  const setupDirection = planCoherence === "incoherent"
    ? "neutral" as const
    : side === "long" ? "bullish" as const : side === "short" ? "bearish" as const : "neutral" as const;
  const candidateStatus = activation?.proposedCandidateStatus ?? (candidateMatchesSide ? currentCandidate?.status : undefined);
  const candidateRejected = candidateStatus === "rejected" || candidateStatus === "no_trade" || candidateStatus === "needs_more_data";
  const riskBlocked = /reject|no[_ ]?trade|avoid|unsuitable|blocked/i.test(activation?.riskScreeningStatus ?? "");
  const hasAnyLevel = finite(entryPrice) || Boolean(entryZone) || finite(stopLoss) || finite(takeProfit);
  const status = side === "flat" || candidateRejected || riskBlocked || planCoherence === "incoherent"
    ? "no_trade"
    : complete
      ? "complete"
      : hasAnyLevel
        ? "partial"
        : "unavailable";
  const signal = complete && planCoherence === "coherent" && canonicalProjection?.actionable && !candidateRejected && !riskBlocked
    ? (side === "long" ? "BUY" : "SELL")
    : "NO_TRADE";
  const overallActionable = Boolean(canonicalProjection?.actionable && planIdentityStatus === "current" && signal !== "NO_TRADE");
  const setupName = activation?.modelName
    ?? currentCandidate?.setupName
    ?? activation?.opportunityType
    ?? (complete ? `${side}_research_plan` : undefined);

  return {
    status,
    planIdentityStatus,
    cycleId: currentActivation.cycleId,
    currentReadEvaluatedAt: currentActivation.currentReadEvaluatedAt,
    currentCandidateId: currentActivation.currentCandidateId,
    setup: clean(setupName, "No qualified research plan").replace(/_/g, " "),
    side,
    setupDirection,
    signal,
    planSource: canonicalProjection ? "canonical_geometry" : "unavailable",
    planCoherence,
    planCoherenceReason,
    candidateStatus,
    entryZone,
    entryPrice,
    entryPriceMethod: canonicalProjection ? "canonical_geometry" : undefined,
    geometryId: canonicalProjection?.geometryId,
    geometryStatus: canonicalProjection?.status,
    geometryValid: canonicalProjection?.geometryValid,
    actionable: overallActionable,
    displayKind: canonicalProjection
      ? overallActionable ? canonicalProjection.displayKind : "RESEARCH_GEOMETRY"
      : undefined,
    stopLoss,
    takeProfit,
    targetProvenance: activation?.proposedTargetProvenance,
    riskReward,
    riskScreeningStatus: clean(activation?.riskScreeningStatus, "not evaluated").replace(/_/g, " "),
    riskScreeningReason: `${clean(
      activation?.riskScreeningReason,
      complete
        ? "Market-context screening is complete; independent account-risk evaluation has not run."
        : "A complete directional research plan is required before independent account-risk evaluation."
    )}${planCoherence === "incoherent" ? ` ${planCoherenceReason}` : ""}`,
    accountRiskEvaluation: "external_simulation_required",
    recommendedMaxRiskPerTradePct: activation?.recommendedMaxRiskPerTradePct,
    sourceFingerprint: currentActivation.sourceFingerprint,
    generatedAt: activation?.activationTimestamp,
    informationalOnly: true,
    executionAllowed: false
  };
};

const candidatePlansFor = (
  activation: IctActivateMarketLatestSummary | undefined,
  sourceFingerprint: string | undefined,
  cycle: OperatorCycleState
): OperatorConsoleSnapshot["candidatePlans"] => {
  const expectedSourceFingerprint = cycle.sourceFingerprint || sourceFingerprint;
  if (!activation?.cycleId || !activation.sourceFingerprint || !activation.currentReadEvaluatedAt) return [];
  if (cycle.cycleId && activation.cycleId !== cycle.cycleId) return [];
  if (expectedSourceFingerprint && activation.sourceFingerprint !== expectedSourceFingerprint) return [];
  return (activation.candidatePlans ?? []).map((plan) => {
    const complete = finite(plan.entry) && finite(plan.stop) && finite(plan.target) && finite(plan.riskReward);
    const candidateActionable = complete && plan.actionable;
    const globalActionable = candidateActionable && activation.canonicalSetupConflict !== "CONFLICTING_CANONICAL_SETUPS";
    const signal = globalActionable
      ? plan.side === "long" ? "BUY" as const : plan.side === "short" ? "SELL" as const : "NO_TRADE" as const
      : "NO_TRADE" as const;
    return {
      strategyId: plan.strategyId,
      strategyVersion: plan.strategyVersion,
      profileId: plan.profileId,
      charterModelNumber: plan.charterProfile?.charterModelNumber,
      charterProfileId: plan.charterProfile?.charterProfileId,
      candidateId: plan.candidateId,
      candidateState: plan.candidateState,
      setup: plan.setupName.replace(/_/g, " "),
      side: plan.side,
      status: plan.status,
      signal,
      geometryId: plan.geometryId,
      entryPrice: plan.entry,
      stopLoss: plan.stop,
      takeProfit: plan.target,
      riskReward: plan.riskReward,
      candidateActionable,
      globalActionable,
      blocker: plan.blockers[0],
      contextIdentity: plan.contextIdentity
    };
  });
};

const marketContextsFor = (
  activation: IctActivateMarketLatestSummary | undefined,
  sourceFingerprint: string | undefined,
  cycle: OperatorCycleState
): OperatorConsoleSnapshot["marketContexts"] => {
  const expectedSourceFingerprint = cycle.sourceFingerprint || sourceFingerprint;
  if (!activation?.cycleId || !activation.sourceFingerprint || !activation.currentReadEvaluatedAt) return [];
  if (cycle.cycleId && activation.cycleId !== cycle.cycleId) return [];
  if (expectedSourceFingerprint && activation.sourceFingerprint !== expectedSourceFingerprint) return [];
  return (activation.contextItems ?? []).map((item) => ({
    contextId: item.contextId,
    artifactId: item.artifactId,
    label: item.displayName,
    classification: item.classification,
    state: item.state,
    sourceBlocked: item.sourceStatus === "blocked_source_semantics",
    detail: item.detail,
    blocker: item.sourceBlockReason ?? item.missingSemanticFields?.join(", "),
    executable: false
  }));
};

const charterProfilesFor = (
  activation: IctActivateMarketLatestSummary | undefined,
  sourceFingerprint: string | undefined,
  cycle: OperatorCycleState
): OperatorConsoleSnapshot["charterProfiles"] => {
  const expectedSourceFingerprint = cycle.sourceFingerprint || sourceFingerprint;
  if (!activation?.cycleId || !activation.sourceFingerprint || !activation.currentReadEvaluatedAt) return [];
  if (cycle.cycleId && activation.cycleId !== cycle.cycleId) return [];
  if (expectedSourceFingerprint && activation.sourceFingerprint !== expectedSourceFingerprint) return [];
  return (activation.charterProfiles ?? []).map((profile) => ({
    charterModelNumber: profile.charterModelNumber,
    charterProfileId: profile.charterProfileId,
    label: profile.label,
    classification: profile.classification,
    status: profile.runtimeStatus,
    owner: profile.ownerStrategyId ?? profile.ownerFrameworkId ?? "none",
    ownerCandidateId: profile.ownerCandidateId,
    detail: profile.detail,
    blocker: profile.blocker,
    emitsGeometry: false,
    executableStrategyAdded: false
  }));
};

const insightFor = (
  runtime: ResearchRuntimeSnapshot | undefined,
  activation: IctActivateMarketLatestSummary | undefined,
  cycle: OperatorCycleState
): OperatorInsightSummary => {
  if (cycle.latestInsight) {
    return cycle.latestInsight;
  }

  const thesis = runtime?.latestResearchCycle.latestThesisSummary;
  const thesisBias = thesis && "finalBias" in thesis ? thesis.finalBias : thesis?.bias;
  const thesisText = thesis && "thesisSummary" in thesis ? thesis.thesisSummary : thesis?.summary;
  const bias = clean(thesisBias, "neutral").replace(/_/g, " ");
  const rawSetup = clean(
    activation?.modelName ?? runtime?.latestResearchCycle.activeGrinchProfileSummary?.profile,
    "No qualified setup"
  ).replace(/_/g, " ");
  const setup = rawSetup.toLowerCase() === "none" ? "No qualified setup" : rawSetup;
  const modelLane = clean(activation?.modelLane, setup === "No qualified setup" ? "no trade" : "research").replace(/_/g, " ");
  const confidence = typeof thesis?.confidence === "number" ? thesis.confidence : undefined;
  const summary = clean(
    thesisText,
    activation?.modelName
      ? `${activation.modelName.replace(/_/g, " ")} is the latest detected research model.`
      : "No qualified setup is active. The system will keep research gates closed until evidence improves."
  );

  return {
    bias,
    setup,
    modelLane,
    confidence,
    summary,
    nextAction: clean(activation?.nextAction ?? runtime?.readiness.nextAction, "Start a research cycle to refresh the current read.")
  };
};

const decisionsFor = ({
  runtime,
  autonomousRun,
  cycle,
  sourceEligible
}: {
  runtime?: ResearchRuntimeSnapshot;
  autonomousRun?: AutonomousResearchRun;
  cycle: OperatorCycleState;
  sourceEligible: boolean;
}): OperatorDecision[] => {
  const decisions: OperatorDecision[] = [];

  if (!sourceEligible) {
    decisions.push({
      id: "source-attention",
      kind: "source_attention",
      title: "Market source needs attention",
      detail: "Start the MT5 read-only services, then run the research cycle again. Mock data is never treated as research evidence.",
      actionLabel: "Open settings",
      href: "/settings",
      severity: "critical"
    });
  }

  if (cycle.status === "blocked" || cycle.status === "failed" || autonomousRun?.status === "paused") {
    decisions.push({
      id: "cycle-attention",
      kind: "cycle_attention",
      title: cycle.status === "failed" ? "Research cycle failed" : "Research cycle paused",
      detail: cycle.lastError ?? cycle.message ?? autonomousRun?.stopReasonDetail ?? "Review the latest blocker before restarting.",
      actionLabel: "Review details",
      href: "/research-lab",
      severity: cycle.status === "failed" ? "critical" : "warning"
    });
  }

  if (runtime?.proposal.latestProposalIsCurrent && runtime.proposal.latestProposalId) {
    decisions.push({
      id: `proposal-${runtime.proposal.latestProposalId}`,
      kind: "proposal_review",
      title: "Research proposal is ready for review",
      detail: "A draft proposal passed intake. It remains non-authoritative and cannot apply itself.",
      actionLabel: "Review proposal",
      href: "/self-improvement",
      severity: "info"
    });
  }

  if (runtime?.readiness.readinessState === "Paper-Demo Candidate") {
    decisions.push({
      id: "paper-demo-review",
      kind: "paper_demo_review",
      title: "Paper-Demo candidate needs operator review",
      detail: "Deterministic gates indicate a reviewable candidate. This does not create an order or execution authority.",
      actionLabel: "Review candidate",
      href: "/paper-demo",
      severity: "info"
    });
  }

  return decisions;
};

export const buildOperatorConsoleSnapshot = ({
  runtime,
  activation,
  autonomousRun,
  validation,
  prediction,
  memory = emptyMemory(),
  cycle = idleCycle(),
  now = new Date().toISOString()
}: BuildOperatorConsoleSnapshotInput): OperatorConsoleSnapshot => {
  const sourceEligible = sourceIsEligible(runtime);
  const provider = providerFor(runtime);
  const canonicalSource = runtime?.marketData.activeResearchSource;
  const sourceStatus = !canonicalSource || canonicalSource.candleCount <= 0
    ? "unavailable"
    : sourceEligible
      ? "active"
      : "attention";
  const metrics = runtime?.performance.canonicalPerformanceMetrics ?? runtime?.latestResearchCycle.latestCycleMetrics;
  const walkForward = runtime?.walkForward.latestRun;
  const walkForwardStatus = walkForward?.stability?.verdict ?? (validation?.walkForwardResult?.verdict ?? "not run");
  const insight = insightFor(runtime, activation, cycle);

  return {
    generatedAt: now,
    source: {
      provider,
      label: clean(runtime?.marketData.activeResearchSourceLabel, "No research source"),
      requestedSymbol: clean(canonicalSource?.normalizedSymbol ?? runtime?.marketData.symbol, activation?.requestedSymbol ?? "MNQ"),
      brokerSymbol: brokerSymbolFor(runtime) ?? activation?.brokerSymbol,
      timeframe: clean(canonicalSource?.timeframe ?? runtime?.marketData.timeframe, activation?.primaryTimeframe ?? "5m"),
      candleCount: canonicalSource?.candleCount ?? 0,
      fingerprint: canonicalSource?.fingerprint || undefined,
      researchEligible: sourceEligible,
      status: sourceStatus,
      statusLabel: sourceEligible
        ? "MT5 research source active"
        : sourceStatus === "unavailable"
          ? "Research source unavailable"
          : "Source is not eligible for research",
      lastTimestamp: canonicalSource?.lastTimestamp
    },
    cycle: {
      ...cycle,
      authority: OPERATOR_AUTHORITY,
      autoApplyAllowed: false,
      researchOnly: true
    },
    insight,
    results: {
      totalTrades: metrics?.totalTrades ?? 0,
      winRate: metrics?.winRate,
      averageR: metrics?.averageR,
      maxDrawdownR: metrics?.maxDrawdownR,
      profitFactor: metrics?.profitFactor ?? undefined,
      readiness: runtime?.readiness.readinessState ?? "Not Ready",
      evidenceScore: runtime?.evidence.evidenceQualityScore,
      maturityScore: runtime?.maturity.maturityScore,
      walkForwardStatus: clean(walkForwardStatus, "not run").replace(/_/g, " "),
      generatedAt: metrics?.generatedAt
    },
    validation: {
      status: clean(validation?.hypothesisStatus, "not queued").replace(/_/g, " "),
      setupLabel: clean(validation?.setupLabel, "No active validation"),
      nextAction: clean(validation?.nextAction, "The autonomous cycle will queue validation when a qualified setup appears."),
      updatedAt: validation?.updatedAt
    },
    prediction: prediction ?? {
      latestFamily: "No forecast issued",
      latestState: "not started",
      pendingForecasts: 0,
      completedForecasts: 0,
      classification: "uncalibrated",
      nextAction: "Run a research cycle with an eligible MT5 source to issue the first timestamped forecast."
    },
    memory,
    researchPlan: researchPlanFor(activation, canonicalSource?.fingerprint, cycle),
    candidatePlans: candidatePlansFor(activation, canonicalSource?.fingerprint, cycle),
    marketContexts: marketContextsFor(activation, canonicalSource?.fingerprint, cycle),
    charterProfiles: charterProfilesFor(activation, canonicalSource?.fingerprint, cycle),
    researchCoverage: researchCoverageFor(cycle),
    canonicalSetupConflict: activation?.canonicalSetupConflict ?? "NONE",
    decisions: decisionsFor({ runtime, autonomousRun, cycle, sourceEligible }),
    authority: OPERATOR_AUTHORITY,
    autoApplyAllowed: false,
    researchOnly: true,
    safetyNote: "Research only. MT5 stays read-only; execution, broker mutation, readiness overrides, and automatic proposal application are disabled."
  };
};
