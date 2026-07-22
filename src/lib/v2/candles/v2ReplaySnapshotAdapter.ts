import { createV2SourceIdentity } from "../identity/v2Identity";
import type { V2SourceIdentity } from "../identity/v2IdentityTypes";
import type {
  V2CandleRepository,
  V2LegacyCandleLike,
  V2LegacyCandleSourceSnapshot
} from "./v2CandleTypes";
import { createV2StaticCandleRepository } from "./v2StaticCandleRepository";

export const V2_REPLAY_SNAPSHOT_ADAPTER_ID = "replay-snapshot";
export const V2_REPLAY_SNAPSHOT_ADAPTER_VERSION = "gotrader-v2-replay-snapshot-adapter-v1";

export interface V2ReplaySnapshotInput {
  snapshotId: string;
  sourceFingerprint: string;
  requestedSymbol: string;
  brokerSymbol?: string;
  timeframe: string;
  candles: readonly V2LegacyCandleLike[];
  warnings?: readonly string[];
}

export function replayInputToV2Snapshot(input: V2ReplaySnapshotInput): V2LegacyCandleSourceSnapshot {
  const identity = createV2SourceIdentity({
    sourceId: input.snapshotId,
    provider: "replay_snapshot",
    requestedSymbol: input.requestedSymbol,
    brokerSymbol: input.brokerSymbol ?? input.requestedSymbol,
    sourceFingerprint: input.sourceFingerprint,
    sourceKind: "replay_snapshot"
  });
  return {
    identity,
    timeframe: input.timeframe,
    candles: input.candles,
    closurePolicy: "replay_snapshot",
    stale: false,
    warnings: input.warnings
  };
}

export function createV2ReplaySnapshotRepository({
  asOf,
  loadSnapshot
}: {
  asOf?: () => string;
  loadSnapshot: (source: V2SourceIdentity) => Promise<V2ReplaySnapshotInput | undefined>;
}): V2CandleRepository {
  return createV2StaticCandleRepository({
    adapterId: V2_REPLAY_SNAPSHOT_ADAPTER_ID,
    adapterVersion: V2_REPLAY_SNAPSHOT_ADAPTER_VERSION,
    asOf,
    async loadSource(source) {
      const snapshot = await loadSnapshot(source);
      return snapshot ? replayInputToV2Snapshot(snapshot) : undefined;
    }
  });
}
