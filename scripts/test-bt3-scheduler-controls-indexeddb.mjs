#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-scheduler-controls/browser");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/shadowSchedulerIndexedDb.ts"), path.join(root, "src/lib/shadowOrchestration/shadowOrchestrationHost.ts")], outRoot });
fs.writeFileSync(path.join(outRoot, "index.html"), "<!doctype html><title>scheduler controls test</title>");
const server = http.createServer((request, response) => {
  const file = path.join(outRoot, request.url === "/" ? "index.html" : request.url.slice(1));
  if (!file.startsWith(outRoot) || !fs.existsSync(file)) return void response.writeHead(404).end();
  response.writeHead(200, { "Content-Type": file.endsWith(".mjs") ? "text/javascript" : "text/html" }); response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { job } = await buildShadowOrchestrationScenario();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate(async ({ job }) => {
    for (const name of ["gotrader-v2-shadow-scheduler", "gotrader-v2-shadow-orchestration"]) await new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase(name); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
    const scheduler = await import("/shadowScheduler.mjs");
    const storage = await import("/shadowSchedulerIndexedDb.mjs");
    const orchestration = await import("/shadowOrchestrationIndexedDb.mjs");
    const hostModule = await import("/shadowOrchestrationHost.mjs");
    const schedule = await scheduler.buildShadowScheduleDefinition({ logicalJobId: job.logicalJobId, anchorAt: "2026-08-12T21:00:00.000Z", intervalMs: 60_000, maxAttempts: 2, estimatedResourceUnits: 1 });
    const entry = await scheduler.buildShadowScheduleQueueEntry(schedule, "2026-08-12T21:00:00.000Z");
    const repoA = new storage.IndexedDbShadowSchedulerRepository();
    const repoB = new storage.IndexedDbShadowSchedulerRepository();
    const admissions = await Promise.all([repoA.admit(entry, 4), repoB.admit(entry, 4)]);
    const reopened = new storage.IndexedDbShadowSchedulerRepository();
    const queued = await reopened.queued(4);
    const lease = await orchestration.acquirePersistedShadowOrchestrationLease({ logicalJobId: job.logicalJobId, ownerId: "retention-owner", acquiredAt: "2026-08-12T21:00:00.000Z", durationMs: 60_000 });
    const cancellation = await orchestration.requestGuardedShadowOrchestrationCancellation({ logicalJobId: job.logicalJobId, proof: lease.lease, ownerId: "retention-owner", requestedAt: "2026-08-12T21:00:01.000Z", reason: "retention_safety" });
    const hostResult = { hostVersion: "gotrader-v2-bounded-shadow-host-v1", status: "cancelled", logicalJobId: job.logicalJobId, ownerId: "retention-owner", stagesProcessed: 0, activeAtAdmission: 1, checkpointId: "", leaseId: lease.lease.leaseId, blocker: "shadow_job_cancelled", released: false, shadowOnly: true, runtimeAdoptionAllowed: false };
    const receipt = await scheduler.buildShadowDispatchReceipt(entry, hostResult, "2026-08-12T21:00:02.000Z");
    await reopened.settle(entry, receipt);
    const compacted = await reopened.compactSettled(0);
    const receiptCount = await reopened.receiptCount();
    const leaseAfter = await orchestration.loadShadowOrchestrationLease(job.logicalJobId);
    const cancellationAfter = await orchestration.loadShadowOrchestrationCancellation(job.logicalJobId);
    const host = new hostModule.BoundedShadowOrchestrationHost({ ownerId: "retention-owner", maxConcurrency: 1, maxStagesPerRun: 1, leaseDurationMs: 60_000, renewEveryStages: 1 });
    host.start();
    const manual = new scheduler.ManualShadowScheduler({ maxQueueDepth: 2, maxDispatchPerTick: 1, maxResourceUnitsPerTick: 2, retainSettledQueueEntries: 1 }, reopened);
    manual.start();
    const guardedTick = await manual.tick({ evaluatedAt: "2026-08-12T21:01:00.000Z", schedules: [schedule],
      jobs: { [job.logicalJobId]: { job, handlers: { ingest: () => ({ outputSummary: { accepted: 1 } }) } } },
      run: (input) => host.run(input) });
    manual.stop(); await host.stop();
    const snapshotAfterCancellation = await orchestration.loadShadowOrchestrationSnapshot(job.logicalJobId);
    let duplicateSettleRejected = false;
    try { await repoB.settle(entry, receipt); } catch (error) { duplicateSettleRejected = String(error).includes("no longer current"); }
    return { admissions: admissions.sort(), queuedCount: queued.length, compacted, receiptCount,
      leasePreserved: leaseAfter?.leaseId === lease.lease.leaseId,
      cancellationPreserved: cancellationAfter?.cancellationId === cancellation.cancellation?.cancellationId,
      guardedDispatchStatus: guardedTick.dispatched[0]?.resultStatus,
      cancellationBypassPrevented: snapshotAfterCancellation === undefined,
      duplicateSettleRejected };
  }, { job });
  assert.deepEqual(result.admissions, ["admitted", "coalesced"]);
  assert.equal(result.queuedCount, 1);
  assert.equal(result.compacted, 1);
  assert.equal(result.receiptCount, 1);
  assert.equal(result.leasePreserved, true);
  assert.equal(result.cancellationPreserved, true);
  assert.equal(result.guardedDispatchStatus, "cancelled");
  assert.equal(result.cancellationBypassPrevented, true);
  assert.equal(result.duplicateSettleRejected, true);
  const report = { schemaVersion: "gotrader-bt3-scheduler-controls-indexeddb-report-v1", status: "passed",
    concurrentTabCoalescing: true, reopenRecovery: true, atomicSettlement: true,
    immutableReceiptRetention: true, orchestrationEvidencePreserved: true,
    cancellationGuardEnforcedThroughHost: true,
    automaticStartup: false, mt5Contacted: false,
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" } };
  fs.writeFileSync(path.join(root, ".gotrader/bt3-scheduler-controls/indexeddb-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
