#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildNativeGeometryScenario } from "./bt3/generate-native-geometry-risk-fixtures.mjs";

const root = process.cwd(); const fixtureRoot = path.join(root, "tests/fixtures/bt3-native-geometry-risk");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const snapshotText = text(path.join(fixtureRoot, "native-geometry-risk.snapshot.json"));
const snapshot = JSON.parse(snapshotText); const manifest = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json")));
assert.equal(sha256(snapshotText), manifest.hashes["native-geometry-risk.snapshot.json"]);
const { geometry, opportunities, assessments } = await buildNativeGeometryScenario();
assert.deepEqual(assessments, snapshot.payload);
for (const [name, assessment] of Object.entries(assessments)) {
  assert.deepEqual(await geometry.validateNativeGeometryAssessment(assessment, opportunities[name]), []);
  assert.equal(assessment.currentLiveGeometryAuthoritative, true);
  assert.equal(assessment.nativeGeometryMutationAllowed, false);
  assert.equal(assessment.standardizedRrExperimentAllowed, false);
  assert.equal(assessment.positionSizingAllowed, false);
}
assert.equal(assessments.long_multiple_targets.riskPriceDistance, 5);
assert.deepEqual(assessments.long_multiple_targets.targetMeasures.map((value) => value.rewardRiskMultiple), [2, 3]);
assert.equal(assessments.short_single_target.riskPriceDistance, 4);
assert.equal(assessments.short_single_target.targetMeasures[0].rewardRiskMultiple, 2);
assert.equal(assessments.displaced_non_monotonic_targets.signalEntryPriceDistance, 1);
assert.equal(assessments.displaced_non_monotonic_targets.signalEntryState, "displaced");
assert.equal(assessments.displaced_non_monotonic_targets.targetSequenceState, "non_monotonic");
assert.deepEqual(assessments.displaced_non_monotonic_targets.targetMeasures.map((value) => value.rewardRiskMultiple), [1.5, 1.2]);
assert.deepEqual(assessments.displaced_non_monotonic_targets.targetPrices, [107.5, 106]);
const before = JSON.stringify(opportunities.long_multiple_targets);
await geometry.assessNativeGeometry(opportunities.long_multiple_targets);
assert.equal(JSON.stringify(opportunities.long_multiple_targets), before);
const tamperedOpportunity = structuredClone(opportunities.short_single_target);
tamperedOpportunity.opportunityId = `sha256:${"0".repeat(64)}`;
await assert.rejects(geometry.assessNativeGeometry(tamperedOpportunity), /opportunity is invalid/);
const wrongMode = structuredClone(opportunities.short_single_target); wrongMode.geometryMode = "standardized_rr";
await assert.rejects(geometry.assessNativeGeometry(wrongMode), /governed BT2 native geometry contract/);
const tamperedAssessment = structuredClone(assessments.short_single_target); tamperedAssessment.riskPriceDistance = 99;
assert.deepEqual(await geometry.validateNativeGeometryAssessment(tamperedAssessment, opportunities.short_single_target),
  ["bt3_native_geometry_assessment_id_invalid", "bt3_native_geometry_assessment_reproduction_mismatch"]);
const serialized = JSON.stringify(assessments);
for (const forbidden of ["cashRisk", "margin", "lotSize", "positionSize", "selectedTarget", "rankedTarget", "pnl"])
  assert.equal(serialized.includes(forbidden), false);
const report = { schemaVersion: "gotrader-bt3-native-geometry-report-v1", status: "passed",
  snapshotHash: `sha256:${sha256(snapshotText)}`, fixtureCount: 3,
  assessmentIds: Object.fromEntries(Object.entries(assessments).map(([key, value]) => [key, value.assessmentId])),
  nativeGeometryUnchanged: true, policyThresholdsApplied: 0, selectedTargetCount: 0,
  instrumentUnitConversions: 0, positionSizingCalculations: 0, rawCandlesSerialized: false, mt5Contacted: false,
  authority: assessments.long_multiple_targets.authority };
const reportPath = path.join(root, ".gotrader/bt3-native-geometry/report.json"); fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"); console.log(JSON.stringify(report, null, 2));
