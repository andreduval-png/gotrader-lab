#!/usr/bin/env node
import assert from "node:assert/strict";
import { deliveryFacts, loadIctI4, narrative } from "./ict-i4-test-harness.mjs";
const ict = await loadIctI4();
for (const type of ["IRL_TO_ERL_DELIVERY", "ERL_TO_IRL_DELIVERY"]) {
  const result = ict.evaluateIrlErlDeliveryFramework({ facts: deliveryFacts(type), asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative() }, type);
  assert.equal(result.phase, "DELIVERY_ACTIVE");
  assert.equal(result.transitionType, type);
  assert.equal(result.executable, false);
  assert.equal(result.objectiveLiquidityClass, type === "IRL_TO_ERL_DELIVERY" ? "EXTERNAL" : "INTERNAL");
  assert.equal(result.mmxmFrameworkId, "gotrader.ict.i3.mmxm-delivery-framework.v1");
  assert.equal("geometry" in result, false);
}
const missing = deliveryFacts().slice(0, 2);
assert.equal(ict.evaluateIrlErlDeliveryFramework({ facts: missing, asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative() }, "IRL_TO_ERL_DELIVERY").phase, "ORIGIN_ESTABLISHED");
const consumed = deliveryFacts().map((fact) => fact.factId === "objective" ? { ...fact, status: "CONSUMED", state: "CONSUMED", consumedAt: "2026-02-03T14:02:00.000Z" } : fact);
assert.equal(ict.evaluateIrlErlDeliveryFramework({ facts: consumed, asOf: "2026-02-03T14:05:00.000Z", sourceFingerprint: "i4-fixture", narrative: narrative() }, "IRL_TO_ERL_DELIVERY").phase, "OBJECTIVE_CONSUMED");
console.log("I4 IRL/ERL delivery framework tests passed");
