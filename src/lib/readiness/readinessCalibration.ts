import type { ValidationSuiteReport } from "@/lib/validation";

export interface ReadinessCalibrationSummary {
  available: boolean;
  average?: number;
  conservative?: number;
  displayValue: string;
  detail: string;
}

export const summarizeReadinessCalibration = (
  validation?: ValidationSuiteReport
): ReadinessCalibrationSummary => {
  const scores = validation?.scenarios
    .map((scenario) => scenario.confidenceCalibration.score)
    .filter((score) => Number.isFinite(score));
  const conservative = validation?.scenarios.find(
    (scenario) => scenario.id === "conservative-confluence"
  )?.confidenceCalibration.score;
  const average = scores?.length
    ? scores.reduce((sum, score) => sum + score, 0) / scores.length
    : undefined;
  if (
    typeof average !== "number" ||
    typeof conservative !== "number" ||
    !Number.isFinite(average) ||
    !Number.isFinite(conservative)
  ) {
    return {
      available: false,
      average,
      conservative,
      displayValue: "unavailable",
      detail: "Confidence calibration is unavailable until a completed validation suite includes conservative-confluence evidence."
    };
  }

  return {
    available: true,
    average,
    conservative,
    displayValue: `${Math.round(average * 100)}% average / ${Math.round(conservative * 100)}% conservative`,
    detail: `Average calibration ${Math.round(average * 100)}%; conservative calibration ${Math.round(conservative * 100)}%.`
  };
};
