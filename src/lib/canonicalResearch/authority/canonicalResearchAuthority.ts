import type {
  CanonicalResearchAuthority,
  CanonicalResearchCapabilities
} from "../contracts/canonicalResearchTypes";

export const CANONICAL_RESEARCH_AUTHORITY_NONE: CanonicalResearchAuthority =
  Object.freeze({
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  });

export const CANONICAL_RESEARCH_CAPABILITIES_DISABLED: CanonicalResearchCapabilities =
  Object.freeze({
    productionAdoptionAllowed: false,
    canCreateEvidence: false,
    canApproveReadiness: false,
    canApplyCalibration: false,
    canCreateTradeIntent: false
  });

const authorityKeys = Object.freeze([
  "brokerAuthority",
  "executionAuthority",
  "readinessOverrideAuthority"
]);

const capabilityKeys = Object.freeze([
  "canApplyCalibration",
  "canApproveReadiness",
  "canCreateEvidence",
  "canCreateTradeIntent",
  "productionAdoptionAllowed"
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const sortedKeys = (value: Record<string, unknown>) =>
  Object.keys(value).sort((left, right) => left.localeCompare(right));

export function validateCanonicalResearchAuthority(
  value: unknown
): readonly string[] {
  if (!isPlainObject(value)) return ["missing_or_invalid_authority"];

  const blockers = new Set<string>();
  const keys = sortedKeys(value);
  for (const key of keys) {
    if (!authorityKeys.includes(key)) blockers.add("unknown_authority_field");
  }
  for (const key of authorityKeys) {
    if (!(key in value)) blockers.add(`missing_${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`);
  }
  if (value.executionAuthority !== "none") {
    blockers.add("execution_authority_must_be_none");
  }
  if (value.brokerAuthority !== "none") {
    blockers.add("broker_authority_must_be_none");
  }
  if (value.readinessOverrideAuthority !== "none") {
    blockers.add("readiness_override_authority_must_be_none");
  }
  return [...blockers].sort();
}

export function validateCanonicalResearchCapabilities(
  value: unknown,
  options: { readonly allowInherited?: boolean } = {}
): readonly string[] {
  if (value === undefined && options.allowInherited) return [];
  if (!isPlainObject(value)) return ["missing_or_invalid_capabilities"];

  const blockers = new Set<string>();
  const keys = sortedKeys(value);
  for (const key of keys) {
    if (!capabilityKeys.includes(key)) blockers.add("unknown_capability_field");
  }
  for (const key of capabilityKeys) {
    if (!(key in value)) blockers.add("missing_capability_field");
    else if (value[key] !== false) blockers.add("capability_must_be_false");
  }
  return [...blockers].sort();
}

export function validateCanonicalResearchBoundary(value: {
  readonly authority?: unknown;
  readonly capabilities?: unknown;
}): readonly string[] {
  return [
    ...validateCanonicalResearchAuthority(value.authority),
    ...validateCanonicalResearchCapabilities(value.capabilities)
  ].filter((blocker, index, blockers) => blockers.indexOf(blocker) === index).sort();
}
