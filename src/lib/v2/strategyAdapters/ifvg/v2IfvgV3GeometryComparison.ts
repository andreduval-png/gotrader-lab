import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import type { V2IfvgV3ParityOutcome } from "./v2IfvgV3Types";
import {
  V2_IFVG_V3_GEOMETRY_COMPARISON_SCHEMA_VERSION,
  type LegacyIfvgV3GeometryObservation,
  type V2IfvgV3GeometryAdapterResult,
  type V2IfvgV3GeometryArtifact,
  type V2IfvgV3GeometryCandidateComparison,
  type V2IfvgV3GeometryComparisonReport
} from "./v2IfvgV3GeometryTypes";

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const sameNumber = (left: number | undefined, right: number | undefined) =>
  left === undefined || right === undefined
    ? left === right
    : Math.abs(left - right) <= 0.0001;

const sameStrings = (left: readonly string[], right: readonly string[]) =>
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

const compareArtifact = (
  candidateId: string,
  legacy?: Readonly<V2IfvgV3GeometryArtifact>,
  v2?: Readonly<V2IfvgV3GeometryArtifact>
): Readonly<V2IfvgV3GeometryCandidateComparison> => {
  if (!legacy) {
    return Object.freeze({
      normalizedCandidateId: candidateId,
      outcome: "v2_only",
      differences: Object.freeze(["geometry_candidate_missing_from_legacy_detector"]),
      v2ArtifactId: v2?.artifactId
    });
  }
  if (!v2) {
    return Object.freeze({
      normalizedCandidateId: candidateId,
      outcome: "legacy_only",
      differences: Object.freeze(["geometry_candidate_missing_from_v2_shadow"]),
      legacyArtifactId: legacy.artifactId
    });
  }
  const differences = uniqueSorted([
    legacy.artifactState === v2.artifactState ? undefined : "geometry_artifact_state_mismatch",
    legacy.direction === v2.direction ? undefined : "direction_mismatch",
    legacy.inversionTime === v2.inversionTime ? undefined : "inversion_time_mismatch",
    legacy.retest?.candleCloseTime === v2.retest?.candleCloseTime ? undefined : "retest_time_mismatch",
    legacy.retest?.barsAfterInversion === v2.retest?.barsAfterInversion
      ? undefined
      : "retest_horizon_mismatch",
    legacy.retest?.cleanRetest === v2.retest?.cleanRetest ? undefined : "clean_retest_mismatch",
    legacy.retest?.signalAgeBars === v2.retest?.signalAgeBars ? undefined : "signal_age_mismatch",
    legacy.retest?.signalFresh === v2.retest?.signalFresh ? undefined : "signal_freshness_mismatch",
    sameNumber(legacy.geometry.zoneLow, v2.geometry.zoneLow) ? undefined : "zone_low_mismatch",
    sameNumber(legacy.geometry.zoneHigh, v2.geometry.zoneHigh) ? undefined : "zone_high_mismatch",
    sameNumber(legacy.geometry.zoneMidpoint, v2.geometry.zoneMidpoint) ? undefined : "zone_midpoint_mismatch",
    sameNumber(legacy.geometry.entry, v2.geometry.entry) ? undefined : "entry_mismatch",
    sameNumber(legacy.geometry.invalidation, v2.geometry.invalidation) ? undefined : "invalidation_mismatch",
    sameNumber(legacy.geometry.target, v2.geometry.target) ? undefined : "target_mismatch",
    sameNumber(legacy.geometry.rr, v2.geometry.rr) ? undefined : "rr_mismatch",
    sameNumber(legacy.geometry.riskDistance, v2.geometry.riskDistance) ? undefined : "risk_distance_mismatch",
    sameNumber(legacy.geometry.targetDistance, v2.geometry.targetDistance)
      ? undefined
      : "target_distance_mismatch",
    legacy.geometry.minimumRR === v2.geometry.minimumRR ? undefined : "minimum_rr_mismatch",
    legacy.targetReference?.type === v2.targetReference?.type ? undefined : "target_type_mismatch",
    sameNumber(legacy.targetReference?.price, v2.targetReference?.price) ? undefined : "target_price_mismatch",
    legacy.constructionValid === v2.constructionValid ? undefined : "construction_validity_mismatch",
    legacy.geometryComplete === v2.geometryComplete ? undefined : "geometry_completeness_mismatch",
    sameStrings(legacy.blockerIds, v2.blockerIds) ? undefined : "geometry_blocker_mismatch"
  ].filter((item): item is string => Boolean(item)));

  return Object.freeze({
    normalizedCandidateId: candidateId,
    outcome: differences.length ? "regression" : "exact_parity",
    differences,
    legacyArtifactId: legacy.artifactId,
    v2ArtifactId: v2.artifactId
  });
};

export const compareLegacyAndV2IfvgV3Geometry = async ({
  legacy,
  v2
}: {
  legacy: Readonly<LegacyIfvgV3GeometryObservation>;
  v2: Readonly<V2IfvgV3GeometryAdapterResult>;
}): Promise<Readonly<V2IfvgV3GeometryComparisonReport>> => {
  assertV2Authority(legacy.authority);
  assertV2Authority(v2.authority);
  const metadataDifferences = uniqueSorted([
    legacy.profileId === v2.profileId ? undefined : "profile_id_mismatch",
    legacy.sourceFingerprint === v2.sourceFingerprint ? undefined : "source_fingerprint_mismatch",
    legacy.contextArtifactId === v2.contextArtifactId ? undefined : "context_artifact_mismatch",
    legacy.primaryWindowIdentityHash === v2.primaryWindowIdentityHash
      ? undefined
      : "primary_window_identity_mismatch"
  ].filter((item): item is string => Boolean(item)));
  const candidateIds = uniqueSorted([
    ...legacy.artifacts.map((artifact) => artifact.normalizedCandidateId),
    ...v2.artifacts.map((artifact) => artifact.normalizedCandidateId)
  ]);
  const rawComparisons = candidateIds.map((candidateId) =>
    compareArtifact(
      candidateId,
      legacy.artifacts.find((artifact) => artifact.normalizedCandidateId === candidateId),
      v2.artifacts.find((artifact) => artifact.normalizedCandidateId === candidateId)
    )
  );
  const legacyCandidatesMatch = legacy.artifacts.every((artifact) =>
    rawComparisons.some((comparison) =>
      comparison.normalizedCandidateId === artifact.normalizedCandidateId &&
      comparison.outcome === "exact_parity"
    )
  );
  const extraV2ArtifactsAreBoundedShadowOutputs = rawComparisons
    .filter((comparison) => comparison.outcome === "v2_only")
    .every((comparison) => {
      const artifact = v2.artifacts.find((candidate) =>
        candidate.normalizedCandidateId === comparison.normalizedCandidateId
      );
      return Boolean(
        artifact &&
        artifact.artifactState !== "insufficient_data" &&
        artifact.canCreateValidationChainEntry === false &&
        artifact.researchOnly === true &&
        artifact.shadowOnly === true &&
        artifact.authority.executionAuthority === "none" &&
        artifact.authority.brokerAuthority === "none" &&
        artifact.authority.readinessOverrideAuthority === "none"
      );
    });
  const normalizeDetectionSetVariance = metadataDifferences.length === 0 &&
    legacy.artifacts.length === 1 &&
    v2.artifacts.length > legacy.artifacts.length &&
    legacyCandidatesMatch &&
    extraV2ArtifactsAreBoundedShadowOutputs;
  const candidateComparisons = Object.freeze(rawComparisons.map((comparison) =>
    normalizeDetectionSetVariance && comparison.outcome === "v2_only"
      ? Object.freeze({
          ...comparison,
          outcome: "acceptable_normalized_variance" as const,
          differences: Object.freeze(["legacy_single_ranked_candidate_vs_v2_geometry_set"])
        })
      : comparison
  ));
  const selectedCandidateGeometryParityAchieved = metadataDifferences.length === 0 &&
    legacy.artifacts.length > 0 &&
    legacyCandidatesMatch;
  const outcome: V2IfvgV3ParityOutcome = metadataDifferences.length > 0 ||
    candidateComparisons.some((comparison) => comparison.outcome === "regression")
    ? "regression"
    : candidateComparisons.some((comparison) => comparison.outcome === "legacy_only")
      ? "legacy_only"
      : candidateComparisons.some((comparison) => comparison.outcome === "v2_only")
        ? "v2_only"
        : candidateComparisons.some((comparison) => comparison.outcome === "acceptable_normalized_variance")
          ? "acceptable_normalized_variance"
          : "exact_parity";
  const documentedVariances = uniqueSorted([
    ...(normalizeDetectionSetVariance ? ["legacy_single_ranked_candidate_vs_v2_geometry_set"] : [])
  ]);
  const differences = uniqueSorted([
    ...metadataDifferences,
    ...candidateComparisons.flatMap((comparison) => comparison.differences)
  ]);
  const limitations = uniqueSorted([
    ...legacy.diagnostics.limitations,
    ...v2.diagnostics.limitations
  ]);
  const reportCore: Omit<V2IfvgV3GeometryComparisonReport, "reportId"> = {
    schemaVersion: V2_IFVG_V3_GEOMETRY_COMPARISON_SCHEMA_VERSION,
    profileId: v2.profileId,
    sourceFingerprint: v2.sourceFingerprint,
    contextArtifactId: v2.contextArtifactId,
    primaryWindowIdentityHash: v2.primaryWindowIdentityHash,
    outcome,
    legacyArtifactCount: legacy.artifacts.length,
    v2ArtifactCount: v2.artifacts.length,
    candidateComparisons,
    differences,
    documentedVariances,
    limitations,
    selectedCandidateGeometryParityAchieved,
    fullCandidateSelectionParityAchieved: false as const,
    fullStrategyParityClaimed: false as const,
    productionAdoptionAllowed: false as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };
  return Object.freeze({
    ...reportCore,
    reportId: await canonicalHash({
      reportType: "ifvg-v3-geometry-shadow-comparison",
      schemaVersion: V2_IFVG_V3_GEOMETRY_COMPARISON_SCHEMA_VERSION,
      sourceFingerprint: v2.sourceFingerprint,
      contextArtifactId: v2.contextArtifactId,
      primaryWindowIdentityHash: v2.primaryWindowIdentityHash,
      outcome,
      candidateComparisons
    })
  });
};
