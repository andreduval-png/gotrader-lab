#!/usr/bin/env node
import assert from "node:assert/strict";
import { ict2022Fixture, loadIctI2 } from "./ict-i2-test-harness.mjs";

const ict = await loadIctI2();
for (const direction of ["bullish", "bearish"]) {
  const result = ict.evaluateIct2022Model(ict2022Fixture(direction));
  assert.equal(result.state, "ACTIVE");
  assert.equal(result.direction, direction === "bullish" ? "long" : "short");
  assert(result.geometry);
  assert.deepEqual(result.authority, ict.ICT_I2_AUTHORITY);
  assert.equal(result.researchValidated, false);
  assert.deepEqual(result.transitions.map((transition) => transition.to), [
    "SEARCHING",
    "DIRECTIONAL_OBJECTIVE_ESTABLISHED",
    "WAITING_FOR_LIQUIDITY_RAID",
    "LIQUIDITY_RAID_CONFIRMED",
    "DISPLACEMENT_CONFIRMED",
    "MSS_CONFIRMED",
    "FVG_CREATED",
    "WAITING_FOR_RETRACE",
    "ENTRY_ELIGIBLE",
    "ACTIVE"
  ]);
}

const noDisplacement = ict2022Fixture();
noDisplacement.facts = noDisplacement.facts.filter((fact) => fact.factType !== "DISPLACEMENT");
assert.equal(ict.evaluateIct2022Model(noDisplacement).state, "LIQUIDITY_RAID_CONFIRMED");

const noMss = ict2022Fixture();
noMss.facts = noMss.facts.filter((fact) => fact.factType !== "MSS");
assert.equal(ict.evaluateIct2022Model(noMss).state, "DISPLACEMENT_CONFIRMED");

const noFvg = ict2022Fixture();
noFvg.facts = noFvg.facts.filter((fact) => fact.factType !== "FVG");
assert.equal(ict.evaluateIct2022Model(noFvg).state, "MSS_CONFIRMED");

const consumed = ict2022Fixture();
const target = consumed.facts.find((fact) => fact.factId === "target-fact");
target.status = "CONSUMED";
target.consumedAt = consumed.asOf;
assert.equal(ict.evaluateIct2022Model(consumed).state, "LIQUIDITY_OBJECTIVE_CONSUMED");

console.log(JSON.stringify({ status: "passed", model: "ict_2022_model_v1", directions: 2, authority: ict.ICT_I2_AUTHORITY }, null, 2));
