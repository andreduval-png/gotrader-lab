import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  cacheDir: ".gotrader/p3-scoring-cache",
  server: { middlewareMode: true }, appType: "custom", logLevel: "silent"
});
try {
  const { scoreCanonicalHistoricalGeometryWithBt2: score } =
    await server.ssrLoadModule("/src/lib/backtesting/canonicalBt2FoldScoring.ts");
  const bar = (index, open, high, low, close) => ({
    timestamp: new Date(Date.UTC(2025, 0, 2, 14, index * 5)).toISOString(),
    open, high, low, close
  });
  const geometry = {
    geometryId: "synthetic", canonicalGeometryParityHash: "synthetic",
    direction: "LONG", intendedEntry: 100, intendedStop: 95, intendedTarget: 110,
    theoreticalRR: 2, entryLifecycleStatus: "ENTRY_TOUCHED_NOT_FILLED"
  };
  const run = (candles, overrides = {}) => score({
    geometry, candles, decisionIndex: 0, maxBarsToResolveTrade: 5,
    tickSize: 0.25, spreadTicks: 0, slippageTicks: 0, commissionTicks: 0,
    ...overrides
  });
  const decision = bar(0, 100, 115, 90, 101);
  assert.equal(run([decision, bar(1, 102, 103, 101, 102)]).outcome, "entry_not_retraced");
  const fill = bar(1, 101, 102, 99, 101);
  const expired = run([decision, fill]);
  assert.equal(expired.outcome, "expired");
  assert.equal(expired.entryIndex, 1);
  assert.equal(expired.realizedR, 0);
  assert.equal(expired.unrealizedR, 0.2);
  const gap = run([decision, fill, bar(2, 90, 92, 89, 91)]);
  assert.equal(gap.outcome, "stop_hit");
  assert.equal(gap.realizedR, -2);
  const ambiguous = run([decision, bar(1, 100, 112, 94, 102)]);
  assert.equal(ambiguous.outcome, "stop_hit");
  assert.equal(ambiguous.sameBarAmbiguous, true);
  const short = run([decision, fill, bar(2, 110, 112, 109, 111)], {
    geometry: { ...geometry, direction: "SHORT", intendedStop: 105, intendedTarget: 90 }
  });
  assert.equal(short.realizedR, -2);
  assert.throws(() => run([decision], { spreadTicks: -1 }), /INVALID_SCORING_INPUT/);
  assert.throws(() => run([decision], { decisionIndex: -1 }), /INVALID_SCORING_INPUT/);
  console.log("PASS: post-decision fills, long/short gap stops, conservative ambiguity, unrealized accounting, input guards");
} finally {
  await server.close();
}
