#!/usr/bin/env node
import assert from "node:assert/strict";
import { evidence, gap, input, loadIctI5, observation } from "./ict-i5-test-harness.mjs";
const ict = await loadIctI5();
const oldGap = gap("NWOG", "GAP_UP", "2026-08-10T13:00:00.000Z", "nwog-old");
oldGap.marketDateOrWeekIdentity = "2026-08-10";
const currentGap = gap("NWOG", "GAP_DOWN", "2026-08-17T13:00:00.000Z", "nwog-current");
const contexts = ict.evaluateNwogContexts([
  input("NWOG", "GAP_DOWN", { gap: currentGap }),
  input("NWOG", "GAP_UP", { gap: oldGap, observations: [{ ...observation(2, { low: 99, close: 101 }), observedAt: "2026-08-10T13:02:00.000Z" }] })
]);
assert.equal(contexts.length, 2);
assert.equal(contexts[0].gapId, "nwog-old");
assert.equal(contexts[0].state, "FULLY_FILLED");
assert.equal(contexts[1].gapId, "nwog-current");
assert.equal(contexts[1].state, "UNTOUCHED");
const mismatch = ict.evaluateNwogContext(input("NWOG", "GAP_UP", { calendarEvidence: evidence("NWOG", { boundaryKind: "DAY_ROLLOVER" }) }));
assert.equal(mismatch.state, "SOURCE_BLOCKED");
assert.throws(() => ict.evaluateNwogContext(input("NDOG", "GAP_UP")), /canonical NWOG fact/);
console.log("I5 stable multi-week NWOG context tests passed");
