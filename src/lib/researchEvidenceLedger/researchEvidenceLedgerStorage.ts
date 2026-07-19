import { aggregateResearchEvidence } from "./aggregateResearchEvidence";
import type { ResearchCycleRun } from "@/lib/researchCycle/researchCycleTypes";
import {
  assertResearchEvidenceRecordIsCompact,
  buildResearchEvidenceRecord
} from "./buildResearchEvidenceRecord";
import type {
  ResearchEvidenceAggregateIndex,
  ResearchEvidenceAppendResult,
  ResearchEvidenceCycleRecord
} from "./researchEvidenceLedgerTypes";
import {
  researchEvidenceAuthorityNone,
  researchEvidenceSafety
} from "./researchEvidenceLedgerTypes";

const DB_NAME = "gotrader-research-evidence";
const DB_VERSION = 1;
const EVIDENCE_STORE = "cycle_evidence";
const FALLBACK_STORAGE_KEY = "gotrader.research-evidence-ledger.fallback.v1";
export const RESEARCH_EVIDENCE_AGGREGATE_STORAGE_KEY = "gotrader.research-evidence-aggregate.v1";
export const RESEARCH_EVIDENCE_UPDATED_EVENT = "gotrader-research-evidence-updated";
const FALLBACK_RECORD_LIMIT = 500;
const sessionRecords = new Map<string, ResearchEvidenceCycleRecord>();
let sessionAggregate = aggregateResearchEvidence([], new Date(0).toISOString());

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const hasIndexedDb = () => typeof indexedDB !== "undefined";

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!isBrowser() || !hasIndexedDb()) {
    reject(new Error("IndexedDB is unavailable for research evidence storage."));
    return;
  }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(EVIDENCE_STORE)) {
      const store = db.createObjectStore(EVIDENCE_STORE, { keyPath: "evidenceId" });
      store.createIndex("identityKey", "identity.identityKey", { unique: false });
      store.createIndex("completedAt", "completedAt", { unique: false });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Unable to open research evidence store."));
});

const txDone = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error ?? new Error("Research evidence transaction failed."));
  tx.onabort = () => reject(tx.error ?? new Error("Research evidence transaction aborted."));
});

const idbRequest = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Research evidence IndexedDB request failed."));
});

const loadFallbackRecords = () => {
  if (!isBrowser()) return [...sessionRecords.values()];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FALLBACK_STORAGE_KEY) ?? "[]") as ResearchEvidenceCycleRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const publishAggregate = (index: ResearchEvidenceAggregateIndex) => {
  sessionAggregate = index;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(RESEARCH_EVIDENCE_AGGREGATE_STORAGE_KEY, JSON.stringify(index));
    } catch {
      // The IndexedDB evidence remains authoritative if the compact materialized view cannot be saved.
    }
    window.dispatchEvent(new CustomEvent(RESEARCH_EVIDENCE_UPDATED_EVENT, { detail: index }));
  }
  return index;
};

export function loadResearchEvidenceAggregateIndex(): ResearchEvidenceAggregateIndex {
  if (!isBrowser()) return sessionAggregate;
  try {
    const raw = window.localStorage.getItem(RESEARCH_EVIDENCE_AGGREGATE_STORAGE_KEY);
    if (!raw) return sessionAggregate;
    const parsed = JSON.parse(raw) as ResearchEvidenceAggregateIndex;
    return parsed?.schemaVersion === 1 ? parsed : sessionAggregate;
  } catch {
    return sessionAggregate;
  }
}

export async function listResearchEvidenceRecords(): Promise<ResearchEvidenceCycleRecord[]> {
  if (!isBrowser() || !hasIndexedDb()) {
    return [...new Map([...loadFallbackRecords(), ...sessionRecords.values()].map((record) => [record.evidenceId, record])).values()]
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  }
  try {
    const db = await openDb();
    const tx = db.transaction(EVIDENCE_STORE, "readonly");
    const rows = await idbRequest<ResearchEvidenceCycleRecord[]>(tx.objectStore(EVIDENCE_STORE).getAll());
    await txDone(tx);
    db.close();
    rows.forEach((record) => sessionRecords.set(record.evidenceId, record));
    return rows.sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  } catch {
    return loadFallbackRecords();
  }
}

const appendFallback = (record: ResearchEvidenceCycleRecord) => {
  const records = [...new Map([...loadFallbackRecords(), record].map((item) => [item.evidenceId, item])).values()]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, FALLBACK_RECORD_LIMIT);
  if (isBrowser()) {
    window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(records));
  }
  records.forEach((item) => sessionRecords.set(item.evidenceId, item));
  return records.sort((left, right) => left.completedAt.localeCompare(right.completedAt));
};

export async function appendResearchEvidenceRecord(
  record: ResearchEvidenceCycleRecord
): Promise<ResearchEvidenceAppendResult> {
  assertResearchEvidenceRecordIsCompact(record);
  let status: ResearchEvidenceAppendResult["status"] = sessionRecords.has(record.evidenceId) ? "duplicate" : "appended";
  let backend: ResearchEvidenceAppendResult["backend"] = "memory";
  sessionRecords.set(record.evidenceId, record);

  if (isBrowser() && hasIndexedDb()) {
    try {
      const db = await openDb();
      const readTx = db.transaction(EVIDENCE_STORE, "readonly");
      const existing = await idbRequest<ResearchEvidenceCycleRecord | undefined>(readTx.objectStore(EVIDENCE_STORE).get(record.evidenceId));
      await txDone(readTx);
      if (existing) {
        status = "duplicate";
      } else {
        const writeTx = db.transaction(EVIDENCE_STORE, "readwrite");
        writeTx.objectStore(EVIDENCE_STORE).add(record);
        await txDone(writeTx);
        status = "appended";
      }
      db.close();
      backend = "indexeddb";
    } catch {
      appendFallback(record);
      backend = "localStorage_fallback";
    }
  } else if (isBrowser()) {
    appendFallback(record);
    backend = "localStorage_fallback";
  }

  const records = await listResearchEvidenceRecords();
  const aggregateIndex = publishAggregate(aggregateResearchEvidence(records));
  return { status, backend, record, aggregateIndex };
}

export async function hydrateResearchEvidenceAggregateIndex() {
  const records = await listResearchEvidenceRecords();
  return publishAggregate(aggregateResearchEvidence(records));
}

export async function backfillResearchEvidenceFromCycleRuns(runs: ResearchCycleRun[]) {
  const completedRuns = runs.filter((run) =>
    Boolean(run.completedAt) && (run.status === "completed" || run.status === "completed_with_warnings")
  );
  for (const run of completedRuns) {
    await appendResearchEvidenceRecord(buildResearchEvidenceRecord(run));
  }
  return hydrateResearchEvidenceAggregateIndex();
}

export async function exportResearchEvidenceLedger() {
  const records = await listResearchEvidenceRecords();
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    records,
    aggregates: aggregateResearchEvidence(records),
    authority: researchEvidenceAuthorityNone,
    safety: researchEvidenceSafety
  };
}
