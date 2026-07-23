import fs from "node:fs/promises";
import path from "node:path";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const MAX_CONTRACT_BYTES = 256 * 1024;

const compactError = (error) => error instanceof Error ? error.message : String(error);

export function normalizeV2Mt5CollectorBridgeUrl(input) {
  const parsed = new URL(String(input || "http://127.0.0.1:7341"));
  if (parsed.protocol !== "http:") throw new Error("The V2 MT5 shadow collector requires loopback HTTP.");
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) throw new Error("The V2 MT5 shadow collector refuses non-loopback hosts.");
  if (parsed.username || parsed.password) throw new Error("Credentials are forbidden in the V2 MT5 collector URL.");
  if (parsed.search || parsed.hash) throw new Error("Query strings and fragments are forbidden in the V2 MT5 collector URL.");
  return parsed.origin;
}

export async function loadV2Mt5OffsetRegimeState({ stateFile, brokerSymbol, ledgerApi }) {
  let text;
  try {
    text = await fs.readFile(stateFile, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return ledgerApi.createV2Mt5OffsetRegimeLedger({ brokerSymbol });
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Existing V2 MT5 offset-regime state is not valid JSON; refusing to overwrite it.");
  }
  const validation = await ledgerApi.validateV2Mt5OffsetRegimeLedgerFile(parsed);
  if (validation.status !== "accepted" || !validation.ledger) {
    throw new Error(`Existing V2 MT5 offset-regime state failed validation: ${validation.blockers.join(", ")}`);
  }
  if (validation.ledger.brokerSymbol !== brokerSymbol) {
    throw new Error("Existing V2 MT5 offset-regime state belongs to a different broker symbol.");
  }
  return validation.ledger;
}

export async function saveV2Mt5OffsetRegimeState({ stateFile, ledger, ledgerApi, savedAtUtc }) {
  const persisted = await ledgerApi.buildV2Mt5OffsetRegimeLedgerFile({ ledger, savedAtUtc });
  const serialized = `${JSON.stringify(persisted, null, 2)}\n`;
  if (/"candles"\s*:|rawServer|rawProvider|timeCurrentRaw|accountData|orderData|positionData|password|secret|apiKey|token/i.test(serialized)) {
    throw new Error("V2 MT5 offset-regime persistence rejected a forbidden field.");
  }
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  const temporaryFile = `${stateFile}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryFile, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
    await fs.rename(temporaryFile, stateFile);
  } catch (error) {
    await fs.rm(temporaryFile, { force: true }).catch(() => undefined);
    throw error;
  }
  return persisted;
}

export async function fetchV2Mt5TimeContract({ bridgeUrl, fetchImpl = fetch, timeoutMs = 5_000 }) {
  const origin = normalizeV2Mt5CollectorBridgeUrl(bridgeUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${origin}/time-contract`, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    if (!response.ok) throw new Error(`MT5 read-only time contract returned HTTP ${response.status}.`);
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_CONTRACT_BYTES) throw new Error("MT5 read-only time contract exceeded the compact response limit.");
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("MT5 read-only time contract returned invalid JSON.");
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function runV2Mt5OffsetRegimeCollectorCycle({
  bridgeUrl,
  brokerSymbol,
  stateFile,
  ledgerApi,
  fetchImpl = fetch,
  timeoutMs = 5_000,
  now = () => new Date().toISOString()
}) {
  const authority = Object.freeze({
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  });
  const ledger = await loadV2Mt5OffsetRegimeState({ stateFile, brokerSymbol, ledgerApi });
  let contract;
  try {
    contract = await fetchV2Mt5TimeContract({ bridgeUrl, fetchImpl, timeoutMs });
  } catch (error) {
    return Object.freeze({
      status: "unavailable",
      action: "none",
      brokerSymbol,
      statePreserved: true,
      activeRegimeId: ledger.activeRegimeId,
      blockers: Object.freeze([`time_contract_unavailable:${compactError(error)}`]),
      warnings: Object.freeze([]),
      shadowOnly: true,
      authority
    });
  }
  const observation = ledgerApi.v2Mt5OffsetRegimeObservationFromContract({ brokerSymbol, contract });
  const append = await ledgerApi.appendV2Mt5OffsetRegimeObservation({ ledger, observation });
  await saveV2Mt5OffsetRegimeState({
    stateFile,
    ledger: append.ledger,
    ledgerApi,
    savedAtUtc: now()
  });
  return Object.freeze({
    status: observation.accepted ? "observed" : "blocked",
    action: append.action,
    brokerSymbol,
    observationId: observation.observationId,
    capturedAtUtc: observation.capturedAtUtc,
    activeRegimeId: append.ledger.activeRegimeId,
    activeRegimeStartUtc: append.activeRegime?.startedAtUtc,
    activeObservationCount: append.activeRegime?.observationCount ?? 0,
    processedObservationCount: append.ledger.processedObservationCount,
    blockers: append.blockers,
    warnings: append.warnings,
    statePreserved: true,
    shadowOnly: true,
    authority
  });
}

const pidIsAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export async function acquireV2Mt5OffsetRegimeCollectorLock(stateFile) {
  const lockFile = `${stateFile}.lock`;
  await fs.mkdir(path.dirname(lockFile), { recursive: true });
  const acquire = async () => {
    const handle = await fs.open(lockFile, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAtUtc: new Date().toISOString() })}\n`, "utf8");
    return handle;
  };
  let handle;
  try {
    handle = await acquire();
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let stalePid;
    try {
      stalePid = JSON.parse(await fs.readFile(lockFile, "utf8")).pid;
    } catch {
      throw new Error("V2 MT5 collector lock exists and cannot be validated.");
    }
    if (pidIsAlive(Number(stalePid))) throw new Error(`V2 MT5 offset-regime collector is already running with PID ${stalePid}.`);
    await fs.rm(lockFile, { force: true });
    handle = await acquire();
  }
  let released = false;
  return Object.freeze({
    lockFile,
    async release() {
      if (released) return;
      released = true;
      await handle.close().catch(() => undefined);
      await fs.rm(lockFile, { force: true });
    }
  });
}
