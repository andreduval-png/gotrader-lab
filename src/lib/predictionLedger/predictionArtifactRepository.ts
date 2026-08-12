import { PREDICTION_ARTIFACT_STORE, PREDICTION_MANIFEST_STORE, idbResult, idbTransactionDone, openEvidenceArtifactDb } from "../evidenceArtifacts/evidenceArtifactIndexedDb";
import { migratePredictionLedgerToArtifacts, validatePredictionArtifact, validatePredictionManifest,
  type PredictionArtifact, type PredictionArtifactManifest } from "./predictionArtifactContract";
import type { PredictionLedgerState } from "./predictionLedgerTypes";
const exact = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function persistPredictionArtifactMirror(state: Readonly<PredictionLedgerState>) {
  const migration = await migratePredictionLedgerToArtifacts(state);
  if ((await validatePredictionManifest(migration.manifest, migration.artifacts)).length) throw new Error("Prediction manifest rejected.");
  for (const artifact of migration.artifacts) if ((await validatePredictionArtifact(artifact)).length) throw new Error("Prediction artifact rejected.");
  const db = await openEvidenceArtifactDb(); try {
    const read = db.transaction([PREDICTION_ARTIFACT_STORE, PREDICTION_MANIFEST_STORE], "readonly");
    const store = read.objectStore(PREDICTION_ARTIFACT_STORE);
    const existing = await Promise.all(migration.artifacts.map((artifact) => idbResult<PredictionArtifact | undefined>(store.get(artifact.artifactId))));
    const existingManifest = await idbResult<PredictionArtifactManifest | undefined>(read.objectStore(PREDICTION_MANIFEST_STORE).get(migration.manifest.manifestId));
    await idbTransactionDone(read); existing.forEach((item, index) => { if (item && !exact(item, migration.artifacts[index])) throw new Error("Prediction immutable artifact conflict."); });
    if (existingManifest && !exact(existingManifest, migration.manifest)) throw new Error("Prediction immutable manifest conflict.");
    const write = db.transaction([PREDICTION_ARTIFACT_STORE, PREDICTION_MANIFEST_STORE], "readwrite");
    migration.artifacts.forEach((artifact, index) => { if (!existing[index]) write.objectStore(PREDICTION_ARTIFACT_STORE).add(artifact); });
    if (!existingManifest) write.objectStore(PREDICTION_MANIFEST_STORE).add(migration.manifest); await idbTransactionDone(write);
    return Object.freeze({ ...migration, backend: "indexeddb" as const, status: existingManifest ? "unchanged" as const : "persisted" as const });
  } finally { db.close(); }
}

export async function loadPredictionArtifactMirror(manifestId: string) {
  const db = await openEvidenceArtifactDb(); try { const tx = db.transaction([PREDICTION_ARTIFACT_STORE, PREDICTION_MANIFEST_STORE], "readonly");
    const manifest = await idbResult<PredictionArtifactManifest | undefined>(tx.objectStore(PREDICTION_MANIFEST_STORE).get(manifestId));
    if (!manifest) { await idbTransactionDone(tx); return undefined; } const store = tx.objectStore(PREDICTION_ARTIFACT_STORE);
    const artifacts = await Promise.all(manifest.orderedArtifactIds.map((id) => idbResult<PredictionArtifact | undefined>(store.get(id)))); await idbTransactionDone(tx);
    if (artifacts.some((value) => !value)) throw new Error("Prediction artifact mirror is incomplete.");
    return Object.freeze({ manifest, artifacts: Object.freeze(artifacts as PredictionArtifact[]) });
  } finally { db.close(); }
}

export async function rollbackPredictionArtifactMirror(manifestId: string) {
  const loaded = await loadPredictionArtifactMirror(manifestId); if (!loaded) return Object.freeze({ status: "not_found" as const, removedArtifactCount: 0 });
  const db = await openEvidenceArtifactDb(); try { const tx = db.transaction([PREDICTION_ARTIFACT_STORE, PREDICTION_MANIFEST_STORE], "readwrite");
    const manifests = await idbResult<PredictionArtifactManifest[]>(tx.objectStore(PREDICTION_MANIFEST_STORE).getAll());
    const retained = new Set(manifests.filter((item) => item.manifestId !== manifestId).flatMap((item) => [...item.orderedArtifactIds]));
    const removable = loaded.manifest.orderedArtifactIds.filter((id) => !retained.has(id));
    removable.forEach((id) => tx.objectStore(PREDICTION_ARTIFACT_STORE).delete(id)); tx.objectStore(PREDICTION_MANIFEST_STORE).delete(manifestId);
    await idbTransactionDone(tx); return Object.freeze({ status: "rolled_back" as const, removedArtifactCount: removable.length,
      retainedSharedArtifactCount: loaded.artifacts.length - removable.length });
  } finally { db.close(); }
}
