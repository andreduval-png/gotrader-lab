import { assertV2Authority } from "../authority/v2Authority";
import { createV2TimeNormalizationPolicy } from "./v2TimeNormalization";
import type { V2TimeNormalizationPolicy } from "./v2TimeNormalizationTypes";
import {
  V2_MT5_TIME_CONTRACT_ID,
  type V2Mt5ReadOnlyTimeContract,
  type V2Mt5TimeContractIdentityFields,
  type V2Mt5TimeContractValidationResult,
  type V2Mt5TimeVerificationObservation
} from "./v2Mt5UpstreamTimeContractTypes";

const providerBases = new Set(["epoch_utc", "mt5_server_wall_clock", "iso_with_offset", "unknown"]);
const dstPolicies = new Set(["iana_timezone_rules", "fixed_offset", "provider_declared", "unknown"]);
const verificationStatuses = new Set(["verified", "configured_unverified", "observed_candidate", "unknown"]);
const sensitiveKey = /(?:account|balance|equity|margin|position|order|deal|credential|password|secret|token|apiKey|login)/i;

const freezeText = (values: readonly string[]) => Object.freeze([...new Set(values)]);

const collectSensitivePaths = (value: unknown, path = "contract", found: string[] = []): string[] => {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitivePaths(item, `${path}[${index}]`, found));
    return found;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    const nestedPath = `${path}.${key}`;
    if (sensitiveKey.test(key)) found.push(nestedPath);
    collectSensitivePaths(nested, nestedPath, found);
  });
  return found;
};

const validIso = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const validIanaTimezone = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
};

const observationMatches = (
  observation: Readonly<V2Mt5TimeVerificationObservation>,
  contract: Partial<V2Mt5ReadOnlyTimeContract>
) => observation.withinTolerance === true && (
  Boolean(contract.providerTimezone) && observation.appliedTimezone === contract.providerTimezone ||
  contract.providerUtcOffsetMinutes !== undefined &&
    observation.appliedOffsetMinutes === contract.providerUtcOffsetMinutes
);

const validateVerifiedEvidence = (
  contract: Partial<V2Mt5ReadOnlyTimeContract>,
  blockers: string[]
) => {
  const sources = new Set(contract.verificationSources ?? []);
  const observations = (contract.verificationObservations ?? []).filter((item) => observationMatches(item, contract));
  const documented = sources.has("provider_documentation") && Boolean(contract.providerDeclarationId?.trim());
  const terminalVerified = sources.has("verified_terminal_metadata") && Boolean(contract.terminalMetadataVerificationId?.trim());
  if (sources.has("provider_documentation") && !documented) blockers.push("provider_declaration_id_missing");
  if (sources.has("verified_terminal_metadata") && !terminalVerified) blockers.push("terminal_metadata_verification_id_missing");
  const hasDeclaration = documented || terminalVerified;
  const tickCandleAgreement = contract.tickCandleBasisAgreement === true;
  if (!tickCandleAgreement) blockers.push("tick_candle_time_basis_mismatch");

  if (contract.providerTimeBasis === "epoch_utc") {
    if (!sources.has("metatrader5_official_documentation")) blockers.push("epoch_utc_documentation_missing");
    if (contract.libraryTimeClaimAgreement !== true) blockers.push("epoch_utc_live_observation_mismatch");
    return;
  }

  if (contract.providerTimeBasis !== "mt5_server_wall_clock") {
    blockers.push("verified_provider_basis_not_supported");
    return;
  }
  if (contract.dstPolicy === "iana_timezone_rules") {
    const winter = observations.some((item) => item.dstState === "standard");
    const summer = observations.some((item) => item.dstState === "daylight");
    if (!hasDeclaration && !(winter && summer)) blockers.push("winter_summer_verification_incomplete");
    return;
  }
  if (contract.dstPolicy === "fixed_offset") {
    const repeated = observations.filter((item) => item.dstState === "not_applicable").length >= 2;
    if (!hasDeclaration || !repeated) blockers.push("fixed_offset_verification_incomplete");
    return;
  }
  blockers.push("verified_dst_policy_not_supported");
};

export function policyFromVerifiedV2Mt5TimeContract(
  contract: Readonly<V2Mt5ReadOnlyTimeContract>
): Readonly<V2TimeNormalizationPolicy> {
  if (contract.verificationStatus !== "verified") {
    throw new Error("A verified MT5 upstream time contract is required before creating a normalization policy.");
  }
  return createV2TimeNormalizationPolicy({
    policyId: contract.contractId,
    version: contract.version,
    provider: "mt5_read_only",
    basis: contract.providerTimeBasis,
    sourceTimezone: contract.providerTimezone,
    sourceUtcOffsetMinutes: contract.providerUtcOffsetMinutes,
    outputTimezone: "UTC",
    discoveryMethod: "verified_upstream_contract",
    dstPolicy: contract.dstPolicy === "iana_timezone_rules"
      ? "iana_timezone_rules"
      : contract.dstPolicy === "fixed_offset"
        ? "explicit_offset"
        : contract.providerTimeBasis === "epoch_utc"
          ? "not_applicable"
          : "unknown",
    maximumClockSkewMs: 60_000,
    closureToleranceMs: 1_000
  });
}

export function validateV2Mt5UpstreamTimeContract(input: unknown): Readonly<V2Mt5TimeContractValidationResult> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({
      status: "blocked" as const,
      phase2Eligible: false,
      verificationStatus: "unknown" as const,
      blockers: Object.freeze(["time_contract_missing"]),
      warnings: Object.freeze([])
    });
  }
  const contract = input as Partial<V2Mt5ReadOnlyTimeContract>;
  if (contract.contractId !== V2_MT5_TIME_CONTRACT_ID) blockers.push("time_contract_id_invalid");
  if (typeof contract.version !== "string" || !contract.version.trim()) blockers.push("time_contract_version_missing");
  if (!providerBases.has(String(contract.providerTimeBasis))) blockers.push("provider_time_basis_invalid");
  if (!dstPolicies.has(String(contract.dstPolicy))) blockers.push("dst_policy_invalid");
  if (!verificationStatuses.has(String(contract.verificationStatus))) blockers.push("verification_status_invalid");
  if (!validIso(contract.systemTimeUtc)) blockers.push("system_time_utc_invalid");
  if (contract.serverTimeUtc && !validIso(contract.serverTimeUtc)) blockers.push("server_time_utc_invalid");
  if (contract.providerTimezone && !validIanaTimezone(contract.providerTimezone)) blockers.push("provider_timezone_invalid");
  if (
    contract.providerUtcOffsetMinutes !== undefined &&
    (!Number.isInteger(contract.providerUtcOffsetMinutes) || Math.abs(contract.providerUtcOffsetMinutes) > 840)
  ) blockers.push("provider_utc_offset_invalid");
  if (contract.providerTimezone && contract.providerUtcOffsetMinutes !== undefined) {
    blockers.push("timezone_and_fixed_offset_are_mutually_exclusive");
  }
  if (contract.readOnly !== true || contract.marketDataOnly !== true) blockers.push("read_only_market_data_contract_required");
  try {
    assertV2Authority(contract.authority);
  } catch {
    blockers.push("authority_contract_invalid");
  }
  if (
    contract.executionAuthority !== "none" ||
    contract.brokerAuthority !== "none" ||
    contract.readinessOverrideAuthority !== "none"
  ) blockers.push("top_level_authority_invalid");
  const sensitivePaths = collectSensitivePaths(contract);
  if (sensitivePaths.length) blockers.push(...sensitivePaths.map((path) => `sensitive_field_forbidden:${path}`));
  if (contract.verificationStatus === "verified") validateVerifiedEvidence(contract, blockers);
  if (contract.verificationStatus !== "verified") warnings.push("The MT5 upstream time contract is not verified; V2 must fail closed.");

  const accepted = blockers.length === 0;
  const normalized = accepted ? Object.freeze(contract as V2Mt5ReadOnlyTimeContract) : undefined;
  const policy = normalized?.verificationStatus === "verified"
    ? policyFromVerifiedV2Mt5TimeContract(normalized)
    : undefined;
  return Object.freeze({
    status: accepted ? "accepted" as const : "blocked" as const,
    phase2Eligible: accepted && normalized?.verificationStatus === "verified",
    verificationStatus: verificationStatuses.has(String(contract.verificationStatus))
      ? contract.verificationStatus as V2Mt5ReadOnlyTimeContract["verificationStatus"]
      : "unknown",
    contract: normalized,
    policy,
    blockers: freezeText(blockers),
    warnings: freezeText([...(contract.warnings ?? []), ...warnings])
  });
}

export function v2Mt5TimeContractIdentityFields(
  contract: Readonly<V2Mt5ReadOnlyTimeContract>
): Readonly<V2Mt5TimeContractIdentityFields> {
  return Object.freeze({
    timeContractId: contract.contractId,
    timeContractVersion: contract.version,
    timeContractVerificationStatus: contract.verificationStatus
  });
}
