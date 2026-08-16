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

export type SimulationRunbookEvidenceSourceKind =
  | "research_cycle_artifact"
  | "handoff_receipt"
  | "reader_receipt"
  | "scheduler_receipt"
  | "signal_receipt"
  | "authority_snapshot"
  | "position_snapshot"
  | "trade_snapshot"
  | "shutdown_receipt";

export interface SimulationRunbookChecklistDefinition {
  id: SimulationRunbookChecklistId;
  label: string;
}

export interface SimulationRunbookEvidenceReceipt {
  contract: "gotrader.simulation_runbook_evidence";
  version: "1.0";
  evidenceId: string;
  previousEvidenceId: string | null;
  cycleId: string;
  checkId: SimulationRunbookChecklistId;
  observedAt: string;
  recordedAt: string;
  sourceKind: SimulationRunbookEvidenceSourceKind;
  sourceId: string;
  sourceDigest: string;
  profileId: string | null;
  parameterFingerprint: string | null;
  sourceFingerprint: string | null;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}

export interface AppendSimulationRunbookEvidenceInput {
  cycleId: string;
  checkId: SimulationRunbookChecklistId;
  observedAt: string;
  sourceKind: SimulationRunbookEvidenceSourceKind;
  sourceId: string;
  sourceDigest: string;
  profileId?: string;
  parameterFingerprint?: string;
  sourceFingerprint?: string;
}

export interface SimulationRunbookState {
  storageStatus: "unavailable" | "loading" | "current_cycle";
  currentCycleId?: string;
  verifiedAt?: string;
  latestResearchPipelineAt?: string;
  latestResearchCycleId?: string;
  latestResearchPipelineStatus?: "completed" | "completed_with_warnings" | "failed";
  symbol: string;
  timeframe: string;
  signal: SimulationRunbookSignal;
  mode: "simulation";
  platform: string;
  notes: string;
  checklist: Record<SimulationRunbookChecklistId, boolean>;
  evidence: SimulationRunbookEvidenceReceipt[];
  evidenceChainValid: boolean;
  evidenceChainHead?: string;
  legacyMigrationArchived: boolean;
  blocker?: string;
}
