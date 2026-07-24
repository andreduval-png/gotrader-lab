import type { V2MarketDataCapability } from "../authority/v2Authority";
import type { V2MarketDataIdentity, V2SourceIdentity, V2SourceKind } from "../identity/v2IdentityTypes";
import type { V2ProviderTimeBasis, V2TimeNormalizationAudit } from "../time/v2TimeNormalizationTypes";
import type { V2Mt5TimeContractVerificationStatus } from "../time/v2Mt5UpstreamTimeContractTypes";

export type V2CandlePurpose =
  | "current_read"
  | "context_shadow"
  | "replay"
  | "walk_forward"
  | "deep_research";

export type V2ClosureSource =
  | "provider_event"
  | "timeframe_elapsed"
  | "historical_dataset"
  | "replay_snapshot"
  | "mock_sample";

export type V2ClosurePolicy =
  | "explicit_closed"
  | "elapsed_time"
  | "historical_dataset"
  | "replay_snapshot"
  | "mock_sample";

export type V2DataQualityStatus = "eligible" | "degraded" | "blocked";

export interface V2CanonicalCandle {
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  isClosed: true;
  closureSource: V2ClosureSource;
  providerTime?: string;
  receivedAt?: string;
  timeAudit?: Readonly<V2TimeNormalizationAudit>;
}

export interface V2DataQualityDiagnostics {
  status: V2DataQualityStatus;
  inputCount: number;
  candleCount: number;
  rejectedCount: number;
  duplicateCount: number;
  conflictingDuplicateCount: number;
  outOfOrderCount: number;
  invalidOhlcCount: number;
  invalidVolumeCount: number;
  invalidTimestampCount: number;
  partialCandleCount: number;
  closureUnknownCount: number;
  futureTimestampCount: number;
  gapCount: number;
  stale: boolean;
  missingTimeframes: readonly string[];
  warnings: readonly string[];
  blockers: readonly string[];
  repairPolicy: "reject_invalid_sort_ascending_deduplicate_identical";
}

export interface V2EvidencePolicy {
  evidencePurpose: boolean;
  sourceEligible: boolean;
  dataQualityEligible: boolean;
  mayCreateEvidence: boolean;
  repositoryCreatesEvidence: false;
  reason: string;
}

export interface V2SourceTimeEligibility {
  currentLiveEligible: boolean;
  historicalEligible: boolean;
  boundedHistoricalContextEligible?: boolean;
  boundedHistoricalContextArtifactId?: string;
  verificationScope: "none" | "current_live" | "historical";
  verifiedAtUtc?: string;
  currentLiveValidUntilUtc?: string;
  offsetRegimeStartUtc?: string;
  offsetRegimeId?: string;
  blockers: readonly string[];
  warnings: readonly string[];
}

export interface V2CanonicalCandleQuery {
  source: Readonly<V2SourceIdentity>;
  timeframe: string;
  start?: string;
  end?: string;
  limit?: number;
  closedOnly: true;
  purpose: V2CandlePurpose;
}

export interface V2CanonicalCandleWindow {
  identity: Readonly<V2MarketDataIdentity>;
  candles: readonly Readonly<V2CanonicalCandle>[];
  diagnostics: Readonly<V2DataQualityDiagnostics>;
  capability: Readonly<V2MarketDataCapability>;
  evidencePolicy: Readonly<V2EvidencePolicy>;
  timeEligibility?: Readonly<V2SourceTimeEligibility>;
  adapterId: string;
  adapterVersion: string;
  shadowOnly: true;
}

export interface V2SourceDescription {
  adapterId: string;
  adapterVersion: string;
  source: Readonly<V2SourceIdentity>;
  availableTimeframes: readonly string[];
  sourceKind: V2SourceKind;
  stale: boolean;
  warnings: readonly string[];
  capability: Readonly<V2MarketDataCapability>;
  providerTimeBasis?: V2ProviderTimeBasis;
  timeNormalizationPolicyId?: string;
  timeNormalizationPolicyVersion?: string;
  timeContractId?: string;
  timeContractVersion?: string;
  timeContractVerificationStatus?: V2Mt5TimeContractVerificationStatus;
  terminalClockClassificationVersion?: string;
  timeVerificationScope?: "none" | "current_live" | "historical";
  timeEligibility?: Readonly<V2SourceTimeEligibility>;
  shadowOnly: true;
}

export interface V2CandleRepository {
  getWindow(query: V2CanonicalCandleQuery): Promise<V2CanonicalCandleWindow>;
  getAvailableTimeframes(source: V2SourceIdentity): Promise<readonly string[]>;
  describeSource(source: V2SourceIdentity): Promise<V2SourceDescription>;
}

export type V2CandleRepositoryErrorCode =
  | "source_unavailable"
  | "source_identity_mismatch"
  | "source_kind_unsupported"
  | "timeframe_unavailable"
  | "query_invalid"
  | "query_limit_exceeded"
  | "deep_history_not_explicit"
  | "mock_evidence_forbidden"
  | "closed_state_unknown"
  | "data_quality_blocked"
  | "adapter_unavailable";

export class V2CandleRepositoryError extends Error {
  readonly code: V2CandleRepositoryErrorCode;

  constructor(code: V2CandleRepositoryErrorCode, message: string) {
    super(message);
    this.name = "V2CandleRepositoryError";
    this.code = code;
  }
}

export interface V2LegacyCandleLike {
  timestamp?: string;
  openTime?: string;
  closeTime?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  closed?: boolean;
  isClosed?: boolean;
  providerTime?: string;
  serverTimestamp?: string;
  receivedAt?: string;
  rawProviderTime?: string | number;
  rawProviderCloseTime?: string | number;
  timeAudit?: Readonly<V2TimeNormalizationAudit>;
}

export interface V2LegacyCandleSourceSnapshot {
  identity: Readonly<V2SourceIdentity>;
  timeframe: string;
  candles: readonly V2LegacyCandleLike[];
  closurePolicy: V2ClosurePolicy;
  stale?: boolean;
  warnings?: readonly string[];
  providerTimeBasis?: V2ProviderTimeBasis;
  timeNormalizationPolicyId?: string;
  timeNormalizationPolicyVersion?: string;
  timeContractId?: string;
  timeContractVersion?: string;
  timeContractVerificationStatus?: V2Mt5TimeContractVerificationStatus;
  terminalClockClassificationVersion?: string;
  timeVerificationScope?: "none" | "current_live" | "historical";
  timeEligibility?: Readonly<V2SourceTimeEligibility>;
}

export interface V2CandleCandidate {
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  isClosed: boolean | undefined;
  closureSource: V2ClosureSource;
  providerTime?: string;
  receivedAt?: string;
  timeAudit?: Readonly<V2TimeNormalizationAudit>;
}
