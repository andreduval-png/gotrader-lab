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
assert.equal(unavailable.provenance.datedOutcomes.relationship, "historical_evidence");
assert.equal(unavailable.provenance.tradePlans.relationship, "historical_evidence");

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
const exactReplay = { sourceCycleId: "cycle-current", generatedAt: "2026-08-16T00:00:00.000Z", runId: "replay-current", totalSignals: 9, provenance: identity };
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
assert.equal(exact.provenance.source.sourceCycleId, "cycle-current");
assert.equal(exact.provenance.backtest.sourceCycleId, "cycle-current");
assert.equal(exact.provenance.replay.sourceCycleId, "cycle-current");
assert.equal(exact.provenance.validation.sourceCycleId, "cycle-current");
assert.equal(exact.validation.evidenceScore, 56);

const sourceDrift = buildResultsWorkspaceSnapshot({
  ...common,
  runtimeSnapshot: {
    ...runtime,
    marketData: {
      ...runtime.marketData,
      researchDataFingerprint: "sha256:new-active-window",
      activeResearchSource: {
        ...runtime.marketData.activeResearchSource,
        fingerprint: "sha256:new-active-window"
      }
    }
  }
});
assert.equal(sourceDrift.provenance.source.relationship, "unavailable");

const matchingButUnboundReplay = buildResultsWorkspaceSnapshot({
  ...common,
  latestResearchState: { latestReplay: { ...exactReplay, sourceCycleId: undefined, runId: "manual-replay", provenance: identity } }
});
assert.equal(matchingButUnboundReplay.provenance.replay.relationship, "historical_evidence");
assert.equal(matchingButUnboundReplay.replay.totalSignals, null);

const exactCycleEvidence = buildResultsWorkspaceSnapshot({
  ...common,
  latestResearchState: {
    latestReplay: { ...exactReplay, sourceCycleId: "cycle-current" },
    latestMonteCarlo: {
      sourceCycleId: "cycle-current",
      generatedAt: "2026-08-16T00:00:00.000Z",
      source: "research_cycle_backtest",
      usableOutcomes: 12,
      robustnessRating: "moderate",
      warnings: [],
      provenance: identity,
      researchOnly: true
    }
  },
  walkForward: {
    runId: "wf-current",
    sourceCycleId: "cycle-current",
    startedAt: "2026-08-16T00:00:00.000Z",
    completedAt: "2026-08-16T00:00:00.000Z",
    status: "completed",
    provenance: identity,
    actualWindowsGenerated: 2,
    stability: { windowCount: 2, outOfSampleWindowsPassed: 2, verdict: "robust_research" }
  }
});
assert.equal(exactCycleEvidence.provenance.replay.relationship, "current_cycle");
assert.equal(exactCycleEvidence.provenance.monteCarlo.relationship, "current_cycle");
assert.equal(exactCycleEvidence.provenance.walkForward.relationship, "current_cycle");
assert.equal(exactCycleEvidence.provenance.monteCarlo.sourceCycleId, "cycle-current");
assert.equal(exactCycleEvidence.provenance.walkForward.sourceCycleId, "cycle-current");

const historical = buildResultsWorkspaceSnapshot({
  ...common,
  canonicalMetrics: { ...metrics, sourceCycleId: "cycle-old", totalTrades: 999 },
  latestResearchState: { latestReplay: { ...exactReplay, sourceCycleId: "cycle-old", provenance: { ...identity, sourceFingerprint: "sha256:old" }, totalSignals: 999 } },
  validationChainEntry: { ...exactChain, sourceCycleId: "cycle-old" }
});
assert.equal(historical.backtest.totalTrades, null);
assert.equal(historical.replay.totalSignals, null);
assert.equal(historical.validation.evidenceScore, null);
assert.equal(historical.provenance.backtest.relationship, "unavailable");
assert.equal(historical.provenance.validation.relationship, "historical_evidence");
assert.throws(() => assertResultsWorkspaceSourceTruth({
  ...historical,
  backtest: { ...historical.backtest, totalTrades: 999 }
}), /must be unavailable/);
assert.throws(() => assertResultsWorkspaceSourceTruth({
  ...exact,
  provenance: {
    ...exact.provenance,
    replay: { ...exact.provenance.replay, sourceCycleId: "cycle-stale" }
  }
}), /not immutably bound to the exact current cycle/);

console.log(JSON.stringify({
  status: "passed",
  currentCycleBinding: true,
  activeSourceIdentityBinding: true,
  unboundMatchingEvidenceHistoricalOnly: true,
  unmatchedEvidenceUnavailable: true,
  unknownFrozenProfileFallback: false,
  syntheticMissingZeroes: false,
  authority: "none/none/none"
}, null, 2));
