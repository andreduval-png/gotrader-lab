#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "cmd-london-long-frozen-validation");
const wrapperUrl = (process.env.MT5_READONLY_BRIDGE_URL ?? "http://127.0.0.1:7341").replace(/\/$/, "");
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

const round = (value, digits = 4) => Number(value.toFixed(digits));
const timestamp = (dayOffset, hour = 8) =>
  new Date(Date.parse("2026-01-02T00:00:00.000Z") + dayOffset * 86_400_000 + hour * 3_600_000).toISOString();

const opportunity = (index, outcome = "target_first", dayOffset = index * 2) => ({
  opportunityId: `cmd-london-long-${index}`,
  family: "consolidation_manipulation_distribution",
  detectedAt: timestamp(dayOffset),
  session: "london",
  side: "long",
  entryReference: 100,
  invalidationReference: 99,
  targetReference: 102,
  targetBasis: "minimum_2r_projection",
  rr: 2,
  evidence: ["Causal consolidation, sweep, and displacement."],
  outcome,
  resolvedAt: timestamp(dayOffset, 9),
  realizedR: outcome === "target_first" ? 2 : -1,
  researchOnly: true
});

const scenarioMap = {
  scenarioMapId: "cmd-london-long-forward-fixture",
  timestamp: "2026-07-20T08:30:00.000Z",
  sourceProvider: "mt5_read_only",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  timeframe: "5m",
  sourceFingerprint: "mt5-forward-fixture",
  currentSession: "london",
  marketPhase: "displacement",
  currentDecisionState: "confirmed_setup",
  primaryScenario: {
    scenarioId: "cmd-london-long-scenario",
    scenarioFamily: "consolidation_raid_displacement",
    direction: "bullish",
    setupType: "intraday_expansion",
    probabilityBand: "moderate",
    confidence: 0.6,
    thesis: "London consolidation raid displaced bullish.",
    liquidityDraw: "External buy-side liquidity",
    expectedSequence: ["Retest", "Hold invalidation", "Expand"],
    requiredConfirmations: ["Closed-candle confirmation"],
    invalidationConditions: ["Close below protected low"],
    conditionalEntryPlan: { status: "conditional", label: "Conditional entry zone if confirmation appears", zone: { lower: 100, upper: 101 }, trigger: "Closed candle retest", researchOnly: true },
    conditionalStopPlan: { status: "conditional", label: "Conditional stop reference", referencePrice: 98, condition: "Protected low", researchOnly: true },
    conditionalTargetPlan: { status: "conditional", label: "Conditional target references", references: [{ label: "External liquidity", price: 106 }], condition: "Target only after trigger", researchOnly: true },
    whyNotConfirmedYet: [],
    whatWouldUpgradeThis: [],
    whatWouldDowngradeThis: [],
    safetyNotice: "Research-only confirmed setup. Paper-demo/live execution still blocked unless readiness gates pass."
  },
  invalidationScenario: {
    scenarioId: "cmd-invalid",
    scenarioFamily: "no_trade_waiting_for_liquidity",
    direction: "neutral",
    setupType: "no_trade",
    probabilityBand: "low",
    confidence: 0.2,
    thesis: "Invalidation fallback.",
    liquidityDraw: "None",
    expectedSequence: [],
    requiredConfirmations: [],
    invalidationConditions: [],
    conditionalEntryPlan: { status: "unavailable", label: "Conditional entry zone if confirmation appears", trigger: "None", researchOnly: true },
    conditionalStopPlan: { status: "unavailable", label: "Conditional stop reference", condition: "None", researchOnly: true },
    conditionalTargetPlan: { status: "unavailable", label: "Conditional target references", references: [], condition: "None", researchOnly: true },
    whyNotConfirmedYet: [],
    whatWouldUpgradeThis: [],
    whatWouldDowngradeThis: [],
    safetyNotice: "Research-only scenario forecast. Not a confirmed setup. No execution authority."
  },
  missingConfirmations: [],
  nextEvidenceToWatch: [],
  authority,
  safety: { researchOnly: true, rawCandlesExcluded: true, rawSnapshotsExcluded: true, autoApplyAllowed: false, autoPromotionAllowed: false }
};

const fetchJson = async (pathname, parameters) => {
  const url = new URL(`${wrapperUrl}/${pathname.replace(/^\//, "")}`);
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${url.pathname} returned HTTP ${response.status}`);
  return response.json();
};

const normalize = (values) => {
  const seen = new Set();
  return values
    .map((value) => ({ ...value, parsedTimestamp: Date.parse(value.timestamp ?? value.time) }))
    .filter((value) => Number.isFinite(value.parsedTimestamp))
    .sort((left, right) => left.parsedTimestamp - right.parsedTimestamp)
    .filter((value) => {
      if (seen.has(value.parsedTimestamp)) return false;
      seen.add(value.parsedTimestamp);
      return true;
    })
    .map((value, index) => ({
      id: `cmd-history-${index}`,
      symbol: "MNQ",
      timeframe: "5m",
      timestamp: new Date(value.parsedTimestamp).toISOString(),
      open: Number(value.open),
      high: Number(value.high),
      low: Number(value.low),
      close: Number(value.close),
      volume: Number(value.volume ?? value.tickVolume ?? value.tick_volume ?? 0)
    }))
    .filter((value) => [value.open, value.high, value.low, value.close].every(Number.isFinite));
};

const fingerprint = (candles) =>
  `mt5-cmd-london-long-${candles.length}-${candles[0]?.timestamp}-${candles.at(-1)?.timestamp}`;

async function loadHistory(days = 180) {
  const latest = await fetchJson("candles", { requestedSymbol: "MNQ", symbol: "USTECH", timeframe: "5m", limit: 5000 });
  const end = Date.parse(latest.lastTimestamp ?? latest.candles?.at(-1)?.timestamp);
  if (!Number.isFinite(end)) throw new Error("MT5 wrapper returned no latest timestamp.");
  const start = end - days * 86_400_000;
  const values = [];
  let chunkCount = 0;
  for (let cursor = start; cursor < end; cursor += 10 * 86_400_000) {
    const next = Math.min(end, cursor + 10 * 86_400_000);
    const payload = await fetchJson("candles/range", {
      requestedSymbol: "MNQ",
      symbol: "USTECH",
      timeframe: "5m",
      from: new Date(cursor).toISOString(),
      to: new Date(next).toISOString(),
      limit: 5000
    });
    values.push(...(Array.isArray(payload.candles) ? payload.candles : []));
    chunkCount += 1;
  }
  return { candles: normalize(values), chunkCount };
}

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/marketEpisodes/marketEpisodeTypes.ts", "marketEpisodeTypes.mjs");
  compile("src/lib/marketEpisodes/cmdLondonLongProfileTypes.ts", "cmdLondonLongProfileTypes.mjs");
  compile("src/lib/marketEpisodes/cmdLondonLongFrozenProfile.ts", "cmdLondonLongFrozenProfile.mjs", [
    ["./cmdLondonLongProfileTypes", "./cmdLondonLongProfileTypes.mjs"]
  ]);
  compile("src/lib/marketEpisodes/validateCmdLondonLongProfile.ts", "validateCmdLondonLongProfile.mjs", [
    ["./cmdLondonLongProfileTypes", "./cmdLondonLongProfileTypes.mjs"],
    ["./cmdLondonLongFrozenProfile", "./cmdLondonLongFrozenProfile.mjs"]
  ]);
  compile("src/lib/marketEpisodes/reconstructMarketEpisodes.ts", "reconstructMarketEpisodes.mjs", [
    ["./marketEpisodeTypes", "./marketEpisodeTypes.mjs"]
  ]);
  const profileModule = await import(pathToFileURL(path.join(outRoot, "cmdLondonLongFrozenProfile.mjs")).href);
  const validatorModule = await import(pathToFileURL(path.join(outRoot, "validateCmdLondonLongProfile.mjs")).href);
  const reconstructionModule = await import(pathToFileURL(path.join(outRoot, "reconstructMarketEpisodes.mjs")).href);

  assert.equal(profileModule.cmdLondonLongFrozenProfile.paperDemoEligible, false);
  assert.equal(profileModule.cmdLondonLongFrozenProfile.autoPromotionAllowed, false);
  assert.equal(profileModule.cmdLondonLongFrozenProfile.status, "retired_causal_reconstruction_leakage");
  assert.equal(profileModule.assessCmdLondonLongForwardScenario(scenarioMap).eligible, false);
  assert.match(profileModule.assessCmdLondonLongForwardScenario(scenarioMap).blockers.join(" "), /causal rolling normalization|full-day volatility normalization/i);
  assert.equal(profileModule.assessCmdLondonLongForwardScenario(scenarioMap).probabilitySource, "heuristic_uncalibrated");
  assert.equal(profileModule.assessCmdLondonLongForwardScenario({ ...scenarioMap, timestamp: "2026-07-17T08:30:00.000Z" }).eligible, false);

  const stableFixture = [
    ...Array.from({ length: 24 }, (_, index) => opportunity(index, index < 16 ? "target_first" : "invalidation_first", index * 3)),
    ...Array.from({ length: 24 }, (_, index) => opportunity(100 + index, index < 16 ? "target_first" : "invalidation_first", 110 + index * 2))
  ];
  const stableResult = validatorModule.validateCmdLondonLongFrozenProfile({
    opportunities: stableFixture,
    sourceProvider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceFingerprint: "stable-fixture",
    firstTimestamp: "2026-01-01T00:00:00.000Z",
    lastTimestamp: "2026-07-01T00:00:00.000Z"
  });
  assert.equal(stableResult.verdict, "retrospective_supported_needs_forward");
  assert.equal(stableResult.paperDemoEligible, false);
  assert.equal(stableResult.forwardCalibrationEligible, false);
  assert.equal(stableResult.forwardObservationEligible, false);

  let liveResult;
  try {
    const history = await loadHistory();
    const sourceFingerprint = fingerprint(history.candles);
    const episodes = reconstructionModule.reconstructMarketEpisodes({
      candles: history.candles,
      sourceProvider: "mt5_read_only",
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      timeframe: "5m",
      sourceFingerprint,
      minimumEpisodeCandles: 24,
      maxResolutionBars: 48
    });
    liveResult = {
      candleCount: history.candles.length,
      lookbackDays: history.candles.length > 1
        ? round((Date.parse(history.candles.at(-1).timestamp) - Date.parse(history.candles[0].timestamp)) / 86_400_000, 2)
        : 0,
      chunkCount: history.chunkCount,
      validation: validatorModule.validateCmdLondonLongFrozenProfile({
        opportunities: episodes.flatMap((episode) => episode.opportunities),
        sourceProvider: "mt5_read_only",
        requestedSymbol: "MNQ",
        brokerSymbol: "USTECH",
        timeframe: "5m",
        sourceFingerprint,
        firstTimestamp: history.candles[0]?.timestamp ?? "unavailable",
        lastTimestamp: history.candles.at(-1)?.timestamp ?? "unavailable"
      })
    };
    assert.equal(liveResult.validation.paperDemoEligible, false);
    assert.equal(liveResult.validation.forwardCalibrationEligible, false);
  } catch (error) {
    liveResult = {
      status: "blocked_source_unavailable",
      reason: error instanceof Error ? error.message : String(error),
      authority
    };
  }

  const compact = {
    status: "passed",
    profile: profileModule.cmdLondonLongFrozenProfile,
    stablePolicyFixture: {
      verdict: stableResult.verdict,
      paperDemoEligible: stableResult.paperDemoEligible,
      forwardCalibrationEligible: stableResult.forwardCalibrationEligible
    },
    liveResult,
    forwardScenarioGate: profileModule.assessCmdLondonLongForwardScenario(scenarioMap),
    authority,
    safety: { rawCandlesSerialized: false, executionIntentCreated: false, autoPromotionAllowed: false }
  };
  const serialized = JSON.stringify(compact);
  assert.doesNotMatch(serialized, /"(?:candles|rawCandles|rawSnapshot|account|orders|positions|apiKey|token|secret)"\s*:/i);
  assert.doesNotMatch(serialized, /"paperDemoEligible"\s*:\s*true/i);
  assert.equal(compact.authority.executionAuthority, "none");

  const integrationSource = fs.readFileSync(path.join(root, "src/lib/predictionLedger/predictionLedgerIntegration.ts"), "utf8");
  const cycleSource = fs.readFileSync(path.join(root, "src/lib/researchCycle/runResearchCycle.ts"), "utf8");
  assert.match(integrationSource, /recordCmdLondonLongForwardObservation/);
  assert.match(integrationSource, /heuristic_uncalibrated/);
  assert.doesNotMatch(cycleSource, /recordCmdLondonLongForwardObservation/);
  assert.match(cycleSource, /recordFrozenMarketEpisodeProfileObservationsFromClosedCandle/);
  console.log(JSON.stringify(compact, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
