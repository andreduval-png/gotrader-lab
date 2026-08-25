#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadIctI3, marketMakerFixture } from "./ict-i3-test-harness.mjs";

const ict = await loadIctI3();
const valid = ict.evaluateMarketMakerBuyModel(marketMakerFixture("BULLISH"));
assert.equal(valid.strategyId, "ict_market_maker_buy_model_v1");
assert.equal(valid.state, "ACTIVE_DELIVERY");
assert.equal(valid.direction, "long");
assert.equal(valid.geometry.geometryValid, true);
assert.equal(valid.geometry.status, "VALID_RESEARCH_ONLY");
assert.equal(valid.geometry.actionable, false);
assert.equal(valid.geometry.entry.intendedPrice, 99);
assert.equal(valid.geometry.stop.price, 90);
assert.equal(valid.geometry.target.price, 120);
assert.equal(valid.context.dealingRangeId, "range-1");
assert.equal(valid.context.transitionId, "transition");
assert.equal(valid.authority.executionAuthority, "none");
assert.equal(valid.researchValidated, false);

const noEvent = marketMakerFixture("BULLISH");
noEvent.facts = noEvent.facts.filter((fact) => fact.factId !== "engineering");
assert.equal(ict.evaluateMarketMakerBuyModel(noEvent).state, "LIQUIDITY_ENGINEERING_FORMING");

const noTransition = marketMakerFixture("BULLISH");
noTransition.facts = noTransition.facts.filter((fact) => fact.factId !== "transition");
assert.equal(ict.evaluateMarketMakerBuyModel(noTransition).state, "DELIVERY_TRANSITION_FORMING");

const noPdArray = marketMakerFixture("BULLISH");
noPdArray.facts = noPdArray.facts.filter((fact) => fact.factId !== "pd-array");
assert.equal(ict.evaluateMarketMakerBuyModel(noPdArray).state, "PD_ARRAY_REPRICE_FORMING");

const belowRr = marketMakerFixture("BULLISH");
belowRr.facts.find((fact) => fact.factId === "objective").price = 105;
const belowRrResult = ict.evaluateMarketMakerBuyModel(belowRr);
assert.equal(belowRrResult.state, "GEOMETRY_NON_ACTIONABLE");
assert.equal(belowRrResult.geometry.status, "VALID_BELOW_RR_THRESHOLD");
assert.equal(belowRrResult.geometry.entry.intendedPrice, 99);
assert.equal(belowRrResult.geometry.stop.price, 90);
assert.equal(belowRrResult.geometry.target.price, 105);

const missed = marketMakerFixture("BULLISH");
missed.candlesByTimeframe["5m"] = [{
  ...missed.candlesByTimeframe["5m"][0],
  id: "late-price",
  low: 104,
  high: 106,
  open: 105,
  close: 105
}];
const missedResult = ict.evaluateMarketMakerBuyModel(missed);
assert.equal(missedResult.state, "ENTRY_MISSED");
assert.equal(missedResult.geometry.entry.intendedPrice, 99);
assert.equal(missedResult.geometry.status, "ENTRY_MISSED");

console.log(JSON.stringify({
  status: "passed",
  strategyId: valid.strategyId,
  lifecycle: valid.transitions.map((transition) => transition.to),
  authority: valid.authority
}, null, 2));
