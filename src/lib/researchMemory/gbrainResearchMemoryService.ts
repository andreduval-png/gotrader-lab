import { GBRAIN_SIDECAR_BASE_URL } from "@/lib/researchMemory/gbrainSidecarClient";
import {
  gbrainResearchMemoryAuthorityNone,
  type GetResearchMemorySummaryInput,
  type GetResearchMemorySummaryOutput,
  type ResearchMemoryStatusInput,
  type ResearchMemoryStatusOutput,
  type SearchResearchMemoryInput,
  type SearchResearchMemoryOutput
} from "@/lib/researchMemory/gbrainResearchMemoryTypes";

const offlineEnvelope = {
  advisoryOnly: true as const,
  nativeEvidenceAuthoritative: true as const,
  productionAdoptionAllowed: false as const,
  authority: gbrainResearchMemoryAuthorityNone
};
const sidecarResponseIsSafe = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  const authority = payload.authority as Record<string, unknown> | undefined;
  return (
    payload.advisoryOnly === true &&
    payload.nativeEvidenceAuthoritative === true &&
    payload.canCreateEvidence === false &&
    payload.canApproveReadiness === false &&
    payload.canApplyCalibration === false &&
    payload.canCreateTradeIntent === false &&
    payload.productionAdoptionAllowed === false &&
    authority?.executionAuthority === "none" &&
    authority.brokerAuthority === "none" &&
    authority.readinessOverrideAuthority === "none"
  );
};

const sidecarBaseUrl = (candidate?: string) => {
  const parsed = new URL(candidate ?? GBRAIN_SIDECAR_BASE_URL);
  if (
    parsed.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
  ) {
    throw new Error("Research-memory retrieval must use the local GoTrader sidecar.");
  }
  return parsed.origin;
};

const requestJson = async <T>(
  route: string,
  options: RequestInit,
  serviceOptions: { fetchImpl?: typeof fetch; baseUrl?: string; timeoutMs?: number } = {}
) => {
  const fetchImpl = serviceOptions.fetchImpl ?? fetch;
  const response = await fetchImpl(`${sidecarBaseUrl(serviceOptions.baseUrl)}${route}`, {
    ...options,
    cache: "no-store",
    signal: AbortSignal.timeout(serviceOptions.timeoutMs ?? 8_000)
  });
  return { response, payload: (await response.json()) as T };
};

export async function getGbrainResearchMemoryStatus(
  input: ResearchMemoryStatusInput = {},
  options: { fetchImpl?: typeof fetch; baseUrl?: string; timeoutMs?: number } = {}
): Promise<ResearchMemoryStatusOutput> {
  try {
    const { response, payload } = await requestJson<{
      status?: string;
      sidecarStatus?: string;
      gbrainBackend?: string;
      storageBackend?: string;
      indexedDocumentCount?: number;
      pendingDocumentCount?: number;
      failedDocumentCount?: number;
      lastIndexedAt?: string;
      lastStoredAt?: string;
      lastReceiptId?: string;
      lastError?: string;
    }>("/v1/status", {}, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!sidecarResponseIsSafe(payload)) throw new Error("Unsafe memory status response.");
    return {
      status: payload.status === "ready" ? "healthy" : "degraded",
      sidecarReachable: payload.sidecarStatus === "running",
      gbrainReachable: payload.gbrainBackend === "pglite",
      fallbackSearchAvailable: payload.storageBackend === "atomic_markdown_spool",
      indexedMemoryCount: input.includeCounts === false ? undefined : payload.indexedDocumentCount,
      pendingMemoryCount: input.includeCounts === false ? undefined : payload.pendingDocumentCount,
      failedMemoryCount: input.includeCounts === false ? undefined : payload.failedDocumentCount,
      lastSuccessfulSyncUtc: payload.lastIndexedAt ?? payload.lastStoredAt,
      lastReceiptId: payload.lastReceiptId,
      blockers: [],
      warnings: payload.lastError ? [payload.lastError] : [],
      provenance: {
        source: "local_gbrain_sidecar",
        retrievalMode: "status",
        advisoryOnly: true,
        nativeEvidenceAuthoritative: true,
        untrustedRetrievedContent: true
      },
      ...offlineEnvelope
    };
  } catch (error) {
    return {
      status: "offline",
      sidecarReachable: false,
      gbrainReachable: false,
      fallbackSearchAvailable: false,
      blockers: ["gbrain_sidecar_offline"],
      warnings: [error instanceof Error ? error.message : "Research memory is unavailable."],
      provenance: {
        source: "local_gbrain_sidecar",
        retrievalMode: "status",
        advisoryOnly: true,
        nativeEvidenceAuthoritative: true,
        untrustedRetrievedContent: true
      },
      ...offlineEnvelope
    };
  }
}

export async function searchGbrainResearchMemorySummaries(
  input: SearchResearchMemoryInput,
  options: { fetchImpl?: typeof fetch; baseUrl?: string; timeoutMs?: number } = {}
): Promise<SearchResearchMemoryOutput> {
  try {
    const { response, payload } = await requestJson<
      SearchResearchMemoryOutput & { retrievalMode?: "keyword" | "bounded_fallback" }
    >(
      "/v1/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, limit: Math.min(Math.max(input.limit ?? 5, 1), 20) })
      },
      options
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!sidecarResponseIsSafe(payload)) throw new Error("Unsafe memory search response.");
    const retrievalMode = payload.retrievalMode === "keyword" ? "keyword" : "bounded_fallback";
    return {
      ...payload,
      results: (payload.results ?? []).slice(0, 20),
      resultCount: Math.min(payload.resultCount ?? payload.results?.length ?? 0, 20),
      responseTruncated: payload.responseTruncated === true,
      blockers: payload.blockers ?? [],
      warnings: payload.warnings ?? [],
      provenance: {
        source: "local_gbrain_sidecar",
        retrievalMode,
        advisoryOnly: true,
        nativeEvidenceAuthoritative: true,
        untrustedRetrievedContent: true
      },
      ...offlineEnvelope
    };
  } catch (error) {
    return {
      status: "offline",
      results: [],
      resultCount: 0,
      responseTruncated: false,
      blockers: ["gbrain_sidecar_offline"],
      warnings: [error instanceof Error ? error.message : "Research memory is unavailable."],
      provenance: {
        source: "local_gbrain_sidecar",
        retrievalMode: "bounded_fallback",
        advisoryOnly: true,
        nativeEvidenceAuthoritative: true,
        untrustedRetrievedContent: true
      },
      ...offlineEnvelope
    };
  }
}

export async function getGbrainResearchMemorySummary(
  input: GetResearchMemorySummaryInput,
  options: { fetchImpl?: typeof fetch; baseUrl?: string; timeoutMs?: number } = {}
): Promise<GetResearchMemorySummaryOutput> {
  try {
    const { response, payload } = await requestJson<GetResearchMemorySummaryOutput>(
      `/v1/memory/${encodeURIComponent(input.memoryId)}`,
      {},
      options
    );
    if (response.status === 404) {
      return {
        status: "not_found",
        blockers: [],
        warnings: [],
        provenance: {
          source: "local_gbrain_sidecar",
          retrievalMode: "direct_lookup",
          advisoryOnly: true,
          nativeEvidenceAuthoritative: true,
          untrustedRetrievedContent: true
        },
        ...offlineEnvelope
      };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!sidecarResponseIsSafe(payload)) throw new Error("Unsafe memory summary response.");
    return {
      ...payload,
      blockers: payload.blockers ?? [],
      warnings: payload.warnings ?? [],
      provenance: {
        source: "local_gbrain_sidecar",
        retrievalMode: "direct_lookup",
        advisoryOnly: true,
        nativeEvidenceAuthoritative: true,
        untrustedRetrievedContent: true
      },
      ...offlineEnvelope
    };
  } catch (error) {
    return {
      status: "offline",
      blockers: ["gbrain_sidecar_offline"],
      warnings: [error instanceof Error ? error.message : "Research memory is unavailable."],
      provenance: {
        source: "local_gbrain_sidecar",
        retrievalMode: "direct_lookup",
        advisoryOnly: true,
        nativeEvidenceAuthoritative: true,
        untrustedRetrievedContent: true
      },
      ...offlineEnvelope
    };
  }
}
