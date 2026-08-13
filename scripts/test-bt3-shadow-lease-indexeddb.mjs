#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-shadow-lease/browser");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/shadowOrchestrationIndexedDb.ts")], outRoot });
fs.writeFileSync(path.join(outRoot, "index.html"), "<!doctype html><title>shadow lease test</title>");
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
    const at = "2026-08-12T17:00:00.000Z";
    const [first, second] = await Promise.all([
      repository.acquirePersistedShadowOrchestrationLease({ logicalJobId: job.logicalJobId, ownerId: "browser-a", acquiredAt: at, durationMs: 60_000 }),
      repository.acquirePersistedShadowOrchestrationLease({ logicalJobId: job.logicalJobId, ownerId: "browser-b", acquiredAt: at, durationMs: 60_000 })
    ]);
    const winner = first.status === "acquired" ? first : second;
    const loser = first.status === "blocked" ? first : second;
    await repository.persistShadowOrchestrationSnapshot({ job, checkpoint: interrupted.checkpoint, artifacts: interrupted.artifacts }, {
      proof: winner.lease, ownerId: winner.lease.ownerId, at: "2026-08-12T17:00:10.000Z"
    });
    const reopened = await repository.loadShadowOrchestrationLease(job.logicalJobId);
    const renewed = await repository.renewPersistedShadowOrchestrationLease({ logicalJobId: job.logicalJobId, ownerId: winner.lease.ownerId, renewedAt: "2026-08-12T17:00:20.000Z", durationMs: 60_000 });
    let staleCommitRejected = false;
    try {
      await repository.persistShadowOrchestrationSnapshot({ job, ...terminal }, { proof: winner.lease, ownerId: winner.lease.ownerId, at: "2026-08-12T17:00:21.000Z" });
    } catch (error) { staleCommitRejected = String(error).includes("stale, foreign, or released"); }
    await repository.persistShadowOrchestrationSnapshot({ job, ...terminal }, { proof: renewed, ownerId: renewed.ownerId, at: "2026-08-12T17:00:21.000Z" });
    const released = await repository.releasePersistedShadowOrchestrationLease(job.logicalJobId, renewed.ownerId, "2026-08-12T17:00:22.000Z");
    let releasedCommitRejected = false;
    try {
      await repository.persistShadowOrchestrationSnapshot({ job, ...terminal }, { proof: released, ownerId: released.ownerId, at: "2026-08-12T17:00:23.000Z" });
    } catch (error) { releasedCommitRejected = String(error).includes("stale, foreign, or released"); }
    return { first: first.status, second: second.status, loserBlocker: loser.blocker, winnerOwner: winner.lease.ownerId,
      reopenedLeaseId: reopened?.leaseId, winnerLeaseId: winner.lease.leaseId, renewedEpoch: renewed.epoch,
      staleCommitRejected, releasedCommitRejected };
  }, { job, interrupted: { checkpoint: interrupted.checkpoint, artifacts: interrupted.artifacts }, terminal: scenarios.uninterrupted });
  assert.deepEqual([result.first, result.second].sort(), ["acquired", "blocked"]);
  assert.equal(result.loserBlocker, "shadow_lease_held_by_foreign_owner");
  assert.equal(result.reopenedLeaseId, result.winnerLeaseId);
  assert.equal(result.renewedEpoch, 2);
  assert.equal(result.staleCommitRejected, true);
  assert.equal(result.releasedCommitRejected, true);
  const report = { schemaVersion: "gotrader-bt3-shadow-lease-indexeddb-report-v1", status: "passed", atomicSingleOwner: true,
    reopenPersistence: true, leasedCheckpointCommit: true, staleCommitRejected: true, releasedCommitRejected: true,
    runtimeIntegrated: false, mt5Contacted: false, authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" } };
  fs.writeFileSync(path.join(root, ".gotrader/bt3-shadow-lease/indexeddb-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
