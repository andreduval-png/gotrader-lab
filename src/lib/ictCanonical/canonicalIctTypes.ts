import type { Candle, FuturesSymbol, Timeframe } from "@/lib/types";

export type CanonicalIctFactType =
  | "SWING"
  | "EQUAL_LEVEL"
  | "LIQUIDITY"
  | "IRL_ERL_TRANSITION"
  | "DRAW_ON_LIQUIDITY"
  | "FVG"
  | "FVG_TRANSITION"
  | "BPR"
  | "BLOCK"
  | "DISPLACEMENT"
  | "MSS"
  | "DEALING_RANGE"
  | "PD_LOCATION"
  | "OTE_ZONE"
  | "PD_ARRAY"
  | "SESSION_WINDOW"
  | "OPENING_GAP";

export type CanonicalDirection = "bullish" | "bearish" | "neutral";
export type CanonicalFactState = "FORMING" | "ACTIVE" | "COMPLETED" | "CONSUMED" | "INVALIDATED" | "SUPERSEDED";

export interface CanonicalIctAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
  productionAdoptionAllowed: false;
  canCreateEvidence: false;
  canApproveReadiness: false;
  canApplyCalibration: false;
  canCreateTradeIntent: false;
}

export const CANONICAL_ICT_NONE_AUTHORITY: CanonicalIctAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none",
  productionAdoptionAllowed: false,
  canCreateEvidence: false,
  canApproveReadiness: false,
  canApplyCalibration: false,
  canCreateTradeIntent: false
});

export interface CanonicalFactLineage {
  sourceCandleIds: readonly string[];
  sourceFactIds: readonly string[];
  sourceFingerprint: string;
  policyId: string;
  policyVersion: string;
}

export interface CanonicalIctFactBase {
  factId: string;
  factType: CanonicalIctFactType;
  symbol: FuturesSymbol;
  timeframe: Timeframe;
  occurredAt: string;
  confirmedAt: string;
  validFrom: string;
  invalidatedAt?: string;
  state: CanonicalFactState;
  lineage: CanonicalFactLineage;
  authority: CanonicalIctAuthority;
}

export interface CanonicalSwingFact extends CanonicalIctFactBase {
  factType: "SWING";
  swingId: string;
  direction: "high" | "low";
  price: number;
  pivotCandleId: string;
  confirmationCandleId: string;
  legacyStrength?: number;
}

export interface CanonicalEqualLevelFact extends CanonicalIctFactBase {
  factType: "EQUAL_LEVEL";
  equalLevelId: string;
  direction: "highs" | "lows";
  memberSwingIds: readonly [string, string, ...string[]];
  price: number;
  tolerance: number;
  tolerancePolicyId: string;
  liquidityStatus: "AVAILABLE" | "ATTACKED" | "CONSUMED" | "INVALIDATED";
  consumedAt?: string;
}

export type CanonicalLiquidityClass = "INTERNAL" | "EXTERNAL" | "SESSION" | "SWING" | "EQUAL_HIGH_LOW";
export type CanonicalLiquidityStatus = "AVAILABLE" | "ATTACKED" | "CONSUMED" | "INVALIDATED";

export interface CanonicalLiquidityFact extends CanonicalIctFactBase {
  factType: "LIQUIDITY";
  liquidityId: string;
  side: "BUY_SIDE_LIQUIDITY" | "SELL_SIDE_LIQUIDITY";
  liquidityClass: CanonicalLiquidityClass;
  sourceStructureIds: readonly string[];
  ownerTimeframe: Timeframe;
  price: number;
  dealingRangeId?: string;
  status: CanonicalLiquidityStatus;
  consumedAt?: string;
  consumingCandleId?: string;
}

export interface CanonicalIrlErlTransitionFact extends CanonicalIctFactBase {
  factType: "IRL_ERL_TRANSITION";
  transitionId: string;
  transitionType: "IRL_TO_ERL_DELIVERY" | "ERL_TO_IRL_DELIVERY";
  direction: Exclude<CanonicalDirection, "neutral">;
  fromLiquidityId: string;
  toLiquidityId: string;
  dealingRangeId: string;
  startedAt: string;
  currentState: "FORMING" | "ACTIVE" | "COMPLETED" | "INVALIDATED";
}

export interface CanonicalDrawOnLiquidityFact extends CanonicalIctFactBase {
  factType: "DRAW_ON_LIQUIDITY";
  drawId: string;
  direction: Exclude<CanonicalDirection, "neutral">;
  targetLiquidityId: string;
  targetClass: CanonicalLiquidityClass;
  ownerTimeframe: Timeframe;
  distance: number;
  structuralRelevance: number;
  available: boolean;
  consumed: boolean;
  selectionPolicyVersion: string;
  nearestLiquidityId?: string;
}

export interface CanonicalFvgFact extends CanonicalIctFactBase {
  factType: "FVG";
  fvgId: string;
  direction: Exclude<CanonicalDirection, "neutral">;
  proximalPrice: number;
  distalPrice: number;
  midpoint: number;
  originCandleIds: readonly [string, string, string];
  fvgState: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "INVALIDATED";
  filledPercentage: number;
  stateChangedAt?: string;
}

export interface CanonicalBprFact extends CanonicalIctFactBase {
  factType: "BPR";
  bprId: string;
  bullishFvgId: string;
  bearishFvgId: string;
  overlapLow: number;
  overlapHigh: number;
}

export interface CanonicalFvgTransitionFact extends CanonicalIctFactBase {
  factType: "FVG_TRANSITION";
  transitionId: string;
  transitionType: "INVERTED";
  originFvgId: string;
  direction: Exclude<CanonicalDirection, "neutral">;
  transitionCandleId: string;
  proximalPrice: number;
  distalPrice: number;
}

export type CanonicalBlockType = "ORDER_BLOCK" | "BREAKER_BLOCK" | "MITIGATION_BLOCK";

export interface CanonicalBlockFact extends CanonicalIctFactBase {
  factType: "BLOCK";
  blockId: string;
  blockType: CanonicalBlockType;
  direction: Exclude<CanonicalDirection, "neutral">;
  originCandleIds: readonly string[];
  proximalPrice: number;
  distalPrice: number;
  midpoint: number;
  originBlockId?: string;
  structureFailureId?: string;
  conversionEventId?: string;
  unresolvedRelationships?: readonly string[];
}

export interface CanonicalDisplacementFact extends CanonicalIctFactBase {
  factType: "DISPLACEMENT";
  displacementId: string;
  direction: Exclude<CanonicalDirection, "neutral">;
  startCandleId: string;
  endCandleId: string;
  bodySize: number;
  baselineBodySize: number;
  bodyMultiple: number;
  measurementPolicyId: string;
}

export interface CanonicalMssFact extends CanonicalIctFactBase {
  factType: "MSS";
  mssId: string;
  direction: Exclude<CanonicalDirection, "neutral">;
  brokenStructureId: string;
  breakCandleId: string;
  displacementId?: string;
  breakPrice: number;
}

export interface CanonicalDealingRangeFact extends CanonicalIctFactBase {
  factType: "DEALING_RANGE";
  dealingRangeId: string;
  highSwingId: string;
  lowSwingId: string;
  highPrice: number;
  lowPrice: number;
  equilibrium: number;
  context: "bullish_range" | "bearish_range" | "balanced_range";
}

export interface CanonicalPdLocationFact extends CanonicalIctFactBase {
  factType: "PD_LOCATION";
  pdLocationId: string;
  dealingRangeId: string;
  price: number;
  location: "PREMIUM" | "EQUILIBRIUM" | "DISCOUNT";
  equilibriumBandFraction: number;
}

export interface CanonicalOteZoneFact extends CanonicalIctFactBase {
  factType: "OTE_ZONE";
  oteZoneId: string;
  dealingRangeId: string;
  direction: Exclude<CanonicalDirection, "neutral">;
  proximalPrice: number;
  distalPrice: number;
  retracementPolicyId: string;
  retracementFractions: readonly [number, number];
}

export type CanonicalPdArrayType =
  | "FVG"
  | "IFVG"
  | "BPR"
  | "ORDER_BLOCK"
  | "BREAKER_BLOCK"
  | "MITIGATION_BLOCK"
  | "OTE_ZONE";

export interface CanonicalPdArrayFact extends CanonicalIctFactBase {
  factType: "PD_ARRAY";
  pdArrayId: string;
  pdArrayType: CanonicalPdArrayType;
  direction: CanonicalDirection;
  priceRange: readonly [number, number];
  sourceFactId: string;
}

export interface CanonicalSessionWindowFact extends CanonicalIctFactBase {
  factType: "SESSION_WINDOW";
  sessionWindowId: string;
  sessionType: "SESSION" | "KILLZONE" | "MACRO";
  name: string;
  timezone: "America/New_York";
  startMinute: number;
  endMinute: number;
  scheduleVersion: string;
  dstPolicy: "IANA_TIME_ZONE";
  resolutionStatus: "RESOLVED" | "UNRESOLVED";
}

export interface CanonicalOpeningGapFact extends CanonicalIctFactBase {
  factType: "OPENING_GAP";
  gapId: string;
  gapType: "NDOG" | "NWOG";
  priorReferencePrice: number;
  newOpenPrice: number;
  gapLow: number;
  gapHigh: number;
  midpoint: number;
  marketDateOrWeekIdentity: string;
  calendarPolicyId: string;
  timeAuthorityId: string;
}

export type CanonicalIctFact =
  | CanonicalSwingFact
  | CanonicalEqualLevelFact
  | CanonicalLiquidityFact
  | CanonicalIrlErlTransitionFact
  | CanonicalDrawOnLiquidityFact
  | CanonicalFvgFact
  | CanonicalFvgTransitionFact
  | CanonicalBprFact
  | CanonicalBlockFact
  | CanonicalDisplacementFact
  | CanonicalMssFact
  | CanonicalDealingRangeFact
  | CanonicalPdLocationFact
  | CanonicalOteZoneFact
  | CanonicalPdArrayFact
  | CanonicalSessionWindowFact
  | CanonicalOpeningGapFact;

export interface CanonicalFactBuildInput {
  candles: readonly Candle[];
  asOf: string;
  symbol?: FuturesSymbol;
  timeframe?: Timeframe;
  sourceFingerprint?: string;
}
