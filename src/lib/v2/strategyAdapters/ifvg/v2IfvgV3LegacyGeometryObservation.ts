import type { IctIfvgFreshRetestV3Assessment } from "../../../ict-strategy-suite/ictIfvgFreshRetestV3";
import type { IctIfvgCandidate } from "../../../ict-strategy-suite/ictIfvgTypes";
import { V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import { addTimeframeDuration } from "./v2IfvgV3Identity";
import { buildLegacyIfvgV3DetectionObservation } from "./v2IfvgV3LegacyObservation";
import {
  V2_IFVG_V3_PROFILE_ID,
  V2_IFVG_V3_STRATEGY_ID
} from "./v2IfvgV3Types";
import {
  V2_IFVG_V3_GEOMETRY_ARTIFACT_SCHEMA_VERSION,
  type LegacyIfvgV3GeometryObservation,
  type V2IfvgV3GeometryArtifact
} from "./v2IfvgV3GeometryTypes";

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

export const buildLegacyIfvgV3GeometryObservation = async ({
  assessment,
  candidate,
  contextArtifactId,
  primaryWindowIdentityHash
}: {
  assessment: Readonly<IctIfvgFreshRetestV3Assessment>;
  candidate: Readonly<IctIfvgCandidate>;
  contextArtifactId: string;
  primaryWindowIdentityHash: string;
}): Promise<Readonly<LegacyIfvgV3GeometryObservation>> => {
  const detection = await buildLegacyIfvgV3DetectionObservation({
    assessment,
    candidate,
    contextArtifactId
  });
  const detected = detection.artifacts[0];
  const sourceFingerprint = candidate.sourceFingerprint ?? "missing_source_fingerprint";
  if (!detected || !candidate.ifvgBounds || !candidate.inversionCandle) {
    return Object.freeze({
      strategyId: V2_IFVG_V3_STRATEGY_ID,
      profileId: V2_IFVG_V3_PROFILE_ID,
      sourceFingerprint,
      contextArtifactId,
      primaryWindowIdentityHash,
      artifacts: Object.freeze([]),
      diagnostics: Object.freeze({
        status: candidate.status === "needs_more_data" ? "insufficient_data" : "eligible",
        blockers: Object.freeze([]),
        warnings: Object.freeze([]),
        limitations: Object.freeze([
          "candidate_ranking_deferred",
          "htf_volume_and_session_blocker_parity_deferred",
          "replay_evidence_readiness_deferred"
        ])
      }),
      shadowOnly: true,
      authority: V2_AUTHORITY_NONE
    });
  }

  const timeframe = candidate.timeframe || "5m";
  const inversionTime = addTimeframeDuration(candidate.inversionCandle.timestamp, timeframe);
  const retestCloseTime = candidate.retestCandle
    ? addTimeframeDuration(candidate.retestCandle.timestamp, timeframe)
    : undefined;
  const construction = candidate.tradeConstruction;
  const blockers = uniqueSorted([
    candidate.retestCandle ? undefined : "ifvg_retest_missing",
    candidate.retestCandle && !assessment.cleanRetest ? "clean_retest_required" : undefined,
    candidate.retestCandle && !assessment.signalFresh ? "stale_retest_signal" : undefined,
    ...(construction?.blockers ?? []).filter((blocker) => blocker !== "source_missing")
  ].filter((item): item is string => Boolean(item)));
  const geometryComplete = [
    candidate.entry,
    candidate.stop,
    candidate.target,
    candidate.rr
  ].every((value) => typeof value === "number" && Number.isFinite(value));
  const geometry = Object.freeze({
    zoneLow: candidate.ifvgBounds.low,
    zoneHigh: candidate.ifvgBounds.high,
    zoneMidpoint: candidate.ifvgBounds.midpoint,
    ...(candidate.entry !== undefined ? { entry: candidate.entry } : {}),
    ...(candidate.stop !== undefined ? { invalidation: candidate.stop } : {}),
    ...(candidate.target !== undefined ? { target: candidate.target } : {}),
    ...(candidate.rr !== undefined ? { rr: candidate.rr } : {}),
    ...(construction?.riskDistance !== undefined ? { riskDistance: construction.riskDistance } : {}),
    ...(construction?.targetDistance !== undefined ? { targetDistance: construction.targetDistance } : {}),
    minimumRR: construction?.minimumRR ?? 2
  });
  const retest = candidate.retestCandle && retestCloseTime
    ? Object.freeze({
        candleCloseTime: retestCloseTime,
        barsAfterInversion:
          candidate.retestCandle.candleIndex - candidate.inversionCandle.candleIndex,
        cleanRetest: assessment.cleanRetest,
        signalAgeBars: assessment.signalAgeBars ?? 0,
        signalFresh: assessment.signalFresh
      })
    : undefined;
  const artifactCore: Omit<V2IfvgV3GeometryArtifact, "artifactId"> = {
    schemaVersion: V2_IFVG_V3_GEOMETRY_ARTIFACT_SCHEMA_VERSION,
    origin: "legacy_normalized" as const,
    normalizedCandidateId: detected.normalizedCandidateId,
    detectionArtifactId: detected.artifactId,
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    profileId: V2_IFVG_V3_PROFILE_ID,
    adapterVersion: "legacy-ifvg-v3-geometry-normalization-v1",
    artifactState: blockers.length === 0 ? "constructed" as const : "blocked" as const,
    direction: detected.direction,
    source: Object.freeze({
      provider: candidate.sourceProvider ?? "unknown",
      requestedSymbol: candidate.requestedSymbol ?? "unknown",
      brokerSymbol: candidate.brokerSymbol ?? "unknown",
      sourceFingerprint,
      timeframe
    }),
    contextArtifactId,
    contextIdentityHash: "legacy_detector_context",
    primaryWindowIdentityHash,
    inversionTime,
    ...(retest ? { retest } : {}),
    geometry,
    ...(candidate.liquidityTarget ? {
      targetReference: Object.freeze({
        type: candidate.liquidityTarget.type,
        source: "prior_swing" as const,
        price: candidate.liquidityTarget.price
      })
    } : {}),
    constructionValid: construction?.valid === true,
    geometryComplete,
    blockerIds: blockers,
    warningIds: uniqueSorted(construction?.warnings ?? []),
    limitationIds: Object.freeze([
      "legacy_detection_normalized_by_semantic_identity",
      "candidate_ranking_deferred",
      "htf_volume_and_session_blocker_parity_deferred",
      "replay_evidence_readiness_deferred"
    ]),
    observedMarketTime: retestCloseTime ?? inversionTime,
    causalClosedCandleTime: retestCloseTime ?? inversionTime,
    canCreateValidationChainEntry: false as const,
    researchOnly: true as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };
  const artifact: Readonly<V2IfvgV3GeometryArtifact> = Object.freeze({
    ...artifactCore,
    artifactId: await canonicalHash({
      artifactType: "legacy-ifvg-v3-geometry-observation",
      contextArtifactId,
      primaryWindowIdentityHash,
      normalizedCandidateId: detected.normalizedCandidateId,
      geometry,
      ...(retest ? { retest } : {}),
      blockerIds: blockers
    })
  });

  return Object.freeze({
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    profileId: V2_IFVG_V3_PROFILE_ID,
    sourceFingerprint,
    contextArtifactId,
    primaryWindowIdentityHash,
    artifacts: Object.freeze([artifact]),
    diagnostics: Object.freeze({
      status: "eligible",
      blockers: Object.freeze([]),
      warnings: Object.freeze([]),
      limitations: Object.freeze([
        "candidate_ranking_deferred",
        "htf_volume_and_session_blocker_parity_deferred",
        "replay_evidence_readiness_deferred"
      ])
    }),
    shadowOnly: true,
    authority: V2_AUTHORITY_NONE
  });
};
