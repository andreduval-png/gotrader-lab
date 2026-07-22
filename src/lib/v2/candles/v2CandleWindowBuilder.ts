import { V2_MARKET_DATA_READ_ONLY } from "../authority/v2Authority";
import { buildV2MarketDataIdentity, v2SourceIdentityMatches } from "../identity/v2Identity";
import type { V2SourceIdentity } from "../identity/v2IdentityTypes";
import { validateAndNormalizeV2Candles } from "./v2CandleValidation";
import {
  V2CandleRepositoryError,
  type V2CandleCandidate,
  type V2CandlePurpose,
  type V2CanonicalCandleQuery,
  type V2CanonicalCandleWindow,
  type V2ClosurePolicy,
  type V2ClosureSource,
  type V2EvidencePolicy,
  type V2LegacyCandleLike
} from "./v2CandleTypes";
import { normalizeV2Timeframe, v2TimeframeMilliseconds } from "./v2Timeframe";

export const V2_QUERY_LIMITS: Readonly<Record<V2CandlePurpose, number>> = Object.freeze({
  current_read: 1_000,
  context_shadow: 5_000,
  replay: 10_000,
  walk_forward: 10_000,
  deep_research: 50_000
});

const evidencePurposes = new Set<V2CandlePurpose>(["replay", "walk_forward", "deep_research"]);

const validIso = (value?: string) => {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new V2CandleRepositoryError("query_invalid", `Invalid V2 candle query timestamp: ${value}`);
  }
  return new Date(parsed).toISOString();
};

export function validateV2CanonicalCandleQuery(query: V2CanonicalCandleQuery) {
  if (!query || query.closedOnly !== true) {
    throw new V2CandleRepositoryError("query_invalid", "V2 candle queries must explicitly request closed candles only.");
  }
  const timeframe = normalizeV2Timeframe(query.timeframe);
  const start = validIso(query.start);
  const end = validIso(query.end);
  if (start && end && Date.parse(start) >= Date.parse(end)) {
    throw new V2CandleRepositoryError("query_invalid", "V2 candle query start must precede end.");
  }
  const maximum = V2_QUERY_LIMITS[query.purpose];
  const limit = query.limit ?? maximum;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new V2CandleRepositoryError("query_invalid", "V2 candle query limit must be a positive integer.");
  }
  if (limit > maximum) {
    throw new V2CandleRepositoryError(
      "query_limit_exceeded",
      `${query.purpose} is capped at ${maximum.toLocaleString()} candles; requested ${limit.toLocaleString()}.`
    );
  }
  if (limit > V2_QUERY_LIMITS.context_shadow && query.purpose !== "deep_research" && query.purpose !== "replay" && query.purpose !== "walk_forward") {
    throw new V2CandleRepositoryError("deep_history_not_explicit", "Large V2 history requests require an explicit deep-research purpose.");
  }
  if (query.source.sourceKind === "mock_sample" && evidencePurposes.has(query.purpose)) {
    throw new V2CandleRepositoryError(
      "mock_evidence_forbidden",
      `Mock/sample candles cannot be requested for ${query.purpose} evidence.`
    );
  }
  return { timeframe, start, end, limit };
}

const closureSourceFor = (policy: V2ClosurePolicy): V2ClosureSource => {
  if (policy === "explicit_closed") return "provider_event";
  if (policy === "historical_dataset") return "historical_dataset";
  if (policy === "replay_snapshot") return "replay_snapshot";
  if (policy === "mock_sample") return "mock_sample";
  return "timeframe_elapsed";
};

const candidateFromLegacy = ({
  asOfMs,
  candle,
  closurePolicy,
  intervalMs
}: {
  asOfMs: number;
  candle: V2LegacyCandleLike;
  closurePolicy: V2ClosurePolicy;
  intervalMs: number;
}): V2CandleCandidate => {
  const openTime = candle.openTime ?? candle.timestamp ?? "invalid";
  const parsedOpen = Date.parse(openTime);
  const closeTime = candle.closeTime ?? (
    Number.isFinite(parsedOpen) ? new Date(parsedOpen + intervalMs).toISOString() : "invalid"
  );
  const closeMs = Date.parse(closeTime);
  const explicitClosed = candle.isClosed ?? candle.closed;
  const isClosed = closurePolicy === "explicit_closed"
    ? explicitClosed
    : closurePolicy === "elapsed_time"
      ? Number.isFinite(closeMs) && closeMs <= asOfMs
      : true;
  return {
    openTime,
    closeTime,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: candle.volume === undefined ? undefined : Number(candle.volume),
    isClosed,
    closureSource: closureSourceFor(closurePolicy),
    providerTime: candle.providerTime ?? candle.serverTimestamp,
    receivedAt: candle.receivedAt,
    timeAudit: candle.timeAudit
  };
};

const evidencePolicyFor = ({
  diagnosticsStatus,
  purpose,
  source
}: {
  diagnosticsStatus: "eligible" | "degraded" | "blocked";
  purpose: V2CandlePurpose;
  source: V2SourceIdentity;
}): Readonly<V2EvidencePolicy> => {
  const evidencePurpose = evidencePurposes.has(purpose);
  const sourceEligible = source.sourceKind !== "mock_sample";
  const dataQualityEligible = diagnosticsStatus === "eligible";
  const mayCreateEvidence = evidencePurpose && sourceEligible && dataQualityEligible;
  const reason = !evidencePurpose
    ? "This query purpose does not create evidence."
    : !sourceEligible
      ? "Mock/sample sources cannot create evidence."
      : !dataQualityEligible
        ? "Data quality must be eligible before a downstream system may create evidence."
        : "The source and window may be supplied to a future evidence system; this repository creates no evidence.";
  return Object.freeze({
    evidencePurpose,
    sourceEligible,
    dataQualityEligible,
    mayCreateEvidence,
    repositoryCreatesEvidence: false as const,
    reason
  });
};

export async function buildV2CanonicalCandleWindow({
  adapterId,
  adapterVersion,
  asOf = new Date().toISOString(),
  closurePolicy,
  legacyCandles,
  query,
  source,
  sourceStale = false,
  sourceWarnings = [],
  timeNormalizationPolicyId,
  timeNormalizationPolicyVersion,
  timeContractId,
  timeContractVersion,
  timeContractVerificationStatus
}: {
  adapterId: string;
  adapterVersion: string;
  asOf?: string;
  closurePolicy: V2ClosurePolicy;
  legacyCandles: readonly V2LegacyCandleLike[];
  query: V2CanonicalCandleQuery;
  source: Readonly<V2SourceIdentity>;
  sourceStale?: boolean;
  sourceWarnings?: readonly string[];
  timeNormalizationPolicyId?: string;
  timeNormalizationPolicyVersion?: string;
  timeContractId?: string;
  timeContractVersion?: string;
  timeContractVerificationStatus?: "verified" | "configured_unverified" | "observed_candidate" | "unknown";
}): Promise<Readonly<V2CanonicalCandleWindow>> {
  if (!v2SourceIdentityMatches(query.source, source)) {
    throw new V2CandleRepositoryError("source_identity_mismatch", "The requested V2 source identity does not match the adapter source.");
  }
  const normalizedQuery = validateV2CanonicalCandleQuery(query);
  const asOfIso = validIso(asOf) ?? new Date().toISOString();
  const asOfMs = Date.parse(asOfIso);
  const intervalMs = v2TimeframeMilliseconds(normalizedQuery.timeframe);
  const sourceCandidates = legacyCandles.map((candle) => candidateFromLegacy({
    asOfMs,
    candle,
    closurePolicy,
    intervalMs
  }));
  const rangeCandidates = sourceCandidates.filter((candidate) => {
    const timestamp = Date.parse(candidate.openTime);
    if (!Number.isFinite(timestamp)) return true;
    if (normalizedQuery.start && timestamp < Date.parse(normalizedQuery.start)) return false;
    if (normalizedQuery.end && timestamp > Date.parse(normalizedQuery.end)) return false;
    return true;
  });
  const limitedCandidates = rangeCandidates.length > normalizedQuery.limit
    ? rangeCandidates.slice(-normalizedQuery.limit)
    : rangeCandidates;
  const validated = validateAndNormalizeV2Candles({
    asOf: asOfIso,
    candidates: limitedCandidates,
    expectedIntervalMs: intervalMs,
    futureToleranceMs: 1_000,
    sourceStale,
    staleAfterMs: query.purpose === "current_read" || query.purpose === "context_shadow"
      ? intervalMs * 3
      : undefined
  });
  const diagnostics = sourceWarnings.length
    ? Object.freeze({
        ...validated.diagnostics,
        warnings: Object.freeze([...validated.diagnostics.warnings, ...sourceWarnings])
      })
    : validated.diagnostics;
  const first = validated.candles[0];
  const last = validated.candles[validated.candles.length - 1];
  const fallbackBoundary = normalizedQuery.end ?? normalizedQuery.start ?? asOfIso;
  const identity = await buildV2MarketDataIdentity({
    source,
    timeNormalizationPolicyId,
    timeNormalizationPolicyVersion,
    timeContractId,
    timeContractVersion,
    timeContractVerificationStatus,
    timeframeFingerprints: { [normalizedQuery.timeframe]: source.sourceFingerprint },
    dataWindowStart: first?.openTime ?? fallbackBoundary,
    dataWindowEnd: last?.closeTime ?? fallbackBoundary,
    lastClosedCandle: last?.closeTime ?? fallbackBoundary,
    candleCountByTimeframe: { [normalizedQuery.timeframe]: validated.candles.length }
  });
  return Object.freeze({
    identity,
    candles: validated.candles,
    diagnostics,
    capability: V2_MARKET_DATA_READ_ONLY,
    evidencePolicy: evidencePolicyFor({
      diagnosticsStatus: diagnostics.status,
      purpose: query.purpose,
      source
    }),
    adapterId,
    adapterVersion,
    shadowOnly: true as const
  });
}
