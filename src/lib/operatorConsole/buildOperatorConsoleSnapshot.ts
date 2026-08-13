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
  type OperatorPredictionSummary
} from "./operatorConsoleTypes";

export interface BuildOperatorConsoleSnapshotInput {
  runtime?: ResearchRuntimeSnapshot;
  activation?: IctActivateMarketLatestSummary;
  autonomousRun?: AutonomousResearchRun;
  validation?: ValidationChainEntry;
  prediction?: OperatorPredictionSummary;
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
  const advisor = runtime?.latestResearchCycle.latestRun?.ictAdvisorSignalSummary;
  const advisorSide = advisor?.side === "long" ? "buy" : advisor?.side === "short" ? "sell" : "no_trade";
  const advisorBias = advisorSide === "buy" ? "bullish" : advisorSide === "sell" ? "bearish" : "neutral";
  const entry = advisor?.entryZoneMidpoint;
  const stopLoss = advisor?.invalidation;
  const takeProfit = advisor?.target;
  const geometryValid = typeof entry === "number" && Number.isFinite(entry) &&
    typeof stopLoss === "number" && Number.isFinite(stopLoss) &&
    typeof takeProfit === "number" && Number.isFinite(takeProfit) &&
    (advisorSide === "buy" ? stopLoss < entry && entry < takeProfit : advisorSide === "sell" ? takeProfit < entry && entry < stopLoss : false);
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
    nextAction: clean(activation?.nextAction ?? runtime?.readiness.nextAction, "Start a research cycle to refresh the current read."),
    tradePlan: advisor
      ? {
          status: geometryValid && advisor.decision === "research_only" ? "valid_research_plan" : geometryValid ? "blocked" : "unavailable",
          side: advisorSide,
          bias: advisorBias,
          decision: advisor.decision,
          entry: geometryValid ? entry : undefined,
          stopLoss: geometryValid ? stopLoss : undefined,
          takeProfit: geometryValid ? takeProfit : undefined,
          riskReward: geometryValid ? advisor.rrEstimate : undefined,
          confidence: advisor.confidence,
          reason: geometryValid
            ? advisor.decision === "research_only"
              ? "Canonical midpoint entry with side-validated research geometry. No execution authority."
              : advisor.noTradeReasons[0] ?? "The deterministic advisor did not qualify this plan."
            : advisor.noTradeReasons[0] ?? "A complete side-consistent entry, stop-loss, and take-profit tuple is unavailable."
        }
      : undefined
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
    decisions: decisionsFor({ runtime, autonomousRun, cycle, sourceEligible }),
    authority: OPERATOR_AUTHORITY,
    autoApplyAllowed: false,
    researchOnly: true,
    safetyNote: "Research only. MT5 stays read-only; execution, broker mutation, readiness overrides, and automatic proposal application are disabled."
  };
};
