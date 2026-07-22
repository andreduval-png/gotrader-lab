import type { V2Authority } from "../authority/v2Authority";

export const V2_MT5_TERMINAL_CLOCK_SCHEMA_ID = "gotrader-mt5-terminal-clock-observation";
export const V2_MT5_TERMINAL_CLOCK_SCHEMA_VERSION = "1.0.0";
export const V2_MT5_TERMINAL_CLOCK_CLASSIFICATION_VERSION = "1.0.0";

export type V2Mt5TimestampBasisClassification =
  | "verified_utc_epoch"
  | "verified_trade_server_wall_clock"
  | "verified_symbol_quote_time_basis"
  | "verified_terminal_calculated_server_time"
  | "current_offset_verified_only"
  | "conflicting_terminal_evidence"
  | "insufficient_evidence"
  | "unknown";

export type V2Mt5PythonTransportBasis =
  | "matches_symbol_quote_time"
  | "matches_terminal_server_time"
  | "matches_utc"
  | "unresolved";

export type V2Mt5TerminalEvidenceStatus =
  | "verified_current_live"
  | "verified_historical"
  | "candidate"
  | "conflicting"
  | "missing";

export type V2Mt5TimeVerificationScope = "none" | "current_live" | "historical";

export interface V2Mt5TerminalClockObservation {
  schemaId: typeof V2_MT5_TERMINAL_CLOCK_SCHEMA_ID;
  version: typeof V2_MT5_TERMINAL_CLOCK_SCHEMA_VERSION;
  observationId: string;
  sequence: number;
  probeInstanceId: string;
  symbol: string;
  timeframe: "M5";
  captureDurationMs: number;
  timeCurrentRaw: number;
  timeTradeServerRaw: number;
  timeGmtRaw: number;
  timeLocalRaw: number;
  timeGmtOffsetSeconds: number;
  timeDaylightSavingsSeconds: number;
  symbolTimeRaw: number;
  symbolTimeMscRaw?: number;
  latestBarOpenRaw: number;
  latestBarIndex: number;
  symbolSynchronized: boolean;
  tickReadSucceeded: boolean;
  barReadSucceeded: boolean;
  terminalBuild?: number;
  authority: Readonly<V2Authority>;
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface V2Mt5TerminalClockComparisonInput {
  observation: Readonly<V2Mt5TerminalClockObservation>;
  systemUtcBeforeMs: number;
  systemUtcAfterMs: number;
  pythonTickRaw: number;
  pythonTickMscRaw?: number;
  pythonLatestM5BarRaw: number;
  wrapperTickRaw?: number;
  wrapperLatestM5BarRaw?: number;
  maximumObservationAgeMs?: number;
  maximumQuoteAgeMs?: number;
  clockToleranceMs?: number;
  historicalDstPolicyVerified?: boolean;
}

export interface V2Mt5TerminalClockDeltas {
  pythonTickMinusTimeCurrentMs: number;
  pythonTickMinusTimeTradeServerMs: number;
  pythonTickMinusTimeGmtMs: number;
  pythonTickMinusSymbolTimeMs: number;
  pythonCandleMinusLatestM5BarMs: number;
  timeCurrentMinusTimeGmtMs: number;
  timeTradeServerMinusTimeCurrentMs: number;
  timeTradeServerMinusTimeGmtMs: number;
  symbolTimeMinusTimeGmtMs: number;
  systemUtcMinusTimeGmtMs: number;
  wrapperTickMinusPythonTickMs?: number;
  wrapperCandleMinusPythonCandleMs?: number;
}

export interface V2Mt5TerminalClockClassification {
  classificationVersion: typeof V2_MT5_TERMINAL_CLOCK_CLASSIFICATION_VERSION;
  basisClassification: V2Mt5TimestampBasisClassification;
  pythonTransportBasis: V2Mt5PythonTransportBasis;
  terminalEvidenceStatus: V2Mt5TerminalEvidenceStatus;
  verificationScope: V2Mt5TimeVerificationScope;
  currentLiveTimeBasisVerified: boolean;
  historicalDstPolicyVerified: boolean;
  phase2Eligible: boolean;
  terminalObservedOffsetMinutes?: number;
  observationAgeMs: number;
  deltas: Readonly<V2Mt5TerminalClockDeltas>;
  blockers: readonly string[];
  warnings: readonly string[];
  authority: Readonly<V2Authority>;
}

export interface V2Mt5TerminalClockValidationResult {
  status: "accepted" | "blocked";
  observation?: Readonly<V2Mt5TerminalClockObservation>;
  blockers: readonly string[];
}
