import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import { findForwardEvidenceBlockedFields } from "../forwardEvidence/buildForwardEvidenceEntry";
import { PREDICTION_LEDGER_STORAGE_KEY } from "./predictionLedgerStorage";
import { PREDICTION_LEDGER_AUTHORITY, type PredictionLedgerState, type UniversalPredictionLedgerEntry } from "./predictionLedgerTypes";

export const PREDICTION_ARTIFACT_SCHEMA = "gotrader-v2-prediction-artifact-v1" as const;
export const PREDICTION_MANIFEST_SCHEMA = "gotrader-v2-prediction-manifest-v1" as const;
const HASH = /^sha256:[0-9a-f]{64}$/;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const unique = (values: string[]) => [...new Set(values)].sort();

export interface PredictionArtifact {
  readonly schemaVersion: typeof PREDICTION_ARTIFACT_SCHEMA; readonly artifactVersion: "v1";
  readonly hashVersion: typeof V2_CANONICAL_HASH_VERSION; readonly migrationMode: "shadow_compare";
  readonly legacyAuthoritative: true; readonly legacyOrigin: Readonly<{ storageKey: typeof PREDICTION_LEDGER_STORAGE_KEY; predictionId: string }>;
  readonly identity: Readonly<{ scenarioMapId: string; scenarioId: string; scenarioFamily: string; modelVersion: string }>;
  readonly sourceLineage: Readonly<{ sourceProvider: string; requestedSymbol: string; brokerSymbol: string; timeframe: string;
    sourceFingerprint: string; issuedAt: string; asOfTimestamp: string; expiresAt: string; independentDate: string }>;
  readonly causalTags: readonly string[]; readonly probabilityProvenance: Readonly<{ source: string; estimate: number; sampleSize: number }>;
  readonly derivation: Readonly<{ kind: "prediction_from_legacy_prediction_ledger"; legacyPredictionId: string }>;
  readonly legacyProjection: Readonly<Record<string, unknown>>; readonly authority: typeof PREDICTION_LEDGER_AUTHORITY;
  readonly artifactId: string;
}

export interface PredictionArtifactManifest {
  readonly schemaVersion: typeof PREDICTION_MANIFEST_SCHEMA; readonly manifestVersion: "v1";
  readonly hashVersion: typeof V2_CANONICAL_HASH_VERSION; readonly migrationMode: "shadow_compare";
  readonly legacyStorageKey: typeof PREDICTION_LEDGER_STORAGE_KEY; readonly legacyAuthoritative: true;
  readonly automaticMirroringAllowed: false; readonly legacyUpdatedAt: string; readonly orderedArtifactIds: readonly string[];
  readonly legacyStateHash: string; readonly authority: typeof PREDICTION_LEDGER_AUTHORITY; readonly manifestId: string;
}

export const projectPredictionArtifactToLegacy = (artifact: Readonly<PredictionArtifact>) =>
  clone(artifact.legacyProjection) as unknown as UniversalPredictionLedgerEntry;

export async function buildPredictionArtifact(entry: Readonly<UniversalPredictionLedgerEntry>) {
  const projection = Object.freeze(clone(entry) as Readonly<Record<string, unknown>>);
  const blocked = findForwardEvidenceBlockedFields(projection);
  if (blocked.length) throw new Error(`Prediction artifact contains blocked fields: ${blocked.join(", ")}`);
  if (!entry.predictionId || !entry.scenarioId || !entry.modelVersion || !entry.sourceFingerprint) throw new Error("Prediction artifact identity is incomplete.");
  if (JSON.stringify(entry.authority) !== JSON.stringify(PREDICTION_LEDGER_AUTHORITY) || !entry.safety?.researchOnly ||
      !entry.safety.rawCandlesExcluded || !entry.safety.rawSnapshotsExcluded || entry.safety.autoPromotionAllowed || entry.safety.executionIntentCreated) {
    throw new Error("Prediction artifact safety or authority is invalid.");
  }
  const core = Object.freeze({ schemaVersion: PREDICTION_ARTIFACT_SCHEMA, artifactVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION, migrationMode: "shadow_compare" as const, legacyAuthoritative: true as const,
    legacyOrigin: Object.freeze({ storageKey: PREDICTION_LEDGER_STORAGE_KEY, predictionId: entry.predictionId }),
    identity: Object.freeze({ scenarioMapId: entry.scenarioMapId, scenarioId: entry.scenarioId, scenarioFamily: entry.scenarioFamily, modelVersion: entry.modelVersion }),
    sourceLineage: Object.freeze({ sourceProvider: entry.sourceProvider, requestedSymbol: entry.requestedSymbol, brokerSymbol: entry.brokerSymbol,
      timeframe: entry.timeframe, sourceFingerprint: entry.sourceFingerprint, issuedAt: entry.issuedAt, asOfTimestamp: entry.asOfTimestamp,
      expiresAt: entry.expiresAt, independentDate: entry.independentDate }),
    causalTags: Object.freeze(unique([`lifecycle:${entry.lifecycleState}`, `resolution:${entry.resolution}`, `direction:${entry.direction}`])),
    probabilityProvenance: Object.freeze({ source: entry.probabilitySource, estimate: entry.probabilityEstimate, sampleSize: entry.calibrationSampleSize }),
    derivation: Object.freeze({ kind: "prediction_from_legacy_prediction_ledger" as const, legacyPredictionId: entry.predictionId }),
    legacyProjection: projection, authority: PREDICTION_LEDGER_AUTHORITY });
  return Object.freeze({ ...core, artifactId: await canonicalHash(core) }) as Readonly<PredictionArtifact>;
}

export async function migratePredictionLedgerToArtifacts(state: Readonly<PredictionLedgerState>) {
  if (state.version !== 1 || JSON.stringify(state.authority) !== JSON.stringify(PREDICTION_LEDGER_AUTHORITY)) throw new Error("Prediction legacy state is invalid.");
  if (new Set(state.entries.map((entry) => entry.predictionId)).size !== state.entries.length) throw new Error("Prediction migration rejects duplicate IDs.");
  const artifacts = Object.freeze(await Promise.all(state.entries.map(buildPredictionArtifact)));
  const persistedState = clone(state);
  const core = Object.freeze({ schemaVersion: PREDICTION_MANIFEST_SCHEMA, manifestVersion: "v1" as const,
    hashVersion: V2_CANONICAL_HASH_VERSION, migrationMode: "shadow_compare" as const, legacyStorageKey: PREDICTION_LEDGER_STORAGE_KEY,
    legacyAuthoritative: true as const, automaticMirroringAllowed: false as const, legacyUpdatedAt: state.updatedAt,
    orderedArtifactIds: Object.freeze(artifacts.map((artifact) => artifact.artifactId)), legacyStateHash: await canonicalHash(persistedState),
    authority: PREDICTION_LEDGER_AUTHORITY });
  return Object.freeze({ artifacts, manifest: Object.freeze({ ...core, manifestId: await canonicalHash(core) }) as Readonly<PredictionArtifactManifest> });
}

export async function validatePredictionArtifact(value: unknown) {
  if (!value || typeof value !== "object") return Object.freeze(["prediction_artifact_missing"]);
  const artifact = value as Partial<PredictionArtifact>; const blockers: string[] = [];
  if (artifact.schemaVersion !== PREDICTION_ARTIFACT_SCHEMA || artifact.artifactVersion !== "v1") blockers.push("prediction_artifact_schema_unsupported");
  if (artifact.hashVersion !== V2_CANONICAL_HASH_VERSION) blockers.push("prediction_artifact_hash_version_unsupported");
  if (artifact.migrationMode !== "shadow_compare" || artifact.legacyAuthoritative !== true) blockers.push("prediction_artifact_boundary_invalid");
  if (!artifact.legacyProjection || findForwardEvidenceBlockedFields(artifact.legacyProjection).length) blockers.push("prediction_artifact_projection_unsafe");
  if (!HASH.test(String(artifact.artifactId ?? ""))) blockers.push("prediction_artifact_id_invalid");
  if (!blockers.length) { const { artifactId, ...core } = artifact as PredictionArtifact;
    if (await canonicalHash(core) !== artifactId) blockers.push("prediction_artifact_id_invalid"); }
  return Object.freeze(unique(blockers));
}

export async function validatePredictionManifest(value: unknown, artifacts: readonly Readonly<PredictionArtifact>[]) {
  if (!value || typeof value !== "object") return Object.freeze(["prediction_manifest_missing"]);
  const manifest = value as Partial<PredictionArtifactManifest>; const blockers: string[] = [];
  if (manifest.schemaVersion !== PREDICTION_MANIFEST_SCHEMA || manifest.manifestVersion !== "v1") blockers.push("prediction_manifest_schema_unsupported");
  if (!HASH.test(String(manifest.manifestId ?? "")) || !HASH.test(String(manifest.legacyStateHash ?? ""))) blockers.push("prediction_manifest_id_invalid");
  if (manifest.migrationMode !== "shadow_compare" || !manifest.legacyAuthoritative || manifest.automaticMirroringAllowed !== false) blockers.push("prediction_manifest_boundary_invalid");
  if (JSON.stringify(manifest.orderedArtifactIds) !== JSON.stringify(artifacts.map((artifact) => artifact.artifactId))) blockers.push("prediction_manifest_order_mismatch");
  if (!blockers.length) { const { manifestId, ...core } = manifest as PredictionArtifactManifest;
    if (await canonicalHash(core) !== manifestId) blockers.push("prediction_manifest_id_invalid"); }
  return Object.freeze(unique(blockers));
}
