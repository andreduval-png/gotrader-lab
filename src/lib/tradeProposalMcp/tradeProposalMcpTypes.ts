export type TradeProposalDirection = "long" | "short";
export type TradeProposalStatus = "blocked" | "queued_for_deterministic_validation";

export interface CompactTradeEvaluationProposal {
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  strategyProfileId: string;
  direction: TradeProposalDirection;
  entry: number;
  stop: number;
  targets: number[];
  sourceProvider?: "mt5_read_only";
  sourceFingerprint?: string;
  validationChainId?: string;
  rationale?: string;
  autoApplyAllowed?: false;
  authority?: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}

export interface TradeProposalMcpAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface TradeProposalSizingPreview {
  status: "paper_preview_only" | "blocked_policy_not_configured" | "blocked_risk_budget_too_small";
  riskDistance: number;
  paperUnitsPreview: number | null;
  riskBudgetUsd: number | null;
  pointValueUsd: number | null;
  executable: false;
  reason: string;
}

export interface TradeProposalMcpEvaluation {
  proposalId: string;
  createdAt: string;
  policyVersion:
    | "gotrader_trade_proposal_mcp_research_v1"
    | "gotrader_trade_proposal_mcp_research_v2";
  audit?: {
    agentId: string;
    sessionId: string;
    correlationId: string;
    transport: "stdio";
  };
  status: TradeProposalStatus;
  compactProposal: Omit<CompactTradeEvaluationProposal, "rationale" | "authority" | "autoApplyAllowed">;
  deterministicChecks: {
    payloadSafe: boolean;
    sourceIdentityValid: boolean;
    profileAllowlisted: boolean;
    geometryValid: boolean;
    rr: number | null;
    minimumRr: 2;
    validationContext:
      | "reference_supplied_unverified"
      | "authoritative_match"
      | "blocked"
      | "missing";
  };
  sizingPreview: TradeProposalSizingPreview;
  blockedFields: string[];
  blockers: string[];
  warnings: string[];
  nextAction: string;
  brokerGateway: {
    status: "disabled";
    submissionAttempted: false;
    monitoringStatus: "not_started";
  };
  autoApplyAllowed: false;
  profileMutationAllowed: false;
  paperDemoPromotionAllowed: false;
  liveExecutionAllowed: false;
  authority: TradeProposalMcpAuthority;
}
