import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { canonicalHash } from "../../serialization/canonicalSerialization";
import {
  V2_IFVG_V3_SELECTION_COMPARISON_SCHEMA_VERSION,
  type LegacyIfvgV3SelectionObservation,
  type V2IfvgV3SelectionComparisonReport,
  type V2IfvgV3SelectionResult
} from "./v2IfvgV3SelectionTypes";
import type { V2IfvgV3ParityOutcome } from "./v2IfvgV3Types";

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const sameStrings = (left: readonly string[], right: readonly string[]) =>
  JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());

const sameSession = (
  left: LegacyIfvgV3SelectionObservation["selectedCandidate"],
  right: V2IfvgV3SelectionResult["candidates"][number] | undefined
) => JSON.stringify(left?.sessionContext) === JSON.stringify(right?.sessionContext);

export const compareLegacyAndV2IfvgV3Selection = async ({
  legacy,
  v2
}: {
  legacy: Readonly<LegacyIfvgV3SelectionObservation>;
  v2: Readonly<V2IfvgV3SelectionResult>;
}): Promise<Readonly<V2IfvgV3SelectionComparisonReport>> => {
  assertV2Authority(legacy.authority);
  assertV2Authority(v2.authority);
  const legacySelected = legacy.selectedCandidate;
  const v2Selected = v2.candidates.find((candidate) => candidate.selected);
  const metadataDifferences = uniqueSorted([
    legacy.profileId === v2.profileId ? undefined : "profile_id_mismatch",
    legacy.sourceFingerprint === v2.sourceFingerprint ? undefined : "source_fingerprint_mismatch",
    legacy.contextArtifactId === v2.contextArtifactId ? undefined : "context_artifact_mismatch",
    legacy.primaryWindowIdentityHash === v2.primaryWindowIdentityHash
      ? undefined
      : "primary_window_identity_mismatch"
  ].filter((item): item is string => Boolean(item)));
  const identityParity = Boolean(
    legacySelected &&
    v2Selected &&
    legacySelected.normalizedCandidateId === v2Selected.normalizedCandidateId
  );
  const blockerParity = Boolean(
    legacySelected &&
    v2Selected &&
    sameStrings(legacySelected.rankingBlockerIds, v2Selected.rankingBlockerIds) &&
    sameStrings(legacySelected.finalBlockerIds, v2Selected.finalBlockerIds) &&
    legacySelected.baseSelectionReady === v2Selected.baseSelectionReady
  );
  const htfParity = Boolean(
    legacySelected &&
    v2Selected &&
    legacySelected.htfAlignment === v2Selected.htfAlignment &&
    sameStrings(legacySelected.htfDirections, v2Selected.htfDirections)
  );
  const volumeParity = Boolean(
    legacySelected &&
    v2Selected &&
    legacySelected.volumeContext.lowVolume === v2Selected.volumeContext.lowVolume
  );
  const sessionParity = Boolean(legacySelected && v2Selected && sameSession(legacySelected, v2Selected));
  const selectionStateParity = legacy.selectionState === v2.selectionState;
  const noSelectionParity = !legacySelected && !v2Selected && selectionStateParity;
  const candidateDifferences = uniqueSorted([
    selectionStateParity ? undefined : "selection_state_mismatch",
    noSelectionParity || identityParity ? undefined : "selected_candidate_identity_mismatch",
    noSelectionParity || blockerParity ? undefined : "selected_candidate_blocker_mismatch",
    noSelectionParity || htfParity ? undefined : "selected_candidate_htf_alignment_mismatch",
    noSelectionParity || volumeParity ? undefined : "selected_candidate_volume_blocker_mismatch",
    noSelectionParity || sessionParity ? undefined : "selected_candidate_session_context_mismatch",
    v2.selectionState === "ambiguous" ? "v2_candidate_ranking_ambiguous" : undefined
  ].filter((item): item is string => Boolean(item)));
  const differences = uniqueSorted([...metadataDifferences, ...candidateDifferences]);
  const selectedCandidateRankingParityAchieved = metadataDifferences.length === 0 &&
    identityParity &&
    blockerParity &&
    htfParity &&
    volumeParity &&
    sessionParity &&
    selectionStateParity;
  const outcome: V2IfvgV3ParityOutcome = differences.length === 0
    ? "exact_parity"
    : legacy.selectionState === "insufficient_data" || v2.selectionState === "insufficient_data"
      ? "insufficient_comparison_data"
      : "regression";
  const limitations = uniqueSorted([
    ...legacy.diagnostics.limitations,
    ...v2.diagnostics.limitations
  ]);
  const reportCore: Omit<V2IfvgV3SelectionComparisonReport, "reportId"> = {
    schemaVersion: V2_IFVG_V3_SELECTION_COMPARISON_SCHEMA_VERSION,
    profileId: v2.profileId,
    sourceFingerprint: v2.sourceFingerprint,
    contextArtifactId: v2.contextArtifactId,
    primaryWindowIdentityHash: v2.primaryWindowIdentityHash,
    outcome,
    differences,
    limitations,
    legacySelectionState: legacy.selectionState,
    v2SelectionState: v2.selectionState,
    ...(legacy.selectedCandidateId ? { legacySelectedCandidateId: legacy.selectedCandidateId } : {}),
    ...(v2.selectedCandidateId ? { v2SelectedCandidateId: v2.selectedCandidateId } : {}),
    selectedCandidateIdentityParityAchieved: identityParity,
    selectedCandidateBlockerParityAchieved: blockerParity,
    htfAlignmentParityAchieved: htfParity,
    volumeBlockerParityAchieved: volumeParity,
    sessionContextParityAchieved: sessionParity,
    selectedCandidateRankingParityAchieved,
    fullCandidateSetOrderingParityAchieved: false as const,
    fullStrategyParityClaimed: false as const,
    productionAdoptionAllowed: false as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };

  return Object.freeze({
    ...reportCore,
    reportId: await canonicalHash({
      reportType: "ifvg-v3-selection-shadow-comparison",
      schemaVersion: V2_IFVG_V3_SELECTION_COMPARISON_SCHEMA_VERSION,
      sourceFingerprint: v2.sourceFingerprint,
      contextArtifactId: v2.contextArtifactId,
      primaryWindowIdentityHash: v2.primaryWindowIdentityHash,
      outcome,
      differences,
      selectedCandidateRankingParityAchieved
    })
  });
};
