#!/usr/bin/env node
import assert from "node:assert/strict";
import { at, ict2022Fixture, loadIctI2 } from "./ict-i2-test-harness.mjs";

const ict = await loadIctI2();
const fixture = ict2022Fixture();
const atTen = { ...fixture, asOf: at(10), candlesByTimeframe: { "5m": [] } };
const earlier = ict.evaluateIct2022Model(atTen);
assert.equal(earlier.state, "DISPLACEMENT_CONFIRMED", "future MSS and FVG cannot validate an earlier entry");

const futureExtended = ict2022Fixture();
futureExtended.candlesByTimeframe["5m"].push({
  ...futureExtended.candlesByTimeframe["5m"][0],
  id: "future",
  timestamp: at(55),
  high: 120,
  low: 80
});
assert.deepEqual(ict.evaluateIct2022Model(futureExtended), ict.evaluateIct2022Model(fixture), "future candle extension must not rewrite fixed-asOf state");

const fvgBeforeRaid = ict2022Fixture();
const fvg = fvgBeforeRaid.facts.find((fact) => fact.factType === "FVG");
fvg.occurredAt = fvg.confirmedAt = fvg.validFrom = at(0);
assert.equal(ict.evaluateIct2022Model(fvgBeforeRaid).state, "MSS_CONFIRMED", "an FVG before the raid cannot become the entry zone");

const futureDraw = ict2022Fixture();
const draw = futureDraw.facts.find((fact) => fact.factType === "DRAW_ON_LIQUIDITY");
draw.occurredAt = draw.confirmedAt = draw.validFrom = at(50);
assert.equal(ict.evaluateIct2022Model(futureDraw).state, "SEARCHING", "future draw cannot alter an earlier target");

console.log(JSON.stringify({ status: "passed", model: "ict_2022_model_v1", futureExtensionInvariant: true }, null, 2));
