import { canonicalHash } from "../canonical/canonicalValueSerialization";
import {
  HISTORICAL_DATASET_AUTHORITY_NONE,
  assertHistoricalDatasetAuthority,
  type HistoricalDatasetAuthority
} from "./historicalDatasetAuthority";
import type {
  HistoricalDatasetCapabilities,
  HistoricalDatasetManifest,
  HistoricalTimeframe
} from "./historicalDatasetTypes";
import {
  HISTORICAL_CAPACITY_PLAN_SCHEMA_VERSION,
  HISTORICAL_INTEGRITY_SCHEMA_VERSION,
  HISTORICAL_PARTITION_SCHEMA_VERSION
} from "./historicalDatasetTypes";

export const HISTORICAL_DATASET_CERTIFICATE_SCHEMA_VERSION =
  "gotrader-historical-dataset-certificate-bt1-6-v1";
export const HISTORICAL_DATASET_REGISTRY_SCHEMA_VERSION =
  "gotrader-historical-dataset-registry-bt1-6-v1";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REQUIRED_TIMEFRAMES: readonly HistoricalTimeframe[] = Object.freeze([
  "1m", "5m", "15m", "1h", "4h", "1d", "1w"
]);
const REQUIRED_DERIVED_TIMEFRAMES: readonly HistoricalTimeframe[] = Object.freeze([
  "5m", "15m", "1h", "4h"
]);
const REQUIRED_REPRODUCTION_CHECKS = Object.freeze([
  "requestId",
  "partitionIdentities",
  "timeframeChecksums",
  "datasetChecksum",
  "datasetId",
  "manifestHash",
  "lineageNodeKey"
]);
const FORBIDDEN_IDENTITY_KEYS = new Set([
  "strategyid",
  "profileid",
  "parameterhash",
  "parameterfingerprint",
  "riskmodel",
  "rrmodel",
  "backtestengine",
  "optimizationmethod"
]);

export interface HistoricalReproductionComparisonEvidence {
  readonly schemaVersion: "gotrader-bt1-5-reproduction-comparison-v1";
  readonly comparisonId: string;
  readonly comparisonMode: "deterministic_rematerialization" | "provider_requery";
  readonly leftReportId: string;
  readonly rightReportId: string;
  readonly checks: Readonly<Record<string, boolean>>;
  readonly status: "passed" | "blocked";
  readonly blockers: readonly string[];
  readonly authority: Readonly<HistoricalDatasetAuthority>;
}

export interface HistoricalDatasetQualificationEvidence {
  readonly qualificationReportId: string;
  readonly qualificationReportAction: "created" | "resumed" | "coalesced";
  readonly liveResumeVerified: boolean;
  readonly qualificationVerificationStatus: "verified" | "incomplete" | "blocked";
  readonly qualificationBlockers: readonly string[];
  readonly bundleId: string;
  readonly capacityPlanId: string;
  readonly evidencePackageId: string;
  readonly controlledInterruptionReportId: string;
  readonly deterministicRematerialization: Readonly<HistoricalReproductionComparisonEvidence>;
  readonly providerRequery: Readonly<HistoricalReproductionComparisonEvidence>;
  readonly readOnlySafetyReportId: string;
  readonly readOnlySafetyVerified: boolean;
  readonly loopbackOnly: boolean;
  readonly getOnly: boolean;
  readonly forbiddenEndpointCallCount: number;
  readonly storageBytes: number;
  readonly peakMemoryBytes: number;
  readonly retrievalDurationMs: number;
  readonly normalizationDurationMs: number;
  readonly integrityDurationMs: number;
  readonly derivationDurationMs: number;
  readonly reproductionDurationMs: number;
  readonly createdAtUtc: string;
  readonly verifiedAtUtc: string;
  readonly verifierVersion: string;
}

export interface HistoricalDatasetCertificationInput {
  readonly manifest: Readonly<HistoricalDatasetManifest>;
  readonly manifestHash: string;
  readonly lineageRoot: string;
  readonly evidence: Readonly<HistoricalDatasetQualificationEvidence>;
}

export interface GoTraderHistoricalDatasetCertificate {
  readonly certificateSchemaVersion: typeof HISTORICAL_DATASET_CERTIFICATE_SCHEMA_VERSION;
  readonly certificateId: string;
  readonly datasetId: string;
  readonly datasetChecksum: string;
  readonly manifestHash: string;
  readonly lineageRoot: string;
  readonly historicalDatasetRequestId: string;
  readonly qualificationReportId: string;
  readonly bundleId: string;
  readonly capacityPlanId: string;
  readonly evidencePackageId: string;
  readonly provider: string;
  readonly providerVersion: string;
  readonly sourceFingerprint: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly symbolSpecificationId: string;
  readonly sourceTimeframes: readonly HistoricalTimeframe[];
  readonly canonicalSourceTimeframe: "1m";
  readonly sourceBarCount: number;
  readonly derivedTimeframes: readonly HistoricalTimeframe[];
  readonly startUtc: string;
  readonly endUtc: string;
  readonly sourceBarCounts: readonly Readonly<{ timeframe: HistoricalTimeframe; barCount: number }>[];
  readonly derivedBarCounts: readonly Readonly<{ timeframe: HistoricalTimeframe; barCount: number }>[];
  readonly partitionCount: number;
  readonly diskBytes: number;
  readonly peakMemoryBytes: number;
  readonly timeAuthorityId: string;
  readonly historicalTimeVerified: true;
  readonly historicalDstVerified: true;
  readonly calendarPolicyId: string;
  readonly alignmentPolicyId: string;
  readonly normalizationVersion: string;
  readonly integrityPolicyVersion: string;
  readonly partitionPolicyVersion: string;
  readonly capacityPolicyVersion: string;
  readonly integrityStatus: "accepted" | "accepted_with_warnings";
  readonly restartResumeVerified: true;
  readonly deterministicRematerializationVerified: true;
  readonly providerRequeryStatus: "stable";
  readonly providerDriftStatus: "not_detected";
  readonly readOnlySafetyVerified: true;
  readonly strategyNeutral: true;
  readonly controlledInterruptionReportId: string;
  readonly deterministicComparisonId: string;
  readonly providerRequeryComparisonId: string;
  readonly readOnlySafetyReportId: string;
  readonly performance: Readonly<{
    retrievalDurationMs: number;
    normalizationDurationMs: number;
    integrityDurationMs: number;
    derivationDurationMs: number;
    reproductionDurationMs: number;
  }>;
  readonly createdAtUtc: string;
  readonly verifiedAtUtc: string;
  readonly verifierVersion: string;
  readonly authoritativeScope: "historical_input_integrity_only";
  readonly authority: Readonly<HistoricalDatasetAuthority>;
  readonly capabilities: Readonly<HistoricalDatasetCapabilities>;
}

export interface HistoricalDatasetRegistryEntry {
  readonly registryEntryId: string;
  readonly certificateId: string;
  readonly datasetId: string;
  readonly datasetChecksum: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly historicalTimeVerified: true;
  readonly historicalDstVerified: true;
  readonly integrityStatus: "accepted" | "accepted_with_warnings";
  readonly status: "candidate" | "qualified" | "superseded" | "quarantined";
}

export interface HistoricalDatasetRegistry {
  readonly schemaVersion: typeof HISTORICAL_DATASET_REGISTRY_SCHEMA_VERSION;
  readonly registryId: string;
  readonly entries: readonly Readonly<HistoricalDatasetRegistryEntry>[];
  readonly authority: Readonly<HistoricalDatasetAuthority>;
}

const unique = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const validHash = (value: string) => HASH_PATTERN.test(String(value ?? ""));

const validIso = (value: string) => Number.isFinite(Date.parse(value));

const scanForbiddenKeys = (value: unknown, blockers: string[]) => {
  if (Array.isArray(value)) {
    value.forEach((item) => scanForbiddenKeys(item, blockers));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_IDENTITY_KEYS.has(key.toLowerCase())) {
      blockers.push(`historical_certificate_forbidden_identity_key_${key}`);
    }
    scanForbiddenKeys(nested, blockers);
  }
};

const validateComparison = (
  value: Readonly<HistoricalReproductionComparisonEvidence>,
  expectedMode: HistoricalReproductionComparisonEvidence["comparisonMode"],
  qualificationReportId: string,
  blockers: string[]
) => {
  try {
    assertHistoricalDatasetAuthority(value.authority);
  } catch {
    blockers.push(`historical_${expectedMode}_authority_invalid`);
  }
  if (value.comparisonMode !== expectedMode) {
    blockers.push(`historical_${expectedMode}_mode_invalid`);
  }
  if (!validHash(value.comparisonId)) blockers.push(`historical_${expectedMode}_identity_invalid`);
  if (![value.leftReportId, value.rightReportId].includes(qualificationReportId)) {
    blockers.push(`historical_${expectedMode}_qualification_report_unbound`);
  }
  const requiredChecksPassed = REQUIRED_REPRODUCTION_CHECKS.every((name) => value.checks[name] === true);
  if (
    value.status !== "passed" ||
    value.blockers.length ||
    !requiredChecksPassed ||
    Object.values(value.checks).some((passed) => !passed)
  ) {
    blockers.push(expectedMode === "provider_requery"
      ? "historical_provider_drift_detected"
      : "historical_deterministic_rematerialization_failed");
  }
};

export function evaluateHistoricalDatasetCertification(
  input: Readonly<HistoricalDatasetCertificationInput>
): readonly string[] {
  const blockers: string[] = [];
  const { manifest, evidence } = input;
  try {
    assertHistoricalDatasetAuthority(manifest.authority);
  } catch {
    blockers.push("historical_certificate_manifest_authority_invalid");
  }
  if (!validHash(manifest.datasetId)) blockers.push("historical_certificate_dataset_id_invalid");
  if (!validHash(manifest.datasetChecksum)) blockers.push("historical_certificate_dataset_checksum_invalid");
  if (!validHash(input.manifestHash)) blockers.push("historical_certificate_manifest_hash_invalid");
  if (!validHash(input.lineageRoot)) blockers.push("historical_certificate_lineage_root_invalid");
  if (!manifest.historicalTimeVerified) blockers.push("historical_certificate_time_unverified");
  if (!manifest.historicalDstVerified) blockers.push("historical_certificate_dst_unverified");
  if (manifest.integrityStatus === "blocked" || manifest.blockers.length) {
    blockers.push("historical_certificate_integrity_blocked");
  }
  if (!manifest.researchOnly || !manifest.rawHistoricalOhlcPersisted) {
    blockers.push("historical_certificate_manifest_scope_invalid");
  }
  if (
    manifest.capabilities.productionAdoptionAllowed ||
    manifest.capabilities.canCreateEvidence ||
    manifest.capabilities.canApproveReadiness ||
    manifest.capabilities.canApplyCalibration ||
    manifest.capabilities.canCreateTradeIntent
  ) blockers.push("historical_certificate_capability_enabled");
  const available = new Set([...manifest.sourceTimeframes, ...manifest.derivedTimeframes]);
  const manifestTimeframes = new Set(manifest.timeframes.map((item) => item.timeframe));
  if (manifestTimeframes.size !== manifest.timeframes.length) {
    blockers.push("historical_certificate_duplicate_timeframe_manifest");
  }
  for (const timeframe of REQUIRED_TIMEFRAMES) {
    if (!available.has(timeframe)) blockers.push(`historical_certificate_${timeframe}_missing`);
    if (!manifestTimeframes.has(timeframe)) blockers.push(`historical_certificate_${timeframe}_manifest_missing`);
  }
  for (const item of manifest.timeframes) {
    if (!Number.isSafeInteger(item.candleCount) || item.candleCount <= 0 || !item.partitionIds.length) {
      blockers.push(`historical_certificate_${item.timeframe}_manifest_invalid`);
    }
  }
  for (const timeframe of REQUIRED_DERIVED_TIMEFRAMES) {
    if (!manifest.derivedTimeframes.includes(timeframe)) {
      blockers.push(`historical_certificate_${timeframe}_derivation_missing`);
    }
  }
  for (const timeframe of ["1d", "1w"] as const) {
    if (!manifest.sourceTimeframes.includes(timeframe) || manifest.derivedTimeframes.includes(timeframe)) {
      blockers.push(`historical_certificate_${timeframe}_must_be_source_native`);
    }
  }
  const durationDays = (Date.parse(manifest.endUtc) - Date.parse(manifest.startUtc)) / 86_400_000;
  if (!validIso(manifest.startUtc) || !validIso(manifest.endUtc) || durationDays < 700 || durationDays > 740) {
    blockers.push("historical_certificate_range_invalid");
  }
  for (const [label, value] of Object.entries({
    qualificationReportId: evidence.qualificationReportId,
    bundleId: evidence.bundleId,
    capacityPlanId: evidence.capacityPlanId,
    evidencePackageId: evidence.evidencePackageId,
    controlledInterruptionReportId: evidence.controlledInterruptionReportId,
    readOnlySafetyReportId: evidence.readOnlySafetyReportId
  })) {
    if (!validHash(value)) blockers.push(`historical_certificate_${label}_invalid`);
  }
  if (!evidence.liveResumeVerified) {
    blockers.push("historical_certificate_live_resume_not_proven");
  }
  if (evidence.qualificationVerificationStatus !== "verified" || evidence.qualificationBlockers.length) {
    blockers.push("historical_certificate_qualification_unverified");
  }
  if (
    !evidence.readOnlySafetyVerified ||
    !evidence.loopbackOnly ||
    !evidence.getOnly ||
    evidence.forbiddenEndpointCallCount !== 0
  ) blockers.push("historical_certificate_read_only_safety_unverified");
  for (const [label, value] of Object.entries({
    storageBytes: evidence.storageBytes,
    peakMemoryBytes: evidence.peakMemoryBytes,
    retrievalDurationMs: evidence.retrievalDurationMs,
    normalizationDurationMs: evidence.normalizationDurationMs,
    integrityDurationMs: evidence.integrityDurationMs,
    derivationDurationMs: evidence.derivationDurationMs,
    reproductionDurationMs: evidence.reproductionDurationMs
  })) {
    if (!Number.isSafeInteger(value) || value < 0) blockers.push(`historical_certificate_${label}_invalid`);
  }
  if (!validIso(evidence.createdAtUtc) || !validIso(evidence.verifiedAtUtc)) {
    blockers.push("historical_certificate_verification_time_invalid");
  }
  if (!String(evidence.verifierVersion ?? "").trim()) blockers.push("historical_certificate_verifier_version_missing");
  validateComparison(
    evidence.deterministicRematerialization,
    "deterministic_rematerialization",
    evidence.qualificationReportId,
    blockers
  );
  validateComparison(
    evidence.providerRequery,
    "provider_requery",
    evidence.qualificationReportId,
    blockers
  );
  scanForbiddenKeys({ manifest, evidence }, blockers);
  return unique(blockers);
}

export async function buildHistoricalDatasetCertificate(
  input: Readonly<HistoricalDatasetCertificationInput>
): Promise<Readonly<GoTraderHistoricalDatasetCertificate>> {
  if (await canonicalHash(input.manifest) !== input.manifestHash) {
    throw new Error("Historical dataset certification blocked: historical_certificate_manifest_hash_mismatch");
  }
  for (const comparison of [
    input.evidence.deterministicRematerialization,
    input.evidence.providerRequery
  ]) {
    const { comparisonId, ...comparisonCore } = comparison;
    if (await canonicalHash(comparisonCore) !== comparisonId) {
      throw new Error("Historical dataset certification blocked: historical_reproduction_identity_mismatch");
    }
  }
  const blockers = evaluateHistoricalDatasetCertification(input);
  if (blockers.length) throw new Error(`Historical dataset certification blocked: ${blockers.join(", ")}`);
  const { manifest, evidence } = input;
  const sourceBarCounts = Object.freeze(manifest.timeframes
    .filter((item) => manifest.sourceTimeframes.includes(item.timeframe))
    .map((item) => Object.freeze({ timeframe: item.timeframe, barCount: item.candleCount }))
    .sort((left, right) => left.timeframe.localeCompare(right.timeframe)));
  const derivedBarCounts = Object.freeze(manifest.timeframes
    .filter((item) => manifest.derivedTimeframes.includes(item.timeframe))
    .map((item) => Object.freeze({ timeframe: item.timeframe, barCount: item.candleCount }))
    .sort((left, right) => left.timeframe.localeCompare(right.timeframe)));
  const sourceBarCount = manifest.timeframes.find((item) => item.timeframe === "1m")!.candleCount;
  const core = Object.freeze({
    certificateSchemaVersion: HISTORICAL_DATASET_CERTIFICATE_SCHEMA_VERSION,
    datasetId: manifest.datasetId,
    datasetChecksum: manifest.datasetChecksum,
    manifestHash: input.manifestHash,
    lineageRoot: input.lineageRoot,
    historicalDatasetRequestId: manifest.requestId,
    qualificationReportId: evidence.qualificationReportId,
    bundleId: evidence.bundleId,
    capacityPlanId: evidence.capacityPlanId,
    evidencePackageId: evidence.evidencePackageId,
    provider: manifest.providerId,
    providerVersion: manifest.providerVersion,
    sourceFingerprint: manifest.sourceFingerprint,
    requestedSymbol: manifest.requestedSymbol,
    brokerSymbol: manifest.brokerSymbol,
    symbolSpecificationId: manifest.symbolSpecId,
    sourceTimeframes: Object.freeze([...manifest.sourceTimeframes].sort()),
    canonicalSourceTimeframe: "1m" as const,
    sourceBarCount,
    derivedTimeframes: Object.freeze([...manifest.derivedTimeframes].sort()),
    startUtc: manifest.startUtc,
    endUtc: manifest.endUtc,
    sourceBarCounts,
    derivedBarCounts,
    partitionCount: manifest.timeframes.reduce((count, item) => count + item.partitionIds.length, 0),
    diskBytes: evidence.storageBytes,
    peakMemoryBytes: evidence.peakMemoryBytes,
    timeAuthorityId: manifest.timeAuthorityId,
    historicalTimeVerified: true as const,
    historicalDstVerified: true as const,
    calendarPolicyId: manifest.calendarId,
    alignmentPolicyId: manifest.timeframeAlignmentPolicyId,
    normalizationVersion: manifest.normalizationVersion,
    integrityPolicyVersion: HISTORICAL_INTEGRITY_SCHEMA_VERSION,
    partitionPolicyVersion: HISTORICAL_PARTITION_SCHEMA_VERSION,
    capacityPolicyVersion: HISTORICAL_CAPACITY_PLAN_SCHEMA_VERSION,
    integrityStatus: manifest.integrityStatus as "accepted" | "accepted_with_warnings",
    restartResumeVerified: true as const,
    deterministicRematerializationVerified: true as const,
    providerRequeryStatus: "stable" as const,
    providerDriftStatus: "not_detected" as const,
    readOnlySafetyVerified: true as const,
    strategyNeutral: true as const,
    controlledInterruptionReportId: evidence.controlledInterruptionReportId,
    deterministicComparisonId: evidence.deterministicRematerialization.comparisonId,
    providerRequeryComparisonId: evidence.providerRequery.comparisonId,
    readOnlySafetyReportId: evidence.readOnlySafetyReportId,
    performance: Object.freeze({
      retrievalDurationMs: evidence.retrievalDurationMs,
      normalizationDurationMs: evidence.normalizationDurationMs,
      integrityDurationMs: evidence.integrityDurationMs,
      derivationDurationMs: evidence.derivationDurationMs,
      reproductionDurationMs: evidence.reproductionDurationMs
    }),
    createdAtUtc: new Date(evidence.createdAtUtc).toISOString(),
    verifiedAtUtc: new Date(evidence.verifiedAtUtc).toISOString(),
    verifierVersion: evidence.verifierVersion.trim(),
    authoritativeScope: "historical_input_integrity_only" as const,
    authority: HISTORICAL_DATASET_AUTHORITY_NONE,
    capabilities: manifest.capabilities
  });
  return Object.freeze({ ...core, certificateId: await canonicalHash(core) });
}

export async function buildHistoricalDatasetRegistryEntry(
  certificate: Readonly<GoTraderHistoricalDatasetCertificate>,
  status: HistoricalDatasetRegistryEntry["status"] = "qualified"
): Promise<Readonly<HistoricalDatasetRegistryEntry>> {
  if (await validateHistoricalDatasetCertificate(certificate).then((items) => items.length)) {
    throw new Error("Historical dataset registry rejected an invalid certificate.");
  }
  const core = Object.freeze({
    certificateId: certificate.certificateId,
    datasetId: certificate.datasetId,
    datasetChecksum: certificate.datasetChecksum,
    requestedSymbol: certificate.requestedSymbol,
    brokerSymbol: certificate.brokerSymbol,
    startUtc: certificate.startUtc,
    endUtc: certificate.endUtc,
    historicalTimeVerified: true as const,
    historicalDstVerified: true as const,
    integrityStatus: certificate.integrityStatus,
    status
  });
  return Object.freeze({ ...core, registryEntryId: await canonicalHash(core) });
}

export async function buildHistoricalDatasetRegistry(
  entries: readonly Readonly<HistoricalDatasetRegistryEntry>[]
): Promise<Readonly<HistoricalDatasetRegistry>> {
  const sorted = Object.freeze([...entries]
    .sort((left, right) => left.registryEntryId.localeCompare(right.registryEntryId)));
  if (new Set(sorted.map((entry) => entry.registryEntryId)).size !== sorted.length) {
    throw new Error("Historical dataset registry contains duplicate entries.");
  }
  for (const entry of sorted) {
    const { registryEntryId, ...core } = entry;
    if (await canonicalHash(core) !== registryEntryId) {
      throw new Error("Historical dataset registry entry identity mismatch.");
    }
  }
  const core = Object.freeze({
    schemaVersion: HISTORICAL_DATASET_REGISTRY_SCHEMA_VERSION,
    entries: sorted,
    authority: HISTORICAL_DATASET_AUTHORITY_NONE
  });
  return Object.freeze({ ...core, registryId: await canonicalHash(core) });
}

export async function validateHistoricalDatasetCertificate(
  certificate: Readonly<GoTraderHistoricalDatasetCertificate>
): Promise<readonly string[]> {
  const blockers: string[] = [];
  try {
    assertHistoricalDatasetAuthority(certificate.authority);
  } catch {
    blockers.push("historical_certificate_authority_invalid");
  }
  const { certificateId, ...core } = certificate;
  if (!validHash(certificateId) || await canonicalHash(core) !== certificateId) {
    blockers.push("historical_certificate_identity_mismatch");
  }
  if (certificate.certificateSchemaVersion !== HISTORICAL_DATASET_CERTIFICATE_SCHEMA_VERSION) {
    blockers.push("historical_certificate_schema_invalid");
  }
  for (const [label, value] of Object.entries({
    datasetId: certificate.datasetId,
    datasetChecksum: certificate.datasetChecksum,
    manifestHash: certificate.manifestHash,
    lineageRoot: certificate.lineageRoot,
    historicalDatasetRequestId: certificate.historicalDatasetRequestId,
    qualificationReportId: certificate.qualificationReportId,
    bundleId: certificate.bundleId,
    capacityPlanId: certificate.capacityPlanId,
    evidencePackageId: certificate.evidencePackageId,
    sourceFingerprint: certificate.sourceFingerprint,
    symbolSpecificationId: certificate.symbolSpecificationId,
    timeAuthorityId: certificate.timeAuthorityId,
    calendarPolicyId: certificate.calendarPolicyId,
    alignmentPolicyId: certificate.alignmentPolicyId,
    controlledInterruptionReportId: certificate.controlledInterruptionReportId,
    deterministicComparisonId: certificate.deterministicComparisonId,
    providerRequeryComparisonId: certificate.providerRequeryComparisonId,
    readOnlySafetyReportId: certificate.readOnlySafetyReportId
  })) {
    if (!validHash(value)) blockers.push(`historical_certificate_${label}_invalid`);
  }
  const available = new Set([...certificate.sourceTimeframes, ...certificate.derivedTimeframes]);
  for (const timeframe of REQUIRED_TIMEFRAMES) {
    if (!available.has(timeframe)) blockers.push(`historical_certificate_${timeframe}_missing`);
  }
  for (const timeframe of REQUIRED_DERIVED_TIMEFRAMES) {
    if (!certificate.derivedTimeframes.includes(timeframe)) {
      blockers.push(`historical_certificate_${timeframe}_derivation_missing`);
    }
  }
  for (const timeframe of ["1d", "1w"] as const) {
    if (!certificate.sourceTimeframes.includes(timeframe) || certificate.derivedTimeframes.includes(timeframe)) {
      blockers.push(`historical_certificate_${timeframe}_must_be_source_native`);
    }
  }
  const durationDays = (Date.parse(certificate.endUtc) - Date.parse(certificate.startUtc)) / 86_400_000;
  if (!validIso(certificate.startUtc) || !validIso(certificate.endUtc) || durationDays < 700 || durationDays > 740) {
    blockers.push("historical_certificate_range_invalid");
  }
  if (!certificate.historicalTimeVerified || !certificate.historicalDstVerified) {
    blockers.push("historical_certificate_time_claim_invalid");
  }
  if (
    certificate.canonicalSourceTimeframe !== "1m" ||
    !Number.isSafeInteger(certificate.sourceBarCount) ||
    certificate.sourceBarCount <= 0
  ) blockers.push("historical_certificate_source_bar_count_invalid");
  if (
    certificate.integrityPolicyVersion !== HISTORICAL_INTEGRITY_SCHEMA_VERSION ||
    certificate.partitionPolicyVersion !== HISTORICAL_PARTITION_SCHEMA_VERSION ||
    certificate.capacityPolicyVersion !== HISTORICAL_CAPACITY_PLAN_SCHEMA_VERSION
  ) blockers.push("historical_certificate_policy_version_invalid");
  if (!["accepted", "accepted_with_warnings"].includes(certificate.integrityStatus)) {
    blockers.push("historical_certificate_integrity_claim_invalid");
  }
  if (
    certificate.capabilities.productionAdoptionAllowed ||
    certificate.capabilities.canCreateEvidence ||
    certificate.capabilities.canApproveReadiness ||
    certificate.capabilities.canApplyCalibration ||
    certificate.capabilities.canCreateTradeIntent
  ) blockers.push("historical_certificate_capability_enabled");
  if (
    certificate.authoritativeScope !== "historical_input_integrity_only" ||
    certificate.providerDriftStatus !== "not_detected" ||
    !certificate.restartResumeVerified ||
    !certificate.deterministicRematerializationVerified ||
    !certificate.readOnlySafetyVerified ||
    !certificate.strategyNeutral
  ) blockers.push("historical_certificate_claims_invalid");
  scanForbiddenKeys(core, blockers);
  return unique(blockers);
}
