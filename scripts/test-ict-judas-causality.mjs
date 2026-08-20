#!/usr/bin/env node
import assert from "node:assert/strict";
import { at, ict2022Fixture, loadIctI2 } from "./ict-i2-test-harness.mjs";

const ict = await loadIctI2();
const fixture = ict2022Fixture();
const initial = ict.evaluateIctJudasSwing(fixture);
const laterEvidence = ict2022Fixture();
laterEvidence.facts.push(...laterEvidence.facts.map((fact) => ({ ...fact, factId: `future-${fact.factId}`, occurredAt: at(55), confirmedAt: at(55), validFrom: at(55) })));
laterEvidence.candlesByTimeframe["5m"].push({ ...laterEvidence.candlesByTimeframe["5m"][0], id: "future", timestamp: at(55) });
assert.deepEqual(ict.evaluateIctJudasSwing(laterEvidence), initial, "future pattern evidence cannot bypass source governance");

for (const scenario of ["initial_move_without_raid", "raid_without_reversal", "late_reversal", "wrong_opening_reference"]) {
  const candidate = ict.evaluateIctJudasSwing({ ...fixture, sourceFingerprint: scenario });
  assert.equal(candidate.state, "SOURCE_BLOCKED");
  assert.equal(candidate.geometry, undefined);
}

console.log(JSON.stringify({ status: "passed", model: "ict_judas_swing_v1", sourceGateCausal: true, futureExtensionInvariant: true }, null, 2));
