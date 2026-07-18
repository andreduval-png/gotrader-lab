import {
  AUTONOMOUS_RESEARCH_UPDATED_EVENT,
  latestAutonomousResearchRun,
  loadAutonomousResearchState
} from "@/lib/autonomousResearch";
import {
  ICT_ACTIVATE_MARKET_UPDATED_EVENT,
  readLatestActivateMarketSummary
} from "@/lib/ict-strategy-suite/ictActivateMarketPipeline";
import { ICT_LATEST_RESEARCH_STATE_UPDATED_EVENT } from "@/lib/ict-strategy-suite/ictLatestResearchState";
import { RESEARCH_CYCLE_UPDATED_EVENT } from "@/lib/researchCycle";
import { resolveResearchRuntimeSnapshot } from "@/lib/runtime";
import {
  latestValidationChainEntry,
  VALIDATION_CHAIN_UPDATED_EVENT
} from "@/lib/validationChain";

import { buildOperatorConsoleSnapshot } from "./buildOperatorConsoleSnapshot";
import {
  OPERATOR_CYCLE_UPDATED_EVENT,
  readOperatorCycleState
} from "./operatorCycle";
import type { OperatorConsoleSnapshot } from "./operatorConsoleTypes";

const listeners = new Set<() => void>();
let refreshPromise: Promise<OperatorConsoleSnapshot> | undefined;
let attached = false;
let snapshot = buildOperatorConsoleSnapshot({ cycle: readOperatorCycleState() });

const notify = () => listeners.forEach((listener) => listener());

export const getOperatorConsoleSnapshot = () => snapshot;

export const refreshOperatorConsoleSnapshot = (): Promise<OperatorConsoleSnapshot> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = resolveResearchRuntimeSnapshot()
    .then((runtime) => {
      snapshot = buildOperatorConsoleSnapshot({
        runtime,
        activation: readLatestActivateMarketSummary(),
        autonomousRun: latestAutonomousResearchRun(loadAutonomousResearchState()),
        validation: latestValidationChainEntry(),
        cycle: readOperatorCycleState()
      });
      notify();
      return snapshot;
    })
    .catch(() => {
      snapshot = buildOperatorConsoleSnapshot({
        activation: readLatestActivateMarketSummary(),
        autonomousRun: latestAutonomousResearchRun(loadAutonomousResearchState()),
        validation: latestValidationChainEntry(),
        cycle: readOperatorCycleState()
      });
      notify();
      return snapshot;
    })
    .finally(() => {
      refreshPromise = undefined;
    });
  return refreshPromise;
};

const refresh = () => {
  void refreshOperatorConsoleSnapshot();
};

const refreshAtCheckpoint = () => {
  const cycle = readOperatorCycleState();
  if (cycle.status === "running" || cycle.status === "stopping") return;
  refresh();
};

const refreshCycleOnly = () => {
  const cycle = readOperatorCycleState();
  snapshot = {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    cycle,
    insight: cycle.latestInsight ?? snapshot.insight,
    authority: cycle.authority,
    autoApplyAllowed: false,
    researchOnly: true
  };
  notify();
  if (cycle.status !== "running" && cycle.status !== "stopping") {
    refresh();
  }
};

const refreshAutonomous = () => {
  const cycle = readOperatorCycleState();
  if (cycle.status === "running" || cycle.status === "stopping") {
    return;
  }
  refresh();
};

const eventNames = [
  ICT_ACTIVATE_MARKET_UPDATED_EVENT,
  ICT_LATEST_RESEARCH_STATE_UPDATED_EVENT,
  RESEARCH_CYCLE_UPDATED_EVENT,
  VALIDATION_CHAIN_UPDATED_EVENT,
  "gotrader:mt5-feed-status-updated",
  "gotrader:mt5-readonly-feed-updated"
];

const attach = () => {
  if (attached || typeof window === "undefined") return;
  attached = true;
  eventNames.forEach((eventName) => window.addEventListener(eventName, refreshAtCheckpoint));
  window.addEventListener(OPERATOR_CYCLE_UPDATED_EVENT, refreshCycleOnly);
  window.addEventListener(AUTONOMOUS_RESEARCH_UPDATED_EVENT, refreshAutonomous);
  window.addEventListener("storage", refresh);
  refresh();
};

const detach = () => {
  if (!attached || listeners.size || typeof window === "undefined") return;
  eventNames.forEach((eventName) => window.removeEventListener(eventName, refreshAtCheckpoint));
  window.removeEventListener(OPERATOR_CYCLE_UPDATED_EVENT, refreshCycleOnly);
  window.removeEventListener(AUTONOMOUS_RESEARCH_UPDATED_EVENT, refreshAutonomous);
  window.removeEventListener("storage", refresh);
  attached = false;
};

export const subscribeOperatorConsole = (listener: () => void) => {
  listeners.add(listener);
  attach();
  return () => {
    listeners.delete(listener);
    detach();
  };
};
