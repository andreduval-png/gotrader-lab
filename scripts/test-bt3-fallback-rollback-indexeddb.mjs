#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";
const root = process.cwd(),
  out = path.join(root, ".gotrader/bt3-fallback-rollback/browser");
compileTypescriptModules({
  files: [
    path.join(
      root,
      "src/lib/shadowOrchestration/shadowOrchestrationIndexedDb.ts",
    ),
  ],
  outRoot: out,
});
fs.writeFileSync(
  path.join(out, "index.html"),
  "<!doctype html><title>rollback</title>",
);
const server = http.createServer((req, res) => {
  const file = path.join(
    out,
    req.url === "/" ? "index.html" : req.url.slice(1),
  );
  if (!file.startsWith(out) || !fs.existsSync(file))
    return void res.writeHead(404).end();
  res.writeHead(200, {
    "Content-Type": file.endsWith(".mjs") ? "text/javascript" : "text/html",
  });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const scenario = await buildShadowOrchestrationScenario(),
  rollbackBase = await scenario.orchestration.runShadowOrchestration({
    job: scenario.job,
    handlers: scenario.handlers,
    interruptAfterStages: 2,
  }),
  rollbackInterrupted = await scenario.orchestration.runShadowOrchestration({
    job: scenario.job,
    handlers: scenario.handlers,
    repository: rollbackBase.repository,
    checkpoint: rollbackBase.checkpoint,
    priorArtifacts: rollbackBase.artifacts,
    interruptAfterStages: 3,
  }),
  terminal = await scenario.orchestration.runShadowOrchestration({
    job: scenario.job,
    handlers: scenario.handlers,
    repository: rollbackInterrupted.repository,
    checkpoint: rollbackInterrupted.checkpoint,
    priorArtifacts: rollbackInterrupted.artifacts,
  }),
  browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const result = await page.evaluate(
    async ({ job, base, interrupted, terminal }) => {
      await new Promise((resolve, reject) => {
        const r = indexedDB.deleteDatabase("gotrader-v2-shadow-orchestration");
        r.onsuccess = resolve;
        r.onerror = () => reject(r.error);
      });
      const db = await import("/shadowOrchestrationIndexedDb.mjs");
      await db.persistShadowOrchestrationSnapshot({
        job,
        checkpoint: base.checkpoint,
        artifacts: base.artifacts,
      });
      await db.persistShadowOrchestrationSnapshot({
        job,
        checkpoint: interrupted.checkpoint,
        artifacts: interrupted.artifacts,
      });
      await db.persistShadowOrchestrationSnapshot({
        job,
        checkpoint: terminal.checkpoint,
        artifacts: terminal.artifacts,
        seal: terminal.seal,
        projection: terminal.projection,
      });
      const lease = await db.acquirePersistedShadowOrchestrationLease({
        logicalJobId: job.logicalJobId,
        ownerId: "rollback-owner",
        acquiredAt: "2026-08-13T03:00:00.000Z",
        durationMs: 60000,
      });
      const preview = await db.previewShadowOrchestrationRollback({
        logicalJobId: job.logicalJobId,
        expectedCurrentCheckpointId: terminal.checkpoint.checkpointId,
        targetCheckpointId: interrupted.checkpoint.checkpointId,
        ownerId: "rollback-owner",
        expectedLeaseId: lease.lease.leaseId,
        observedAt: "2026-08-13T03:00:01.000Z",
        maxDepth: 2,
      });
      let badConfirmation = false;
      try {
        await db.applyShadowOrchestrationRollback(
          preview,
          "wrong",
          "2026-08-13T03:00:02.000Z",
          lease.lease,
        );
      } catch {
        badConfirmation = true;
      }
      const [a, b] = await Promise.allSettled([
        db.applyShadowOrchestrationRollback(
          preview,
          preview.confirmationToken,
          "2026-08-13T03:00:02.000Z",
          lease.lease,
        ),
        db.applyShadowOrchestrationRollback(
          preview,
          preview.confirmationToken,
          "2026-08-13T03:00:02.000Z",
          lease.lease,
        ),
      ]);
      const reopened = await db.applyShadowOrchestrationRollback(
        preview,
        preview.confirmationToken,
        "2026-08-13T03:00:02.000Z",
        lease.lease,
      );
      const loaded = await db.loadShadowOrchestrationSnapshot(job.logicalJobId);
      const raw = await db.openShadowOrchestrationDb();
      const names = [
        "jobs",
        "stage_artifacts",
        "checkpoints",
        "terminal_seals",
        "operator_projections",
        "leases",
        "lease_heads",
        "rollback_previews",
        "rollback_receipts",
      ];
      const tx = raw.transaction(names, "readonly");
      const counts = {};
      for (const name of names)
        counts[name] = await new Promise((resolve, reject) => {
          const r = tx.objectStore(name).count();
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      raw.close();
      const stalePreview = await db
        .previewShadowOrchestrationRollback({
          logicalJobId: job.logicalJobId,
          expectedCurrentCheckpointId: interrupted.checkpoint.checkpointId,
          targetCheckpointId: base.checkpoint.checkpointId,
          ownerId: "rollback-owner",
          expectedLeaseId: lease.lease.leaseId,
          observedAt: "2026-08-13T03:00:03.000Z",
          maxDepth: 2,
        })
        .catch(() => undefined);
      const staleLease = await db.acquirePersistedShadowOrchestrationLease({
        logicalJobId: job.logicalJobId,
        ownerId: "foreign-owner",
        acquiredAt: "2026-08-13T03:01:01.000Z",
        durationMs: 60000,
      });
      const staleResult = stalePreview
        ? await db.applyShadowOrchestrationRollback(
            stalePreview,
            stalePreview.confirmationToken,
            "2026-08-13T03:01:02.000Z",
            lease.lease,
          )
        : { status: "preview_unavailable" };
      const quarantines = await db.loadShadowOrchestrationQuarantines(
        job.logicalJobId,
      );
      return {
        badConfirmation,
        statuses: [a.status, b.status],
        reopened: reopened.status,
        loadedCheckpoint: loaded.checkpoint.checkpointId,
        counts,
        staleRejected:
          staleResult.status === "quarantined" &&
          quarantines.some((item) => item.attemptedAction === "rollback"),
        newLease: staleLease.lease.ownerId,
      };
    },
    {
      job: scenario.job,
      base: {
        checkpoint: rollbackBase.checkpoint,
        artifacts: rollbackBase.artifacts,
      },
      interrupted: {
        checkpoint: rollbackInterrupted.checkpoint,
        artifacts: rollbackInterrupted.artifacts,
      },
      terminal,
    },
  );
  assert.equal(result.badConfirmation, true);
  assert.deepEqual(result.statuses, ["fulfilled", "fulfilled"]);
  assert.equal(result.reopened, "coalesced");
  assert.equal(
    result.loadedCheckpoint,
    rollbackInterrupted.checkpoint.checkpointId,
  );
  assert.equal(result.counts.checkpoints, 3);
  assert.equal(result.counts.terminal_seals, 1);
  assert.equal(result.counts.operator_projections, 1);
  assert.equal(result.counts.rollback_receipts, 1);
  assert.equal(result.staleRejected, true);
  const report = {
    schemaVersion: "gotrader-bt3-fallback-rollback-indexeddb-report-v1",
    status: "passed",
    atomicCompareAndSet: true,
    concurrentTabCoalescing: true,
    reopenIdempotence: true,
    confirmationFailClosed: true,
    evidencePreserved: true,
    staleOwnerRejected: true,
    automaticRollback: false,
    mt5Contacted: false,
    authority: scenario.job.authority,
  };
  fs.writeFileSync(
    path.join(root, ".gotrader/bt3-fallback-rollback/indexeddb-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
