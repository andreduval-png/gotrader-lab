import { canonicalHash } from "../canonical/canonicalValueSerialization";
import {
  HISTORICAL_DATASET_AUTHORITY_NONE,
  assertHistoricalDatasetAuthority
} from "./historicalDatasetAuthority";
import { HISTORICAL_DATASET_CAPABILITIES_DISABLED } from "./historicalDatasetContracts";
import {
  HISTORICAL_DATASET_SCHEMA_ID,
  HISTORICAL_DATASET_SCHEMA_VERSION,
  HISTORICAL_NORMALIZATION_VERSION,
  type HistoricalDatasetManifest,
  type HistoricalDatasetTimeframeManifest,
  type HistoricalDatasetVerification,
  type HistoricalDerivedTimeframeLineage,
  type HistoricalIntegrityLedger,
  type HistoricalNormalizedCandle,
  type HistoricalProviderDescription,
  type HistoricalTimeframe
} from "./historicalDatasetTypes";

const hashPattern = /^sha256:[0-9a-f]{64}$/;

const unique = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const manifestCore = (manifest: Readonly<HistoricalDatasetManifest>) => {
  const { datasetId, ...core } = manifest;
  return core;
};

export interface HistoricalTimeframeSealInput {
  readonly timeframe: HistoricalTimeframe;
  readonly candles: readonly Readonly<HistoricalNormalizedCandle>[];
  readonly partitionIds: readonly string[];
  readonly integrityLedger: Readonly<HistoricalIntegrityLedger>;
  readonly derivedLineage?: Readonly<HistoricalDerivedTimeframeLineage>;
}

export async function buildHistoricalDatasetManifest(input: {
  readonly requestId: string;
  readonly request: {
    readonly requestedSymbol: string;
    readonly brokerSymbol: string;
    readonly sourceTimeframes: readonly HistoricalTimeframe[];
    readonly derivedTimeframes?: readonly HistoricalTimeframe[];
    readonly parentDatasetIds?: readonly string[];
    readonly startUtc: string;
    readonly endUtc: string;
    readonly timeNormalizationPolicy: {
      readonly policyId: string;
      readonly version: string;
      readonly basis: HistoricalDatasetManifest["providerTimeBasis"];
      readonly dstPolicy: HistoricalDatasetManifest["dstPolicy"];
    };
    readonly timeAuthority: {
      readonly authorityId: string;
      readonly historicalTimeVerified: boolean;
      readonly historicalDstVerified: boolean;
      readonly blockers: readonly string[];
      readonly warnings: readonly string[];
    };
    readonly symbolSpec: {
      readonly symbolSpecId: string;
      readonly blockers: readonly string[];
      readonly warnings: readonly string[];
    };
    readonly calendar: {
      readonly calendarId: string;
      readonly verificationStatus: "verified" | "configured_unverified";
    };
    readonly timeframeAlignment: {
      readonly policyId: string;
      readonly verificationStatus: "verified" | "configured_unverified";
    };
    readonly creationPolicyId: string;
    readonly creationPolicyVersion: string;
  };
  readonly provider: Readonly<HistoricalProviderDescription>;
  readonly timeframes: readonly Readonly<HistoricalTimeframeSealInput>[];
}): Promise<Readonly<HistoricalDatasetManifest>> {
  assertHistoricalDatasetAuthority(input.provider.authority);
  const entries: HistoricalDatasetTimeframeManifest[] = [];
  const blockers: string[] = [
    ...input.request.timeAuthority.blockers,
    ...input.request.symbolSpec.blockers
  ];
  const warnings: string[] = [
    ...input.request.timeAuthority.warnings,
    ...input.request.symbolSpec.warnings
  ];
  for (const parentId of input.request.parentDatasetIds ?? []) {
    if (!hashPattern.test(parentId)) blockers.push("historical_parent_dataset_id_invalid");
  }
  if (!input.request.timeAuthority.historicalTimeVerified) blockers.push("historical_time_not_verified");
  if (!input.request.timeAuthority.historicalDstVerified) blockers.push("historical_dst_not_verified");
  if (input.request.calendar.verificationStatus !== "verified") blockers.push("historical_market_calendar_unverified");
  if (
    (input.request.derivedTimeframes?.length ?? 0) > 0 &&
    input.request.timeframeAlignment.verificationStatus !== "verified"
  ) blockers.push("historical_timeframe_alignment_unverified");
  for (const value of [...input.timeframes].sort((left, right) => left.timeframe.localeCompare(right.timeframe))) {
    if (!value.candles.length) blockers.push(`historical_${value.timeframe}_contains_no_candles`);
    blockers.push(...value.integrityLedger.summary.blockers);
    warnings.push(...value.integrityLedger.summary.warnings);
    if (value.derivedLineage) {
      blockers.push(...value.derivedLineage.blockers);
      warnings.push(...value.derivedLineage.warnings);
    }
    const timeframeChecksum = await canonicalHash({
      normalizationVersion: HISTORICAL_NORMALIZATION_VERSION,
      timeframe: value.timeframe,
      candles: value.candles
    });
    entries.push(Object.freeze({
      timeframe: value.timeframe,
      candleCount: value.candles.length,
      firstCandleTimeUtc: value.candles[0]?.openTimeUtc ?? input.request.startUtc,
      lastCandleTimeUtc: value.candles.at(-1)?.closeTimeUtc ?? input.request.startUtc,
      partitionIds: Object.freeze([...value.partitionIds].sort()),
      timeframeChecksum,
      integrityLedgerId: value.integrityLedger.ledgerId,
      ...(value.derivedLineage ? { derivedLineageId: value.derivedLineage.lineageId } : {})
    }));
  }
  const integrityStatus = input.timeframes.some((value) => value.integrityLedger.summary.status === "blocked")
    ? "blocked" as const
    : input.timeframes.some((value) => value.integrityLedger.summary.status === "accepted_with_warnings")
      ? "accepted_with_warnings" as const
      : "accepted" as const;
  const normalizedBlockers = unique(blockers);
  const normalizedWarnings = unique(warnings);
  const datasetChecksum = await canonicalHash({
    normalizationVersion: HISTORICAL_NORMALIZATION_VERSION,
    timeframes: entries.map((entry) => ({
      timeframe: entry.timeframe,
      timeframeChecksum: entry.timeframeChecksum,
      candleCount: entry.candleCount
    }))
  });
  const core = {
    schemaId: HISTORICAL_DATASET_SCHEMA_ID as typeof HISTORICAL_DATASET_SCHEMA_ID,
    version: HISTORICAL_DATASET_SCHEMA_VERSION as typeof HISTORICAL_DATASET_SCHEMA_VERSION,
    requestId: input.requestId,
    providerId: input.provider.providerId,
    providerVersion: input.provider.providerVersion,
    requestedSymbol: input.request.requestedSymbol,
    brokerSymbol: input.request.brokerSymbol,
    sourceTimeframes: Object.freeze([...input.request.sourceTimeframes].sort()),
    derivedTimeframes: Object.freeze([...(input.request.derivedTimeframes ?? [])].sort()),
    parentDatasetIds: Object.freeze([...(input.request.parentDatasetIds ?? [])].sort()),
    startUtc: input.request.startUtc,
    endUtc: input.request.endUtc,
    timeNormalizationPolicyId: input.request.timeNormalizationPolicy.policyId,
    timeNormalizationPolicyVersion: input.request.timeNormalizationPolicy.version,
    providerTimeBasis: input.request.timeNormalizationPolicy.basis,
    dstPolicy: input.request.timeNormalizationPolicy.dstPolicy,
    timeAuthorityId: input.request.timeAuthority.authorityId,
    historicalTimeVerified: input.request.timeAuthority.historicalTimeVerified,
    historicalDstVerified: input.request.timeAuthority.historicalDstVerified,
    symbolSpecId: input.request.symbolSpec.symbolSpecId,
    calendarId: input.request.calendar.calendarId,
    timeframeAlignmentPolicyId: input.request.timeframeAlignment.policyId,
    normalizationVersion: HISTORICAL_NORMALIZATION_VERSION as typeof HISTORICAL_NORMALIZATION_VERSION,
    sourceFingerprint: input.provider.sourceFingerprint,
    creationPolicyId: input.request.creationPolicyId,
    creationPolicyVersion: input.request.creationPolicyVersion,
    timeframes: Object.freeze(entries),
    datasetChecksum,
    integrityStatus,
    authoritativeScope: "historical_ohlc_only" as const,
    rawHistoricalOhlcPersisted: true as const,
    researchOnly: true as const,
    blockers: normalizedBlockers,
    warnings: normalizedWarnings,
    authority: HISTORICAL_DATASET_AUTHORITY_NONE,
    capabilities: HISTORICAL_DATASET_CAPABILITIES_DISABLED
  };
  return Object.freeze({ ...core, datasetId: await canonicalHash(core) });
}

export async function validateHistoricalDatasetManifest(
  value: unknown
): Promise<Readonly<HistoricalDatasetVerification>> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const manifest = value as Partial<HistoricalDatasetManifest> | undefined;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return Object.freeze({ status: "blocked", blockers: Object.freeze(["historical_manifest_missing"]), warnings: Object.freeze([]) });
  }
  try {
    assertHistoricalDatasetAuthority(manifest.authority);
  } catch {
    blockers.push("historical_manifest_authority_invalid");
  }
  if (manifest.schemaId !== HISTORICAL_DATASET_SCHEMA_ID) blockers.push("historical_manifest_schema_invalid");
  if (manifest.version !== HISTORICAL_DATASET_SCHEMA_VERSION) blockers.push("historical_manifest_version_invalid");
  if (!manifest.datasetId || !hashPattern.test(manifest.datasetId)) blockers.push("historical_dataset_id_invalid");
  if (!manifest.requestId || !hashPattern.test(manifest.requestId)) blockers.push("historical_request_id_invalid");
  if (!manifest.datasetChecksum || !hashPattern.test(manifest.datasetChecksum)) blockers.push("historical_dataset_checksum_invalid");
  if (!manifest.sourceFingerprint || !hashPattern.test(manifest.sourceFingerprint)) blockers.push("historical_source_fingerprint_invalid");
  if (!manifest.timeAuthorityId || !hashPattern.test(manifest.timeAuthorityId)) blockers.push("historical_time_authority_id_invalid");
  if (!manifest.symbolSpecId || !hashPattern.test(manifest.symbolSpecId)) blockers.push("historical_symbol_spec_id_invalid");
  if (!Array.isArray(manifest.timeframes) || !manifest.timeframes.length) blockers.push("historical_timeframes_missing");
  if (manifest.authoritativeScope !== "historical_ohlc_only") blockers.push("historical_scope_invalid");
  if (manifest.rawHistoricalOhlcPersisted !== true) blockers.push("historical_storage_contract_invalid");
  if (manifest.researchOnly !== true) blockers.push("historical_research_scope_invalid");
  if (
    !manifest.capabilities ||
    Object.values(manifest.capabilities).some((capability) => capability !== false)
  ) blockers.push("historical_capabilities_invalid");
  if (Array.isArray(manifest.blockers)) blockers.push(...manifest.blockers);
  if (Array.isArray(manifest.warnings)) warnings.push(...manifest.warnings);
  if (!blockers.length && manifest.datasetId) {
    const expectedId = await canonicalHash(manifestCore(manifest as HistoricalDatasetManifest));
    if (expectedId !== manifest.datasetId) blockers.push("historical_manifest_identity_mismatch");
  }
  return Object.freeze({
    status: blockers.length ? "blocked" : "verified",
    ...(blockers.length ? {} : { manifest: Object.freeze(manifest as HistoricalDatasetManifest) }),
    blockers: unique(blockers),
    warnings: unique(warnings)
  });
}
