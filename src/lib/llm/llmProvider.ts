import type {
  LLMAdvisoryRun,
  LLMProviderMode,
  LLMProviderStatus,
  LLMResearchState
} from "@/lib/llm/llmTypes";
import { safeArray, safeTopN } from "@/lib/utils";

export const LLM_RESEARCH_STORAGE_KEY = "gotrader_ai_lab_llm_research_state";
export const LLM_RESEARCH_UPDATED_EVENT = "gotrader-ai-lab-llm-research-updated";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const MAX_LLM_RESEARCH_RUNS = 20;
const MAX_LLM_RESEARCH_BYTES = 512 * 1024;
let inMemoryState: LLMResearchState | undefined;

const initialState = (): LLMResearchState => ({
  researchMode: "llm_required",
  providerMode: "local_command",
  runs: [],
  totalContextExports: 0,
  totalResponseImports: 0,
  unsafeResponseRejections: 0,
  deterministicFallbackEnabled: true,
  mockModeAllowed: true,
  safetyNotice: "LLM agents are required for real research mode, but advisory only."
});

const normalizeState = (state: Partial<LLMResearchState>): LLMResearchState => ({
  ...initialState(),
  ...state,
  researchMode: "llm_required",
  providerMode: state.providerMode ?? "local_command",
  runs: safeTopN(safeArray(state.runs), MAX_LLM_RESEARCH_RUNS),
  totalContextExports: state.totalContextExports ?? 0,
  totalResponseImports: state.totalResponseImports ?? 0,
  unsafeResponseRejections: state.unsafeResponseRejections ?? 0,
  deterministicFallbackEnabled: true,
  mockModeAllowed: true,
  safetyNotice: "LLM agents are required for real research mode, but advisory only."
});

const parseState = (raw: string | null) => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<LLMResearchState>;
    return normalizeState(parsed);
  } catch {
    return undefined;
  }
};

const serializedBytes = (value: string) => new TextEncoder().encode(value).byteLength;

const publish = (state: LLMResearchState) => {
  const normalized = normalizeState(state);
  inMemoryState = normalized;
  if (!isBrowser()) return normalized;

  let storedLocally = false;
  for (const maximumRuns of [20, 10, 5, 3, 1, 0]) {
    const candidate = normalizeState({ ...normalized, runs: normalized.runs.slice(0, maximumRuns) });
    const serialized = JSON.stringify(candidate);
    if (serializedBytes(serialized) > MAX_LLM_RESEARCH_BYTES) continue;
    try {
      window.localStorage.setItem(LLM_RESEARCH_STORAGE_KEY, serialized);
      storedLocally = true;
      break;
    } catch {
      // Retry with a smaller immutable history projection.
    }
  }

  if (!storedLocally) {
    try {
      window.sessionStorage?.setItem(LLM_RESEARCH_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // The active tab retains the advisory state in memory.
    }
    console.warn("LLM research persistence fell back after browser storage reached its quota.");
  }
  window.dispatchEvent(new CustomEvent(LLM_RESEARCH_UPDATED_EVENT, { detail: normalized }));
  return normalized;
};

export function loadLLMResearchState(): LLMResearchState {
  if (!isBrowser()) {
    return inMemoryState ?? initialState();
  }
  if (inMemoryState) return inMemoryState;
  const local = parseState(window.localStorage.getItem(LLM_RESEARCH_STORAGE_KEY));
  if (local) return local;
  const session = typeof window.sessionStorage !== "undefined"
    ? parseState(window.sessionStorage.getItem(LLM_RESEARCH_STORAGE_KEY))
    : undefined;
  return session ?? publish(initialState());
}

export function saveLLMResearchState(state: LLMResearchState): LLMResearchState {
  return publish(normalizeState(state));
}

export function saveLLMAdvisoryRun(run: LLMAdvisoryRun, providerMode?: LLMProviderMode): LLMResearchState {
  const state = loadLLMResearchState();
  return saveLLMResearchState({
    ...state,
    providerMode: providerMode ?? run.providerMode,
    latestRunId: run.runId,
    runs: safeTopN([run, ...safeArray(state.runs)], MAX_LLM_RESEARCH_RUNS),
    unsafeResponseRejections: (state.unsafeResponseRejections ?? 0) + (run.unsafeResponseRejections ?? 0)
  });
}

export function recordLLMContextExport(exportedAt = new Date().toISOString()): LLMResearchState {
  const state = loadLLMResearchState();
  return saveLLMResearchState({
    ...state,
    latestContextExportAt: exportedAt,
    totalContextExports: (state.totalContextExports ?? 0) + 1
  });
}

export function recordLLMResponseImport(run: LLMAdvisoryRun, importedAt = new Date().toISOString()): LLMResearchState {
  const saved = saveLLMAdvisoryRun(run, "local_command");
  return saveLLMResearchState({
    ...saved,
    latestResponseImportAt: importedAt,
    totalResponseImports: (saved.totalResponseImports ?? 0) + 1
  });
}

export function recordLLMUnsafeResponseRejection(count = 1): LLMResearchState {
  const state = loadLLMResearchState();
  return saveLLMResearchState({
    ...state,
    unsafeResponseRejections: (state.unsafeResponseRejections ?? 0) + count
  });
}

export function latestLLMAdvisoryRun(state = loadLLMResearchState()) {
  const runs = safeArray(state.runs);
  return runs.find((run) => run.runId === state.latestRunId) ?? runs[0];
}

export function isLLMAdvisoryReviewPassed(state = loadLLMResearchState()) {
  const latest = latestLLMAdvisoryRun(state);
  return Boolean(latest?.advisoryPassed && latest.realProvider && latest.status === "complete");
}

export function getLLMReadinessImpact(state = loadLLMResearchState()) {
  const latest = latestLLMAdvisoryRun(state);
  if (isLLMAdvisoryReviewPassed(state)) {
    return "LLM advisory review passed through a configured secure provider boundary.";
  }
  if (!latest) {
    return "LLM advisory review required before Paper-Demo Candidate.";
  }
  if (!latest.realProvider) {
    return "Latest LLM run was mock or fallback only; deterministic fallback may support Research Ready but cannot unlock Paper-Demo Candidate.";
  }
  return latest.readinessImpact;
}

export function providerStatusForMode(providerMode: LLMProviderMode): LLMProviderStatus {
  if (providerMode === "local_command") {
    return {
      providerMode,
      configured: false,
      statusMessage:
        "Local command mode must run through a secure local bridge. Configure GOTRADER_LLM_AGENT_COMMAND outside frontend code, for example node scripts/gpt55-llm-agent-provider.mjs.",
      secureBoundary: "local_command"
    };
  }
  if (providerMode === "mock_llm") {
    return {
      providerMode,
      configured: true,
      statusMessage: "Mock LLM is available for UI testing only and cannot satisfy real research readiness.",
      secureBoundary: "none"
    };
  }
  if (providerMode === "deterministic_fallback") {
    return {
      providerMode,
      configured: true,
      statusMessage: "Deterministic fallback is available for offline tests and baseline comparison only.",
      secureBoundary: "none"
    };
  }
  return {
    providerMode,
    configured: false,
    statusMessage: "Future API provider is planning-only until a secure backend, edge function, or provider service exists.",
    secureBoundary: "future_secure_service"
  };
}
