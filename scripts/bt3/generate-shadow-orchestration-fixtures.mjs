#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-shadow-orchestration/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-shadow-orchestration");
const writeMode = process.argv.includes("--write");
const stable = (value) => {
  const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const comparable = (result) => ({
  checkpoint: result.checkpoint,
  artifacts: result.artifacts,
  seal: result.seal,
  projection: result.projection
});

export async function buildShadowOrchestrationScenario() {
  compileTypescriptModules({
    files: [path.join(root, "src/lib/shadowOrchestration/shadowOrchestrationEngine.ts")],
    outRoot
  });
  const orchestration = await import(`${pathToFileURL(path.join(outRoot, "shadowOrchestrationEngine.mjs")).href}?v=${Date.now()}`);
  const inputArtifactId = `sha256:${"1".repeat(64)}`;
  const stages = [
    { stageName: "ingest", stageVersion: "v1", required: true, retryLimit: 0 },
    { stageName: "derive", stageVersion: "v1", required: true, retryLimit: 1 },
    { stageName: "assess", stageVersion: "v1", required: true, retryLimit: 0 },
    { stageName: "project", stageVersion: "v1", required: false, retryLimit: 0 }
  ];
  const job = await orchestration.buildShadowResearchJob({
    jobType: "synthetic_research_fixture",
    jobTypeVersion: "v1",
    inputArtifactIds: [inputArtifactId],
    compactInput: { fixture: "phase-8", sampleCount: 4 },
    stages
  });
  const handlers = {
    ingest: ({ attemptNumber }) => ({ outputSummary: { accepted: 4, attemptNumber } }),
    derive: ({ attemptNumber }) => {
      if (attemptNumber === 1) throw new orchestration.ShadowStageExecutionError("synthetic_transient", true);
      return { outputSummary: { derived: 4, attemptNumber }, warnings: ["retry_recovered"] };
    },
    assess: () => ({ outputSummary: { eligible: true, score: 0.75 } }),
    project: () => ({ outputSummary: { projectionRows: 1 } })
  };

  const uninterrupted = await orchestration.runShadowOrchestration({ job, handlers });
  const interrupted = await orchestration.runShadowOrchestration({ job, handlers, interruptAfterStages: 2 });
  assert.equal(interrupted.interrupted, true);
  const resumed = await orchestration.runShadowOrchestration({
    job,
    handlers,
    repository: interrupted.repository,
    checkpoint: interrupted.checkpoint,
    priorArtifacts: interrupted.artifacts
  });
  assert.deepEqual(comparable(resumed), comparable(uninterrupted));

  const duplicateRepository = new orchestration.InMemoryShadowOrchestrationRepository();
  const duplicateFirst = await orchestration.runShadowOrchestration({ job, handlers, repository: duplicateRepository });
  const duplicateSecond = await orchestration.runShadowOrchestration({
    job,
    handlers,
    repository: duplicateRepository,
    checkpoint: duplicateFirst.checkpoint,
    priorArtifacts: duplicateFirst.artifacts
  });
  assert.deepEqual(comparable(duplicateSecond), comparable(duplicateFirst));

  const blocked = await orchestration.runShadowOrchestration({
    job,
    handlers: { ...handlers, derive: () => ({ status: "blocked", blockers: ["synthetic_policy_block"] }) }
  });
  const failed = await orchestration.runShadowOrchestration({
    job,
    handlers: { ...handlers, derive: () => { throw new orchestration.ShadowStageExecutionError("synthetic_retry_exhausted", true); } }
  });
  const cancelled = await orchestration.runShadowOrchestration({ job, handlers, cancelBeforeStage: 1 });
  const optionalSkipped = await orchestration.runShadowOrchestration({
    job,
    handlers: { ingest: handlers.ingest, derive: handlers.derive, assess: handlers.assess }
  });

  return {
    orchestration,
    job,
    handlers,
    interrupted,
    scenarios: {
      uninterrupted: comparable(uninterrupted),
      resumed: comparable(resumed),
      blocked: comparable(blocked),
      failed: comparable(failed),
      cancelled: comparable(cancelled),
      optionalSkipped: comparable(optionalSkipped)
    }
  };
}

const firstScenario = await buildShadowOrchestrationScenario();
const first = stable({ schemaVersion: "gotrader-bt3-shadow-orchestration-snapshot-v1", payload: firstScenario.scenarios });
const secondScenario = await buildShadowOrchestrationScenario();
const second = stable({ schemaVersion: "gotrader-bt3-shadow-orchestration-snapshot-v1", payload: secondScenario.scenarios });
assert.equal(second, first);
fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "shadow-orchestration.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-shadow-orchestration-hashes-v1", hashes: { "shadow-orchestration.snapshot.json": sha256(first) } });
if (writeMode) {
  fs.writeFileSync(snapshotPath, first, "utf8");
  fs.writeFileSync(hashPath, manifest, "utf8");
} else {
  assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest);
}
console.log(JSON.stringify({
  status: writeMode ? "written" : "passed",
  byteStable: true,
  scenarioCount: Object.keys(firstScenario.scenarios).length,
  snapshotHash: `sha256:${sha256(first)}`,
  logicalJobId: firstScenario.job.logicalJobId,
  mt5Contacted: false
}, null, 2));
