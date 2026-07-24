#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const host = "127.0.0.1";
const port = Number(process.env.GOTRADER_GBRAIN_PORT || 8799);
const sidecarRoot = path.resolve(
  process.env.GOTRADER_GBRAIN_DATA_DIR || path.join(repoRoot, ".gotrader", "gbrain-sidecar")
);
const documentsRoot = path.join(sidecarRoot, "documents");
const statePath = path.join(sidecarRoot, "index.json");
const receiptsPath = path.join(sidecarRoot, "receipts.jsonl");
const gbrainHome = path.resolve(process.env.GBRAIN_HOME || path.join(sidecarRoot, "gbrain-home"));
const gbrainConfigPath = path.join(gbrainHome, ".gbrain", "config.json");
const localGbrainBin = path.join(
  sidecarRoot,
  "bin",
  process.platform === "win32" ? "gbrain.cmd" : "gbrain"
);
const vendorGbrainCli = path.resolve(
  process.env.GOTRADER_GBRAIN_VENDOR_CLI ||
    path.join(sidecarRoot, "vendor", "gbrain", "src", "cli.ts")
);
const userBunBin = path.join(os.homedir(), ".bun", "bin");
const npmGlobalBin = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "npm"
);
const npmBunBin = path.join(npmGlobalBin, "node_modules", "bun", "bin");
const bunExecutableCandidates = [
  process.env.BUN_COMMAND,
  path.join(userBunBin, process.platform === "win32" ? "bun.exe" : "bun"),
  path.join(npmBunBin, process.platform === "win32" ? "bun.exe" : "bun"),
  path.join(npmGlobalBin, process.platform === "win32" ? "bun.cmd" : "bun"),
  "bun"
].filter(Boolean);
const requestBodyLimit = 512 * 1024;
const maximumBatchSize = 100;
const maximumMarkdownSize = 32_000;
const maximumSearchResults = 25;
const allowedOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173"
]);
const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const safetyNotice =
  "Advisory research memory only. gbrain cannot approve readiness, apply calibration, call MT5, or enable execution.";
const memorySafetyPolicy = Object.freeze({
  advisoryOnly: true,
  nativeEvidenceAuthoritative: true,
  canCreateEvidence: false,
  canApproveReadiness: false,
  canApplyCalibration: false,
  canCreateTradeIntent: false,
  productionAdoptionAllowed: false
});

const initialState = () => ({
  schemaVersion: 1,
  updatedAt: new Date(0).toISOString(),
  documents: {},
  lastIndexedAt: null,
  lastError: null
});

let state = initialState();
let gbrainCapability = {
  checkedAt: null,
  command: null,
  commandArgsPrefix: [],
  displayCommand: null,
  installed: false,
  initialized: false,
  version: null,
  error: null
};
let indexingQueue = Promise.resolve();

const nowIso = () => new Date().toISOString();
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const uniqueText = (values, limit = 20) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].slice(0, limit);
const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isAuthorityNone = (value) =>
  isPlainObject(value) &&
  value.executionAuthority === "none" &&
  value.brokerAuthority === "none" &&
  value.readinessOverrideAuthority === "none";

const forbiddenKeyPattern =
  /^(?:account|accountData|accountId|accountNumber|orders?|orderData|positions?|positionData|password|secret|apiKey|api_key|token|mt5Credentials|screenshots?|base64|rawRuntimeSnapshot|rawSnapshot|rawCandles|candles|importedOhlcv)$/i;
const secretContentPattern =
  /data:[^;]+;base64,|(?:api[_-]?key|password|secret|bearer|token)\s*[:=]\s*\S+/i;

function validateDocument(document) {
  const blockedFields = [];
  if (!isPlainObject(document)) {
    return { valid: false, blockedFields: ["document"] };
  }
  if (!/^gbrain_document_[a-z0-9._-]+$/i.test(String(document.documentId ?? ""))) {
    blockedFields.push("document.documentId");
  }
  if (!/^gotrader\/[a-z0-9._/-]+\.md$/i.test(String(document.path ?? ""))) {
    blockedFields.push("document.path");
  }
  if (!String(document.title ?? "").trim() || String(document.title).length > 300) {
    blockedFields.push("document.title");
  }
  if (!String(document.markdown ?? "").trim() || String(document.markdown).length > maximumMarkdownSize) {
    blockedFields.push("document.markdown");
  }
  if (secretContentPattern.test(String(document.markdown ?? ""))) {
    blockedFields.push("document.markdown.secret_or_base64_content");
  }
  if (!Array.isArray(document.tags) || document.tags.length > 30) {
    blockedFields.push("document.tags");
  }
  if (!isAuthorityNone(document.authority)) {
    blockedFields.push("document.authority");
  }

  const visit = (value, currentPath) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }
    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedPath = `${currentPath}.${key}`;
      if (forbiddenKeyPattern.test(key)) blockedFields.push(nestedPath);
      visit(nestedValue, nestedPath);
    }
  };
  visit(document, "document");

  return {
    valid: blockedFields.length === 0,
    blockedFields: uniqueText(blockedFields, 40)
  };
}

function safeDocumentPath(relativePath) {
  const normalized = String(relativePath).replace(/\\/g, "/");
  const resolved = path.resolve(documentsRoot, ...normalized.split("/"));
  const relative = path.relative(documentsRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Document path escaped the GoTrader gbrain spool.");
  }
  return resolved;
}

async function atomicWrite(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, content, "utf8");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.rename(temporaryPath, filePath);
      return;
    } catch (error) {
      const retryable =
        error &&
        typeof error === "object" &&
        ["EPERM", "EBUSY", "EACCES"].includes(String(error.code ?? ""));
      if (!retryable || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}

async function appendReceipt(receipt) {
  await fs.mkdir(path.dirname(receiptsPath), { recursive: true });
  await fs.appendFile(receiptsPath, `${JSON.stringify(receipt)}\n`, "utf8");
}

async function loadState() {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, "utf8"));
    state = {
      ...initialState(),
      ...parsed,
      documents: isPlainObject(parsed.documents) ? parsed.documents : {}
    };
  } catch {
    state = initialState();
  }
}

async function saveState() {
  state.updatedAt = nowIso();
  await atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function candidateGbrainCommands() {
  const names = process.platform === "win32" ? ["gbrain.exe", "gbrain.cmd", "gbrain"] : ["gbrain"];
  const explicit = process.env.GBRAIN_COMMAND ? [process.env.GBRAIN_COMMAND] : [];
  return uniqueText([
    ...explicit,
    localGbrainBin,
    ...names.map((name) => path.join(userBunBin, name)),
    ...names.map((name) => path.join(npmGlobalBin, name)),
    ...names
  ]);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const isWindowsScript = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const executable = isWindowsScript ? process.env.ComSpec || "cmd.exe" : command;
    const executableArgs = isWindowsScript ? ["/d", "/s", "/c", command, ...args] : args;
    const child = spawn(executable, executableArgs, {
      cwd: repoRoot,
      env: {
        ...process.env,
        GBRAIN_HOME: gbrainHome,
        GBRAIN_NO_UPDATE_CHECK: "1",
        PATH: [userBunBin, npmBunBin, npmGlobalBin, process.env.PATH].filter(Boolean).join(path.delimiter)
      },
      stdio: [options.stdin ? "pipe" : "ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({
        ok: false,
        exitCode: null,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: "Command timed out."
      });
    }, options.timeoutMs ?? 30_000);
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      clearTimeout(timer);
      finish({ ok: false, exitCode: null, stdout: "", stderr: error.message });
    });
    child.on("exit", (exitCode) => {
      clearTimeout(timer);
      finish({
        ok: exitCode === 0,
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
    if (options.stdin) {
      child.stdin.end(options.stdin);
    }
  });
}

async function detectGbrainCapability() {
  const checkedAt = nowIso();
  try {
    await fs.access(vendorGbrainCli);
    for (const bunCommand of bunExecutableCandidates) {
      const result = await runCommand(bunCommand, [vendorGbrainCli, "--version"], {
        timeoutMs: 8_000
      });
      if (!result.ok) continue;
      let initialized = false;
      try {
        await fs.access(gbrainConfigPath);
        initialized = true;
      } catch {
        initialized = false;
      }
      gbrainCapability = {
        checkedAt,
        command: bunCommand,
        commandArgsPrefix: [vendorGbrainCli],
        displayCommand: localGbrainBin,
        installed: true,
        initialized,
        version: result.stdout.trim().slice(0, 120) || "installed",
        error: initialized
          ? null
          : "gbrain is installed but its GoTrader PGLite brain is not initialized."
      };
      return gbrainCapability;
    }
  } catch {
    // Fall through to a globally installed gbrain executable.
  }

  for (const command of candidateGbrainCommands()) {
    const result = await runCommand(command, ["--version"], { timeoutMs: 8_000 });
    if (!result.ok) continue;
    let initialized = false;
    try {
      await fs.access(gbrainConfigPath);
      initialized = true;
    } catch {
      initialized = false;
    }
    gbrainCapability = {
      checkedAt,
      command,
      commandArgsPrefix: [],
      displayCommand: command,
      installed: true,
      initialized,
      version: result.stdout.trim().slice(0, 120) || "installed",
      error: initialized ? null : "gbrain is installed but its GoTrader PGLite brain is not initialized."
    };
    return gbrainCapability;
  }
  gbrainCapability = {
    checkedAt,
    command: null,
    commandArgsPrefix: [],
    displayCommand: null,
    installed: false,
    initialized: false,
    version: null,
    error: "gbrain CLI is not installed. Durable GoTrader spool remains active."
  };
  return gbrainCapability;
}

function runGbrain(args, options = {}) {
  return runCommand(
    gbrainCapability.command,
    [...gbrainCapability.commandArgsPrefix, ...args],
    options
  );
}

async function indexDocument(document, contentHash) {
  if (!gbrainCapability.installed || !gbrainCapability.initialized || !gbrainCapability.command) {
    return {
      indexed: false,
      reason: gbrainCapability.error ?? "gbrain CLI is unavailable."
    };
  }
  const slug = String(document.path).replace(/\.md$/i, "");
  const result = await runGbrain(
    ["capture", "--stdin", "--json", "--slug", slug, "--type", "analysis"],
    { stdin: document.markdown, timeoutMs: 45_000 }
  );
  if (!result.ok) {
    return {
      indexed: false,
      reason: String(result.stderr || result.stdout || "gbrain capture failed.").trim().slice(0, 500)
    };
  }
  let receipt;
  try {
    receipt = JSON.parse(result.stdout);
  } catch {
    receipt = { output: result.stdout.trim().slice(0, 500) };
  }
  return { indexed: true, receipt, contentHash };
}

async function persistDocument(document) {
  const validation = validateDocument(document);
  if (!validation.valid) {
    return {
      accepted: false,
      status: "blocked_unsafe_document",
      blockedFields: validation.blockedFields
    };
  }
  const contentHash = sha256(document.markdown);
  const existing = state.documents[document.documentId];
  if (existing?.contentHash === contentHash && existing.indexStatus === "indexed") {
    return {
      accepted: true,
      status: "duplicate",
      documentId: document.documentId,
      indexStatus: existing.indexStatus
    };
  }

  const storedAt = nowIso();
  const storedPath = safeDocumentPath(document.path);
  await atomicWrite(storedPath, `${document.markdown.trim()}\n`);
  state.documents[document.documentId] = {
    documentId: document.documentId,
    path: document.path,
    title: document.title,
    tags: uniqueText(document.tags, 30),
    sourceFingerprint: document.sourceFingerprint,
    cycleId: document.cycleId,
    generatedAt: document.generatedAt,
    storedAt,
    contentHash,
    indexStatus: "pending",
    indexAttemptCount: existing?.indexAttemptCount ?? 0,
    lastIndexAttemptAt: existing?.lastIndexAttemptAt ?? null,
    lastIndexError: null
  };
  await saveState();

  const indexResult = await indexDocument(document, contentHash);
  const record = state.documents[document.documentId];
  record.indexAttemptCount += 1;
  record.lastIndexAttemptAt = nowIso();
  if (indexResult.indexed) {
    record.indexStatus = "indexed";
    record.indexedAt = nowIso();
    record.lastIndexError = null;
    state.lastIndexedAt = record.indexedAt;
    state.lastError = null;
  } else {
    record.indexStatus = "pending";
    record.lastIndexError = indexResult.reason;
    state.lastError = indexResult.reason;
  }
  await saveState();
  await appendReceipt({
    timestamp: nowIso(),
    eventType: "gotrader_gbrain_memory_stored",
    documentId: document.documentId,
    contentHash,
    storageStatus: "stored",
    indexStatus: record.indexStatus,
    authority
  });

  return {
    accepted: true,
    status: existing ? "updated" : "stored",
    documentId: document.documentId,
    indexStatus: record.indexStatus,
    indexError: record.lastIndexError
  };
}

async function retryPendingIndex() {
  await detectGbrainCapability();
  if (!gbrainCapability.installed || !gbrainCapability.initialized) {
    return { attempted: 0, indexed: 0, failed: 0 };
  }
  const pending = Object.values(state.documents).filter((record) => record.indexStatus !== "indexed");
  let indexed = 0;
  let failed = 0;
  for (const record of pending.slice(0, 100)) {
    try {
      const markdown = await fs.readFile(safeDocumentPath(record.path), "utf8");
      const result = await indexDocument({ path: record.path, markdown }, record.contentHash);
      record.indexAttemptCount += 1;
      record.lastIndexAttemptAt = nowIso();
      if (result.indexed) {
        indexed += 1;
        record.indexStatus = "indexed";
        record.indexedAt = nowIso();
        record.lastIndexError = null;
        state.lastIndexedAt = record.indexedAt;
      } else {
        failed += 1;
        record.indexStatus = "pending";
        record.lastIndexError = result.reason;
        state.lastError = result.reason;
      }
    } catch (error) {
      failed += 1;
      record.indexStatus = "failed";
      record.lastIndexError = error instanceof Error ? error.message : String(error);
      state.lastError = record.lastIndexError;
    }
  }
  await saveState();
  return { attempted: pending.length, indexed, failed };
}

function queueIndexRetry() {
  indexingQueue = indexingQueue.then(retryPendingIndex, retryPendingIndex);
  return indexingQueue;
}

function compactStatus() {
  const documents = Object.values(state.documents);
  const indexedDocumentCount = documents.filter((record) => record.indexStatus === "indexed").length;
  const failedDocumentCount = documents.filter((record) => record.indexStatus === "failed").length;
  const pendingDocumentCount = documents.length - indexedDocumentCount - failedDocumentCount;
  const status =
    gbrainCapability.installed && gbrainCapability.initialized
      ? pendingDocumentCount || failedDocumentCount
        ? "degraded_index_pending"
        : "ready"
      : "degraded_spool_only";
  return {
    provider: "gbrain_local",
    service: "gotrader_gbrain_sidecar",
    status,
    sidecarStatus: "running",
    endpoint: `http://${host}:${port}`,
    storageBackend: "atomic_markdown_spool",
    gbrainBackend: gbrainCapability.initialized ? "pglite" : "unavailable",
    gbrainCliInstalled: gbrainCapability.installed,
    gbrainInitialized: gbrainCapability.initialized,
    gbrainVersion: gbrainCapability.version,
    durableDocumentCount: documents.length,
    indexedDocumentCount,
    pendingDocumentCount,
    failedDocumentCount,
    lastStoredAt: documents.map((record) => record.storedAt).sort().at(-1) ?? null,
    lastIndexedAt: state.lastIndexedAt,
    lastError: state.lastError ?? gbrainCapability.error,
    dataDirectory: sidecarRoot,
    authority,
    safetyNotice
  };
}

async function searchSpool(query, limit) {
  const terms = uniqueText(
    String(query).toLowerCase().split(/[^a-z0-9._-]+/).filter((term) => term.length > 1),
    20
  );
  const records = Object.values(state.documents);
  const results = [];
  for (const record of records) {
    try {
      const markdown = await fs.readFile(safeDocumentPath(record.path), "utf8");
      const haystack = `${record.title}\n${record.tags.join(" ")}\n${markdown}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.split(term).length - 1), 0);
      if (!score && terms.length) continue;
      results.push({
        documentId: record.documentId,
        path: record.path,
        title: record.title,
        score,
        sourceFingerprint: record.sourceFingerprint,
        cycleId: record.cycleId,
        generatedAt: record.generatedAt,
        summary: markdown
          .replace(/^#.+$/gm, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500)
      });
    } catch {
      // A missing spool file is reported through status/reconciliation, not leaked into search.
    }
  }
  return results
    .sort((left, right) => right.score - left.score || String(right.generatedAt).localeCompare(String(left.generatedAt)))
    .slice(0, limit);
}

async function searchGbrain(query, limit) {
  if (!gbrainCapability.installed || !gbrainCapability.initialized || !gbrainCapability.command) {
    return null;
  }
  const result = await runGbrain(
    ["call", "search", JSON.stringify({ query, limit })],
    { timeoutMs: 30_000 }
  );
  if (!result.ok) return null;
  try {
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? parsed : parsed?.content ?? parsed?.results ?? null;
  } catch {
    return null;
  }
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({
    ...payload,
    ...memorySafetyPolicy,
    authority,
    safetyNotice
  }));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > requestBodyLimit) {
      throw new Error("request_body_too_large");
    }
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

async function handleRequest(request, response) {
  applyCors(request, response);
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  const url = new URL(request.url || "/", `http://${host}:${port}`);
  if (request.method === "GET" && ["/health", "/v1/status"].includes(url.pathname)) {
    sendJson(response, 200, compactStatus());
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/memory/recent") {
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);
    const documents = Object.values(state.documents)
      .sort((left, right) => String(right.storedAt).localeCompare(String(left.storedAt)))
      .slice(0, limit)
      .map((record) => ({
        documentId: record.documentId,
        path: record.path,
        title: record.title,
        tags: record.tags,
        sourceFingerprint: record.sourceFingerprint,
        cycleId: record.cycleId,
        generatedAt: record.generatedAt,
        storedAt: record.storedAt,
        indexStatus: record.indexStatus
      }));
    sendJson(response, 200, { status: "complete", documents, authority, safetyNotice });
    return;
  }
  if (request.method === "POST" && ["/ingest", "/v1/memory"].includes(url.pathname)) {
    const result = await persistDocument(await readJson(request));
    sendJson(response, result.accepted ? 200 : 422, { ...result, authority, safetyNotice });
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/memory/batch") {
    const payload = await readJson(request);
    const documents = Array.isArray(payload.documents) ? payload.documents.slice(0, maximumBatchSize) : [];
    if (!documents.length) {
      sendJson(response, 400, { status: "invalid_batch", authority, safetyNotice });
      return;
    }
    const results = [];
    for (const document of documents) {
      results.push(await persistDocument(document));
    }
    sendJson(response, results.some((result) => !result.accepted) ? 207 : 200, {
      status: "complete",
      accepted: results.filter((result) => result.accepted).length,
      blocked: results.filter((result) => !result.accepted).length,
      results,
      authority,
      safetyNotice
    });
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/sync") {
    const result = await queueIndexRetry();
    sendJson(response, 200, { status: "complete", ...result, authority, safetyNotice });
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/search") {
    const payload = await readJson(request);
    const query = String(payload.query ?? "").trim().slice(0, 500);
    const limit = Math.min(Math.max(Number(payload.limit || 10), 1), maximumSearchResults);
    if (!query) {
      sendJson(response, 400, { status: "invalid_query", authority, safetyNotice });
      return;
    }
    const gbrainResults = await searchGbrain(query, limit);
    const results = Array.isArray(gbrainResults) ? gbrainResults.slice(0, limit) : await searchSpool(query, limit);
    sendJson(response, 200, {
      status: "complete",
      backend: Array.isArray(gbrainResults) ? "gbrain_pglite_keyword" : "spool_keyword",
      query,
      results,
      authority,
      safetyNotice
    });
    return;
  }
  sendJson(response, 404, { status: "not_found", authority, safetyNotice });
}

await fs.mkdir(documentsRoot, { recursive: true });
await fs.mkdir(gbrainHome, { recursive: true });
await loadState();
await detectGbrainCapability();
void queueIndexRetry();

const server = http.createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(response, message === "request_body_too_large" ? 413 : 400, {
      status: "request_failed",
      error: message.slice(0, 500),
      authority,
      safetyNotice
    });
  });
});

server.listen(port, host, () => {
  console.log(`GoTrader gbrain sidecar listening on http://${host}:${port}`);
  console.log(`Durable research memory: ${sidecarRoot}`);
  console.log(`gbrain home: ${gbrainHome}`);
  console.log(safetyNotice);
});

const retryTimer = setInterval(() => {
  void queueIndexRetry();
}, 60_000);
retryTimer.unref();

const shutdown = () => {
  clearInterval(retryTimer);
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
