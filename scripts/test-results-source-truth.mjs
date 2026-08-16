#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gotrader-results-truth-"));
const output = path.join(temp, "results-builder.mjs");
await build({
  entryPoints: [path.join(root, "src/lib/results/buildResultsWorkspaceSnapshot.ts")],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  alias: { "@": path.join(root, "src") },
  logLevel: "silent"
});
const { buildResultsWorkspaceSnapshot, assertResultsWorkspaceSourceTruth } = await import(new URL(`file:///${output.replaceAll("\\", "/")}`));

const identity = {
  strategyProfile: "unregistered_profile",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "sha256:current",
  parameterFingerprint: "sha256:params"
};
const runtime = {
  generatedAt: "2026-08-16T00:00:00.000Z",
  marketData: {
    symbol: "MNQ",
    timeframe: "5m",
    processedCandleCount: 500,
    researchDataFingerprint: identity.sourceFingerprint,
    activeResearchSource: {
      provider: identity.sourceProvider,
      timeframe: identity.timeframe,
      candleCount: 500,
      fingerprint: identity.sourceFingerprint,
      dataQuality: "real_imported",
      provenance: { providerSymbol: identity.brokerSymbol }
    }
  },
  mt5ReadOnly: { brokerSymbol: identity.brokerSymbol },
  activeConfig: { resolvedBacktestConfig: { strategyProfile: identity.strategyProfile } },
  latestResearchCycle: { latestCycleId: "cycle-current" },
  researchIdentity: { active: identity },
  performance: {},
  readiness: { readinessState: "Not Ready", actualBlockers: [], nextAction: "Run validation." },
  evidence: { evidenceQualityScore: 56 },
  maturity: { maturityScore: 42 }
};
const paperDemoState = { candidates: [], dailyChecklists: [], journalEntries: [] };
const predictionLedger = { entries: [] };
const common = { runtimeSnapshot: runtime, paperDemoState, predictionLedger, forwardEvidenceEntries: [] };

const unavailable = buildResultsWorkspaceSnapshot(common);
assert.equal(unavailable.provenance.source.relationship, "current_cycle");
assert.equal(unavailable.frozenProfile.status, "unavailable");
assert.equal(unavailable.frozenProfile.profileId, null);
assert.equal(unavailable.frozenProfile.historicalTrades, null);
assert.equal(unavailable.backtest.totalTrades, null);
assert.equal(unavailable.validation.evidenceScore, null);
assert.equal(unavailable.provenance.validation.relationship, "unavailable");

const noCycle = buildResultsWorkspaceSnapshot({ ...common, runtimeSnapshot: { ...runtime, latestResearchCycle: {} } });
assert.equal(noCycle.provenance.source.relationship, "unavailable");
assertResultsWorkspaceSourceTruth(noCycle);

const metrics = {
  sourceCycleId: "cycle-current",
  generatedAt: "2026-08-16T00:00:00.000Z",
  totalTrades: 12,
  winningTrades: 7,
  losingTrades: 5,
  winRate: 7 / 12,
  averageR: 1.2,
  profitFactor: 1.8,
  maxDrawdownR: 2.1,
  realizedPnL: 1400,
  metricSourceLabel: "canonical current cycle"
};
const exactReplay = { generatedAt: "2026-08-16T00:00:00.000Z", runId: "replay-current", totalSignals: 9, provenance: identity };
const exactChain = {
  recognitionId: "recognition-current",
  setupLabel: identity.strategyProfile,
  sourceCycleId: "cycle-current",
  sourceFingerprint: identity.sourceFingerprint,
  provenance: identity,
  provenanceStatus: "matched",
  hypothesisStatus: "validated",
  blockers: [],
  updatedAt: "2026-08-16T00:00:00.000Z",
  nextAction: "Collect forward evidence.",
  replayResult: { verdict: "passed" },
  evidenceQuality: { evidenceQualityScore: 56, maturityScore: 42 }
};
const exact = buildResultsWorkspaceSnapshot({
  ...common,
  canonicalMetrics: metrics,
  latestResearchState: { latestReplay: exactReplay },
  validationChainEntry: exactChain
});
assert.equal(exact.backtest.totalTrades, 12);
assert.equal(exact.replay.totalSignals, 9);
assert.equal(exact.provenance.replay.relationship, "current_cycle");
assert.equal(exact.validation.evidenceScore, 56);

const historical = buildResultsWorkspaceSnapshot({
  ...common,
  canonicalMetrics: { ...metrics, sourceCycleId: "cycle-old", totalTrades: 999 },
  latestResearchState: { latestReplay: { ...exactReplay, provenance: { ...identity, sourceFingerprint: "sha256:old" }, totalSignals: 999 } },
  validationChainEntry: { ...exactChain, sourceCycleId: "cycle-old" }
});
assert.equal(historical.backtest.totalTrades, null);
assert.equal(historical.replay.totalSignals, null);
assert.equal(historical.validation.evidenceScore, null);
assert.equal(historical.provenance.backtest.relationship, "unavailable");
assert.equal(historical.provenance.validation.relationship, "unavailable");
assert.throws(() => assertResultsWorkspaceSourceTruth({
  ...historical,
  backtest: { ...historical.backtest, totalTrades: 999 }
}), /must be unavailable/);

console.log(JSON.stringify({
  status: "passed",
  currentCycleBinding: true,
  unmatchedEvidenceUnavailable: true,
  unknownFrozenProfileFallback: false,
  syntheticMissingZeroes: false,
  authority: "none/none/none"
}, null, 2));
