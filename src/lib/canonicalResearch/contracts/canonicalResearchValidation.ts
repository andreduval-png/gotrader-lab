import { canonicalSerialize } from "../../v2/serialization/canonicalSerialization";
import {
  CANONICAL_RESEARCH_AUTHORITY_NONE,
  CANONICAL_RESEARCH_CAPABILITIES_DISABLED,
  validateCanonicalResearchAuthority,
  validateCanonicalResearchCapabilities
} from "../authority/canonicalResearchAuthority";
import type {
  CanonicalResearchJobCheckpoint,
  CanonicalResearchJobRequest,
  CanonicalResearchSealValidationResult,
  CanonicalResearchValidationResult
} from "./canonicalResearchTypes";

const requestFields = new Set([
  "authority",
  "brokerSymbol",
  "capabilities",
  "contextArtifactId",
  "contextIdentity",
  "costModelId",
  "jobType",
  "jobVersion",
  "parameterHash",
  "primaryTimeframe",
  "profileId",
  "profileVersion",
  "requestedAt",
  "requestedSymbol",
  "requiredFacts",
  "requiredTimeframes",
  "schemaVersions",
  "shadowOnly",
  "sourceFingerprint",
  "strategyId",
  "timeContractId",
  "triggerCandleIdentity",
  "triggerEventId"
]);

const forbiddenKeyRules = [
  {
    keys: new Set([
      "rawcandles",
      "candles",
      "candlearray",
      "candlearrays",
      "candledata",
      "ohlcv",
      "ohlcvarray",
      "ohlcvarrays",
      "importedohlcv",
      "importedohlcvarrays"
    ]),
    blocker: "forbidden_raw_market_data"
  },
  {
    keys: new Set([
      "rawruntimesnapshot",
      "rawmt5snapshot",
      "rawsnapshot",
      "snapshot",
      "screenshot",
      "screenshots",
      "base64"
    ]),
    blocker: "forbidden_raw_runtime_snapshot"
  },
  {
    keys: new Set([
      "credential",
      "credentials",
      "apikey",
      "apikeys",
      "token",
      "tokens",
      "password",
      "passwords",
      "mt5credentials",
      "secret",
      "secrets"
    ]),
    blocker: "forbidden_secret_or_credential"
  },
  {
    keys: new Set(["account", "accounts", "accountdata", "balance", "balancedata"]),
    blocker: "forbidden_account_data"
  },
  {
    keys: new Set(["order", "orders", "orderdata", "pendingorders", "orderroute"]),
    blocker: "forbidden_order_data"
  },
  {
    keys: new Set(["position", "positions", "positiondata"]),
    blocker: "forbidden_position_data"
  },
  {
    keys: new Set([
      "executionrequest",
      "executionintent",
      "placeorder",
      "buymarket",
      "sellmarket",
      "closeposition",
      "modifyorder",
      "cancelorder",
      "brokermutation"
    ]),
    blocker: "forbidden_execution_request"
  },
  {
    keys: new Set([
      "readinessoverride",
      "approvereadiness"
    ]),
    blocker: "forbidden_readiness_override"
  },
  {
    keys: new Set([
      "autoapply",
      "autoapplyallowed",
      "applycalibration",
      "approvecalibrationproposal",
      "activecalibration"
    ]),
    blocker: "forbidden_auto_apply"
  }
] as const;

const hashPattern = /^sha256:[0-9a-f]{64}$/;
const contextArtifactPattern = /^v2-context:[0-9a-f]{64}$/;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:+/-]*$/;
const timeframePattern = /^(?:[1-9][0-9]*)(?:m|h|d|w)$/;
const dangerousCommandPattern =
  /\b(?:place order|buy market|sell market|close position|modify order|cancel order)\b/i;

const normalizeKey = (key: string) =>
  key.toLowerCase().replace(/[^a-z0-9]/g, "");

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isCanonicalIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

const isNonEmptyIdentifier = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 256 &&
  identifierPattern.test(value);

const isSortedUniqueStringSet = (value: unknown): value is readonly string[] => {
  if (!Array.isArray(value) || value.length === 0) return false;
  if (!value.every((item) => isNonEmptyIdentifier(item))) return false;
  const sorted = [...new Set(value)].sort((left, right) =>
    left.localeCompare(right)
  );
  return sorted.length === value.length &&
    sorted.every((item, index) => item === value[index]);
};

const collectForbiddenBlockers = (
  value: unknown,
  blockers: Set<string>,
  seen = new WeakSet<object>()
) => {
  if (typeof value === "string") {
    if (dangerousCommandPattern.test(value)) {
      blockers.add("forbidden_execution_request");
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) {
    blockers.add("non_canonical_request_payload");
    return;
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (const item of value) collectForbiddenBlockers(item, blockers, seen);
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      const normalizedKey = normalizeKey(key);
      for (const rule of forbiddenKeyRules) {
        if (rule.keys.has(normalizedKey)) blockers.add(rule.blocker);
      }
      collectForbiddenBlockers(nested, blockers, seen);
    }
  } finally {
    seen.delete(value);
  }
};

const validateSchemaVersions = (
  value: unknown,
  blockers: Set<string>
): value is Readonly<Record<string, string>> => {
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    blockers.add("invalid_schema_versions");
    return false;
  }
  if (
    !Object.entries(value).every(
      ([key, version]) =>
        isNonEmptyIdentifier(key) && isNonEmptyIdentifier(version)
    )
  ) {
    blockers.add("invalid_schema_versions");
    return false;
  }
  return true;
};

const validateRequestShape = (
  value: Record<string, unknown>,
  blockers: Set<string>
) => {
  for (const key of Object.keys(value)) {
    if (!requestFields.has(key)) blockers.add("unsupported_request_field");
  }

  if (value.jobType !== "context_lineage" && value.jobType !== "strategy_shadow") {
    blockers.add("unsupported_job_type");
  }
  for (const field of [
    "jobVersion",
    "triggerEventId",
    "requestedSymbol",
    "brokerSymbol",
    "contextArtifactId"
  ]) {
    if (!isNonEmptyIdentifier(value[field])) {
      blockers.add(`invalid_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`);
    }
  }
  if (!isCanonicalIsoTimestamp(value.requestedAt)) {
    blockers.add("invalid_requested_at");
  }
  for (const field of [
    "triggerCandleIdentity",
    "contextIdentity",
    "sourceFingerprint",
    "timeContractId"
  ]) {
    if (typeof value[field] !== "string" || !hashPattern.test(value[field])) {
      blockers.add(`invalid_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`);
    }
  }
  if (
    typeof value.contextArtifactId === "string" &&
    !contextArtifactPattern.test(value.contextArtifactId)
  ) {
    blockers.add("invalid_context_artifact_id");
  }
  if (
    typeof value.primaryTimeframe !== "string" ||
    !timeframePattern.test(value.primaryTimeframe)
  ) {
    blockers.add("invalid_primary_timeframe");
  }
  if (!isSortedUniqueStringSet(value.requiredFacts)) {
    blockers.add("required_facts_not_sorted_unique");
  }
  if (
    !isSortedUniqueStringSet(value.requiredTimeframes) ||
    (Array.isArray(value.requiredTimeframes) &&
      !value.requiredTimeframes.every(
        (timeframe) =>
          typeof timeframe === "string" && timeframePattern.test(timeframe)
      ))
  ) {
    blockers.add("required_timeframes_not_sorted_unique");
  }
  validateSchemaVersions(value.schemaVersions, blockers);

  if (value.shadowOnly !== true) blockers.add("shadow_only_boundary_required");

  for (const blocker of validateCanonicalResearchAuthority(value.authority)) {
    blockers.add(blocker);
  }
  for (const blocker of validateCanonicalResearchCapabilities(
    value.capabilities,
    { allowInherited: true }
  )) {
    blockers.add(blocker);
  }

  if (value.jobType === "strategy_shadow") {
    for (const field of [
      "strategyId",
      "profileId",
      "profileVersion",
      "parameterHash",
      "costModelId"
    ]) {
      if (!isNonEmptyIdentifier(value[field])) {
        blockers.add(`missing_or_invalid_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`);
      }
    }
    if (
      typeof value.parameterHash === "string" &&
      !hashPattern.test(value.parameterHash)
    ) {
      blockers.add("invalid_parameter_hash");
    }
  } else {
    for (const field of [
      "strategyId",
      "profileId",
      "profileVersion",
      "parameterHash",
      "costModelId"
    ]) {
      if (field in value) blockers.add("strategy_fields_not_allowed_for_context_job");
    }
  }
};

export function validateCanonicalResearchJobRequest(
  input: unknown
): CanonicalResearchValidationResult {
  const blockers = new Set<string>();
  collectForbiddenBlockers(input, blockers);

  if (!isPlainObject(input)) {
    blockers.add("request_must_be_plain_object");
  } else {
    validateRequestShape(input, blockers);
  }

  try {
    canonicalSerialize(input);
  } catch {
    blockers.add("non_canonical_request_payload");
  }

  const sortedBlockers = [...blockers].sort();
  if (sortedBlockers.length > 0 || !isPlainObject(input)) {
    return Object.freeze({
      accepted: false,
      blockers: Object.freeze(sortedBlockers)
    });
  }

  return Object.freeze({
    accepted: true,
    blockers: Object.freeze([]) as readonly [],
    request: input as unknown as CanonicalResearchJobRequest,
    authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
    capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
  });
}

export function validateCanonicalResearchSeal(
  checkpoint: Pick<
    CanonicalResearchJobCheckpoint,
    "status" | "leaseExpiresAt"
  >,
  sealAttemptAt: string
): CanonicalResearchSealValidationResult {
  const blockers = new Set<string>();
  if (checkpoint.status === "cancelled") {
    blockers.add("job_cancelled_before_seal");
  }
  if (!isCanonicalIsoTimestamp(sealAttemptAt)) {
    blockers.add("invalid_seal_attempt_time");
  }
  if (checkpoint.leaseExpiresAt !== undefined) {
    if (!isCanonicalIsoTimestamp(checkpoint.leaseExpiresAt)) {
      blockers.add("invalid_lease_expiry");
    } else if (
      isCanonicalIsoTimestamp(sealAttemptAt) &&
      Date.parse(sealAttemptAt) > Date.parse(checkpoint.leaseExpiresAt)
    ) {
      blockers.add("job_lease_expired_before_seal");
    }
  } else {
    blockers.add("job_lease_missing_before_seal");
  }

  const sortedBlockers = [...blockers].sort();
  return Object.freeze({
    allowed: sortedBlockers.length === 0,
    blockers: Object.freeze(sortedBlockers)
  });
}
