import type { SimulationAuthority } from "./simulationAuthority";

export type SimulationDirection = "long" | "short";
export type SimulationOrderPolicy = "market_at_next_open" | "limit_at_price" | "stop_at_price";
export type SimulationIntrabarPolicy =
  | "conservative_stop_first_v1"
  | "ambiguous_no_result_v1"
  | "lower_timeframe_resolution_v1";
export type SimulationTerminalState =
  | "exited"
  | "expired_unfilled"
  | "ambiguous"
  | "insufficient_data"
  | "blocked";

export interface SimulationCapabilities {
  readonly productionAdoptionAllowed: false;
  readonly canCreateEvidence: false;
  readonly canApproveReadiness: false;
  readonly canApplyCalibration: false;
  readonly canCreateTradeIntent: false;
  readonly canPlaceOrder: false;
}

export interface CanonicalOpportunityCore {
  readonly schemaVersion: "gotrader-canonical-opportunity-bt2-v1";
  readonly adapterVersion: string;
  readonly datasetCertificateId: string;
  readonly datasetId: string;
  readonly strategyId: string;
  readonly profileVersion: string;
  readonly parameterHash: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly timeframe: string;
  readonly decisionAtUtc: string;
  readonly sourceCandleClosedAtUtc: string;
  readonly contextLineageRoot: string;
  readonly direction: SimulationDirection;
  readonly geometryMode: "native_strategy_geometry";
  readonly orderPolicy: SimulationOrderPolicy;
  readonly activatesAtUtc: string;
  readonly expiresAtUtc: string;
  readonly signalPrice: number;
  readonly entryPrice: number;
  readonly stopPrice: number;
  readonly targetPrices: readonly number[];
  readonly eligible: boolean;
  readonly blockers: readonly string[];
  readonly authority: Readonly<SimulationAuthority>;
  readonly capabilities: Readonly<SimulationCapabilities>;
}

export interface CanonicalOpportunity extends CanonicalOpportunityCore {
  readonly opportunityId: string;
}

export interface SimulationCandle {
  readonly openTimeUtc: string;
  readonly closeTimeUtc: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly spreadPoints?: number;
}

export interface SimulationCostModel {
  readonly modelId: string;
  readonly version: string;
  readonly pointSize: number;
  readonly spreadMode: "candle" | "static" | "none";
  readonly staticSpreadPoints?: number;
  readonly slippagePoints: number;
  readonly commissionR: number;
  readonly swapR: number;
}

export interface SimulationTransition {
  readonly ordinal: number;
  readonly state: "received" | "activation_pending" | "active_order" | "filled" | "open" | SimulationTerminalState;
  readonly atUtc: string;
  readonly reason: string;
  readonly candleOpenTimeUtc?: string;
  readonly price?: number;
}

export interface TradeSimulationRecordCore {
  readonly schemaVersion: "gotrader-trade-simulation-record-bt2-v1";
  readonly engineVersion: "bt2-pure-simulator-v1";
  readonly opportunityId: string;
  readonly datasetCertificateId: string;
  readonly datasetId: string;
  readonly intrabarPolicy: SimulationIntrabarPolicy;
  readonly costModelId: string;
  readonly terminalState: SimulationTerminalState;
  readonly exitReason: string;
  readonly fillPrice?: number;
  readonly exitPrice?: number;
  readonly grossR?: number;
  readonly costR?: number;
  readonly netR?: number;
  readonly maePrice?: number;
  readonly mfePrice?: number;
  readonly maePoints?: number;
  readonly mfePoints?: number;
  readonly maeR?: number;
  readonly mfeR?: number;
  readonly transitions: readonly Readonly<SimulationTransition>[];
  readonly blockers: readonly string[];
  readonly authority: Readonly<SimulationAuthority>;
  readonly capabilities: Readonly<SimulationCapabilities>;
}

export interface TradeSimulationRecord extends TradeSimulationRecordCore {
  readonly recordId: string;
}

export interface TradeLedgerSealCore {
  readonly schemaVersion: "gotrader-trade-ledger-seal-bt2-v1";
  readonly experimentId: string;
  readonly datasetCertificateId: string;
  readonly orderedRecordIds: readonly string[];
  readonly outcomeCounts: Readonly<Record<SimulationTerminalState, number>>;
  readonly checkpointLineage: readonly string[];
  readonly codeCommit: string;
  readonly authority: Readonly<SimulationAuthority>;
  readonly capabilities: Readonly<SimulationCapabilities>;
}

export interface TradeLedgerSeal extends TradeLedgerSealCore {
  readonly ledgerSealId: string;
}

export interface SimulationCheckpointCore {
  readonly schemaVersion: "gotrader-simulation-checkpoint-bt2-v1";
  readonly experimentId: string;
  readonly nextOpportunityOrdinal: number;
  readonly committedRecordIds: readonly string[];
  readonly authority: Readonly<SimulationAuthority>;
}

export interface SimulationCheckpoint extends SimulationCheckpointCore {
  readonly checkpointId: string;
}
