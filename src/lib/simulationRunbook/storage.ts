import type {
  SimulationRunbookCheckEvidence,
  SimulationRunbookChecklistDefinition,
  SimulationRunbookChecklistId,
  SimulationRunbookState
} from "@/lib/simulationRunbook/simulationRunbookTypes";

export const SIMULATION_RUNBOOK_STORAGE_KEY = "gotrader_ai_lab_simulation_runbook";
export const SIMULATION_RUNBOOK_UPDATED_EVENT = "gotrader-ai-lab-simulation-runbook-updated";

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
  simulationRunbookChecklist.reduce(
    (items, item) => ({
      ...items,
      [item.id]: false
    }),
    {} as Record<SimulationRunbookChecklistId, boolean>
  );

export const defaultSimulationRunbookState: SimulationRunbookState = {
  schemaVersion: 2,
  symbol: "",
  timeframe: "5m",
  signal: "",
  mode: "simulation",
  platform: "ai_lab_handoff",
  notes: "",
  checklist: emptyChecklist(),
  evidence: {},
  canonicalStatus: "unavailable",
  canonicalBlockers: ["simulation_runbook_evidence_not_loaded"]
};

const isSha256Id = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);

const validEvidenceFor = (
  evidence: SimulationRunbookCheckEvidence | undefined,
  checkId: SimulationRunbookChecklistId,
  cycleId: string | undefined
) => Boolean(
  evidence &&
    cycleId &&
    evidence.checkId === checkId &&
    evidence.cycleId === cycleId &&
    isSha256Id(evidence.evidenceId) &&
    isSha256Id(evidence.sourceEvidenceId) &&
    Boolean(evidence.recordedAt) &&
    Boolean(evidence.observedAt) &&
    Boolean(evidence.profileId) &&
    Boolean(evidence.profileVersion) &&
    Boolean(evidence.parameterFingerprint) &&
    Boolean(evidence.sourceFingerprint) &&
    Boolean(evidence.validationIdentity)
);

const deriveChecklist = (
  evidence: Partial<Record<SimulationRunbookChecklistId, SimulationRunbookCheckEvidence>>,
  cycleId: string | undefined,
  canonicalStatus: SimulationRunbookState["canonicalStatus"]
) => simulationRunbookChecklist.reduce((items, item) => ({
  ...items,
  [item.id]: canonicalStatus === "available" && validEvidenceFor(evidence[item.id], item.id, cycleId)
}), emptyChecklist());

const sanitizeRunbookState = (state: Partial<SimulationRunbookState>): SimulationRunbookState => {
  const evidence = state.schemaVersion === 2 && state.evidence ? state.evidence : {};
  const canonicalStatus = state.schemaVersion === 2
    ? state.canonicalStatus ?? "unavailable"
    : "blocked";
  const checklist = deriveChecklist(evidence, state.latestResearchCycleId, canonicalStatus);
  const completed = simulationRunbookChecklist.filter((item) => checklist[item.id]).length;
  return {
    ...defaultSimulationRunbookState,
    ...state,
    schemaVersion: 2,
    mode: "simulation",
    latestResearchPipelineStatus:
      state.latestResearchPipelineStatus === "completed" ||
      state.latestResearchPipelineStatus === "completed_with_warnings" ||
      state.latestResearchPipelineStatus === "failed"
        ? state.latestResearchPipelineStatus
        : undefined,
    platform: state.platform?.trim() || defaultSimulationRunbookState.platform,
    evidence,
    canonicalStatus,
    canonicalBlockers: state.schemaVersion === 2
      ? state.canonicalBlockers ?? []
      : ["legacy_boolean_runbook_state_is_non_authoritative"],
    checklist,
    verifiedAt: canonicalStatus === "available" && completed === simulationRunbookChecklist.length
      ? state.verifiedAt
      : undefined
  };
};

export function loadSimulationRunbookState(): SimulationRunbookState {
  if (typeof window === "undefined") {
    return defaultSimulationRunbookState;
  }
  const raw = window.localStorage.getItem(SIMULATION_RUNBOOK_STORAGE_KEY);
  if (!raw) {
    return defaultSimulationRunbookState;
  }
  try {
    return sanitizeRunbookState(JSON.parse(raw) as Partial<SimulationRunbookState>);
  } catch {
    return defaultSimulationRunbookState;
  }
}

export function saveSimulationRunbookState(state: SimulationRunbookState) {
  if (typeof window === "undefined") {
    return;
  }
  const next = sanitizeRunbookState(state);
  window.localStorage.setItem(SIMULATION_RUNBOOK_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(SIMULATION_RUNBOOK_UPDATED_EVENT, { detail: next }));
}

export function completeSimulationRunbookVerification(state: SimulationRunbookState) {
  const sanitized = sanitizeRunbookState(state);
  if (countCompletedRunbookItems(sanitized) !== simulationRunbookChecklist.length) {
    return sanitized;
  }
  const next = sanitizeRunbookState({
    ...sanitized,
    verifiedAt: new Date().toISOString()
  });
  saveSimulationRunbookState(next);
  return next;
}

export function resetSimulationRunbookState() {
  saveSimulationRunbookState(defaultSimulationRunbookState);
  return defaultSimulationRunbookState;
}

export function countCompletedRunbookItems(state: SimulationRunbookState) {
  const sanitized = sanitizeRunbookState(state);
  return simulationRunbookChecklist.filter((item) => sanitized.checklist[item.id]).length;
}

export function projectCanonicalSimulationRunbook(
  current: SimulationRunbookState,
  canonical: {
    status: "available" | "blocked" | "unavailable";
    cycleId?: string | null;
    evidenceId?: string | null;
    blockers?: string[];
    verifiedAt?: string | null;
    records?: SimulationRunbookCheckEvidence[];
  }
) {
  const evidence = Object.fromEntries(
    (canonical.records ?? []).map((record) => [record.checkId, record])
  ) as Partial<Record<SimulationRunbookChecklistId, SimulationRunbookCheckEvidence>>;
  return sanitizeRunbookState({
    ...current,
    latestResearchCycleId: canonical.cycleId ?? current.latestResearchCycleId,
    evidence,
    canonicalStatus: canonical.status,
    canonicalEvidenceId: canonical.evidenceId ?? undefined,
    canonicalBlockers: canonical.blockers ?? [],
    verifiedAt: canonical.verifiedAt ?? undefined,
    refreshedAt: new Date().toISOString()
  });
}
