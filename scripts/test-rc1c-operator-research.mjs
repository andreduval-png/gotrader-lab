#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const server = await createServer({ root, cacheDir: ".gotrader/p2-vite-cache", logLevel: "silent", server: { middlewareMode: true }, appType: "custom" });

try {
  const scheduler = await server.ssrLoadModule("/src/lib/operatorResearch/operatorResearchScheduler.ts");
  const executor = await server.ssrLoadModule("/src/lib/operatorResearch/operatorResearchExecutor.ts");
  const coverage = await server.ssrLoadModule("/src/lib/researchCoverage/canonicalResearchCoverageRegistry.ts");
  const contracts = coverage.canonicalLiveResearchCoverage();
  const expectedOrder = [...coverage.CANONICAL_LIVE_RESEARCH_OWNER_ORDER];
  assert.equal(contracts.length, 5);

  const first = contracts[0].datasetRequirement;
  const datasetBinding = {
    datasetFamily: first.historicalDatasetFamily,
    datasetVersion: first.historicalDatasetVersion,
    certificateId: first.certificateId,
    datasetChecksum: first.datasetChecksum,
    sourceFingerprint: first.sourceFingerprint
  };
  const pilotStart = Date.parse("2024-08-01T13:30:00.000Z");
  const pilotCandles = Object.fromEntries(["5m", "15m", "1h", "4h", "1d"].map((timeframe) => [
    timeframe,
    Array.from({ length: 16 }, (_, index) => ({
      id: `rc1c-${timeframe}-${index}`,
      symbol: "MNQ",
      timeframe,
      timestamp: new Date(pilotStart + index * 300_000).toISOString(),
      open: 100 + (index % 3) * 0.25,
      high: 101 + (index % 3) * 0.25,
      low: 99 + (index % 3) * 0.25,
      close: 100.25 + (index % 3) * 0.25,
      volume: 100 + index
    }))
  ]));
  const evaluationTimes = pilotCandles["5m"].slice(-2).map((candle) => candle.timestamp);
  const narrative = {
    structural: "bearish",
    intermediate: "bearish",
    execution: "bearish",
    liquidityPath: "sellside",
    structuralTimeframe: "1h",
    intermediateTimeframe: "15m",
    executionTimeframe: "5m",
    policyId: "rc1c-bounded-narrative",
    policyVersion: "1.0.0"
  };

  let clock = Date.parse("2026-08-28T12:00:00.000Z");
  const now = () => (clock += 10);
  const events = [];
  let active = 0;
  let maxActive = 0;
  const accepted = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "rc1c_acceptance",
    cycleStartedAt: "2026-08-28T11:59:59.000Z",
    planPublishedAt: "2026-08-28T12:00:00.000Z",
    datasetBinding,
    now,
    mt5RequestCount: 1,
    canonicalFactBuildCount: 1,
    capacityFor: () => true,
    onUpdate: (summary) => events.push({
      globalStatus: summary.globalStatus,
      statuses: summary.tasks.map((task) => task.status),
      planPublished: summary.livePlanPublished
    }),
    execute: async (task, reportProgress) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        return await executor.executeCanonicalOwnerHistoricalPilot(task, {
          datasetBinding,
          candlesByTimeframe: pilotCandles,
          evaluationTimes,
          narrativeAt: () => narrative,
          maximumEvaluations: 2
        }, reportProgress);
      } finally {
        active -= 1;
      }
    }
  });

  assert.equal(accepted.liveOwnerTaskCount, 5);
  assert.deepEqual(accepted.tasks.map((task) => task.ownerStrategyId), expectedOrder);
  assert.equal(accepted.researchOnlyTasks.length, 1);
  assert.equal(accepted.researchOnlyTasks[0].ownerStrategyId, "ifvg_fresh_retest_v4_candidate");
  assert.equal(accepted.researchOnlyTasks[0].liveOwner, false);
  assert.equal(maxActive, 1, "certified-heavy owner tasks must run serially");
  assert.equal(accepted.globalStatus, "COMPLETE_WITH_BLOCKERS");
  assert.ok(accepted.tasks.every((task) => task.status === "BLOCKED" &&
    /CERTIFIED_CONTENT_PROVENANCE_UNAVAILABLE/.test(task.blocker)));
  assert.ok(events.every((event) => event.planPublished), "plan must already be published before owner queue updates");
  expectedOrder.forEach((_, index) => {
    assert.ok(events.some((event) => event.statuses[index] === "RUNNING"), `owner ${index + 1} must publish RUNNING before terminal status`);
  });
  assert.ok(Date.parse(accepted.performance.planPublishedAt) < Date.parse(accepted.performance.firstHistoricalOwnerResearchCompletedAt));
  assert.equal(accepted.performance.mt5RequestCount, 1);
  assert.equal(accepted.performance.sharedLiveFetchPlanCount, 1);
  assert.equal(accepted.performance.canonicalFactBuildCount, 1);
  assert.equal(accepted.sharedLiveContextCount, 1);
  assert.equal(accepted.historicalMt5FallbackUsed, false);
  assert.equal(accepted.geometryMutationDetected, false);
  assert.ok(accepted.tasks.every((task) => task.evidenceIds.length === 0 && task.evidence.length === 0));
  assert.ok(accepted.tasks.every((task) => task.capacityGateEvaluated && task.datasetGateEvaluated));

  const attempted = [];
  const oneBlocked = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "rc1c_one_blocked",
    cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z",
    datasetBinding,
    now,
    capacityFor: () => true,
    execute: async (task) => {
      attempted.push(task.ownerStrategyId);
      const blocked = task.ownerStrategyId === "ict_market_maker_buy_model_v1";
      return {
        status: blocked ? "BLOCKED" : "PASSED_WITH_ZERO_CANDIDATES",
        blocker: blocked ? "Owner-specific bounded fixture unavailable." : undefined,
        progress: { evaluationsCompleted: 1, candidateCount: 0, fillCount: 0, outcomeCount: 0, blockedCount: blocked ? 1 : 0 }
      };
    }
  });
  assert.equal(oneBlocked.globalStatus, "COMPLETE_WITH_BLOCKERS");
  assert.equal(oneBlocked.tasks.find((task) => task.ownerStrategyId === "ict_market_maker_buy_model_v1").status, "BLOCKED");
  assert.deepEqual(attempted, expectedOrder, "one owner failure must not silently skip later owners");
  assert.equal(oneBlocked.livePlanPreserved, true);

  let invalidExecutions = 0;
  const invalidDataset = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "rc1c_invalid_dataset",
    cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z",
    datasetBinding: { ...datasetBinding, certificateId: "wrong" },
    now,
    execute: async () => {
      invalidExecutions += 1;
      throw new Error("must not execute");
    }
  });
  assert.equal(invalidExecutions, 0);
  assert.ok(invalidDataset.tasks.every((task) => task.status === "CERTIFICATE_INVALID"));
  assert.equal(invalidDataset.livePlanPreserved, true);

  const unavailableDataset = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "rc1c_dataset_unavailable",
    cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z",
    now,
    execute: async () => { throw new Error("must not execute without certified data"); }
  });
  assert.ok(unavailableDataset.tasks.every((task) => task.status === "DATASET_UNAVAILABLE"));
  assert.equal(unavailableDataset.historicalMt5FallbackUsed, false);

  const capacity = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "rc1c_capacity",
    cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z",
    datasetBinding,
    now,
    capacityFor: (task) => task.ownerStrategyId !== "ict_market_maker_buy_model_v1",
    execute: async () => ({ status: "PASSED_WITH_ZERO_CANDIDATES", progress: { evaluationsCompleted: 1, candidateCount: 0, fillCount: 0, outcomeCount: 0, blockedCount: 0 } })
  });
  assert.equal(capacity.tasks.find((task) => task.ownerStrategyId === "ict_market_maker_buy_model_v1").status, "CAPACITY_BLOCKED");
  assert.equal(capacity.tasks.find((task) => task.ownerStrategyId === "ict_market_maker_sell_model_v1").status, "PASSED_WITH_ZERO_CANDIDATES");

  const unmeasuredCapacity = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "rc1c_unmeasured_capacity",
    cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z",
    datasetBinding,
    now,
    execute: async () => { throw new Error("must not execute without measured capacity"); }
  });
  assert.ok(unmeasuredCapacity.tasks.every((task) => task.status === "CAPACITY_BLOCKED"));

  let lateProgress;
  let stalledSignal;
  let stallExecutions = 0;
  const stalled = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "rc1c_stall",
    cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z",
    datasetBinding,
    ownerStallTimeoutMs: 15,
    capacityFor: () => true,
    execute: async (_task, report, signal) => {
      stallExecutions += 1;
      lateProgress = report;
      stalledSignal = signal;
      return new Promise(() => undefined);
    }
  });
  assert.equal(stalled.tasks[0].status, "FAILED");
  assert.match(stalled.tasks[0].blocker, /OWNER_RESEARCH_STALLED/);
  assert.equal(stalled.tasks[1].status, "BLOCKED");
  assert.equal(stallExecutions, 1);
  assert.equal(stalledSignal.aborted, true);
  const stalledSnapshot = JSON.stringify(stalled);
  lateProgress({ evaluationsCompleted: 999 });
  assert.equal(JSON.stringify(stalled), stalledSnapshot, "late callbacks cannot mutate terminal results");

  const midRunController = new AbortController();
  let cancelExecutions = 0;
  const midRun = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "mid-run-cancel", cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z", datasetBinding,
    signal: midRunController.signal, capacityFor: () => true,
    execute: async () => {
      cancelExecutions += 1;
      midRunController.abort("operator_stop_requested");
      return new Promise(() => undefined);
    }
  });
  assert.equal(cancelExecutions, 1);
  assert.ok(midRun.tasks.every((task) => task.status === "CANCELLED"));

  const foreignEvidence = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "cross-owner-evidence", cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z", datasetBinding,
    capacityFor: () => true,
    execute: async (task, report) => {
      const other = scheduler.createCanonicalOwnerResearchQueue({ cycleId: "other", queuedAt: "2026-08-28T12:00:00.000Z" }).tasks
        .find((candidate) => candidate.ownerStrategyId !== task.ownerStrategyId);
      const contract = contracts.find((item) => item.ownerStrategyId === other.ownerStrategyId);
      // Explicit forged evidence tests the scheduler independently of the blocked pilot.
      return {
        status: "PASSED",
        evidence: [{
          strategyId: contract.ownerStrategyId, strategyVersion: contract.ownerStrategyVersion,
          researchProfileId: contract.researchProfileId,
          geometryPolicyId: contract.geometryPolicyId, geometryPolicyVersion: contract.geometryPolicyVersion,
          datasetFamily: datasetBinding.datasetFamily, datasetVersion: datasetBinding.datasetVersion,
          datasetCertificateId: datasetBinding.certificateId, datasetChecksum: datasetBinding.datasetChecksum,
          sourceFingerprint: datasetBinding.sourceFingerprint, parameterHash: contract.parameterIdentity,
          sessionPolicyVersion: contract.datasetRequirement.sessionPolicyVersion,
          evaluationTier: "HISTORICAL_VALIDATION", runId: "synthetic-foreign-evidence",
          asOfStart: evaluationTimes[0], asOfEnd: evaluationTimes[1], producerLineage: other.foldRunnerId
        }],
        progress: { evaluationsCompleted: 1, candidateCount: 0, fillCount: 0, outcomeCount: 0, blockedCount: 0 }
      };
    }
  });
  assert.ok(foreignEvidence.tasks.every((task) => task.status === "EVIDENCE_INCOMPATIBLE" && task.evidenceIds.length === 0));

  const incompatible = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "rc1c_incompatible_evidence",
    cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z",
    datasetBinding,
    now,
    capacityFor: () => true,
    execute: async (task) => {
      const contract = contracts.find((item) => item.ownerStrategyId === task.ownerStrategyId);
      return {
        status: "PASSED",
        evidence: [{
          strategyId: contract.ownerStrategyId,
          strategyVersion: "stale-version",
          researchProfileId: contract.researchProfileId,
          geometryPolicyId: contract.geometryPolicyId,
          geometryPolicyVersion: contract.geometryPolicyVersion,
          datasetFamily: contract.datasetRequirement.historicalDatasetFamily,
          datasetVersion: contract.datasetRequirement.historicalDatasetVersion,
          datasetCertificateId: contract.datasetRequirement.certificateId,
          datasetChecksum: contract.datasetRequirement.datasetChecksum,
          sourceFingerprint: contract.datasetRequirement.sourceFingerprint,
          parameterHash: contract.parameterIdentity,
          sessionPolicyVersion: contract.datasetRequirement.sessionPolicyVersion,
          evaluationTier: "HISTORICAL_VALIDATION",
          runId: `${task.taskId}:stale`,
          asOfStart: "2024-08-01T13:30:00.000Z",
          asOfEnd: "2024-08-01T13:35:00.000Z",
          producerLineage: task.foldRunnerId
        }],
        progress: { evaluationsCompleted: 1, candidateCount: 0, fillCount: 0, outcomeCount: 0, blockedCount: 0 }
      };
    }
  });
  assert.ok(incompatible.tasks.every((task) => task.status === "EVIDENCE_INCOMPATIBLE" && task.evidenceIds.length === 0));

  const canceledController = new AbortController();
  canceledController.abort("operator_stop_requested");
  const canceled = await scheduler.runCanonicalOwnerResearchScheduler({
    cycleId: "rc1c_canceled",
    cycleStartedAt: "2026-08-28T12:00:00.000Z",
    planPublishedAt: "2026-08-28T12:00:00.100Z",
    datasetBinding,
    signal: canceledController.signal,
    capacityFor: () => true,
    now,
    execute: async () => { throw new Error("must not execute after cancellation"); }
  });
  assert.equal(canceled.globalStatus, "CANCELLED");
  assert.ok(canceled.tasks.every((task) => task.status === "CANCELLED"));
  assert.equal(canceled.livePlanPreserved, true);

  const queueA = scheduler.createCanonicalOwnerResearchQueue({ cycleId: "cycle_a", queuedAt: "2026-08-28T12:00:00.000Z" });
  const queueB = scheduler.createCanonicalOwnerResearchQueue({ cycleId: "cycle_b", queuedAt: "2026-08-28T12:00:01.000Z" });
  assert.ok(queueA.tasks.every((task) => task.cycleId === "cycle_a" && !queueB.tasks.some((other) => other.taskId === task.taskId)));

  const cycleSource = fs.readFileSync(path.join(root, "src/lib/operatorConsole/operatorCycle.ts"), "utf8");
  const storeSource = fs.readFileSync(path.join(root, "src/lib/operatorConsole/operatorConsoleStore.ts"), "utf8");
  assert.match(cycleSource, /readOperatorCycleState\(\)\.cycleId !== summary\.cycleId/);
  assert.match(storeSource, /cycleActive && !cycle\.ownerResearch\?\.livePlanPublished/);
  assert.doesNotMatch(cycleSource, /proposedEntryPrice\s*=|proposedStopLoss\s*=|proposedTakeProfit\s*=/);

  console.log(JSON.stringify({
    status: "passed",
    liveOwnerCount: accepted.liveOwnerTaskCount,
    ownerOrder: expectedOrder,
    ownerStatuses: Object.fromEntries(accepted.tasks.map((task) => [task.ownerStrategyId, task.status])),
    researchOnly: accepted.researchOnlyTasks.map((task) => task.ownerStrategyId),
    maximumConcurrency: maxActive,
    planFirst: true,
    completeWithBlockers: oneBlocked.globalStatus,
    globalDatasetBlock: invalidDataset.tasks[0].status,
    unavailableDataset: unavailableDataset.tasks[0].status,
    capacityBlock: capacity.tasks.find((task) => task.ownerStrategyId === "ict_market_maker_buy_model_v1").status,
    unmeasuredCapacity: unmeasuredCapacity.tasks[0].status,
    watchdog: stalled.tasks[0].status,
    evidenceQuarantine: incompatible.tasks[0].status,
    cancellation: canceled.globalStatus,
    performance: accepted.performance,
    authority: "none/none/none"
  }, null, 2));
} finally {
  await server.close();
}
