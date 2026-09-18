import {
  ICT_ACTIVATE_MARKET_LATEST_SUMMARY_STORAGE_KEY,
  readLatestActivateMarketSummary
} from "@/lib/ict-strategy-suite/ictActivateMarketPipeline";
import { canonicalLiveResearchCoverage } from "@/lib/researchCoverage";
import { runCanonicalOwnerResearchScheduler } from "@/lib/operatorResearch";
import type { ResearchRuntimeSnapshot } from "@/lib/runtime";

import { runInt3a2ProductionConflictAcceptance } from "./int3a2ProductionAcceptance";
import { OPERATOR_AUTHORITY } from "./operatorConsoleTypes";
import { saveOperatorCycleState } from "./operatorCycle";

const CYCLE_ID = "rc1c-production-plan-first";
let scenarioPromise: Promise<ResearchRuntimeSnapshot> | undefined;

export const runRc1cProductionAcceptance = () => {
  if (scenarioPromise) return scenarioPromise;
  scenarioPromise = (async () => {
    const runtime = await runInt3a2ProductionConflictAcceptance();
    const activation = readLatestActivateMarketSummary();
    const selected = activation?.candidatePlans?.find((candidate) => candidate.strategyId === "ict_2022_model_v1");
    if (!activation || !selected?.geometry) throw new Error("RC1C acceptance could not resolve canonical ICT 2022 geometry.");

    const planFirstActivation = {
      ...activation,
      cycleId: CYCLE_ID,
      currentCandidateId: undefined,
      canonicalSetupConflict: undefined,
      currentOpportunitySummary: undefined,
      candidatePlans: [selected],
      modelName: selected.setupName,
      researchSide: selected.side,
      proposedCandidateStatus: "accepted" as const,
      proposedGeometry: selected.geometry,
      proposedEntryPrice: selected.entry,
      proposedEntryZone: selected.entry === undefined ? undefined : { lower: selected.entry, upper: selected.entry },
      proposedStopLoss: selected.stop,
      proposedTakeProfit: selected.target,
      proposedRiskReward: selected.riskReward,
      riskScreeningStatus: "accepted",
      riskScreeningReason: "Canonical producer geometry passed the bounded acceptance fixture."
    };
    window.localStorage.setItem(ICT_ACTIVATE_MARKET_LATEST_SUMMARY_STORAGE_KEY, JSON.stringify(planFirstActivation));

    const contracts = canonicalLiveResearchCoverage();
    const requirement = contracts[0].datasetRequirement;
    const ownerResearch = await runCanonicalOwnerResearchScheduler({
      cycleId: CYCLE_ID,
      cycleStartedAt: "2026-08-28T13:00:00.000Z",
      planPublishedAt: "2026-08-28T13:00:00.250Z",
      datasetBinding: {
        datasetFamily: requirement.historicalDatasetFamily,
        datasetVersion: requirement.historicalDatasetVersion,
        certificateId: requirement.certificateId ?? "",
        datasetChecksum: requirement.datasetChecksum ?? "",
        sourceFingerprint: requirement.sourceFingerprint ?? ""
      },
      mt5RequestCount: 1,
      canonicalFactBuildCount: 1,
      capacityFor: () => true,
      execute: async (task, progress) => {
        progress({ evaluationsCompleted: 1, currentPartition: "bounded-acceptance" });
        const blocked = task.ownerStrategyId === "ict_market_maker_buy_model_v1";
        return {
          status: blocked ? "BLOCKED" : "PASSED_WITH_ZERO_CANDIDATES",
          blocker: blocked ? "Owner-specific bounded acceptance fixture unavailable." : undefined,
          progress: {
            evaluationsCompleted: 1,
            candidateCount: 0,
            fillCount: 0,
            outcomeCount: 0,
            blockedCount: blocked ? 1 : 0,
            currentPartition: "bounded-acceptance"
          }
        };
      }
    });
    ownerResearch.researchOnlyTasks[0].status = "RUNNING";
    ownerResearch.researchOnlyTasks[0].startedAt = "2026-08-28T13:00:01.000Z";
    ownerResearch.researchOnlyTasks[0].progress.currentPartition = "bounded-research-only";

    saveOperatorCycleState({
      cycleId: CYCLE_ID,
      status: "running",
      stage: "research_only",
      progressPercent: 70,
      message: "Live plan available; separate research-only lane is running.",
      startedAt: "2026-08-28T13:00:00.000Z",
      heartbeatAt: "2026-08-28T13:00:01.000Z",
      sourceFingerprint: runtime.marketData.activeResearchSource.fingerprint,
      ownerResearch,
      authority: OPERATOR_AUTHORITY,
      autoApplyAllowed: false,
      researchOnly: true
    });
    return runtime;
  })();
  return scenarioPromise;
};
