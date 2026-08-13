#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildShadowOrchestrationScenario } from "./bt3/generate-shadow-orchestration-fixtures.mjs";
import { buildCanaryConfig, canonicalHash, sealCheckpoint, sealFinalReport } from "./bt3/phase8-operational-canary-core.mjs";

const root = process.cwd();
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? "" : process.argv[index + 1] ?? ""; };
const candidateHead = arg("--candidate-head");
const resumePath = arg("--resume");
const preflightOnly = process.argv.includes("--preflight-only");
const config = buildCanaryConfig({ candidateHead });
const startedAt = resumePath ? JSON.parse(fs.readFileSync(resumePath, "utf8")).startedAt : new Date().toISOString();
const runId = resumePath ? JSON.parse(fs.readFileSync(resumePath, "utf8")).runId : canonicalHash({ candidateHead, configId: config.configId, startedAt });
const runRoot = path.join(root, ".gotrader/bt3-phase8-operational-canary/runs", runId.slice(7));
const profileRoot = path.join(os.tmpdir(), "gotrader-bt3-phase8-canary", runId.slice(7), "browser-profile");
const moduleRoot = path.join(runRoot, "modules");
const checkpointRoot = path.join(runRoot, "checkpoints");
fs.mkdirSync(checkpointRoot, { recursive: true });
compileTypescriptModules({ files: [
  path.join(root, "src/lib/shadowOrchestration/shadowOrchestrationHost.ts"),
  path.join(root, "src/lib/shadowOrchestration/shadowSchedulerIndexedDb.ts"),
  path.join(root, "src/lib/shadowOrchestration/shadowOperatorControlsIndexedDb.ts"),
], outRoot: moduleRoot });
fs.writeFileSync(path.join(moduleRoot, "index.html"), "<!doctype html><title>BT3 Phase 8 canary</title>");
const server = http.createServer((request, response) => {
  const file = path.join(moduleRoot, request.url === "/" ? "index.html" : request.url.slice(1));
  if (!file.startsWith(moduleRoot) || !fs.existsSync(file)) return void response.writeHead(404).end();
  response.writeHead(200, { "Content-Type": file.endsWith(".mjs") ? "text/javascript" : "text/html" }); response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
let context;
const launch = async () => { context = await chromium.launchPersistentContext(profileRoot, { headless: true }); const pages = context.pages(); const page = pages[0] ?? await context.newPage(); await page.goto(url); return page; };
let page = await launch();
const scenario = await buildShadowOrchestrationScenario();
const rollbackBase = await scenario.orchestration.runShadowOrchestration({ job: scenario.job, handlers: scenario.handlers, interruptAfterStages: 2 });
const rollbackInterrupted = await scenario.orchestration.runShadowOrchestration({
  job: scenario.job, handlers: scenario.handlers, repository: rollbackBase.repository,
  checkpoint: rollbackBase.checkpoint, priorArtifacts: rollbackBase.artifacts, interruptAfterStages: 3,
});
const rollbackTerminal = await scenario.orchestration.runShadowOrchestration({
  job: scenario.job, handlers: scenario.handlers, repository: rollbackInterrupted.repository,
  checkpoint: rollbackInterrupted.checkpoint, priorArtifacts: rollbackInterrupted.artifacts,
});
const state = resumePath ? JSON.parse(fs.readFileSync(resumePath, "utf8")) : {
  runId, candidateHead, configId: config.configId, startedAt, sequence: 0, monotonicElapsedMs: 0,
  controlledCancellationObserved: false, browserRestartObserved: false, exercisedContracts: [],
  maxRssBytesObserved: 0, storageBytesObserved: 0, unexpectedFailures: 0, blockers: [], authority: config.authority,
};
if (resumePath) {
  const { validateCheckpoint } = await import("./bt3/phase8-operational-canary-core.mjs");
  if (!validateCheckpoint(state, config)) throw new Error("resume checkpoint integrity is invalid");
}
const processStarted = process.hrtime.bigint();
const processBaseElapsedMs = state.monotonicElapsedMs;
const checkpoint = () => {
  const elapsed = processBaseElapsedMs + Number(process.hrtime.bigint() - processStarted) / 1e6;
  const sealed = sealCheckpoint({ ...state, observedAt: new Date().toISOString(), monotonicElapsedMs: Math.floor(elapsed), maxRssBytesObserved: Math.max(state.maxRssBytesObserved, process.memoryUsage().rss), storageBytesObserved: directoryBytes(runRoot) });
  const file = path.join(checkpointRoot, `${String(sealed.sequence).padStart(4, "0")}-${sealed.integrityHash.slice(7, 19)}.json`);
  fs.writeFileSync(file, `${JSON.stringify(sealed, null, 2)}\n`, { flag: "wx" });
  fs.writeFileSync(path.join(runRoot, "latest.checkpoint.path"), `${file}\n`);
  Object.assign(state, sealed); return sealed;
};

function directoryBytes(directory) { let total = 0; for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const target = path.join(directory, entry.name); total += entry.isDirectory() ? directoryBytes(target) : fs.statSync(target).size; } return total; }

async function exercise(sequence) {
  const logicalJobId = canonicalHash({ runId, sequence });
  return page.evaluate(async ({ logicalJobId, sequence, scenario }) => {
    const db = await import("/shadowOrchestrationIndexedDb.mjs");
    const scheduler = await import("/shadowScheduler.mjs");
    const controls = await import("/shadowOperatorControls.mjs");
    const fallback = await import("/shadowFallbackRollback.mjs");
    const hostModule = await import("/shadowOrchestrationHost.mjs");
    const at = (offset) => new Date(Date.parse("2026-08-13T00:00:00.000Z") + sequence * 600000 + offset).toISOString();
    const lease = await db.acquirePersistedShadowOrchestrationLease({ logicalJobId, ownerId: `canary-${sequence}`, acquiredAt: at(0), durationMs: 60000 });
    const renewed = await db.renewPersistedShadowOrchestrationLease({ logicalJobId, ownerId: `canary-${sequence}`, renewedAt: at(1000), durationMs: 60000 });
    const foreign = await db.requestGuardedShadowOrchestrationCancellation({ logicalJobId, proof: lease.lease, ownerId: "foreign-owner", requestedAt: at(2000), reason: "foreign_owner_probe" });
    const cancellation = await db.requestGuardedShadowOrchestrationCancellation({ logicalJobId, proof: renewed, ownerId: `canary-${sequence}`, requestedAt: at(3000), reason: "controlled_canary_cancellation" });
    const released = await db.releasePersistedShadowOrchestrationLease(logicalJobId, `canary-${sequence}`, at(4000));
    const schedule = await scheduler.buildShadowScheduleDefinition({ logicalJobId, anchorAt: at(0), intervalMs: 60000, maxAttempts: 2, estimatedResourceUnits: 1 });
    const entry = await scheduler.buildShadowScheduleQueueEntry(schedule, at(0));
    const repo = new scheduler.InMemoryShadowSchedulerRepository();
    const admission = [await repo.admit(entry, 4), await repo.admit(entry, 4)];
    const snapshot = await controls.buildShadowOperatorSnapshot({ logicalJobId, observedAt: at(5000), evidenceUpdatedAt: at(4000), staleAfterMs: 60000, schedulerState: "paused", lease: released });
    const command = await controls.buildShadowOperatorCommand({ action: "pause", logicalJobId, operatorId: `canary-${sequence}`, requestedAt: at(5500), reason: "canary_manual_pause" });
    const handlers = Object.fromEntries(["inspect", "tick", "pause", "resume", "stop", "cancel"].map((action) => [action, async () => ({ resultIdentity: snapshot.snapshotId })]));
    const commandResult = await new controls.ManualShadowOperatorController(new controls.InMemoryShadowOperatorCommandRepository(), handlers).execute(command, at(5600));
    let hostResult = { first: "skipped", second: "skipped" };
    if (sequence === 0) {
      const hostHandlers = { ingest: () => ({ outputSummary: { accepted: 4 } }), derive: () => ({ outputSummary: { derived: 4 } }), assess: () => ({ outputSummary: { eligible: true } }), project: () => ({ outputSummary: { projectionRows: 1 } }) };
      const firstHost = new hostModule.BoundedShadowOrchestrationHost({ ownerId: "canary-host-a", maxConcurrency: 1, maxStagesPerRun: 2, leaseDurationMs: 60000, renewEveryStages: 1 });
      firstHost.start(); const first = await firstHost.run({ job: scenario.job, handlers: hostHandlers }); await firstHost.stop();
      const secondHost = new hostModule.BoundedShadowOrchestrationHost({ ownerId: "canary-host-b", maxConcurrency: 1, maxStagesPerRun: 2, leaseDurationMs: 60000, renewEveryStages: 1 });
      secondHost.start(); const second = await secondHost.run({ job: scenario.job, handlers: hostHandlers }); await secondHost.stop();
      hostResult = { first: first.status, second: second.status };
    }
    const interrupted = scenario.interrupted;
    const terminal = scenario.terminal;
    const rollbackLease = `sha256:${"e".repeat(64)}`;
    const preview = await fallback.buildShadowRollbackPreview({ logicalJobId: scenario.job.logicalJobId, currentCheckpointId: terminal.checkpoint.checkpointId, targetCheckpointId: interrupted.checkpoint.checkpointId, checkpoints: [interrupted.checkpoint, terminal.checkpoint], ownerId: "canary-rollback", expectedLeaseId: rollbackLease, observedAt: at(6000), maxDepth: 2, preservedArtifactCount: terminal.artifacts.length });
    const receipt = await fallback.buildShadowRollbackReceipt(preview, at(7000));
    return { lease: lease.status, renewed: renewed.status, foreign: foreign.status, cancellation: cancellation.status, released: released.status, admission, snapshot: snapshot.freshness, command: commandResult.status, host: hostResult, rollback: receipt.status };
  }, { logicalJobId, sequence, scenario: { job: scenario.job, interrupted: { checkpoint: rollbackInterrupted.checkpoint, artifacts: rollbackInterrupted.artifacts }, terminal: { checkpoint: rollbackTerminal.checkpoint, artifacts: rollbackTerminal.artifacts } } });
}

try {
  while (state.monotonicElapsedMs < config.durationMs && state.sequence < config.maxSamples) {
    const result = await exercise(state.sequence);
    if (result.lease !== "acquired" || result.renewed !== "active" || result.foreign !== "quarantined" || result.cancellation !== "persisted" || result.released !== "released" || result.admission.join(",") !== "admitted,coalesced" || result.command !== "succeeded" || (state.sequence === 0 && (result.host.first !== "interrupted" || result.host.second !== "completed")) || result.rollback !== "applied") throw new Error(`contract matrix failed: ${JSON.stringify(result)}`);
    state.controlledCancellationObserved = true;
    state.exercisedContracts = ["orchestration", "checkpoint_recovery", "lease", "cancellation", "quarantine", "bounded_host", "scheduler", "operator", "rollback"];
    state.sequence += 1;
    checkpoint();
    if (preflightOnly) {
      fs.writeFileSync(path.join(runRoot, "preflight-report.json"), `${JSON.stringify({ schemaVersion: "gotrader-bt3-phase8-operational-canary-preflight-v1", status: "passed", runId, candidateHead, configId: config.configId, exercisedContracts: state.exercisedContracts, operationalAcceptanceClaimed: false, authority: config.authority }, null, 2)}\n`, { flag: "wx" });
      break;
    }
    if (!state.browserRestartObserved && state.sequence >= 2) { await context.close(); page = await launch(); state.browserRestartObserved = true; checkpoint(); }
    if (state.monotonicElapsedMs >= config.durationMs) break;
    await new Promise((resolve) => setTimeout(resolve, config.sampleIntervalMs));
  }
  if (preflightOnly) process.exitCode = 0;
  else {
  const finalCheckpoint = checkpoint();
  const report = sealFinalReport(finalCheckpoint, config);
  fs.writeFileSync(path.join(runRoot, "final-report.json"), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  process.exitCode = report.assessment.status === "passed" ? 0 : 2;
  }
} catch (error) {
  state.unexpectedFailures += 1; state.blockers = [...new Set([...state.blockers, error instanceof Error ? error.message : "unknown_canary_failure"])]; checkpoint();
  process.exitCode = 1;
} finally { if (context) await context.close(); await new Promise((resolve) => server.close(resolve)); }
