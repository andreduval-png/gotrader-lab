import { V2_AUTHORITY_NONE } from "../authority/v2Authority";
import type { V2CanonicalCandle, V2CanonicalCandleWindow } from "../candles/v2CandleTypes";
import { buildV2MarketFactId, v2ContextWindowTimeframe } from "./v2ContextIdentity";
import {
  V2_CONTEXT_OPENING_PRICE_FACT_POLICY_VERSION,
  V2_CONTEXT_SESSION_FACT_POLICY_VERSION,
  V2_CONTEXT_STRATEGY_TIMEZONE,
  type V2ContextBuildRequest,
  type V2ContextFactFamily,
  type V2ContextInputIdentity,
  type V2FactEnvelope,
  type V2MarketFact,
  type V2OpeningPriceFactPayload,
  type V2SessionFactPayload
} from "./v2ContextTypes";

export const V2_SESSION_FACT_ENGINE_ID = "gotrader-v2-session-fact-engine";
export const V2_OPENING_PRICE_FACT_ENGINE_ID = "gotrader-v2-opening-price-fact-engine";

export type V2SessionFactId = "asia" | "london" | "new_york_am" | "new_york_lunch" | "new_york_pm";

interface V2SessionDefinition {
  id: V2SessionFactId;
  startMinute: number;
  endMinute: number;
  startsPreviousDay?: boolean;
}
export interface V2SessionOpeningFactEngineResult {
  facts: readonly Readonly<V2MarketFact>[];
  warnings: readonly string[];
  blockers: readonly string[];
}

const SESSION_DEFINITIONS: readonly Readonly<V2SessionDefinition>[] = Object.freeze([
  Object.freeze({ id: "asia", startMinute: 20 * 60, endMinute: 0, startsPreviousDay: true }),
  Object.freeze({ id: "london", startMinute: 2 * 60, endMinute: 5 * 60 }),
  Object.freeze({ id: "new_york_am", startMinute: 9 * 60 + 30, endMinute: 12 * 60 }),
  Object.freeze({ id: "new_york_lunch", startMinute: 12 * 60, endMinute: 13 * 60 + 30 }),
  Object.freeze({ id: "new_york_pm", startMinute: 13 * 60 + 30, endMinute: 16 * 60 })
]);

const unique = (values: readonly string[]) => Object.freeze([...new Set(values)]);
const isoMs = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const dateKey = (year: number, month: number, day: number) =>
  `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
const shiftDate = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return dateKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
};

const localFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: V2_CONTEXT_STRATEGY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hour12: false,
  hourCycle: "h23"
});

const localParts = (timestamp: string) => {
  const values = Object.fromEntries(localFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  const hour = Number(values.hour) % 24;
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour,
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: values.weekday,
    date: `${values.year}-${values.month}-${values.day}`,
    minuteOfDay: hour * 60 + Number(values.minute)
  };
};

// Convert an explicit New York wall-clock boundary to UTC without assuming a fixed offset.
const newYorkBoundaryUtc = (localDate: string, minuteOfDay: number) => {
  const [year, month, day] = localDate.split("-").map(Number);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const desiredWallClock = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = desiredWallClock;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = localParts(new Date(candidate).toISOString());
    const observedWallClock = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
      0
    );
    candidate += desiredWallClock - observedWallClock;
  }
  return new Date(candidate).toISOString();
};

const tradingDateFor = (timestamp: string) => {
  const local = localParts(timestamp);
  return local.minuteOfDay >= 20 * 60 ? shiftDate(local.date, 1) : local.date;
};

const quality = ({ complete, warnings }: { complete: boolean; warnings: readonly string[] }) => Object.freeze({
  status: complete ? "eligible" as const : "degraded" as const,
  confidenceClass: complete ? "exact" as const : "incomplete" as const,
  warnings: unique(warnings),
  blockers: Object.freeze([] as string[])
});

const derivation = (policyId: string, policyVersion: string, window: Readonly<V2CanonicalCandleWindow>) => Object.freeze({
  policyId,
  policyVersion,
  inputWindowIdentityHashes: Object.freeze([window.identity.identityHash]),
  inputFactIds: Object.freeze([] as string[])
});

const finalizeSessionFact = async (
  fact: Omit<V2FactEnvelope<"session", V2SessionFactPayload>, "factId" | "providerTime" | "receivedAt">
): Promise<Readonly<V2FactEnvelope<"session", V2SessionFactPayload>>> => Object.freeze({
  factId: await buildV2MarketFactId(fact),
  ...fact
});

const finalizeOpeningFact = async (
  fact: Omit<V2FactEnvelope<"opening_price", V2OpeningPriceFactPayload>, "factId" | "providerTime" | "receivedAt">
): Promise<Readonly<V2FactEnvelope<"opening_price", V2OpeningPriceFactPayload>>> => Object.freeze({
  factId: await buildV2MarketFactId(fact),
  ...fact
});

const candleAtBoundary = (candles: readonly Readonly<V2CanonicalCandle>[], boundaryUtc: string) => {
  const boundaryMs = Date.parse(boundaryUtc);
  return candles.find((candle) => Date.parse(candle.openTime) === boundaryMs);
};

const buildSessionFacts = async ({
  request,
  identity,
  window
}: {
  request: V2ContextBuildRequest;
  identity: Readonly<V2ContextInputIdentity>;
  window: Readonly<V2CanonicalCandleWindow>;
}) => {
  const facts: Readonly<V2FactEnvelope<"session", V2SessionFactPayload>>[] = [];
  const warnings: string[] = [];
  const asOfMs = Date.parse(request.asOfMarketTime);
  const tradingDate = tradingDateFor(request.asOfMarketTime);
  for (const session of SESSION_DEFINITIONS) {
    const startDate = session.startsPreviousDay ? shiftDate(tradingDate, -1) : tradingDate;
    const startUtc = newYorkBoundaryUtc(startDate, session.startMinute);
    const endUtc = newYorkBoundaryUtc(tradingDate, session.endMinute);
    const startMs = Date.parse(startUtc);
    const endMs = Date.parse(endUtc);
    if (asOfMs < startMs) continue;
    const candles = window.candles.filter((candle) => {
      const openMs = Date.parse(candle.openTime);
      return openMs >= startMs && openMs < endMs && Date.parse(candle.closeTime) <= asOfMs;
    });
    if (!candles.length) {
      if (asOfMs >= endMs) warnings.push(`session_fact_unavailable:${session.id}`);
      continue;
    }
    const expectedCount = Math.round((endMs - startMs) / (5 * 60_000));
    const complete = asOfMs >= endMs &&
      Date.parse(candles[0].openTime) === startMs &&
      Date.parse(candles.at(-1)!.closeTime) >= endMs &&
      candles.length === expectedCount;
    const factWarnings = complete ? [] : [`session_fact_incomplete:${session.id}`];
    const payload = Object.freeze({
      sessionType: session.id,
      sessionDate: tradingDate,
      timezone: V2_CONTEXT_STRATEGY_TIMEZONE,
      startUtc,
      endUtc,
      openPrice: candles[0].open,
      high: Math.max(...candles.map((candle) => candle.high)),
      low: Math.min(...candles.map((candle) => candle.low)),
      close: candles.at(-1)!.close,
      complete,
      sourceTimeframes: Object.freeze(["5m"])
    });
    facts.push(await finalizeSessionFact({
      kind: "session",
      identityRef: identity.identityHash,
      payload,
      timeframe: "5m",
      observedMarketTime: candles.at(-1)!.closeTime,
      causalClosedCandleTime: candles.at(-1)!.closeTime,
      validFrom: candles.at(-1)!.closeTime,
      ...(complete ? {} : { expiresAt: endUtc }),
      quality: quality({ complete, warnings: factWarnings }),
      derivation: derivation(V2_SESSION_FACT_ENGINE_ID, V2_CONTEXT_SESSION_FACT_POLICY_VERSION, window),
      authority: V2_AUTHORITY_NONE
    }));
    warnings.push(...factWarnings);
  }
  return { facts, warnings };
};

const openingBoundaryCandidates = (
  request: V2ContextBuildRequest,
  window: Readonly<V2CanonicalCandleWindow>
) => {
  const asOfMs = Date.parse(request.asOfMarketTime);
  const tradingDate = tradingDateFor(request.asOfMarketTime);
  const fixed = [
    { openingType: "new_york_midnight" as const, boundaryUtc: newYorkBoundaryUtc(tradingDate, 0) },
    { openingType: "new_york_0930" as const, boundaryUtc: newYorkBoundaryUtc(tradingDate, 9 * 60 + 30) }
  ];
  const sundayCandles = window.candles.filter((candle) => {
    const local = localParts(candle.openTime);
    return local.weekday === "Sun" && local.minuteOfDay === 18 * 60 && Date.parse(candle.openTime) <= asOfMs;
  });
  const sunday = sundayCandles.at(-1);
  return [
    ...(sunday ? [{ openingType: "sunday" as const, boundaryUtc: sunday.openTime }] : []),
    ...fixed.filter((item) => Date.parse(item.boundaryUtc) <= asOfMs)
  ];
};

const buildOpeningFacts = async ({
  request,
  identity,
  window
}: {
  request: V2ContextBuildRequest;
  identity: Readonly<V2ContextInputIdentity>;
  window: Readonly<V2CanonicalCandleWindow>;
}) => {
  const facts: Readonly<V2FactEnvelope<"opening_price", V2OpeningPriceFactPayload>>[] = [];
  const warnings: string[] = [];
  const candidates = openingBoundaryCandidates(request, window);
  if (!candidates.some((candidate) => candidate.openingType === "sunday")) {
    warnings.push("opening_price_unavailable:sunday");
  }
  for (const candidate of candidates) {
    const candle = candleAtBoundary(window.candles, candidate.boundaryUtc);
    if (!candle) {
      warnings.push(`opening_price_unavailable:${candidate.openingType}`);
      continue;
    }
    const payload = Object.freeze({
      openingType: candidate.openingType,
      price: candle.open,
      boundaryUtc: candidate.boundaryUtc,
      derivationQuality: "exact_candle_open" as const
    });
    facts.push(await finalizeOpeningFact({
      kind: "opening_price",
      identityRef: identity.identityHash,
      payload,
      timeframe: "5m",
      observedMarketTime: candle.closeTime,
      causalClosedCandleTime: candle.closeTime,
      validFrom: candle.closeTime,
      quality: quality({ complete: true, warnings: [] }),
      derivation: derivation(V2_OPENING_PRICE_FACT_ENGINE_ID, V2_CONTEXT_OPENING_PRICE_FACT_POLICY_VERSION, window),
      authority: V2_AUTHORITY_NONE
    }));
  }
  return { facts, warnings };
};

export async function buildV2SessionOpeningFacts({
  request,
  identity
}: {
  request: V2ContextBuildRequest;
  identity: Readonly<V2ContextInputIdentity>;
}): Promise<Readonly<V2SessionOpeningFactEngineResult>> {
  const requested = new Set<V2ContextFactFamily>(request.requestedFactFamilies ?? []);
  if (!requested.size) {
    return Object.freeze({ facts: Object.freeze([]), warnings: Object.freeze([]), blockers: Object.freeze([]) });
  }
  const window = request.windows.find((candidate) => v2ContextWindowTimeframe(candidate) === "5m");
  if (!window || window.diagnostics.status === "blocked") {
    return Object.freeze({
      facts: Object.freeze([]),
      warnings: Object.freeze([]),
      blockers: Object.freeze(["session_opening_fact_engine_requires_eligible_5m_window"])
    });
  }
  const facts: Readonly<V2MarketFact>[] = [];
  const warnings: string[] = [];
  if (requested.has("session")) {
    const result = await buildSessionFacts({ request, identity, window });
    facts.push(...result.facts);
    warnings.push(...result.warnings);
  }
  if (requested.has("opening_price")) {
    const result = await buildOpeningFacts({ request, identity, window });
    facts.push(...result.facts);
    warnings.push(...result.warnings);
  }
  return Object.freeze({
    facts: Object.freeze(facts),
    warnings: unique(warnings),
    blockers: Object.freeze([])
  });
}
