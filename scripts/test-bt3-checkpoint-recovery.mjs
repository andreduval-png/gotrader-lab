#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildResearchCycleShadowAdapterScenario } from "./bt3/generate-research-cycle-shadow-adapter-fixtures.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-checkpoint-recovery/browser");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/researchCycleCheckpointRecovery.ts")], outRoot });
fs.writeFileSync(path.join(outRoot, "index.html"), "<!doctype html><title>checkpoint recovery test</title>");
const server = http.createServer((request, response) => {
  const file = path.join(outRoot, request.url === "/" ? "index.html" : request.url.slice(1));
  if (!file.startsWith(outRoot) || !fs.existsSync(file)) return void response.writeHead(404).end();
  response.writeHead(200, { "Content-Type": file.endsWith(".mjs") ? "text/javascript" : "text/html" });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const { scenarios } = await buildResearchCycleShadowAdapterScenario();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  const result = await page.evaluate(async (terminal) => {
    const dbName = "gotrader-v2-shadow-orchestration";
    const deleteDb = () => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    const counts = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 3);
      request.onsuccess = () => {
        const db = request.result;
        const names = ["jobs", "stage_artifacts", "checkpoints", "terminal_seals", "operator_projections", "job_heads"];
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
    const running = structuredClone(terminal);
    running.status = "running";
    delete running.completedAt;
    running.steps = running.steps.map((step) => ({ ...step, status: "pending", completedAt: undefined }));
    const prefix = (count) => ({ ...structuredClone(running), steps: running.steps.map((step, ordinal) => ordinal < count
      ? { ...step, status: ordinal === 1 ? "warning" : "passed", summary: `Observed ${step.stepId}.`, ...(ordinal === 1 ? { warning: "Synthetic warning." } : {}) }
      : step) });
    await deleteDb();
    const recovery = await import("/researchCycleCheckpointRecovery.mjs");
    const events = [];
    window.addEventListener(recovery.RESEARCH_CYCLE_CHECKPOINT_EVENT, (event) => events.push(event.detail));
    const one = prefix(1);
    const three = prefix(3);
    const bytesBefore = JSON.stringify(three);
    const [first, advanced] = await Promise.all([
      recovery.queueResearchCycleCheckpointObservation(one),
      recovery.queueResearchCycleCheckpointObservation(three)
    ]);
    const repeated = await recovery.queueResearchCycleCheckpointObservation(three);
    const loaded = await recovery.loadResearchCycleCheckpointRecovery(three);
    const nonContiguous = prefix(1);
    nonContiguous.steps[2] = { ...nonContiguous.steps[2], status: "passed", summary: "Out of order." };
    const rejected = await recovery.queueResearchCycleCheckpointObservation(nonContiguous);
    const terminalIgnored = await recovery.queueResearchCycleCheckpointObservation(terminal);
    const storeCounts = await counts();
    await deleteDb();
    return { first, advanced, repeated, loaded, rejected, terminalIgnored, storeCounts, events,
      inputBytesUnchanged: bytesBefore === JSON.stringify(three) };
  }, scenarios.completed);

  assert.equal(result.first.status, "observed");
  assert.equal(result.first.recovery.completedPrefixCount, 1);
  assert.equal(result.advanced.status, "observed");
  assert.equal(result.advanced.recovery.completedPrefixCount, 3);
  assert.equal(result.advanced.recovery.heartbeatSequence, 3);
  assert.equal(result.repeated.status, "unchanged");
  assert.equal(result.repeated.recovery.recoveryDescriptorId, result.advanced.recovery.recoveryDescriptorId);
  assert.deepEqual(result.loaded, result.advanced.recovery);
  assert.equal(result.loaded.recoveryExecutionAllowed, false);
  assert.equal(result.loaded.runtimeAdoptionAllowed, false);
  assert.equal(result.rejected.status, "failed");
  assert.match(result.rejected.error, /non-contiguous completed prefix/);
  assert.equal(result.terminalIgnored.status, "ignored");
  assert.equal(result.terminalIgnored.reason, "terminal_run_uses_terminal_mirror");
  assert.equal(result.inputBytesUnchanged, true);
  assert.equal(result.events.length, 5);
  assert.deepEqual(result.storeCounts, { jobs: 1, stage_artifacts: 3, checkpoints: 2, terminal_seals: 0, operator_projections: 0, job_heads: 1 });
  const cycleSource = fs.readFileSync(path.join(root, "src/lib/researchCycle/runResearchCycle.ts"), "utf8");
  assert.equal((cycleSource.match(/queueResearchCycleCheckpointObservation\(/g) ?? []).length, 2);
  assert.match(cycleSource, /void queueResearchCycleCheckpointObservation\(compactResearchCycleRun\(snapshot\(\)\)\);/);
  const report = {
    schemaVersion: "gotrader-bt3-checkpoint-recovery-report-v1",
    status: "passed",
    recoveryDescriptorId: result.loaded.recoveryDescriptorId,
    logicalJobId: result.loaded.logicalJobId,
    checkpointId: result.loaded.checkpointId,
    reportIdentity: `sha256:${crypto.createHash("sha256").update(JSON.stringify(result.loaded)).digest("hex")}`,
    serializedAdvancement: true,
    duplicateCoalesced: true,
    completedPrefixCount: result.loaded.completedPrefixCount,
    nonContiguousRejected: true,
    terminalPathSeparate: true,
    recoveryExecutionAllowed: false,
    inputBytesUnchanged: true,
    runtimeAdoptionAllowed: false,
    mt5Contacted: false,
    authority: result.loaded.authority
  };
  const reportPath = path.join(root, ".gotrader/bt3-checkpoint-recovery/report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
