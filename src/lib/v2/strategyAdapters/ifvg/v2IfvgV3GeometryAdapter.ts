import { buildIctTradeConstruction } from "../../../ict-strategy-suite/ictTradeConstruction";
import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import type { V2CanonicalCandle } from "../../candles/v2CandleTypes";
import type {
  V2FactEnvelope,
  V2FairValueGapFactPayload
} from "../../context/v2ContextTypes";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import { detectV2IfvgV3Shadow } from "./v2IfvgV3Adapter";
import {
  V2_IFVG_V3_PROFILE_ID,
  V2_IFVG_V3_STRATEGY_ID,
  type V2IfvgV3DetectionArtifact
} from "./v2IfvgV3Types";
import {
  V2_IFVG_V3_GEOMETRY_ADAPTER_ID,
  V2_IFVG_V3_GEOMETRY_ADAPTER_VERSION,
  V2_IFVG_V3_GEOMETRY_ARTIFACT_SCHEMA_VERSION,
  V2_IFVG_V3_GEOMETRY_INPUT_CONTRACT_VERSION,
  V2_IFVG_V3_RETEST_HORIZON_BARS,
  type V2IfvgV3GeometryAdapterResult,
  type V2IfvgV3GeometryArtifact,
  type V2IfvgV3GeometryCanaryInput
} from "./v2IfvgV3GeometryTypes";

type FvgFact = Readonly<V2FactEnvelope<"fair_value_gap", V2FairValueGapFactPayload>>;
type IndexedCandle = Readonly<V2CanonicalCandle> & { index: number };

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const rounded = (value: number, decimals = 4) => Number(value.toFixed(decimals));

const averageRange = (candles: readonly IndexedCandle[]) =>
  candles.length
    ? candles.reduce((total, candle) => total + Math.max(0, candle.high - candle.low), 0) / candles.length
    : 0;

const touchesBounds = (candle: IndexedCandle, low: number, high: number) =>
  candle.high >= low && candle.low <= high;

const retestRespects = (
  candle: IndexedCandle,
  side: "long" | "short",
  low: number,
  high: number
) => side === "long" ? candle.close >= low : candle.close <= high;

const cleanRetest = (
  candle: IndexedCandle,
  side: "long" | "short",
  low: number,
  high: number,
  midpoint: number
) => side === "long"
  ? candle.low <= midpoint && candle.low >= low && candle.close >= midpoint
  : candle.high >= midpoint && candle.high <= high && candle.close <= midpoint;

const stopBufferFor = (
  candles: readonly IndexedCandle[],
  index: number,
  low: number,
  high: number
) => {
  const recentRange = averageRange(candles.slice(Math.max(0, index - 24), index + 1));
  const gapSize = Math.max(0, high - low);
  return Math.max(recentRange * 0.03, gapSize * 0.02, 0.01);
};

const findTarget = (
  candles: readonly IndexedCandle[],
  side: "long" | "short",
  entry: number,
  retestIndex: number
) => {
  const lookback = candles.slice(Math.max(0, retestIndex - 96), retestIndex);
  const minimumDistance = Math.max(
    averageRange(candles.slice(Math.max(0, retestIndex - 24), retestIndex)) * 0.8,
    1
  );
  if (side === "long") {
    return lookback
      .map((candle) => candle.high)
      .filter((price) => price > entry + minimumDistance)
      .sort((left, right) => left - right)[0];
  }
  return lookback
    .map((candle) => candle.low)
    .filter((price) => price < entry - minimumDistance)
    .sort((left, right) => right - left)[0];
};

const buildArtifact = async ({
  contextArtifactId,
  contextIdentityHash,
  detection,
  fact,
  primaryWindowIdentityHash,
  provider,
  candles
}: {
  contextArtifactId: string;
  contextIdentityHash: string;
  detection: Readonly<V2IfvgV3DetectionArtifact>;
  fact: FvgFact;
  primaryWindowIdentityHash: string;
  provider: string;
  candles: readonly IndexedCandle[];
}): Promise<Readonly<V2IfvgV3GeometryArtifact>> => {
  const inversionTime = detection.ifvgReference?.inversionTime;
  const inversionIndex = inversionTime
    ? candles.findIndex((candle) => candle.closeTime === inversionTime)
    : -1;
  const side = detection.direction;
  const low = fact.payload.lowerBound;
  const high = fact.payload.upperBound;
  const midpoint = fact.payload.midpoint;
  const retest = inversionIndex >= 0
    ? candles
        .slice(inversionIndex + 1, inversionIndex + 1 + V2_IFVG_V3_RETEST_HORIZON_BARS)
        .find((candle) => touchesBounds(candle, low, high) && retestRespects(candle, side, low, high))
    : undefined;
  const isCleanRetest = retest ? cleanRetest(retest, side, low, high, midpoint) : false;
  const signalAgeBars = retest ? candles.length - 1 - retest.index : undefined;
  const signalFresh = signalAgeBars === 0;
  const entry = retest ? rounded(midpoint) : undefined;
  const stopBuffer = retest ? stopBufferFor(candles, retest.index, low, high) : undefined;
  const invalidation = entry === undefined || stopBuffer === undefined
    ? undefined
    : side === "long"
      ? rounded(low - stopBuffer)
      : rounded(high + stopBuffer);
  const target = entry === undefined || !retest
    ? undefined
    : findTarget(candles, side, entry, retest.index);
  const construction = buildIctTradeConstruction({
    side,
    entry,
    stop: invalidation,
    target,
    entryModelType: "ifvg",
    structureBounds: {
      ifvgLow: low,
      ifvgHigh: high,
      fvgLow: low,
      fvgHigh: high
    },
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    symbol: detection.source.requestedSymbol,
    brokerSymbol: detection.source.brokerSymbol,
    timeframe: detection.source.timeframe,
    sourceFingerprint: detection.source.sourceFingerprint,
    minimumRR: 2,
    preferredRR: 3,
    authority: V2_AUTHORITY_NONE
  });
  const blockers = uniqueSorted([
    inversionIndex < 0 ? "inversion_candle_missing_from_primary_window" : undefined,
    retest ? undefined : "ifvg_retest_missing",
    retest && !isCleanRetest ? "clean_retest_required" : undefined,
    retest && !signalFresh ? "stale_retest_signal" : undefined,
    ...construction.blockers.filter((blocker) => blocker !== "source_missing")
  ].filter((item): item is string => Boolean(item)));
  const geometryComplete = [
    construction.entry,
    construction.stop,
    construction.target,
    construction.rr
  ].every((value) => typeof value === "number" && Number.isFinite(value));
  const artifactState = inversionIndex < 0
    ? "insufficient_data" as const
    : blockers.length === 0
      ? "constructed" as const
      : "blocked" as const;
  const artifactCore: Omit<V2IfvgV3GeometryArtifact, "artifactId"> = {
    schemaVersion: V2_IFVG_V3_GEOMETRY_ARTIFACT_SCHEMA_VERSION,
    origin: "v2_shadow" as const,
    normalizedCandidateId: detection.normalizedCandidateId,
    detectionArtifactId: detection.artifactId,
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    profileId: V2_IFVG_V3_PROFILE_ID,
    adapterVersion: V2_IFVG_V3_GEOMETRY_ADAPTER_VERSION,
    artifactState,
    direction: side,
    source: Object.freeze({
      provider,
      requestedSymbol: detection.source.requestedSymbol,
      brokerSymbol: detection.source.brokerSymbol,
      sourceFingerprint: detection.source.sourceFingerprint,
      timeframe: detection.source.timeframe
    }),
    contextArtifactId,
    contextIdentityHash,
    primaryWindowIdentityHash,
    inversionTime: inversionTime ?? detection.causalClosedCandleTime,
    ...(retest && signalAgeBars !== undefined ? {
      retest: Object.freeze({
        candleCloseTime: retest.closeTime,
        barsAfterInversion: retest.index - inversionIndex,
        cleanRetest: isCleanRetest,
        signalAgeBars,
        signalFresh
      })
    } : {}),
    geometry: Object.freeze({
      zoneLow: low,
      zoneHigh: high,
      zoneMidpoint: midpoint,
      ...(construction.entry !== undefined ? { entry: construction.entry } : {}),
      ...(construction.stop !== undefined ? { invalidation: construction.stop } : {}),
      ...(construction.target !== undefined ? { target: construction.target } : {}),
      ...(construction.rr !== undefined ? { rr: construction.rr } : {}),
      ...(construction.riskDistance !== undefined ? { riskDistance: construction.riskDistance } : {}),
      ...(construction.targetDistance !== undefined ? { targetDistance: construction.targetDistance } : {}),
      minimumRR: construction.minimumRR
    }),
    ...(target !== undefined ? {
      targetReference: Object.freeze({
        type: side === "long" ? "buy_side_liquidity" as const : "sell_side_liquidity" as const,
        source: "prior_swing" as const,
        price: target
      })
    } : {}),
    constructionValid: construction.valid,
    geometryComplete,
    blockerIds: blockers,
    warningIds: uniqueSorted(construction.warnings),
    limitationIds: Object.freeze([
      "candidate_ranking_deferred",
      "htf_volume_and_session_blocker_parity_deferred",
      "replay_evidence_readiness_deferred"
    ]),
    observedMarketTime: retest?.closeTime ?? inversionTime ?? detection.observedMarketTime,
    causalClosedCandleTime: retest?.closeTime ?? inversionTime ?? detection.causalClosedCandleTime,
    canCreateValidationChainEntry: false as const,
    researchOnly: true as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };
  return Object.freeze({
    ...artifactCore,
    artifactId: await canonicalHash({
      artifactType: "ifvg-v3-geometry-shadow-artifact",
      adapterVersion: V2_IFVG_V3_GEOMETRY_ADAPTER_VERSION,
      contextArtifactId,
      primaryWindowIdentityHash,
      normalizedCandidateId: detection.normalizedCandidateId,
      geometry: artifactCore.geometry,
      ...(artifactCore.retest ? { retest: artifactCore.retest } : {}),
      blockerIds: blockers
    })
  });
};

export const projectV2IfvgV3GeometryShadow = async ({
  context,
  primaryWindow
}: V2IfvgV3GeometryCanaryInput): Promise<Readonly<V2IfvgV3GeometryAdapterResult>> => {
  assertV2Authority(context.authority);
  assertV2Authority(primaryWindow.capability.authority);
  const sourceFingerprint = context.identity.source.sourceFingerprint;
  const primaryReference = context.identity.inputWindows.find((item) => item.timeframe === "5m");
  const blockers = uniqueSorted([
    context.diagnostics.status === "blocked" ? "context_blocked" : undefined,
    context.identity.source.sourceKind === "mock_sample" ? "mock_sample_source_not_eligible" : undefined,
    primaryWindow.diagnostics.status === "blocked" ? "primary_window_blocked" : undefined,
    primaryWindow.identity.source.sourceFingerprint !== sourceFingerprint
      ? "primary_window_source_fingerprint_mismatch"
      : undefined,
    primaryReference?.identityHash !== primaryWindow.identity.identityHash
      ? "primary_window_identity_mismatch"
      : undefined,
    primaryWindow.candles.length === 0 ? "primary_window_empty" : undefined
  ].filter((item): item is string => Boolean(item)));
  const detectionResult = await detectV2IfvgV3Shadow(context);
  const detected = detectionResult.artifacts.filter((artifact) =>
    artifact.artifactState === "detected" &&
    artifact.detectionFlowState === "inversion_confirmed"
  );
  const facts = new Map(
    context.facts
      .filter((fact): fact is FvgFact => fact.kind === "fair_value_gap")
      .map((fact) => [fact.factId, fact])
  );
  const missingFacts = detected
    .filter((artifact) => {
      const factId = artifact.fvgReference.factId;
      return !factId || !facts.has(factId);
    })
    .map(() => "detection_fvg_fact_missing");
  const allBlockers = uniqueSorted([...blockers, ...missingFacts]);
  const indexedCandles = primaryWindow.candles.map((candle, index) => Object.freeze({ ...candle, index }));
  const artifacts = allBlockers.length
    ? Object.freeze([] as Readonly<V2IfvgV3GeometryArtifact>[])
    : Object.freeze(await Promise.all(detected.map((artifact) =>
        buildArtifact({
          contextArtifactId: context.contextArtifactId,
          contextIdentityHash: context.identity.identityHash,
          detection: artifact,
          fact: facts.get(artifact.fvgReference.factId as string) as FvgFact,
          primaryWindowIdentityHash: primaryWindow.identity.identityHash,
          provider: context.identity.source.provider,
          candles: indexedCandles
        })
      )));
  const limitations = uniqueSorted([
    "candidate_ranking_deferred",
    "htf_volume_and_session_blocker_parity_deferred",
    "replay_evidence_readiness_deferred"
  ]);

  return Object.freeze({
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    profileId: V2_IFVG_V3_PROFILE_ID,
    adapterId: V2_IFVG_V3_GEOMETRY_ADAPTER_ID,
    adapterVersion: V2_IFVG_V3_GEOMETRY_ADAPTER_VERSION,
    inputContractVersion: V2_IFVG_V3_GEOMETRY_INPUT_CONTRACT_VERSION,
    contextArtifactId: context.contextArtifactId,
    sourceFingerprint,
    primaryWindowIdentityHash: primaryWindow.identity.identityHash,
    artifacts,
    diagnostics: Object.freeze({
      status: allBlockers.length
        ? "blocked"
        : detectionResult.diagnostics.status === "insufficient_data"
          ? "insufficient_data"
          : "eligible",
      blockers: allBlockers,
      warnings: detectionResult.diagnostics.warnings,
      limitations
    }),
    selectedCandidateRankingMigrated: false,
    fullStrategyParityClaimed: false,
    shadowOnly: true,
    authority: V2_AUTHORITY_NONE
  });
};
