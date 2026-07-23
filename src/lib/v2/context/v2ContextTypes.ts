import type { V2Authority } from "../authority/v2Authority";
import type { V2CanonicalCandleWindow } from "../candles/v2CandleTypes";
import type { V2SourceIdentity } from "../identity/v2IdentityTypes";

export const V2_CONTEXT_SCHEMA_VERSION = "gotrader-v2-canonical-market-context-v1";
export const V2_CONTEXT_POLICY_VERSION = "gotrader-v2-context-policy-v1";
export const V2_CONTEXT_IDENTITY_VERSION = "gotrader-v2-context-input-identity-v1";
export const V2_CONTEXT_SESSION_CALENDAR_VERSION = "gotrader-v2-shadow-session-calendar-v1";
export const V2_CONTEXT_STRATEGY_TIMEZONE = "America/New_York" as const;
export const V2_CONTEXT_SESSION_FACT_POLICY_VERSION = "gotrader-v2-session-facts-v1";
export const V2_CONTEXT_OPENING_PRICE_FACT_POLICY_VERSION = "gotrader-v2-opening-price-facts-v1";
export const V2_CONTEXT_DEALING_RANGE_FACT_POLICY_VERSION = "gotrader-v2-session-dealing-range-facts-v1";
export const V2_CONTEXT_LIQUIDITY_FACT_POLICY_VERSION = "gotrader-v2-session-liquidity-facts-v1";
export const V2_CONTEXT_DISPLACEMENT_FACT_POLICY_VERSION = "gotrader-v2-displacement-facts-v1";
export const V2_CONTEXT_FAIR_VALUE_GAP_FACT_POLICY_VERSION = "gotrader-v2-fair-value-gap-facts-v1";

export type V2ContextPurpose = "current_live_shadow" | "deterministic_fixture";
export type V2ContextStatus = "eligible" | "degraded" | "blocked";
export type V2ContextFactFamily =
  | "session"
  | "opening_price"
  | "dealing_range"
  | "liquidity"
  | "displacement"
  | "fair_value_gap";
export type V2MarketFactKind =
  | "session"
  | "opening_price"
  | "dealing_range"
  | "liquidity_pool"
  | "liquidity_sweep"
  | "displacement"
  | "fair_value_gap"
  | "higher_timeframe_bias";

export interface V2FactQuality {
  status: "eligible" | "degraded" | "blocked";
  confidenceClass: "exact" | "derived" | "incomplete";
  warnings: readonly string[];
  blockers: readonly string[];
}

export interface V2FactDerivation {
  policyId: string;
  policyVersion: string;
  inputWindowIdentityHashes: readonly string[];
  inputFactIds: readonly string[];
}

export interface V2FactEnvelope<TKind extends V2MarketFactKind, TPayload> {
  factId: string;
  kind: TKind;
  identityRef: string;
  payload: Readonly<TPayload>;
  timeframe: string;
  observedMarketTime: string;
  causalClosedCandleTime: string;
  providerTime?: string;
  receivedAt?: string;
  validFrom: string;
  expiresAt?: string;
  supersedesFactId?: string;
  quality: Readonly<V2FactQuality>;
  derivation: Readonly<V2FactDerivation>;
  authority: Readonly<V2Authority>;
}

export interface V2SessionFactPayload {
  sessionType: string;
  sessionDate: string;
  timezone: typeof V2_CONTEXT_STRATEGY_TIMEZONE;
  startUtc: string;
  endUtc: string;
  openPrice?: number;
  high?: number;
  low?: number;
  close?: number;
  complete: boolean;
  sourceTimeframes: readonly string[];
}

export interface V2OpeningPriceFactPayload {
  openingType: "sunday" | "new_york_midnight" | "new_york_0930" | "daily" | "weekly";
  price?: number;
  boundaryUtc: string;
  derivationQuality: "exact_candle_open" | "first_eligible_after_boundary" | "derived_fallback" | "unavailable";
}

export interface V2DealingRangeFactPayload {
  rangeType: string;
  direction: "bullish" | "bearish" | "neutral";
  low: number;
  high: number;
  midpoint: number;
  equilibrium: number;
  premiumBoundary: number;
  discountBoundary: number;
  anchorStartTime: string;
  anchorEndTime: string;
  anchorFactIds: readonly string[];
  complete: boolean;
}

export interface V2LiquidityPoolFactPayload {
  side: "buy_side" | "sell_side";
  poolType: string;
  price: number;
  formedAt: string;
  confirmedAt: string;
  tolerancePolicy: string;
  state: "active" | "touched" | "swept" | "inactive";
}

export interface V2LiquiditySweepFactPayload {
  liquidityPoolFactId: string;
  side: "buy_side" | "sell_side";
  poolPrice: number;
  extremePrice: number;
  sweepCandleTime: string;
  closedBackInside: boolean;
  displacementFollowThrough?: boolean;
  confirmationState: "wick_through" | "confirmed" | "rejected";
}

export interface V2DisplacementFactPayload {
  direction: "bullish" | "bearish";
  candleTime: string;
  bodySize: number;
  fullRange: number;
  bodyToRangeRatio: number;
  comparisonBaseline: string;
  baselineValue: number;
  displacementMultiple: number;
  closesThroughStructure: boolean;
  leavesFvg: boolean;
  policyId: string;
  policyVersion: string;
}

export interface V2FairValueGapFactPayload {
  direction: "bullish" | "bearish";
  gapType: "fvg" | "ifvg";
  lowerBound: number;
  upperBound: number;
  midpoint: number;
  formedAt: string;
  confirmationCandleTime: string;
  state: "fresh" | "touched" | "partially_filled" | "filled" | "inverted" | "invalidated";
  originalFvgFactId?: string;
  inversionTime?: string;
  policyId: string;
  policyVersion: string;
}

export interface V2HigherTimeframeBiasFactPayload {
  timeframe: string;
  direction: "bullish" | "bearish" | "neutral" | "insufficient_data";
  basis: string;
  supportingFactIds: readonly string[];
  contradictoryFactIds: readonly string[];
  confidenceClass: "high" | "medium" | "low" | "insufficient";
  complete: boolean;
}

export type V2MarketFact =
  | V2FactEnvelope<"session", V2SessionFactPayload>
  | V2FactEnvelope<"opening_price", V2OpeningPriceFactPayload>
  | V2FactEnvelope<"dealing_range", V2DealingRangeFactPayload>
  | V2FactEnvelope<"liquidity_pool", V2LiquidityPoolFactPayload>
  | V2FactEnvelope<"liquidity_sweep", V2LiquiditySweepFactPayload>
  | V2FactEnvelope<"displacement", V2DisplacementFactPayload>
  | V2FactEnvelope<"fair_value_gap", V2FairValueGapFactPayload>
  | V2FactEnvelope<"higher_timeframe_bias", V2HigherTimeframeBiasFactPayload>;

export interface V2ContextWindowIdentityRef {
  timeframe: string;
  identityHash: string;
  sourceFingerprint: string;
  dataWindowStart: string;
  dataWindowEnd: string;
  lastClosedCandle: string;
  candleCount: number;
  offsetRegimeId?: string;
}

export interface V2ContextInputIdentity {
  identityVersion: typeof V2_CONTEXT_IDENTITY_VERSION;
  identityHash: string;
  source: Readonly<V2SourceIdentity>;
  purpose: V2ContextPurpose;
  asOfMarketTime: string;
  requiredTimeframes: readonly string[];
  inputWindows: readonly Readonly<V2ContextWindowIdentityRef>[];
  contextPolicyVersion: string;
  sessionCalendarVersion: string;
  requestedFactFamilies?: readonly V2ContextFactFamily[];
  factPolicyVersions?: readonly string[];
}

export interface V2ContextDiagnostics {
  status: V2ContextStatus;
  missingTimeframes: readonly string[];
  staleWindows: readonly string[];
  preVerificationWindows: readonly string[];
  futureCandleAttempts: number;
  unsupportedPolicyRequests: readonly string[];
  timeContractBlockers: readonly string[];
  warnings: readonly string[];
  blockers: readonly string[];
  comparisonEligible: boolean;
  factEngineStatus:
    | "not_implemented_phase_2a0"
    | "blocked_by_context_eligibility"
    | "session_opening_price_phase_2a3"
    | "range_liquidity_phase_2a4"
    | "displacement_fvg_phase_2a5";
}

export interface V2ContextEligibilityResult extends V2ContextDiagnostics {
  eligibleWindowCount: number;
}

export interface V2ContextBuildRequest {
  source: Readonly<V2SourceIdentity>;
  requestedSymbol: string;
  brokerSymbol: string;
  asOfMarketTime: string;
  requiredTimeframes: readonly string[];
  windows: readonly Readonly<V2CanonicalCandleWindow>[];
  contextPolicyVersion?: string;
  sessionCalendarVersion?: string;
  purpose: V2ContextPurpose;
  requestedFactFamilies?: readonly V2ContextFactFamily[];
  builtAt?: string;
}

export interface V2CanonicalMarketState {
  contextArtifactId: string;
  identity: Readonly<V2ContextInputIdentity>;
  facts: readonly Readonly<V2MarketFact>[];
  diagnostics: Readonly<V2ContextDiagnostics>;
  contextSchemaVersion: typeof V2_CONTEXT_SCHEMA_VERSION;
  contextPolicyVersion: string;
  sessionCalendarVersion: string;
  strategySessionTimezone: typeof V2_CONTEXT_STRATEGY_TIMEZONE;
  builtAt: string;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2CanonicalMarketContextBuilder {
  build(request: V2ContextBuildRequest): Promise<Readonly<V2CanonicalMarketState>>;
}
