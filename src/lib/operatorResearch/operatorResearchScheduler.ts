import {
  CANONICAL_LIVE_RESEARCH_OWNER_ORDER,
  canonicalLiveResearchCoverage,
  researchOnlyCoverage,
  evaluateResearchEvidenceCompatibility,
  type CanonicalResearchCoverageContract
} from "@/lib/researchCoverage";
import type {
  CanonicalOwnerResearchProgress,
  CanonicalOwnerResearchTask,
  OperatorResearchCycleSummary,
  OperatorResearchDatasetBinding,
  OwnerResearchExecutionResult,
  OwnerResearchGateResult
} from "./operatorResearchTypes";

const NONE_AUTHORITY = Object.freeze({ executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" } as const);
const OWNER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  ifvg_fresh_retest_v3_research: "IFVG v3",
  ict_2022_model_v1: "ICT 2022",
  ict_market_maker_buy_model_v1: "MMBM",
  ict_market_maker_sell_model_v1: "MMSM",
  nasdaq_london_raid_ny_reversal_v1: "London Raid v1",
  ifvg_fresh_retest_v4_candidate: "IFVG v4"
});

const nowIso = (now: () => number) => new Date(now()).toISOString();
const emptyProgress = (): CanonicalOwnerResearchProgress => ({
  evaluationsCompleted: 0,
  candidateCount: 0,
  fillCount: 0,
  outcomeCount: 0,
  blockedCount: 0
});

const taskFor = (
  contract: CanonicalResearchCoverageContract,
  cycleId: string,
  priority: number,
  queuedAt: string
): CanonicalOwnerResearchTask => ({
  taskId: `${cycleId}:${contract.ownerStrategyId}:HISTORICAL_VALIDATION`,
  cycleId,
  ownerStrategyId: contract.ownerStrategyId,
  ownerLabel: OWNER_LABELS[contract.ownerStrategyId] ?? contract.ownerStrategyId,
  strategyVersion: contract.ownerStrategyVersion,
  researchProfileId: contract.researchProfileId,
  tier: "HISTORICAL_VALIDATION",
  adapterId: contract.historicalGeometryAdapterId,
  foldRunnerId: contract.foldRunnerId,
  datasetFamily: contract.datasetRequirement.historicalDatasetFamily,
  datasetVersion: contract.datasetRequirement.historicalDatasetVersion,
  datasetCertificateId: contract.datasetRequirement.certificateId,
  datasetChecksum: contract.datasetRequirement.datasetChecksum,
  sourceFingerprint: contract.datasetRequirement.sourceFingerprint,
  resourceClass: contract.resourceBudget.resourceClass,
  estimatedMemoryMb: contract.resourceBudget.estimatedMemoryMb,
  capacityGateEvaluated: false,
  datasetGateEvaluated: false,
  priority,
  liveOwner: contract.runtimeAdmissionStatus === "LIVE_OWNER",
  researchOnly: contract.runtimeAdmissionStatus === "RESEARCH_ONLY",
  status: "QUEUED",
  queuedAt,
  evidenceIds: [],
  evidence: [],
  progress: emptyProgress()
});

export const createCanonicalOwnerResearchQueue = ({
  cycleId,
  queuedAt
}: {
  cycleId: string;
  queuedAt: string;
}) => {
  const byId = new Map(canonicalLiveResearchCoverage().map((contract) => [contract.ownerStrategyId, contract]));
  const tasks = CANONICAL_LIVE_RESEARCH_OWNER_ORDER.map((ownerStrategyId, priority) => {
    const contract = byId.get(ownerStrategyId);
    if (!contract) throw new Error(`RC1C_LIVE_OWNER_REGISTRY_MISSING: ${ownerStrategyId}`);
    return taskFor(contract, cycleId, priority, queuedAt);
  });
  if (tasks.length !== 5) throw new Error(`RC1C_LIVE_OWNER_COUNT_INVALID: ${tasks.length}`);
  const researchOnlyTasks = researchOnlyCoverage().map((contract, index) => taskFor(contract, cycleId, 100 + index, queuedAt));
  return { tasks, researchOnlyTasks };
};

export const evaluateOwnerResearchGate = ({
  contract,
  datasetBinding,
  capacityAvailable
}: {
  contract: CanonicalResearchCoverageContract;
  datasetBinding?: OperatorResearchDatasetBinding;
  capacityAvailable?: boolean;
}): OwnerResearchGateResult => {
  if (!contract.historicalValidationPolicy.supported) {
    return { status: "SKIPPED_BY_POLICY", blocker: contract.historicalValidationPolicy.reason };
  }
  if (!contract.historicalGeometryAdapterId || !contract.foldRunnerId) {
    return { status: "ADAPTER_BLOCKED", blocker: "Owner-specific historical adapter or fold runner is unavailable." };
  }
  if (contract.datasetRequirement.certificateRequirement === "REQUIRED") {
    if (!datasetBinding) {
      return { status: "DATASET_UNAVAILABLE", blocker: "Certified historical dataset is not bound in this browser cycle.", global: true };
    }
    const expected = contract.datasetRequirement;
    if (
      datasetBinding.datasetFamily !== expected.historicalDatasetFamily ||
      datasetBinding.datasetVersion !== expected.historicalDatasetVersion ||
      datasetBinding.certificateId !== expected.certificateId ||
      datasetBinding.datasetChecksum !== expected.datasetChecksum ||
      datasetBinding.sourceFingerprint !== expected.sourceFingerprint
    ) {
      return { status: "CERTIFICATE_INVALID", blocker: "Certified historical dataset identity does not match the owner contract.", global: true };
    }
  }
  if (capacityAvailable !== true) {
    return { status: "CAPACITY_BLOCKED", blocker: `${contract.resourceBudget.resourceClass} capacity is unavailable or was not measured.` };
  }
  return { status: "RUN" };
};

const terminalHasBlocker = (task: CanonicalOwnerResearchTask) => ![
  "PASSED",
  "PASSED_WITH_ZERO_CANDIDATES"
].includes(task.status);

export interface RunCanonicalOwnerResearchSchedulerInput {
  cycleId: string;
  cycleStartedAt: string;
  planPublishedAt: string;
  datasetBinding?: OperatorResearchDatasetBinding;
  capacityFor?: (task: CanonicalOwnerResearchTask) => boolean;
  execute: (
    task: CanonicalOwnerResearchTask,
    reportProgress: (progress: Partial<CanonicalOwnerResearchProgress>) => void,
    signal?: AbortSignal
  ) => Promise<OwnerResearchExecutionResult>;
  onUpdate?: (summary: OperatorResearchCycleSummary) => void;
  signal?: AbortSignal;
  now?: () => number;
  ownerStallTimeoutMs?: number;
  mt5RequestCount?: number;
  canonicalFactBuildCount?: number;
}

export const runCanonicalOwnerResearchScheduler = async (
  input: RunCanonicalOwnerResearchSchedulerInput
): Promise<OperatorResearchCycleSummary> => {
  const now = input.now ?? Date.now;
  const queuedAt = nowIso(now);
  const queue = createCanonicalOwnerResearchQueue({ cycleId: input.cycleId, queuedAt });
  let summary: OperatorResearchCycleSummary = {
    schemaVersion: "gotrader.operator-owner-research.v1",
    cycleId: input.cycleId,
    globalStatus: "LIVE_PLAN_AVAILABLE",
    liveOwnerTaskCount: 5,
    tasks: queue.tasks,
    researchOnlyTasks: queue.researchOnlyTasks,
    performance: {
      cycleStartedAt: input.cycleStartedAt,
      planPublishedAt: input.planPublishedAt,
      timeToLivePlanMs: Math.max(0, Date.parse(input.planPublishedAt) - Date.parse(input.cycleStartedAt)),
      mt5RequestCount: input.mt5RequestCount,
      canonicalFactBuildCount: input.canonicalFactBuildCount ?? 1,
      sharedLiveFetchPlanCount: 1,
      stageDurationsMs: { PLAN_PUBLISH: 0, LLM_ADVISORY: 0 }
    },
    livePlanPublished: true,
    livePlanPreserved: true,
    geometryMutationDetected: false,
    sharedLiveContextCount: 1,
    historicalMt5FallbackUsed: false,
    researchValidated: false,
    authority: NONE_AUTHORITY
  };
  const publish = () => input.onUpdate?.(structuredClone(summary));
  publish();

  const liveContracts = new Map<string, CanonicalResearchCoverageContract>(
    canonicalLiveResearchCoverage().map((contract) => [contract.ownerStrategyId, contract])
  );
  let globalGate: OwnerResearchGateResult | undefined;
  let stalledOwner = false;
  for (let index = 0; index < summary.tasks.length; index += 1) {
    const task = summary.tasks[index];
    if (stalledOwner) {
      task.status = "BLOCKED";
      task.blocker = "Previous owner stalled; queue halted to prevent overlapping execution.";
      task.completedAt = nowIso(now);
      task.progress.blockedCount = 1;
      continue;
    }
    if (input.signal?.aborted) {
      task.status = "CANCELLED";
      task.completedAt = nowIso(now);
      task.blocker = "Operator cancelled the owner research queue.";
      continue;
    }
    const contract = liveContracts.get(task.ownerStrategyId);
    if (!contract) throw new Error(`RC1C_OWNER_CONTRACT_MISSING: ${task.ownerStrategyId}`);
    task.datasetGateEvaluated = true;
    const capacityAvailable = input.capacityFor?.(task);
    task.capacityGateEvaluated = capacityAvailable !== undefined;
    const gate = globalGate && globalGate.status !== "RUN"
      ? globalGate
      : evaluateOwnerResearchGate({
          contract,
          datasetBinding: input.datasetBinding,
          capacityAvailable
        });
    if (gate.status !== "RUN") {
      task.status = gate.status;
      task.blocker = gate.blocker;
      task.progress.blockedCount = 1;
      task.completedAt = nowIso(now);
      task.lastProgressAt = task.completedAt;
      task.progress.lastProgressAt = task.completedAt;
      if (gate.global) globalGate = gate;
      summary.globalStatus = "OWNER_RESEARCH_PARTIAL";
      publish();
      continue;
    }

    const startedMs = now();
    task.status = "RUNNING";
    task.startedAt = new Date(startedMs).toISOString();
    task.lastProgressAt = task.startedAt;
    task.queueWaitMs = Math.max(0, startedMs - Date.parse(task.queuedAt));
    task.progress.lastProgressAt = task.startedAt;
    summary.globalStatus = "OWNER_RESEARCH_RUNNING";
    summary.performance.firstOwnerResearchStartedAt ??= task.startedAt;
    publish();

    let timer: ReturnType<typeof setTimeout> | undefined;
    let acceptingProgress = true;
    const ownerController = new AbortController();
    let rejectStall: ((error: Error) => void) | undefined;
    const timeoutMs = input.ownerStallTimeoutMs ?? 180_000;
    const stalled = new Promise<never>((_, reject) => { rejectStall = reject; });
    const onAbort = () => {
      acceptingProgress = false;
      ownerController.abort(input.signal?.reason);
      rejectStall?.(new Error("OWNER_RESEARCH_CANCELLED"));
    };
    input.signal?.addEventListener("abort", onAbort, { once: true });
    const resetWatchdog = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        stalledOwner = true;
        acceptingProgress = false;
        ownerController.abort("owner_research_stalled");
        rejectStall?.(new Error(`OWNER_RESEARCH_STALLED: ${task.ownerStrategyId}`));
      }, timeoutMs);
    };
    const reportProgress = (progress: Partial<CanonicalOwnerResearchProgress>) => {
      if (!acceptingProgress || input.signal?.aborted) return;
      const at = nowIso(now);
      task.progress = { ...task.progress, ...progress, lastProgressAt: at };
      task.lastProgressAt = at;
      resetWatchdog();
      publish();
    };
    resetWatchdog();
    try {
      input.signal?.throwIfAborted();
      const result = await Promise.race([input.execute(task, reportProgress, ownerController.signal), stalled]);
      input.signal?.throwIfAborted();
      const evidenceCompatibility = (result.evidence ?? []).map((evidence) => ({
        evidence,
        compatibility: evidence.strategyId !== task.ownerStrategyId || evidence.researchProfileId !== task.researchProfileId || evidence.evaluationTier !== task.tier
          ? { compatible: false, reason: "Evidence does not belong to this owner task/profile/tier." }
          : evaluateResearchEvidenceCompatibility(evidence)
      }));
      const incompatibleEvidence = evidenceCompatibility.find((item) => !item.compatibility.compatible);
      task.status = incompatibleEvidence ? "EVIDENCE_INCOMPATIBLE" : result.status;
      task.blocker = incompatibleEvidence?.compatibility.reason ?? result.blocker;
      task.evidenceIds = incompatibleEvidence
        ? []
        : evidenceCompatibility.length
          ? evidenceCompatibility.map((item) => item.evidence.runId)
          : [...(result.evidenceIds ?? [])];
      task.evidence = incompatibleEvidence ? [] : evidenceCompatibility.map((item) => item.evidence);
      task.progress = { ...task.progress, ...result.progress, lastProgressAt: nowIso(now) };
    } catch (error) {
      task.status = input.signal?.aborted ? "CANCELLED" : "FAILED";
      task.blocker = error instanceof Error ? error.message : "Owner research failed.";
      task.progress.blockedCount += 1;
    } finally {
      acceptingProgress = false;
      input.signal?.removeEventListener("abort", onAbort);
      if (timer) clearTimeout(timer);
    }
    const completedMs = now();
    task.completedAt = new Date(completedMs).toISOString();
    task.lastProgressAt = task.completedAt;
    task.runDurationMs = Math.max(0, completedMs - startedMs);
    summary.performance.firstHistoricalOwnerResearchCompletedAt ??= task.completedAt;
    summary.globalStatus = "OWNER_RESEARCH_PARTIAL";
    publish();
  }

  const completedAt = nowIso(now);
  summary.performance.ownerQueueDurationMs = Math.max(0, Date.parse(completedAt) - Date.parse(queuedAt));
  summary.performance.stageDurationsMs.OWNER_RESEARCH_QUEUE = summary.performance.ownerQueueDurationMs;
  const durationKeys = ["IFVG_V3_RESEARCH", "ICT2022_RESEARCH", "MMBM_RESEARCH", "MMSM_RESEARCH", "LONDON_RESEARCH"] as const;
  summary.tasks.forEach((task, index) => {
    if (task.runDurationMs !== undefined) summary.performance.stageDurationsMs[durationKeys[index]] = task.runDurationMs;
  });
  summary.globalStatus = input.signal?.aborted
    ? "CANCELLED"
    : summary.tasks.some(terminalHasBlocker)
      ? "COMPLETE_WITH_BLOCKERS"
      : "OWNER_RESEARCH_COMPLETE";
  publish();
  return summary;
};
