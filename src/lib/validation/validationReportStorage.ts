import type { ValidationSuiteReport } from "@/lib/validation/validationTypes";

export const VALIDATION_REPORT_STORAGE_KEY = "gotrader_ai_lab_latest_validation_report";
export const VALIDATION_REPORT_UPDATED_EVENT = "gotrader-ai-lab-validation-report-updated";

let inMemoryLatestValidationReport: ValidationSuiteReport | undefined;

const compactValidationReport = (report: ValidationSuiteReport, aggressive = false): ValidationSuiteReport => ({
  id: report.id,
  generatedAt: report.generatedAt,
  provenance: report.provenance,
  scenarios: report.scenarios.map((scenario) => ({
    ...scenario,
    description: aggressive ? "Compact validation scenario." : scenario.description,
    bestTrade: undefined,
    worstTrade: undefined,
    skipReasons: scenario.skipReasons.slice(0, aggressive ? 6 : 20),
    agentContributionSummary: scenario.agentContributionSummary.slice(0, aggressive ? 8 : 20)
  })),
  calibration: {
    ...report.calibration,
    agentWeightsToIncrease: report.calibration.agentWeightsToIncrease.slice(0, aggressive ? 6 : 12),
    agentWeightsToDecrease: report.calibration.agentWeightsToDecrease.slice(0, aggressive ? 6 : 12),
    weakICTRules: report.calibration.weakICTRules.slice(0, aggressive ? 8 : 20)
  },
  safetyNotice: "Simulation validation only. No broker connection. No real trades."
});

const parse = (raw: string | null) => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as ValidationSuiteReport;
  } catch {
    return undefined;
  }
};

export function saveLatestValidationReport(report: ValidationSuiteReport) {
  inMemoryLatestValidationReport = report;
  if (typeof window === "undefined") return;

  const compact = compactValidationReport(report);
  const aggressive = compactValidationReport(report, true);
  let stored = false;
  for (const candidate of [compact, aggressive]) {
    try {
      window.localStorage.setItem(VALIDATION_REPORT_STORAGE_KEY, JSON.stringify(candidate));
      stored = true;
      break;
    } catch {
      // Retry with a smaller report below.
    }
  }
  if (!stored) {
    try {
      window.localStorage.removeItem(VALIDATION_REPORT_STORAGE_KEY);
      window.localStorage.setItem(VALIDATION_REPORT_STORAGE_KEY, JSON.stringify(aggressive));
      stored = true;
    } catch {
      try {
        window.sessionStorage?.setItem(VALIDATION_REPORT_STORAGE_KEY, JSON.stringify(aggressive));
      } catch {
        // In-memory validation remains available for the active research cycle.
      }
      console.warn("Validation report persistence fell back to session or in-memory storage after browser quota was reached.");
    }
  }
  window.dispatchEvent(new CustomEvent(VALIDATION_REPORT_UPDATED_EVENT, { detail: report }));
}

export function loadLatestValidationReport(): ValidationSuiteReport | undefined {
  if (typeof window === "undefined") return inMemoryLatestValidationReport;
  const local = parse(window.localStorage.getItem(VALIDATION_REPORT_STORAGE_KEY));
  if (local) {
    inMemoryLatestValidationReport = local;
    return local;
  }
  const session = typeof window.sessionStorage !== "undefined"
    ? parse(window.sessionStorage.getItem(VALIDATION_REPORT_STORAGE_KEY))
    : undefined;
  if (session) {
    inMemoryLatestValidationReport = session;
    return session;
  }
  return inMemoryLatestValidationReport;
}
