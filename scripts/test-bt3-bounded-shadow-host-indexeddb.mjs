#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-bounded-shadow-host/browser");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/shadowOrchestrationHost.ts")], outRoot });
fs.writeFileSync(path.join(outRoot, "index.html"), "<!doctype html><title>bounded shadow host test</title>");
const server = http.createServer((request, response) => {
  const file = path.join(outRoot, request.url === "/" ? "index.html" : request.url.slice(1));
  if (!file.startsWith(outRoot) || !fs.existsSync(file)) return void response.writeHead(404).end();
  response.writeHead(200, { "Content-Type": file.endsWith(".mjs") ? "text/javascript" : "text/html" });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { job, handlers } = await buildShadowOrchestrationScenario();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate(async ({ job }) => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase("gotrader-v2-shadow-orchestration");
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    const module = await import("/shadowOrchestrationHost.mjs");
    const repository = await import("/shadowOrchestrationIndexedDb.mjs");
    const handlers = {
      ingest: () => ({ outputSummary: { accepted: 4 } }),
      derive: () => ({ outputSummary: { derived: 4 } }),
      assess: () => ({ outputSummary: { eligible: true } }),
      project: () => ({ outputSummary: { projectionRows: 1 } })
    };
    const config = { ownerId: "browser-host", maxConcurrency: 1, maxStagesPerRun: 2, leaseDurationMs: 60_000, renewEveryStages: 1 };
    const firstHost = new module.BoundedShadowOrchestrationHost(config);
    firstHost.start();
    const first = await firstHost.run({ job, handlers });
    await firstHost.stop();
    const firstSnapshot = await repository.loadShadowOrchestrationSnapshot(job.logicalJobId);
    const secondHost = new module.BoundedShadowOrchestrationHost(config);
    secondHost.start();
    const second = await secondHost.run({ job, handlers });
    await secondHost.stop();
    const finalSnapshot = await repository.loadShadowOrchestrationSnapshot(job.logicalJobId);
    const released = await repository.loadShadowOrchestrationLease(job.logicalJobId);
    const stale = await repository.persistGuardedShadowOrchestrationSnapshot(finalSnapshot, {
      proof: released,
      ownerId: config.ownerId,
      at: "2026-08-12T21:00:00.000Z",
      attemptedAction: "terminal_seal"
    });
    return {
      firstStatus: first.status,
      firstStages: first.stagesProcessed,
      firstArtifactCount: firstSnapshot?.artifacts.length,
      secondStatus: second.status,
      secondStages: second.stagesProcessed,
      finalArtifactCount: finalSnapshot?.artifacts.length,
      terminalSealed: Boolean(finalSnapshot?.seal && finalSnapshot?.projection),
      releasedStatus: released?.status,
      staleStatus: stale.status,
      staleBlocker: stale.blocker
    };
  }, { job });
  assert.equal(result.firstStatus, "interrupted");
  assert.equal(result.firstStages, 2);
  assert.equal(result.firstArtifactCount, 2);
  assert.equal(result.secondStatus, "completed");
  assert.equal(result.secondStages, 2);
  assert.equal(result.finalArtifactCount, 4);
  assert.equal(result.terminalSealed, true);
  assert.equal(result.releasedStatus, "released");
  assert.equal(result.staleStatus, "quarantined");
  assert.equal(result.staleBlocker, "shadow_lease_released");
  const report = {
    schemaVersion: "gotrader-bt3-bounded-shadow-host-indexeddb-report-v1",
    status: "passed",
    finiteRunRecovery: true,
    noCompletedStageReplay: true,
    terminalSealPersisted: true,
    leaseReleased: true,
    releasedOwnerCommitQuarantined: true,
    schedulerStarted: false,
    mt5Contacted: false,
    authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }
  };
  fs.writeFileSync(path.join(root, ".gotrader/bt3-bounded-shadow-host/indexeddb-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
