import { V2_AUTHORITY_NONE } from "../authority/v2Authority";
import type { V2CanonicalCandle, V2CanonicalCandleWindow } from "../candles/v2CandleTypes";
import { buildV2MarketFactId, v2ContextWindowTimeframe } from "./v2ContextIdentity";
import {
  V2_CONTEXT_DISPLACEMENT_FACT_POLICY_VERSION,
  V2_CONTEXT_FAIR_VALUE_GAP_FACT_POLICY_VERSION,
  type V2ContextBuildRequest,
  type V2ContextInputIdentity,
  type V2DisplacementFactPayload,
  type V2FactEnvelope,
  type V2FairValueGapFactPayload,
  type V2LiquidityPoolFactPayload,
  type V2LiquiditySweepFactPayload,
  type V2MarketFact
} from "./v2ContextTypes";

export const V2_DISPLACEMENT_FACT_ENGINE_ID = "gotrader-v2-displacement-fact-engine";
export const V2_FAIR_VALUE_GAP_FACT_ENGINE_ID = "gotrader-v2-fair-value-gap-fact-engine";
export const V2_DISPLACEMENT_BODY_MULTIPLE = 1.6;
export const V2_DISPLACEMENT_BASELINE_CANDLES = 10;

export interface V2DisplacementFvgFactEngineResult {
  facts: readonly Readonly<V2MarketFact>[];
  warnings: readonly string[];
  blockers: readonly string[];
}

type PoolFact = Readonly<V2FactEnvelope<"liquidity_pool", V2LiquidityPoolFactPayload>>;
type SweepFact = Readonly<V2FactEnvelope<"liquidity_sweep", V2LiquiditySweepFactPayload>>;
type DisplacementFact = Readonly<V2FactEnvelope<"displacement", V2DisplacementFactPayload>>;

interface GapCandidate {
  direction: "bullish" | "bearish";
  firstIndex: number;
  middleIndex: number;
  confirmationIndex: number;
  lowerBound: number;
  upperBound: number;
}

const round = (value: number, precision = 8) => Number(value.toFixed(precision));
const unique = (values: readonly string[]) => Object.freeze([...new Set(values)]);
const quality = Object.freeze({
  status: "eligible" as const,
  confidenceClass: "derived" as const,
  warnings: Object.freeze([] as string[]),
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
  inputFactIds: unique(inputFactIds)
});

const finalize = async <TKind extends "displacement" | "fair_value_gap", TPayload>(
  fact: Omit<V2FactEnvelope<TKind, TPayload>, "factId" | "providerTime" | "receivedAt">
) => Object.freeze({ factId: await buildV2MarketFactId(fact as never), ...fact });

const bodySize = (candle: Readonly<V2CanonicalCandle>) => Math.abs(candle.close - candle.open);
const fullRange = (candle: Readonly<V2CanonicalCandle>) => candle.high - candle.low;
const directionOf = (candle: Readonly<V2CanonicalCandle>) =>
  candle.close > candle.open ? "bullish" as const : candle.close < candle.open ? "bearish" as const : undefined;

const detectGapCandidates = (candles: readonly Readonly<V2CanonicalCandle>[]) => {
  const gaps: GapCandidate[] = [];
  for (let index = 2; index < candles.length; index += 1) {
    const first = candles[index - 2];
    const third = candles[index];
    if (first.high < third.low) {
      gaps.push({
        direction: "bullish",
        firstIndex: index - 2,
        middleIndex: index - 1,
        confirmationIndex: index,
        lowerBound: first.high,
        upperBound: third.low
      });
    }
    if (first.low > third.high) {
      gaps.push({
        direction: "bearish",
        firstIndex: index - 2,
        middleIndex: index - 1,
        confirmationIndex: index,
        lowerBound: third.high,
        upperBound: first.low
      });
    }
  }
  return gaps;
};

const crossedPoolFacts = (
  candle: Readonly<V2CanonicalCandle>,
  direction: "bullish" | "bearish",
  pools: readonly PoolFact[],
  sweeps: readonly SweepFact[]
) => pools.filter((pool) => {
  if (Date.parse(pool.observedMarketTime) > Date.parse(candle.closeTime)) return false;
  const crossed = direction === "bullish"
    ? pool.payload.side === "buy_side" && candle.close > pool.payload.price
    : pool.payload.side === "sell_side" && candle.close < pool.payload.price;
  if (!crossed) return false;
  if (pool.payload.state !== "swept") return true;
  return sweeps.some((sweep) =>
    sweep.payload.liquidityPoolFactId === pool.factId && sweep.payload.sweepCandleTime === candle.openTime
  );
});

const buildDisplacementFacts = async ({
  identity,
  window,
  gaps,
  pools,
  sweeps
}: {
  identity: Readonly<V2ContextInputIdentity>;
  window: Readonly<V2CanonicalCandleWindow>;
  gaps: readonly GapCandidate[];
  pools: readonly PoolFact[];
  sweeps: readonly SweepFact[];
}) => {
  const facts: DisplacementFact[] = [];
  for (
    let index = V2_DISPLACEMENT_BASELINE_CANDLES;
    index < window.candles.length - 1;
    index += 1
  ) {
    const candle = window.candles[index];
    const nextCandle = window.candles[index + 1];
    const direction = directionOf(candle);
    if (!direction) continue;
    const baselineCandles = window.candles.slice(index - V2_DISPLACEMENT_BASELINE_CANDLES, index);
    const baselineValue = baselineCandles.reduce((total, item) => total + bodySize(item), 0) /
      V2_DISPLACEMENT_BASELINE_CANDLES;
    const body = bodySize(candle);
    if (baselineValue <= 0 || body < baselineValue * V2_DISPLACEMENT_BODY_MULTIPLE) continue;
    const range = fullRange(candle);
    if (range <= 0) continue;
    const leavesFvg = gaps.some((gap) => gap.middleIndex === index && gap.direction === direction);
    const crossedPools = crossedPoolFacts(candle, direction, pools, sweeps);
    const payload = Object.freeze({
      direction,
      candleTime: candle.openTime,
      bodySize: round(body),
      fullRange: round(range),
      bodyToRangeRatio: round(body / range),
      comparisonBaseline: `mean_body_previous_${V2_DISPLACEMENT_BASELINE_CANDLES}_closed_candles`,
      baselineValue: round(baselineValue),
      displacementMultiple: round(body / baselineValue),
      closesThroughStructure: crossedPools.length > 0,
      leavesFvg,
      policyId: V2_DISPLACEMENT_FACT_ENGINE_ID,
      policyVersion: V2_CONTEXT_DISPLACEMENT_FACT_POLICY_VERSION
    });
    facts.push(await finalize({
      kind: "displacement",
      identityRef: identity.identityHash,
      payload,
      timeframe: "5m",
      observedMarketTime: nextCandle.closeTime,
      causalClosedCandleTime: nextCandle.closeTime,
      validFrom: nextCandle.closeTime,
      quality,
      derivation: derivation({
        policyId: V2_DISPLACEMENT_FACT_ENGINE_ID,
        policyVersion: V2_CONTEXT_DISPLACEMENT_FACT_POLICY_VERSION,
        window,
        inputFactIds: crossedPools.map((pool) => pool.factId)
      }),
      authority: V2_AUTHORITY_NONE
    }));
  }
  return facts;
};

const lifecycleFor = (
  gap: GapCandidate,
  candles: readonly Readonly<V2CanonicalCandle>[]
) => {
  let state: V2FairValueGapFactPayload["state"] = "fresh";
  let rank = 0;
  let transitionCandle = candles[gap.confirmationIndex];
  let inversionTime: string | undefined;
  const advance = (nextState: V2FairValueGapFactPayload["state"], nextRank: number, candle: Readonly<V2CanonicalCandle>) => {
    if (nextRank <= rank) return;
    state = nextState;
    rank = nextRank;
    transitionCandle = candle;
  };
  for (const candle of candles.slice(gap.confirmationIndex + 1)) {
    if (gap.direction === "bullish") {
      if (candle.close < gap.lowerBound) {
        advance("inverted", 4, candle);
        inversionTime = candle.closeTime;
        break;
      }
      if (candle.low <= gap.lowerBound) advance("filled", 3, candle);
      else if (candle.low < gap.upperBound) advance("partially_filled", 2, candle);
      else if (candle.low === gap.upperBound) advance("touched", 1, candle);
    } else {
      if (candle.close > gap.upperBound) {
        advance("inverted", 4, candle);
        inversionTime = candle.closeTime;
        break;
      }
      if (candle.high >= gap.upperBound) advance("filled", 3, candle);
      else if (candle.high > gap.lowerBound) advance("partially_filled", 2, candle);
      else if (candle.high === gap.lowerBound) advance("touched", 1, candle);
    }
  }
  return { state, transitionCandle, inversionTime };
};

const buildFairValueGapFacts = async ({
  identity,
  window,
  gaps,
  displacements
}: {
  identity: Readonly<V2ContextInputIdentity>;
  window: Readonly<V2CanonicalCandleWindow>;
  gaps: readonly GapCandidate[];
  displacements: readonly DisplacementFact[];
}) => {
  const facts: Readonly<V2FactEnvelope<"fair_value_gap", V2FairValueGapFactPayload>>[] = [];
  for (const gap of gaps) {
    const middle = window.candles[gap.middleIndex];
    const confirmation = window.candles[gap.confirmationIndex];
    const displacement = displacements.find((fact) =>
      fact.payload.candleTime === middle.openTime && fact.payload.direction === gap.direction && fact.payload.leavesFvg
    );
    const lifecycle = lifecycleFor(gap, window.candles);
    const payload = Object.freeze({
      direction: gap.direction,
      gapType: "fvg" as const,
      lowerBound: gap.lowerBound,
      upperBound: gap.upperBound,
      midpoint: round((gap.lowerBound + gap.upperBound) / 2),
      formedAt: middle.closeTime,
      confirmationCandleTime: confirmation.closeTime,
      state: lifecycle.state,
      ...(lifecycle.inversionTime ? { inversionTime: lifecycle.inversionTime } : {}),
      policyId: V2_FAIR_VALUE_GAP_FACT_ENGINE_ID,
      policyVersion: V2_CONTEXT_FAIR_VALUE_GAP_FACT_POLICY_VERSION
    });
    facts.push(await finalize({
      kind: "fair_value_gap",
      identityRef: identity.identityHash,
      payload,
      timeframe: "5m",
      observedMarketTime: lifecycle.transitionCandle.closeTime,
      causalClosedCandleTime: lifecycle.transitionCandle.closeTime,
      validFrom: lifecycle.transitionCandle.closeTime,
      quality,
      derivation: derivation({
        policyId: V2_FAIR_VALUE_GAP_FACT_ENGINE_ID,
        policyVersion: V2_CONTEXT_FAIR_VALUE_GAP_FACT_POLICY_VERSION,
        window,
        inputFactIds: displacement ? [displacement.factId] : []
      }),
      authority: V2_AUTHORITY_NONE
    }));
  }
  return facts;
};

export async function buildV2DisplacementFvgFacts({
  request,
  identity,
  sourceFacts
}: {
  request: V2ContextBuildRequest;
  identity: Readonly<V2ContextInputIdentity>;
  sourceFacts: readonly Readonly<V2MarketFact>[];
}): Promise<Readonly<V2DisplacementFvgFactEngineResult>> {
  const requested = new Set(request.requestedFactFamilies ?? []);
  if (!requested.has("displacement") && !requested.has("fair_value_gap")) {
    return Object.freeze({ facts: Object.freeze([]), warnings: Object.freeze([]), blockers: Object.freeze([]) });
  }
  const window = request.windows.find((candidate) => v2ContextWindowTimeframe(candidate) === "5m");
  if (!window || window.diagnostics.status === "blocked") {
    return Object.freeze({
      facts: Object.freeze([]),
      warnings: Object.freeze([]),
      blockers: Object.freeze(["displacement_fvg_fact_engine_requires_eligible_5m_window"])
    });
  }
  const gaps = detectGapCandidates(window.candles);
  const pools = sourceFacts.filter((fact): fact is PoolFact => fact.kind === "liquidity_pool");
  const sweeps = sourceFacts.filter((fact): fact is SweepFact => fact.kind === "liquidity_sweep");
  const displacements = requested.has("displacement")
    ? await buildDisplacementFacts({ identity, window, gaps, pools, sweeps })
    : [];
  const fvgFacts = requested.has("fair_value_gap")
    ? await buildFairValueGapFacts({ identity, window, gaps, displacements })
    : [];
  return Object.freeze({
    facts: Object.freeze([
      ...(requested.has("displacement") ? displacements : []),
      ...fvgFacts
    ]),
    warnings: Object.freeze([]),
    blockers: Object.freeze([])
  });
}
