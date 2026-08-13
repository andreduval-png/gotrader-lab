#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-bounded-shadow-host/node");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/shadowOrchestrationHost.ts")], outRoot });
const hostModule = await import(`${pathToFileURL(path.join(outRoot, "shadowOrchestrationHost.mjs")).href}?v=${Date.now()}`);
const leaseModule = await import(`${pathToFileURL(path.join(outRoot, "shadowOrchestrationLease.mjs")).href}?v=${Date.now()}`);
const { job, handlers } = await buildShadowOrchestrationScenario();

const createHarness = () => {
  const snapshots = new Map();
  const cancellations = new Map();
  const quarantines = [];
  let lease;
  let tick = 0;
  let rejectRenewal = false;
  const now = () => new Date(Date.parse("2026-08-12T20:00:00.000Z") + tick++ * 1_000).toISOString();
  const dependencies = {
    now,
    loadSnapshot: async (id) => snapshots.get(id),
    loadCancellation: async (id) => cancellations.get(id),
    acquireLease: async (input) => {
      const result = await leaseModule.acquireShadowOrchestrationLease({ ...input, current: lease });
      if (result.status !== "blocked" && result.status !== "coalesced") lease = result.lease;
      return result;
    },
    renewLease: async (input) => {
      if (rejectRenewal) throw new Error("synthetic_lease_loss");
      lease = await leaseModule.renewShadowOrchestrationLease({ current: lease, ownerId: input.ownerId, renewedAt: input.renewedAt, durationMs: input.durationMs });
      return lease;
    },
    releaseLease: async (logicalJobId, ownerId, releasedAt) => {
      assert.equal(logicalJobId, lease.logicalJobId);
      lease = await leaseModule.releaseShadowOrchestrationLease(lease, ownerId, releasedAt);
      return lease;
    },
    persistSnapshot: async (snapshot, guard) => {
      if (!lease || lease.leaseId !== guard.proof.leaseId || lease.status !== "active") {
        return { status: "quarantined", blocker: "shadow_lease_guard_rejected", quarantine: {} };
      }
      snapshots.set(snapshot.job.logicalJobId, snapshot);
      return { status: "persisted", result: { status: "persisted" } };
    },
    quarantine: async (input) => {
      const evidence = { ...input, quarantineId: `quarantine-${quarantines.length + 1}` };
      quarantines.push(evidence);
      return { status: "persisted", evidence };
    }
  };
  return { dependencies, snapshots, cancellations, quarantines, setRejectRenewal: (value) => { rejectRenewal = value; } };
};

assert.throws(() => new hostModule.BoundedShadowOrchestrationHost({ ownerId: "", maxConcurrency: 1, maxStagesPerRun: 1, leaseDurationMs: 1_000, renewEveryStages: 1 }), /owner/);
assert.throws(() => new hostModule.BoundedShadowOrchestrationHost({ ownerId: "owner", maxConcurrency: 0, maxStagesPerRun: 1, leaseDurationMs: 1_000, renewEveryStages: 1 }), /concurrency/);
assert.throws(() => new hostModule.BoundedShadowOrchestrationHost({ ownerId: "owner", maxConcurrency: 1, maxStagesPerRun: 33, leaseDurationMs: 1_000, renewEveryStages: 1 }), /stage budget/);

const recovery = createHarness();
const firstHost = new hostModule.BoundedShadowOrchestrationHost({ ownerId: "host-a", maxConcurrency: 1, maxStagesPerRun: 2, leaseDurationMs: 60_000, renewEveryStages: 1 }, recovery.dependencies);
firstHost.start();
const first = await firstHost.run({ job, handlers });
assert.equal(first.status, "interrupted");
assert.equal(first.stagesProcessed, 2);
assert.equal(first.released, true);
await firstHost.stop();
assert.equal(firstHost.getState(), "stopped");
assert.equal(recovery.snapshots.get(job.logicalJobId).artifacts.length, 2);

const resumedHost = new hostModule.BoundedShadowOrchestrationHost({ ownerId: "host-a", maxConcurrency: 1, maxStagesPerRun: 2, leaseDurationMs: 60_000, renewEveryStages: 1 }, recovery.dependencies);
resumedHost.start();
const resumed = await resumedHost.run({ job, handlers });
assert.equal(resumed.status, "completed");
assert.equal(resumed.stagesProcessed, 2);
assert.equal(resumed.released, true);
assert.equal(recovery.snapshots.get(job.logicalJobId).artifacts.length, 4);
assert.ok(recovery.snapshots.get(job.logicalJobId).seal);
await resumedHost.stop();

const cancelledHarness = createHarness();
cancelledHarness.cancellations.set(job.logicalJobId, { cancellationId: "accepted-cancellation" });
const cancelledHost = new hostModule.BoundedShadowOrchestrationHost({ ownerId: "host-cancel", maxConcurrency: 1, maxStagesPerRun: 2, leaseDurationMs: 60_000, renewEveryStages: 1 }, cancelledHarness.dependencies);
cancelledHost.start();
const cancelled = await cancelledHost.run({ job, handlers });
assert.equal(cancelled.status, "cancelled");
assert.equal(cancelled.stagesProcessed, 0);
assert.equal(cancelled.released, true);
assert.equal(cancelledHarness.snapshots.size, 0);
await cancelledHost.stop();

const lostLeaseHarness = createHarness();
lostLeaseHarness.setRejectRenewal(true);
const lostLeaseHost = new hostModule.BoundedShadowOrchestrationHost({ ownerId: "host-lost", maxConcurrency: 1, maxStagesPerRun: 2, leaseDurationMs: 60_000, renewEveryStages: 1 }, lostLeaseHarness.dependencies);
lostLeaseHost.start();
const lost = await lostLeaseHost.run({ job, handlers });
assert.equal(lost.status, "quarantined");
assert.equal(lost.stagesProcessed, 1);
assert.equal(lost.blocker, "shadow_host_lease_renewal_rejected");
assert.equal(lostLeaseHarness.quarantines.length, 1);
await lostLeaseHost.stop();

const concurrencyHarness = createHarness();
let resolveStage;
const gate = new Promise((resolve) => { resolveStage = resolve; });
const gatedHandlers = { ...handlers, ingest: async () => { await gate; return { outputSummary: { accepted: 4 } }; } };
const concurrencyHost = new hostModule.BoundedShadowOrchestrationHost({ ownerId: "host-concurrency", maxConcurrency: 1, maxStagesPerRun: 1, leaseDurationMs: 60_000, renewEveryStages: 1 }, concurrencyHarness.dependencies);
concurrencyHost.start();
const activeRun = concurrencyHost.run({ job, handlers: gatedHandlers });
await Promise.resolve();
assert.equal(concurrencyHost.getActiveCount(), 1);
await assert.rejects(concurrencyHost.run({ job, handlers }), /concurrency limit/);
const stopPromise = concurrencyHost.stop();
assert.equal(concurrencyHost.getState(), "stopping");
await assert.rejects(concurrencyHost.run({ job, handlers }), /not accepting work/);
resolveStage();
const drained = await activeRun;
await stopPromise;
assert.equal(drained.status, "interrupted");
assert.equal(concurrencyHost.getState(), "stopped");

const report = {
  schemaVersion: "gotrader-bt3-bounded-shadow-host-report-v1",
  status: "passed",
  explicitLifecycle: true,
  configurationBounds: true,
  concurrencyBound: true,
  stageBudgetBound: true,
  deterministicRecovery: true,
  cancellationObserved: true,
  leaseLossQuarantined: true,
  gracefulDrain: true,
  schedulerStarted: false,
  mt5Contacted: false,
  authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }
};
fs.mkdirSync(path.join(root, ".gotrader/bt3-bounded-shadow-host"), { recursive: true });
fs.writeFileSync(path.join(root, ".gotrader/bt3-bounded-shadow-host/report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
