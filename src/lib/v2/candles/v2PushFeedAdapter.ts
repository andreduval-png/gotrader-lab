import { createV2SourceIdentity } from "../identity/v2Identity";
import type { V2SourceIdentity } from "../identity/v2IdentityTypes";
import {
  V2CandleRepositoryError,
  type V2CandleRepository,
  type V2LegacyCandleLike,
  type V2LegacyCandleSourceSnapshot
} from "./v2CandleTypes";
import { createV2StaticCandleRepository } from "./v2StaticCandleRepository";
import { normalizeV2Timeframe } from "./v2Timeframe";

export const V2_PUSH_FEED_ADAPTER_ID = "mt5-push-feed-rolling-store";
export const V2_PUSH_FEED_ADAPTER_VERSION = "gotrader-v2-push-feed-adapter-v1";

export interface V2LegacyPushFeedState {
  candlesBySeries: Readonly<Record<string, readonly (V2LegacyCandleLike & {
    brokerSymbol?: string;
    requestedSymbol?: string;
    sourceFingerprint?: string;
    timeframe?: string;
  })[]>>;
  status: {
    status?: string;
    connectionStatus?: string;
    lastCandleFingerprint?: string;
    warnings?: readonly string[];
  };
}

const findSeries = (state: V2LegacyPushFeedState, brokerSymbol: string, timeframe: string) => {
  const normalizedTimeframe = normalizeV2Timeframe(timeframe);
  const entries = Object.entries(state.candlesBySeries);
  const exactKey = `mt5:${brokerSymbol}:${normalizedTimeframe}`;
  const exact = state.candlesBySeries[exactKey];
  if (exact) return exact;
  return entries.find(([, candles]) => {
    const first = candles[0];
    return first?.brokerSymbol === brokerSymbol && normalizeV2Timeframe(first.timeframe ?? timeframe) === normalizedTimeframe;
  })?.[1];
};

export function createV2SourceIdentityFromPushFeed({
  brokerSymbol,
  requestedSymbol,
  sourceFingerprint,
  timeframe
}: {
  brokerSymbol: string;
  requestedSymbol: string;
  sourceFingerprint: string;
  timeframe: string;
}): Readonly<V2SourceIdentity> {
  return createV2SourceIdentity({
    sourceId: `mt5-push:${brokerSymbol}:${normalizeV2Timeframe(timeframe)}`,
    provider: "mt5_push_feed",
    requestedSymbol,
    brokerSymbol,
    sourceFingerprint,
    sourceKind: "mt5_read_only"
  });
}

export function createV2PushFeedRepository({
  asOf,
  getState
}: {
  asOf?: () => string;
  getState: () => V2LegacyPushFeedState;
}): V2CandleRepository {
  return createV2StaticCandleRepository({
    adapterId: V2_PUSH_FEED_ADAPTER_ID,
    adapterVersion: V2_PUSH_FEED_ADAPTER_VERSION,
    asOf,
    async loadSource(source): Promise<V2LegacyCandleSourceSnapshot | undefined> {
      if (source.sourceKind !== "mt5_read_only" || source.provider !== "mt5_push_feed") {
        throw new V2CandleRepositoryError("source_kind_unsupported", "The push adapter accepts only explicit MT5 push-feed identities.");
      }
      const state = getState();
      if (
        state.status.lastCandleFingerprint &&
        state.status.lastCandleFingerprint !== source.sourceFingerprint
      ) {
        throw new V2CandleRepositoryError(
          "source_identity_mismatch",
          "The MT5 push-feed snapshot changed after the V2 source identity was captured."
        );
      }
      const timeframe = source.sourceId.split(":").at(-1) ?? "";
      const candles = findSeries(state, source.brokerSymbol, timeframe);
      if (!candles) return undefined;
      return {
        identity: source,
        timeframe,
        candles,
        closurePolicy: "explicit_closed",
        stale: state.status.status === "stale" || state.status.connectionStatus === "degraded",
        warnings: state.status.warnings
      };
    }
  });
}
