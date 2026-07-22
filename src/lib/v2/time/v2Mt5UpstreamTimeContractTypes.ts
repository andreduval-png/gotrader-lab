import type { V2Authority } from "../authority/v2Authority";
import type { V2TimeNormalizationPolicy } from "./v2TimeNormalizationTypes";
import type {
  V2Mt5PythonTransportBasis,
  V2Mt5TerminalEvidenceStatus,
  V2Mt5TimeVerificationScope,
  V2Mt5TimestampBasisClassification
} from "./v2Mt5TerminalClockTypes";

export const V2_MT5_TIME_CONTRACT_ID = "gotrader-mt5-readonly-time-contract";
export const V2_MT5_TIME_CONTRACT_VERSION = "1.1.0";

export type V2Mt5TimeContractVerificationStatus =
  | "verified"
  | "configured_unverified"
  | "observed_candidate"
  | "unknown";

export type V2Mt5TimeContractProviderBasis =
  | "epoch_utc"
  | "mt5_server_wall_clock"
  | "iso_with_offset"
  | "unknown";

export type V2Mt5TimeContractDstPolicy =
  | "iana_timezone_rules"
  | "fixed_offset"
  | "provider_declared"
  | "unknown";

export interface V2Mt5TimeVerificationObservation {
  observationId: string;
  observedAtUtc: string;
  rawProviderTime: number | string;
  normalizedProviderTimeUtc: string;
  systemUtc: string;
  appliedTimezone?: string;
  appliedOffsetMinutes: number;
  expectedOffsetMinutes?: number;
  dstState: "standard" | "daylight" | "not_applicable" | "unknown";
  withinTolerance: boolean;
  source: "live" | "historical_capture";
}

export interface V2Mt5TimeObservationSummary {
  observationCount: number;
  acceptedObservationCount: number;
  winterObservationCount: number;
  summerObservationCount: number;
  fixedOffsetObservationCount: number;
}

export interface V2Mt5ReadOnlyTimeContract {
  contractId: typeof V2_MT5_TIME_CONTRACT_ID;
  version: string;
  providerTimeBasis: V2Mt5TimeContractProviderBasis;
  providerTimezone?: string;
  providerUtcOffsetMinutes?: number;
  dstPolicy: V2Mt5TimeContractDstPolicy;
  configurationSource: "operator_config" | "provider_metadata" | "none";
  verificationStatus: V2Mt5TimeContractVerificationStatus;
  verificationSources: readonly string[];
  providerDeclarationId?: string;
  terminalMetadataVerificationId?: string;
  rawServerTime?: number | string;
  rawServerTimeMsc?: number;
  interpretedServerTimeUtc?: string;
  normalizedProviderTimeUtc?: string;
  serverTimeUtc?: string;
  systemTimeUtc: string;
  observedOffsetMinutes?: number;
  rawLatestCandleTime?: number | string;
  tickCandleBasisAgreement: boolean;
  libraryTimeClaim?: "epoch_utc";
  libraryTimeClaimAgreement?: boolean;
  observationSummary: Readonly<V2Mt5TimeObservationSummary>;
  verificationObservations?: readonly Readonly<V2Mt5TimeVerificationObservation>[];
  terminalBuild?: number;
  terminalVersion?: string;
  mt5PackageVersion?: string;
  terminalProbeSchemaVersion?: string;
  terminalProbeObservationId?: string;
  terminalProbeInstanceId?: string;
  terminalProbeCapturedAt?: string;
  terminalBasisClassification?: V2Mt5TimestampBasisClassification;
  pythonTransportBasis?: V2Mt5PythonTransportBasis;
  terminalObservedOffsetMinutes?: number;
  terminalEvidenceStatus?: V2Mt5TerminalEvidenceStatus;
  terminalClockClassificationVersion?: string;
  terminalProbeBlockers?: readonly string[];
  terminalProbeWarnings?: readonly string[];
  timeVerificationScope?: V2Mt5TimeVerificationScope;
  currentLiveTimeBasisVerified?: boolean;
  historicalDstPolicyVerified?: boolean;
  phase2Eligible?: boolean;
  strategySessionTimezone?: "America/New_York";
  readOnly: true;
  marketDataOnly: true;
  blockers: readonly string[];
  warnings: readonly string[];
  authority: Readonly<V2Authority>;
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
  receivedAtUtc?: string;
  wrapperContractVersion?: string;
  upstreamPath?: string;
  sourceMethod?: string;
}

export interface V2Mt5TimeContractValidationResult {
  status: "accepted" | "blocked";
  phase2Eligible: boolean;
  verificationStatus: V2Mt5TimeContractVerificationStatus;
  contract?: Readonly<V2Mt5ReadOnlyTimeContract>;
  policy?: Readonly<V2TimeNormalizationPolicy>;
  blockers: readonly string[];
  warnings: readonly string[];
}

export interface V2Mt5TimeContractIdentityFields {
  timeContractId: string;
  timeContractVersion: string;
  timeContractVerificationStatus: V2Mt5TimeContractVerificationStatus;
  terminalClockClassificationVersion?: string;
  timeVerificationScope?: V2Mt5TimeVerificationScope;
}
