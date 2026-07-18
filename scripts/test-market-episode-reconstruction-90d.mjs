#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "market-episode-reconstruction-90d");
const bridgeUrl = (process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341").replace(/\/$/, "");
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const timeframe = process.env.MARKET_EPISODE_TIMEFRAME || "5m";
const requestedDays = Math.max(1, Number(process.env.MARKET_EPISODE_LOOKBACK_DAYS || 90));
const chunkDays = Math.max(1, Number(process.env.MARKET_EPISODE_CHUNK_DAYS || 10));
const timeoutMs = Math.max(1000, Number(process.env.MT5_READONLY_TEST_TIMEOUT_MS || 15000));

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

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

const fetchJson = async (pathname, params) => {
  const url = new URL(`${bridgeUrl}/${pathname.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}: ${payload.message ?? "unavailable"}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

const candleTime = (value) => {
  const parsed = Date.parse(value?.timestamp);
  return Number.isFinite(parsed) ? parsed : Number(value?.time ?? 0) * 1000;
};

const normalize = (values) => {
  const seen = new Set();
  return values
    .filter((value) => Number.isFinite(candleTime(value)) && candleTime(value) > 0)
    .sort((left, right) => candleTime(left) - candleTime(right))
    .filter((value) => {
      const timestamp = candleTime(value);
      if (seen.has(timestamp)) return false;
      seen.add(timestamp);
      return true;
    })
    .map((value, index) => ({
      id: `episode-${brokerSymbol}-${timeframe}-${candleTime(value)}-${index}`,
      symbol: requestedSymbol,
      timeframe,
      timestamp: new Date(candleTime(value)).toISOString(),
      open: Number(value.open),
      high: Number(value.high),
      low: Number(value.low),
      close: Number(value.close),
      volume: Number(value.volume ?? value.tickVolume ?? value.tick_volume ?? 0)
    }))
    .filter((value) => [value.open, value.high, value.low, value.close].every(Number.isFinite));
};

const stableFingerprint = (candles) => {
  const text = `${brokerSymbol}|${requestedSymbol}|${timeframe}|${candles.length}|${candles[0]?.timestamp}|${candles.at(-1)?.timestamp}`;
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `mt5-episode-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const round = (value, digits = 4) => Number(value.toFixed(digits));

const summarizeFamily = (opportunities) => {
  const completed = opportunities.filter((item) => item.outcome === "target_first" || item.outcome === "invalidation_first");
  const winners = completed.filter((item) => item.outcome === "target_first");
  const realized = completed.map((item) => item.realizedR).filter(Number.isFinite);
  return {
    candidates: opportunities.length,
    completed: completed.length,
    targetFirstRate: completed.length ? round(winners.length / completed.length) : null,
    averageRealizedR: realized.length ? round(realized.reduce((sum, value) => sum + value, 0) / realized.length) : null,
    independentDates: new Set(opportunities.map((item) => item.detectedAt.slice(0, 10))).size,
    sessions: Object.fromEntries(Array.from(new Set(opportunities.map((item) => item.session))).map((session) => [session, opportunities.filter((item) => item.session === session).length]))
  };
};

async function loadHistory() {
  const latest = await fetchJson("candles", {
    requestedSymbol,
    symbol: brokerSymbol,
    timeframe,
    limit: 5000
  });
  const latestCandles = Array.isArray(latest.candles) ? latest.candles : [];
  const endTimestamp = latest.lastTimestamp ?? latestCandles.at(-1)?.timestamp;
  if (!endTimestamp) throw new Error("The MT5 wrapper returned no latest candle timestamp.");
  const end = Date.parse(endTimestamp);
  const start = end - requestedDays * 86_400_000;
  const chunks = [];
  const candles = [];
  for (let cursor = start; cursor < end; cursor += chunkDays * 86_400_000) {
    const next = Math.min(end, cursor + chunkDays * 86_400_000);
    const payload = await fetchJson("candles/range", {
      requestedSymbol,
      symbol: brokerSymbol,
      timeframe,
      from: new Date(cursor).toISOString(),
      to: new Date(next).toISOString(),
      limit: 5000
    });
    const chunkCandles = Array.isArray(payload.candles) ? payload.candles : [];
    chunks.push({ from: new Date(cursor).toISOString(), to: new Date(next).toISOString(), count: chunkCandles.length });
    candles.push(...chunkCandles);
  }
  return { candles: normalize(candles), chunks };
}

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/marketEpisodes/marketEpisodeTypes.ts", "marketEpisodeTypes.mjs");
  compile(
    "src/lib/marketEpisodes/reconstructMarketEpisodes.ts",
    "reconstructMarketEpisodes.mjs",
    [["./marketEpisodeTypes", "./marketEpisodeTypes.mjs"]]
  );
  compile("src/lib/marketEpisodes/marketEpisodeVariantTypes.ts", "marketEpisodeVariantTypes.mjs");
  compile(
    "src/lib/marketEpisodes/discoverMarketEpisodeVariants.ts",
    "discoverMarketEpisodeVariants.mjs",
    [
      ["./marketEpisodeTypes", "./marketEpisodeTypes.mjs"],
      ["./marketEpisodeVariantTypes", "./marketEpisodeVariantTypes.mjs"]
    ]
  );
  const module = await import(pathToFileURL(path.join(outRoot, "reconstructMarketEpisodes.mjs")).href);
  const variantsModule = await import(pathToFileURL(path.join(outRoot, "discoverMarketEpisodeVariants.mjs")).href);

  let history;
  try {
    history = await loadHistory();
  } catch (error) {
    console.log(JSON.stringify({
      status: "blocked_source_unavailable",
      message: error instanceof Error ? error.message : String(error),
      requestedSymbol,
      brokerSymbol,
      timeframe,
      authority,
      rawCandlesSerialized: false
    }, null, 2));
    return;
  }

  const fingerprint = stableFingerprint(history.candles);
  const episodes = module.reconstructMarketEpisodes({
    requestedSymbol,
    brokerSymbol,
    timeframe,
    sourceProvider: "mt5_read_only",
    sourceFingerprint: fingerprint,
    candles: history.candles,
    minimumEpisodeCandles: 24,
    maxResolutionBars: 48
  });
  const summary = module.summarizeMarketEpisodes(episodes);
  const variantDiscovery = variantsModule.discoverMarketEpisodeVariants(episodes);
  const opportunities = episodes.flatMap((episode) => episode.opportunities);
  const families = Object.fromEntries(
    Array.from(new Set(opportunities.map((item) => item.family))).map((family) => [
      family,
      summarizeFamily(opportunities.filter((item) => item.family === family))
    ])
  );
  const lookbackDays = history.candles.length > 1
    ? round((Date.parse(history.candles.at(-1).timestamp) - Date.parse(history.candles[0].timestamp)) / 86_400_000, 2)
    : 0;
  const compact = {
    status: lookbackDays >= requestedDays * 0.8 ? "completed_sufficient_depth" : "completed_limited_depth",
    source: {
      provider: "mt5_read_only",
      requestedSymbol,
      brokerSymbol,
      timeframe,
      sourceFingerprint: fingerprint,
      candleCount: history.candles.length,
      lookbackDays,
      chunkCount: history.chunks.length
    },
    episodeSummary: summary,
    families,
    variantDiscovery: {
      evaluatedVariantCount: variantDiscovery.evaluatedVariantCount,
      promisingVariantCount: variantDiscovery.promisingVariantCount,
      topVariants: variantDiscovery.variants.slice(0, 8),
      nextAction: variantDiscovery.nextAction
    },
    nextAction: opportunities.length
      ? "Use independent-date and chronological walk-forward checks before drafting any new profile."
      : "No deterministic episode family repeated; keep model discovery blocked and inspect event thresholds.",
    authority,
    safety: {
      researchOnly: true,
      rawCandlesSerialized: false,
      executionIntentCreated: false,
      autoPromotionAllowed: false
    }
  };
  const serialized = JSON.stringify(compact);
  assert.doesNotMatch(serialized, /"(?:candles|rawCandles|rawSnapshot|account|orders|positions|apiKey|token|secret)"\s*:/i);
  assert.equal(compact.authority.executionAuthority, "none");
  assert.equal(compact.safety.executionIntentCreated, false);
  console.log(JSON.stringify(compact, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
