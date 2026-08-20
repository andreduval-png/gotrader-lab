#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadIctI2, po3Fixture } from "./ict-i2-test-harness.mjs";

const ict = await loadIctI2();
for (const direction of ["bullish", "bearish"]) {
  const result = ict.evaluateIctPowerOfThree(po3Fixture(direction));
  assert.equal(result.state, "ACTIVE");
  assert.equal(result.direction, direction === "bullish" ? "long" : "short");
  assert(result.geometry);
  assert.deepEqual(result.transitions.map((transition) => transition.to), [
    "SEARCHING",
    "ACCUMULATION_FORMING",
    "ACCUMULATION_CONFIRMED",
    "MANIPULATION_FORMING",
    "MANIPULATION_CONFIRMED",
    "DISTRIBUTION_FORMING",
    "DISTRIBUTION_CONFIRMED",
    "ENTRY_ELIGIBLE",
    "ACTIVE"
  ]);
}

const rangeOnly = po3Fixture();
rangeOnly.facts = rangeOnly.facts.filter((fact) => fact.factType === "DEALING_RANGE" || fact.factId === "po3-target");
assert.equal(ict.evaluateIctPowerOfThree(rangeOnly).state, "MANIPULATION_FORMING");

const noDistribution = po3Fixture();
noDistribution.facts = noDistribution.facts.filter((fact) => !["DISPLACEMENT", "MSS"].includes(fact.factType));
assert.equal(ict.evaluateIctPowerOfThree(noDistribution).state, "DISTRIBUTION_FORMING");

const wrongDirection = po3Fixture();
wrongDirection.facts.find((fact) => fact.factType === "DISPLACEMENT").direction = "bearish";
assert.equal(ict.evaluateIctPowerOfThree(wrongDirection).state, "DISTRIBUTION_FORMING");

const hodLod = ict.evaluateIctPowerOfThree(po3Fixture(), { ...ict.ICT_PO3_BASE_PARAMETERS, objectiveProfile: "HOD_LOD_RESEARCH" });
assert.equal(hodLod.profileId, "po3_hod_lod_research_v1");
assert.equal(hodLod.strategyId, "ict_power_of_three_v1");
assert.equal(ict.ICT_PO3_CMD_COMPARISON.behaviorallyIdentical, false);

console.log(JSON.stringify({ status: "passed", model: "ict_power_of_three_v1", directions: 2, hodLodIsProfile: true, cmdDistinct: true }, null, 2));
