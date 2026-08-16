#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRunbookEvidenceStore, RUNBOOK_CHECK_IDS } from "./gotrader-runbook-evidence-core.mjs";

const sourceKinds = {
  aiLabThesisGenerated: "research_cycle_artifact",
  handoffExported: "handoff_receipt",
  savedLatestHandoff: "handoff_receipt",
  readerConversionTested: "reader_receipt",
  schedulerOneCycleCompleted: "scheduler_receipt",
  signalLogged: "signal_receipt",
  brokerExecutionSkipped: "authority_snapshot",
  positionsZero: "position_snapshot",
  tradesZero: "trade_snapshot",
  shutdownComplete: "shutdown_receipt"
};

const digest = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
const root = await fs.mkdtemp(path.join(os.tmpdir(), "gotrader-runbook-evidence-"));

try {
  const store = createRunbookEvidenceStore({ root, now: () => "2026-08-16T01:00:00.000Z" });
  await store.initialize();
  const cycleId = "cycle-source-truth-001";

  await store.archiveLegacy({ checklist: Object.fromEntries(RUNBOOK_CHECK_IDS.map((id) => [id, true])) });
  assert.equal(store.projectCycle(cycleId).completedChecks, 0, "Legacy browser state must not satisfy any check.");

  for (const checkId of RUNBOOK_CHECK_IDS) {
    const result = await store.appendEvidence({
      cycleId,
      checkId,
      observedAt: "2026-08-16T00:59:00.000Z",
      sourceKind: sourceKinds[checkId],
      sourceId: `${cycleId}:${checkId}`,
      sourceDigest: digest(`${cycleId}:${checkId}`),
      profileId: "liquidity_reclaim_scalper_v1_base_research",
      parameterFingerprint: digest("parameters"),
      sourceFingerprint: digest("source")
    });
    assert.equal(result.accepted, true);
  }

  const complete = store.projectCycle(cycleId);
  assert.equal(complete.completedChecks, 10);
  assert.ok(complete.verifiedAt);
  assert.equal(complete.evidenceChainValid, true);
  assert.equal(complete.authority.executionAuthority, "none");

  const coalesced = await store.appendEvidence({
    cycleId,
    checkId: "shutdownComplete",
    observedAt: "2026-08-16T00:59:00.000Z",
    sourceKind: "shutdown_receipt",
    sourceId: `${cycleId}:shutdownComplete`,
    sourceDigest: digest(`${cycleId}:shutdownComplete`)
  });
  assert.equal(coalesced.coalesced, true);

  await assert.rejects(
    store.appendEvidence({
      cycleId,
      checkId: "shutdownComplete",
      observedAt: "2026-08-16T00:59:00.000Z",
      sourceKind: "shutdown_receipt",
      sourceId: `${cycleId}:changed`,
      sourceDigest: digest("changed")
    }),
    /runbook_check_evidence_immutable/
  );

  await assert.rejects(
    store.appendEvidence({
      cycleId: "cycle-other",
      checkId: "schedulerOneCycleCompleted",
      observedAt: "2026-08-16T00:59:00.000Z",
      sourceKind: "research_cycle_artifact",
      sourceId: "wrong-source-kind",
      sourceDigest: digest("wrong")
    }),
    /runbook_source_not_authorized_for_check/
  );

  const reloaded = createRunbookEvidenceStore({ root });
  await reloaded.initialize();
  assert.equal(reloaded.projectCycle(cycleId).completedChecks, 10, "Restart must reproduce the exact projection.");
  assert.equal(reloaded.projectCycle("cycle-other").completedChecks, 0, "Evidence must not cross cycle identities.");

  const storageSource = await fs.readFile(path.join(process.cwd(), "src/lib/simulationRunbook/storage.ts"), "utf8");
  const viewSource = await fs.readFile(path.join(process.cwd(), "src/components/simulation-runbook/SimulationRunbookView.tsx"), "utf8");
  const readinessSource = await fs.readFile(path.join(process.cwd(), "src/lib/readiness/readinessGate.ts"), "utf8");
  assert.match(storageSource, /\/v1\/runbook\/cycles\//);
  assert.match(storageSource, /legacy-archive/);
  assert.doesNotMatch(storageSource, /localStorage\.setItem\(SIMULATION_RUNBOOK_STORAGE_KEY/);
  assert.doesNotMatch(viewSource, /type="checkbox"/);
  assert.match(viewSource, /They cannot be toggled here/);
  assert.match(readinessSource, /runbook\.currentCycleId === currentCycleId/);
  assert.match(readinessSource, /runbook\.evidenceChainValid/);

  console.log(JSON.stringify({
    status: "passed",
    cycleBinding: true,
    immutableEvidence: true,
    restartIntegrity: true,
    legacyTrusted: false,
    browserPortStorageAuthoritative: false,
    authority: "none/none/none"
  }, null, 2));
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
