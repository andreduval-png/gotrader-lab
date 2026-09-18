#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { at as fixtureAt, authority, loadIctI3Runtime, marketMakerFixture } from "./ict-i3-test-harness.mjs";

const { ict, canonical } = await loadIctI3Runtime();
const start = Date.UTC(2026, 1, 3, 14, 0);
const at = (index) => new Date(start + index * 5 * 60_000).toISOString();
const candle = (index, open, high, low, close) => ({
  id: `natural-${index}`,
  symbol: "MNQ",
  timeframe: "5m",
  timestamp: at(index),
  open,
  high,
  low,
  close,
  volume: 100
});

const bullishCandles = [
  candle(0, 100, 102, 99, 101),
  candle(1, 101, 103, 100, 102),
  candle(2, 102, 104, 101, 103),
  candle(3, 104, 106, 103, 105),
  candle(4, 108, 110, 107, 109),
  candle(5, 107, 108, 105, 106),
  candle(6, 105, 106, 103, 104),
  candle(7, 100, 101, 95, 96),
  candle(8, 92, 94, 90, 91),
  candle(9, 94, 96, 93, 95),
  candle(10, 95, 97, 94, 96),
  candle(11, 91, 92, 89, 91.5),
  candle(12, 91, 100, 89, 99),
  candle(13, 99, 102, 98, 100),
  candle(14, 98, 99, 95, 96)
];

const mirror = (item) => ({
  ...item,
  id: item.id.replace("natural", "mirror"),
  open: 200 - item.open,
  high: 200 - item.low,
  low: 200 - item.high,
  close: 200 - item.close
});

const narrative = (direction) => ({
  structural: direction,
  intermediate: direction === "bullish" ? "bearish" : "bullish",
  execution: direction,
  liquidityPath: direction === "bullish" ? "buyside" : "sellside",
  structuralTimeframe: "1h",
  intermediateTimeframe: "15m",
  executionTimeframe: "5m",
  policyId: "gotrader.ict.c1-1.hierarchical-roles.v1",
  policyVersion: "1.0.0"
});

const evaluateNatural = (direction, candles, future = []) => {
  const asOf = at(14);
  const snapshot = canonical.buildCanonicalIctFactSnapshot({
    candles: [...candles, ...future],
    asOf,
    symbol: "MNQ",
    timeframe: "5m"
  });
  assert.equal(snapshot.facts.some((fact) => fact.factType === "IRL_ERL_TRANSITION"), false);
  const input = {
    facts: snapshot.facts,
    candlesByTimeframe: { "5m": candles },
    asOf,
    sourceFingerprint: snapshot.sourceFingerprint,
    narrative: narrative(direction === "BULLISH" ? "bullish" : "bearish"),
    symbol: "MNQ",
    timeframe: "5m"
  };
  const result = direction === "BULLISH"
    ? ict.evaluateMarketMakerBuyModel(input)
    : ict.evaluateMarketMakerSellModel(input);
  return { snapshot, result };
};

const assertQualified = ({ snapshot, result }, expected) => {
  assert.equal(result.deliverySequence.status, "QUALIFIED");
  assert.equal(result.state, "ACTIVE_DELIVERY");
  assert.equal(result.geometry.status, "VALID_ACTIONABLE");
  assert.equal(result.geometry.entry.intendedPrice, expected.entry);
  assert.equal(result.geometry.stop.price, expected.stop);
  assert.equal(result.geometry.target.price, expected.target);
  assert.equal(result.geometry.theoreticalRR, 3);
  assert.equal(result.context.sequenceId, result.deliverySequence.sequenceId);
  assert.equal(result.supportingFactIds.some((id) => /transition/i.test(id)), false);
  assert.equal(result.authority.executionAuthority, "none");
  assert.equal(result.authority.brokerAuthority, "none");
  assert.deepEqual(result.authority, authority);
  const ordered = result.deliverySequence.orderedTimestamps;
  assert(Date.parse(ordered.liquidityConsumedAt) < Date.parse(ordered.displacementValidFrom));
  assert(Date.parse(ordered.displacementValidFrom) < Date.parse(ordered.pdArrayValidFrom));
  assert(snapshot.facts.some((fact) => fact.factId === result.deliverySequence.engineeringLiquidityId));
  assert(snapshot.facts.some((fact) => fact.factId === result.deliverySequence.displacementId));
  assert(snapshot.facts.some((fact) => fact.factId === result.deliverySequence.pdArrayId));
  assert(snapshot.facts.some((fact) => fact.factId === result.deliverySequence.objectiveLiquidityId));
  const rangeId = result.deliverySequence.dealingRangeId;
  for (const factId of [
    result.deliverySequence.pdLocationFactId,
    result.deliverySequence.engineeringLiquidityId,
    result.deliverySequence.pdArrayId,
    result.deliverySequence.objectiveLiquidityId
  ]) {
    const fact = snapshot.facts.find((item) => item.factId === factId);
    assert.equal(fact?.dealingRangeId, rangeId, `${factId} must be positively owned by the selected range`);
  }
  const displacement = snapshot.facts.find((fact) => fact.factId === result.deliverySequence.displacementId);
  const range = snapshot.facts.find((fact) => fact.factType === "DEALING_RANGE" && fact.dealingRangeId === rangeId);
  assert.equal(displacement?.lineage.sourceFingerprint, range?.lineage.sourceFingerprint);
};

const bullish = evaluateNatural("BULLISH", bullishCandles);
const bearishCandles = bullishCandles.map(mirror);
const bearish = evaluateNatural("BEARISH", bearishCandles);
assertQualified(bullish, { entry: 95, stop: 90, target: 110 });
assertQualified(bearish, { entry: 105, stop: 110, target: 90 });

const foreignCandles = bullishCandles.map((item) => ({ ...item, id: item.id.replace("natural", "foreign") }));
const foreign = evaluateNatural("BULLISH", foreignCandles);
const rangeA = bullish.snapshot.facts.find((fact) => fact.factType === "DEALING_RANGE");
const rangeB = foreign.snapshot.facts.find((fact) => fact.factType === "DEALING_RANGE");
const foreignPdArray = foreign.snapshot.facts.find((fact) =>
  fact.factType === "PD_ARRAY" && fact.factId === foreign.result.deliverySequence.pdArrayId
);
assert(rangeA && rangeB && foreignPdArray);
assert.equal(rangeA.lowPrice, rangeB.lowPrice, "adversarial ranges must overlap exactly in price");
assert.equal(rangeA.highPrice, rangeB.highPrice, "adversarial ranges must overlap exactly in price");
assert.notEqual(rangeA.lineage.sourceFingerprint, rangeB.lineage.sourceFingerprint);
assert.equal(foreignPdArray.dealingRangeId, rangeB.dealingRangeId, "natural projection must bind the foreign FVG to range B");

const evaluateWithReplacementArray = (replacement) => {
  const input = {
    facts: [rangeB, ...bullish.snapshot.facts.filter((fact) => fact.factType !== "PD_ARRAY"), replacement],
    candlesByTimeframe: { "5m": bullishCandles },
    asOf: at(14),
    sourceFingerprint: bullish.snapshot.sourceFingerprint,
    narrative: narrative("bullish"),
    symbol: "MNQ",
    timeframe: "5m"
  };
  return ict.evaluateMarketMakerBuyModel(input);
};

const foreignRangeResult = evaluateWithReplacementArray(foreignPdArray);
assert.equal(foreignRangeResult.deliverySequence.dealingRangeId, rangeA.dealingRangeId);
assert.equal(foreignRangeResult.deliverySequence.status, "PD_ARRAY_RANGE_INVALID");
assert.equal(foreignRangeResult.geometry, undefined);

const { dealingRangeId: _removedRangeId, ...untaggedPdArray } = {
  ...foreignPdArray,
  factId: "untagged-natural-pd-array",
  pdArrayId: "untagged-natural-pd-array",
  lineage: { ...foreignPdArray.lineage, sourceFingerprint: rangeA.lineage.sourceFingerprint }
};
const untaggedResult = evaluateWithReplacementArray(untaggedPdArray);
assert.equal(untaggedResult.deliverySequence.status, "PD_ARRAY_RANGE_INVALID");
assert.equal(untaggedResult.geometry, undefined);

const sequenceSource = fs.readFileSync(new URL("../src/lib/ictI3/marketMakerDeliverySequence.ts", import.meta.url), "utf8");
assert.doesNotMatch(sequenceSource, /!array\.dealingRangeId/);
assert.match(sequenceSource, /array\.dealingRangeId === range\.dealingRangeId/);

const repeated = evaluateNatural("BULLISH", bullishCandles);
assert.equal(repeated.result.candidateId, bullish.result.candidateId);
assert.equal(repeated.result.deliverySequence.sequenceId, bullish.result.deliverySequence.sequenceId);
assert.deepEqual(repeated.result.geometry, bullish.result.geometry);

const future = candle(20, 130, 140, 120, 135);
const futureExtended = evaluateNatural("BULLISH", bullishCandles, [future]);
assert.equal(futureExtended.snapshot.sourceFingerprint, bullish.snapshot.sourceFingerprint);
assert.equal(futureExtended.result.candidateId, bullish.result.candidateId);
assert.equal(futureExtended.result.deliverySequence.sequenceId, bullish.result.deliverySequence.sequenceId);
assert.deepEqual(futureExtended.result.geometry, bullish.result.geometry);

const evaluateFixture = (fixture, direction = "BULLISH") => direction === "BULLISH"
  ? ict.evaluateMarketMakerBuyModel(fixture)
  : ict.evaluateMarketMakerSellModel(fixture);

for (const direction of ["BULLISH", "BEARISH"]) {
  for (const factId of ["pd-location", "engineering", "objective"]) {
    const foreignSource = marketMakerFixture(direction);
    foreignSource.facts.find((fact) => fact.factId === factId).lineage.sourceFingerprint = "foreign-source";
    const result = evaluateFixture(foreignSource, direction);
    assert.notEqual(result.deliverySequence.status, "QUALIFIED");
    assert.equal(result.geometry, undefined, `${direction} ${factId}: failed qualification must never emit geometry`);
    assert.ok(result.blockers.length > 0);
  }
}

const staleArray = marketMakerFixture("BULLISH");
Object.assign(staleArray.facts.find((fact) => fact.factId === "pd-array"), {
  occurredAt: fixtureAt(10), confirmedAt: fixtureAt(10), validFrom: fixtureAt(10)
});
const staleArrayResult = evaluateFixture(staleArray);
assert.equal(staleArrayResult.deliverySequence.status, "SEQUENCE_ORDER_INVALID");
assert.equal(staleArrayResult.state, "PD_ARRAY_REPRICE_FORMING");
assert.equal(staleArrayResult.geometry, undefined);

const equalTimeDisplacement = marketMakerFixture("BULLISH");
Object.assign(equalTimeDisplacement.facts.find((fact) => fact.factId === "displacement"), {
  occurredAt: fixtureAt(5), confirmedAt: fixtureAt(5), validFrom: fixtureAt(5)
});
const equalTimeResult = evaluateFixture(equalTimeDisplacement);
assert.equal(equalTimeResult.deliverySequence.status, "SEQUENCE_ORDER_INVALID");
assert.equal(equalTimeResult.state, "DELIVERY_SEQUENCE_FORMING");

const wrongDirection = marketMakerFixture("BULLISH");
wrongDirection.facts.find((fact) => fact.factId === "displacement").direction = "bearish";
const wrongDirectionResult = evaluateFixture(wrongDirection);
assert.equal(wrongDirectionResult.deliverySequence.status, "WAITING_FOR_DISPLACEMENT");
assert.equal(wrongDirectionResult.state, "DELIVERY_SEQUENCE_FORMING");

const wrongRange = marketMakerFixture("BULLISH");
wrongRange.facts.find((fact) => fact.factId === "pd-array").dealingRangeId = "different-range";
const wrongRangeResult = evaluateFixture(wrongRange);
assert.equal(wrongRangeResult.deliverySequence.status, "PD_ARRAY_RANGE_INVALID");
assert.equal(wrongRangeResult.state, "PD_ARRAY_REPRICE_FORMING");
assert.equal(wrongRangeResult.geometry, undefined);

const outsideRange = marketMakerFixture("BULLISH");
outsideRange.facts.find((fact) => fact.factId === "pd-array").priceRange = [118, 120];
assert.equal(evaluateFixture(outsideRange).deliverySequence.status, "PD_ARRAY_RANGE_INVALID");

const wrongLocation = marketMakerFixture("BULLISH");
wrongLocation.facts.find((fact) => fact.factId === "pd-location").location = "PREMIUM";
const wrongLocationResult = evaluateFixture(wrongLocation);
assert.equal(wrongLocationResult.deliverySequence.status, "PD_LOCATION_INVALID");
assert.equal(wrongLocationResult.state, "RANGE_CONTEXT_ESTABLISHED");

const futureDisplacement = marketMakerFixture("BULLISH");
Object.assign(futureDisplacement.facts.find((fact) => fact.factId === "displacement"), {
  occurredAt: fixtureAt(40), confirmedAt: fixtureAt(40), validFrom: fixtureAt(40)
});
const futureDisplacementResult = evaluateFixture(futureDisplacement);
assert.equal(futureDisplacementResult.deliverySequence.status, "WAITING_FOR_DISPLACEMENT");
assert.equal(futureDisplacementResult.state, "DELIVERY_SEQUENCE_FORMING");

const futureLiquidity = marketMakerFixture("BULLISH");
Object.assign(futureLiquidity.facts.find((fact) => fact.factId === "engineering"), {
  occurredAt: fixtureAt(40), confirmedAt: fixtureAt(40), validFrom: fixtureAt(40), consumedAt: fixtureAt(40)
});
const futureLiquidityResult = evaluateFixture(futureLiquidity);
assert.equal(futureLiquidityResult.deliverySequence.status, "WAITING_FOR_LIQUIDITY_EVENT");
assert.equal(futureLiquidityResult.state, "LIQUIDITY_ENGINEERING_FORMING");

const nonCausalLiquidity = marketMakerFixture("BULLISH");
Object.assign(nonCausalLiquidity.facts.find((fact) => fact.factId === "engineering"), {
  occurredAt: fixtureAt(0), confirmedAt: fixtureAt(0), validFrom: fixtureAt(0), consumedAt: fixtureAt(0)
});
assert.equal(evaluateFixture(nonCausalLiquidity).deliverySequence.status, "WAITING_FOR_LIQUIDITY_EVENT");

const futureArray = marketMakerFixture("BULLISH");
Object.assign(futureArray.facts.find((fact) => fact.factId === "pd-array"), {
  occurredAt: fixtureAt(40), confirmedAt: fixtureAt(40), validFrom: fixtureAt(40)
});
const futureArrayResult = evaluateFixture(futureArray);
assert.equal(futureArrayResult.deliverySequence.status, "WAITING_FOR_PD_ARRAY");
assert.equal(futureArrayResult.state, "PD_ARRAY_REPRICE_FORMING");

const missingObjective = marketMakerFixture("BULLISH");
missingObjective.facts = missingObjective.facts.filter((fact) => fact.factId !== "objective");
const missingObjectiveResult = evaluateFixture(missingObjective);
assert.equal(missingObjectiveResult.deliverySequence.status, "OBJECTIVE_UNAVAILABLE");
assert.equal(missingObjectiveResult.state, "NO_VALID_TARGET");
assert.equal(missingObjectiveResult.geometry, undefined);

const bearishWrongLocation = marketMakerFixture("BEARISH");
bearishWrongLocation.facts.find((fact) => fact.factId === "pd-location").location = "DISCOUNT";
assert.equal(evaluateFixture(bearishWrongLocation, "BEARISH").deliverySequence.status, "PD_LOCATION_INVALID");

for (const contract of [ict.ICT_MMBM_CANONICAL_MODEL, ict.ICT_MMSM_CANONICAL_MODEL]) {
  assert.equal(contract.requiredFactTypes.includes("IRL_ERL_TRANSITION"), false);
  assert.equal(contract.factDependencyIds.some((id) => /irl|erl|transition/i.test(id)), false);
}

console.log(JSON.stringify({
  status: "passed",
  policyId: bullish.result.deliverySequence.policyId,
  bullish: {
    sequenceId: bullish.result.deliverySequence.sequenceId,
    candidateId: bullish.result.candidateId,
    dealingRangeId: bullish.result.deliverySequence.dealingRangeId,
    engineeringLiquidityId: bullish.result.deliverySequence.engineeringLiquidityId,
    displacementId: bullish.result.deliverySequence.displacementId,
    pdArrayId: bullish.result.deliverySequence.pdArrayId,
    targetLiquidityId: bullish.result.deliverySequence.objectiveLiquidityId,
    geometry: bullish.result.geometry
  },
  bearish: {
    sequenceId: bearish.result.deliverySequence.sequenceId,
    candidateId: bearish.result.candidateId,
    dealingRangeId: bearish.result.deliverySequence.dealingRangeId,
    engineeringLiquidityId: bearish.result.deliverySequence.engineeringLiquidityId,
    displacementId: bearish.result.deliverySequence.displacementId,
    pdArrayId: bearish.result.deliverySequence.pdArrayId,
    targetLiquidityId: bearish.result.deliverySequence.objectiveLiquidityId,
    geometry: bearish.result.geometry
  }
}, null, 2));
