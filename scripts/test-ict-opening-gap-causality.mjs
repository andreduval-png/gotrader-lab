#!/usr/bin/env node
import assert from "node:assert/strict";
import { at, gap, input, loadIctI5, observation } from "./ict-i5-test-harness.mjs";
const ict = await loadIctI5();
const visible = observation(2, { low: 108, close: 109 });
const futureFill = observation(20, { low: 99, close: 99 });
const base = ict.evaluateNdogContext(input("NDOG", "GAP_UP", { asOf: at(10), observations: [visible] }));
const extended = ict.evaluateNdogContext(input("NDOG", "GAP_UP", { asOf: at(10), observations: [visible, futureFill] }));
assert.equal(base.state, "PARTIALLY_RETRACED");
assert.equal(extended.state, base.state);
assert.equal(extended.contextId, base.contextId);
const later = ict.evaluateNdogContext(input("NDOG", "GAP_UP", { asOf: at(25), observations: [visible, futureFill] }));
assert.equal(later.state, "CROSSED");
assert.throws(() => ict.evaluateNdogContext(input("NDOG", "GAP_UP", { gap: gap("NDOG", "GAP_UP", at(20)), asOf: at(10) })), /before validFrom/);
const tgifA = ict.evaluateTgifContext({ asOf: at(10), sourceFingerprint: "fixed", supportingFactIds: ["known-weekly-range"] });
const tgifB = ict.evaluateTgifContext({ asOf: at(10), sourceFingerprint: "fixed", supportingFactIds: ["known-weekly-range"] });
assert.deepEqual(tgifB, tgifA);
console.log("I5 opening-gap causality and future-extension tests passed");
