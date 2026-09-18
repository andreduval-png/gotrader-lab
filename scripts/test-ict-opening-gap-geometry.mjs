#!/usr/bin/env node
import assert from "node:assert/strict";
import { input, loadIctI5 } from "./ict-i5-test-harness.mjs";
const ict = await loadIctI5();
const context = ict.evaluateNdogContext(input("NDOG", "GAP_UP"));
const registry = ict.assertIctI5Registry();
assert.equal(registry.length, 3);
assert.equal(ict.executableIctI5Registry().length, 0);
assert.equal(context.executable, false);
for (const forbidden of ["entry", "stop", "target", "geometry", "actionable", "theoreticalRR"]) assert.equal(forbidden in context, false);
assert.equal(context.authority.canCreateTradeIntent, false);
console.log("I5 fail-closed G1.1 and registry tests passed");
