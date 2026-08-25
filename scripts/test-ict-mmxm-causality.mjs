#!/usr/bin/env node
import assert from "node:assert/strict";
import { at, factBase, loadIctI3, marketMakerFixture } from "./ict-i3-test-harness.mjs";

const ict = await loadIctI3();
for (const direction of ["BULLISH", "BEARISH"]) {
  const fixture = marketMakerFixture(direction);
  const evaluate = direction === "BULLISH" ? ict.evaluateMarketMakerBuyModel : ict.evaluateMarketMakerSellModel;
  const before = evaluate(fixture);
  const extended = structuredClone(fixture);
  extended.facts.push({
    ...factBase("future-objective", "LIQUIDITY", 40),
    liquidityId: "future-objective",
    side: direction === "BULLISH" ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY",
    liquidityClass: "EXTERNAL",
    sourceStructureIds: ["future-swing"],
    ownerTimeframe: "1h",
    dealingRangeId: "range-1",
    price: direction === "BULLISH" ? 140 : 60,
    status: "AVAILABLE"
  });
  extended.candlesByTimeframe["5m"].push({
    id: "future-candle",
    symbol: "NQ",
    timeframe: "5m",
    timestamp: at(40),
    open: 200,
    high: 210,
    low: 190,
    close: 205,
    volume: 100
  });
  const after = evaluate(extended);
  assert.equal(after.state, before.state);
  assert.equal(after.candidateId, before.candidateId);
  assert.equal(after.geometry.geometryId, before.geometry.geometryId);
  assert.deepEqual(after.transitions, before.transitions);
}

const futureTrap = marketMakerFixture("BULLISH");
futureTrap.facts = futureTrap.facts.filter((fact) => fact.factId !== "transition");
futureTrap.facts.push({
  ...factBase("future-transition", "IRL_ERL_TRANSITION", 40),
  transitionId: "future-transition",
  transitionType: "ERL_TO_IRL_DELIVERY",
  direction: "bullish",
  fromLiquidityId: "engineering",
  toLiquidityId: "internal",
  dealingRangeId: "range-1",
  startedAt: at(40),
  currentState: "ACTIVE"
});
assert.equal(ict.evaluateMarketMakerBuyModel(futureTrap).state, "DELIVERY_TRANSITION_FORMING");

console.log("MMXM causality and future-extension invariance tests passed");
