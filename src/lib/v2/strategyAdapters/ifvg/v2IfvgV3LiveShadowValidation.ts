import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import {
  V2_IFVG_V3_LIVE_SHADOW_FILE_SCHEMA,
  V2_IFVG_V3_LIVE_SHADOW_FILE_VERSION,
  V2_IFVG_V3_LIVE_SHADOW_LEDGER_SCHEMA,
  V2_IFVG_V3_LIVE_SHADOW_LEDGER_VERSION,
  V2_IFVG_V3_LIVE_SHADOW_MAX_OBSERVATIONS,
  V2_IFVG_V3_LIVE_SHADOW_SCHEMA,
  V2_IFVG_V3_LIVE_SHADOW_VERSION,
  type V2IfvgV3LiveShadowLedger,
  type V2IfvgV3LiveShadowLedgerFile,
  type V2IfvgV3LiveShadowObservation,
  type V2IfvgV3LiveShadowValidationResult
} from "./v2IfvgV3LiveShadowTypes";

const forbiddenKey = /^(?:candles|rawCandles|rawRuntimeSnapshot|rawSnapshot|accountData|orderData|positionData|password|secret|apiKey|token|mt5Credentials|base64)$/i;
const sha256 = (value: unknown) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
const validIso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const nonNegativeInteger = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;
const unique = (values: readonly string[]) => Object.freeze([...new Set(values)]);

const forbiddenPaths = (value: unknown, path = "state", found: string[] = []): string[] => {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => forbiddenPaths(item, `${path}[${index}]`, found));
    return found;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    const next = `${path}.${key}`;
    if (forbiddenKey.test(key)) found.push(next);
    forbiddenPaths(nested, next, found);
  });
  return found;
};

const validateObservation = (
  input: unknown,
  index: number,
  ledger: Partial<V2IfvgV3LiveShadowLedger>,
  blockers: string[]
): Readonly<V2IfvgV3LiveShadowObservation> | undefined => {
  const prefix = `live_shadow_observation_${index}`;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blockers.push(`${prefix}_invalid`);
    return undefined;
  }
  const observation = input as Partial<V2IfvgV3LiveShadowObservation>;
  if (observation.schemaId !== V2_IFVG_V3_LIVE_SHADOW_SCHEMA) blockers.push(`${prefix}_schema_invalid`);
  if (observation.version !== V2_IFVG_V3_LIVE_SHADOW_VERSION) blockers.push(`${prefix}_version_invalid`);
  if (!sha256(observation.observationId)) blockers.push(`${prefix}_id_invalid`);
  if (!validIso(observation.collectedAtUtc)) blockers.push(`${prefix}_collected_at_invalid`);
  if (!observation.source || typeof observation.source !== "object") blockers.push(`${prefix}_source_missing`);
  if (observation.source?.provider !== "mt5_read_only") blockers.push(`${prefix}_provider_invalid`);
  if (observation.source?.requestedSymbol !== ledger.requestedSymbol) blockers.push(`${prefix}_requested_symbol_mismatch`);
  if (observation.source?.brokerSymbol !== ledger.brokerSymbol) blockers.push(`${prefix}_broker_symbol_mismatch`);
  if (observation.source?.timeframe !== ledger.timeframe) blockers.push(`${prefix}_timeframe_mismatch`);
  if (!sha256(observation.source?.distinctClosedWindowKey)) blockers.push(`${prefix}_window_key_invalid`);
  if (!validIso(observation.source?.windowReferenceTime)) blockers.push(`${prefix}_window_reference_invalid`);
  if (observation.status !== "blocked_context" && !validIso(observation.source?.lastClosedCandleTime)) {
    blockers.push(`${prefix}_last_closed_invalid`);
  }
  if (!["exact_parity", "regression", "insufficient_comparison_data", "blocked_context"].includes(String(observation.status))) {
    blockers.push(`${prefix}_status_invalid`);
  }
  if (observation.status === "blocked_context" && observation.parity !== undefined) blockers.push(`${prefix}_blocked_parity_invalid`);
  if (observation.status !== "blocked_context" && !observation.parity) blockers.push(`${prefix}_parity_missing`);
  if (
    observation.statisticallyIndependentWindowClaimed !== false ||
    observation.fullCandidateSetOrderingParityAchieved !== false ||
    observation.fullStrategyParityClaimed !== false ||
    observation.canCreateValidationChainEntry !== false ||
    observation.productionAdoptionAllowed !== false ||
    observation.researchOnly !== true ||
    observation.shadowOnly !== true
  ) blockers.push(`${prefix}_shadow_boundary_invalid`);
  try {
    assertV2Authority(observation.authority);
  } catch {
    blockers.push(`${prefix}_authority_invalid`);
  }
  return Object.freeze({ ...(observation as V2IfvgV3LiveShadowObservation), authority: V2_AUTHORITY_NONE });
};

export function validateV2IfvgV3LiveShadowLedger(
  input: unknown
): Readonly<V2IfvgV3LiveShadowValidationResult> {
  const blockers: string[] = [];
  forbiddenPaths(input).forEach((path) => blockers.push(`live_shadow_forbidden_field:${path}`));
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({ status: "blocked", blockers: Object.freeze(["live_shadow_ledger_missing"]) });
  }
  const ledger = input as Partial<V2IfvgV3LiveShadowLedger>;
  if (ledger.schemaId !== V2_IFVG_V3_LIVE_SHADOW_LEDGER_SCHEMA) blockers.push("live_shadow_ledger_schema_invalid");
  if (ledger.version !== V2_IFVG_V3_LIVE_SHADOW_LEDGER_VERSION) blockers.push("live_shadow_ledger_version_invalid");
  if (ledger.policyVersion !== V2_IFVG_V3_LIVE_SHADOW_VERSION) blockers.push("live_shadow_policy_version_invalid");
  if (!ledger.requestedSymbol?.trim()) blockers.push("live_shadow_requested_symbol_missing");
  if (!ledger.brokerSymbol?.trim()) blockers.push("live_shadow_broker_symbol_missing");
  if (!ledger.timeframe?.trim()) blockers.push("live_shadow_timeframe_missing");
  if (!Array.isArray(ledger.observations) || ledger.observations.length > V2_IFVG_V3_LIVE_SHADOW_MAX_OBSERVATIONS) {
    blockers.push("live_shadow_observations_invalid");
  }
  [
    ledger.processedObservationCount,
    ledger.compactedObservationCount,
    ledger.exactParityCount,
    ledger.regressionCount,
    ledger.insufficientComparisonCount,
    ledger.blockedContextCount,
    ledger.distinctClosedWindowCount,
    ledger.distinctMarketDateCount
  ].forEach((value, index) => {
    if (!nonNegativeInteger(value)) blockers.push(`live_shadow_count_${index}_invalid`);
  });
  if (ledger.productionAdoptionAllowed !== false || ledger.shadowOnly !== true) {
    blockers.push("live_shadow_ledger_boundary_invalid");
  }
  try {
    assertV2Authority(ledger.authority);
  } catch {
    blockers.push("live_shadow_ledger_authority_invalid");
  }
  const observations = Object.freeze((Array.isArray(ledger.observations) ? ledger.observations : [])
    .map((item, index) => validateObservation(item, index, ledger, blockers))
    .filter((item): item is Readonly<V2IfvgV3LiveShadowObservation> => Boolean(item)));
  if (new Set(observations.map((item) => item.source.distinctClosedWindowKey)).size !== observations.length) {
    blockers.push("live_shadow_duplicate_closed_window");
  }
  const expected = {
    exactParityCount: observations.filter((item) => item.status === "exact_parity").length,
    regressionCount: observations.filter((item) => item.status === "regression").length,
    insufficientComparisonCount: observations.filter((item) => item.status === "insufficient_comparison_data").length,
    blockedContextCount: observations.filter((item) => item.status === "blocked_context").length,
    distinctClosedWindowCount: new Set(observations.map((item) => item.source.distinctClosedWindowKey)).size,
    distinctMarketDateCount: new Set(observations.map((item) => item.source.marketDateNewYork)).size
  };
  Object.entries(expected).forEach(([key, value]) => {
    if (ledger[key as keyof typeof expected] !== value) blockers.push(`live_shadow_${key}_mismatch`);
  });
  const accepted = blockers.length === 0;
  const normalized = accepted ? Object.freeze({
    ...(ledger as V2IfvgV3LiveShadowLedger),
    observations,
    productionAdoptionAllowed: false as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  }) : undefined;
  return Object.freeze({
    status: accepted ? "accepted" : "blocked",
    ...(normalized ? { ledger: normalized } : {}),
    blockers: unique(blockers)
  });
}

export async function buildV2IfvgV3LiveShadowLedgerFile({
  ledger,
  savedAtUtc
}: {
  ledger: Readonly<V2IfvgV3LiveShadowLedger>;
  savedAtUtc: string;
}): Promise<Readonly<V2IfvgV3LiveShadowLedgerFile>> {
  const validation = validateV2IfvgV3LiveShadowLedger(ledger);
  if (validation.status !== "accepted" || !validation.ledger) {
    throw new Error(`Cannot persist invalid IFVG live shadow ledger: ${validation.blockers.join(", ")}`);
  }
  if (!validIso(savedAtUtc)) throw new Error("IFVG live shadow savedAtUtc is invalid.");
  return Object.freeze({
    schemaId: V2_IFVG_V3_LIVE_SHADOW_FILE_SCHEMA,
    version: V2_IFVG_V3_LIVE_SHADOW_FILE_VERSION,
    savedAtUtc: new Date(savedAtUtc).toISOString(),
    ledgerHash: await canonicalHash(validation.ledger),
    ledger: validation.ledger
  });
}

export async function validateV2IfvgV3LiveShadowLedgerFile(
  input: unknown
): Promise<Readonly<V2IfvgV3LiveShadowValidationResult>> {
  const blockers: string[] = [];
  forbiddenPaths(input).forEach((path) => blockers.push(`live_shadow_file_forbidden_field:${path}`));
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({ status: "blocked", blockers: Object.freeze(["live_shadow_file_missing"]) });
  }
  const file = input as Partial<V2IfvgV3LiveShadowLedgerFile>;
  if (file.schemaId !== V2_IFVG_V3_LIVE_SHADOW_FILE_SCHEMA) blockers.push("live_shadow_file_schema_invalid");
  if (file.version !== V2_IFVG_V3_LIVE_SHADOW_FILE_VERSION) blockers.push("live_shadow_file_version_invalid");
  if (!validIso(file.savedAtUtc)) blockers.push("live_shadow_file_saved_at_invalid");
  if (!sha256(file.ledgerHash)) blockers.push("live_shadow_file_hash_invalid");
  const ledgerValidation = validateV2IfvgV3LiveShadowLedger(file.ledger);
  blockers.push(...ledgerValidation.blockers);
  if (ledgerValidation.ledger && sha256(file.ledgerHash)) {
    const expectedHash = await canonicalHash(ledgerValidation.ledger);
    if (expectedHash !== file.ledgerHash) blockers.push("live_shadow_file_checksum_mismatch");
  }
  const accepted = blockers.length === 0 && Boolean(ledgerValidation.ledger);
  const normalizedFile = accepted ? Object.freeze({
    schemaId: V2_IFVG_V3_LIVE_SHADOW_FILE_SCHEMA,
    version: V2_IFVG_V3_LIVE_SHADOW_FILE_VERSION,
    savedAtUtc: new Date(String(file.savedAtUtc)).toISOString(),
    ledgerHash: String(file.ledgerHash),
    ledger: ledgerValidation.ledger as Readonly<V2IfvgV3LiveShadowLedger>
  }) : undefined;
  return Object.freeze({
    status: accepted ? "accepted" : "blocked",
    ...(ledgerValidation.ledger ? { ledger: ledgerValidation.ledger } : {}),
    ...(normalizedFile ? { file: normalizedFile } : {}),
    blockers: unique(blockers)
  });
}
