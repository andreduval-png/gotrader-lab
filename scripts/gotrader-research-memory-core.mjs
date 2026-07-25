import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withFileLock } from "./gotrader-file-lock.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

export const RESEARCH_MEMORY_TOOL_NAMES = Object.freeze([
  "gotrader_research_memory_status",
  "gotrader_search_research_memory",
  "gotrader_get_research_memory_summary"
]);
export const RESEARCH_MEMORY_AUTHORITY = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
export const RESEARCH_MEMORY_LIMITS = Object.freeze({
  minimumQueryLength: 3,
  maximumQueryLength: 300,
  maximumTags: 10,
  defaultResults: 5,
  maximumResults: 20,
  maximumResponseBytes: 64 * 1024,
  maximumDateRangeDays: 730,
  timeoutMs: 8_000,
  maximumConcurrentSearches: 2,
  maximumRequestsPerWindow: 60,
  rateWindowMs: 60_000,
  maximumAuditBytes: 512 * 1024,
  retainedAuditBytes: 256 * 1024
});

const safety = Object.freeze({
  advisoryOnly: true,
  nativeEvidenceAuthoritative: true,
  canCreateEvidence: false,
  canApproveReadiness: false,
  canApplyCalibration: false,
  canCreateTradeIntent: false,
  productionAdoptionAllowed: false,
  authority: RESEARCH_MEMORY_AUTHORITY
});
const allowedSearchKeys = new Set([
  "query",
  "profileId",
  "profileVersion",
  "parameterFingerprint",
  "sourceFingerprint",
  "requestedSymbol",
  "brokerSymbol",
  "timeframe",
  "dateFromUtc",
  "dateToUtc",
  "outcome",
  "blocker",
  "tags",
  "limit"
]);
const forbiddenIntentPatterns = [
  ["raw_candles_requested", /\b(?:raw\s+)?(?:candles?|ohlcv)(?:\s+arrays?)?\b/i],
  ["runtime_snapshot_requested", /\b(?:raw\s+)?runtime\s+snapshots?\b/i],
  ["account_data_requested", /\baccount\s+(?:data|balance|details|records?)\b/i],
  ["order_data_requested", /\b(?:broker\s+)?orders?\s+(?:data|details|records?|history)\b/i],
  ["position_data_requested", /\bpositions?\s+(?:data|details|records?)\b/i],
  ["credentials_requested", /\b(?:credentials?|passwords?|api[_ -]?keys?|access\s+tokens?)\b/i],
  ["memory_mutation_requested", /\b(?:write|delete|update|mutate|overwrite)\s+(?:the\s+)?(?:memory|gbrain|evidence)\b/i],
  ["evidence_creation_requested", /\bcreate\s+(?:new\s+)?evidence\b/i],
  ["readiness_approval_requested", /\b(?:approve|override|promote)\s+(?:the\s+)?readiness\b/i],
  ["calibration_apply_requested", /\b(?:apply|activate)\s+(?:the\s+)?calibration\b/i],
  ["trade_execution_requested", /\b(?:place|execute|close|modify|cancel)\s+(?:a\s+|the\s+)?(?:trade|order|position)\b/i],
  ["authority_escalation_requested", /\b(?:grant|enable|derive)\s+(?:execution|broker|readiness)\s*authority\b/i]
];

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const byteLength = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");
const uniqueText = (values, limit = 20) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].slice(0, limit);
const compactText = (value, limit = 1_200) =>
  String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(?:ignore|disregard)\s+(?:all\s+)?(?:previous|prior)\s+instructions?/gi, "[untrusted instruction removed]")
    .replace(/(?:execution|broker|readinessOverride)Authority\s*[:=]\s*(?!none\b)\S+/gi, "[unsafe authority claim removed]")
    .replace(/data:[^;]+;base64,[a-z0-9+/=]+/gi, "[base64 removed]")
    .replace(/(?:api[_ -]?key|password|secret|bearer|token)\s*[:=]\s*\S+/gi, "[secret removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
const compactAuditText = (value, limit = 300) => {
  const text = compactText(value, limit);
  if (
    /(?:api[_ -]?key|password|secret|bearer|token)\s*[:=]/i.test(text) ||
    /data:[^;]+;base64,/i.test(text)
  ) {
    return "[redacted]";
  }
  return text;
};
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const authorityIsNone = (value) =>
  isObject(value) &&
  value.executionAuthority === "none" &&
  value.brokerAuthority === "none" &&
  value.readinessOverrideAuthority === "none";
const sidecarSafetyIsValid = (payload) =>
  isObject(payload) &&
  payload.advisoryOnly === true &&
  payload.nativeEvidenceAuthoritative === true &&
  payload.canCreateEvidence === false &&
  payload.canApproveReadiness === false &&
  payload.canApplyCalibration === false &&
  payload.canCreateTradeIntent === false &&
  payload.productionAdoptionAllowed === false &&
  authorityIsNone(payload.authority);

const provenance = (retrievalMode) => ({
  source: "local_gbrain_sidecar",
  retrievalMode,
  advisoryOnly: true,
  nativeEvidenceAuthoritative: true,
  untrustedRetrievedContent: true
});

const baseEnvelope = (retrievalMode) => ({
  ...safety,
  provenance: provenance(retrievalMode)
});

const normalizeIdentifier = (value, limit = 300) => compactText(value, limit);

const normalizeSearchInput = (input) => {
  if (!isObject(input)) return { valid: false, blockers: ["invalid_search_input"] };
  const unsupportedFields = Object.keys(input).filter((key) => !allowedSearchKeys.has(key));
  const query = String(input.query ?? "").trim();
  const blockers = [];
  if (unsupportedFields.length) blockers.push("unsupported_search_fields");
  if (query.length < RESEARCH_MEMORY_LIMITS.minimumQueryLength) blockers.push("query_too_short");
  if (query.length > RESEARCH_MEMORY_LIMITS.maximumQueryLength) blockers.push("query_too_long");
  for (const [blocker, pattern] of forbiddenIntentPatterns) {
    if (pattern.test(query)) blockers.push(blocker);
  }
  const tags = Array.isArray(input.tags)
    ? uniqueText(input.tags.map((tag) => normalizeIdentifier(tag, 80)), RESEARCH_MEMORY_LIMITS.maximumTags + 1)
    : [];
  if (input.tags !== undefined && !Array.isArray(input.tags)) blockers.push("invalid_tags");
  if (tags.length > RESEARCH_MEMORY_LIMITS.maximumTags) blockers.push("too_many_tags");
  const dateFrom = input.dateFromUtc ? new Date(String(input.dateFromUtc)) : undefined;
  const dateTo = input.dateToUtc ? new Date(String(input.dateToUtc)) : undefined;
  if (dateFrom && Number.isNaN(dateFrom.getTime())) blockers.push("invalid_date_from");
  if (dateTo && Number.isNaN(dateTo.getTime())) blockers.push("invalid_date_to");
  if (dateFrom && dateTo && !Number.isNaN(dateFrom.getTime()) && !Number.isNaN(dateTo.getTime())) {
    if (dateFrom > dateTo) blockers.push("invalid_date_range");
    if ((dateTo.getTime() - dateFrom.getTime()) / 86_400_000 > RESEARCH_MEMORY_LIMITS.maximumDateRangeDays) {
      blockers.push("date_range_too_large");
    }
  }
  const requestedLimit = Number(input.limit ?? RESEARCH_MEMORY_LIMITS.defaultResults);
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) blockers.push("invalid_limit");
  return {
    valid: blockers.length === 0,
    blockers: uniqueText(blockers),
    value: {
      query,
      profileId: normalizeIdentifier(input.profileId),
      profileVersion: normalizeIdentifier(input.profileVersion, 120),
      parameterFingerprint: normalizeIdentifier(input.parameterFingerprint),
      sourceFingerprint: normalizeIdentifier(input.sourceFingerprint),
      requestedSymbol: normalizeIdentifier(input.requestedSymbol, 80),
      brokerSymbol: normalizeIdentifier(input.brokerSymbol, 80),
      timeframe: normalizeIdentifier(input.timeframe, 40),
      dateFromUtc: dateFrom && !Number.isNaN(dateFrom.getTime()) ? dateFrom.toISOString() : undefined,
      dateToUtc: dateTo && !Number.isNaN(dateTo.getTime()) ? dateTo.toISOString() : undefined,
      outcome: normalizeIdentifier(input.outcome, 120),
      blocker: normalizeIdentifier(input.blocker),
      tags: tags.slice(0, RESEARCH_MEMORY_LIMITS.maximumTags),
      limit: Math.min(
        Math.max(Number.isInteger(requestedLimit) ? requestedLimit : RESEARCH_MEMORY_LIMITS.defaultResults, 1),
        RESEARCH_MEMORY_LIMITS.maximumResults
      )
    }
  };
};

const sanitizeAggregate = (value) => {
  if (!isObject(value)) return undefined;
  const numeric = (candidate) => typeof candidate === "number" && Number.isFinite(candidate) ? candidate : undefined;
  return {
    completedTrades: numeric(value.completedTrades),
    averageR: numeric(value.averageR),
    maximumDrawdownR: numeric(value.maximumDrawdownR),
    profitFactor: numeric(value.profitFactor),
    positiveCycle: typeof value.positiveCycle === "boolean" ? value.positiveCycle : undefined,
    oosVerdict: compactText(value.oosVerdict, 120) || undefined
  };
};

export const sanitizeResearchMemorySummary = (value, retrievalMode = "bounded_fallback") => {
  if (!isObject(value)) return undefined;
  const memoryId = String(value.memoryId ?? value.documentId ?? "");
  if (!/^gbrain_document_[a-z0-9._-]+$/i.test(memoryId)) return undefined;
  if (value.authority && !authorityIsNone(value.authority)) return undefined;
  const createdAtUtc = compactText(value.createdAtUtc ?? value.generatedAt, 80);
  return {
    memoryId,
    evidenceRecordId: compactText(value.evidenceRecordId, 200) || undefined,
    researchCycleId: compactText(value.researchCycleId ?? value.cycleId, 200) || undefined,
    profileId: compactText(value.profileId, 200) || undefined,
    profileVersion: compactText(value.profileVersion, 120) || undefined,
    parameterFingerprint: compactText(value.parameterFingerprint, 300) || undefined,
    requestedSymbol: compactText(value.requestedSymbol, 80) || undefined,
    brokerSymbol: compactText(value.brokerSymbol, 80) || undefined,
    timeframe: compactText(value.timeframe, 40) || undefined,
    marketDate: compactText(value.marketDate, 40) || undefined,
    sourceProvider: compactText(value.sourceProvider, 120) || undefined,
    title: compactText(value.title, 300) || "GoTrader research memory",
    createdAtUtc: createdAtUtc || new Date(0).toISOString(),
    storedAtUtc: compactText(value.storedAtUtc ?? value.storedAt, 80) || undefined,
    sourceFingerprint: compactText(value.sourceFingerprint, 300) || undefined,
    receiptId: compactText(value.receiptId, 240) || undefined,
    outcome: compactText(value.outcome, 120) || undefined,
    outcomeSummary: compactText(value.outcomeSummary ?? value.summary, 1_200) || undefined,
    blockerSummary: uniqueText(
      Array.isArray(value.blockerSummary) ? value.blockerSummary.map((item) => compactText(item, 300)) : [],
      16
    ),
    aggregateSummary: sanitizeAggregate(value.aggregateSummary),
    hypothesisSummary: compactText(value.hypothesisSummary, 800) || undefined,
    similarityTags: uniqueText(
      Array.isArray(value.similarityTags ?? value.tags)
        ? (value.similarityTags ?? value.tags).map((tag) => compactText(tag, 80))
        : [],
      20
    ),
    indexStatus: compactText(value.indexStatus, 80) || undefined,
    ...baseEnvelope(retrievalMode)
  };
};

const validateLoopbackUrl = (value) => {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname)
  ) {
    throw new Error("gbrain_sidecar_must_be_loopback");
  }
  return parsed.origin;
};

const appendBoundedAudit = async (auditPath, entry, limits) => {
  const lockPath = `${auditPath}.lock`;
  await withFileLock(lockPath, async () => {
    await fs.mkdir(path.dirname(auditPath), { recursive: true });
    let existing = "";
    try {
      existing = await fs.readFile(auditPath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const nextLine = `${JSON.stringify(entry)}\n`;
    let combined = `${existing}${nextLine}`;
    if (Buffer.byteLength(combined, "utf8") > limits.maximumAuditBytes) {
      const lines = combined.trimEnd().split(/\r?\n/);
      const retained = [];
      let retainedBytes = 0;
      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const lineBytes = Buffer.byteLength(lines[index], "utf8") + 1;
        if (retainedBytes + lineBytes > limits.retainedAuditBytes) break;
        retained.unshift(lines[index]);
        retainedBytes += lineBytes;
      }
      combined = `${retained.join("\n")}\n`;
    }
    const temporary = `${auditPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, combined, "utf8");
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await fs.rename(temporary, auditPath);
        break;
      } catch (error) {
        const retryable =
          error &&
          typeof error === "object" &&
          ["EPERM", "EBUSY", "EACCES"].includes(String(error.code ?? ""));
        if (!retryable || attempt === 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
      }
    }
  });
};

export const createGbrainResearchMemoryFacade = ({
  baseUrl = process.env.GOTRADER_GBRAIN_URL || "http://127.0.0.1:8799",
  fetchImpl = globalThis.fetch,
  auditPath = process.env.GOTRADER_MCP_MEMORY_AUDIT_PATH ||
    path.join(repoRoot, ".gotrader", "gbrain-sidecar", "mcp-retrieval-audit.jsonl"),
  agentId = process.env.GOTRADER_MCP_AGENT_ID || "local_stdio_agent",
  sessionId = crypto.randomUUID(),
  limits: limitOverrides = {}
} = {}) => {
  const endpoint = validateLoopbackUrl(baseUrl);
  const limits = { ...RESEARCH_MEMORY_LIMITS, ...limitOverrides };
  const requests = [];
  let concurrentSearches = 0;

  const checkRate = () => {
    const cutoff = Date.now() - limits.rateWindowMs;
    while (requests.length && requests[0] < cutoff) requests.shift();
    if (requests.length >= limits.maximumRequestsPerWindow) return false;
    requests.push(Date.now());
    return true;
  };

  const fetchJson = async (route, options = {}) => {
    const response = await fetchImpl(`${endpoint}${route}`, {
      ...options,
      headers: options.body ? { "Content-Type": "application/json", ...(options.headers ?? {}) } : options.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(limits.timeoutMs)
    });
    const payload = await response.json();
    return { response, payload };
  };

  const status = async (input = {}) => {
    if (
      !isObject(input) ||
      Object.keys(input).some((key) => key !== "includeCounts") ||
      (input.includeCounts !== undefined && typeof input.includeCounts !== "boolean")
    ) {
      return {
        status: "blocked",
        sidecarReachable: false,
        gbrainReachable: false,
        fallbackSearchAvailable: false,
        blockers: ["unsupported_status_fields"],
        warnings: [],
        ...baseEnvelope("status")
      };
    }
    try {
      const { response, payload } = await fetchJson("/v1/status");
      if (!response.ok || !sidecarSafetyIsValid(payload)) {
        return {
          status: "blocked",
          sidecarReachable: response.ok,
          gbrainReachable: false,
          fallbackSearchAvailable: false,
          blockers: ["unsafe_or_unrecognized_sidecar_status"],
          warnings: [],
          ...baseEnvelope("status")
        };
      }
      const includeCounts = input.includeCounts !== false;
      return {
        status: payload.status === "ready" ? "healthy" : "degraded",
        sidecarReachable: true,
        gbrainReachable: payload.gbrainBackend === "pglite",
        fallbackSearchAvailable: payload.storageBackend === "atomic_markdown_spool",
        indexedMemoryCount: includeCounts ? Number(payload.indexedDocumentCount ?? 0) : undefined,
        pendingMemoryCount: includeCounts ? Number(payload.pendingDocumentCount ?? 0) : undefined,
        failedMemoryCount: includeCounts ? Number(payload.failedDocumentCount ?? 0) : undefined,
        lastSuccessfulSyncUtc: compactText(payload.lastIndexedAt ?? payload.lastStoredAt, 80) || undefined,
        lastReceiptId: compactText(payload.lastReceiptId, 240) || undefined,
        blockers: [],
        warnings: payload.lastError ? [compactText(payload.lastError, 500)] : [],
        ...baseEnvelope("status")
      };
    } catch (error) {
      return {
        status: "offline",
        sidecarReachable: false,
        gbrainReachable: false,
        fallbackSearchAvailable: false,
        blockers: ["gbrain_sidecar_offline"],
        warnings: [compactText(error instanceof Error ? error.message : error, 300)],
        ...baseEnvelope("status")
      };
    }
  };

  const search = async (input) => {
    const normalized = normalizeSearchInput(input);
    if (!normalized.valid) {
      return {
        status: "blocked",
        results: [],
        resultCount: 0,
        responseTruncated: false,
        blockers: normalized.blockers,
        warnings: [],
        ...baseEnvelope("bounded_fallback")
      };
    }
    if (concurrentSearches >= limits.maximumConcurrentSearches) {
      return {
        status: "blocked",
        results: [],
        resultCount: 0,
        responseTruncated: false,
        blockers: ["concurrent_search_limit_reached"],
        warnings: [],
        ...baseEnvelope("bounded_fallback")
      };
    }
    concurrentSearches += 1;
    try {
      const { response, payload } = await fetchJson("/v1/search", {
        method: "POST",
        body: JSON.stringify(normalized.value)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!sidecarSafetyIsValid(payload) || !Array.isArray(payload.results)) {
        return {
          status: "blocked",
          results: [],
          resultCount: 0,
          responseTruncated: false,
          blockers: ["unsafe_or_unrecognized_memory_response"],
          warnings: [],
          ...baseEnvelope("bounded_fallback")
        };
      }
      const retrievalMode = payload.retrievalMode === "keyword" ? "keyword" : "bounded_fallback";
      const results = payload.results
        .map((item) => sanitizeResearchMemorySummary(item, retrievalMode))
        .filter(Boolean)
        .slice(0, normalized.value.limit);
      let bounded = [...results];
      let responseTruncated = false;
      let output = {
        status: "complete",
        results: bounded,
        resultCount: bounded.length,
        responseTruncated,
        blockers: [],
        warnings: [],
        ...baseEnvelope(retrievalMode)
      };
      while (bounded.length && byteLength(output) > limits.maximumResponseBytes) {
        bounded = bounded.slice(0, -1);
        responseTruncated = true;
        output = {
          ...output,
          results: bounded,
          resultCount: bounded.length,
          responseTruncated,
          warnings: ["response_size_limit_applied"]
        };
      }
      return output;
    } catch (error) {
      return {
        status: "offline",
        results: [],
        resultCount: 0,
        responseTruncated: false,
        blockers: ["gbrain_sidecar_offline"],
        warnings: [compactText(error instanceof Error ? error.message : error, 300)],
        ...baseEnvelope("bounded_fallback")
      };
    } finally {
      concurrentSearches -= 1;
    }
  };

  const summary = async (input) => {
    if (!isObject(input) || Object.keys(input).some((key) => key !== "memoryId")) {
      return {
        status: "blocked",
        blockers: ["unsupported_summary_fields"],
        warnings: [],
        ...baseEnvelope("direct_lookup")
      };
    }
    const memoryId = String(input.memoryId ?? "");
    if (!/^gbrain_document_[a-z0-9._-]+$/i.test(memoryId)) {
      return {
        status: "blocked",
        blockers: ["invalid_memory_id"],
        warnings: [],
        ...baseEnvelope("direct_lookup")
      };
    }
    try {
      const { response, payload } = await fetchJson(`/v1/memory/${encodeURIComponent(memoryId)}`);
      if (response.status === 404) {
        return {
          status: "not_found",
          blockers: [],
          warnings: [],
          ...baseEnvelope("direct_lookup")
        };
      }
      if (!response.ok || !sidecarSafetyIsValid(payload)) {
        return {
          status: "blocked",
          blockers: ["unsafe_or_unrecognized_memory_response"],
          warnings: [],
          ...baseEnvelope("direct_lookup")
        };
      }
      const memory = sanitizeResearchMemorySummary(payload.memory, "direct_lookup");
      if (!memory) {
        return {
          status: "blocked",
          blockers: ["unsafe_or_unrecognized_memory_summary"],
          warnings: [],
          ...baseEnvelope("direct_lookup")
        };
      }
      return {
        status: "complete",
        memory,
        blockers: [],
        warnings: [],
        ...baseEnvelope("direct_lookup")
      };
    } catch (error) {
      return {
        status: "offline",
        blockers: ["gbrain_sidecar_offline"],
        warnings: [compactText(error instanceof Error ? error.message : error, 300)],
        ...baseEnvelope("direct_lookup")
      };
    }
  };

  const execute = async (toolName, input = {}, context = {}) => {
    const requestId = context.requestId || crypto.randomUUID();
    const timestamp = new Date().toISOString();
    let result;
    if (!checkRate()) {
      result = {
        status: "blocked",
        blockers: ["mcp_memory_rate_limit_reached"],
        warnings: [],
        ...baseEnvelope(toolName.endsWith("_status") ? "status" : "bounded_fallback")
      };
    } else if (toolName === "gotrader_research_memory_status") {
      result = await status(input);
    } else if (toolName === "gotrader_search_research_memory") {
      result = await search(input);
    } else if (toolName === "gotrader_get_research_memory_summary") {
      result = await summary(input);
    } else {
      result = {
        status: "blocked",
        blockers: ["unsupported_memory_tool"],
        warnings: [],
        ...baseEnvelope("bounded_fallback")
      };
    }
    const audit = {
      requestId,
      timestamp,
      agentId: compactText(context.agentId ?? agentId, 120),
      sessionId: compactText(context.sessionId ?? sessionId, 120),
      toolName,
      queryHash: toolName === "gotrader_search_research_memory"
        ? sha256(String(input?.query ?? ""))
        : undefined,
      filters: toolName === "gotrader_search_research_memory" && isObject(input)
        ? Object.fromEntries(
            Object.entries(input)
              .filter(([key]) => key !== "query" && allowedSearchKeys.has(key))
              .map(([key, value]) => {
                if (["parameterFingerprint", "sourceFingerprint"].includes(key)) {
                  return [key, `sha256:${sha256(String(value))}`];
                }
                return [
                  key,
                  Array.isArray(value)
                    ? value.slice(0, 10).map((item) => compactAuditText(item, 80))
                    : compactAuditText(value, 300)
                ];
              })
          )
        : undefined,
      resultCount: Array.isArray(result.results) ? result.results.length : result.memory ? 1 : 0,
      responseSizeBytes: byteLength(result),
      retrievalMode: result.provenance?.retrievalMode,
      status: result.status,
      blockers: uniqueText(result.blockers ?? [], 20),
      authority: RESEARCH_MEMORY_AUTHORITY
    };
    try {
      await appendBoundedAudit(auditPath, audit, limits);
    } catch {
      result = {
        ...result,
        warnings: uniqueText([...(result.warnings ?? []), "retrieval_audit_log_unavailable"])
      };
    }
    return result;
  };

  return {
    execute,
    status,
    search,
    summary,
    limits,
    endpoint,
    auditPath
  };
};
