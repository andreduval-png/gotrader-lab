import {
  migrateForwardEvidenceLedgerToArtifacts,
  validateForwardEvidenceArtifact,
  validateForwardEvidenceArtifactManifest,
  type ForwardEvidenceArtifact,
  type ForwardEvidenceArtifactManifest
} from "./forwardEvidenceArtifactContract";
import type { ForwardEvidenceEntry } from "./forwardEvidenceTypes";

export const FORWARD_EVIDENCE_ARTIFACT_DB_NAME = "gotrader-v2-evidence-artifacts";
export const FORWARD_EVIDENCE_ARTIFACT_DB_VERSION = 1;
const ARTIFACT_STORE = "forward_evidence_artifacts";
const MANIFEST_STORE = "forward_evidence_manifests";

const hasIndexedDb = () => typeof indexedDB !== "undefined";
const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Forward-evidence artifact request failed."));
});
const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error("Forward-evidence artifact transaction failed."));
  transaction.onabort = () => reject(transaction.error ?? new Error("Forward-evidence artifact transaction aborted."));
});
const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!hasIndexedDb()) return reject(new Error("IndexedDB is unavailable for forward-evidence artifacts."));
  const request = indexedDB.open(FORWARD_EVIDENCE_ARTIFACT_DB_NAME, FORWARD_EVIDENCE_ARTIFACT_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(ARTIFACT_STORE)) db.createObjectStore(ARTIFACT_STORE, { keyPath: "artifactId" });
    if (!db.objectStoreNames.contains(MANIFEST_STORE)) db.createObjectStore(MANIFEST_STORE, { keyPath: "manifestId" });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Unable to open forward-evidence artifact database."));
});

const exact = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export async function persistForwardEvidenceArtifactMirror(entries: readonly Readonly<ForwardEvidenceEntry>[]) {
  const migration = await migrateForwardEvidenceLedgerToArtifacts(entries);
  const manifestBlockers = await validateForwardEvidenceArtifactManifest(migration.manifest, migration.artifacts);
  if (manifestBlockers.length) throw new Error(`Forward-evidence manifest rejected: ${manifestBlockers.join(", ")}`);
  for (const artifact of migration.artifacts) {
    const blockers = await validateForwardEvidenceArtifact(artifact);
    if (blockers.length) throw new Error(`Forward-evidence artifact rejected: ${blockers.join(", ")}`);
  }
  const db = await openDb();
  try {
    const readTx = db.transaction([ARTIFACT_STORE, MANIFEST_STORE], "readonly");
    const artifactStore = readTx.objectStore(ARTIFACT_STORE);
    const existingArtifacts = await Promise.all(migration.artifacts.map((artifact) =>
      requestResult<ForwardEvidenceArtifact | undefined>(artifactStore.get(artifact.artifactId))));
    const existingManifest = await requestResult<ForwardEvidenceArtifactManifest | undefined>(
      readTx.objectStore(MANIFEST_STORE).get(migration.manifest.manifestId));
    await transactionDone(readTx);
    existingArtifacts.forEach((existing, index) => {
      if (existing && !exact(existing, migration.artifacts[index])) {
        throw new Error(`Forward-evidence immutable artifact conflict: ${migration.artifacts[index].artifactId}`);
      }
    });
    if (existingManifest && !exact(existingManifest, migration.manifest)) {
      throw new Error(`Forward-evidence immutable manifest conflict: ${migration.manifest.manifestId}`);
    }
    const writeTx = db.transaction([ARTIFACT_STORE, MANIFEST_STORE], "readwrite");
    migration.artifacts.forEach((artifact, index) => {
      if (!existingArtifacts[index]) writeTx.objectStore(ARTIFACT_STORE).add(artifact);
    });
    if (!existingManifest) writeTx.objectStore(MANIFEST_STORE).add(migration.manifest);
    await transactionDone(writeTx);
    return Object.freeze({ ...migration, backend: "indexeddb" as const,
      status: existingManifest ? "unchanged" as const : "persisted" as const });
  } finally {
    db.close();
  }
}

export async function loadForwardEvidenceArtifactMirror(manifestId: string) {
  const db = await openDb();
  try {
    const tx = db.transaction([ARTIFACT_STORE, MANIFEST_STORE], "readonly");
    const manifest = await requestResult<ForwardEvidenceArtifactManifest | undefined>(tx.objectStore(MANIFEST_STORE).get(manifestId));
    if (!manifest) { await transactionDone(tx); return undefined; }
    const artifactStore = tx.objectStore(ARTIFACT_STORE);
    const artifacts = await Promise.all(manifest.orderedArtifactIds.map((artifactId) =>
      requestResult<ForwardEvidenceArtifact | undefined>(artifactStore.get(artifactId))));
    await transactionDone(tx);
    if (artifacts.some((artifact) => !artifact)) throw new Error("Forward-evidence mirror is incomplete.");
    const complete = artifacts as ForwardEvidenceArtifact[];
    const blockers = await validateForwardEvidenceArtifactManifest(manifest, complete);
    if (blockers.length) throw new Error(`Forward-evidence stored manifest rejected: ${blockers.join(", ")}`);
    return Object.freeze({ manifest, artifacts: Object.freeze(complete) });
  } finally {
    db.close();
  }
}

export async function rollbackForwardEvidenceArtifactMirror(manifestId: string) {
  const loaded = await loadForwardEvidenceArtifactMirror(manifestId);
  if (!loaded) return Object.freeze({ status: "not_found" as const, removedArtifactCount: 0 });
  const db = await openDb();
  try {
    const tx = db.transaction([ARTIFACT_STORE, MANIFEST_STORE], "readwrite");
    const manifests = await requestResult<ForwardEvidenceArtifactManifest[]>(tx.objectStore(MANIFEST_STORE).getAll());
    const retainedArtifactIds = new Set(manifests.filter((manifest) => manifest.manifestId !== manifestId)
      .flatMap((manifest) => [...manifest.orderedArtifactIds]));
    const removableArtifactIds = loaded.manifest.orderedArtifactIds.filter((artifactId) => !retainedArtifactIds.has(artifactId));
    removableArtifactIds.forEach((artifactId) => tx.objectStore(ARTIFACT_STORE).delete(artifactId));
    tx.objectStore(MANIFEST_STORE).delete(manifestId);
    await transactionDone(tx);
    return Object.freeze({ status: "rolled_back" as const, removedArtifactCount: removableArtifactIds.length,
      retainedSharedArtifactCount: loaded.artifacts.length - removableArtifactIds.length });
  } finally {
    db.close();
  }
}
