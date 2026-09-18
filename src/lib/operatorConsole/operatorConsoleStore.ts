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
import {
  evaluatePredictionCalibration,
  loadPredictionLedger,
  PREDICTION_LEDGER_UPDATED_EVENT
} from "@/lib/predictionLedger";
import { resolveResearchRuntimeSnapshot } from "@/lib/runtime";
import {
  latestValidationChainEntry,
  VALIDATION_CHAIN_UPDATED_EVENT
} from "@/lib/validationChain";
import {
  hydrateResearchEvidenceAggregateIndex,
  loadResearchEvidenceAggregateIndex,
  RESEARCH_EVIDENCE_UPDATED_EVENT
} from "@/lib/researchEvidenceLedger";
import {
  GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT,
  loadGbrainMemoryOutbox
} from "@/lib/researchMemory";

import { buildOperatorConsoleSnapshot } from "./buildOperatorConsoleSnapshot";
import { buildOperatorMemorySummary } from "./operatorMemorySummary";
import {
  OPERATOR_CYCLE_UPDATED_EVENT,
  readOperatorCycleState
} from "./operatorCycle";
import type { OperatorConsoleSnapshot } from "./operatorConsoleTypes";
import type { OperatorPredictionSummary } from "./operatorConsoleTypes";
import type { OperatorResearchPlanSummary } from "./operatorConsoleTypes";

const listeners = new Set<() => void>();
let refreshPromise: Promise<OperatorConsoleSnapshot> | undefined;
let attached = false;
let snapshot = buildOperatorConsoleSnapshot({ cycle: readOperatorCycleState() });

const resolveOperatorRuntimeSnapshot = async () => {
  const acceptanceScenario = import.meta.env.DEV && typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("acceptanceScenario")
    : undefined;
  if (acceptanceScenario === "int3a2-live-conflict") {
    const acceptance = await import("./int3a2ProductionAcceptance");
    return acceptance.runInt3a2ProductionConflictAcceptance();
  }
  if (acceptanceScenario === "rc1c-plan-first") {
    const acceptance = await import("./rc1cProductionAcceptance");
    return acceptance.runRc1cProductionAcceptance();
  }
  if (acceptanceScenario === "multi-strategy-validation") {
    const acceptance = await import("./multiStrategyValidationAcceptance");
    return acceptance.runMultiStrategyValidationAcceptance();
  }
  if (acceptanceScenario === "owner-validation-policy") {
    const acceptance = await import("./ownerValidationPolicyAcceptance");
    return acceptance.runOwnerValidationPolicyAcceptance();
  }
  return resolveResearchRuntimeSnapshot();
};

const readPredictionSummary = (): OperatorPredictionSummary => {
  const state = loadPredictionLedger();
  const latest = state.entries.at(-1);
  const calibration = evaluatePredictionCalibration(state.entries);
  const latestIsContextOnly = latest?.resolution === "not_actionable";
  const nextAction = !latest
    ? "Run a research cycle with an eligible MT5 source to issue the first timestamped forecast."
    : latestIsContextOnly
      ? "Context watch issued. Calibration starts only after direction, trigger zone, invalidation, and target define a causal forecast."
      : latest.resolution === "pending"
        ? "Forward forecast is active. Collect later closed-candle outcomes across independent dates before trusting its probability estimate."
        : calibration.classification === "uncalibrated"
          ? "Collect later closed-candle outcomes across independent dates before trusting the probability estimate."
          : calibration.classification === "insufficient_data"
            ? calibration.blockers[0] ?? "Collect more independent causal outcomes."
            : calibration.classification === "calibrated_positive"
              ? "Continue forward tracking; calibration does not promote readiness by itself."
              : "Keep the forecast family in research and review its expectancy and calibration blockers.";
  return {
    latestFamily: (latest?.scenarioFamily ?? "No forecast issued").replace(/_/g, " "),
    latestState: (latestIsContextOnly ? "context watch" : latest?.lifecycleState ?? "not started").replace(/_/g, " "),
    pendingForecasts: calibration.pendingForecasts,
    completedForecasts: calibration.completedForecasts,
    classification: (latestIsContextOnly && calibration.actionableForecasts === 0
      ? "awaiting causal forecast"
      : calibration.classification
    ).replace(/_/g, " "),
    averageRealizedR: calibration.averageRealizedR ?? undefined,
    nextAction
  };
};

const notify = () => listeners.forEach((listener) => listener());

const pendingResearchPlan = (
  cycleId: string | undefined,
  sourceFingerprint: string | undefined
): OperatorResearchPlanSummary => ({
  status: "unavailable",
  planIdentityStatus: "pending_cycle",
  cycleId,
  setup: "Refreshing current-cycle research plan",
  side: "flat",
  setupDirection: "neutral",
  signal: "NO_TRADE",
  planSource: "unavailable",
  planCoherence: "incomplete",
  planCoherenceReason: "The current cycle has not produced an identity-bound trade plan yet.",
  riskScreeningStatus: "not evaluated",
  riskScreeningReason: "Wait for the current market read and risk screen to complete.",
  accountRiskEvaluation: "external_simulation_required",
  sourceFingerprint,
  informationalOnly: true,
  executionAllowed: false
});

export const getOperatorConsoleSnapshot = () => snapshot;

export const refreshOperatorConsoleSnapshot = (): Promise<OperatorConsoleSnapshot> => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = Promise.all([
    resolveOperatorRuntimeSnapshot().catch((error) => {
      if (import.meta.env.DEV) console.error("Operator runtime refresh failed", error);
      return undefined;
    }),
    hydrateResearchEvidenceAggregateIndex().catch(() => loadResearchEvidenceAggregateIndex())
  ])
    .then(([runtime, evidence]) => {
      snapshot = buildOperatorConsoleSnapshot({
        runtime,
        activation: readLatestActivateMarketSummary(),
        autonomousRun: latestAutonomousResearchRun(loadAutonomousResearchState()),
        validation: latestValidationChainEntry(),
        prediction: readPredictionSummary(),
        memory: buildOperatorMemorySummary(evidence, loadGbrainMemoryOutbox()),
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
        prediction: readPredictionSummary(),
        memory: buildOperatorMemorySummary(loadResearchEvidenceAggregateIndex(), loadGbrainMemoryOutbox()),
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
  if ((cycle.status === "running" || cycle.status === "stopping") && !cycle.ownerResearch?.livePlanPublished) return;
  refresh();
};

const refreshCycleOnly = () => {
  const cycle = readOperatorCycleState();
  const cycleActive = cycle.status === "running" || cycle.status === "stopping";
  snapshot = {
    ...snapshot,
    generatedAt: new Date().toISOString(),
    cycle,
    insight: cycle.latestInsight ?? snapshot.insight,
    researchPlan: cycleActive && !cycle.ownerResearch?.livePlanPublished
      ? pendingResearchPlan(cycle.cycleId, snapshot.source.fingerprint)
      : snapshot.researchPlan,
    authority: cycle.authority,
    autoApplyAllowed: false,
    researchOnly: true
  };
  notify();
  if (cycleActive && cycle.ownerResearch?.livePlanPublished) {
    refresh();
  }
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
  PREDICTION_LEDGER_UPDATED_EVENT,
  VALIDATION_CHAIN_UPDATED_EVENT,
  RESEARCH_EVIDENCE_UPDATED_EVENT,
  GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT,
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
