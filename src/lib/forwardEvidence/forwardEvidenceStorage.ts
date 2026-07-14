import { buildForwardEvidenceEntry } from "./buildForwardEvidenceEntry";
import type { ForwardEvidenceEntry, ForwardEvidenceEntryInput } from "./forwardEvidenceTypes";

export const FORWARD_EVIDENCE_STORAGE_KEY = "gotrader.forward-evidence.v1";
export const FORWARD_EVIDENCE_UPDATED_EVENT = "gotrader-forward-evidence-updated";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const normalizeStoredEntry = (value: unknown): ForwardEvidenceEntry | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Partial<ForwardEvidenceEntryInput>;
  if (
    typeof record.sourceFingerprint !== "string" ||
    typeof record.setupTimestamp !== "string" ||
    typeof record.independentDate !== "string" ||
    typeof record.forwardWindowId !== "string" ||
    (record.direction !== "long" && record.direction !== "short")
  ) {
    return undefined;
  }
  return buildForwardEvidenceEntry(record as ForwardEvidenceEntryInput);
};

export const loadForwardEvidenceLedger = (): ForwardEvidenceEntry[] => {
  if (!isBrowser()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FORWARD_EVIDENCE_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.map(normalizeStoredEntry).filter((entry): entry is ForwardEvidenceEntry => Boolean(entry))
      : [];
  } catch {
    return [];
  }
};

export const saveForwardEvidenceLedger = (entries: ForwardEvidenceEntry[]) => {
  const compact = entries.map(normalizeStoredEntry).filter((entry): entry is ForwardEvidenceEntry => Boolean(entry));
  if (isBrowser()) {
    window.localStorage.setItem(FORWARD_EVIDENCE_STORAGE_KEY, JSON.stringify(compact));
    window.dispatchEvent(new CustomEvent(FORWARD_EVIDENCE_UPDATED_EVENT, { detail: compact }));
  }
  return compact;
};

export const appendForwardEvidenceEntry = (input: ForwardEvidenceEntryInput) => {
  const entry = buildForwardEvidenceEntry(input);
  const existing = loadForwardEvidenceLedger().filter((item) => item.entryId !== entry.entryId);
  saveForwardEvidenceLedger([...existing, entry]);
  return entry;
};
