import type { ValidationScenarioResult, ValidationSuiteReport } from "@/lib/validation";
import type { LongShortComparison, SessionQualityComparison } from "@/lib/researchQuality/researchQualityTypes";
import type { ResearchQualityFailureAttribution } from "@/lib/researchQuality/researchQualityFailureAttributionTypes";

const scenarioById = (report: ValidationSuiteReport, id: string) =>
  report.scenarios.find((scenario) => scenario.id === id);

const noteFor = (scenario: ValidationScenarioResult) => {
  if (scenario.totalTrades === 0) {
    return "No accepted simulated trades; this session needs more data before ranking.";
  }
  if (scenario.averageR > 0 && scenario.readiness !== "red") {
    return "Session shows usable simulated evidence, but still needs broader replay coverage.";
  }
  return "Session underperformed or remains weakly calibrated in this validation sample.";
};

const readinessForSession = (trades: number, winRate: number, averageR: number, maxDrawdown: number) =>
  trades >= 5 && winRate >= 0.52 && averageR >= 0.15 && maxDrawdown <= 4
    ? "green" as const
    : trades >= 2 && averageR >= -0.1 && maxDrawdown <= 6
      ? "yellow" as const
      : "red" as const;

export function compareSessions(
  report: ValidationSuiteReport,
  attribution?: ResearchQualityFailureAttribution
): SessionQualityComparison[] {
  if (attribution?.canonicalScenarioId && attribution.sessionMatrix.length) {
    return attribution.sessionMatrix.map((session) => ({
      session: session.session,
      scenarioName: attribution.canonicalScenarioName ?? "Canonical completed outcomes",
      totalTrades: session.completedTrades,
      winRate: session.targetFirstRate,
      averageR: session.averageR,
      maxDrawdown: session.maxDrawdownR,
      profitFactor: session.profitFactor,
      readiness: readinessForSession(session.completedTrades, session.targetFirstRate, session.averageR, session.maxDrawdownR),
      note: session.completedTrades < 5
        ? "Completed-outcome session sample is too small to rank."
        : "Derived from completed outcomes in the canonical validation scenario."
    }));
  }
  return [
    ["NY AM", scenarioById(report, "ny-am-only")],
    ["London", scenarioById(report, "london-only")]
  ]
    .filter((item): item is [string, ValidationScenarioResult] => Boolean(item[1]))
    .map(([session, scenario]) => ({
      session,
      scenarioName: scenario.name,
      totalTrades: scenario.totalTrades,
      winRate: scenario.winRate,
      averageR: scenario.averageR,
      maxDrawdown: scenario.maxDrawdown,
      profitFactor: scenario.profitFactor,
      readiness: scenario.readiness,
      note: noteFor(scenario)
    }));
}

export function compareLongShortPerformance(report: ValidationSuiteReport): LongShortComparison {
  const longOnly = scenarioById(report, "long-only");
  const shortOnly = scenarioById(report, "short-only");
  const longScore = longOnly?.score ?? 0;
  const shortScore = shortOnly?.score ?? 0;
  const bestDirection = longScore >= shortScore ? "Long-only" : "Short-only";
  const worstDirection = longScore >= shortScore ? "Short-only" : "Long-only";

  return {
    bestDirection,
    worstDirection,
    longOnlyAverageR: longOnly?.averageR ?? 0,
    shortOnlyAverageR: shortOnly?.averageR ?? 0,
    longOnlyWinRate: longOnly?.winRate ?? 0,
    shortOnlyWinRate: shortOnly?.winRate ?? 0,
    note:
      Math.abs(longScore - shortScore) >= 20
        ? "Directional performance is uneven; avoid assuming symmetric long and short rules."
        : "Long and short filters are not decisively separated in this mock validation sample."
  };
}
