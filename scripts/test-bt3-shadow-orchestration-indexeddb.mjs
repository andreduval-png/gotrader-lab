#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-shadow-orchestration/browser");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/shadowOrchestrationIndexedDb.ts")], outRoot });
fs.writeFileSync(path.join(outRoot, "index.html"), "<!doctype html><title>shadow repository test</title>");
const server = http.createServer((request, response) => {
  const file = path.join(outRoot, request.url === "/" ? "index.html" : request.url.slice(1));
  if (!file.startsWith(outRoot) || !fs.existsSync(file)) return void response.writeHead(404).end();
  response.writeHead(200, { "Content-Type": file.endsWith(".mjs") ? "text/javascript" : "text/html" });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const { job, interrupted, scenarios } = await buildShadowOrchestrationScenario();
const terminal = scenarios.uninterrupted;
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  const result = await page.evaluate(async ({ job, interrupted, terminal }) => {
    const dbName = "gotrader-v2-shadow-orchestration";
    const repository = await import("/shadowOrchestrationIndexedDb.mjs");
    const deleteDb = () => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    const mutate = (stores, operation) => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, repository.SHADOW_ORCHESTRATION_DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(stores, "readwrite");
        operation(transaction);
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
    const counts = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, repository.SHADOW_ORCHESTRATION_DB_VERSION);
      request.onsuccess = () => {
        const db = request.result;
        const names = ["jobs", "stage_artifacts", "checkpoints", "terminal_seals", "operator_projections", "job_heads", "leases", "lease_heads", "cancellations", "cancellation_heads", "quarantines"];
        const transaction = db.transaction(names, "readonly");
        const values = {};
        names.forEach((name) => {
          const count = transaction.objectStore(name).count();
          count.onsuccess = () => { values[name] = count.result; };
        });
        transaction.oncomplete = () => { db.close(); resolve(values); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
    await deleteDb();
    const interruptedSnapshot = { job, checkpoint: interrupted.checkpoint, artifacts: interrupted.artifacts };
    const terminalSnapshot = { job, ...terminal };
    const first = await repository.persistShadowOrchestrationSnapshot(interruptedSnapshot);
    const brokenInterrupted = structuredClone(interruptedSnapshot);
    brokenInterrupted.artifacts[1].previousStageArtifactId = brokenInterrupted.artifacts[1].inputArtifactIds[0].replace(/.$/, "0");
    let brokenInterruptedRejected = false;
    try { await repository.persistShadowOrchestrationSnapshot(brokenInterrupted); }
    catch (error) { brokenInterruptedRejected = String(error).includes("identity rejected"); }
    const advanced = await repository.persistShadowOrchestrationSnapshot(terminalSnapshot);
    const repeated = await repository.persistShadowOrchestrationSnapshot(terminalSnapshot);
    const loaded = await repository.loadShadowOrchestrationSnapshot(job.logicalJobId);
    const rebuilt = await repository.rebuildShadowOperatorProjection(job.logicalJobId);

    const poison = structuredClone(job);
    poison.compactInput.fixture = "poison";
    const rollback = await repository.rollbackShadowOrchestrationSnapshot(job.logicalJobId);
    const countsAfterRollback = await counts();
    await mutate(["jobs"], (transaction) => transaction.objectStore("jobs").add(poison));
    let immutableConflictRejected = false;
    try { await repository.persistShadowOrchestrationSnapshot(terminalSnapshot); }
    catch (error) { immutableConflictRejected = String(error).includes("immutable job conflict"); }
    await mutate(["jobs"], (transaction) => transaction.objectStore("jobs").delete(job.logicalJobId));
    await repository.persistShadowOrchestrationSnapshot(terminalSnapshot);
    await mutate(["stage_artifacts"], (transaction) => transaction.objectStore("stage_artifacts").delete(terminal.artifacts[1].stageArtifactId));
    let incompleteChainRejected = false;
    try { await repository.loadShadowOrchestrationSnapshot(job.logicalJobId); }
    catch (error) { incompleteChainRejected = String(error).includes("incomplete"); }
    await repository.rollbackShadowOrchestrationSnapshot(job.logicalJobId).catch(() => undefined);
    await deleteDb();
    return {
      first: first.status,
      advanced: advanced.status,
      repeated: repeated.status,
      loadedArtifactCount: loaded?.artifacts.length ?? 0,
      loadedCheckpointId: loaded?.checkpoint.checkpointId,
      rebuiltProjectionId: rebuilt.projectionId,
      immutableConflictRejected,
      incompleteChainRejected,
      brokenInterruptedRejected,
      rollback,
      countsAfterRollback,
      stores: ["jobs", "stage_artifacts", "checkpoints", "terminal_seals", "operator_projections", "job_heads", "leases", "lease_heads", "cancellations", "cancellation_heads", "quarantines"]
    };
  }, { job, interrupted: { checkpoint: interrupted.checkpoint, artifacts: interrupted.artifacts }, terminal });

  assert.equal(result.first, "persisted");
  assert.equal(result.advanced, "persisted");
  assert.equal(result.repeated, "unchanged");
  assert.equal(result.loadedArtifactCount, 4);
  assert.equal(result.loadedCheckpointId, terminal.checkpoint.checkpointId);
  assert.equal(result.rebuiltProjectionId, terminal.projection.projectionId);
  assert.equal(result.immutableConflictRejected, true);
  assert.equal(result.incompleteChainRejected, true);
  assert.equal(result.brokenInterruptedRejected, true);
  assert.equal(result.rollback.removedArtifactCount, 4);
  assert.deepEqual(result.countsAfterRollback, {
    jobs: 0,
    stage_artifacts: 0,
    checkpoints: 0,
    terminal_seals: 0,
    operator_projections: 0,
    job_heads: 0,
    leases: 0,
    lease_heads: 0,
    cancellations: 0,
    cancellation_heads: 0,
    quarantines: 0
  });
  assert.equal(result.stores.length, 11);
  const report = {
    schemaVersion: "gotrader-bt3-shadow-orchestration-indexeddb-report-v1",
    status: "passed",
    browserIndexedDb: true,
    interruptedToTerminalAdvance: true,
    reopenRecovery: true,
    immutableConflictRejected: true,
    incompleteChainRejected: true,
    interruptedChainTamperRejected: true,
    projectionReproduction: true,
    scopedRollbackPassed: true,
    atomicStoreCount: result.stores.length,
    runtimeIntegrated: false,
    mt5Contacted: false,
    authority: job.authority
  };
  const reportPath = path.join(root, ".gotrader/bt3-shadow-orchestration/indexeddb-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
