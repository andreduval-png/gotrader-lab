import type { IctManualReplayReviewResult } from "@/lib/ict-strategy-suite/ictManualReplayReviewTypes";
import type { WalkForwardRun } from "@/lib/walkForward";
import {
  applyValidationChainEvidenceUpdate,
  applyValidationChainReplayResult,
  applyValidationChainWalkForwardResult
} from "./buildValidationChain";
import {
  latestValidationChainEntry,
  saveValidationChainEntry,
  updateLatestValidationChainEntry
} from "./validationChainStore";
import type { ValidationChainEntry, ValidationChainReplaySummary, ValidationChainWalkForwardSummary } from "./validationChainTypes";

const REPLAY_MINIMUM_SIGNALS = 5;
const REPLAY_PASS_TARGET_FIRST_RATE = 0.45;

export const replaySummaryFromManualReview = (review: IctManualReplayReviewResult): ValidationChainReplaySummary => {
  const verdict =
    review.status !== "completed"
      ? "needs_more_data"
      : review.totalSignals < REPLAY_MINIMUM_SIGNALS
        ? "needs_more_data"
        : review.targetFirstRate >= REPLAY_PASS_TARGET_FIRST_RATE
          ? "passed"
          : "failed";
  return {
    runId: review.runId,
    generatedAt: review.generatedAt,
    verdict,
    totalWindows: review.totalWindows,
    totalSignals: review.totalSignals,
    targetFirstRate: review.targetFirstRate,
    averageRr: review.averageRrAchieved,
    usableOutcomes: review.monteCarloOutcomes?.length,
    reason:
      review.status !== "completed"
        ? review.status === "unavailable"
          ? "Replay review was unavailable."
          : "Replay review did not complete."
        : review.totalSignals < REPLAY_MINIMUM_SIGNALS
          ? `Only ${review.totalSignals} replay signal(s); ${REPLAY_MINIMUM_SIGNALS}+ needed for a verdict.`
          : `Target-first rate ${(review.targetFirstRate * 100).toFixed(0)}% across ${review.totalSignals} signals.`,
    provenance: review.provenance
  };
};

export const recordReplayReviewInValidationChain = (
  review: IctManualReplayReviewResult
): ValidationChainEntry | undefined =>
  updateLatestValidationChainEntry((entry) => {
    if (entry.hypothesisStatus === "replay_failed" || entry.hypothesisStatus === "rejected") {
      return entry;
    }
    return applyValidationChainReplayResult(entry, replaySummaryFromManualReview(review));
  });

export const walkForwardSummaryFromRun = (run: WalkForwardRun): ValidationChainWalkForwardSummary => {
  const stability = run.stability;
  const verdict: ValidationChainWalkForwardSummary["verdict"] = !stability
    ? "needs_more_data"
    : stability.verdict === "robust_research" ||
        stability.verdict === "paper_demo_review_candidate" ||
        stability.verdict === "promising"
      ? "passed"
      : stability.verdict === "insufficient_evidence"
        ? "needs_more_data"
        : "failed";
  const tradeCount = run.windows.reduce(
    (sum, window) => sum + (window.metricsBySplit?.out_of_sample?.totalTrades ?? 0),
    0
  );
  return {
    runId: run.runId,
    generatedAt: run.completedAt ?? run.startedAt,
    verdict,
    grade: stability?.stabilityScore,
    oosVerdict: stability?.verdict,
    tradeCount,
    windowsTested: run.actualWindowsGenerated,
    oosWindowsPassed: stability?.outOfSampleWindowsPassed,
    warningFlags: [...run.warnings, ...(stability?.failReasons ?? [])].slice(0, 6),
    reason: stability?.summary ?? "Walk-forward run has no stability summary yet.",
    provenance: run.provenance
  };
};

export const recordWalkForwardRunInValidationChain = (run: WalkForwardRun): ValidationChainEntry | undefined => {
  const latest = latestValidationChainEntry();
  if (!latest) {
    return undefined;
  }
  if (run.status !== "completed" && run.status !== "completed_with_warnings") {
    return undefined;
  }
  if (latest.walkForwardResult?.runId === run.runId) {
    return latest;
  }
  const next = applyValidationChainWalkForwardResult(latest, walkForwardSummaryFromRun(run));
  saveValidationChainEntry(next);
  return next;
};

export const recordEvidenceUpdateInValidationChain = (input: {
  evidenceQualityScore?: number;
  maturityScore?: number;
  maturityGrade?: string;
  selfImprovementStatus?: string;
  provenance?: ValidationChainEntry["provenance"];
}): ValidationChainEntry | undefined => {
  const latest = latestValidationChainEntry();
  if (!latest) {
    return undefined;
  }
  // Allow evidence snapshots after walk-forward progress or when chain is still collecting.
  const eligibleStatuses = new Set([
    "walk_forward_passed",
    "walk_forward_required",
    "walk_forward_running",
    "needs_more_data",
    "replay_passed"
  ]);
  if (!eligibleStatuses.has(latest.hypothesisStatus) && latest.hypothesisStatus !== "walk_forward_passed") {
    // Still record when walk-forward already produced a result on the entry.
    if (!latest.walkForwardResult) {
      return latest;
    }
  }
  return updateLatestValidationChainEntry((entry) =>
    applyValidationChainEvidenceUpdate(entry, {
      generatedAt: new Date().toISOString(),
      evidenceQualityScore: input.evidenceQualityScore,
      maturityScore: input.maturityScore,
      maturityGrade: input.maturityGrade,
      selfImprovementStatus: input.selfImprovementStatus,
      provenance: input.provenance,
      detail: "Evidence/maturity snapshot recorded after research cycle. Readiness gates remain deterministic."
    })
  );
};
