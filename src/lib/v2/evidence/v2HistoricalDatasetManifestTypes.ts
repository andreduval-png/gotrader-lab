import type { V2Authority } from "../authority/v2Authority";
import type { V2Mt5TimeContractVerificationStatus } from "../time/v2Mt5UpstreamTimeContractTypes";

export const V2_HISTORICAL_DATASET_MANIFEST_SCHEMA =
  "gotrader-v2-historical-dataset-manifest";
export const V2_HISTORICAL_DATASET_MANIFEST_VERSION = "phase-3f-v1";
export const V2_HISTORICAL_CANDLE_ENCODING_VERSION = "closed-ohlcv-utc-v1";

export interface V2HistoricalDatasetManifest {
  schemaVersion: typeof V2_HISTORICAL_DATASET_MANIFEST_SCHEMA;
  version: typeof V2_HISTORICAL_DATASET_MANIFEST_VERSION;
  datasetId: string;
  canonicalSourceFingerprint: string;
  requestedSymbol: string;
  brokerSymbol: string;
  provider: string;
  timeframe: string;
  firstCandleTimeUtc: string;
  lastCandleTimeUtc: string;
  candleCount: number;
  timeNormalizationPolicyId: string;
  timeNormalizationPolicyVersion: string;
  timeContractId: string;
  timeContractVersion: string;
  timeContractVerificationStatus: V2Mt5TimeContractVerificationStatus;
  offsetRegimeVersion: string;
  candleEncodingVersion: typeof V2_HISTORICAL_CANDLE_ENCODING_VERSION;
  datasetChecksum: string;
  historicalTimeEligible: boolean;
  rawCandlesPersisted: false;
  researchOnly: true;
  shadowOnly: true;
  blockers: readonly string[];
  warnings: readonly string[];
  authority: Readonly<V2Authority>;
}

export interface V2HistoricalDatasetManifestBuildInput {
  requestedSymbol: string;
  brokerSymbol: string;
  provider: string;
  timeframe: string;
  timeNormalizationPolicyId: string;
  timeNormalizationPolicyVersion: string;
  timeContractId: string;
  timeContractVersion: string;
  timeContractVerificationStatus: V2Mt5TimeContractVerificationStatus;
  offsetRegimeVersion: string;
  historicalTimeEligible: boolean;
  blockers?: readonly string[];
  warnings?: readonly string[];
}

export interface V2HistoricalDatasetManifestValidation {
  status: "accepted" | "blocked";
  manifest?: Readonly<V2HistoricalDatasetManifest>;
  blockers: readonly string[];
  warnings: readonly string[];
}
