import type { AutonomousResearchRun } from "@/lib/autonomousResearch";
import type { IctActivateMarketLatestSummary } from "@/lib/ict-strategy-suite/ictActivateMarketPipelineTypes";
import type { ResearchRuntimeSnapshot } from "@/lib/runtime";
import type { ValidationChainEntry } from "@/lib/validationChain";

import {
  OPERATOR_AUTHORITY,
  type OperatorConsoleSnapshot,
  type OperatorCycleState,
  type OperatorDecision,
  type OperatorInsightSummary,
  type OperatorMemorySummary,
  type OperatorPredictionSummary
} from "./operatorConsoleTypes";
import {
  operatorCycleIsActive,
  pendingOperatorInsight,
  pendingOperatorResearchPlan
} from "./operatorPendingState";

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

const impliedEntryFor = ({
  side,
  stopLoss,
  takeProfit,
  riskReward
}: {
  side: "long" | "short" | "flat";
  stopLoss?: number;
  takeProfit?: number;
  riskReward?: number;
}) => {
  if ((side !== "long" && side !== "short") || !finite(stopLoss) || !finite(takeProfit) || !finite(riskReward) || riskReward <= 0) {
    return undefined;
  }
  const entry = (takeProfit + riskReward * stopLoss) / (1 + riskReward);
  const geometryValid = side === "long"
    ? stopLoss < entry && entry < takeProfit
    : takeProfit < entry && entry < stopLoss;
  if (!geometryValid) return undefined;
  const reproducedRiskReward = Math.abs(takeProfit - entry) / Math.abs(entry - stopLoss);
  return Math.abs(reproducedRiskReward - riskReward) <= Math.max(0.01, riskReward * 0.005)
    ? roundedPrice(entry)
    : undefined;
};

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

const researchPlanFor = (
  activation: IctActivateMarketLatestSummary | undefined,
  sourceFingerprint: string | undefined
): OperatorConsoleSnapshot["researchPlan"] => {
  const currentCandidate = activation?.currentOpportunitySummary?.topOpportunity
    ?? activation?.currentOpportunitySummary?.topNearMiss
    ?? activation?.currentOpportunitySummary?.topRejected;
  const stopLoss = activation?.proposedStopLoss;
  const takeProfit = activation?.proposedTakeProfit;
  const levelImpliedSide = finite(stopLoss) && finite(takeProfit) && stopLoss !== takeProfit
    ? stopLoss < takeProfit ? "long" as const : "short" as const
    : undefined;
  const candidateSide = currentCandidate?.side;
  const side = activation?.researchSide === "long" || activation?.researchSide === "short" || activation?.researchSide === "flat"
    ? activation.researchSide
    : candidateSide === "long" || candidateSide === "short"
      ? candidateSide
      : levelImpliedSide ?? "flat";
  const proposedEntryZone = activation?.proposedEntryZone;
  const entryZone = proposedEntryZone && finite(proposedEntryZone.lower) && finite(proposedEntryZone.upper)
    ? {
        lower: Math.min(proposedEntryZone.lower, proposedEntryZone.upper),
        upper: Math.max(proposedEntryZone.lower, proposedEntryZone.upper)
      }
    : undefined;
  const directional = side === "long" || side === "short";
  const riskReward = activation?.proposedRiskReward;
  const candidateMatchesSide = candidateSide === side || candidateSide === undefined;
  const canonicalEntryPrice = activation?.proposedEntryPrice ?? (candidateMatchesSide ? currentCandidate?.entry : undefined);
  const recoveredEntryPrice = impliedEntryFor({ side, stopLoss, takeProfit, riskReward });
  const entryPrice = directional && finite(canonicalEntryPrice)
    ? roundedPrice(canonicalEntryPrice)
    : directional && entryZone
      ? roundedPrice((entryZone.lower + entryZone.upper) / 2)
      : recoveredEntryPrice;
  const complete =
    directional &&
    finite(entryPrice) &&
    finite(stopLoss) &&
    finite(takeProfit) &&
    finite(riskReward);
  const geometryCoherent = !complete
    ? undefined
    : side === "long"
      ? stopLoss < entryPrice && entryPrice < takeProfit
      : side === "short"
        ? takeProfit < entryPrice && entryPrice < stopLoss
        : false;
  const reproducedRiskReward = complete && geometryCoherent
    ? Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss)
    : undefined;
  const riskRewardCoherent = reproducedRiskReward === undefined || !finite(riskReward)
    ? undefined
    : Math.abs(reproducedRiskReward - riskReward) <= Math.max(0.15, riskReward * 0.1);
  const planCoherence = geometryCoherent === false || riskRewardCoherent === false
    ? "incoherent" as const
    : complete
      ? "coherent" as const
      : "incomplete" as const;
  const planCoherenceReason = geometryCoherent === false
    ? `${side === "long" ? "Bullish" : "Bearish"} direction conflicts with entry, stop-loss, and take-profit geometry.`
    : riskRewardCoherent === false
      ? "The stated risk/reward does not match the entry, stop-loss, and take-profit prices."
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
  const signal = complete && planCoherence === "coherent" && !candidateRejected && !riskBlocked ? (side === "long" ? "BUY" : "SELL") : "NO_TRADE";

  return {
    status,
    setup: clean(activation?.modelName, "No qualified research plan").replace(/_/g, " "),
    side,
    setupDirection,
    signal,
    planSource: activation?.proposedEntryPrice !== undefined ? "signal_contract" : finite(entryPrice) ? "legacy_recovery" : "unavailable",
    planCoherence,
    planCoherenceReason,
    candidateStatus,
    entryZone,
    entryPrice,
    entryPriceMethod: finite(canonicalEntryPrice)
      ? "canonical_candidate"
      : entryZone && finite(entryPrice)
        ? "zone_midpoint"
        : finite(recoveredEntryPrice)
          ? "rr_implied_recovery"
        : undefined,
    stopLoss,
    takeProfit,
    riskReward,
    riskScreeningStatus: clean(activation?.riskScreeningStatus, "not evaluated").replace(/_/g, " "),
    riskScreeningReason: `${clean(
      activation?.riskScreeningReason,
      complete
        ? "Market-context screening is complete; independent account-risk evaluation has not run."
        : "A complete directional research plan is required before independent account-risk evaluation."
    )}${planCoherence === "incoherent" ? ` ${planCoherenceReason}` : ""}`,
    accountRiskEvaluation: "not_evaluated",
    recommendedMaxRiskPerTradePct: activation?.recommendedMaxRiskPerTradePct,
    sourceFingerprint,
    generatedAt: activation?.activationTimestamp,
    informationalOnly: true,
    executionAllowed: false
  };
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
  const cycleActive = operatorCycleIsActive(cycle);
  const insight = cycleActive ? pendingOperatorInsight(cycle) : insightFor(runtime, activation, cycle);

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
    researchPlan: cycleActive
      ? pendingOperatorResearchPlan(canonicalSource?.fingerprint)
      : researchPlanFor(activation, canonicalSource?.fingerprint),
    decisions: decisionsFor({ runtime, autonomousRun, cycle, sourceEligible }),
    authority: OPERATOR_AUTHORITY,
    autoApplyAllowed: false,
    researchOnly: true,
    safetyNote: "Research only. MT5 stays read-only; execution, broker mutation, readiness overrides, and automatic proposal application are disabled."
  };
};
