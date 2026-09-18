import assert from "node:assert/strict";
import { evaluateCapacityPreflight as evaluate, P4_PROBE_POLICY as policy } from "./lib/p4-capacity-preflight.mjs";
const eligible = { freeMemoryBytes: policy.minimumFreeMemoryBytes, freeDiskBytes: policy.minimumFreeDiskBytes };
const result = evaluate(eligible);
assert.equal(result.status, "BOUNDED_PROBE_ELIGIBLE");
assert.equal(result.maximumProbeWorkers, 1);
assert.equal(result.safeWorkerCount, 0);
assert.equal(result.fullDatasetRunAllowed, false);
assert.equal(result.qualificationStatus, "NOT_QUALIFIED");
for (const field of ["freeMemoryBytes", "freeDiskBytes"]) {
  for (const value of [undefined, NaN, Infinity, -1, 0, eligible[field] - 1]) {
    const blocked = evaluate({ ...eligible, [field]: value });
    assert.equal(blocked.status, "CAPACITY_BLOCKED");
    assert.equal(blocked.maximumProbeWorkers, 0);
    assert.equal(blocked.safeWorkerCount, 0);
    assert.equal(blocked.fullDatasetRunAllowed, false);
  }
}
assert.equal(evaluate({ freeMemoryBytes: 128 * 1024 ** 3, freeDiskBytes: 1024 ** 4 }).safeWorkerCount, 0);
console.log("PASS: capacity boundaries, missing measurements, and no unmeasured worker qualification");
