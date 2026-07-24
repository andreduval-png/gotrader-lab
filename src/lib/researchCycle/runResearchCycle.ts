import { compactAutoResearchCycle, runAutoResearchCycle } from "@/lib/autoResearch";
import type { AutoResearchCandidateResult, AutoResearchCycle } from "@/lib/autoResearch";
import {
  auditAgentDebateSession,
  auditAutoResearchDecision,
  auditCioSynthesis,
  auditReadinessGate,
  auditSelfImprovementDecision,
  buildAgentAuditTraces,
  saveAgentAuditTraces
} from "@/lib/agentAudit";
import {
  runAgentDebateSession,
  saveAgentDebateSession,
  type AgentDebateSession
} from "@/lib/agentDebate";
import {
  diagnoseTradeGeneration,
  diagnoseTradeQuality,
  runBacktest,
  sanitizeBacktestConfig,
  topTradeGenerationDiagnostic
} from "@/lib/backtesting";
import type { BacktestResult, ResolvedBacktestConfig } from "@/lib/backtesting";
import { recordResearchCycleCommunication } from "@/lib/communications/communicationSpec";
import { createCandleSourceFingerprint } from "@/lib/candleSources";
import { buildEvidenceLedger } from "@/lib/evidence";
import type { EvidenceLedgerInput } from "@/lib/evidence";
import {
  appendResearchEvidenceRecord,
  buildResearchEvidenceMemoryPacket,
  buildResearchEvidenceRecord
} from "@/lib/researchEvidenceLedger";
import { queueGbrainMemoryPacket, syncGbrainResearchMemory } from "@/lib/researchMemory";`r`nimport { evaluateCycleHistoricalEvidence } from "@/lib/researchEvidence";`r`nimport { persistAndReconcileTradePlanCycle } from "@/lib/tradePlanOutcomes";
import {
  buildLLMResearchContextPacket,
  importLLMAgentResponse,
  recordLLMResponseImport,
  recordLLMUnsafeResponseRejection,
  runLocalBridgeAdvisory,
  validateLLMContextPacket
} from "@/lib/llm";
import type { LLMAdvisoryRun } from "@/lib/llm";
import {
  DASHBOARD_IMPORTED_CANDIDATE_LIMIT,
  DASHBOARD_IMPORTED_RAW_WINDOW_LIMIT,
  DASHBOARD_IMPORTED_SAFE_PROCESSED_LIMIT,
  DASHBOARD_IMPORTED_SAFE_WINDOW_SIZE,
  buildMarketContext,
  getImportedDataPreset,
  loadCandleWindowSettings,
  loadPreparedCandleSource,
  resolveActiveResearchCandleSource,
  resolveImportedCandleActivationState,
  type PreparedCandleSource
} from "@/lib/marketData";
import { hydrateActiveTradingViewMcpChartFeed } from "@/lib/integrations/tradingview";
import { hydrateActiveMt5ReadOnlyCandleFeed } from "@/lib/integrations/mt5";
import {
  buildIctAdvisorPacketFromRuntime,
  buildIctMarketAnalysisContextBundle
} from "@/lib/ict-strategy-suite";
import type { IctAdvisorPacket, IctMarketAnalysisContext } from "@/lib/ict-strategy-suite";
import { buildAndSaveAutomatedCycleEvidence } from "@/lib/ict-strategy-suite/ictAutomatedCycleEvidence";
import { resolveResearchRuntimeSnapshot } from "@/lib/runtime";
import { buildCanonicalPerformanceMetricsFromRun, canonicalMetricsForRun } from "@/lib/performance/canonicalMetrics";
import { calculateResearchMaturity } from "@/lib/maturity";
import { evaluateReadinessGate } from "@/lib/readiness";
import { analyzeValidationResults, saveLatestResearchQualityReview } from "@/lib/researchQuality";
import type {
  ResearchCycleBacktestSummary,
  ResearchCycleCandidateSummary,
  ResearchCycleQualitySummary,
  ResearchCycleAgentDebateSummary,
  ResearchCycleRun,
  ResearchCycleRunOptions,
  ResearchCycleState,
  ResearchCycleStatus,
  ResearchCycleStepId,
  ResearchCycleStepResult,
  ResearchCycleThesisSummary,
  ResearchCycleValidationSummary
} from "@/lib/researchCycle/researchCycleTypes";
import { runDetectorProfileBacktest } from "@/lib/researchCycle/runDetectorProfileBacktest";
import { notifyResearchCycleObserver } from "@/lib/researchCycle/safeResearchCycleObserver";
import { generateThesis } from "@/lib/simulation";
import {
  loadSimulationRunbookState,
  saveSimulationRunbookState
} from "@/lib/simulationRunbook";
import type { SimulationRunbookSignal } from "@/lib/simulationRunbook";
import {
  type CalibrationProposal,
  loadSelfImprovementState,
  resolveActiveBacktestConfig,
  upsertCalibrationProposal
} from "@/lib/selfImprovement";
import { labStorage } from "@/lib/storage";
import type { LabState, ThesisInput, TradeThesis } from "@/lib/types";
import { safeArray, safeTopN, uid } from "@/lib/utils";
import { runValidationSuiteAsync, saveLatestValidationReport } from "@/lib/validation";
import type { ValidationSuiteReport } from "@/lib/validation";
import {
  buildValidationProvenanceIdentity,
  fingerprintValidationParameters
} from "@/lib/validationProvenance";
import {
  applyFrozenResearchProfileConfig,
  getFrozenResearchProfile
} from "@/lib/forwardEvidence";
import { reviewEdgeStatistics } from "@/lib/agents/edgeAuditorAgent";
import {
  adaptDetectorProfileWalkForwardRun,
  loadPreparedCanonicalWalkForwardCandleSource,
  runDetectorProfileWalkForward,
  runWalkForwardValidation,
  saveWalkForwardRun,
  walkForwardProvenanceReview
} from "@/lib/walkForward";
import { linkResearchCycleValidationChain } from "@/lib/validationChain";
import { buildForwardScenarioMap } from "@/lib/forwardScenario";
import {
  recordFrozenMarketEpisodeProfileObservationsFromClosedCandle,
  recordForwardScenarioPrediction
} from "@/lib/predictionLedger";

export const RESEARCH_CYCLE_STORAGE_KEY = "gotrader_ai_lab_research_cycle_state";
export const RESEARCH_CYCLE_UPDATED_EVENT = "gotrader-ai-lab-research-cycle-updated";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const stepDefinitions: Array<Pick<ResearchCycleStepResult, "stepId" | "label" | "summary">> = [
  {
    stepId: "thesis_generation",
    label: "Research thesis",
    summary: "Waiting to generate ICT context and CIO thesis."
  },
  {
    stepId: "backtest",
    label: "Backtest",
    summary: "Waiting to run the active research-source backtest."
  },
  {
    stepId: "auto_research",
    label: "Auto research cycle",
    summary: "Waiting to search bounded research configurations."
  },
  {
    stepId: "validation",
    label: "Validation suite",
    summary: "Waiting to run scenario validation."
  },
  {
    stepId: "walk_forward",
    label: "Walk-forward OOS",
    summary: "Waiting to run walk-forward out-of-sample validation."
  },
  {
    stepId: "research_quality",
    label: "Research quality review",
    summary: "Waiting to analyze validation quality."
  },
  {
    stepId: "self_improvement",
    label: "Self-improvement proposal",
    summary: "Waiting to check whether a stability proposal was created."
  },
  {
    stepId: "simulation_verification",
    label: "Simulation runbook",
    summary: "Waiting to record research pipeline completion."
  },
  {
    stepId: "readiness_gate",
    label: "Readiness gate update",
    summary: "Waiting to recompute readiness without overrides."
  },
  {
    stepId: "llm_advisory",
    label: "LLM advisory review (post-validation)",
    summary: "Waiting to review completed validation results via the local LLM bridge."
  },
  {
    stepId: "communications_audit",
    label: "Communications audit",
    summary: "Waiting to log the research cycle."
  }
];

const initialState = (): ResearchCycleState => ({
  runs: [],
  safetyNotice: "Research cycle only. Broker execution remains disabled."
});

const readinessBlockerLabel = (requirement: { id?: string; label: string; passed?: boolean }) => {
  if (requirement.passed) {
    return undefined;
  }
  switch (requirement.id) {
    case "validation-exists":
      return "Validation suite missing.";
    case "research-quality-exists":
      return "Research quality review missing.";
    case "simulated-trade-sample":
      return "Insufficient simulated trades.";
    case "quality-candidate":
      return "Research Quality must reach Paper-Demo Candidate.";
    case "llm-advisory-review":
      return "LLM advisory missing.";
    case "runbook-complete":
      return "Simulation runbook incomplete.";
    case "drawdown-threshold":
      return "Drawdown too high.";
    case "confidence-calibration":
      return "Confidence calibration too low.";
    case "false-positive-control":
      return "False positives too high.";
    case "session-consistency":
      return "Session consistency weak.";
    case "conservative-stability":
      return "Conservative scenario unstable.";
    default:
      return requirement.label;
  }
};

const uniqueText = (items: Array<string | undefined>) =>
  items.filter((item): item is string => Boolean(item?.trim())).filter((item, index, array) => array.indexOf(item) === index);

const persistTradePlanCycleSafely = async (run: ResearchCycleRun, candles: import("@/lib/types").Candle[]) => {
  try {
    await persistAndReconcileTradePlanCycle(run, candles, run.completedAt ?? new Date().toISOString());
  } catch (error) {
    run.candleWindowWarnings = uniqueText([
      ...(run.candleWindowWarnings ?? []),
      `Trade-plan result persistence failed safely: ${error instanceof Error ? error.message : "unknown error"}. No readiness or authority changed.`
    ]);
  }
};

const evidenceDataModeFor = (
  sourceMode: ResearchCycleRun["dataSourceMode"],
  fallbackMode: PreparedCandleSource["mode"]
): EvidenceLedgerInput["dataMode"] => {
  if (sourceMode === "tradingview_mcp_chart" || sourceMode === "mt5_read_only") {
    return "future_provider";
  }
  return fallbackMode === "imported" ? "imported" : "mock";
};

const sourceMetadataFor = ({
  activeResearchCandleSource,
  mt5ReadOnlyFeed,
  tradingViewChartFeed
}: {
  activeResearchCandleSource: ReturnType<typeof resolveActiveResearchCandleSource>;
  mt5ReadOnlyFeed?: Awaited<ReturnType<typeof hydrateActiveMt5ReadOnlyCandleFeed>>;
  tradingViewChartFeed?: Awaited<ReturnType<typeof hydrateActiveTradingViewMcpChartFeed>>;
}): ResearchCycleRun["sourceMetadata"] => {
  const mt5Active = activeResearchCandleSource.sourceMode === "mt5_read_only";
  const tradingViewActive = activeResearchCandleSource.sourceMode === "tradingview_mcp_chart";
  const eligibility = mt5Active
    ? mt5ReadOnlyFeed?.researchEligibility
    : tradingViewActive
      ? tradingViewChartFeed?.researchEligibility
      : undefined;

  return {
    activeSourceMode: activeResearchCandleSource.sourceMode,
    activeSourceLabel: activeResearchCandleSource.sourceLabel,
    activeSourceFingerprint: activeResearchCandleSource.canonicalFingerprint,
    candleCount: activeResearchCandleSource.identity.candleCount,
    firstTimestamp: activeResearchCandleSource.identity.firstTimestamp,
    lastTimestamp: activeResearchCandleSource.identity.lastTimestamp,
    firstClose: activeResearchCandleSource.identity.firstClose,
    lastClose: activeResearchCandleSource.identity.lastClose,
    researchEligibility: eligibility?.state,
    eligibilityReasons: safeArray(eligibility?.reasons),
    sourceWarnings: uniqueText([
      ...(mt5Active ? safeArray(mt5ReadOnlyFeed?.warnings) : []),
      ...(tradingViewActive ? safeArray(tradingViewChartFeed?.warnings) : []),
      activeResearchCandleSource.sourceMode === "mt5_read_only"
        ? "MT5 read-only candles are CFD/proxy market data, not CME futures broker truth."
        : undefined,
      activeResearchCandleSource.sourceMode === "tradingview_mcp_chart"
        ? "TradingView MCP candles are chart data, not broker truth."
        : undefined
    ]),
    authority: {
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none"
    }
  };
};

const evaluateResearchCycleSourceGuard = ({
  activeResearchCandleSource,
  allowedSourceModes,
  minimumCandleCount = 400,
  mt5ReadOnlyFeed,
  tradingViewChartFeed
}: {
  activeResearchCandleSource: ReturnType<typeof resolveActiveResearchCandleSource>;
  allowedSourceModes?: NonNullable<ResearchCycleRunOptions["sourceGuard"]>["allowedSourceModes"];
  minimumCandleCount?: number;
  mt5ReadOnlyFeed?: Awaited<ReturnType<typeof hydrateActiveMt5ReadOnlyCandleFeed>>;
  tradingViewChartFeed?: Awaited<ReturnType<typeof hydrateActiveTradingViewMcpChartFeed>>;
}) => {
  const allowedModes = allowedSourceModes ?? ["mt5_read_only", "imported", "tradingview_mcp_chart"];
  const sourceMode = activeResearchCandleSource.sourceMode;
  const sourceLabel = activeResearchCandleSource.sourceLabel;
  const candleCount = activeResearchCandleSource.identity.candleCount;

  if (!allowedModes.includes(sourceMode)) {
    return `active research source ${sourceMode.replace(/_/g, " ")} is not allowed for this guarded run. Select MT5 read-only or another explicit eligible source.`;
  }
  if (sourceMode === "mock") {
    return "active research source is mock/demo data. Autonomous Research requires an explicit eligible canonical source.";
  }
  if (!activeResearchCandleSource.canonicalFingerprint) {
    return `active research source ${sourceLabel} is missing a source fingerprint.`;
  }
  if (candleCount < minimumCandleCount) {
    return `active research source ${sourceLabel} has ${candleCount.toLocaleString()} candles; ${minimumCandleCount.toLocaleString()} are required.`;
  }
  if (sourceMode === "mt5_read_only") {
    const eligibility = mt5ReadOnlyFeed?.researchEligibility;
    if (!mt5ReadOnlyFeed?.activeForResearch || eligibility?.state !== "eligible_for_research_cycle") {
      return [
        "MT5 read-only is not active as the guarded research source.",
        ...(eligibility?.reasons ?? ["Click Use MT5 for Research after fetching eligible MT5 candles."])
      ].join(" ");
    }
    if (
      mt5ReadOnlyFeed.executionAuthority !== "none" ||
      mt5ReadOnlyFeed.brokerAuthority !== "none" ||
      mt5ReadOnlyFeed.readinessOverrideAuthority !== "none"
    ) {
      return "MT5 read-only source authority is invalid. Execution, broker, and readiness override authority must all be none.";
    }
  }
  if (sourceMode === "tradingview_mcp_chart") {
    const eligibility = tradingViewChartFeed?.researchEligibility;
    if (!tradingViewChartFeed?.activeForResearch || eligibility?.state !== "eligible_for_research_cycle") {
      return [
        "TradingView MCP is not active as the guarded research source.",
        ...(eligibility?.reasons ?? ["Select TradingView for research only after source gates pass."])
      ].join(" ");
    }
  }

  return undefined;
};

const publish = (state: ResearchCycleState) => {
  if (isBrowser()) {
    try {
      window.localStorage.setItem(RESEARCH_CYCLE_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      const compactState = {
        ...state,
        runs: safeTopN(safeArray(state.runs), 1).map((run) => compactResearchCycleRun(run, "aggressive"))
      };
      try {
        window.localStorage.setItem(RESEARCH_CYCLE_STORAGE_KEY, JSON.stringify(compactState));
      } catch (retryError) {
        console.warn("Research cycle storage write skipped after pruning.", {
          error: retryError instanceof Error ? retryError.message : String(retryError)
        });
      }
    }
    window.dispatchEvent(new CustomEvent(RESEARCH_CYCLE_UPDATED_EVENT, { detail: state }));
  }
  return state;
};

const initialSteps = (): ResearchCycleStepResult[] =>
  stepDefinitions.map((step) => ({
    ...step,
    status: "pending"
  }));

const now = () => new Date().toISOString();

const yieldToBrowser = () =>
  new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });

const statusCounts = (steps: ResearchCycleStepResult[]) => ({
  warnings: steps.filter((step) => step.status === "warning").length,
  failed: steps.filter((step) => step.status === "failed").length,
  passed: steps.filter((step) => step.status === "passed" || step.status === "completed").length,
  skipped: steps.filter((step) => step.status === "skipped").length
});

const signalFor = (thesis: TradeThesis): SimulationRunbookSignal =>
  thesis.finalBias === "bullish" ? "BUY" : thesis.finalBias === "bearish" ? "SELL" : "NEUTRAL";

const thesisInputFor = (config: ResolvedBacktestConfig, cycleId: string): ThesisInput => ({
  symbol: config.symbol,
  timeframe: config.timeframe,
  session:
    config.session ??
    (config.sessionFilter === "London"
      ? "London"
      : config.sessionFilter === "New York" || config.sessionFilter === "NY AM Kill Zone"
        ? "New York AM"
        : config.sessionFilter === "NY PM Kill Zone"
          ? "New York PM"
          : "Globex"),
  marketRegime: config.marketRegime,
  notes: `Generated by AI Research Cycle ${cycleId}. Simulation-only pipeline; broker execution disabled.`
});

const summarizeThesis = (thesis: TradeThesis, debateSessionId: string): ResearchCycleThesisSummary => ({
  thesisId: thesis.id,
  debateSessionId,
  generatedAt: thesis.createdAt,
  symbol: thesis.symbol,
  timeframe: thesis.timeframe,
  bias: thesis.finalBias,
  confidence: thesis.confidence,
  ictBias: thesis.ictContext.bias,
  confluenceScore: thesis.ictContext.confluenceScore,
  summary: thesis.thesisSummary,
  invalidation: thesis.invalidationLevel,
  target: thesis.targetLiquidity
});

const summarizeBacktest = (result: BacktestResult): ResearchCycleBacktestSummary => ({
  config: {
    symbol: result.config.symbol,
    timeframe: result.config.timeframe,
    sessionFilter: result.config.sessionFilter,
    minimumConfluenceThreshold: result.config.minimumConfluenceThreshold,
    minimumConfidenceThreshold: result.config.minimumConfidenceThreshold,
    targetRMultiple: result.config.targetRMultiple,
    stopModel: result.config.stopModel
  },
  totalTrades: result.summary.totalTrades,
  wins: result.summary.wins,
  losses: result.summary.losses,
  unresolved: result.summary.unresolved,
  winRate: result.summary.winRate,
  realizedR: result.summary.realizedR,
  averageR: result.summary.averageR,
  maxDrawdown: result.summary.maxDrawdown,
  profitFactor: result.summary.profitFactor,
  skippedSignals: result.summary.skippedSignals,
  grinchSummary: result.summary.grinchSummary,
  bestTradeR: result.summary.bestTrade?.rMultiple,
  worstTradeR: result.summary.worstTrade?.rMultiple,
  edgeStatistics: result.summary.edgeStatistics
});

const summarizeValidation = (report: ValidationSuiteReport): ResearchCycleValidationSummary => ({
  validationId: report.id,
  generatedAt: report.generatedAt,
  provenance: report.provenance,
  readinessStatus: report.calibration.readinessStatus,
  readinessScore: report.calibration.readinessScore,
  strongestScenario: report.calibration.strongestScenario,
  weakestScenario: report.calibration.weakestScenario,
  recommendedConfluenceThreshold: report.calibration.recommendedConfluenceThreshold,
  recommendedConfidenceThreshold: report.calibration.recommendedConfidenceThreshold
});

const summarizeQuality = (review: ReturnType<typeof analyzeValidationResults>): ResearchCycleQualitySummary => ({
  reviewId: review.id,
  generatedAt: review.generatedAt,
  readinessGrade: review.readinessGrade,
  readinessScore: review.readinessScore,
  topWeaknesses: safeTopN(review.topWeaknesses, 3).map((item) => item.title),
  topStrengths: safeTopN(review.topStrengths, 3).map((item) => item.title),
  recommendedNextStep: review.recommendedNextStep
});

const summarizeCandidate = (candidate?: AutoResearchCandidateResult): ResearchCycleCandidateSummary | undefined =>
  candidate
    ? {
        candidateId: candidate.candidateId,
        label: candidate.label,
        score: candidate.scoreBreakdown?.totalScore ?? 0,
        resultCategory: candidate.resultCategory,
        readinessEstimate: candidate.readinessEstimate?.state ?? "Not Ready"
      }
    : undefined;

const summarizeAgentDebateConsensus = (session: AgentDebateSession): ResearchCycleAgentDebateSummary => ({
  sessionId: session.sessionId,
  consensusReached: session.moderatorOutput.consensusReached,
  position: session.moderatorOutput.position,
  probability: session.moderatorOutput.probability,
  strongestDisagreement: session.moderatorOutput.disagreements[0] ?? "No major disagreement recorded.",
  minorityView: session.moderatorOutput.minorityView
});

const compactLLMRun = (run?: LLMAdvisoryRun): LLMAdvisoryRun | undefined =>
  run
    ? {
        ...run,
        responses: [],
        validationResults: {}
      }
    : undefined;

const llmUnavailableSummary = (reason: string) => {
  switch (reason) {
    case "bridge_offline":
      return "LLM advisory bridge offline. Deterministic research continued; advisory unavailable.";
    case "config_missing":
      return "LLM advisory bridge is online, but the advisory provider is not configured. Deterministic research continued.";
    case "timeout":
      return "LLM advisory bridge is online, but the provider timed out. Deterministic research continued.";
    case "circuit_open":
      return "LLM advisory retry is cooling down after a provider failure. Deterministic research continued.";
    case "deferred_until_evidence_ready":
      return "LLM advisory was deferred until deterministic evidence is ready.";
    case "skipped_for_autonomous_stability":
      return "LLM advisory was intentionally skipped for autonomous stability mode.";
    default:
      return "LLM advisory request was unavailable. Deterministic research continued.";
  }
};

const llmBridgeProcessAvailable = (reason: string) => reason !== "bridge_offline";

const unavailableLLMRun = ({
  contextPacketId,
  reason,
  warnings
}: {
  contextPacketId: string;
  reason: string;
  warnings: string[];
}): LLMAdvisoryRun => ({
  runId: uid("llm_run_unavailable"),
  timestamp: now(),
  researchMode: "llm_required",
  providerMode: "local_command",
  providerConfigured: false,
  status: "unavailable",
  realProvider: false,
  advisoryPassed: false,
  contextPacketId,
  responses: [],
  validationResults: {},
  unsafeResponseRejections: 0,
  readinessImpact: [
    warnings[0] ?? llmUnavailableSummary(reason),
    `Reason: ${reason}.`
  ].join(" "),
  safetyNotice: "LLM agents are advisory only. They cannot execute trades or override readiness gates."
});

export function compactResearchCycleRun(
  run: ResearchCycleRun,
  mode: "standard" | "aggressive" = "standard"
): ResearchCycleRun {
  return {
    ...run,
    steps: safeArray(run.steps).map((step) => ({ ...step })),
    llmRun: compactLLMRun(run.llmRun),
    autoResearchCheckpoint: undefined,
    autoResearchCycle:
      mode === "standard" && run.autoResearchCycle
        ? compactAutoResearchCycle(run.autoResearchCycle)
        : undefined,
    validationReport: undefined,
    researchQualityReview: undefined,
    backtestDiagnostics: safeTopN(run.backtestDiagnostics, mode === "aggressive" ? 3 : 20),
    tradeQualityDiagnostics: safeTopN(run.tradeQualityDiagnostics, mode === "aggressive" ? 3 : 12),
    activeCalibrationSourceTrace: safeTopN(run.activeCalibrationSourceTrace, mode === "aggressive" ? 4 : 12),
    candleWindowWarnings: safeTopN(run.candleWindowWarnings, mode === "aggressive" ? 4 : 10),
    blockers: safeTopN(run.blockers, 8),
    promotionBlockers: safeTopN(run.promotionBlockers, 8),
    latestGeneratedProposal: mode === "aggressive" ? undefined : run.latestGeneratedProposal
  };
}

const nextActionFor = (run: ResearchCycleRun) => {
  if (run.status === "canceled") {
    return "Discard the stopped checkpoint or rerun the research cycle in Safe mode.";
  }
  if (run.status === "failed") {
    return "Open the failed step details, fix the blocker, then rerun the research cycle.";
  }
  if (run.backtestSummary?.totalTrades === 0) {
    return "Review zero-trade diagnostics and recovery results. Strategy cannot be evaluated until simulated trades exist.";
  }
  const activeReadinessRequirements = run.readinessSnapshot?.activeFailedRequirements ??
    run.readinessSnapshot?.failedRequirements ??
    [];
  if (
    !run.llmRun?.advisoryPassed &&
    activeReadinessRequirements.some((requirement) => requirement.id === "llm-advisory-review")
  ) {
    return "Start the local LLM bridge and rerun GPT advisory review before expecting Paper-Demo Candidate readiness.";
  }
  if (run.createdProposalId) {
    return "Review the new self-improvement proposal. Approval is still required before settings change.";
  }
  if (safeArray(run.blockers).length) {
    return "Review readiness blockers and rerun validation after the weakest requirement improves.";
  }
  return "Keep broker execution disabled and continue simulation monitoring.";
};

const resultSummaryFor = (run: ResearchCycleRun) => {
  const counts = statusCounts(safeArray(run.steps));
  if (run.status === "canceled") {
    return `Research cycle canceled after ${run.candidateProgress?.currentCandidate ?? 0}/${run.candidateProgress?.totalCandidates ?? 0} candidate checkpoints. Broker execution remained disabled.`;
  }
  if (run.status === "failed") {
    return `Research cycle failed at ${run.failedStepId ?? "unknown step"}. Broker execution remained disabled.`;
  }
  return [
    `${counts.passed} steps passed`,
    counts.warnings ? `${counts.warnings} warning${counts.warnings === 1 ? "" : "s"}` : "no blocking warnings",
    counts.skipped ? `${counts.skipped} skipped` : undefined,
    run.backtestSummary ? `${run.backtestSummary.totalTrades} backtest trades` : undefined,
    run.backtestSummary?.totalTrades === 0 ? "No valid simulated trades were generated" : undefined,
    run.autoResearchCycle?.noSafePaperDemoCandidateFound ? "No safe Paper-Demo Candidate found" : undefined,
    run.bestCandidateSummary ? `best candidate: ${run.bestCandidateSummary.label}` : undefined,
    run.createdProposalId ? `proposal ${run.createdProposalId} created` : "no proposal created",
    `readiness: ${run.readinessSnapshot?.state ?? "not evaluated"}`
  ].filter(Boolean).join(" / ");
};

const finalStatusFor = (run: ResearchCycleRun): ResearchCycleStatus => {
  if (run.failedStepId === "backtest" || run.failedStepId === "thesis_generation") {
    return "failed";
  }
  const counts = statusCounts(safeArray(run.steps));
  return counts.warnings || counts.failed || counts.skipped || safeArray(run.blockers).length
    ? "completed_with_warnings"
    : "completed";
};

export function loadResearchCycleState(): ResearchCycleState {
  if (!isBrowser()) {
    return initialState();
  }

  const raw = window.localStorage.getItem(RESEARCH_CYCLE_STORAGE_KEY);
  if (!raw) {
    return publish(initialState());
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ResearchCycleState>;
    return {
      ...initialState(),
      ...parsed,
      runs: safeArray(parsed.runs)
    };
  } catch {
    return publish(initialState());
  }
}

export function saveResearchCycleRun(run: ResearchCycleRun): ResearchCycleState {
  const state = loadResearchCycleState();
  const compactRun = compactResearchCycleRun(run);
  return publish({
    ...state,
    latestRunId: compactRun.cycleId,
    runs: safeTopN([compactRun, ...safeArray(state.runs).filter((item) => item.cycleId !== compactRun.cycleId)], 5)
  });
}

export function latestResearchCycleRun(state = loadResearchCycleState()) {
  const runs = safeArray(state.runs);
  return runs.find((run) => run.cycleId === state.latestRunId) ?? runs[0];
}

export async function runResearchCycle({
  state,
  searchMode = "standard",
  maxCandidateCount = 10,
  maxResearchCandles,
  backtestConfig,
  candleWindowSettings,
  advancedFullResearchMode = false,
  skipHeavyAudit,
  skipLlmAdvisory = false,
  skipAutoResearch = false,
  maxAdaptivePasses,
  autoResearchTimeoutMs,
  autoResearchCheckpointPersistence,
  sourceGuard,
  onUpdate,
  certifiedHistoricalEvidence,
  signal
}: ResearchCycleRunOptions): Promise<ResearchCycleRun> {
  let steps = initialSteps();
  let workingState: LabState = labStorage.load() ?? state;
  const cycleId = uid("research_cycle");
  const throwIfCanceled = () => {
    if (signal?.aborted) {
      throw new Error("Research cycle canceled by user.");
    }
  };
  const activeResearchConfig = resolveActiveBacktestConfig(backtestConfig ? sanitizeBacktestConfig(backtestConfig) : undefined);
  const baseActiveConfig = activeResearchConfig.config;
  const requestedCandleWindowSettings = candleWindowSettings ?? loadCandleWindowSettings();
  const importActivation = await resolveImportedCandleActivationState().catch(() => undefined);
  // Fail closed: a failed source load must not silently fall back to mock
  // candles, because mock-based results would masquerade as research evidence.
  const activeCandleSource: PreparedCandleSource = await loadPreparedCandleSource(requestedCandleWindowSettings).catch((error) => ({
    mode: "mock" as const,
    label: "No research data source (load failed)",
    candles: [],
    rawCandleCount: 0,
    researchWindowCandles: 0,
    processedCandleCount: 0,
    estimatedProcessedCandles: 0,
    appliedSettings: {
      windowMode: "latest",
      windowSize: 0,
      targetTimeframe: "5m" as const,
      sessionFilter: "all" as const,
      advancedMode: false
    },
    aggregationApplied: false,
    performanceMode: "safe" as const,
    warnings: [
      `Candle source failed to load: ${error instanceof Error ? error.message : "unknown error"}. Research is blocked until a real source is active.`
    ]
  }));
  const importedPreset = activeCandleSource.mode === "imported" ? getImportedDataPreset(activeCandleSource.appliedSettings) : "mock";
  const tradingViewChartFeed = await hydrateActiveTradingViewMcpChartFeed().catch(() => undefined);
  const mt5ReadOnlyFeed = await hydrateActiveMt5ReadOnlyCandleFeed().catch(() => undefined);
  const activeResearchCandleSource = resolveActiveResearchCandleSource(activeCandleSource, tradingViewChartFeed, mt5ReadOnlyFeed);
  const activeResearchUsesExternalReadOnly =
    activeResearchCandleSource.sourceMode === "tradingview_mcp_chart" || activeResearchCandleSource.sourceMode === "mt5_read_only";
  const sourceGuardIssue = sourceGuard?.requireEligibleResearchSource
    ? evaluateResearchCycleSourceGuard({
        activeResearchCandleSource,
        allowedSourceModes: sourceGuard.allowedSourceModes,
        minimumCandleCount: sourceGuard.minimumCandleCount,
        mt5ReadOnlyFeed,
        tradingViewChartFeed
      })
    : undefined;
  const importedExpectedButMissing =
    !activeResearchUsesExternalReadOnly &&
    activeCandleSource.mode !== "imported" &&
    ((importActivation?.importedDatasetCount ?? 0) > 0 || importActivation?.status === "active_import_missing_stale");
  const importedGuardedMode = activeCandleSource.mode === "imported" && !activeResearchUsesExternalReadOnly && !advancedFullResearchMode;
  const effectiveSearchMode = searchMode;
  const effectiveMaxCandidateCount = importedGuardedMode
    ? Math.min(maxCandidateCount, DASHBOARD_IMPORTED_CANDIDATE_LIMIT)
    : maxCandidateCount;
  const effectiveMaxAdaptivePasses = maxAdaptivePasses ?? (importedGuardedMode && importedPreset === "safe" ? 1 : undefined);
  const heavyAuditSkipped = skipHeavyAudit ?? importedGuardedMode;
  const researchPreset =
    activeCandleSource.mode !== "imported"
      ? "mock"
      : advancedFullResearchMode || activeCandleSource.performanceMode === "advanced"
        ? "advanced"
        : activeCandleSource.researchWindowCandles <= DASHBOARD_IMPORTED_SAFE_WINDOW_SIZE
          ? "safe"
          : "standard";
  const hardLimitWarnings = activeCandleSource.mode === "imported" && !advancedFullResearchMode
    ? [
        activeCandleSource.processedCandleCount > DASHBOARD_IMPORTED_SAFE_PROCESSED_LIMIT
          ? `Processed candles ${activeCandleSource.processedCandleCount.toLocaleString()} exceed the dashboard safe limit of ${DASHBOARD_IMPORTED_SAFE_PROCESSED_LIMIT.toLocaleString()}.`
          : undefined,
        activeCandleSource.researchWindowCandles > DASHBOARD_IMPORTED_RAW_WINDOW_LIMIT
          ? `Raw imported window ${activeCandleSource.researchWindowCandles.toLocaleString()} exceeds the dashboard safe limit of ${DASHBOARD_IMPORTED_RAW_WINDOW_LIMIT.toLocaleString()}.`
          : undefined,
        maxCandidateCount > DASHBOARD_IMPORTED_CANDIDATE_LIMIT
          ? `Candidate count ${maxCandidateCount.toLocaleString()} exceeds the imported-data safe limit of ${DASHBOARD_IMPORTED_CANDIDATE_LIMIT.toLocaleString()}.`
          : undefined
      ].filter(Boolean) as string[]
    : [];
  const sourceResearchCandles = activeResearchCandleSource.candles;
  const boundedResearchCandleCount = maxResearchCandles
    ? Math.max(100, Math.min(sourceResearchCandles.length, Math.round(maxResearchCandles)))
    : sourceResearchCandles.length;
  const researchCandles = sourceResearchCandles.slice(
    Math.max(0, sourceResearchCandles.length - boundedResearchCandleCount)
  );
  // Recognition on mock/sample candles is not research evidence. Any cycle
  // that would run on mock data fails closed with an actionable blocker.
  const mockDataBlockedReason =
    activeResearchCandleSource.sourceMode === "mock" || researchCandles.length === 0
      ? researchCandles.length === 0
        ? "No research candles are available from the active source."
        : "The active research source is mock/sample data, which cannot produce research evidence."
      : undefined;
  const dataSourceLabel = activeResearchCandleSource.sourceLabel;
  const evidenceDataMode = evidenceDataModeFor(activeResearchCandleSource.sourceMode, activeCandleSource.mode);
  const latestResearchCandle = researchCandles[researchCandles.length - 1];
  const sourceAlignedConfig = activeResearchUsesExternalReadOnly && latestResearchCandle
    ? sanitizeBacktestConfig({
        ...baseActiveConfig,
        symbol: latestResearchCandle.symbol,
        timeframe: latestResearchCandle.timeframe
      })
    : activeCandleSource.metadata
      ? sanitizeBacktestConfig({
          ...baseActiveConfig,
          symbol: activeCandleSource.metadata.symbol,
          timeframe: activeCandleSource.appliedSettings.targetTimeframe
        })
      : baseActiveConfig;
  const activeFrozenProfile = getFrozenResearchProfile(sourceAlignedConfig.strategyProfile);
  const activeConfig = activeFrozenProfile
    ? sanitizeBacktestConfig({
        ...sourceAlignedConfig,
        strategyProfile: activeFrozenProfile.profileId,
        warmupCandles: activeFrozenProfile.frozenParameters.warmupCandles,
        decisionInterval: activeFrozenProfile.frozenParameters.decisionInterval,
        maxBarsToResolveTrade: activeFrozenProfile.frozenParameters.maxBarsToResolveTrade,
        visibleWindow: activeFrozenProfile.frozenParameters.visibleWindow,
        targetRMultiple: activeFrozenProfile.frozenParameters.minimumRR,
        allowLong: activeFrozenProfile.frozenParameters.allowLong,
        allowShort: activeFrozenProfile.frozenParameters.allowShort
      })
    : sourceAlignedConfig;
  const run: ResearchCycleRun = {
    cycleId,
    startedAt: now(),
    status: "running",
    steps,
    llmBridgeAvailable: false,
    activeCalibrationId: activeResearchConfig.activeCalibrationId,
    activeCalibrationApprovedAt: activeResearchConfig.activeResearchCalibration?.approvedAt,
    activeCalibrationApplied: activeResearchConfig.activeCalibrationApplied,
    activeCalibrationPatch: activeResearchConfig.appliedPatch,
    activeCalibrationMergeStatus: activeResearchConfig.mergeStatus,
    activeCalibrationMergeLabel: activeResearchConfig.mergeStatusLabel,
    activeCalibrationMergeError: activeResearchConfig.mergeError,
    activeCalibrationSourceTrace: activeResearchConfig.sourceTrace,
    defaultConfluenceThreshold: activeResearchConfig.defaultConfluenceThreshold,
    savedConfluenceThreshold: activeResearchConfig.savedConfluenceThreshold,
    finalBacktestConfluenceThreshold: activeResearchConfig.finalBacktestConfluenceThreshold,
    activeConfluenceThreshold: activeConfig.minimumConfluenceThreshold,
    dataSourceMode: activeResearchCandleSource.sourceMode,
    dataSourceLabel,
    rawCandleCount: activeResearchUsesExternalReadOnly ? activeResearchCandleSource.identity.candleCount : activeCandleSource.rawCandleCount,
    researchWindowCandles: researchCandles.length,
    processedCandleCount: researchCandles.length,
    researchTimeframe: activeConfig.timeframe,
    performanceMode: activeCandleSource.performanceMode,
    researchPreset,
    advancedFullResearchMode,
    effectiveSearchMode,
    effectiveMaxCandidateCount,
    heavyAuditSkipped,
    candleWindowSettings: activeCandleSource.appliedSettings,
    candleWindowWarnings: [
      ...activeCandleSource.warnings,
      ...(researchCandles.length < sourceResearchCandles.length
        ? [`Responsive cycle window: latest ${researchCandles.length.toLocaleString()} of ${sourceResearchCandles.length.toLocaleString()} active-source candles.`]
        : []),
      ...(activeResearchUsesExternalReadOnly
        ? [
            `Research source is ${activeResearchCandleSource.sourceMode.replace(/_/g, " ")} read-only candles. First ${activeResearchCandleSource.identity.firstTimestamp ?? "n/a"} / ${activeResearchCandleSource.identity.firstClose ?? "n/a"}; last ${activeResearchCandleSource.identity.lastTimestamp ?? "n/a"} / ${activeResearchCandleSource.identity.lastClose ?? "n/a"}. Not broker truth and no execution authority.`
          ]
        : []),
      ...hardLimitWarnings,
      ...(activeCandleSource.mode === "mock"
        ? [`Current data source is Mock. Not valid for imported MNQ comparison. ${importActivation?.message ?? ""}`.trim()]
        : [])
    ],
    sourceMetadata: sourceMetadataFor({ activeResearchCandleSource, mt5ReadOnlyFeed, tradingViewChartFeed }),
    nextRecommendedAction: "Research cycle is running.",
    resultSummary: "Research cycle is running.",
    safetyNotice: "Research cycle only. Broker execution remains disabled."
  };

  const snapshot = () => ({ ...run, steps: steps.map((step) => ({ ...step })) });
  let cycleMarketAnalysisContext: IctMarketAnalysisContext | undefined;
  const notify = () => notifyResearchCycleObserver(onUpdate, snapshot());
  const setStep = (stepId: ResearchCycleStepId, patch: Partial<ResearchCycleStepResult>) => {
    steps = steps.map((step) => (step.stepId === stepId ? { ...step, ...patch } : step));
    run.steps = steps;
    notify();
  };
  const startStep = (stepId: ResearchCycleStepId) => setStep(stepId, { status: "running", startedAt: now() });
  const passStep = (
    stepId: ResearchCycleStepId,
    patch: Partial<ResearchCycleStepResult> & Pick<ResearchCycleStepResult, "summary">
  ) => setStep(stepId, { status: "passed", completedAt: now(), ...patch });
  const warnStep = (
    stepId: ResearchCycleStepId,
    patch: Partial<ResearchCycleStepResult> & Pick<ResearchCycleStepResult, "summary" | "warning">
  ) => setStep(stepId, { status: "warning", completedAt: now(), ...patch });
  const failStep = (stepId: ResearchCycleStepId, message: string) => {
    setStep(stepId, {
      status: "failed",
      completedAt: now(),
      summary: "Step failed.",
      error: message
    });
    run.failedStepId = stepId;
    run.failedStepDetails = message;
  };
  const skipStep = (stepId: ResearchCycleStepId, summary: string, detail?: string) =>
    setStep(stepId, { status: "skipped", completedAt: now(), summary, detail });

  notify();

  if (sourceGuardIssue) {
    const message = `${sourceGuard?.messagePrefix ?? "Research cycle blocked"}: ${sourceGuardIssue}`;
    failStep("thesis_generation", message);
    skipStep("backtest", "Backtest skipped because the active research source did not pass the source guard.");
    skipStep("llm_advisory", "LLM advisory skipped because the active research source did not pass the source guard.");
    skipStep("auto_research", "Auto Research skipped because the active research source did not pass the source guard.");
    skipStep("validation", "Validation skipped because the active research source did not pass the source guard.");
    skipStep("walk_forward", "Walk-forward skipped because the active research source did not pass the source guard.");
    skipStep("research_quality", "Research quality skipped because the active research source did not pass the source guard.");
    skipStep("self_improvement", "Self-improvement skipped because the active research source did not pass the source guard.");
    skipStep("simulation_verification", "Simulation runbook update skipped because the active research source did not pass the source guard.");
    skipStep("readiness_gate", "Readiness skipped because the active research source did not pass the source guard.");
    skipStep("communications_audit", "Communications audit skipped because the active research source did not pass the source guard.");
    run.status = "failed";
    run.completedAt = now();
    run.nextRecommendedAction = "Select and verify an eligible canonical research source, then rerun the research cycle.";
    run.resultSummary = resultSummaryFor(run);
    await persistTradePlanCycleSafely(run, researchCandles);
    saveResearchCycleRun(snapshot());
    return snapshot();
  }

  if (importedExpectedButMissing) {
    failStep(
      "thesis_generation",
      `Imported data is expected but not active. ${importActivation?.message ?? "Reactivate the imported dataset on Market Data before running imported-data research."}`
    );
    skipStep("backtest", "Backtest skipped because imported data is not active.");
    skipStep("llm_advisory", "LLM advisory skipped because imported data is not active.");
    skipStep("auto_research", "Auto Research skipped because imported data is not active.");
    skipStep("validation", "Validation skipped because imported data is not active.");
    skipStep("walk_forward", "Walk-forward skipped because imported data is not active.");
    skipStep("research_quality", "Research quality skipped because imported data is not active.");
    skipStep("self_improvement", "Self-improvement skipped because imported data is not active.");
    skipStep("simulation_verification", "Simulation runbook update skipped because imported data is not active.");
    skipStep("readiness_gate", "Readiness skipped because imported data is not active.");
    skipStep("communications_audit", "Communications audit skipped because imported data is not active.");
    run.status = "failed";
    run.completedAt = now();
    run.nextRecommendedAction = "Reactivate an imported dataset on Market Data, or re-import MNQ historical data, then rerun the research cycle.";
    run.resultSummary = resultSummaryFor(run);
    await persistTradePlanCycleSafely(run, researchCandles);
    saveResearchCycleRun(snapshot());
    return snapshot();
  }

  if (hardLimitWarnings.length) {
    failStep(
      "thesis_generation",
      `Imported historical dataset exceeds dashboard safe limits. ${hardLimitWarnings.join(" ")} Enable Advanced full research mode intentionally, or use the Safe preset: latest 500 raw candles aggregated to 5m.`
    );
    skipStep("backtest", "Backtest skipped because imported-data limits were exceeded.");
    skipStep("llm_advisory", "LLM advisory skipped because imported-data limits were exceeded.");
    skipStep("auto_research", "Auto Research skipped because imported-data limits were exceeded.");
    skipStep("validation", "Validation skipped because imported-data limits were exceeded.");
    skipStep("walk_forward", "Walk-forward skipped because imported-data limits were exceeded.");
    skipStep("research_quality", "Research quality skipped because imported-data limits were exceeded.");
    skipStep("self_improvement", "Self-improvement skipped because imported-data limits were exceeded.");
    skipStep("simulation_verification", "Simulation runbook update skipped because imported-data limits were exceeded.");
    skipStep("readiness_gate", "Readiness skipped because imported-data limits were exceeded.");
    skipStep("communications_audit", "Communications audit skipped because imported-data limits were exceeded.");
    run.status = "failed";
    run.completedAt = now();
    run.nextRecommendedAction =
      "Use the dashboard Safe preset or enable Advanced full research mode only when intentionally stress-testing large imported datasets.";
    run.resultSummary = resultSummaryFor(run);
    await persistTradePlanCycleSafely(run, researchCandles);
    saveResearchCycleRun(snapshot());
    return snapshot();
  }

  if (mockDataBlockedReason) {
    const message = `Research cycle blocked: ${mockDataBlockedReason} Activate MT5 read-only research mode or import historical candles, then rerun.`;
    failStep("thesis_generation", message);
    skipStep("backtest", "Backtest skipped because mock/sample data cannot produce research evidence.");
    skipStep("llm_advisory", "LLM advisory skipped because mock/sample data cannot produce research evidence.");
    skipStep("auto_research", "Auto Research skipped because mock/sample data cannot produce research evidence.");
    skipStep("validation", "Validation skipped because mock/sample data cannot produce research evidence.");
    skipStep("walk_forward", "Walk-forward skipped because mock/sample data cannot produce research evidence.");
    skipStep("research_quality", "Research quality skipped because mock/sample data cannot produce research evidence.");
    skipStep("self_improvement", "Self-improvement skipped because mock/sample data cannot produce research evidence.");
    skipStep("simulation_verification", "Simulation runbook update skipped because mock/sample data cannot produce research evidence.");
    skipStep("readiness_gate", "Readiness skipped because mock/sample data cannot produce research evidence.");
    skipStep("communications_audit", "Communications audit skipped because mock/sample data cannot produce research evidence.");
    run.status = "failed";
    run.completedAt = now();
    run.nextRecommendedAction =
      "Activate MT5 read-only research mode (Advisor > Activate Market) or import historical candles on Market Data, then rerun the research cycle.";
    run.resultSummary = resultSummaryFor(run);
    await persistTradePlanCycleSafely(run, researchCandles);
    saveResearchCycleRun(snapshot());
    return snapshot();
  }

  try {
    startStep("thesis_generation");
    await yieldToBrowser();
    throwIfCanceled();
    let generatedThesis: ReturnType<typeof generateThesis> | undefined;
    let structuredDebateSession: AgentDebateSession | undefined;
    let latestSelfImprovementProposal: CalibrationProposal | undefined;
    try {
      generatedThesis = generateThesis(thesisInputFor(activeConfig, cycleId), workingState, researchCandles);
      structuredDebateSession = runAgentDebateSession({
        thesis: generatedThesis.thesis,
        sourceDebate: generatedThesis.debateSession,
        mode: "deterministic_fallback",
        roundCount: 2,
        consensusThreshold: 3
      });
      saveAgentDebateSession(structuredDebateSession);
      workingState = {
        ...workingState,
        debateSessions: [generatedThesis.debateSession, ...safeArray(workingState.debateSessions)],
        tradeTheses: [generatedThesis.thesis, ...safeArray(workingState.tradeTheses)],
        recommendations: [...generatedThesis.recommendations, ...safeArray(workingState.recommendations)]
      };
      labStorage.save(workingState);
      run.thesisSummary = summarizeThesis(generatedThesis.thesis, generatedThesis.debateSession.id);
      const regimeClassification = generatedThesis.thesis.regimeClassification;
      if (regimeClassification) {
        run.regimeSummary = {
          label: regimeClassification.stableLabel,
          instantaneousLabel: regimeClassification.instantaneousLabel,
          stableLabel: regimeClassification.stableLabel,
          confidence: regimeClassification.confidence,
          dataQuality: regimeClassification.dataQuality,
          transitionPending: regimeClassification.transitionPending,
          candleCount: regimeClassification.candleCount,
          requiredCandleCount: 100,
          missingInputs: regimeClassification.missingInputs,
          supportingFactors: safeTopN(regimeClassification.supportingFactors, 6),
          warnings: safeTopN(regimeClassification.warnings, 6),
          sourceFingerprint: regimeClassification.sourceFingerprint
        };
      }
      run.agentDebateConsensus = summarizeAgentDebateConsensus(structuredDebateSession);

      // Unified recognition path: run the ICT Strategy Suite advisor engine on
      // the same runtime source so the Lab cycle and the Advisor reason about
      // the same setups (signal, approved profile decision, recognition).
      if (!mockDataBlockedReason) {
        try {
          const runtimeSnapshot = await resolveResearchRuntimeSnapshot({ labState: workingState });
          const marketAnalysisContextBundle =
            activeResearchCandleSource.sourceMode === "mt5_read_only"
              ? await buildIctMarketAnalysisContextBundle({ snapshot: runtimeSnapshot })
              : undefined;
          cycleMarketAnalysisContext = marketAnalysisContextBundle?.context;
          const advisorPacket: IctAdvisorPacket = await buildIctAdvisorPacketFromRuntime(runtimeSnapshot, {
            marketAnalysisContextBundle
          });
          const recommended = advisorPacket.recommendedSignal;
          run.ictAdvisorSignalSummary = {
            packetId: advisorPacket.packetId,
            generatedAt: advisorPacket.generatedAt,
            strategyId: recommended.strategyId,
            setup: recommended.setup,
            side: recommended.side,
            decision: recommended.decision,
            confidence: recommended.confidence,
            compositeBias: recommended.bias.composite,
            approvedProfileStatus: advisorPacket.compactSummary?.approvedProfileStatus,
            approvalScore: advisorPacket.compactSummary?.approvalScore,
            entryZoneMidpoint: recommended.entryZone?.midpoint,
            target: recommended.target,
            invalidation: recommended.invalidation,
            rrEstimate: recommended.rrEstimate,
            scalpStatus: advisorPacket.compactSummary.scalpStatus,
            summary: recommended.summary,
            noTradeReasons: safeTopN(recommended.noTradeReasons, 6),
            universalRecognitionLabel: advisorPacket.universalRecognition
              ? `${advisorPacket.universalRecognition.tier.replace(/_/g, " ")}: ${advisorPacket.universalRecognition.opportunitySummary}`
              : undefined,
            alignsWithThesis:
              recommended.side === "flat"
                ? generatedThesis.thesis.finalBias === "neutral"
                : (recommended.side === "long" && generatedThesis.thesis.finalBias === "bullish") ||
                  (recommended.side === "short" && generatedThesis.thesis.finalBias === "bearish"),
            sourceFingerprint: advisorPacket.activeSource?.sourceFingerprint
          };
        } catch (advisorError) {
          run.candleWindowWarnings = [
            ...(run.candleWindowWarnings ?? []),
            `ICT advisor signal engine could not run on the research source: ${
              advisorError instanceof Error ? advisorError.message : "unknown error"
            }`
          ];
        }
      }

      const advisorAlignmentNote = run.ictAdvisorSignalSummary
        ? ` Advisor engine: ${run.ictAdvisorSignalSummary.setup} ${run.ictAdvisorSignalSummary.side} (${run.ictAdvisorSignalSummary.decision}), ${
            run.ictAdvisorSignalSummary.alignsWithThesis ? "aligned with" : "diverging from"
          } the CIO thesis.`
        : "";
      passStep("thesis_generation", {
        summary: `${generatedThesis.thesis.symbol} ${generatedThesis.thesis.timeframe} thesis generated: ${generatedThesis.thesis.finalBias}.`,
        detail: `ICT ${generatedThesis.thesis.ictContext.bias}, confluence ${Math.round(generatedThesis.thesis.ictContext.confluenceScore * 100)}%, CIO confidence ${Math.round(generatedThesis.thesis.confidence * 100)}%. Debate consensus ${structuredDebateSession.moderatorOutput.consensusReached ? structuredDebateSession.moderatorOutput.position : "flat/no consensus"}. Active confluence threshold ${(activeConfig.minimumConfluenceThreshold * 100).toFixed(0)}%. Data source: ${dataSourceLabel}.${advisorAlignmentNote}`
      });
    } catch (error) {
      failStep("thesis_generation", error instanceof Error ? error.message : "Research thesis generation failed.");
    }

    if (!generatedThesis) {
      skipStep("backtest", "Backtest skipped because thesis generation failed.");
      skipStep("llm_advisory", "LLM advisory skipped because thesis generation failed.");
      skipStep("auto_research", "Auto Research skipped because thesis generation failed.");
      skipStep("validation", "Validation skipped because thesis generation failed.");
      skipStep("walk_forward", "Walk-forward skipped because thesis generation failed.");
      skipStep("research_quality", "Research quality skipped because thesis generation failed.");
      skipStep("self_improvement", "Self-improvement skipped because thesis generation failed.");
      skipStep("simulation_verification", "Simulation runbook update skipped because thesis generation failed.");
      skipStep("readiness_gate", "Readiness skipped because thesis generation failed.");
      run.status = "failed";
      run.completedAt = now();
      run.nextRecommendedAction = nextActionFor(run);
      run.resultSummary = resultSummaryFor(run);
      await persistTradePlanCycleSafely(run, researchCandles);
      saveResearchCycleRun(snapshot());
      return snapshot();
    }

    startStep("backtest");
    await yieldToBrowser();
    throwIfCanceled();
    let backtestResult: BacktestResult | undefined;
    try {
      backtestResult = await runDetectorProfileBacktest({
        candles: researchCandles,
        config: activeConfig,
        signal,
        timeoutMs: autoResearchTimeoutMs ?? 120_000
      });
      run.backtestSummary = summarizeBacktest(backtestResult);
      // Edge auditor waits for walk-forward OOS; do not use in-sample backtest edge here.
      if (backtestResult.summary.totalTrades === 0) {
        run.backtestDiagnostics = diagnoseTradeGeneration({
          candles: researchCandles,
          config: backtestResult.config,
          result: backtestResult,
          thesis: generatedThesis.thesis
        });
        const topDiagnostic = topTradeGenerationDiagnostic(run.backtestDiagnostics);
        warnStep("backtest", {
          summary: "No trades generated. Strategy cannot be evaluated from this backtest yet.",
          warning:
            topDiagnostic?.explanation ??
            (skipAutoResearch
              ? "No simulated trades were generated. Candidate recovery is deferred in the crash-safe cycle mode."
              : "No simulated trades were generated. Auto Research will try bounded trade-generation recovery."),
          detail: topDiagnostic
            ? `${topDiagnostic.reasonCode.replace(/_/g, " ")}: ${topDiagnostic.suggestedFix} ${skipAutoResearch ? "Recovery search was deferred for cycle stability." : "Bounded recovery remains available in Auto Research."} Active threshold used ${(activeConfig.minimumConfluenceThreshold * 100).toFixed(0)}%; data source: ${dataSourceLabel}; config merge: ${activeResearchConfig.mergeStatusLabel}. ${activeResearchConfig.mergeError ?? ""}`.trim()
            : `${skipAutoResearch ? "Recovery search was deferred for cycle stability." : "Auto Research will try threshold, session, direction, stop-model, and resolution-window recovery candidates."} Active threshold used ${(activeConfig.minimumConfluenceThreshold * 100).toFixed(0)}%; data source: ${dataSourceLabel}; config merge: ${activeResearchConfig.mergeStatusLabel}. ${activeResearchConfig.mergeError ?? ""}`.trim()
        });
      } else {
        run.tradeQualityDiagnostics = diagnoseTradeQuality({ result: backtestResult });
        passStep("backtest", {
          summary: `Backtest completed with ${backtestResult.summary.totalTrades} simulated trades.`,
          detail: `Win rate ${Math.round(backtestResult.summary.winRate * 100)}%, average R ${backtestResult.summary.averageR.toFixed(2)}, max drawdown ${backtestResult.summary.maxDrawdown.toFixed(2)}R. Active confluence threshold ${(activeConfig.minimumConfluenceThreshold * 100).toFixed(0)}%. Data source: ${dataSourceLabel}.`
        });
      }
    } catch (error) {
      const fallbackMessage =
        activeCandleSource.mode === "imported"
          ? "Historical dataset was too large for browser processing. Reduce research window or aggregate to 5m/15m."
          : "Backtest failed. Check active Backtest Lab config and mock candle data.";
      const details = error instanceof Error ? error.message : fallbackMessage;
      failStep(
        "backtest",
        activeCandleSource.mode === "imported"
          ? `${fallbackMessage} Details: ${details}`
          : `Backtest failed: ${details}`
      );
    }

    if (!backtestResult) {
      skipStep("llm_advisory", "LLM advisory skipped because backtest failed.");
      skipStep("auto_research", "Auto Research skipped because backtest failed; candidate scoring stopped.");
      skipStep("validation", "Validation skipped because backtest failed.");
      skipStep("walk_forward", "Walk-forward skipped because backtest failed.");
      skipStep("research_quality", "Research quality skipped because validation did not run.");
      skipStep("self_improvement", "Self-improvement skipped because Auto Research did not run.");
      skipStep("simulation_verification", "Simulation runbook update skipped because pipeline failed before validation.");
      skipStep("readiness_gate", "Readiness skipped because backtest failed.");
      run.status = "failed";
      run.completedAt = now();
      run.nextRecommendedAction = nextActionFor(run);
      run.resultSummary = resultSummaryFor(run);
      await persistTradePlanCycleSafely(run, researchCandles);
      saveResearchCycleRun(snapshot());
      return snapshot();
    }

    // LLM advisory review now runs after validation/quality/readiness so the
    // packet carries real results instead of undefined placeholders.

    const cycleForwardScenarioMap = buildForwardScenarioMap({
      timestamp: run.startedAt,
      sourceProvider: activeResearchCandleSource.sourceMode,
      requestedSymbol: generatedThesis.thesis.symbol,
      brokerSymbol: activeCandleSource.metadata?.symbol ?? generatedThesis.thesis.symbol,
      timeframe: generatedThesis.thesis.timeframe,
      sourceFingerprint: activeResearchCandleSource.canonicalFingerprint,
      regime: generatedThesis.thesis.regimeClassification?.stableLabel ?? generatedThesis.thesis.marketRegime,
      evidenceQuality: generatedThesis.thesis.confidence * 100,
      direction: generatedThesis.thesis.finalBias,
      confirmedSetup: false,
      liquidityDraw: `Conditional liquidity objective ${generatedThesis.thesis.targetLiquidity}`,
      liquidityDrawDirection: generatedThesis.thesis.finalBias,
      liquiditySwept: generatedThesis.thesis.ictContext.liquiditySweep,
      mitigationDetected: false,
      displacementConfirmed: generatedThesis.thesis.ictContext.displacement === "strong",
      premiumDiscountContext: generatedThesis.thesis.ictContext.premiumDiscount,
      ifvgFreshRetestState: generatedThesis.thesis.ictContext.fairValueGap === "none" ? "absent" : "partial",
      ifvgDirection:
        generatedThesis.thesis.ictContext.fairValueGap === "bullish"
          ? "bullish"
          : generatedThesis.thesis.ictContext.fairValueGap === "bearish"
            ? "bearish"
            : "neutral",
      ifvgZone: {
        lower: Math.min(...generatedThesis.thesis.simulatedTradePlan.entryZone),
        upper: Math.max(...generatedThesis.thesis.simulatedTradePlan.entryZone)
      },
      ifvgProfileStrength: "unvalidated",
      conditionalEntryZone: {
        lower: Math.min(...generatedThesis.thesis.simulatedTradePlan.entryZone),
        upper: Math.max(...generatedThesis.thesis.simulatedTradePlan.entryZone)
      },
      conditionalStopReference: generatedThesis.thesis.invalidationLevel,
      conditionalTargets: [{ label: "Conditional thesis liquidity target", price: generatedThesis.thesis.targetLiquidity }],
      missingConfirmations: [
        generatedThesis.thesis.ictContext.liquiditySweep ? undefined : "Liquidity sweep is not confirmed.",
        generatedThesis.thesis.ictContext.displacement === "strong" ? undefined : "Strong displacement is not confirmed.",
        generatedThesis.thesis.ictContext.fairValueGap === "none" ? "A qualifying FVG is not confirmed." : "A fresh FVG retest is not confirmed."
      ].filter((item): item is string => Boolean(item)),
      blockers: generatedThesis.thesis.finalBias === "neutral" ? ["Directional thesis is neutral."] : [],
      warnings: [generatedThesis.thesis.riskNotes]
    });

    const sourceIsEligibleForPrediction =
      Boolean(activeResearchCandleSource.canonicalFingerprint) &&
      !/mock|sample/i.test(activeResearchCandleSource.sourceMode);
    if (sourceIsEligibleForPrediction) {
      recordForwardScenarioPrediction(cycleForwardScenarioMap, {
        modelVersion: activeConfig.strategyProfile ?? "research_cycle:v1",
        maxBarsToResolve: 48
      });
      if (activeResearchCandleSource.sourceMode === "mt5_read_only" && generatedThesis.thesis.timeframe.toLowerCase() === "5m") {
        const latestClosedTimestamp = researchCandles.at(-1)?.timestamp;
        if (latestClosedTimestamp) {
          recordFrozenMarketEpisodeProfileObservationsFromClosedCandle({
            candles: researchCandles,
            closedCandleTimestamp: latestClosedTimestamp,
            sourceProvider: activeResearchCandleSource.sourceMode,
            requestedSymbol: generatedThesis.thesis.symbol,
            brokerSymbol: activeCandleSource.metadata?.symbol ?? generatedThesis.thesis.symbol,
            timeframe: generatedThesis.thesis.timeframe,
            sourceFingerprint: activeResearchCandleSource.canonicalFingerprint
          });
        }
      }
    }

    startStep("auto_research");
    await yieldToBrowser();
    throwIfCanceled();
    let autoResearchCycle: AutoResearchCycle | undefined;
    if (skipAutoResearch) {
      skipStep(
        "auto_research",
        "Auto Research candidate search deferred for autonomous stability mode."
      );
    } else {
    try {
      autoResearchCycle = await runAutoResearchCycle({
        searchMode: effectiveSearchMode,
        maxCandidateCount: effectiveMaxCandidateCount,
        maxAdaptivePasses: effectiveMaxAdaptivePasses,
        createProposal: true,
        candles: researchCandles,
        baselineConfig: activeConfig,
        dataSource: dataSourceLabel,
        candleWindow: `${activeCandleSource.researchWindowCandles} raw window / ${activeCandleSource.processedCandleCount} processed ${activeCandleSource.appliedSettings.targetTimeframe} candles`,
        activeCalibrationIdUsed: activeResearchConfig.activeCalibrationId,
        forwardScenarioMap: cycleForwardScenarioMap,
        researchIdentity: {
          strategyProfile: activeConfig.strategyProfile,
          sourceProvider: activeResearchCandleSource.sourceMode,
          requestedSymbol: mt5ReadOnlyFeed?.requestedSymbol ?? generatedThesis.thesis.symbol,
          brokerSymbol:
            mt5ReadOnlyFeed?.brokerSymbol ??
            activeCandleSource.metadata?.symbol ??
            generatedThesis.thesis.symbol,
          timeframe: generatedThesis.thesis.timeframe,
          sourceFingerprint: activeResearchCandleSource.canonicalFingerprint,
          parameterFingerprint: fingerprintValidationParameters(activeConfig)
        },
        signal,
        timeoutMs: autoResearchTimeoutMs ?? (activeCandleSource.mode === "imported" && !advancedFullResearchMode ? 25_000 : 45_000),
        checkpointPersistence: autoResearchCheckpointPersistence,
        onCandidateEvaluated: (progress) => {
          run.candidateProgress = progress;
          setStep("auto_research", {
            status: "running",
            summary: `Pass ${progress.passNumber ?? 1}/${progress.totalPasses ?? 1}: candidate ${progress.currentCandidate}/${progress.totalCandidates}: ${progress.candidateLabel}.`,
            detail: progress.bestCandidateLabel
              ? `Best so far: ${progress.bestCandidateLabel} (${progress.bestCandidateCategory}, score ${progress.bestCandidateScore}). Targeting: ${
                  safeArray(progress.failedGatesTargeted).length
                    ? safeArray(progress.failedGatesTargeted).map((gate) => gate.replace(/_/g, " ")).join(", ")
                    : "initial bounded search"
                }.`
              : "No stable best candidate selected yet."
          });
        },
        onCheckpoint: (checkpoint) => {
          run.autoResearchCheckpoint = checkpoint;
          run.candidateProgress = {
            currentCandidate: checkpoint.currentCandidate,
            totalCandidates: checkpoint.totalCandidates,
            passNumber: checkpoint.currentPass,
            totalPasses: checkpoint.totalPasses,
            passLabel: checkpoint.phase,
            candidateId: checkpoint.bestCandidateId ?? checkpoint.cycleId,
            candidateLabel: checkpoint.currentCandidateName ?? checkpoint.phase,
            candidateScore: checkpoint.bestCandidateScore ?? 0,
            bestCandidateId: checkpoint.bestCandidateId,
            bestCandidateLabel: checkpoint.bestCandidateLabel,
            bestCandidateScore: checkpoint.bestCandidateScore,
            bestCandidateCategory: checkpoint.bestCandidateCategory
          };
          notify();
        }
      });
      run.autoResearchCycle = autoResearchCycle;
      run.createdProposalId = autoResearchCycle.createdProposalId;
      run.latestGeneratedProposal = autoResearchCycle.createdProposal;
      run.bestCandidateSummary = summarizeCandidate(autoResearchCycle.bestCandidate);
      if (autoResearchCycle.status === "failed") {
        failStep("auto_research", autoResearchCycle.error ?? "Auto Research cycle failed.");
      } else {
        passStep("auto_research", {
          summary: autoResearchCycle.bestCandidate
            ? `Best candidate: ${autoResearchCycle.bestCandidate.label}.`
            : "Auto Research completed without a viable best candidate.",
          detail: autoResearchCycle.noSafePaperDemoCandidateFound
            ? autoResearchCycle.recoveryAttempted
              ? `${safeArray(autoResearchCycle.adaptivePasses).length || 1} adaptive pass${safeArray(autoResearchCycle.adaptivePasses).length === 1 ? "" : "es"} plus recovery completed. Trades after recovery: ${autoResearchCycle.tradesAfterRecovery ?? 0}. Continue research.`
              : `${safeArray(autoResearchCycle.adaptivePasses).length || 1} adaptive pass${safeArray(autoResearchCycle.adaptivePasses).length === 1 ? "" : "es"} completed. No safe Paper-Demo Candidate found. Continue research.`
            : `${safeArray(autoResearchCycle.adaptivePasses).length || 1} adaptive pass${safeArray(autoResearchCycle.adaptivePasses).length === 1 ? "" : "es"} completed. Final category: ${autoResearchCycle.finalResultCategory}.`
        });
      }
    } catch (error) {
      const message =
        activeCandleSource.mode === "imported"
          ? "Auto Research exceeded browser-safe processing limits. Keep the Safe preset or reduce search depth."
          : "Auto Research failed.";
      warnStep("auto_research", {
        summary: "Auto Research failed safely; downstream validation will continue where possible.",
        warning: `${message} ${error instanceof Error ? error.message : ""}`.trim()
      });
    }
    }

    startStep("validation");
    await yieldToBrowser();
    throwIfCanceled();
    let validationReport: ValidationSuiteReport | undefined;
    let detectorEvidenceContext:
      | {
          baseline: BacktestResult;
          candles: typeof researchCandles;
          sourceProvider: string;
          sourceFingerprint: string;
          sourceLabel: string;
          brokerSymbol?: string;
          requestedLookbackDays: number;
          availableLookbackDays: number;
          rawCandleCount: number;
          processedCandleCount: number;
        }
      | undefined;
    try {
      const frozenProfile = getFrozenResearchProfile(activeConfig.strategyProfile);
      const validationConfig = frozenProfile
        ? applyFrozenResearchProfileConfig(activeConfig)
        : activeConfig;
      let validationCandles = researchCandles;
      let validationSourceProvider: string = activeResearchCandleSource.sourceMode;
      let validationSourceFingerprint = activeResearchCandleSource.canonicalFingerprint;
      let validationSourceLabel = activeResearchCandleSource.sourceLabel;
      let validationBrokerSymbol = mt5ReadOnlyFeed?.brokerSymbol;

      if (frozenProfile && activeResearchCandleSource.sourceMode === "mt5_read_only") {
        setStep("validation", {
          status: "running",
          summary: `Loading explicit ${frozenProfile.historicalValidationDays}-day MT5 history for the frozen detector profile.`
        });
        const deepSource = await loadPreparedCanonicalWalkForwardCandleSource({
          windowMode: "latest",
          windowSize: 50000,
          targetTimeframe: "5m",
          sessionFilter: "all",
          advancedMode: true
        }, {
          allowMt5DeepHistory: true,
          requestedLookbackDays: frozenProfile.historicalValidationDays
        });
        const cutoff = Date.parse(frozenProfile.validationCutoff);
        const historicalCandles = deepSource.candles.filter((candle) => {
          const timestamp = Date.parse(candle.timestamp);
          return Number.isFinite(timestamp) && (!Number.isFinite(cutoff) || timestamp <= cutoff);
        });
        if (historicalCandles.length >= 5_000) {
          validationCandles = historicalCandles;
          validationSourceProvider = deepSource.provider;
          validationSourceLabel = `${deepSource.label} / frozen through ${frozenProfile.validationCutoff}`;
          validationBrokerSymbol = deepSource.brokerSymbol ?? frozenProfile.brokerSymbol;
          validationSourceFingerprint = createCandleSourceFingerprint({
            candles: historicalCandles,
            provider: deepSource.provider,
            sourceId: `${frozenProfile.profileId}:${frozenProfile.validationCutoff}`,
            symbol: frozenProfile.requestedSymbol,
            timeframe: frozenProfile.timeframe
          });
          const firstTime = Date.parse(historicalCandles[0]?.timestamp ?? "");
          const lastTime = Date.parse(historicalCandles.at(-1)?.timestamp ?? "");
          const availableLookbackDays =
            Number.isFinite(firstTime) && Number.isFinite(lastTime)
              ? Math.max(0, (lastTime - firstTime) / 86_400_000)
              : 0;
          const baseline = await runDetectorProfileBacktest({
            candles: historicalCandles,
            config: validationConfig,
            signal
          });
          detectorEvidenceContext = {
            baseline,
            candles: historicalCandles,
            sourceProvider: deepSource.provider,
            sourceFingerprint: validationSourceFingerprint,
            sourceLabel: validationSourceLabel,
            brokerSymbol: validationBrokerSymbol,
            requestedLookbackDays: frozenProfile.historicalValidationDays,
            availableLookbackDays,
            rawCandleCount: deepSource.rawCandleCount,
            processedCandleCount: historicalCandles.length
          };
          run.validationEvidenceCandleCount = historicalCandles.length;
          run.validationEvidenceLookbackDays = availableLookbackDays;
          run.validationEvidenceRequestedLookbackDays = frozenProfile.historicalValidationDays;
          run.validationEvidenceSourceFingerprint = validationSourceFingerprint;
          run.candleWindowWarnings = [
            ...(run.candleWindowWarnings ?? []),
            `Frozen ${frozenProfile.profileId} validation used ${historicalCandles.length.toLocaleString()} compact MT5 candles across ${availableLookbackDays.toFixed(1)} days. The tactical current read remains ${researchCandles.length.toLocaleString()} candles.`
          ];
        } else {
          run.candleWindowWarnings = [
            ...(run.candleWindowWarnings ?? []),
            `Explicit MT5 history returned only ${historicalCandles.length.toLocaleString()} pre-cutoff candles; detector-specific validation stayed on the tactical source.`
          ];
        }
      }
      const cycleValidationProvenance = buildValidationProvenanceIdentity({
        strategyProfile: activeConfig.strategyProfile,
        strategyProfileVersion: frozenProfile?.profileVersion,
        proposalId: run.createdProposalId,
        candidateId: run.latestGeneratedProposal?.sourceCandidateId,
        sourceProvider: validationSourceProvider,
        requestedSymbol: mt5ReadOnlyFeed?.requestedSymbol ?? activeConfig.symbol,
        brokerSymbol: validationBrokerSymbol,
        timeframe: activeConfig.timeframe,
        sourceFingerprint: validationSourceFingerprint,
        parameterFingerprint: frozenProfile
          ? fingerprintValidationParameters(frozenProfile.frozenParameters)
          : fingerprintValidationParameters(activeConfig),
        detectorProfileFingerprint: frozenProfile
          ? fingerprintValidationParameters(frozenProfile.frozenParameters)
          : undefined,
        validationCutoff: frozenProfile?.validationCutoff,
        dataRangeStart: validationCandles[0]?.timestamp,
        dataRangeEnd: validationCandles.at(-1)?.timestamp
      });
      validationReport = await runValidationSuiteAsync(validationCandles, validationConfig, {
        signal,
        provenance: cycleValidationProvenance,
        baselineResult: detectorEvidenceContext?.baseline,
        onScenarioComplete: (completed, total, scenario) => {
          setStep("validation", {
            status: "running",
            summary: `Validation scenario ${completed}/${total}: ${scenario.name}.`
          });
        }
      });
      run.validationReport = validationReport;
      run.validationSummary = summarizeValidation(validationReport);
      saveLatestValidationReport(validationReport);
      if (backtestResult.summary.totalTrades > 0) {
        run.tradeQualityDiagnostics = diagnoseTradeQuality({ result: backtestResult, validation: validationReport });
      }
      passStep("validation", {
        summary: `Validation completed: ${validationReport.calibration.readinessStatus} readiness, score ${validationReport.calibration.readinessScore}.`,
        detail: `Strongest: ${validationReport.calibration.strongestScenario}; weakest: ${validationReport.calibration.weakestScenario}.`
      });
    } catch (error) {
      failStep("validation", error instanceof Error ? error.message : "Validation suite failed.");
    }

    startStep("walk_forward");
    await yieldToBrowser();
    throwIfCanceled();
    let cycleWalkForwardRun: Awaited<ReturnType<typeof runWalkForwardValidation>> | undefined;
    try {
      const frozenProfile = getFrozenResearchProfile(activeConfig.strategyProfile);
      if (frozenProfile && detectorEvidenceContext && validationReport?.provenance) {
        const tradeOutcomes = detectorEvidenceContext.baseline.trades.map((trade) => ({
          openedAt: trade.openedAt,
          rMultiple: trade.rMultiple,
          outcome: trade.outcome
        }));
        const detectorWalkForward = runDetectorProfileWalkForward({
          profileId: frozenProfile.profileId,
          sourceProvider: detectorEvidenceContext.sourceProvider,
          sourceFingerprint: detectorEvidenceContext.sourceFingerprint,
          sourceStart: detectorEvidenceContext.candles[0]?.timestamp ?? "",
          sourceEnd: detectorEvidenceContext.candles.at(-1)?.timestamp ?? "",
          proposalId: run.createdProposalId,
          candidateId: run.latestGeneratedProposal?.sourceCandidateId,
          requestedSymbol: frozenProfile.requestedSymbol,
          brokerSymbol: detectorEvidenceContext.brokerSymbol ?? frozenProfile.brokerSymbol,
          timeframe: frozenProfile.timeframe,
          parameterFingerprint: validationReport.provenance.parameterFingerprint,
          detectorProfileFingerprint: validationReport.provenance.detectorProfileFingerprint,
          validationRunId: validationReport.provenance.validationRunId,
          trades: tradeOutcomes
        });
        const developmentStart = Date.parse(detectorWalkForward.developmentEnd);
        const historicalEnd = Date.parse(detectorWalkForward.sourceEnd);
        const oosTrades = tradeOutcomes.filter((trade) => {
          const openedAt = Date.parse(trade.openedAt);
          return Number.isFinite(openedAt) && openedAt >= developmentStart && openedAt <= historicalEnd;
        });
        cycleWalkForwardRun = adaptDetectorProfileWalkForwardRun({
          result: detectorWalkForward,
          config: applyFrozenResearchProfileConfig(activeConfig),
          oosTrades,
          sourceLabel: detectorEvidenceContext.sourceLabel,
          rawCandleCount: detectorEvidenceContext.rawCandleCount,
          processedCandleCount: detectorEvidenceContext.processedCandleCount,
          availableLookbackDays: detectorEvidenceContext.availableLookbackDays,
          requestedLookbackDays: detectorEvidenceContext.requestedLookbackDays
        });
        saveWalkForwardRun(cycleWalkForwardRun);
      } else {
      cycleWalkForwardRun = await runWalkForwardValidation({
        mode: advancedFullResearchMode ? "standard" : "safe",
        maxWindows: advancedFullResearchMode ? 5 : 3,
        proposalId: run.createdProposalId,
        candidateId: run.latestGeneratedProposal?.sourceCandidateId,
        validationProvenance: validationReport?.provenance,
        configOverride: run.createdProposalId ? run.latestGeneratedProposal?.proposedConfig : activeConfig,
        signal,
        onProgress: (wfRun) => {
          setStep("walk_forward", {
            status: "running",
            summary: wfRun.progress?.message ?? `Walk-forward window ${wfRun.progress?.currentWindow ?? 0}/${wfRun.progress?.totalWindows ?? 0}.`,
            detail: wfRun.stability?.summary
          });
        }
      });
      }
      const oosEdge = cycleWalkForwardRun.stability?.edgeStatistics;
      run.edgeAuditorSummary = reviewEdgeStatistics(
        oosEdge?.provenance === "out_of_sample" ? oosEdge : undefined,
        cycleWalkForwardRun.stability?.verdict === "robust_research" ||
          cycleWalkForwardRun.stability?.verdict === "promising" ||
          cycleWalkForwardRun.stability?.verdict === "paper_demo_review_candidate"
      );
      if (
        cycleWalkForwardRun.status === "failed" ||
        cycleWalkForwardRun.preflight?.status === "blocked"
      ) {
        warnStep("walk_forward", {
          summary: "Walk-forward did not produce usable OOS edge evidence.",
          warning:
            cycleWalkForwardRun.preflight?.blockers?.[0]?.message ??
            cycleWalkForwardRun.stability?.summary ??
            "Walk-forward blocked or failed; readiness OOS gate will remain closed."
        });
      } else {
        passStep("walk_forward", {
          summary: `Walk-forward ${cycleWalkForwardRun.stability?.verdict?.replace(/_/g, " ") ?? cycleWalkForwardRun.status}.`,
          detail: oosEdge?.summary ?? cycleWalkForwardRun.stability?.summary ?? "OOS edge statistics recorded."
        });
      }
    } catch (error) {
      warnStep("walk_forward", {
        summary: "Walk-forward failed safely; readiness will require a successful OOS run.",
        warning: error instanceof Error ? error.message : "Walk-forward validation failed."
      });
    }

    try {
      const evidenceBacktest = detectorEvidenceContext?.baseline ?? backtestResult;
      const automatedEvidence = buildAndSaveAutomatedCycleEvidence({
        backtestResult: evidenceBacktest,
        cycleId: run.cycleId,
        generatedAt: now(),
        requestedSymbol: validationReport?.provenance?.requestedSymbol ?? generatedThesis.thesis.symbol,
        brokerSymbol:
          validationReport?.provenance?.brokerSymbol ??
          detectorEvidenceContext?.brokerSymbol ??
          mt5ReadOnlyFeed?.brokerSymbol ??
          generatedThesis.thesis.symbol,
        sourceProvider: activeResearchCandleSource.sourceMode,
        activeSourceFingerprint: activeResearchCandleSource.canonicalFingerprint,
        provenance: validationReport?.provenance,
        walkForwardRun: cycleWalkForwardRun,
        marketAnalysisContext: cycleMarketAnalysisContext
      });
      run.automatedEvidenceSummary = {
        replayOutcomeCount: automatedEvidence.outcomeCount,
        replayTargetFirstRate: automatedEvidence.replay.targetFirstRate ?? 0,
        monteCarloUsableOutcomes: automatedEvidence.monteCarlo.usableOutcomes,
        monteCarloRobustness: automatedEvidence.monteCarlo.robustnessRating,
        walkForwardVerdict: automatedEvidence.walkForward?.verdict,
        walkForwardOosTrades: automatedEvidence.walkForward?.tradeCount,
        walkForwardWindowsPassed: automatedEvidence.walkForward?.oosWindowsPassed,
        walkForwardWindowsTested: automatedEvidence.walkForward?.windowsTested,
        marketAnalysisDepthStatus: automatedEvidence.marketAnalysis?.context.analysisDepthStatus,
        marketAnalysisTimeframesLoaded: automatedEvidence.marketAnalysis?.context.analysisTimeframesLoaded,
        sourceFingerprint: activeResearchCandleSource.canonicalFingerprint,
        validationSourceFingerprint: validationReport?.provenance?.sourceFingerprint,
        researchOnly: true,
        authority: {
          executionAuthority: "none",
          brokerAuthority: "none",
          readinessOverrideAuthority: "none"
        }
      };
    } catch (error) {
      run.candleWindowWarnings = [
        ...(run.candleWindowWarnings ?? []),
        `Automated evidence persistence failed safely: ${error instanceof Error ? error.message : "unknown error"}. Manual replay and Monte Carlo remain available.`
      ];
    }

    const currentCandidateProfile =
      run.ictAdvisorSignalSummary &&
      run.ictAdvisorSignalSummary.side !== "flat" &&
      run.ictAdvisorSignalSummary.setup !== "no_trade"
        ? run.ictAdvisorSignalSummary.strategyId
        : undefined;
    run.historicalEvidenceContract = evaluateCycleHistoricalEvidence({
      tacticalIdentity: {
        strategyProfile: currentCandidateProfile,
        parameterFingerprint:
          currentCandidateProfile === activeConfig.strategyProfile
            ? fingerprintValidationParameters(activeFrozenProfile?.frozenParameters ?? activeConfig)
            : undefined,
        sourceProvider: activeResearchCandleSource.sourceMode,
        requestedSymbol: mt5ReadOnlyFeed?.requestedSymbol ?? activeConfig.symbol,
        brokerSymbol: mt5ReadOnlyFeed?.brokerSymbol ?? activeConfig.symbol,
        timeframe: activeConfig.timeframe,
        activeSourceFingerprint: activeResearchCandleSource.canonicalFingerprint
      },
      historicalIdentity: validationReport?.provenance,
      certificate: certifiedHistoricalEvidence
    });

    startStep("research_quality");
    await yieldToBrowser();
    throwIfCanceled();
    let researchQualityReview: ReturnType<typeof analyzeValidationResults> | undefined;
    if (!validationReport) {
      skipStep("research_quality", "Research quality skipped because validation did not produce a report.");
    } else {
      try {
        researchQualityReview = analyzeValidationResults(validationReport);
        saveLatestResearchQualityReview(researchQualityReview);
        run.researchQualityReview = researchQualityReview;
        run.researchQualitySummary = summarizeQuality(researchQualityReview);
        passStep("research_quality", {
          summary: `Research quality grade: ${researchQualityReview.readinessGrade}.`,
          detail: researchQualityReview.recommendedNextStep
        });
      } catch (error) {
        failStep("research_quality", error instanceof Error ? error.message : "Research quality review failed.");
      }
    }

    startStep("self_improvement");
    await yieldToBrowser();
    throwIfCanceled();
    let improvementState = loadSelfImprovementState();
    if (
      run.createdProposalId &&
      run.latestGeneratedProposal &&
      !safeArray(improvementState.proposals).some((proposal) => proposal.proposalId === run.createdProposalId)
    ) {
      improvementState = upsertCalibrationProposal(
        run.latestGeneratedProposal,
        "created",
        "Recovered proposal from the latest AI Research Cycle summary."
      );
    }
    const latestProposal =
      (run.createdProposalId
        ? safeArray(improvementState.proposals).find((proposal) => proposal.proposalId === run.createdProposalId)
        : undefined) ??
      safeArray(improvementState.proposals).find((proposal) => proposal.proposalId === improvementState.latestProposalId) ??
      safeArray(improvementState.proposals)[0];
    latestSelfImprovementProposal = latestProposal;
    run.latestGeneratedProposal =
      run.latestGeneratedProposal ??
      (run.createdProposalId
        ? safeArray(improvementState.proposals).find((proposal) => proposal.proposalId === run.createdProposalId)
        : undefined);
    run.proposalStatus = run.createdProposalId
      ? "proposed"
      : latestProposal?.status;
    if (run.createdProposalId) {
      passStep("self_improvement", {
        summary: `Approval-required proposal created: ${run.createdProposalId}.`,
        detail: "Proposal remains simulation-only until the user reviews and approves it."
      });
    } else if (latestProposal?.status === "proposed" || latestProposal?.status === "testing") {
      warnStep("self_improvement", {
        summary: `Existing proposal still requires review: ${latestProposal.proposalId}.`,
        warning: "No new proposal was created because the best candidate did not clear the stability gate."
      });
    } else {
      passStep("self_improvement", {
        summary: "No self-improvement proposal was created.",
        detail: "Best candidate did not improve stability enough to justify a proposal."
      });
    }

    startStep("simulation_verification");
    await yieldToBrowser();
    throwIfCanceled();
    const runbookBefore = loadSimulationRunbookState();
    const runbookAfter = {
      ...runbookBefore,
      latestResearchPipelineAt: now(),
      latestResearchCycleId: run.cycleId,
      latestResearchPipelineStatus: "completed" as const,
      symbol: generatedThesis.thesis.symbol,
      timeframe: generatedThesis.thesis.timeframe,
      signal: signalFor(generatedThesis.thesis),
      mode: "simulation",
      platform: runbookBefore.platform || "ai_lab_handoff",
      notes: [
        runbookBefore.notes,
        `AI Research Cycle ${run.cycleId} completed thesis/backtest/validation pipeline at ${new Date().toISOString()}. Scheduler verification checks were not changed by this automated pipeline.`
      ].filter(Boolean).join("\n"),
      checklist: {
        ...runbookBefore.checklist,
        aiLabThesisGenerated: true,
        schedulerOneCycleCompleted: true,
        signalLogged: true,
        brokerExecutionSkipped: true
      }
    };
    saveSimulationRunbookState(runbookAfter);
    passStep("simulation_verification", {
      summary: "Simulation runbook recorded research pipeline completion.",
      detail: "Marked research-safe checklist items (thesis generated, one cycle completed, signal logged, broker execution skipped). Positions/trades/shutdown remain operator-verified."
    });

    startStep("readiness_gate");
    await yieldToBrowser();
    throwIfCanceled();
    const matchedCycleWalkForward =
      validationReport?.provenance && cycleWalkForwardRun &&
      walkForwardProvenanceReview(validationReport.provenance, cycleWalkForwardRun).matched
        ? cycleWalkForwardRun
        : undefined;
    const readinessEdgeStatistics = (() => {
      const oos = matchedCycleWalkForward?.stability?.edgeStatistics;
      return oos?.provenance === "out_of_sample" ? oos : undefined;
    })();
    let readinessSnapshot = evaluateReadinessGate({
      validation: validationReport,
      quality: researchQualityReview,
      runbook: runbookAfter,
      edgeStatistics: readinessEdgeStatistics,
      provenanceExpectation: validationReport?.provenance,
      walkForwardRun: matchedCycleWalkForward
    });
    run.readinessSnapshot = readinessSnapshot;
    passStep("readiness_gate", {
      summary: `Readiness remains ${readinessSnapshot.state}.`,
      detail: `${safeArray(readinessSnapshot.activeFailedRequirements).length} active blocker(s); ${safeArray(readinessSnapshot.deferredRequirements).length} later requirement(s); no override applied.`
    });

    startStep("llm_advisory");
    await yieldToBrowser();
    throwIfCanceled();
    if (skipLlmAdvisory) {
      run.llmBridgeAvailable = false;
      run.llmAdvisoryUnavailable = true;
      run.llmAdvisoryUnavailableReason = "skipped_for_autonomous_stability";
      skipStep(
        "llm_advisory",
        "LLM advisory skipped for autonomous stability mode; deterministic research continued."
      );
    } else {
    const llmMarketContext = buildMarketContext({
      symbol: activeConfig.symbol,
      timeframe: activeConfig.timeframe,
      mode: evidenceDataMode,
      candles: researchCandles
    });
    const llmEvidenceQualitySummary = buildEvidenceLedger({
      dataMode: evidenceDataMode,
      sourceLabel: detectorEvidenceContext?.sourceLabel ?? dataSourceLabel,
      rawCandleCount: detectorEvidenceContext?.rawCandleCount ?? run.rawCandleCount ?? researchCandles.length,
      processedCandleCount: detectorEvidenceContext?.processedCandleCount ?? run.processedCandleCount ?? researchCandles.length,
      researchWindow: detectorEvidenceContext?.processedCandleCount ?? run.researchWindowCandles ?? researchCandles.length,
      latestCycleId: run.cycleId,
      latestCycleTimestamp: run.startedAt,
      debateSessionId: run.agentDebateConsensus?.sessionId,
      validationId: run.validationSummary?.validationId,
      researchQualityId: run.researchQualitySummary?.reviewId,
      readinessState: readinessSnapshot.state,
      replayOutcomeCount: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.replayOutcomeCount : undefined,
      walkForwardOosTradeCount: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.walkForwardOosTrades : undefined,
      walkForwardWindowsPassed: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.walkForwardWindowsPassed : undefined,
      walkForwardWindowsTested: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.walkForwardWindowsTested : undefined,
      walkForwardVerdict: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.walkForwardVerdict : undefined,
      monteCarloUsableOutcomes: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.monteCarloUsableOutcomes : undefined,
      monteCarloRobustness: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.monteCarloRobustness : undefined
    });
    // Post-validation review: the packet now includes the completed
    // validation report, research-quality review, and readiness snapshot.
    const llmPacket = buildLLMResearchContextPacket({
      state: workingState,
      validation: validationReport,
      quality: researchQualityReview,
      readiness: readinessSnapshot,
      runbook: runbookAfter,
      providerMode: "local_command",
      marketContext: llmMarketContext,
      evidenceQualitySummary: llmEvidenceQualitySummary,
      historicalEvidenceContract: run.historicalEvidenceContract
    });
    const contextValidation = validateLLMContextPacket(llmPacket);

    if (!contextValidation.valid) {
      warnStep("llm_advisory", {
        summary: "LLM advisory review was skipped because the context packet failed validation.",
        warning: contextValidation.errors.join(" ")
      });
    } else {
      try {
        const bridgeResult = await runLocalBridgeAdvisory(llmPacket);
        if (bridgeResult.advisoryStatus === "unavailable") {
          const advisoryUnavailableSummary = llmUnavailableSummary(bridgeResult.reason);
          const advisoryUnavailableDetail = safeArray(bridgeResult.details)
            .filter((detail): detail is string => typeof detail === "string" && Boolean(detail.trim()))
            .join(" ")
            .slice(0, 500);
          run.llmBridgeAvailable = llmBridgeProcessAvailable(bridgeResult.reason);
          run.llmAdvisoryUnavailable = true;
          run.llmAdvisoryUnavailableReason = bridgeResult.reason;
          run.llmAdvisoryUnavailableDetail = advisoryUnavailableDetail || bridgeResult.warnings[0];
          run.llmRun = unavailableLLMRun({
            contextPacketId: llmPacket.packetId,
            reason: bridgeResult.reason,
            warnings: [...bridgeResult.warnings, ...safeArray(bridgeResult.details)]
          });
          warnStep("llm_advisory", {
            summary: advisoryUnavailableSummary,
            warning: [...bridgeResult.warnings, ...safeArray(bridgeResult.details)].join(" ")
          });
        } else {
          run.llmBridgeAvailable = true;
          const importResult = importLLMAgentResponse(JSON.stringify(safeArray(bridgeResult.responses)), llmPacket.packetId);
          if (!importResult.run || !importResult.valid) {
            recordLLMUnsafeResponseRejection(Math.max(1, importResult.unsafeResponseRejections));
            warnStep("llm_advisory", {
              summary: "Local LLM bridge responded, but advisory validation failed.",
              warning: importResult.errors.join(" ") || "Unsafe or incomplete advisory response."
            });
          } else {
            run.llmRun = importResult.run;
            recordLLMResponseImport(importResult.run, importResult.run.timestamp);
            passStep("llm_advisory", {
              summary: "Post-validation LLM advisory review passed with the full validation/quality/readiness packet.",
              detail: bridgeResult.responseFile ? `Response file: ${bridgeResult.responseFile}` : undefined
            });
          }
        }
      } catch (error) {
        const advisoryUnavailableDetail = error instanceof Error ? error.message : "Local LLM bridge request failed.";
        run.llmBridgeAvailable = false;
        run.llmAdvisoryUnavailable = true;
        run.llmAdvisoryUnavailableReason = "request_failed";
        run.llmAdvisoryUnavailableDetail = advisoryUnavailableDetail.slice(0, 500);
        run.llmRun = unavailableLLMRun({
          contextPacketId: llmPacket.packetId,
          reason: "request_failed",
          warnings: [
            llmUnavailableSummary("request_failed"),
            advisoryUnavailableDetail
          ]
        });
        warnStep("llm_advisory", {
          summary: llmUnavailableSummary("request_failed"),
          warning: advisoryUnavailableDetail
        });
      }
    }
    }

    // Research Quality reads the persisted advisory-review gate. Recompute it
    // after a successful current-cycle review so this cycle can progress
    // without requiring an otherwise identical second run.
    if (validationReport && run.llmRun?.advisoryPassed) {
      researchQualityReview = analyzeValidationResults(validationReport);
      saveLatestResearchQualityReview(researchQualityReview);
      run.researchQualityReview = researchQualityReview;
      run.researchQualitySummary = summarizeQuality(researchQualityReview);
      passStep("research_quality", {
        summary: `Research quality refreshed after advisory review: ${researchQualityReview.readinessGrade}.`,
        detail: researchQualityReview.recommendedNextStep
      });
    }

    readinessSnapshot = evaluateReadinessGate({
      validation: validationReport,
      quality: researchQualityReview,
      runbook: runbookAfter,
      edgeStatistics: readinessEdgeStatistics,
      provenanceExpectation: validationReport?.provenance,
      walkForwardRun: matchedCycleWalkForward
    });
    run.readinessSnapshot = readinessSnapshot;
    passStep("readiness_gate", {
      summary: `Readiness remains ${readinessSnapshot.state}.`,
      detail: `${safeArray(readinessSnapshot.activeFailedRequirements).length} active blocker(s); ${safeArray(readinessSnapshot.deferredRequirements).length} later requirement(s); no override applied.`
    });

    // LLM advisory is a promotion/readiness concern, not a research-cycle failure.
    run.blockers = uniqueText([
      ...safeArray(readinessSnapshot.activeFailedRequirements).map(readinessBlockerLabel)
    ]);
    run.promotionBlockers = uniqueText([
      ...safeArray(readinessSnapshot.failedRequirements).map(readinessBlockerLabel),
      ...(!run.llmRun?.advisoryPassed ? ["LLM advisory missing for Paper-Demo Candidate promotion."] : [])
    ]);

    run.canonicalMetrics = buildCanonicalPerformanceMetricsFromRun(run, validationReport);
    const cycleEvidenceSummary = buildEvidenceLedger({
      dataMode: evidenceDataMode,
      sourceLabel: detectorEvidenceContext?.sourceLabel ?? dataSourceLabel,
      rawCandleCount: detectorEvidenceContext?.rawCandleCount ?? run.rawCandleCount ?? researchCandles.length,
      processedCandleCount: detectorEvidenceContext?.processedCandleCount ?? run.processedCandleCount ?? researchCandles.length,
      researchWindow: detectorEvidenceContext?.processedCandleCount ?? run.researchWindowCandles ?? researchCandles.length,
      latestCycleId: run.cycleId,
      latestCycleTimestamp: run.completedAt ?? run.startedAt,
      latestLLMRunId: run.llmRun?.runId,
      llmAdvisoryPassed: run.llmRun?.advisoryPassed,
      debateSessionId: run.agentDebateConsensus?.sessionId,
      validationId: run.validationSummary?.validationId,
      researchQualityId: run.researchQualitySummary?.reviewId,
      readinessState: readinessSnapshot.state,
      proposalId: run.createdProposalId,
      smtState: run.backtestSummary?.grinchSummary?.latestScore?.smtState,
      replayOutcomeCount: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.replayOutcomeCount : undefined,
      walkForwardOosTradeCount: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.walkForwardOosTrades : undefined,
      walkForwardWindowsPassed: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.walkForwardWindowsPassed : undefined,
      walkForwardWindowsTested: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.walkForwardWindowsTested : undefined,
      walkForwardVerdict: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.walkForwardVerdict : undefined,
      monteCarloUsableOutcomes: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.monteCarloUsableOutcomes : undefined,
      monteCarloRobustness: run.historicalEvidenceContract?.supportScope === "candidate_support" ? run.automatedEvidenceSummary?.monteCarloRobustness : undefined
    });
    run.evidenceSummary = {
      evidenceScore: cycleEvidenceSummary.overallScore,
      realEvidenceCoverage: cycleEvidenceSummary.realEvidenceCoverage,
      weakestEvidenceCategories: safeTopN(cycleEvidenceSummary.weakestEvidenceCategories, 5),
      readinessEvidenceWarnings: safeTopN(cycleEvidenceSummary.readinessEvidenceWarnings, 5),
      nextDataImprovement: cycleEvidenceSummary.nextDataImprovement
    };
    const existingCycleState = loadResearchCycleState();
    const maturityCycles = [
      run,
      ...safeArray(existingCycleState.runs).filter((item) => item.cycleId !== run.cycleId)
    ].map((cycle) => {
      const metrics = canonicalMetricsForRun(cycle);
      return {
        cycleId: cycle.cycleId,
        timestamp: cycle.completedAt ?? cycle.startedAt,
        status: cycle.status,
        activeCalibrationId: metrics?.activeCalibrationId ?? cycle.activeCalibrationId,
        dataSourceMode: cycle.dataSourceMode,
        researchPreset: cycle.researchPreset,
        candleWindow: metrics?.candleWindow ?? `${cycle.researchWindowCandles ?? 0} raw / ${cycle.processedCandleCount ?? 0} processed`,
        rawCandleCount: cycle.validationEvidenceCandleCount ?? metrics?.rawCandleCount ?? cycle.rawCandleCount,
        processedCandleCount: cycle.validationEvidenceCandleCount ?? metrics?.processedCandleCount ?? cycle.processedCandleCount,
        totalTrades: metrics?.totalTrades ?? cycle.backtestSummary?.totalTrades,
        winRate: metrics?.winRate ?? cycle.backtestSummary?.winRate,
        averageR: metrics?.averageR ?? cycle.backtestSummary?.averageR,
        maxDrawdownR: metrics?.maxDrawdownR ?? cycle.backtestSummary?.maxDrawdown,
        falsePositiveCount: metrics?.falsePositiveCount,
        readinessScore: metrics?.readinessScore ?? cycle.researchQualitySummary?.readinessScore ?? cycle.validationSummary?.readinessScore,
        readinessState: cycle.readinessSnapshot?.state,
        llmAdvisoryPassed: cycle.llmRun?.advisoryPassed
      };
    });
    const maturitySummary = calculateResearchMaturity({
      activeCalibrationId: activeResearchConfig.activeCalibrationId,
      activeCalibrationApprovedAt: activeResearchConfig.activeResearchCalibration?.approvedAt,
      cycles: maturityCycles,
      evidenceQualityScore: cycleEvidenceSummary.overallScore,
      proposals: loadSelfImprovementState().proposals,
      latestReadinessState: readinessSnapshot.state,
      latestWalkForwardRun: matchedCycleWalkForward
    });
    run.maturitySummary = {
      maturityScore: maturitySummary.score,
      maturityGrade: maturitySummary.grade,
      missingRequirements: safeTopN(maturitySummary.missingRequirements, 5),
      maturityWarnings: safeTopN(maturitySummary.maturityWarnings, 5),
      nextMaturityRequirement: maturitySummary.nextMaturityRequirement
    };

    linkResearchCycleValidationChain({
      cycle: run,
      walkForwardRun: matchedCycleWalkForward,
      persist: true
    });

    let auditWarning: string | undefined;
    if (heavyAuditSkipped) {
      auditWarning = "Heavy agent audit traces were skipped in imported-data Safe mode. Enable Advanced full research mode only for intentional stress testing.";
    } else {
      try {
        saveAgentAuditTraces([
          ...buildAgentAuditTraces({
            thesis: generatedThesis.thesis,
            debateMessages: generatedThesis.debateSession.messages,
            llmRun: run.llmRun
          }),
          ...auditCioSynthesis(generatedThesis.thesis, generatedThesis.debateSession.messages),
          ...auditAgentDebateSession(structuredDebateSession),
          ...(autoResearchCycle ? auditAutoResearchDecision(autoResearchCycle) : []),
          ...auditSelfImprovementDecision(latestSelfImprovementProposal),
          ...auditReadinessGate(readinessSnapshot)
        ]);
      } catch (error) {
        auditWarning = `Agent audit trace storage failed safely. ${error instanceof Error ? error.message : ""}`.trim();
      }
    }

    run.status = finalStatusFor(run);
    run.completedAt = now();
    run.canonicalMetrics = buildCanonicalPerformanceMetricsFromRun(run, validationReport);
    run.nextRecommendedAction = nextActionFor(run);
    run.resultSummary = resultSummaryFor(run);

    startStep("communications_audit");
    await yieldToBrowser();
    throwIfCanceled();
    try {
      recordResearchCycleCommunication({
        cycleId: run.cycleId,
        status: run.status,
        summary: resultSummaryFor({ ...run, steps }),
        validationId: validationReport?.id,
        proposalId: run.createdProposalId,
        readinessState: readinessSnapshot.state,
        actionRequired: Boolean(run.createdProposalId || safeArray(run.blockers).length || run.status === "completed_with_warnings")
      });
      if (auditWarning) {
        warnStep("communications_audit", {
          summary: "Research cycle logged with compact audit handling.",
          warning: auditWarning,
          detail: "Audit message has no execution authority."
        });
      } else {
        passStep("communications_audit", {
          summary: "Research cycle logged to the in-app communications audit trail.",
          detail: "Audit message has no execution authority."
        });
      }
    } catch (error) {
      warnStep("communications_audit", {
        summary: "Research cycle completed, but communications audit storage failed safely.",
        warning: error instanceof Error ? error.message : "Unable to save communication audit entry."
      });
    }

    run.status = finalStatusFor(run);
    run.completedAt = now();
    run.canonicalMetrics = buildCanonicalPerformanceMetricsFromRun(run, validationReport);
    run.nextRecommendedAction = nextActionFor(run);
    run.resultSummary = resultSummaryFor(run);
    try {
      const evidenceRecord = buildResearchEvidenceRecord(run);
      const appendResult = await appendResearchEvidenceRecord(evidenceRecord);
      const outboxEntry = queueGbrainMemoryPacket(buildResearchEvidenceMemoryPacket(evidenceRecord));
      run.evidenceRecordId = evidenceRecord.evidenceId;
      run.evidenceIdentityKey = evidenceRecord.identity.identityKey;
      run.evidenceStorageBackend = appendResult.backend;
      run.gbrainMemoryOutboxId = outboxEntry.outboxId;
      void syncGbrainResearchMemory({ includeEvidenceBackfill: false });
    } catch (error) {
      run.candleWindowWarnings = uniqueText([
        ...(run.candleWindowWarnings ?? []),
        `Persistent research evidence failed safely: ${error instanceof Error ? error.message : "unknown error"}. Readiness and execution authority were not changed.`
      ]);
    }
    await persistTradePlanCycleSafely(run, researchCandles);
    saveResearchCycleRun(snapshot());
    notify();
    return snapshot();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research cycle failed.";
    const runningStep = steps.find((step) => step.status === "running")?.stepId ?? "communications_audit";
    if (signal?.aborted || /canceled/i.test(message)) {
      setStep(runningStep, {
        status: "skipped",
        summary: "Research cycle was canceled before completion.",
        warning: message
      });
      run.status = "canceled";
    } else {
      failStep(runningStep, message);
      run.status = "failed";
    }
    run.completedAt = now();
    run.canonicalMetrics = buildCanonicalPerformanceMetricsFromRun(run, run.validationReport);
    run.nextRecommendedAction = nextActionFor(run);
    run.resultSummary = resultSummaryFor(run);
    try {
      recordResearchCycleCommunication({
        cycleId: run.cycleId,
        status: run.status,
        summary: message,
        readinessState: run.readinessSnapshot?.state,
        actionRequired: true
      });
    } catch {
      // Keep the failed research-cycle result available even if audit logging storage is full.
    }
    await persistTradePlanCycleSafely(run, researchCandles);
    saveResearchCycleRun(snapshot());
    return snapshot();
  }
}
