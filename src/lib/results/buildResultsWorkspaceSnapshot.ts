import {
  FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS,
  evaluateForwardEvidenceLedger,
  getFrozenResearchProfile
} from "@/lib/forwardEvidence";
import { evaluatePredictionCalibration } from "@/lib/predictionLedger";
import { matchActiveResearchIdentity, type ValidationProvenanceIdentity } from "@/lib/validationProvenance";
import {
  RESULTS_WORKSPACE_AUTHORITY,
  type ResultsEvidenceIdentityStatus,
  type ResultsWorkspaceBuildInput,
  type ResultsWorkspaceSnapshot
} from "./resultsWorkspaceTypes";

const finiteOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const uniqueStrings = (values: Array<string | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].slice(0, 12);

const normalized = (value: string | undefined) => value?.trim().toLowerCase() ?? "";

const matchesSourceIdentity = (
  record: { sourceFingerprint?: string; requestedSymbol?: string; brokerSymbol?: string; timeframe?: string },
  sourceIdentity: { sourceFingerprint?: string; requestedSymbol?: string; brokerSymbol?: string; timeframe?: string }
) => Boolean(
  sourceIdentity.sourceFingerprint &&
  record.sourceFingerprint === sourceIdentity.sourceFingerprint &&
  normalized(record.requestedSymbol) === normalized(sourceIdentity.requestedSymbol) &&
  normalized(record.brokerSymbol) === normalized(sourceIdentity.brokerSymbol) &&
  normalized(record.timeframe) === normalized(sourceIdentity.timeframe)
);

const evidenceIdentityStatus = (
  record: unknown,
  activeIdentity: ValidationProvenanceIdentity | undefined,
  evidenceIdentity: ValidationProvenanceIdentity | undefined
): ResultsEvidenceIdentityStatus => {
  if (!record) return "missing";
  if (!activeIdentity || !evidenceIdentity) return "unverified";
  return matchActiveResearchIdentity(activeIdentity, evidenceIdentity).matched ? "matched" : "mismatch";
};

export function buildResultsWorkspaceSnapshot(
  input: ResultsWorkspaceBuildInput
): ResultsWorkspaceSnapshot {
  const runtime = input.runtimeSnapshot;
  const source = runtime?.marketData.activeResearchSource;
  const activation = input.activationSummary;
  const candidateMetrics = input.canonicalMetrics ?? runtime?.performance.canonicalPerformanceMetrics;
  const activeIdentity = runtime?.researchIdentity?.active;
  const candidateReplay = input.latestResearchState?.latestReplay;
  const candidateMonteCarlo = input.latestResearchState?.latestMonteCarlo;
  const candidateWalkForward = runtime?.walkForward.latestRun ?? input.walkForward;
  const candidateChain = input.validationChainEntry;
  const metricIdentityStatus: ResultsEvidenceIdentityStatus = !candidateMetrics
    ? "missing"
    : !runtime?.latestResearchCycle.latestCycleId
      ? "unverified"
      : candidateMetrics.sourceCycleId === runtime.latestResearchCycle.latestCycleId
        ? "matched"
        : "mismatch";
  const replayIdentityStatus = evidenceIdentityStatus(candidateReplay, activeIdentity, candidateReplay?.provenance);
  const monteCarloIdentityStatus = evidenceIdentityStatus(candidateMonteCarlo, activeIdentity, candidateMonteCarlo?.provenance);
  const walkForwardIdentityStatus = evidenceIdentityStatus(candidateWalkForward, activeIdentity, candidateWalkForward?.provenance);
  const chainIdentityStatus = evidenceIdentityStatus(candidateChain, activeIdentity, candidateChain?.provenance);
  const metrics = metricIdentityStatus === "matched" ? candidateMetrics : undefined;
  const replay = replayIdentityStatus === "matched" ? candidateReplay : undefined;
  const monteCarlo = monteCarloIdentityStatus === "matched" ? candidateMonteCarlo : undefined;
  const walkForward = walkForwardIdentityStatus === "matched" ? candidateWalkForward : undefined;
  const chain = chainIdentityStatus === "matched" ? candidateChain : undefined;
  const sourceIdentity = {
    sourceFingerprint: source?.fingerprint,
    requestedSymbol: runtime?.marketData.symbol,
    brokerSymbol: runtime?.mt5ReadOnly.brokerSymbol ?? source?.provenance.providerSymbol,
    timeframe: source?.timeframe ?? runtime?.marketData.timeframe
  };
  const paperCandidates = input.paperDemoState.candidates.filter((candidate) => matchesSourceIdentity(candidate, sourceIdentity));
  const predictionEntries = input.predictionLedger.entries.filter((entry) => matchesSourceIdentity(entry, sourceIdentity));
  const latestChecklist = input.paperDemoState.dailyChecklists[0];
  const activeFrozenProfileId =
    runtime?.researchIdentity?.active.strategyProfile ??
    runtime?.latestResearchCycle.latestValidationSummary?.provenance?.strategyProfile ??
    runtime?.activeConfig.resolvedBacktestConfig.strategyProfile;
  const frozen = getFrozenResearchProfile(activeFrozenProfileId ?? "");
  const forward = frozen ? evaluateForwardEvidenceLedger(input.forwardEvidenceEntries, frozen.profileId) : undefined;
  const predictions = evaluatePredictionCalibration(predictionEntries);
  const sourceIdentityStatus: ResultsEvidenceIdentityStatus = sourceIdentity.sourceFingerprint ? "matched" : "unverified";
  const oos = walkForward?.stability?.edgeStatistics?.provenance === "out_of_sample"
    ? walkForward.stability.edgeStatistics
    : undefined;
  const runtimeBlockers = runtime?.readiness.actualBlockers ?? [];
  const reportedReadinessState = runtime?.readiness.readinessState ?? "not_evaluated";
  const activationIdentityStatus: ResultsEvidenceIdentityStatus = !activation
    ? "missing"
    : !activation.sourceFingerprint || !source?.fingerprint
      ? "unverified"
      : activation.sourceFingerprint === source.fingerprint
        ? "matched"
        : "mismatch";
  const activationBound = activationIdentityStatus === "matched" ? activation : undefined;
  const progressionBlockers = uniqueStrings([
    ...runtimeBlockers,
    ...(chain?.blockers ?? []),
    ...(forward?.blockers ?? []),
    ...(frozen ? [] : [`No registered frozen evidence exists for ${activeFrozenProfileId ?? "the active strategy profile"}.`]),
    ...(chainIdentityStatus === "mismatch" ? ["The latest validation chain belongs to a different research identity."] : []),
    ...(walkForwardIdentityStatus === "mismatch" ? ["The latest walk-forward run belongs to a different research identity."] : [])
  ]);
  const readinessIntegrity = runtimeBlockers.length > 0 && !/block|not_ready|not ready/i.test(reportedReadinessState)
    ? "contradictory" as const
    : "consistent" as const;
  const effectiveReadinessState = progressionBlockers.length ? "blocked" : reportedReadinessState;

  return {
    generatedAt: new Date().toISOString(),
    source: {
      provider: source?.provider ?? "unavailable",
      requestedSymbol: activationBound?.requestedSymbol ?? runtime?.marketData.symbol ?? "MNQ",
      brokerSymbol: activationBound?.brokerSymbol ?? runtime?.mt5ReadOnly.brokerSymbol ?? source?.provenance.providerSymbol ?? "USTECH",
      timeframe: activationBound?.primaryTimeframe ?? source?.timeframe ?? runtime?.marketData.timeframe ?? "5m",
      candleCount: source?.candleCount ?? runtime?.marketData.processedCandleCount ?? 0,
      fingerprint: source?.fingerprint ?? runtime?.marketData.researchDataFingerprint ?? "missing",
      dataQuality: source?.dataQuality ?? "unavailable",
      analysisDepthStatus: activationBound?.analysisDepthStatus ?? "activation_required",
      analysisTimeframesRequested: activationBound?.analysisTimeframesRequested ?? [],
      analysisTimeframesLoaded: activationBound?.analysisTimeframesLoaded ?? activationBound?.analysisTimeframesUsed ?? [],
      missingTimeframes: activationBound?.missingTimeframes ?? [],
      requiredTimeframesLoaded: activationBound?.requiredTimeframesLoaded ?? false,
      weeklyBiasStatus: activationBound?.weeklyBiasStatus ?? "activation_required",
      weeklyBiasDirection: activationBound?.weeklyBiasDirection ?? "unknown",
      activationIdentityStatus
    },
    backtest: {
      status: metrics ? "available" : "missing",
      identityStatus: metricIdentityStatus,
      cycleId: metrics?.sourceCycleId,
      totalTrades: metrics?.totalTrades ?? 0,
      winningTrades: metrics?.winningTrades ?? 0,
      losingTrades: metrics?.losingTrades ?? 0,
      winRate: finiteOrNull(metrics?.winRate),
      averageR: finiteOrNull(metrics?.averageR),
      profitFactor: metrics?.losingTrades ? finiteOrNull(metrics.profitFactor) : null,
      maxDrawdownR: finiteOrNull(metrics?.maxDrawdownR),
      realizedPnL: finiteOrNull(metrics?.realizedPnL),
      metricSource: metrics?.metricSourceLabel ?? "No completed canonical research cycle"
    },
    replay: {
      status: replay ? "available" : "missing",
      identityStatus: replayIdentityStatus,
      runId: replay?.runId,
      totalSignals: replay?.totalSignals ?? null,
      targetFirstRate: finiteOrNull(replay?.targetFirstRate),
      approvedTargetFirstRate: finiteOrNull(replay?.approvedTargetFirstRate),
      averageRrAchieved: finiteOrNull(replay?.averageRrAchieved),
      approvedAverageRr: finiteOrNull(replay?.approvedAverageRr),
      verdict: chain?.replayResult?.verdict ?? (replay ? "saved" : "not_run")
    },
    walkForward: {
      status: walkForward?.status ?? "not_run",
      identityStatus: walkForwardIdentityStatus,
      runId: walkForward?.runId,
      verdict: walkForward?.stability?.verdict ?? chain?.walkForwardResult?.verdict ?? "not_run",
      windows: walkForward?.stability?.windowCount ?? walkForward?.actualWindowsGenerated ?? null,
      windowsPassed: walkForward?.stability?.outOfSampleWindowsPassed ?? chain?.walkForwardResult?.oosWindowsPassed ?? null,
      oosTrades: oos?.sampleSize ?? chain?.walkForwardResult?.tradeCount ?? null,
      oosAverageR: finiteOrNull(oos?.meanR),
      oosLower95: finiteOrNull(oos?.expectancyLower95),
      overfitRisk: walkForward?.stability?.overfitRisk ?? "not_evaluated",
      provenanceStatus: chain?.provenanceStatus ?? (walkForward?.sourceFingerprint ? "source_fingerprinted" : "missing")
    },
    monteCarlo: {
      status: monteCarlo ? "available" : "missing",
      identityStatus: monteCarloIdentityStatus,
      robustness: monteCarlo?.robustnessRating ?? "not_run",
      usableOutcomes: monteCarlo?.usableOutcomes ?? null,
      medianEndingR: finiteOrNull(monteCarlo?.medianEndingR),
      fifthPercentileEndingR: finiteOrNull(monteCarlo?.fifthPercentileEndingR),
      medianMaxDrawdownPct: finiteOrNull(monteCarlo?.medianMaxDrawdownPct),
      worstMaxDrawdownPct: finiteOrNull(monteCarlo?.worstMaxDrawdownPct),
      riskOfRuinPct: finiteOrNull(monteCarlo?.riskOfRuinPct),
      recommendedMaxRiskPerTradePct: finiteOrNull(monteCarlo?.recommendedMaxRiskPerTradePct)
    },
    paperDemo: {
      identityStatus: sourceIdentityStatus,
      candidateCount: paperCandidates.length,
      excludedCandidateCount: input.paperDemoState.candidates.length - paperCandidates.length,
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
      availability: frozen ? "available" : "unavailable",
      profileId: frozen?.profileId ?? activeFrozenProfileId ?? "unidentified_profile",
      status: frozen ? "historically_validated_forward_evidence_required" : "no_registered_frozen_evidence",
      historicalTrades: frozen?.evidence.completedTrades ?? null,
      historicalTargetFirstRate: frozen?.evidence.targetFirstRate ?? null,
      historicalAverageR: frozen?.evidence.averageR ?? null,
      historicalProfitFactor: frozen?.evidence.profitFactor ?? null,
      historicalUniqueDates: frozen?.evidence.uniqueDates ?? null,
      rollingWindowsPassed: frozen?.evidence.positiveRollingWindows ?? null,
      rollingWindowsTotal: frozen?.evidence.totalRollingWindows ?? null,
      oosTrades: frozen?.evidence.oosTrades ?? null,
      oosAverageR: frozen?.evidence.oosAverageR ?? null,
      oosProfitFactor: frozen?.evidence.oosProfitFactor ?? null,
      monteCarloRobustness: frozen?.evidence.monteCarloRobustness ?? "not_available",
      forwardCompleted: forward?.completedForwardOutcomes ?? null,
      forwardRequired: FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.completedOutcomes,
      forwardIndependentDates: forward?.independentDates ?? null,
      forwardWindows: forward?.forwardWindows ?? null,
      forwardTargetFirstRate: forward?.targetFirstRate ?? null,
      forwardAverageR: forward?.averageR ?? null,
      reassessmentEligible: forward?.reassessmentEligible ?? false,
      recommendation: forward?.recommendation ?? "frozen_evidence_unavailable"
    },
    predictions: {
      identityStatus: sourceIdentityStatus,
      totalForecasts: predictions.totalForecasts,
      excludedForecasts: input.predictionLedger.entries.length - predictionEntries.length,
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
      setupLabel: chain?.setupLabel ?? frozen?.profileId ?? activeFrozenProfileId ?? "unidentified_profile",
      hypothesisStatus: chain?.hypothesisStatus ?? "unverified",
      chainIdentityStatus,
      replayVerdict: chain?.replayResult?.verdict ?? (replay ? "saved" : "not_run"),
      walkForwardVerdict: chain?.walkForwardResult?.verdict ?? walkForward?.stability?.verdict ?? "not_run",
      evidenceScore: runtime?.evidence.evidenceQualityScore ?? chain?.evidenceQuality?.evidenceQualityScore ?? 0,
      maturityScore: runtime?.maturity.maturityScore ?? chain?.evidenceQuality?.maturityScore ?? 0,
      reportedReadinessState,
      readinessState: effectiveReadinessState,
      readinessIntegrity,
      blockers: progressionBlockers,
      nextAction: progressionBlockers[0] ?? runtime?.readiness.nextAction ?? "Activate Market and run deterministic validation."
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
