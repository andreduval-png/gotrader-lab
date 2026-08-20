import { normalizeCycleMetricsForDisplay } from "@/lib/performance/canonicalMetrics";
import { loadGbrainMemoryOutbox } from "@/lib/researchMemory";
import { buildResultsWorkspaceSnapshot } from "@/lib/results";
import { resolveResearchRuntimeSnapshot } from "@/lib/runtime";
import { listSimulatedOutcomeEvents } from "@/lib/simulatedOutcomeLedger";
import { loadSelfImprovementState } from "@/lib/selfImprovement";
import { readLatestActivateMarketSummary } from "@/lib/ict-strategy-suite/ictActivateMarketPipeline";
import { readLatestResearchState } from "@/lib/ict-strategy-suite";
import { loadPaperDemoOperationsState } from "@/lib/paperDemoOperations";
import { loadPredictionLedger } from "@/lib/predictionLedger";
import { loadForwardEvidenceLedger } from "@/lib/forwardEvidence";
import { latestValidationChainEntry, readValidationChainState } from "@/lib/validationChain";
import type { ResearchMcpRuntimeMirror } from "./researchMcpTypes";

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;

export async function buildResearchMcpRuntimeMirror(): Promise<ResearchMcpRuntimeMirror> {
  const runtime = await resolveResearchRuntimeSnapshot();
  const outcomes = await listSimulatedOutcomeEvents();
  const selfImprovement = loadSelfImprovementState();
  const memory = loadGbrainMemoryOutbox();
  const metrics = runtime.performance.canonicalPerformanceMetrics ?? normalizeCycleMetricsForDisplay(runtime.latestResearchCycle.latestRun);
  const results = buildResultsWorkspaceSnapshot({
    runtimeSnapshot: runtime,
    canonicalMetrics: metrics,
    activationSummary: readLatestActivateMarketSummary(),
    latestResearchState: readLatestResearchState(),
    walkForward: runtime.walkForward.latestRun,
    validationChainEntry: latestValidationChainEntry(readValidationChainState()),
    paperDemoState: loadPaperDemoOperationsState(),
    predictionLedger: loadPredictionLedger(),
    forwardEvidenceEntries: loadForwardEvidenceLedger()
  });
  const identity = runtime.researchIdentity.active;
  const validationIdentity = runtime.researchIdentity.matchingValidationId ?? identity.validationRunId ?? "";
  const validationLedgerEntry = runtime.evidence.evidenceLedgerSummary.entries.find(
    (entry) =>
      Boolean(validationIdentity) &&
      entry.category === "validation results" &&
      entry.label === `Validation ${validationIdentity}` &&
      entry.sourceType !== "unavailable"
  );
  return {
    schemaVersion: 1,
    capturedAt: runtime.generatedAt,
    activeProfile: {
      profileId: identity.strategyProfile ?? "",
      profileVersion: identity.strategyProfileVersion ?? "",
      parameterFingerprint: identity.parameterFingerprint ?? "",
      sourceFingerprint: identity.sourceFingerprint ?? "",
      validationIdentity,
      sourceProvider: identity.sourceProvider ?? runtime.marketData.activeResearchSource.provider,
      requestedSymbol: identity.requestedSymbol ?? runtime.marketData.symbol,
      brokerSymbol: identity.brokerSymbol ?? runtime.mt5ReadOnly.brokerSymbol ?? "",
      timeframe: identity.timeframe ?? runtime.marketData.timeframe
    },
    currentCycle: {
      cycleId: runtime.latestResearchCycle.latestCycleId ?? null,
      status: runtime.latestResearchCycle.latestCycleStatus ?? "unavailable",
      startedAt: runtime.latestResearchCycle.latestRun?.startedAt ?? null,
      completedAt: runtime.latestResearchCycle.latestRun?.completedAt ?? null,
      thesis: runtime.latestResearchCycle.latestThesisSummary,
      validationSummary: runtime.latestResearchCycle.latestValidationSummary ?? null,
      researchQualitySummary: runtime.latestResearchCycle.latestResearchQualitySummary ?? null,
      readinessSummary: runtime.latestResearchCycle.latestReadinessSummary ?? null,
      evidenceIds: [
        runtime.researchIdentity.matchingValidationId,
        runtime.researchIdentity.matchingResearchQualityReviewId,
        runtime.researchIdentity.matchingWalkForwardRunId
      ].filter(Boolean)
    },
    results,
    certifiedEvidence: {
      score: runtime.evidence.evidenceQualityScore,
      entries: runtime.evidence.evidenceLedgerSummary.entries.map((entry) => ({
        evidenceId: entry.entryId === validationLedgerEntry?.entryId ? validationIdentity : entry.entryId,
        ledgerEntryId: entry.entryId,
        category: entry.category,
        label: entry.label,
        sourceType: entry.sourceType,
        qualityScore: entry.qualityScore,
        certificationStatus:
          entry.entryId === validationLedgerEntry?.entryId && runtime.researchIdentity.validationMatched
            ? "identity_matched"
            : "summary_only",
        profileId: entry.entryId === validationLedgerEntry?.entryId ? identity.strategyProfile ?? "" : undefined,
        profileVersion: entry.entryId === validationLedgerEntry?.entryId ? identity.strategyProfileVersion ?? "" : undefined,
        parameterFingerprint: entry.entryId === validationLedgerEntry?.entryId ? identity.parameterFingerprint ?? "" : undefined,
        sourceFingerprint: entry.entryId === validationLedgerEntry?.entryId ? identity.sourceFingerprint ?? "" : undefined,
        validationIdentity: entry.entryId === validationLedgerEntry?.entryId ? validationIdentity : undefined
      })),
      warnings: runtime.evidence.readinessEvidenceWarnings
    },
    validation: {
      status: runtime.researchIdentity.validationMatched ? "available" : "blocked",
      identityStatus: runtime.researchIdentity.validationStatus,
      evidenceId: validationIdentity || null,
      blockers: runtime.researchIdentity.validationBlockers,
      walkForwardRunId: runtime.researchIdentity.matchingWalkForwardRunId ?? null,
      freshnessTimestamp: runtime.walkForward.latestTimestamp ?? runtime.latestResearchCycle.latestCycleTimestamp ?? runtime.generatedAt
    },
    calibration: {
      proposals: selfImprovement.proposals.slice(0, 30).map((proposal) => ({
        proposalId: proposal.proposalId,
        status: proposal.status,
        source: proposal.source,
        intent: proposal.proposalIntent ?? null,
        createdAt: proposal.timestamp,
        validationStatus: proposal.testedAt ? "tested" : "not_tested",
        rejectionReason: proposal.approvalNotes ?? null,
        approvalRequired: true,
        autoApplyAllowed: false
      }))
    },
    readiness: {
      state: runtime.readiness.readinessState,
      blockers: runtime.readiness.actualBlockers,
      passedRequirements: runtime.readiness.passedRequirements,
      warnings: runtime.readiness.warnings,
      nextAction: runtime.readiness.nextAction,
      evidenceId: validationIdentity || null
    },
    simulatedOutcomes: {
      rejectedEventCount: outcomes.rejectedEventCount,
      records: outcomes.latest.slice(0, 500)
    },
    memory: {
      deliveryEnabled: memory.deliveryEnabled === true,
      endpointHost: memory.endpointHost ?? null,
      queued: memory.entries.filter((entry) => entry.status === "pending").length,
      delivered: memory.entries.filter((entry) => entry.status === "delivered").length,
      failed: memory.entries.filter((entry) => entry.status === "failed").length,
      updatedAt: memory.entries[0]?.queuedAt ?? runtime.generatedAt
    },
    authority
  };
}
