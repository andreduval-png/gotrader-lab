import type {
  HistoricalDstPolicy,
  HistoricalProviderTimeBasis,
  HistoricalTimeNormalizationPolicy
} from "./historicalTimeNormalization";
import type { HistoricalDatasetAuthority } from "./historicalDatasetAuthority";

export const HISTORICAL_DATASET_SCHEMA_ID = "gotrader-historical-dataset-manifest";
export const HISTORICAL_DATASET_SCHEMA_VERSION = "bt1-v1";
export const HISTORICAL_PARTITION_SCHEMA_ID = "gotrader-historical-candle-partition";
export const HISTORICAL_PARTITION_SCHEMA_VERSION = "bt1-v1";
export const HISTORICAL_CHECKPOINT_SCHEMA_ID = "gotrader-historical-ingestion-checkpoint";
export const HISTORICAL_CHECKPOINT_SCHEMA_VERSION = "bt1-v1";
export const HISTORICAL_INTEGRITY_SCHEMA_ID = "gotrader-historical-integrity-ledger";
export const HISTORICAL_INTEGRITY_SCHEMA_VERSION = "bt1-v1";
export const HISTORICAL_NORMALIZATION_VERSION = "closed-ohlcv-utc-bt1-v1";
export const HISTORICAL_SYMBOL_SPEC_SCHEMA_VERSION = "gotrader-mt5-symbol-spec-bt1-v1";
export const HISTORICAL_TIME_AUTHORITY_SCHEMA_VERSION = "gotrader-historical-time-authority-bt1-v1";
export const HISTORICAL_TIMEFRAME_LINEAGE_SCHEMA_VERSION = "gotrader-derived-timeframe-lineage-bt1-v1";
export const HISTORICAL_STORAGE_ENVELOPE_SCHEMA_VERSION = "gotrader-historical-storage-envelope-bt1-v1";

export type HistoricalTimeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

export interface HistoricalDatasetCapabilities {
  readonly productionAdoptionAllowed: false;
  readonly canCreateEvidence: false;
  readonly canApproveReadiness: false;
  readonly canApplyCalibration: false;
  readonly canCreateTradeIntent: false;
}

export interface HistoricalSourceCandle {
  readonly providerOpenTime: string | number;
  readonly providerCloseTime?: string | number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
  readonly spreadPoints?: number;
  readonly isClosed?: boolean;
}

export interface HistoricalNormalizedCandle {
  readonly openTimeUtc: string;
  readonly closeTimeUtc: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
  readonly spreadPoints?: number;
}

export interface HistoricalProviderDescription {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly sourceFingerprint: string;
  readonly readOnly: true;
  readonly marketDataOnly: true;
  readonly supportedTimeframes: readonly HistoricalTimeframe[];
  readonly maximumPageCandles: number;
  readonly authority: Readonly<HistoricalDatasetAuthority>;
}

export interface HistoricalSourcePageRequest {
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly timeframe: HistoricalTimeframe;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly cursor?: string;
  readonly limit: number;
}

export interface HistoricalSourcePage {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly timeframe: HistoricalTimeframe;
  readonly cursor?: string;
  readonly nextCursor?: string;
  readonly candles: readonly HistoricalSourceCandle[];
  readonly sourcePageFingerprint?: string;
  readonly warnings: readonly string[];
  readonly authority: Readonly<HistoricalDatasetAuthority>;
}

export interface HistoricalDatasetProvider {
  readonly describe: () => Promise<Readonly<HistoricalProviderDescription>>;
  readonly fetchPage: (
    request: Readonly<HistoricalSourcePageRequest>
  ) => Promise<Readonly<HistoricalSourcePage>>;
}

export interface HistoricalTimeEvidenceCheck {
  readonly checkId: string;
  readonly status: "verified" | "blocked" | "not_applicable";
  readonly evidenceId?: string;
  readonly blockers: readonly string[];
}

export interface HistoricalTimeAuthority {
  readonly schemaVersion: typeof HISTORICAL_TIME_AUTHORITY_SCHEMA_VERSION;
  readonly authorityId: string;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly providerTimeBasis: HistoricalProviderTimeBasis;
  readonly dstPolicy: HistoricalDstPolicy;
  readonly historicalTimeVerified: boolean;
  readonly historicalDstVerified: boolean;
  readonly checks: {
    readonly winter: Readonly<HistoricalTimeEvidenceCheck>;
    readonly summer: Readonly<HistoricalTimeEvidenceCheck>;
    readonly springTransition: Readonly<HistoricalTimeEvidenceCheck>;
    readonly fallTransition: Readonly<HistoricalTimeEvidenceCheck>;
    readonly maintenanceBoundary: Readonly<HistoricalTimeEvidenceCheck>;
  };
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly authority: Readonly<HistoricalDatasetAuthority>;
}

export interface HistoricalSymbolSpecSnapshot {
  readonly schemaVersion: typeof HISTORICAL_SYMBOL_SPEC_SCHEMA_VERSION;
  readonly symbolSpecId: string;
  readonly providerId: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly digits: number;
  readonly pointSize: number;
  readonly pipSize: number;
  readonly pipInPoints: number;
  readonly spreadUnit: "broker_points" | "price";
  readonly tickSize?: number;
  readonly tickValue?: number;
  readonly tickValueCurrency?: string;
  readonly tradeContractSize?: number;
  readonly volumeMinLots?: number;
  readonly volumeMaxLots?: number;
  readonly volumeStepLots?: number;
  readonly accountCurrency?: string;
  readonly verificationStatus: "verified_provider_metadata" | "configured_unverified";
  readonly sourceFingerprint: string;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly authority: Readonly<HistoricalDatasetAuthority>;
}

export type HistoricalClosureReason =
  | "maintenance"
  | "weekend"
  | "holiday"
  | "early_close"
  | "provider_outage";

export interface HistoricalClosedInterval {
  readonly startUtc: string;
  readonly endUtc: string;
  readonly reason: HistoricalClosureReason;
  readonly evidenceId?: string;
}

export interface HistoricalMarketCalendarSnapshot {
  readonly calendarId: string;
  readonly version: string;
  readonly providerId: string;
  readonly brokerSymbol: string;
  readonly timezone: string;
  readonly verificationStatus: "verified" | "configured_unverified";
  readonly closedIntervals: readonly Readonly<HistoricalClosedInterval>[];
  readonly sourceFingerprint: string;
}

export interface HistoricalTimeframeAlignmentPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly anchorOffsetMinutes: number;
  readonly weekStartsOn: "monday";
  readonly verificationStatus: "verified" | "configured_unverified";
}

export interface HistoricalDatasetRequest {
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly sourceTimeframes: readonly HistoricalTimeframe[];
  readonly derivedTimeframes?: readonly HistoricalTimeframe[];
  readonly parentDatasetIds?: readonly string[];
  readonly startUtc: string;
  readonly endUtc: string;
  readonly pageSize: number;
  readonly timeNormalizationPolicy: Readonly<HistoricalTimeNormalizationPolicy>;
  readonly timeAuthority: Readonly<HistoricalTimeAuthority>;
  readonly symbolSpec: Readonly<HistoricalSymbolSpecSnapshot>;
  readonly calendar: Readonly<HistoricalMarketCalendarSnapshot>;
  readonly timeframeAlignment: Readonly<HistoricalTimeframeAlignmentPolicy>;
  readonly creationPolicyId: string;
  readonly creationPolicyVersion: string;
}

export type HistoricalIntegrityEventKind =
  | "duplicate"
  | "conflicting_duplicate"
  | "missing_bar"
  | "future_bar"
  | "out_of_range_bar"
  | "invalid_timestamp"
  | "invalid_ohlc"
  | "invalid_volume"
  | "invalid_spread"
  | "partial_bar"
  | "time_normalization_blocked"
  | "expected_closure_gap"
  | "unclassified_gap";

export interface HistoricalIntegrityEvent {
  readonly eventId: string;
  readonly kind: HistoricalIntegrityEventKind;
  readonly timeframe: HistoricalTimeframe;
  readonly openTimeUtc?: string;
  readonly endTimeUtc?: string;
  readonly blocking: boolean;
  readonly classification?: HistoricalClosureReason | "unclassified";
  readonly details: readonly string[];
}

export interface HistoricalIntegritySummary {
  readonly status: "accepted" | "accepted_with_warnings" | "blocked";
  readonly inputCandleCount: number;
  readonly canonicalCandleCount: number;
  readonly duplicateCount: number;
  readonly conflictingDuplicateCount: number;
  readonly missingBarCount: number;
  readonly expectedClosureGapCount: number;
  readonly unclassifiedGapCount: number;
  readonly futureBarCount: number;
  readonly outOfRangeBarCount: number;
  readonly invalidTimestampCount: number;
  readonly invalidOhlcCount: number;
  readonly invalidVolumeCount: number;
  readonly invalidSpreadCount: number;
  readonly partialBarCount: number;
  readonly timeNormalizationBlockedCount: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export interface HistoricalIntegrityLedger {
  readonly schemaId: typeof HISTORICAL_INTEGRITY_SCHEMA_ID;
  readonly version: typeof HISTORICAL_INTEGRITY_SCHEMA_VERSION;
  readonly ledgerId: string;
  readonly requestId: string;
  readonly events: readonly Readonly<HistoricalIntegrityEvent>[];
  readonly summary: Readonly<HistoricalIntegritySummary>;
  readonly authority: Readonly<HistoricalDatasetAuthority>;
}

export interface HistoricalPartitionPayload {
  readonly schemaId: typeof HISTORICAL_PARTITION_SCHEMA_ID;
  readonly version: typeof HISTORICAL_PARTITION_SCHEMA_VERSION;
  readonly partitionId: string;
  readonly requestId: string;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly sourceFingerprint: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly timeframe: HistoricalTimeframe;
  readonly pageOrdinal: number;
  readonly sourceCursor?: string;
  readonly sourceNextCursor?: string;
  readonly sourcePageFingerprint: string;
  readonly candles: readonly Readonly<HistoricalNormalizedCandle>[];
  readonly rejectedEvents: readonly Readonly<HistoricalIntegrityEvent>[];
  readonly warnings: readonly string[];
  readonly derivedFrom?: Readonly<HistoricalDerivedTimeframeLineage>;
  readonly authority: Readonly<HistoricalDatasetAuthority>;
}

export interface HistoricalCheckpointTimeframeState {
  readonly timeframe: HistoricalTimeframe;
  readonly phase: "pending" | "fetching" | "complete";
  readonly nextCursor?: string;
  readonly pageCount: number;
  readonly partitionIds: readonly string[];
}

export interface HistoricalIngestionCheckpoint {
  readonly schemaId: typeof HISTORICAL_CHECKPOINT_SCHEMA_ID;
  readonly version: typeof HISTORICAL_CHECKPOINT_SCHEMA_VERSION;
  readonly requestId: string;
  readonly requestHash: string;
  readonly phase: "fetching" | "sealing" | "complete" | "blocked";
  readonly timeframes: readonly Readonly<HistoricalCheckpointTimeframeState>[];
  readonly completedDatasetId?: string;
  readonly blockers: readonly string[];
  readonly authority: Readonly<HistoricalDatasetAuthority>;
}

export interface HistoricalDerivedTimeframeLineage {
  readonly schemaVersion: typeof HISTORICAL_TIMEFRAME_LINEAGE_SCHEMA_VERSION;
  readonly lineageId: string;
  readonly parentDatasetRequestId: string;
  readonly parentTimeframe: HistoricalTimeframe;
  readonly parentPartitionIds: readonly string[];
  readonly targetTimeframe: HistoricalTimeframe;
  readonly alignmentPolicyId: string;
  readonly alignmentPolicyVersion: string;
  readonly completeness: "complete" | "calendar_adjusted" | "blocked";
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export interface HistoricalDatasetTimeframeManifest {
  readonly timeframe: HistoricalTimeframe;
  readonly candleCount: number;
  readonly firstCandleTimeUtc: string;
  readonly lastCandleTimeUtc: string;
  readonly partitionIds: readonly string[];
  readonly timeframeChecksum: string;
  readonly integrityLedgerId: string;
  readonly derivedLineageId?: string;
}

export interface HistoricalDatasetManifest {
  readonly schemaId: typeof HISTORICAL_DATASET_SCHEMA_ID;
  readonly version: typeof HISTORICAL_DATASET_SCHEMA_VERSION;
  readonly datasetId: string;
  readonly requestId: string;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly sourceTimeframes: readonly HistoricalTimeframe[];
  readonly derivedTimeframes: readonly HistoricalTimeframe[];
  readonly parentDatasetIds: readonly string[];
  readonly startUtc: string;
  readonly endUtc: string;
  readonly timeNormalizationPolicyId: string;
  readonly timeNormalizationPolicyVersion: string;
  readonly providerTimeBasis: HistoricalProviderTimeBasis;
  readonly dstPolicy: HistoricalDstPolicy;
  readonly timeAuthorityId: string;
  readonly historicalTimeVerified: boolean;
  readonly historicalDstVerified: boolean;
  readonly symbolSpecId: string;
  readonly calendarId: string;
  readonly timeframeAlignmentPolicyId: string;
  readonly normalizationVersion: typeof HISTORICAL_NORMALIZATION_VERSION;
  readonly sourceFingerprint: string;
  readonly creationPolicyId: string;
  readonly creationPolicyVersion: string;
  readonly timeframes: readonly Readonly<HistoricalDatasetTimeframeManifest>[];
  readonly datasetChecksum: string;
  readonly integrityStatus: HistoricalIntegritySummary["status"];
  readonly authoritativeScope: "historical_ohlc_only";
  readonly rawHistoricalOhlcPersisted: true;
  readonly researchOnly: true;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly authority: Readonly<HistoricalDatasetAuthority>;
  readonly capabilities: Readonly<HistoricalDatasetCapabilities>;
}

export interface HistoricalDatasetVerification {
  readonly status: "verified" | "blocked";
  readonly manifest?: Readonly<HistoricalDatasetManifest>;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export interface HistoricalDatasetStorageAdapter {
  readonly readText: (relativePath: string) => Promise<string | undefined>;
  readonly writeTextAtomic: (relativePath: string, value: string) => Promise<void>;
  readonly listFiles: (relativePath: string) => Promise<readonly string[]>;
}

export type HistoricalStorageArtifactKind =
  | "request"
  | "checkpoint"
  | "partition"
  | "integrity"
  | "manifest"
  | "lineage";

export interface HistoricalStorageEnvelope<T> {
  readonly schemaVersion: typeof HISTORICAL_STORAGE_ENVELOPE_SCHEMA_VERSION;
  readonly artifactKind: HistoricalStorageArtifactKind;
  readonly integrityHash: string;
  readonly payload: T;
}

export interface HistoricalDatasetRepositoryOptions {
  readonly storage: HistoricalDatasetStorageAdapter;
  readonly now?: () => string;
  readonly maximumPagesPerTimeframe?: number;
  readonly atomicWriteRetries?: number;
}

export interface HistoricalDatasetCreationResult {
  readonly action: "created" | "resumed" | "coalesced";
  readonly manifest: Readonly<HistoricalDatasetManifest>;
  readonly verification: Readonly<HistoricalDatasetVerification>;
}
