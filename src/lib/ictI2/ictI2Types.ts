import type { CanonicalIctAuthority, CanonicalIctFact } from "@/lib/ictCanonical";
import type { StrategyGeometryIntent, CanonicalTradeGeometry } from "@/lib/tradeGeometry";
import type { Candle, FuturesSymbol, Timeframe } from "@/lib/types";

export type IctCoreStrategyId = "ict_2022_model_v1" | "ict_power_of_three_v1" | "ict_judas_swing_v1";
export type IctCoreStrategyRole = "PRIMARY_EXECUTABLE_RESEARCH" | "PRIMARY_STATE_MODEL" | "SOURCE_BLOCKED_CONTEXT";
export type IctRoleDirection = "bullish" | "bearish" | "neutral" | "unavailable";

export interface IctHierarchicalNarrative {
  structural: IctRoleDirection;
  intermediate: IctRoleDirection;
  execution: IctRoleDirection;
  liquidityPath: "buyside" | "sellside" | "balanced" | "unavailable";
  structuralTimeframe: Timeframe;
  intermediateTimeframe: Timeframe;
  executionTimeframe: Timeframe;
  policyId: "gotrader.ict.c1-1.hierarchical-roles.v1";
  policyVersion: "1.0.0";
}

export interface IctCoreDetectionInput {
  facts: readonly CanonicalIctFact[];
  candlesByTimeframe: Readonly<Partial<Record<Timeframe, readonly Candle[]>>>;
  asOf: string;
  sourceFingerprint: string;
  narrative: IctHierarchicalNarrative;
  symbol: FuturesSymbol;
  timeframe: Timeframe;
}

export interface IctCoreStateTransition<State extends string> {
  sequence: number;
  from: State | null;
  to: State;
  validFrom: string;
  supportingFactIds: readonly string[];
  reason: string;
}

export interface IctCoreStrategyCandidate<State extends string = string> {
  candidateId: string;
  strategyId: IctCoreStrategyId;
  strategyVersion: string;
  profileId: string;
  role: IctCoreStrategyRole;
  symbol: FuturesSymbol;
  timeframe: Timeframe;
  direction: "long" | "short" | "none";
  state: State;
  geometryEligible: boolean;
  actionable: boolean;
  geometryIntent?: StrategyGeometryIntent;
  canonicalGeometry?: CanonicalTradeGeometry;
  supportingFactIds: readonly string[];
  blockers: readonly string[];
  transitions: readonly IctCoreStateTransition<State>[];
  contextIdentity: string;
  sourceFingerprint: string;
  marketTimestamp: string;
  researchValidated: false;
  authority: CanonicalIctAuthority;
}

export interface IctCoreCandidateCollection {
  version: "gotrader.ict-core-candidates.v1";
  generatedAt: string;
  sourceFingerprint: string;
  candidates: readonly IctCoreStrategyCandidate[];
  conflict: "NONE" | "CONFLICTING_CANONICAL_SETUPS";
  researchValidated: false;
  authority: CanonicalIctAuthority;
}

