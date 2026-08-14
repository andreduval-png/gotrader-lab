#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildBaselineBreakdowns, buildCertifiedPartitionIndex, buildDescriptiveMetrics, LRS_BASELINE_AUTHORITY, loadCertifiedTimeframe, loadLrsBaselineModules, readCertifiedForwardCandles } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "gotrader-lrs-baseline-"));
try {
  const partitionId = `sha256:${"a".repeat(64)}`;
  fs.mkdirSync(path.join(root, "partitions"), { recursive: true });
  fs.writeFileSync(path.join(root, "partitions", `${partitionId.replace(":", "_")}.json`), JSON.stringify({ payload: {
    partitionId, timeframe: "5m", candles: [
      { openTimeUtc: "2025-01-02T14:30:00.000Z", closeTimeUtc: "2025-01-02T14:35:00.000Z", open: 100, high: 102, low: 99, close: 101, spreadPoints: 10 },
      { openTimeUtc: "2025-01-02T14:35:00.000Z", closeTimeUtc: "2025-01-02T14:40:00.000Z", open: 101, high: 103, low: 100, close: 102, spreadPoints: 10 }
    ] } }));
  const manifest = { timeframes: [{ timeframe: "5m", partitionIds: [partitionId], candleCount: 2,
    firstCandleTimeUtc: "2025-01-02T14:30:00.000Z", lastCandleTimeUtc: "2025-01-02T14:40:00.000Z" }] };
  const candles = loadCertifiedTimeframe({ repositoryRoot: root, manifest, timeframe: "5m" });
  assert.equal(candles.length, 2);
  assert.throws(() => loadCertifiedTimeframe({ repositoryRoot: root, manifest: { timeframes: [{ ...manifest.timeframes[0], candleCount: 3 }] }, timeframe: "5m" }), /coverage mismatch/);
  const index = buildCertifiedPartitionIndex({ repositoryRoot: root, manifest, timeframe: "5m" });
  const forward = readCertifiedForwardCandles({ repositoryRoot: root, index, startUtc: "2025-01-02T14:34:00.000Z", maximumCandles: 1 });
  assert.equal(forward.length, 1); assert.equal(forward[0].openTimeUtc, "2025-01-02T14:30:00.000Z");
  const empty = buildDescriptiveMetrics([]);
  assert.deepEqual({ records: empty.records, netWinRate: empty.netWinRate, expectancyNetR: empty.expectancyNetR, profitFactor: empty.profitFactor },
    { records: 0, netWinRate: null, expectancyNetR: null, profitFactor: 0 });
  const metrics = buildDescriptiveMetrics([
    { terminalState: "exited", fillPrice: 100, grossR: 2, netR: 1.9 },
    { terminalState: "exited", fillPrice: 100, grossR: -1, netR: -1.1 },
    { terminalState: "expired_unfilled" }, { terminalState: "ambiguous", fillPrice: 100 }
  ]);
  assert.equal(metrics.records, 4); assert.equal(metrics.filled, 3); assert.equal(metrics.wins, 1); assert.equal(metrics.losses, 1);
  assert.equal(metrics.expiredUnfilled, 1); assert.equal(metrics.ambiguous, 1); assert.equal(metrics.maxDrawdownR, 1.1);
  const breakdowns = buildBaselineBreakdowns([{ opportunity: { direction: "long", decisionAtUtc: "2025-01-02T15:00:00.000Z" },
    record: { terminalState: "exited", fillPrice: 100, grossR: 2, netR: 1.9 } }]);
  assert.equal(breakdowns.byDirection.long.records, 1); assert.equal(breakdowns.byYear["2025"].wins, 1);
  assert.deepEqual(LRS_BASELINE_AUTHORITY, { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" });
  const modules = await loadLrsBaselineModules(path.join(root, "compiled"));
  const profile = await (await import(pathToFileURL(path.join(root, "compiled", "liquidityReclaimScalperParameters.mjs")).href)).buildLrsBaseProfile();
  assert.equal(profile.parameterHash, "sha256:c58d3a0aaff9ba61ece6ea0df2d76145059be36cab9f2347a66a0e6da642f748");
  assert.equal(typeof modules.simulation.simulateTrade, "function");
  console.log(JSON.stringify({ status: "passed", partitionFailClosed: true, zeroEventHonest: true, descriptiveMetrics: true,
    parameterIdentityBound: true, authority: "none/none/none" }, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
