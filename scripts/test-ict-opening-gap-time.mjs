#!/usr/bin/env node
import assert from "node:assert/strict";
import { evidence, input, loadIctI5 } from "./ict-i5-test-harness.mjs";
const ict = await loadIctI5();
const springBefore = ict.resolveIctI5NewYorkParts("2026-03-08T06:30:00.000Z");
const springAfter = ict.resolveIctI5NewYorkParts("2026-03-08T07:30:00.000Z");
assert.equal(springBefore.localTime, "01:30:00");
assert.equal(springAfter.localTime, "03:30:00");
const fallFirst = ict.resolveIctI5NewYorkParts("2026-11-01T05:30:00.000Z");
const fallSecond = ict.resolveIctI5NewYorkParts("2026-11-01T06:30:00.000Z");
assert.equal(fallFirst.localTime, "01:30:00");
assert.equal(fallSecond.localTime, "01:30:00");
assert.equal(ict.resolveIctI5MarketDate("2026-08-17T03:30:00.000Z"), "2026-08-16");
assert.equal(ict.resolveIctI5MarketWeek("2026-08-23T22:00:00.000Z"), "2026-08-17");
for (const holidayStatus of ["FULL_CLOSURE", "EARLY_CLOSE", "DELAYED_REOPEN"]) {
  const context = ict.evaluateNdogContext(input("NDOG", "GAP_UP", { calendarEvidence: evidence("NDOG", { boundaryKind: "HOLIDAY_REOPEN", holidayStatus }) }));
  assert.equal(context.state, "UNTOUCHED");
}
assert.equal(ict.evaluateNdogContext(input("NDOG", "GAP_UP", { calendarEvidence: evidence("NDOG", { calendarStatus: "UNVERIFIED" }) })).state, "SOURCE_BLOCKED");
console.log("I5 IANA DST, weekend, and calendar-evidence tests passed");
