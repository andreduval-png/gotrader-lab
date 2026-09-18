#!/usr/bin/env node
import assert from "node:assert/strict";
import { at, evidence, input, loadIctI5, observation } from "./ict-i5-test-harness.mjs";
const ict = await loadIctI5();
for (const orientation of ["GAP_UP", "GAP_DOWN"]) {
  const context = ict.evaluateNdogContext(input("NDOG", orientation));
  assert.equal(context.artifactId, "gotrader.ict.i5.ndog-context.v1");
  assert.equal(context.decision, "CONTEXT_ONLY");
  assert.equal(context.executable, false);
}
const filled = ict.evaluateNdogContext(input("NDOG", "GAP_UP", { observations: [observation(2, { low: 99, close: 101 })] }));
assert.equal(filled.state, "FULLY_FILLED");
assert.equal(filled.fullyFilled, true);
const expired = ict.evaluateNdogContext(input("NDOG", "GAP_UP", { expiresAt: at(5), asOf: at(10) }));
assert.equal(expired.state, "EXPIRED");
const unavailable = ict.evaluateNdogContext(input("NDOG", "GAP_UP", { calendarEvidence: evidence("NDOG", { openingReferenceAvailable: false }) }));
assert.equal(unavailable.state, "SOURCE_BLOCKED");
assert.throws(() => ict.evaluateNdogContext(input("NWOG", "GAP_UP")), /canonical NDOG fact/);
console.log("I5 NDOG context-only tests passed");
