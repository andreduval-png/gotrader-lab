import { canonicalHash } from "../canonical/canonicalValueSerialization";
import {
  HISTORICAL_DATASET_AUTHORITY_NONE,
  assertHistoricalDatasetAuthority
} from "./historicalDatasetAuthority";
import {
  createHistoricalTimeNormalizationPolicy,
  type HistoricalDstPolicy,
  type HistoricalProviderTimeBasis
} from "./historicalTimeNormalization";
import {
  HISTORICAL_SYMBOL_SPEC_SCHEMA_VERSION,
  HISTORICAL_TIME_AUTHORITY_SCHEMA_VERSION,
  type HistoricalDatasetCapabilities,
  type HistoricalDatasetRequest,
  type HistoricalSymbolSpecSnapshot,
  type HistoricalTimeAuthority,
  type HistoricalTimeEvidenceCheck,
  type HistoricalTimeframe
} from "./historicalDatasetTypes";

export const HISTORICAL_DATASET_CAPABILITIES_DISABLED: Readonly<HistoricalDatasetCapabilities> =
  Object.freeze({
    productionAdoptionAllowed: false,
    canCreateEvidence: false,
    canApproveReadiness: false,
    canApplyCalibration: false,
    canCreateTradeIntent: false
  });

const supportedTimeframes: readonly HistoricalTimeframe[] = Object.freeze([
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
  "1w"
]);

const unique = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const required = (value: string, name: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`Historical dataset ${name} is required.`);
  return normalized;
};

const iso = (value: string, name: string) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Historical dataset ${name} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
};

const normalizeTimeframes = (values: readonly HistoricalTimeframe[], name: string) => {
  if (!values.length) throw new Error(`Historical dataset ${name} must not be empty.`);
  for (const value of values) {
    if (!supportedTimeframes.includes(value)) {
      throw new Error(`Historical dataset ${name} contains unsupported timeframe ${value}.`);
    }
  }
  return unique(values) as readonly HistoricalTimeframe[];
};

const checkAccepted = (check: Readonly<HistoricalTimeEvidenceCheck>) =>
  check.status === "verified" || check.status === "not_applicable";

const checkVerified = (check: Readonly<HistoricalTimeEvidenceCheck>) =>
  check.status === "verified";

const normalizeCheck = (
  value: Readonly<HistoricalTimeEvidenceCheck>,
  name: string
): Readonly<HistoricalTimeEvidenceCheck> => {
  const checkId = required(value.checkId, `${name}.checkId`);
  const blockers = unique(value.blockers);
  if (value.status === "verified" && !value.evidenceId) {
    throw new Error(`Historical time ${name} verification requires evidenceId.`);
  }
  if (value.status === "blocked" && !blockers.length) {
    throw new Error(`Historical time ${name} blocked check requires blockers.`);
  }
  return Object.freeze({
    checkId,
    status: value.status,
    ...(value.evidenceId ? { evidenceId: required(value.evidenceId, `${name}.evidenceId`) } : {}),
    blockers
  });
};

export async function buildHistoricalTimeAuthority(input: {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly providerTimeBasis: HistoricalProviderTimeBasis;
  readonly dstPolicy: HistoricalDstPolicy;
  readonly checks: HistoricalTimeAuthority["checks"];
  readonly warnings?: readonly string[];
}): Promise<Readonly<HistoricalTimeAuthority>> {
  const checks = Object.freeze({
    winter: normalizeCheck(input.checks.winter, "winter"),
    summer: normalizeCheck(input.checks.summer, "summer"),
    springTransition: normalizeCheck(input.checks.springTransition, "springTransition"),
    fallTransition: normalizeCheck(input.checks.fallTransition, "fallTransition"),
    maintenanceBoundary: normalizeCheck(input.checks.maintenanceBoundary, "maintenanceBoundary")
  });
  const blockers = unique([
    ...Object.values(checks).flatMap((check) => check.blockers),
    input.providerTimeBasis === "unknown" ? "historical_provider_time_basis_unknown" : "",
    !checkVerified(checks.winter) ? "historical_winter_time_not_verified" : "",
    !checkVerified(checks.summer) ? "historical_summer_time_not_verified" : "",
    !checkVerified(checks.maintenanceBoundary) ? "historical_maintenance_boundary_not_verified" : "",
    !checkAccepted(checks.springTransition) ? "historical_spring_dst_transition_not_verified" : "",
    !checkAccepted(checks.fallTransition) ? "historical_fall_dst_transition_not_verified" : ""
  ]);
  const historicalTimeVerified =
    input.providerTimeBasis !== "unknown" &&
    checkVerified(checks.winter) &&
    checkVerified(checks.summer) &&
    checkVerified(checks.maintenanceBoundary);
  const historicalDstVerified =
    historicalTimeVerified &&
    checkAccepted(checks.springTransition) &&
    checkAccepted(checks.fallTransition) &&
    (input.dstPolicy === "not_applicable" ||
      (checkVerified(checks.springTransition) && checkVerified(checks.fallTransition)));
  const core = {
    schemaVersion:
      HISTORICAL_TIME_AUTHORITY_SCHEMA_VERSION as typeof HISTORICAL_TIME_AUTHORITY_SCHEMA_VERSION,
    providerId: required(input.providerId, "timeAuthority.providerId"),
    providerVersion: required(input.providerVersion, "timeAuthority.providerVersion"),
    providerTimeBasis: input.providerTimeBasis,
    dstPolicy: input.dstPolicy,
    historicalTimeVerified,
    historicalDstVerified,
    checks,
    blockers,
    warnings: unique(input.warnings ?? []),
    authority: HISTORICAL_DATASET_AUTHORITY_NONE
  };
  return Object.freeze({ ...core, authorityId: await canonicalHash(core) });
}

export async function buildHistoricalSymbolSpecSnapshot(input: Omit<
  HistoricalSymbolSpecSnapshot,
  "schemaVersion" | "symbolSpecId" | "blockers" | "warnings" | "authority"
> & {
  readonly blockers?: readonly string[];
  readonly warnings?: readonly string[];
}): Promise<Readonly<HistoricalSymbolSpecSnapshot>> {
  const blockers = [...(input.blockers ?? [])];
  if (!Number.isInteger(input.digits) || input.digits < 0 || input.digits > 12) {
    blockers.push("symbol_digits_invalid");
  }
  if (!Number.isFinite(input.pointSize) || input.pointSize <= 0) blockers.push("symbol_point_size_invalid");
  if (!Number.isInteger(input.pipInPoints) || input.pipInPoints <= 0) blockers.push("symbol_pip_points_invalid");
  if (!Number.isFinite(input.pipSize) || input.pipSize <= 0) blockers.push("symbol_pip_size_invalid");
  const expectedPip = input.pointSize * input.pipInPoints;
  if (
    Number.isFinite(expectedPip) &&
    Number.isFinite(input.pipSize) &&
    Math.abs(expectedPip - input.pipSize) > Math.max(1e-12, Math.abs(expectedPip) * 1e-9)
  ) {
    blockers.push("symbol_pip_point_relationship_invalid");
  }
  for (const [name, value] of Object.entries({
    tickSize: input.tickSize,
    tickValue: input.tickValue,
    tradeContractSize: input.tradeContractSize,
    volumeMinLots: input.volumeMinLots,
    volumeMaxLots: input.volumeMaxLots,
    volumeStepLots: input.volumeStepLots
  })) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      blockers.push(`symbol_${name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_invalid`);
    }
  }
  if (
    input.volumeMinLots !== undefined &&
    input.volumeMaxLots !== undefined &&
    input.volumeMinLots > input.volumeMaxLots
  ) blockers.push("symbol_volume_bounds_invalid");
  if (input.verificationStatus !== "verified_provider_metadata") {
    blockers.push("symbol_spec_provider_metadata_unverified");
  }
  const core = {
    schemaVersion: HISTORICAL_SYMBOL_SPEC_SCHEMA_VERSION as typeof HISTORICAL_SYMBOL_SPEC_SCHEMA_VERSION,
    providerId: required(input.providerId, "symbolSpec.providerId"),
    requestedSymbol: required(input.requestedSymbol, "symbolSpec.requestedSymbol"),
    brokerSymbol: required(input.brokerSymbol, "symbolSpec.brokerSymbol"),
    digits: input.digits,
    pointSize: input.pointSize,
    pipSize: input.pipSize,
    pipInPoints: input.pipInPoints,
    spreadUnit: input.spreadUnit,
    ...(input.tickSize === undefined ? {} : { tickSize: input.tickSize }),
    ...(input.tickValue === undefined ? {} : { tickValue: input.tickValue }),
    ...(input.tickValueCurrency ? { tickValueCurrency: input.tickValueCurrency } : {}),
    ...(input.tradeContractSize === undefined ? {} : { tradeContractSize: input.tradeContractSize }),
    ...(input.volumeMinLots === undefined ? {} : { volumeMinLots: input.volumeMinLots }),
    ...(input.volumeMaxLots === undefined ? {} : { volumeMaxLots: input.volumeMaxLots }),
    ...(input.volumeStepLots === undefined ? {} : { volumeStepLots: input.volumeStepLots }),
    ...(input.accountCurrency ? { accountCurrency: input.accountCurrency } : {}),
    verificationStatus: input.verificationStatus,
    sourceFingerprint: required(input.sourceFingerprint, "symbolSpec.sourceFingerprint"),
    blockers: unique(blockers),
    warnings: unique(input.warnings ?? []),
    authority: HISTORICAL_DATASET_AUTHORITY_NONE
  };
  return Object.freeze({ ...core, symbolSpecId: await canonicalHash(core) });
}

export async function deriveHistoricalDatasetRequestIdentity(
  input: Readonly<HistoricalDatasetRequest>,
  provider: {
    readonly providerId: string;
    readonly providerVersion: string;
    readonly sourceFingerprint: string;
    readonly maximumPageCandles: number;
    readonly supportedTimeframes: readonly HistoricalTimeframe[];
    readonly authority: unknown;
  }
) {
  assertHistoricalDatasetAuthority(provider.authority);
  assertHistoricalDatasetAuthority(input.timeAuthority.authority);
  assertHistoricalDatasetAuthority(input.symbolSpec.authority);
  const policy = createHistoricalTimeNormalizationPolicy(input.timeNormalizationPolicy);
  const sourceTimeframes = normalizeTimeframes(input.sourceTimeframes, "sourceTimeframes");
  const derivedTimeframes = unique(input.derivedTimeframes ?? [])
    .filter((value) => !sourceTimeframes.includes(value as HistoricalTimeframe)) as readonly HistoricalTimeframe[];
  for (const timeframe of sourceTimeframes) {
    if (!provider.supportedTimeframes.includes(timeframe)) {
      throw new Error(`Historical provider does not support source timeframe ${timeframe}.`);
    }
  }
  const startUtc = iso(input.startUtc, "startUtc");
  const endUtc = iso(input.endUtc, "endUtc");
  if (Date.parse(endUtc) <= Date.parse(startUtc)) {
    throw new Error("Historical dataset endUtc must be after startUtc.");
  }
  if (!Number.isInteger(input.pageSize) || input.pageSize <= 0 || input.pageSize > provider.maximumPageCandles) {
    throw new Error("Historical dataset pageSize exceeds provider bounds.");
  }
  const requestedSymbol = required(input.requestedSymbol, "requestedSymbol");
  const brokerSymbol = required(input.brokerSymbol, "brokerSymbol");
  if (
    input.symbolSpec.requestedSymbol !== requestedSymbol ||
    input.symbolSpec.brokerSymbol !== brokerSymbol ||
    input.symbolSpec.providerId !== provider.providerId
  ) throw new Error("Historical symbol specification does not match the provider request.");
  if (
    input.timeAuthority.providerId !== provider.providerId ||
    input.timeAuthority.providerVersion !== provider.providerVersion ||
    input.timeAuthority.providerTimeBasis !== policy.basis ||
    input.timeAuthority.dstPolicy !== policy.dstPolicy
  ) throw new Error("Historical time authority does not match the provider normalization policy.");
  if (
    input.calendar.providerId !== provider.providerId ||
    input.calendar.brokerSymbol !== brokerSymbol
  ) throw new Error("Historical market calendar does not match the provider request.");
  if (!Number.isInteger(input.timeframeAlignment.anchorOffsetMinutes)) {
    throw new Error("Historical timeframe alignment anchor must be an integer minute offset.");
  }
  const normalizedRequest = Object.freeze({
    ...input,
    requestedSymbol,
    brokerSymbol,
    sourceTimeframes,
    derivedTimeframes,
    parentDatasetIds: unique(input.parentDatasetIds ?? []),
    startUtc,
    endUtc,
    timeNormalizationPolicy: policy
  });
  const requestCore = {
    providerId: provider.providerId,
    providerVersion: provider.providerVersion,
    sourceFingerprint: provider.sourceFingerprint,
    requestedSymbol,
    brokerSymbol,
    sourceTimeframes,
    derivedTimeframes,
    parentDatasetIds: unique(input.parentDatasetIds ?? []),
    startUtc,
    endUtc,
    pageSize: input.pageSize,
    timeNormalizationPolicy: policy,
    timeAuthorityId: input.timeAuthority.authorityId,
    symbolSpecId: input.symbolSpec.symbolSpecId,
    calendarId: input.calendar.calendarId,
    calendarVersion: input.calendar.version,
    timeframeAlignment: input.timeframeAlignment,
    creationPolicyId: required(input.creationPolicyId, "creationPolicyId"),
    creationPolicyVersion: required(input.creationPolicyVersion, "creationPolicyVersion")
  };
  const requestHash = await canonicalHash(requestCore);
  return Object.freeze({ requestId: requestHash, requestHash, requestCore, normalizedRequest });
}

export function historicalTimeframeMilliseconds(value: HistoricalTimeframe) {
  const values: Record<HistoricalTimeframe, number> = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
    "1w": 604_800_000
  };
  return values[value];
}
