import type { CanonicalCandleSource } from "@/lib/candleSources/candleSourceTypes";
import { loadCanonicalCandleSource } from "@/lib/candleSources/candleSourceStorage";
import { createV2SourceIdentity } from "../identity/v2Identity";
import type { V2SourceIdentity, V2SourceKind } from "../identity/v2IdentityTypes";
import {
  V2CandleRepositoryError,
  type V2CandleRepository,
  type V2ClosurePolicy,
  type V2LegacyCandleSourceSnapshot
} from "./v2CandleTypes";
import { createV2StaticCandleRepository } from "./v2StaticCandleRepository";

export const V2_CANONICAL_SOURCE_MANAGER_ADAPTER_ID = "legacy-canonical-source-manager";
export const V2_CANONICAL_SOURCE_MANAGER_ADAPTER_VERSION = "gotrader-v2-canonical-source-manager-adapter-v1";

const mappingForProvider = (provider: CanonicalCandleSource["provider"]): {
  sourceKind: V2SourceKind;
  closurePolicy: V2ClosurePolicy;
} => {
  if (provider === "mt5_read_only") return { sourceKind: "mt5_read_only", closurePolicy: "elapsed_time" };
  if (provider === "imported_historical") return { sourceKind: "imported_historical", closurePolicy: "historical_dataset" };
  if (provider === "replay") return { sourceKind: "replay_snapshot", closurePolicy: "replay_snapshot" };
  if (provider === "mock") return { sourceKind: "mock_sample", closurePolicy: "mock_sample" };
  throw new V2CandleRepositoryError(
    "source_kind_unsupported",
    `Legacy provider ${provider} has no approved Phase 1 V2 source-kind mapping.`
  );
};

export function createV2SourceIdentityFromCanonicalSource(
  source: CanonicalCandleSource
): Readonly<V2SourceIdentity> {
  const mapping = mappingForProvider(source.provider);
  return createV2SourceIdentity({
    sourceId: source.sourceId,
    provider: source.provider,
    requestedSymbol: source.symbol,
    brokerSymbol: source.provenance.providerSymbol ?? source.normalizedSymbol,
    sourceFingerprint: source.fingerprint,
    sourceKind: mapping.sourceKind
  });
}

export function canonicalSourceToV2Snapshot(source: CanonicalCandleSource): V2LegacyCandleSourceSnapshot {
  const mapping = mappingForProvider(source.provider);
  return {
    identity: createV2SourceIdentityFromCanonicalSource(source),
    timeframe: source.timeframe,
    candles: source.candles,
    closurePolicy: mapping.closurePolicy,
    stale: false,
    warnings: source.warnings
  };
}

export function createV2CanonicalSourceManagerRepository({
  asOf,
  loadSource = loadCanonicalCandleSource
}: {
  asOf?: () => string;
  loadSource?: (sourceId: string) => Promise<CanonicalCandleSource | undefined>;
} = {}): V2CandleRepository {
  return createV2StaticCandleRepository({
    adapterId: V2_CANONICAL_SOURCE_MANAGER_ADAPTER_ID,
    adapterVersion: V2_CANONICAL_SOURCE_MANAGER_ADAPTER_VERSION,
    asOf,
    async loadSource(identity) {
      const source = await loadSource(identity.sourceId);
      return source ? canonicalSourceToV2Snapshot(source) : undefined;
    }
  });
}
