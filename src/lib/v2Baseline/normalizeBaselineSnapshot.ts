import type { NormalizedBaselineSnapshot } from "./baselineTypes";

const unstableKeys = new Set([
  "createdAt",
  "updatedAt",
  "generatedAt",
  "receivedAt",
  "localReceivedAt",
  "requestStartedAt",
  "requestCompletedAt",
  "latencyMs",
  "durationMs",
  "runId",
  "packetId",
  "decisionId",
  "journalId"
]);

const marketTimeKeys = new Set([
  "timestamp",
  "signalTime",
  "candleTime",
  "tradingDate",
  "dataWindowStart",
  "dataWindowEnd",
  "lastClosedCandle",
  "firstCandleTime",
  "lastCandleTime"
]);

const normalizePath = (value: string) =>
  value
    .replace(/C:\\Users\\[^\\]+\\OneDrive\\Documents\\gotrader/gi, "<workspace>")
    .replace(/C:\\Users\\[^\\]+\\AppData\\Local\\Temp/gi, "<temp>")
    .replace(/\\/g, "/");

const normalizeValue = (value: unknown, key?: string): unknown => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return marketTimeKeys.has(key ?? "") ? value : normalizePath(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([nestedKey, nestedValue]) => !unstableKeys.has(nestedKey) && nestedValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([nestedKey, nestedValue]) => [nestedKey, normalizeValue(nestedValue, nestedKey)])
    );
  }
  return String(value);
};

export const normalizeBaselineSnapshot = <T>(value: T): NormalizedBaselineSnapshot => ({
  schemaVersion: "gotrader-v2-normalized-snapshot-v1",
  payload: normalizeValue(value) as T
});

export const canonicalSerializeBaselineSnapshot = (value: unknown) =>
  `${JSON.stringify(normalizeBaselineSnapshot(value), null, 2)}\n`;
