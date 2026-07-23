import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import { validateV2HistoricalDatasetManifest } from "../../evidence/v2HistoricalDatasetManifest";
import { canonicalHash, canonicalSerialize } from "../../serialization/canonicalSerialization";
import {
  V2_IFVG_V2_NEGATIVE_BASELINE_SHA256,
  V2_IFVG_V3_POSITIVE_BASELINE_SHA256
} from "./v2IfvgPhase3CanaryTypes";
import {
  V2_IFVG_PHASE3_EVIDENCE_FILE_SCHEMA,
  V2_IFVG_PHASE3_EVIDENCE_FILE_VERSION,
  V2_IFVG_PHASE3_EVIDENCE_SCHEMA,
  V2_IFVG_PHASE3_EVIDENCE_VERSION,
  type V2IfvgPhase3EvidenceArtifact,
  type V2IfvgPhase3EvidenceBoundary,
  type V2IfvgPhase3EvidenceBuildInput,
  type V2IfvgPhase3EvidenceBundle,
  type V2IfvgPhase3EvidenceDatasetReference,
  type V2IfvgPhase3EvidenceFile,
  type V2IfvgPhase3EvidenceMetrics,
  type V2IfvgPhase3EvidenceProfileId,
  type V2IfvgPhase3EvidenceSummary,
  type V2IfvgPhase3EvidenceValidation
} from "./v2IfvgPhase3EvidenceTypes";

export const V2_IFVG_V3_PARAMETER_FINGERPRINT =
  "ifvg_fresh_retest_v3_research|default_frozen_parameters";
export const V2_IFVG_V2_PARAMETER_FINGERPRINT =
  "ifvg_filtered_v2_research|default_frozen_parameters";

const hashPattern = /^sha256:[a-f0-9]{64}$/i;
const forbiddenKey =
  /^(?:candles|rawCandles|rawRuntimeSnapshot|rawSnapshot|accountData|orderData|positionData|password|secret|apiKey|token|mt5Credentials|base64)$/i;

const compact = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const findForbiddenPaths = (value: unknown, path = "evidence", found: string[] = []): string[] => {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenPaths(item, `${path}[${index}]`, found));
    return found;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    const nestedPath = `${path}.${key}`;
    if (forbiddenKey.test(key)) found.push(nestedPath);
    findForbiddenPaths(nested, nestedPath, found);
  });
  return found;
};

const datasetReference = (
  manifest: V2IfvgPhase3EvidenceBuildInput["datasetManifest"]
): Readonly<V2IfvgPhase3EvidenceDatasetReference> =>
  Object.freeze({
    datasetId: manifest.datasetId,
    canonicalSourceFingerprint: manifest.canonicalSourceFingerprint,
    datasetChecksum: manifest.datasetChecksum,
    timeNormalizationPolicyId: manifest.timeNormalizationPolicyId,
    timeNormalizationPolicyVersion: manifest.timeNormalizationPolicyVersion,
    timeContractVersion: manifest.timeContractVersion,
    offsetRegimeVersion: manifest.offsetRegimeVersion
  });

const validateBoundaries = (
  boundaries: readonly Readonly<V2IfvgPhase3EvidenceBoundary>[],
  datasetStart: string,
  datasetEnd: string
) => {
  if (!boundaries.length) throw new Error("IFVG Phase 3 evidence boundaries are missing.");
  const datasetStartMs = Date.parse(datasetStart);
  const datasetEndMs = Date.parse(datasetEnd);
  return Object.freeze(boundaries.map((boundary) => {
    const start = new Date(boundary.startTimeUtc);
    const end = new Date(boundary.endTimeUtc);
    if (!boundary.boundaryId?.trim() || !Number.isFinite(start.valueOf()) || !Number.isFinite(end.valueOf())) {
      throw new Error("IFVG Phase 3 evidence boundary is invalid.");
    }
    if (
      end.valueOf() <= start.valueOf() ||
      start.valueOf() < datasetStartMs ||
      end.valueOf() > datasetEndMs
    ) {
      throw new Error(`IFVG Phase 3 evidence boundary ${boundary.boundaryId} is outside the dataset.`);
    }
    return Object.freeze({
      ...boundary,
      startTimeUtc: start.toISOString(),
      endTimeUtc: end.toISOString()
    });
  }));
};

const metricDifferences = (expected: unknown, actual: unknown, path = "metrics"): string[] => {
  if (Object.is(expected, actual)) return [];
  if (
    !expected ||
    !actual ||
    typeof expected !== "object" ||
    typeof actual !== "object" ||
    Array.isArray(expected) !== Array.isArray(actual)
  ) {
    return [`${path}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`];
  }
  const expectedRecord = expected as Record<string, unknown>;
  const actualRecord = actual as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(expectedRecord), ...Object.keys(actualRecord)])].sort();
  return keys.flatMap((key) =>
    metricDifferences(expectedRecord[key], actualRecord[key], `${path}.${key}`)
  );
};

const artifact = async ({
  artifactKind,
  profileId,
  profileVersion,
  classification,
  parentReplayArtifactId,
  dataset,
  parameterFingerprint,
  costModel,
  boundaries,
  metrics,
  expectedMetrics,
  baselineSnapshotHash
}: {
  artifactKind: "replay" | "oos";
  profileId: V2IfvgPhase3EvidenceProfileId;
  profileVersion: "v2" | "v3";
  classification: "positive_canary" | "negative_control";
  parentReplayArtifactId?: string;
  dataset: Readonly<V2IfvgPhase3EvidenceDatasetReference>;
  parameterFingerprint: string;
  costModel: string;
  boundaries: readonly Readonly<V2IfvgPhase3EvidenceBoundary>[];
  metrics: Readonly<V2IfvgPhase3EvidenceMetrics>;
  expectedMetrics: Readonly<V2IfvgPhase3EvidenceMetrics>;
  baselineSnapshotHash: string;
}): Promise<Readonly<V2IfvgPhase3EvidenceArtifact>> => {
  const differences = compact(metricDifferences(expectedMetrics, metrics));
  const core = {
    artifactKind,
    profileId,
    profileVersion,
    classification,
    ...(parentReplayArtifactId ? { parentReplayArtifactId } : {}),
    dataset,
    parameterFingerprint,
    costModel,
    boundaries,
    metrics,
    metricsHash: await canonicalHash(metrics),
    baselineSnapshotHash,
    regressionStatus: differences.length ? "regression" as const : "exact_parity" as const,
    metricDifferences: differences,
    promotionAllowed: false as const,
    canCreateEvidence: false as const,
    rawCandlesPersisted: false as const,
    researchOnly: true as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };
  return Object.freeze({
    ...core,
    artifactId: await canonicalHash(core)
  });
};

export async function buildV2IfvgPhase3EvidenceBundle(
  input: Readonly<V2IfvgPhase3EvidenceBuildInput>
): Promise<Readonly<V2IfvgPhase3EvidenceBundle>> {
  const datasetValidation = await validateV2HistoricalDatasetManifest(input.datasetManifest);
  if (datasetValidation.status !== "accepted") {
    throw new Error(`IFVG Phase 3 dataset is blocked: ${datasetValidation.blockers.join(", ")}`);
  }
  const generatedAt = new Date(input.generatedAtUtc);
  if (!Number.isFinite(generatedAt.valueOf())) throw new Error("IFVG Phase 3 generation time is invalid.");
  const dataset = datasetReference(input.datasetManifest);
  const datasetStart = input.datasetManifest.firstCandleTimeUtc;
  const datasetEnd = input.datasetManifest.lastCandleTimeUtc;
  const v3Replay = await artifact({
    artifactKind: "replay",
    profileId: "ifvg_fresh_retest_v3_research",
    profileVersion: "v3",
    classification: "positive_canary",
    dataset,
    parameterFingerprint: input.positiveCanary.parameterFingerprint,
    costModel: input.positiveCanary.costModel,
    boundaries: validateBoundaries(input.positiveCanary.replayBoundaries, datasetStart, datasetEnd),
    metrics: input.positiveCanary.replayActual,
    expectedMetrics: input.positiveCanary.replayExpected,
    baselineSnapshotHash: input.positiveCanary.baselineSnapshotHash
  });
  const v3Oos = await artifact({
    artifactKind: "oos",
    profileId: "ifvg_fresh_retest_v3_research",
    profileVersion: "v3",
    classification: "positive_canary",
    parentReplayArtifactId: v3Replay.artifactId,
    dataset,
    parameterFingerprint: input.positiveCanary.parameterFingerprint,
    costModel: input.positiveCanary.costModel,
    boundaries: validateBoundaries(input.positiveCanary.oosBoundaries, datasetStart, datasetEnd),
    metrics: input.positiveCanary.oosActual,
    expectedMetrics: input.positiveCanary.oosExpected,
    baselineSnapshotHash: input.positiveCanary.baselineSnapshotHash
  });
  const v2Replay = await artifact({
    artifactKind: "replay",
    profileId: "ifvg_filtered_v2_research",
    profileVersion: "v2",
    classification: "negative_control",
    dataset,
    parameterFingerprint: input.negativeControl.parameterFingerprint,
    costModel: input.negativeControl.costModel,
    boundaries: validateBoundaries(input.negativeControl.replayBoundaries, datasetStart, datasetEnd),
    metrics: input.negativeControl.replayActual,
    expectedMetrics: input.negativeControl.replayExpected,
    baselineSnapshotHash: input.negativeControl.baselineSnapshotHash
  });
  const v2Oos = await artifact({
    artifactKind: "oos",
    profileId: "ifvg_filtered_v2_research",
    profileVersion: "v2",
    classification: "negative_control",
    parentReplayArtifactId: v2Replay.artifactId,
    dataset,
    parameterFingerprint: input.negativeControl.parameterFingerprint,
    costModel: input.negativeControl.costModel,
    boundaries: validateBoundaries(input.negativeControl.oosBoundaries, datasetStart, datasetEnd),
    metrics: input.negativeControl.oosActual,
    expectedMetrics: input.negativeControl.oosExpected,
    baselineSnapshotHash: input.negativeControl.baselineSnapshotHash
  });
  const artifacts = Object.freeze({ v3Replay, v3Oos, v2Replay, v2Oos });
  const replayDifferences = compact([
    ...v3Replay.metricDifferences.map((difference) => `v3:${difference}`),
    ...v2Replay.metricDifferences.map((difference) => `v2:${difference}`)
  ]);
  const oosDifferences = compact([
    ...v3Oos.metricDifferences.map((difference) => `v3:${difference}`),
    ...v2Oos.metricDifferences.map((difference) => `v2:${difference}`)
  ]);
  const allMetricDifferences = compact([...replayDifferences, ...oosDifferences]);
  const regressionReport = Object.freeze({
    status: allMetricDifferences.length ? "regression" as const : "exact_parity" as const,
    sourceDifferences: Object.freeze([]),
    parameterDifferences: Object.freeze([]),
    costModelDifferences: Object.freeze([]),
    replayDifferences,
    oosDifferences,
    metricDifferences: allMetricDifferences,
    baselineModified: false as const
  });
  const core = {
    schemaVersion: V2_IFVG_PHASE3_EVIDENCE_SCHEMA as typeof V2_IFVG_PHASE3_EVIDENCE_SCHEMA,
    version: V2_IFVG_PHASE3_EVIDENCE_VERSION as typeof V2_IFVG_PHASE3_EVIDENCE_VERSION,
    generatedAtUtc: generatedAt.toISOString(),
    datasetManifest: input.datasetManifest,
    artifacts,
    regressionReport,
    validationStatus: regressionReport.status,
    promotionAllowed: false as const,
    canCreateEvidence: false as const,
    rawCandlesPersisted: false as const,
    researchOnly: true as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  };
  return Object.freeze({ ...core, bundleId: await canonicalHash(core) });
}

export async function buildV2IfvgPhase3EvidenceFile(
  bundle: Readonly<V2IfvgPhase3EvidenceBundle>
): Promise<Readonly<V2IfvgPhase3EvidenceFile>> {
  return Object.freeze({
    schemaVersion: V2_IFVG_PHASE3_EVIDENCE_FILE_SCHEMA,
    version: V2_IFVG_PHASE3_EVIDENCE_FILE_VERSION,
    fileHash: await canonicalHash(bundle),
    bundle
  });
}

const artifactCore = (value: Readonly<V2IfvgPhase3EvidenceArtifact>) => {
  const { artifactId, ...core } = value;
  return core;
};

const bundleCore = (value: Readonly<V2IfvgPhase3EvidenceBundle>) => {
  const { bundleId, ...core } = value;
  return core;
};

export async function validateV2IfvgPhase3EvidenceFile(
  value: unknown
): Promise<Readonly<V2IfvgPhase3EvidenceValidation>> {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const file = value as Partial<V2IfvgPhase3EvidenceFile> | undefined;
  const bundle = file?.bundle as V2IfvgPhase3EvidenceBundle | undefined;
  if (!file || typeof file !== "object" || !bundle) {
    const summary: V2IfvgPhase3EvidenceSummary = {
      validationStatus: "blocked",
      sourceIdentityMatches: false,
      parameterIdentityMatches: false,
      costModelIdentityMatches: false,
      boundaryIdentityComplete: false,
      metricsExact: false,
      blockers: Object.freeze(["ifvg_phase3_evidence_file_missing"]),
      warnings: Object.freeze([]),
      authority: V2_AUTHORITY_NONE
    };
    return Object.freeze({ status: "blocked", summary: Object.freeze(summary) });
  }
  try {
    assertV2Authority(bundle.authority);
  } catch {
    blockers.push("ifvg_phase3_evidence_authority_invalid");
  }
  if (
    file.schemaVersion !== V2_IFVG_PHASE3_EVIDENCE_FILE_SCHEMA ||
    file.version !== V2_IFVG_PHASE3_EVIDENCE_FILE_VERSION ||
    bundle.schemaVersion !== V2_IFVG_PHASE3_EVIDENCE_SCHEMA ||
    bundle.version !== V2_IFVG_PHASE3_EVIDENCE_VERSION
  ) {
    blockers.push("ifvg_phase3_evidence_schema_invalid");
  }
  const forbiddenPaths = findForbiddenPaths(file);
  blockers.push(...forbiddenPaths.map((path) => `ifvg_phase3_evidence_forbidden_field:${path}`));
  const datasetValidation = await validateV2HistoricalDatasetManifest(bundle.datasetManifest);
  blockers.push(...datasetValidation.blockers);
  warnings.push(...datasetValidation.warnings);
  if (!file.fileHash || file.fileHash !== await canonicalHash(bundle)) {
    blockers.push("ifvg_phase3_evidence_file_hash_mismatch");
  }
  if (!bundle.bundleId || bundle.bundleId !== await canonicalHash(bundleCore(bundle))) {
    blockers.push("ifvg_phase3_evidence_bundle_hash_mismatch");
  }
  const artifacts = bundle.artifacts
    ? [bundle.artifacts.v3Replay, bundle.artifacts.v3Oos, bundle.artifacts.v2Replay, bundle.artifacts.v2Oos]
    : [];
  if (artifacts.length !== 4 || artifacts.some((item) => !item)) {
    blockers.push("ifvg_phase3_evidence_artifacts_missing");
  }
  for (const item of artifacts.filter(Boolean)) {
    try {
      assertV2Authority(item.authority);
    } catch {
      blockers.push(`ifvg_phase3_artifact_authority_invalid:${item.profileId}:${item.artifactKind}`);
    }
    if (!item.artifactId || item.artifactId !== await canonicalHash(artifactCore(item))) {
      blockers.push(`ifvg_phase3_artifact_hash_mismatch:${item.profileId}:${item.artifactKind}`);
    }
    if (!item.metricsHash || item.metricsHash !== await canonicalHash(item.metrics)) {
      blockers.push(`ifvg_phase3_metrics_hash_mismatch:${item.profileId}:${item.artifactKind}`);
    }
  }
  const artifactRolesValid = Boolean(
    bundle.artifacts?.v3Replay?.artifactKind === "replay" &&
    bundle.artifacts.v3Replay.profileId === "ifvg_fresh_retest_v3_research" &&
    bundle.artifacts.v3Replay.profileVersion === "v3" &&
    bundle.artifacts.v3Replay.classification === "positive_canary" &&
    bundle.artifacts.v3Replay.baselineSnapshotHash === V2_IFVG_V3_POSITIVE_BASELINE_SHA256 &&
    bundle.artifacts?.v3Oos?.artifactKind === "oos" &&
    bundle.artifacts.v3Oos.profileId === "ifvg_fresh_retest_v3_research" &&
    bundle.artifacts.v3Oos.profileVersion === "v3" &&
    bundle.artifacts.v3Oos.classification === "positive_canary" &&
    bundle.artifacts.v3Oos.baselineSnapshotHash === V2_IFVG_V3_POSITIVE_BASELINE_SHA256 &&
    bundle.artifacts?.v2Replay?.artifactKind === "replay" &&
    bundle.artifacts.v2Replay.profileId === "ifvg_filtered_v2_research" &&
    bundle.artifacts.v2Replay.profileVersion === "v2" &&
    bundle.artifacts.v2Replay.classification === "negative_control" &&
    bundle.artifacts.v2Replay.baselineSnapshotHash === V2_IFVG_V2_NEGATIVE_BASELINE_SHA256 &&
    bundle.artifacts?.v2Oos?.artifactKind === "oos" &&
    bundle.artifacts.v2Oos.profileId === "ifvg_filtered_v2_research" &&
    bundle.artifacts.v2Oos.profileVersion === "v2" &&
    bundle.artifacts.v2Oos.classification === "negative_control" &&
    bundle.artifacts.v2Oos.baselineSnapshotHash === V2_IFVG_V2_NEGATIVE_BASELINE_SHA256
  );
  if (!artifactRolesValid) blockers.push("ifvg_phase3_artifact_identity_mismatch");
  const expectedDatasetReference = datasetReference(bundle.datasetManifest);
  const sourceIdentityMatches = artifacts.length === 4 && artifacts.every((item) =>
    canonicalSerialize(item.dataset) === canonicalSerialize(expectedDatasetReference)
  );
  if (!sourceIdentityMatches) blockers.push("ifvg_phase3_replay_oos_source_identity_mismatch");
  const parameterIdentityMatches =
    bundle.artifacts?.v3Replay?.parameterFingerprint === V2_IFVG_V3_PARAMETER_FINGERPRINT &&
    bundle.artifacts?.v3Oos?.parameterFingerprint === V2_IFVG_V3_PARAMETER_FINGERPRINT &&
    bundle.artifacts?.v2Replay?.parameterFingerprint === V2_IFVG_V2_PARAMETER_FINGERPRINT &&
    bundle.artifacts?.v2Oos?.parameterFingerprint === V2_IFVG_V2_PARAMETER_FINGERPRINT;
  if (!parameterIdentityMatches) blockers.push("ifvg_phase3_parameter_fingerprint_mismatch");
  const costModelIdentityMatches =
    Boolean(bundle.artifacts?.v3Replay?.costModel) &&
    bundle.artifacts?.v3Replay?.costModel === bundle.artifacts?.v3Oos?.costModel &&
    Boolean(bundle.artifacts?.v2Replay?.costModel) &&
    bundle.artifacts?.v2Replay?.costModel === bundle.artifacts?.v2Oos?.costModel;
  if (!costModelIdentityMatches) blockers.push("ifvg_phase3_cost_model_mismatch");
  const boundaryIdentityComplete = artifacts.length === 4 && artifacts.every((item) =>
    item.boundaries.length > 0 &&
    item.boundaries.every((boundary) =>
      Boolean(boundary.boundaryId) &&
      Number.isFinite(Date.parse(boundary.startTimeUtc)) &&
      Number.isFinite(Date.parse(boundary.endTimeUtc))
    )
  );
  if (!boundaryIdentityComplete) blockers.push("ifvg_phase3_replay_oos_boundaries_missing");
  if (
    bundle.artifacts?.v3Oos?.parentReplayArtifactId !== bundle.artifacts?.v3Replay?.artifactId ||
    bundle.artifacts?.v2Oos?.parentReplayArtifactId !== bundle.artifacts?.v2Replay?.artifactId
  ) {
    blockers.push("ifvg_phase3_oos_parent_replay_mismatch");
  }
  const metricsExact = artifacts.length === 4 &&
    artifacts.every((item) => item.regressionStatus === "exact_parity" && !item.metricDifferences.length) &&
    bundle.regressionReport?.status === "exact_parity" &&
    bundle.validationStatus === "exact_parity";
  if (!metricsExact) blockers.push("ifvg_phase3_regenerated_metrics_regression");
  if (
    bundle.rawCandlesPersisted !== false ||
    bundle.researchOnly !== true ||
    bundle.shadowOnly !== true ||
    bundle.promotionAllowed !== false ||
    bundle.canCreateEvidence !== false
  ) {
    blockers.push("ifvg_phase3_evidence_scope_invalid");
  }
  if (!hashPattern.test(bundle.datasetManifest.datasetId)) {
    blockers.push("ifvg_phase3_dataset_id_invalid");
  }
  const regression = blockers.includes("ifvg_phase3_regenerated_metrics_regression") ||
    blockers.some((blocker) => blocker.includes("_hash_mismatch")) ||
    forbiddenPaths.length > 0;
  const status = regression ? "regression" as const : blockers.length ? "blocked" as const : "accepted" as const;
  const summary: V2IfvgPhase3EvidenceSummary = {
    validationStatus: status,
    datasetId: bundle.datasetManifest.datasetId,
    canonicalSourceFingerprint: bundle.datasetManifest.canonicalSourceFingerprint,
    datasetChecksum: bundle.datasetManifest.datasetChecksum,
    artifactIds: Object.freeze(artifacts.map((item) => item.artifactId)),
    sourceIdentityMatches,
    parameterIdentityMatches,
    costModelIdentityMatches,
    boundaryIdentityComplete,
    metricsExact,
    blockers: compact(blockers),
    warnings: compact(warnings),
    authority: V2_AUTHORITY_NONE
  };
  return Object.freeze({
    status,
    ...(status === "accepted" ? { bundle: Object.freeze(bundle) } : {}),
    summary: Object.freeze(summary)
  });
}
