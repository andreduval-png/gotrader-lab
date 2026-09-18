import type { CanonicalTradeGeometry } from "@/lib/tradeGeometry";
import {
  buildCanonicalHistoricalGeometryEnvelope,
  type CanonicalHistoricalGeometryEnvelope,
  type HistoricalIntermediateTarget
} from "./historicalGeometry";
import { BT_G1_1_CERTIFIED_DATASET } from "./certifiedHistoricalDataset";

export type HistoricalGeometryClassification =
  | "CANONICAL_HISTORICAL_NATIVE"
  | "CANONICAL_HISTORICAL_ADAPTER"
  | "SOURCE_BLOCKED"
  | "RESEARCH_ONLY"
  | "ADAPTER_MISSING"
  | "NON_EXECUTABLE";

export type HistoricalSurfaceStatus = "AVAILABLE" | "ADAPTER_MISSING" | "SOURCE_BLOCKED" | "NOT_APPLICABLE";

export interface HistoricalStrategyAdapterDefinition {
  strategyId: string;
  profileId?: string;
  ownerStrategyId?: string;
  classification: HistoricalGeometryClassification;
  reason: string;
  promotionAllowed: false;
  surfaces: {
    envelope: HistoricalSurfaceStatus;
    replay: HistoricalSurfaceStatus;
    walkForward: HistoricalSurfaceStatus;
    oos: HistoricalSurfaceStatus;
    autoResearch: HistoricalSurfaceStatus;
  };
}

const allAvailable = Object.freeze({
  envelope: "AVAILABLE",
  replay: "AVAILABLE",
  walkForward: "AVAILABLE",
  oos: "AVAILABLE",
  autoResearch: "AVAILABLE"
} satisfies HistoricalStrategyAdapterDefinition["surfaces"]);

const missing = Object.freeze({
  envelope: "ADAPTER_MISSING",
  replay: "ADAPTER_MISSING",
  walkForward: "ADAPTER_MISSING",
  oos: "ADAPTER_MISSING",
  autoResearch: "ADAPTER_MISSING"
} satisfies HistoricalStrategyAdapterDefinition["surfaces"]);

const definition = (
  strategyId: string,
  classification: HistoricalGeometryClassification,
  reason: string,
  surfaces: HistoricalStrategyAdapterDefinition["surfaces"],
  profileId?: string,
  ownerStrategyId?: string
): HistoricalStrategyAdapterDefinition => Object.freeze({
  strategyId,
  profileId,
  ownerStrategyId,
  classification,
  reason,
  promotionAllowed: false,
  surfaces
});

export const HISTORICAL_STRATEGY_ADAPTERS: readonly HistoricalStrategyAdapterDefinition[] = Object.freeze([
  definition("ifvg_fresh_retest_v3_research", "CANONICAL_HISTORICAL_ADAPTER", "RC1B invokes the frozen v3 producer and preserves its native lifecycle and geometry.", allAvailable),
  definition("ict_2022_model_v1", "CANONICAL_HISTORICAL_NATIVE", "RC1B invokes the current 2.0.0-int3a owner with causal canonical facts.", allAvailable),
  definition("ict_market_maker_buy_model_v1", "CANONICAL_HISTORICAL_NATIVE", "RC1B invokes the frozen DH4 MarketMakerDeliverySequence owner without transition injection.", allAvailable),
  definition("ict_market_maker_sell_model_v1", "CANONICAL_HISTORICAL_NATIVE", "RC1B invokes the frozen DH4 MarketMakerDeliverySequence owner without transition injection.", allAvailable),
  definition("nasdaq_london_raid_ny_reversal_v1", "CANONICAL_HISTORICAL_ADAPTER", "The corrected live owner and historical fold share nearest-eligible-native-objective target policy v2 without R:R-driven target substitution.", allAvailable),
  definition("ifvg_fresh_retest_v4_candidate", "RESEARCH_ONLY", "IFVG v4 remains isolated and has no live-owner fold binding.", missing)
]);

export const resolveHistoricalStrategyAdapter = (strategyId: string, profileId?: string) =>
  HISTORICAL_STRATEGY_ADAPTERS.find((item) => item.strategyId === strategyId && item.profileId === profileId) ??
  HISTORICAL_STRATEGY_ADAPTERS.find((item) => item.strategyId === strategyId && !item.profileId) ??
  definition(strategyId, "ADAPTER_MISSING", "No canonical historical adapter is registered for this executable identity.", missing, profileId);

export const adaptCanonicalStrategyGeometryForHistorical = ({
  geometry,
  sourceFingerprint,
  datasetId,
  datasetCertificateId,
  costModelId,
  fillModelId,
  sessionPolicyId,
  asOf,
  intermediateTargets
}: {
  geometry: CanonicalTradeGeometry;
  sourceFingerprint: string;
  datasetId?: string;
  datasetCertificateId?: string;
  costModelId: string;
  fillModelId: string;
  sessionPolicyId: string;
  asOf: string;
  intermediateTargets?: readonly HistoricalIntermediateTarget[];
}): { definition: HistoricalStrategyAdapterDefinition; envelope: CanonicalHistoricalGeometryEnvelope } => {
  const adapter = resolveHistoricalStrategyAdapter(geometry.strategyId, geometry.profileId);
  if (adapter.surfaces.envelope !== "AVAILABLE") {
    const code = adapter.classification === "SOURCE_BLOCKED"
      ? "HISTORICAL_GEOMETRY_SOURCE_BLOCKED"
      : "HISTORICAL_GEOMETRY_ADAPTER_MISSING";
    throw new Error(`${code}: ${adapter.strategyId}${adapter.profileId ? `/${adapter.profileId}` : ""}.`);
  }
  if (Boolean(datasetId) !== Boolean(datasetCertificateId)) {
    throw new Error("CERTIFIED_HISTORICAL_DATASET_BINDING_INCOMPLETE");
  }
  if (
    datasetId &&
    (datasetId !== BT_G1_1_CERTIFIED_DATASET.datasetId ||
      datasetCertificateId !== BT_G1_1_CERTIFIED_DATASET.certificateId)
  ) {
    throw new Error("CERTIFIED_HISTORICAL_DATASET_IDENTITY_MISMATCH");
  }
  return {
    definition: adapter,
    envelope: buildCanonicalHistoricalGeometryEnvelope({
      geometry,
      sourceFingerprint,
      datasetId,
      datasetCertificateId,
      costModelId,
      fillModelId,
      sessionPolicyId,
      asOf,
      intermediateTargets
    })
  };
};
