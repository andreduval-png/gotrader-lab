export interface GbrainResearchMemoryAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface GbrainResearchMemoryAggregateSummary {
  completedTrades?: number;
  averageR?: number | null;
  maximumDrawdownR?: number | null;
  profitFactor?: number | null;
  positiveCycle?: boolean;
  oosVerdict?: string;
}

export interface GbrainResearchMemoryIdentity {
  evidenceRecordId?: string;
  researchCycleId?: string;
  profileId?: string;
  profileVersion?: string;
  parameterFingerprint?: string;
  requestedSymbol?: string;
  brokerSymbol?: string;
  timeframe?: string;
  marketDate?: string;
  sourceProvider?: string;
}

export interface GbrainResearchMemoryMetadata extends GbrainResearchMemoryIdentity {
  outcome?: string;
  outcomeSummary?: string;
  blockerSummary: string[];
  aggregateSummary?: GbrainResearchMemoryAggregateSummary;
  hypothesisSummary?: string;
}

export interface SearchResearchMemoryInput {
  query: string;
  profileId?: string;
  profileVersion?: string;
  parameterFingerprint?: string;
  sourceFingerprint?: string;
  requestedSymbol?: string;
  brokerSymbol?: string;
  timeframe?: string;
  dateFromUtc?: string;
  dateToUtc?: string;
  outcome?: string;
  blocker?: string;
  tags?: readonly string[];
  limit?: number;
}

export interface ResearchMemoryStatusInput {
  includeCounts?: boolean;
}

export interface GetResearchMemorySummaryInput {
  memoryId: string;
}

export interface GbrainResearchMemoryProvenance {
  source: "local_gbrain_sidecar";
  retrievalMode: "keyword" | "bounded_fallback" | "direct_lookup" | "status";
  advisoryOnly: true;
  nativeEvidenceAuthoritative: true;
  untrustedRetrievedContent: true;
}

export interface GbrainResearchMemorySummary extends GbrainResearchMemoryIdentity {
  memoryId: string;
  title: string;
  createdAtUtc: string;
  storedAtUtc?: string;
  sourceFingerprint?: string;
  receiptId?: string;
  outcome?: string;
  outcomeSummary?: string;
  blockerSummary: string[];
  aggregateSummary?: GbrainResearchMemoryAggregateSummary;
  hypothesisSummary?: string;
  similarityTags: string[];
  indexStatus?: string;
  provenance: GbrainResearchMemoryProvenance;
  advisoryOnly: true;
  nativeEvidenceAuthoritative: true;
  canCreateEvidence: false;
  canApproveReadiness: false;
  canApplyCalibration: false;
  canCreateTradeIntent: false;
  productionAdoptionAllowed: false;
  authority: GbrainResearchMemoryAuthority;
}

export interface ResearchMemoryStatusOutput {
  status: "healthy" | "degraded" | "offline" | "blocked";
  sidecarReachable: boolean;
  gbrainReachable: boolean;
  fallbackSearchAvailable: boolean;
  indexedMemoryCount?: number;
  pendingMemoryCount?: number;
  failedMemoryCount?: number;
  lastSuccessfulSyncUtc?: string;
  lastReceiptId?: string;
  blockers: string[];
  warnings: string[];
  provenance: GbrainResearchMemoryProvenance;
  advisoryOnly: true;
  nativeEvidenceAuthoritative: true;
  productionAdoptionAllowed: false;
  authority: GbrainResearchMemoryAuthority;
}

export interface SearchResearchMemoryOutput {
  status: "complete" | "blocked" | "offline";
  results: GbrainResearchMemorySummary[];
  resultCount: number;
  responseTruncated: boolean;
  blockers: string[];
  warnings: string[];
  provenance: GbrainResearchMemoryProvenance;
  advisoryOnly: true;
  nativeEvidenceAuthoritative: true;
  productionAdoptionAllowed: false;
  authority: GbrainResearchMemoryAuthority;
}

export interface GetResearchMemorySummaryOutput {
  status: "complete" | "not_found" | "blocked" | "offline";
  memory?: GbrainResearchMemorySummary;
  blockers: string[];
  warnings: string[];
  provenance: GbrainResearchMemoryProvenance;
  advisoryOnly: true;
  nativeEvidenceAuthoritative: true;
  productionAdoptionAllowed: false;
  authority: GbrainResearchMemoryAuthority;
}

export const gbrainResearchMemoryAuthorityNone: GbrainResearchMemoryAuthority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
