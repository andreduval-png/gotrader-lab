#!/usr/bin/env node
import assert from "node:assert/strict";
import { deliveryFacts, loadIctI4, narrative } from "./ict-i4-test-harness.mjs";
const ict = await loadIctI4();
const input = { facts: deliveryFacts("IRL_TO_ERL_DELIVERY", 20), asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative() };
const before = ict.evaluateIrlErlDeliveryFramework(input, "IRL_TO_ERL_DELIVERY");
const after = ict.evaluateIrlErlDeliveryFramework({ ...input, facts: [...input.facts, ...deliveryFacts("IRL_TO_ERL_DELIVERY", 30)] }, "IRL_TO_ERL_DELIVERY");
assert.equal(before.phase, "ORIGIN_ESTABLISHED");
assert.equal(after.phase, before.phase);
assert.equal(after.contextId, before.contextId);
assert.equal(after.transitionId, undefined);
console.log("I4 delivery future-transition invariance tests passed");
