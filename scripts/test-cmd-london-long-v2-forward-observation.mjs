#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "cmd-london-long-v2-forward-observation");
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };

const compile = (sourceRelative, outputName, replacements = []) => {
  const sourcePath = path.join(root, sourceRelative);
  const outputPath = path.join(outRoot, outputName);
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, replacements.reduce((value, [from, to]) => value.replaceAll(from, to), output), "utf8");
};

const detectedAt = "2026-07-20T06:30:00.000Z";
const opportunity = {
  opportunityId: "cmd-v2-forward-opportunity",
  family: "consolidation_manipulation_distribution",
  detectedAt,
  session: "london",
  side: "long",
  entryReference: 100,
  invalidationReference: 98,
  targetReference: 104,
  targetBasis: "external_liquidity",
  rr: 2,
  evidence: ["Causal consolidation, sweep, displacement, and external target."],
  outcome: "expired",
  researchOnly: true
};

const context = {
  sourceProvider: "mt5_push_feed",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "mt5|USTECH|5m|2026-07-20T06:30:00.000Z|100|received",
  closedCandleTimestamp: detectedAt
};

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/marketEpisodes/cmdLondonLongProfileTypes.ts", "cmdLondonLongProfileTypes.mjs");
  compile("src/lib/marketEpisodes/cmdLondonLongExternalTargetV2.ts", "cmdLondonLongExternalTargetV2.mjs", [
    ["./cmdLondonLongProfileTypes", "./cmdLondonLongProfileTypes.mjs"]
  ]);
  compile("src/lib/predictionLedger/predictionLedgerTypes.ts", "predictionLedgerTypes.mjs");
  compile("src/lib/predictionLedger/predictionLedger.ts", "predictionLedger.mjs", [
    ["./predictionLedgerTypes", "./predictionLedgerTypes.mjs"]
  ]);

  const profileModule = await import(pathToFileURL(path.join(outRoot, "cmdLondonLongExternalTargetV2.mjs")).href);
  const ledgerModule = await import(pathToFileURL(path.join(outRoot, "predictionLedger.mjs")).href);

  const eligible = profileModule.assessCmdLondonLongExternalTargetV2Observation({ opportunity, ...context });
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.freshCohort, true);
  assert.equal(eligible.inheritedOutcomeCount, 0);
  assert.equal(eligible.paperDemoEligible, false);

  const projectedTarget = profileModule.assessCmdLondonLongExternalTargetV2Observation({
    opportunity: { ...opportunity, targetBasis: "minimum_2r_projection" },
    ...context
  });
  assert.equal(projectedTarget.eligible, false);
  assert.match(projectedTarget.blockers.join(" "), /external liquidity/i);

  const historical = profileModule.assessCmdLondonLongExternalTargetV2Observation({
    opportunity: { ...opportunity, detectedAt: "2026-07-17T06:30:00.000Z" },
    ...context,
    closedCandleTimestamp: "2026-07-17T06:30:00.000Z"
  });
  assert.equal(historical.eligible, false);
  assert.match(historical.blockers.join(" "), /predates/i);

  const stale = profileModule.assessCmdLondonLongExternalTargetV2Observation({
    opportunity,
    ...context,
    closedCandleTimestamp: "2026-07-20T06:35:00.000Z"
  });
  assert.equal(stale.eligible, false);
  assert.match(stale.blockers.join(" "), /current closed candle/i);

  const entry = ledgerModule.issuePredictionFromMarketOpportunity({
    opportunity,
    sourceProvider: context.sourceProvider,
    requestedSymbol: context.requestedSymbol,
    brokerSymbol: context.brokerSymbol,
    timeframe: context.timeframe,
    sourceFingerprint: context.sourceFingerprint,
    modelVersion: profileModule.CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID,
    scenarioFamily: "cmd_london_long_external_target",
    maxBarsToResolve: 48
  });
  assert.equal(entry.modelVersion, "cmd_london_long_external_target_v2_research");
  assert.equal(entry.lifecycleState, "triggered");
  assert.equal(entry.probabilitySource, "heuristic_uncalibrated");
  assert.equal(entry.calibrationSampleSize, 0);
  assert.equal(entry.expectedR, 2);
  assert.equal(entry.resolution, "pending");
  assert.equal(entry.safety.autoPromotionAllowed, false);
  assert.equal(entry.safety.executionIntentCreated, false);
  assert.deepEqual(entry.authority, authority);

  const resolved = ledgerModule.updatePredictionWithClosedCandle(entry, {
    timestamp: "2026-07-20T06:35:00.000Z",
    high: 104.2,
    low: 99.8,
    close: 104,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceFingerprint: "mt5-next-close"
  });
  assert.equal(resolved.resolution, "target_first");
  assert.equal(resolved.realizedR, 2);

  const oldV1 = { ...resolved, predictionId: "old-v1", modelVersion: "cmd_london_long_episode_v1" };
  const freshV2Only = [oldV1, resolved].filter(
    (item) => item.modelVersion === profileModule.CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID
  );
  const freshSummary = ledgerModule.evaluatePredictionCalibration(freshV2Only, "cmd_london_long_external_target");
  assert.equal(freshSummary.totalForecasts, 1);
  assert.equal(freshSummary.classification, "uncalibrated");

  const integrationSource = fs.readFileSync(path.join(root, "src/lib/predictionLedger/predictionLedgerIntegration.ts"), "utf8");
  const appSource = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  const cycleSource = fs.readFileSync(path.join(root, "src/lib/researchCycle/runResearchCycle.ts"), "utf8");
  assert.match(integrationSource, /entry\.modelVersion === CMD_LONDON_LONG_EXTERNAL_TARGET_V2_ID/);
  assert.match(integrationSource, /inheritedV1OutcomeCount:\s*0/);
  assert.match(appSource, /subscribeFrozenMarketEpisodeProfilesToMt5PushFeed/);
  assert.match(cycleSource, /recordFrozenMarketEpisodeProfileObservationsFromClosedCandle/);
  assert.doesNotMatch(cycleSource, /recordCmdLondonLongForwardObservation/);

  const compact = {
    status: "passed",
    profileId: entry.modelVersion,
    eligible: eligible.eligible,
    staleBlocked: !stale.eligible,
    projectedTargetBlocked: !projectedTarget.eligible,
    historicalBackfillBlocked: !historical.eligible,
    calibrationSampleSize: entry.calibrationSampleSize,
    inheritedV1OutcomeCount: 0,
    forwardResolution: resolved.resolution,
    paperDemoEligible: false,
    authority,
    safety: entry.safety
  };
  const serialized = JSON.stringify(compact);
  assert.doesNotMatch(serialized, /"(?:candles|rawCandles|rawSnapshot|account|orders|positions|apiKey|token|secret)"\s*:/i);
  assert.doesNotMatch(serialized, /"(?:paperDemoEligible|autoPromotionAllowed|executionIntentCreated)"\s*:\s*true/i);
  console.log(JSON.stringify(compact, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
