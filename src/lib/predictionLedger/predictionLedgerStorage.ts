import {
  PREDICTION_LEDGER_AUTHORITY,
  type PredictionLedgerState,
  type UniversalPredictionLedgerEntry
} from "./predictionLedgerTypes";

export const PREDICTION_LEDGER_STORAGE_KEY = "gotrader.prediction-ledger.v1";
export const PREDICTION_LEDGER_UPDATED_EVENT = "gotrader-prediction-ledger-updated";
const MAX_PREDICTION_ENTRIES = 500;
const MAX_PREDICTION_LEDGER_BYTES = 512 * 1024;
let inMemoryPredictionLedger: PredictionLedgerState | undefined;

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const defaultState = (): PredictionLedgerState => ({
  version: 1,
  updatedAt: new Date(0).toISOString(),
  entries: [],
  authority: PREDICTION_LEDGER_AUTHORITY
});

const parseState = (raw: string | null): PredictionLedgerState | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<PredictionLedgerState> | null;
    if (!parsed || !Array.isArray(parsed.entries)) return undefined;
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      entries: parsed.entries.map(safeEntry).filter((entry): entry is UniversalPredictionLedgerEntry => Boolean(entry)).slice(-MAX_PREDICTION_ENTRIES),
      authority: PREDICTION_LEDGER_AUTHORITY
    };
  } catch {
    return undefined;
  }
};

const serializedBytes = (value: string) => new TextEncoder().encode(value).length;

const compactToByteBound = (state: PredictionLedgerState, maximumEntries = MAX_PREDICTION_ENTRIES) => {
  let entries = state.entries.slice(-maximumEntries);
  let candidate = { ...state, entries };
  let serialized = JSON.stringify(candidate);
  while (serializedBytes(serialized) > MAX_PREDICTION_LEDGER_BYTES && entries.length > 1) {
    entries = entries.slice(Math.ceil(entries.length / 2));
    candidate = { ...state, entries };
    serialized = JSON.stringify(candidate);
  }
  return { state: candidate, serialized };
};

const safeEntry = (value: unknown): UniversalPredictionLedgerEntry | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const entry = value as UniversalPredictionLedgerEntry;
  if (!entry.predictionId || !entry.scenarioId || !entry.issuedAt || !entry.sourceFingerprint) return undefined;
  return {
    ...entry,
    expectedSequence: Array.isArray(entry.expectedSequence) ? entry.expectedSequence.slice(0, 8) : [],
    requiredConfirmations: Array.isArray(entry.requiredConfirmations) ? entry.requiredConfirmations.slice(0, 8) : [],
    invalidationConditions: Array.isArray(entry.invalidationConditions) ? entry.invalidationConditions.slice(0, 8) : [],
    targetReferences: Array.isArray(entry.targetReferences) ? entry.targetReferences.slice(0, 4) : [],
    authority: PREDICTION_LEDGER_AUTHORITY,
    safety: {
      researchOnly: true,
      rawCandlesExcluded: true,
      rawSnapshotsExcluded: true,
      autoPromotionAllowed: false,
      executionIntentCreated: false
    }
  };
};

export function loadPredictionLedger(): PredictionLedgerState {
  if (!isBrowser()) return inMemoryPredictionLedger ?? defaultState();
  const local = parseState(window.localStorage.getItem(PREDICTION_LEDGER_STORAGE_KEY));
  if (local) return local;
  const session = typeof window.sessionStorage !== "undefined"
    ? parseState(window.sessionStorage.getItem(PREDICTION_LEDGER_STORAGE_KEY))
    : undefined;
  return session ?? inMemoryPredictionLedger ?? defaultState();
}

export function savePredictionLedger(entries: UniversalPredictionLedgerEntry[]): PredictionLedgerState {
  const requested: PredictionLedgerState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: entries.map(safeEntry).filter((entry): entry is UniversalPredictionLedgerEntry => Boolean(entry)).slice(-MAX_PREDICTION_ENTRIES),
    authority: PREDICTION_LEDGER_AUTHORITY
  };
  let persisted = compactToByteBound(requested).state;
  inMemoryPredictionLedger = persisted;
  if (!isBrowser()) return persisted;

  let stored = false;
  for (const maximumEntries of [MAX_PREDICTION_ENTRIES, 250, 100, 50, 25, 10, 1]) {
    const attempt = compactToByteBound(requested, maximumEntries);
    try {
      window.localStorage.setItem(PREDICTION_LEDGER_STORAGE_KEY, attempt.serialized);
      persisted = attempt.state;
      stored = true;
      break;
    } catch {
      // Retry with a smaller append-only tail below.
    }
  }

  if (!stored) {
    const minimal = compactToByteBound(requested, 1);
    try {
      window.sessionStorage?.setItem(PREDICTION_LEDGER_STORAGE_KEY, minimal.serialized);
      persisted = minimal.state;
    } catch {
      // The in-memory state remains available to the active cycle.
    }
    console.warn("Prediction ledger persistence fell back after browser storage reached its quota.");
  }
  inMemoryPredictionLedger = persisted;
  window.dispatchEvent(new CustomEvent(PREDICTION_LEDGER_UPDATED_EVENT, { detail: persisted }));
  return persisted;
}

export function recordPredictionLedgerEntry(entry: UniversalPredictionLedgerEntry) {
  const state = loadPredictionLedger();
  const existing = state.entries.find((item) => item.predictionId === entry.predictionId);
  if (existing) return existing;
  savePredictionLedger([...state.entries, entry]);
  return entry;
}

export function clearPredictionLedger() {
  if (isBrowser()) window.localStorage.removeItem(PREDICTION_LEDGER_STORAGE_KEY);
  return defaultState();
}
