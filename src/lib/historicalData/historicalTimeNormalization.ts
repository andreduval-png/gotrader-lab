export type HistoricalProviderTimeBasis =
  | "utc_iso"
  | "epoch_utc"
  | "iso_with_offset"
  | "mt5_server_wall_clock"
  | "unknown";

export type HistoricalTimeDiscoveryMethod =
  | "explicit_payload_offset"
  | "configured_iana_timezone"
  | "server_clock_comparison"
  | "explicit_utc_contract"
  | "verified_upstream_contract"
  | "unknown";

export type HistoricalDstPolicy =
  | "iana_timezone_rules"
  | "explicit_offset"
  | "not_applicable"
  | "unknown";

export interface HistoricalTimeNormalizationPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly provider: string;
  readonly basis: HistoricalProviderTimeBasis;
  readonly sourceTimezone?: string;
  readonly sourceUtcOffsetMinutes?: number;
  readonly outputTimezone: "UTC";
  readonly discoveryMethod: HistoricalTimeDiscoveryMethod;
  readonly dstPolicy: HistoricalDstPolicy;
  readonly maximumClockSkewMs: number;
  readonly closureToleranceMs: number;
}

export type HistoricalTimeDiagnosticCode =
  | "invalid_provider_time"
  | "unknown_provider_time_basis"
  | "missing_source_timezone"
  | "invalid_source_timezone"
  | "ambiguous_local_time"
  | "nonexistent_local_time"
  | "invalid_time_policy";

export interface HistoricalNormalizedProviderTime {
  readonly status: "normalized" | "blocked";
  readonly rawProviderTime: string | number;
  readonly normalizedTimeUtc?: string;
  readonly providerTimeBasis: HistoricalProviderTimeBasis;
  readonly timeNormalizationPolicyId: string;
  readonly timeNormalizationPolicyVersion: string;
  readonly sourceTimezone?: string;
  readonly offsetAppliedMinutes?: number;
  readonly rawToUtcDeltaMs?: number;
  readonly dstState: "standard" | "daylight" | "fixed_offset" | "not_applicable" | "unknown";
  readonly warnings: readonly string[];
  readonly blockers: readonly HistoricalTimeDiagnosticCode[];
}

const EXPLICIT_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const EXPLICIT_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z)?$/;

interface WallClockParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

const freezeStrings = <T extends string>(values: readonly T[]) => Object.freeze([...values]);

const validExplicitInstant = (value: string, pattern: RegExp) => {
  if (!pattern.test(value)) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const epochMilliseconds = (value: number) => {
  if (!Number.isFinite(value)) return undefined;
  const milliseconds = Math.abs(value) < 10_000_000_000 ? value * 1_000 : value;
  return Number.isFinite(new Date(milliseconds).getTime()) ? milliseconds : undefined;
};

const wallClockPartsFrom = (value: string | number): WallClockParts | undefined => {
  if (typeof value === "number") {
    const milliseconds = epochMilliseconds(value);
    if (milliseconds === undefined) return undefined;
    const date = new Date(milliseconds);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      millisecond: date.getUTCMilliseconds()
    };
  }
  const match = WALL_CLOCK.exec(value);
  if (!match) return undefined;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
    millisecond: Number((match[7] ?? "0").padEnd(3, "0"))
  };
  const check = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  ));
  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() + 1 !== parts.month ||
    check.getUTCDate() !== parts.day ||
    check.getUTCHours() !== parts.hour ||
    check.getUTCMinutes() !== parts.minute ||
    check.getUTCSeconds() !== parts.second
  ) return undefined;
  return parts;
};

const naiveWallClockMilliseconds = (parts: WallClockParts) => Date.UTC(
  parts.year,
  parts.month - 1,
  parts.day,
  parts.hour,
  parts.minute,
  parts.second,
  parts.millisecond
);

const formatterFor = (timeZone: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

const zonedParts = (timestamp: number, timeZone: string): Omit<WallClockParts, "millisecond"> => {
  const values = Object.fromEntries(
    formatterFor(timeZone).formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second
  };
};

const sameWallClock = (left: WallClockParts, right: Omit<WallClockParts, "millisecond">) =>
  left.year === right.year &&
  left.month === right.month &&
  left.day === right.day &&
  left.hour === right.hour &&
  left.minute === right.minute &&
  left.second === right.second;

const ianaCandidates = (parts: WallClockParts, timeZone: string) => {
  const naive = naiveWallClockMilliseconds(parts);
  const matches: { timestamp: number; offsetMinutes: number }[] = [];
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const timestamp = naive - offsetMinutes * 60_000;
    if (sameWallClock(parts, zonedParts(timestamp, timeZone))) {
      matches.push({ timestamp, offsetMinutes });
    }
  }
  return matches;
};

const standardOffsetForYear = (year: number, timeZone: string) => {
  const offsets = [0, 1, 6, 7].map((month) => {
    const instant = Date.UTC(year, month, 15, 12, 0, 0);
    const parts = zonedParts(instant, timeZone);
    return Math.round((Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) - instant) / 60_000);
  });
  return Math.min(...offsets);
};

const blocked = (
  rawProviderTime: string | number,
  policy: HistoricalTimeNormalizationPolicy,
  blocker: HistoricalTimeDiagnosticCode
): Readonly<HistoricalNormalizedProviderTime> => Object.freeze({
  status: "blocked",
  rawProviderTime,
  providerTimeBasis: policy.basis,
  timeNormalizationPolicyId: policy.policyId,
  timeNormalizationPolicyVersion: policy.version,
  ...(policy.sourceTimezone ? { sourceTimezone: policy.sourceTimezone } : {}),
  dstState: "unknown",
  warnings: freezeStrings([]),
  blockers: freezeStrings([blocker])
});

export function createHistoricalTimeNormalizationPolicy(
  input: HistoricalTimeNormalizationPolicy
): Readonly<HistoricalTimeNormalizationPolicy> {
  const policy = { ...input };
  if (!String(policy.policyId ?? "").trim() || !String(policy.version ?? "").trim() || !String(policy.provider ?? "").trim()) {
    throw new Error("Historical time policy requires policyId, version, and provider.");
  }
  if (policy.outputTimezone !== "UTC") throw new Error("Historical normalized output timezone must be UTC.");
  if (!Number.isFinite(policy.maximumClockSkewMs) || policy.maximumClockSkewMs < 0) {
    throw new Error("Historical time policy requires a non-negative maximumClockSkewMs.");
  }
  if (!Number.isFinite(policy.closureToleranceMs) || policy.closureToleranceMs < 0) {
    throw new Error("Historical time policy requires a non-negative closureToleranceMs.");
  }
  if (policy.sourceUtcOffsetMinutes !== undefined && (
    !Number.isInteger(policy.sourceUtcOffsetMinutes) || Math.abs(policy.sourceUtcOffsetMinutes) > 14 * 60
  )) throw new Error("Historical sourceUtcOffsetMinutes must be an integer between -840 and 840.");
  if (policy.basis === "mt5_server_wall_clock") {
    if (policy.sourceTimezone && policy.sourceUtcOffsetMinutes !== undefined) {
      throw new Error("Historical wall-clock policy must use either an IANA timezone or a fixed offset.");
    }
    if (policy.sourceTimezone) {
      try {
        formatterFor(policy.sourceTimezone).format(new Date(0));
      } catch {
        throw new Error(`Invalid historical IANA source timezone: ${policy.sourceTimezone}`);
      }
    }
  }
  return Object.freeze(policy);
}

export function normalizeHistoricalProviderTime(
  input: string | number,
  policyInput: HistoricalTimeNormalizationPolicy
): Readonly<HistoricalNormalizedProviderTime> {
  let policy: Readonly<HistoricalTimeNormalizationPolicy>;
  try {
    policy = createHistoricalTimeNormalizationPolicy(policyInput);
  } catch {
    return blocked(input, policyInput, "invalid_time_policy");
  }
  if (policy.basis === "unknown") return blocked(input, policy, "unknown_provider_time_basis");

  let normalizedMs: number | undefined;
  let offsetAppliedMinutes: number | undefined;
  let rawWallClockMs: number | undefined;
  let dstState: HistoricalNormalizedProviderTime["dstState"] = "not_applicable";
  if (policy.basis === "epoch_utc") {
    normalizedMs = typeof input === "number" ? epochMilliseconds(input) : undefined;
  } else if (policy.basis === "utc_iso") {
    normalizedMs = typeof input === "string" ? validExplicitInstant(input, EXPLICIT_UTC) : undefined;
  } else if (policy.basis === "iso_with_offset") {
    normalizedMs = typeof input === "string" ? validExplicitInstant(input, EXPLICIT_OFFSET) : undefined;
  } else {
    const parts = wallClockPartsFrom(input);
    if (!parts) return blocked(input, policy, "invalid_provider_time");
    rawWallClockMs = naiveWallClockMilliseconds(parts);
    if (policy.sourceTimezone) {
      let candidates: { timestamp: number; offsetMinutes: number }[];
      try {
        candidates = ianaCandidates(parts, policy.sourceTimezone);
      } catch {
        return blocked(input, policy, "invalid_source_timezone");
      }
      if (candidates.length === 0) return blocked(input, policy, "nonexistent_local_time");
      if (candidates.length > 1) return blocked(input, policy, "ambiguous_local_time");
      normalizedMs = candidates[0].timestamp;
      offsetAppliedMinutes = candidates[0].offsetMinutes;
      dstState = offsetAppliedMinutes === standardOffsetForYear(parts.year, policy.sourceTimezone)
        ? "standard"
        : "daylight";
    } else if (policy.sourceUtcOffsetMinutes !== undefined) {
      offsetAppliedMinutes = policy.sourceUtcOffsetMinutes;
      normalizedMs = rawWallClockMs - offsetAppliedMinutes * 60_000;
      dstState = "fixed_offset";
    } else {
      return blocked(input, policy, "missing_source_timezone");
    }
  }
  if (normalizedMs === undefined || !Number.isFinite(normalizedMs)) {
    return blocked(input, policy, "invalid_provider_time");
  }
  return Object.freeze({
    status: "normalized",
    rawProviderTime: input,
    normalizedTimeUtc: new Date(normalizedMs).toISOString(),
    providerTimeBasis: policy.basis,
    timeNormalizationPolicyId: policy.policyId,
    timeNormalizationPolicyVersion: policy.version,
    ...(policy.sourceTimezone ? { sourceTimezone: policy.sourceTimezone } : {}),
    ...(offsetAppliedMinutes === undefined ? {} : { offsetAppliedMinutes }),
    rawToUtcDeltaMs: rawWallClockMs === undefined ? 0 : normalizedMs - rawWallClockMs,
    dstState,
    warnings: freezeStrings([]),
    blockers: freezeStrings([])
  });
}
