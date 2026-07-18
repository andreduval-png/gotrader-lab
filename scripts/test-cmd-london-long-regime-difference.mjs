#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "cmd-london-long-regime-difference");
const wrapperUrl = (process.env.MT5_READONLY_BRIDGE_URL ?? "http://127.0.0.1:7341").replace(/\/$/, "");
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const DAY_MS = 86_400_000;

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

const fetchJson = async (pathname, parameters) => {
  const url = new URL(`${wrapperUrl}/${pathname.replace(/^\//, "")}`);
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
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
      id: `cmd-regime-${index}`,
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
  `mt5-cmd-regime-${candles.length}-${candles[0]?.timestamp}-${candles.at(-1)?.timestamp}`;

async function loadHistory(days = 180) {
  const latest = await fetchJson("candles", { requestedSymbol: "MNQ", symbol: "USTECH", timeframe: "5m", limit: 5000 });
  const end = Date.parse(latest.lastTimestamp ?? latest.candles?.at(-1)?.timestamp);
  if (!Number.isFinite(end)) throw new Error("MT5 wrapper returned no latest timestamp.");
  const start = end - days * DAY_MS;
  const values = [];
  let chunkCount = 0;
  for (let cursor = start; cursor < end; cursor += 10 * DAY_MS) {
    const next = Math.min(end, cursor + 10 * DAY_MS);
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
  compile("src/lib/marketEpisodes/cmdLondonLongRegimeTypes.ts", "cmdLondonLongRegimeTypes.mjs");
  compile("src/lib/marketEpisodes/cmdLondonLongFrozenProfile.ts", "cmdLondonLongFrozenProfile.mjs", [
    ["./cmdLondonLongProfileTypes", "./cmdLondonLongProfileTypes.mjs"]
  ]);
  compile("src/lib/marketEpisodes/cmdLondonLongExternalTargetV2.ts", "cmdLondonLongExternalTargetV2.mjs", [
    ["./cmdLondonLongProfileTypes", "./cmdLondonLongProfileTypes.mjs"]
  ]);
  compile("src/lib/marketEpisodes/reconstructMarketEpisodes.ts", "reconstructMarketEpisodes.mjs", [
    ["./marketEpisodeTypes", "./marketEpisodeTypes.mjs"]
  ]);
  compile("src/lib/marketEpisodes/analyzeCmdLondonLongRegimeDifference.ts", "analyzeCmdLondonLongRegimeDifference.mjs", [
    ["./cmdLondonLongProfileTypes", "./cmdLondonLongProfileTypes.mjs"],
    ["./cmdLondonLongFrozenProfile", "./cmdLondonLongFrozenProfile.mjs"],
    ["./cmdLondonLongRegimeTypes", "./cmdLondonLongRegimeTypes.mjs"]
  ]);

  const profileModule = await import(pathToFileURL(path.join(outRoot, "cmdLondonLongFrozenProfile.mjs")).href);
  const v2Module = await import(pathToFileURL(path.join(outRoot, "cmdLondonLongExternalTargetV2.mjs")).href);
  const reconstructionModule = await import(pathToFileURL(path.join(outRoot, "reconstructMarketEpisodes.mjs")).href);
  const auditModule = await import(pathToFileURL(path.join(outRoot, "analyzeCmdLondonLongRegimeDifference.mjs")).href);

  assert.equal(profileModule.cmdLondonLongFrozenProfile.status, "retired_causal_reconstruction_leakage");
  assert.equal(profileModule.cmdLondonLongFrozenProfile.paperDemoEligible, false);
  assert.equal(v2Module.cmdLondonLongExternalTargetV2ResearchHypothesis.executable, false);
  assert.equal(v2Module.cmdLondonLongExternalTargetV2ResearchHypothesis.forwardObservationPolicy, "closed_candle_detector_only");
  assert.equal(v2Module.cmdLondonLongExternalTargetV2ResearchHypothesis.genericScenarioObservationEligible, false);
  assert.equal(v2Module.cmdLondonLongExternalTargetV2ResearchHypothesis.detectorSpecificForwardObservationEligible, true);
  assert.equal(v2Module.cmdLondonLongExternalTargetV2ResearchHypothesis.inheritedOutcomeCount, 0);
  assert.equal(v2Module.cmdLondonLongExternalTargetV2ResearchHypothesis.paperDemoEligible, false);

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
    const audit = auditModule.analyzeCmdLondonLongRegimeDifference(episodes);
    assert.equal(audit.profileStatus, "retired_causal_reconstruction_leakage");
    assert.equal(audit.safety.executableProfileCreated, false);
    assert.equal(audit.safety.autoPromotionAllowed, false);
    assert.ok(audit.variants.every((variant) => variant.mayCreateExecutableProfile === false));
    assert.ok(audit.telemetry.every((row) => row.sourceFingerprint === sourceFingerprint));
    liveResult = {
      status: "completed",
      candleCount: history.candles.length,
      lookbackDays: history.candles.length > 1
        ? Number(((Date.parse(history.candles.at(-1).timestamp) - Date.parse(history.candles[0].timestamp)) / DAY_MS).toFixed(2))
        : 0,
      chunkCount: history.chunkCount,
      audit: {
        discoveryWindowStart: audit.discoveryWindowStart,
        preSelection: audit.preSelection,
        discovery: audit.discovery,
        featureComparisons: audit.featureComparisons,
        variants: audit.variants,
        recommendedVariantId: audit.recommendedVariantId,
        recommendation: audit.recommendation,
        telemetryCount: audit.telemetry.length,
        authority: audit.authority,
        safety: audit.safety
      },
      v2ResearchHypothesis: v2Module.cmdLondonLongExternalTargetV2ResearchHypothesis
    };
  } catch (error) {
    liveResult = {
      status: "blocked_source_unavailable",
      reason: error instanceof Error ? error.message : String(error),
      authority
    };
  }

  const output = {
    status: "passed",
    profileStatus: profileModule.cmdLondonLongFrozenProfile.status,
    v2Status: v2Module.cmdLondonLongExternalTargetV2ResearchHypothesis.status,
    forwardObservationPolicy: v2Module.cmdLondonLongExternalTargetV2ResearchHypothesis.forwardObservationPolicy,
    genericScenarioObservationEligible: false,
    detectorSpecificForwardObservationEligible: true,
    inheritedOutcomeCount: 0,
    liveResult,
    authority,
    safety: { rawCandlesSerialized: false, executableProfileCreated: false, autoPromotionAllowed: false }
  };
  const serialized = JSON.stringify(output);
  assert.doesNotMatch(serialized, /"(?:candles|rawCandles|rawSnapshot|account|orders|positions|apiKey|token|secret)"\s*:/i);
  assert.doesNotMatch(serialized, /"(?:paperDemoEligible|autoPromotionAllowed|executableProfileCreated)"\s*:\s*true/i);
  assert.deepEqual(output.authority, authority);
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
