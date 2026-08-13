import type { BacktestResult, SimulatedTradeRecord } from "@/lib/backtesting";
import type { ValidationSuiteReport } from "@/lib/validation/validationTypes";
import type {
  ResearchQualityDrawdownCluster,
  ResearchQualityFailureAttribution,
  ResearchQualityFailureCauseSummary,
  ResearchQualityContextAssociationSummary,
  ResearchQualitySessionOutcome,
  ResearchQualityTradeContext,
  ValidationScenarioQualityTelemetry
} from "@/lib/researchQuality/researchQualityFailureAttributionTypes";

const authority = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const unique = (values: Array<string | undefined>) => Array.from(new Set(values.filter((value): value is string => Boolean(value))));
const MIN_ASSOCIATION_COHORT = 5;
const MIN_STOP_RATE_DELTA = 0.15;
const MIN_STOP_RISK_RATIO = 1.25;

const profitFactorFor = (trades: SimulatedTradeRecord[]) => {
  const gains = trades.filter((trade) => trade.rMultiple > 0).reduce((sum, trade) => sum + trade.rMultiple, 0);
  const losses = Math.abs(trades.filter((trade) => trade.rMultiple < 0).reduce((sum, trade) => sum + trade.rMultiple, 0));
  if (losses === 0) return gains > 0 ? 99 : null;
  return round(gains / losses, 2);
};

const maxDrawdownFor = (trades: SimulatedTradeRecord[]) => {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of trades) {
    equity += trade.rMultiple;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return round(maxDrawdown, 2);
};

const causeLabel: Record<string, string> = {
  timing_expired_trade: "Expired timing window",
  weak_profile_trade: "Weak profile accepted",
  entry_confirmation_without_valid_profile: "Entry confirmation without a valid profile",
  missing_intermarket_confirmation: "Missing intermarket confirmation",
  grinch_score_conflict: "Grinch score conflict",
  counter_htf_delivery: "Counter-HTF delivery",
  missing_htf_context: "HTF context unavailable",
  session_window_mismatch: "Session-window mismatch",
  stale_retest: "Stale retest",
  weak_displacement: "Weak displacement",
  missing_external_liquidity_target: "External liquidity target missing",
  low_reward_risk: "Reward/risk below profile requirement",
  unattributed_model_loss: "Unattributed model loss"
};

const contextCauseCodesFor = (trade: SimulatedTradeRecord) => {
  const causes: string[] = [...(trade.grinchScore?.falsePositiveBlockers ?? [])];
  const context = trade.qualityContext as ResearchQualityTradeContext | undefined;
  if (context?.htfAlignment === "against_htf") {
    causes.push("counter_htf_delivery");
  }
  if (context?.htfAlignment === "unavailable") {
    causes.push("missing_htf_context");
  }
  if (context?.sessionPreferred === false) {
    causes.push("session_window_mismatch");
  }
  if (context?.freshRetest === false || (context?.signalAgeBars ?? 0) > 0) {
    causes.push("stale_retest");
  }
  if (context?.displacementConfirmed === false) {
    causes.push("weak_displacement");
  }
  if (context?.liquidityTargetPresent === false) {
    causes.push("missing_external_liquidity_target");
  }
  if (trade.riskReward < 2) {
    causes.push("low_reward_risk");
  }
  return Array.from(new Set(causes));
};

const contextAssociationsFor = (trades: SimulatedTradeRecord[]): ResearchQualityContextAssociationSummary[] => {
  const resolved = trades.filter((trade) => trade.outcome === "target_hit" || trade.outcome === "stop_hit");
  const causeCodes = Array.from(new Set(resolved.flatMap(contextCauseCodesFor)));
  return causeCodes.map((causeCode) => {
    const exposed = resolved.filter((trade) => contextCauseCodesFor(trade).includes(causeCode));
    const comparator = resolved.filter((trade) => !contextCauseCodesFor(trade).includes(causeCode));
    const exposedStops = exposed.filter((trade) => trade.outcome === "stop_hit").length;
    const comparatorStops = comparator.filter((trade) => trade.outcome === "stop_hit").length;
    const exposedRate = exposedStops / Math.max(1, exposed.length);
    const comparatorRate = comparatorStops / Math.max(1, comparator.length);
    const delta = exposedRate - comparatorRate;
    const riskRatio = comparatorRate > 0 ? exposedRate / comparatorRate : exposedRate > 0 && comparator.length ? 99 : null;
    const enoughComparison = exposed.length >= MIN_ASSOCIATION_COHORT && comparator.length >= MIN_ASSOCIATION_COHORT;
    const qualified = enoughComparison && delta >= MIN_STOP_RATE_DELTA && (riskRatio ?? 0) >= MIN_STOP_RISK_RATIO;
    const status = qualified
      ? "qualified_causal_hypothesis" as const
      : enoughComparison
        ? "not_discriminating" as const
        : "insufficient_comparator" as const;
    const evidence = !enoughComparison
      ? `${causeLabel[causeCode] ?? causeCode} was present on ${exposed.length}/${resolved.length} resolved trades; at least ${MIN_ASSOCIATION_COHORT} exposed and ${MIN_ASSOCIATION_COHORT} comparator trades are required before causal attribution.`
      : `${causeLabel[causeCode] ?? causeCode} stop rate ${round(exposedRate * 100, 1)}% (${exposedStops}/${exposed.length}) versus ${round(comparatorRate * 100, 1)}% (${comparatorStops}/${comparator.length}) without the flag; delta ${round(delta * 100, 1)} percentage points.`;
    return {
      causeCode,
      label: causeLabel[causeCode] ?? causeCode.replace(/_/g, " "),
      exposedCompletedCount: exposed.length,
      exposedStopHitCount: exposedStops,
      comparatorCompletedCount: comparator.length,
      comparatorStopHitCount: comparatorStops,
      exposedStopHitRate: round(exposedRate, 4),
      comparatorStopHitRate: round(comparatorRate, 4),
      stopHitRateDelta: round(delta, 4),
      riskRatio: riskRatio === null ? null : round(riskRatio, 3),
      status,
      directlyAttributed: qualified,
      evidence
    };
  }).sort((left, right) =>
    Number(right.directlyAttributed) - Number(left.directlyAttributed) ||
    right.stopHitRateDelta - left.stopHitRateDelta ||
    right.exposedStopHitCount - left.exposedStopHitCount
  );
};

const failureCausesFor = (
  trades: SimulatedTradeRecord[],
  associations = contextAssociationsFor(trades)
): ResearchQualityFailureCauseSummary[] => {
  const rows = new Map<string, {
    directlyAttributed: boolean;
    evidence: string;
    association?: ResearchQualityContextAssociationSummary;
    trades: SimulatedTradeRecord[];
  }>();
  for (const trade of trades.filter((item) => item.bias !== "neutral" && item.outcome === "stop_hit")) {
    const qualified = associations
      .filter((association) => association.directlyAttributed && contextCauseCodesFor(trade).includes(association.causeCode))
      .sort((left, right) => right.stopHitRateDelta - left.stopHitRateDelta)[0];
    const causeCode = qualified?.causeCode ?? "unattributed_model_loss";
    const evidence = qualified?.evidence ??
      "Recorded pre-entry flags did not distinguish this stop from winning trades, or lacked an independent comparator; preserve it as an unattributed model loss.";
    const row = rows.get(causeCode) ?? {
      directlyAttributed: Boolean(qualified),
      evidence,
      association: qualified,
      trades: []
    };
    row.trades.push(trade);
    rows.set(causeCode, row);
  }
  return [...rows.entries()]
    .map(([causeCode, row]) => ({
      causeCode,
      label: causeLabel[causeCode] ?? causeCode.replace(/_/g, " "),
      stopHitCount: row.trades.length,
      totalLostR: round(Math.abs(row.trades.reduce((sum, trade) => sum + Math.min(0, trade.rMultiple), 0)), 2),
      averageConfidence: round(average(row.trades.map((trade) => trade.confidence)), 3),
      averageRiskReward: round(average(row.trades.map((trade) => trade.riskReward)), 2),
      worstR: round(Math.min(...row.trades.map((trade) => trade.rMultiple)), 2),
      sessions: unique(row.trades.map((trade) => trade.session)),
      sides: unique(row.trades.map((trade) => trade.bias)),
      regimes: unique(row.trades.map((trade) => trade.marketRegime)),
      sampleTradeIds: row.trades.slice(0, 5).map((trade) => trade.id),
      directlyAttributed: row.directlyAttributed,
      evidence: row.evidence,
      associationStatus: row.association?.status ?? ("unattributed" as const),
      exposedCompletedCount: row.association?.exposedCompletedCount,
      comparatorCompletedCount: row.association?.comparatorCompletedCount,
      exposedStopHitRate: row.association?.exposedStopHitRate,
      comparatorStopHitRate: row.association?.comparatorStopHitRate,
      stopHitRateDelta: row.association?.stopHitRateDelta
    }))
    .sort((left, right) => right.totalLostR - left.totalLostR || right.stopHitCount - left.stopHitCount);
};

const sessionOutcomesFor = (trades: SimulatedTradeRecord[]): ResearchQualitySessionOutcome[] => {
  const sessions = new Map<string, SimulatedTradeRecord[]>();
  for (const trade of trades) {
    const items = sessions.get(trade.session) ?? [];
    items.push(trade);
    sessions.set(trade.session, items);
  }
  return [...sessions.entries()]
    .map(([session, items]) => {
      const targetHits = items.filter((trade) => trade.outcome === "target_hit");
      const stopHits = items.filter((trade) => trade.outcome === "stop_hit");
      const expired = items.filter((trade) => trade.outcome === "expired").length;
      const resolved = targetHits.length + stopHits.length;
      return {
        session,
        completedTrades: items.length,
        targetHits: targetHits.length,
        stopHits: stopHits.length,
        expired,
        targetFirstRate: round(targetHits.length / Math.max(1, resolved), 3),
        averageR: round(average(items.map((trade) => trade.rMultiple)), 2),
        averageWinR: round(average(targetHits.map((trade) => trade.rMultiple)), 2),
        averageLossR: round(average(stopHits.map((trade) => trade.rMultiple)), 2),
        profitFactor: profitFactorFor(items),
        maxDrawdownR: maxDrawdownFor(items)
      };
    })
    .sort((left, right) => right.completedTrades - left.completedTrades);
};

const drawdownRisk = (maxDrawdownR: number) => maxDrawdownR >= 4 ? "red" as const : maxDrawdownR >= 2 ? "yellow" as const : "green" as const;

const drawdownClustersFor = (
  sourceTrades: SimulatedTradeRecord[],
  associations: ResearchQualityContextAssociationSummary[]
): ResearchQualityDrawdownCluster[] => {
  const trades = [...sourceTrades].sort((left, right) => Date.parse(left.resolvedAt) - Date.parse(right.resolvedAt) || left.exitIndex - right.exitIndex);
  const clusters: ResearchQualityDrawdownCluster[] = [];
  let equity = 0;
  let peak = 0;
  let active: SimulatedTradeRecord[] = [];
  let activePeak = 0;
  let activeMaxDrawdown = 0;

  const closeCluster = (recovered: boolean) => {
    if (!active.length) return;
    const causes = failureCausesFor(active, associations);
    const cumulativeR = active.reduce((sum, trade) => sum + trade.rMultiple, 0);
    clusters.push({
      clusterId: `drawdown_${clusters.length + 1}`,
      startAt: active[0].resolvedAt,
      endAt: active.at(-1)!.resolvedAt,
      tradeCount: active.length,
      stopHitCount: active.filter((trade) => trade.outcome === "stop_hit").length,
      cumulativeR: round(cumulativeR, 2),
      maxDrawdownR: round(activeMaxDrawdown, 2),
      recovered,
      sessions: unique(active.map((trade) => trade.session)),
      sides: unique(active.map((trade) => trade.bias)),
      dominantFailureCause: causes[0]?.causeCode,
      sampleTradeIds: active.slice(0, 6).map((trade) => trade.id),
      risk: drawdownRisk(activeMaxDrawdown)
    });
    active = [];
    activeMaxDrawdown = 0;
  };

  for (const trade of trades) {
    const priorPeak = peak;
    equity += trade.rMultiple;
    if (!active.length && equity < priorPeak) {
      activePeak = priorPeak;
      active = [trade];
    } else if (active.length) {
      active.push(trade);
    }
    if (active.length) {
      activeMaxDrawdown = Math.max(activeMaxDrawdown, activePeak - equity);
      if (equity >= activePeak) closeCluster(true);
    }
    peak = Math.max(peak, equity);
  }
  closeCluster(false);
  return clusters.sort((left, right) => right.maxDrawdownR - left.maxDrawdownR).slice(0, 12);
};

export function buildValidationScenarioQualityTelemetry(result: BacktestResult): ValidationScenarioQualityTelemetry {
  const trades = result.trades.filter((trade) => trade.bias !== "neutral");
  const targetHits = trades.filter((trade) => trade.outcome === "target_hit").length;
  const stopHits = trades.filter((trade) => trade.outcome === "stop_hit").length;
  const expired = trades.filter((trade) => trade.outcome === "expired").length;
  const neutral = result.trades.length - trades.length;
  const contextAssociations = contextAssociationsFor(trades);
  const causes = failureCausesFor(trades, contextAssociations);
  const attributedStopHitCount = causes.filter((cause) => cause.directlyAttributed).reduce((sum, cause) => sum + cause.stopHitCount, 0);
  const stopHitTrades = trades.filter((trade) => trade.outcome === "stop_hit");
  const contextEvaluatedStopHitCount = stopHitTrades.filter((trade) => Boolean(trade.qualityContext)).length;
  const wins = trades.filter((trade) => trade.outcome === "target_hit");
  const losses = trades.filter((trade) => trade.outcome === "stop_hit");
  return {
    schemaVersion: 1,
    basis: "completed_simulated_trade_outcomes",
    completedTradeCount: trades.length,
    targetHitCount: targetHits,
    stopHitCount: stopHits,
    expiredCount: expired,
    neutralCount: neutral,
    averageWinR: round(average(wins.map((trade) => trade.rMultiple)), 2),
    averageLossR: round(average(losses.map((trade) => trade.rMultiple)), 2),
    stopHitRate: round(stopHits / Math.max(1, targetHits + stopHits), 3),
    attributedStopHitCount,
    unattributedStopHitCount: Math.max(0, stopHits - attributedStopHitCount),
    contextEvaluatedStopHitCount,
    contextEvaluationCoverage: round(contextEvaluatedStopHitCount / Math.max(1, stopHits), 3),
    attributionCoverage: round(attributedStopHitCount / Math.max(1, stopHits), 3),
    failureCauses: causes,
    contextAssociations,
    sessionOutcomes: sessionOutcomesFor(trades),
    drawdownClusters: drawdownClustersFor(trades, contextAssociations),
    rejectedContexts: result.summary.skipReasons.slice(0, 12).map((item) => ({
      reason: item.reason,
      count: item.count,
      classification: "rejected_context_not_false_positive" as const
    })),
    authority,
    safety: {
      rawCandlesExcluded: true,
      fullTradeRecordsExcluded: true,
      accountOrderPositionDataExcluded: true,
      evidenceCreationAllowed: false,
      readinessPromotionAllowed: false
    }
  };
}

const canonicalScenarioFor = (report: ValidationSuiteReport) =>
  report.scenarios.find((scenario) => scenario.id === "conservative-confluence" && scenario.qualityTelemetry) ??
  [...report.scenarios]
    .filter((scenario) => scenario.qualityTelemetry)
    .sort((left, right) => (right.qualityTelemetry?.completedTradeCount ?? 0) - (left.qualityTelemetry?.completedTradeCount ?? 0))[0];

const recommendedExperimentFor = (cause?: ResearchQualityFailureCauseSummary) => {
  if (!cause || !cause.directlyAttributed) {
    return "No recorded context flag currently discriminates losses from winners. Preserve the frozen profile, collect untouched forward outcomes, and add a genuine HTF comparator before testing an exclusion.";
  }
  if (cause.causeCode.includes("session") || cause.causeCode.includes("timing")) {
    return "Test one session/timing exclusion against the unchanged frozen baseline.";
  }
  if (cause.causeCode.includes("htf")) {
    return "Test one HTF-alignment requirement against the unchanged frozen baseline.";
  }
  if (cause.causeCode.includes("displacement") || cause.causeCode.includes("entry_confirmation")) {
    return "Test one displacement/entry-confirmation requirement against the unchanged frozen baseline.";
  }
  if (cause.causeCode.includes("liquidity") || cause.causeCode.includes("reward_risk")) {
    return "Test one target-geometry requirement against the unchanged frozen baseline.";
  }
  return `Exclude only ${cause.label.toLowerCase()} in a new candidate profile and rerun frozen chronological OOS validation.`;
};

export function buildResearchQualityFailureAttribution(report: ValidationSuiteReport): ResearchQualityFailureAttribution {
  const scenario = canonicalScenarioFor(report);
  const telemetry = scenario?.qualityTelemetry;
  const topFailureCause = telemetry?.failureCauses.find((cause) => cause.directlyAttributed) ?? telemetry?.failureCauses[0];
  const contextAssociations = telemetry?.contextAssociations ?? [];
  const topContextAssociation = contextAssociations.find((association) => association.directlyAttributed) ??
    contextAssociations[0];
  const blockers = [
    telemetry ? undefined : "completed_trade_telemetry_missing",
    telemetry && telemetry.stopHitCount > 0 && telemetry.contextEvaluationCoverage < 0.9
      ? "false_positive_context_coverage_below_90_percent"
      : undefined,
    telemetry?.drawdownClusters.some((cluster) => cluster.risk === "red") ? "red_chronological_drawdown_cluster_present" : undefined
  ].filter((item): item is string => Boolean(item));
  const recommendedExperiment = recommendedExperimentFor(topFailureCause);
  return {
    id: `quality_attribution_${report.id}`,
    generatedAt: new Date().toISOString(),
    sourceValidationId: report.id,
    sourceProvider: report.provenance?.sourceProvider,
    requestedSymbol: report.provenance?.requestedSymbol,
    brokerSymbol: report.provenance?.brokerSymbol,
    timeframe: report.provenance?.timeframe,
    sourceFingerprint: report.provenance?.sourceFingerprint,
    strategyProfile: report.provenance?.strategyProfile ?? scenario?.config.strategyProfile,
    strategyProfileVersion: report.provenance?.strategyProfileVersion,
    parameterFingerprint: report.provenance?.parameterFingerprint,
    canonicalScenarioId: scenario?.id,
    canonicalScenarioName: scenario?.name,
    completedTradeCount: telemetry?.completedTradeCount ?? 0,
    targetHitCount: telemetry?.targetHitCount ?? 0,
    stopHitCount: telemetry?.stopHitCount ?? 0,
    expiredCount: telemetry?.expiredCount ?? 0,
    stopHitRate: telemetry?.stopHitRate ?? 0,
    attributedStopHitCount: telemetry?.attributedStopHitCount ?? 0,
    unattributedStopHitCount: telemetry?.unattributedStopHitCount ?? 0,
    contextEvaluatedStopHitCount: telemetry?.contextEvaluatedStopHitCount ?? 0,
    contextEvaluationCoverage: telemetry?.contextEvaluationCoverage ?? 0,
    attributionCoverage: telemetry?.attributionCoverage ?? 0,
    failureCauses: telemetry?.failureCauses ?? [],
    contextAssociations,
    sessionMatrix: telemetry?.sessionOutcomes ?? [],
    drawdownClusters: telemetry?.drawdownClusters ?? [],
    rejectedContexts: telemetry?.rejectedContexts ?? [],
    topFailureCause: topFailureCause?.directlyAttributed ? topFailureCause : undefined,
    topContextAssociation,
    recommendedExperiment,
    nextAction: blockers.length
      ? `${recommendedExperiment} Resolve: ${blockers.join(", ")}.`
      : `${recommendedExperiment} A draft experiment still cannot create evidence or promote readiness by itself.`,
    blockers,
    authority,
    safety: {
      rawCandlesExcluded: true,
      rawSnapshotsExcluded: true,
      secretsExcluded: true,
      accountOrderPositionDataExcluded: true,
      evidenceCreationAllowed: false,
      readinessPromotionAllowed: false,
      profileMutationAllowed: false
    }
  };
}
