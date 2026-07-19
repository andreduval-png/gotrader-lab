import type {
  ResearchEvidenceAggregate,
  ResearchEvidenceAggregateIndex,
  ResearchEvidenceCycleRecord
} from "./researchEvidenceLedgerTypes";
import {
  researchEvidenceAuthorityNone,
  researchEvidenceSafety
} from "./researchEvidenceLedgerTypes";

const round = (value: number, digits = 4) => Number(value.toFixed(digits));

const weightedAverage = (
  rows: ResearchEvidenceCycleRecord[],
  value: (row: ResearchEvidenceCycleRecord) => number | null,
  weight: (row: ResearchEvidenceCycleRecord) => number
) => {
  let weightedTotal = 0;
  let totalWeight = 0;
  rows.forEach((row) => {
    const current = value(row);
    const currentWeight = weight(row);
    if (current !== null && Number.isFinite(current) && currentWeight > 0) {
      weightedTotal += current * currentWeight;
      totalWeight += currentWeight;
    }
  });
  return totalWeight ? round(weightedTotal / totalWeight) : null;
};

const aggregateGroup = (rows: ResearchEvidenceCycleRecord[]): ResearchEvidenceAggregate => {
  const sorted = [...rows].sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  const latest = sorted[sorted.length - 1];
  const totalTrades = sorted.reduce((sum, row) => sum + row.performance.tradeCount, 0);
  const winningTrades = sorted.reduce((sum, row) => sum + row.performance.winningTrades, 0);
  const losingTrades = sorted.reduce((sum, row) => sum + row.performance.losingTrades, 0);
  const blockerCounts = new Map<string, number>();
  sorted.flatMap((row) => [...row.blockers, ...row.promotionBlockers]).forEach((blocker) => {
    blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1);
  });

  return {
    identity: latest.identity,
    firstCompletedAt: sorted[0].completedAt,
    lastCompletedAt: latest.completedAt,
    cycleCount: sorted.length,
    independentCycleDates: new Set(sorted.map((row) => row.completedAt.slice(0, 10))).size,
    sourceFingerprintCount: new Set(sorted.map((row) => row.source.sourceFingerprint).filter(Boolean)).size,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate: totalTrades ? round(winningTrades / totalTrades) : 0,
    weightedAverageR: weightedAverage(sorted, (row) => row.performance.averageR, (row) => row.performance.tradeCount) ?? 0,
    totalRealizedR: round(sorted.reduce((sum, row) => sum + row.performance.realizedR, 0)),
    worstMaxDrawdownR: round(Math.max(0, ...sorted.map((row) => row.performance.maxDrawdownR))),
    weightedProfitFactor: weightedAverage(sorted, (row) => row.performance.profitFactor, (row) => row.performance.tradeCount),
    positiveEdgeCycles: sorted.filter((row) => row.resultClass === "positive_edge").length,
    promisingCycles: sorted.filter((row) => row.resultClass === "promising_small_sample").length,
    negativeEdgeCycles: sorted.filter((row) => row.resultClass === "negative_edge").length,
    noSampleCycles: sorted.filter((row) => row.resultClass === "no_sample").length,
    oosTrades: sorted.reduce((sum, row) => sum + row.validation.walkForwardOosTrades, 0),
    oosWindowsPassed: sorted.reduce((sum, row) => sum + row.validation.walkForwardWindowsPassed, 0),
    oosWindowsTested: sorted.reduce((sum, row) => sum + row.validation.walkForwardWindowsTested, 0),
    walkForwardPassedCycles: sorted.filter((row) =>
      ["passed", "promising", "robust_research", "paper_demo_review_candidate"].includes(
        row.validation.walkForwardVerdict ?? ""
      )
    ).length,
    monteCarloRobustCycles: sorted.filter((row) =>
      ["moderate", "strong", "robust"].includes((row.validation.monteCarloRobustness ?? "").toLowerCase())
    ).length,
    latestEvidenceScore: latest.evidenceMaturity.evidenceScore,
    latestMaturityScore: latest.evidenceMaturity.maturityScore,
    latestReadinessState: latest.evidenceMaturity.readinessState,
    latestResultClass: latest.resultClass,
    recurringBlockers: [...blockerCounts.entries()]
      .map(([blocker, occurrences]) => ({ blocker, occurrences }))
      .sort((left, right) => right.occurrences - left.occurrences || left.blocker.localeCompare(right.blocker))
      .slice(0, 8),
    latestNextAction: latest.nextAction,
    authority: researchEvidenceAuthorityNone
  };
};

export function aggregateResearchEvidence(
  records: ResearchEvidenceCycleRecord[],
  generatedAt = new Date().toISOString()
): ResearchEvidenceAggregateIndex {
  const groups = new Map<string, ResearchEvidenceCycleRecord[]>();
  records.forEach((record) => {
    const rows = groups.get(record.identity.identityKey) ?? [];
    rows.push(record);
    groups.set(record.identity.identityKey, rows);
  });

  return {
    schemaVersion: 1,
    generatedAt,
    totalRecords: records.length,
    totalProfiles: groups.size,
    aggregates: [...groups.values()]
      .map(aggregateGroup)
      .sort((left, right) => right.lastCompletedAt.localeCompare(left.lastCompletedAt)),
    authority: researchEvidenceAuthorityNone,
    safety: researchEvidenceSafety
  };
}
