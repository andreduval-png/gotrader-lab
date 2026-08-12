#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-cycle-shadow-adapter/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-cycle-shadow-adapter");
const writeMode = process.argv.includes("--write");
const stable = (value) => {
  const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const ids = ["thesis_generation", "backtest", "auto_research", "validation", "walk_forward", "research_quality",
  "self_improvement", "simulation_verification", "readiness_gate", "llm_advisory", "communications_audit"];
const sourceFingerprint = `sha256:${"4".repeat(64)}`;
const run = (status, statuses, suffix) => ({
  cycleId: `synthetic-cycle-${suffix}`,
  startedAt: "2026-08-12T12:00:00.000Z",
  completedAt: "2026-08-12T12:11:00.000Z",
  status,
  steps: ids.map((stepId, ordinal) => ({ stepId, label: stepId, status: statuses[ordinal], summary: `Synthetic ${stepId} ${statuses[ordinal]}.`,
    ...(statuses[ordinal] === "warning" ? { warning: "Synthetic warning." } : {}), ...(statuses[ordinal] === "failed" ? { error: "Synthetic failure." } : {}) })),
  llmBridgeAvailable: false,
  sourceMetadata: { activeSourceMode: "imported", activeSourceLabel: "Synthetic compact fixture", activeSourceFingerprint: sourceFingerprint,
    candleCount: 100, eligibilityReasons: [], sourceWarnings: [], authority: { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" } },
  ...(status === "failed" ? { failedStepId: ids[statuses.indexOf("failed")], failedStepDetails: "Synthetic failure." } : {}),
  blockers: status === "failed" ? ["synthetic_failure"] : [],
  nextRecommendedAction: "Remain in research-only mode.",
  resultSummary: `Synthetic ${status} cycle.`,
  safetyNotice: "Research cycle only. Broker execution remains disabled."
});

export async function buildResearchCycleShadowAdapterScenario() {
  compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/researchCycleShadowAdapter.ts")], outRoot });
  const adapter = await import(`${pathToFileURL(path.join(outRoot, "researchCycleShadowAdapter.mjs")).href}?v=${Date.now()}`);
  const scenarios = {
    completed: run("completed", ids.map(() => "passed"), "completed"),
    warnings: run("completed_with_warnings", ids.map((_, index) => index === 4 ? "warning" : index === 7 ? "skipped" : "completed"), "warnings"),
    failed: run("failed", ids.map((_, index) => index === 3 ? "failed" : index > 3 ? "skipped" : "passed"), "failed"),
    canceled: run("canceled", ids.map((_, index) => index >= 5 ? "skipped" : "passed"), "canceled")
  };
  const adaptations = {};
  for (const [key, value] of Object.entries(scenarios)) adaptations[key] = await adapter.adaptResearchCycleRunToShadow(value);
  return { adapter, scenarios, adaptations };
}

const firstScenario = await buildResearchCycleShadowAdapterScenario();
const first = stable({ schemaVersion: "gotrader-bt3-cycle-shadow-adapter-snapshot-v1", payload: firstScenario.adaptations });
const secondScenario = await buildResearchCycleShadowAdapterScenario();
const second = stable({ schemaVersion: "gotrader-bt3-cycle-shadow-adapter-snapshot-v1", payload: secondScenario.adaptations });
assert.equal(second, first);
fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "cycle-shadow-adapter.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-cycle-shadow-adapter-hashes-v1", hashes: { "cycle-shadow-adapter.snapshot.json": sha256(first) } });
if (writeMode) { fs.writeFileSync(snapshotPath, first); fs.writeFileSync(hashPath, manifest); }
else { assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first); assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest); }
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, scenarioCount: 4,
  snapshotHash: `sha256:${sha256(first)}`, parityIds: Object.fromEntries(Object.entries(firstScenario.adaptations).map(([key, value]) => [key, value.parity.parityAssessmentId])), mt5Contacted: false }, null, 2));
