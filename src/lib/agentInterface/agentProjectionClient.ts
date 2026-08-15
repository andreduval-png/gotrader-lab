import type { ResearchCycleRun } from "@/lib/researchCycle/researchCycleTypes";
import type { ResultsWorkspaceSnapshot } from "@/lib/results/resultsWorkspaceTypes";

const CONTRACT = "gotrader.agent_projection";
const VERSION = "1.0";
const AUTHORITY = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;
const endpoint = String(
  import.meta.env.VITE_GOTRADER_AGENT_INTERFACE_URL ?? "http://127.0.0.1:8799"
).replace(/\/$/, "");

const postProjection = async (route: string, projection: unknown) => {
  const response = await fetch(`${endpoint}/v1/projections/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(projection)
  });
  if (!response.ok) throw new Error(`Agent projection publish failed with HTTP ${response.status}.`);
};

export const publishCurrentCycleProjection = async (run: ResearchCycleRun) => {
  const generatedAt = run.completedAt ?? new Date().toISOString();
  await postProjection("current-cycle", {
    contract: CONTRACT,
    version: VERSION,
    projectionType: "current_cycle",
    generatedAt,
    observedAt: run.completedAt ?? run.startedAt,
    identities: {
      cycleId: run.cycleId,
      evidenceRecordId: run.evidenceRecordId,
      evidenceIdentityKey: run.evidenceIdentityKey,
      validationReportId: run.validationReport?.id,
      strategyId: run.ictAdvisorSignalSummary?.strategyId,
      candidateId: run.bestCandidateSummary?.candidateId,
      sourceFingerprint: run.sourceMetadata?.activeSourceFingerprint
    },
    payload: {
      cycleId: run.cycleId,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      status: run.status,
      resultSummary: run.resultSummary,
      nextRecommendedAction: run.nextRecommendedAction,
      source: run.sourceMetadata,
      thesis: run.thesisSummary,
      candidate: run.bestCandidateSummary,
      advisorSignal: run.ictAdvisorSignalSummary,
      canonicalMetrics: run.canonicalMetrics,
      validation: run.validationSummary,
      researchQuality: run.researchQualitySummary,
      readiness: run.readinessSnapshot,
      historicalEvidence: run.historicalEvidenceContract,
      blockers: run.blockers ?? [],
      promotionBlockers: run.promotionBlockers ?? [],
      safetyNotice: run.safetyNotice
    },
    authority: AUTHORITY
  });
};

export const publishResultsProjection = async (snapshot: ResultsWorkspaceSnapshot) => {
  await postProjection("results", {
    contract: CONTRACT,
    version: VERSION,
    projectionType: "results",
    generatedAt: snapshot.generatedAt,
    observedAt: snapshot.generatedAt,
    identities: {
      cycleId: snapshot.backtest.cycleId,
      strategyProfile: snapshot.frozenProfile.profileId,
      sourceFingerprint: snapshot.source.fingerprint
    },
    payload: snapshot,
    authority: AUTHORITY
  });
};
