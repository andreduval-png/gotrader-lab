import {
  FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS,
  evaluateForwardEvidenceLedger,
  getFrozenResearchProfile
} from "@/lib/forwardEvidence";
import { evaluatePredictionCalibration } from "@/lib/predictionLedger";
import { matchValidationProvenance, type ValidationProvenanceIdentity } from "@/lib/validationProvenance";
import {
  RESULTS_WORKSPACE_AUTHORITY,
  type ResultsWorkspaceBuildInput,
  type ResultsSectionProvenance,
  type ResultsWorkspaceSnapshot
} from "./resultsWorkspaceTypes";

const finiteOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const uniqueStrings = (values: Array<string | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].slice(0, 12);

const unavailable = (sourceType: string, reason: string, sourceId?: string): ResultsSectionProvenance => ({
  relationship: "unavailable",
  sourceType,
  sourceId,
  identityMatched: false,
  reason
});

const currentEvidence = ({
  sourceType,
  sourceId,
  generatedAt,
  identity,
  currentIdentity,
  sourceCycleId,
  currentCycleId
}: {
  sourceType: string;
  sourceId?: string;
  generatedAt?: string;
  identity?: ValidationProvenanceIdentity;
  currentIdentity?: ValidationProvenanceIdentity;
  sourceCycleId?: string;
  currentCycleId?: string;
}): ResultsSectionProvenance => {
  if (!currentCycleId) return unavailable(sourceType, "No completed current research cycle is available.", sourceId);
  if (!identity || !currentIdentity) return unavailable(sourceType, "Exact current-cycle provenance is unavailable.", sourceId);
  const review = matchValidationProvenance(currentIdentity, identity);
  if (!review.matched) return unavailable(sourceType, review.summary, sourceId);
  if (!sourceCycleId) {
    return {
      relationship: "historical_evidence",
      sourceType,
      sourceId,
      sourceCycleId,
      generatedAt,
      identity,
      identityMatched: true,
      reason: `Identity matches, but the evidence has no immutable binding to current cycle ${currentCycleId}.`
    };
  }
  if (sourceCycleId !== currentCycleId) {
    return {
      relationship: "historical_evidence",
      sourceType,
      sourceId,
      sourceCycleId,
      generatedAt,
      identity,
      identityMatched: true,
      reason: `Identity matches, but the evidence belongs to historical cycle ${sourceCycleId}, not current cycle ${currentCycleId}.`
    };
  }
  return { relationship: "current_cycle", sourceType, sourceId, sourceCycleId, generatedAt, identity, identityMatched: true, reason: `Identity matches current cycle ${currentCycleId}.` };
};

const historicalEvidence = (sourceType: string, sourceId: string, identity: ValidationProvenanceIdentity, reason: string): ResultsSectionProvenance => ({
  relationship: "historical_evidence",
  sourceType,
  sourceId,
  identity,
  identityMatched: true,
  reason
});

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
  const currentCycleId = runtime?.latestResearchCycle.latestCycleId;
  const currentIdentity = runtime?.researchIdentity.active;
  const activeSourceMatchesCurrentCycle = Boolean(
    source &&
    currentCycleId &&
    currentIdentity &&
    source.provider === currentIdentity.sourceProvider &&
    source.timeframe === currentIdentity.timeframe &&
    source.fingerprint === currentIdentity.sourceFingerprint &&
    (runtime?.marketData.symbol ?? "") === currentIdentity.requestedSymbol &&
    (runtime?.mt5ReadOnly.brokerSymbol ?? source.provenance.providerSymbol ?? "") === currentIdentity.brokerSymbol
  );
  const activeFrozenProfileId =
    runtime?.researchIdentity?.active.strategyProfile ??
    runtime?.latestResearchCycle.latestValidationSummary?.provenance?.strategyProfile ??
    runtime?.activeConfig.resolvedBacktestConfig.strategyProfile;
  const frozen = getFrozenResearchProfile(activeFrozenProfileId ?? "");
  const forward = frozen ? evaluateForwardEvidenceLedger(input.forwardEvidenceEntries, frozen.profileId) : undefined;
  const predictions = evaluatePredictionCalibration(input.predictionLedger.entries);
  const currentMetrics = metrics?.sourceCycleId === currentCycleId && currentCycleId ? metrics : undefined;
  const backtestProvenance = currentMetrics
    ? { relationship: "current_cycle", sourceType: "canonical_cycle_metrics", sourceId: currentMetrics.sourceCycleId, sourceCycleId: currentMetrics.sourceCycleId, generatedAt: currentMetrics.generatedAt, identity: currentIdentity, identityMatched: true, reason: `Canonical metrics are attached to current cycle ${currentCycleId}.` } satisfies ResultsSectionProvenance
    : unavailable("canonical_cycle_metrics", metrics?.sourceCycleId ? `Metrics belong to cycle ${metrics.sourceCycleId}, not the current cycle.` : "Current-cycle canonical metrics are missing.", metrics?.sourceCycleId);
  const replayProvenance = currentEvidence({ sourceType: "ict_replay_snapshot", sourceId: replay?.runId, generatedAt: replay?.generatedAt, identity: replay?.provenance, currentIdentity, sourceCycleId: replay?.sourceCycleId ?? (replay?.runId === currentCycleId ? replay?.runId : undefined), currentCycleId });
  const walkForwardProvenance = currentEvidence({ sourceType: "walk_forward_run", sourceId: walkForward?.runId, generatedAt: walkForward?.completedAt ?? walkForward?.startedAt, identity: walkForward?.provenance, currentIdentity, sourceCycleId: walkForward?.sourceCycleId, currentCycleId });
  const monteCarloProvenance = currentEvidence({ sourceType: "ict_monte_carlo_snapshot", generatedAt: monteCarlo?.generatedAt, identity: monteCarlo?.provenance, currentIdentity, sourceCycleId: monteCarlo?.sourceCycleId, currentCycleId });
  const chainProvenance = currentEvidence({ sourceType: "validation_chain", sourceId: chain?.recognitionId, generatedAt: chain?.updatedAt, identity: chain?.provenance, currentIdentity, sourceCycleId: chain?.sourceCycleId, currentCycleId });
  const replayCurrent = replayProvenance.relationship === "current_cycle" ? replay : undefined;
  const walkForwardCurrent = walkForwardProvenance.relationship === "current_cycle" ? walkForward : undefined;
  const monteCarloCurrent = monteCarloProvenance.relationship === "current_cycle" ? monteCarlo : undefined;
  const chainCurrent = chainProvenance.relationship === "current_cycle" ? chain : undefined;
  const oos = walkForwardCurrent?.stability?.edgeStatistics?.provenance === "out_of_sample"
    ? walkForwardCurrent.stability.edgeStatistics
    : undefined;
  const runtimeBlockers = runtime?.readiness.actualBlockers ?? [];

  const snapshot: ResultsWorkspaceSnapshot = {
    generatedAt: new Date().toISOString(),
    currentCycleId,
    currentIdentity,
    provenance: {
      source: activeSourceMatchesCurrentCycle
        ? { relationship: "current_cycle", sourceType: "canonical_research_source", sourceId: source!.fingerprint, sourceCycleId: currentCycleId, generatedAt: runtime?.generatedAt, identity: currentIdentity, identityMatched: true, reason: `Canonical active research source for current cycle ${currentCycleId}.` }
        : unavailable("canonical_research_source", source ? "The active source does not exactly match the completed current-cycle source identity." : "Active canonical research source is unavailable.", source?.fingerprint),
      backtest: backtestProvenance,
      replay: replayProvenance,
      walkForward: walkForwardProvenance,
      monteCarlo: monteCarloProvenance,
      paperDemo: { relationship: "historical_evidence", sourceType: "paper_demo_operations_ledger", generatedAt: input.paperDemoState.updatedAt, identityMatched: true, reason: "Counts come directly from the local research-only Paper Demo operations ledger." },
      frozenProfile: frozen ? historicalEvidence("frozen_profile_registry", frozen.profileId, { strategyProfile: frozen.profileId, strategyProfileVersion: frozen.profileVersion }, "Immutable frozen-profile evidence; historical and separate from the current cycle.") : unavailable("frozen_profile_registry", activeFrozenProfileId ? `No frozen profile is registered for ${activeFrozenProfileId}.` : "No active strategy profile identity is available."),
      predictions: { relationship: "historical_evidence", sourceType: "prediction_ledger", generatedAt: input.predictionLedger.updatedAt, identityMatched: true, reason: "Metrics are computed directly from stored causal prediction-ledger entries." },
      validation: chainProvenance,
      datedOutcomes: { relationship: "historical_evidence", sourceType: "lab_state_outcome_ledger", identityMatched: true, reason: `${input.datedOutcomeCount ?? 0} stored simulation outcome record(s); global ledger evidence, not current-cycle metrics.` },
      tradePlans: { relationship: "historical_evidence", sourceType: "browser_trade_plan_ledger", identityMatched: true, reason: `${input.tradePlanRecordCount ?? 0} identity-bearing trade-plan record(s) in the current browser-origin ledger; mutable local evidence, not certified evidence.` }
    },
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
      status: backtestProvenance.relationship === "current_cycle" ? "available" : "missing",
      cycleId: backtestProvenance.relationship === "current_cycle" ? metrics?.sourceCycleId : undefined,
      totalTrades: backtestProvenance.relationship === "current_cycle" ? finiteOrNull(metrics?.totalTrades) : null,
      winningTrades: backtestProvenance.relationship === "current_cycle" ? finiteOrNull(metrics?.winningTrades) : null,
      losingTrades: backtestProvenance.relationship === "current_cycle" ? finiteOrNull(metrics?.losingTrades) : null,
      winRate: backtestProvenance.relationship === "current_cycle" ? finiteOrNull(metrics?.winRate) : null,
      averageR: backtestProvenance.relationship === "current_cycle" ? finiteOrNull(metrics?.averageR) : null,
      profitFactor: backtestProvenance.relationship === "current_cycle" ? finiteOrNull(metrics?.profitFactor) : null,
      maxDrawdownR: backtestProvenance.relationship === "current_cycle" ? finiteOrNull(metrics?.maxDrawdownR) : null,
      realizedPnL: backtestProvenance.relationship === "current_cycle" ? finiteOrNull(metrics?.realizedPnL) : null,
      metricSource: backtestProvenance.reason
    },
    replay: {
      status: replayCurrent ? "available" : "missing",
      runId: replayCurrent?.runId,
      totalSignals: finiteOrNull(replayCurrent?.totalSignals),
      targetFirstRate: finiteOrNull(replayCurrent?.targetFirstRate),
      approvedTargetFirstRate: finiteOrNull(replayCurrent?.approvedTargetFirstRate),
      averageRrAchieved: finiteOrNull(replayCurrent?.averageRrAchieved),
      approvedAverageRr: finiteOrNull(replayCurrent?.approvedAverageRr),
      verdict: chainCurrent?.replayResult?.verdict ?? (replayCurrent ? "saved" : "unavailable")
    },
    walkForward: {
      status: walkForwardCurrent?.status ?? "unavailable",
      runId: walkForwardCurrent?.runId,
      verdict: walkForwardCurrent?.stability?.verdict ?? chainCurrent?.walkForwardResult?.verdict ?? "unavailable",
      windows: finiteOrNull(walkForwardCurrent?.stability?.windowCount ?? walkForwardCurrent?.actualWindowsGenerated),
      windowsPassed: finiteOrNull(walkForwardCurrent?.stability?.outOfSampleWindowsPassed ?? chainCurrent?.walkForwardResult?.oosWindowsPassed),
      oosTrades: finiteOrNull(oos?.sampleSize ?? chainCurrent?.walkForwardResult?.tradeCount),
      oosAverageR: finiteOrNull(oos?.meanR),
      oosLower95: finiteOrNull(oos?.expectancyLower95),
      overfitRisk: walkForwardCurrent?.stability?.overfitRisk ?? "unavailable",
      provenanceStatus: walkForwardProvenance.relationship
    },
    monteCarlo: {
      status: monteCarloCurrent ? "available" : "missing",
      robustness: monteCarloCurrent?.robustnessRating ?? "unavailable",
      usableOutcomes: finiteOrNull(monteCarloCurrent?.usableOutcomes),
      medianEndingR: finiteOrNull(monteCarloCurrent?.medianEndingR),
      fifthPercentileEndingR: finiteOrNull(monteCarloCurrent?.fifthPercentileEndingR),
      medianMaxDrawdownPct: finiteOrNull(monteCarloCurrent?.medianMaxDrawdownPct),
      worstMaxDrawdownPct: finiteOrNull(monteCarloCurrent?.worstMaxDrawdownPct),
      riskOfRuinPct: finiteOrNull(monteCarloCurrent?.riskOfRuinPct),
      recommendedMaxRiskPerTradePct: finiteOrNull(monteCarloCurrent?.recommendedMaxRiskPerTradePct)
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
      profileId: frozen?.profileId ?? null,
      status: frozen ? "historically_validated_forward_evidence_required" : "unavailable",
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
      monteCarloRobustness: frozen?.evidence.monteCarloRobustness ?? null,
      forwardCompleted: forward?.completedForwardOutcomes ?? null,
      forwardRequired: FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.completedOutcomes,
      forwardIndependentDates: forward?.independentDates ?? null,
      forwardWindows: forward?.forwardWindows ?? null,
      forwardTargetFirstRate: forward?.targetFirstRate ?? null,
      forwardAverageR: forward?.averageR ?? null,
      reassessmentEligible: forward?.reassessmentEligible ?? false,
      recommendation: forward?.recommendation ?? "Unavailable until an exact frozen profile identity is registered."
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
      setupLabel: chainCurrent?.setupLabel ?? activeFrozenProfileId ?? "unavailable",
      hypothesisStatus: chainCurrent?.hypothesisStatus ?? "unavailable",
      replayVerdict: chainCurrent?.replayResult?.verdict ?? "unavailable",
      walkForwardVerdict: chainCurrent?.walkForwardResult?.verdict ?? "unavailable",
      evidenceScore: chainCurrent ? finiteOrNull(runtime?.evidence.evidenceQualityScore ?? chainCurrent.evidenceQuality?.evidenceQualityScore) : null,
      maturityScore: chainCurrent ? finiteOrNull(runtime?.maturity.maturityScore ?? chainCurrent.evidenceQuality?.maturityScore) : null,
      readinessState: chainCurrent ? runtime?.readiness.readinessState ?? "not_evaluated" : "unavailable",
      blockers: uniqueStrings([...runtimeBlockers, ...(chainCurrent?.blockers ?? []), ...(forward?.blockers ?? []), chainProvenance.relationship === "unavailable" ? chainProvenance.reason : undefined]),
      nextAction: chainCurrent?.nextAction ?? forward?.blockers[0] ?? "Activate Market and run identity-matched deterministic validation."
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
  assertResultsWorkspaceSourceTruth(snapshot);
  return snapshot;
}

export const assertResultsWorkspaceSourceTruth = (snapshot: ResultsWorkspaceSnapshot) => {
  const currentSections = Object.values(snapshot.provenance).filter((item) => item.relationship === "current_cycle");
  if (currentSections.length && !snapshot.currentCycleId) {
    throw new Error("Results current-cycle evidence is missing the current cycle identity.");
  }
  if (currentSections.some((item) => item.sourceCycleId !== snapshot.currentCycleId)) {
    throw new Error("Results current-cycle evidence is not immutably bound to the exact current cycle.");
  }
  if (snapshot.provenance.backtest.relationship !== "current_cycle" && (
    snapshot.backtest.status !== "missing" ||
    snapshot.backtest.totalTrades !== null ||
    snapshot.backtest.realizedPnL !== null
  )) {
    throw new Error("Results backtest values must be unavailable when current-cycle identity does not match.");
  }
  if (snapshot.provenance.replay.relationship !== "current_cycle" && (
    snapshot.replay.status !== "missing" || snapshot.replay.totalSignals !== null
  )) {
    throw new Error("Results replay values must be unavailable when current-cycle provenance does not match.");
  }
  if (snapshot.provenance.walkForward.relationship !== "current_cycle" && (
    snapshot.walkForward.windows !== null || snapshot.walkForward.oosTrades !== null
  )) {
    throw new Error("Results walk-forward values must be unavailable when current-cycle provenance does not match.");
  }
  if (snapshot.provenance.monteCarlo.relationship !== "current_cycle" && (
    snapshot.monteCarlo.status !== "missing" || snapshot.monteCarlo.usableOutcomes !== null
  )) {
    throw new Error("Results Monte Carlo values must be unavailable when current-cycle provenance does not match.");
  }
  if (snapshot.provenance.validation.relationship !== "current_cycle" && (
    snapshot.validation.evidenceScore !== null || snapshot.validation.maturityScore !== null
  )) {
    throw new Error("Results validation scores must be unavailable when current-cycle provenance does not match.");
  }
  if (snapshot.frozenProfile.status === "unavailable" && (
    snapshot.frozenProfile.profileId !== null || snapshot.frozenProfile.historicalTrades !== null
  )) {
    throw new Error("Unknown frozen profiles must not inherit another profile's evidence.");
  }
  return true;
};

export const assertResultsWorkspaceSnapshotIsCompact = (snapshot: ResultsWorkspaceSnapshot) => {
  assertResultsWorkspaceSourceTruth(snapshot);
  const serialized = JSON.stringify(snapshot);
  if (/"(?:candles|rawCandles|rawRuntimeSnapshot|accountData|orderData|positionData|apiKey|token|password)"\s*:/i.test(serialized)) {
    throw new Error("Results workspace snapshot contains forbidden raw or sensitive fields.");
  }
  if (Object.values(snapshot.authority).some((value) => value !== "none")) {
    throw new Error("Results workspace authority must remain none/none/none.");
  }
  return true;
};
