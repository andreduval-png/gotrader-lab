#!/usr/bin/env node
import assert from "node:assert/strict";
import { evidence, input, loadIctI5, observation } from "./ict-i5-test-harness.mjs";
const ict = await loadIctI5();
assert.equal(ict.evaluateOpeningGapContext(input("NDOG", "GAP_UP")).state, "UNTOUCHED");
assert.equal(ict.evaluateOpeningGapContext(input("NDOG", "GAP_DOWN")).orientation, "GAP_DOWN");
assert.equal(ict.evaluateOpeningGapContext(input("NDOG", "FLAT_OR_NO_GAP")).state, "INVALIDATED");
assert.equal(ict.evaluateOpeningGapContext(input("NDOG", "GAP_UP", { observations: [observation(2, { low: 108 })] })).state, "PARTIALLY_RETRACED");
assert.equal(ict.evaluateOpeningGapContext(input("NDOG", "GAP_UP", { observations: [observation(2, { low: 105 })] })).state, "MIDPOINT_REACHED");
assert.equal(ict.evaluateOpeningGapContext(input("NDOG", "GAP_UP", { observations: [observation(2, { low: 100, close: 101 })] })).state, "FULLY_FILLED");
assert.equal(ict.evaluateOpeningGapContext(input("NDOG", "GAP_UP", { observations: [observation(2, { low: 99, close: 99 })] })).state, "CROSSED");
for (const boundaryKind of ["MAINTENANCE", "PROVIDER_OUTAGE", "UNKNOWN"]) {
  const result = ict.evaluateOpeningGapContext(input("NDOG", "GAP_UP", { calendarEvidence: evidence("NDOG", { boundaryKind }) }));
  assert.equal(result.state, "SOURCE_BLOCKED");
}
console.log("I5 shared opening-gap lifecycle tests passed");
