import type { ValidationScenarioResult, ValidationSuiteReport } from "@/lib/validation";
import type { FalsePositivePattern } from "@/lib/researchQuality/researchQualityTypes";
import type { ResearchQualityFailureAttribution } from "@/lib/researchQuality/researchQualityFailureAttributionTypes";

const estimatedLossesFor = (scenario: ValidationScenarioResult) =>
  Math.max(0, scenario.totalTrades - Math.round(scenario.totalTrades * scenario.winRate));

const mitigationFor = (scenario: ValidationScenarioResult) => {
  if (scenario.confidenceCalibration.calibrationGap >= 0.25) {
    return "Raise the minimum confidence threshold or reduce CIO confidence when agent agreement is thin.";
  }
  if (scenario.averageR < 0) {
    return "Review invalidation distance and target placement before accepting similar simulated theses.";
  }
  if (scenario.winRate < 0.5) {
    return "Require stronger ICT confluence before this scenario can graduate from research.";
  }
  return "Keep as an observation and retest with a larger independent sample.";
};

const patternFor = (scenario: ValidationScenarioResult) => {
  if (scenario.id === "aggressive-confluence") {
    return "Loose confluence gates accepted lower-quality theses.";
  }
  if (scenario.id === "high-confidence-only") {
    return "High stated confidence did not fully remove losing simulated theses.";
  }
  if (scenario.category === "session") {
    return `${scenario.name} produced weaker session-specific confirmation.`;
  }
  if (scenario.category === "stop") {
    return `${scenario.name} exposed invalidation or target placement fragility.`;
  }
  return "Negative or poorly calibrated simulated theses appeared in this scenario.";
};

const mitigationForCause = (causeCode: string) => {
  if (causeCode.includes("session") || causeCode.includes("timing")) return "Test one session/timing exclusion against the frozen baseline.";
  if (causeCode.includes("htf")) return "Test one HTF-alignment requirement against the frozen baseline.";
  if (causeCode.includes("displacement") || causeCode.includes("entry_confirmation")) return "Test one displacement/entry-confirmation requirement.";
  if (causeCode === "unattributed_model_loss") return "Capture richer compact pre-entry context before changing any threshold.";
  return "Test one causal exclusion at a time and require non-degrading chronological OOS evidence.";
};

export function analyzeFalsePositivePatterns(
  report: ValidationSuiteReport,
  attribution?: ResearchQualityFailureAttribution
): FalsePositivePattern[] {
  if (attribution && attribution.canonicalScenarioId) {
    const scenario = report.scenarios.find((item) => item.id === attribution.canonicalScenarioId);
    const resolved = attribution.targetHitCount + attribution.stopHitCount;
    return attribution.failureCauses.map((cause) => ({
      scenarioName: `${attribution.canonicalScenarioName ?? "Canonical scenario"}: ${cause.label}`,
      estimatedFalsePositives: cause.stopHitCount,
      winRate: attribution.targetHitCount / Math.max(1, resolved),
      averageConfidence: cause.averageConfidence,
      calibrationGap: scenario?.confidenceCalibration.calibrationGap ?? 0,
      worstR: cause.worstR,
      pattern: cause.evidence,
      mitigation: mitigationForCause(cause.causeCode),
      causeCode: cause.causeCode,
      countBasis: "completed_stop_hits"
    }));
  }
  const candidates = report.scenarios
    .filter(
      (scenario) =>
        scenario.totalTrades > 0 &&
        (scenario.winRate < 0.5 ||
          scenario.averageR < 0 ||
          (scenario.worstTradeR <= -0.75 && scenario.maxDrawdown > 4) ||
          scenario.confidenceCalibration.calibrationGap >= 0.2)
    )
    .map((scenario) => ({
      scenarioName: scenario.name,
      estimatedFalsePositives: estimatedLossesFor(scenario),
      winRate: scenario.winRate,
      averageConfidence: scenario.confidenceCalibration.averageConfidence,
      calibrationGap: scenario.confidenceCalibration.calibrationGap,
      worstR: scenario.worstTradeR,
      pattern: patternFor(scenario),
      mitigation: mitigationFor(scenario),
      countBasis: "legacy_estimate" as const
    }))
    .sort(
      (a, b) =>
        b.estimatedFalsePositives +
        b.calibrationGap +
        Math.abs(Math.min(0, b.worstR)) -
        (a.estimatedFalsePositives + a.calibrationGap + Math.abs(Math.min(0, a.worstR)))
    );

  // Scenario variants often expose the same underlying weakness. Count the
  // root pattern once, retaining the worst manifestation, instead of treating
  // every threshold/stop label as a distinct false-positive family.
  const familyFor = (item: FalsePositivePattern) =>
    item.calibrationGap >= 0.2
      ? "confidence_calibration"
      : item.averageConfidence > 0 && item.winRate < 0.5
        ? "weak_hit_rate"
        : item.worstR <= -0.75
          ? "loss_tail"
          : "negative_expectancy";
  const distinct = new Map<string, FalsePositivePattern>();
  for (const candidate of candidates) {
    const family = familyFor(candidate);
    if (!distinct.has(family)) distinct.set(family, candidate);
  }
  return [...distinct.values()];
}
