import { V2_AUTHORITY_NONE } from "../authority/v2Authority";
import type { V2CanonicalCandle, V2CanonicalCandleWindow } from "../candles/v2CandleTypes";
import { buildV2MarketFactId, v2ContextWindowTimeframe } from "./v2ContextIdentity";
import {
  V2_CONTEXT_DEALING_RANGE_FACT_POLICY_VERSION,
  V2_CONTEXT_LIQUIDITY_FACT_POLICY_VERSION,
  type V2ContextBuildRequest,
  type V2ContextInputIdentity,
  type V2DealingRangeFactPayload,
  type V2FactEnvelope,
  type V2LiquidityPoolFactPayload,
  type V2LiquiditySweepFactPayload,
  type V2MarketFact,
  type V2SessionFactPayload
} from "./v2ContextTypes";

export const V2_DEALING_RANGE_FACT_ENGINE_ID = "gotrader-v2-session-dealing-range-fact-engine";
export const V2_LIQUIDITY_FACT_ENGINE_ID = "gotrader-v2-session-liquidity-fact-engine";

export interface V2DealingRangeLiquidityFactEngineResult {
  facts: readonly Readonly<V2MarketFact>[];
  warnings: readonly string[];
  blockers: readonly string[];
}

type SessionFact = Readonly<V2FactEnvelope<"session", V2SessionFactPayload>>;
type PoolSide = V2LiquidityPoolFactPayload["side"];

const unique = (values: readonly string[]) => Object.freeze([...new Set(values)]);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const quality = (complete: boolean, warning?: string) => Object.freeze({
  status: complete ? "eligible" as const : "degraded" as const,
  confidenceClass: complete ? "derived" as const : "incomplete" as const,
  warnings: Object.freeze(warning ? [warning] : []),
  blockers: Object.freeze([] as string[])
});
const derivation = ({
  policyId,
  policyVersion,
  window,
  inputFactIds
}: {
  policyId: string;
  policyVersion: string;
  window: Readonly<V2CanonicalCandleWindow>;
  inputFactIds: readonly string[];
}) => Object.freeze({
  policyId,
  policyVersion,
  inputWindowIdentityHashes: Object.freeze([window.identity.identityHash]),
  inputFactIds: Object.freeze([...inputFactIds])
});

const finalize = async <TKind extends "dealing_range" | "liquidity_pool" | "liquidity_sweep", TPayload>(
  fact: Omit<V2FactEnvelope<TKind, TPayload>, "factId" | "providerTime" | "receivedAt">
) => Object.freeze({ factId: await buildV2MarketFactId(fact as never), ...fact });

const validSessionGeometry = (fact: SessionFact) =>
  finite(fact.payload.openPrice) &&
  finite(fact.payload.high) &&
  finite(fact.payload.low) &&
  finite(fact.payload.close) &&
  fact.payload.high > fact.payload.low;

const sessionDirection = (payload: V2SessionFactPayload): V2DealingRangeFactPayload["direction"] => {
  if (!finite(payload.openPrice) || !finite(payload.close)) return "neutral";
  if (payload.close > payload.openPrice) return "bullish";
  if (payload.close < payload.openPrice) return "bearish";
  return "neutral";
};

const laterCandles = (
  window: Readonly<V2CanonicalCandleWindow>,
  confirmedAt: string,
  asOfMarketTime: string
) => {
  const confirmedMs = Date.parse(confirmedAt);
  const asOfMs = Date.parse(asOfMarketTime);
  return window.candles.filter((candle) =>
    Date.parse(candle.openTime) >= confirmedMs && Date.parse(candle.closeTime) <= asOfMs
  );
};

const touchesPool = (candle: Readonly<V2CanonicalCandle>, side: PoolSide, price: number) =>
  side === "buy_side" ? candle.high >= price : candle.low <= price;

const breachesPool = (candle: Readonly<V2CanonicalCandle>, side: PoolSide, price: number) =>
  side === "buy_side" ? candle.high > price : candle.low < price;

const closesBackInside = (candle: Readonly<V2CanonicalCandle>, side: PoolSide, price: number) =>
  side === "buy_side" ? candle.close < price : candle.close > price;

const buildRangeFact = async ({
  identity,
  session,
  window
}: {
  identity: Readonly<V2ContextInputIdentity>;
  session: SessionFact;
  window: Readonly<V2CanonicalCandleWindow>;
}) => {
  const low = session.payload.low!;
  const high = session.payload.high!;
  const equilibrium = (low + high) / 2;
  const complete = session.payload.complete && session.quality.status === "eligible";
  const warning = complete ? undefined : `dealing_range_incomplete:${session.payload.sessionType}`;
  const payload = Object.freeze({
    rangeType: `session:${session.payload.sessionType}`,
    direction: sessionDirection(session.payload),
    low,
    high,
    midpoint: equilibrium,
    equilibrium,
    premiumBoundary: high,
    discountBoundary: low,
    anchorStartTime: session.payload.startUtc,
    anchorEndTime: session.payload.endUtc,
    anchorFactIds: Object.freeze([session.factId]),
    complete
  });
  return finalize({
    kind: "dealing_range",
    identityRef: identity.identityHash,
    payload,
    timeframe: "5m",
    observedMarketTime: session.observedMarketTime,
    causalClosedCandleTime: session.causalClosedCandleTime,
    validFrom: session.validFrom,
    ...(session.expiresAt ? { expiresAt: session.expiresAt } : {}),
    quality: quality(complete, warning),
    derivation: derivation({
      policyId: V2_DEALING_RANGE_FACT_ENGINE_ID,
      policyVersion: V2_CONTEXT_DEALING_RANGE_FACT_POLICY_VERSION,
      window,
      inputFactIds: [session.factId]
    }),
    authority: V2_AUTHORITY_NONE
  });
};

const buildPoolAndSweep = async ({
  request,
  identity,
  session,
  window,
  side
}: {
  request: V2ContextBuildRequest;
  identity: Readonly<V2ContextInputIdentity>;
  session: SessionFact;
  window: Readonly<V2CanonicalCandleWindow>;
  side: PoolSide;
}) => {
  const price = side === "buy_side" ? session.payload.high! : session.payload.low!;
  const candidates = laterCandles(window, session.payload.endUtc, request.asOfMarketTime);
  const firstTouch = candidates.find((candle) => touchesPool(candle, side, price));
  const firstSweep = candidates.find((candle) => breachesPool(candle, side, price));
  const state: V2LiquidityPoolFactPayload["state"] = firstSweep ? "swept" : firstTouch ? "touched" : "active";
  const stateCandle = firstSweep ?? firstTouch;
  const observedMarketTime = stateCandle?.closeTime ?? session.payload.endUtc;
  const payload = Object.freeze({
    side,
    poolType: `session_${side === "buy_side" ? "high" : "low"}:${session.payload.sessionType}`,
    price,
    formedAt: session.payload.endUtc,
    confirmedAt: session.payload.endUtc,
    tolerancePolicy: "strict_price_comparison_v1",
    state
  });
  const pool = await finalize({
    kind: "liquidity_pool",
    identityRef: identity.identityHash,
    payload,
    timeframe: "5m",
    observedMarketTime,
    causalClosedCandleTime: observedMarketTime,
    validFrom: observedMarketTime,
    quality: quality(true),
    derivation: derivation({
      policyId: V2_LIQUIDITY_FACT_ENGINE_ID,
      policyVersion: V2_CONTEXT_LIQUIDITY_FACT_POLICY_VERSION,
      window,
      inputFactIds: [session.factId]
    }),
    authority: V2_AUTHORITY_NONE
  });
  if (!firstSweep) return { pool, sweep: undefined };
  const rejectedInside = closesBackInside(firstSweep, side, price);
  const sweepPayload = Object.freeze({
    liquidityPoolFactId: pool.factId,
    side,
    poolPrice: price,
    extremePrice: side === "buy_side" ? firstSweep.high : firstSweep.low,
    sweepCandleTime: firstSweep.openTime,
    closedBackInside: rejectedInside,
    confirmationState: rejectedInside ? "confirmed" as const : "wick_through" as const
  });
  const sweep = await finalize({
    kind: "liquidity_sweep",
    identityRef: identity.identityHash,
    payload: sweepPayload,
    timeframe: "5m",
    observedMarketTime: firstSweep.closeTime,
    causalClosedCandleTime: firstSweep.closeTime,
    validFrom: firstSweep.closeTime,
    quality: quality(true),
    derivation: derivation({
      policyId: V2_LIQUIDITY_FACT_ENGINE_ID,
      policyVersion: V2_CONTEXT_LIQUIDITY_FACT_POLICY_VERSION,
      window,
      inputFactIds: [pool.factId]
    }),
    authority: V2_AUTHORITY_NONE
  });
  return { pool, sweep };
};

export async function buildV2DealingRangeLiquidityFacts({
  request,
  identity,
  sourceFacts
}: {
  request: V2ContextBuildRequest;
  identity: Readonly<V2ContextInputIdentity>;
  sourceFacts: readonly Readonly<V2MarketFact>[];
}): Promise<Readonly<V2DealingRangeLiquidityFactEngineResult>> {
  const requested = new Set(request.requestedFactFamilies ?? []);
  if (!requested.has("dealing_range") && !requested.has("liquidity")) {
    return Object.freeze({ facts: Object.freeze([]), warnings: Object.freeze([]), blockers: Object.freeze([]) });
  }
  const window = request.windows.find((candidate) => v2ContextWindowTimeframe(candidate) === "5m");
  if (!window || window.diagnostics.status === "blocked") {
    return Object.freeze({
      facts: Object.freeze([]),
      warnings: Object.freeze([]),
      blockers: Object.freeze(["range_liquidity_fact_engine_requires_eligible_5m_window"])
    });
  }
  const sessions = sourceFacts.filter((fact): fact is SessionFact => fact.kind === "session");
  if (!sessions.length) {
    return Object.freeze({
      facts: Object.freeze([]),
      warnings: Object.freeze(["range_liquidity_source_session_unavailable"]),
      blockers: Object.freeze([])
    });
  }

  const ranges: Readonly<V2MarketFact>[] = [];
  const pools: Readonly<V2MarketFact>[] = [];
  const sweeps: Readonly<V2MarketFact>[] = [];
  const warnings: string[] = [];
  for (const session of sessions) {
    if (!validSessionGeometry(session)) {
      warnings.push(`session_geometry_unavailable:${session.payload.sessionType}`);
      continue;
    }
    if (requested.has("dealing_range")) {
      ranges.push(await buildRangeFact({ identity, session, window }));
      if (!session.payload.complete) warnings.push(`dealing_range_incomplete:${session.payload.sessionType}`);
    }
    if (requested.has("liquidity")) {
      if (!session.payload.complete || session.quality.status !== "eligible") {
        warnings.push(`liquidity_pool_deferred_incomplete_session:${session.payload.sessionType}`);
        continue;
      }
      for (const side of ["buy_side", "sell_side"] as const) {
        const result = await buildPoolAndSweep({ request, identity, session, window, side });
        pools.push(result.pool);
        if (result.sweep) sweeps.push(result.sweep);
      }
    }
  }
  return Object.freeze({
    facts: Object.freeze([...ranges, ...pools, ...sweeps]),
    warnings: unique(warnings),
    blockers: Object.freeze([])
  });
}
