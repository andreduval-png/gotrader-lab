export const TRADE_GEOMETRY_SCHEMA_VERSION = "gotrader.trade-geometry.v1";
export const TRADE_GEOMETRY_VERSION = "g1.1.0";

export type TradeDirection = "LONG" | "SHORT";

export type EntryLifecycleStatus =
  | "WAITING_FOR_ENTRY"
  | "ENTRY_AVAILABLE"
  | "ENTRY_TOUCHED_NOT_FILLED"
  | "ENTRY_FILLED"
  | "ENTRY_MISSED"
  | "ENTRY_EXPIRED";

export type TradeGeometryStatus =
  | "VALID_ACTIONABLE"
  | "VALID_RESEARCH_ONLY"
  | "VALID_BELOW_RR_THRESHOLD"
  | "ENTRY_MISSED"
  | "ENTRY_EXPIRED"
  | "INVALID_ENTRY"
  | "INVALID_STOP"
  | "INVALID_TARGET"
  | "TARGET_TOO_CLOSE"
  | "NO_VALID_TARGET"
  | "TARGET_CONSUMED"
  | "GEOMETRY_DIRECTION_INVALID"
  | "GEOMETRY_POLICY_MISMATCH"
  | "GEOMETRY_PAYLOAD_CONFLICT";

export type CanonicalTargetType =
  | "INTERNAL_LIQUIDITY"
  | "EXTERNAL_LIQUIDITY"
  | "DRAW_ON_LIQUIDITY"
  | "PRIMARY_DRAW_ON_LIQUIDITY"
  | "NEAREST_DIRECTIONAL_LIQUIDITY"
  | "SESSION_HIGH"
  | "SESSION_LOW"
  | "SWING_HIGH"
  | "SWING_LOW"
  | "EQUAL_HIGHS"
  | "EQUAL_LOWS"
  | "RANGE_BOUNDARY"
  | "HOD"
  | "LOD"
  | "OPENING_GAP_OBJECTIVE"
  | "PD_ARRAY_OBJECTIVE";

export interface TradeGeometryAuthority {
  execution: "none";
  broker: "none";
  production: "none";
}

export interface CanonicalEntryIntent {
  model: string;
  intendedPrice: number;
  sourceFactId?: string;
  ownerTimeframe?: string;
  validFrom?: string;
  expiresAt?: string;
  lifecycleStatus: EntryLifecycleStatus;
}

export interface CanonicalStopIntent {
  model: string;
  price: number;
  sourceFactId?: string;
  ownerTimeframe?: string;
  structuralInvalidation: boolean;
  bufferPolicyId?: string;
  bufferPolicyVersion?: string;
}

export interface CanonicalTargetCandidate {
  targetId: string;
  type: CanonicalTargetType;
  direction: TradeDirection;
  price: number;
  sourceFactId?: string;
  ownerTimeframe?: string;
  validFrom?: string;
  freshness?: string;
  consumed: boolean;
  internalExternalClass?: "INTERNAL" | "EXTERNAL";
  structuralAlignment?: string;
  liquidityClass?: string;
}

export interface CanonicalTargetPolicy {
  policyId: string;
  policyVersion: string;
  primaryTargetType: CanonicalTargetType;
  primaryTargetId?: string;
  allowedFallbackTargetTypes: readonly CanonicalTargetType[];
  minimumTargetQuality?: string;
  allowConsumedTargetReuse?: boolean;
}

export interface CanonicalTargetIntent {
  model: string;
  price: number;
  sourceFactId?: string;
  ownerTimeframe?: string;
  targetId: string;
  targetType: CanonicalTargetType;
  liquidityClass?: string;
  selectionRole: "PRIMARY" | "EXPLICIT_FALLBACK";
  policyId: string;
  policyVersion: string;
}

export interface CanonicalTradeGeometry {
  schemaVersion: typeof TRADE_GEOMETRY_SCHEMA_VERSION;
  geometryVersion: typeof TRADE_GEOMETRY_VERSION;
  geometryId: string;
  logicalGeometryKey: string;
  strategyId: string;
  strategyVersion: string;
  profileId?: string;
  profileVersion?: string;
  parameterHash?: string;
  candidateId: string;
  direction: TradeDirection;
  entry: Readonly<CanonicalEntryIntent>;
  stop: Readonly<CanonicalStopIntent>;
  target?: Readonly<CanonicalTargetIntent>;
  targetPolicy: Readonly<CanonicalTargetPolicy>;
  nearestLiquidityId?: string;
  primaryDrawOnLiquidityId?: string;
  riskDistance?: number;
  rewardDistance?: number;
  theoreticalRR?: number;
  minimumRequiredRR?: number;
  geometryValid: boolean;
  actionable: boolean;
  status: TradeGeometryStatus;
  blockers: readonly string[];
  warnings: readonly string[];
  sourceFingerprint: string;
  authority: Readonly<TradeGeometryAuthority>;
}

export interface BuildCanonicalTradeGeometryInput {
  strategyId: string;
  strategyVersion: string;
  profileId?: string;
  profileVersion?: string;
  parameterHash?: string;
  candidateId: string;
  direction: TradeDirection;
  entry: CanonicalEntryIntent;
  stop: CanonicalStopIntent;
  targetCandidates: readonly CanonicalTargetCandidate[];
  targetPolicy: CanonicalTargetPolicy;
  nearestLiquidityId?: string;
  primaryDrawOnLiquidityId?: string;
  minimumRequiredRR?: number;
  sourceFingerprint: string;
  asOf: string;
  researchOnly?: boolean;
}

export interface CanonicalGeometryProjection {
  geometryId: string;
  intendedEntry: number;
  intendedStop: number;
  intendedTarget: number;
  theoreticalRR: number;
  minimumRequiredRR?: number;
  geometryValid: boolean;
  actionable: boolean;
  status: TradeGeometryStatus;
  displayKind: "ACTIONABLE_GEOMETRY" | "RESEARCH_GEOMETRY";
}

