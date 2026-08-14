import type { ResearchCycleRun } from "@/lib/researchCycle/researchCycleTypes";
import type { WalkForwardRun } from "@/lib/walkForward/walkForwardTypes";
import {
  buildValidationProvenanceIdentity,
  matchValidationProvenance
} from "@/lib/validationProvenance";
import {
  applyValidationChainEvidenceUpdate,
  applyValidationChainReplayResult,
  applyValidationChainWalkForwardResult,
  queueValidationChainEntry
} from "./buildValidationChain";
import { saveValidationChainEntry } from "./validationChainStore";
import type {
  ValidationChainEntry,
  ValidationChainReplaySummary,
  ValidationChainWalkForwardSummary
} from "./validationChainTypes";

const MINIMUM_REPLAY_OUTCOMES = 5;
const MINIMUM_REPLAY_TARGET_FIRST_RATE = 0.45;

const replaySummaryFor = (
  cycle: ResearchCycleRun,
  provenance: NonNullable<ResearchCycleRun["validationSummary"]>["provenance"]
): ValidationChainReplaySummary => {
  const outcomeCount =
    cycle.automatedEvidenceSummary?.replayOutcomeCount ??
    cycle.backtestSummary?.totalTrades ??
    0;
  const targetFirstRate =
    cycle.automatedEvidenceSummary?.replayTargetFirstRate ??
    cycle.backtestSummary?.winRate ??
    0;
  const averageR = cycle.canonicalMetrics?.averageR ?? cycle.backtestSummary?.averageR ?? 0;
  const verdict: ValidationChainReplaySummary["verdict"] =
    outcomeCount < MINIMUM_REPLAY_OUTCOMES
      ? "needs_more_data"
      : targetFirstRate >= MINIMUM_REPLAY_TARGET_FIRST_RATE && averageR > 0
        ? "passed"
        : "failed";

  return {
    runId: cycle.validationSummary?.validationId,
    generatedAt: cycle.validationSummary?.generatedAt ?? cycle.completedAt ?? cycle.startedAt,
    verdict,
    totalWindows: 1,
    totalSignals: outcomeCount,
    targetFirstRate,
    averageRr: averageR,
    usableOutcomes: outcomeCount,
    reason:
      verdict === "needs_more_data"
        ? `Only ${outcomeCount} replay outcome(s); ${MINIMUM_REPLAY_OUTCOMES} are required for a replay verdict.`
        : verdict === "passed"
          ? `${outcomeCount} deterministic replay outcomes passed with ${(targetFirstRate * 100).toFixed(1)}% target-first and ${averageR.toFixed(2)}R average.`
          : `${outcomeCount} deterministic replay outcomes did not clear the positive replay thresholds.`,
    provenance
  };
};

const walkForwardSummaryFor = (
  run: WalkForwardRun,
  provenance: NonNullable<WalkForwardRun["provenance"]>
): ValidationChainWalkForwardSummary => {
  const stability = run.stability;
  const verdict: ValidationChainWalkForwardSummary["verdict"] =
    stability?.verdict === "robust_research" ||
    stability?.verdict === "paper_demo_review_candidate" ||
    stability?.verdict === "promising"
      ? "passed"
      : stability?.verdict === "insufficient_evidence" || !stability
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
    provenance
  };
};

export interface ResearchCycleValidationChainLinkResult {
  status: "linked" | "not_available" | "blocked";
  entry?: ValidationChainEntry;
  reason: string;
}

/**
 * Links compact, deterministic cycle artifacts to one exact validation-chain
 * identity. It never creates evidence from recognition alone and never stores
 * candles or mutable broker data.
 */
export function linkResearchCycleValidationChain(input: {
  cycle: ResearchCycleRun;
  walkForwardRun?: WalkForwardRun;
  persist?: boolean;
}): ResearchCycleValidationChainLinkResult {
  const { cycle, walkForwardRun } = input;
  const validation = cycle.validationSummary;
  const originalProvenance = validation?.provenance;
  if (!validation || !originalProvenance) {
    return {
      status: "not_available",
      reason: "The research cycle has no compact validation provenance to link."
    };
  }

  const recognitionId =
    originalProvenance.candidateId ??
    cycle.bestCandidateSummary?.candidateId ??
    `research_cycle_${cycle.cycleId}`;
  const provenance = buildValidationProvenanceIdentity({
    ...originalProvenance,
    candidateId: recognitionId
  });
  const sourceProvider = provenance.sourceProvider ?? cycle.dataSourceMode ?? "unknown";
  const sourceFingerprint =
    provenance.sourceFingerprint ??
    cycle.validationEvidenceSourceFingerprint ??
    cycle.sourceMetadata?.activeSourceFingerprint;
  const isMockOrSample = sourceProvider === "mock" || cycle.dataSourceMode === "mock";

  const queue = queueValidationChainEntry({
    recognitionId,
    recognitionType: "full_model",
    setupLabel:
      provenance.strategyProfile ??
      cycle.ictAdvisorSignalSummary?.strategyId ??
      cycle.ictAdvisorSignalSummary?.setup ??
      "Validated research cycle",
    symbol: provenance.requestedSymbol ?? cycle.thesisSummary?.symbol ?? "MNQ",
    brokerSymbol: provenance.brokerSymbol,
    timeframe: provenance.timeframe ?? cycle.researchTimeframe ?? "5m",
    htfContext: cycle.automatedEvidenceSummary?.marketAnalysisTimeframesLoaded ?? [],
    sourceFingerprint,
    sourceStatus: {
      sourceProvider,
      isMockOrSample,
      isResearchActive: !isMockOrSample && Boolean(sourceFingerprint),
      statusLabel: isMockOrSample ? "mock_sample" : "research_active"
    },
    generatedAt: validation.generatedAt,
    provenance
  });
  if (!queue.ok) {
    return { status: "blocked", entry: queue.entry, reason: queue.reason };
  }

  let entry = applyValidationChainReplayResult(
    {
      ...queue.entry,
      sourceCycleId: cycle.cycleId
    },
    replaySummaryFor(cycle, provenance)
  );

  if (entry.replayResult?.verdict === "passed" && walkForwardRun?.provenance) {
    const originalMatch = matchValidationProvenance(
      originalProvenance,
      walkForwardRun.provenance,
      {
        purpose: "walk_forward",
        requireValidationRunId: true,
        requireWalkForwardRunId: true,
        requireMatchingOosEvidence: true
      }
    );
    if (originalMatch.matched) {
      const walkForwardProvenance = buildValidationProvenanceIdentity({
        ...walkForwardRun.provenance,
        candidateId: recognitionId
      });
      entry = applyValidationChainWalkForwardResult(
        entry,
        walkForwardSummaryFor(walkForwardRun, walkForwardProvenance)
      );
    } else {
      entry = {
        ...entry,
        blockers: [
          ...entry.blockers,
          "Walk-forward evidence was not linked because it does not match the cycle validation identity."
        ],
        nextAction: originalMatch.summary
      };
    }
  }

  if (
    entry.hypothesisStatus === "walk_forward_passed" &&
    cycle.evidenceSummary &&
    cycle.maturitySummary
  ) {
    const evidenceProvenance = buildValidationProvenanceIdentity({
      ...(walkForwardRun?.provenance ?? provenance),
      candidateId: recognitionId
    });
    entry = applyValidationChainEvidenceUpdate(entry, {
      generatedAt: cycle.completedAt ?? cycle.startedAt,
      evidenceQualityScore: cycle.evidenceSummary.evidenceScore,
      maturityScore: cycle.maturitySummary.maturityScore,
      maturityGrade: cycle.maturitySummary.maturityGrade,
      selfImprovementStatus: cycle.createdProposalId ? "proposal_created" : "none",
      detail: "Evidence and maturity linked from the same deterministic research cycle identity.",
      provenance: evidenceProvenance
    });
  }

  if (input.persist !== false) saveValidationChainEntry(entry);
  return {
    status: "linked",
    entry,
    reason: "Research cycle validation, replay, walk-forward, evidence, and maturity were linked by provenance."
  };
}
