#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadIctI4, narrative, oteFacts } from "./ict-i4-test-harness.mjs";
const ict = await loadIctI4();
for (const direction of ["bullish", "bearish"]) {
  const price = direction === "bullish" ? 96 : 104;
  const input = { facts: oteFacts(direction), asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative(direction), direction, observedPrice: price, observedAt: "2026-02-03T14:03:00.000Z" };
  const result = ict.evaluateOteEntryPolicy(input);
  assert.equal(result.phase, "ZONE_REACHED");
  assert.equal(result.zoneEncountered, true);
  assert.equal(result.dealingRangeId, "range");
  assert.equal(result.oteZoneId, "ote");
  assert.deepEqual(result.retracementFractions, [0.62, 0.79]);
  assert.equal(result.executable, false);
  assert.equal("geometry" in result, false);
}
const noRange = ict.evaluateOteEntryPolicy({ facts: [], asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative(), direction: "bullish" });
assert.equal(noRange.phase, "SEARCHING");
const waiting = ict.evaluateOteEntryPolicy({ facts: oteFacts(), asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative(), direction: "bullish", observedPrice: 105, observedAt: "2026-02-03T14:03:00.000Z" });
assert.equal(waiting.phase, "WAITING_FOR_RETRACE");
console.log("I4 OTE entry-policy tests passed");
