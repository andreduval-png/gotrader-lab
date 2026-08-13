#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-stale-owner-quarantine/browser");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/shadowOrchestrationIndexedDb.ts")], outRoot });
fs.writeFileSync(path.join(outRoot, "index.html"), "<!doctype html><title>stale owner quarantine test</title>");
const server = http.createServer((request, response) => {
  const file = path.join(outRoot, request.url === "/" ? "index.html" : request.url.slice(1));
  if (!file.startsWith(outRoot) || !fs.existsSync(file)) return void response.writeHead(404).end();
  response.writeHead(200, { "Content-Type": file.endsWith(".mjs") ? "text/javascript" : "text/html" });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { job, interrupted, scenarios } = await buildShadowOrchestrationScenario();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate(async ({ job, interrupted, terminal }) => {
    const dbName = "gotrader-v2-shadow-orchestration";
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    const repository = await import("/shadowOrchestrationIndexedDb.mjs");
    const leaseA = await repository.acquirePersistedShadowOrchestrationLease({
      logicalJobId: job.logicalJobId, ownerId: "owner-a", acquiredAt: "2026-08-12T18:00:00.000Z", durationMs: 60_000
    });
    const initial = await repository.persistGuardedShadowOrchestrationSnapshot(
      { job, checkpoint: interrupted.checkpoint, artifacts: interrupted.artifacts },
      { proof: leaseA.lease, ownerId: "owner-a", at: "2026-08-12T18:00:10.000Z", attemptedAction: "checkpoint_advance" }
    );
    const cancelled = await repository.requestGuardedShadowOrchestrationCancellation({
      logicalJobId: job.logicalJobId, proof: leaseA.lease, ownerId: "owner-a",
      requestedAt: "2026-08-12T18:00:20.000Z", reason: "operator_requested_stop"
    });
    const repeated = await repository.requestGuardedShadowOrchestrationCancellation({
      logicalJobId: job.logicalJobId, proof: leaseA.lease, ownerId: "owner-a",
      requestedAt: "2026-08-12T18:00:20.000Z", reason: "operator_requested_stop"
    });
    const cancelledAdvance = await repository.persistGuardedShadowOrchestrationSnapshot(
      { job, ...terminal },
      { proof: leaseA.lease, ownerId: "owner-a", at: "2026-08-12T18:00:21.000Z", attemptedAction: "terminal_seal" }
    );
    const released = await repository.releasePersistedShadowOrchestrationLease(job.logicalJobId, "owner-a", "2026-08-12T18:00:22.000Z");
    const leaseB = await repository.acquirePersistedShadowOrchestrationLease({
      logicalJobId: job.logicalJobId, ownerId: "owner-b", acquiredAt: "2026-08-12T18:00:23.000Z", durationMs: 60_000
    });
    const staleAdvance = await repository.persistGuardedShadowOrchestrationSnapshot(
      { job, ...terminal },
      { proof: leaseA.lease, ownerId: "owner-a", at: "2026-08-12T18:00:24.000Z", attemptedAction: "terminal_seal" }
    );
    const staleCancel = await repository.requestGuardedShadowOrchestrationCancellation({
      logicalJobId: job.logicalJobId, proof: leaseA.lease, ownerId: "owner-a",
      requestedAt: "2026-08-12T18:00:25.000Z", reason: "stale_owner_stop"
    });
    const snapshot = await repository.loadShadowOrchestrationSnapshot(job.logicalJobId);
    const cancellation = await repository.loadShadowOrchestrationCancellation(job.logicalJobId);
    return {
      initial: initial.status,
      cancelled: cancelled.status,
      repeated: repeated.status,
      cancelledAdvance: cancelledAdvance.status,
      cancelledBlocker: cancelledAdvance.blocker,
      staleAdvance: staleAdvance.status,
      staleAdvanceBlocker: staleAdvance.blocker,
      staleCancel: staleCancel.status,
      staleCancelBlocker: staleCancel.blocker,
      snapshotCheckpointId: snapshot?.checkpoint.checkpointId,
      initialCheckpointId: interrupted.checkpoint.checkpointId,
      cancellationId: cancellation?.cancellationId,
      acceptedCancellationId: cancelled.cancellation?.cancellationId,
      releasedStatus: released.status,
      takeoverOwner: leaseB.lease.ownerId
    };
  }, { job, interrupted: { checkpoint: interrupted.checkpoint, artifacts: interrupted.artifacts }, terminal: scenarios.uninterrupted });

  assert.equal(result.initial, "persisted");
  assert.equal(result.cancelled, "persisted");
  assert.equal(result.repeated, "coalesced");
  assert.equal(result.cancelledAdvance, "quarantined");
  assert.equal(result.cancelledBlocker, "shadow_job_cancelled");
  assert.equal(result.staleAdvance, "quarantined");
  assert.equal(result.staleAdvanceBlocker, "shadow_lease_foreign_owner");
  assert.equal(result.staleCancel, "quarantined");
  assert.equal(result.staleCancelBlocker, "shadow_lease_foreign_owner");
  assert.equal(result.snapshotCheckpointId, result.initialCheckpointId);
  assert.equal(result.cancellationId, result.acceptedCancellationId);
  assert.equal(result.releasedStatus, "released");
  assert.equal(result.takeoverOwner, "owner-b");

  const report = {
    schemaVersion: "gotrader-bt3-stale-owner-quarantine-report-v1",
    status: "passed",
    cancellationOwnerBound: true,
    cancellationIdempotent: true,
    cancelledAdvanceQuarantined: true,
    staleAdvanceQuarantined: true,
    staleCancellationQuarantined: true,
    snapshotHeadUnchanged: true,
    workerStarted: false,
    schedulerStarted: false,
    mt5Contacted: false,
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }
  };
  fs.mkdirSync(path.join(root, ".gotrader/bt3-stale-owner-quarantine"), { recursive: true });
  fs.writeFileSync(path.join(root, ".gotrader/bt3-stale-owner-quarantine/report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
