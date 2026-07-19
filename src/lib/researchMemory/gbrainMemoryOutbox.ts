import type { GoTraderResearchMemoryPacket } from "./researchMemoryTypes";

export const GBRAIN_MEMORY_OUTBOX_STORAGE_KEY = "gotrader.gbrain-memory-outbox.v1";
export const GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT = "gotrader-gbrain-memory-outbox-updated";
const MAX_OUTBOX_ENTRIES = 250;

export type GbrainMemoryOutboxStatus = "pending" | "delivered" | "failed";

export interface GbrainMemoryDocument {
  documentId: string;
  path: string;
  title: string;
  markdown: string;
  tags: string[];
  sourceFingerprint?: string;
  cycleId?: string;
  generatedAt: string;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}

export interface GbrainMemoryOutboxEntry {
  outboxId: string;
  queuedAt: string;
  status: GbrainMemoryOutboxStatus;
  attemptCount: number;
  lastAttemptAt?: string;
  deliveredAt?: string;
  lastError?: string;
  document: GbrainMemoryDocument;
}

export interface GbrainMemoryOutboxState {
  schemaVersion: 1;
  deliveryEnabled: boolean;
  endpointHost?: string;
  entries: GbrainMemoryOutboxEntry[];
  safetyNotice: "gbrain memory is advisory only. GoTrader remains the research and readiness authority.";
}

const initialState = (): GbrainMemoryOutboxState => ({
  schemaVersion: 1,
  deliveryEnabled: false,
  entries: [],
  safetyNotice: "gbrain memory is advisory only. GoTrader remains the research and readiness authority."
});

let sessionState = initialState();
const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const uniqueText = (values: Array<string | undefined>, limit = 12) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].slice(0, limit);

const safeLine = (value: unknown) => String(value ?? "n/a").replace(/[\r\n]+/g, " ").slice(0, 1200);

const authorityIsNone = (packet: GoTraderResearchMemoryPacket) =>
  packet.authority.executionAuthority === "none" &&
  packet.authority.brokerAuthority === "none" &&
  packet.authority.readinessOverrideAuthority === "none";

const forbiddenObjectKey = /^(?:account|accountData|accountId|accountNumber|orders?|orderData|positions?|positionData|password|secret|apiKey|api_key|token|mt5Credentials|screenshots?|base64|rawRuntimeSnapshot|rawSnapshot|importedOhlcv)$/i;

export function validateGbrainMemoryPacket(packet: GoTraderResearchMemoryPacket) {
  const blockedFields: string[] = [];
  const visit = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (value.length > 8_000) blockedFields.push(`${path}.oversized_text`);
      if (/data:[^;]+;base64,/i.test(value) || /(?:api[_-]?key|password|secret|bearer|token)\s*[:=]\s*\S+/i.test(value)) {
        blockedFields.push(`${path}.secret_or_base64_content`);
      }
      return;
    }
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      const itemPath = `${path}.${key}`;
      if (forbiddenObjectKey.test(key)) blockedFields.push(itemPath);
      if (/^(?:candles|rawCandles)$/i.test(key) && typeof item !== "number") blockedFields.push(itemPath);
      visit(item, itemPath);
    });
  };
  visit(packet, "packet");
  if (!authorityIsNone(packet)) blockedFields.push("packet.authority");
  const requiredExclusions = [
    "candle_arrays",
    "raw_runtime_snapshot",
    "secrets",
    "account_order_position_data",
    "screenshots_base64",
    "imported_ohlcv_arrays"
  ];
  requiredExclusions.forEach((exclusion) => {
    if (!packet.exclusions.includes(exclusion as never)) blockedFields.push(`packet.exclusions.${exclusion}`);
  });
  return {
    valid: blockedFields.length === 0,
    blockedFields: uniqueText(blockedFields, 30)
  };
}

export function buildGbrainMemoryDocument(packet: GoTraderResearchMemoryPacket): GbrainMemoryDocument {
  const validation = validateGbrainMemoryPacket(packet);
  if (!validation.valid) {
    throw new Error(`gbrain memory packet blocked: ${validation.blockedFields.join(", ")}`);
  }
  const subjectId = packet.memoryType === "research_cycle" && packet.cycleId
    ? packet.cycleId
    : packet.packetId;
  const path = `gotrader/${packet.memoryType.replace(/_/g, "-")}/${subjectId}.md`;
  const tags = uniqueText([
    "gotrader",
    packet.memoryType,
    packet.source.provider,
    packet.source.requestedSymbol,
    packet.source.timeframe,
    packet.regime.label,
    packet.readiness.state
  ]).map((tag) => tag.toLowerCase().replace(/[^a-z0-9._-]+/g, "-"));
  const lines = [
    `# GoTrader ${packet.memoryType.replace(/_/g, " ")} ${subjectId}`,
    "",
    `- Timestamp: ${safeLine(packet.timestamp)}`,
    `- Source: ${safeLine(packet.source.provider)} / ${safeLine(packet.source.requestedSymbol)} -> ${safeLine(packet.source.brokerSymbol)}`,
    `- Timeframe: ${safeLine(packet.source.timeframe)}`,
    `- Source fingerprint: ${safeLine(packet.source.sourceFingerprint)}`,
    `- Candle count: ${safeLine(packet.source.candleCount)}`,
    `- Regime: ${safeLine(packet.regime.label)} (${safeLine(packet.regime.dataQuality)})`,
    `- Sample: ${safeLine(packet.metrics.sampleSize)} trades, average ${safeLine(packet.metrics.averageR)}R, profit factor ${safeLine(packet.metrics.profitFactor)}`,
    `- Walk-forward: ${safeLine(packet.walkForwardVerdict?.verdict ?? "not available")}`,
    `- Evidence / maturity: ${safeLine(packet.evidenceMaturity.evidenceScore)} / ${safeLine(packet.evidenceMaturity.maturityScore)}`,
    `- Readiness: ${safeLine(packet.readiness.state)}`,
    "",
    "## Summary",
    safeLine("resultSummary" in packet ? packet.resultSummary : packet.nextAction),
    "",
    "## Blockers",
    ...(packet.blockers.length ? packet.blockers.map((blocker) => `- ${safeLine(blocker)}`) : ["- None recorded"]),
    "",
    "## Next Action",
    safeLine(packet.nextAction),
    "",
    "## Safety",
    "- Research memory only.",
    "- executionAuthority: none",
    "- brokerAuthority: none",
    "- readinessOverrideAuthority: none",
    "- Raw candles, runtime snapshots, secrets, account/order/position data, and screenshots are excluded."
  ];

  return {
    documentId: `gbrain_document_${packet.packetId}`,
    path,
    title: `GoTrader ${packet.memoryType.replace(/_/g, " ")} ${subjectId}`,
    markdown: lines.join("\n"),
    tags,
    sourceFingerprint: packet.source.sourceFingerprint,
    cycleId: "cycleId" in packet ? packet.cycleId : undefined,
    generatedAt: packet.timestamp,
    authority: {
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none"
    }
  };
}

const publish = (state: GbrainMemoryOutboxState) => {
  sessionState = state;
  if (isBrowser()) {
    window.localStorage.setItem(GBRAIN_MEMORY_OUTBOX_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT, { detail: state }));
  }
  return state;
};

export function loadGbrainMemoryOutbox(): GbrainMemoryOutboxState {
  if (!isBrowser()) return sessionState;
  try {
    const raw = window.localStorage.getItem(GBRAIN_MEMORY_OUTBOX_STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<GbrainMemoryOutboxState>;
    return {
      ...initialState(),
      ...parsed,
      // Missing legacy values fail closed. Only the literal true enables delivery.
      deliveryEnabled: parsed.deliveryEnabled === true,
      entries: Array.isArray(parsed.entries) ? parsed.entries.slice(0, MAX_OUTBOX_ENTRIES) : []
    };
  } catch {
    return initialState();
  }
}

export function setGbrainMemoryDeliveryEnabled(enabled: boolean, endpointHost?: string) {
  const state = loadGbrainMemoryOutbox();
  const sanitizedHost = (() => {
    if (!endpointHost) return undefined;
    try {
      const parsed = new URL(endpointHost.includes("://") ? endpointHost : `http://${endpointHost}`);
      return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    } catch {
      return undefined;
    }
  })();
  return publish({
    ...state,
    deliveryEnabled: enabled === true,
    endpointHost: enabled ? sanitizedHost : undefined
  });
}

export function queueGbrainMemoryPacket(packet: GoTraderResearchMemoryPacket) {
  const document = buildGbrainMemoryDocument(packet);
  const state = loadGbrainMemoryOutbox();
  const existing = state.entries.find((entry) => entry.document.documentId === document.documentId);
  if (existing) return existing;
  const entry: GbrainMemoryOutboxEntry = {
    outboxId: `gbrain_outbox_${packet.packetId}`,
    queuedAt: new Date().toISOString(),
    status: "pending",
    attemptCount: 0,
    document
  };
  publish({
    ...state,
    entries: [entry, ...state.entries].slice(0, MAX_OUTBOX_ENTRIES)
  });
  return entry;
}

const isLoopbackEndpoint = (endpoint: string) => {
  try {
    const url = new URL(endpoint);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
};

export async function deliverPendingGbrainMemory(options: {
  endpoint: string;
  fetchImpl?: typeof fetch;
  maximumEntries?: number;
}) {
  const state = loadGbrainMemoryOutbox();
  if (!state.deliveryEnabled) {
    return { status: "disabled" as const, delivered: 0, failed: 0 };
  }
  if (!isLoopbackEndpoint(options.endpoint)) {
    return { status: "blocked_non_loopback_endpoint" as const, delivered: 0, failed: 0 };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const pending = state.entries.filter((entry) => entry.status !== "delivered").slice(0, options.maximumEntries ?? 20);
  const updated = new Map(state.entries.map((entry) => [entry.outboxId, entry]));
  let delivered = 0;
  let failed = 0;
  for (const entry of pending) {
    const attemptedAt = new Date().toISOString();
    try {
      const response = await fetchImpl(options.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.document)
      });
      if (!response.ok) throw new Error(`Local gbrain gateway returned HTTP ${response.status}.`);
      delivered += 1;
      updated.set(entry.outboxId, {
        ...entry,
        status: "delivered",
        attemptCount: entry.attemptCount + 1,
        lastAttemptAt: attemptedAt,
        deliveredAt: attemptedAt,
        lastError: undefined
      });
    } catch (error) {
      failed += 1;
      updated.set(entry.outboxId, {
        ...entry,
        status: "failed",
        attemptCount: entry.attemptCount + 1,
        lastAttemptAt: attemptedAt,
        lastError: error instanceof Error ? error.message : "Local gbrain delivery failed."
      });
    }
  }
  publish({ ...state, entries: state.entries.map((entry) => updated.get(entry.outboxId) ?? entry) });
  return { status: failed ? "completed_with_failures" as const : "completed" as const, delivered, failed };
}
