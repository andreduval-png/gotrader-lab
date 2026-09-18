#!/usr/bin/env node
import assert from "node:assert/strict";
import { input, loadIctI5 } from "./ict-i5-test-harness.mjs";
const ict = await loadIctI5();
for (const artifact of [ict.evaluateNdogContext(input("NDOG", "GAP_UP")), ict.evaluateNwogContext(input("NWOG", "GAP_DOWN")), ict.evaluateTgifContext({ asOf: input().asOf, sourceFingerprint: "i5-fixture" })]) {
  const result = ict.adaptIctI5ArtifactToBt2(artifact);
  assert.equal(result.status, "blocked");
  assert.match(result.blockers[0], /no source-authorized canonical trade geometry/);
  assert.equal("request" in result, false);
}
console.log("I5 BT2 fail-closed boundary tests passed");
