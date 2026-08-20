import type {
  SimulatedOutcomeEvent,
  SimulatedOutcomeEventPayload,
  SimulatedOutcomeIdentity
} from "./simulatedOutcomeLedgerTypes";

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return value;
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

export const canonicalSimulatedOutcomeJson = (value: unknown) => JSON.stringify(stableValue(value));

export const sha256SimulatedOutcome = async (value: unknown) => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SHA-256 is unavailable; simulated outcome evidence cannot be certified.");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalSimulatedOutcomeJson(value))
  );
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
};

export const assertCompleteSimulatedOutcomeIdentity = (identity: SimulatedOutcomeIdentity) => {
  const required: Array<keyof SimulatedOutcomeIdentity> = [
    "cycleId",
    "tradeId",
    "sourceFingerprint",
    "strategyProfile",
    "parameterFingerprint",
    "requestedSymbol",
    "timeframe"
  ];
  const missing = required.filter((key) => !String(identity[key] ?? "").trim());
  if (missing.length) {
    throw new Error(`Simulated outcome identity is incomplete: ${missing.join(", ")}.`);
  }
  return true;
};

export const createSimulatedOutcomeEvent = async (
  payload: SimulatedOutcomeEventPayload
): Promise<SimulatedOutcomeEvent> => {
  assertCompleteSimulatedOutcomeIdentity(payload.identity);
  const evidenceHash = await sha256SimulatedOutcome(payload);
  return {
    ...payload,
    eventId: `simulated_outcome_${evidenceHash.slice("sha256:".length)}`,
    evidenceHash
  };
};

export const verifySimulatedOutcomeEvent = async (event: SimulatedOutcomeEvent) => {
  const { eventId, evidenceHash, ...payload } = event;
  assertCompleteSimulatedOutcomeIdentity(payload.identity);
  const expectedHash = await sha256SimulatedOutcome(payload);
  if (evidenceHash !== expectedHash || eventId !== `simulated_outcome_${expectedHash.slice("sha256:".length)}`) {
    throw new Error(`Simulated outcome evidence failed integrity verification: ${eventId}.`);
  }
  return true;
};

export const assertSimulatedOutcomeEventIsCompact = (event: SimulatedOutcomeEvent) => {
  const serialized = JSON.stringify(event);
  if (/"(?:candles|rawCandles|rawSnapshot|accountData|orderData|positionData|apiKey|token|password|secret)"\s*:/i.test(serialized)) {
    throw new Error("Simulated outcome evidence contains forbidden raw or sensitive fields.");
  }
  if (new Blob([serialized]).size > 32_768) {
    throw new Error("Simulated outcome evidence exceeds the 32 KiB compact-record limit.");
  }
  if (Object.values(event.authority).some((value) => value !== "none")) {
    throw new Error("Simulated outcome evidence authority must remain none/none/none.");
  }
  return true;
};
