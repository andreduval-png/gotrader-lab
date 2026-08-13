import type {
  AccountRiskDecision,
  SimulationRiskAcknowledgement
} from "@/lib/risk/accountRiskTypes";

export interface PaperDemoGatewayAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export type PaperDemoGatewayPreparationStatus =
  | "blocked"
  | "already_prepared"
  | "prepared_for_local_paper_simulation_review";

export interface PaperDemoGatewayPreparation {
  preparationId: string;
  idempotencyKey: string;
  proposalId: string;
  validationChainId: string;
  preparedAt: string;
  expiresAt: string;
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
  paperUnitsPreview: number;
  riskBudgetUsd: number;
  riskDecisionId: string;
  riskPolicyVersion: "gotrader_simulation_account_risk_v1";
  riskState: "monitoring" | "warning" | "pre_breach";
  mt5BrokerRevalidationRequired: true;
  status: "prepared_for_local_paper_simulation_review";
  paperOnly: true;
  executable: false;
  brokerSubmissionAttempted: false;
  readinessOverrideApplied: false;
  authority: PaperDemoGatewayAuthority;
}

export interface PaperDemoGatewayState {
  policyVersion: "gotrader_paper_demo_gateway_v1";
  date: string;
  dailyRealizedR: number;
  preparations: PaperDemoGatewayPreparation[];
  authority: PaperDemoGatewayAuthority;
}

export interface PaperDemoGatewayResult {
  status: PaperDemoGatewayPreparationStatus;
  preparation?: PaperDemoGatewayPreparation;
  blockers: string[];
  nextAction: string;
  state: PaperDemoGatewayState;
  brokerSubmissionAttempted: false;
  accountRisk?: {
    decision: AccountRiskDecision;
    acknowledgement?: SimulationRiskAcknowledgement;
  };
  authority: PaperDemoGatewayAuthority;
}
