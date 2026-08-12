export const EVIDENCE_ARTIFACT_DB_NAME = "gotrader-v2-evidence-artifacts";
export const EVIDENCE_ARTIFACT_DB_VERSION = 2;
export const FORWARD_ARTIFACT_STORE = "forward_evidence_artifacts";
export const FORWARD_MANIFEST_STORE = "forward_evidence_manifests";
export const PREDICTION_ARTIFACT_STORE = "prediction_artifacts";
export const PREDICTION_MANIFEST_STORE = "prediction_manifests";

const stores = [FORWARD_ARTIFACT_STORE, FORWARD_MANIFEST_STORE, PREDICTION_ARTIFACT_STORE, PREDICTION_MANIFEST_STORE];

export const idbResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Evidence artifact request failed."));
});

export const idbTransactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error("Evidence artifact transaction failed."));
  transaction.onabort = () => reject(transaction.error ?? new Error("Evidence artifact transaction aborted."));
});

export const openEvidenceArtifactDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is unavailable for evidence artifacts."));
  const request = indexedDB.open(EVIDENCE_ARTIFACT_DB_NAME, EVIDENCE_ARTIFACT_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    for (const store of stores) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store,
      { keyPath: store.endsWith("manifests") ? "manifestId" : "artifactId" });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Unable to open evidence artifact database."));
});
