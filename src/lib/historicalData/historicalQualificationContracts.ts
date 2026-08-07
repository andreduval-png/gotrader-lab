import { canonicalHash } from "../canonical/canonicalValueSerialization";
import {
  HISTORICAL_DATASET_AUTHORITY_NONE,
  assertHistoricalDatasetAuthority
} from "./historicalDatasetAuthority";
import {
  HISTORICAL_CAPACITY_PLAN_SCHEMA_VERSION,
  HISTORICAL_MARKET_CALENDAR_SCHEMA_VERSION,
  HISTORICAL_TIME_EVIDENCE_PACKAGE_SCHEMA_VERSION,
  HISTORICAL_TIMEFRAME_ALIGNMENT_SCHEMA_VERSION,
  type HistoricalClosedInterval,
  type HistoricalDatasetCapacityPlan,
  type HistoricalMarketCalendarSnapshot,
  type HistoricalQualificationStatus,
  type HistoricalTimeEvidencePackage,
  type HistoricalTimeEvidencePeriod,
  type HistoricalTimeEvidenceRecord,
  type HistoricalTimeframe,
  type HistoricalTimeframeAlignmentPolicy
} from "./historicalDatasetTypes";
import type {
  HistoricalDstPolicy,
  HistoricalProviderTimeBasis
} from "./historicalTimeNormalization";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const PERIODS: readonly HistoricalTimeEvidencePeriod[] = Object.freeze([
  "winter",
  "summer",
  "spring_transition",
  "fall_transition",
  "maintenance_boundary"
]);
const DERIVABLE_WITH_FIXED_UTC: readonly HistoricalTimeframe[] = Object.freeze([
  "5m", "15m", "1h", "4h"
]);
const HISTORICAL_TIMEFRAMES: readonly HistoricalTimeframe[] = Object.freeze([
  "1m", "5m", "15m", "1h", "4h", "1d", "1w"
]);

const unique = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const required = (value: string, name: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`Historical qualification ${name} is required.`);
  return normalized;
};

const iso = (value: string, name: string) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Historical qualification ${name} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
};

const fingerprint = (value: string, name: string) => {
  const normalized = required(value, name);
  if (!HASH_PATTERN.test(normalized)) {
    throw new Error(`Historical qualification ${name} must be a canonical sha256 identity.`);
  }
  return normalized;
};

const validateTimezone = (value: string) => {
  const timezone = required(value, "sessionTimezone");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new Error(`Historical qualification sessionTimezone is invalid: ${timezone}`);
  }
  return timezone;
};

const statusAccepted = (value: HistoricalQualificationStatus) =>
  value === "verified" || value === "not_applicable";

const evidenceRecordCore = (record: Readonly<HistoricalTimeEvidenceRecord>) => {
  const { evidenceId, ...core } = record;
  return core;
};

const evidencePackageCore = (value: Readonly<HistoricalTimeEvidencePackage>) => {
  const { evidencePackageId, ...core } = value;
  return core;
};

const calendarCore = (value: Readonly<HistoricalMarketCalendarSnapshot>) => {
  const { calendarId, ...core } = value;
  return core;
};

const alignmentCore = (value: Readonly<HistoricalTimeframeAlignmentPolicy>) => {
  const { policyId, ...core } = value;
  return core;
};

export async function buildHistoricalTimeEvidenceRecord(input: Omit<
  HistoricalTimeEvidenceRecord,
  "schemaVersion" | "evidenceId" | "blockers" | "warnings" | "authority"
> & {
  readonly blockers?: readonly string[];
  readonly warnings?: readonly string[];
}): Promise<Readonly<HistoricalTimeEvidenceRecord>> {
  if (!PERIODS.includes(input.period)) throw new Error(`Unsupported historical evidence period: ${input.period}`);
  if (!statusAccepted(input.timestampStatus) && input.timestampStatus !== "blocked") {
    throw new Error("Historical evidence timestamp status is invalid.");
  }
  if (!statusAccepted(input.sessionStatus) && input.sessionStatus !== "blocked") {
    throw new Error("Historical evidence session status is invalid.");
  }
  const blockers = unique(input.blockers ?? []);
  if ((input.timestampStatus === "blocked" || input.sessionStatus === "blocked") && !blockers.length) {
    throw new Error("Blocked historical evidence requires at least one blocker.");
  }
  if (input.observedOffsetMinutes !== undefined && (
    !Number.isInteger(input.observedOffsetMinutes) || Math.abs(input.observedOffsetMinutes) > 14 * 60
  )) throw new Error("Historical evidence offset must be an integer between -840 and 840 minutes.");
  const core = Object.freeze({
    schemaVersion:
      HISTORICAL_TIME_EVIDENCE_PACKAGE_SCHEMA_VERSION as typeof HISTORICAL_TIME_EVIDENCE_PACKAGE_SCHEMA_VERSION,
    period: input.period,
    providerId: required(input.providerId, "evidence.providerId"),
    providerVersion: required(input.providerVersion, "evidence.providerVersion"),
    terminalIdentityFingerprint: fingerprint(input.terminalIdentityFingerprint, "evidence.terminalIdentityFingerprint"),
    requestedSymbol: required(input.requestedSymbol, "evidence.requestedSymbol"),
    brokerSymbol: required(input.brokerSymbol, "evidence.brokerSymbol"),
    timeframe: input.timeframe,
    rawProviderTime: input.rawProviderTime,
    normalizedTimeUtc: iso(input.normalizedTimeUtc, "evidence.normalizedTimeUtc"),
    expectedSessionInterpretation: required(
      input.expectedSessionInterpretation,
      "evidence.expectedSessionInterpretation"
    ),
    ...(input.observedOffsetMinutes === undefined ? {} : { observedOffsetMinutes: input.observedOffsetMinutes }),
    providerTimeBasis: input.providerTimeBasis,
    sourceFingerprint: fingerprint(input.sourceFingerprint, "evidence.sourceFingerprint"),
    normalizationPolicyId: required(input.normalizationPolicyId, "evidence.normalizationPolicyId"),
    normalizationPolicyVersion: required(input.normalizationPolicyVersion, "evidence.normalizationPolicyVersion"),
    timestampStatus: input.timestampStatus,
    sessionStatus: input.sessionStatus,
    blockers,
    warnings: unique(input.warnings ?? []),
    authority: HISTORICAL_DATASET_AUTHORITY_NONE
  });
  return Object.freeze({ ...core, evidenceId: await canonicalHash(core) });
}

export async function buildHistoricalTimeEvidencePackage(input: {
  readonly providerId: string;
  readonly providerVersion: string;
  readonly terminalIdentityFingerprint: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly providerTimeBasis: HistoricalProviderTimeBasis;
  readonly timestampDstPolicy: HistoricalDstPolicy;
  readonly sessionTimezone: string;
  readonly sourceFingerprint: string;
  readonly normalizationPolicyId: string;
  readonly normalizationPolicyVersion: string;
  readonly verificationVersion: string;
  readonly records: readonly Readonly<HistoricalTimeEvidenceRecord>[];
  readonly warnings?: readonly string[];
}): Promise<Readonly<HistoricalTimeEvidencePackage>> {
  const records = [...input.records].sort(
    (left, right) => left.period.localeCompare(right.period) || left.evidenceId.localeCompare(right.evidenceId)
  );
  const blockers: string[] = [];
  for (const period of PERIODS) {
    const matches = records.filter((record) => record.period === period);
    if (matches.length !== 1) blockers.push(`historical_${period}_evidence_count_invalid`);
  }
  for (const record of records) {
    assertHistoricalDatasetAuthority(record.authority);
    if (
      record.providerId !== input.providerId ||
      record.providerVersion !== input.providerVersion ||
      record.terminalIdentityFingerprint !== input.terminalIdentityFingerprint ||
      record.requestedSymbol !== input.requestedSymbol ||
      record.brokerSymbol !== input.brokerSymbol ||
      record.providerTimeBasis !== input.providerTimeBasis ||
      record.sourceFingerprint !== input.sourceFingerprint ||
      record.normalizationPolicyId !== input.normalizationPolicyId ||
      record.normalizationPolicyVersion !== input.normalizationPolicyVersion ||
      await canonicalHash(evidenceRecordCore(record)) !== record.evidenceId
    ) blockers.push(`historical_${record.period}_evidence_identity_mismatch`);
    blockers.push(...record.blockers);
  }
  const byPeriod = new Map(records.map((record) => [record.period, record]));
  const winter = byPeriod.get("winter");
  const summer = byPeriod.get("summer");
  const spring = byPeriod.get("spring_transition");
  const fall = byPeriod.get("fall_transition");
  const maintenance = byPeriod.get("maintenance_boundary");
  const historicalTimestampVerified = [winter, summer, spring, fall, maintenance].every(
    (record) => record && statusAccepted(record.timestampStatus)
  );
  const historicalSessionVerified = [winter, summer, maintenance].every(
    (record) => record?.sessionStatus === "verified"
  );
  const historicalSessionDstVerified = [spring, fall].every(
    (record) => record?.sessionStatus === "verified"
  );
  if (!historicalTimestampVerified) blockers.push("historical_timestamp_evidence_incomplete");
  if (!historicalSessionVerified) blockers.push("historical_session_evidence_incomplete");
  if (!historicalSessionDstVerified) blockers.push("historical_session_dst_evidence_incomplete");
  const core = Object.freeze({
    schemaVersion:
      HISTORICAL_TIME_EVIDENCE_PACKAGE_SCHEMA_VERSION as typeof HISTORICAL_TIME_EVIDENCE_PACKAGE_SCHEMA_VERSION,
    providerId: required(input.providerId, "evidencePackage.providerId"),
    providerVersion: required(input.providerVersion, "evidencePackage.providerVersion"),
    terminalIdentityFingerprint: fingerprint(
      input.terminalIdentityFingerprint,
      "evidencePackage.terminalIdentityFingerprint"
    ),
    requestedSymbol: required(input.requestedSymbol, "evidencePackage.requestedSymbol"),
    brokerSymbol: required(input.brokerSymbol, "evidencePackage.brokerSymbol"),
    providerTimeBasis: input.providerTimeBasis,
    timestampDstPolicy: input.timestampDstPolicy,
    sessionTimezone: validateTimezone(input.sessionTimezone),
    sourceFingerprint: fingerprint(input.sourceFingerprint, "evidencePackage.sourceFingerprint"),
    normalizationPolicyId: required(input.normalizationPolicyId, "evidencePackage.normalizationPolicyId"),
    normalizationPolicyVersion: required(
      input.normalizationPolicyVersion,
      "evidencePackage.normalizationPolicyVersion"
    ),
    verificationVersion: required(input.verificationVersion, "evidencePackage.verificationVersion"),
    records: Object.freeze(records),
    historicalTimestampVerified,
    historicalSessionVerified,
    historicalSessionDstVerified,
    blockers: unique(blockers),
    warnings: unique(input.warnings ?? []),
    authority: HISTORICAL_DATASET_AUTHORITY_NONE
  });
  return Object.freeze({ ...core, evidencePackageId: await canonicalHash(core) });
}

export async function validateHistoricalTimeEvidencePackage(
  value: Readonly<HistoricalTimeEvidencePackage>
) {
  const blockers: string[] = [];
  try {
    assertHistoricalDatasetAuthority(value.authority);
  } catch {
    blockers.push("historical_evidence_package_authority_invalid");
  }
  if (await canonicalHash(evidencePackageCore(value)) !== value.evidencePackageId) {
    blockers.push("historical_evidence_package_identity_mismatch");
  }
  blockers.push(...value.blockers);
  return Object.freeze(unique(blockers));
}

export async function buildHistoricalMarketCalendarSnapshot(input: Omit<
  HistoricalMarketCalendarSnapshot,
  "schemaVersion" | "calendarId" | "closedIntervals"
> & {
  readonly closedIntervals: readonly Readonly<HistoricalClosedInterval>[];
}): Promise<Readonly<HistoricalMarketCalendarSnapshot>> {
  const intervals = [...input.closedIntervals]
    .map((interval) => Object.freeze({
      startUtc: iso(interval.startUtc, "calendar.closedInterval.startUtc"),
      endUtc: iso(interval.endUtc, "calendar.closedInterval.endUtc"),
      reason: interval.reason,
      ...(interval.evidenceId ? { evidenceId: fingerprint(interval.evidenceId, "calendar.closedInterval.evidenceId") } : {})
    }))
    .sort((left, right) => left.startUtc.localeCompare(right.startUtc) || left.endUtc.localeCompare(right.endUtc));
  for (let index = 0; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (Date.parse(interval.endUtc) <= Date.parse(interval.startUtc)) {
      throw new Error("Historical calendar closed interval must have positive duration.");
    }
    if (input.verificationStatus === "verified" && !interval.evidenceId) {
      throw new Error("Verified historical calendar intervals require evidence IDs.");
    }
    if (index > 0 && Date.parse(interval.startUtc) < Date.parse(intervals[index - 1].endUtc)) {
      throw new Error("Historical calendar closed intervals must not overlap.");
    }
  }
  if (input.verificationStatus === "verified" && !input.verificationEvidenceId) {
    throw new Error("Verified historical calendar requires a verificationEvidenceId.");
  }
  const core = Object.freeze({
    schemaVersion:
      HISTORICAL_MARKET_CALENDAR_SCHEMA_VERSION as typeof HISTORICAL_MARKET_CALENDAR_SCHEMA_VERSION,
    version: required(input.version, "calendar.version"),
    providerId: required(input.providerId, "calendar.providerId"),
    brokerSymbol: required(input.brokerSymbol, "calendar.brokerSymbol"),
    timezone: validateTimezone(input.timezone),
    dstPolicy: input.dstPolicy,
    evidencePackageId: fingerprint(input.evidencePackageId, "calendar.evidencePackageId"),
    verificationVersion: required(input.verificationVersion, "calendar.verificationVersion"),
    ...(input.verificationEvidenceId
      ? { verificationEvidenceId: fingerprint(input.verificationEvidenceId, "calendar.verificationEvidenceId") }
      : {}),
    verificationStatus: input.verificationStatus,
    closedIntervals: Object.freeze(intervals),
    sourceFingerprint: fingerprint(input.sourceFingerprint, "calendar.sourceFingerprint")
  });
  return Object.freeze({ ...core, calendarId: await canonicalHash(core) });
}

export async function validateHistoricalMarketCalendarSnapshot(
  value: Readonly<HistoricalMarketCalendarSnapshot>
) {
  const blockers: string[] = [];
  if (await canonicalHash(calendarCore(value)) !== value.calendarId) {
    blockers.push("historical_market_calendar_identity_mismatch");
  }
  if (value.verificationStatus !== "verified") blockers.push("historical_market_calendar_unverified");
  return Object.freeze(unique(blockers));
}

export async function buildHistoricalTimeframeAlignmentPolicy(input: Omit<
  HistoricalTimeframeAlignmentPolicy,
  "schemaVersion" | "policyId" | "mode" | "supportedDerivedTimeframes"
> & {
  readonly supportedDerivedTimeframes?: readonly HistoricalTimeframe[];
}): Promise<Readonly<HistoricalTimeframeAlignmentPolicy>> {
  if (!Number.isInteger(input.anchorOffsetMinutes)) {
    throw new Error("Historical timeframe alignment anchor must be an integer minute offset.");
  }
  const requested = input.supportedDerivedTimeframes ?? DERIVABLE_WITH_FIXED_UTC;
  const unsupported = requested.filter((timeframe) => !DERIVABLE_WITH_FIXED_UTC.includes(timeframe));
  if (unsupported.length) {
    throw new Error(`Fixed UTC alignment cannot qualify derived ${unsupported.join(", ")}; use native source bars.`);
  }
  const core = Object.freeze({
    schemaVersion:
      HISTORICAL_TIMEFRAME_ALIGNMENT_SCHEMA_VERSION as typeof HISTORICAL_TIMEFRAME_ALIGNMENT_SCHEMA_VERSION,
    version: required(input.version, "alignment.version"),
    mode: "fixed_utc_anchor" as const,
    anchorOffsetMinutes: input.anchorOffsetMinutes,
    weekStartsOn: input.weekStartsOn,
    calendarId: fingerprint(input.calendarId, "alignment.calendarId"),
    evidencePackageId: fingerprint(input.evidencePackageId, "alignment.evidencePackageId"),
    verificationVersion: required(input.verificationVersion, "alignment.verificationVersion"),
    supportedDerivedTimeframes: Object.freeze([...new Set(requested)].sort()),
    verificationStatus: input.verificationStatus
  });
  return Object.freeze({ ...core, policyId: await canonicalHash(core) });
}

export async function validateHistoricalTimeframeAlignmentPolicy(
  value: Readonly<HistoricalTimeframeAlignmentPolicy>,
  derivedTimeframes: readonly HistoricalTimeframe[]
) {
  const blockers: string[] = [];
  if (await canonicalHash(alignmentCore(value)) !== value.policyId) {
    blockers.push("historical_timeframe_alignment_identity_mismatch");
  }
  if (value.verificationStatus !== "verified") blockers.push("historical_timeframe_alignment_unverified");
  for (const timeframe of derivedTimeframes) {
    if (!value.supportedDerivedTimeframes.includes(timeframe)) {
      blockers.push(`historical_${timeframe}_alignment_not_qualified`);
    }
  }
  return Object.freeze(unique(blockers));
}

export async function buildHistoricalDatasetCapacityPlan(input: {
  readonly sourceTimeframes: readonly HistoricalTimeframe[];
  readonly pilotStartUtc: string;
  readonly pilotEndUtc: string;
  readonly targetStartUtc: string;
  readonly targetEndUtc: string;
  readonly observedSourceBars: number;
  readonly observedPartitionCount: number;
  readonly observedStorageBytes: number;
  readonly observedPeakMemoryBytes: number;
  readonly maximumSourceBars: number;
  readonly maximumPartitionCount: number;
  readonly maximumStorageBytes: number;
  readonly maximumPeakMemoryBytes: number;
  readonly safetyMultiplier?: number;
}): Promise<Readonly<HistoricalDatasetCapacityPlan>> {
  const sourceTimeframes = Object.freeze(unique(input.sourceTimeframes) as readonly HistoricalTimeframe[]);
  if (!sourceTimeframes.length) throw new Error("Historical capacity requires at least one source timeframe.");
  if (sourceTimeframes.some((timeframe) => !HISTORICAL_TIMEFRAMES.includes(timeframe))) {
    throw new Error("Historical capacity contains an unsupported source timeframe.");
  }
  const pilotStartUtc = iso(input.pilotStartUtc, "capacity.pilotStartUtc");
  const pilotEndUtc = iso(input.pilotEndUtc, "capacity.pilotEndUtc");
  const targetStartUtc = iso(input.targetStartUtc, "capacity.targetStartUtc");
  const targetEndUtc = iso(input.targetEndUtc, "capacity.targetEndUtc");
  const pilotDuration = Date.parse(pilotEndUtc) - Date.parse(pilotStartUtc);
  const targetDuration = Date.parse(targetEndUtc) - Date.parse(targetStartUtc);
  if (pilotDuration <= 0 || targetDuration <= 0) throw new Error("Historical capacity ranges must have positive duration.");
  const values = {
    observedSourceBars: input.observedSourceBars,
    observedPartitionCount: input.observedPartitionCount,
    observedStorageBytes: input.observedStorageBytes,
    observedPeakMemoryBytes: input.observedPeakMemoryBytes,
    maximumSourceBars: input.maximumSourceBars,
    maximumPartitionCount: input.maximumPartitionCount,
    maximumStorageBytes: input.maximumStorageBytes,
    maximumPeakMemoryBytes: input.maximumPeakMemoryBytes
  };
  for (const [name, value] of Object.entries(values)) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`Historical capacity ${name} must be a positive integer.`);
  }
  const safetyMultiplier = input.safetyMultiplier ?? 1.25;
  if (!Number.isFinite(safetyMultiplier) || safetyMultiplier < 1) {
    throw new Error("Historical capacity safetyMultiplier must be at least one.");
  }
  const scale = targetDuration / pilotDuration * safetyMultiplier;
  const projectedSourceBars = Math.ceil(input.observedSourceBars * scale);
  const projectedPartitionCount = Math.ceil(input.observedPartitionCount * scale);
  const projectedStorageBytes = Math.ceil(input.observedStorageBytes * scale);
  const projectedPeakMemoryBytes = Math.ceil(input.observedPeakMemoryBytes * scale);
  const blockers = unique([
    projectedSourceBars > input.maximumSourceBars ? "historical_capacity_source_bar_bound_exceeded" : "",
    projectedPartitionCount > input.maximumPartitionCount ? "historical_capacity_partition_bound_exceeded" : "",
    projectedStorageBytes > input.maximumStorageBytes ? "historical_capacity_storage_bound_exceeded" : "",
    projectedPeakMemoryBytes > input.maximumPeakMemoryBytes ? "historical_capacity_memory_bound_exceeded" : ""
  ]);
  const core = Object.freeze({
    schemaVersion: HISTORICAL_CAPACITY_PLAN_SCHEMA_VERSION as typeof HISTORICAL_CAPACITY_PLAN_SCHEMA_VERSION,
    sourceTimeframes,
    pilotStartUtc,
    pilotEndUtc,
    targetStartUtc,
    targetEndUtc,
    observedSourceBars: input.observedSourceBars,
    observedPartitionCount: input.observedPartitionCount,
    observedStorageBytes: input.observedStorageBytes,
    observedPeakMemoryBytes: input.observedPeakMemoryBytes,
    projectedSourceBars,
    projectedPartitionCount,
    projectedStorageBytes,
    projectedPeakMemoryBytes,
    maximumSourceBars: input.maximumSourceBars,
    maximumPartitionCount: input.maximumPartitionCount,
    maximumStorageBytes: input.maximumStorageBytes,
    maximumPeakMemoryBytes: input.maximumPeakMemoryBytes,
    status: blockers.length ? "blocked" as const : "within_bounds" as const,
    blockers,
    warnings: Object.freeze([]),
    authority: HISTORICAL_DATASET_AUTHORITY_NONE
  });
  return Object.freeze({ ...core, capacityPlanId: await canonicalHash(core) });
}
