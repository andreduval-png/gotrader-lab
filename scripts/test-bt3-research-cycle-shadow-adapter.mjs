#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildResearchCycleShadowAdapterScenario } from "./bt3/generate-research-cycle-shadow-adapter-fixtures.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "tests/fixtures/bt3-cycle-shadow-adapter");
const snapshotText = fs.readFileSync(path.join(fixtureRoot, "cycle-shadow-adapter.snapshot.json"), "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "snapshot-hashes.json"), "utf8"));
assert.equal(crypto.createHash("sha256").update(snapshotText).digest("hex"), manifest.hashes["cycle-shadow-adapter.snapshot.json"]);
const snapshot = JSON.parse(snapshotText);
const { adapter, scenarios, adaptations } = await buildResearchCycleShadowAdapterScenario();
assert.deepEqual(adaptations, snapshot.payload);
for (const [key, adaptation] of Object.entries(adaptations)) {
  assert.equal(await adapter.validateResearchCycleShadowAdaptation(scenarios[key], adaptation), true);
  assert.equal(adaptation.parity.legacyResearchCycleAuthoritative, true);
  assert.equal(adaptation.parity.automaticMirroringAllowed, false);
}
assert.equal(adaptations.completed.seal.terminalStatus, "completed");
assert.equal(adaptations.warnings.seal.terminalStatus, "completed");
assert.equal(adaptations.warnings.artifacts[4].warnings[0], "legacy_step_warning_walk_forward");
assert.equal(adaptations.failed.seal.terminalStatus, "failed");
assert.equal(adaptations.failed.artifacts[3].status, "failed");
assert.equal(adaptations.canceled.seal.terminalStatus, "cancelled");
assert.equal(adaptations.canceled.artifacts[5].status, "cancelled");

const originalBytes = JSON.stringify(scenarios.completed);
await adapter.adaptResearchCycleRunToShadow(scenarios.completed);
assert.equal(JSON.stringify(scenarios.completed), originalBytes);
const reordered = structuredClone(scenarios.completed);
[reordered.steps[0], reordered.steps[1]] = [reordered.steps[1], reordered.steps[0]];
await assert.rejects(adapter.adaptResearchCycleRunToShadow(reordered), /step order mismatch/);
const running = structuredClone(scenarios.completed); running.status = "running";
await assert.rejects(adapter.adaptResearchCycleRunToShadow(running), /terminal identified run/);
const pending = structuredClone(scenarios.completed); pending.steps[2].status = "pending";
await assert.rejects(adapter.adaptResearchCycleRunToShadow(pending), /non-terminal legacy steps/);
const unsafeAuthority = structuredClone(scenarios.completed); unsafeAuthority.sourceMetadata.authority.executionAuthority = "enabled";
await assert.rejects(adapter.adaptResearchCycleRunToShadow(unsafeAuthority), /authority-none source identity/);
const inconsistentFailure = structuredClone(scenarios.failed); inconsistentFailure.failedStepId = "backtest";
await assert.rejects(adapter.adaptResearchCycleRunToShadow(inconsistentFailure), /failed status is inconsistent/);
const tampered = structuredClone(adaptations.completed); tampered.parity.statusParity = false;
assert.equal(await adapter.validateResearchCycleShadowAdaptation(scenarios.completed, tampered), false);
const blockerChanged = structuredClone(scenarios.completed); blockerChanged.blockers = ["new_compact_blocker"];
const blockerAdaptation = await adapter.adaptResearchCycleRunToShadow(blockerChanged);
assert.notEqual(blockerAdaptation.legacyCycleIdentity, adaptations.completed.legacyCycleIdentity);
const serialized = JSON.stringify(adaptations);
for (const forbidden of ["rawCandles", "accountNumber", "orderId", "positionId", "brokerMutation", "executionIntent"]) assert.equal(serialized.includes(forbidden), false);

const report = { schemaVersion: "gotrader-bt3-research-cycle-shadow-adapter-report-v1", status: "passed",
  snapshotHash: `sha256:${crypto.createHash("sha256").update(snapshotText).digest("hex")}`, scenarioCount: 4,
  exactLegacyStepOrder: true, terminalStatusParity: true, inputBytesUnchanged: true, negativeCasesFailClosed: true,
  automaticMirroringAllowed: false, runtimeIntegrated: false, mt5Contacted: false, authority: adaptations.completed.parity.authority };
const reportPath = path.join(root, ".gotrader/bt3-cycle-shadow-adapter/report.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
