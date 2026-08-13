import type { ValidationScenarioResult, ValidationSuiteReport } from "@/lib/validation";
import type { DrawdownClusterNote } from "@/lib/researchQuality/researchQualityTypes";
import type { ResearchQualityFailureAttribution } from "@/lib/researchQuality/researchQualityFailureAttributionTypes";

const clusterRiskFor = (scenario: ValidationScenarioResult) => {
  if (scenario.maxDrawdown >= 4 || scenario.worstTradeR <= -1.5) {
    return "red" as const;
  }
  if (scenario.maxDrawdown >= 2 || scenario.worstTradeR <= -1) {
    return "yellow" as const;
  }
  return "green" as const;
};

const notesFor = (scenario: ValidationScenarioResult) => {
  if (scenario.maxDrawdown === 0 && scenario.totalTrades === 0) {
    return "No trades were accepted, so drawdown quality cannot be evaluated.";
  }
  if (scenario.category === "stop") {
    return "Stop-model sensitivity should be retested before trusting this invalidation approach.";
  }
  if (scenario.category === "session") {
    return "Session filtering may concentrate risk around a narrower market window.";
  }
  return "Review losing sequences and threshold gates before increasing strategy trust.";
};

export function analyzeDrawdownClusters(
  report: ValidationSuiteReport,
  attribution?: ResearchQualityFailureAttribution
): DrawdownClusterNote[] {
  if (attribution?.canonicalScenarioId) {
    return attribution.drawdownClusters.map((cluster) => ({
      scenarioName: `${attribution.canonicalScenarioName ?? "Canonical scenario"} / ${cluster.clusterId}`,
      maxDrawdown: cluster.maxDrawdownR,
      worstTradeR: -cluster.maxDrawdownR,
      clusterRisk: cluster.risk,
      notes: `${cluster.tradeCount} chronological trades, ${cluster.stopHitCount} stop hits; ${cluster.recovered ? "recovered" : "open at sample end"}${cluster.dominantFailureCause ? `; dominant context ${cluster.dominantFailureCause}` : ""}.`,
      clusterId: cluster.clusterId,
      startAt: cluster.startAt,
      endAt: cluster.endAt,
      recovered: cluster.recovered
    }));
  }
  return report.scenarios
    .filter((scenario) => scenario.maxDrawdown > 0 || scenario.worstTradeR < 0)
    .map((scenario) => ({
      scenarioName: scenario.name,
      maxDrawdown: scenario.maxDrawdown,
      worstTradeR: scenario.worstTradeR,
      clusterRisk: clusterRiskFor(scenario),
      notes: notesFor(scenario)
    }))
    .sort((a, b) => b.maxDrawdown + Math.abs(Math.min(0, b.worstTradeR)) - (a.maxDrawdown + Math.abs(Math.min(0, a.worstTradeR))));
}
