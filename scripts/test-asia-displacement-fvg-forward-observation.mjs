#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "asia-displacement-fvg-forward-observation");
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

const detectedAt = "2026-07-20T01:30:00.000Z";
const opportunity = {
  opportunityId: "asia-dfvg-v2-forward-opportunity",
  family: "displacement_fvg_continuation",
  detectedAt,
  session: "asia",
  side: "short",
  entryReference: 100,
  invalidationReference: 102,
  targetReference: 96,
  targetBasis: "external_liquidity",
  rr: 2,
  evidence: ["Causal bearish displacement and FVG continuation with prior external liquidity."],
  outcome: "expired",
  researchOnly: true
};

const context = {
  sourceProvider: "mt5_push_feed",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "mt5|USTECH|5m|2026-07-20T01:30:00.000Z|100|received",
  closedCandleTimestamp: detectedAt
};

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/marketEpisodes/marketEpisodeTypes.ts", "marketEpisodeTypes.mjs");
  compile("src/lib/marketEpisodes/asiaDisplacementFvgExternalTargetV2.ts", "asiaDisplacementFvgExternalTargetV2.mjs", [
    ["./marketEpisodeTypes", "./marketEpisodeTypes.mjs"]
  ]);
  compile("src/lib/predictionLedger/predictionLedgerTypes.ts", "predictionLedgerTypes.mjs");
  compile("src/lib/predictionLedger/predictionLedger.ts", "predictionLedger.mjs", [
    ["./predictionLedgerTypes", "./predictionLedgerTypes.mjs"]
  ]);

  const profile = await import(pathToFileURL(path.join(outRoot, "asiaDisplacementFvgExternalTargetV2.mjs")).href);
  const ledger = await import(pathToFileURL(path.join(outRoot, "predictionLedger.mjs")).href);

  const eligible = profile.assessAsiaDisplacementFvgExternalTargetV2Observation({ opportunity, ...context });
  assert.equal(eligible.eligible, true);
  assert.equal(eligible.inheritedOutcomeCount, 0);
  assert.equal(eligible.paperDemoEligible, false);

  const projected = profile.assessAsiaDisplacementFvgExternalTargetV2Observation({
    opportunity: { ...opportunity, targetBasis: "minimum_2r_projection" },
    ...context
  });
  assert.equal(projected.eligible, false);
  assert.match(projected.blockers.join(" "), /external liquidity/i);

  const wrongSession = profile.assessAsiaDisplacementFvgExternalTargetV2Observation({
    opportunity: { ...opportunity, session: "london" },
    ...context
  });
  assert.equal(wrongSession.eligible, false);
  assert.match(wrongSession.blockers.join(" "), /Asia session/i);

  const historical = profile.assessAsiaDisplacementFvgExternalTargetV2Observation({
    opportunity: { ...opportunity, detectedAt: "2026-07-17T01:30:00.000Z" },
    ...context,
    closedCandleTimestamp: "2026-07-17T01:30:00.000Z"
  });
  assert.equal(historical.eligible, false);
  assert.match(historical.blockers.join(" "), /predates/i);

  const entry = ledger.issuePredictionFromMarketOpportunity({
    opportunity,
    sourceProvider: context.sourceProvider,
    requestedSymbol: context.requestedSymbol,
    brokerSymbol: context.brokerSymbol,
    timeframe: context.timeframe,
    sourceFingerprint: context.sourceFingerprint,
    modelVersion: profile.ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID,
    scenarioFamily: "asia_displacement_fvg_external_target",
    maxBarsToResolve: 48
  });
  assert.equal(entry.modelVersion, "asia_displacement_fvg_short_external_target_v2_research");
  assert.equal(entry.direction, "bearish");
  assert.equal(entry.probabilitySource, "heuristic_uncalibrated");
  assert.equal(entry.calibrationSampleSize, 0);
  assert.equal(entry.expectedR, 2);
  assert.equal(entry.safety.autoPromotionAllowed, false);
  assert.deepEqual(entry.authority, authority);

  const resolved = ledger.updatePredictionWithClosedCandle(entry, {
    timestamp: "2026-07-20T01:35:00.000Z",
    high: 100.5,
    low: 95.8,
    close: 96,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceFingerprint: "mt5-next-close"
  });
  assert.equal(resolved.resolution, "target_first");
  assert.equal(resolved.realizedR, 2);

  const integrationSource = fs.readFileSync(path.join(root, "src/lib/predictionLedger/predictionLedgerIntegration.ts"), "utf8");
  const appSource = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  const cycleSource = fs.readFileSync(path.join(root, "src/lib/researchCycle/runResearchCycle.ts"), "utf8");
  assert.match(integrationSource, /entry\.modelVersion === ASIA_DISPLACEMENT_FVG_EXTERNAL_TARGET_V2_ID/);
  assert.match(integrationSource, /inheritedHistoricalOutcomeCount:\s*0/);
  assert.match(appSource, /subscribeFrozenMarketEpisodeProfilesToMt5PushFeed/);
  assert.match(cycleSource, /recordFrozenMarketEpisodeProfileObservationsFromClosedCandle/);

  const compact = {
    status: "passed",
    profileId: entry.modelVersion,
    eligible: true,
    projectedTargetBlocked: !projected.eligible,
    wrongSessionBlocked: !wrongSession.eligible,
    historicalBackfillBlocked: !historical.eligible,
    calibrationSampleSize: entry.calibrationSampleSize,
    inheritedHistoricalOutcomeCount: 0,
    resolution: resolved.resolution,
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
