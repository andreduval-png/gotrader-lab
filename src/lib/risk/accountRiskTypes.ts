export type AccountRiskState =
  | "monitoring"
  | "warning"
  | "pre_breach"
  | "locked"
  | "stale_data"
  | "unavailable";

export interface AccountRiskAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface SimulationAccountSnapshot {
  snapshotId: string;
  accountId: string;
  mode: "simulation";
  capturedAt: string;
  heartbeatAt: string;
  sessionDate: string;
  simulatedBalanceUsd: number;
  simulatedEquityUsd: number;
  dailyStartingEquityUsd: number;
  dailyPeakEquityUsd: number;
  dailyRealizedPnlUsd: number;
  simulatedUnrealizedPnlUsd: number;
  openRiskUsd: number;
  activeIntentCount: number;
  sequence: number;
  source: "simulation_adapter";
  brokerDataIncluded: false;
  authority: AccountRiskAuthority;
}

export interface RiskEvaluationRequest {
  requestId: string;
  createdAt: string;
  proposalId: string;
  validationChainId: string;
  strategyProfileId: string;
  sourceProvider: "mt5_read_only";
  sourceFingerprint: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  direction: "long" | "short";
  entry: number;
  stop: number;
  targets: number[];
  requestedRiskUsd: number;
  purpose: "simulation_risk_evaluation";
  brokerSubmissionRequested: false;
  authority: AccountRiskAuthority;
}

export interface SimulationRiskSizing {
  status: "simulation_preview_only" | "blocked";
  sizingMode: "fixed_risk_stop_distance_preview";
  riskDistance: number;
  requestedRiskUsd: number;
  approvedRiskBudgetUsd: number;
  pointValueUsdPerPriceUnit: number;
  rawVolume: number;
  simulationVolumePreview: number | null;
  estimatedRiskUsd: number | null;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  brokerRevalidationRequired: true;
  executable: false;
  blockers: string[];
  warnings: string[];
}

export interface AccountRiskDecision {
  decisionId: string;
  evaluatedAt: string;
  policyVersion: "gotrader_simulation_account_risk_v1";
  requestId: string;
  accountId: string;
  evaluatedSnapshotId?: string;
  evaluatedStateSequence?: number;
  status: "approved_for_simulation" | "blocked";
  riskState: AccountRiskState;
  sizing: SimulationRiskSizing;
  metrics: {
    currentDrawdownUsd: number;
    drawdownRatio: number;
    currentOpenRiskUsd: number;
    projectedOpenRiskUsd: number;
    projectedDailyRiskUsd: number;
    remainingDailyLossCapacityUsd: number;
    remainingOpenRiskCapacityUsd: number;
    activeIntentCount: number;
    maxConcurrentIntents: number;
    heartbeatAgeMs: number | null;
  };
  blockers: string[];
  warnings: string[];
  nextAction: string;
  simulationOnly: true;
  brokerSubmissionAllowed: false;
  liveExecutionAllowed: false;
  mt5Requirements: {
    independentGatewayRequired: true;
    demoAccountRequired: true;
    liveAccountAllowed: false;
    recomputeVolumeFromTerminalSymbolMetadata: true;
    requireTickValue: true;
    requireTickSize: true;
    requireVolumeMinMaxStep: true;
    requireMarginCheck: true;
    requireProtectedStopAndTarget: true;
    requireFreshBrokerSnapshotAtDispatch: true;
    trustSimulationVolumePreview: false;
  };
  authority: AccountRiskAuthority;
}

export interface SimulationRiskCommand {
  contract: "gotrader.simulation_risk_command";
  version: "1.0";
  commandId: string;
  idempotencyKey: string;
  createdAt: string;
  expiresAt: string;
  type: "reserve_simulation_risk";
  accountId: string;
  proposalId: string;
  validationChainId: string;
  strategyProfileId: string;
  requestedSymbol: string;
  brokerSymbol: string;
  direction: "long" | "short";
  riskDecisionId: string;
  riskPolicyVersion: "gotrader_simulation_account_risk_v1";
  expectedStateSequence: number;
  approvedRiskUsd: number;
  simulationVolumePreview: number;
  simulationOnly: true;
  brokerSubmissionAllowed: false;
  authority: AccountRiskAuthority;
}

export interface SimulationRiskAcknowledgement {
  contract: "gotrader.simulation_risk_acknowledgement";
  version: "1.0";
  acknowledgementId: string;
  commandId: string;
  acknowledgedAt: string;
  status:
    | "simulation_risk_reserved"
    | "duplicate_ignored"
    | "reservation_rejected"
    | "simulation_outcome_recorded"
    | "reservation_not_found";
  message: string;
  blockers?: string[];
  outcomeR?: number;
  realizedPnlUsd?: number;
  brokerCallMade: false;
  authority: AccountRiskAuthority;
}
