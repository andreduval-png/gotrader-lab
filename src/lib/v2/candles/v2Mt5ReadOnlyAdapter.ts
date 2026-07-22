import { createV2SourceIdentity } from "../identity/v2Identity";
import type { V2SourceIdentity } from "../identity/v2IdentityTypes";
import {
  V2CandleRepositoryError,
  type V2CandleRepository,
  type V2LegacyCandleLike,
  type V2LegacyCandleSourceSnapshot
} from "./v2CandleTypes";
import { createV2StaticCandleRepository } from "./v2StaticCandleRepository";

export const V2_MT5_READ_ONLY_ADAPTER_ID = "mt5-read-only-snapshot";
export const V2_MT5_READ_ONLY_ADAPTER_VERSION = "gotrader-v2-mt5-read-only-adapter-v1";

export interface V2Mt5ReadOnlyFeedSnapshot {
  feedId: string;
  requestedSymbol: string;
  brokerSymbol?: string;
  symbol: string;
  timeframe: string;
  candleFingerprint?: string;
  candles: readonly V2LegacyCandleLike[];
  connectionStatus: "connected" | "degraded" | "disconnected" | "error" | "planned";
  fetchedAt?: string;
  warnings?: readonly string[];
}

export function createV2SourceIdentityFromMt5Feed(feed: V2Mt5ReadOnlyFeedSnapshot): Readonly<V2SourceIdentity> {
  if (!feed.candleFingerprint) {
    throw new V2CandleRepositoryError(
      "source_identity_mismatch",
      "MT5 V2 snapshot requires the existing compatibility candle fingerprint."
    );
  }
  return createV2SourceIdentity({
    sourceId: feed.feedId,
    provider: "mt5_read_only",
    requestedSymbol: feed.requestedSymbol,
    brokerSymbol: feed.brokerSymbol ?? feed.symbol,
    sourceFingerprint: feed.candleFingerprint,
    sourceKind: "mt5_read_only"
  });
}

export function mt5FeedToV2Snapshot(feed: V2Mt5ReadOnlyFeedSnapshot): V2LegacyCandleSourceSnapshot {
  return {
    identity: createV2SourceIdentityFromMt5Feed(feed),
    timeframe: feed.timeframe,
    candles: feed.candles,
    closurePolicy: "elapsed_time",
    stale: feed.connectionStatus !== "connected",
    warnings: feed.warnings
  };
}

export function createV2Mt5ReadOnlyRepository({
  asOf,
  loadFeed
}: {
  asOf?: () => string;
  loadFeed: (source: V2SourceIdentity) => Promise<V2Mt5ReadOnlyFeedSnapshot | undefined>;
}): V2CandleRepository {
  return createV2StaticCandleRepository({
    adapterId: V2_MT5_READ_ONLY_ADAPTER_ID,
    adapterVersion: V2_MT5_READ_ONLY_ADAPTER_VERSION,
    asOf,
    async loadSource(source) {
      const feed = await loadFeed(source);
      return feed ? mt5FeedToV2Snapshot(feed) : undefined;
    }
  });
}
