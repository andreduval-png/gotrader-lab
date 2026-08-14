#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const sourceRoot = path.join(root, "src", "lib");
const outputRoot = path.join(root, ".gotrader", "lrs-r1-preregistration-test");
compileTypescriptModules({ outRoot: outputRoot, files: [
  "strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperR1.ts"
].map((file) => path.join(sourceRoot, file)) });
const load = (file) => import(`${pathToFileURL(path.join(outputRoot, file)).href}?t=${Date.now()}`);
const r1 = await load("liquidityReclaimScalperR1.mjs");
const parameters = await load("liquidityReclaimScalperParameters.mjs");

assert.equal(r1.LRS_R1_PARAMETER_SCHEMA.length, Object.keys(parameters.LRS_BASE_PARAMETERS).length);
assert.equal(new Set(r1.LRS_R1_PARAMETER_SCHEMA.map((item) => item.name)).size, r1.LRS_R1_PARAMETER_SCHEMA.length);
assert.equal(r1.LRS_R1_PARAMETER_SCHEMA.find((item) => item.name === "sessionPolicy").sweepAuthorization, "frozen_not_implemented");
assert.equal(r1.LRS_R1_PARAMETER_SCHEMA.find((item) => item.name === "entryModel").sweepAuthorization, "authorized");
assert.deepEqual(r1.validateLrsR1TrialParameters(parameters.LRS_BASE_PARAMETERS), parameters.LRS_BASE_PARAMETERS);
assert.throws(() => r1.validateLrsR1TrialParameters({ ...parameters.LRS_BASE_PARAMETERS, sessionPolicy: "LONDON" }), /frozen/);
assert.throws(() => r1.validateLrsR1TrialParameters({ ...parameters.LRS_BASE_PARAMETERS, maximumSetupAgeBars: 96 }), /preregistered/);
assert.throws(() => r1.validateLrsR1TrialParameters({ ...parameters.LRS_BASE_PARAMETERS, entryRetracementRatio: 0.382 }), /baseline/);
assert.throws(() => r1.validateLrsR1TrialParameters({ ...parameters.LRS_BASE_PARAMETERS, stopBufferPoints: 0.5 }), /zero/);
assert.throws(() => r1.validateLrsR1TrialParameters({ ...parameters.LRS_BASE_PARAMETERS, standardizedRR: 2 }), /must be null/);
const validTrial = r1.validateLrsR1TrialParameters({ ...parameters.LRS_BASE_PARAMETERS, entryModel: "DISPLACEMENT_RETRACE",
  entryRetracementRatio: 0.618, stopModel: "RAID_EXTREME_BUFFER", stopBufferPoints: 0.5,
  targetModel: "STANDARDIZED_R", standardizedRR: 2.5, minimumTheoreticalRR: 2, maximumSetupAgeBars: 24 });
assert.equal(validTrial.standardizedRR, 2.5);

const hash = (digit) => `sha256:${digit.repeat(64)}`;
const familyInput = { codeCommit: "3dd4bbf059af618ca477188c3a2ed5859fde06ed", baselineAcceptanceId: hash("1"),
  baselineReportId: hash("2"), baselineLedgerSealId: hash("3"), datasetCertificateId: hash("4"), datasetId: hash("5"),
  sourceFingerprint: hash("6"), startUtc: "2024-08-01T00:00:00.000Z", endUtc: "2026-08-01T00:00:00.000Z",
  timePolicyId: hash("7") };
const first = await r1.buildLrsR1Preregistration(familyInput);
const second = await r1.buildLrsR1Preregistration({ ...familyInput });
assert.deepEqual(first, second);
assert.match(first.parameterSchemaId, /^sha256:[0-9a-f]{64}$/);
assert.match(first.experimentFamily.experimentFamilyId, /^sha256:[0-9a-f]{64}$/);
assert.match(first.samplingPlan.samplingPlanId, /^sha256:[0-9a-f]{64}$/);
assert.equal(first.samplingPlan.trialBudget, 128);
assert.equal(first.samplingPlan.executionAuthorized, false);
assert.equal(first.experimentFamily.researchValidated, false);
assert.equal(first.experimentFamily.productionAdoptionAllowed, false);
assert.deepEqual(first.experimentFamily.authority, { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" });
await assert.rejects(r1.buildLrsR1Preregistration({ ...familyInput, endUtc: "2026-08-02T00:00:00.000Z" }), /two-year/);

console.log(JSON.stringify({ status: "passed", parameterSchemaId: first.parameterSchemaId,
  experimentFamilyId: first.experimentFamily.experimentFamilyId, samplingPlanId: first.samplingPlan.samplingPlanId,
  trialBudget: first.samplingPlan.trialBudget, executionAuthorized: first.samplingPlan.executionAuthorized }, null, 2));
