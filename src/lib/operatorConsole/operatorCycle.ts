import {
  runAutonomousResearchLoop,
  type AutonomousResearchRun
} from "@/lib/autonomousResearch";
import {
  readLatestResearchState
} from "@/lib/ict-strategy-suite/ictLatestResearchState";
import { runIctActivateMarketPipeline } from "@/lib/ict-strategy-suite/ictActivateMarketPipeline";
import { ensureMt5CanonicalResearchSource } from "@/lib/ict-strategy-suite/ictActivateMarketSourceActivation";
import { loadActiveMt5ReadOnlyCandleFeed } from "@/lib/integrations/mt5/mt5ReadOnlyClient";
import { publishClosedMt5ReadOnlyCandles } from "@/lib/mt5PushFeed/mt5ReadOnlyEventAdapter";
import { ifvgShallowRetestV4FrozenProfile } from "@/lib/forwardEvidence/frozenProfileRegistry";
import { recordForwardScenarioPrediction } from "@/lib/predictionLedger";
import { resolveResearchRuntimeSnapshot } from "@/lib/runtime";
import { runCanonicalOwnerResearchScheduler } from "@/lib/operatorResearch";
import { evaluateCanonicalOwnerValidationCycle } from "@/lib/ownerValidation";
import type { LabState } from "@/lib/types";

import {
  OPERATOR_AUTHORITY,
  type OperatorCycleStage,
  type OperatorCycleState,
  type OperatorInsightSummary
} from "./operatorConsoleTypes";
import { prepareOperatorForwardScenario } from "./operatorForwardScenario";
import { awaitOperatorAbort, createOperatorCycleGuard } from "./operatorCycleGuard";

const LEGACY_OPERATOR_CYCLE_STORAGE_KEYS = ["gotrader.operator-cycle.v2", "gotrader.operator-cycle.v1"];
const OPERATOR_CYCLE_TAB_STORAGE_KEY = "gotrader.operator-cycle.tab.v1";
export const OPERATOR_CYCLE_STORAGE_KEY = "gotrader.operator-cycle.v3";
export const OPERATOR_CYCLE_SESSION_STORAGE_KEY = "gotrader.operator-cycle.v3.session";
export const OPERATOR_CYCLE_UPDATED_EVENT = "gotrader:operator-cycle-updated";
// The cycle guard covers activation, market reading, research and finalization.
const OPERATOR_CYCLE_HEARTBEAT_MS = 2_000;
const OPERATOR_CYCLE_STALE_AFTER_MS = 90_000;
const OPERATOR_RESEARCH_PROFILE = ifvgShallowRetestV4FrozenProfile.profileId;
const OPERATOR_STOP_ABORT_REASON = "operator_stop_requested";
const OPERATOR_TIMEOUT_ABORT_REASON = "operator_timeout";
const OPERATOR_TIMEOUT_MESSAGE = "The research cycle exceeded its three-minute progress deadline or fifteen-minute total deadline and was stopped.";

const createOwnerInstanceId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `operator_owner_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const ownerInstanceId = (() => {
  if (typeof window === "undefined") return createOwnerInstanceId();
  const runtimeWindow = window as Window & { __gotraderOperatorCycleOwnerInstanceId?: string };
  runtimeWindow.__gotraderOperatorCycleOwnerInstanceId ??= createOwnerInstanceId();
  return runtimeWindow.__gotraderOperatorCycleOwnerInstanceId;
})();
const ownerTabId = (() => {
  if (typeof window === "undefined") return ownerInstanceId;
  try {
    const existing = window.sessionStorage.getItem(OPERATOR_CYCLE_TAB_STORAGE_KEY);
    if (existing) return existing;
    const created = createOwnerInstanceId();
    window.sessionStorage.setItem(OPERATOR_CYCLE_TAB_STORAGE_KEY, created);
    return created;
  } catch {
    return ownerInstanceId;
  }
})();

const initialState = (): OperatorCycleState => ({
  status: "idle",
  stage: "idle",
  progressPercent: 0,
  message: "Ready to start a supervised research cycle.",
  authority: OPERATOR_AUTHORITY,
  autoApplyAllowed: false,
  researchOnly: true
});

let memoryState = initialState();
let persistenceFailed = false;
let activeController: AbortController | undefined;
let heartbeatTimer: ReturnType<typeof globalThis.setInterval> | undefined;

const sanitize = (state: OperatorCycleState): OperatorCycleState => ({
  cycleId: state.cycleId,
  ownerTabId: state.ownerTabId,
  ownerInstanceId: state.ownerInstanceId,
  status: state.status,
  stage: state.stage,
  progressPercent: Math.max(0, Math.min(100, Math.round(state.progressPercent))),
  message: String(state.message ?? "").slice(0, 500),
  startedAt: state.startedAt,
  heartbeatAt: state.heartbeatAt,
  completedAt: state.completedAt,
  lastError: state.lastError ? String(state.lastError).slice(0, 500) : undefined,
  sourceFingerprint: state.sourceFingerprint,
  latestInsight: state.latestInsight
    ? {
        bias: String(state.latestInsight.bias).slice(0, 80),
        setup: String(state.latestInsight.setup).slice(0, 120),
        modelLane: String(state.latestInsight.modelLane).slice(0, 80),
        confidence: state.latestInsight.confidence,
        summary: String(state.latestInsight.summary).slice(0, 600),
        nextAction: String(state.latestInsight.nextAction).slice(0, 400)
      }
    : undefined,
  ownerResearch: state.ownerResearch,
  authority: OPERATOR_AUTHORITY,
  autoApplyAllowed: false,
  researchOnly: true
});

const heartbeatIsFresh = (state: OperatorCycleState, now = Date.now()) => {
  const heartbeatMs = Date.parse(state.heartbeatAt ?? state.startedAt ?? "");
  return Number.isFinite(heartbeatMs) && now - heartbeatMs <= OPERATOR_CYCLE_STALE_AFTER_MS;
};

const recoverInterruptedState = (state: OperatorCycleState): OperatorCycleState => {
  if (state.status !== "running" && state.status !== "stopping") {
    return state;
  }
  if (activeController && state.ownerInstanceId === ownerInstanceId) return state;
  if (state.ownerTabId && state.ownerTabId === ownerTabId && state.ownerInstanceId !== ownerInstanceId) {
    return sanitize({
      ...state,
      status: "canceled",
      stage: "complete",
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      message: "The browser document was replaced while the research cycle was running. The abandoned cycle was canceled safely.",
      lastError: "Same-tab document replacement recovered safely; no research gates or authority were changed."
    });
  }
  if (state.ownerInstanceId && state.ownerInstanceId !== ownerInstanceId && heartbeatIsFresh(state)) return state;
  return sanitize({
    ...state,
    status: "canceled",
    stage: "complete",
    progressPercent: 100,
    completedAt: new Date().toISOString(),
    message: "The research cycle owner stopped reporting for more than 90 seconds. The stale cycle was canceled safely.",
    lastError: "Stale cycle ownership recovered safely; no research gates or authority were changed."
  });
};

const stopHeartbeat = () => {
  if (heartbeatTimer !== undefined) {
    globalThis.clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
};

const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = globalThis.setInterval(() => {
    if (!activeController || (memoryState.status !== "running" && memoryState.status !== "stopping")) {
      stopHeartbeat();
      return;
    }
    saveOperatorCycleState({ ...memoryState, heartbeatAt: new Date().toISOString() }, { notify: false });
  }, OPERATOR_CYCLE_HEARTBEAT_MS);
};

export const readOperatorCycleState = (): OperatorCycleState => {
  if (typeof window === "undefined" || persistenceFailed) {
    return memoryState;
  }
  try {
    const sessionRaw = window.sessionStorage.getItem(OPERATOR_CYCLE_SESSION_STORAGE_KEY);
    const currentRaw = sessionRaw ?? window.localStorage.getItem(OPERATOR_CYCLE_STORAGE_KEY);
    const legacyRaw = currentRaw
      ? null
      : LEGACY_OPERATOR_CYCLE_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) ?? null;
    const raw = currentRaw ?? legacyRaw;
    if (!raw) return memoryState;
    const parsed = sanitize(JSON.parse(raw) as OperatorCycleState);
    const recovered = recoverInterruptedState(
      legacyRaw && (parsed.status === "running" || parsed.status === "stopping")
        ? { ...parsed, ownerTabId: undefined, ownerInstanceId: undefined, heartbeatAt: undefined }
        : parsed
    );
    memoryState = recovered;
    if (legacyRaw || recovered.status === "canceled") {
      try {
        window.sessionStorage.setItem(OPERATOR_CYCLE_SESSION_STORAGE_KEY, JSON.stringify(recovered));
        window.localStorage.setItem(OPERATOR_CYCLE_STORAGE_KEY, JSON.stringify(recovered));
      } catch {
        // The in-memory state remains authoritative for the active document.
      }
    }
    return recovered;
  } catch {
    return memoryState;
  }
};

export const saveOperatorCycleState = (
  state: OperatorCycleState,
  options: { notify?: boolean } = {}
): OperatorCycleState => {
  const compact = sanitize(state);
  memoryState = compact;
  if (typeof window !== "undefined") {
    const serialized = JSON.stringify(compact);
    if (/"candles"\s*:/i.test(serialized)) {
      throw new Error("Operator cycle state must not contain candle arrays.");
    }
    persistenceFailed = false;
    try {
      window.sessionStorage.setItem(OPERATOR_CYCLE_SESSION_STORAGE_KEY, serialized);
    } catch {
      persistenceFailed = true;
      // In-memory state remains available when browser storage is unavailable.
    }
    try {
      window.localStorage.setItem(OPERATOR_CYCLE_STORAGE_KEY, serialized);
    } catch {
      persistenceFailed = true;
      // A full origin must not turn a heartbeat into a failed research cycle.
    }
    if (options.notify !== false) {
      window.dispatchEvent(new CustomEvent(OPERATOR_CYCLE_UPDATED_EVENT, { detail: compact }));
    }
  }
  return compact;
};

const updateState = (
  current: OperatorCycleState,
  patch: Partial<OperatorCycleState>
): OperatorCycleState => saveOperatorCycleState({ ...current, ...patch });

const stageProgress: Record<OperatorCycleStage, number> = {
  idle: 0,
  activating_source: 10,
  building_market_read: 30,
  owner_research: 52,
  research_only: 70,
  running_research: 55,
  finalizing: 92,
  complete: 100
};

const insightFromPipeline = (result: Awaited<ReturnType<typeof runIctActivateMarketPipeline>>): OperatorInsightSummary => {
  const read = result.currentRead;
  const bias = String(read?.bias ?? read?.sessionDirectionalRead ?? read?.modelDirection ?? "neutral").replace(/_/g, " ");
  const setup = String(read?.modelName ?? read?.bestSetup ?? result.summary.modelName ?? "No qualified setup").replace(/_/g, " ");
  const modelLane = String(read?.modelQualityLane ?? result.summary.modelLane ?? "no trade").replace(/_/g, " ");
  const summary = read?.opportunitySummary || read?.recognitionOpportunitySummary || result.summary.recognitionOpportunitySummary ||
    (result.summary.modelDetected
      ? `${setup} was detected for research review.`
      : "No qualified setup is active. Research gates remain closed.");
  return {
    bias,
    setup,
    modelLane,
    confidence: read?.confidence ?? read?.modelConfidence,
    summary,
    nextAction: result.operatorWorkflow?.recommendedAction ?? read?.nextAction ?? result.summary.nextAction ?? "Wait for the next qualified market event."
  };
};

const statusMessageForRun = (run: AutonomousResearchRun, stoppedByOperator = false) => {
  if (run.status === "failed") return run.stopReasonDetail ?? "The autonomous research pass failed.";
  if (run.status === "paused") return run.stopReasonDetail ?? "The autonomous research pass paused for review.";
  if (run.status === "canceled") {
    return stoppedByOperator
      ? "Research cycle stopped by the operator."
      : run.stopReasonDetail ?? "The autonomous research pass canceled before completion.";
  }
  return run.stopReasonDetail ?? "Research cycle completed. Results and decisions are ready for review.";
};

export const stopOperatorResearchCycle = (): OperatorCycleState => {
  const current = readOperatorCycleState();
  if (current.status !== "running" && current.status !== "stopping") {
    return current;
  }
  if (current.ownerInstanceId !== ownerInstanceId || !activeController) {
    return current;
  }
  activeController.abort(OPERATOR_STOP_ABORT_REASON);
  return updateState(current, {
    status: "stopping",
    message: "Stopping after the current guarded research step completes."
  });
};

export async function runOperatorResearchCycle(labState: LabState): Promise<OperatorCycleState> {
  const existing = readOperatorCycleState();
  if (existing.status === "running" || existing.status === "stopping") {
    return existing;
  }

  const controller = new AbortController();
  activeController = controller;
  const startedAt = new Date().toISOString();
  const cycleId = `operator_cycle_${Date.now()}`;
  let current = saveOperatorCycleState({
    cycleId,
    ownerTabId,
    ownerInstanceId,
    status: "running",
    stage: "activating_source",
    progressPercent: stageProgress.activating_source,
    message: "Activating the canonical MT5 read-only research source.",
    startedAt,
    heartbeatAt: startedAt,
    authority: OPERATOR_AUTHORITY,
    autoApplyAllowed: false,
    researchOnly: true
  });
  startHeartbeat();
  const guard = createOperatorCycleGuard(controller);

  try {
    const activation = await awaitOperatorAbort(ensureMt5CanonicalResearchSource({ signal: controller.signal, deferHigherTimeframesToSharedPlanner: true }), controller.signal);
    controller.signal.throwIfAborted();
    guard.progress();
    if (!activation.ok || !activation.snapshot) {
      return updateState(current, {
        status: "blocked",
        stage: "complete",
        progressPercent: 100,
        completedAt: new Date().toISOString(),
        message: activation.message,
        lastError: activation.message,
        sourceFingerprint: activation.source.sourceFingerprint
      });
    }

    const activationSnapshot = activation.snapshot;
    const sourcePrepCompletedAt = new Date().toISOString();
    const activatedFeed = loadActiveMt5ReadOnlyCandleFeed();
    if (activatedFeed?.candles.length) {
      publishClosedMt5ReadOnlyCandles(activatedFeed);
    }
    const canonicalSourceFingerprint = activationSnapshot.marketData.activeResearchSource.fingerprint;

    if (controller.signal.aborted) {
      return updateState(current, {
        status: "canceled",
        stage: "complete",
        progressPercent: 100,
        completedAt: new Date().toISOString(),
        message: "Research cycle stopped before market analysis began."
      });
    }

    current = updateState(current, {
      stage: "building_market_read",
      progressPercent: stageProgress.building_market_read,
      message: "Building the multi-timeframe ICT market read.",
      sourceFingerprint: canonicalSourceFingerprint
    });

    let lastPipelineProgressBucket = -1;
    const pipeline = await awaitOperatorAbort(runIctActivateMarketPipeline(
      {
        snapshot: activation.snapshot,
        latestResearchState: readLatestResearchState(),
        saveLatestSummary: true,
        cycleId,
        signal: controller.signal,
        dataAsOf: startedAt
      },
      {
        onStepUpdate: (step, steps) => {
          if (controller.signal.aborted) return;
          const completed = steps.filter((item) => item.status === "completed" || item.status === "skipped" || item.status === "failed").length;
          const progress = stageProgress.building_market_read + Math.round((completed / Math.max(1, steps.length)) * 20);
          const progressBucket = Math.floor(completed / 3);
          if (progressBucket === lastPipelineProgressBucket && step.status !== "failed") return;
          lastPipelineProgressBucket = progressBucket;
          guard.progress();
          current = updateState(current, {
            progressPercent: Math.min(50, progress),
            message: step.message ?? step.label
          });
        }
      }
    ), controller.signal);
    controller.signal.throwIfAborted();
    const latestInsight = insightFromPipeline(pipeline);
    const planPublishedAt = new Date().toISOString();
    const activateMarketCompletedAt = planPublishedAt;
    const preparedScenario = prepareOperatorForwardScenario(
      pipeline.currentRead?.forwardScenarioMap,
      activation.source
    );
    if (preparedScenario.ok && preparedScenario.scenarioMap) {
      recordForwardScenarioPrediction(preparedScenario.scenarioMap, {
        modelVersion: "operator_market_scenario:v1",
        maxBarsToResolve: 48
      });
    }

    if (controller.signal.aborted) {
      return updateState(current, {
        status: "canceled",
        stage: "complete",
        progressPercent: 100,
        completedAt: new Date().toISOString(),
        message: "Research cycle stopped after the current market read.",
        latestInsight
      });
    }

    current = updateState(current, {
      stage: "owner_research",
      progressPercent: stageProgress.owner_research,
      message: "Current research plan published. Checking five owner-authentic historical research paths.",
      latestInsight
    });

    const ownerResearch = await awaitOperatorAbort(runCanonicalOwnerResearchScheduler({
      cycleId,
      cycleStartedAt: startedAt,
      planPublishedAt,
      canonicalFactBuildCount: 1,
      signal: controller.signal,
      execute: async () => {
        throw new Error("Certified historical execution requires an exact browser-bound dataset.");
      },
      onUpdate: (summary) => {
        if (controller.signal.aborted) return;
        if (readOperatorCycleState().cycleId !== summary.cycleId) return;
        guard.progress();
        const terminal = summary.tasks.filter((task) => !["QUEUED", "RUNNING"].includes(task.status)).length;
        current = updateState(current, {
          stage: "owner_research",
          progressPercent: stageProgress.owner_research + Math.round((terminal / 5) * 15),
          message: terminal < 5
            ? `Owner research ${terminal}/5 checked. Current live plan remains available.`
            : "Five owner research paths checked. Starting the separate IFVG v4 research-only lane.",
          ownerResearch: summary,
          latestInsight
        });
      }
    }), controller.signal);
    controller.signal.throwIfAborted();
    ownerResearch.performance.sourcePrepCompletedAt = sourcePrepCompletedAt;
    ownerResearch.performance.activateMarketCompletedAt = activateMarketCompletedAt;
    ownerResearch.performance.timeToActivateMarketMs = Math.max(0, Date.parse(activateMarketCompletedAt) - Date.parse(startedAt));
    ownerResearch.performance.stageDurationsMs.SOURCE_PREP = Math.max(0, Date.parse(sourcePrepCompletedAt) - Date.parse(startedAt));
    ownerResearch.performance.stageDurationsMs.ACTIVATE_MARKET = Math.max(0, Date.parse(activateMarketCompletedAt) - Date.parse(sourcePrepCompletedAt));

    const validationStartedAt = Date.now();
    ownerResearch.ownerValidation = evaluateCanonicalOwnerValidationCycle({ cycleId, tasks: ownerResearch.tasks });
    ownerResearch.performance.validationCompleteAt = ownerResearch.ownerValidation.evaluatedAt;
    ownerResearch.performance.validationDurationMs = Math.max(0, Date.parse(ownerResearch.ownerValidation.evaluatedAt) - validationStartedAt);
    ownerResearch.performance.stageDurationsMs.VALIDATION = ownerResearch.performance.validationDurationMs;
    const researchOnlyTask = ownerResearch.researchOnlyTasks.find((task) => task.ownerStrategyId === OPERATOR_RESEARCH_PROFILE);
    if (researchOnlyTask) {
      const at = new Date().toISOString();
      researchOnlyTask.status = "RUNNING";
      researchOnlyTask.startedAt = at;
      researchOnlyTask.lastProgressAt = at;
      researchOnlyTask.progress.lastProgressAt = at;
    }
    current = updateState(current, {
      stage: "research_only",
      progressPercent: stageProgress.research_only,
      message: "Running one bounded IFVG v4 research-only pass. The live plan remains available.",
      ownerResearch,
      latestInsight
    });

    let lastAutonomousProgress = -1;
    let lastAutonomousStage = "";
    const autonomousPromise = runAutonomousResearchLoop({
      state: labState,
      signal: controller.signal,
      settings: {
        maxIterations: 1,
        noImprovementStop: 1,
        safeImportedDataMode: true,
        advancedFullResearchMode: false,
        runLlmAdvisory: false,
        autoApplyPolicyEnabled: false,
        researchStrategyProfile: OPERATOR_RESEARCH_PROFILE,
        maxResearchCandles: 1000
      },
      onUpdate: (run) => {
        if (controller.signal.aborted) return;
        const progress = Math.max(0, Math.min(100, run.progress.progressPercent));
        const stage = run.progress.activeStage;
        if (stage === lastAutonomousStage && Math.abs(progress - lastAutonomousProgress) < 5) return;
        lastAutonomousStage = stage;
        lastAutonomousProgress = progress;
        guard.progress();
        current = updateState(current, {
          progressPercent: stageProgress.research_only + Math.round(progress * 0.2),
          message: run.progress.currentTask
        });
      }
    });
    const autonomousRun = await awaitOperatorAbort(autonomousPromise, controller.signal);
    controller.signal.throwIfAborted();

    if (researchOnlyTask) {
      const completedAt = new Date().toISOString();
      const completedIterations = autonomousRun.iterations.filter((iteration) => iteration.status === "completed" || iteration.status === "warning");
      const candidateCount = autonomousRun.iterations.filter((iteration) => Boolean(iteration.bestCandidateLabel)).length;
      researchOnlyTask.status = autonomousRun.status === "completed"
        ? candidateCount > 0 ? "PASSED" : "PASSED_WITH_ZERO_CANDIDATES"
        : autonomousRun.status === "canceled" ? "CANCELLED"
          : autonomousRun.status === "paused" ? "BLOCKED"
            : "FAILED";
      researchOnlyTask.completedAt = completedAt;
      researchOnlyTask.lastProgressAt = completedAt;
      researchOnlyTask.progress = {
        evaluationsCompleted: completedIterations.length,
        candidateCount,
        fillCount: 0,
        outcomeCount: 0,
        blockedCount: autonomousRun.status === "completed" ? 0 : 1,
        lastProgressAt: completedAt
      };
      researchOnlyTask.runDurationMs = researchOnlyTask.startedAt
        ? Math.max(0, Date.parse(completedAt) - Date.parse(researchOnlyTask.startedAt))
        : undefined;
      researchOnlyTask.blocker = autonomousRun.status === "completed" ? undefined : statusMessageForRun(autonomousRun);
      if (researchOnlyTask.runDurationMs !== undefined) ownerResearch.performance.stageDurationsMs.IFVG_V4_RESEARCH_ONLY = researchOnlyTask.runDurationMs;
    }
    current = updateState(current, {
      stage: "finalizing",
      progressPercent: stageProgress.finalizing,
      message: "Refreshing the compact operator results."
    });
    await awaitOperatorAbort(resolveResearchRuntimeSnapshot({ labState }), controller.signal);
    controller.signal.throwIfAborted();

    const stoppedByOperator = controller.signal.reason === OPERATOR_STOP_ABORT_REASON;
    const timedOut = controller.signal.reason === OPERATOR_TIMEOUT_ABORT_REASON;
    const canceled = stoppedByOperator || (!timedOut && autonomousRun.status === "canceled");
    const failed = timedOut || autonomousRun.status === "failed";
    const paused = autonomousRun.status === "paused";
    const completionMessage = timedOut ? OPERATOR_TIMEOUT_MESSAGE : statusMessageForRun(autonomousRun, stoppedByOperator);
    const completedWithOwnerBlockers = ownerResearch.globalStatus === "COMPLETE_WITH_BLOCKERS" && !canceled && !failed && !paused;
    ownerResearch.performance.cycleCompletedAt = new Date().toISOString();
    ownerResearch.performance.cycleTotalMs = Math.max(0, Date.parse(ownerResearch.performance.cycleCompletedAt) - Date.parse(startedAt));
    ownerResearch.performance.stageDurationsMs.CYCLE_TOTAL = ownerResearch.performance.cycleTotalMs;
    return updateState(current, {
      status: canceled ? "canceled" : failed ? "failed" : paused ? "blocked" : completedWithOwnerBlockers ? "completed_with_blockers" : "completed",
      stage: "complete",
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      message: completedWithOwnerBlockers
        ? "Live plan completed; owner research finished with documented blockers."
        : completionMessage,
      lastError: failed || paused ? completionMessage : undefined,
      latestInsight,
      ownerResearch
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research cycle failed unexpectedly.";
    const stoppedByOperator = controller.signal.reason === OPERATOR_STOP_ABORT_REASON;
    const timedOut = controller.signal.reason === OPERATOR_TIMEOUT_ABORT_REASON;
    const failureMessage = timedOut ? OPERATOR_TIMEOUT_MESSAGE : message;
    return updateState(current, {
      status: stoppedByOperator ? "canceled" : "failed",
      stage: "complete",
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      message: stoppedByOperator ? "Research cycle stopped by the operator." : failureMessage,
      lastError: stoppedByOperator ? undefined : failureMessage
    });
  } finally {
    guard.dispose();
    stopHeartbeat();
    if (activeController === controller) {
      activeController = undefined;
    }
  }
}
