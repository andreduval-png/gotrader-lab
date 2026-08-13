import {
  defaultBacktestConfig,
  loadBacktestConfig,
  sanitizeBacktestConfig
} from "@/lib/backtesting";
import type {
  BacktestAgentWeights,
  BacktestConfig,
  BacktestSessionFilter,
  ResolvedBacktestConfig
} from "@/lib/backtesting/backtestTypes";
import {
  applyProposalChangesToConfig,
  summarizeValidationMetrics
} from "@/lib/selfImprovement/evaluateCalibrationProposal";
import { resolveActiveBacktestConfig } from "@/lib/selfImprovement/approveCalibrationProposal";
import type {
  CalibrationProposal,
  CalibrationProposalChanges,
  CalibrationProposalSource,
  CalibrationTargetProblem
} from "@/lib/selfImprovement/selfImprovementTypes";
import { loadResearchEvidenceAggregateIndex } from "@/lib/researchEvidenceLedger";
import { uid } from "@/lib/utils";
import { loadLatestResearchQualityReview } from "@/lib/researchQuality";
import { loadLatestValidationReport } from "@/lib/validation";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const sessionFilterFromScenario = (scenarioName?: string): BacktestSessionFilter | undefined => {
  if (!scenarioName) {
    return undefined;
  }
  if (scenarioName.includes("NY AM")) {
    return "NY AM Kill Zone";
  }
  if (scenarioName.includes("London")) {
    return "London";
  }
  if (scenarioName.includes("New York")) {
    return "New York";
  }
  if (scenarioName.includes("Asia")) {
    return "Asia";
  }
  return undefined;
};

const safeConfig = (config: BacktestConfig | ResolvedBacktestConfig) => sanitizeBacktestConfig(config);

const proposeAgentWeightChange = (config: ResolvedBacktestConfig): Partial<BacktestAgentWeights> => {
  const validation = loadLatestValidationReport();
  const decrease = validation?.calibration.agentWeightsToDecrease[0];
  const increase = validation?.calibration.agentWeightsToIncrease[0];
  const changes: Partial<BacktestAgentWeights> = {};

  if (decrease?.agentId && decrease.agentId in config.agentWeights) {
    const key = decrease.agentId as keyof BacktestAgentWeights;
    changes[key] = round(Math.max(0.05, config.agentWeights[key] - 0.04), 3);
  }
  if (increase?.agentId && increase.agentId in config.agentWeights) {
    const key = increase.agentId as keyof BacktestAgentWeights;
    changes[key] = round(Math.min(1.5, config.agentWeights[key] + 0.04), 3);
  }

  return changes;
};

const detectTargetProblem = (): CalibrationTargetProblem => {
  const validation = loadLatestValidationReport();
  const quality = loadLatestResearchQualityReview();
  const weaknessText = quality?.topWeaknesses.map((weakness) => `${weakness.title} ${weakness.detail}`).join(" ").toLowerCase() ?? "";
  const averageWinRate = validation
    ? validation.scenarios.reduce((sum, scenario) => sum + scenario.winRate, 0) / Math.max(1, validation.scenarios.length)
    : 0;
  const averageR = validation
    ? validation.scenarios.reduce((sum, scenario) => sum + scenario.averageR, 0) / Math.max(1, validation.scenarios.length)
    : 0;
  const maxDrawdown = validation ? Math.max(...validation.scenarios.map((scenario) => scenario.maxDrawdown)) : 0;
  const averageCalibration = validation
    ? validation.scenarios.reduce((sum, scenario) => sum + scenario.confidenceCalibration.score, 0) /
      Math.max(1, validation.scenarios.length)
    : 1;

  if (maxDrawdown > 4 || weaknessText.includes("drawdown")) {
    return "high_drawdown";
  }
  if ((quality?.falsePositivePatterns[0]?.estimatedFalsePositives ?? 0) > 0 || weaknessText.includes("false positive")) {
    return "false_positives";
  }
  if (averageWinRate > 0 && averageWinRate < 0.48) {
    return "low_win_rate";
  }
  if (averageR < 0.05 || weaknessText.includes("average r")) {
    return "weak_average_r";
  }
  if (averageCalibration < 0.55 || weaknessText.includes("confidence")) {
    return "poor_confidence_calibration";
  }
  if (weaknessText.includes("session") || weaknessText.includes("london") || weaknessText.includes("ny am")) {
    return "poor_session_performance";
  }
  if ((validation?.calibration.agentWeightsToDecrease.length ?? 0) > 0) {
    return "unstable_agent_weight";
  }
  return "overfitting_risk";
};

const proposedChangesFor = (
  targetProblem: CalibrationTargetProblem,
  config: ResolvedBacktestConfig
): CalibrationProposalChanges => {
  const validation = loadLatestValidationReport();
  const quality = loadLatestResearchQualityReview();
  const bestSession =
    sessionFilterFromScenario([...((quality?.sessionComparison) ?? [])].sort((a, b) => b.averageR - a.averageR)[0]?.scenarioName) ??
    sessionFilterFromScenario(validation?.calibration.bestSession);

  switch (targetProblem) {
    case "high_drawdown":
      return {
        confluenceThreshold: round(clamp01(config.minimumConfluenceThreshold + 0.07), 2),
        confidenceThreshold: round(clamp01(config.minimumConfidenceThreshold + 0.04), 2)
      };
    case "low_win_rate":
      return {
        confidenceThreshold: round(clamp01(config.minimumConfidenceThreshold + 0.06), 2)
      };
    case "weak_average_r":
      return {
        targetRMultiple: round(Math.min(3.5, config.targetRMultiple + 0.25), 2)
      };
    case "false_positives":
      return {
        confidenceThreshold: round(clamp01(config.minimumConfidenceThreshold + 0.08), 2)
      };
    case "poor_session_performance":
      return {
        sessionFilter: bestSession ?? "NY AM Kill Zone"
      };
    case "poor_confidence_calibration":
      return {
        confidenceThreshold: round(clamp01(config.minimumConfidenceThreshold + 0.05), 2)
      };
    case "unstable_agent_weight":
      return {
        agentWeights: proposeAgentWeightChange(config)
      };
    case "overfitting_risk":
    default:
      return {
        confluenceThreshold: round(clamp01(Math.max(config.minimumConfluenceThreshold, 0.5)), 2)
      };
  }
};

const reasonFor = (targetProblem: CalibrationTargetProblem) => {
  const quality = loadLatestResearchQualityReview();
  const attribution = quality?.failureAttribution;
  if (attribution?.blockers.includes("false_positive_context_coverage_below_90_percent")) {
    return `Pre-entry context coverage is incomplete (${Math.round((attribution.contextEvaluationCoverage ?? 0) * 100)}% evaluated). ${attribution.recommendedExperiment}`;
  }
  if (attribution?.topFailureCause) {
    return `${attribution.topFailureCause.label}: ${attribution.topFailureCause.evidence} ${attribution.recommendedExperiment}`;
  }
  const topWeakness = quality?.topWeaknesses[0];
  if (topWeakness) {
    return `${topWeakness.title}: ${topWeakness.detail}`;
  }

  const validation = loadLatestValidationReport();
  if (validation) {
    return `Validation calibration flagged ${validation.calibration.weakestScenario} as the weakest scenario.`;
  }

  return `Internal proposal created because ${targetProblem.replace(/_/g, " ")} needs baseline simulation testing.`;
};

const lifetimeEvidenceFor = (
  currentConfig: ResolvedBacktestConfig,
  validationReport: NonNullable<ReturnType<typeof loadLatestValidationReport>>
): CalibrationProposal["lifetimeEvidenceContext"] => {
  const provenance = validationReport.provenance;
  const strategyProfile = provenance?.strategyProfile ?? currentConfig.strategyProfile;
  const aggregate = loadResearchEvidenceAggregateIndex().aggregates.find((item) =>
    item.identity.strategyProfile === strategyProfile &&
    (!provenance?.strategyProfileVersion || item.identity.strategyProfileVersion === provenance.strategyProfileVersion) &&
    (!provenance?.parameterFingerprint || item.identity.parameterFingerprint === provenance.parameterFingerprint) &&
    (!provenance?.sourceProvider || item.identity.sourceProvider === provenance.sourceProvider) &&
    (!provenance?.requestedSymbol || item.identity.requestedSymbol === provenance.requestedSymbol) &&
    (!provenance?.brokerSymbol || item.identity.brokerSymbol === provenance.brokerSymbol) &&
    (!provenance?.timeframe || item.identity.timeframe === provenance.timeframe)
  );
  if (!aggregate) return undefined;
  return {
    identityKey: aggregate.identity.identityKey,
    strategyProfile: aggregate.identity.strategyProfile,
    cycleCount: aggregate.cycleCount,
    independentCycleDates: aggregate.independentCycleDates,
    sourceFingerprintCount: aggregate.sourceFingerprintCount,
    totalTrades: aggregate.totalTrades,
    weightedAverageR: aggregate.weightedAverageR,
    totalRealizedR: aggregate.totalRealizedR,
    worstMaxDrawdownR: aggregate.worstMaxDrawdownR,
    positiveEdgeCycles: aggregate.positiveEdgeCycles,
    oosTrades: aggregate.oosTrades,
    oosWindowsPassed: aggregate.oosWindowsPassed,
    oosWindowsTested: aggregate.oosWindowsTested,
    recurringBlockers: aggregate.recurringBlockers.map((item) => `${item.blocker} (${item.occurrences})`),
    latestReadinessState: aggregate.latestReadinessState,
    evidenceAuthority: "historical_context_only"
  };
};

export function createCalibrationProposal(source: CalibrationProposalSource = "openclaw"): CalibrationProposal {
  const currentConfig = safeConfig(resolveActiveBacktestConfig().config ?? loadBacktestConfig() ?? defaultBacktestConfig);
  // Fail closed: proposals must be grounded in a real validation report, never
  // in a mock-candle validation suite that fabricates baseline metrics.
  const validationReport = loadLatestValidationReport();
  if (!validationReport) {
    throw new Error(
      "Cannot create a calibration proposal without a validation report from real data. Run a research cycle on an eligible source first."
    );
  }
  const beforeMetrics = summarizeValidationMetrics(validationReport);
  const targetProblem = detectTargetProblem();
  const proposedChanges = proposedChangesFor(targetProblem, currentConfig);
  const proposedConfig = applyProposalChangesToConfig(currentConfig, proposedChanges);
  const lifetimeEvidenceContext = lifetimeEvidenceFor(currentConfig, validationReport);

  return {
    proposalId: uid("calibration_proposal"),
    timestamp: new Date().toISOString(),
    source,
    status: "proposed",
    mode: "simulation",
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none",
    reason: reasonFor(targetProblem),
    targetProblem,
    proposedChanges,
    expectedImprovement:
      "Improve stability, drawdown behavior, confidence calibration, or scenario consistency without changing execution authority.",
    safetyNotes: [
      "Simulation-only proposal.",
      "No broker settings, execution permissions, readiness overrides, or paper/live trading modes can be changed.",
      lifetimeEvidenceContext
        ? `Historical context covers ${lifetimeEvidenceContext.cycleCount} compatible cycle(s) and ${lifetimeEvidenceContext.totalTrades} simulated trade(s); it does not create readiness evidence by itself.`
        : "No compatible lifetime evidence aggregate is available yet; this proposal remains grounded in the current validation report only.",
      "User approval is required before active simulation calibration settings are updated."
    ],
    beforeMetrics,
    lifetimeEvidenceContext,
    baselineConfig: currentConfig,
    proposedConfig,
    approvalRequired: true
  };
}
