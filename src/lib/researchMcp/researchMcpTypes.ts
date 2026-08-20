export type ResearchMcpConnectionState = "direct" | "tradingview_upstream" | "stale" | "disconnected" | "blocked";

export interface ResearchMcpToolResponse<T = unknown> {
  status: "available" | "unavailable" | "blocked";
  surface?: string;
  freshness: "fresh" | "stale" | "unavailable";
  capturedAt?: string;
  evidenceId?: string | null;
  blockers: string[];
  activeProfile?: ResearchMcpActiveProfile;
  data?: T;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}

export interface ResearchMcpActiveProfile {
  profileId: string;
  profileVersion: string;
  parameterFingerprint: string;
  sourceFingerprint: string;
  validationIdentity: string;
  sourceProvider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
}

export interface ResearchMcpRuntimeMirror {
  schemaVersion: 1;
  capturedAt: string;
  activeProfile: ResearchMcpActiveProfile;
  currentCycle: unknown;
  results: unknown;
  certifiedEvidence: unknown;
  validation: unknown;
  calibration: unknown;
  readiness: unknown;
  simulatedOutcomes: unknown;
  memory: unknown;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}
