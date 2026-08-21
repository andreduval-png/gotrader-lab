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
import type { LabState } from "@/lib/types";

import {
  OPERATOR_AUTHORITY,
  type OperatorCycleStage,
  type OperatorCycleState,
  type OperatorInsightSummary
} from "./operatorConsoleTypes";
import { prepareOperatorForwardScenario } from "./operatorForwardScenario";

const LEGACY_OPERATOR_CYCLE_STORAGE_KEYS = ["gotrader.operator-cycle.v2", "gotrader.operator-cycle.v1"];
const OPERATOR_CYCLE_TAB_STORAGE_KEY = "gotrader.operator-cycle.tab.v1";
export const OPERATOR_CYCLE_STORAGE_KEY = "gotrader.operator-cycle.v3";
export const OPERATOR_CYCLE_UPDATED_EVENT = "gotrader:operator-cycle-updated";
// Tactical operator cycles have both a liveness watchdog and an absolute wall-clock budget.
// Deep-history research stays in Advanced Research Lab.
const OPERATOR_RESEARCH_STALL_TIMEOUT_MS = 180_000;
const OPERATOR_CYCLE_MAX_DURATION_MS = 300_000;
const OPERATOR_CYCLE_HEARTBEAT_MS = 2_000;
const OPERATOR_CYCLE_STALE_AFTER_MS = 90_000;
const OPERATOR_RESEARCH_PROFILE = ifvgShallowRetestV4FrozenProfile.profileId;
const OPERATOR_STOP_ABORT_REASON = "operator_stop_requested";
const OPERATOR_TIMEOUT_ABORT_REASON = "operator_timeout";
const OPERATOR_TIMEOUT_MESSAGE = "The guarded research cycle made no observable progress for three minutes and was stopped to keep GoTrader responsive.";
const OPERATOR_DEADLINE_ABORT_REASON = "operator_deadline";
const OPERATOR_DEADLINE_MESSAGE = "The Operator Console cycle reached its five-minute tactical budget and stopped safely. Use Advanced Research Lab for deep-history validation.";

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
  if (typeof window === "undefined") {
    return memoryState;
  }
  try {
    const currentRaw = window.localStorage.getItem(OPERATOR_CYCLE_STORAGE_KEY);
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
      window.localStorage.setItem(OPERATOR_CYCLE_STORAGE_KEY, JSON.stringify(recovered));
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
    window.localStorage.setItem(OPERATOR_CYCLE_STORAGE_KEY, serialized);
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
  let rejectForDeadline: ((error: Error) => void) | undefined;
  const deadlinePromise = new Promise<never>((_, reject) => {
    rejectForDeadline = reject;
  });
  void deadlinePromise.catch(() => undefined);
  const deadlineTimer = globalThis.setTimeout(() => {
    controller.abort(OPERATOR_DEADLINE_ABORT_REASON);
    rejectForDeadline?.(new Error(OPERATOR_DEADLINE_MESSAGE));
  }, OPERATOR_CYCLE_MAX_DURATION_MS);
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

  try {
    const activation = await ensureMt5CanonicalResearchSource();
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

    const activatedFeed = loadActiveMt5ReadOnlyCandleFeed();
    if (activatedFeed?.candles.length) {
      publishClosedMt5ReadOnlyCandles(activatedFeed);
    }

    if (controller.signal.aborted) {
      const deadlineReached = controller.signal.reason === OPERATOR_DEADLINE_ABORT_REASON;
      return updateState(current, {
        status: deadlineReached ? "failed" : "canceled",
        stage: "complete",
        progressPercent: 100,
        completedAt: new Date().toISOString(),
        message: deadlineReached ? OPERATOR_DEADLINE_MESSAGE : "Research cycle stopped before market analysis began.",
        lastError: deadlineReached ? OPERATOR_DEADLINE_MESSAGE : undefined
      });
    }

    current = updateState(current, {
      stage: "building_market_read",
      progressPercent: stageProgress.building_market_read,
      message: "Building the multi-timeframe ICT market read.",
      sourceFingerprint: activation.source.sourceFingerprint
    });

    let lastPipelineProgressBucket = -1;
    const pipeline = await runIctActivateMarketPipeline(
      {
        snapshot: activation.snapshot,
        latestResearchState: readLatestResearchState(),
        saveLatestSummary: true,
        cycleId
      },
      {
        onStepUpdate: (step, steps) => {
          const completed = steps.filter((item) => item.status === "completed" || item.status === "skipped" || item.status === "failed").length;
          const progress = stageProgress.building_market_read + Math.round((completed / Math.max(1, steps.length)) * 20);
          const progressBucket = Math.floor(completed / 3);
          if (progressBucket === lastPipelineProgressBucket && step.status !== "failed") return;
          lastPipelineProgressBucket = progressBucket;
          current = updateState(current, {
            progressPercent: Math.min(50, progress),
            message: step.message ?? step.label
          });
        }
      }
    );
    const latestInsight = insightFromPipeline(pipeline);
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
      const deadlineReached = controller.signal.reason === OPERATOR_DEADLINE_ABORT_REASON;
      return updateState(current, {
        status: deadlineReached ? "failed" : "canceled",
        stage: "complete",
        progressPercent: 100,
        completedAt: new Date().toISOString(),
        message: deadlineReached ? OPERATOR_DEADLINE_MESSAGE : "Research cycle stopped after the current market read.",
        lastError: deadlineReached ? OPERATOR_DEADLINE_MESSAGE : undefined,
        latestInsight
      });
    }

    current = updateState(current, {
      stage: "running_research",
      progressPercent: stageProgress.running_research,
      message: "Running one guarded autonomous research and validation pass.",
      latestInsight
    });

    let lastAutonomousProgress = -1;
    let lastAutonomousStage = "";
    let resetResearchStallWatchdog: () => void = () => undefined;
    const autonomousPromise = runAutonomousResearchLoop({
      state: labState,
      signal: controller.signal,
      settings: {
        maxIterations: 1,
        noImprovementStop: 1,
        safeImportedDataMode: true,
        advancedFullResearchMode: false,
        runLlmAdvisory: true,
        autoApplyPolicyEnabled: false,
        researchStrategyProfile: OPERATOR_RESEARCH_PROFILE,
        maxResearchCandles: 1000,
        validationDepth: "tactical"
      },
      onUpdate: (run) => {
        resetResearchStallWatchdog();
        const progress = Math.max(0, Math.min(100, run.progress.progressPercent));
        const stage = run.progress.activeStage;
        if (stage === lastAutonomousStage && Math.abs(progress - lastAutonomousProgress) < 5) return;
        lastAutonomousStage = stage;
        lastAutonomousProgress = progress;
        current = updateState(current, {
          progressPercent: 55 + Math.round(progress * 0.35),
          message: run.progress.currentTask
        });
      }
    });
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    let watchdogActive = true;
    let rejectForStall: ((error: Error) => void) | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      rejectForStall = reject;
    });
    resetResearchStallWatchdog = () => {
      if (!watchdogActive) return;
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
      timeoutId = globalThis.setTimeout(() => {
        watchdogActive = false;
        controller.abort(OPERATOR_TIMEOUT_ABORT_REASON);
        rejectForStall?.(new Error(OPERATOR_TIMEOUT_MESSAGE));
      }, OPERATOR_RESEARCH_STALL_TIMEOUT_MS);
    };
    resetResearchStallWatchdog();
    let autonomousRun: Awaited<typeof autonomousPromise>;
    try {
      autonomousRun = await Promise.race([autonomousPromise, timeoutPromise, deadlinePromise]);
    } finally {
      watchdogActive = false;
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
    }

    current = updateState(current, {
      stage: "finalizing",
      progressPercent: stageProgress.finalizing,
      message: "Refreshing the compact operator results."
    });
    await resolveResearchRuntimeSnapshot({ labState });

    const stoppedByOperator = controller.signal.reason === OPERATOR_STOP_ABORT_REASON;
    const timedOut = controller.signal.reason === OPERATOR_TIMEOUT_ABORT_REASON;
    const deadlineReached = controller.signal.reason === OPERATOR_DEADLINE_ABORT_REASON;
    const canceled = stoppedByOperator || (!timedOut && !deadlineReached && autonomousRun.status === "canceled");
    const failed = timedOut || deadlineReached || autonomousRun.status === "failed";
    const paused = autonomousRun.status === "paused";
    const completionMessage = deadlineReached
      ? OPERATOR_DEADLINE_MESSAGE
      : timedOut
        ? OPERATOR_TIMEOUT_MESSAGE
        : statusMessageForRun(autonomousRun, stoppedByOperator);
    return updateState(current, {
      status: canceled ? "canceled" : failed ? "failed" : paused ? "blocked" : "completed",
      stage: "complete",
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      message: completionMessage,
      lastError: failed || paused ? completionMessage : undefined,
      latestInsight
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research cycle failed unexpectedly.";
    const stoppedByOperator = controller.signal.reason === OPERATOR_STOP_ABORT_REASON;
    const timedOut = controller.signal.reason === OPERATOR_TIMEOUT_ABORT_REASON;
    const deadlineReached = controller.signal.reason === OPERATOR_DEADLINE_ABORT_REASON;
    const failureMessage = deadlineReached ? OPERATOR_DEADLINE_MESSAGE : timedOut ? OPERATOR_TIMEOUT_MESSAGE : message;
    return updateState(current, {
      status: stoppedByOperator ? "canceled" : "failed",
      stage: "complete",
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      message: stoppedByOperator ? "Research cycle stopped by the operator." : failureMessage,
      lastError: stoppedByOperator ? undefined : failureMessage
    });
  } finally {
    globalThis.clearTimeout(deadlineTimer);
    stopHeartbeat();
    if (activeController === controller) {
      activeController = undefined;
    }
  }
}
