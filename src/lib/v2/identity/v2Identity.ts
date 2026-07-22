import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../serialization/canonicalSerialization";
import {
  V2_IDENTITY_SCHEMA_VERSION,
  V2_SESSION_CALENDAR_VERSION,
  V2_TIMEZONE_VERSION,
  type V2MarketDataIdentity,
  type V2SourceIdentity,
  type V2SourceKind
} from "./v2IdentityTypes";

const sourceKinds = new Set<V2SourceKind>([
  "mt5_read_only",
  "imported_historical",
  "replay_snapshot",
  "mock_sample"
]);

const requireText = (value: string, field: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`V2 source identity requires ${field}.`);
  }
  return normalized;
};

export function createV2SourceIdentity(input: Omit<V2SourceIdentity, "marketDataAccess"> & {
  marketDataAccess?: "read_only";
}): Readonly<V2SourceIdentity> {
  if (!sourceKinds.has(input.sourceKind)) {
    throw new Error(`Unsupported V2 source kind: ${String(input.sourceKind)}`);
  }
  if (input.marketDataAccess && input.marketDataAccess !== "read_only") {
    throw new Error("V2 market-data access must remain read-only.");
  }
  return Object.freeze({
    sourceId: requireText(input.sourceId, "sourceId"),
    provider: requireText(input.provider, "provider"),
    requestedSymbol: requireText(input.requestedSymbol, "requestedSymbol"),
    brokerSymbol: requireText(input.brokerSymbol, "brokerSymbol"),
    sourceFingerprint: requireText(input.sourceFingerprint, "sourceFingerprint"),
    sourceKind: input.sourceKind,
    marketDataAccess: "read_only" as const
  });
}

export function sortV2StringRecord(values: Readonly<Record<string, string>>) {
  return Object.freeze(
    Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right)))
  );
}

export function sortV2NumberRecord(values: Readonly<Record<string, number>>) {
  return Object.freeze(
    Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right)))
  );
}

export async function buildV2MarketDataIdentity({
  candleCountByTimeframe,
  dataWindowEnd,
  dataWindowStart,
  lastClosedCandle,
  sessionCalendarVersion = V2_SESSION_CALENDAR_VERSION,
  source,
  timeframeFingerprints,
  timezoneVersion = V2_TIMEZONE_VERSION
}: {
  candleCountByTimeframe: Readonly<Record<string, number>>;
  dataWindowEnd: string;
  dataWindowStart: string;
  lastClosedCandle: string;
  sessionCalendarVersion?: string;
  source: Readonly<V2SourceIdentity>;
  timeframeFingerprints: Readonly<Record<string, string>>;
  timezoneVersion?: string;
}): Promise<Readonly<V2MarketDataIdentity>> {
  const identityCore = {
    source: createV2SourceIdentity(source),
    timeframeFingerprints: sortV2StringRecord(timeframeFingerprints),
    dataWindowStart,
    dataWindowEnd,
    lastClosedCandle,
    candleCountByTimeframe: sortV2NumberRecord(candleCountByTimeframe),
    sessionCalendarVersion,
    timezoneVersion,
    identitySchemaVersion: V2_IDENTITY_SCHEMA_VERSION,
    canonicalHashVersion: V2_CANONICAL_HASH_VERSION
  };
  const identityHash = await canonicalHash(identityCore);
  return Object.freeze({ ...identityCore, identityHash });
}

export function v2SourceIdentityMatches(left: V2SourceIdentity, right: V2SourceIdentity) {
  return left.sourceId === right.sourceId &&
    left.provider === right.provider &&
    left.requestedSymbol === right.requestedSymbol &&
    left.brokerSymbol === right.brokerSymbol &&
    left.sourceFingerprint === right.sourceFingerprint &&
    left.sourceKind === right.sourceKind &&
    left.marketDataAccess === "read_only" &&
    right.marketDataAccess === "read_only";
}
