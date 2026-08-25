#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadIctI3, marketMakerFixture } from "./ict-i3-test-harness.mjs";

const ict = await loadIctI3();
const valid = ict.evaluateMarketMakerSellModel(marketMakerFixture("BEARISH"));
assert.equal(valid.strategyId, "ict_market_maker_sell_model_v1");
assert.equal(valid.state, "ACTIVE_DELIVERY");
assert.equal(valid.direction, "short");
assert.equal(valid.geometry.geometryValid, true);
assert.equal(valid.geometry.status, "VALID_ACTIONABLE");
assert.equal(valid.geometry.actionable, true);
assert.equal(valid.geometry.entry.intendedPrice, 101);
assert.equal(valid.geometry.stop.price, 110);
assert.equal(valid.geometry.target.price, 80);
assert.equal(valid.context.deliveryDirection, "BEARISH_DELIVERY");
assert.equal(valid.authority.executionAuthority, "none");

const consumed = marketMakerFixture("BEARISH");
const objective = consumed.facts.find((fact) => fact.factId === "objective");
objective.status = "CONSUMED";
objective.consumedAt = consumed.asOf;
const consumedResult = ict.evaluateMarketMakerSellModel(consumed);
assert.equal(consumedResult.state, "TARGET_CONSUMED");
assert.equal(consumedResult.geometry.status, "TARGET_CONSUMED");

const invalidated = marketMakerFixture("BEARISH");
invalidated.smt = {
  divergenceType: "bullish_smt",
  confirmsCandidate: false,
  rejectsCandidate: true,
  reason: "Bullish SMT opposes bearish delivery."
};
const blockingProfile = { ...ict.ICT_MMSM_BASE_PARAMETERS, opposingSmtBehavior: "BLOCK" };
assert.equal(ict.evaluateMarketMakerSellModel(invalidated, blockingProfile).state, "INVALIDATED");

console.log(JSON.stringify({
  status: "passed",
  strategyId: valid.strategyId,
  lifecycle: valid.transitions.map((transition) => transition.to),
  authority: valid.authority
}, null, 2));
