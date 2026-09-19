import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { canonicalHash } from "./lib/bt-g1-3-certified-dataset.mjs";
import { reconcileHistoricalResults } from "./lib/p4-batch-dispatch.mjs";
import { qualificationPlan } from "./lib/p4-qualification-plan.mjs";

if (!process.argv[2]) throw new Error("CONTINUATION_DIRECTORY_REQUIRED");
const root = path.resolve(process.argv[2]);
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const manifest = read("manifest.json"), continuation = read("continuation-report.json");
const plan = qualificationPlan(manifest.observationsPerOwner);
assert.equal(manifest.stages, plan.stages);
assert.deepEqual(manifest.schedule, plan.schedule);
assert.equal(continuation.manifestHash, canonicalHash(manifest));
assert.equal(continuation.fullEvaluationAllowed, false);
assert.equal(continuation.reports.length, plan.stages);
const finalPrefix = `stage-${plan.stages}/`;
const final = read(`${finalPrefix}pilot-report.json`);
const { canonicalFingerprint } = await import(pathToFileURL(path.join(root,
  finalPrefix, "runtime/src/lib/ictCanonical/canonicalIctIdentity.mjs")).href);
let peakRssBytes = 0;
for (let stage = 1; stage <= plan.stages; stage += 1) {
  const prefix = `stage-${stage}/`, pilot = read(`${prefix}pilot-report.json`);
  const supervisor = read(`${prefix}supervisor-report.json`);
  assert.deepEqual(supervisor, continuation.reports[stage - 1]);
  assert.equal(supervisor.status, "COMPLETED");
  assert.equal(supervisor.packageUnchanged, true);
  assert.equal(fs.statSync(path.join(root, prefix, "stderr.log")).size, 0);
  assert.equal(pilot.admissionHash, canonicalHash(pilot.admission));
  assert.equal(pilot.admissionHash, final.admissionHash);
  assert.deepEqual(pilot.policyBinding, final.policyBinding);
  assert.deepEqual(pilot.scheduledObservations.map((item) => item.asOf), plan.schedule);
  assert.ok(pilot.scheduledObservations.every((item) => item.status === "AVAILABLE"));
  assert.deepEqual(pilot.results.map((item) => item.strategyId), final.protocol.owners);
  assert.equal(pilot.researchValidated, false);
  assert.equal(pilot.productionAdoptionAllowed, false);
  assert.equal(pilot.authority, "none/none/none");
  peakRssBytes = Math.max(peakRssBytes, supervisor.peakRssBytes, pilot.resources.peakRssBytes);
  assert.ok(supervisor.elapsedMs <= 120000);
  assert.ok(supervisor.diskSnapshot.outputBytes <= 128 * 1024 ** 2);
  for (const owner of pilot.results) {
    const checkpoint = read(`${prefix}${owner.strategyId}.checkpoint.json`);
    const { checkpointHash, ...body } = checkpoint;
    assert.equal(checkpointHash, canonicalFingerprint(body));
    assert.equal(checkpoint.nextPosition, stage * 6);
    assert.equal(owner.status, stage === plan.stages ? "completed" : "checkpointed");
  }
}
assert.ok(peakRssBytes <= 768 * 1024 ** 2);
const results = final.results.map(({ strategyId }) => {
  const result = read(`${finalPrefix}${strategyId}.result.json`);
  const { resultIdentityHash, ...body } = result;
  assert.equal(resultIdentityHash, canonicalFingerprint(body));
  const provenance = read(`${finalPrefix}${strategyId}.provenance.json`);
  const { bindingHash, ...binding } = provenance;
  assert.equal(bindingHash, canonicalHash(binding));
  assert.equal(provenance.resultContentHash, canonicalHash(result));
  assert.equal(provenance.admissionHash, final.admissionHash);
  assert.equal(provenance.foldIdentityHash, result.foldIdentityHash);
  const { stateHash, ...state } = read(`batches/${strategyId}/state.json`);
  assert.equal(stateHash, canonicalHash(state));
  assert.deepEqual(state.checkpoint, read(`${finalPrefix}${strategyId}.checkpoint.json`));
  assert.equal(fs.existsSync(path.join(root, "batches", strategyId, "dispatch.lock")), false);
  return result;
});
const reconciliation = reconcileHistoricalResults({ results, expectedOwners: final.protocol.owners,
  expectedSchedule: plan.schedule });
assert.deepEqual(reconciliation, final.reconciliation);
console.log(JSON.stringify({ status: "VERIFIED_BOUNDED_CAPACITY", dates: plan.dates,
  observationsPerOwner: plan.observationsPerOwner, peakRssBytes,
  continuationHash: canonicalHash(continuation), pilotHash: canonicalHash(final),
  reconciliation, fullEvaluationAllowed: false }, null, 2));
