import type { V2CanonicalCandle } from "../candles/v2CandleTypes";
import { assertV2Authority, V2_AUTHORITY_NONE } from "../authority/v2Authority";
import { canonicalHash, canonicalSerialize } from "../serialization/canonicalSerialization";
import {
  V2_HISTORICAL_CANDLE_ENCODING_VERSION,
  V2_HISTORICAL_DATASET_MANIFEST_SCHEMA,
  V2_HISTORICAL_DATASET_MANIFEST_VERSION,
  type V2HistoricalDatasetManifest,
  type V2HistoricalDatasetManifestBuildInput,
  type V2HistoricalDatasetManifestValidation
} from "./v2HistoricalDatasetManifestTypes";

const hashPattern = /^sha256:[a-f0-9]{64}$/i;

const compact = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const requiredText = (value: string, name: string) => {
  if (!value?.trim()) throw new Error(`Historical dataset ${name} is required.`);
  return value.trim();
};

const isoUtc = (value: string, name: string) => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) {
    throw new Error(`Historical dataset ${name} is invalid.`);
  }
  return parsed.toISOString();
};

const validateCandle = (candle: Readonly<V2CanonicalCandle>, index: number) => {
  const openTimeUtc = isoUtc(candle.openTime, `candle[${index}].openTime`);
  const closeTimeUtc = isoUtc(candle.closeTime, `candle[${index}].closeTime`);
  const openTime = Date.parse(openTimeUtc);
  const closeTime = Date.parse(closeTimeUtc);
  if (closeTime <= openTime) throw new Error(`Historical dataset candle[${index}] closes before it opens.`);
  const values = [candle.open, candle.high, candle.low, candle.close];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Historical dataset candle[${index}] contains a non-finite OHLC value.`);
  }
  if (
    candle.high < Math.max(candle.open, candle.close) ||
    candle.low > Math.min(candle.open, candle.close) ||
    candle.low > candle.high
  ) {
    throw new Error(`Historical dataset candle[${index}] contains invalid OHLC geometry.`);
  }
  if (candle.volume !== undefined && (!Number.isFinite(candle.volume) || candle.volume < 0)) {
    throw new Error(`Historical dataset candle[${index}] contains invalid volume.`);
  }
  if (candle.isClosed !== true) {
    throw new Error(`Historical dataset candle[${index}] is not explicitly closed.`);
  }
  return Object.freeze({
    openTimeUtc,
    closeTimeUtc,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    ...(candle.volume === undefined ? {} : { volume: candle.volume })
  });
};

const manifestCore = (manifest: Readonly<V2HistoricalDatasetManifest>) => {
  const { datasetId, ...core } = manifest;
  return core;
};

const sourceIdentityFromManifest = (manifest: Readonly<V2HistoricalDatasetManifest>) => ({
  provider: manifest.provider,
  requestedSymbol: manifest.requestedSymbol,
  brokerSymbol: manifest.brokerSymbol,
  timeframe: manifest.timeframe,
  firstCandleTimeUtc: manifest.firstCandleTimeUtc,
  lastCandleTimeUtc: manifest.lastCandleTimeUtc,
  candleCount: manifest.candleCount,
  timeNormalizationPolicyId: manifest.timeNormalizationPolicyId,
  timeNormalizationPolicyVersion: manifest.timeNormalizationPolicyVersion,
  timeContractId: manifest.timeContractId,
  timeContractVersion: manifest.timeContractVersion,
  timeContractVerificationStatus: manifest.timeContractVerificationStatus,
  offsetRegimeVersion: manifest.offsetRegimeVersion,
  candleEncodingVersion: manifest.candleEncodingVersion,
  datasetChecksum: manifest.datasetChecksum
});

export async function buildV2HistoricalDatasetManifest(
  input: Readonly<V2HistoricalDatasetManifestBuildInput>,
  candles: readonly Readonly<V2CanonicalCandle>[]
): Promise<Readonly<V2HistoricalDatasetManifest>> {
  if (!candles.length) throw new Error("Historical dataset contains no candles.");
  const normalized = candles
    .map(validateCandle)
    .sort((left, right) => Date.parse(left.openTimeUtc) - Date.parse(right.openTimeUtc));
  const seen = new Map<string, string>();
  for (const candle of normalized) {
    const identity = `${candle.openTimeUtc}|${candle.closeTimeUtc}`;
    const valueHash = canonicalSerialize(candle);
    const previous = seen.get(identity);
    if (previous && previous !== valueHash) {
      throw new Error(`Historical dataset contains a conflicting duplicate at ${candle.openTimeUtc}.`);
    }
    if (previous) throw new Error(`Historical dataset contains a duplicate at ${candle.openTimeUtc}.`);
    seen.set(identity, valueHash);
  }
  const datasetChecksum = await canonicalHash({
    candleEncodingVersion:
      V2_HISTORICAL_CANDLE_ENCODING_VERSION as typeof V2_HISTORICAL_CANDLE_ENCODING_VERSION,
    candles: normalized
  });
  const sourceIdentity = {
    provider: requiredText(input.provider, "provider"),
    requestedSymbol: requiredText(input.requestedSymbol, "requestedSymbol"),
    brokerSymbol: requiredText(input.brokerSymbol, "brokerSymbol"),
    timeframe: requiredText(input.timeframe, "timeframe"),
    firstCandleTimeUtc: normalized[0].openTimeUtc,
    lastCandleTimeUtc: normalized.at(-1)!.closeTimeUtc,
    candleCount: normalized.length,
    timeNormalizationPolicyId: requiredText(
      input.timeNormalizationPolicyId,
      "timeNormalizationPolicyId"
    ),
    timeNormalizationPolicyVersion: requiredText(
      input.timeNormalizationPolicyVersion,
      "timeNormalizationPolicyVersion"
    ),
    timeContractId: requiredText(input.timeContractId, "timeContractId"),
    timeContractVersion: requiredText(input.timeContractVersion, "timeContractVersion"),
    timeContractVerificationStatus: input.timeContractVerificationStatus,
    offsetRegimeVersion: requiredText(input.offsetRegimeVersion, "offsetRegimeVersion"),
    candleEncodingVersion:
      V2_HISTORICAL_CANDLE_ENCODING_VERSION as typeof V2_HISTORICAL_CANDLE_ENCODING_VERSION,
    datasetChecksum
  };
  const canonicalSourceFingerprint = await canonicalHash(sourceIdentity);
  const core = {
    schemaVersion: V2_HISTORICAL_DATASET_MANIFEST_SCHEMA as typeof V2_HISTORICAL_DATASET_MANIFEST_SCHEMA,
    version: V2_HISTORICAL_DATASET_MANIFEST_VERSION as typeof V2_HISTORICAL_DATASET_MANIFEST_VERSION,
    canonicalSourceFingerprint,
    ...sourceIdentity,
    historicalTimeEligible: input.historicalTimeEligible,
    rawCandlesPersisted: false as const,
    researchOnly: true as const,
    shadowOnly: true as const,
    blockers: compact([
      ...(input.blockers ?? []),
      input.historicalTimeEligible ? "" : "historical_time_contract_not_verified"
    ]),
    warnings: compact(input.warnings ?? []),
    authority: V2_AUTHORITY_NONE
  };
  return Object.freeze({
    ...core,
    datasetId: await canonicalHash(core)
  });
}

export async function validateV2HistoricalDatasetManifest(
  value: unknown
): Promise<Readonly<V2HistoricalDatasetManifestValidation>> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const manifest = value as Partial<V2HistoricalDatasetManifest> | undefined;
  if (!manifest || typeof manifest !== "object") {
    return Object.freeze({
      status: "blocked",
      blockers: Object.freeze(["historical_dataset_manifest_missing"]),
      warnings: Object.freeze([])
    });
  }
  try {
    assertV2Authority(manifest.authority);
  } catch {
    blockers.push("historical_dataset_authority_invalid");
  }
  if (manifest.schemaVersion !== V2_HISTORICAL_DATASET_MANIFEST_SCHEMA) {
    blockers.push("historical_dataset_schema_invalid");
  }
  if (manifest.version !== V2_HISTORICAL_DATASET_MANIFEST_VERSION) {
    blockers.push("historical_dataset_version_invalid");
  }
  if (!manifest.datasetId || !hashPattern.test(manifest.datasetId)) {
    blockers.push("historical_dataset_id_invalid");
  }
  if (!manifest.canonicalSourceFingerprint || !hashPattern.test(manifest.canonicalSourceFingerprint)) {
    blockers.push("historical_dataset_source_fingerprint_invalid");
  }
  if (!manifest.datasetChecksum || !hashPattern.test(manifest.datasetChecksum)) {
    blockers.push("historical_dataset_checksum_invalid");
  }
  const requiredFields = [
    "provider",
    "requestedSymbol",
    "brokerSymbol",
    "timeframe",
    "timeNormalizationPolicyId",
    "timeNormalizationPolicyVersion",
    "timeContractId",
    "timeContractVersion",
    "offsetRegimeVersion"
  ] as const;
  for (const field of requiredFields) {
    if (typeof manifest[field] !== "string" || !manifest[field]?.trim()) {
      blockers.push(`historical_dataset_${field}_missing`);
    }
  }
  if (!Number.isInteger(manifest.candleCount) || (manifest.candleCount ?? 0) <= 0) {
    blockers.push("historical_dataset_candle_count_invalid");
  }
  if (!manifest.firstCandleTimeUtc || !Number.isFinite(Date.parse(manifest.firstCandleTimeUtc))) {
    blockers.push("historical_dataset_first_candle_invalid");
  }
  if (!manifest.lastCandleTimeUtc || !Number.isFinite(Date.parse(manifest.lastCandleTimeUtc))) {
    blockers.push("historical_dataset_last_candle_invalid");
  }
  if (
    manifest.firstCandleTimeUtc &&
    manifest.lastCandleTimeUtc &&
    Date.parse(manifest.lastCandleTimeUtc) <= Date.parse(manifest.firstCandleTimeUtc)
  ) {
    blockers.push("historical_dataset_boundary_order_invalid");
  }
  if (manifest.historicalTimeEligible !== true) {
    blockers.push("historical_time_contract_not_verified");
  }
  if (manifest.timeContractVerificationStatus !== "verified") {
    blockers.push("historical_dataset_time_contract_unverified");
  }
  if (manifest.rawCandlesPersisted !== false) blockers.push("historical_dataset_raw_candles_persisted");
  if (manifest.researchOnly !== true || manifest.shadowOnly !== true) {
    blockers.push("historical_dataset_scope_invalid");
  }
  if (Array.isArray(manifest.blockers) && manifest.blockers.length) {
    blockers.push(...manifest.blockers);
  }
  if (Array.isArray(manifest.warnings)) warnings.push(...manifest.warnings);
  if (!blockers.length && manifest.datasetId) {
    const expectedSourceFingerprint = await canonicalHash(
      sourceIdentityFromManifest(manifest as V2HistoricalDatasetManifest)
    );
    if (expectedSourceFingerprint !== manifest.canonicalSourceFingerprint) {
      blockers.push("historical_dataset_source_fingerprint_mismatch");
    }
    const expectedId = await canonicalHash(manifestCore(manifest as V2HistoricalDatasetManifest));
    if (expectedId !== manifest.datasetId) blockers.push("historical_dataset_manifest_hash_mismatch");
  }
  return Object.freeze({
    status: blockers.length ? "blocked" : "accepted",
    ...(blockers.length ? {} : { manifest: Object.freeze(manifest as V2HistoricalDatasetManifest) }),
    blockers: compact(blockers),
    warnings: compact(warnings)
  });
}
