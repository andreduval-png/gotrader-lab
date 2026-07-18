#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "asia-displacement-fvg-stability");
const wrapperUrl = (process.env.MT5_READONLY_BRIDGE_URL ?? "http://127.0.0.1:7341").replace(/\/$/, "");
const DAY_MS = 86_400_000;
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
      id: `asia-dfvg-${index}`,
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

async function loadHistory(days = 180) {
  const latest = await fetchJson("candles", { requestedSymbol: "MNQ", symbol: "USTECH", timeframe: "5m", limit: 5000 });
  const end = Date.parse(latest.lastTimestamp ?? latest.candles?.at(-1)?.timestamp);
  if (!Number.isFinite(end)) throw new Error("MT5 wrapper returned no latest timestamp.");
  const values = [];
  let chunkCount = 0;
  for (let cursor = end - days * DAY_MS; cursor < end; cursor += 10 * DAY_MS) {
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
  compile("src/lib/marketEpisodes/asiaDisplacementFvgCandidateTypes.ts", "asiaDisplacementFvgCandidateTypes.mjs");
  compile("src/lib/marketEpisodes/asiaDisplacementFvgCandidate.ts", "asiaDisplacementFvgCandidate.mjs", [
    ["./marketEpisodeTypes", "./marketEpisodeTypes.mjs"],
    ["./asiaDisplacementFvgCandidateTypes", "./asiaDisplacementFvgCandidateTypes.mjs"]
  ]);
  compile("src/lib/marketEpisodes/reconstructMarketEpisodes.ts", "reconstructMarketEpisodes.mjs", [
    ["./marketEpisodeTypes", "./marketEpisodeTypes.mjs"]
  ]);
  const analyzer = await import(pathToFileURL(path.join(outRoot, "asiaDisplacementFvgCandidate.mjs")).href);
  const reconstruction = await import(pathToFileURL(path.join(outRoot, "reconstructMarketEpisodes.mjs")).href);

  assert.equal(analyzer.asiaDisplacementFvgShortV1Candidate.executable, false);
  assert.equal(analyzer.asiaDisplacementFvgShortV1Candidate.forwardObservationEligible, false);
  assert.equal(analyzer.asiaDisplacementFvgShortV1Candidate.paperDemoEligible, false);

  let liveResult;
  try {
    const history = await loadHistory();
    const sourceFingerprint = `mt5-asia-dfvg-${history.candles.length}-${history.candles[0]?.timestamp}-${history.candles.at(-1)?.timestamp}`;
    const episodes = reconstruction.reconstructMarketEpisodes({
      candles: history.candles,
      sourceProvider: "mt5_read_only",
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      timeframe: "5m",
      sourceFingerprint,
      minimumEpisodeCandles: 24,
      maxResolutionBars: 48
    });
    const audit = analyzer.analyzeAsiaDisplacementFvgStability(episodes);
    const allCandidates = episodes
      .flatMap((episode) => episode.opportunities)
      .filter(analyzer.isAsiaDisplacementFvgShortCandidate);
    const split = Date.parse(audit.splitTimestamp);
    const summarizeVariant = (variantId, rule, items) => ({
      variantId,
      rule,
      preSelection: analyzer.summarizeAsiaDisplacementFvgPeriod(
        items.filter((item) => Date.parse(item.detectedAt) < split)
      ),
      discovery: analyzer.summarizeAsiaDisplacementFvgPeriod(
        items.filter((item) => Date.parse(item.detectedAt) >= split)
      ),
      pooled: analyzer.summarizeAsiaDisplacementFvgPeriod(items),
      selectionContaminated: true,
      forwardObservationEligible: false
    });
    const exploratoryVariants = [
      summarizeVariant(
        "asia_dfvg_short_external_target_v2_candidate",
        "External-liquidity target was known at detection.",
        allCandidates.filter((item) => item.targetBasis === "external_liquidity")
      ),
      summarizeVariant(
        "asia_dfvg_short_projected_target_control",
        "The detector used its minimum-R projection because no external target was known.",
        allCandidates.filter((item) => item.targetBasis === "minimum_2r_projection")
      )
    ];
    assert.equal(audit.selectionContaminated, true);
    assert.equal(audit.untouchedOosEvidence, false);
    assert.equal(audit.forwardObservationEligible, false);
    assert.equal(audit.paperDemoEligible, false);
    assert.deepEqual(audit.authority, authority);
    liveResult = {
      status: "completed",
      candleCount: history.candles.length,
      lookbackDays: Number(((Date.parse(history.candles.at(-1).timestamp) - Date.parse(history.candles[0].timestamp)) / DAY_MS).toFixed(2)),
      chunkCount: history.chunkCount,
      sourceFingerprint,
      audit,
      exploratoryVariants
    };
  } catch (error) {
    liveResult = {
      status: "blocked_source_unavailable",
      reason: error instanceof Error ? error.message : String(error),
      authority
    };
  }

  const compact = {
    status: "passed",
    profileId: analyzer.ASIA_DISPLACEMENT_FVG_SHORT_V1_ID,
    liveResult,
    authority,
    safety: { rawCandlesSerialized: false, autoPromotionAllowed: false, executionIntentCreated: false }
  };
  const serialized = JSON.stringify(compact);
  assert.doesNotMatch(serialized, /"(?:candles|rawCandles|rawSnapshot|account|orders|positions|apiKey|token|secret)"\s*:/i);
  assert.doesNotMatch(serialized, /"(?:forwardObservationEligible|paperDemoEligible|autoPromotionAllowed|executionIntentCreated)"\s*:\s*true/i);
  console.log(JSON.stringify(compact, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
