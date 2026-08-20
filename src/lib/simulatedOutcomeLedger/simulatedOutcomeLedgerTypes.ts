export type SimulatedOutcomeSourceKind = "current_cycle" | "backtest" | "paper";

export type SimulatedOutcomeStatus =
  | "pending"
  | "target_hit"
  | "stop_hit"
  | "expired"
  | "rejected";

export interface SimulatedOutcomeIdentity {
  cycleId: string;
  tradeId: string;
  sourceFingerprint: string;
  strategyProfile: string;
  strategyProfileVersion?: string;
  parameterFingerprint: string;
  requestedSymbol: string;
  brokerSymbol?: string;
  timeframe: string;
  sourceProvider?: string;
}

export interface SimulatedOutcomeTargetProvenance {
  type: string;
  sourceTimeframe?: string;
  selectionReason: string;
  distancePoints?: number;
  rr?: number;
  minimumRR?: number;
  gateStatus: "accepted" | "rejected" | "unavailable";
  rejectionReasons: string[];
}

export interface SimulatedOutcomeTradePlan {
  side: "long" | "short" | "flat";
  tradeModel?: string;
  tradeHorizon?: "scalp" | "intraday" | "swing" | "unclassified";
  session?: string;
  entryZone?: [number, number];
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  targetProvenance?: SimulatedOutcomeTargetProvenance;
}

export interface SimulatedOutcomeResult {
  rMultiple?: number;
  maxFavorableExcursion?: number;
  maxAdverseExcursion?: number;
  points?: number;
  targetHit?: boolean;
  stopHit?: boolean;
  reason: string;
}

export interface SimulatedOutcomeEventPayload {
  schemaVersion: 1;
  outcomeKey: string;
  sourceKind: SimulatedOutcomeSourceKind;
  status: SimulatedOutcomeStatus;
  recordedAt: string;
  openedAt?: string;
  resolvedAt?: string;
  previousEventHash?: string;
  identity: SimulatedOutcomeIdentity;
  plan: SimulatedOutcomeTradePlan;
  result?: SimulatedOutcomeResult;
  researchOnly: true;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
  safety: {
    rawCandlesExcluded: true;
    rawSnapshotsExcluded: true;
    accountDataExcluded: true;
    orderDataExcluded: true;
    positionDataExcluded: true;
    secretsExcluded: true;
    executionIntentCreated: false;
  };
}

export interface SimulatedOutcomeEvent extends SimulatedOutcomeEventPayload {
  eventId: string;
  evidenceHash: string;
}

export interface SimulatedOutcomeLedgerReadResult {
  events: SimulatedOutcomeEvent[];
  latest: SimulatedOutcomeEvent[];
  rejectedEventCount: number;
}

export interface SimulatedOutcomeAppendResult {
  status: "appended" | "duplicate";
  backend: "indexeddb" | "localStorage_fallback" | "memory";
  event: SimulatedOutcomeEvent;
}

export const simulatedOutcomeAuthorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
} as const;

export const simulatedOutcomeSafety = {
  rawCandlesExcluded: true,
  rawSnapshotsExcluded: true,
  accountDataExcluded: true,
  orderDataExcluded: true,
  positionDataExcluded: true,
  secretsExcluded: true,
  executionIntentCreated: false
} as const;
