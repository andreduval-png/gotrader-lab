#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadIctI3, marketMakerFixture } from "./ict-i3-test-harness.mjs";

const ict = await loadIctI3();
const buy = ict.evaluateMarketMakerBuyModel(marketMakerFixture("BULLISH"));
const sell = ict.evaluateMarketMakerSellModel(marketMakerFixture("BEARISH"));

assert.deepEqual(
  buy.transitions.map((transition) => transition.to),
  sell.transitions.map((transition) => transition.to)
);
assert.equal(buy.geometry.riskDistance, sell.geometry.riskDistance);
assert.equal(buy.geometry.rewardDistance, sell.geometry.rewardDistance);
assert.equal(buy.geometry.theoreticalRR, sell.geometry.theoreticalRR);
assert.equal(buy.geometry.status, sell.geometry.status);
assert.deepEqual(buy.authority, sell.authority);
assert.equal(buy.context.transitionType, sell.context.transitionType);
assert.notEqual(buy.candidateId, sell.candidateId);
assert.notEqual(buy.geometry.geometryId, sell.geometry.geometryId);

console.log(JSON.stringify({
  status: "passed",
  mirroredPhases: buy.transitions.length,
  riskDistance: buy.geometry.riskDistance,
  rewardDistance: buy.geometry.rewardDistance,
  theoreticalRR: buy.geometry.theoreticalRR
}, null, 2));
