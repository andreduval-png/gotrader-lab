import { assertV2Authority, V2_AUTHORITY_NONE } from "../authority/v2Authority";
import { canonicalHash } from "../serialization/canonicalSerialization";
import {
  V2_MT5_OFFSET_REGIME_DEFAULT_MAX_GAP_MS,
  V2_MT5_OFFSET_REGIME_FILE_SCHEMA,
  V2_MT5_OFFSET_REGIME_FILE_VERSION,
  V2_MT5_OFFSET_REGIME_LEDGER_SCHEMA,
  V2_MT5_OFFSET_REGIME_LEDGER_VERSION,
  V2_MT5_OFFSET_REGIME_MAX_SUMMARIES,
  V2_MT5_OFFSET_REGIME_POLICY_VERSION,
  type V2Mt5OffsetRegimeFileValidationResult,
  type V2Mt5OffsetRegimeLedger,
  type V2Mt5OffsetRegimeLedgerFile,
  type V2Mt5OffsetRegimeSummary,
  type V2Mt5OffsetRegimeTerminationReason,
  type V2Mt5OffsetRegimeValidationResult
} from "./v2Mt5OffsetRegimeTypes";

const terminationReasons = new Set<V2Mt5OffsetRegimeTerminationReason>([
  "observation_gap",
  "terminal_instance_changed",
  "terminal_build_changed",
  "provider_basis_changed",
  "provider_offset_changed",
  "stale_quote",
  "terminal_evidence_conflict",
  "observation_rejected"
]);
const providerBases = new Set(["epoch_utc", "mt5_server_wall_clock"]);
const sensitiveKey = /(?:account|balance|equity|margin|position|order|deal|credential|password|secret|token|apiKey|login)/i;
const unique = (values: readonly string[]) => Object.freeze([...new Set(values)]);
const validIso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const nonNegativeInteger = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;
const positiveInteger = (value: unknown) => Number.isInteger(value) && Number(value) > 0;
const sha256 = (value: unknown) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);

const sensitivePaths = (value: unknown, path = "state", found: string[] = []): string[] => {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => sensitivePaths(item, `${path}[${index}]`, found));
    return found;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    const next = `${path}.${key}`;
    if (sensitiveKey.test(key)) found.push(next);
    sensitivePaths(nested, next, found);
  });
  return found;
};

const textArray = (value: unknown, blocker: string, blockers: string[]) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    blockers.push(blocker);
    return Object.freeze([] as string[]);
  }
  return unique(value as string[]);
};

const validateRegime = (
  input: unknown,
  brokerSymbol: string,
  index: number,
  blockers: string[]
): Readonly<V2Mt5OffsetRegimeSummary> | undefined => {
  const prefix = `offset_regime_${index}`;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blockers.push(`${prefix}_invalid`);
    return undefined;
  }
  const regime = input as Partial<V2Mt5OffsetRegimeSummary>;
  if (typeof regime.regimeId !== "string" || !/^v2-mt5-offset-regime:[a-f0-9]{64}$/i.test(regime.regimeId)) blockers.push(`${prefix}_id_invalid`);
  if (!new Set(["active", "terminated"]).has(String(regime.status))) blockers.push(`${prefix}_status_invalid`);
  if (regime.brokerSymbol !== brokerSymbol) blockers.push(`${prefix}_broker_symbol_mismatch`);
  if (typeof regime.probeInstanceId !== "string" || !/^[a-f0-9]{8}$/i.test(regime.probeInstanceId)) blockers.push(`${prefix}_probe_instance_invalid`);
  if (!providerBases.has(String(regime.providerTimeBasis))) blockers.push(`${prefix}_provider_basis_invalid`);
  if (!Number.isInteger(regime.observedOffsetMinutes) || Math.abs(Number(regime.observedOffsetMinutes)) > 840) blockers.push(`${prefix}_offset_invalid`);
  if (regime.terminalBuild !== undefined && !positiveInteger(regime.terminalBuild)) blockers.push(`${prefix}_terminal_build_invalid`);
  if (!validIso(regime.startedAtUtc)) blockers.push(`${prefix}_start_invalid`);
  if (!validIso(regime.lastObservedAtUtc)) blockers.push(`${prefix}_last_observed_invalid`);
  if (validIso(regime.startedAtUtc) && validIso(regime.lastObservedAtUtc) && Date.parse(String(regime.startedAtUtc)) > Date.parse(String(regime.lastObservedAtUtc))) blockers.push(`${prefix}_time_order_invalid`);
  if (!positiveInteger(regime.observationCount)) blockers.push(`${prefix}_observation_count_invalid`);
  if (typeof regime.firstObservationId !== "string" || !regime.firstObservationId.trim()) blockers.push(`${prefix}_first_observation_id_missing`);
  if (typeof regime.lastObservationId !== "string" || !regime.lastObservationId.trim()) blockers.push(`${prefix}_last_observation_id_missing`);
  if (!sha256(regime.continuityHash)) blockers.push(`${prefix}_continuity_hash_invalid`);
  if (regime.status === "active" && (regime.terminatedAtUtc !== undefined || regime.terminationReason !== undefined)) blockers.push(`${prefix}_active_termination_invalid`);
  if (regime.status === "terminated") {
    if (!validIso(regime.terminatedAtUtc)) blockers.push(`${prefix}_termination_time_invalid`);
    if (!terminationReasons.has(regime.terminationReason as V2Mt5OffsetRegimeTerminationReason)) blockers.push(`${prefix}_termination_reason_invalid`);
  }
  return Object.freeze({ ...(regime as V2Mt5OffsetRegimeSummary) });
};

export function validateV2Mt5OffsetRegimeLedger(input: unknown): Readonly<V2Mt5OffsetRegimeValidationResult> {
  const blockers: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({ status: "blocked", blockers: Object.freeze(["offset_regime_ledger_missing"]) });
  }
  sensitivePaths(input).forEach((path) => blockers.push(`offset_regime_sensitive_field_forbidden:${path}`));
  const ledger = input as Partial<V2Mt5OffsetRegimeLedger>;
  if (ledger.schemaId !== V2_MT5_OFFSET_REGIME_LEDGER_SCHEMA) blockers.push("offset_regime_ledger_schema_invalid");
  if (ledger.version !== V2_MT5_OFFSET_REGIME_LEDGER_VERSION) blockers.push("offset_regime_ledger_version_invalid");
  if (ledger.policyVersion !== V2_MT5_OFFSET_REGIME_POLICY_VERSION) blockers.push("offset_regime_policy_version_invalid");
  if (typeof ledger.brokerSymbol !== "string" || !ledger.brokerSymbol.trim()) blockers.push("offset_regime_broker_symbol_missing");
  if (!Number.isFinite(ledger.maximumGapMs) || Number(ledger.maximumGapMs) < 30_000 || Number(ledger.maximumGapMs) > V2_MT5_OFFSET_REGIME_DEFAULT_MAX_GAP_MS) blockers.push("offset_regime_maximum_gap_invalid");
  if (!Array.isArray(ledger.regimes) || ledger.regimes.length > V2_MT5_OFFSET_REGIME_MAX_SUMMARIES) blockers.push("offset_regime_summaries_invalid");
  if (!nonNegativeInteger(ledger.processedObservationCount)) blockers.push("offset_regime_processed_count_invalid");
  if (!nonNegativeInteger(ledger.compactedRegimeCount)) blockers.push("offset_regime_compacted_count_invalid");
  if (ledger.shadowOnly !== true) blockers.push("offset_regime_shadow_boundary_invalid");
  try {
    assertV2Authority(ledger.authority);
  } catch {
    blockers.push("offset_regime_authority_invalid");
  }
  const warnings = textArray(ledger.warnings, "offset_regime_warnings_invalid", blockers);
  const ledgerBlockers = textArray(ledger.blockers, "offset_regime_blockers_invalid", blockers);
  const regimes = Object.freeze((Array.isArray(ledger.regimes) ? ledger.regimes : [])
    .map((regime, index) => validateRegime(regime, String(ledger.brokerSymbol ?? ""), index, blockers))
    .filter((regime): regime is Readonly<V2Mt5OffsetRegimeSummary> => Boolean(regime)));
  const active = regimes.filter((regime) => regime.status === "active");
  if (active.length > 1) blockers.push("offset_regime_multiple_active");
  if (ledger.activeRegimeId === undefined && active.length) blockers.push("offset_regime_active_id_missing");
  if (ledger.activeRegimeId !== undefined && !active.some((regime) => regime.regimeId === ledger.activeRegimeId)) blockers.push("offset_regime_active_id_mismatch");
  const accepted = blockers.length === 0;
  const normalized = accepted ? Object.freeze({
    schemaId: V2_MT5_OFFSET_REGIME_LEDGER_SCHEMA,
    version: V2_MT5_OFFSET_REGIME_LEDGER_VERSION,
    policyVersion: V2_MT5_OFFSET_REGIME_POLICY_VERSION,
    brokerSymbol: String(ledger.brokerSymbol),
    maximumGapMs: Number(ledger.maximumGapMs),
    regimes,
    ...(ledger.activeRegimeId ? { activeRegimeId: ledger.activeRegimeId } : {}),
    processedObservationCount: Number(ledger.processedObservationCount),
    compactedRegimeCount: Number(ledger.compactedRegimeCount),
    warnings,
    blockers: ledgerBlockers,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  }) : undefined;
  return Object.freeze({
    status: accepted ? "accepted" : "blocked",
    ...(normalized ? { ledger: normalized } : {}),
    blockers: unique(blockers)
  });
}

export async function buildV2Mt5OffsetRegimeLedgerFile({
  ledger,
  savedAtUtc
}: {
  ledger: Readonly<V2Mt5OffsetRegimeLedger>;
  savedAtUtc: string;
}): Promise<Readonly<V2Mt5OffsetRegimeLedgerFile>> {
  const validation = validateV2Mt5OffsetRegimeLedger(ledger);
  if (validation.status !== "accepted" || !validation.ledger) {
    throw new Error(`Cannot persist invalid MT5 offset-regime ledger: ${validation.blockers.join(", ")}`);
  }
  if (!validIso(savedAtUtc)) throw new Error("MT5 offset-regime savedAtUtc is invalid.");
  return Object.freeze({
    schemaId: V2_MT5_OFFSET_REGIME_FILE_SCHEMA,
    version: V2_MT5_OFFSET_REGIME_FILE_VERSION,
    savedAtUtc: new Date(savedAtUtc).toISOString(),
    ledgerHash: await canonicalHash(validation.ledger),
    ledger: validation.ledger
  });
}

export async function validateV2Mt5OffsetRegimeLedgerFile(
  input: unknown
): Promise<Readonly<V2Mt5OffsetRegimeFileValidationResult>> {
  const blockers: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({ status: "blocked", blockers: Object.freeze(["offset_regime_file_missing"]) });
  }
  sensitivePaths(input).forEach((path) => blockers.push(`offset_regime_file_sensitive_field_forbidden:${path}`));
  const file = input as Partial<V2Mt5OffsetRegimeLedgerFile>;
  if (file.schemaId !== V2_MT5_OFFSET_REGIME_FILE_SCHEMA) blockers.push("offset_regime_file_schema_invalid");
  if (file.version !== V2_MT5_OFFSET_REGIME_FILE_VERSION) blockers.push("offset_regime_file_version_invalid");
  if (!validIso(file.savedAtUtc)) blockers.push("offset_regime_file_saved_at_invalid");
  if (!sha256(file.ledgerHash)) blockers.push("offset_regime_file_hash_invalid");
  const ledgerValidation = validateV2Mt5OffsetRegimeLedger(file.ledger);
  blockers.push(...ledgerValidation.blockers);
  if (ledgerValidation.ledger && sha256(file.ledgerHash)) {
    const expectedHash = await canonicalHash(ledgerValidation.ledger);
    if (expectedHash !== file.ledgerHash) blockers.push("offset_regime_file_checksum_mismatch");
  }
  const accepted = blockers.length === 0 && Boolean(ledgerValidation.ledger);
  const normalizedFile = accepted ? Object.freeze({
    schemaId: V2_MT5_OFFSET_REGIME_FILE_SCHEMA,
    version: V2_MT5_OFFSET_REGIME_FILE_VERSION,
    savedAtUtc: new Date(String(file.savedAtUtc)).toISOString(),
    ledgerHash: String(file.ledgerHash),
    ledger: ledgerValidation.ledger as Readonly<V2Mt5OffsetRegimeLedger>
  }) : undefined;
  return Object.freeze({
    status: accepted ? "accepted" : "blocked",
    ...(ledgerValidation.ledger ? { ledger: ledgerValidation.ledger } : {}),
    ...(normalizedFile ? { file: normalizedFile } : {}),
    blockers: unique(blockers)
  });
}
