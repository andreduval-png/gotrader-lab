import fs from "node:fs/promises";
import path from "node:path";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const MAX_JSON_BYTES = 8 * 1024 * 1024;

export function resolveV2IfvgLiveShadowMode(input) {
  const normalized = String(input ?? "shadow").trim().toLowerCase();
  if (["shadow", "enabled", "on", "true", "1"].includes(normalized)) return "shadow";
  if (["disabled", "off", "false", "0"].includes(normalized)) return "disabled";
  throw new Error("V2_IFVG_LIVE_SHADOW_MODE must be shadow or disabled.");
}

export function normalizeV2IfvgLiveShadowBridgeUrl(input) {
  const parsed = new URL(String(input || "http://127.0.0.1:7341"));
  if (parsed.protocol !== "http:") throw new Error("The IFVG live shadow collector requires loopback HTTP.");
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) throw new Error("The IFVG live shadow collector refuses non-loopback hosts.");
  if (parsed.username || parsed.password) throw new Error("Credentials are forbidden in the IFVG live shadow collector URL.");
  if (parsed.search || parsed.hash) throw new Error("Query strings and fragments are forbidden in the collector base URL.");
  return parsed.origin;
}

const fetchJson = async ({ fetchImpl, timeoutMs, url }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) {
      throw new Error("MT5 read-only response exceeded the live shadow size limit.");
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`MT5 read-only endpoint returned invalid JSON (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      throw new Error(`MT5 read-only endpoint returned HTTP ${response.status}.`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
};

export async function fetchV2IfvgLiveShadowInputs({
  bridgeUrl,
  brokerSymbol,
  fetchImpl = fetch,
  limits,
  requestedSymbol,
  timeoutMs,
  timeframes
}) {
  const origin = normalizeV2IfvgLiveShadowBridgeUrl(bridgeUrl);
  const timeContract = await fetchJson({
    fetchImpl,
    timeoutMs,
    url: `${origin}/time-contract`
  });
  const feeds = {};
  for (const timeframe of timeframes) {
    const params = new URLSearchParams({
      requestedSymbol,
      symbol: brokerSymbol,
      timeframe,
      limit: String(limits[timeframe])
    });
    const payload = await fetchJson({
      fetchImpl,
      timeoutMs,
      url: `${origin}/candles?${params}`
    });
    const candles = Array.isArray(payload?.candles) ? payload.candles : [];
    if (!candles.length) throw new Error(`MT5 read-only ${timeframe} window returned no candles.`);
    feeds[timeframe] = Object.freeze({
      candles,
      connectionStatus: payload.connectionStatus === "connected" ? "connected" : "degraded",
      firstTimestamp: payload.firstTimestamp ?? candles[0]?.timestamp,
      lastTimestamp: payload.lastTimestamp ?? candles.at(-1)?.timestamp,
      warnings: Object.freeze(Array.isArray(payload.warnings) ? payload.warnings.map(String) : [])
    });
  }
  return Object.freeze({
    origin,
    timeContract,
    feeds: Object.freeze(feeds)
  });
}

export async function loadV2IfvgLiveShadowLedger({
  brokerSymbol,
  ledgerApi,
  requestedSymbol,
  stateFile,
  timeframe
}) {
  let text;
  try {
    text = await fs.readFile(stateFile, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return ledgerApi.createV2IfvgV3LiveShadowLedger({
        requestedSymbol,
        brokerSymbol,
        timeframe
      });
    }
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Existing IFVG live shadow state is not valid JSON; refusing to overwrite it.");
  }
  const validation = await ledgerApi.validateV2IfvgV3LiveShadowLedgerFile(parsed);
  if (validation.status !== "accepted" || !validation.ledger) {
    throw new Error(`Existing IFVG live shadow state failed validation: ${validation.blockers.join(", ")}`);
  }
  if (
    validation.ledger.requestedSymbol !== requestedSymbol ||
    validation.ledger.brokerSymbol !== brokerSymbol ||
    validation.ledger.timeframe !== timeframe
  ) {
    throw new Error("Existing IFVG live shadow state belongs to a different market identity.");
  }
  return validation.ledger;
}

export async function loadV2IfvgOffsetRegimeLedger({ stateFile, validationApi }) {
  let text;
  try {
    text = await fs.readFile(stateFile, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Existing MT5 offset-regime state is not valid JSON.");
  }
  const validation = await validationApi.validateV2Mt5OffsetRegimeLedgerFile(parsed);
  if (validation.status !== "accepted" || !validation.ledger) {
    throw new Error(`Existing MT5 offset-regime state failed validation: ${validation.blockers.join(", ")}`);
  }
  return validation.ledger;
}

export async function saveV2IfvgLiveShadowLedger({
  ledger,
  ledgerApi,
  savedAtUtc,
  stateFile
}) {
  const persisted = await ledgerApi.buildV2IfvgV3LiveShadowLedgerFile({ ledger, savedAtUtc });
  const serialized = `${JSON.stringify(persisted, null, 2)}\n`;
  if (
    /"candles"\s*:|rawCandles|rawRuntimeSnapshot|rawSnapshot|accountData|orderData|positionData|password|secret|apiKey|token|mt5Credentials|base64/i.test(serialized)
  ) {
    throw new Error("IFVG live shadow persistence rejected a forbidden field.");
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

const pidIsAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export async function acquireV2IfvgLiveShadowLock(stateFile) {
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
      throw new Error("IFVG live shadow collector lock exists and cannot be validated.");
    }
    if (pidIsAlive(Number(stalePid))) {
      throw new Error(`IFVG live shadow collector is already running with PID ${stalePid}.`);
    }
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
