#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { ict2022Fixture, loadIctI2, po3Fixture } from "./ict-i2-test-harness.mjs";

const ict = await loadIctI2();
const candidates = [
  ict.evaluateIct2022Model(ict2022Fixture()),
  ict.evaluateIctPowerOfThree({ ...po3Fixture(), dataset: ict2022Fixture().dataset })
];
for (const candidate of candidates) {
  const adapted = ict.adaptIctI2CandidateToBt2(candidate);
  assert.equal(adapted.status, "ready");
  assert.equal(adapted.request.ambiguityPolicyOwner, "BT2");
  assert.equal(adapted.request.outcomePolicyOwner, "BT2");
  assert.equal(adapted.request.symbol, "NQ");
  assert.equal(adapted.request.timeframe, "5m");
  assert.equal(adapted.request.canonicalGeometry.stop.price, adapted.request.invalidation);
  assert.equal(adapted.request.canonicalGeometry.target.price, adapted.request.targetLiquidity);
  assert.equal(
    adapted.request.canonicalGeometry.entry.intendedPrice,
    (adapted.request.entryZone[0] + adapted.request.entryZone[1]) / 2
  );
  assert.equal(adapted.request.canonicalGeometry.actionable, false);
  assert.equal(adapted.request.canonicalGeometry.authority.execution, "none");
  assert(!("outcome" in adapted.request));
  assert(ict.assertCompactIctI2Bt2Request(adapted.request).ok);
}
assert.equal(ict.adaptIctI2CandidateToBt2(ict.evaluateIctJudasSwing(ict2022Fixture())).status, "blocked");

// Exercise the existing BT2 conservative same-bar policy without adding an I2 shortcut.
const source = fs.readFileSync(path.join(process.cwd(), "src/lib/backtesting/outcomeScoring.ts"), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const runtimePath = path.join(process.cwd(), ".gotrader", `ict-i2-outcome-scoring-${process.pid}.mjs`);
fs.writeFileSync(runtimePath, output, "utf8");
const { scoreSimulatedTradeOutcome } = await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);
const candle = (id, minute, high, low, close = 100) => ({ id, symbol: "NQ", timeframe: "5m", timestamp: new Date(Date.UTC(2026, 0, 5, 14, minute)).toISOString(), open: 100, high, low, close, volume: 1 });
const decision = {
  id: "decision",
  decisionIndex: 0,
  candle: candle("decision-candle", 0, 100, 100),
  agentOpinions: [],
  thesis: {
    id: "thesis",
    symbol: "NQ",
    timeframe: "5m",
    session: "New York AM",
    marketRegime: "trend",
    finalBias: "bullish",
    confidence: 1,
    simulatedTradePlan: { entryZone: [100, 100], invalidation: 95, targetLiquidity: 110, riskReward: 2 }
  }
};
const sameBar = scoreSimulatedTradeOutcome(decision, [decision.candle, candle("same-bar", 5, 111, 94)], 1);
assert.equal(sameBar.outcome, "stop_hit");
const entryStop = scoreSimulatedTradeOutcome(decision, [decision.candle, candle("entry-stop", 5, 101, 94)], 1);
assert.equal(entryStop.outcome, "stop_hit");
const entryTarget = scoreSimulatedTradeOutcome(decision, [decision.candle, candle("entry-target", 5, 111, 99)], 1);
assert.equal(entryTarget.outcome, "target_hit");

console.log(JSON.stringify({ status: "passed", requests: candidates.length, sameBarOwner: "BT2", ambiguityPolicy: "stop_first" }, null, 2));
