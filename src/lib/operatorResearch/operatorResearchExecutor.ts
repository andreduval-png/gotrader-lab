import { resolveCanonicalHistoricalFoldAdapter, runCanonicalHistoricalFold } from "@/lib/historicalFold";
import { findResearchCoverage } from "@/lib/researchCoverage";
import type { IctHierarchicalNarrative } from "@/lib/ictI2";
import type { Candle, Timeframe } from "@/lib/types";

import type {
  CanonicalOwnerResearchProgress,
  CanonicalOwnerResearchTask,
  OperatorResearchDatasetBinding,
  OwnerResearchExecutionResult
} from "./operatorResearchTypes";

export interface CanonicalOwnerHistoricalPilotInput {
  datasetBinding: OperatorResearchDatasetBinding;
  candlesByTimeframe: Readonly<Partial<Record<Timeframe, readonly Candle[]>>>;
  evaluationTimes: readonly string[];
  narrativeAt?: (asOf: string) => IctHierarchicalNarrative | undefined;
  maximumEvaluations: number;
}

export const executeCanonicalOwnerHistoricalPilot = async (
  task: CanonicalOwnerResearchTask,
  input: CanonicalOwnerHistoricalPilotInput,
  reportProgress: (progress: Partial<CanonicalOwnerResearchProgress>) => void
): Promise<OwnerResearchExecutionResult> => {
  const contract = findResearchCoverage(task.ownerStrategyId);
  if (!contract) throw new Error(`RC1C_OWNER_CONTRACT_MISSING: ${task.ownerStrategyId}`);
  const adapter = resolveCanonicalHistoricalFoldAdapter(task.ownerStrategyId, task.researchProfileId);
  if (adapter.adapterId !== task.foldRunnerId) {
    throw new Error(`RC1C_FOLD_RUNNER_IDENTITY_MISMATCH: ${task.foldRunnerId}/${adapter.adapterId}`);
  }
  if (adapter.strategyVersion !== task.strategyVersion || adapter.geometryPolicyId !== contract.geometryPolicyId || adapter.geometryPolicyVersion !== contract.geometryPolicyVersion) {
    throw new Error(`RC1C_OWNER_ADAPTER_IDENTITY_MISMATCH: ${task.ownerStrategyId}`);
  }
  const evaluationTimes = [...input.evaluationTimes]
    .sort((left, right) => Date.parse(left) - Date.parse(right))
    .slice(0, Math.max(1, input.maximumEvaluations));
  if (!evaluationTimes.length) {
    return {
      status: "INSUFFICIENT_DATA",
      blocker: "The bounded pilot has no evaluation timestamps.",
      progress: { evaluationsCompleted: 0, candidateCount: 0, fillCount: 0, outcomeCount: 0, blockedCount: 1 }
    };
  }
  reportProgress({ evaluationsCompleted: 0, currentPartition: "bounded-certified-pilot" });
  const startInclusive = evaluationTimes[0];
  const endExclusive = new Date(Date.parse(evaluationTimes.at(-1)!) + 1).toISOString();
  const result = runCanonicalHistoricalFold({
    fold: {
      experimentFamilyId: "rc1c-bounded-owner-pilot",
      trialId: task.taskId,
      foldId: "bounded-1",
      partition: "validation",
      run: { startInclusive, endExclusive }
    },
    configurationId: "rc1c-owner-authentic-bounded-v1",
    adapter,
    dataset: {
      datasetId: input.datasetBinding.datasetVersion,
      datasetCertificateId: input.datasetBinding.certificateId,
      datasetChecksum: input.datasetBinding.datasetChecksum,
      sourceFingerprint: input.datasetBinding.sourceFingerprint
    },
    candlesByTimeframe: input.candlesByTimeframe,
    evaluationTimes,
    primaryTimeframe: "5m",
    costModelId: "rc1c-bounded-zero-cost.v1",
    fillModelId: "rc1c-bounded-causal-retrace.v1",
    tickSize: 0.25,
    spreadTicks: 0,
    slippageTicks: 0,
    commissionTicks: 0,
    maxBarsToResolveTrade: 3,
    narrativeAt: input.narrativeAt,
    checkpointEvery: Math.max(1, evaluationTimes.length)
  });
  reportProgress({
    evaluationsCompleted: result.counts.evaluated,
    candidateCount: result.counts.candidates,
    fillCount: result.counts.fills,
    outcomeCount: result.counts.completedTrades,
    currentPartition: "bounded-certified-pilot"
  });
  // Caller-supplied certificate labels do not prove these candles came from
  // verified partitions. Keep pilot diagnostics, but publish no certified evidence.
  return {
    status: "BLOCKED",
    blocker: "CERTIFIED_CONTENT_PROVENANCE_UNAVAILABLE: pilot candles have not been bound to verified partitions.",
    evidence: [],
    progress: {
      evaluationsCompleted: result.counts.evaluated,
      candidateCount: result.counts.candidates,
      fillCount: result.counts.fills,
      outcomeCount: result.counts.completedTrades,
      blockedCount: Math.max(1, result.counts.sourceBlocked),
      currentPartition: "bounded-certified-pilot"
    }
  };
};
