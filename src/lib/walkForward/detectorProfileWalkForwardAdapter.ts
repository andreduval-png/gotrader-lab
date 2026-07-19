import type { ResolvedBacktestConfig } from "@/lib/backtesting";
import { computeEdgeStatistics } from "@/lib/statistics/edgeStatistics";
import type {
  DetectorProfileTradeOutcome,
  DetectorProfileWalkForwardResult
} from "@/lib/walkForward/detectorProfileWalkForwardTypes";
import type {
  WalkForwardPreflightBlocker,
  WalkForwardRun,
  WalkForwardSplitLabel,
  WalkForwardWindowMetrics,
  WalkForwardWindowResult
} from "@/lib/walkForward/walkForwardTypes";

const SAFETY_NOTICE =
  "Walk-forward validation is simulation-only. It cannot execute trades, enable demo/live mode, or override readiness." as const;

const splitLabels: WalkForwardSplitLabel[] = ["in_sample", "validation", "out_of_sample"];

const emptyMetrics = (): WalkForwardWindowMetrics => ({
  totalTrades: 0,
  winRate: 0,
  averageR: 0,
  maxDrawdownR: 0,
  profitFactor: null,
  falsePositiveCount: 0,
  skippedSignals: 0,
  confidenceCalibration: 0,
  readinessScore: 0,
  evidenceQualityScore: 0,
  pass: false,
  failReasons: ["Detector-profile evidence is reported in the chronological OOS split only."]
});

const configSummary = (config: ResolvedBacktestConfig): WalkForwardWindowResult["configUsed"] => ({
  symbol: config.symbol,
  timeframe: config.timeframe,
  minimumConfluenceThreshold: config.minimumConfluenceThreshold,
  minimumConfidenceThreshold: config.minimumConfidenceThreshold,
  sessionFilter: config.sessionFilter,
  targetRMultiple: config.targetRMultiple,
  stopModel: config.stopModel,
  allowLong: config.allowLong,
  allowShort: config.allowShort
});

const windowsFor = (
  result: DetectorProfileWalkForwardResult,
  config: ResolvedBacktestConfig,
  sourceLabel: string
): WalkForwardWindowResult[] =>
  result.windows.map((window) => {
    const oos: WalkForwardWindowMetrics = {
      totalTrades: window.oosTrades,
      winRate: window.winRate,
      averageR: window.averageR,
      maxDrawdownR: window.maxDrawdownR,
      profitFactor: window.profitFactor,
      falsePositiveCount: window.invalidationFirst,
      skippedSignals: window.stalled,
      confidenceCalibration: 0,
      readinessScore: window.passed ? 100 : 0,
      evidenceQualityScore: window.passed ? 100 : 50,
      pass: window.passed,
      failReasons: window.failReasons
    };
    const metricsBySplit = Object.fromEntries(
      splitLabels.map((label) => [label, label === "out_of_sample" ? oos : emptyMetrics()])
    ) as WalkForwardWindowResult["metricsBySplit"];
    return {
      windowId: `detector_oos_${window.windowIndex}`,
      windowIndex: window.windowIndex,
      totalWindows: result.windows.length,
      splitSummaries: splitLabels.map((label) => ({
        splitId: `detector_oos_${window.windowIndex}_${label}`,
        label,
        displayLabel: label === "out_of_sample" ? "Frozen chronological OOS" : label.replace(/_/g, " "),
        startTimestamp: window.from,
        endTimestamp: window.to,
        rawCandleCount: 0,
        processedCandleCount: 0,
        aggregateTimeframe: config.timeframe,
        dataSource: sourceLabel,
        symbol: config.symbol
      })),
      metricsBySplit,
      configUsed: configSummary(config),
      verdict: window.passed ? "pass" : window.oosTrades > 0 ? "warning" : "fail",
      failReasons: window.failReasons,
      completedAt: result.generatedAt
    };
  });

const preflightBlockers = (result: DetectorProfileWalkForwardResult): WalkForwardPreflightBlocker[] =>
  result.verdict === "passed"
    ? []
    : result.blockers.slice(0, 6).map((message) => ({
        code:
          result.verdict === "blocked_source"
            ? "source_not_eligible"
            : result.oosWindowCount < 2
              ? "insufficient_windows"
              : "insufficient_replay_candidates",
        message,
        nextAction: result.nextAction
      }));

export function adaptDetectorProfileWalkForwardRun(input: {
  result: DetectorProfileWalkForwardResult;
  config: ResolvedBacktestConfig;
  oosTrades: DetectorProfileTradeOutcome[];
  sourceLabel: string;
  rawCandleCount: number;
  processedCandleCount: number;
  availableLookbackDays: number;
  requestedLookbackDays: number;
}): WalkForwardRun {
  const { result, config } = input;
  const edgeStatistics = computeEdgeStatistics(
    input.oosTrades.map((trade) => trade.rMultiple),
    { minimumSampleSize: 20, provenance: "out_of_sample" }
  );
  const windows = windowsFor(result, config, input.sourceLabel);
  const enoughEvidence =
    result.verdict === "passed" &&
    result.totalOosTrades >= result.requirements.minimumOosTrades &&
    result.oosWindowCount >= result.requirements.minimumOosWindows;
  const evidenceReasons = [
    result.totalOosTrades < result.requirements.minimumOosTrades
      ? `Only ${result.totalOosTrades} OOS trades; ${result.requirements.minimumOosTrades} required.`
      : undefined,
    result.oosWindowCount < result.requirements.minimumOosWindows
      ? `Only ${result.oosWindowCount} OOS windows; ${result.requirements.minimumOosWindows} required.`
      : undefined,
    ...result.blockers
  ].filter((item): item is string => Boolean(item));
  const stabilityVerdict =
    result.verdict === "passed"
      ? "robust_research" as const
      : result.verdict === "insufficient_data" || result.verdict === "forward_evidence_required"
        ? "insufficient_evidence" as const
        : "fail" as const;
  const preflight = {
    status: result.verdict === "passed" ? "ready" as const : "blocked" as const,
    strategyId: result.profileId,
    requestedSymbol: result.provenance.requestedSymbol,
    brokerSymbol: result.provenance.brokerSymbol,
    timeframe: result.provenance.timeframe,
    sourceProvider: result.sourceProvider,
    sourceFingerprint: result.sourceFingerprint,
    sourceDepthUsed: "active_walk_forward_source" as const,
    sourceDepthStatus: input.availableLookbackDays >= input.requestedLookbackDays * 0.9 ? "sufficient" as const : "limited" as const,
    sourceDepthLabel: `${input.availableLookbackDays.toFixed(1)} of ${input.requestedLookbackDays} requested days`,
    canRequestDeepMt5History: true,
    availableLookbackDays: input.availableLookbackDays,
    availableCandidateCount: result.totalOosTrades,
    replayPassedCandidateCount: result.totalOosTrades,
    uniqueTradingDates: result.uniqueOosTradingDates,
    activeRollingWindowsPossible: result.oosWindowCount,
    estimatedOosTrades: result.totalOosTrades,
    requiredCandidates: result.requirements.minimumOosTrades,
    requiredReplayPassedCandidates: result.requirements.minimumOosTrades,
    requiredUniqueTradingDates: result.requirements.minimumUniqueDates,
    requiredWindows: result.requirements.minimumOosWindows,
    requiredOosTrades: result.requirements.minimumOosTrades,
    blockers: preflightBlockers(result),
    warnings: result.warnings,
    nextAction: result.nextAction,
    authority: {
      executionAuthority: "none" as const,
      brokerAuthority: "none" as const,
      readinessOverrideAuthority: "none" as const
    },
    safety: {
      rawCandlesExcluded: true as const,
      rawSnapshotsExcluded: true as const,
      accountDataExcluded: true as const,
      orderDataExcluded: true as const,
      positionDataExcluded: true as const,
      secretsExcluded: true as const
    }
  };

  return {
    runId: result.provenance.walkForwardRunId ?? `detector_walk_forward_${Date.now()}`,
    startedAt: result.generatedAt,
    completedAt: result.generatedAt,
    status: result.verdict === "passed" ? "completed" : "completed_with_warnings",
    mode: "standard",
    splitRatioPreset: "60_20_20",
    splitRatio: {
      preset: "60_20_20",
      label: "Frozen profile chronological holdout",
      inSample: 0.6,
      validation: 0.2,
      outOfSample: 0.2
    },
    maxWindows: Math.max(2, result.oosWindowCount),
    requestedMaxWindows: Math.max(2, result.oosWindowCount),
    actualWindowsGenerated: result.oosWindowCount,
    windowGenerationNotes: [
      "Detector-specific chronological holdout replaces generic small candle windows for this frozen profile.",
      "Raw candles remain internal; this record stores compact OOS metrics only."
    ],
    walkForwardDataPreset: "custom",
    dataSource: result.sourceProvider,
    dataSourceLabel: input.sourceLabel,
    dataPreset: "custom",
    sourceProvider: result.sourceProvider,
    sourceFingerprint: result.sourceFingerprint,
    sourceDataQuality: input.availableLookbackDays >= input.requestedLookbackDays * 0.9 ? "full" : "limited",
    sourceWarnings: result.warnings,
    preflight,
    providerSymbol: result.provenance.brokerSymbol,
    symbol: config.symbol,
    timeframe: config.timeframe,
    rawCandleCount: input.rawCandleCount,
    processedCandleCount: input.processedCandleCount,
    candleWindow: `${input.processedCandleCount.toLocaleString()} compact ${config.timeframe} candles / ${input.availableLookbackDays.toFixed(1)} days`,
    configMergeStatus: "frozen detector profile parameters applied",
    proposalId: result.provenance.proposalId,
    provenance: result.provenance,
    windows,
    stability: {
      windowCount: result.oosWindowCount,
      windowsPassed: result.oosWindowsPassed,
      outOfSampleWindowsPassed: result.oosWindowsPassed,
      averageWinRate: windows.length ? windows.reduce((sum, item) => sum + item.metricsBySplit.out_of_sample.winRate, 0) / windows.length : 0,
      medianWinRate: windows.length ? [...windows].sort((a, b) => a.metricsBySplit.out_of_sample.winRate - b.metricsBySplit.out_of_sample.winRate)[Math.floor(windows.length / 2)].metricsBySplit.out_of_sample.winRate : 0,
      worstWindowWinRate: windows.length ? Math.min(...windows.map((item) => item.metricsBySplit.out_of_sample.winRate)) : 0,
      averageRConsistency: result.pooledOos.averageR,
      worstWindowAverageR: windows.length ? Math.min(...windows.map((item) => item.metricsBySplit.out_of_sample.averageR)) : 0,
      worstWindowDrawdownR: windows.length ? Math.max(...windows.map((item) => item.metricsBySplit.out_of_sample.maxDrawdownR)) : 0,
      tradeCountConsistency: result.totalOosTrades,
      falsePositiveConsistency: Math.max(0, 1 - result.windows.reduce((sum, item) => sum + item.invalidationFirst, 0) / Math.max(1, result.totalOosTrades)),
      readinessConsistency: result.oosWindowPassRate,
      stabilityScore: Math.round(result.oosWindowPassRate * 100),
      overfitRisk: result.largestSingleDateShare > 0.15 ? "high" : result.verdict === "passed" ? "low" : "medium",
      verdict: stabilityVerdict,
      bestWindowId: windows.find((item) => item.verdict === "pass")?.windowId,
      worstWindowId: windows.find((item) => item.verdict !== "pass")?.windowId,
      recommendedNextAction: result.nextAction,
      summary: `${result.oosWindowsPassed}/${result.oosWindowCount} frozen chronological OOS windows passed; ${result.totalOosTrades} OOS trades; ${result.pooledOos.averageR.toFixed(2)}R average.`,
      failReasons: evidenceReasons,
      evidenceSummary: {
        minimumWindows: result.requirements.minimumOosWindows,
        preferredWindows: Math.max(3, result.requirements.minimumOosWindows),
        minimumOosTradesPerWindow: result.requirements.minimumTradesPerWindow,
        minimumTotalOosTrades: result.requirements.minimumOosTrades,
        requestedMaxWindows: Math.max(2, result.oosWindowCount),
        actualWindowsGenerated: result.oosWindowCount,
        totalOosTrades: result.totalOosTrades,
        windowsBelowMinimumOosTrades: result.windows.filter(
          (window) => window.oosTrades < result.requirements.minimumTradesPerWindow
        ).length,
        enoughEvidence,
        insufficientEvidenceReasons: enoughEvidence ? [] : evidenceReasons,
        windowGenerationNotes: ["Frozen detector-profile chronological holdout."]
      },
      edgeStatistics
    },
    warnings: result.warnings,
    safetyNotice: SAFETY_NOTICE
  };
}
