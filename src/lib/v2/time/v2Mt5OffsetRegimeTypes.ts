import type { V2Authority } from "../authority/v2Authority";
import type {
  V2Mt5PythonTransportBasis,
  V2Mt5TimestampBasisClassification
} from "./v2Mt5TerminalClockTypes";
import type { V2Mt5TimeContractProviderBasis } from "./v2Mt5UpstreamTimeContractTypes";

export const V2_MT5_OFFSET_REGIME_LEDGER_SCHEMA = "gotrader-v2-mt5-offset-regime-ledger";
export const V2_MT5_OFFSET_REGIME_LEDGER_VERSION = "1.0.0";
export const V2_MT5_OFFSET_REGIME_POLICY_VERSION = "gotrader-v2-mt5-offset-regime-continuity-v1";
export const V2_MT5_OFFSET_REGIME_DEFAULT_MAX_GAP_MS = 120_000;
export const V2_MT5_OFFSET_REGIME_MAX_SUMMARIES = 24;

export type V2Mt5OffsetRegimeTerminationReason =
  | "observation_gap"
  | "terminal_instance_changed"
  | "terminal_build_changed"
  | "provider_basis_changed"
  | "provider_offset_changed"
  | "stale_quote"
  | "terminal_evidence_conflict"
  | "observation_rejected";

export interface V2Mt5OffsetRegimeObservation {
  observationId: string;
  probeInstanceId: string;
  brokerSymbol: string;
  capturedAtUtc: string;
  providerTimeBasis: V2Mt5TimeContractProviderBasis;
  observedOffsetMinutes: number;
  terminalBuild?: number;
  basisClassification: V2Mt5TimestampBasisClassification;
  pythonTransportBasis: V2Mt5PythonTransportBasis;
  accepted: boolean;
  blockers: readonly string[];
  warnings: readonly string[];
  authority: Readonly<V2Authority>;
}

export interface V2Mt5OffsetRegimeSummary {
  regimeId: string;
  status: "active" | "terminated";
  brokerSymbol: string;
  probeInstanceId: string;
  providerTimeBasis: V2Mt5TimeContractProviderBasis;
  observedOffsetMinutes: number;
  terminalBuild?: number;
  startedAtUtc: string;
  lastObservedAtUtc: string;
  observationCount: number;
  firstObservationId: string;
  lastObservationId: string;
  continuityHash: string;
  terminatedAtUtc?: string;
  terminationReason?: V2Mt5OffsetRegimeTerminationReason;
}

export interface V2Mt5OffsetRegimeLedger {
  schemaId: typeof V2_MT5_OFFSET_REGIME_LEDGER_SCHEMA;
  version: typeof V2_MT5_OFFSET_REGIME_LEDGER_VERSION;
  policyVersion: typeof V2_MT5_OFFSET_REGIME_POLICY_VERSION;
  brokerSymbol: string;
  maximumGapMs: number;
  regimes: readonly Readonly<V2Mt5OffsetRegimeSummary>[];
  activeRegimeId?: string;
  processedObservationCount: number;
  compactedRegimeCount: number;
  warnings: readonly string[];
  blockers: readonly string[];
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2Mt5OffsetRegimeAppendResult {
  action: "created" | "extended" | "restarted" | "terminated" | "rejected" | "idempotent";
  ledger: Readonly<V2Mt5OffsetRegimeLedger>;
  activeRegime?: Readonly<V2Mt5OffsetRegimeSummary>;
  blockers: readonly string[];
  warnings: readonly string[];
}

export interface V2Mt5OffsetRegimeCoverage {
  eligible: boolean;
  regimeId?: string;
  regimeStartUtc?: string;
  lastObservedAtUtc?: string;
  validUntilUtc?: string;
  blockers: readonly string[];
  warnings: readonly string[];
}
