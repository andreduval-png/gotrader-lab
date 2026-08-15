import type { ResearchCycleRun } from "@/lib/researchCycle/researchCycleTypes";
import type { Candle } from "@/lib/types";
import { buildTradePlanCycleResult, evaluateTradePlanOutcome } from "./tradePlanOutcomeEvaluation";
import type { TradePlanCycleResultRecord } from "./tradePlanOutcomeTypes";

const DB_NAME = "gotrader-trade-plan-results";
const DB_VERSION = 1;
const STORE = "cycle_results";
const FALLBACK_KEY = "gotrader.trade-plan-results.fallback.v1";
const FALLBACK_LIMIT = 500;
export const TRADE_PLAN_RESULTS_UPDATED_EVENT = "gotrader-trade-plan-results-updated";
const sessionRecords = new Map<string, TradePlanCycleResultRecord>();

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const hasIndexedDb = () => typeof indexedDB !== "undefined";

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!isBrowser() || !hasIndexedDb()) return reject(new Error("IndexedDB is unavailable for trade-plan results."));
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) {
      const store = db.createObjectStore(STORE, { keyPath: "cycleId" });
      store.createIndex("completedAt", "completedAt", { unique: false });
      store.createIndex("lineageKey", "identity.lineageKey", { unique: false });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Unable to open trade-plan results."));
});

const txDone = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error ?? new Error("Trade-plan results transaction failed."));
  tx.onabort = () => reject(tx.error ?? new Error("Trade-plan results transaction aborted."));
});

const idbRequest = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Trade-plan results request failed."));
});

const fallbackRecords = () => {
  if (!isBrowser()) return [...sessionRecords.values()];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FALLBACK_KEY) ?? "[]") as TradePlanCycleResultRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const publish = () => {
  if (isBrowser()) window.dispatchEvent(new CustomEvent(TRADE_PLAN_RESULTS_UPDATED_EVENT));
};

const outcomeChanged = (left: TradePlanCycleResultRecord, right: TradePlanCycleResultRecord) => {
  const { observationRevision: _leftRevision, ...leftOutcome } = left.outcome;
  const { observationRevision: _rightRevision, ...rightOutcome } = right.outcome;
  return JSON.stringify(leftOutcome) !== JSON.stringify(rightOutcome);
};

export async function listTradePlanCycleResults(): Promise<TradePlanCycleResultRecord[]> {
  if (!isBrowser() || !hasIndexedDb()) {
    return [...new Map([...fallbackRecords(), ...sessionRecords.values()].map((record) => [record.cycleId, record])).values()]
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  }
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const records = await idbRequest<TradePlanCycleResultRecord[]>(tx.objectStore(STORE).getAll());
    await txDone(tx);
    db.close();
    records.forEach((record) => sessionRecords.set(record.cycleId, record));
    return records.sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  } catch {
    return fallbackRecords().sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  }
}

const writeFallback = (record: TradePlanCycleResultRecord) => {
  sessionRecords.set(record.cycleId, record);
  if (!isBrowser()) return;
  const records = [...new Map([...fallbackRecords(), record].map((item) => [item.cycleId, item])).values()]
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, FALLBACK_LIMIT);
  window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(records));
};

export async function saveTradePlanCycleResult(record: TradePlanCycleResultRecord) {
  sessionRecords.set(record.cycleId, record);
  if (isBrowser() && hasIndexedDb()) {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      await txDone(tx);
      db.close();
      publish();
      return "indexeddb" as const;
    } catch {
      writeFallback(record);
      publish();
      return "localStorage_fallback" as const;
    }
  }
  writeFallback(record);
  publish();
  return isBrowser() ? "localStorage_fallback" as const : "memory" as const;
}

export async function persistAndReconcileTradePlanCycle(
  run: ResearchCycleRun,
  candles: Candle[],
  observedAt = new Date().toISOString()
) {
  const nextRecord = buildTradePlanCycleResult(run, candles);
  const existing = await listTradePlanCycleResults();
  const matchingLineage = existing.filter((record) => record.identity.lineageKey === nextRecord.identity.lineageKey);
  for (const record of matchingLineage) {
    const evaluated = evaluateTradePlanOutcome(record, candles, observedAt);
    if (outcomeChanged(evaluated, record)) await saveTradePlanCycleResult(evaluated);
  }
  const prior = existing.find((record) => record.cycleId === nextRecord.cycleId);
  await saveTradePlanCycleResult(prior ? { ...nextRecord, plan: prior.plan, outcome: prior.outcome } : nextRecord);
  return nextRecord;
}

export async function reconcileSavedTradePlanOutcomes(
  candles: Candle[],
  observedAt = new Date().toISOString()
) {
  if (!candles.length) return { inspected: 0, updated: 0 };
  const records = await listTradePlanCycleResults();
  let inspected = 0;
  let updated = 0;
  for (const record of records) {
    const evaluated = evaluateTradePlanOutcome(record, candles, observedAt);
    if (evaluated === record) continue;
    inspected += 1;
    if (outcomeChanged(evaluated, record)) {
      await saveTradePlanCycleResult(evaluated);
      updated += 1;
    }
  }
  return { inspected, updated };
}
