import { defaultBacktestConfig, runBacktest, sanitizeBacktestConfig } from "@/lib/backtesting";
import type { BacktestConfig, BacktestResult, SimulatedTradeRecord } from "@/lib/backtesting";
import { buildCalibrationReport } from "@/lib/validation/calibrationReport";
import type {
  ValidationAgentContribution,
  ValidationConfidenceCalibration,
  ValidationReadinessStatus,
  ValidationScenarioDefinition,
  ValidationScenarioResult,
  ValidationSuiteReport
} from "@/lib/validation/validationTypes";
import type { Candle } from "@/lib/types";
import {
  buildValidationProvenanceIdentity,
  fingerprintValidationParameters,
  type ValidationProvenanceIdentity
} from "@/lib/validationProvenance";

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const scenariosFor = (baseConfig: BacktestConfig = {}): ValidationScenarioDefinition[] => {
  const base = {
    ...defaultBacktestConfig,
    ...baseConfig
  };

  return [
    {
      id: "conservative-confluence",
      name: "Conservative confluence threshold",
      description: "Raises ICT confluence and confidence thresholds to test stricter evidence gates.",
      category: "threshold",
      config: { ...base, minimumConfluenceThreshold: 0.55, minimumConfidenceThreshold: 0.55 }
    },
    {
      id: "aggressive-confluence",
      name: "Aggressive confluence threshold",
      description: "Lowers thresholds to test whether more frequent simulated theses still hold up.",
      category: "threshold",
      config: { ...base, minimumConfluenceThreshold: 0.2, minimumConfidenceThreshold: 0.35 }
    },
    {
      id: "ny-am-only",
      name: "NY AM only",
      description: "Limits decisions to the New York AM ICT kill-zone slice.",
      category: "session",
      config: { ...base, sessionFilter: "NY AM Kill Zone" }
    },
    {
      id: "london-only",
      name: "London only",
      description: "Limits decisions to the London session and London open context.",
      category: "session",
      config: { ...base, sessionFilter: "London" }
    },
    {
      id: "long-only",
      name: "Long-only",
      description: "Allows bullish simulated theses while rejecting short theses.",
      category: "direction",
      config: { ...base, allowLong: true, allowShort: false }
    },
    {
      id: "short-only",
      name: "Short-only",
      description: "Allows bearish simulated theses while rejecting long theses.",
      category: "direction",
      config: { ...base, allowLong: false, allowShort: true }
    },
    {
      id: "swing-stop",
      name: "Swing-stop model",
      description: "Uses latest swing structure as the simulated invalidation model.",
      category: "stop",
      config: { ...base, stopModel: "latest swing" }
    },
    {
      id: "fixed-tick-stop",
      name: "Fixed-tick stop model",
      description: "Uses a fixed tick stop to test whether structure-dependent stops are necessary.",
      category: "stop",
      config: { ...base, stopModel: "fixed ticks", fixedTickStopSize: 40 }
    },
    {
      id: "fvg-invalidation",
      name: "FVG invalidation model",
      description: "Uses unmitigated fair value gap boundaries as simulated invalidation.",
      category: "stop",
      config: { ...base, stopModel: "FVG invalidation" }
    },
    {
      id: "high-confidence-only",
      name: "High confidence only",
      description: "Requires stronger CIO confidence before a simulated trade can be scored.",
      category: "confidence",
      config: { ...base, minimumConfidenceThreshold: 0.68 }
    }
  ];
};

const profitFactorFor = (trades: SimulatedTradeRecord[]) => {
  const positiveR = trades.filter((trade) => trade.rMultiple > 0).reduce((sum, trade) => sum + trade.rMultiple, 0);
  const negativeR = Math.abs(
    trades.filter((trade) => trade.rMultiple < 0).reduce((sum, trade) => sum + trade.rMultiple, 0)
  );
  if (negativeR === 0) {
    return positiveR > 0 ? 99 : null;
  }
  return round(positiveR / negativeR, 2);
};

const confidenceCalibrationFor = (trades: SimulatedTradeRecord[]): ValidationConfidenceCalibration => {
  const directionalTrades = trades.filter((trade) => trade.bias !== "neutral");
  const wins = directionalTrades.filter((trade) => trade.outcome === "target_hit").length;
  const averageConfidence =
    directionalTrades.reduce((sum, trade) => sum + trade.confidence, 0) / Math.max(1, directionalTrades.length);
  const realizedWinRate = wins / Math.max(1, directionalTrades.length);
  const calibrationGap = Math.abs(averageConfidence - realizedWinRate);

  return {
    score: round(clamp(1 - calibrationGap), 3),
    averageConfidence: round(averageConfidence, 3),
    realizedWinRate: round(realizedWinRate, 3),
    calibrationGap: round(calibrationGap, 3),
    sampleSize: directionalTrades.length
  };
};

const agentRecommendationFor = (agent: ValidationAgentContribution): ValidationAgentContribution["recommendation"] => {
  if (agent.cioAlignmentRate >= 0.62 && agent.averageConfidence >= 0.5) {
    return "increase";
  }
  if (agent.cioAlignmentRate < 0.45 || agent.averageConfidence < 0.42) {
    return "decrease";
  }
  return "hold";
};

const agentContributionsFor = (result: BacktestResult): ValidationAgentContribution[] =>
  result.summary.agentAttribution.map((agent) => {
    const recommendation = agentRecommendationFor({
      ...agent,
      recommendation: "hold",
      reason: ""
    });
    return {
      ...agent,
      recommendation,
      reason:
        recommendation === "increase"
          ? "Strong CIO alignment and usable confidence calibration in this scenario."
          : recommendation === "decrease"
            ? "Weak CIO alignment or low confidence in this scenario."
            : "No clear simulated evidence to change this agent weight."
    };
  });

const scoreScenario = (
  totalTrades: number,
  winRate: number,
  averageR: number,
  maxDrawdown: number,
  profitFactor: number | null,
  calibration: ValidationConfidenceCalibration
) => {
  const tradeQuality = clamp(totalTrades / 8);
  const rQuality = clamp((averageR + 0.5) / 1.5);
  const profitQuality = profitFactor === null ? 0 : clamp((Math.min(profitFactor, 4) - 1) / 3);
  const drawdownPenalty = clamp(maxDrawdown / 6) * 16;
  return round(
    clamp(
      100 *
        (0.24 * winRate + 0.24 * rQuality + 0.2 * profitQuality + 0.17 * calibration.score + 0.15 * tradeQuality) -
        drawdownPenalty,
      0,
      100
    ),
    0
  );
};

const readinessFor = (
  totalTrades: number,
  winRate: number,
  averageR: number,
  maxDrawdown: number,
  profitFactor: number | null,
  calibration: ValidationConfidenceCalibration
): ValidationReadinessStatus => {
  const factor = profitFactor ?? 0;
  if (totalTrades >= 5 && winRate >= 0.52 && averageR >= 0.15 && maxDrawdown <= 4 && factor >= 1.2 && calibration.score >= 0.55) {
    return "green";
  }
  if (totalTrades >= 2 && averageR >= -0.1 && maxDrawdown <= 6 && calibration.score >= 0.4) {
    return "yellow";
  }
  return "red";
};

const scenarioResultFor = (definition: ValidationScenarioDefinition, result: BacktestResult): ValidationScenarioResult => {
  const { summary } = result;
  const profitFactor = profitFactorFor(result.trades);
  const confidenceCalibration = confidenceCalibrationFor(result.trades);
  const bestTradeR = summary.bestTrade?.rMultiple ?? 0;
  const worstTradeR = summary.worstTrade?.rMultiple ?? 0;
  const score = scoreScenario(
    summary.totalTrades,
    summary.winRate,
    summary.averageR,
    summary.maxDrawdown,
    profitFactor,
    confidenceCalibration
  );

  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    config: result.config,
    totalTrades: summary.totalTrades,
    winRate: round(summary.winRate, 3),
    averageR: round(summary.averageR, 2),
    maxDrawdown: round(summary.maxDrawdown, 2),
    bestTrade: summary.bestTrade,
    worstTrade: summary.worstTrade,
    bestTradeR: round(bestTradeR, 2),
    worstTradeR: round(worstTradeR, 2),
    skippedSignals: summary.skippedSignals,
    skipReasons: summary.skipReasons,
    profitFactor,
    confidenceCalibration,
    agentContributionSummary: agentContributionsFor(result),
    score,
    readiness: readinessFor(
      summary.totalTrades,
      summary.winRate,
      summary.averageR,
      summary.maxDrawdown,
      profitFactor,
      confidenceCalibration
    )
  };
};

export interface ValidationSuiteRunOptions {
  provenance?: ValidationProvenanceIdentity;
  /** Optional detector replay reused by equivalent frozen-profile scenarios. */
  baselineResult?: BacktestResult;
}

const detectorProfileExecutionKey = (definition: ValidationScenarioDefinition) => {
  const config = definition.config;
  const profile = config.strategyProfile;
  if (profile !== "ifvg_fresh_retest_v3_research" && profile !== "ifvg_filtered_v2_research") {
    return undefined;
  }
  if (profile === "ifvg_fresh_retest_v3_research") {
    // The v3 profile is frozen. Generic scenario definitions must not mutate
    // its direction/session identity, and repeating the same causal detector
    // over a 180-day browser array can block the UI for tens of seconds.
    // Chronological robustness is measured separately by the detector-profile
    // walk-forward validator.
    return JSON.stringify({
      profile,
      maxBarsToResolveTrade: config.maxBarsToResolveTrade,
      spreadTicks: config.spreadTicks,
      slippageTicks: config.slippageTicks,
      commissionTicks: config.commissionTicks
    });
  }
  // IFVG profiles own their entry, full-candle invalidation, target, and
  // confidence rules. Generic confluence and stop-model labels do not change
  // detector behavior, so rerunning those equivalent scenarios only burns CPU.
  return JSON.stringify({
    profile,
    sessionFilter: config.sessionFilter ?? "all",
    allowLong: config.allowLong ?? true,
    allowShort: config.allowShort ?? true,
    maxBarsToResolveTrade: config.maxBarsToResolveTrade,
    spreadTicks: config.spreadTicks,
    slippageTicks: config.slippageTicks,
    commissionTicks: config.commissionTicks
  });
};

const resultForDefinition = (
  candles: Candle[],
  definition: ValidationScenarioDefinition,
  cache: Map<string, BacktestResult>,
  baselineResult?: BacktestResult
) => {
  const key = detectorProfileExecutionKey(definition);
  if (!key) return runBacktest(candles, definition.config);
  const cached = cache.get(key);
  if (cached) return { ...cached, config: sanitizeBacktestConfig({ ...cached.config, ...definition.config }) };
  const baselineKey = baselineResult
    ? detectorProfileExecutionKey({ ...definition, config: baselineResult.config })
    : undefined;
  const result = baselineResult && baselineKey === key
    ? baselineResult
    : runBacktest(candles, definition.config);
  cache.set(key, result);
  return { ...result, config: sanitizeBacktestConfig({ ...result.config, ...definition.config }) };
};

const provenanceFor = (
  reportId: string,
  candles: Candle[],
  baseConfig: BacktestConfig,
  provided?: ValidationProvenanceIdentity
) => {
  const first = candles[0];
  const last = candles.at(-1);
  return buildValidationProvenanceIdentity({
    ...provided,
    strategyProfile: provided?.strategyProfile ?? baseConfig.strategyProfile,
    requestedSymbol: provided?.requestedSymbol ?? baseConfig.symbol ?? first?.symbol,
    timeframe: provided?.timeframe ?? baseConfig.timeframe ?? first?.timeframe,
    parameterFingerprint:
      provided?.parameterFingerprint ?? fingerprintValidationParameters(baseConfig),
    validationRunId: reportId,
    dataRangeStart: provided?.dataRangeStart ?? first?.timestamp,
    dataRangeEnd: provided?.dataRangeEnd ?? last?.timestamp
  });
};

export function runValidationSuite(
  candles: Candle[],
  baseConfig: BacktestConfig = {},
  options: ValidationSuiteRunOptions = {}
): ValidationSuiteReport {
  const generatedAt = new Date().toISOString();
  const id = `validation_${Date.now()}`;
  const cache = new Map<string, BacktestResult>();
  const scenarios = scenariosFor(baseConfig).map((definition) =>
    scenarioResultFor(definition, resultForDefinition(candles, definition, cache, options.baselineResult))
  );

  return {
    id,
    generatedAt,
    provenance: provenanceFor(id, candles, baseConfig, options.provenance),
    scenarios,
    calibration: buildCalibrationReport(scenarios, generatedAt),
    safetyNotice: "Simulation validation only. No broker connection. No real trades."
  };
}

export async function runValidationSuiteAsync(
  candles: Candle[],
  baseConfig: BacktestConfig = {},
  options: {
    signal?: AbortSignal;
    onScenarioComplete?: (completed: number, total: number, scenario: ValidationScenarioResult) => void;
    provenance?: ValidationProvenanceIdentity;
    baselineResult?: BacktestResult;
  } = {}
): Promise<ValidationSuiteReport> {
  const generatedAt = new Date().toISOString();
  const id = `validation_${Date.now()}`;
  const definitions = scenariosFor(baseConfig);
  const scenarios: ValidationScenarioResult[] = [];
  const cache = new Map<string, BacktestResult>();

  for (const definition of definitions) {
    if (options.signal?.aborted) {
      throw new Error("Validation suite canceled by user.");
    }
    const scenario = scenarioResultFor(
      definition,
      resultForDefinition(candles, definition, cache, options.baselineResult)
    );
    scenarios.push(scenario);
    options.onScenarioComplete?.(scenarios.length, definitions.length, scenario);
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
  }

  return {
    id,
    generatedAt,
    provenance: provenanceFor(id, candles, baseConfig, options.provenance),
    scenarios,
    calibration: buildCalibrationReport(scenarios, generatedAt),
    safetyNotice: "Simulation validation only. No broker connection. No real trades."
  };
}

export { scenariosFor as getValidationScenarioDefinitions };
