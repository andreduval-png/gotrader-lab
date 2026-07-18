import type { Candle } from "@/lib/types";
import {
  MARKET_EPISODE_AUTHORITY,
  type InternalIndexedCandle,
  type MarketEpisode,
  type MarketEpisodeDirection,
  type MarketEpisodeEvent,
  type MarketEpisodeEventType,
  type MarketEpisodeOpportunity,
  type MarketEpisodeOpportunityFamily,
  type MarketEpisodeOutcome,
  type MarketEpisodeReconstructionInput,
  type MarketEpisodeReconstructionSummary,
  type MarketEpisodeSession
} from "./marketEpisodeTypes";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number, digits = 6) => Number(value.toFixed(digits));
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const unique = <T>(values: T[]) => Array.from(new Set(values));

const stableId = (...values: Array<string | number>) => {
  let hash = 2166136261;
  for (const character of values.join("|") ) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const nyPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

const nyParts = (timestamp: string) => {
  const parts = Object.fromEntries(
    nyPartsFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
};

const sessionFor = (timestamp: string): MarketEpisodeSession => {
  const { hour, minute } = nyParts(timestamp);
  const totalMinutes = hour * 60 + minute;
  if (totalMinutes >= 20 * 60 || totalMinutes < 2 * 60) return "asia";
  if (totalMinutes >= 2 * 60 && totalMinutes < 5 * 60) return "london";
  if (totalMinutes >= 9 * 60 + 30 && totalMinutes < 12 * 60) return "new_york_am";
  if (totalMinutes >= 13 * 60 + 30 && totalMinutes < 16 * 60) return "new_york_pm";
  return "off_hours";
};

const median = (values: number[]) => {
  const sorted = values.filter(finite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const validCandle = (candle: Candle) =>
  Boolean(candle?.timestamp) &&
  [candle.open, candle.high, candle.low, candle.close].every(finite) &&
  candle.high >= Math.max(candle.open, candle.close, candle.low) &&
  candle.low <= Math.min(candle.open, candle.close, candle.high);

const normalizeCandles = (candles: Candle[]) => {
  const deduplicated = new Map<string, Candle>();
  for (const candle of candles) {
    if (validCandle(candle)) deduplicated.set(candle.timestamp, candle);
  }
  return Array.from(deduplicated.values()).sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)
  );
};

const trueRange = (candle: Candle, previous?: Candle) =>
  Math.max(
    candle.high - candle.low,
    previous ? Math.abs(candle.high - previous.close) : 0,
    previous ? Math.abs(candle.low - previous.close) : 0
  );

const directionFor = (candle: Candle): MarketEpisodeDirection =>
  candle.close > candle.open ? "bullish" : candle.close < candle.open ? "bearish" : "neutral";

const event = (
  type: MarketEpisodeEventType,
  candle: Candle,
  patch: Partial<Omit<MarketEpisodeEvent, "eventId" | "type" | "timestamp" | "session">> = {}
): MarketEpisodeEvent => ({
  eventId: `episode_event_${stableId(type, candle.timestamp, patch.direction ?? "neutral")}`,
  type,
  timestamp: candle.timestamp,
  session: sessionFor(candle.timestamp),
  direction: patch.direction ?? directionFor(candle),
  quality: clamp(round(patch.quality ?? 0.5, 4), 0, 1),
  evidence: unique(patch.evidence ?? []).slice(0, 6),
  ...(finite(patch.price) ? { price: round(patch.price) } : {}),
  ...(finite(patch.lower) ? { lower: round(patch.lower) } : {}),
  ...(finite(patch.upper) ? { upper: round(patch.upper) } : {})
});

const detectEvents = (dayCandles: InternalIndexedCandle[], globalCandles: Candle[]) => {
  const bodies = dayCandles.map(({ candle }) => Math.abs(candle.close - candle.open));
  const ranges = dayCandles.map(({ candle, sourceIndex }) => trueRange(candle, globalCandles[sourceIndex - 1]));
  const episodeMedianBody = Math.max(median(bodies), Number.EPSILON);
  const episodeMedianRange = Math.max(median(ranges), Number.EPSILON);
  const events: MarketEpisodeEvent[] = [];
  let consolidationActive = false;

  dayCandles.forEach(({ candle, sourceIndex }, dayIndex) => {
    // Detection thresholds must use information available before this candle.
    // Full-day medians leak future volatility into historical recognition.
    const baseline = globalCandles.slice(Math.max(0, sourceIndex - 48), sourceIndex);
    const baselineBodies = baseline.map((item) => Math.abs(item.close - item.open));
    const baselineRanges = baseline.map((item, index) => {
      const previous = index > 0 ? baseline[index - 1] : globalCandles[Math.max(0, sourceIndex - baseline.length - 1)];
      return trueRange(item, previous);
    });
    const medianBody = Math.max(median(baselineBodies), Number.EPSILON);
    const medianRange = Math.max(median(baselineRanges), Number.EPSILON);
    const session = sessionFor(candle.timestamp);
    const parts = nyParts(candle.timestamp);
    if ((parts.hour === 0 && parts.minute < 10) || (parts.hour === 9 && parts.minute >= 30 && parts.minute < 40)) {
      events.push(event("session_open", candle, { price: candle.open, quality: 1, evidence: [`${session} reference open`] }));
    }

    if (dayIndex >= 7) {
      const window = dayCandles.slice(dayIndex - 7, dayIndex + 1).map((item) => item.candle);
      const high = Math.max(...window.map((item) => item.high));
      const low = Math.min(...window.map((item) => item.low));
      const range = high - low;
      const netChange = Math.abs(window.at(-1)!.close - window[0].open);
      const consolidated = range <= medianRange * 5.5 && netChange <= range * 0.45;
      if (consolidated && !consolidationActive) {
        events.push(event("consolidation", candle, {
          lower: low,
          upper: high,
          direction: "neutral",
          quality: 1 - clamp(range / (medianRange * 6), 0, 1),
          evidence: ["Eight-candle range compression", "Net delivery remains contained"]
        }));
      }
      consolidationActive = consolidated;
    }

    if (sourceIndex >= 12) {
      const prior = globalCandles.slice(sourceIndex - 12, sourceIndex);
      const priorHigh = Math.max(...prior.map((item) => item.high));
      const priorLow = Math.min(...prior.map((item) => item.low));
      if (candle.high > priorHigh && candle.close < priorHigh) {
        const depth = (candle.high - priorHigh) / medianRange;
        events.push(event("liquidity_sweep", candle, {
          direction: "bearish",
          price: candle.high,
          quality: clamp(0.45 + depth / 2, 0, 1),
          evidence: ["Prior buy-side liquidity exceeded", "Close returned below prior high"]
        }));
      }
      if (candle.low < priorLow && candle.close > priorLow) {
        const depth = (priorLow - candle.low) / medianRange;
        events.push(event("liquidity_sweep", candle, {
          direction: "bullish",
          price: candle.low,
          quality: clamp(0.45 + depth / 2, 0, 1),
          evidence: ["Prior sell-side liquidity exceeded", "Close returned above prior low"]
        }));
      }
    }

    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    if (sourceIndex >= 3 && body >= medianBody * 1.8 && range >= medianRange * 1.35) {
      const prior = globalCandles.slice(sourceIndex - 3, sourceIndex);
      const direction = directionFor(candle);
      const brokeStructure =
        direction === "bullish"
          ? candle.close > Math.max(...prior.map((item) => item.high))
          : direction === "bearish"
            ? candle.close < Math.min(...prior.map((item) => item.low))
            : false;
      if (brokeStructure) {
        events.push(event("displacement", candle, {
          direction,
          price: candle.close,
          quality: clamp((body / medianBody - 1) / 3, 0, 1),
          evidence: ["Body expansion exceeds local median", "Close displaced beyond short-term structure"]
        }));
        events.push(event("expansion", candle, {
          direction,
          price: candle.close,
          quality: clamp(range / (medianRange * 3), 0, 1),
          evidence: ["Directional range expansion"]
        }));
      }
    }

    if (sourceIndex >= 2) {
      const first = globalCandles[sourceIndex - 2];
      if (candle.low > first.high) {
        events.push(event("fair_value_gap", candle, {
          direction: "bullish",
          lower: first.high,
          upper: candle.low,
          quality: clamp((candle.low - first.high) / medianRange, 0, 1),
          evidence: ["Three-candle bullish imbalance"]
        }));
      }
      if (candle.high < first.low) {
        events.push(event("fair_value_gap", candle, {
          direction: "bearish",
          lower: candle.high,
          upper: first.low,
          quality: clamp((first.low - candle.high) / medianRange, 0, 1),
          evidence: ["Three-candle bearish imbalance"]
        }));
      }
    }

    if (sourceIndex >= 3 && body >= medianBody * 1.15) {
      const prior = globalCandles.slice(sourceIndex - 3, sourceIndex);
      const priorBullish = prior.filter((item) => item.close > item.open).length >= 2;
      const priorBearish = prior.filter((item) => item.close < item.open).length >= 2;
      if (priorBearish && candle.close > Math.max(...prior.map((item) => Math.max(item.open, item.close)))) {
        events.push(event("cisd", candle, {
          direction: "bullish",
          price: candle.close,
          quality: clamp(body / (medianBody * 3), 0, 1),
          evidence: ["Bearish delivery preceded bullish body close-through"]
        }));
      }
      if (priorBullish && candle.close < Math.min(...prior.map((item) => Math.min(item.open, item.close)))) {
        events.push(event("cisd", candle, {
          direction: "bearish",
          price: candle.close,
          quality: clamp(body / (medianBody * 3), 0, 1),
          evidence: ["Bullish delivery preceded bearish body close-through"]
        }));
      }
    }
  });

  return { events: events.slice(0, 100), medianBody: episodeMedianBody, medianRange: episodeMedianRange };
};

interface OpportunityDraft {
  family: MarketEpisodeOpportunityFamily;
  event: MarketEpisodeEvent;
  sweep?: MarketEpisodeEvent;
  consolidation?: MarketEpisodeEvent;
  evidence: string[];
}

const resolveOpportunity = (
  draft: OpportunityDraft,
  globalCandles: Candle[],
  sourceIndexByTimestamp: Map<string, number>,
  maxResolutionBars: number
): MarketEpisodeOpportunity | undefined => {
  const sourceIndex = sourceIndexByTimestamp.get(draft.event.timestamp);
  if (sourceIndex === undefined) return undefined;
  const signal = globalCandles[sourceIndex];
  const side = draft.event.direction === "bullish" ? "long" : draft.event.direction === "bearish" ? "short" : undefined;
  if (!side) return undefined;
  const entryReference = signal.close;
  const rawInvalidation = draft.sweep?.price ?? (side === "long" ? signal.low : signal.high);
  const risk = side === "long" ? entryReference - rawInvalidation : rawInvalidation - entryReference;
  if (!finite(rawInvalidation) || risk <= 0) return undefined;

  const prior = globalCandles.slice(Math.max(0, sourceIndex - 48), sourceIndex);
  const externalTarget =
    side === "long"
      ? prior.map((item) => item.high).filter((price) => price > entryReference + risk * 1.5).sort((a, b) => a - b)[0]
      : prior.map((item) => item.low).filter((price) => price < entryReference - risk * 1.5).sort((a, b) => b - a)[0];
  const projectedTarget = side === "long" ? entryReference + risk * 2 : entryReference - risk * 2;
  const targetReference = externalTarget ?? projectedTarget;
  const rr = Math.abs(targetReference - entryReference) / risk;
  if (rr < 1.5) return undefined;

  let outcome: MarketEpisodeOutcome = "expired";
  let resolvedAt: string | undefined;
  let barsToResolution: number | undefined;
  let realizedR = 0;
  let mfe = 0;
  let mae = 0;
  const future = globalCandles.slice(sourceIndex + 1, sourceIndex + 1 + maxResolutionBars);
  for (let index = 0; index < future.length; index += 1) {
    const candle = future[index];
    const targetHit = side === "long" ? candle.high >= targetReference : candle.low <= targetReference;
    const invalidationHit = side === "long" ? candle.low <= rawInvalidation : candle.high >= rawInvalidation;
    const favorable = side === "long" ? candle.high - entryReference : entryReference - candle.low;
    const adverse = side === "long" ? entryReference - candle.low : candle.high - entryReference;
    mfe = Math.max(mfe, favorable / risk);
    mae = Math.max(mae, adverse / risk);
    if (targetHit && invalidationHit) {
      outcome = "ambiguous";
      resolvedAt = candle.timestamp;
      barsToResolution = index + 1;
      break;
    }
    if (targetHit) {
      outcome = "target_first";
      realizedR = rr;
      resolvedAt = candle.timestamp;
      barsToResolution = index + 1;
      break;
    }
    if (invalidationHit) {
      outcome = "invalidation_first";
      realizedR = -1;
      resolvedAt = candle.timestamp;
      barsToResolution = index + 1;
      break;
    }
  }

  return {
    opportunityId: `market_opportunity_${stableId(draft.family, draft.event.timestamp, side)}`,
    family: draft.family,
    detectedAt: draft.event.timestamp,
    session: draft.event.session,
    side,
    entryReference: round(entryReference),
    invalidationReference: round(rawInvalidation),
    targetReference: round(targetReference),
    targetBasis: externalTarget ? "external_liquidity" : "minimum_2r_projection",
    rr: round(rr, 3),
    evidence: unique(draft.evidence).slice(0, 8),
    outcome,
    ...(resolvedAt ? { resolvedAt } : {}),
    ...(outcome === "target_first" || outcome === "invalidation_first" ? { realizedR: round(realizedR, 3) } : {}),
    mfeR: round(mfe, 3),
    maeR: round(mae, 3),
    ...(barsToResolution ? { barsToResolution } : {}),
    researchOnly: true
  };
};

const discoverOpportunities = (
  events: MarketEpisodeEvent[],
  globalCandles: Candle[],
  sourceIndexByTimestamp: Map<string, number>,
  maxResolutionBars: number
) => {
  const drafts: OpportunityDraft[] = [];
  for (const current of events) {
    if (current.type !== "displacement" || current.direction === "neutral") continue;
    const currentTime = Date.parse(current.timestamp);
    const recent = events.filter((candidate) => {
      const deltaMinutes = (currentTime - Date.parse(candidate.timestamp)) / 60_000;
      return deltaMinutes >= 0 && deltaMinutes <= 180;
    });
    const sweep = [...recent].reverse().find(
      (candidate) => candidate.type === "liquidity_sweep" && candidate.direction === current.direction
    );
    const consolidation = [...recent].reverse().find((candidate) => candidate.type === "consolidation");
    const fvg = recent.find(
      (candidate) => candidate.type === "fair_value_gap" && candidate.direction === current.direction
    );

    if (sweep && consolidation) {
      drafts.push({
        family: "consolidation_manipulation_distribution",
        event: current,
        sweep,
        consolidation,
        evidence: ["Consolidation identified before manipulation", "Liquidity sweep preceded displacement", "Distribution direction confirmed by close"]
      });
    }
    if (sweep) {
      drafts.push({
        family: "session_raid_reversal",
        event: current,
        sweep,
        evidence: ["Liquidity raid rejected", "Opposing displacement followed the sweep"]
      });
    }
    if (fvg) {
      drafts.push({
        family: "displacement_fvg_continuation",
        event: current,
        evidence: ["Displacement produced a same-direction fair value gap", "Entry remains a historical research label only"]
      });
    }
  }
  const seen = new Set<string>();
  return drafts
    .map((draft) => resolveOpportunity(draft, globalCandles, sourceIndexByTimestamp, maxResolutionBars))
    .filter((opportunity): opportunity is MarketEpisodeOpportunity => {
      if (!opportunity || seen.has(opportunity.opportunityId)) return false;
      seen.add(opportunity.opportunityId);
      return true;
    });
};

export function reconstructMarketEpisodes(input: MarketEpisodeReconstructionInput): MarketEpisode[] {
  const candles = normalizeCandles(input.candles);
  const minimumEpisodeCandles = Math.max(8, input.minimumEpisodeCandles ?? 24);
  const maxResolutionBars = Math.max(1, input.maxResolutionBars ?? 48);
  const sourceIndexByTimestamp = new Map(candles.map((candle, index) => [candle.timestamp, index]));
  const byDate = new Map<string, InternalIndexedCandle[]>();
  candles.forEach((candle, sourceIndex) => {
    const date = nyParts(candle.timestamp).date;
    byDate.set(date, [...(byDate.get(date) ?? []), { candle, sourceIndex }]);
  });

  const episodes: MarketEpisode[] = [];
  for (const [tradingDate, indexed] of byDate) {
    if (indexed.length < minimumEpisodeCandles) continue;
    const dayCandles = indexed.map((item) => item.candle);
    const { events, medianBody, medianRange } = detectEvents(indexed, candles);
    const opportunities = discoverOpportunities(events, candles, sourceIndexByTimestamp, maxResolutionBars);
    const dayOpen = dayCandles[0].open;
    const dayHigh = Math.max(...dayCandles.map((candle) => candle.high));
    const dayLow = Math.min(...dayCandles.map((candle) => candle.low));
    const dayClose = dayCandles.at(-1)!.close;
    const midpoint = (dayHigh + dayLow) / 2;
    const twelveAm = indexed.find(({ candle }) => {
      const parts = nyParts(candle.timestamp);
      return parts.hour === 0 && parts.minute < 10;
    })?.candle.open;
    const eventCount = (type: MarketEpisodeEventType) => events.filter((item) => item.type === type).length;
    const context = Math.abs(dayClose - midpoint) <= Math.max(medianRange, (dayHigh - dayLow) * 0.05)
      ? "equilibrium" as const
      : dayClose > midpoint
        ? "premium" as const
        : "discount" as const;

    episodes.push({
      episodeId: `market_episode_${stableId(input.sourceFingerprint, tradingDate, input.timeframe)}`,
      tradingDate,
      sourceProvider: input.sourceProvider,
      requestedSymbol: input.requestedSymbol,
      brokerSymbol: input.brokerSymbol,
      timeframe: input.timeframe,
      sourceFingerprint: input.sourceFingerprint,
      firstTimestamp: dayCandles[0].timestamp,
      lastTimestamp: dayCandles.at(-1)!.timestamp,
      candleCount: dayCandles.length,
      features: {
        asOfTimestamp: dayCandles.at(-1)!.timestamp,
        ...(finite(twelveAm) ? { twelveAmOpen: round(twelveAm) } : {}),
        dayOpen: round(dayOpen),
        dayHigh: round(dayHigh),
        dayLow: round(dayLow),
        dayClose: round(dayClose),
        dealingRangeMidpoint: round(midpoint),
        premiumDiscountContext: context,
        medianTrueRange: round(medianRange),
        medianBodySize: round(medianBody),
        consolidationCount: eventCount("consolidation"),
        liquiditySweepCount: eventCount("liquidity_sweep"),
        displacementCount: eventCount("displacement"),
        fairValueGapCount: eventCount("fair_value_gap"),
        cisdCount: eventCount("cisd")
      },
      events,
      opportunities,
      summary: `${events.length} compact ICT events and ${opportunities.length} causal historical opportunities reconstructed for ${tradingDate}.`,
      authority: MARKET_EPISODE_AUTHORITY,
      safety: {
        researchOnly: true,
        rawCandlesExcluded: true,
        rawSnapshotsExcluded: true,
        autoPromotionAllowed: false
      }
    });
  }
  return episodes;
}

const emptyRecord = <T extends string>(keys: T[]) => Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;

export function summarizeMarketEpisodes(episodes: MarketEpisode[]): MarketEpisodeReconstructionSummary {
  const eventTypes: MarketEpisodeEventType[] = ["session_open", "consolidation", "liquidity_sweep", "displacement", "fair_value_gap", "cisd", "expansion"];
  const opportunityFamilies: MarketEpisodeOpportunityFamily[] = ["consolidation_manipulation_distribution", "session_raid_reversal", "displacement_fvg_continuation"];
  const outcomes: MarketEpisodeOutcome[] = ["target_first", "invalidation_first", "ambiguous", "expired", "insufficient_data"];
  const eventCounts = emptyRecord(eventTypes);
  const opportunityCounts = emptyRecord(opportunityFamilies);
  const outcomeCounts = emptyRecord(outcomes);
  const opportunities = episodes.flatMap((episode) => episode.opportunities);
  episodes.flatMap((episode) => episode.events).forEach((item) => { eventCounts[item.type] += 1; });
  opportunities.forEach((item) => {
    opportunityCounts[item.family] += 1;
    outcomeCounts[item.outcome] += 1;
  });
  const binary = opportunities.filter((item) => item.outcome === "target_first" || item.outcome === "invalidation_first");
  const realized = binary.map((item) => item.realizedR).filter(finite);
  const first = episodes[0];
  return {
    episodeCount: episodes.length,
    opportunityCount: opportunities.length,
    independentDates: new Set(episodes.map((episode) => episode.tradingDate)).size,
    eventCounts,
    opportunityCounts,
    outcomeCounts,
    targetFirstRate: binary.length ? binary.filter((item) => item.outcome === "target_first").length / binary.length : null,
    averageRealizedR: realized.length ? realized.reduce((sum, value) => sum + value, 0) / realized.length : null,
    sourceProvider: first?.sourceProvider ?? "unavailable",
    requestedSymbol: first?.requestedSymbol ?? "unknown",
    brokerSymbol: first?.brokerSymbol ?? "unknown",
    timeframe: first?.timeframe ?? "unknown",
    sourceFingerprint: first?.sourceFingerprint ?? "missing",
    authority: MARKET_EPISODE_AUTHORITY,
    safety: { rawCandlesExcluded: true, researchOnly: true }
  };
}
