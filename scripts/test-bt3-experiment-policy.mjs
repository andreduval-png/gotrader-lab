#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildExperimentPolicyScenario } from "./bt3/generate-experiment-policy-fixtures.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "tests/fixtures/bt3-experiment-policy");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const snapshotText = text(path.join(fixtureRoot, "experiment-policy.snapshot.json"));
const snapshot = JSON.parse(snapshotText);
const hashManifest = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json")));
assert.equal(sha256(snapshotText), hashManifest.hashes["experiment-policy.snapshot.json"]);

const { policy, scenarios } = await buildExperimentPolicyScenario();
assert.deepEqual(scenarios, snapshot.payload);
for (const scenario of Object.values(scenarios)) {
  assert.deepEqual(await policy.validateControlledExperimentRegistration(scenario.registration), []);
  assert.deepEqual(await policy.validateMultipleComparisonAssessment(scenario.assessment, scenario.registration, scenario.trials), []);
  assert.equal(scenario.assessment.familyComplete, true);
  assert.equal(scenario.assessment.researchOnly, true);
  assert.equal(scenario.assessment.automaticSelectionAllowed, false);
  assert.equal(scenario.assessment.automaticPromotionAllowed, false);
  assert.ok(scenario.assessment.diagnostics.every((diagnostic) => diagnostic.applicability === "not_applicable"));
  const qValues = scenario.assessment.results.map((result) => result.benjaminiHochberg.adjustedQValue);
  const holmValues = scenario.assessment.results.map((result) => result.holm.adjustedPValue);
  assert.deepEqual(qValues, [...qValues].sort((left, right) => left - right));
  assert.deepEqual(holmValues, [...holmValues].sort((left, right) => left - right));
}

assert.deepEqual(scenarios.partial_reject.assessment.results.map((result) => ({
  p: result.rawPValue,
  bh: result.benjaminiHochberg.adjustedQValue,
  bhRejected: result.benjaminiHochberg.rejected,
  holm: result.holm.adjustedPValue,
  holmRejected: result.holm.rejected,
  bonferroni: result.bonferroni.adjustedPValue,
  bonferroniRejected: result.bonferroni.rejected
})), [
  { p: 0.001, bh: 0.004, bhRejected: true, holm: 0.004, holmRejected: true, bonferroni: 0.004, bonferroniRejected: true },
  { p: 0.01, bh: 0.02, bhRejected: true, holm: 0.03, holmRejected: true, bonferroni: 0.04, bonferroniRejected: true },
  { p: 0.03, bh: 0.04, bhRejected: true, holm: 0.06, holmRejected: false, bonferroni: 0.12, bonferroniRejected: false },
  { p: 0.2, bh: 0.2, bhRejected: false, holm: 0.2, holmRejected: false, bonferroni: 0.8, bonferroniRejected: false }
]);
assert.ok(scenarios.all_reject.assessment.results.every((result) => result.benjaminiHochberg.rejected && result.holm.rejected && result.bonferroni.rejected));
assert.ok(scenarios.no_reject.assessment.results.every((result) => !result.benjaminiHochberg.rejected && !result.holm.rejected && !result.bonferroni.rejected));
assert.deepEqual(scenarios.ties_and_boundaries.assessment.results.slice(1, 3).map((result) => result.candidateId), ["ties-boundaries-candidate-02", "ties-boundaries-candidate-03"]);

const orderScenario = scenarios.partial_reject;
const reversed = await policy.assessMultipleComparisons(orderScenario.registration, [...orderScenario.trials].reverse());
assert.deepEqual(reversed, orderScenario.assessment);
const tamperedRegistration = structuredClone(orderScenario.registration);
tamperedRegistration.alpha = 0.1;
assert.deepEqual(await policy.validateControlledExperimentRegistration(tamperedRegistration), ["experiment_registration_identity_invalid"]);
const unknownSchema = structuredClone(orderScenario.registration);
unknownSchema.schemaVersion = "unknown";
assert.deepEqual(await policy.validateControlledExperimentRegistration(unknownSchema), ["experiment_registration_identity_invalid", "experiment_registration_schema_unsupported"]);
const unknownMethod = structuredClone(orderScenario.registration);
unknownMethod.methods[0] = "unknown";
assert.deepEqual(await policy.validateControlledExperimentRegistration(unknownMethod), ["experiment_registration_identity_invalid", "experiment_registration_methods_invalid"]);
const tamperedAuthority = structuredClone(orderScenario.registration);
tamperedAuthority.authority.executionAuthority = "enabled";
assert.deepEqual(await policy.validateControlledExperimentRegistration(tamperedAuthority), ["experiment_registration_authority_invalid", "experiment_registration_identity_invalid"]);
const tamperedAssessment = structuredClone(orderScenario.assessment);
tamperedAssessment.results[0].rawPValue = 0.5;
assert.deepEqual(await policy.validateMultipleComparisonAssessment(tamperedAssessment, orderScenario.registration, orderScenario.trials),
  ["multiple_comparison_identity_invalid", "multiple_comparison_reproduction_mismatch"]);
await assert.rejects(policy.assessMultipleComparisons(orderScenario.registration, orderScenario.trials.slice(1)), /complete preregistered family/);
await assert.rejects(policy.assessMultipleComparisons(orderScenario.registration, [...orderScenario.trials, orderScenario.trials[0]]), /complete preregistered family/);
await assert.rejects(policy.assessMultipleComparisons(orderScenario.registration, orderScenario.trials.map((trial, index) => index ? trial : { ...trial, rawPValue: -0.1 })), /between zero and one/);
await assert.rejects(policy.assessMultipleComparisons(orderScenario.registration, orderScenario.trials.map((trial, index) => index ? trial : { ...trial, rawPValue: Number.NaN })), /between zero and one/);
await assert.rejects(policy.assessMultipleComparisons(orderScenario.registration, orderScenario.trials.map((trial, index) => index ? trial : { ...trial, familyId: `sha256:${"0".repeat(64)}` })), /family identity mismatch/);
await assert.rejects(policy.preregisterControlledExperiment({
  familyKey: "arbitrary-dependency",
  hypothesis: "Unsupported dependence must fail closed.",
  primaryStatistic: "mean R",
  tail: "right",
  alpha: 0.05,
  fdrTarget: 0.05,
  dependencyAssumption: "arbitrary_dependency",
  candidates: [{ candidateId: "candidate-a", label: "A" }]
}), /unsupported for arbitrary dependency/);
await assert.rejects(policy.preregisterControlledExperiment({
  familyKey: "duplicates",
  hypothesis: "Duplicate membership must fail closed.",
  primaryStatistic: "mean R",
  tail: "right",
  alpha: 0.05,
  fdrTarget: 0.05,
  dependencyAssumption: "independent_or_positive_dependency",
  candidates: [{ candidateId: "candidate-a", label: "A" }, { candidateId: "candidate-a", label: "A duplicate" }]
}), /duplicate candidate IDs/);

const serialized = JSON.stringify(scenarios);
for (const forbidden of ["rawCandles", "accountNumber", "orderId", "positionId", "brokerMutation", "executionIntent"])
  assert.equal(serialized.includes(forbidden), false);
const report = {
  schemaVersion: "gotrader-bt3-experiment-policy-report-v1",
  status: "passed",
  snapshotHash: `sha256:${sha256(snapshotText)}`,
  familyCount: Object.keys(scenarios).length,
  completeFamilyAccounting: true,
  benjaminiHochbergFdr: true,
  holmFamilyWise: true,
  bonferroniFamilyWise: true,
  inputOrderInvariant: true,
  dependentDiagnosticsExplicitlyNotApplicable: true,
  automaticSelectionAllowed: false,
  automaticPromotionAllowed: false,
  runtimeIntegrated: false,
  mt5Contacted: false,
  authority: scenarios.partial_reject.assessment.authority
};
const reportPath = path.join(root, ".gotrader/bt3-experiment-policy/report.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
