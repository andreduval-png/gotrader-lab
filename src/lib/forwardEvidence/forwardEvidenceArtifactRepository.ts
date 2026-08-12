import {
  migrateForwardEvidenceLedgerToArtifacts,
  validateForwardEvidenceArtifact,
  validateForwardEvidenceArtifactManifest,
  type ForwardEvidenceArtifact,
  type ForwardEvidenceArtifactManifest
} from "./forwardEvidenceArtifactContract";
import type { ForwardEvidenceEntry } from "./forwardEvidenceTypes";
import { EVIDENCE_ARTIFACT_DB_NAME, EVIDENCE_ARTIFACT_DB_VERSION, FORWARD_ARTIFACT_STORE as ARTIFACT_STORE,
  FORWARD_MANIFEST_STORE as MANIFEST_STORE, idbResult as requestResult, idbTransactionDone as transactionDone,
  openEvidenceArtifactDb as openDb } from "../evidenceArtifacts/evidenceArtifactIndexedDb";

export const FORWARD_EVIDENCE_ARTIFACT_DB_NAME = EVIDENCE_ARTIFACT_DB_NAME;
export const FORWARD_EVIDENCE_ARTIFACT_DB_VERSION = EVIDENCE_ARTIFACT_DB_VERSION;

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
