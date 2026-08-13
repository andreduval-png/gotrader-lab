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
const outRoot = path.join(root, ".gotrader/bt3-terminal-shadow-mirroring/browser");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/researchCycleTerminalShadowMirror.ts")], outRoot });
fs.writeFileSync(path.join(outRoot, "index.html"), "<!doctype html><title>terminal shadow mirror test</title>");
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
  const result = await page.evaluate(async ({ completed, unsafe }) => {
    const dbName = "gotrader-v2-shadow-orchestration";
    const deleteDb = () => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    const counts = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 2);
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
    await deleteDb();
    const mirror = await import("/researchCycleTerminalShadowMirror.mjs");
    const events = [];
    window.addEventListener(mirror.RESEARCH_CYCLE_TERMINAL_SHADOW_EVENT, (event) => events.push(event.detail));
    const before = JSON.stringify(completed);
    const first = await mirror.mirrorTerminalResearchCycleRun(completed);
    const second = await mirror.mirrorTerminalResearchCycleRun(completed);
    const failed = await mirror.mirrorTerminalResearchCycleRun(unsafe);
    const storeCounts = await counts();
    await deleteDb();
    return { before, after: JSON.stringify(completed), first, second, failed, events, storeCounts };
  }, {
    completed: scenarios.completed,
    unsafe: { ...scenarios.completed, cycleId: "synthetic-cycle-unsafe", sourceMetadata: { ...scenarios.completed.sourceMetadata,
      authority: { ...scenarios.completed.sourceMetadata.authority, executionAuthority: "enabled" } } }
  });

  assert.equal(result.before, result.after);
  assert.equal(result.first.status, "mirrored");
  assert.equal(result.second.status, "unchanged");
  assert.equal(result.first.receipt.receiptId, result.second.receipt.receiptId);
  assert.equal(result.first.receipt.legacyResearchCycleAuthoritative, true);
  assert.equal(result.first.receipt.terminalShadowMirroringAllowed, true);
  assert.equal(result.first.receipt.runtimeAdoptionAllowed, false);
  assert.equal(result.failed.status, "failed");
  assert.match(result.failed.error, /authority-none source identity/);
  assert.equal(result.events.length, 3);
  assert.deepEqual(result.storeCounts, {
    jobs: 1,
    stage_artifacts: 11,
    checkpoints: 1,
    terminal_seals: 1,
    operator_projections: 1,
    job_heads: 1
  });
  const cycleSource = fs.readFileSync(path.join(root, "src/lib/researchCycle/runResearchCycle.ts"), "utf8");
  assert.match(cycleSource, /saveResearchCycleRun\(terminalRun\);\s*await mirrorTerminalResearchCycleRun\(compactResearchCycleRun\(terminalRun\)\);/);
  assert.equal((cycleSource.match(/mirrorTerminalResearchCycleRun\(/g) ?? []).length, 1);
  const report = {
    schemaVersion: "gotrader-bt3-terminal-shadow-mirroring-report-v1",
    status: "passed",
    receiptId: result.first.receipt.receiptId,
    logicalJobId: result.first.receipt.logicalJobId,
    terminalSealId: result.first.receipt.terminalSealId,
    projectionId: result.first.receipt.projectionId,
    parityAssessmentId: result.first.receipt.parityAssessmentId,
    receiptHash: `sha256:${crypto.createHash("sha256").update(JSON.stringify(result.first.receipt)).digest("hex")}`,
    terminalOnly: true,
    legacySavedBeforeMirror: true,
    repeatedReceiptStable: true,
    persistedJobHeadCount: result.storeCounts.job_heads,
    invalidInputFailedIsolated: true,
    inputBytesUnchanged: true,
    terminalShadowMirroringAllowed: true,
    runtimeAdoptionAllowed: false,
    mt5Contacted: false,
    authority: result.first.receipt.authority
  };
  const reportPath = path.join(root, ".gotrader/bt3-terminal-shadow-mirroring/report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
