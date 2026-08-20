export type SimulationRunbookChecklistId =
  | "aiLabThesisGenerated"
  | "handoffExported"
  | "savedLatestHandoff"
  | "readerConversionTested"
  | "schedulerOneCycleCompleted"
  | "signalLogged"
  | "brokerExecutionSkipped"
  | "positionsZero"
  | "tradesZero"
  | "shutdownComplete";

export type SimulationRunbookSignal = "" | "BUY" | "SELL" | "NEUTRAL";

export interface SimulationRunbookChecklistDefinition {
  id: SimulationRunbookChecklistId;
  label: string;
}

export type SimulationRunbookEvidenceSource =
  | "research_cycle_artifact"
  | "handoff_receipt"
  | "scheduler_receipt";

export interface SimulationRunbookCheckEvidence {
  checkId: SimulationRunbookChecklistId;
  cycleId: string;
  recordedAt: string;
  observedAt: string;
  source: SimulationRunbookEvidenceSource;
  sourceEvidenceId: string;
  evidenceId: string;
  previousEvidenceId: string | null;
  profileId: string;
  profileVersion: string;
  parameterFingerprint: string;
  sourceFingerprint: string;
  validationIdentity: string;
  detail: string;
}

export type SimulationRunbookCanonicalStatus = "available" | "blocked" | "unavailable";

export interface SimulationRunbookState {
  schemaVersion?: 2;
  verifiedAt?: string;
  latestResearchPipelineAt?: string;
  latestResearchCycleId?: string;
  latestResearchPipelineStatus?: "completed" | "completed_with_warnings" | "failed";
  symbol: string;
  timeframe: string;
  signal: SimulationRunbookSignal;
  mode: string;
  platform: string;
  notes: string;
  checklist: Record<SimulationRunbookChecklistId, boolean>;
  evidence?: Partial<Record<SimulationRunbookChecklistId, SimulationRunbookCheckEvidence>>;
  canonicalStatus?: SimulationRunbookCanonicalStatus;
  canonicalEvidenceId?: string;
  canonicalBlockers?: string[];
  refreshedAt?: string;
}
