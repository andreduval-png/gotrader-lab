import type { Candle, FuturesSymbol, Timeframe } from "@/lib/types";
import type { CanonicalFactLineage, CanonicalIctFactBase, CanonicalIctFactType } from "@/lib/ictCanonical/canonicalIctTypes";
import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return value;
};

export const stableCanonicalJson = (value: unknown) => JSON.stringify(stableValue(value));

const fnv1a = (value: string, seed: number) => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

export const canonicalFingerprint = (value: unknown) => {
  const serialized = stableCanonicalJson(value);
  return `fnv1a128:${fnv1a(serialized, 0x811c9dc5)}${fnv1a(serialized, 0x9e3779b9)}${fnv1a(serialized, 0x85ebca6b)}${fnv1a(serialized, 0xc2b2ae35)}`;
};

export const canonicalFactId = (factType: CanonicalIctFactType, identity: unknown) =>
  `ict:${factType.toLowerCase()}:${canonicalFingerprint(identity).slice("fnv1a128:".length)}`;

export const fingerprintCanonicalSource = (candles: readonly Candle[]) =>
  canonicalFingerprint(
    candles.map((candle) => ({
      id: candle.id,
      symbol: candle.symbol,
      timeframe: candle.timeframe,
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    }))
  );

export const canonicalLineage = ({
  sourceCandleIds,
  sourceFactIds = [],
  sourceFingerprint,
  policyId,
  policyVersion
}: {
  sourceCandleIds: readonly string[];
  sourceFactIds?: readonly string[];
  sourceFingerprint: string;
  policyId: string;
  policyVersion: string;
}): CanonicalFactLineage => ({
  sourceCandleIds: [...sourceCandleIds],
  sourceFactIds: [...sourceFactIds],
  sourceFingerprint,
  policyId,
  policyVersion
});

export const canonicalFactBase = ({
  factId,
  factType,
  symbol,
  timeframe,
  occurredAt,
  confirmedAt,
  validFrom,
  invalidatedAt,
  state,
  lineage
}: Omit<CanonicalIctFactBase, "authority">): CanonicalIctFactBase => {
  for (const [name, timestamp] of Object.entries({ occurredAt, confirmedAt, validFrom, invalidatedAt })) {
    if (timestamp !== undefined && !Number.isFinite(Date.parse(timestamp))) {
      throw new Error(`Canonical ICT fact has invalid ${name}: ${timestamp}`);
    }
  }
  if (Date.parse(confirmedAt) < Date.parse(occurredAt) || Date.parse(validFrom) < Date.parse(confirmedAt)) {
    throw new Error("Canonical ICT fact timestamp ordering must satisfy occurredAt <= confirmedAt <= validFrom.");
  }
  return {
    factId,
    factType,
    symbol,
    timeframe,
    occurredAt,
    confirmedAt,
    validFrom,
    invalidatedAt,
    state,
    lineage,
    authority: CANONICAL_ICT_NONE_AUTHORITY
  };
};

export const resolveFactMarket = (
  candles: readonly Candle[],
  symbol?: FuturesSymbol,
  timeframe?: Timeframe
): { symbol: FuturesSymbol; timeframe: Timeframe } => {
  const first = candles[0];
  const resolvedSymbol = symbol ?? first?.symbol;
  const resolvedTimeframe = timeframe ?? first?.timeframe;
  if (!resolvedSymbol || !resolvedTimeframe) {
    throw new Error("Canonical ICT facts require explicit or candle-derived symbol and timeframe.");
  }
  if (candles.some((candle) => candle.symbol !== resolvedSymbol || candle.timeframe !== resolvedTimeframe)) {
    throw new Error("Canonical ICT fact input cannot mix symbols or timeframes.");
  }
  return { symbol: resolvedSymbol, timeframe: resolvedTimeframe };
};

export const causalCandlesAt = (candles: readonly Candle[], asOf: string) => {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) throw new Error(`Invalid causal asOf timestamp: ${asOf}`);
  return [...candles]
    .filter((candle) => Date.parse(candle.timestamp) <= asOfMs)
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp) || left.id.localeCompare(right.id));
};
