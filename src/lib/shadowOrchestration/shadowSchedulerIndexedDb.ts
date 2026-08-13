import { canonicalSerialize } from "../canonical/canonicalValueSerialization";
import { validateShadowDispatchReceipt, validateShadowScheduleQueueEntry, type ShadowDispatchReceipt, type ShadowScheduleQueueEntry, type ShadowSchedulerRepository } from "./shadowScheduler";

export const SHADOW_SCHEDULER_DB_NAME = "gotrader-v2-shadow-scheduler";
export const SHADOW_SCHEDULER_DB_VERSION = 1;
const QUEUE = "queue";
const RECEIPTS = "receipts";
const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const transactionDone = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
const exact = (a: unknown, b: unknown) => canonicalSerialize(a) === canonicalSerialize(b);

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(SHADOW_SCHEDULER_DB_NAME, SHADOW_SCHEDULER_DB_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(QUEUE)) request.result.createObjectStore(QUEUE, { keyPath: "queueId" });
    if (!request.result.objectStoreNames.contains(RECEIPTS)) request.result.createObjectStore(RECEIPTS, { keyPath: "receiptId" });
  };
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});

export class IndexedDbShadowSchedulerRepository implements ShadowSchedulerRepository {
  async admit(entry: Readonly<ShadowScheduleQueueEntry>, maxQueueDepth: number) {
    if (!await validateShadowScheduleQueueEntry(entry)) throw new Error("Shadow scheduler queue identity rejected.");
    const db = await open();
    try {
      const tx = db.transaction([QUEUE], "readwrite"); const store = tx.objectStore(QUEUE);
      const existing = await requestResult<ShadowScheduleQueueEntry | undefined>(store.get(entry.queueId));
      if (existing) { await transactionDone(tx); return exact(existing, entry) || existing.status === "settled" ? "coalesced" as const : "coalesced" as const; }
      const all = await requestResult<ShadowScheduleQueueEntry[]>(store.getAll());
      if (all.some((item) => item.status === "queued" && item.logicalJobId === entry.logicalJobId && item.dueAt === entry.dueAt)) { await transactionDone(tx); return "coalesced" as const; }
      if (all.filter((item) => item.status === "queued").length >= maxQueueDepth) { await transactionDone(tx); return "queue_full" as const; }
      store.add(entry); await transactionDone(tx); return "admitted" as const;
    } finally { db.close(); }
  }
  async queued(limit: number) { const db = await open(); try { const tx = db.transaction([QUEUE], "readonly"); const all = await requestResult<ShadowScheduleQueueEntry[]>(tx.objectStore(QUEUE).getAll()); await transactionDone(tx); return all.filter((item) => item.status === "queued").sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.queueId.localeCompare(b.queueId)).slice(0, limit); } finally { db.close(); } }
  async settle(entry: Readonly<ShadowScheduleQueueEntry>, receipt: Readonly<ShadowDispatchReceipt>, retry?: Readonly<ShadowScheduleQueueEntry>) {
    if (!await validateShadowScheduleQueueEntry(entry) || !await validateShadowDispatchReceipt(receipt) || (retry && !await validateShadowScheduleQueueEntry(retry))) throw new Error("Shadow scheduler settlement identity rejected.");
    const db = await open(); try { const tx = db.transaction([QUEUE, RECEIPTS], "readwrite"); const queue = tx.objectStore(QUEUE); const receipts = tx.objectStore(RECEIPTS);
      const current = await requestResult<ShadowScheduleQueueEntry | undefined>(queue.get(entry.queueId));
      if (!current || current.status !== "queued") throw new Error("Shadow scheduler queue claim is no longer current.");
      const existing = await requestResult<ShadowDispatchReceipt | undefined>(receipts.get(receipt.receiptId));
      if (existing && !exact(existing, receipt)) throw new Error("Shadow dispatch receipt conflict.");
      queue.put({ ...entry, status: "settled" }); if (!existing) receipts.add(receipt); if (retry) queue.add(retry); await transactionDone(tx);
    } finally { db.close(); }
  }
  async compactSettled(retainCount: number) { const db = await open(); try { const tx = db.transaction([QUEUE], "readwrite"); const store = tx.objectStore(QUEUE); const all = await requestResult<ShadowScheduleQueueEntry[]>(store.getAll()); const settled = all.filter((item) => item.status === "settled").sort((a, b) => b.dueAt.localeCompare(a.dueAt) || b.queueId.localeCompare(a.queueId)); settled.slice(retainCount).forEach((item) => store.delete(item.queueId)); await transactionDone(tx); return Math.max(0, settled.length - retainCount); } finally { db.close(); } }
  async receiptCount() { const db = await open(); try { const tx = db.transaction([RECEIPTS], "readonly"); const count = await requestResult<number>(tx.objectStore(RECEIPTS).count()); await transactionDone(tx); return count; } finally { db.close(); } }
}
