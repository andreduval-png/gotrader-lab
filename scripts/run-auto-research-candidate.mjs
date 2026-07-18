import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcLibRoot = path.join(workspaceRoot, "src", "lib");
const allowedVariants = new Set(["strict", "balanced", "exploratory", "all"]);
const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const config = {
  family: process.env.AUTO_RESEARCH_CANDIDATE_FAMILY || "reversal_expansion_confirmation",
  variant: process.env.AUTO_RESEARCH_VARIANT || "all",
  bridgeUrl: (process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341").replace(/\/$/, ""),
  requestedSymbol: process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ",
  brokerSymbol:
    process.env.MT5_READONLY_BROKER_SYMBOL ||
    process.env.MT5_READONLY_DEFAULT_SYMBOL ||
    "USTECH",
  timeframe: process.env.AUTO_RESEARCH_TIMEFRAME || process.env.MT5_READONLY_TEST_TIMEFRAME || "5m",
  candleLimit: Number(process.env.AUTO_RESEARCH_CANDLE_LIMIT || process.env.MT5_READONLY_TEST_LIMIT || 1000),
  lookbackDays: Math.max(0, Number(process.env.AUTO_RESEARCH_LOOKBACK_DAYS || 0)),
  historyEndOffsetDays: Math.max(0, Number(process.env.AUTO_RESEARCH_HISTORY_END_OFFSET_DAYS || 0)),
  historyChunkDays: Math.max(1, Number(process.env.AUTO_RESEARCH_HISTORY_CHUNK_DAYS || 10)),
  fetchTimeoutMs: Number(process.env.AUTO_RESEARCH_SOURCE_TIMEOUT_MS || process.env.MT5_READONLY_TEST_TIMEOUT_MS || 5000),
  maxCandidates: Number(process.env.AUTO_RESEARCH_MAX_CANDIDATES || 25),
  validationMode: process.env.AUTO_RESEARCH_VALIDATION_MODE || "direct"
};

if (!allowedVariants.has(config.variant)) {
  console.error(
    JSON.stringify(
      {
        status: "invalid_input",
        error: `AUTO_RESEARCH_VARIANT must be one of ${[...allowedVariants].join(", ")}.`,
        received: config.variant
      },
      null,
      2
    )
  );
  process.exit(1);
}

if (!["direct", "full"].includes(config.validationMode)) {
  console.error(
    JSON.stringify(
      {
        status: "invalid_input",
        error: "AUTO_RESEARCH_VALIDATION_MODE must be direct or full.",
        received: config.validationMode
      },
      null,
      2
    )
  );
  process.exit(1);
}

const safeArray = (value) => (Array.isArray(value) ? value : []);
const round = (value, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const nyTradingDate = (timestamp) => {
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) return "unknown";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const summarizeTradeSample = (trades, additionalCostR = 0) => {
  const returns = trades
    .map((trade) => Number(trade.rMultiple) - additionalCostR)
    .filter(Number.isFinite);
  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value < 0);
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of returns) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return {
    trades: returns.length,
    targetFirst: trades.filter((trade) => trade.outcome === "target_hit").length,
    invalidationFirst: trades.filter((trade) => trade.outcome === "stop_hit").length,
    stalled: trades.filter((trade) => trade.outcome === "expired").length,
    winRate: round(returns.length ? wins.length / returns.length : 0, 4),
    averageR: round(average(returns), 3),
    medianR: round(median(returns), 3),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 3) : grossProfit > 0 ? 99 : 0,
    maxDrawdownR: round(maxDrawdown, 3),
    uniqueTradingDates: new Set(trades.map((trade) => nyTradingDate(trade.openedAt))).size
  };
};
const countBy = (items, selector) => Object.fromEntries(
  [...items.reduce((counts, item) => {
    const key = selector(item) || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
);
const percentile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
};
const summarizeMonteCarlo = (trades, simulationCount = 2000) => {
  const returns = trades.map((trade) => Number(trade.rMultiple)).filter(Number.isFinite);
  if (returns.length < 30) {
    return {
      usableOutcomes: returns.length,
      simulationCount: 0,
      robustness: "insufficient_data",
      reason: "At least 30 compact outcomes are required for Monte Carlo."
    };
  }
  const tradesPerSimulation = Math.min(100, returns.length);
  let randomState = 0x51f15e;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x100000000;
  };
  const endingR = [];
  const drawdowns = [];
  const losingStreaks = [];
  let ruinCount = 0;
  for (let simulation = 0; simulation < simulationCount; simulation += 1) {
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let losingStreak = 0;
    let longestLosingStreak = 0;
    let ruined = false;
    for (let index = 0; index < tradesPerSimulation; index += 1) {
      const value = returns[Math.floor(random() * returns.length)];
      equity += value;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      losingStreak = value < 0 ? losingStreak + 1 : 0;
      longestLosingStreak = Math.max(longestLosingStreak, losingStreak);
      if (equity <= -20) ruined = true;
    }
    endingR.push(equity);
    drawdowns.push(maxDrawdown);
    losingStreaks.push(longestLosingStreak);
    if (ruined) ruinCount += 1;
  }
  const p5EndingR = percentile(endingR, 0.05);
  const medianDrawdownR = percentile(drawdowns, 0.5);
  const p95DrawdownR = percentile(drawdowns, 0.95);
  const riskOfRuinPct = (ruinCount / simulationCount) * 100;
  const robustness = p5EndingR > 0 && riskOfRuinPct < 1
    ? "strong"
    : p5EndingR > -5 && riskOfRuinPct < 5
      ? "moderate"
      : "weak";
  return {
    usableOutcomes: returns.length,
    simulationCount,
    tradesPerSimulation,
    robustness,
    medianEndingR: round(percentile(endingR, 0.5), 3),
    fifthPercentileEndingR: round(p5EndingR, 3),
    medianMaxDrawdownR: round(medianDrawdownR, 3),
    ninetyFifthPercentileMaxDrawdownR: round(p95DrawdownR, 3),
    worstMaxDrawdownR: round(Math.max(...drawdowns), 3),
    medianLongestLosingStreak: round(percentile(losingStreaks, 0.5), 0),
    ninetyFifthPercentileLongestLosingStreak: round(percentile(losingStreaks, 0.95), 0),
    riskOfRuinPct: round(riskOfRuinPct, 3),
    recommendedMaxRiskPerIdeaPct: round(Math.min(0.5, p95DrawdownR > 0 ? 10 / p95DrawdownR : 0.5), 2),
    note: "Deterministic bootstrap of compact R outcomes; ruin threshold is -20R. This is research evidence, not readiness or execution authority."
  };
};
const summarizeTemporalRobustness = (backtestResult) => {
  const trades = safeArray(backtestResult?.trades)
    .filter((trade) => trade?.bias !== "neutral" && Number.isFinite(Number(trade?.rMultiple)))
    .sort((left, right) => Date.parse(left.openedAt) - Date.parse(right.openedAt));
  const candles = safeArray(backtestResult?.candles);
  const firstTimestamp = candles[0]?.timestamp;
  const lastTimestamp = candles.at(-1)?.timestamp;
  const start = Date.parse(firstTimestamp);
  const end = Date.parse(lastTimestamp);
  const windowMs = 30 * 86_400_000;
  const stepMs = 15 * 86_400_000;
  const rollingWindows = [];
  if (Number.isFinite(start) && Number.isFinite(end)) {
    for (let cursor = start; cursor + windowMs <= end + 1; cursor += stepMs) {
      const scoped = trades.filter((trade) => {
        const value = Date.parse(trade.openedAt);
        return value >= cursor && value < cursor + windowMs;
      });
      rollingWindows.push({
        from: new Date(cursor).toISOString().slice(0, 10),
        to: new Date(cursor + windowMs).toISOString().slice(0, 10),
        ...summarizeTradeSample(scoped)
      });
    }
  }
  const midpoint = Math.floor(trades.length / 2);
  const firstHalf = summarizeTradeSample(trades.slice(0, midpoint));
  const secondHalf = summarizeTradeSample(trades.slice(midpoint));
  const activeWindows = rollingWindows.filter((window) => window.trades > 0);
  const weakWindows = activeWindows.filter((window) => window.averageR <= 0 || window.profitFactor <= 1);
  const summary = summarizeTradeSample(trades);
  const independentPass =
    summary.trades >= 20 &&
    summary.uniqueTradingDates >= 3 &&
    activeWindows.length >= 2 &&
    secondHalf.trades >= 10 &&
    secondHalf.averageR > 0 &&
    secondHalf.profitFactor > 1;
  const classification = !independentPass
    ? summary.trades < 20
      ? "insufficient_data"
      : "promising_but_unstable"
    : weakWindows.length > Math.floor(activeWindows.length * 0.4)
      ? "promising_but_unstable"
      : "ready_for_formal_walk_forward";
  return {
    summary,
    costSensitivity: {
      modeledCostOnly: summary,
      additional025R: summarizeTradeSample(trades, 0.25),
      additional05R: summarizeTradeSample(trades, 0.5),
      additional10R: summarizeTradeSample(trades, 1)
    },
    firstHalf,
    secondHalf,
    rolling: {
      windowDays: 30,
      stepDays: 15,
      windowCount: rollingWindows.length,
      activeWindows: activeWindows.length,
      positiveWindows: activeWindows.length - weakWindows.length,
      weakWindows: weakWindows.length,
      windows: rollingWindows
    },
    bySide: countBy(trades, (trade) => trade.bias),
    bySession: countBy(trades, (trade) => trade.session),
    monteCarlo: summarizeMonteCarlo(trades),
    classification,
    nextAction: classification === "ready_for_formal_walk_forward"
      ? "Run deterministic rolling walk-forward with the profile frozen; do not change gates or promote readiness yet."
      : "Keep the profile research-only and inspect weak windows before any progression."
  };
};
const debug = (...args) => {
  if (process.env.AUTO_RESEARCH_DEBUG === "1") {
    console.error("[auto-research-candidate]", ...args);
  }
};

const fetchJson = async (url, timeoutMs = config.fetchTimeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    return {
      ok: response.ok,
      status: response.status,
      payload,
      url
    };
  } finally {
    clearTimeout(timeout);
  }
};

const printAndExit = (payload, exitCode = 0) => {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
};

const fetchMt5Source = async () => {
  const query = new URLSearchParams({
    requestedSymbol: config.requestedSymbol,
    symbol: config.brokerSymbol,
    timeframe: config.timeframe,
    limit: String(config.candleLimit)
  });

  const healthUrl = `${config.bridgeUrl}/health`;
  const statusUrl = `${config.bridgeUrl}/status`;
  const candlesUrl = `${config.bridgeUrl}/candles?${query.toString()}`;
  let health;
  let status;
  let candlesResponse;

  try {
    health = await fetchJson(healthUrl);
    status = await fetchJson(statusUrl);
    candlesResponse = await fetchJson(candlesUrl);
    if (config.lookbackDays > 0 && candlesResponse.ok) {
      const latestPayload = candlesResponse.payload && typeof candlesResponse.payload === "object"
        ? candlesResponse.payload
        : {};
      const latestRows = safeArray(latestPayload.candles);
      const anchorTimestamp = latestPayload.lastTimestamp ?? latestRows.at(-1)?.timestamp;
      if (!anchorTimestamp) throw new Error("MT5 latest endpoint did not provide a history anchor timestamp.");
      const end = Date.parse(anchorTimestamp) - config.historyEndOffsetDays * 86_400_000;
      const start = end - config.lookbackDays * 86_400_000;
      const rangeRows = [];
      const chunks = [];
      for (let cursor = start; cursor < end; cursor += config.historyChunkDays * 86_400_000) {
        const next = Math.min(end, cursor + config.historyChunkDays * 86_400_000);
        const rangeUrl = `${config.bridgeUrl}/candles/range?${new URLSearchParams({
          requestedSymbol: config.requestedSymbol,
          symbol: config.brokerSymbol,
          timeframe: config.timeframe,
          from: new Date(cursor).toISOString(),
          to: new Date(next).toISOString(),
          limit: "5000"
        }).toString()}`;
        const rangeResponse = await fetchJson(rangeUrl);
        if (!rangeResponse.ok) throw new Error(`MT5 range endpoint returned HTTP ${rangeResponse.status}.`);
        const rangePayload = rangeResponse.payload && typeof rangeResponse.payload === "object" ? rangeResponse.payload : {};
        const rows = safeArray(rangePayload.candles);
        rangeRows.push(...rows);
        chunks.push({ from: new Date(cursor).toISOString(), to: new Date(next).toISOString(), returnedCount: rows.length });
      }
      candlesResponse = {
        ok: true,
        status: 200,
        url: `${config.bridgeUrl}/candles/range`,
        payload: {
          ...latestPayload,
          candles: rangeRows,
          returnedCount: rangeRows.length,
          historyMode: "explicit_chunked_range",
          lookbackDays: config.lookbackDays,
          historyEndOffsetDays: config.historyEndOffsetDays,
          chunks
        }
      };
    }
  } catch (error) {
    return {
      ok: false,
      health,
      status,
      error: error instanceof Error ? error.message : String(error),
      attemptedUrl: candlesUrl
    };
  }

  const payload = candlesResponse.payload && typeof candlesResponse.payload === "object"
    ? candlesResponse.payload
    : undefined;
  const candles = safeArray(payload?.candles);
  const returnedCount = Number(payload?.returnedCount ?? payload?.candleCount ?? candles.length);
  return {
    ok: candlesResponse.ok && candles.length > 0,
    health,
    status,
    candlesResponse,
    candlesPayload: payload,
    returnedCount,
    attemptedUrl: candlesUrl
  };
};

const failSourceUnavailable = (sourceResult) => {
  printAndExit(
    {
      status: "source_unavailable",
      message: "MT5 read-only source is unavailable to the headless candidate runner.",
      family: config.family,
      variant: config.variant,
      source: {
        provider: "mt5_read_only",
        bridgeUrl: config.bridgeUrl,
        requestedSymbol: config.requestedSymbol,
        brokerSymbol: config.brokerSymbol,
        timeframe: config.timeframe,
        requestedLimit: config.candleLimit,
        attemptedUrl: sourceResult.attemptedUrl,
        health: compactEndpoint(sourceResult.health),
        status: compactEndpoint(sourceResult.status),
        candles: compactEndpoint(sourceResult.candlesResponse),
        error: sourceResult.error
      },
      instructions: [
        "Start the MT5 upstream server.",
        "Start the GoTrader MT5 read-only wrapper with npm.cmd run mt5:readonly-bridge.",
        "Confirm the feed with npm.cmd run test:mt5-readonly.",
        "Set MT5_READONLY_BROKER_SYMBOL=USTECH if the broker symbol is not persisted in your shell."
      ],
      safetyAuthority: authorityNone
    },
    1
  );
};

const compactEndpoint = (result) => {
  if (!result) {
    return undefined;
  }
  const payload = result.payload && typeof result.payload === "object" ? result.payload : undefined;
  return {
    ok: result.ok,
    status: result.status,
    url: result.url,
    connectionStatus: payload?.connectionStatus ?? payload?.upstreamStatus,
    warning: safeArray(payload?.warnings)[0],
    error: payload?.error ?? (typeof result.payload === "string" ? result.payload.slice(0, 160) : undefined)
  };
};

const normalizeCandle = (raw, index) => {
  const timestamp = String(raw?.timestamp ?? raw?.time ?? "");
  const open = Number(raw?.open);
  const high = Number(raw?.high);
  const low = Number(raw?.low);
  const close = Number(raw?.close);
  const volume = Number(raw?.volume ?? raw?.tickVolume ?? 0);
  if (!timestamp || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
    return undefined;
  }
  return {
    id: String(raw?.id ?? `mt5_${timestamp}_${index}`),
    symbol: config.requestedSymbol,
    timeframe: config.timeframe,
    timestamp,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume) ? volume : 0
  };
};

const normalizeCandles = (rawCandles) => {
  const byTimestamp = new Map();
  rawCandles.forEach((raw, index) => {
    const candle = normalizeCandle(raw, index);
    if (candle) {
      byTimestamp.set(candle.timestamp, candle);
    }
  });
  return [...byTimestamp.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
};

const fingerprintFor = (candles) => {
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) {
    return "empty";
  }
  return [
    "mt5_read_only",
    config.requestedSymbol,
    config.brokerSymbol,
    config.timeframe,
    candles.length,
    first.timestamp,
    last.timestamp,
    first.close,
    last.close
  ].join("|");
};

const collectSourceFiles = (root) => {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        files.push(fullPath);
      }
    }
  };
  walk(root);
  return files;
};

const compileLibraryBundle = () => {
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gotrader-auto-research-"));
  fs.writeFileSync(path.join(outRoot, "package.json"), JSON.stringify({ type: "module" }), "utf8");
  const workspaceNodeModules = path.join(workspaceRoot, "node_modules");
  if (fs.existsSync(workspaceNodeModules)) {
    try {
      fs.symlinkSync(workspaceNodeModules, path.join(outRoot, "node_modules"), "junction");
    } catch {
      // If the junction already exists or the filesystem rejects it, Node may still resolve
      // dependencies through absolute package imports rewritten by the caller's environment.
    }
  }
  const sourceFiles = collectSourceFiles(srcLibRoot);
  const sourceSet = new Set(sourceFiles.map((file) => path.normalize(file)));

  const sourceToOutput = (sourcePath) => {
    const relative = path.relative(srcLibRoot, sourcePath);
    return path.join(outRoot, relative).replace(/\.ts$/, ".js");
  };

  const candidatePathsFor = (basePath) => [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts")
  ];

  const resolveSourceSpecifier = (specifier, fromSource) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
      return undefined;
    }
    const basePath = specifier.startsWith("@/")
      ? path.join(workspaceRoot, "src", specifier.slice(2))
      : path.resolve(path.dirname(fromSource), specifier);
    const match = candidatePathsFor(basePath).find((candidate) => sourceSet.has(path.normalize(candidate)));
    return match;
  };

  const toImportSpecifier = (targetSource, fromSource) => {
    const fromOutput = sourceToOutput(fromSource);
    const targetOutput = sourceToOutput(targetSource);
    let relative = path.relative(path.dirname(fromOutput), targetOutput).replace(/\\/g, "/");
    if (!relative.startsWith(".")) {
      relative = `./${relative}`;
    }
    return relative;
  };

  const rewriteSpecifier = (specifier, fromSource) => {
    const resolved = resolveSourceSpecifier(specifier, fromSource);
    return resolved ? toImportSpecifier(resolved, fromSource) : specifier;
  };

  const rewriteImports = (sourceText, sourcePath) =>
    sourceText
      .replace(/(from\s+["'])([^"']+)(["'])/g, (_match, prefix, specifier, suffix) =>
        `${prefix}${rewriteSpecifier(specifier, sourcePath)}${suffix}`
      )
      .replace(/(import\s*\(\s*["'])([^"']+)(["']\s*\))/g, (_match, prefix, specifier, suffix) =>
        `${prefix}${rewriteSpecifier(specifier, sourcePath)}${suffix}`
      )
      .replace(/(import\s+["'])([^"']+)(["'])/g, (_match, prefix, specifier, suffix) =>
        `${prefix}${rewriteSpecifier(specifier, sourcePath)}${suffix}`
      );

  for (const sourcePath of sourceFiles) {
    const rewritten = rewriteImports(fs.readFileSync(sourcePath, "utf8"), sourcePath);
    const output = ts.transpileModule(rewritten, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false,
        sourceMap: false
      },
      fileName: sourcePath
    }).outputText;
    const outputPath = sourceToOutput(sourcePath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, output, "utf8");
  }

  return {
    outRoot,
    importLib: (relativePath) => import(pathToFileURL(path.join(outRoot, relativePath)).href)
  };
};

const variantForCandidate = (candidate) => {
  if (["ifvg_filtered_v2_research", "ifvg_fresh_retest_v3_research", "cmd_high_displacement_v2_research"].includes(candidate.candidateFamily)) {
    return "balanced";
  }
  const label = String(candidate.label || "").toLowerCase();
  if (label.includes("strict")) {
    return "strict";
  }
  if (label.includes("balanced")) {
    return "balanced";
  }
  if (label.includes("exploratory")) {
    return "exploratory";
  }
  return "unknown";
};

const reportGrinch = (backtestResult) => {
  const summary = backtestResult?.summary?.grinchSummary;
  const latestScore = summary?.latestScore;
  const reversalProfile = latestScore?.evaluatedProfiles?.find((profile) => profile.profile === "reversal");
  const missingExpansionEvidence = safeArray(latestScore?.missingEvidence)
    .filter((item) => /12am|london|expansion|reversal/i.test(item))
    .slice(0, 8);
  const expansionConfirmedByReason = safeArray(latestScore?.reasons).some((item) => /expanded away|reversal profile/i.test(item));
  const conditionPassed = Boolean(
    latestScore &&
      reversalProfile &&
      (reversalProfile.selectable || latestScore.activeProfile === "reversal") &&
      !missingExpansionEvidence.some((item) => /no clean expansion away/i.test(item)) &&
      (expansionConfirmedByReason || latestScore.activeProfile === "reversal")
  );
  const status = !latestScore ? "unavailable" : conditionPassed ? "passed" : "missing_evidence";
  return {
    selectedProfile: latestScore?.activeProfile ?? "none",
    setupQuality: latestScore?.setupQuality,
    hardGateReason: latestScore?.hardGateReason,
    timingStatus: reversalProfile?.timingGrade ?? latestScore?.timingGrade,
    expansionConfirmationStatus: status,
    reversalExpansionConditionPassed: conditionPassed,
    reversalProfileState: reversalProfile?.state,
    reversalEntryIntent: reversalProfile?.entryIntent,
    profileCandidateCount: summary?.profileCandidateCounts?.reversal ?? 0,
    missingExpansionEvidence: missingExpansionEvidence.length
      ? missingExpansionEvidence
      : conditionPassed
        ? []
        : ["Reversal expansion evidence was not available in the latest Grinch score."],
    missingEvidence: safeArray(latestScore?.missingEvidence).slice(0, 12),
    supportingReasons: safeArray(latestScore?.reasons).slice(0, 8),
    score: latestScore?.grinchModelScore,
    falsePositiveRisk: latestScore?.falsePositiveRisk,
    profileValidity: latestScore?.profileValidity
  };
};

const compactReplayDiagnostics = (diagnostics) => ({
  title: diagnostics?.title,
  generatedAt: diagnostics?.generatedAt,
  timingDate: diagnostics?.timingDate,
  timingZone: diagnostics?.timingZone,
  sourceTimestampZone: diagnostics?.sourceTimestampZone,
  sessionModel: diagnostics?.sessionModel,
  twelveAmOpen: diagnostics?.twelveAmOpen,
  sundayOpen: diagnostics?.sundayOpen,
  londonInteraction: diagnostics?.londonInteraction,
  expansionWindow: diagnostics?.expansionWindow,
  expansionTest: diagnostics?.expansionTest,
  failureReason: diagnostics?.expansionTest?.failureReason,
  nearMissScore: diagnostics?.nearMissScore,
  recommendation: diagnostics?.recommendation,
  candidateCandles: safeArray(diagnostics?.candidateCandles).slice(0, 16),
  overlaySummary: diagnostics?.overlaySummary,
  safetyNotice: diagnostics?.safetyNotice
});

const buildExpansionReplayDiagnostics = ({ candles, modules }) => {
  const latest = candles[candles.length - 1];
  const options = {
    symbol: config.requestedSymbol,
    timeframe: config.timeframe,
    currentTimestamp: latest?.timestamp,
    sourceProvider: "mt5_read_only",
    requestedSymbol: config.requestedSymbol,
    brokerSymbol: config.brokerSymbol
  };
  const phase1 = modules.analyzeGrinchPhase1({
    candles,
    options
  });
  const reversal = modules.analyzeGrinchPhase2Reversal({
    candles,
    phase1,
    options
  });
  return modules.buildGrinchExpansionReplayDiagnostics({
    candles,
    phase1,
    reversal,
    sessionTimeMapping: phase1.sessionTimeMapping
  });
};

const summarizeBacktest = (result) => ({
  trades: result.summary.totalTrades,
  directionalTrades: result.summary.directionalTrades,
  skippedSignals: result.summary.skippedSignals,
  winRate: round(result.summary.winRate, 3),
  averageR: round(result.summary.averageR, 2),
  drawdown: round(result.summary.maxDrawdown, 2),
  profitFactor: result.summary.profitFactor,
  bestTradeR: round(result.summary.bestTrade?.rMultiple ?? 0, 2),
  worstTradeR: round(result.summary.worstTrade?.rMultiple ?? 0, 2),
  strategyProfileSummary: result.summary.strategyProfileSummary
});

const metricsFromBacktest = (result) => {
  const grinchSummary = result.summary.grinchSummary;
  const falsePositiveRisk = grinchSummary?.averageFalsePositiveRisk ?? grinchSummary?.latestScore?.falsePositiveRisk ?? 0;
  const detectorProfile = result.summary.strategyProfileSummary?.strategyProfile !== "agent_consensus";
  const estimatedFalsePositives = detectorProfile
    ? safeArray(result.trades).filter((trade) => trade?.outcome === "stop_hit").length
    : Math.round(result.summary.totalTrades * (1 - result.summary.winRate) * (falsePositiveRisk / 100));
  return {
    validationId: `headless_direct_${Date.now()}`,
    validationTimestamp: new Date().toISOString(),
    totalTrades: result.summary.totalTrades,
    winRate: round(result.summary.winRate, 3),
    averageR: round(result.summary.averageR, 2),
    maxDrawdown: round(result.summary.maxDrawdown, 2),
    profitFactor: result.summary.profitFactor,
    skippedSignals: result.summary.skippedSignals,
    falsePositiveCount: estimatedFalsePositives,
    confidenceCalibration: null,
    readinessScore: null,
    readinessStatus: "not_evaluated",
    stabilityScore: null,
    conservativeScenarioStable: false,
    strongestScenario: "not_evaluated",
    weakestScenario: "not_evaluated"
  };
};

const directComparison = (baselineMetrics, metrics) => {
  const positiveChanges = [];
  const negativeChanges = [];
  if (metrics.averageR > baselineMetrics.averageR) {
    positiveChanges.push(`Average R improved: ${baselineMetrics.averageR}R -> ${metrics.averageR}R.`);
  } else if (metrics.averageR < baselineMetrics.averageR) {
    negativeChanges.push(`Average R weakened: ${baselineMetrics.averageR}R -> ${metrics.averageR}R.`);
  }
  if (metrics.winRate > baselineMetrics.winRate) {
    positiveChanges.push(`Win rate improved: ${round(baselineMetrics.winRate * 100, 1)}% -> ${round(metrics.winRate * 100, 1)}%.`);
  } else if (metrics.winRate < baselineMetrics.winRate) {
    negativeChanges.push(`Win rate weakened: ${round(baselineMetrics.winRate * 100, 1)}% -> ${round(metrics.winRate * 100, 1)}%.`);
  }
  if (metrics.maxDrawdown < baselineMetrics.maxDrawdown) {
    positiveChanges.push(`Drawdown improved: ${baselineMetrics.maxDrawdown}R -> ${metrics.maxDrawdown}R.`);
  } else if (metrics.maxDrawdown > baselineMetrics.maxDrawdown) {
    negativeChanges.push(`Drawdown worsened: ${baselineMetrics.maxDrawdown}R -> ${metrics.maxDrawdown}R.`);
  }
  const improved =
    metrics.averageR >= baselineMetrics.averageR &&
    metrics.winRate >= baselineMetrics.winRate &&
    metrics.maxDrawdown <= baselineMetrics.maxDrawdown &&
    metrics.totalTrades > 0;
  const profitableResearchCandidate =
    metrics.totalTrades >= 20 &&
    metrics.averageR > 0 &&
    Number(metrics.profitFactor ?? 0) > 1;
  return {
    improved,
    stabilityImproved: metrics.maxDrawdown <= baselineMetrics.maxDrawdown,
    recommendation: improved || profitableResearchCandidate ? "keep_testing" : "reject",
    promotionVerdict: "needs_full_validation",
    summary: improved
      ? "Direct headless backtest improved headline metrics; full validation and walk-forward are still required."
      : profitableResearchCandidate
        ? "Direct backtest is profitable with a sufficient research sample, but drawdown or another headline metric did not beat baseline; keep testing without promotion."
      : "Direct headless backtest did not improve enough headline metrics for promotion.",
    positiveChanges,
    negativeChanges,
    criticalRegressions: metrics.totalTrades < 3 ? ["Direct backtest trade sample is too small."] : [],
    sanityWarnings: [
      "Direct mode does not run the full validation suite, evidence ledger, maturity review, or walk-forward."
    ],
    followUpSearchDirection: "Run AUTO_RESEARCH_VALIDATION_MODE=full or the UI Auto Research workflow before treating this as promotion evidence."
  };
};

const directScoreBreakdown = (baselineMetrics, metrics, grinch) => {
  const tradeCountScore = Math.min(100, metrics.totalTrades * 12);
  const averageRScore = Math.min(100, Math.max(0, ((metrics.averageR + 0.4) / 1.4) * 100));
  const winRateScore = Math.min(100, Math.max(0, metrics.winRate * 100));
  const drawdownScore = Math.min(100, Math.max(0, 100 - metrics.maxDrawdown * 14));
  const falsePositiveScore = Math.min(100, Math.max(0, 100 - metrics.falsePositiveCount * 12));
  const grinchModelScore = grinch.score ?? 50;
  const stabilityImproved = metrics.maxDrawdown <= baselineMetrics.maxDrawdown;
  const sufficientSample = metrics.totalTrades >= 2 && metrics.totalTrades >= Math.max(2, baselineMetrics.totalTrades * 0.35);
  const totalScore = Math.round(
    averageRScore * 0.18 +
      winRateScore * 0.14 +
      drawdownScore * 0.16 +
      falsePositiveScore * 0.14 +
      tradeCountScore * 0.14 +
      grinchModelScore * 0.24
  );
  return {
    totalScore,
    grinchModelScore: Math.round(grinchModelScore),
    grinchFalsePositiveRisk: grinch.falsePositiveRisk,
    grinchProfileValidity: grinch.profileValidity,
    stabilityImproved,
    sufficientSample,
    rationale:
      "Direct headless score uses single-window backtest metrics and Grinch support only; full Auto Research scoring requires validation mode."
  };
};

const detectorProfileComparison = (walkForward) => {
  const historicalPass = walkForward.verdict === "passed";
  const forwardEvidenceRequired = walkForward.verdict === "forward_evidence_required";
  return {
  improved: historicalPass,
  stabilityImproved: historicalPass,
  recommendation: historicalPass || forwardEvidenceRequired ? "keep_testing" : "reject",
  promotionVerdict: "needs_follow_up",
  summary:
    historicalPass
      ? "The frozen detector profile passed chronological holdout validation. Keep it research-only and collect untouched forward evidence."
      : forwardEvidenceRequired
        ? "The active MT5 window is post-cutoff forward data. Preserve the frozen historical audit and collect untouched outcomes."
      : `The frozen detector profile did not pass chronological holdout validation (${walkForward.verdict}).`,
  positiveChanges:
    historicalPass
      ? [
          `${walkForward.oosWindowsPassed}/${walkForward.oosWindowCount} OOS windows passed.`,
          `Pooled OOS expectancy is ${walkForward.pooledOos.averageR}R with ${walkForward.totalOosTrades} trades.`
        ]
      : [],
  negativeChanges: walkForward.blockers,
  criticalRegressions: historicalPass || forwardEvidenceRequired ? [] : walkForward.blockers,
  sanityWarnings: walkForward.warnings,
  followUpSearchDirection: walkForward.nextAction
  };
};

const detectorProfileScoreBreakdown = (metrics, walkForward) => {
  const sampleScore = Math.min(100, (walkForward.totalOosTrades / 60) * 100);
  const expectancyScore = Math.min(100, Math.max(0, (walkForward.pooledOos.averageR / 2) * 100));
  const windowScore = walkForward.oosWindowPassRate * 100;
  const costScore = Math.min(100, Math.max(0, (walkForward.additionalCost05R.averageR / 1.5) * 100));
  const dateScore = Math.min(100, (walkForward.uniqueOosTradingDates / 30) * 100);
  return {
    totalScore: Math.round(sampleScore * 0.2 + expectancyScore * 0.25 + windowScore * 0.25 + costScore * 0.2 + dateScore * 0.1),
    stabilityImproved: walkForward.verdict === "passed",
    sufficientSample: walkForward.totalOosTrades >= 40,
    rationale:
      "Detector-profile score uses frozen chronological OOS windows, pooled expectancy, cost stress, and independent dates. It cannot promote readiness."
  };
};

const summarizeCandidate = ({
  candidate,
  variant,
  backtestResult,
  validationReport,
  quality,
  readiness,
  metrics,
  comparison,
  scoreBreakdown,
  expansionReplayDiagnostics,
  profileWalkForward
}) => {
  const grinch = reportGrinch(backtestResult);
  const strategySummary = backtestResult.summary.strategyProfileSummary;
  const isDetectorProfile = ["ifvg_filtered_v2_research", "ifvg_fresh_retest_v3_research", "cmd_high_displacement_v2_research"].includes(strategySummary?.strategyProfile);
  const strategyMissingEvidence = Object.entries(strategySummary?.blockerCounts ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([reason, count]) => `${reason.replace(/_/g, " ")} (${count})`);
  return {
    candidateId: candidate.candidateId,
    candidateFamily: candidate.candidateFamily,
    variant,
    label: candidate.label,
    rationale: candidate.rationale,
    researchOnly: candidate.candidateFamilyMetadata?.researchOnly ?? true,
    autoApplyAllowed: false,
    changedParameters: candidate.changedParameters,
    sourceProvider: "mt5_read_only",
    requestedSymbol: config.requestedSymbol,
    brokerSymbol: config.brokerSymbol,
    candleCount: validationReport?.sourceCandleCount ?? backtestResult.candles?.length ?? 0,
    grinchProfileSelected: isDetectorProfile ? "not_applicable" : grinch.selectedProfile,
    timingStatus: isDetectorProfile ? "not_applicable" : grinch.timingStatus,
    expansionConfirmationStatus: isDetectorProfile ? "not_applicable" : grinch.expansionConfirmationStatus,
    expansionConfirmationPassed: isDetectorProfile ? undefined : grinch.reversalExpansionConditionPassed,
    missingEvidence: isDetectorProfile ? strategyMissingEvidence : grinch.missingExpansionEvidence,
    backtest: summarizeBacktest(backtestResult),
    temporalRobustness: isDetectorProfile ? summarizeTemporalRobustness(backtestResult) : undefined,
    metricSource: profileWalkForward
      ? "detector_profile_frozen_oos"
      : config.validationMode === "full"
        ? "validation_suite"
        : "direct_backtest",
    trades: metrics.totalTrades,
    winRate: metrics.winRate,
    averageR: metrics.averageR,
    drawdown: metrics.maxDrawdown,
    profitFactor: metrics.profitFactor,
    falsePositives: metrics.falsePositiveCount,
    readiness: readiness?.state ?? "not_evaluated_headless_direct_mode",
    readinessScore: metrics.readinessScore,
    evidenceScore: "unavailable_in_headless_runner",
    maturityScore: "unavailable_in_headless_runner",
    walkForwardVerdict: profileWalkForward?.verdict ?? "not_run",
    profileWalkForward,
    expansionReplayDiagnostics,
    validationReadinessStatus: metrics.readinessStatus,
    stabilityScore: metrics.stabilityScore,
    scoreBreakdown: {
      totalScore: scoreBreakdown.totalScore,
      grinchModelScore: scoreBreakdown.grinchModelScore,
      grinchFalsePositiveRisk: scoreBreakdown.grinchFalsePositiveRisk,
      grinchProfileValidity: scoreBreakdown.grinchProfileValidity,
      stabilityImproved: scoreBreakdown.stabilityImproved,
      sufficientSample: scoreBreakdown.sufficientSample,
      rationale: scoreBreakdown.rationale
    },
    comparison: {
      improved: comparison.improved,
      stabilityImproved: comparison.stabilityImproved,
      recommendation: comparison.recommendation,
      promotionVerdict: comparison.promotionVerdict,
      summary: comparison.summary,
      criticalRegressions: comparison.criticalRegressions,
      sanityWarnings: comparison.sanityWarnings,
      followUpSearchDirection: comparison.followUpSearchDirection
    },
    researchQuality: quality
      ? {
          readinessGrade: quality.readinessGrade,
          readinessScore: quality.readinessScore,
          weakestSessions: safeArray(quality.sessionComparison)
            .filter((session) => session.readiness === "red")
            .slice(0, 3)
            .map((session) => session.session)
        }
      : {
          readinessGrade: "not_evaluated_headless_direct_mode",
          readinessScore: null,
          weakestSessions: []
        },
    grinch,
    safetyAuthority: authorityNone
  };
};

const main = async () => {
  debug("fetching MT5 source");
  const sourceResult = await fetchMt5Source();
  if (!sourceResult.ok) {
    failSourceUnavailable(sourceResult);
  }

  const rawCandles = safeArray(sourceResult.candlesPayload?.candles);
  const candles = normalizeCandles(rawCandles);
  const returnedCount = Number(sourceResult.candlesPayload?.returnedCount ?? candles.length);
  const sourceEligible = candles.length >= 400;
  if (!sourceEligible) {
    printAndExit(
      {
        status: "source_ineligible",
        message: "MT5 read-only candles loaded, but the source is not research-eligible for this candidate run.",
        family: config.family,
        variant: config.variant,
        source: {
          provider: "mt5_read_only",
          requestedSymbol: config.requestedSymbol,
          brokerSymbol: config.brokerSymbol,
          timeframe: config.timeframe,
          requestedLimit: config.candleLimit,
          returnedCount,
          normalizedCandleCount: candles.length,
          depthStatus: sourceResult.candlesPayload?.depthStatus,
          firstTimestamp: candles[0]?.timestamp,
          lastTimestamp: candles[candles.length - 1]?.timestamp,
          eligibilityReason: "researchCycle requires at least 400 valid candles."
        },
        instructions: [
          "Run npm.cmd run test:mt5-readonly to confirm MT5 depth.",
          "Increase AUTO_RESEARCH_CANDLE_LIMIT or MT5_READONLY_TEST_LIMIT if the provider has more history.",
          "Keep imported historical data for deep walk-forward if MT5 depth is insufficient."
        ],
        safetyAuthority: authorityNone
      },
      1
    );
  }

  debug("compiling TypeScript research modules");
  const bundle = compileLibraryBundle();
  debug("importing research modules");
  const backtesting = await bundle.importLib("backtesting/index.js");
  const { generateCandidateConfigs } = await bundle.importLib("autoResearch/generateCandidateConfigs.js");
  const strategyLibrary = await bundle.importLib("strategyLibrary/index.js");
  let fullValidationModules;
  let detectorProfileValidationModules;

  const baselineConfig = backtesting.sanitizeBacktestConfig({
    ...backtesting.loadBacktestConfig(),
    symbol: config.requestedSymbol,
    timeframe: config.timeframe
  });
  const expansionReplayDiagnostics = compactReplayDiagnostics(
    buildExpansionReplayDiagnostics({
      candles,
      modules: strategyLibrary
    })
  );

  debug("generating candidates");
  const allCandidates = generateCandidateConfigs(baselineConfig, "deep", config.maxCandidates);
  const familyCandidates = allCandidates.filter((candidate) => candidate.candidateFamily === config.family);
  const candidateConfigs = familyCandidates.filter((candidate) => {
    const variant = variantForCandidate(candidate);
    return config.variant === "all" || variant === config.variant;
  });

  if (!candidateConfigs.length) {
    printAndExit(
      {
        status: "candidate_not_found",
        message: "No Auto Research candidate configs matched the requested family/variant.",
        requested: {
          family: config.family,
          variant: config.variant
        },
        availableFamilies: [...new Set(allCandidates.map((candidate) => candidate.candidateFamily).filter(Boolean))],
        availableCandidates: allCandidates.map((candidate) => ({
          family: candidate.candidateFamily,
          variant: variantForCandidate(candidate),
          label: candidate.label
        })),
        safetyAuthority: authorityNone
      },
      1
    );
  }

  const detectorOnlyRun = candidateConfigs.every((candidate) => Boolean(candidate.config.strategyProfile));
  if (config.validationMode === "full" && detectorOnlyRun) {
    detectorProfileValidationModules = await bundle.importLib("walkForward/detectorProfileWalkForward.js");
  } else if (config.validationMode === "full") {
    fullValidationModules = {
      ...(await bundle.importLib("autoResearch/scoreCandidateConfig.js")),
      ...(await bundle.importLib("autoResearch/configSearchSpace.js")),
      ...(await bundle.importLib("validation/runValidationSuite.js")),
      ...(await bundle.importLib("researchQuality/analyzeValidationResults.js")),
      ...(await bundle.importLib("readiness/readinessGate.js")),
      ...(await bundle.importLib("selfImprovement/evaluateCalibrationProposal.js")),
      ...(await bundle.importLib("selfImprovement/compareProposalToBaseline.js")),
      ...(await bundle.importLib("simulationRunbook/storage.js"))
    };
  }
  const baselineCandles = config.lookbackDays > 0 && detectorOnlyRun
    ? candles.slice(-Math.min(1000, candles.length))
    : candles;
  debug("running baseline backtest", { candles: baselineCandles.length, detectorOnlyRun });
  // A generic-agent baseline is context, not the validation target for an
  // explicit detector profile. Keep that comparison bounded during deep CLI
  // history scans while the requested detector still receives every candle.
  const baselineBacktest = backtesting.runBacktest(baselineCandles, baselineConfig);
  let baselineMetrics;
  let baselineReadiness;
  if (config.validationMode === "full" && fullValidationModules) {
    debug("running baseline validation");
    const baselineValidation = fullValidationModules.runValidationSuite(baselineCandles, baselineConfig);
    baselineValidation.sourceCandleCount = baselineCandles.length;
    const baselineQuality = fullValidationModules.analyzeValidationResults(baselineValidation);
    baselineReadiness = fullValidationModules.evaluateReadinessGate({
      validation: baselineValidation,
      quality: baselineQuality,
      runbook: fullValidationModules.loadSimulationRunbookState()
    });
    baselineMetrics = fullValidationModules.summarizeValidationMetrics(baselineValidation);
  } else {
    baselineMetrics = metricsFromBacktest(baselineBacktest);
    baselineReadiness = { state: "not_evaluated_headless_direct_mode" };
  }

  const candidateReports = candidateConfigs.map((candidate) => {
    debug("evaluating candidate", candidate.label);
    const backtestResult = backtesting.runBacktest(candles, candidate.config);
    const grinch = reportGrinch(backtestResult);
    let validationReport;
    let quality;
    let readiness;
    let metrics;
    let comparison;
    let scoreBreakdown;
    let profileWalkForward;
    const strategyProfile = backtestResult.summary.strategyProfileSummary?.strategyProfile;
    const isDetectorProfile = strategyProfile && strategyProfile !== "agent_consensus";
    if (config.validationMode === "full" && isDetectorProfile && detectorProfileValidationModules) {
      debug("running frozen detector-profile walk-forward", candidate.label);
      profileWalkForward = detectorProfileValidationModules.runDetectorProfileWalkForward({
        profileId: strategyProfile,
        sourceProvider: "mt5_read_only",
        sourceFingerprint: fingerprintFor(candles),
        sourceStart: candles[0]?.timestamp ?? "",
        sourceEnd: candles.at(-1)?.timestamp ?? "",
        trades: safeArray(backtestResult.trades).map((trade) => ({
          openedAt: trade.openedAt,
          rMultiple: trade.rMultiple,
          outcome: trade.outcome
        }))
      });
      metrics = metricsFromBacktest(backtestResult);
      metrics.readinessStatus = "not_ready";
      readiness = { state: "Not Ready" };
      comparison = detectorProfileComparison(profileWalkForward);
      scoreBreakdown = detectorProfileScoreBreakdown(metrics, profileWalkForward);
    } else if (config.validationMode === "full" && fullValidationModules) {
      debug("running validation", candidate.label);
      validationReport = fullValidationModules.runValidationSuite(candles, candidate.config);
      validationReport.sourceCandleCount = candles.length;
      quality = fullValidationModules.analyzeValidationResults(validationReport);
      readiness = fullValidationModules.evaluateReadinessGate({
        validation: validationReport,
        quality,
        runbook: fullValidationModules.loadSimulationRunbookState()
      });
      metrics = fullValidationModules.summarizeValidationMetrics(validationReport);
      comparison = fullValidationModules.compareProposalToBaseline(baselineMetrics, metrics);
      scoreBreakdown = fullValidationModules.scoreCandidateConfig({
        baselineMetrics,
        metrics,
        validation: validationReport,
        quality,
        grinchScore: backtestResult.summary.grinchSummary?.latestScore,
        scoringCriteria: fullValidationModules.defaultAutoResearchScoringCriteria
      });
    } else {
      metrics = metricsFromBacktest(backtestResult);
      comparison = directComparison(baselineMetrics, metrics);
      scoreBreakdown = directScoreBreakdown(baselineMetrics, metrics, grinch);
    }

    return summarizeCandidate({
      candidate,
      variant: variantForCandidate(candidate),
      backtestResult,
      validationReport,
      quality,
      readiness,
      metrics,
      comparison,
      scoreBreakdown,
      expansionReplayDiagnostics,
      profileWalkForward
    });
  });

  const bestCandidate = [...candidateReports].sort((a, b) => b.scoreBreakdown.totalScore - a.scoreBreakdown.totalScore)[0];
  printAndExit({
    status: "completed",
    runner: "headless_auto_research_candidate",
    command: "npm.cmd run test:auto-research-candidate",
    inputs: {
      candidateFamily: config.family,
      variant: config.variant,
      maxCandidates: config.maxCandidates,
      validationMode: config.validationMode
    },
    source: {
      provider: "mt5_read_only",
      requestedSymbol: config.requestedSymbol,
      brokerSymbol: config.brokerSymbol,
      timeframe: config.timeframe,
      requestedLimit: config.candleLimit,
      returnedCount,
      normalizedCandleCount: candles.length,
      depthStatus: sourceResult.candlesPayload?.depthStatus,
      connectionStatus: sourceResult.candlesPayload?.connectionStatus,
      firstTimestamp: candles[0]?.timestamp,
      lastTimestamp: candles[candles.length - 1]?.timestamp,
      firstClose: candles[0]?.close,
      lastClose: candles[candles.length - 1]?.close,
      fingerprint: fingerprintFor(candles),
      eligibility: {
        chartDisplay: candles.length >= 5,
        quickAnalysis: candles.length >= 100,
        researchCycle: candles.length >= 400,
        walkForward: candles.length >= 1000
      },
      warnings: [
        "MT5 read-only USTECH is CFD/proxy data for MNQ/NQ-style research, not CME MNQ futures truth."
      ],
      safetyAuthority: authorityNone
    },
    baseline: {
      scope: {
        candleCount: baselineCandles.length,
        boundedForDetectorDiagnostic: baselineCandles.length !== candles.length,
        note: baselineCandles.length !== candles.length
          ? "Generic baseline is bounded to the latest 1,000 candles; the requested detector uses the full explicit history. No promotion comparison is inferred from different scopes."
          : "Baseline and candidate use the same source depth."
      },
      config: {
        symbol: baselineConfig.symbol,
        timeframe: baselineConfig.timeframe,
        sessionFilter: baselineConfig.sessionFilter,
        minimumConfluenceThreshold: baselineConfig.minimumConfluenceThreshold,
        minimumConfidenceThreshold: baselineConfig.minimumConfidenceThreshold,
        decisionInterval: baselineConfig.decisionInterval
      },
      backtest: summarizeBacktest(baselineBacktest),
      metrics: baselineMetrics,
      readiness: baselineReadiness.state,
      metricSource:
        config.validationMode === "full" && !detectorOnlyRun
          ? "validation_suite"
          : "generic_context_direct_backtest",
      grinch: reportGrinch(baselineBacktest),
      expansionReplayDiagnostics
    },
    candidateCount: candidateReports.length,
    bestCandidate: bestCandidate
      ? {
          label: bestCandidate.label,
          variant: bestCandidate.variant,
          totalScore: bestCandidate.scoreBreakdown.totalScore,
          recommendation: bestCandidate.comparison.recommendation,
          promotionVerdict: bestCandidate.comparison.promotionVerdict
        }
      : undefined,
    candidates: candidateReports,
    expansionReplayDiagnostics,
    guardrails: [
      "Runner is research-only.",
      "Auto-apply remains disabled.",
      "Production thresholds are not mutated.",
      "No execution intent, account mutation, order route, or readiness override is created.",
      config.validationMode === "full" && detectorOnlyRun
        ? "Frozen detector-profile chronological holdout validation ran; it cannot promote readiness or create execution authority."
        : config.validationMode === "full"
          ? "Full validation suite was run for baseline and requested candidates."
        : "Direct mode skips full validation, evidence ledger, maturity review, and walk-forward for speed."
    ],
    safetyAuthority: authorityNone
  });
};

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        safetyAuthority: authorityNone
      },
      null,
      2
    )
  );
  process.exit(1);
});
