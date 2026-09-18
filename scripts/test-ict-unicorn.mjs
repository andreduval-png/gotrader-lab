#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadIctI4, unicornFacts, narrative } from "./ict-i4-test-harness.mjs";
const ict = await loadIctI4();
for (const direction of ["bullish", "bearish"]) {
  const result = ict.evaluateUnicornContext({ facts: unicornFacts(direction), asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative(direction) });
  assert.equal(result.phase, "SOURCE_BLOCKED");
  assert.deepEqual(result.overlap, [99, 101]);
  assert.equal(result.direction, direction);
  assert.equal(result.executable, false);
  assert.equal(result.authority.executionAuthority, "none");
}
const breakerOnly = ict.evaluateUnicornContext({ facts: unicornFacts().slice(0, 1), asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative() });
assert.equal(breakerOnly.phase, "BREAKER_CONFIRMED");
const fvgOnly = ict.evaluateUnicornContext({ facts: unicornFacts().slice(1), asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative() });
assert.equal(fvgOnly.phase, "SEARCHING");
const noOverlap = unicornFacts().map((fact) => fact.factType === "FVG" ? { ...fact, proximalPrice: 110, distalPrice: 108, midpoint: 109 } : fact);
assert.equal(ict.evaluateUnicornContext({ facts: noOverlap, asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative() }).phase, "QUALIFYING_FVG_CONFIRMED");
console.log("I4 Unicorn composite-context tests passed");
