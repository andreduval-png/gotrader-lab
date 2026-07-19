import {
  FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS,
  evaluateForwardEvidenceLedger,
  getFrozenResearchProfile,
  ifvgFreshRetestV3FrozenProfile
} from "@/lib/forwardEvidence";
import { evaluatePredictionCalibration } from "@/lib/predictionLedger";
import {
  RESULTS_WORKSPACE_AUTHORITY,
  type ResultsWorkspaceBuildInput,
  type ResultsWorkspaceSnapshot
} from "./resultsWorkspaceTypes";

const finiteOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const uniqueStrings = (values: Array<string | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].slice(0, 12);

export function buildResultsWorkspaceSnapshot(
  input: ResultsWorkspaceBuildInput
): ResultsWorkspaceSnapshot {
  const runtime = input.runtimeSnapshot;
  const source = runtime?.marketData.activeResearchSource;
  const activation = input.activationSummary;
  const metrics = input.canonicalMetrics ?? runtime?.performance.canonicalPerformanceMetrics;
  const replay = input.latestResearchState?.latestReplay;
  const monteCarlo = input.latestResearchState?.latestMonteCarlo;
  const walkForward = input.walkForward;
  const chain = input.validationChainEntry;
  const paperCandidates = input.paperDemoState.candidates;
  const latestChecklist = input.paperDemoState.dailyChecklists[0];
  const activeFrozenProfileId =
    runtime?.latestResearchCycle.latestValidationSummary?.provenance?.strategyProfile ??
    runtime?.activeConfig.resolvedBacktestConfig.strategyProfile;
  const frozen = getFrozenResearchProfile(activeFrozenProfileId ?? "") ?? ifvgFreshRetestV3FrozenProfile;
  const forward = evaluateForwardEvidenceLedger(input.forwardEvidenceEntries, frozen.profileId);
  const predictions = evaluatePredictionCalibration(input.predictionLedger.entries);
  const oos = walkForward?.stability?.edgeStatistics?.provenance === "out_of_sample"
    ? walkForward.stability.edgeStatistics
    : undefined;
  const runtimeBlockers = runtime?.readiness.actualBlockers ?? [];

  return {
    generatedAt: new Date().toISOString(),
    source: {
      provider: source?.provider ?? "unavailable",
      requestedSymbol: activation?.requestedSymbol ?? runtime?.marketData.symbol ?? "MNQ",
      brokerSymbol: activation?.brokerSymbol ?? runtime?.mt5ReadOnly.brokerSymbol ?? source?.provenance.providerSymbol ?? "USTECH",
      timeframe: activation?.primaryTimeframe ?? source?.timeframe ?? runtime?.marketData.timeframe ?? "5m",
      candleCount: source?.candleCount ?? runtime?.marketData.processedCandleCount ?? 0,
      fingerprint: source?.fingerprint ?? runtime?.marketData.researchDataFingerprint ?? "missing",
      dataQuality: source?.dataQuality ?? "unavailable",
      analysisDepthStatus: activation?.analysisDepthStatus ?? "activation_required",
      analysisTimeframesRequested: activation?.analysisTimeframesRequested ?? [],
      analysisTimeframesLoaded: activation?.analysisTimeframesLoaded ?? activation?.analysisTimeframesUsed ?? [],
      missingTimeframes: activation?.missingTimeframes ?? [],
      requiredTimeframesLoaded: activation?.requiredTimeframesLoaded ?? false,
      weeklyBiasStatus: activation?.weeklyBiasStatus ?? "activation_required",
      weeklyBiasDirection: activation?.weeklyBiasDirection ?? "unknown"
    },
    backtest: {
      status: metrics ? "available" : "missing",
      cycleId: metrics?.sourceCycleId,
      totalTrades: metrics?.totalTrades ?? 0,
      winningTrades: metrics?.winningTrades ?? 0,
      losingTrades: metrics?.losingTrades ?? 0,
      winRate: finiteOrNull(metrics?.winRate),
      averageR: finiteOrNull(metrics?.averageR),
      profitFactor: finiteOrNull(metrics?.profitFactor),
      maxDrawdownR: finiteOrNull(metrics?.maxDrawdownR),
      realizedPnL: finiteOrNull(metrics?.realizedPnL),
      metricSource: metrics?.metricSourceLabel ?? "No completed canonical research cycle"
    },
    replay: {
      status: replay ? "available" : "missing",
      runId: replay?.runId,
      totalSignals: replay?.totalSignals ?? 0,
      targetFirstRate: finiteOrNull(replay?.targetFirstRate),
      approvedTargetFirstRate: finiteOrNull(replay?.approvedTargetFirstRate),
      averageRrAchieved: finiteOrNull(replay?.averageRrAchieved),
      approvedAverageRr: finiteOrNull(replay?.approvedAverageRr),
      verdict: chain?.replayResult?.verdict ?? (replay ? "saved" : "not_run")
    },
    walkForward: {
      status: walkForward?.status ?? "not_run",
      runId: walkForward?.runId,
      verdict: walkForward?.stability?.verdict ?? chain?.walkForwardResult?.verdict ?? "not_run",
      windows: walkForward?.stability?.windowCount ?? walkForward?.actualWindowsGenerated ?? 0,
      windowsPassed: walkForward?.stability?.outOfSampleWindowsPassed ?? chain?.walkForwardResult?.oosWindowsPassed ?? 0,
      oosTrades: oos?.sampleSize ?? chain?.walkForwardResult?.tradeCount ?? 0,
      oosAverageR: finiteOrNull(oos?.meanR),
      oosLower95: finiteOrNull(oos?.expectancyLower95),
      overfitRisk: walkForward?.stability?.overfitRisk ?? "not_evaluated",
      provenanceStatus: chain?.provenanceStatus ?? (walkForward?.sourceFingerprint ? "source_fingerprinted" : "missing")
    },
    monteCarlo: {
      status: monteCarlo ? "available" : "missing",
      robustness: monteCarlo?.robustnessRating ?? "not_run",
      usableOutcomes: monteCarlo?.usableOutcomes ?? 0,
      medianEndingR: finiteOrNull(monteCarlo?.medianEndingR),
      fifthPercentileEndingR: finiteOrNull(monteCarlo?.fifthPercentileEndingR),
      medianMaxDrawdownPct: finiteOrNull(monteCarlo?.medianMaxDrawdownPct),
      worstMaxDrawdownPct: finiteOrNull(monteCarlo?.worstMaxDrawdownPct),
      riskOfRuinPct: finiteOrNull(monteCarlo?.riskOfRuinPct),
      recommendedMaxRiskPerTradePct: finiteOrNull(monteCarlo?.recommendedMaxRiskPerTradePct)
    },
    paperDemo: {
      candidateCount: paperCandidates.length,
      monitoringCount: paperCandidates.filter((candidate) => candidate.status === "monitoring").length,
      blockedCount: paperCandidates.filter((candidate) => candidate.status === "blocked").length,
      watchlistCount: paperCandidates.filter((candidate) => candidate.status === "watchlist").length,
      retiredCount: paperCandidates.filter((candidate) => candidate.status === "retired").length,
      journalEntries: input.paperDemoState.journalEntries.length,
      checklistCompleted: latestChecklist?.items.filter((item) => item.completed).length ?? 0,
      checklistTotal: latestChecklist?.items.length ?? 0,
      brokerConnected: false
    },
    frozenProfile: {
      profileId: frozen.profileId,
      status: "historically_validated_forward_evidence_required",
      historicalTrades: frozen.evidence.completedTrades,
      historicalTargetFirstRate: frozen.evidence.targetFirstRate,
      historicalAverageR: frozen.evidence.averageR,
      historicalProfitFactor: frozen.evidence.profitFactor,
      historicalUniqueDates: frozen.evidence.uniqueDates,
      rollingWindowsPassed: frozen.evidence.positiveRollingWindows,
      rollingWindowsTotal: frozen.evidence.totalRollingWindows,
      oosTrades: frozen.evidence.oosTrades,
      oosAverageR: frozen.evidence.oosAverageR,
      oosProfitFactor: frozen.evidence.oosProfitFactor,
      monteCarloRobustness: frozen.evidence.monteCarloRobustness,
      forwardCompleted: forward.completedForwardOutcomes,
      forwardRequired: FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.completedOutcomes,
      forwardIndependentDates: forward.independentDates,
      forwardWindows: forward.forwardWindows,
      forwardTargetFirstRate: forward.targetFirstRate,
      forwardAverageR: forward.averageR,
      reassessmentEligible: forward.reassessmentEligible,
      recommendation: forward.recommendation
    },
    predictions: {
      totalForecasts: predictions.totalForecasts,
      actionableForecasts: predictions.actionableForecasts,
      completedForecasts: predictions.completedForecasts,
      pendingForecasts: predictions.pendingForecasts,
      targetFirstRate: predictions.targetFirstRate,
      averageRealizedR: predictions.averageRealizedR,
      brierScore: predictions.brierScore,
      independentDates: predictions.independentDates,
      activeWindows: predictions.activeWindows,
      classification: predictions.classification
    },
    validation: {
      setupLabel: chain?.setupLabel ?? frozen.profileId,
      hypothesisStatus: chain?.hypothesisStatus ?? "forward_evidence_required",
      replayVerdict: chain?.replayResult?.verdict ?? (replay ? "saved" : "not_run"),
      walkForwardVerdict: chain?.walkForwardResult?.verdict ?? walkForward?.stability?.verdict ?? "not_run",
      evidenceScore: runtime?.evidence.evidenceQualityScore ?? chain?.evidenceQuality?.evidenceQualityScore ?? 0,
      maturityScore: runtime?.maturity.maturityScore ?? chain?.evidenceQuality?.maturityScore ?? 0,
      readinessState: runtime?.readiness.readinessState ?? "not_evaluated",
      blockers: uniqueStrings([...runtimeBlockers, ...(chain?.blockers ?? []), ...forward.blockers]),
      nextAction: chain?.nextAction ?? runtime?.readiness.nextAction ?? forward.blockers[0] ?? "Activate Market and run deterministic validation."
    },
    authority: RESULTS_WORKSPACE_AUTHORITY,
    safety: {
      researchOnly: true,
      aggregateMetricsNotFabricatedIntoDailyResults: true,
      rawCandlesExcluded: true,
      rawSnapshotsExcluded: true,
      accountDataExcluded: true,
      orderDataExcluded: true,
      positionDataExcluded: true,
      secretsExcluded: true,
      executionIntentCreated: false
    }
  };
}

export const assertResultsWorkspaceSnapshotIsCompact = (snapshot: ResultsWorkspaceSnapshot) => {
  const serialized = JSON.stringify(snapshot);
  if (/"(?:candles|rawCandles|rawRuntimeSnapshot|accountData|orderData|positionData|apiKey|token|password)"\s*:/i.test(serialized)) {
    throw new Error("Results workspace snapshot contains forbidden raw or sensitive fields.");
  }
  if (Object.values(snapshot.authority).some((value) => value !== "none")) {
    throw new Error("Results workspace authority must remain none/none/none.");
  }
  return true;
};
