#!/usr/bin/env node
import assert from "node:assert/strict";
import { at, loadIctI2, po3Fixture } from "./ict-i2-test-harness.mjs";

const ict = await loadIctI2();
const fixture = po3Fixture();
const early = ict.evaluateIctPowerOfThree({ ...fixture, asOf: at(5), candlesByTimeframe: { "5m": [] } });
assert.equal(early.state, "DISTRIBUTION_FORMING", "future distribution cannot confirm at manipulation time");

const futureExtended = po3Fixture();
futureExtended.candlesByTimeframe["5m"].push({ ...futureExtended.candlesByTimeframe["5m"][0], id: "future", timestamp: at(55), high: 120, low: 80 });
assert.deepEqual(ict.evaluateIctPowerOfThree(futureExtended), ict.evaluateIctPowerOfThree(fixture));

const earlyFvg = po3Fixture();
const fvg = earlyFvg.facts.find((fact) => fact.factType === "FVG");
fvg.occurredAt = fvg.confirmedAt = fvg.validFrom = at(5);
assert.equal(ict.evaluateIctPowerOfThree(earlyFvg).state, "DISTRIBUTION_CONFIRMED", "FVG before distribution cannot qualify entry");

const falseBreakout = po3Fixture();
falseBreakout.facts.find((fact) => fact.factType === "MSS").direction = "bearish";
assert.equal(ict.evaluateIctPowerOfThree(falseBreakout).state, "DISTRIBUTION_FORMING");

console.log(JSON.stringify({ status: "passed", model: "ict_power_of_three_v1", futureExtensionInvariant: true }, null, 2));
