#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-scheduler-controls/node");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/shadowScheduler.ts")], outRoot });
const schedulerModule = await import(`${pathToFileURL(path.join(outRoot, "shadowScheduler.mjs")).href}?v=${Date.now()}`);
const { job, handlers } = await buildShadowOrchestrationScenario();

const schedule = await schedulerModule.buildShadowScheduleDefinition({
  logicalJobId: job.logicalJobId,
  anchorAt: "2026-08-12T20:00:00.000Z",
  intervalMs: 60_000,
  maxAttempts: 3,
  estimatedResourceUnits: 4
});
assert.equal(schedulerModule.resolveShadowScheduleDueAt(schedule, "2026-08-12T19:59:59.999Z"), undefined);
assert.equal(schedulerModule.resolveShadowScheduleDueAt(schedule, "2026-08-12T20:02:45.000Z"), "2026-08-12T20:02:00.000Z");
assert.equal(await schedulerModule.validateShadowScheduleDefinition(schedule), true);
assert.equal(await schedulerModule.validateShadowScheduleDefinition({ ...schedule, intervalMs: 120_000 }), false);
assert.throws(() => new schedulerModule.ManualShadowScheduler({ maxQueueDepth: 0, maxDispatchPerTick: 1, maxResourceUnitsPerTick: 1, retainSettledQueueEntries: 0 }, new schedulerModule.InMemoryShadowSchedulerRepository()), /queue depth/);

const resultFor = (status, input, attempt = 1) => ({
  hostVersion: "gotrader-v2-bounded-shadow-host-v1",
  status,
  logicalJobId: input.job.logicalJobId,
  ownerId: "scheduler-test",
  stagesProcessed: status === "completed" ? 2 : 0,
  activeAtAdmission: 1,
  checkpointId: status === "completed" ? `sha256:${"c".repeat(64)}` : "",
  leaseId: `sha256:${String(attempt).repeat(64).slice(0, 64)}`,
  ...(status === "lease_blocked" ? { blocker: "shadow_lease_held_by_foreign_owner" } : {}),
  released: status === "completed",
  shadowOnly: true,
  runtimeAdoptionAllowed: false
});

const repository = new schedulerModule.InMemoryShadowSchedulerRepository();
const scheduler = new schedulerModule.ManualShadowScheduler({ maxQueueDepth: 2, maxDispatchPerTick: 1, maxResourceUnitsPerTick: 4, retainSettledQueueEntries: 1 }, repository);
scheduler.start();
scheduler.pause();
await assert.rejects(scheduler.tick({ evaluatedAt: "2026-08-12T20:02:00.000Z", schedules: [schedule], jobs: {}, run: async () => resultFor("completed", { job }) }), /not running/);
scheduler.resume();
let attempts = 0;
const run = async (input) => resultFor(++attempts < 3 ? "lease_blocked" : "completed", input, attempts);
const registrations = { [job.logicalJobId]: { job, handlers } };
const first = await scheduler.tick({ evaluatedAt: "2026-08-12T20:02:00.000Z", schedules: [schedule, schedule], jobs: registrations, run });
assert.deepEqual([...first.admission].sort(), ["admitted", "coalesced"]);
assert.equal(first.dispatched.length, 1);
assert.equal(first.dispatched[0].attemptNumber, 1);
const second = await scheduler.tick({ evaluatedAt: "2026-08-12T20:02:00.000Z", schedules: [schedule], jobs: registrations, run });
assert.equal(second.dispatched[0].attemptNumber, 2);
const third = await scheduler.tick({ evaluatedAt: "2026-08-12T20:02:00.000Z", schedules: [schedule], jobs: registrations, run });
assert.equal(third.dispatched[0].attemptNumber, 3);
assert.equal(third.dispatched[0].resultStatus, "completed");
assert.equal([...repository.entries.values()].filter((entry) => entry.status === "queued").length, 0);
assert.equal(repository.receipts.size, 3);

const resourceRepository = new schedulerModule.InMemoryShadowSchedulerRepository();
const resourceScheduler = new schedulerModule.ManualShadowScheduler({ maxQueueDepth: 1, maxDispatchPerTick: 1, maxResourceUnitsPerTick: 3, retainSettledQueueEntries: 0 }, resourceRepository);
resourceScheduler.start();
let resourceRuns = 0;
const pressured = await resourceScheduler.tick({ evaluatedAt: "2026-08-12T20:03:00.000Z", schedules: [schedule], jobs: registrations, run: async (input) => { resourceRuns += 1; return resultFor("completed", input); } });
assert.equal(pressured.resourceUnits, 0);
assert.equal(pressured.dispatched.length, 0);
assert.equal(resourceRuns, 0);

const queueRepository = new schedulerModule.InMemoryShadowSchedulerRepository();
const dueAt = schedulerModule.resolveShadowScheduleDueAt(schedule, "2026-08-12T20:04:00.000Z");
const firstEntry = await schedulerModule.buildShadowScheduleQueueEntry(schedule, dueAt);
assert.equal(await queueRepository.admit(firstEntry, 1), "admitted");
const secondSchedule = await schedulerModule.buildShadowScheduleDefinition({ ...schedule, logicalJobId: `sha256:${"b".repeat(64)}` });
const secondEntry = await schedulerModule.buildShadowScheduleQueueEntry(secondSchedule, dueAt);
assert.equal(await queueRepository.admit(secondEntry, 1), "queue_full");
await assert.rejects(queueRepository.admit({ ...firstEntry, estimatedResourceUnits: 9 }, 1), /identity rejected/);

scheduler.stop();
await assert.rejects(scheduler.tick({ evaluatedAt: "2026-08-12T20:05:00.000Z", schedules: [schedule], jobs: registrations, run }), /not running/);
assert.throws(() => scheduler.resume(), /paused/);

const report = {
  schemaVersion: "gotrader-bt3-scheduler-controls-report-v1",
  status: "passed",
  deterministicDueTime: true,
  logicalJobCoalescing: true,
  queueBound: true,
  dispatchBound: true,
  resourceBackpressure: true,
  boundedRetryExhaustion: true,
  immutableIdentityValidation: true,
  pauseResumeStop: true,
  automaticStartup: false,
  mt5Contacted: false,
  authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }
};
fs.mkdirSync(path.join(root, ".gotrader/bt3-scheduler-controls"), { recursive: true });
fs.writeFileSync(path.join(root, ".gotrader/bt3-scheduler-controls/report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
