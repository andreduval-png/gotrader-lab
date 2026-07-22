import { V2_MARKET_DATA_READ_ONLY } from "../authority/v2Authority";
import { v2SourceIdentityMatches } from "../identity/v2Identity";
import type { V2SourceIdentity } from "../identity/v2IdentityTypes";
import { buildV2CanonicalCandleWindow } from "./v2CandleWindowBuilder";
import {
  V2CandleRepositoryError,
  type V2CandleRepository,
  type V2CanonicalCandleQuery,
  type V2LegacyCandleSourceSnapshot,
  type V2SourceDescription
} from "./v2CandleTypes";
import { normalizeV2Timeframe } from "./v2Timeframe";

export const V2_STATIC_REPOSITORY_ADAPTER_VERSION = "gotrader-v2-static-repository-v1";

export function createV2StaticCandleRepository({
  adapterId,
  adapterVersion = V2_STATIC_REPOSITORY_ADAPTER_VERSION,
  asOf,
  loadSource
}: {
  adapterId: string;
  adapterVersion?: string;
  asOf?: () => string;
  loadSource: (source: V2SourceIdentity) => Promise<V2LegacyCandleSourceSnapshot | undefined>;
}): V2CandleRepository {
  const resolve = async (requested: V2SourceIdentity) => {
    const source = await loadSource(requested);
    if (!source) {
      throw new V2CandleRepositoryError("source_unavailable", `V2 source is unavailable: ${requested.sourceId}`);
    }
    if (!v2SourceIdentityMatches(requested, source.identity)) {
      throw new V2CandleRepositoryError("source_identity_mismatch", `V2 source identity changed for ${requested.sourceId}.`);
    }
    return source;
  };

  return Object.freeze({
    async getWindow(query: V2CanonicalCandleQuery) {
      const source = await resolve(query.source);
      if (normalizeV2Timeframe(source.timeframe) !== normalizeV2Timeframe(query.timeframe)) {
        throw new V2CandleRepositoryError(
          "timeframe_unavailable",
          `${query.timeframe} is unavailable for V2 source ${query.source.sourceId}.`
        );
      }
      return buildV2CanonicalCandleWindow({
        adapterId,
        adapterVersion,
        asOf: asOf?.(),
        closurePolicy: source.closurePolicy,
        legacyCandles: source.candles,
        query,
        source: source.identity,
        sourceStale: source.stale,
        sourceWarnings: source.warnings,
        timeNormalizationPolicyId: source.timeNormalizationPolicyId,
        timeNormalizationPolicyVersion: source.timeNormalizationPolicyVersion
      });
    },
    async getAvailableTimeframes(sourceIdentity: V2SourceIdentity) {
      const source = await resolve(sourceIdentity);
      return Object.freeze([normalizeV2Timeframe(source.timeframe)]);
    },
    async describeSource(sourceIdentity: V2SourceIdentity): Promise<V2SourceDescription> {
      const source = await resolve(sourceIdentity);
      return Object.freeze({
        adapterId,
        adapterVersion,
        source: source.identity,
        availableTimeframes: Object.freeze([normalizeV2Timeframe(source.timeframe)]),
        sourceKind: source.identity.sourceKind,
        stale: Boolean(source.stale),
        warnings: Object.freeze([...(source.warnings ?? [])]),
        capability: V2_MARKET_DATA_READ_ONLY,
        providerTimeBasis: source.providerTimeBasis,
        timeNormalizationPolicyId: source.timeNormalizationPolicyId,
        timeNormalizationPolicyVersion: source.timeNormalizationPolicyVersion,
        shadowOnly: true as const
      });
    }
  });
}
