import type { ForwardDecisionState, ForwardScenarioMap } from "@/lib/forwardScenario";
import {
  PREDICTION_LEDGER_AUTHORITY,
  type PredictionCalibrationSummary,
  type PredictionIssueOptions,
  type PredictionLedgerCandleUpdate,
  type PredictionLifecycleState,
  type PredictionProbabilitySource,
  type PredictionCandleInput,
  type MarketOpportunityPredictionInput,
  type UniversalPredictionLedgerEntry
} from "./predictionLedgerTypes";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const round = (value: number, digits = 6) => Number(value.toFixed(digits));
const unique = (values: Array<string | undefined>, limit = 10) => Array.from(new Set(values.filter((value): value is string => Boolean(value)))).slice(0, limit);

const stableId = (...values: Array<string | number>) => {
  let hash = 2166136261;
  for (const character of values.join("|")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const minutesForTimeframe = (timeframe: string) => {
  const normalized = timeframe.trim().toLowerCase();
  const value = Number.parseInt(normalized, 10);
  if (normalized.endsWith("m")) return Number.isFinite(value) ? value : 5;
  if (normalized.endsWith("h")) return (Number.isFinite(value) ? value : 1) * 60;
  if (normalized.endsWith("d")) return (Number.isFinite(value) ? value : 1) * 1440;
  return 5;
};

const dateFor = (timestamp: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date(timestamp));

const lifecycleFor = (state: ForwardDecisionState): PredictionLifecycleState => {
  if (state === "confirmed_setup") return "armed";
  if (state === "developing_setup") return "forming";
  if (state === "anticipated_scenario") return "anticipated";
  if (state === "invalidated") return "invalidated";
  return "observed_context";
};

const heuristicProbability = (band: "low" | "moderate" | "high", confidence: number) => {
  const base = band === "high" ? 0.68 : band === "moderate" ? 0.54 : 0.38;
  return clamp(base * 0.65 + clamp(confidence) * 0.35, 0.05, 0.9);
};

const expectedRFor = (entry: number | undefined, stop: number | undefined, target: number | undefined) => {
  if (!finite(entry) || !finite(stop) || !finite(target)) return undefined;
  const risk = Math.abs(entry - stop);
  return risk > 0 ? round(Math.abs(target - entry) / risk, 4) : undefined;
};

export function issuePredictionFromScenarioMap(
  map: ForwardScenarioMap,
  options: PredictionIssueOptions = {}
): UniversalPredictionLedgerEntry {
  const scenario = map.primaryScenario;
  const maxBarsToResolve = Math.max(1, options.maxBarsToResolve ?? 48);
  const issuedAt = map.timestamp;
  const expiresAt = new Date(Date.parse(issuedAt) + minutesForTimeframe(map.timeframe) * maxBarsToResolve * 60_000).toISOString();
  const zone = scenario.conditionalEntryPlan.zone;
  const stop = scenario.conditionalStopPlan.referencePrice;
  const targets = scenario.conditionalTargetPlan.references
    .filter((target): target is { label: string; price: number } => finite(target.price))
    .slice(0, 4)
    .map((target) => ({ label: target.label.slice(0, 120), price: round(target.price) }));
  const entryReference = zone ? (zone.lower + zone.upper) / 2 : undefined;
  const probabilitySource: PredictionProbabilitySource = options.probabilitySource ?? "heuristic_uncalibrated";
  const historicalProbability = options.historicalTargetFirstRate;
  const probabilityEstimate = probabilitySource === "heuristic_uncalibrated" || !finite(historicalProbability)
    ? heuristicProbability(scenario.probabilityBand, scenario.confidence)
    : clamp(historicalProbability, 0.01, 0.99);
  const actionable = scenario.direction !== "neutral" && Boolean(zone) && finite(stop) && targets.length > 0;

  return {
    predictionId: `prediction_${stableId(
      map.scenarioMapId,
      scenario.scenarioId,
      map.sourceFingerprint ?? "missing",
      options.modelVersion ?? `${scenario.scenarioFamily}:v1`
    )}`,
    scenarioMapId: map.scenarioMapId,
    scenarioId: scenario.scenarioId,
    scenarioFamily: scenario.scenarioFamily,
    modelVersion: options.modelVersion ?? `${scenario.scenarioFamily}:v1`,
    issuedAt,
    asOfTimestamp: issuedAt,
    expiresAt,
    requestedSymbol: map.requestedSymbol,
    brokerSymbol: map.brokerSymbol,
    timeframe: map.timeframe,
    sourceProvider: map.sourceProvider,
    sourceFingerprint: map.sourceFingerprint ?? `missing:${map.scenarioMapId}`,
    direction: scenario.direction,
    lifecycleState: lifecycleFor(map.currentDecisionState),
    probabilityBand: scenario.probabilityBand,
    probabilityEstimate: round(probabilityEstimate, 4),
    probabilitySource,
    calibrationSampleSize: Math.max(0, options.historicalSampleSize ?? 0),
    ...(options.confidenceInterval ? {
      confidenceInterval: {
        lower: round(clamp(options.confidenceInterval.lower), 4),
        upper: round(clamp(options.confidenceInterval.upper), 4)
      }
    } : {}),
    thesis: scenario.thesis.slice(0, 600),
    liquidityDraw: scenario.liquidityDraw.slice(0, 240),
    expectedSequence: unique(scenario.expectedSequence, 8),
    requiredConfirmations: unique(scenario.requiredConfirmations, 8),
    invalidationConditions: unique(scenario.invalidationConditions, 8),
    ...(zone ? { entryZone: { lower: round(Math.min(zone.lower, zone.upper)), upper: round(Math.max(zone.lower, zone.upper)) } } : {}),
    ...(finite(stop) ? { stopReference: round(stop) } : {}),
    targetReferences: targets,
    ...(() => {
      const expectedR = expectedRFor(entryReference, stop, targets[0]?.price);
      return finite(expectedR) ? { expectedR } : {};
    })(),
    resolution: actionable ? "pending" : "not_actionable",
    barsObserved: 0,
    maxBarsToResolve,
    independentDate: dateFor(issuedAt),
    blockerSummary: actionable
      ? unique(map.missingConfirmations).join(" ").slice(0, 500)
      : "Forecast lacks a complete causal entry, invalidation, target, or directional setup and is context-only.",
    authority: PREDICTION_LEDGER_AUTHORITY,
    safety: {
      researchOnly: true,
      rawCandlesExcluded: true,
      rawSnapshotsExcluded: true,
      autoPromotionAllowed: false,
      executionIntentCreated: false
    }
  };
}

export function issuePredictionFromMarketOpportunity(
  input: MarketOpportunityPredictionInput
): UniversalPredictionLedgerEntry {
  const { opportunity } = input;
  const maxBarsToResolve = Math.max(1, input.maxBarsToResolve ?? 48);
  const familyLabel = opportunity.family.replace(/_/g, " ");
  const sessionLabel = opportunity.session.replace(/_/g, " ");
  const expiresAt = new Date(
    Date.parse(opportunity.detectedAt) + minutesForTimeframe(input.timeframe) * maxBarsToResolve * 60_000
  ).toISOString();
  return {
    predictionId: `prediction_${stableId(
      input.modelVersion,
      opportunity.opportunityId,
      input.sourceFingerprint,
      opportunity.detectedAt
    )}`,
    scenarioMapId: `market_episode:${opportunity.opportunityId}`,
    scenarioId: opportunity.opportunityId,
    scenarioFamily: input.scenarioFamily,
    modelVersion: input.modelVersion,
    issuedAt: opportunity.detectedAt,
    asOfTimestamp: opportunity.detectedAt,
    expiresAt,
    requestedSymbol: input.requestedSymbol,
    brokerSymbol: input.brokerSymbol,
    timeframe: input.timeframe,
    sourceProvider: input.sourceProvider,
    sourceFingerprint: input.sourceFingerprint,
    direction: opportunity.side === "long" ? "bullish" : "bearish",
    lifecycleState: "triggered",
    probabilityBand: "moderate",
    probabilityEstimate: 0.5,
    probabilitySource: "heuristic_uncalibrated",
    calibrationSampleSize: 0,
    thesis: `Causal ${familyLabel} ${sessionLabel} ${opportunity.side} opportunity formed with an external-liquidity target known on the closed signal candle.`,
    liquidityDraw: "Causal external liquidity",
    expectedSequence: ["Closed-candle detector signal", "Hold causal invalidation", "Reach external liquidity target"],
    requiredConfirmations: ["Exact frozen detector-specific selector matched on the closed candle"],
    invalidationConditions: ["Price reaches the causal invalidation before the external-liquidity target"],
    entryZone: { lower: round(opportunity.entryReference), upper: round(opportunity.entryReference) },
    stopReference: round(opportunity.invalidationReference),
    targetReferences: [{ label: "External liquidity", price: round(opportunity.targetReference) }],
    expectedR: round(opportunity.rr, 4),
    triggeredAt: opportunity.detectedAt,
    resolution: "pending",
    barsObserved: 0,
    maxBarsToResolve,
    independentDate: dateFor(opportunity.detectedAt),
    blockerSummary:
      "Fresh v2 forward-research cohort. Zero v1 outcomes or retrospective probabilities were inherited. No Paper-Demo or execution progression is implied.",
    authority: PREDICTION_LEDGER_AUTHORITY,
    safety: {
      researchOnly: true,
      rawCandlesExcluded: true,
      rawSnapshotsExcluded: true,
      autoPromotionAllowed: false,
      executionIntentCreated: false
    }
  };
}

const seriesMatches = (entry: UniversalPredictionLedgerEntry, candle: PredictionCandleInput) =>
  entry.brokerSymbol === candle.brokerSymbol && entry.timeframe.toLowerCase() === candle.timeframe.toLowerCase();

const zoneTouched = (entry: UniversalPredictionLedgerEntry, candle: PredictionCandleInput) =>
  Boolean(entry.entryZone && candle.high >= entry.entryZone.lower && candle.low <= entry.entryZone.upper);

const resolveTriggered = (entry: UniversalPredictionLedgerEntry, candle: PredictionCandleInput) => {
  const target = entry.targetReferences[0]?.price;
  const stop = entry.stopReference;
  if (!finite(target) || !finite(stop) || entry.direction === "neutral") return entry;
  const targetHit = entry.direction === "bullish" ? candle.high >= target : candle.low <= target;
  const invalidationHit = entry.direction === "bullish" ? candle.low <= stop : candle.high >= stop;
  if (!targetHit && !invalidationHit) return entry;
  const resolution = targetHit && invalidationHit
    ? "ambiguous" as const
    : targetHit
      ? "target_first" as const
      : "invalidation_first" as const;
  return {
    ...entry,
    lifecycleState: "resolved" as const,
    resolution,
    resolvedAt: candle.timestamp,
    ...(resolution === "target_first" ? { realizedR: entry.expectedR ?? 0 } : {}),
    ...(resolution === "invalidation_first" ? { realizedR: -1 } : {})
  };
};

export function updatePredictionWithClosedCandle(
  entry: UniversalPredictionLedgerEntry,
  candle: PredictionCandleInput
): UniversalPredictionLedgerEntry {
  if (!seriesMatches(entry, candle)) return entry;
  if (Date.parse(candle.timestamp) <= Date.parse(entry.asOfTimestamp)) return entry;
  if (["resolved", "expired", "invalidated"].includes(entry.lifecycleState)) return entry;
  if (entry.resolution === "not_actionable") return entry;

  let next: UniversalPredictionLedgerEntry = {
    ...entry,
    barsObserved: entry.barsObserved + 1
  };
  if (next.lifecycleState !== "triggered" && zoneTouched(next, candle)) {
    next = { ...next, lifecycleState: "triggered", triggeredAt: candle.timestamp };
  }
  if (next.lifecycleState === "triggered") next = resolveTriggered(next, candle);
  if (next.lifecycleState !== "resolved" && (next.barsObserved >= next.maxBarsToResolve || Date.parse(candle.timestamp) >= Date.parse(next.expiresAt))) {
    next = {
      ...next,
      lifecycleState: "expired",
      resolution: "expired",
      resolvedAt: candle.timestamp
    };
  }
  return next;
}

export function updatePredictionLedgerWithClosedCandle(
  entries: UniversalPredictionLedgerEntry[],
  candle: PredictionCandleInput
): PredictionLedgerCandleUpdate {
  const updatedPredictionIds: string[] = [];
  const next = entries.map((entry) => {
    const updated = updatePredictionWithClosedCandle(entry, candle);
    if (updated !== entry) updatedPredictionIds.push(entry.predictionId);
    return updated;
  });
  return {
    entries: next,
    updatedPredictionIds,
    ignored: updatedPredictionIds.length === 0,
    reason: updatedPredictionIds.length ? undefined : "No active prediction matched this closed candle.",
    authority: PREDICTION_LEDGER_AUTHORITY
  };
}

const activeWindowCount = (entries: UniversalPredictionLedgerEntry[]) => {
  const timestamps = entries.map((entry) => Date.parse(entry.issuedAt)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!timestamps.length) return 0;
  const origin = timestamps[0];
  return new Set(timestamps.map((timestamp) => Math.floor((timestamp - origin) / (30 * 24 * 60 * 60 * 1000)))).size;
};

export function evaluatePredictionCalibration(
  entries: UniversalPredictionLedgerEntry[],
  scenarioFamily?: string
): PredictionCalibrationSummary {
  const scoped = scenarioFamily ? entries.filter((entry) => entry.scenarioFamily === scenarioFamily) : entries;
  const actionable = scoped.filter((entry) => entry.resolution !== "not_actionable");
  const binary = actionable.filter((entry) => entry.resolution === "target_first" || entry.resolution === "invalidation_first");
  const targetFirst = binary.filter((entry) => entry.resolution === "target_first").length;
  const invalidationFirst = binary.filter((entry) => entry.resolution === "invalidation_first").length;
  const ambiguous = actionable.filter((entry) => entry.resolution === "ambiguous").length;
  const expired = actionable.filter((entry) => entry.resolution === "expired").length;
  const predicted = binary.map((entry) => entry.probabilityEstimate);
  const actual = binary.map((entry) => entry.resolution === "target_first" ? 1 : 0);
  const targetFirstRate = binary.length ? targetFirst / binary.length : null;
  const averagePredictedProbability = predicted.length ? predicted.reduce((sum, value) => sum + value, 0) / predicted.length : null;
  const brierScore = predicted.length
    ? predicted.reduce((sum, value, index) => sum + (value - actual[index]) ** 2, 0) / predicted.length
    : null;
  const realized = binary.map((entry) => entry.realizedR).filter(finite);
  const averageRealizedR = realized.length ? realized.reduce((sum, value) => sum + value, 0) / realized.length : null;
  const grossProfit = realized.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(realized.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
  const independentDates = new Set(binary.map((entry) => entry.independentDate)).size;
  const activeWindows = activeWindowCount(binary);
  const blockers = unique([
    binary.length < 20 ? `Only ${binary.length} completed causal forecasts; at least 20 are required.` : undefined,
    independentDates < 3 ? `Only ${independentDates} independent dates; at least 3 are required.` : undefined,
    activeWindows < 2 ? `Only ${activeWindows} active 30-day windows; at least 2 are required.` : undefined,
    averageRealizedR !== null && averageRealizedR <= 0 ? `Average realized expectancy is ${round(averageRealizedR, 3)}R.` : undefined,
    brierScore !== null && brierScore > 0.25 ? `Probability calibration is weak (Brier ${round(brierScore, 3)}).` : undefined
  ]);
  const heuristicOnly = actionable.length > 0 && actionable.every((entry) => entry.probabilitySource === "heuristic_uncalibrated");
  const classification = heuristicOnly
    ? "uncalibrated" as const
    : binary.length < 20 || independentDates < 3 || activeWindows < 2
      ? "insufficient_data" as const
      : averageRealizedR !== null && averageRealizedR > 0 && brierScore !== null && brierScore <= 0.25
        ? "calibrated_positive" as const
        : averageRealizedR !== null && averageRealizedR <= 0
          ? "calibrated_negative" as const
          : "unstable" as const;

  return {
    generatedAt: new Date().toISOString(),
    ...(scenarioFamily ? { scenarioFamily } : {}),
    totalForecasts: scoped.length,
    actionableForecasts: actionable.length,
    completedForecasts: binary.length + ambiguous + expired,
    pendingForecasts: actionable.filter((entry) => entry.resolution === "pending").length,
    targetFirst,
    invalidationFirst,
    ambiguous,
    expired,
    targetFirstRate: targetFirstRate === null ? null : round(targetFirstRate, 4),
    averagePredictedProbability: averagePredictedProbability === null ? null : round(averagePredictedProbability, 4),
    brierScore: brierScore === null ? null : round(brierScore, 4),
    calibrationError: targetFirstRate === null || averagePredictedProbability === null ? null : round(Math.abs(targetFirstRate - averagePredictedProbability), 4),
    averageRealizedR: averageRealizedR === null ? null : round(averageRealizedR, 4),
    profitFactor: profitFactor === null ? null : Number.isFinite(profitFactor) ? round(profitFactor, 4) : profitFactor,
    independentDates,
    activeWindows,
    classification,
    blockers: heuristicOnly ? unique(["Forecast probabilities remain heuristic until historical episodes or walk-forward outcomes calibrate them.", ...blockers]) : blockers,
    autoPromotionAllowed: false,
    authority: PREDICTION_LEDGER_AUTHORITY
  };
}
