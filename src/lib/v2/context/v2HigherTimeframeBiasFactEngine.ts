import { V2_AUTHORITY_NONE } from "../authority/v2Authority";
import type { V2CanonicalCandle, V2CanonicalCandleWindow } from "../candles/v2CandleTypes";
import { buildV2MarketFactId, v2ContextWindowTimeframe } from "./v2ContextIdentity";
import {
  V2_CONTEXT_HIGHER_TIMEFRAME_BIAS_FACT_POLICY_VERSION,
  type V2ContextBuildRequest,
  type V2ContextInputIdentity,
  type V2FactEnvelope,
  type V2HigherTimeframeBiasFactPayload,
  type V2MarketFact
} from "./v2ContextTypes";

export const V2_HIGHER_TIMEFRAME_BIAS_FACT_ENGINE_ID = "gotrader-v2-higher-timeframe-bias-fact-engine";
export const V2_HIGHER_TIMEFRAME_BIAS_LOOKBACK_CANDLES = 5;
export const V2_HIGHER_TIMEFRAME_BIAS_MINIMUM_RETURN = 0.001;
export const V2_HIGHER_TIMEFRAME_BIAS_TIMEFRAMES = Object.freeze(["15m", "1h", "4h", "1d", "1w"] as const);

export interface V2HigherTimeframeBiasFactEngineResult {
  facts: readonly Readonly<V2MarketFact>[];
  warnings: readonly string[];
  blockers: readonly string[];
}

type HigherTimeframeBiasFact = Readonly<
  V2FactEnvelope<"higher_timeframe_bias", V2HigherTimeframeBiasFactPayload>
>;

const supportedTimeframes = new Set<string>(V2_HIGHER_TIMEFRAME_BIAS_TIMEFRAMES);
const unique = (values: readonly string[]) => Object.freeze([...new Set(values)]);
const round = (value: number, precision = 8) => Number(value.toFixed(precision));

const finalize = async (
  fact: Omit<HigherTimeframeBiasFact, "factId" | "providerTime" | "receivedAt">
): Promise<HigherTimeframeBiasFact> => Object.freeze({
  factId: await buildV2MarketFactId(fact),
  ...fact
});

const derivation = (window: Readonly<V2CanonicalCandleWindow>) => Object.freeze({
  policyId: V2_HIGHER_TIMEFRAME_BIAS_FACT_ENGINE_ID,
  policyVersion: V2_CONTEXT_HIGHER_TIMEFRAME_BIAS_FACT_POLICY_VERSION,
  inputWindowIdentityHashes: Object.freeze([window.identity.identityHash]),
  inputFactIds: Object.freeze([] as string[])
});

const insufficientPayload = (timeframe: string, candleCount: number) => Object.freeze({
  timeframe,
  direction: "insufficient_data" as const,
  basis: `explicit_${timeframe}_closed_candles:${candleCount}/${V2_HIGHER_TIMEFRAME_BIAS_LOOKBACK_CANDLES}_required`,
  supportingFactIds: Object.freeze([] as string[]),
  contradictoryFactIds: Object.freeze([] as string[]),
  confidenceClass: "insufficient" as const,
  complete: false
});

const directionalPayload = (
  timeframe: string,
  candles: readonly Readonly<V2CanonicalCandle>[]
): Readonly<V2HigherTimeframeBiasFactPayload> => {
  const sample = candles.slice(-V2_HIGHER_TIMEFRAME_BIAS_LOOKBACK_CANDLES);
  const first = sample[0];
  const latest = sample.at(-1)!;
  const prior = sample.slice(0, -1);
  const denominator = Math.max(Math.abs(first.open), Number.EPSILON);
  const returnRatio = (latest.close - first.open) / denominator;
  const priorHigh = Math.max(...prior.map((candle) => candle.high));
  const priorLow = Math.min(...prior.map((candle) => candle.low));
  const structureState =
    latest.close > priorHigh ? "close_above_prior_four_high" :
      latest.close < priorLow ? "close_below_prior_four_low" :
        "inside_prior_four_range";
  const direction =
    returnRatio >= V2_HIGHER_TIMEFRAME_BIAS_MINIMUM_RETURN ? "bullish" as const :
      returnRatio <= -V2_HIGHER_TIMEFRAME_BIAS_MINIMUM_RETURN ? "bearish" as const :
        "neutral" as const;
  const structureConfirms =
    (direction === "bullish" && latest.close > priorHigh) ||
    (direction === "bearish" && latest.close < priorLow);
  return Object.freeze({
    timeframe,
    direction,
    basis: [
      `last_${V2_HIGHER_TIMEFRAME_BIAS_LOOKBACK_CANDLES}_explicit_closed_candles`,
      `return=${round(returnRatio)}`,
      `threshold=${V2_HIGHER_TIMEFRAME_BIAS_MINIMUM_RETURN}`,
      `structure=${structureState}`
    ].join(";"),
    supportingFactIds: Object.freeze([] as string[]),
    contradictoryFactIds: Object.freeze([] as string[]),
    confidenceClass: direction === "neutral" ? "low" as const : structureConfirms ? "high" as const : "medium" as const,
    complete: true
  });
};

const buildFact = async ({
  identity,
  timeframe,
  window
}: {
  identity: Readonly<V2ContextInputIdentity>;
  timeframe: string;
  window: Readonly<V2CanonicalCandleWindow>;
}) => {
  const latest = window.candles.at(-1)!;
  const complete = window.candles.length >= V2_HIGHER_TIMEFRAME_BIAS_LOOKBACK_CANDLES;
  const warning = `higher_timeframe_bias_insufficient_closed_candles:${timeframe}:${window.candles.length}/${V2_HIGHER_TIMEFRAME_BIAS_LOOKBACK_CANDLES}`;
  return finalize({
    kind: "higher_timeframe_bias",
    identityRef: identity.identityHash,
    payload: complete
      ? directionalPayload(timeframe, window.candles)
      : insufficientPayload(timeframe, window.candles.length),
    timeframe,
    observedMarketTime: latest.closeTime,
    causalClosedCandleTime: latest.closeTime,
    validFrom: latest.closeTime,
    quality: Object.freeze({
      status: complete ? "eligible" as const : "degraded" as const,
      confidenceClass: complete ? "derived" as const : "incomplete" as const,
      warnings: complete ? Object.freeze([] as string[]) : Object.freeze([warning]),
      blockers: Object.freeze([] as string[])
    }),
    derivation: derivation(window),
    authority: V2_AUTHORITY_NONE
  });
};

export async function buildV2HigherTimeframeBiasFacts({
  request,
  identity
}: {
  request: V2ContextBuildRequest;
  identity: Readonly<V2ContextInputIdentity>;
}): Promise<Readonly<V2HigherTimeframeBiasFactEngineResult>> {
  const requested = new Set(request.requestedFactFamilies ?? []);
  if (!requested.has("higher_timeframe_bias")) {
    return Object.freeze({ facts: Object.freeze([]), warnings: Object.freeze([]), blockers: Object.freeze([]) });
  }
  const windows = request.windows
    .map((window) => ({ timeframe: v2ContextWindowTimeframe(window), window }))
    .filter(({ timeframe, window }) => supportedTimeframes.has(timeframe) && window.diagnostics.status !== "blocked")
    .sort((left, right) => left.timeframe.localeCompare(right.timeframe));
  if (!windows.length) {
    return Object.freeze({
      facts: Object.freeze([]),
      warnings: Object.freeze([]),
      blockers: Object.freeze(["higher_timeframe_bias_requires_explicit_m15_h1_h4_d1_or_w1_window"])
    });
  }
  const facts = await Promise.all(windows.map(({ timeframe, window }) =>
    buildFact({ identity, timeframe, window })
  ));
  return Object.freeze({
    facts: Object.freeze(facts),
    warnings: unique(facts.flatMap((fact) => fact.quality.warnings)),
    blockers: Object.freeze([])
  });
}
