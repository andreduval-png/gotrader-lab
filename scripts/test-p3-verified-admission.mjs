import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { canonicalHash } from "./lib/bt-g1-3-certified-dataset.mjs";

// Synthetic verifier dependencies test orchestration, not certified data acceptance.
const calls = [];
let failVerification = false;
const dataset = { datasetId: "fixture", datasetChecksum: "checksum", sourceFingerprint: "source" };
const candle = { timestamp: "2025-01-01T00:00:00.000Z", open: 100, high: 101, low: 99, close: 100 };
const dependencies = {
  canonicalHash: (value) => canonicalHash(structuredClone(value)),
  verifyCertificateAndManifest() {
    calls.push("certificate");
    return { manifest: dataset, certificate: { certificateId: "certificate" } };
  },
  verifyAllPartitions(verified, options) {
    calls.push("partitions");
    assert.notEqual(options.verifyChecksums, false);
    if (failVerification) throw new Error("partition corrupt");
    return { datasetChecksum: "checksum", manifestHash: "manifest" };
  },
  loadCertifiedTimeframe() { calls.push("load"); return [structuredClone(candle)]; }
};
const context = vm.createContext({});
const dep = new vm.SyntheticModule(Object.keys(dependencies), function () {
  for (const [key, value] of Object.entries(dependencies)) this.setExport(key, value);
}, { context });
const source = fs.readFileSync(new URL("./lib/p3-verified-fold-admission.mjs", import.meta.url), "utf8");
const module = new vm.SourceTextModule(source, { context });
await module.link(() => dep);
await module.evaluate();
const { loadVerifiedFoldAdmission: load, runVerifiedHistoricalFold: run } = module.namespace;
const requests = [{ timeframe: "5m", startUtc: "2025-01-01", endUtc: "2025-01-02", warmupDays: 0 }];
assert.throws(() => run({ receipt: {} }, () => assert.fail("must not run"), {}), /ADMISSION_REQUIRED/);
assert.throws(() => load({ requests: [] }), /INVALID_SLICE_REQUESTS/);
const admission = load({ requests });
assert.deepEqual(calls, ["certificate", "partitions", "load"]);
assert.equal(admission.receipt.slices[0].contentHash, canonicalHash([candle]));
assert.throws(() => { admission.candlesByTimeframe["5m"][0].close = 999; }, TypeError);
requests[0].warmupDays = 20;
assert.equal(admission.receipt.slices[0].warmupDays, 0);
assert.throws(() => run(structuredClone(admission), () => null, {}), /ADMISSION_REQUIRED/);
const output = run(admission, (input) => {
  assert.equal(input.dataset.datasetId, "fixture");
  assert.equal(input.candlesByTimeframe["5m"][0].close, 100);
    return { resultIdentityHash: "result", foldIdentityHash: "fold", researchValidated: false, optional: undefined };
}, {
  adapter: { requiredTimeframes: ["5m"] }, primaryTimeframe: "5m",
  dataset: { datasetId: "forged" }, candlesByTimeframe: { "5m": [] }
});
assert.equal(output.provenance.resultContentHash, canonicalHash(structuredClone(output.result)));
assert.equal(Object.hasOwn(output.result, "optional"), false);
assert.equal(output.provenance.authority, "none/none/none");
failVerification = true;
calls.length = 0;
assert.throws(() => load({ requests }), /partition corrupt/);
assert.deepEqual(calls, ["certificate", "partitions"]);
console.log("PASS: verification order, fail-closed loading, immutable slices, forged admission rejection, exact result binding (synthetic)");
