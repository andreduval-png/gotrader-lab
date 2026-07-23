import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import {
  V2_IFVG_V3_COMPARISON_SCHEMA_VERSION,
  V2_IFVG_V3_MAX_INVERSION_BARS,
  V2_IFVG_V3_PROFILE_ID,
  type LegacyIfvgV3DetectionObservation,
  type V2IfvgV3AdapterResult,
  type V2IfvgV3CandidateComparison,
  type V2IfvgV3ComparisonReport,
  type V2IfvgV3DetectionArtifact,
  type V2IfvgV3ParityOutcome
} from "./v2IfvgV3Types";

const detected = (artifacts: readonly Readonly<V2IfvgV3DetectionArtifact>[]) =>
  artifacts.filter((artifact) =>
    artifact.artifactState === "detected" &&
    artifact.detectionFlowState === "inversion_confirmed"
  );

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const compareCandidate = (
  candidateId: string,
  legacy?: Readonly<V2IfvgV3DetectionArtifact>,
  v2?: Readonly<V2IfvgV3DetectionArtifact>
): Readonly<V2IfvgV3CandidateComparison> => {
  if (!legacy) {
    return Object.freeze({
      normalizedCandidateId: candidateId,
      outcome: "v2_only",
      differences: Object.freeze(["candidate_missing_from_legacy_detector"]),
      v2ArtifactId: v2?.artifactId
    });
  }
  if (!v2) {
    return Object.freeze({
      normalizedCandidateId: candidateId,
      outcome: "legacy_only",
      differences: Object.freeze(["candidate_missing_from_v2_adapter"]),
      legacyArtifactId: legacy.artifactId
    });
  }
  const differences = [
    legacy.direction === v2.direction ? undefined : "direction_mismatch",
    legacy.fvgReference.semanticIdentityHash === v2.fvgReference.semanticIdentityHash
      ? undefined
      : "fvg_identity_mismatch",
    legacy.ifvgReference?.inversionTime === v2.ifvgReference?.inversionTime
      ? undefined
      : "inversion_time_mismatch",
    legacy.ifvgReference?.inversionBarsAfterConfirmation === v2.ifvgReference?.inversionBarsAfterConfirmation
      ? undefined
      : "inversion_horizon_mismatch",
    legacy.fvgReference.preInversionUsage === v2.fvgReference.preInversionUsage
      ? undefined
      : "pre_inversion_usage_mismatch",
    legacy.detectionFlowState === v2.detectionFlowState ? undefined : "detection_flow_state_mismatch",
    JSON.stringify(legacy.blockerIds) === JSON.stringify(v2.blockerIds)
      ? undefined
      : "detection_blocker_mismatch"
  ].filter((item): item is string => Boolean(item));
  const outcome: V2IfvgV3ParityOutcome = differences.length > 0 ? "regression" : "exact_parity";
  return Object.freeze({
    normalizedCandidateId: candidateId,
    outcome,
    differences: Object.freeze(differences),
    legacyArtifactId: legacy.artifactId,
    v2ArtifactId: v2.artifactId
  });
};

const overallOutcome = (
  comparisons: readonly Readonly<V2IfvgV3CandidateComparison>[],
  detectionBlockingLimitations: readonly string[],
  metadataDifferences: readonly string[]
): V2IfvgV3ParityOutcome => {
  if (metadataDifferences.length > 0) return "regression";
  if (comparisons.some((comparison) => comparison.outcome === "regression")) return "regression";
  if (comparisons.some((comparison) => comparison.outcome === "legacy_only")) return "legacy_only";
  if (comparisons.some((comparison) => comparison.outcome === "v2_only")) return "v2_only";
  if (
    detectionBlockingLimitations.length > 0 ||
    comparisons.some((comparison) => comparison.outcome === "insufficient_comparison_data")
  ) return "insufficient_comparison_data";
  if (comparisons.some((comparison) => comparison.outcome === "acceptable_normalized_variance")) {
    return "acceptable_normalized_variance";
  }
  return "exact_parity";
};

export const compareLegacyAndV2IfvgV3Detection = async ({
  legacy,
  v2
}: {
  legacy: Readonly<LegacyIfvgV3DetectionObservation>;
  v2: Readonly<V2IfvgV3AdapterResult>;
}): Promise<Readonly<V2IfvgV3ComparisonReport>> => {
  assertV2Authority(legacy.authority);
  assertV2Authority(v2.authority);
  const metadataDifferences = uniqueSorted([
    legacy.profileId === v2.profileId ? undefined : "profile_id_mismatch",
    legacy.sourceFingerprint === v2.sourceFingerprint ? undefined : "source_fingerprint_mismatch",
    legacy.contextArtifactId === v2.contextArtifactId ? undefined : "context_artifact_id_mismatch"
  ].filter((item): item is string => Boolean(item)));
  const legacyDetected = detected(legacy.artifacts);
  const v2Detected = detected(v2.artifacts);
  const candidateIds = uniqueSorted([
    ...legacyDetected.map((artifact) => artifact.normalizedCandidateId),
    ...v2Detected.map((artifact) => artifact.normalizedCandidateId)
  ]);
  const rawCandidateComparisons = candidateIds.map((candidateId) =>
    compareCandidate(
      candidateId,
      legacyDetected.find((artifact) => artifact.normalizedCandidateId === candidateId),
      v2Detected.find((artifact) => artifact.normalizedCandidateId === candidateId)
    )
  );
  const legacyCandidatesMatched = legacyDetected.every((legacyArtifact) =>
    rawCandidateComparisons.some((comparison) =>
      comparison.normalizedCandidateId === legacyArtifact.normalizedCandidateId &&
      comparison.outcome === "exact_parity"
    )
  );
  const v2OnlyCandidatesAreDetectionValid = rawCandidateComparisons
    .filter((comparison) => comparison.outcome === "v2_only")
    .every((comparison) => {
      const artifact = v2Detected.find((candidate) =>
        candidate.normalizedCandidateId === comparison.normalizedCandidateId
      );
      return artifact?.fvgReference.preInversionUsage === "unused" &&
        artifact.ifvgReference?.inversionBarsAfterConfirmation !== undefined &&
        artifact.ifvgReference.inversionBarsAfterConfirmation <= V2_IFVG_V3_MAX_INVERSION_BARS;
    });
  const normalizeSingleLegacyOutput = legacyDetected.length === 1 &&
    v2Detected.length > legacyDetected.length &&
    legacyCandidatesMatched &&
    v2OnlyCandidatesAreDetectionValid;
  const candidateComparisons = Object.freeze(rawCandidateComparisons.map((comparison) =>
    normalizeSingleLegacyOutput && comparison.outcome === "v2_only"
      ? Object.freeze({
          ...comparison,
          outcome: "acceptable_normalized_variance" as const,
          differences: Object.freeze(["legacy_single_ranked_candidate_vs_v2_detection_set"])
        })
      : comparison
  ));
  const limitations = uniqueSorted([
    ...legacy.diagnostics.limitations,
    ...v2.diagnostics.limitations,
    ...v2Detected.flatMap((artifact) => artifact.limitationIds)
  ]);
  const detectionBlockingLimitations = limitations.filter((limitation) =>
    limitation !== "fresh_retest_history_deferred_to_phase_3b"
  );
  const documentedVariances = uniqueSorted([
    ...(normalizeSingleLegacyOutput ? ["legacy_single_ranked_candidate_vs_v2_detection_set"] : [])
  ]);
  const differences = uniqueSorted([
    ...metadataDifferences,
    ...candidateComparisons.flatMap((comparison) => comparison.differences)
  ]);
  const outcome = overallOutcome(candidateComparisons, detectionBlockingLimitations, metadataDifferences);
  const reportCore: Omit<V2IfvgV3ComparisonReport, "reportId"> = {
    schemaVersion: V2_IFVG_V3_COMPARISON_SCHEMA_VERSION,
    profileId: V2_IFVG_V3_PROFILE_ID,
    contextArtifactId: v2.contextArtifactId,
    sourceFingerprint: v2.sourceFingerprint,
    outcome,
    legacyDetectedCount: legacyDetected.length,
    v2DetectedCount: v2Detected.length,
    candidateComparisons,
    differences,
    documentedVariances,
    limitations,
    detectionParityAchieved: outcome === "exact_parity" || outcome === "acceptable_normalized_variance",
    fullStrategyParityClaimed: false as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };
  return Object.freeze({
    ...reportCore,
    reportId: await canonicalHash(reportCore)
  });
};
