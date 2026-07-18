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

export const OPERATOR_CYCLE_STORAGE_KEY = "gotrader.operator-cycle.v1";
export const OPERATOR_CYCLE_UPDATED_EVENT = "gotrader:operator-cycle-updated";
const OPERATOR_RESEARCH_TIMEOUT_MS = 120_000;

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

const sanitize = (state: OperatorCycleState): OperatorCycleState => ({
  cycleId: state.cycleId,
  status: state.status,
  stage: state.stage,
  progressPercent: Math.max(0, Math.min(100, Math.round(state.progressPercent))),
  message: String(state.message ?? "").slice(0, 500),
  startedAt: state.startedAt,
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

const recoverInterruptedState = (state: OperatorCycleState): OperatorCycleState => {
  if ((state.status !== "running" && state.status !== "stopping") || activeController) {
    return state;
  }
  return sanitize({
    ...state,
    status: "canceled",
    stage: "complete",
    progressPercent: 100,
    completedAt: new Date().toISOString(),
    message: "The previous research cycle was interrupted by a page reload or browser shutdown. Start a new cycle when ready.",
    lastError: "Interrupted cycle recovered safely; no research gates or authority were changed."
  });
};

export const readOperatorCycleState = (): OperatorCycleState => {
  if (typeof window === "undefined") {
    return memoryState;
  }
  try {
    const raw = window.localStorage.getItem(OPERATOR_CYCLE_STORAGE_KEY);
    if (!raw) return memoryState;
    const recovered = recoverInterruptedState(sanitize(JSON.parse(raw) as OperatorCycleState));
    memoryState = recovered;
    if (recovered.status === "canceled") {
      window.localStorage.setItem(OPERATOR_CYCLE_STORAGE_KEY, JSON.stringify(recovered));
    }
    return recovered;
  } catch {
    return memoryState;
  }
};

export const saveOperatorCycleState = (state: OperatorCycleState): OperatorCycleState => {
  const compact = sanitize(state);
  memoryState = compact;
  if (typeof window !== "undefined") {
    const serialized = JSON.stringify(compact);
    if (/"candles"\s*:/i.test(serialized)) {
      throw new Error("Operator cycle state must not contain candle arrays.");
    }
    window.localStorage.setItem(OPERATOR_CYCLE_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent(OPERATOR_CYCLE_UPDATED_EVENT, { detail: compact }));
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

const statusMessageForRun = (run: AutonomousResearchRun) => {
  if (run.status === "failed") return run.stopReasonDetail ?? "The autonomous research pass failed.";
  if (run.status === "paused") return run.stopReasonDetail ?? "The autonomous research pass paused for review.";
  if (run.status === "canceled") return "Research cycle stopped by the operator.";
  return run.stopReasonDetail ?? "Research cycle completed. Results and decisions are ready for review.";
};

export const stopOperatorResearchCycle = (): OperatorCycleState => {
  const current = readOperatorCycleState();
  if (current.status !== "running" && current.status !== "stopping") {
    return current;
  }
  activeController?.abort();
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
    status: "running",
    stage: "activating_source",
    progressPercent: stageProgress.activating_source,
    message: "Activating the canonical MT5 read-only research source.",
    startedAt,
    authority: OPERATOR_AUTHORITY,
    autoApplyAllowed: false,
    researchOnly: true
  });

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
      sourceFingerprint: activation.source.sourceFingerprint
    });

    let lastPipelineProgressBucket = -1;
    const pipeline = await runIctActivateMarketPipeline(
      {
        snapshot: activation.snapshot,
        latestResearchState: readLatestResearchState(),
        saveLatestSummary: true
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
      stage: "running_research",
      progressPercent: stageProgress.running_research,
      message: "Running one guarded autonomous research and validation pass.",
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
        autoApplyPolicyEnabled: false,
        researchStrategyProfile: "ifvg_fresh_retest_v3_research",
        maxResearchCandles: 1000
      },
      onUpdate: (run) => {
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
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = globalThis.setTimeout(() => {
        controller.abort();
        reject(new Error("The guarded research cycle exceeded two minutes and was stopped to keep GoTrader responsive."));
      }, OPERATOR_RESEARCH_TIMEOUT_MS);
    });
    let autonomousRun: Awaited<typeof autonomousPromise>;
    try {
      autonomousRun = await Promise.race([autonomousPromise, timeoutPromise]);
    } finally {
      if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId);
    }

    current = updateState(current, {
      stage: "finalizing",
      progressPercent: stageProgress.finalizing,
      message: "Refreshing the compact operator results."
    });
    await resolveResearchRuntimeSnapshot({ labState });

    const canceled = controller.signal.aborted || autonomousRun.status === "canceled";
    const failed = autonomousRun.status === "failed";
    const paused = autonomousRun.status === "paused";
    return updateState(current, {
      status: canceled ? "canceled" : failed ? "failed" : paused ? "blocked" : "completed",
      stage: "complete",
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      message: statusMessageForRun(autonomousRun),
      lastError: failed || paused ? statusMessageForRun(autonomousRun) : undefined,
      latestInsight
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research cycle failed unexpectedly.";
    const canceled = controller.signal.aborted;
    return updateState(current, {
      status: canceled ? "canceled" : "failed",
      stage: "complete",
      progressPercent: 100,
      completedAt: new Date().toISOString(),
      message: canceled ? "Research cycle stopped by the operator." : message,
      lastError: canceled ? undefined : message
    });
  } finally {
    if (activeController === controller) {
      activeController = undefined;
    }
  }
}
