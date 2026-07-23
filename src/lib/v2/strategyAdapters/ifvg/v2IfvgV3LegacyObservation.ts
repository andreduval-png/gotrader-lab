import type { IctIfvgFreshRetestV3Assessment } from "../../../ict-strategy-suite/ictIfvgFreshRetestV3";
import type { IctIfvgCandidate } from "../../../ict-strategy-suite/ictIfvgTypes";
import { V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import {
  V2_IFVG_V3_ARTIFACT_SCHEMA_VERSION,
  V2_IFVG_V3_PROFILE_ID,
  V2_IFVG_V3_STRATEGY_ID,
  type LegacyIfvgV3DetectionObservation,
  type V2IfvgV3DetectionArtifact
} from "./v2IfvgV3Types";
import {
  addTimeframeDuration,
  buildV2IfvgV3ArtifactIdentity,
  buildV2IfvgV3CandidateIdentity,
  buildV2IfvgV3FvgSemanticIdentity
} from "./v2IfvgV3Identity";

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

export const buildLegacyIfvgV3DetectionObservation = async ({
  assessment,
  candidate,
  contextArtifactId
}: {
  assessment: Readonly<IctIfvgFreshRetestV3Assessment>;
  candidate: Readonly<IctIfvgCandidate>;
  contextArtifactId: string;
}): Promise<Readonly<LegacyIfvgV3DetectionObservation>> => {
  const sourceFingerprint = candidate.sourceFingerprint ?? "missing_source_fingerprint";
  if (!candidate.originalFvgCandle || !candidate.ifvgBounds || !candidate.originalFvgDirection) {
    return Object.freeze({
      strategyId: V2_IFVG_V3_STRATEGY_ID,
      profileId: V2_IFVG_V3_PROFILE_ID,
      sourceFingerprint,
      contextArtifactId,
      artifacts: Object.freeze([]),
      diagnostics: Object.freeze({
        status: candidate.status === "needs_more_data" ? "insufficient_data" : "eligible",
        blockers: Object.freeze([]),
        warnings: Object.freeze([]),
        limitations: Object.freeze([])
      }),
      shadowOnly: true,
      authority: V2_AUTHORITY_NONE
    });
  }

  const timeframe = candidate.timeframe || "5m";
  const confirmationCandleTime = addTimeframeDuration(candidate.originalFvgCandle.timestamp, timeframe);
  if (!candidate.inversionCandle) {
    return Object.freeze({
      strategyId: V2_IFVG_V3_STRATEGY_ID,
      profileId: V2_IFVG_V3_PROFILE_ID,
      sourceFingerprint,
      contextArtifactId,
      artifacts: Object.freeze([]),
      diagnostics: Object.freeze({
        status: "eligible",
        blockers: Object.freeze([]),
        warnings: Object.freeze([]),
        limitations: Object.freeze([])
      }),
      shadowOnly: true,
      authority: V2_AUTHORITY_NONE
    });
  }

  const inversionTime = addTimeframeDuration(candidate.inversionCandle.timestamp, timeframe);
  const inversionBarsAfterConfirmation = Math.max(
    0,
    candidate.inversionCandle.candleIndex - candidate.originalFvgCandle.candleIndex
  );
  const preInversionUsage = candidate.missingConditions.includes("unused_ifvg_zone")
    ? "used" as const
    : "unused" as const;
  const direction = candidate.side === "short" ? "short" as const : "long" as const;
  const semanticIdentityHash = await buildV2IfvgV3FvgSemanticIdentity({
    confirmationCandleTime,
    direction: candidate.originalFvgDirection,
    lowerBound: candidate.ifvgBounds.low,
    sourceFingerprint,
    timeframe,
    upperBound: candidate.ifvgBounds.high
  });
  const normalizedCandidateId = await buildV2IfvgV3CandidateIdentity({
    direction,
    fvgSemanticIdentityHash: semanticIdentityHash,
    inversionTime,
    sourceFingerprint,
    timeframe
  });
  const artifactId = await buildV2IfvgV3ArtifactIdentity({
    adapterVersion: "legacy-ifvg-v3-normalization-v1",
    contextArtifactId,
    normalizedCandidateId
  });
  const blockerIds = uniqueSorted([
    candidate.missingConditions.includes("unused_ifvg_zone")
      ? "ifvg_zone_used_before_inversion"
      : undefined
  ].filter((item): item is string => Boolean(item)));
  const artifact: Readonly<V2IfvgV3DetectionArtifact> = Object.freeze({
    schemaVersion: V2_IFVG_V3_ARTIFACT_SCHEMA_VERSION,
    artifactId,
    normalizedCandidateId,
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    profileId: V2_IFVG_V3_PROFILE_ID,
    adapterVersion: "legacy-ifvg-v3-normalization-v1",
    artifactState: "detected",
    detectionFlowState: "inversion_confirmed",
    direction,
    source: Object.freeze({
      provider: candidate.sourceProvider ?? "unknown",
      requestedSymbol: candidate.requestedSymbol ?? "unknown",
      brokerSymbol: candidate.brokerSymbol ?? "unknown",
      sourceFingerprint,
      timeframe
    }),
    contextArtifactId,
    contextIdentityHash: "legacy_detector_context",
    fvgReference: Object.freeze({
      semanticIdentityHash,
      originalDirection: candidate.originalFvgDirection,
      confirmationCandleTime,
      lifecycleState: "inverted",
      lifecycleTransitions: Object.freeze([
        Object.freeze({
          state: "fresh",
          candleTime: confirmationCandleTime,
          barsAfterConfirmation: 0
        }),
        Object.freeze({
          state: "inverted",
          candleTime: inversionTime,
          barsAfterConfirmation: inversionBarsAfterConfirmation
        })
      ]),
      preInversionUsage
    }),
    ifvgReference: Object.freeze({
      inversionTime,
      inversionBarsAfterConfirmation,
      derivedFromLifecycleState: "inverted"
    }),
    liquidityFactIds: Object.freeze([]),
    confirmationState: "confirmed_closed_candle",
    blockerIds,
    limitationIds: Object.freeze([
      "legacy_fact_ids_normalized_by_semantic_identity",
      assessment.signalFresh ? "" : "legacy_fresh_retest_not_current"
    ].filter(Boolean)),
    observedMarketTime: inversionTime,
    causalClosedCandleTime: inversionTime,
    policyVersion: "legacy-ifvg-v1-plus-fresh-retest-v3",
    shadowOnly: true,
    authority: V2_AUTHORITY_NONE
  });

  return Object.freeze({
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    profileId: V2_IFVG_V3_PROFILE_ID,
    sourceFingerprint,
    contextArtifactId,
    artifacts: Object.freeze([artifact]),
    diagnostics: Object.freeze({
      status: "eligible",
      blockers: Object.freeze([]),
      warnings: Object.freeze([]),
      limitations: Object.freeze([])
    }),
    shadowOnly: true,
    authority: V2_AUTHORITY_NONE
  });
};
