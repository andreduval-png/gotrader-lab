#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "src", "lib", "ict-strategy-suite");
const outRoot = path.join(root, ".gotrader", "cmd-high-displacement-v2-performance");
const reportPath = path.join(root, "docs", "cmd-high-displacement-v2-validation-audit.md");
const bridgeUrl = (process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341").replace(/\/$/, "");
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const timeframe = "5m";
const lookbackDays = 90;
const chunkDays = 10;
const timeoutMs = Number(process.env.MT5_READONLY_TEST_TIMEOUT_MS || 15000);
const horizonBars = 24;
const tickSize = 0.25;
const frictionTicks = 3;
const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const sourceFiles = [
  "ictStrategySuiteTypes.ts",
  "ictStrategySuiteHelpers.ts",
  "ictSessionNarrativeTypes.ts",
  "ictSessionNarrative.ts",
  "ictCmdHighDisplacementV2Types.ts",
  "ictCmdHighDisplacementV2.ts"
];

function compileDetector() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });
  for (const file of sourceFiles) {
    const sourcePath = path.join(sourceRoot, file);
    const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText
      .replace(/from\s+"\.\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'\.\/([^']+)'/g, "from './$1.mjs'");
    fs.writeFileSync(path.join(outRoot, file.replace(/\.ts$/, ".mjs")), output, "utf8");
  }
}

const round = (value, digits = 4) => Number(Number.isFinite(value) ? value.toFixed(digits) : 0);
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const topCounts = (items, selector, limit = 12) => {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)))
    .slice(0, limit);
};

const endpoint = (route, params = {}) => {
  const url = new URL(`${bridgeUrl}/${route.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    const payload = response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}: ${String(payload).slice(0, 160)}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

const normalize = (raw) => {
  const byTime = new Map();
  for (const item of raw) {
    const timestamp = String(item?.timestamp ?? item?.time ?? "");
    const candle = {
      id: `mt5_cmd_v2_${timestamp}`,
      symbol: requestedSymbol,
      timeframe,
      timestamp,
      open: Number(item?.open),
      high: Number(item?.high),
      low: Number(item?.low),
      close: Number(item?.close),
      volume: Number(item?.volume ?? item?.tickVolume ?? item?.tick_volume ?? 0)
    };
    if (timestamp && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)) {
      byTime.set(timestamp, candle);
    }
  }
  return [...byTime.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
};

async function fetchPeriod(endOffsetDays) {
  const latest = await fetchJson(endpoint("candles", {
    requestedSymbol,
    symbol: brokerSymbol,
    timeframe,
    limit: 1000
  }));
  const latestTimestamp = latest?.lastTimestamp ?? latest?.candles?.at(-1)?.timestamp;
  if (!latestTimestamp) throw new Error("MT5 latest endpoint did not provide a last candle timestamp.");
  const end = Date.parse(latestTimestamp) - endOffsetDays * 86_400_000;
  const start = end - lookbackDays * 86_400_000;
  const raw = [];
  const chunks = [];
  for (let cursor = start; cursor < end; cursor += chunkDays * 86_400_000) {
    const next = Math.min(end, cursor + chunkDays * 86_400_000);
    const payload = await fetchJson(endpoint("candles/range", {
      requestedSymbol,
      symbol: brokerSymbol,
      timeframe,
      from: new Date(cursor).toISOString(),
      to: new Date(next).toISOString(),
      limit: 5000
    }));
    const rows = Array.isArray(payload?.candles) ? payload.candles : [];
    raw.push(...rows);
    chunks.push({ from: new Date(cursor).toISOString(), to: new Date(next).toISOString(), count: rows.length });
  }
  const candles = normalize(raw);
  return {
    candles,
    chunkCount: chunks.length,
    completedChunkCount: chunks.filter((chunk) => chunk.count > 0).length,
    candleCount: candles.length,
    firstTimestamp: candles[0]?.timestamp,
    lastTimestamp: candles.at(-1)?.timestamp,
    availableLookbackDays: candles.length > 1
      ? round((Date.parse(candles.at(-1).timestamp) - Date.parse(candles[0].timestamp)) / 86_400_000, 2)
      : 0,
    endOffsetDays
  };
}

const nyDate = (timestamp) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const nySession = (timestamp) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit"
  }).formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === "hour")?.value) % 24;
  if (hour >= 2 && hour < 5) return "London";
  if (hour >= 7 && hour < 12) return "New York AM";
  if (hour >= 12 && hour < 16) return "New York PM";
  return "off_hours";
};

const scoreOutcome = (candidate, decisionIndex, candles) => {
  const entry = candidate.entry;
  const stop = candidate.stop;
  const target = candidate.target;
  const risk = stop - entry;
  if (!(risk > 0 && target < entry)) return undefined;
  const future = candles.slice(decisionIndex + 1, decisionIndex + 1 + horizonBars);
  if (!future.length) return undefined;
  let outcome = "expired";
  let exitIndex = decisionIndex + future.length;
  let exit = future.at(-1);
  for (let offset = 0; offset < future.length; offset += 1) {
    const row = future[offset];
    const stopHit = row.high >= stop;
    const targetHit = row.low <= target;
    if (stopHit || targetHit) {
      outcome = stopHit ? "stop_hit" : "target_hit";
      exitIndex = decisionIndex + offset + 1;
      exit = row;
      break;
    }
  }
  const frictionR = (frictionTicks * tickSize) / risk;
  const targetR = (entry - target) / risk;
  const markR = (entry - exit.close) / risk;
  const rMultiple = outcome === "target_hit"
    ? targetR - frictionR
    : outcome === "stop_hit"
      ? -1 - frictionR
      : Math.max(-1, Math.min(targetR, markR)) - frictionR;
  return {
    decisionIndex,
    exitIndex,
    openedAt: candidate.signalTime ?? candles[decisionIndex].timestamp,
    resolvedAt: exit.timestamp,
    tradingDate: nyDate(candidate.signalTime ?? candles[decisionIndex].timestamp),
    session: nySession(candidate.signalTime ?? candles[decisionIndex].timestamp),
    outcome,
    rr: round(targetR, 3),
    rMultiple: round(rMultiple, 3),
    displacementScore: candidate.displacementScore,
    targetType: candidate.externalLiquidityTargetType
  };
};

const formationBlocked = (blockers) => blockers.some((blocker) =>
  /confirmed consolidation-manipulation-distribution|short-only|bearish displacement|stale|displacement score|FVG/i.test(blocker)
);

async function scanPeriod(detector, depth, label) {
  const candles = depth.candles;
  const fingerprint = `mt5_read_only|${requestedSymbol}|${brokerSymbol}|${timeframe}|${candles.length}|${candles[0]?.timestamp}|${candles.at(-1)?.timestamp}`;
  const blockerCounts = new Map();
  const formationBlockerCounts = new Map();
  const formationSamples = [];
  const trades = [];
  let formationCount = 0;
  let eligibleCount = 0;
  let overlapCount = 0;
  let activeUntilIndex = -1;
  for (let index = 160; index < candles.length - 1; index += 1) {
    if (index > 160 && index % 4000 === 0) process.stderr.write(`[cmd-v2] ${label}: ${index}/${candles.length}\n`);
    const assessment = detector.assessIctCmdHighDisplacementV2({
      candles: candles.slice(Math.max(0, index + 1 - 800), index + 1),
      requestedSymbol,
      brokerSymbol,
      timeframe,
      sourceProvider: "mt5_read_only",
      sourceFingerprint: fingerprint,
      requestedLookbackDays: lookbackDays,
      availableLookbackDays: depth.availableLookbackDays
    });
    if (!formationBlocked(assessment.blockers)) {
      formationCount += 1;
      for (const blocker of assessment.blockers) {
        formationBlockerCounts.set(blocker, (formationBlockerCounts.get(blocker) || 0) + 1);
      }
      if (formationSamples.length < 20) {
        formationSamples.push({
          tradingDate: nyDate(assessment.signalTime ?? candles[index].timestamp),
          session: nySession(assessment.signalTime ?? candles[index].timestamp),
          status: assessment.status,
          eligible: assessment.eligible,
          displacementScore: assessment.displacementScore,
          rr: assessment.rr,
          targetType: assessment.externalLiquidityTargetType,
          blockers: assessment.blockers
        });
      }
    }
    if (!assessment.eligible) {
      for (const blocker of assessment.blockers) blockerCounts.set(blocker, (blockerCounts.get(blocker) || 0) + 1);
      continue;
    }
    eligibleCount += 1;
    if (index <= activeUntilIndex) {
      overlapCount += 1;
      continue;
    }
    const trade = scoreOutcome(assessment, index, candles);
    if (!trade) continue;
    trades.push(trade);
    activeUntilIndex = trade.exitIndex;
  }
  return {
    label,
    depth: {
      candleCount: depth.candleCount,
      availableLookbackDays: depth.availableLookbackDays,
      chunkCount: depth.chunkCount,
      completedChunkCount: depth.completedChunkCount,
      firstTimestamp: depth.firstTimestamp,
      lastTimestamp: depth.lastTimestamp,
      sourceFingerprint: fingerprint
    },
    evaluatedWindows: Math.max(0, candles.length - 161),
    formationCount,
    eligibleCount,
    overlapCount,
    blockerDistribution: [...blockerCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    formationBlockerDistribution: [...formationBlockerCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    formationSamples,
    trades
  };
}

const metricsFor = (trades, firstTimestamp, lastTimestamp) => {
  const target = trades.filter((trade) => trade.outcome === "target_hit").length;
  const stop = trades.filter((trade) => trade.outcome === "stop_hit").length;
  const expired = trades.length - target - stop;
  const returns = trades.map((trade) => trade.rMultiple);
  const grossWins = returns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLosses = Math.abs(returns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  const start = Date.parse(firstTimestamp || "");
  const end = Date.parse(lastTimestamp || "");
  let activeRollingWindows = 0;
  const rolling = [];
  for (let cursor = start; Number.isFinite(cursor) && cursor < end; cursor += 15 * 86_400_000) {
    const windowTrades = trades.filter((trade) => {
      const time = Date.parse(trade.openedAt);
      return time >= cursor && time < cursor + 30 * 86_400_000;
    });
    if (windowTrades.length) activeRollingWindows += 1;
    rolling.push({
      start: new Date(cursor).toISOString().slice(0, 10),
      count: windowTrades.length,
      targetFirstRate: round(windowTrades.filter((trade) => trade.outcome === "target_hit").length / Math.max(1, windowTrades.length) * 100, 2),
      averageR: round(average(windowTrades.map((trade) => trade.rMultiple)), 3)
    });
  }
  const uniqueDates = new Set(trades.map((trade) => trade.tradingDate)).size;
  const averageR = round(average(returns), 3);
  const profitFactor = grossLosses ? round(grossWins / grossLosses, 3) : grossWins > 0 ? 999 : 0;
  const classification = trades.length < 20
    ? "needs_more_data"
    : uniqueDates < 3 || activeRollingWindows < 2
      ? "overfit_risk"
      : averageR <= 0 || profitFactor <= 1
        ? "rejected"
        : "ready_for_more_validation";
  return {
    candidateCount: trades.length,
    targetFirst: target,
    invalidationFirst: stop,
    stalled: expired,
    targetFirstRate: round(target / Math.max(1, trades.length) * 100, 2),
    invalidationFirstRate: round(stop / Math.max(1, trades.length) * 100, 2),
    averageR,
    medianR: round(median(returns), 3),
    averagePlannedRR: round(average(trades.map((trade) => trade.rr)), 3),
    profitFactor,
    maxDrawdownR: round(maxDrawdown, 3),
    uniqueTradingDates: uniqueDates,
    activeRollingWindows,
    classification,
    bySession: topCounts(trades, (trade) => trade.session),
    byOutcome: topCounts(trades, (trade) => trade.outcome),
    byTargetType: topCounts(trades, (trade) => trade.targetType),
    rollingWindows: rolling.filter((window) => window.count > 0)
  };
};

const safeScan = (scan) => ({
  label: scan.label,
  depth: scan.depth,
  evaluatedWindows: scan.evaluatedWindows,
  formationCount: scan.formationCount,
  eligibleCount: scan.eligibleCount,
  overlapCount: scan.overlapCount,
  blockerDistribution: scan.blockerDistribution,
  formationBlockerDistribution: scan.formationBlockerDistribution,
  formationSamples: scan.formationSamples,
  metrics: metricsFor(scan.trades, scan.depth.firstTimestamp, scan.depth.lastTimestamp)
});

const writeReport = (report) => {
  const current = report.periods.current;
  const prior = report.periods.priorIndependent;
  const rows = [current, prior].map((period) =>
    `| ${period.label} | ${period.metrics.candidateCount} | ${period.metrics.targetFirstRate}% | ${period.metrics.averageR} | ${period.metrics.profitFactor} | ${period.metrics.uniqueTradingDates} | ${period.metrics.activeRollingWindows} | ${period.metrics.classification} |`
  ).join("\n");
  const markdown = `# CMD High-Displacement v2 Causal Validation Audit\n\nGenerated: ${report.generatedAt}\n\n## Conclusion\n\n${report.conclusion}\n\nThis is research-only MT5 CFD/proxy analysis for MNQ-style research using USTECH. It does not grant execution, broker, or readiness authority.\n\n## Independent-period results\n\n| Period | Candidates | Target-first | Average R | Profit factor | Dates | Active rolling windows | Classification |\n|---|---:|---:|---:|---:|---:|---:|---|\n${rows}\n\n## Current blockers\n\n${current.blockerDistribution.map((item) => `- ${item.reason}: ${item.count}`).join("\n")}\n\n## Decision\n\n- Promotion: ${report.promotionDecision}\n- Next implementation: ${report.nextImplementation}\n- Authority: none / none / none\n- Raw candles serialized: no\n`;
  fs.writeFileSync(reportPath, markdown, "utf8");
};

async function main() {
  compileDetector();
  const detector = await import(`${pathToFileURL(path.join(outRoot, "ictCmdHighDisplacementV2.mjs")).href}?v=${Date.now()}`);
  const currentDepth = await fetchPeriod(0);
  const priorDepth = await fetchPeriod(90);
  assert(currentDepth.candleCount > 5000, "current explicit history must contain more than 5,000 candles");
  assert(priorDepth.candleCount > 5000, "prior independent history must contain more than 5,000 candles");
  const currentScan = await scanPeriod(detector, currentDepth, "current_90d");
  const priorScan = await scanPeriod(detector, priorDepth, "prior_independent_90d");
  const periods = {
    current: safeScan(currentScan),
    priorIndependent: safeScan(priorScan)
  };
  const independentPass = [periods.current.metrics, periods.priorIndependent.metrics].every((metrics) =>
    metrics.candidateCount >= 20 &&
    metrics.uniqueTradingDates >= 3 &&
    metrics.activeRollingWindows >= 2 &&
    metrics.averageR > 0 &&
    metrics.profitFactor > 1
  );
  const report = {
    status: "passed",
    generatedAt: new Date().toISOString(),
    strategyId: "cmd_high_displacement_v2_research",
    source: { provider: "mt5_read_only", requestedSymbol, brokerSymbol, timeframe, cfdProxy: true },
    periods,
    independentPass,
    conclusion: independentPass
      ? "The narrow detector has positive expectancy in both independent periods and is ready for deeper deterministic validation, not promotion."
      : "The executable detector has not passed independent-period evidence gates. Keep it research-only and use its blocker distribution to choose the next refinement.",
    promotionDecision: "no_promotion",
    nextImplementation: independentPass
      ? "Add HTF/session ablation and formal walk-forward validation for this exact executable profile."
      : "Refine only the dominant causally measured formation blocker, then repeat the same independent-period audit.",
    authority,
    safety: {
      researchOnly: true,
      rawCandlesSerialized: false,
      accountDataIncluded: false,
      orderDataIncluded: false,
      positionDataIncluded: false,
      brokerMutation: false
    }
  };
  const serialized = JSON.stringify(report);
  assert(!/"(rawCandles|candles|account|orders?|positions?|password|secret|apiKey)"\s*:/.test(serialized));
  assert.deepEqual(report.authority, authority);
  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`CMD high-displacement v2 performance diagnostic failed: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
