export type V2ProviderTimeBasis =
  | "utc_iso"
  | "epoch_utc"
  | "iso_with_offset"
  | "mt5_server_wall_clock"
  | "unknown";

export type V2TimeDiscoveryMethod =
  | "explicit_payload_offset"
  | "configured_iana_timezone"
  | "server_clock_comparison"
  | "explicit_utc_contract"
  | "unknown";

export type V2DstPolicy =
  | "iana_timezone_rules"
  | "explicit_offset"
  | "not_applicable"
  | "unknown";

export interface V2TimeNormalizationPolicy {
  policyId: string;
  version: string;
  provider: string;
  basis: V2ProviderTimeBasis;
  sourceTimezone?: string;
  sourceUtcOffsetMinutes?: number;
  outputTimezone: "UTC";
  discoveryMethod: V2TimeDiscoveryMethod;
  dstPolicy: V2DstPolicy;
  maximumClockSkewMs: number;
  closureToleranceMs: number;
}

export type V2TimeDiagnosticCode =
  | "invalid_provider_time"
  | "unknown_provider_time_basis"
  | "missing_source_timezone"
  | "invalid_source_timezone"
  | "ambiguous_local_time"
  | "nonexistent_local_time"
  | "invalid_time_policy"
  | "reference_clock_skew"
  | "normalized_future_candle"
  | "partial_candle"
  | "close_proof_unavailable"
  | "policy_mismatch";

export interface V2NormalizedProviderTime {
  status: "normalized" | "blocked";
  rawProviderTime: string | number;
  normalizedTimeUtc?: string;
  providerTimeBasis: V2ProviderTimeBasis;
  timeNormalizationPolicyId: string;
  timeNormalizationPolicyVersion: string;
  sourceTimezone?: string;
  offsetAppliedMinutes?: number;
  rawToUtcDeltaMs?: number;
  dstState: "standard" | "daylight" | "fixed_offset" | "not_applicable" | "unknown";
  warnings: readonly string[];
  blockers: readonly V2TimeDiagnosticCode[];
}

export interface V2TimeNormalizationAudit {
  rawProviderOpenTime: string | number;
  rawProviderCloseTime?: string | number;
  normalizedOpenTimeUtc?: string;
  normalizedCloseTimeUtc?: string;
  providerTimeBasis: V2ProviderTimeBasis;
  timeNormalizationPolicyId: string;
  timeNormalizationPolicyVersion: string;
  sourceTimezone?: string;
  offsetAppliedMinutes?: number;
  rawToUtcDeltaMs?: number;
  dstState: V2NormalizedProviderTime["dstState"];
  receivedAt: string;
  closureStatus: "closed" | "open" | "future" | "blocked";
  warnings: readonly string[];
  blockers: readonly V2TimeDiagnosticCode[];
}

export interface V2TrustedReferenceClock {
  status: "trusted" | "blocked";
  referenceUtc?: string;
  systemUtc: string;
  receivedAtUtc: string;
  providerUtc?: string;
  maximumObservedSkewMs: number;
  blockers: readonly V2TimeDiagnosticCode[];
}

export interface V2CandleClosureProof {
  status: "closed" | "open" | "future" | "blocked";
  normalizedOpenTimeUtc?: string;
  normalizedCloseTimeUtc?: string;
  trustedReferenceUtc?: string;
  closureToleranceMs: number;
  explicitProviderClosed?: boolean;
  blockers: readonly V2TimeDiagnosticCode[];
}
