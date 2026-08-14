#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildBaselineBreakdowns, buildCertifiedPartitionIndex, buildDescriptiveMetrics, buildScanCheckpointCore,
  classifyLrsMemoryPressure, compactLegacyScanCheckpoint, discoverCandidates, LRS_BASELINE_AUTHORITY,
  LRS_BASELINE_MAX_RSS_BYTES, LRS_BASELINE_SOFT_RECYCLE_RSS_BYTES, loadCertifiedTimeframe, loadLrsBaselineModules,
  migrateV3ScanCheckpoint, readCertifiedForwardCandles } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";

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
  const mutableCandidates = [{ candidateId: "one", state: "ENTRY_ELIGIBLE", blockers: [] }];
  const checkpoint = buildScanCheckpointCore({ nextSegment: 1, candidateCount: 2, duplicateCandidateCount: 0, setupCount: 1, expiredSetupCount: 0,
    eligibleCandidates: mutableCandidates, seenCandidateIds: ["one"], seenFactIds: ["b", "a"] });
  mutableCandidates.push({ candidateId: "two" });
  assert.equal(mutableCandidates.length, 2); assert.equal(checkpoint.eligibleCandidates.length, 1); assert.deepEqual(checkpoint.seenFactIds, ["a", "b"]);
  const compacted = compactLegacyScanCheckpoint({ schemaVersion: "gotrader-lrs-baseline-scan-checkpoint-v1", nextSegment: 3,
    candidates: [{ candidateId: "search", state: "SEARCHING", blockers: ["pending"] },
      { candidateId: "eligible", state: "ENTRY_ELIGIBLE", blockers: [] },
      { candidateId: "eligible", state: "ENTRY_ELIGIBLE", blockers: [] },
      { candidateId: "expired", state: "SETUP_EXPIRED", blockers: ["expired"] }], seenFactIds: ["z"] });
  assert.equal(compacted.schemaVersion, "gotrader-lrs-baseline-scan-checkpoint-v4");
  assert.equal(compacted.candidateCount, 3); assert.equal(compacted.duplicateCandidateCount, 1);
  assert.equal(compacted.setupCount, 2); assert.equal(compacted.expiredSetupCount, 1);
  assert.deepEqual(compacted.eligibleCandidates.map((item) => item.candidateId), ["eligible"]); assert.equal("candidates" in compacted, false);
  assert.deepEqual(compacted.seenCandidateIds, ["eligible", "expired", "search"]);
  const migrated = migrateV3ScanCheckpoint({ ...checkpoint, schemaVersion: "gotrader-lrs-baseline-scan-checkpoint-v3" });
  assert.equal(migrated.schemaVersion, "gotrader-lrs-baseline-scan-checkpoint-v4");
  assert.deepEqual(migrated.seenFactIds, checkpoint.seenFactIds);
  assert.equal(classifyLrsMemoryPressure(LRS_BASELINE_SOFT_RECYCLE_RSS_BYTES - 1), "continue");
  assert.equal(classifyLrsMemoryPressure(LRS_BASELINE_SOFT_RECYCLE_RSS_BYTES), "controlled_recycle");
  assert.equal(classifyLrsMemoryPressure(LRS_BASELINE_MAX_RSS_BYTES + 1), "hard_limit_exceeded");
  assert.throws(() => classifyLrsMemoryPressure(-1), /Invalid/);

  const event = (suffix, causalClosedCandleTime) => ({ kind: "fair_value_gap", causalClosedCandleTime,
    payload: { direction: "bullish", confirmationCandleTime: causalClosedCandleTime, lowerBound: 100,
      upperBound: 101 + suffix, inversionTime: causalClosedCandleTime, preInversionUsage: "unused",
      inversionBarsAfterConfirmation: 1, gapType: "fvg", state: "inverted" } });
  const events = [event(1, "2025-01-02T14:35:00.000Z"), event(2, "2025-01-02T14:40:00.000Z")];
  const discoveryModules = {
    identity: { createV2SourceIdentity: (value) => value },
    candle: { buildV2CanonicalCandleWindow: async (value) => value },
    context: { buildV2CanonicalMarketContext: async (value) => ({ ...value, diagnostics: { status: "passed", blockers: [] },
      facts: value.asOfMarketTime === "2025-01-03T00:00:00.000Z" ? events : [] }) },
    detector: { detectLiquidityReclaimScalper: async ({ setupCreatedAt }) => ({ candidateId: `candidate:${setupCreatedAt}`,
      state: "ENTRY_ELIGIBLE", blockers: [], entryEligibleAt: setupCreatedAt }) }
  };
  const qualified = { certificate: { datasetId: "sha256:dataset", provider: "fixture", requestedSymbol: "MNQ",
    brokerSymbol: "USTECH", sourceFingerprint: "sha256:source", startUtc: "2025-01-02T00:00:00.000Z",
    endUtc: "2025-01-03T00:00:00.000Z", certificateId: "sha256:certificate" } };
  const discoveryCandles = [{ openTimeUtc: "2025-01-02T14:30:00.000Z", closeTimeUtc: "2025-01-03T00:00:00.000Z",
    open: 100, high: 102, low: 99, close: 101, volume: 1 }];
  const interruptedWrites = [];
  let releaseCount = 0;
  const interrupted = await discoverCandidates({ modules: discoveryModules, qualified, m5: discoveryCandles,
    m15: discoveryCandles, parameters: {}, writeCheckpoint: async (value) => interruptedWrites.push(value),
    readRssBytes: () => LRS_BASELINE_SOFT_RECYCLE_RSS_BYTES, releaseTransientMemory: () => { releaseCount += 1; } });
  assert.equal(interrupted.reason, "controlled_memory_recycle");
  assert.equal(interrupted.checkpoint.nextSegment, 0);
  assert.equal(interrupted.checkpoint.candidateCount, 1);
  assert.equal(interrupted.checkpoint.seenFactIds.length, 1);
  assert.equal(releaseCount, 1);
  const resumedWrites = [];
  const resumed = await discoverCandidates({ modules: discoveryModules, qualified, m5: discoveryCandles,
    m15: discoveryCandles, parameters: {}, checkpoint: interrupted.checkpoint,
    writeCheckpoint: async (value) => resumedWrites.push(value), readRssBytes: () => 0 });
  assert.equal(resumed.interrupted, false);
  assert.equal(resumed.checkpoint.nextSegment, 1);
  assert.equal(resumed.checkpoint.candidateCount, 2);
  assert.equal(resumed.checkpoint.seenFactIds.length, 2);
  const uninterrupted = await discoverCandidates({ modules: discoveryModules, qualified, m5: discoveryCandles,
    m15: discoveryCandles, parameters: {}, writeCheckpoint: async () => {}, readRssBytes: () => 0 });
  assert.deepEqual(resumed.checkpoint, uninterrupted.checkpoint);
  const modules = await loadLrsBaselineModules(path.join(root, "compiled"));
  const profile = await (await import(pathToFileURL(path.join(root, "compiled", "liquidityReclaimScalperParameters.mjs")).href)).buildLrsBaseProfile();
  assert.equal(profile.parameterHash, "sha256:c58d3a0aaff9ba61ece6ea0df2d76145059be36cab9f2347a66a0e6da642f748");
  assert.equal(typeof modules.simulation.simulateTrade, "function");
  const boundedSource = fs.readFileSync(path.join(process.cwd(), "scripts/run-liquidity-reclaim-scalper-baseline-bounded.mjs"), "utf8");
  assert.match(boundedSource, /segmentsPerChild < 1 \|\| segmentsPerChild > 10/);
  const runnerSource = fs.readFileSync(path.join(process.cwd(), "scripts/support/liquidity-reclaim-scalper-baseline-runner.mjs"), "utf8");
  assert.ok(runnerSource.indexOf("if (discovery.interrupted) return withResources(discovery)") <
    runnerSource.indexOf("const m1Index = buildCertifiedPartitionIndex"));
  console.log(JSON.stringify({ status: "passed", partitionFailClosed: true, zeroEventHonest: true, descriptiveMetrics: true,
    parameterIdentityBound: true, eventCheckpointRestartParity: true, controlledMemoryRecycle: true,
    authority: "none/none/none" }, null, 2));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
