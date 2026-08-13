import type {
  AutonomousLoopIteration,
  AutonomousLoopProgressEvent,
  AutonomousPerformancePhaseTiming,
  AutonomousResearchRun,
  AutonomousResearchState
} from "@/lib/autonomousResearch/autonomousResearchTypes";
import { safeArray, safeTopN } from "@/lib/utils";

export const AUTONOMOUS_RESEARCH_STORAGE_KEY = "gotrader_ai_lab_autonomous_research_state";
export const AUTONOMOUS_RESEARCH_UPDATED_EVENT = "gotrader-ai-lab-autonomous-research-updated";

type CompactMode = "standard" | "aggressive" | "minimal";

let inMemoryState: AutonomousResearchState | undefined;

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";
const text = (value: string | undefined, maximum = 700) => {
  if (!value || value.length <= maximum) return value;
  return `${value.slice(0, maximum - 16)}... [trimmed]`;
};
const textList = (values: readonly string[] | undefined, limit: number, maximum = 500) =>
  safeTopN(safeArray(values), limit).map((value) => text(value, maximum) ?? "");

const initialState = (): AutonomousResearchState => ({
  runs: [],
  calibrationDriftHistory: [],
  safetyNotice: "Autonomous research is simulation-only. It cannot execute trades, approve Paper-Demo Candidate, send go-trader handoffs, or override readiness."
});

const progressForRun = (run: AutonomousResearchRun) => {
  const startedAt = run.startedAt ?? new Date().toISOString();
  const terminalStage =
    run.status === "failed" ? "failed" :
    run.status === "canceled" ? "canceled" :
    run.status === "paused" ? "paused" :
    run.status === "completed" || run.status === "completed_with_warnings" ? "completed" :
    "idle";
  return run.progress ?? {
    status: run.status,
    activeStage: run.status === "running" ? "resolving_runtime" : terminalStage,
    activeStageLabel: run.status === "running" ? "Resolving runtime" : run.status.replace(/_/g, " "),
    currentIteration: run.currentIteration ?? 0,
    maxIterations: run.settings?.maxIterations ?? 3,
    progressPercent: run.status === "completed" ? 100 : 0,
    startedAt,
    updatedAt: run.completedAt ?? startedAt,
    currentTask: run.status === "running" ? "Autonomous loop checkpoint recovered." : "Autonomous loop is idle.",
    stopReason: run.stopReason,
    stopReasonDetail: run.stopReasonDetail,
    events: []
  };
};

const compactProgressEvent = (event: AutonomousLoopProgressEvent): AutonomousLoopProgressEvent => ({
  eventId: event.eventId,
  timestamp: event.timestamp,
  stage: event.stage,
  title: text(event.title, 180) ?? "Autonomous update",
  detail: text(event.detail, 600) ?? ""
});

const compactTiming = (timing: AutonomousPerformancePhaseTiming): AutonomousPerformancePhaseTiming => ({
  phase: timing.phase,
  durationMs: timing.durationMs,
  startedAt: timing.startedAt,
  completedAt: timing.completedAt,
  detail: text(timing.detail, 400),
  skipped: timing.skipped
});

const compactIteration = (iteration: AutonomousLoopIteration, mode: CompactMode): AutonomousLoopIteration => ({
  iteration: iteration.iteration,
  startedAt: iteration.startedAt,
  completedAt: iteration.completedAt,
  cycleId: iteration.cycleId,
  blockerDiagnosis: safeTopN(safeArray(iteration.blockerDiagnosis), mode === "standard" ? 12 : 6),
  safetyDiagnosis: iteration.safetyDiagnosis
    ? {
        ...iteration.safetyDiagnosis,
        blockerCategories: safeTopN(safeArray(iteration.safetyDiagnosis.blockerCategories), 12),
        blockReasons: textList(iteration.safetyDiagnosis.blockReasons, 10),
        scenarioSelection: {
          ...iteration.safetyDiagnosis.scenarioSelection,
          blockers: safeTopN(safeArray(iteration.safetyDiagnosis.scenarioSelection.blockers), 12),
          evidenceUsed: textList(iteration.safetyDiagnosis.scenarioSelection.evidenceUsed, 8),
          rejectedScenarioFamilies: safeTopN(
            safeArray(iteration.safetyDiagnosis.scenarioSelection.rejectedScenarioFamilies),
            8
          ).map((item) => ({ ...item, reason: text(item.reason, 400) ?? "" })),
          reasoningSummary: text(iteration.safetyDiagnosis.scenarioSelection.reasoningSummary, 700) ?? ""
        }
      }
    : undefined,
  selectedScenarioFamily: iteration.selectedScenarioFamily,
  scenarioReason: text(iteration.scenarioReason, 600),
  autoResearchCycleId: iteration.autoResearchCycleId,
  bestCandidateLabel: text(iteration.bestCandidateLabel, 240),
  latestCandidateResult: text(iteration.latestCandidateResult, 300),
  proposalId: iteration.proposalId,
  llmAdvisoryUnavailable: iteration.llmAdvisoryUnavailable,
  llmAdvisoryUnavailableReason: text(iteration.llmAdvisoryUnavailableReason, 300),
  llmAdvisoryUnavailableDetail: text(iteration.llmAdvisoryUnavailableDetail, 500),
  walkForwardRunId: iteration.walkForwardRunId,
  walkForwardVerdict: iteration.walkForwardVerdict,
  autoApplyEligibility: iteration.autoApplyEligibility
    ? {
        ...iteration.autoApplyEligibility,
        reasons: textList(iteration.autoApplyEligibility.reasons, 8)
      }
    : undefined,
  sourceDiagnostics: iteration.sourceDiagnostics
    ? {
        ...iteration.sourceDiagnostics,
        eligibilityReasons: textList(iteration.sourceDiagnostics.eligibilityReasons, 8),
        fallbackReason: text(iteration.sourceDiagnostics.fallbackReason, 400),
        blocker: text(iteration.sourceDiagnostics.blocker, 500)
      }
    : undefined,
  autoAppliedCalibrationId: iteration.autoAppliedCalibrationId,
  readinessState: iteration.readinessState,
  maturityScore: iteration.maturityScore,
  status: iteration.status,
  notes: textList(iteration.notes, mode === "standard" ? 10 : 5, 700)
});

export const compactAutonomousResearchRun = (
  run: AutonomousResearchRun,
  mode: CompactMode = "standard"
): AutonomousResearchRun => {
  const progress = progressForRun(run);
  const eventLimit = mode === "standard" ? 16 : mode === "aggressive" ? 8 : 4;
  const iterationLimit = mode === "standard" ? 5 : mode === "aggressive" ? 2 : 1;
  const timingLimit = mode === "standard" ? 12 : mode === "aggressive" ? 6 : 3;
  return {
    runId: run.runId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    status: run.status,
    settings: {
      maxIterations: run.settings.maxIterations,
      noImprovementStop: run.settings.noImprovementStop,
      safeImportedDataMode: run.settings.safeImportedDataMode,
      advancedFullResearchMode: run.settings.advancedFullResearchMode,
      runLlmAdvisory: run.settings.runLlmAdvisory,
      autoApplyPolicyEnabled: run.settings.autoApplyPolicyEnabled === true,
      researchStrategyProfile: run.settings.researchStrategyProfile,
      maxResearchCandles: run.settings.maxResearchCandles
    },
    currentIteration: run.currentIteration,
    progress: {
      ...progress,
      activeStageLabel: text(progress.activeStageLabel, 180) ?? "Autonomous research",
      currentTask: text(progress.currentTask, 600) ?? "",
      stopReasonDetail: text(progress.stopReasonDetail, 700),
      events: safeTopN(safeArray(progress.events), eventLimit).map(compactProgressEvent)
    },
    iterations: safeTopN(safeArray(run.iterations), iterationLimit).map((iteration) => compactIteration(iteration, mode)),
    latestBlocker: run.latestBlocker,
    latestScenarioFamily: run.latestScenarioFamily,
    latestScenarioReason: text(run.latestScenarioReason, 600),
    latestCandidateResult: text(run.latestCandidateResult, 300),
    latestAutoApplyEligibility: run.latestAutoApplyEligibility
      ? {
          ...run.latestAutoApplyEligibility,
          reasons: textList(run.latestAutoApplyEligibility.reasons, 8)
        }
      : undefined,
    sourceDiagnostics: run.sourceDiagnostics
      ? {
          ...run.sourceDiagnostics,
          eligibilityReasons: textList(run.sourceDiagnostics.eligibilityReasons, 8),
          fallbackReason: text(run.sourceDiagnostics.fallbackReason, 400),
          blocker: text(run.sourceDiagnostics.blocker, 500)
        }
      : undefined,
    performanceDiagnostics: run.performanceDiagnostics
      ? {
          ...run.performanceDiagnostics,
          skippedHeavyDiagnostics: textList(run.performanceDiagnostics.skippedHeavyDiagnostics, 8),
          lastBlocker: text(run.performanceDiagnostics.lastBlocker, 500),
          phaseTimings: safeTopN(safeArray(run.performanceDiagnostics.phaseTimings), timingLimit).map(compactTiming)
        }
      : undefined,
    latestAutoAppliedCalibrationId: run.latestAutoAppliedCalibrationId,
    stopReason: run.stopReason,
    stopReasonDetail: text(run.stopReasonDetail, 800),
    readinessTrend: text(run.readinessTrend, 300) ?? "unknown",
    maturityTrend: text(run.maturityTrend, 500) ?? "unknown",
    goTraderHandoffGate: {
      eligibleForReview: run.goTraderHandoffGate.eligibleForReview,
      reasons: textList(run.goTraderHandoffGate.reasons, 8),
      brokerExecutionDisabled: true
    },
    calibrationDriftHistory: safeTopN(
      safeArray(run.calibrationDriftHistory),
      mode === "standard" ? 8 : mode === "aggressive" ? 3 : 1
    ),
    openClawHooks: {
      ...run.openClawHooks,
      packets: Object.fromEntries(
        Object.entries(run.openClawHooks.packets ?? {}).map(([key, packet]) => [
          key,
          packet
            ? {
                ...packet,
                blockers: textList(packet.blockers, 8)
              }
            : packet
        ])
      )
    },
    hermesNotifications: run.hermesNotifications.latestPayload
      ? {
          ...run.hermesNotifications,
          latestPayload: {
            ...run.hermesNotifications.latestPayload,
            title: text(run.hermesNotifications.latestPayload.title, 180) ?? "Autonomous research",
            summary: text(run.hermesNotifications.latestPayload.summary, 500) ?? ""
          }
        }
      : run.hermesNotifications,
    safetyNotice: "Autonomous research is simulation-only. It cannot execute trades, approve Paper-Demo Candidate, send go-trader handoffs, or override readiness."
  };
};

export const compactAutonomousResearchState = (
  state: AutonomousResearchState,
  mode: CompactMode = "standard"
): AutonomousResearchState => {
  const activeRunId = state.activeRun?.runId;
  const historyLimit = mode === "standard" ? 3 : mode === "aggressive" ? 1 : 0;
  return {
    latestRunId: state.latestRunId,
    runs: safeTopN(
      safeArray(state.runs).filter((run) => run.runId !== activeRunId),
      historyLimit
    ).map((run) => compactAutonomousResearchRun(run, mode)),
    activeRun: state.activeRun ? compactAutonomousResearchRun(state.activeRun, mode) : undefined,
    calibrationDriftHistory: safeTopN(
      safeArray(state.calibrationDriftHistory),
      mode === "standard" ? 10 : mode === "aggressive" ? 3 : 1
    ),
    safetyNotice: "Autonomous research is simulation-only. It cannot execute trades, approve Paper-Demo Candidate, send go-trader handoffs, or override readiness."
  };
};

export const estimateAutonomousResearchStateBytes = (state: AutonomousResearchState) =>
  new TextEncoder().encode(JSON.stringify(state)).byteLength;

const parseState = (raw: string | null) => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<AutonomousResearchState>;
    return compactAutonomousResearchState({
      ...initialState(),
      ...parsed,
      runs: safeArray(parsed.runs),
      calibrationDriftHistory: safeArray(parsed.calibrationDriftHistory)
    });
  } catch {
    return undefined;
  }
};

export function loadAutonomousResearchState(): AutonomousResearchState {
  if (!isBrowser()) return inMemoryState ?? initialState();
  const local = parseState(window.localStorage.getItem(AUTONOMOUS_RESEARCH_STORAGE_KEY));
  if (local) {
    inMemoryState = local;
    return local;
  }
  const session = typeof window.sessionStorage !== "undefined"
    ? parseState(window.sessionStorage.getItem(AUTONOMOUS_RESEARCH_STORAGE_KEY))
    : undefined;
  return session ?? inMemoryState ?? initialState();
}

const dispatchUpdate = (state: AutonomousResearchState) => {
  window.dispatchEvent(new CustomEvent(AUTONOMOUS_RESEARCH_UPDATED_EVENT, { detail: state }));
};

export function saveAutonomousResearchState(state: AutonomousResearchState): AutonomousResearchState {
  const compact = compactAutonomousResearchState(state);
  inMemoryState = compact;
  if (!isBrowser()) return compact;

  const attempts: Array<{ mode: CompactMode; state: AutonomousResearchState }> = [
    { mode: "standard", state: compact },
    { mode: "aggressive", state: compactAutonomousResearchState(state, "aggressive") },
    { mode: "minimal", state: compactAutonomousResearchState(state, "minimal") }
  ];
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      window.localStorage.setItem(AUTONOMOUS_RESEARCH_STORAGE_KEY, JSON.stringify(attempt.state));
      inMemoryState = attempt.state;
      dispatchUpdate(attempt.state);
      if (attempt.mode !== "standard") {
        console.warn(`Autonomous research history was pruned using ${attempt.mode} storage mode.`);
      }
      return attempt.state;
    } catch (error) {
      lastError = error;
    }
  }

  const minimal = attempts.at(-1)!.state;
  try {
    window.localStorage.removeItem(AUTONOMOUS_RESEARCH_STORAGE_KEY);
    window.localStorage.setItem(AUTONOMOUS_RESEARCH_STORAGE_KEY, JSON.stringify(minimal));
    inMemoryState = minimal;
    dispatchUpdate(minimal);
    console.warn("Autonomous research history was reset to the active compact checkpoint after browser storage reached its quota.");
    return minimal;
  } catch (error) {
    lastError = error;
  }

  try {
    window.sessionStorage?.setItem(AUTONOMOUS_RESEARCH_STORAGE_KEY, JSON.stringify(minimal));
  } catch {
    // The in-memory checkpoint below remains authoritative for this tab.
  }
  inMemoryState = minimal;
  dispatchUpdate(minimal);
  console.warn("Autonomous research persistence was kept in memory after browser storage reached its quota.", {
    error: lastError instanceof Error ? lastError.message : String(lastError)
  });
  return minimal;
}

export function saveAutonomousResearchRun(run: AutonomousResearchRun): AutonomousResearchState {
  const state = loadAutonomousResearchState();
  const isRunning = run.status === "running";
  return saveAutonomousResearchState({
    ...state,
    latestRunId: run.runId,
    activeRun: isRunning ? run : undefined,
    runs: isRunning
      ? safeArray(state.runs).filter((item) => item.runId !== run.runId)
      : safeTopN([run, ...state.runs.filter((item) => item.runId !== run.runId)], 3),
    calibrationDriftHistory: safeTopN([...run.calibrationDriftHistory, ...state.calibrationDriftHistory], 10)
  });
}

export function latestAutonomousResearchRun(state = loadAutonomousResearchState()) {
  return state.activeRun ?? state.runs.find((run) => run.runId === state.latestRunId) ?? state.runs[0];
}

export function discardAutonomousResearchCheckpoint(): AutonomousResearchState {
  const state = loadAutonomousResearchState();
  const activeRunId = state.activeRun?.runId;
  if (!activeRunId) return saveAutonomousResearchState({ ...state, activeRun: undefined });
  const now = new Date().toISOString();
  const canceled = compactAutonomousResearchRun({
    ...state.activeRun!,
    status: "canceled",
    completedAt: state.activeRun!.completedAt ?? now,
    stopReason: "user_canceled",
    stopReasonDetail: "Previous autonomous loop checkpoint was discarded from Mission Control.",
    progress: {
      ...state.activeRun!.progress,
      status: "canceled",
      activeStage: "canceled",
      activeStageLabel: "Canceled",
      updatedAt: now,
      currentTask: "Previous autonomous loop checkpoint discarded.",
      stopReason: "user_canceled",
      stopReasonDetail: "Previous autonomous loop checkpoint was discarded from Mission Control.",
      events: [
        {
          eventId: `autonomy_event_${Date.now()}`,
          timestamp: now,
          stage: "canceled",
          title: "Previous loop checkpoint discarded",
          detail: "Mission Control cleared an incomplete autonomous loop checkpoint."
        },
        ...safeArray(state.activeRun!.progress?.events)
      ]
    }
  });
  return saveAutonomousResearchState({
    ...state,
    activeRun: undefined,
    latestRunId: activeRunId,
    runs: [canceled, ...safeArray(state.runs).filter((run) => run.runId !== activeRunId)]
  });
}

export function clearAutonomousResearchHistory(): AutonomousResearchState {
  const cleared = initialState();
  if (isBrowser()) {
    window.sessionStorage?.removeItem(AUTONOMOUS_RESEARCH_STORAGE_KEY);
  }
  return saveAutonomousResearchState(cleared);
}
