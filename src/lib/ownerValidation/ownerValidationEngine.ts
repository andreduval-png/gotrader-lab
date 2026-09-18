import {
  CANONICAL_LIVE_RESEARCH_OWNER_ORDER,
  evaluateResearchEvidenceCompatibility,
  findResearchCoverage,
  RESEARCH_COVERAGE_AUTHORITY,
  type CanonicalLiveResearchOwnerId,
  type CanonicalResearchEvidenceIdentity
} from "@/lib/researchCoverage";
import type { CanonicalOwnerResearchTask } from "@/lib/operatorResearch";
import { findOwnerValidationContract } from "./ownerValidationRegistry";
import { evaluateCanonicalOwnerPolicyCycle } from "@/lib/ownerValidationPolicy";
import {
  OWNER_VALIDATION_EVIDENCE_SCHEMA,
  OWNER_VALIDATION_VERSION,
  type CanonicalOwnerReadinessRecord,
  type CanonicalOwnerValidationEvidence,
  type CanonicalOwnerValidationMetrics,
  type CanonicalOwnerValidationRecord,
  type CanonicalOwnerValidationSummary,
  type EvaluateOwnerValidationInput,
  type OwnerReadinessStatus,
  type OwnerValidationStatus
} from "./ownerValidationTypes";

const emptyMetrics = (): CanonicalOwnerValidationMetrics => ({ evaluations: 0, candidates: 0, fills: 0, resolvedOutcomes: 0 });

const upstreamBlock = (status?: string): { status: OwnerValidationStatus; blocker: string } | undefined => {
  if (status === "DATASET_UNAVAILABLE") return { status, blocker: "Certified historical dataset is unavailable for this owner." };
  if (status === "CERTIFICATE_INVALID") return { status, blocker: "Certified historical dataset identity is invalid." };
  if (status === "CAPACITY_BLOCKED") return { status, blocker: "Measured host capacity is unavailable for this owner validation tier." };
  if (["FAILED", "BLOCKED", "ADAPTER_BLOCKED", "NOT_SUPPORTED", "SKIPPED_BY_POLICY", "CANCELLED", "RUNNING", "QUEUED", "EVIDENCE_INCOMPATIBLE"].includes(status ?? "")) {
    return { status: "SOURCE_BLOCKED", blocker: `Owner research cannot supply validation evidence: ${status}.` };
  }
  return undefined;
};

const record = (
  input: EvaluateOwnerValidationInput,
  status: OwnerValidationStatus,
  blocker: string | undefined,
  evidence: CanonicalOwnerValidationEvidence | undefined,
  compatibility: CanonicalOwnerValidationRecord["evidenceCompatibility"]
): CanonicalOwnerValidationRecord => ({
  ownerStrategyId: input.ownerStrategyId,
  strategyVersion: findOwnerValidationContract(input.ownerStrategyId)?.strategyVersion ?? "unknown",
  researchProfileId: findOwnerValidationContract(input.ownerStrategyId)?.researchProfileId ?? "unknown",
  status,
  blocker,
  evidenceIds: evidence ? [evidence.identity.runId] : [],
  metrics: evidence?.metrics ?? emptyMetrics(),
  lastEvaluatedAt: input.evaluatedAt,
  evidenceAgeMs: evidence ? Math.max(0, Date.parse(input.evaluatedAt) - Date.parse(evidence.createdAt)) : undefined,
  evidenceCompatibility: compatibility,
  researchValidated: false
});

export const evaluateCanonicalOwnerEvidence = (input: EvaluateOwnerValidationInput): CanonicalOwnerValidationRecord => {
  const contract = findOwnerValidationContract(input.ownerStrategyId);
  if (!contract) return record(input, "SOURCE_BLOCKED", "Owner validation contract is unavailable.", undefined, "MISSING");
  const upstream = upstreamBlock(input.upstreamStatus);
  if (upstream) return record(input, upstream.status, upstream.blocker, undefined, "MISSING");
  const evidence = input.evidence?.at(-1);
  if (!evidence) return record(input, "INSUFFICIENT_EVIDENCE", "No current owner-specific validation evidence is available.", undefined, "MISSING");
  if (evidence.schemaVersion !== OWNER_VALIDATION_EVIDENCE_SCHEMA || evidence.evidenceVersion !== contract.evidenceVersion) {
    return record(input, "EVIDENCE_INCOMPATIBLE", "Evidence schema/version does not match the owner validation contract.", evidence, "INCOMPATIBLE");
  }
  const compatibility = evaluateResearchEvidenceCompatibility(evidence.identity, input.ownerStrategyId);
  if (!compatibility.compatible) return record(input, "EVIDENCE_INCOMPATIBLE", compatibility.reason, evidence, "INCOMPATIBLE");
  if (evidence.identity.evaluationTier !== contract.requiredEvidenceTier) {
    return record(input, "EVIDENCE_INCOMPATIBLE", "Tactical or forward evidence cannot satisfy certified historical validation.", evidence, "INCOMPATIBLE");
  }
  const counts = [evidence.metrics.evaluations, evidence.metrics.candidates, evidence.metrics.fills, evidence.metrics.resolvedOutcomes];
  if (!counts.every((value) => Number.isSafeInteger(value) && value >= 0) ||
      evidence.metrics.fills > evidence.metrics.candidates || evidence.metrics.resolvedOutcomes > evidence.metrics.fills ||
      !Number.isFinite(Date.parse(evidence.createdAt)) || !Number.isFinite(Date.parse(input.evaluatedAt)) || Date.parse(evidence.createdAt) > Date.parse(input.evaluatedAt)) {
    return record(input, "EVIDENCE_INCOMPATIBLE", "Invalid sample accounting or evidence timestamp.", evidence, "INCOMPATIBLE");
  }
  if (evidence.metrics.candidates === 0) {
    return record(input, "INSUFFICIENT_EVIDENCE", "The bounded owner sample produced zero candidates; this is neither a pass nor a failure.", evidence, "CURRENT");
  }
  if (evidence.historicalParityStatus !== "PASSED") return record(input, "PARITY_REQUIRED", "Current live/historical owner parity evidence is required.", evidence, "CURRENT");
  if (evidence.determinismStatus !== "PASSED") return record(input, "DETERMINISM_REQUIRED", "A matching deterministic rerun seal is required.", evidence, "CURRENT");
  if (evidence.causalityStatus !== "PASSED") return record(input, "CAUSALITY_REQUIRED", "Current future-invariance and causal fold evidence is required.", evidence, "CURRENT");
  if (evidence.walkForwardStatus !== "PASSED") return record(input, "WALK_FORWARD_REQUIRED", "Owner-specific walk-forward evidence is required.", evidence, "CURRENT");
  if (evidence.oosStatus !== "PASSED") return record(input, "OOS_REQUIRED", "Owner-specific OOS evidence is required.", evidence, "CURRENT");
  if (contract.thresholdPolicy === "UNDEFINED") return record(input, "VALIDATION_POLICY_REQUIRED", contract.thresholdPolicyReason, evidence, "CURRENT");
  return record(input, "INSUFFICIENT_EVIDENCE", "Requirement flags alone do not establish quantitative performance or exact-profile forward readiness; policy evidence is required.", evidence, "CURRENT");
};

const readinessFor = (validation: CanonicalOwnerValidationRecord, evidence?: CanonicalOwnerValidationEvidence): CanonicalOwnerReadinessRecord => {
  let status: OwnerReadinessStatus = "VALIDATION_REQUIRED";
  let reason = "Compatible owner-specific validation must pass before readiness can be evaluated.";
  if (validation.status === "VALIDATION_POLICY_REQUIRED") {
    status = "POLICY_REQUIRED";
    reason = validation.blocker ?? "Owner-specific readiness policy is required.";
  } else if (validation.status === "CAPACITY_BLOCKED") {
    status = "CAPACITY_BLOCKED";
    reason = validation.blocker ?? "Capacity is unavailable.";
  } else if (validation.status === "INSUFFICIENT_EVIDENCE") {
    status = "INSUFFICIENT_EVIDENCE";
    reason = validation.blocker ?? "More compatible evidence is required.";
  } else if (["SOURCE_BLOCKED", "DATASET_UNAVAILABLE", "CERTIFICATE_INVALID", "EVIDENCE_INCOMPATIBLE"].includes(validation.status)) {
    status = "SOURCE_BLOCKED";
    reason = validation.blocker ?? "Validation evidence is blocked.";
  } else if (validation.status === "VALIDATION_PASSED" && evidence?.readinessEvidenceStatus === "PASSED") {
    status = "READY_FOR_RESEARCH_USE";
    reason = "Exact owner validation and readiness evidence prerequisites passed; execution authority remains none.";
  } else if (validation.status === "VALIDATION_PASSED") {
    status = "NOT_READY";
    reason = "Validation passed, but compatible readiness-tier evidence is not complete.";
  }
  return {
    ownerStrategyId: validation.ownerStrategyId,
    validationStatus: validation.status,
    status,
    reason,
    evidenceIds: [...validation.evidenceIds],
    lastEvaluatedAt: validation.lastEvaluatedAt,
    authority: RESEARCH_COVERAGE_AUTHORITY
  };
};

export const validationEvidenceFromResearchTask = (
  task: CanonicalOwnerResearchTask,
  identity: CanonicalResearchEvidenceIdentity,
  createdAt: string
): CanonicalOwnerValidationEvidence => {
  const coverage = findResearchCoverage(task.ownerStrategyId);
  return {
    schemaVersion: OWNER_VALIDATION_EVIDENCE_SCHEMA,
    evidenceVersion: coverage?.evidenceVersion ?? "unknown",
    identity,
    historicalParityStatus: "NOT_EVALUATED",
    determinismStatus: "NOT_EVALUATED",
    causalityStatus: "NOT_EVALUATED",
    walkForwardStatus: "NOT_EVALUATED",
    oosStatus: "NOT_EVALUATED",
    readinessEvidenceStatus: "NOT_EVALUATED",
    metrics: {
      evaluations: task.progress.evaluationsCompleted,
      candidates: task.progress.candidateCount,
      fills: task.progress.fillCount,
      resolvedOutcomes: task.progress.outcomeCount
    },
    createdAt
  };
};

export const evaluateCanonicalOwnerValidationCycle = ({
  cycleId,
  tasks,
  evaluatedAt = new Date().toISOString(),
  evidenceByOwner = {}
}: {
  cycleId: string;
  tasks: readonly CanonicalOwnerResearchTask[];
  evaluatedAt?: string;
  evidenceByOwner?: Partial<Record<CanonicalLiveResearchOwnerId, readonly CanonicalOwnerValidationEvidence[]>>;
}): CanonicalOwnerValidationSummary => {
  const currentTasks = tasks.filter((task) => task.cycleId === cycleId);
  const tasksByOwner = new Map(currentTasks.map((task) => [task.ownerStrategyId, task]));
  const owners = CANONICAL_LIVE_RESEARCH_OWNER_ORDER.map((ownerStrategyId) => {
    const task = tasksByOwner.get(ownerStrategyId);
    const storedEvidence = evidenceByOwner[ownerStrategyId] ?? task?.evidence?.map((identity) => validationEvidenceFromResearchTask(task, identity, task.completedAt ?? evaluatedAt));
    return evaluateCanonicalOwnerEvidence({ ownerStrategyId, evidence: storedEvidence, upstreamStatus: task?.status, evaluatedAt });
  });
  const readiness = owners.map((validation) => readinessFor(validation, evidenceByOwner[validation.ownerStrategyId as CanonicalLiveResearchOwnerId]?.at(-1)));
  const accumulationStatusByOwner = Object.fromEntries(currentTasks.map((task) => [
    task.ownerStrategyId,
    task.status === "CAPACITY_BLOCKED"
      ? "CAPACITY_BLOCKED"
      : task.status === "DATASET_UNAVAILABLE"
        ? "DATASET_UNAVAILABLE"
        : task.status === "CERTIFICATE_INVALID"
          ? "CERTIFICATE_INVALID"
          : task.evidenceIds.length
            ? "EVIDENCE_ACCUMULATING"
            : "NO_EVIDENCE"
  ]));
  const policySummary = evaluateCanonicalOwnerPolicyCycle({ cycleId, accumulationStatusByOwner });
  const passed = owners.filter((owner) => owner.status === "VALIDATION_PASSED").length;
  const globallyBlocked = owners.every((owner) => ["DATASET_UNAVAILABLE", "CERTIFICATE_INVALID", "CAPACITY_BLOCKED", "SOURCE_BLOCKED"].includes(owner.status));
  return {
    schemaVersion: OWNER_VALIDATION_VERSION,
    cycleId,
    liveOwnerCount: 5,
    globalStatus: passed === 5 ? "ALL_VALIDATED" : passed > 0 ? "PARTIALLY_VALIDATED" : globallyBlocked ? "VALIDATION_BLOCKED" : "NONE_VALIDATED",
    owners,
    readiness,
    policySummary,
    researchOnly: { ownerStrategyId: "ifvg_fresh_retest_v4_candidate", validationStatus: "RESEARCH_ONLY", readinessStatus: "NOT_APPLICABLE" },
    evaluatedAt,
    researchValidated: false,
    authority: RESEARCH_COVERAGE_AUTHORITY
  };
};

export const preserveCurrentCycleValidation = (
  current: CanonicalOwnerValidationSummary | undefined,
  incoming: CanonicalOwnerValidationSummary,
  activeCycleId: string
) => incoming.cycleId === activeCycleId ? incoming : current;
