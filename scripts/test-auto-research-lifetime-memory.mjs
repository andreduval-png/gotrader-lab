#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "auto-research-lifetime-memory-test");

const compile = (sourceRelative, outputName, replacements = []) => {
  const sourcePath = path.join(root, sourceRelative);
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(
    path.join(outRoot, outputName),
    replacements.reduce((value, [from, to]) => value.replaceAll(from, to), output),
    "utf8"
  );
};

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const safety = {
  rawCandlesExcluded: true,
  rawRuntimeSnapshotsExcluded: true,
  importedOhlcvArraysExcluded: true,
  accountDataExcluded: true,
  orderDataExcluded: true,
  positionDataExcluded: true,
  secretsExcluded: true,
  screenshotsBase64Excluded: true,
  readinessPromotionAllowed: false
};

const aggregateFor = ({ config, fingerprint, cycles, trades, dates, averageR, positive, negative, blockers }) => ({
  identity: {
    identityKey: `${config.strategyProfile}|${fingerprint}|mnq|ustech|5m|mt5_read_only`,
    strategyProfile: config.strategyProfile,
    parameterFingerprint: fingerprint,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceProvider: "mt5_read_only"
  },
  firstCompletedAt: "2026-06-01T00:00:00.000Z",
  lastCompletedAt: "2026-07-19T00:00:00.000Z",
  cycleCount: cycles,
  independentCycleDates: dates,
  sourceFingerprintCount: dates,
  totalTrades: trades,
  winningTrades: Math.round(trades * 0.55),
  losingTrades: Math.round(trades * 0.45),
  winRate: 0.55,
  weightedAverageR: averageR,
  totalRealizedR: trades * averageR,
  worstMaxDrawdownR: averageR > 0 ? 4 : 10,
  weightedProfitFactor: averageR > 0 ? 2.2 : 0.8,
  positiveEdgeCycles: positive,
  promisingCycles: 0,
  negativeEdgeCycles: negative,
  noSampleCycles: 0,
  oosTrades: trades,
  oosWindowsPassed: positive,
  oosWindowsTested: Math.max(positive, negative),
  walkForwardPassedCycles: positive,
  monteCarloRobustCycles: positive,
  latestResultClass: averageR > 0 ? "positive_edge" : "negative_edge",
  recurringBlockers: blockers.map((blocker, index) => ({ blocker, occurrences: blockers.length - index + 1 })),
  latestNextAction: "Run the next bounded deterministic experiment.",
  authority
});

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/validationProvenance/validationProvenance.ts", "validationProvenance.mjs");
  compile(
    "src/lib/autoResearch/prioritizeCandidatesWithLifetimeEvidence.ts",
    "prioritizeCandidatesWithLifetimeEvidence.mjs",
    [["@/lib/validationProvenance", "./validationProvenance.mjs"]]
  );

  const validation = await import(pathToFileURL(path.join(outRoot, "validationProvenance.mjs")).href);
  const planner = await import(pathToFileURL(path.join(outRoot, "prioritizeCandidatesWithLifetimeEvidence.mjs")).href);

  const positiveConfig = { strategyProfile: "ifvg_fresh_retest_v3_research", minimumConfluenceThreshold: 0.6 };
  const failedConfig = { strategyProfile: "failed_parameter_family", minimumConfluenceThreshold: 0.2 };
  const unseenConfig = { strategyProfile: "ifvg_fresh_retest_v4_candidate", minimumConfluenceThreshold: 0.72 };
  const smallNegativeConfig = { strategyProfile: "small_negative_sample", minimumConfluenceThreshold: 0.64 };
  const positiveFingerprint = validation.fingerprintValidationParameters(positiveConfig);
  const failedFingerprint = validation.fingerprintValidationParameters(failedConfig);
  const smallNegativeFingerprint = validation.fingerprintValidationParameters(smallNegativeConfig);
  const activeIdentity = {
    strategyProfile: positiveConfig.strategyProfile,
    parameterFingerprint: positiveFingerprint,
    sourceProvider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceFingerprint: "current_mt5_window"
  };
  const aggregateIndex = {
    schemaVersion: 1,
    generatedAt: "2026-07-19T00:00:00.000Z",
    totalRecords: 10,
    totalProfiles: 2,
    aggregates: [
      aggregateFor({
        config: positiveConfig,
        fingerprint: positiveFingerprint,
        cycles: 6,
        trades: 120,
        dates: 6,
        averageR: 1.4,
        positive: 5,
        negative: 1,
        blockers: ["Walk-forward sample needs more independent dates.", "Maximum drawdown needs conservative review."]
      }),
      aggregateFor({
        config: failedConfig,
        fingerprint: failedFingerprint,
        cycles: 4,
        trades: 80,
        dates: 4,
        averageR: -0.3,
        positive: 0,
        negative: 4,
        blockers: ["Negative expectancy persisted across OOS windows."]
      }),
      aggregateFor({
        config: smallNegativeConfig,
        fingerprint: smallNegativeFingerprint,
        cycles: 1,
        trades: 8,
        dates: 1,
        averageR: -0.1,
        positive: 0,
        negative: 1,
        blockers: ["Trade sample is too small."]
      })
    ],
    authority,
    safety
  };
  const candidates = [
    {
      candidateId: "candidate_failed",
      label: "Failed exact identity",
      rationale: "Regression identity",
      searchMode: "standard",
      config: failedConfig,
      changedParameters: ["strategyProfile"],
      candidateFamily: "ifvg_filtered_v2_research"
    },
    {
      candidateId: "candidate_unseen",
      label: "New conservative risk experiment",
      rationale: "Target the recurring drawdown blocker.",
      searchMode: "standard",
      config: unseenConfig,
      changedParameters: ["strategyProfile", "confluenceThreshold"],
      candidateFamily: "ifvg_fresh_retest_v4_candidate"
    },
    {
      candidateId: "candidate_small_negative",
      label: "Small negative sample",
      rationale: "Keep a small unresolved sample neutral.",
      searchMode: "standard",
      config: smallNegativeConfig,
      changedParameters: ["strategyProfile"],
      candidateFamily: "ifvg_filtered_v2_research"
    },
    {
      candidateId: "candidate_positive",
      label: "Positive identity confirmation",
      rationale: "Collect another independent validation cycle.",
      searchMode: "standard",
      config: positiveConfig,
      changedParameters: ["strategyProfile"],
      candidateFamily: "ifvg_fresh_retest_v3_research"
    }
  ];

  const standard = planner.prioritizeCandidatesWithLifetimeEvidence({
    candidates,
    aggregateIndex,
    activeIdentity,
    searchMode: "standard"
  });
  assert.deepEqual(standard.candidates.map((candidate) => candidate.candidateId), [
    "candidate_positive",
    "candidate_unseen",
    "candidate_small_negative"
  ]);
  assert.deepEqual(standard.plan.excludedCandidateIds, ["candidate_failed"]);
  assert.equal(standard.excludedCandidates[0].lifetimeEvidenceDecision.disposition, "deprioritize_failed_identity");
  assert.equal(standard.candidates[0].lifetimeEvidenceDecision.disposition, "prioritize_unresolved_blocker");
  assert.equal(standard.candidates.at(-1).lifetimeEvidenceDecision.disposition, "neutral_insufficient_history");
  assert.equal(standard.plan.compatibleActiveProfileFound, true);
  assert.ok(standard.plan.recurringBlockers.some((item) => item.family === "evidence_depth"));
  assert.ok(standard.plan.recurringBlockers.some((item) => item.family === "risk_stability"));

  const deep = planner.prioritizeCandidatesWithLifetimeEvidence({
    candidates,
    aggregateIndex,
    activeIdentity,
    searchMode: "deep"
  });
  assert.equal(deep.excludedCandidates.length, 0);
  assert.equal(deep.candidates.at(-1).candidateId, "candidate_failed");
  assert.equal(deep.candidates.at(-1).lifetimeEvidenceDecision.disposition, "regression_diagnostic_only");

  const missingIdentity = planner.prioritizeCandidatesWithLifetimeEvidence({
    candidates,
    aggregateIndex,
    searchMode: "standard"
  });
  assert.equal(missingIdentity.plan.compatibleActiveProfileFound, false);
  assert.equal(missingIdentity.plan.excludedCandidateIds.length, 0);
  assert.match(missingIdentity.plan.summary, /identity was incomplete/i);
  assert.deepEqual(standard.plan.authority, authority);
  assert.doesNotMatch(JSON.stringify(standard), /"(?:candles|rawCandles|accountData|orderData|positionData|secret|apiKey)"\s*:/i);

  const runSource = fs.readFileSync(path.join(root, "src/lib/autoResearch/runAutoResearchCycle.ts"), "utf8");
  assert.match(runSource, /prioritizeCandidatesWithLifetimeEvidence/);
  assert.match(runSource, /loadResearchEvidenceAggregateIndex/);
  assert.match(runSource, /lifetimeExperimentPlan/);

  console.log(JSON.stringify({
    status: "passed",
    prioritized: standard.candidates.map((candidate) => candidate.candidateId),
    excluded: standard.plan.excludedCandidateIds,
    recurringBlockerFamilies: standard.plan.recurringBlockers.map((item) => item.family),
    authority: standard.plan.authority
  }, null, 2));
}

main().catch((error) => {
  console.error("Auto Research lifetime-memory test failed:", error);
  process.exitCode = 1;
});
