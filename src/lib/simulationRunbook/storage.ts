import type {
  AppendSimulationRunbookEvidenceInput,
  SimulationRunbookChecklistDefinition,
  SimulationRunbookChecklistId,
  SimulationRunbookEvidenceReceipt,
  SimulationRunbookState
} from "@/lib/simulationRunbook/simulationRunbookTypes";

export const SIMULATION_RUNBOOK_STORAGE_KEY = "gotrader_ai_lab_simulation_runbook";
export const SIMULATION_RUNBOOK_UPDATED_EVENT = "gotrader-ai-lab-simulation-runbook-updated";
const endpoint = String(import.meta.env.VITE_GOTRADER_AGENT_INTERFACE_URL ?? "http://127.0.0.1:8799").replace(/\/$/, "");

export const simulationRunbookChecklist: SimulationRunbookChecklistDefinition[] = [
  { id: "aiLabThesisGenerated", label: "AI Lab thesis generated" },
  { id: "handoffExported", label: "Handoff exported" },
  { id: "savedLatestHandoff", label: "Saved as exports/latest-gotrader-handoff.json" },
  { id: "readerConversionTested", label: "Reader conversion tested" },
  { id: "schedulerOneCycleCompleted", label: "Scheduler one-cycle run completed" },
  { id: "signalLogged", label: "Signal logged" },
  { id: "brokerExecutionSkipped", label: "Broker execution skipped" },
  { id: "positionsZero", label: "Positions = 0" },
  { id: "tradesZero", label: "Trades = 0" },
  { id: "shutdownComplete", label: "Shutdown complete" }
];

const emptyChecklist = (): Record<SimulationRunbookChecklistId, boolean> =>
  Object.fromEntries(simulationRunbookChecklist.map((item) => [item.id, false])) as Record<SimulationRunbookChecklistId, boolean>;

export const defaultSimulationRunbookState: SimulationRunbookState = {
  storageStatus: "unavailable",
  symbol: "",
  timeframe: "",
  signal: "",
  mode: "simulation",
  platform: "durable_research_memory_sidecar",
  notes: "",
  checklist: emptyChecklist(),
  evidence: [],
  evidenceChainValid: false,
  legacyMigrationArchived: false,
  blocker: "runbook_evidence_not_loaded"
};

let cachedState = defaultSimulationRunbookState;
let legacyMigrationAttempted = false;

const emit = (state: SimulationRunbookState) => {
  cachedState = state;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SIMULATION_RUNBOOK_UPDATED_EVENT, { detail: state }));
  }
  return state;
};

const failClosed = (cycleId: string | undefined, blocker: string) => emit({
  ...defaultSimulationRunbookState,
  currentCycleId: cycleId,
  latestResearchCycleId: cycleId,
  blocker
});

const normalizeProjection = (payload: Record<string, unknown>, cycleId: string): SimulationRunbookState => {
  const evidence = Array.isArray(payload.evidence) ? payload.evidence as SimulationRunbookEvidenceReceipt[] : [];
  const checklist = { ...emptyChecklist() };
  for (const receipt of evidence) {
    if (receipt.cycleId === cycleId && receipt.checkId in checklist) checklist[receipt.checkId] = true;
  }
  const completed = Object.values(checklist).filter(Boolean).length;
  return {
    ...defaultSimulationRunbookState,
    storageStatus: payload.status === "current_cycle" ? "current_cycle" : "unavailable",
    currentCycleId: cycleId,
    latestResearchCycleId: cycleId,
    latestResearchPipelineAt: evidence.at(-1)?.observedAt,
    latestResearchPipelineStatus: evidence.length ? "completed" : undefined,
    verifiedAt: completed === simulationRunbookChecklist.length ? String(payload.verifiedAt ?? evidence.at(-1)?.recordedAt) : undefined,
    checklist,
    evidence,
    evidenceChainValid: payload.evidenceChainValid === true,
    evidenceChainHead: typeof payload.evidenceChainHead === "string" ? payload.evidenceChainHead : undefined,
    legacyMigrationArchived: payload.legacyMigrationArchived === true,
    blocker: evidence.length ? undefined : "no_current_cycle_runbook_evidence"
  };
};

const requestJson = async (route: string, init?: RequestInit) => {
  const response = await fetch(`${endpoint}${route}`, { cache: "no-store", ...init });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error ?? payload.blocker ?? `runbook_http_${response.status}`));
  return payload;
};

const archiveLegacyBrowserState = async () => {
  if (legacyMigrationAttempted || typeof window === "undefined") return;
  legacyMigrationAttempted = true;
  const raw = window.localStorage.getItem(SIMULATION_RUNBOOK_STORAGE_KEY);
  if (!raw) return;
  try {
    await requestJson("/v1/runbook/legacy-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawState: JSON.parse(raw), migratedAt: new Date().toISOString() })
    });
    window.localStorage.removeItem(SIMULATION_RUNBOOK_STORAGE_KEY);
  } catch {
    // Keep the legacy value until an archive receipt is durably acknowledged.
  }
};

export function loadSimulationRunbookState(): SimulationRunbookState {
  return cachedState;
}

export async function hydrateSimulationRunbookState(cycleId?: string): Promise<SimulationRunbookState> {
  if (!cycleId) return failClosed(undefined, "current_cycle_id_required");
  emit({ ...defaultSimulationRunbookState, storageStatus: "loading", currentCycleId: cycleId, latestResearchCycleId: cycleId });
  await archiveLegacyBrowserState();
  try {
    const payload = await requestJson(`/v1/runbook/cycles/${encodeURIComponent(cycleId)}`);
    return emit(normalizeProjection(payload, cycleId));
  } catch (error) {
    return failClosed(cycleId, error instanceof Error ? error.message : "runbook_sidecar_unavailable");
  }
}

export async function appendSimulationRunbookEvidence(input: AppendSimulationRunbookEvidenceInput): Promise<SimulationRunbookState> {
  try {
    const payload = await requestJson("/v1/runbook/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const state = payload.state as Record<string, unknown> | undefined;
    if (!state) return failClosed(input.cycleId, "runbook_sidecar_response_invalid");
    return emit(normalizeProjection(state, input.cycleId));
  } catch (error) {
    return failClosed(input.cycleId, error instanceof Error ? error.message : "runbook_evidence_append_failed");
  }
}

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]));
};

export async function digestSimulationRunbookSource(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(stable(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function countCompletedRunbookItems(state: SimulationRunbookState) {
  if (!state.evidenceChainValid || state.storageStatus !== "current_cycle") return 0;
  return simulationRunbookChecklist.filter((item) => state.checklist[item.id]).length;
}
