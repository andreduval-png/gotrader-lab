import {
  buildResearchEvidenceMemoryPacket,
  listResearchEvidenceRecords
} from "@/lib/researchEvidenceLedger";
import {
  buildGbrainMemoryDocument,
  deliverPendingGbrainMemory,
  loadGbrainMemoryOutbox,
  setGbrainMemoryDeliveryEnabled,
  type GbrainMemoryDocument
} from "@/lib/researchMemory/gbrainMemoryOutbox";
import { buildSupplementalEvidenceMemoryPackets } from "@/lib/researchMemory/supplementalResearchMemoryPackets";

export const GBRAIN_SIDECAR_BASE_URL = "http://127.0.0.1:8799";
export const GBRAIN_SIDECAR_STATUS_STORAGE_KEY = "gotrader.gbrain-sidecar-status.v1";
export const GBRAIN_SIDECAR_STATUS_UPDATED_EVENT = "gotrader-gbrain-sidecar-status-updated";

export interface GbrainSidecarStatus {
  provider: "gbrain_local";
  service: "gotrader_research_memory_sidecar";
  status: "ready" | "degraded_spool_only" | "degraded_index_pending" | "offline";
  sidecarStatus: "running" | "offline";
  storageBackend: "atomic_markdown_spool" | "unavailable";
  gbrainBackend: "pglite" | "unavailable";
  gbrainCliInstalled: boolean;
  gbrainInitialized: boolean;
  gbrainVersion?: string | null;
  durableDocumentCount: number;
  indexedDocumentCount: number;
  pendingDocumentCount: number;
  failedDocumentCount: number;
  lastStoredAt?: string | null;
  lastIndexedAt?: string | null;
  lastError?: string | null;
  dataDirectory?: string;
  advisoryOnly: true;
  nativeEvidenceAuthoritative: true;
  canCreateEvidence: false;
  canApproveReadiness: false;
  canApplyCalibration: false;
  canCreateTradeIntent: false;
  productionAdoptionAllowed: false;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
  safetyNotice: string;
}

export interface GbrainMemorySearchResult {
  documentId?: string;
  path?: string;
  title?: string;
  score?: number;
  sourceFingerprint?: string;
  cycleId?: string;
  generatedAt?: string;
  summary?: string;
  slug?: string;
  content?: string;
}

export interface GbrainMemorySearchResponse {
  status: "complete" | "offline" | "blocked_unsafe_response";
  backend: "gbrain_pglite_keyword" | "spool_keyword" | "unavailable";
  query: string;
  results: GbrainMemorySearchResult[];
  authority: GbrainSidecarStatus["authority"];
  warning?: string;
}

export interface GbrainResearchMemorySyncResult {
  status: "complete" | "complete_with_warnings" | "offline" | "blocked_unsafe_response";
  backfilled: number;
  delivered: number;
  failed: number;
  statusSnapshot: GbrainSidecarStatus;
  warning?: string;
}

const authorityNone = Object.freeze({
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
});

const offlineStatus = (warning?: string): GbrainSidecarStatus => ({
  provider: "gbrain_local",
  service: "gotrader_research_memory_sidecar",
  status: "offline",
  sidecarStatus: "offline",
  storageBackend: "unavailable",
  gbrainBackend: "unavailable",
  gbrainCliInstalled: false,
  gbrainInitialized: false,
  durableDocumentCount: 0,
  indexedDocumentCount: 0,
  pendingDocumentCount: 0,
  failedDocumentCount: 0,
  lastError: warning ?? "The local gbrain sidecar is offline.",
  advisoryOnly: true,
  nativeEvidenceAuthoritative: true,
  canCreateEvidence: false,
  canApproveReadiness: false,
  canApplyCalibration: false,
  canCreateTradeIntent: false,
  productionAdoptionAllowed: false,
  authority: authorityNone,
  safetyNotice: "Advisory research memory only. GoTrader remains authoritative."
});

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const authorityIsNone = (value: unknown): value is GbrainSidecarStatus["authority"] => {
  if (!value || typeof value !== "object") return false;
  const authority = value as Record<string, unknown>;
  return (
    authority.executionAuthority === "none" &&
    authority.brokerAuthority === "none" &&
    authority.readinessOverrideAuthority === "none"
  );
};

const publishStatus = (status: GbrainSidecarStatus) => {
  if (!isBrowser()) return status;
  try {
    window.localStorage.setItem(GBRAIN_SIDECAR_STATUS_STORAGE_KEY, JSON.stringify(status));
  } catch {
    // Status caching is optional; the sidecar spool remains authoritative.
  }
  window.dispatchEvent(new CustomEvent(GBRAIN_SIDECAR_STATUS_UPDATED_EVENT, { detail: status }));
  return status;
};

export function loadCachedGbrainSidecarStatus(): GbrainSidecarStatus {
  if (!isBrowser()) return offlineStatus();
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GBRAIN_SIDECAR_STATUS_STORAGE_KEY) ?? "null"
    ) as (GbrainSidecarStatus & { service?: string }) | null;
    if (
      parsed?.provider === "gbrain_local" &&
      ["gotrader_research_memory_sidecar", "gotrader_gbrain_sidecar"].includes(parsed.service ?? "") &&
      parsed.advisoryOnly === true &&
      parsed.nativeEvidenceAuthoritative === true &&
      parsed.productionAdoptionAllowed === false &&
      authorityIsNone(parsed.authority)
    ) {
      return { ...parsed, service: "gotrader_research_memory_sidecar" };
    }
  } catch {
    // Fall through to the fail-closed offline snapshot.
  }
  return offlineStatus();
}

export async function fetchGbrainSidecarStatus(options: {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
} = {}): Promise<GbrainSidecarStatus> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? GBRAIN_SIDECAR_BASE_URL;
  try {
    const response = await fetchImpl(`${baseUrl}/v1/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as GbrainSidecarStatus & { service?: string };
    if (
      payload.provider !== "gbrain_local" ||
      !["gotrader_research_memory_sidecar", "gotrader_gbrain_sidecar"].includes(payload.service ?? "") ||
      payload.sidecarStatus !== "running" ||
      payload.advisoryOnly !== true ||
      payload.nativeEvidenceAuthoritative !== true ||
      payload.productionAdoptionAllowed !== false ||
      payload.canCreateEvidence !== false ||
      payload.canApproveReadiness !== false ||
      payload.canApplyCalibration !== false ||
      payload.canCreateTradeIntent !== false ||
      !authorityIsNone(payload.authority)
    ) {
      const blocked = offlineStatus("The local memory service returned an unsafe or unrecognized status.");
      blocked.status = "offline";
      return publishStatus(blocked);
    }
    return publishStatus({ ...payload, service: "gotrader_research_memory_sidecar" });
  } catch (error) {
    return publishStatus(
      offlineStatus(
        `Local gbrain sidecar unavailable: ${error instanceof Error ? error.message : "request failed"}.`
      )
    );
  }
}

async function postDocuments(
  documents: GbrainMemoryDocument[],
  options: { fetchImpl?: typeof fetch; baseUrl?: string } = {}
) {
  if (!documents.length) return { accepted: 0, blocked: 0 };
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? GBRAIN_SIDECAR_BASE_URL;
  let accepted = 0;
  let blocked = 0;
  for (let index = 0; index < documents.length; index += 100) {
    const response = await fetchImpl(`${baseUrl}/v1/memory/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: documents.slice(index, index + 100) }),
      signal: AbortSignal.timeout(20_000)
    });
    const payload = (await response.json()) as { accepted?: number; blocked?: number };
    if (!response.ok && response.status !== 207) {
      throw new Error(`Local gbrain batch returned HTTP ${response.status}.`);
    }
    accepted += Number(payload.accepted ?? 0);
    blocked += Number(payload.blocked ?? 0);
  }
  return { accepted, blocked };
}

export async function syncGbrainResearchMemory(options: {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  includeEvidenceBackfill?: boolean;
} = {}): Promise<GbrainResearchMemorySyncResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? GBRAIN_SIDECAR_BASE_URL;
  const statusSnapshot = await fetchGbrainSidecarStatus({ fetchImpl, baseUrl });
  if (statusSnapshot.sidecarStatus !== "running") {
    return {
      status: "offline",
      backfilled: 0,
      delivered: 0,
      failed: 0,
      statusSnapshot,
      warning: statusSnapshot.lastError ?? undefined
    };
  }

  // Reaching the recognized GoTrader loopback service is the trust handshake.
  // No remote endpoint or browser credential can be configured here.
  setGbrainMemoryDeliveryEnabled(true, baseUrl);
  let backfilled = 0;
  let blocked = 0;
  try {
    if (options.includeEvidenceBackfill !== false) {
      const records = await listResearchEvidenceRecords();
      const documents = records.flatMap((record) => [
        buildGbrainMemoryDocument(buildResearchEvidenceMemoryPacket(record)),
        ...buildSupplementalEvidenceMemoryPackets(record).map(buildGbrainMemoryDocument)
      ]);
      const batchResult = await postDocuments(documents, { fetchImpl, baseUrl });
      backfilled = batchResult.accepted;
      blocked = batchResult.blocked;
    }
    const delivery = await deliverPendingGbrainMemory({
      endpoint: `${baseUrl}/v1/memory`,
      fetchImpl,
      maximumEntries: 100
    });
    const refreshedStatus = await fetchGbrainSidecarStatus({ fetchImpl, baseUrl });
    const deliveryFailed = "failed" in delivery ? delivery.failed : 0;
    const deliveryCount = "delivered" in delivery ? delivery.delivered : 0;
    return {
      status: blocked || deliveryFailed ? "complete_with_warnings" : "complete",
      backfilled,
      delivered: deliveryCount,
      failed: blocked + deliveryFailed,
      statusSnapshot: refreshedStatus,
      warning: blocked
        ? `${blocked} compact memory document(s) were blocked by the local safety validator.`
        : deliveryFailed
          ? `${deliveryFailed} queued memory document(s) could not be delivered.`
          : undefined
    };
  } catch (error) {
    return {
      status: "complete_with_warnings",
      backfilled,
      delivered: 0,
      failed: loadGbrainMemoryOutbox().entries.filter((entry) => entry.status !== "delivered").length,
      statusSnapshot: await fetchGbrainSidecarStatus({ fetchImpl, baseUrl }),
      warning: error instanceof Error ? error.message : "Local gbrain memory synchronization failed."
    };
  }
}

export async function searchGbrainResearchMemory(
  query: string,
  options: { fetchImpl?: typeof fetch; baseUrl?: string; limit?: number } = {}
): Promise<GbrainMemorySearchResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? GBRAIN_SIDECAR_BASE_URL;
  const safeQuery = String(query).trim().slice(0, 500);
  if (!safeQuery) {
    return {
      status: "complete",
      backend: "unavailable",
      query: "",
      results: [],
      authority: authorityNone,
      warning: "A compact research-memory query is required."
    };
  }
  try {
    const response = await fetchImpl(`${baseUrl}/v1/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: safeQuery, limit: Math.min(Math.max(options.limit ?? 8, 1), 20) }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as GbrainMemorySearchResponse;
    if (!authorityIsNone(payload.authority) || !Array.isArray(payload.results)) {
      return {
        status: "blocked_unsafe_response",
        backend: "unavailable",
        query: safeQuery,
        results: [],
        authority: authorityNone,
        warning: "The memory response failed GoTrader authority validation."
      };
    }
    return {
      ...payload,
      query: safeQuery,
      results: payload.results.slice(0, 20),
      authority: authorityNone
    };
  } catch (error) {
    return {
      status: "offline",
      backend: "unavailable",
      query: safeQuery,
      results: [],
      authority: authorityNone,
      warning: `Local gbrain search unavailable: ${error instanceof Error ? error.message : "request failed"}.`
    };
  }
}
