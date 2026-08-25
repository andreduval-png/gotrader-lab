#!/usr/bin/env node
import assert from "node:assert/strict";
import { loadIctI3, marketMakerFixture } from "./ict-i3-test-harness.mjs";

const ict = await loadIctI3();
const registry = ict.assertIctI3Registry();
assert.equal(registry.length, 3);
assert.equal(ict.executableIctI3Registry().length, 2);
assert.equal(registry.find((entry) => entry.modelId === "mmxm_delivery_framework_v1").executable, false);
assert.equal(ict.ICT_I3_SOURCE_PACKET.status, "RESOLVED_FOR_BOUNDED_RESEARCH");

const candidate = ict.evaluateMarketMakerBuyModel(marketMakerFixture("BULLISH"));
assert.equal(candidate.context.classification, "framework_context");
assert.equal(candidate.context.frameworkId, "gotrader.ict.i3.mmxm-delivery-framework.v1");
assert.equal(candidate.context.liquidityEventId, "engineering");
assert.equal(candidate.context.objectiveLiquidityId, "objective");
assert(!("candles" in candidate.context));

console.log(JSON.stringify({
  status: "passed",
  framework: candidate.context.frameworkId,
  executableModels: ict.executableIctI3Registry().map((entry) => entry.modelId)
}, null, 2));
