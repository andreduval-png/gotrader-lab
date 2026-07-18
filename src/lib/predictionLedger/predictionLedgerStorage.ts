import {
  PREDICTION_LEDGER_AUTHORITY,
  type PredictionLedgerState,
  type UniversalPredictionLedgerEntry
} from "./predictionLedgerTypes";

export const PREDICTION_LEDGER_STORAGE_KEY = "gotrader.prediction-ledger.v1";
export const PREDICTION_LEDGER_UPDATED_EVENT = "gotrader-prediction-ledger-updated";
const MAX_PREDICTION_ENTRIES = 500;

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const defaultState = (): PredictionLedgerState => ({
  version: 1,
  updatedAt: new Date(0).toISOString(),
  entries: [],
  authority: PREDICTION_LEDGER_AUTHORITY
});

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
  if (!isBrowser()) return defaultState();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREDICTION_LEDGER_STORAGE_KEY) ?? "null") as Partial<PredictionLedgerState> | null;
    if (!parsed || !Array.isArray(parsed.entries)) return defaultState();
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      entries: parsed.entries.map(safeEntry).filter((entry): entry is UniversalPredictionLedgerEntry => Boolean(entry)).slice(-MAX_PREDICTION_ENTRIES),
      authority: PREDICTION_LEDGER_AUTHORITY
    };
  } catch {
    return defaultState();
  }
}

export function savePredictionLedger(entries: UniversalPredictionLedgerEntry[]): PredictionLedgerState {
  const state: PredictionLedgerState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: entries.map(safeEntry).filter((entry): entry is UniversalPredictionLedgerEntry => Boolean(entry)).slice(-MAX_PREDICTION_ENTRIES),
    authority: PREDICTION_LEDGER_AUTHORITY
  };
  if (isBrowser()) {
    window.localStorage.setItem(PREDICTION_LEDGER_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(PREDICTION_LEDGER_UPDATED_EVENT, { detail: state }));
  }
  return state;
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
