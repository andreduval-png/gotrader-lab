#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadIctI4, narrative, oteFacts } from "./ict-i4-test-harness.mjs";
const ict = await loadIctI4();
const input = { facts: oteFacts("bullish", 20), asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative(), direction: "bullish", observedPrice: 96, observedAt: "2026-02-03T14:30:00.000Z" };
const before = ict.evaluateOteEntryPolicy(input);
const after = ict.evaluateOteEntryPolicy({ ...input, facts: [...input.facts, ...oteFacts("bullish", 30)] });
assert.equal(before.phase, "DIRECTIONAL_THESIS_ESTABLISHED");
assert.equal(after.phase, before.phase);
assert.equal(after.contextId, before.contextId);
assert.equal(after.zoneEncountered, false);
console.log("I4 OTE swing-confirmation and future-extension tests passed");
