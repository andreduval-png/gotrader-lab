import {
  defaultBacktestConfig,
  loadBacktestConfig,
  sanitizeBacktestConfig
} from "@/lib/backtesting";
import type { BacktestConfig, ResolvedBacktestConfig } from "@/lib/backtesting";
import type { Candle } from "@/lib/types";
import { compareProposalToBaseline } from "@/lib/selfImprovement/compareProposalToBaseline";
import type {
  CalibrationProposal,
  CalibrationProposalChanges,
  CalibrationProposalMetrics
} from "@/lib/selfImprovement/selfImprovementTypes";
import { runValidationSuite } from "@/lib/validation";
import type { ValidationScenarioResult, ValidationSuiteReport } from "@/lib/validation";
import {
  buildValidationProvenanceIdentity,
  fingerprintValidationParameters
} from "@/lib/validationProvenance";
import { getFrozenResearchProfile } from "@/lib/forwardEvidence";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const profitFactorAverage = (scenarios: ValidationScenarioResult[]) => {
  const values = scenarios
    .map((scenario) => scenario.profitFactor)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? round(average(values), 2) : null;
};

/** Approximate stop-hit count from scenario win rate (resolved trades only). */
export const estimateFalsePositives = (scenarios: ValidationScenarioResult[]) =>
  Math.round(
    scenarios.reduce((sum, scenario) => sum + scenario.totalTrades * Math.max(0, 1 - scenario.winRate), 0)
  );

export function summarizeValidationMetrics(report: ValidationSuiteReport): CalibrationProposalMetrics {
  const scenarios = report.scenarios;
  const conservative = scenarios.find((scenario) => scenario.id === "conservative-confluence");
  const totalTrades = scenarios.reduce((sum, scenario) => sum + scenario.totalTrades, 0);
  const skippedSignals = scenarios.reduce((sum, scenario) => sum + scenario.skippedSignals, 0);
  const winRate = average(scenarios.map((scenario) => scenario.winRate));
  const averageR = average(scenarios.map((scenario) => scenario.averageR));
  const maxDrawdown = Math.max(...scenarios.map((scenario) => scenario.maxDrawdown));
  const confidenceCalibration = average(scenarios.map((scenario) => scenario.confidenceCalibration.score));
  const falsePositiveCount = estimateFalsePositives(scenarios);
  const stabilityScore = clamp(
    100 -
      maxDrawdown * 8 -
      falsePositiveCount * 3 +
      confidenceCalibration * 18 +
      Math.min(totalTrades, 12) * 1.5,
    0,
    100
  );

  return {
    validationId: report.id,
    validationTimestamp: report.generatedAt,
    totalTrades,
    winRate: round(winRate, 3),
    averageR: round(averageR, 2),
    maxDrawdown: round(maxDrawdown, 2),
    profitFactor: profitFactorAverage(scenarios),
    skippedSignals,
    falsePositiveCount,
    confidenceCalibration: round(confidenceCalibration, 3),
    readinessScore: report.calibration.readinessScore,
    readinessStatus: report.calibration.readinessStatus,
    stabilityScore: round(stabilityScore, 0),
    conservativeScenarioStable: conservative?.readiness === "green",
    strongestScenario: report.calibration.strongestScenario,
    weakestScenario: report.calibration.weakestScenario,
    provenance: report.provenance
  };
}

export function applyProposalChangesToConfig(
  config: ResolvedBacktestConfig,
  changes: CalibrationProposalChanges
): ResolvedBacktestConfig {
  const next: BacktestConfig = {
    ...config,
    minimumConfluenceThreshold: changes.confluenceThreshold ?? config.minimumConfluenceThreshold,
    minimumConfidenceThreshold: changes.confidenceThreshold ?? config.minimumConfidenceThreshold,
    sessionFilter: changes.sessionFilter ?? config.sessionFilter,
    stopModel: changes.stopModel ?? config.stopModel,
    targetRMultiple: changes.targetRMultiple ?? config.targetRMultiple,
    agentWeights: changes.agentWeights ? { ...config.agentWeights, ...changes.agentWeights } : config.agentWeights
  };

  return sanitizeBacktestConfig(next);
}

export function evaluateCalibrationProposal(proposal: CalibrationProposal, candles: Candle[]): CalibrationProposal {
  if (!candles.length) {
    throw new Error(
      "Cannot test a calibration proposal without real candles. Activate MT5 read-only research mode or import historical candles first."
    );
  }
  const baselineConfig = proposal.baselineConfig ?? loadBacktestConfig();
  const proposedConfig = applyProposalChangesToConfig(baselineConfig ?? defaultBacktestConfig, proposal.proposedChanges);
  const frozenProfile = getFrozenResearchProfile(proposedConfig.strategyProfile);
  const sourceContext = proposal.proposalIntentDetails?.sourceContext;
  const validationReport = runValidationSuite(candles, proposedConfig, {
    provenance: buildValidationProvenanceIdentity({
      strategyProfile: proposedConfig.strategyProfile,
      strategyProfileVersion: frozenProfile?.profileVersion,
      proposalId: proposal.proposalId,
      candidateId: proposal.sourceCandidateId,
      sourceProvider: sourceContext?.provider,
      requestedSymbol: sourceContext?.requestedSymbol ?? proposedConfig.symbol,
      brokerSymbol: sourceContext?.brokerSymbol,
      timeframe: sourceContext?.timeframe ?? proposedConfig.timeframe,
      sourceFingerprint: sourceContext?.sourceFingerprint,
      parameterFingerprint: fingerprintValidationParameters(proposedConfig),
      detectorProfileFingerprint: frozenProfile
        ? fingerprintValidationParameters(frozenProfile.frozenParameters)
        : undefined,
      validationCutoff: frozenProfile?.validationCutoff
    })
  });
  const afterMetrics = summarizeValidationMetrics(validationReport);
  const comparisonResult = compareProposalToBaseline(proposal.beforeMetrics, afterMetrics);

  return {
    ...proposal,
    status: "testing",
    proposedConfig,
    afterMetrics,
    comparisonResult,
    testedAt: validationReport.generatedAt
  };
}
