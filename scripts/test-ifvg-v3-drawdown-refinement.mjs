#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src", "lib", "ict-strategy-suite");
const outRoot = path.join(projectRoot, ".gotrader", "ifvg-v3-drawdown-refinement");
const reportPath = path.join(projectRoot, "docs", "ifvg-v3-drawdown-refinement-audit.md");
const sourceFiles = [
  "ictTradeConstructionTypes.ts",
  "ictTradeConstruction.ts",
  "ictIfvgTypes.ts",
  "ictIfvg.ts",
  "ictIfvgFreshRetestV3.ts",
  "ictIfvgShallowRetestV4.ts",
  "ictMonteCarlo.ts"
];

const bridgeUrl = (process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341").replace(/\/$/, "");
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const lookbackDays = Number(process.env.IFVG_V3_REFINEMENT_LOOKBACK_DAYS || 180);
const validationCutoff = process.env.IFVG_V3_VALIDATION_CUTOFF || "2026-07-14T04:40:00.000Z";
const chunkDays = Number(process.env.IFVG_V3_REFINEMENT_CHUNK_DAYS || 14);
const timeoutMs = Number(process.env.MT5_READONLY_TEST_TIMEOUT_MS || 15000);
const timeframe = "5m";
const tickSize = 0.25;
const scanWindow = 160;
const warmupCandles = 100;
const maxBarsToResolveTrade = 48;
const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const safety = {
  rawCandlesExcluded: true,
  rawSnapshotsExcluded: true,
  secretsExcluded: true,
  accountDataExcluded: true,
  orderDataExcluded: true,
  positionDataExcluded: true,
  brokerMutation: false,
  realOrderPlaced: false,
  readinessPromotionAllowed: false
};

const round = (value, decimals = 4) => Number(Number.isFinite(value) ? value.toFixed(decimals) : 0);
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const countBy = (values, selector) => Object.fromEntries(
  [...values.reduce((counts, value) => {
    const key = selector(value) ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
);

function compileForNode() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });
  for (const file of sourceFiles) {
    const sourcePath = path.join(sourceRoot, file);
    const transpiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText;
    const rewritten = transpiled
      .replace(/from\s+"\.\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'\.\/([^']+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), rewritten, "utf8");
  }
}

const endpoint = (pathname, params = {}) => {
  const url = new URL(`${bridgeUrl}/${pathname.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    const body = response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

const candleTime = (candle) => Number.isFinite(Date.parse(candle?.timestamp))
  ? Date.parse(candle.timestamp)
  : Number(candle?.time ?? 0) * 1000;

const normalizeCandles = (raw) => {
  const seen = new Set();
  return raw
    .filter((candle) => candle && candleTime(candle) > 0)
    .sort((a, b) => candleTime(a) - candleTime(b))
    .filter((candle) => {
      const key = candleTime(candle);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((candle, index) => ({
      id: `mt5_ifvg_v3_${brokerSymbol}_${candleTime(candle)}_${index}`,
      symbol: requestedSymbol,
      timeframe,
      timestamp: new Date(candleTime(candle)).toISOString(),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume ?? candle.tickVolume ?? candle.tick_volume ?? 0)
    }));
};

async function fetchHistory() {
  const latest = await fetchJson(endpoint("candles", {
    requestedSymbol,
    symbol: brokerSymbol,
    timeframe,
    limit: 1000
  }));
  const latestCandles = Array.isArray(latest?.candles) ? latest.candles : [];
  const latestTimestamp = latest?.lastTimestamp ?? latestCandles.at(-1)?.timestamp;
  if (!latestTimestamp) throw new Error("MT5 latest candles did not provide an anchor timestamp.");
  const end = Math.min(Date.parse(latestTimestamp), Date.parse(validationCutoff));
  const start = end - lookbackDays * 86_400_000;
  const chunkMs = chunkDays * 86_400_000;
  const raw = [];
  let chunkCount = 0;
  for (let cursor = start; cursor < end; cursor += chunkMs) {
    const to = Math.min(cursor + chunkMs, end);
    const payload = await fetchJson(endpoint("candles/range", {
      requestedSymbol,
      symbol: brokerSymbol,
      timeframe,
      from: new Date(cursor).toISOString(),
      to: new Date(to).toISOString(),
      limit: 5000
    }));
    raw.push(...(Array.isArray(payload?.candles) ? payload.candles : []));
    chunkCount += 1;
  }
  const candles = normalizeCandles(raw).filter((candle) => Date.parse(candle.timestamp) <= end);
  if (candles.length < 5000) throw new Error(`Only ${candles.length} MT5 candles were available; deep validation requires at least 5,000.`);
  return {
    candles,
    chunkCount,
    firstTimestamp: candles[0]?.timestamp,
    lastTimestamp: candles.at(-1)?.timestamp,
    availableDays: round((Date.parse(candles.at(-1).timestamp) - Date.parse(candles[0].timestamp)) / 86_400_000, 2)
  };
}

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});
const nyParts = (timestamp) => {
  const parts = Object.fromEntries(nyFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour === "24" ? 0 : parts.hour);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: hour * 60 + Number(parts.minute ?? 0) };
};
const sessionFor = (minute) => {
  if (minute >= 120 && minute < 300) return "london";
  if (minute >= 570 && minute < 720) return "new_york_am";
  if (minute >= 720 && minute < 810) return "new_york_lunch";
  if (minute >= 810 && minute < 960) return "new_york_pm";
  return "globex";
};

const trueRange = (candle, previous) => Math.max(
  candle.high - candle.low,
  Math.abs(candle.high - (previous?.close ?? candle.open)),
  Math.abs(candle.low - (previous?.close ?? candle.open))
);
const atrAt = (candles, index, period = 20) => {
  const values = [];
  for (let cursor = Math.max(1, index - period + 1); cursor <= index; cursor += 1) {
    values.push(trueRange(candles[cursor], candles[cursor - 1]));
  }
  return average(values);
};
const percentileRank = (values, current) => values.length
  ? values.filter((value) => value <= current).length / values.length
  : 0.5;
const bucket = (value, limits, labels) => labels[limits.findIndex((limit) => value <= limit)] ?? labels.at(-1);

const maxDrawdown = (returns) => {
  let equity = 0;
  let peak = 0;
  let worst = 0;
  for (const value of returns) {
    equity += value;
    peak = Math.max(peak, equity);
    worst = Math.max(worst, peak - equity);
  }
  return round(worst, 3);
};

const summarize = (trades, extraCostR = 0) => {
  const returns = trades.map((trade) => trade.rMultiple - extraCostR);
  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value < 0);
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  return {
    trades: trades.length,
    targetFirst: trades.filter((trade) => trade.outcome === "target_first").length,
    invalidationFirst: trades.filter((trade) => trade.outcome === "invalidation_first").length,
    stalled: trades.filter((trade) => trade.outcome === "stalled").length,
    winRate: round(trades.length ? wins.length / trades.length : 0, 4),
    averageR: round(average(returns), 3),
    medianR: round(median(returns), 3),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 3) : wins.length ? 999 : 0,
    maxDrawdownR: maxDrawdown(returns),
    uniqueDates: new Set(trades.map((trade) => trade.tradingDate)).size
  };
};

const simulateTrade = ({ candidate, decisionIndex, candles }) => {
  if (candidate.side === "flat" || !Number.isFinite(candidate.entry) || !Number.isFinite(candidate.stop) || !Number.isFinite(candidate.target)) return undefined;
  const entry = candidate.entry;
  const stop = candidate.stop;
  const target = candidate.target;
  const risk = Math.abs(entry - stop);
  if (!(risk > 0)) return undefined;
  const direction = candidate.side === "long" ? 1 : -1;
  const future = candles.slice(decisionIndex + 1, decisionIndex + 1 + maxBarsToResolveTrade);
  if (!future.length) return undefined;
  let outcome = "stalled";
  let exitIndex = decisionIndex + future.length;
  let exit = future.at(-1);
  for (let offset = 0; offset < future.length; offset += 1) {
    const candle = future[offset];
    const stopHit = candidate.side === "long" ? candle.low <= stop : candle.high >= stop;
    const targetHit = candidate.side === "long" ? candle.high >= target : candle.low <= target;
    if (stopHit || targetHit) {
      outcome = stopHit ? "invalidation_first" : "target_first";
      exitIndex = decisionIndex + offset + 1;
      exit = candle;
      break;
    }
  }
  const targetR = Math.abs(target - entry) / risk;
  const frictionR = (3 * tickSize) / risk;
  const markR = direction * (exit.close - entry) / risk;
  const rMultiple = outcome === "target_first"
    ? targetR - frictionR
    : outcome === "invalidation_first"
      ? -1 - frictionR
      : Math.max(-1, Math.min(targetR, markR)) - frictionR;
  const priorAtr = atrAt(candles, decisionIndex);
  const atrHistory = [];
  for (let cursor = Math.max(20, decisionIndex - 96); cursor < decisionIndex; cursor += 1) atrHistory.push(atrAt(candles, cursor));
  const volatilityRank = percentileRank(atrHistory, priorAtr);
  const inversion = candidate.inversionCandle;
  const priorBodies = candles.slice(Math.max(0, decisionIndex - 20), decisionIndex).map((candle) => Math.abs(candle.close - candle.open));
  const displacementScore = inversion ? Math.abs(inversion.close - inversion.open) / Math.max(median(priorBodies), tickSize) : 0;
  const zoneSize = Math.max((candidate.ifvgBounds?.high ?? 0) - (candidate.ifvgBounds?.low ?? 0), tickSize);
  const penetration = candidate.side === "long"
    ? ((candidate.ifvgBounds?.high ?? entry) - (candidate.retestCandle?.low ?? entry)) / zoneSize
    : ((candidate.retestCandle?.high ?? entry) - (candidate.ifvgBounds?.low ?? entry)) / zoneSize;
  const parts = nyParts(candles[decisionIndex].timestamp);
  return {
    candidateId: `ifvg_v3_${candidate.retestCandle?.timestamp ?? candles[decisionIndex].timestamp}_${candidate.side}`,
    openedAt: candles[decisionIndex].timestamp,
    tradingDate: parts.date,
    session: sessionFor(parts.minute),
    side: candidate.side,
    outcome,
    rMultiple: round(rMultiple, 3),
    rr: round(targetR, 3),
    exitIndex,
    entryDepthBucket: bucket(penetration, [0.66, 0.83], ["shallow", "middle", "deep"]),
    invalidationAtrBucket: bucket(risk / Math.max(priorAtr, tickSize), [0.35, 0.6, 0.9], ["tight", "balanced", "wide", "very_wide"]),
    volatilityRegime: bucket(volatilityRank, [0.33, 0.66], ["low", "normal", "high"]),
    displacementBucket: bucket(displacementScore, [1, 1.5, 2], ["weak", "moderate", "strong", "very_strong"]),
    sourceFingerprint: `mt5_read_only|${requestedSymbol}|${brokerSymbol}|${timeframe}|${validationCutoff}`,
    authority
  };
};

async function collectTrades(candles, assess) {
  const trades = [];
  const seen = new Set();
  let activeUntilIndex = -1;
  for (let decisionIndex = Math.max(warmupCandles, 40); decisionIndex < candles.length - 1; decisionIndex += 1) {
    const window = candles.slice(Math.max(0, decisionIndex + 1 - scanWindow), decisionIndex + 1);
    const assessment = assess({
      candles: window,
      sourceProvider: "mt5_read_only",
      sourceFingerprint: `mt5_read_only|${requestedSymbol}|${brokerSymbol}|${timeframe}|${candles.length}`,
      requestedSymbol,
      brokerSymbol,
      timeframe,
      generatedAt: candles[decisionIndex].timestamp
    });
    const candidate = assessment.candidate;
    const key = [candidate.originalFvgCandle?.timestamp, candidate.inversionCandle?.timestamp, candidate.retestCandle?.timestamp, candidate.side].join("|");
    if (!candidate.originalFvgCandle || seen.has(key)) continue;
    seen.add(key);
    if (!assessment.eligible || assessment.blockers.length || decisionIndex <= activeUntilIndex) continue;
    const trade = simulateTrade({ candidate, decisionIndex, candles });
    if (!trade) continue;
    trades.push(trade);
    activeUntilIndex = trade.exitIndex;
  }
  return trades;
}

const definitions = [
  { id: "long_only", family: "side", predicate: (trade) => trade.side === "long" },
  { id: "short_only", family: "side", predicate: (trade) => trade.side === "short" },
  ...["globex", "london", "new_york_am", "new_york_lunch", "new_york_pm"].map((value) => ({ id: `${value}_only`, family: "session", predicate: (trade) => trade.session === value })),
  ...["shallow", "middle", "deep"].map((value) => ({ id: `entry_depth_${value}`, family: "entry_depth", predicate: (trade) => trade.entryDepthBucket === value })),
  ...["tight", "balanced", "wide", "very_wide"].map((value) => ({ id: `invalidation_${value}`, family: "invalidation_distance", predicate: (trade) => trade.invalidationAtrBucket === value })),
  ...["low", "normal", "high"].map((value) => ({ id: `volatility_${value}`, family: "volatility", predicate: (trade) => trade.volatilityRegime === value })),
  ...["weak", "moderate", "strong", "very_strong"].map((value) => ({ id: `displacement_${value}`, family: "displacement", predicate: (trade) => trade.displacementBucket === value }))
];

const fixedWindows = (trades, from, to) => {
  const windowMs = 30 * 86_400_000;
  const rows = [];
  for (let cursor = from; cursor < to; cursor += windowMs) {
    const scoped = trades.filter((trade) => {
      const time = Date.parse(trade.openedAt);
      return time >= cursor && time < Math.min(cursor + windowMs, to);
    });
    if (scoped.length) rows.push(summarize(scoped));
  }
  return rows;
};

const evaluate = (definition, developmentTrades, oosTrades, developmentRange, oosRange) => {
  const development = developmentTrades.filter(definition.predicate);
  const oos = oosTrades.filter(definition.predicate);
  const developmentSummary = summarize(development);
  const oosSummary = summarize(oos);
  const fullSummary = summarize([...development, ...oos]);
  const stressedOos = summarize(oos, 0.5);
  const oosWindows = fixedWindows(oos, oosRange.from, oosRange.to);
  const discoveryEligible = developmentSummary.trades >= 40 &&
    developmentSummary.uniqueDates >= 20 &&
    developmentSummary.averageR > 0 &&
    developmentSummary.profitFactor > 1 &&
    developmentSummary.maxDrawdownR < summarize(developmentTrades).maxDrawdownR;
  const validationPassed = discoveryEligible &&
    oosSummary.trades >= 20 &&
    oosSummary.uniqueDates >= 10 &&
    oosWindows.length >= 2 &&
    oosWindows.every((window) => window.averageR > 0 && window.profitFactor > 1) &&
    stressedOos.averageR > 0 &&
    stressedOos.profitFactor > 1 &&
    oosSummary.maxDrawdownR <= 4 &&
    fullSummary.maxDrawdownR <= 4;
  return {
    id: definition.id,
    family: definition.family,
    development: developmentSummary,
    oos: oosSummary,
    stressedOos,
    full: fullSummary,
    activeOosWindows: oosWindows.length,
    positiveOosWindows: oosWindows.filter((window) => window.averageR > 0 && window.profitFactor > 1).length,
    discoveryEligible,
    validationPassed,
    failedGates: [
      developmentSummary.trades < 40 ? "development_sample" : undefined,
      developmentSummary.uniqueDates < 20 ? "development_dates" : undefined,
      developmentSummary.averageR <= 0 || developmentSummary.profitFactor <= 1 ? "development_edge" : undefined,
      developmentSummary.maxDrawdownR >= summarize(developmentTrades).maxDrawdownR ? "development_drawdown_not_improved" : undefined,
      oosSummary.trades < 20 ? "oos_sample" : undefined,
      oosSummary.uniqueDates < 10 ? "oos_dates" : undefined,
      oosWindows.length < 2 ? "oos_windows" : undefined,
      oosWindows.some((window) => window.averageR <= 0 || window.profitFactor <= 1) ? "oos_window_edge" : undefined,
      stressedOos.averageR <= 0 || stressedOos.profitFactor <= 1 ? "oos_cost_stress" : undefined,
      oosSummary.maxDrawdownR > 4 ? "oos_drawdown" : undefined,
      fullSummary.maxDrawdownR > 4 ? "full_drawdown" : undefined
    ].filter(Boolean)
  };
};

const assertSafe = (report) => {
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /"(rawCandles|candles|rawSnapshot|account|accounts|orders|positions|password|secret|apiKey|token)"\s*:/i);
  assert.equal(report.authority.executionAuthority, "none");
  assert.equal(report.authority.brokerAuthority, "none");
  assert.equal(report.authority.readinessOverrideAuthority, "none");
  assert.equal(report.safety.readinessPromotionAllowed, false);
};

const writeReport = (report) => {
  const rows = report.variants.map((variant) =>
    `| ${variant.id} | ${variant.development.trades} | ${variant.development.averageR} | ${variant.development.maxDrawdownR} | ${variant.oos.trades} | ${variant.oos.averageR} | ${variant.oos.maxDrawdownR} | ${variant.full.maxDrawdownR} | ${variant.positiveOosWindows}/${variant.activeOosWindows} | ${variant.validationPassed ? "pass" : variant.failedGates.join(", ")} |`
  ).join("\n");
  const winner = report.acceptedVariant
    ? `\`${report.acceptedVariant.id}\` passed every frozen OOS and drawdown gate. It may be implemented only as a new research-only \`ifvg_fresh_retest_v4_candidate\` fork.`
    : "No single-variable refinement passed the unchanged evidence and 4R drawdown gates. IFVG v3 remains frozen and no v4 profile should be registered from this audit.";
  fs.writeFileSync(reportPath, `# IFVG v3 Drawdown Refinement Audit

Generated by \`npm.cmd run test:ifvg-v3-drawdown-refinement\` using explicit 180-day MT5 read-only history.

## Method

- Frozen profile: \`ifvg_fresh_retest_v3_research\`
- Requested/broker symbol: \`${requestedSymbol}\` / \`${brokerSymbol}\`
- Timeframe: \`${timeframe}\`
- Source depth: ${report.source.candleCount} candles across ${report.source.availableDays} days
- Development/OOS split: chronological 2/3 and untouched trailing 1/3
- Selection: one compact filter at a time; no compound search
- Same-bar ambiguity: invalidation first
- Existing modeled friction: three ticks; OOS stress adds 0.5R
- Raw candles remained internal to the CLI process

## Baseline

| Segment | Trades | Win rate | Avg R | PF | Max DD | Dates |
|---|---:|---:|---:|---:|---:|---:|
| Full | ${report.baseline.full.trades} | ${(report.baseline.full.winRate * 100).toFixed(1)}% | ${report.baseline.full.averageR} | ${report.baseline.full.profitFactor} | ${report.baseline.full.maxDrawdownR}R | ${report.baseline.full.uniqueDates} |
| Development | ${report.baseline.development.trades} | ${(report.baseline.development.winRate * 100).toFixed(1)}% | ${report.baseline.development.averageR} | ${report.baseline.development.profitFactor} | ${report.baseline.development.maxDrawdownR}R | ${report.baseline.development.uniqueDates} |
| OOS | ${report.baseline.oos.trades} | ${(report.baseline.oos.winRate * 100).toFixed(1)}% | ${report.baseline.oos.averageR} | ${report.baseline.oos.profitFactor} | ${report.baseline.oos.maxDrawdownR}R | ${report.baseline.oos.uniqueDates} |

## Drawdown Distribution

- Session: ${JSON.stringify(report.distribution.session)}
- Side: ${JSON.stringify(report.distribution.side)}
- Entry depth: ${JSON.stringify(report.distribution.entryDepth)}
- Invalidation distance: ${JSON.stringify(report.distribution.invalidationDistance)}
- Volatility: ${JSON.stringify(report.distribution.volatility)}
- Displacement: ${JSON.stringify(report.distribution.displacement)}

## One-Variable Tests

| Filter | Dev N | Dev Avg R | Dev DD | OOS N | OOS Avg R | OOS DD | Full DD | Positive OOS windows | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
${rows}

## Decision

${winner}

Production profile verification: \`ifvg_fresh_retest_v4_candidate\` reproduced ${report.productionV4Verification.trades} trades, ${report.productionV4Verification.averageR}R average, ${report.productionV4Verification.profitFactor} profit factor, and ${report.productionV4Verification.maxDrawdownR}R max drawdown. It remains research-only and is not Paper-Demo eligible.

Monte Carlo used ${report.monteCarlo.usableOutcomes} compact replay outcomes across ${report.monteCarlo.simulationCount} seeded simulations. Robustness: **${report.monteCarlo.robustnessRating}**; median ending R ${report.monteCarlo.medianEndingR}, fifth-percentile ending R ${report.monteCarlo.fifthPercentileEndingR}, median max drawdown ${report.monteCarlo.medianMaxDrawdownR}R, risk of ruin ${report.monteCarlo.riskOfRuinPct}%.

Readiness and Paper-Demo promotion remain blocked. This audit cannot modify the frozen profile or create execution authority.

## Next Action

${report.nextAction}

## Safety

- executionAuthority: none
- brokerAuthority: none
- readinessOverrideAuthority: none
- no raw candle persistence
- no broker/account/order/position access
- no automatic readiness or Paper-Demo promotion
`, "utf8");
};

async function main() {
  compileForNode();
  const { assessIctIfvgFreshRetestV3 } = await import(pathToFileURL(path.join(outRoot, "ictIfvgFreshRetestV3.mjs")).href);
  const { assessIctIfvgShallowRetestV4 } = await import(pathToFileURL(path.join(outRoot, "ictIfvgShallowRetestV4.mjs")).href);
  const { runMonteCarloBatch } = await import(pathToFileURL(path.join(outRoot, "ictMonteCarlo.mjs")).href);
  const source = await fetchHistory();
  const trades = await collectTrades(source.candles, assessIctIfvgFreshRetestV3);
  const productionV4Trades = await collectTrades(source.candles, assessIctIfvgShallowRetestV4);
  assert.ok(trades.length >= 100, `Expected a substantial frozen v3 sample, received ${trades.length}.`);
  const start = Date.parse(source.firstTimestamp);
  const end = Date.parse(source.lastTimestamp);
  const developmentEnd = start + (end - start) * (2 / 3);
  const developmentTrades = trades.filter((trade) => Date.parse(trade.openedAt) < developmentEnd);
  const oosTrades = trades.filter((trade) => Date.parse(trade.openedAt) >= developmentEnd);
  const variants = definitions
    .map((definition) => evaluate(definition, developmentTrades, oosTrades, { from: start, to: developmentEnd }, { from: developmentEnd, to: end }))
    .filter((variant) => variant.discoveryEligible)
    .sort((a, b) => Number(b.validationPassed) - Number(a.validationPassed) || a.full.maxDrawdownR - b.full.maxDrawdownR || b.oos.averageR - a.oos.averageR);
  const acceptedVariant = variants.find((variant) => variant.validationPassed) ?? null;
  const productionV4Summary = summarize(productionV4Trades);
  assert.equal(productionV4Summary.trades, acceptedVariant?.full.trades, "production v4 must reproduce the accepted shallow-retest sample");
  assert.equal(productionV4Summary.maxDrawdownR, acceptedVariant?.full.maxDrawdownR, "production v4 must reproduce accepted drawdown");
  const monteCarlo = runMonteCarloBatch(
    productionV4Trades.map((trade) => ({
      id: trade.candidateId,
      strategyId: "ifvg_fresh_retest_v4_candidate",
      symbol: requestedSymbol,
      side: trade.side,
      outcome: trade.outcome,
      rMultiple: trade.rMultiple,
      sourceTime: trade.openedAt,
      researchOnly: true
    })),
    {
      source: "real_replay_runner",
      simulationCount: 2000,
      tradesPerSimulation: productionV4Trades.length,
      riskPerTradePct: 0.5,
      includeApprovedOnly: false,
      randomSeed: 41,
      researchOnly: true
    }
  );
  const report = {
    status: "passed",
    diagnostic: "ifvg_v3_drawdown_refinement",
    generatedAt: new Date().toISOString(),
    source: {
      provider: "mt5_read_only",
      requestedSymbol,
      brokerSymbol,
      timeframe,
      candleCount: source.candles.length,
      chunkCount: source.chunkCount,
      availableDays: source.availableDays,
      firstTimestamp: source.firstTimestamp,
      lastTimestamp: source.lastTimestamp,
      sourceWarning: "USTECH is an MT5 CFD/proxy source for MNQ-style research."
    },
    profile: "ifvg_fresh_retest_v3_research",
    frozenValidationCutoff: validationCutoff,
    baseline: {
      full: summarize(trades),
      development: summarize(developmentTrades),
      oos: summarize(oosTrades),
      oosCostStress05R: summarize(oosTrades, 0.5)
    },
    distribution: {
      session: countBy(trades, (trade) => trade.session),
      side: countBy(trades, (trade) => trade.side),
      entryDepth: countBy(trades, (trade) => trade.entryDepthBucket),
      invalidationDistance: countBy(trades, (trade) => trade.invalidationAtrBucket),
      volatility: countBy(trades, (trade) => trade.volatilityRegime),
      displacement: countBy(trades, (trade) => trade.displacementBucket)
    },
    variants,
    acceptedVariant,
    productionV4Verification: {
      profileId: "ifvg_fresh_retest_v4_candidate",
      ...productionV4Summary,
      matchedAcceptedVariant: true,
      researchOnly: true,
      paperDemoEligible: false
    },
    monteCarlo: {
      usableOutcomes: monteCarlo.input.usableOutcomes,
      simulationCount: monteCarlo.input.simulationCount,
      tradesPerSimulation: monteCarlo.input.tradesPerSimulation,
      robustnessRating: monteCarlo.recommendation.robustnessRating,
      medianEndingR: monteCarlo.performance.medianEndingR,
      fifthPercentileEndingR: monteCarlo.performance.fifthPercentileEndingR,
      medianMaxDrawdownR: monteCarlo.performance.medianMaxDrawdownR,
      worstMaxDrawdownR: monteCarlo.performance.worstMaxDrawdownR,
      riskOfRuinPct: monteCarlo.performance.riskOfRuinPct,
      probabilityDrawdownOverLimitPct: monteCarlo.performance.probabilityDrawdownOverLimitPct,
      recommendedMaxRiskPerTradePct: monteCarlo.recommendation.recommendedMaxRiskPerTradePct,
      researchOnly: true
    },
    profileDecision: acceptedVariant ? "draft_new_v4_research_fork_only" : "keep_v3_frozen_no_v4_registration",
    nextAction: acceptedVariant
      ? "Collect untouched post-cutoff outcomes for ifvg_fresh_retest_v4_candidate before any evidence, maturity, or Paper-Demo review."
      : "Keep IFVG v3 frozen. Collect forward-only outcomes and revisit risk sizing or exit-policy research separately; do not mine compound historical filters.",
    authority,
    safety
  };
  assertSafe(report);
  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: "failed",
    diagnostic: "ifvg_v3_drawdown_refinement",
    error: error instanceof Error ? error.message : String(error),
    authority,
    safety
  }, null, 2));
  process.exitCode = 1;
});
