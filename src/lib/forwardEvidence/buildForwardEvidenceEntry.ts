import {
  FORWARD_EVIDENCE_AUTHORITY,
  type ForwardEvidenceEntry,
  type ForwardEvidenceEntryInput,
  type ForwardEvidenceTargetReference
} from "./forwardEvidenceTypes";
import { getFrozenResearchProfile, ifvgFreshRetestV3FrozenProfile } from "./frozenProfileRegistry";

const forbiddenKeys = new Set([
  "candles",
  "rawcandles",
  "candlearray",
  "candlesarray",
  "rawsnapshot",
  "runtimesnapshot",
  "rawruntimesnapshot",
  "rawmt5snapshot",
  "ohlcv",
  "importedohlcv",
  "screenshot",
  "screenshots",
  "base64",
  "secret",
  "secrets",
  "apikey",
  "apikeys",
  "token",
  "tokens",
  "password",
  "passwords",
  "mt5credentials",
  "account",
  "accountdata",
  "order",
  "orders",
  "orderdata",
  "position",
  "positions",
  "positiondata",
  "brokerexecutionpayload",
  "executionpayload"
]);

const normalizedKey = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();
const base64Payload = /^(?:data:[^;]+;base64,|[A-Za-z0-9+/]{300,}={0,2}$)/;
const sensitiveValue = /(?:api[_-]?key|password|secret|authorization\s*:|bearer\s+[a-z0-9._-]+)/i;

export const findForwardEvidenceBlockedFields = (value: unknown): string[] => {
  const blocked = new Set<string>();
  const visit = (candidate: unknown, path: string, seen: Set<object>) => {
    if (
      typeof candidate === "string" &&
      (base64Payload.test(candidate.trim()) || sensitiveValue.test(candidate))
    ) {
      blocked.add(path || "sensitive_payload");
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    if (seen.has(candidate)) return;
    seen.add(candidate);
    for (const [key, child] of Object.entries(candidate as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (forbiddenKeys.has(normalizedKey(key))) {
        blocked.add(childPath);
        continue;
      }
      visit(child, childPath, seen);
    }
  };
  visit(value, "", new Set<object>());
  return [...blocked].sort();
};

const compactText = (value: unknown, maximum = 500) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : "";

const compactList = (value: unknown, maximum = 12) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((item) => compactText(item, 160)).filter(Boolean))).slice(0, maximum)
    : [];

const validTimestamp = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;

const finiteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const normalizeTargets = (targets: unknown): ForwardEvidenceTargetReference[] =>
  Array.isArray(targets)
    ? targets
        .map((target) => {
          if (!target || typeof target !== "object") return undefined;
          const record = target as Record<string, unknown>;
          const price = finiteNumber(record.price);
          const label = compactText(record.label, 80);
          return price === undefined || !label ? undefined : { label, price };
        })
        .filter((target): target is ForwardEvidenceTargetReference => Boolean(target))
        .slice(0, 6)
    : [];

const entryId = () =>
  `forward_evidence_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const buildForwardEvidenceEntry = (input: ForwardEvidenceEntryInput): ForwardEvidenceEntry => {
  const frozen = getFrozenResearchProfile(input.profileId ?? ifvgFreshRetestV3FrozenProfile.profileId) ??
    ifvgFreshRetestV3FrozenProfile;
  const blockedFields = findForwardEvidenceBlockedFields(input);
  const setupTimestamp = validTimestamp(input.setupTimestamp) ?? frozen.validationCutoff;
  const timestamp = validTimestamp(input.timestamp) ?? new Date().toISOString();
  const beforeOrAtCutoff = Date.parse(setupTimestamp) <= Date.parse(frozen.validationCutoff);
  const unsafeAuthority =
    input.authority?.executionAuthority !== undefined && input.authority.executionAuthority !== "none" ||
    input.authority?.brokerAuthority !== undefined && input.authority.brokerAuthority !== "none" ||
    input.authority?.readinessOverrideAuthority !== undefined &&
      input.authority.readinessOverrideAuthority !== "none";
  const sourceFingerprint = compactText(input.sourceFingerprint, 200);
  const evidenceOrigin = input.evidenceOrigin === "live_closed_candle"
    ? "live_closed_candle" as const
    : "legacy_unverified" as const;
  const causalAtIssue = evidenceOrigin === "live_closed_candle" && input.causalAtIssue === true;
  const invalidIndependentDate = !/^\d{4}-\d{2}-\d{2}$/.test(input.independentDate);
  const forwardWindowId = compactText(input.forwardWindowId, 120);
  const rejectionReasons = [
    blockedFields.length ? `unsafe fields removed: ${blockedFields.join(", ")}` : "",
    beforeOrAtCutoff ? "setup is not after the frozen validation cutoff" : "",
    unsafeAuthority ? "unsafe authority requested" : "",
    !sourceFingerprint ? "source fingerprint missing" : "",
    invalidIndependentDate ? "independent date is invalid" : "",
    !forwardWindowId ? "forward window is missing" : ""
  ].filter(Boolean);
  const requestedOutcome = input.outcome ?? "pending";
  const outcome = rejectionReasons.length ? "rejected" : requestedOutcome;
  const lower = finiteNumber(input.entryZone?.lower);
  const upper = finiteNumber(input.entryZone?.upper);
  const entryZone = lower !== undefined && upper !== undefined
    ? { lower: Math.min(lower, upper), upper: Math.max(lower, upper) }
    : undefined;
  const blockerSummary = [
    ...rejectionReasons,
    compactText(input.blockerSummary, 500)
  ].filter(Boolean).join("; ");

  return {
    entryId: compactText(input.entryId, 120) || entryId(),
    timestamp,
    profileId: frozen.profileId,
    profileVersion: frozen.profileVersion,
    frozenAt: frozen.frozenAt,
    validationCutoff: frozen.validationCutoff,
    sourceProvider: frozen.sourceProvider,
    requestedSymbol: frozen.requestedSymbol,
    brokerSymbol: frozen.brokerSymbol,
    timeframe: frozen.timeframe,
    sourceFingerprint,
    evidenceOrigin,
    causalAtIssue,
    forwardEligible: rejectionReasons.length === 0 && causalAtIssue,
    setupTimestamp,
    independentDate: invalidIndependentDate ? setupTimestamp.slice(0, 10) : input.independentDate,
    forwardWindowId,
    direction: input.direction === "short" ? "short" : "long",
    scenarioFamily: compactText(input.scenarioFamily, 120) || frozen.profileId,
    entryZone,
    stopReference: finiteNumber(input.stopReference),
    targetReferences: normalizeTargets(input.targetReferences),
    triggerEvidence: compactList(input.triggerEvidence),
    missingEvidence: compactList(input.missingEvidence),
    outcome,
    realizedR: outcome === "pending" || outcome === "rejected" ? undefined : finiteNumber(input.realizedR),
    barsObserved: Math.max(0, Math.floor(finiteNumber(input.barsObserved) ?? 0)),
    lastCheckedAt: validTimestamp(input.lastCheckedAt),
    blockerSummary,
    notes: blockedFields.length ? "" : compactText(input.notes, 500),
    authority: FORWARD_EVIDENCE_AUTHORITY
  };
};
