import type { V2Authority } from "../../authority/v2Authority";
import type { V2HistoricalDatasetManifest } from "../../evidence/v2HistoricalDatasetManifestTypes";
import type {
  V2IfvgV2OosSummary,
  V2IfvgV2ReplaySummary,
  V2IfvgV3OosSummary,
  V2IfvgV3ReplaySummary
} from "./v2IfvgPhase3CanaryTypes";

export const V2_IFVG_PHASE3_EVIDENCE_SCHEMA = "gotrader-v2-ifvg-phase3-evidence-bundle";
export const V2_IFVG_PHASE3_EVIDENCE_VERSION = "phase-3f-v1";
export const V2_IFVG_PHASE3_EVIDENCE_FILE_SCHEMA =
  "gotrader-v2-ifvg-phase3-evidence-file";
export const V2_IFVG_PHASE3_EVIDENCE_FILE_VERSION = "phase-3f-v1";

export type V2IfvgPhase3EvidenceProfileId =
  | "ifvg_fresh_retest_v3_research"
  | "ifvg_filtered_v2_research";
export type V2IfvgPhase3EvidenceArtifactKind = "replay" | "oos";
export type V2IfvgPhase3EvidenceMetrics =
  | V2IfvgV3ReplaySummary
  | V2IfvgV3OosSummary
  | V2IfvgV2ReplaySummary
  | V2IfvgV2OosSummary;

export interface V2IfvgPhase3EvidenceDatasetReference {
  datasetId: string;
  canonicalSourceFingerprint: string;
  datasetChecksum: string;
  timeNormalizationPolicyId: string;
  timeNormalizationPolicyVersion: string;
  timeContractVersion: string;
  offsetRegimeVersion: string;
}

export interface V2IfvgPhase3EvidenceBoundary {
  boundaryId: string;
  role: "full_replay" | "development" | "oos" | "current_window" | "independent_window";
  startTimeUtc: string;
  endTimeUtc: string;
}

export interface V2IfvgPhase3EvidenceArtifact {
  artifactId: string;
  artifactKind: V2IfvgPhase3EvidenceArtifactKind;
  profileId: V2IfvgPhase3EvidenceProfileId;
  profileVersion: "v2" | "v3";
  classification: "positive_canary" | "negative_control";
  parentReplayArtifactId?: string;
  dataset: Readonly<V2IfvgPhase3EvidenceDatasetReference>;
  parameterFingerprint: string;
  costModel: string;
  boundaries: readonly Readonly<V2IfvgPhase3EvidenceBoundary>[];
  metrics: Readonly<V2IfvgPhase3EvidenceMetrics>;
  metricsHash: string;
  baselineSnapshotHash: string;
  regressionStatus: "exact_parity" | "regression";
  metricDifferences: readonly string[];
  promotionAllowed: false;
  canCreateEvidence: false;
  rawCandlesPersisted: false;
  researchOnly: true;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgPhase3RegressionReport {
  status: "exact_parity" | "regression";
  sourceDifferences: readonly string[];
  parameterDifferences: readonly string[];
  costModelDifferences: readonly string[];
  replayDifferences: readonly string[];
  oosDifferences: readonly string[];
  metricDifferences: readonly string[];
  baselineModified: false;
}

export interface V2IfvgPhase3EvidenceBundle {
  schemaVersion: typeof V2_IFVG_PHASE3_EVIDENCE_SCHEMA;
  version: typeof V2_IFVG_PHASE3_EVIDENCE_VERSION;
  bundleId: string;
  generatedAtUtc: string;
  datasetManifest: Readonly<V2HistoricalDatasetManifest>;
  artifacts: {
    v3Replay: Readonly<V2IfvgPhase3EvidenceArtifact>;
    v3Oos: Readonly<V2IfvgPhase3EvidenceArtifact>;
    v2Replay: Readonly<V2IfvgPhase3EvidenceArtifact>;
    v2Oos: Readonly<V2IfvgPhase3EvidenceArtifact>;
  };
  regressionReport: Readonly<V2IfvgPhase3RegressionReport>;
  validationStatus: "exact_parity" | "regression";
  promotionAllowed: false;
  canCreateEvidence: false;
  rawCandlesPersisted: false;
  researchOnly: true;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2IfvgPhase3EvidenceFile {
  schemaVersion: typeof V2_IFVG_PHASE3_EVIDENCE_FILE_SCHEMA;
  version: typeof V2_IFVG_PHASE3_EVIDENCE_FILE_VERSION;
  fileHash: string;
  bundle: Readonly<V2IfvgPhase3EvidenceBundle>;
}

export interface V2IfvgPhase3EvidenceSummary {
  validationStatus: "accepted" | "blocked" | "regression";
  datasetId?: string;
  canonicalSourceFingerprint?: string;
  datasetChecksum?: string;
  artifactIds?: readonly string[];
  sourceIdentityMatches: boolean;
  parameterIdentityMatches: boolean;
  costModelIdentityMatches: boolean;
  boundaryIdentityComplete: boolean;
  metricsExact: boolean;
  blockers: readonly string[];
  warnings: readonly string[];
  authority: Readonly<V2Authority>;
}

export interface V2IfvgPhase3EvidenceValidation {
  status: "accepted" | "blocked" | "regression";
  bundle?: Readonly<V2IfvgPhase3EvidenceBundle>;
  summary: Readonly<V2IfvgPhase3EvidenceSummary>;
}

export interface V2IfvgPhase3EvidenceBuildInput {
  generatedAtUtc: string;
  datasetManifest: Readonly<V2HistoricalDatasetManifest>;
  positiveCanary: {
    baselineSnapshotHash: string;
    parameterFingerprint: string;
    costModel: string;
    replayExpected: Readonly<V2IfvgV3ReplaySummary>;
    replayActual: Readonly<V2IfvgV3ReplaySummary>;
    oosExpected: Readonly<V2IfvgV3OosSummary>;
    oosActual: Readonly<V2IfvgV3OosSummary>;
    replayBoundaries: readonly Readonly<V2IfvgPhase3EvidenceBoundary>[];
    oosBoundaries: readonly Readonly<V2IfvgPhase3EvidenceBoundary>[];
  };
  negativeControl: {
    baselineSnapshotHash: string;
    parameterFingerprint: string;
    costModel: string;
    replayExpected: Readonly<V2IfvgV2ReplaySummary>;
    replayActual: Readonly<V2IfvgV2ReplaySummary>;
    oosExpected: Readonly<V2IfvgV2OosSummary>;
    oosActual: Readonly<V2IfvgV2OosSummary>;
    replayBoundaries: readonly Readonly<V2IfvgPhase3EvidenceBoundary>[];
    oosBoundaries: readonly Readonly<V2IfvgPhase3EvidenceBoundary>[];
  };
}
