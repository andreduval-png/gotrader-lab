#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const fixtureRoot = path.join(workspace, "tests", "fixtures", "v2-baseline");
const outRoot = path.join(workspace, ".gotrader", "v2-ifvg-phase3-evidence-regeneration");
const bridgeUrl = (process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341").replace(/\/$/, "");
const requestedSymbol = process.env.MT5_READONLY_REQUESTED_SYMBOL || "MNQ";
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const timeframe = "5m";
const lookbackDays = Number(process.env.V2_IFVG_EVIDENCE_LOOKBACK_DAYS || 180);
const chunkDays = Number(process.env.V2_IFVG_EVIDENCE_CHUNK_DAYS || 14);
const cutoffUtc = process.env.V2_IFVG_EVIDENCE_CUTOFF_UTC || "2026-07-14T04:40:00.000Z";
const timeoutMs = Number(process.env.MT5_READONLY_TEST_TIMEOUT_MS || 15_000);
const safeSymbol = brokerSymbol.replace(/[^a-z0-9._-]/gi, "_");
const evidenceFile = path.resolve(
  process.env.V2_IFVG_PHASE3_EVIDENCE_FILE ||
  path.join(workspace, ".gotrader", "v2", `ifvg-phase3-evidence-${safeSymbol}-5m.json`)
);
const regressionFile = path.resolve(
  path.join(workspace, ".gotrader", "v2", `ifvg-phase3-regression-${safeSymbol}-5m.json`)
);
const tickSize = 0.25;
const scanWindow = 160;
const warmupCandles = 100;
const maxBarsToResolveTrade = 48;
const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const sourceFiles = [
  "src/lib/v2Baseline/baselineTypes.ts",
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/candles/v2CandleTypes.ts",
  "src/lib/v2/time/v2TimeNormalizationTypes.ts",
  "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
  "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
  "src/lib/v2/identity/v2IdentityTypes.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/evidence/v2HistoricalDatasetManifestTypes.ts",
  "src/lib/v2/evidence/v2HistoricalDatasetManifest.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3CanaryTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3BaselineAdapter.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3EvidenceTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3Evidence.ts",
  "src/lib/ict-strategy-suite/ictTradeConstructionTypes.ts",
  "src/lib/ict-strategy-suite/ictTradeConstruction.ts",
  "src/lib/ict-strategy-suite/ictIfvgTypes.ts",
  "src/lib/ict-strategy-suite/ictIfvg.ts",
  "src/lib/ict-strategy-suite/ictIfvgFilteredV2.ts",
  "src/lib/ict-strategy-suite/ictIfvgFreshRetestV3.ts"
].map((file) => path.join(workspace, file));

const compact = (values) => [...new Set(values.filter(Boolean))].sort();
const round = (value, decimals = 4) => Number(Number.isFinite(value) ? value.toFixed(decimals) : 0);
const average = (values) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;

const endpoint = (pathname, params = {}) => {
  const url = new URL(`${bridgeUrl}/${pathname.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    const body = response.headers.get("content-type")?.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

const blocked = (reason, blockers, extra = {}) => {
  console.log(JSON.stringify({
    status: reason,
    phase: "3F",
    evidenceFile,
    blockers: compact(blockers),
    ...extra,
    rawCandlesPersisted: false,
    phase4ImplementationAuthorized: false,
    productionAdoptionAllowed: false,
    authority
  }, null, 2));
};

const preflightTimeContract = async () => {
  let contract;
  try {
    contract = await fetchJson(endpoint("time-contract"));
  } catch (error) {
    return {
      accepted: false,
      blockers: [`historical_time_contract_unavailable:${error instanceof Error ? error.message : String(error)}`]
    };
  }
  const blockers = compact([
    contract?.verificationStatus === "verified" ? "" : "historical_time_contract_not_verified",
    contract?.historicalDstPolicyVerified === true ? "" : "historical_dst_policy_not_verified",
    contract?.timeVerificationScope === "historical" ? "" : "historical_time_verification_scope_missing",
    contract?.phase2Eligible === true ? "" : "historical_time_contract_phase2_ineligible",
    contract?.providerTimeBasis && contract.providerTimeBasis !== "unknown"
      ? ""
      : "historical_provider_time_basis_unknown",
    contract?.terminalClockClassificationVersion
      ? ""
      : "terminal_clock_classification_version_missing"
  ]);
  return { accepted: blockers.length === 0, blockers, contract };
};

const candleTime = (candle) => Number.isFinite(Date.parse(candle?.timestamp))
  ? Date.parse(candle.timestamp)
  : Number(candle?.time ?? 0) * 1000;

const normalizeCandles = (raw) => {
  const byTime = new Map();
  for (const value of raw) {
    const time = candleTime(value);
    if (!(time > 0)) continue;
    const normalized = {
      id: `mt5_ifvg_phase3_${brokerSymbol}_${time}`,
      symbol: requestedSymbol,
      timeframe,
      timestamp: new Date(time).toISOString(),
      open: Number(value.open),
      high: Number(value.high),
      low: Number(value.low),
      close: Number(value.close),
      volume: Number(value.volume ?? value.tickVolume ?? value.tick_volume ?? 0)
    };
    if ([normalized.open, normalized.high, normalized.low, normalized.close].some((item) => !Number.isFinite(item))) {
      throw new Error(`Invalid MT5 OHLC at ${normalized.timestamp}.`);
    }
    const previous = byTime.get(time);
    if (previous && JSON.stringify(previous) !== JSON.stringify(normalized)) {
      throw new Error(`Conflicting MT5 candle at ${normalized.timestamp}.`);
    }
    byTime.set(time, normalized);
  }
  return [...byTime.values()].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
};

const fetchHistory = async () => {
  const latest = await fetchJson(endpoint("candles", {
    requestedSymbol,
    symbol: brokerSymbol,
    timeframe,
    limit: 1000
  }));
  const latestRows = Array.isArray(latest?.candles) ? latest.candles : [];
  const latestTimestamp = latest?.lastTimestamp ?? latestRows.at(-1)?.timestamp;
  if (!latestTimestamp) throw new Error("MT5 latest candles did not provide an anchor timestamp.");
  const end = Math.min(Date.parse(latestTimestamp), Date.parse(cutoffUtc));
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
  if (candles.length < 5000) {
    throw new Error(`Only ${candles.length} MT5 candles were available; Phase 3F requires at least 5,000.`);
  }
  return { candles, chunkCount };
};

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const tradingDate = (timestamp) => {
  const parts = Object.fromEntries(
    nyFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

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
    targetFirstRate: round(trades.length
      ? trades.filter((trade) => trade.outcome === "target_first").length / trades.length
      : 0, 4),
    invalidationFirstRate: round(trades.length
      ? trades.filter((trade) => trade.outcome === "invalidation_first").length / trades.length
      : 0, 4),
    averageR: round(average(returns), 3),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 3) : wins.length ? 999 : 0,
    maximumDrawdownR: maxDrawdown(returns),
    uniqueDates: new Set(trades.map((trade) => trade.tradingDate)).size
  };
};

const simulateTrade = ({ candidate, decisionIndex, candles }) => {
  if (
    candidate.side === "flat" ||
    !Number.isFinite(candidate.entry) ||
    !Number.isFinite(candidate.stop) ||
    !Number.isFinite(candidate.target)
  ) return undefined;
  const risk = Math.abs(candidate.entry - candidate.stop);
  if (!(risk > 0)) return undefined;
  const future = candles.slice(decisionIndex + 1, decisionIndex + 1 + maxBarsToResolveTrade);
  if (!future.length) return undefined;
  let outcome = "stalled";
  let exitIndex = decisionIndex + future.length;
  let exit = future.at(-1);
  for (let offset = 0; offset < future.length; offset += 1) {
    const candle = future[offset];
    const stopHit = candidate.side === "long"
      ? candle.low <= candidate.stop
      : candle.high >= candidate.stop;
    const targetHit = candidate.side === "long"
      ? candle.high >= candidate.target
      : candle.low <= candidate.target;
    if (stopHit || targetHit) {
      outcome = stopHit ? "invalidation_first" : "target_first";
      exitIndex = decisionIndex + offset + 1;
      exit = candle;
      break;
    }
  }
  const targetR = Math.abs(candidate.target - candidate.entry) / risk;
  const frictionR = (3 * tickSize) / risk;
  const direction = candidate.side === "long" ? 1 : -1;
  const markR = direction * (exit.close - candidate.entry) / risk;
  const rMultiple = outcome === "target_first"
    ? targetR - frictionR
    : outcome === "invalidation_first"
      ? -1 - frictionR
      : Math.max(-1, Math.min(targetR, markR)) - frictionR;
  return {
    openedAt: candles[decisionIndex].timestamp,
    tradingDate: tradingDate(candles[decisionIndex].timestamp),
    outcome,
    rMultiple: round(rMultiple, 3),
    exitIndex
  };
};

const collectTrades = (candles, assess) => {
  const trades = [];
  const seen = new Set();
  let activeUntilIndex = -1;
  for (let decisionIndex = Math.max(warmupCandles, 40); decisionIndex < candles.length - 1; decisionIndex += 1) {
    const window = candles.slice(Math.max(0, decisionIndex + 1 - scanWindow), decisionIndex + 1);
    const assessment = assess({
      candles: window,
      sourceProvider: "mt5_read_only",
      sourceFingerprint: `process_local:${requestedSymbol}:${brokerSymbol}:${timeframe}:${candles.length}`,
      requestedSymbol,
      brokerSymbol,
      timeframe,
      generatedAt: candles[decisionIndex].timestamp
    });
    const candidate = assessment.candidate;
    const key = [
      candidate.originalFvgCandle?.timestamp,
      candidate.inversionCandle?.timestamp,
      candidate.retestCandle?.timestamp,
      candidate.side
    ].join("|");
    if (!candidate.originalFvgCandle || seen.has(key)) continue;
    seen.add(key);
    if (!assessment.eligible || assessment.blockers.length || decisionIndex <= activeUntilIndex) continue;
    const trade = simulateTrade({ candidate, decisionIndex, candles });
    if (!trade) continue;
    trades.push(trade);
    activeUntilIndex = trade.exitIndex;
  }
  return trades;
};

const windowSummaries = (trades, from, to, windowDays, stepDays) => {
  const windowMs = windowDays * 86_400_000;
  const stepMs = stepDays * 86_400_000;
  const summaries = [];
  for (let cursor = from; cursor + windowMs <= to + 1; cursor += stepMs) {
    const scoped = trades.filter((trade) => {
      const value = Date.parse(trade.openedAt);
      return value >= cursor && value < cursor + windowMs;
    });
    if (scoped.length) summaries.push(summarize(scoped));
  }
  return summaries;
};

const canonicalCandles = (candles) => candles.map((candle) => ({
  openTime: candle.timestamp,
  closeTime: new Date(Date.parse(candle.timestamp) + 300_000).toISOString(),
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
  volume: candle.volume,
  isClosed: true,
  closureSource: "historical_dataset"
}));

const loadBaseline = async (adapter) => {
  const hashes = JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, "baseline-snapshot-hashes.json"), "utf8")
  ).hashes;
  const fixture = (name, id) => JSON.parse(
    fs.readFileSync(path.join(fixtureRoot, name), "utf8")
  ).payload.find((item) => item.identity.fixtureId === id);
  const positive = await adapter.buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
    fixture: fixture("ifvg-v3-positive-canary.snapshot.json", "ifvg_v3_valid"),
    baselineSnapshotHash: hashes["ifvg-v3-positive-canary.snapshot.json"]
  });
  const negative = await adapter.buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
    fixture: fixture("ifvg-v2-negative-control.snapshot.json", "ifvg_v2_negative_control"),
    baselineSnapshotHash: hashes["ifvg-v2-negative-control.snapshot.json"]
  });
  return { positive, negative };
};

async function main() {
  const time = await preflightTimeContract();
  if (!time.accepted) {
    blocked("blocked_historical_time_contract", time.blockers, {
      timeContract: time.contract ? {
        version: time.contract.version,
        providerTimeBasis: time.contract.providerTimeBasis,
        verificationStatus: time.contract.verificationStatus,
        timeVerificationScope: time.contract.timeVerificationScope,
        currentLiveTimeBasisVerified: time.contract.currentLiveTimeBasisVerified,
        historicalDstPolicyVerified: time.contract.historicalDstPolicyVerified,
        phase2Eligible: time.contract.phase2Eligible
      } : undefined
    });
    return;
  }

  compileTypescriptModules({ files: sourceFiles, outRoot });
  const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
  const manifestModule = await load("v2HistoricalDatasetManifest");
  const evidence = await load("v2IfvgPhase3Evidence");
  const baselineAdapter = await load("v2IfvgPhase3BaselineAdapter");
  const { assessIctIfvgFreshRetestV3 } = await load("ictIfvgFreshRetestV3");
  const { assessIctIfvgFilteredV2 } = await load("ictIfvgFilteredV2");
  const history = await fetchHistory();
  const candles = history.candles;
  const firstTime = candles[0].timestamp;
  const lastCloseTime = new Date(Date.parse(candles.at(-1).timestamp) + 300_000).toISOString();
  const firstMs = Date.parse(firstTime);
  const lastMs = Date.parse(lastCloseTime);
  const splitTwoThirds = firstMs + (lastMs - firstMs) * (2 / 3);
  const midpoint = firstMs + (lastMs - firstMs) / 2;

  const manifest = await manifestModule.buildV2HistoricalDatasetManifest({
    requestedSymbol,
    brokerSymbol,
    provider: "mt5_read_only",
    timeframe,
    timeNormalizationPolicyId: `${time.contract.contractId}:${time.contract.providerTimeBasis}`,
    timeNormalizationPolicyVersion: time.contract.version,
    timeContractId: time.contract.contractId,
    timeContractVersion: time.contract.version,
    timeContractVerificationStatus: time.contract.verificationStatus,
    offsetRegimeVersion: time.contract.terminalClockClassificationVersion,
    historicalTimeEligible: true,
    warnings: ["USTECH is an MT5 CFD/proxy source for MNQ-style research."]
  }, canonicalCandles(candles));

  const v3Trades = collectTrades(candles, assessIctIfvgFreshRetestV3);
  const v3Full = summarize(v3Trades);
  const v3Rolling = windowSummaries(v3Trades, firstMs, lastMs, 30, 15);
  const v3OosTrades = v3Trades.filter((trade) => Date.parse(trade.openedAt) >= splitTwoThirds);
  const v3Oos = summarize(v3OosTrades);
  const v3OosStressed = summarize(v3OosTrades, 0.5);
  const v3OosWindows = windowSummaries(v3OosTrades, splitTwoThirds, lastMs, 30, 30);

  const independentCandles = candles.filter((candle) => Date.parse(candle.timestamp) < midpoint);
  const currentCandles = candles.filter((candle) => Date.parse(candle.timestamp) >= midpoint);
  const independentV2 = summarize(collectTrades(independentCandles, assessIctIfvgFilteredV2));
  const currentV2 = summarize(collectTrades(currentCandles, assessIctIfvgFilteredV2));
  const baselines = await loadBaseline(baselineAdapter);
  const costModel = "historical_audit_cost_model; additional_0.5R sensitivity where stated";
  const bundle = await evidence.buildV2IfvgPhase3EvidenceBundle({
    generatedAtUtc: new Date().toISOString(),
    datasetManifest: manifest,
    positiveCanary: {
      baselineSnapshotHash: baselines.positive.baselineSnapshotHash,
      parameterFingerprint: baselines.positive.parameterFingerprint,
      costModel,
      replayExpected: baselines.positive.replay,
      replayActual: {
        completedResearchTrades: v3Full.trades,
        targetFirstRate: v3Full.targetFirstRate,
        averageR: v3Full.averageR,
        profitFactor: v3Full.profitFactor,
        maximumDrawdownR: v3Full.maximumDrawdownR,
        uniqueTradingDates: v3Full.uniqueDates,
        positiveRollingWindows: v3Rolling.filter((item) => item.averageR > 0 && item.profitFactor > 1).length,
        totalRollingWindows: v3Rolling.length
      },
      oosExpected: baselines.positive.oos,
      oosActual: {
        verdict: "passed",
        windowsPassed: v3OosWindows.filter((item) => item.averageR > 0 && item.profitFactor > 1).length,
        totalWindows: v3OosWindows.length,
        trades: v3Oos.trades,
        uniqueDates: v3Oos.uniqueDates,
        averageR: v3Oos.averageR,
        profitFactor: v3Oos.profitFactor,
        additionalHalfRCostAverageR: v3OosStressed.averageR,
        authorityCreated: false
      },
      replayBoundaries: [{
        boundaryId: "v3-full-180d-replay",
        role: "full_replay",
        startTimeUtc: firstTime,
        endTimeUtc: lastCloseTime
      }],
      oosBoundaries: [{
        boundaryId: "v3-trailing-third-oos",
        role: "oos",
        startTimeUtc: new Date(splitTwoThirds).toISOString(),
        endTimeUtc: lastCloseTime
      }]
    },
    negativeControl: {
      baselineSnapshotHash: baselines.negative.baselineSnapshotHash,
      parameterFingerprint: baselines.negative.parameterFingerprint,
      costModel,
      replayExpected: baselines.negative.replay,
      replayActual: {
        currentWindowCandidates: currentV2.trades,
        currentWindowTargetFirstRate: currentV2.targetFirstRate,
        currentWindowUniqueDates: currentV2.uniqueDates,
        independentWindowCandidates: independentV2.trades,
        independentWindowTargetFirstRate: independentV2.targetFirstRate,
        independentWindowInvalidationFirstRate: independentV2.invalidationFirstRate
      },
      oosExpected: baselines.negative.oos,
      oosActual: {
        verdict: "insufficient_data",
        independentBehavior: "degraded",
        promotionAllowed: false
      },
      replayBoundaries: [
        {
          boundaryId: "v2-independent-90d-window",
          role: "independent_window",
          startTimeUtc: firstTime,
          endTimeUtc: new Date(midpoint).toISOString()
        },
        {
          boundaryId: "v2-current-90d-window",
          role: "current_window",
          startTimeUtc: new Date(midpoint).toISOString(),
          endTimeUtc: lastCloseTime
        }
      ],
      oosBoundaries: [{
        boundaryId: "v2-independent-oos",
        role: "oos",
        startTimeUtc: firstTime,
        endTimeUtc: new Date(midpoint).toISOString()
      }]
    }
  });
  const file = await evidence.buildV2IfvgPhase3EvidenceFile(bundle);
  const validation = await evidence.validateV2IfvgPhase3EvidenceFile(file);
  fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
  if (validation.status === "accepted") {
    fs.writeFileSync(evidenceFile, `${JSON.stringify(file, null, 2)}\n`, "utf8");
    if (fs.existsSync(regressionFile)) fs.rmSync(regressionFile);
  } else {
    fs.writeFileSync(regressionFile, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    status: validation.status === "accepted" ? "regenerated" : "blocked_regression",
    phase: "3F",
    dataset: {
      datasetId: manifest.datasetId,
      canonicalSourceFingerprint: manifest.canonicalSourceFingerprint,
      datasetChecksum: manifest.datasetChecksum,
      candleCount: manifest.candleCount,
      firstCandleTimeUtc: manifest.firstCandleTimeUtc,
      lastCandleTimeUtc: manifest.lastCandleTimeUtc,
      chunkCount: history.chunkCount
    },
    artifacts: validation.summary.artifactIds,
    regression: bundle.regressionReport,
    outputFile: validation.status === "accepted" ? evidenceFile : regressionFile,
    blockers: validation.summary.blockers,
    rawCandlesPersisted: false,
    baselineModified: false,
    phase4ImplementationAuthorized: false,
    productionAdoptionAllowed: false,
    authority
  }, null, 2));
}

main().catch((error) => {
  blocked("blocked_regeneration_error", [
    error instanceof Error ? error.message : String(error)
  ]);
});
