#!/usr/bin/env node
import assert from "node:assert/strict";
import { ict2022Fixture, loadIctI2 } from "./ict-i2-test-harness.mjs";

const ict = await loadIctI2();
ict.assertIctI2SourcePacket(ict.ICT_JUDAS_SOURCE_PACKET);
const result = ict.evaluateIctJudasSwing(ict2022Fixture());
assert.equal(result.state, "SOURCE_BLOCKED");
assert.equal(result.direction, "none");
assert.equal(result.geometry, undefined);
assert.equal(result.blockers.length, 4);
assert.equal(ict.ICT_JUDAS_BLOCKED_PARAMETERS.session, "LONDON_0000_TO_0500_NEW_YORK");
assert.equal(ict.ICT_JUDAS_BLOCKED_PARAMETERS.openingReference, "NEW_YORK_MIDNIGHT_OPEN");
assert.equal(ict.ICT_JUDAS_BLOCKED_MODEL.requiredFactTypes.includes("MSS"), false);
assert.equal(ict.ICT_JUDAS_BLOCKED_MODEL.requiredFactTypes.includes("FVG"), false);
assert.equal(result.researchValidated, false);
assert.equal(ict.ICT_JUDAS_LONDON_RAID_COMPARISON.alias, false);
assert.equal(ict.ICT_JUDAS_LONDON_RAID_COMPARISON.duplicateRegistrationPrevented, true);
assert.equal(ict.ICT_JUDAS_SILVER_BULLET_COMPARISON.behaviorallyIdentical, false);
assert(!ict.executableIctI2Registry().some((entry) => entry.strategyId === "ict_judas_swing_v1"));
assert.equal(ict.assertNoExecutableIctI2Aliases().length, 2);

console.log(JSON.stringify({
  status: "passed",
  model: "ict_judas_swing_v1",
  disposition: "BLOCKED_SOURCE_SEMANTICS",
  unresolvedMaterialRules: result.blockers.length,
  duplicateRegistrationPrevented: true
}, null, 2));
