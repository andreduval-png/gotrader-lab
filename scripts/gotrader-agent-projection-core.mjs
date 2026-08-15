import { GOTRADER_AGENT_AUTHORITY, withAgentProvenance } from "./gotrader-agent-provenance-core.mjs";

export const GOTRADER_AGENT_PROJECTION_CONTRACT = "gotrader.agent_projection";
export const GOTRADER_AGENT_PROJECTION_VERSION = "1.0";
export const GOTRADER_AGENT_PROJECTION_TYPES = Object.freeze(["current_cycle", "results"]);
export const GOTRADER_AGENT_PROJECTION_LIMITS = Object.freeze({
  maximumBytes: 256 * 1024,
  currentCycleMaxAgeMs: 15 * 60 * 1000,
  resultsMaxAgeMs: 30 * 60 * 1000,
  futureToleranceMs: 30 * 1000,
  timeoutMs: 5_000
});

const forbiddenKeyPattern = /^(?:candles|rawCandles|ohlcv|rawRuntimeSnapshot|rawSnapshot|accountData|orders?|orderData|positions?|positionData|credentials?|password|secret|apiKey|api_key|token|mt5Credentials|screenshots?|base64|importedOhlcv)$/i;
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const authorityIsNone = (value) =>
  isObject(value) &&
  value.executionAuthority === "none" &&
  value.brokerAuthority === "none" &&
  value.readinessOverrideAuthority === "none";

const findForbiddenKey = (value, path = "projection") => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return undefined;
  }
  if (!isObject(value)) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeyPattern.test(key)) return `${path}.${key}`;
    const found = findForbiddenKey(child, `${path}.${key}`);
    if (found) return found;
  }
  return undefined;
};

export const evaluateProjectionFreshness = ({ generatedAt, maxAgeMs, now = Date.now(), limits = GOTRADER_AGENT_PROJECTION_LIMITS }) => {
  const timestamp = Date.parse(String(generatedAt ?? ""));
  if (!Number.isFinite(timestamp)) {
    return { status: "invalid", fresh: false, ageMs: null, blocker: "projection_timestamp_invalid" };
  }
  const ageMs = now - timestamp;
  if (ageMs < -limits.futureToleranceMs) {
    return { status: "future", fresh: false, ageMs, blocker: "projection_timestamp_in_future" };
  }
  if (ageMs > maxAgeMs) {
    return { status: "stale", fresh: false, ageMs, blocker: "projection_stale" };
  }
  return { status: "fresh", fresh: true, ageMs: Math.max(0, ageMs), blocker: null };
};

export const validateAgentProjection = (value, expectedType) => {
  const blockers = [];
  if (!isObject(value)) blockers.push("projection_not_object");
  if (value?.contract !== GOTRADER_AGENT_PROJECTION_CONTRACT) blockers.push("projection_contract_invalid");
  if (value?.version !== GOTRADER_AGENT_PROJECTION_VERSION) blockers.push("projection_version_invalid");
  if (!GOTRADER_AGENT_PROJECTION_TYPES.includes(value?.projectionType)) blockers.push("projection_type_invalid");
  if (expectedType && value?.projectionType !== expectedType) blockers.push("projection_type_mismatch");
  if (!authorityIsNone(value?.authority)) blockers.push("projection_authority_not_none");
  const forbiddenKey = findForbiddenKey(value);
  if (forbiddenKey) blockers.push(`projection_forbidden_field:${forbiddenKey}`);
  if (Buffer.byteLength(JSON.stringify(value ?? null), "utf8") > GOTRADER_AGENT_PROJECTION_LIMITS.maximumBytes) {
    blockers.push("projection_too_large");
  }
  return { valid: blockers.length === 0, blockers };
};

const validateLoopbackUrl = (value) => {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" || !["127.0.0.1", "localhost", "::1", "[::1]"].includes(parsed.hostname)) {
    throw new Error("agent_projection_sidecar_must_be_loopback");
  }
  return parsed.origin;
};

export const createAgentProjectionReader = ({
  baseUrl = process.env.GOTRADER_AGENT_INTERFACE_URL || process.env.GOTRADER_GBRAIN_URL || "http://127.0.0.1:8799",
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  limits: limitOverrides = {}
} = {}) => {
  const endpoint = validateLoopbackUrl(baseUrl);
  const limits = { ...GOTRADER_AGENT_PROJECTION_LIMITS, ...limitOverrides };
  const read = async (projectionType, toolName) => {
    const route = projectionType === "current_cycle" ? "current-cycle" : "results";
    let response;
    let projection;
    try {
      response = await fetchImpl(`${endpoint}/v1/projections/${route}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(limits.timeoutMs)
      });
      projection = await response.json();
    } catch (error) {
      return withAgentProvenance({
        status: "offline",
        projectionType,
        blockers: ["agent_projection_sidecar_offline"],
        warnings: [String(error instanceof Error ? error.message : error).slice(0, 300)]
      }, {
        toolName,
        evidenceClass: "fresh_operational_projection",
        source: "gotrader_research_memory_sidecar",
        freshness: { status: "unavailable", fresh: false }
      });
    }
    if (!response.ok) {
      return withAgentProvenance({
        status: response.status === 404 ? "unavailable" : "blocked",
        projectionType,
        blockers: [projection?.blocker || "agent_projection_unavailable"],
        warnings: []
      }, {
        toolName,
        evidenceClass: "fresh_operational_projection",
        source: "gotrader_research_memory_sidecar",
        freshness: { status: "unavailable", fresh: false }
      });
    }
    const validation = validateAgentProjection(projection, projectionType);
    const maxAgeMs = projectionType === "current_cycle" ? limits.currentCycleMaxAgeMs : limits.resultsMaxAgeMs;
    const freshness = evaluateProjectionFreshness({ generatedAt: projection.generatedAt, maxAgeMs, now: now(), limits });
    const blockers = [...validation.blockers, ...(freshness.blocker ? [freshness.blocker] : [])];
    return withAgentProvenance({
      status: blockers.length ? "blocked" : "available",
      projectionType,
      projection: blockers.length ? undefined : projection.payload,
      blockers,
      warnings: []
    }, {
      toolName,
      evidenceClass: "fresh_operational_projection",
      source: "gotrader_research_memory_sidecar",
      observedAt: projection.observedAt,
      sourceUpdatedAt: projection.generatedAt,
      freshness,
      identities: projection.identities ?? {}
    });
  };
  return {
    readCurrentCycle: () => read("current_cycle", "gotrader_get_current_cycle"),
    readResults: () => read("results", "gotrader_get_results")
  };
};

export const AGENT_PROJECTION_AUTHORITY = GOTRADER_AGENT_AUTHORITY;
