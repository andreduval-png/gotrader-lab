import {
  assertSimulatedOutcomeEventIsCompact,
  verifySimulatedOutcomeEvent
} from "./simulatedOutcomeIntegrity";
import type {
  SimulatedOutcomeAppendResult,
  SimulatedOutcomeEvent,
  SimulatedOutcomeLedgerReadResult
} from "./simulatedOutcomeLedgerTypes";

const DB_NAME = "gotrader-simulated-outcome-ledger";
const DB_VERSION = 1;
const EVENT_STORE = "outcome_events";
const FALLBACK_STORAGE_KEY = "gotrader.simulated-outcome-ledger.fallback.v1";
const FALLBACK_EVENT_LIMIT = 2_000;
export const SIMULATED_OUTCOME_LEDGER_UPDATED_EVENT = "gotrader-simulated-outcome-ledger-updated";

const memoryEvents = new Map<string, SimulatedOutcomeEvent>();
const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const hasIndexedDb = () => typeof indexedDB !== "undefined";

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!isBrowser() || !hasIndexedDb()) {
    reject(new Error("IndexedDB is unavailable for simulated outcome storage."));
    return;
  }
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(EVENT_STORE)) {
      const store = db.createObjectStore(EVENT_STORE, { keyPath: "eventId" });
      store.createIndex("outcomeKey", "outcomeKey", { unique: false });
      store.createIndex("recordedAt", "recordedAt", { unique: false });
      store.createIndex("cycleId", "identity.cycleId", { unique: false });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Unable to open simulated outcome ledger."));
});

const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Simulated outcome IndexedDB request failed."));
});

const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error("Simulated outcome transaction failed."));
  transaction.onabort = () => reject(transaction.error ?? new Error("Simulated outcome transaction aborted."));
});

const fallbackEvents = () => {
  if (!isBrowser()) return [...memoryEvents.values()];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FALLBACK_STORAGE_KEY) ?? "[]") as SimulatedOutcomeEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const appendFallback = (event: SimulatedOutcomeEvent) => {
  const existing = fallbackEvents().find((item) => item.eventId === event.eventId);
  if (existing && existing.evidenceHash !== event.evidenceHash) {
    throw new Error(`Simulated outcome event ID collision: ${event.eventId}.`);
  }
  const next = [...new Map([...fallbackEvents(), event].map((item) => [item.eventId, item])).values()]
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
    .slice(0, FALLBACK_EVENT_LIMIT);
  if (isBrowser()) window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(next));
  next.forEach((item) => memoryEvents.set(item.eventId, item));
};

const readStoredEvents = async () => {
  if (!isBrowser() || !hasIndexedDb()) {
    return [...new Map([...fallbackEvents(), ...memoryEvents.values()].map((event) => [event.eventId, event])).values()];
  }
  try {
    const db = await openDb();
    const transaction = db.transaction(EVENT_STORE, "readonly");
    const events = await requestResult<SimulatedOutcomeEvent[]>(transaction.objectStore(EVENT_STORE).getAll());
    await transactionDone(transaction);
    db.close();
    events.forEach((event) => memoryEvents.set(event.eventId, event));
    return events;
  } catch {
    return fallbackEvents();
  }
};

export const listSimulatedOutcomeEvents = async (): Promise<SimulatedOutcomeLedgerReadResult> => {
  const stored = await readStoredEvents();
  const integrityVerified: SimulatedOutcomeEvent[] = [];
  let rejectedEventCount = 0;
  for (const event of stored) {
    try {
      assertSimulatedOutcomeEventIsCompact(event);
      await verifySimulatedOutcomeEvent(event);
      integrityVerified.push(event);
    } catch {
      rejectedEventCount += 1;
    }
  }
  const byHash = new Map(integrityVerified.map((event) => [event.evidenceHash, event]));
  const events = integrityVerified.filter((event) => {
    if (!event.previousEventHash) return true;
    const previous = byHash.get(event.previousEventHash);
    const valid = Boolean(
      previous &&
      previous.outcomeKey === event.outcomeKey &&
      previous.recordedAt <= event.recordedAt &&
      previous.status === "pending" &&
      event.status !== "pending"
    );
    if (!valid) rejectedEventCount += 1;
    return valid;
  });
  events.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  const latest = [...new Map(events.map((event) => [event.outcomeKey, event])).values()]
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  return { events, latest, rejectedEventCount };
};

export const appendSimulatedOutcomeEvent = async (
  event: SimulatedOutcomeEvent
): Promise<SimulatedOutcomeAppendResult> => {
  assertSimulatedOutcomeEventIsCompact(event);
  await verifySimulatedOutcomeEvent(event);
  const memoryExisting = memoryEvents.get(event.eventId);
  if (memoryExisting && memoryExisting.evidenceHash !== event.evidenceHash) {
    throw new Error(`Simulated outcome event ID collision: ${event.eventId}.`);
  }
  memoryEvents.set(event.eventId, event);
  let status: SimulatedOutcomeAppendResult["status"] = memoryExisting ? "duplicate" : "appended";
  let backend: SimulatedOutcomeAppendResult["backend"] = "memory";

  if (isBrowser() && hasIndexedDb()) {
    try {
      const db = await openDb();
      const readTransaction = db.transaction(EVENT_STORE, "readonly");
      const existing = await requestResult<SimulatedOutcomeEvent | undefined>(
        readTransaction.objectStore(EVENT_STORE).get(event.eventId)
      );
      await transactionDone(readTransaction);
      if (existing) {
        if (existing.evidenceHash !== event.evidenceHash) {
          db.close();
          throw new Error(`Simulated outcome event ID collision: ${event.eventId}.`);
        }
        status = "duplicate";
      } else {
        const writeTransaction = db.transaction(EVENT_STORE, "readwrite");
        writeTransaction.objectStore(EVENT_STORE).add(event);
        await transactionDone(writeTransaction);
        status = "appended";
      }
      db.close();
      backend = "indexeddb";
    } catch (error) {
      if (error instanceof Error && /collision/.test(error.message)) throw error;
      appendFallback(event);
      backend = "localStorage_fallback";
    }
  } else if (isBrowser()) {
    appendFallback(event);
    backend = "localStorage_fallback";
  }

  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(SIMULATED_OUTCOME_LEDGER_UPDATED_EVENT, { detail: event }));
  }
  return { status, backend, event };
};

export const appendSimulatedOutcomeEvents = async (events: SimulatedOutcomeEvent[]) => {
  const results: SimulatedOutcomeAppendResult[] = [];
  for (const event of events) results.push(await appendSimulatedOutcomeEvent(event));
  return results;
};
