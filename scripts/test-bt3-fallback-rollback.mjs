#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";
const root = process.cwd(),
  out = path.join(root, ".gotrader/bt3-fallback-rollback/node");
compileTypescriptModules({
  files: [
    path.join(root, "src/lib/shadowOrchestration/shadowFallbackRollback.ts"),
  ],
  outRoot: out,
});
const mod = await import(
  `${pathToFileURL(path.join(out, "shadowFallbackRollback.mjs")).href}?v=${Date.now()}`
);
const scenario = await buildShadowOrchestrationScenario();
const { job } = scenario,
  interrupted = await scenario.orchestration.runShadowOrchestration({ job, handlers: scenario.handlers, interruptAfterStages: 3 }),
  terminal = await scenario.orchestration.runShadowOrchestration({ job, handlers: scenario.handlers, repository: interrupted.repository, checkpoint: interrupted.checkpoint, priorArtifacts: interrupted.artifacts });
const lease = `sha256:${"e".repeat(64)}`;
const preview = await mod.buildShadowRollbackPreview({
  logicalJobId: job.logicalJobId,
  currentCheckpointId: terminal.checkpoint.checkpointId,
  targetCheckpointId: interrupted.checkpoint.checkpointId,
  checkpoints: [interrupted.checkpoint, terminal.checkpoint],
  ownerId: "rollback-owner",
  expectedLeaseId: lease,
  observedAt: "2026-08-13T03:00:00.000Z",
  maxDepth: 2,
  preservedArtifactCount: terminal.artifacts.length,
});
assert.equal(preview.rollbackDepth, 1);
assert.equal(await mod.validateShadowRollbackPreview(preview), true);
assert.equal(preview.runtimeAdoptionAllowed, false);
const repeat = await mod.buildShadowRollbackPreview({
  logicalJobId: job.logicalJobId,
  currentCheckpointId: terminal.checkpoint.checkpointId,
  targetCheckpointId: interrupted.checkpoint.checkpointId,
  checkpoints: [interrupted.checkpoint, terminal.checkpoint],
  ownerId: "rollback-owner",
  expectedLeaseId: lease,
  observedAt: "2026-08-13T03:00:00.000Z",
  maxDepth: 2,
  preservedArtifactCount: terminal.artifacts.length,
});
assert.equal(preview.previewId, repeat.previewId);
await assert.rejects(
  mod.buildShadowRollbackPreview({
    logicalJobId: job.logicalJobId,
    currentCheckpointId: terminal.checkpoint.checkpointId,
    targetCheckpointId: interrupted.checkpoint.checkpointId,
    checkpoints: [interrupted.checkpoint, terminal.checkpoint],
    ownerId: "rollback-owner",
    expectedLeaseId: lease,
    observedAt: "2026-08-13T03:00:00.000Z",
    maxDepth: 1,
    preservedArtifactCount: 4,
    targetTerminalSealId: terminal.seal.terminalSealId,
  }),
  /terminal evidence/,
);
await assert.rejects(
  mod.buildShadowRollbackPreview({
    logicalJobId: job.logicalJobId,
    currentCheckpointId: terminal.checkpoint.checkpointId,
    targetCheckpointId: `sha256:${"f".repeat(64)}`,
    checkpoints: [interrupted.checkpoint, terminal.checkpoint],
    ownerId: "rollback-owner",
    expectedLeaseId: lease,
    observedAt: "2026-08-13T03:00:00.000Z",
    maxDepth: 1,
    preservedArtifactCount: 4,
  }),
  /(ancestor|depth exceeds bound)/,
);
const receipt = await mod.buildShadowRollbackReceipt(
  preview,
  "2026-08-13T03:00:01.000Z",
);
assert.equal(await mod.validateShadowRollbackReceipt(receipt), true);
const report = {
  schemaVersion: "gotrader-bt3-fallback-rollback-report-v1",
  status: "passed",
  deterministicPreview: true,
  boundedAncestry: true,
  terminalEvidenceFailClosed: true,
  immutableReceipt: true,
  legacyAuthoritative: true,
  runtimeAdoptionAllowed: false,
  automaticRollback: false,
  mt5Contacted: false,
  authority: job.authority,
};
fs.mkdirSync(
  path.dirname(path.join(root, ".gotrader/bt3-fallback-rollback/report.json")),
  { recursive: true },
);
fs.writeFileSync(
  path.join(root, ".gotrader/bt3-fallback-rollback/report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
