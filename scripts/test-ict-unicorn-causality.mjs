#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadIctI4, unicornFacts, narrative } from "./ict-i4-test-harness.mjs";
const ict = await loadIctI4();
const input = { facts: unicornFacts("bullish", 20), asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative() };
const before = ict.evaluateUnicornContext(input);
const after = ict.evaluateUnicornContext({ ...input, facts: [...input.facts, ...unicornFacts("bullish", 30)] });
assert.equal(before.phase, "BREAKER_CONFIRMED");
assert.equal(after.phase, before.phase);
assert.equal(after.contextId, before.contextId);
assert.equal(after.overlap, undefined);
console.log("I4 Unicorn future-extension invariance tests passed");
