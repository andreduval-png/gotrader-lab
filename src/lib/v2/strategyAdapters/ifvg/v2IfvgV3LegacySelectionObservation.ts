import type { IctIfvgFreshRetestV3Assessment } from "../../../ict-strategy-suite/ictIfvgFreshRetestV3";
import type { IctIfvgCandidate } from "../../../ict-strategy-suite/ictIfvgTypes";
import { V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import { buildLegacyIfvgV3GeometryObservation } from "./v2IfvgV3LegacyGeometryObservation";
import {
  V2_IFVG_V3_SELECTION_ARTIFACT_SCHEMA_VERSION,
  type LegacyIfvgV3SelectionObservation,
  type V2IfvgV3RankedCandidate
} from "./v2IfvgV3SelectionTypes";
import {
  V2_IFVG_V3_PROFILE_ID,
  V2_IFVG_V3_STRATEGY_ID
} from "./v2IfvgV3Types";

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const normalizeBlocker = (blocker: string) => {
  const normalized = blocker.trim().toLowerCase();
  if (!normalized || normalized === "base_ifvg_not_validation_eligible") return undefined;
  if (normalized.includes("never fully inverted")) return "full_inversion_not_confirmed";
  if (normalized.includes("already used before inversion")) return "ifvg_zone_used_before_inversion";
  if (normalized.includes("against available htf")) return "against_htf";
  if (normalized.includes("low-volume")) return "low_volume_inversion";
  if (normalized.includes("did not retest")) return "ifvg_retest_missing";
  if (normalized.includes("no next draw-on-liquidity")) return "liquidity_target_missing";
  if (normalized === "clean_retest_required") return "clean_retest_required";
  if (normalized === "stale_retest_signal") return "stale_retest_signal";
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
};

const normalizeBlockers = (blockers: readonly string[]) => uniqueSorted(
  blockers
    .map(normalizeBlocker)
    .filter((blocker): blocker is string => Boolean(blocker))
);

export const buildLegacyIfvgV3SelectionObservation = async ({
  assessment,
  candidate,
  contextArtifactId,
  primaryWindowIdentityHash
}: {
  assessment: Readonly<IctIfvgFreshRetestV3Assessment>;
  candidate: Readonly<IctIfvgCandidate>;
  contextArtifactId: string;
  primaryWindowIdentityHash: string;
}): Promise<Readonly<LegacyIfvgV3SelectionObservation>> => {
  const geometry = await buildLegacyIfvgV3GeometryObservation({
    assessment,
    candidate,
    contextArtifactId,
    primaryWindowIdentityHash
  });
  const geometryArtifact = geometry.artifacts[0];
  const sourceFingerprint = candidate.sourceFingerprint ?? "missing_source_fingerprint";
  const rankingBlockerIds = normalizeBlockers(candidate.blockers);
  const finalBlockerIds = normalizeBlockers(assessment.blockers);
  const recencyIndex =
    candidate.retestCandle?.candleIndex ??
    candidate.inversionCandle?.candleIndex ??
    candidate.originalFvgCandle?.candleIndex ??
    -1;
  const lowVolume = candidate.status === "blocked_low_volume" ||
    candidate.blockers.some((blocker) => /low-volume/i.test(blocker));
  const sessionContext = candidate.sessionContext
    ? Object.freeze({
        id: candidate.sessionContext.id,
        label: candidate.sessionContext.label,
        localTime: candidate.sessionContext.localTime,
        timingZone: candidate.sessionContext.timingZone,
        preferredWindow: candidate.sessionContext.preferredWindow
      })
    : undefined;
  const selectedCandidate: Readonly<V2IfvgV3RankedCandidate> | undefined = geometryArtifact
    ? Object.freeze({
        normalizedCandidateId: geometryArtifact.normalizedCandidateId,
        geometryArtifactId: geometryArtifact.artifactId,
        direction: geometryArtifact.direction,
        selected: true,
        rank: 1,
        rankKey: Object.freeze({
          readyRank: rankingBlockerIds.length === 0 ? 1 as const : 0 as const,
          blockerCount: rankingBlockerIds.length,
          recencyIndex,
          discoveryIndex: 0
        }),
        baseSelectionReady: rankingBlockerIds.length === 0,
        htfAlignment: candidate.htfAlignment,
        htfDirections: Object.freeze([...candidate.htfDirections]),
        volumeContext: Object.freeze({
          lowVolume,
          policy: "inversion_vs_prior_24_positive_volume_35pct" as const
        }),
        ...(sessionContext ? { sessionContext } : {}),
        rankingBlockerIds,
        finalBlockerIds,
        warningIds: uniqueSorted(candidate.warnings),
        canCreateValidationChainEntry: false as const,
        researchOnly: true as const,
        shadowOnly: true as const,
        authority: V2_AUTHORITY_NONE
      })
    : undefined;
  const selectionState = selectedCandidate
    ? "selected" as const
    : candidate.status === "needs_more_data"
      ? "insufficient_data" as const
      : "no_candidate" as const;
  const artifactCore: Omit<LegacyIfvgV3SelectionObservation, "selectionArtifactId"> = {
    schemaVersion: V2_IFVG_V3_SELECTION_ARTIFACT_SCHEMA_VERSION,
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    profileId: V2_IFVG_V3_PROFILE_ID,
    sourceFingerprint,
    contextArtifactId,
    primaryWindowIdentityHash,
    selectionState,
    ...(selectedCandidate ? {
      selectedCandidateId: selectedCandidate.normalizedCandidateId,
      selectedCandidate
    } : {}),
    diagnostics: Object.freeze({
      status: selectionState === "insufficient_data" ? "insufficient_data" as const : "eligible" as const,
      blockers: Object.freeze([] as string[]),
      warnings: Object.freeze([] as string[]),
      limitations: Object.freeze([
        "legacy_public_detector_exposes_selected_candidate_only",
        "replay_evidence_readiness_deferred"
      ])
    }),
    fullCandidateSetOrderingObservable: false as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };

  return Object.freeze({
    ...artifactCore,
    selectionArtifactId: await canonicalHash({
      artifactType: "legacy-ifvg-v3-selection-observation",
      contextArtifactId,
      primaryWindowIdentityHash,
      selectionState,
      ...(selectedCandidate ? { selectedCandidate } : {})
    })
  });
};
