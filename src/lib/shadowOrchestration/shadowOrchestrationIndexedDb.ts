import { canonicalSerialize } from "../canonical/canonicalValueSerialization";
import {
  buildShadowTerminalSeal,
  materializeShadowOperatorProjection,
  validateShadowCheckpoint,
  validateShadowOperatorProjection,
  validateShadowResearchJob,
  validateShadowStageArtifact,
  validateShadowStageChain,
  validateShadowTerminalSeal
} from "./shadowOrchestrationEngine";
import type {
  ShadowOperatorProjection,
  ShadowOrchestrationCheckpoint,
  ShadowResearchJob,
  ShadowStageArtifact,
  ShadowTerminalSeal
} from "./shadowOrchestrationTypes";

export const SHADOW_ORCHESTRATION_DB_NAME = "gotrader-v2-shadow-orchestration";
export const SHADOW_ORCHESTRATION_DB_VERSION = 1;
export const SHADOW_JOB_STORE = "jobs";
export const SHADOW_STAGE_STORE = "stage_artifacts";
export const SHADOW_CHECKPOINT_STORE = "checkpoints";
export const SHADOW_SEAL_STORE = "terminal_seals";
export const SHADOW_PROJECTION_STORE = "operator_projections";
export const SHADOW_HEAD_STORE = "job_heads";

const stores = [SHADOW_JOB_STORE, SHADOW_STAGE_STORE, SHADOW_CHECKPOINT_STORE, SHADOW_SEAL_STORE, SHADOW_PROJECTION_STORE, SHADOW_HEAD_STORE];
const exact = (left: unknown, right: unknown) => canonicalSerialize(left) === canonicalSerialize(right);
const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Shadow orchestration request failed."));
});
const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error("Shadow orchestration transaction failed."));
  transaction.onabort = () => reject(transaction.error ?? new Error("Shadow orchestration transaction aborted."));
});

interface ShadowJobHead {
  logicalJobId: string;
  checkpointId: string;
  heartbeatSequence: number;
  terminalSealId?: string;
  projectionId?: string;
}

export interface ShadowOrchestrationSnapshot {
  job: Readonly<ShadowResearchJob>;
  checkpoint: Readonly<ShadowOrchestrationCheckpoint>;
  artifacts: readonly Readonly<ShadowStageArtifact>[];
  seal?: Readonly<ShadowTerminalSeal>;
  projection?: Readonly<ShadowOperatorProjection>;
}

export const openShadowOrchestrationDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is unavailable for shadow orchestration."));
  const request = indexedDB.open(SHADOW_ORCHESTRATION_DB_NAME, SHADOW_ORCHESTRATION_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    const keyPaths: Record<string, string> = {
      [SHADOW_JOB_STORE]: "logicalJobId",
      [SHADOW_STAGE_STORE]: "stageArtifactId",
      [SHADOW_CHECKPOINT_STORE]: "checkpointId",
      [SHADOW_SEAL_STORE]: "terminalSealId",
      [SHADOW_PROJECTION_STORE]: "projectionId",
      [SHADOW_HEAD_STORE]: "logicalJobId"
    };
    for (const store of stores) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: keyPaths[store] });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Unable to open shadow orchestration database."));
});

async function validateSnapshot(snapshot: Readonly<ShadowOrchestrationSnapshot>) {
  if (!await validateShadowResearchJob(snapshot.job) || !await validateShadowCheckpoint(snapshot.checkpoint) ||
      !(await Promise.all(snapshot.artifacts.map(validateShadowStageArtifact))).every(Boolean) ||
      !await validateShadowStageChain(snapshot.job, snapshot.artifacts)) {
    throw new Error("Shadow orchestration snapshot identity rejected.");
  }
  if (snapshot.checkpoint.logicalJobId !== snapshot.job.logicalJobId || snapshot.checkpoint.nextStageOrdinal !== snapshot.artifacts.length ||
      !exact(snapshot.checkpoint.orderedStageArtifactIds, snapshot.artifacts.map((artifact) => artifact.stageArtifactId))) {
    throw new Error("Shadow orchestration snapshot chain rejected.");
  }
  if (Boolean(snapshot.seal) !== Boolean(snapshot.projection)) throw new Error("Shadow terminal evidence must be complete.");
  if (snapshot.seal && snapshot.projection) {
    if (!await validateShadowTerminalSeal(snapshot.seal) || !await validateShadowOperatorProjection(snapshot.projection)) {
      throw new Error("Shadow terminal evidence identity rejected.");
    }
    const reproducedSeal = await buildShadowTerminalSeal(snapshot.job, snapshot.checkpoint, snapshot.artifacts);
    const reproducedProjection = await materializeShadowOperatorProjection(snapshot.job, reproducedSeal, snapshot.artifacts);
    if (!exact(reproducedSeal, snapshot.seal) || !exact(reproducedProjection, snapshot.projection)) {
      throw new Error("Shadow terminal evidence reproduction mismatch.");
    }
  } else if (snapshot.checkpoint.terminalStatus !== undefined) {
    throw new Error("Shadow terminal checkpoint requires sealed evidence.");
  }
}

export async function persistShadowOrchestrationSnapshot(snapshot: Readonly<ShadowOrchestrationSnapshot>) {
  await validateSnapshot(snapshot);
  const db = await openShadowOrchestrationDb();
  try {
    const tx = db.transaction(stores, "readwrite");
    const jobStore = tx.objectStore(SHADOW_JOB_STORE);
    const stageStore = tx.objectStore(SHADOW_STAGE_STORE);
    const checkpointStore = tx.objectStore(SHADOW_CHECKPOINT_STORE);
    const sealStore = tx.objectStore(SHADOW_SEAL_STORE);
    const projectionStore = tx.objectStore(SHADOW_PROJECTION_STORE);
    const headStore = tx.objectStore(SHADOW_HEAD_STORE);
    const existingJob = await requestResult<ShadowResearchJob | undefined>(jobStore.get(snapshot.job.logicalJobId));
    const existingArtifacts = await Promise.all(snapshot.artifacts.map((artifact) =>
      requestResult<ShadowStageArtifact | undefined>(stageStore.get(artifact.stageArtifactId))));
    const existingCheckpoint = await requestResult<ShadowOrchestrationCheckpoint | undefined>(checkpointStore.get(snapshot.checkpoint.checkpointId));
    const existingSeal = snapshot.seal ? await requestResult<ShadowTerminalSeal | undefined>(sealStore.get(snapshot.seal.terminalSealId)) : undefined;
    const existingProjection = snapshot.projection ? await requestResult<ShadowOperatorProjection | undefined>(projectionStore.get(snapshot.projection.projectionId)) : undefined;
    const existingHead = await requestResult<ShadowJobHead | undefined>(headStore.get(snapshot.job.logicalJobId));
    if (existingJob && !exact(existingJob, snapshot.job)) throw new Error("Shadow immutable job conflict.");
    existingArtifacts.forEach((existing, index) => { if (existing && !exact(existing, snapshot.artifacts[index])) throw new Error("Shadow immutable stage artifact conflict."); });
    if (existingCheckpoint && !exact(existingCheckpoint, snapshot.checkpoint)) throw new Error("Shadow immutable checkpoint conflict.");
    if (existingSeal && !exact(existingSeal, snapshot.seal)) throw new Error("Shadow immutable terminal seal conflict.");
    if (existingProjection && !exact(existingProjection, snapshot.projection)) throw new Error("Shadow immutable projection conflict.");
    if (existingHead && existingHead.heartbeatSequence > snapshot.checkpoint.heartbeatSequence) throw new Error("Shadow persisted checkpoint heartbeat regression.");
    if (existingHead && existingHead.heartbeatSequence === snapshot.checkpoint.heartbeatSequence && existingHead.checkpointId !== snapshot.checkpoint.checkpointId) {
      throw new Error("Shadow persisted checkpoint heartbeat conflict.");
    }
    if (!existingJob) jobStore.add(snapshot.job);
    snapshot.artifacts.forEach((artifact, index) => { if (!existingArtifacts[index]) stageStore.add(artifact); });
    if (!existingCheckpoint) checkpointStore.add(snapshot.checkpoint);
    if (snapshot.seal && !existingSeal) sealStore.add(snapshot.seal);
    if (snapshot.projection && !existingProjection) projectionStore.add(snapshot.projection);
    const head: ShadowJobHead = {
      logicalJobId: snapshot.job.logicalJobId,
      checkpointId: snapshot.checkpoint.checkpointId,
      heartbeatSequence: snapshot.checkpoint.heartbeatSequence,
      ...(snapshot.seal ? { terminalSealId: snapshot.seal.terminalSealId } : {}),
      ...(snapshot.projection ? { projectionId: snapshot.projection.projectionId } : {})
    };
    headStore.put(head);
    await transactionDone(tx);
    return Object.freeze({ status: existingHead && exact(existingHead, head) ? "unchanged" as const : "persisted" as const, head: Object.freeze(head) });
  } finally {
    db.close();
  }
}

export async function loadShadowOrchestrationSnapshot(logicalJobId: string) {
  const db = await openShadowOrchestrationDb();
  try {
    const tx = db.transaction(stores, "readonly");
    const head = await requestResult<ShadowJobHead | undefined>(tx.objectStore(SHADOW_HEAD_STORE).get(logicalJobId));
    if (!head) { await transactionDone(tx); return undefined; }
    const job = await requestResult<ShadowResearchJob | undefined>(tx.objectStore(SHADOW_JOB_STORE).get(logicalJobId));
    const checkpoint = await requestResult<ShadowOrchestrationCheckpoint | undefined>(tx.objectStore(SHADOW_CHECKPOINT_STORE).get(head.checkpointId));
    if (!job || !checkpoint) throw new Error("Shadow persisted job head is incomplete.");
    const stageStore = tx.objectStore(SHADOW_STAGE_STORE);
    const artifacts = await Promise.all(checkpoint.orderedStageArtifactIds.map((id) => requestResult<ShadowStageArtifact | undefined>(stageStore.get(id))));
    const seal = head.terminalSealId ? await requestResult<ShadowTerminalSeal | undefined>(tx.objectStore(SHADOW_SEAL_STORE).get(head.terminalSealId)) : undefined;
    const projection = head.projectionId ? await requestResult<ShadowOperatorProjection | undefined>(tx.objectStore(SHADOW_PROJECTION_STORE).get(head.projectionId)) : undefined;
    await transactionDone(tx);
    if (artifacts.some((artifact) => !artifact) || Boolean(head.terminalSealId) !== Boolean(seal) || Boolean(head.projectionId) !== Boolean(projection)) {
      throw new Error("Shadow persisted snapshot is incomplete.");
    }
    const snapshot = Object.freeze({ job, checkpoint, artifacts: Object.freeze(artifacts as ShadowStageArtifact[]), ...(seal ? { seal } : {}), ...(projection ? { projection } : {}) });
    await validateSnapshot(snapshot);
    return snapshot;
  } finally {
    db.close();
  }
}

export async function rebuildShadowOperatorProjection(logicalJobId: string) {
  const snapshot = await loadShadowOrchestrationSnapshot(logicalJobId);
  if (!snapshot?.seal || !snapshot.projection) throw new Error("Shadow terminal snapshot is unavailable for projection rebuild.");
  const rebuilt = await materializeShadowOperatorProjection(snapshot.job, snapshot.seal, snapshot.artifacts);
  if (!exact(rebuilt, snapshot.projection)) throw new Error("Shadow persisted projection reproduction mismatch.");
  return rebuilt;
}

export async function rollbackShadowOrchestrationSnapshot(logicalJobId: string) {
  const loaded = await loadShadowOrchestrationSnapshot(logicalJobId);
  if (!loaded) return Object.freeze({ status: "not_found" as const, removedArtifactCount: 0 });
  const db = await openShadowOrchestrationDb();
  try {
    const tx = db.transaction(stores, "readwrite");
    const artifacts = await requestResult<ShadowStageArtifact[]>(tx.objectStore(SHADOW_STAGE_STORE).getAll());
    const checkpoints = await requestResult<ShadowOrchestrationCheckpoint[]>(tx.objectStore(SHADOW_CHECKPOINT_STORE).getAll());
    const seals = await requestResult<ShadowTerminalSeal[]>(tx.objectStore(SHADOW_SEAL_STORE).getAll());
    const projections = await requestResult<ShadowOperatorProjection[]>(tx.objectStore(SHADOW_PROJECTION_STORE).getAll());
    const ownedArtifacts = artifacts.filter((artifact) => artifact.logicalJobId === logicalJobId);
    tx.objectStore(SHADOW_JOB_STORE).delete(logicalJobId);
    ownedArtifacts.forEach((artifact) => tx.objectStore(SHADOW_STAGE_STORE).delete(artifact.stageArtifactId));
    checkpoints.filter((checkpoint) => checkpoint.logicalJobId === logicalJobId)
      .forEach((checkpoint) => tx.objectStore(SHADOW_CHECKPOINT_STORE).delete(checkpoint.checkpointId));
    seals.filter((seal) => seal.logicalJobId === logicalJobId)
      .forEach((seal) => tx.objectStore(SHADOW_SEAL_STORE).delete(seal.terminalSealId));
    projections.filter((projection) => projection.logicalJobId === logicalJobId)
      .forEach((projection) => tx.objectStore(SHADOW_PROJECTION_STORE).delete(projection.projectionId));
    tx.objectStore(SHADOW_HEAD_STORE).delete(logicalJobId);
    await transactionDone(tx);
    return Object.freeze({ status: "rolled_back" as const, removedArtifactCount: ownedArtifacts.length });
  } finally {
    db.close();
  }
}
