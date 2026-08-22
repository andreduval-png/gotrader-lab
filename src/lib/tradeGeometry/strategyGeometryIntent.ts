import type {
  CanonicalEntryIntent,
  CanonicalStopIntent,
  CanonicalTargetCandidate,
  TradeDirection
} from "@/lib/tradeGeometry/tradeGeometryTypes";

export type GeometryRuleClassification =
  | "SOURCE_DEFINED"
  | "CANONICAL_GOTRADER_RULE"
  | "RESEARCH_PARAMETER"
  | "LEGACY_COMPATIBILITY"
  | "SOURCE_CONFLICT"
  | "UNRESOLVED";

export interface StrategyGeometryPolicyIdentity {
  geometryPolicyId: string;
  geometryPolicyVersion: string;
  entryPolicyId: string;
  stopPolicyId: string;
  targetPolicyId: string;
  targetPrecedencePolicyId?: string;
}

export interface CompleteStrategyGeometryIntent extends StrategyGeometryPolicyIdentity {
  status: "COMPLETE";
  strategyId: string;
  strategyVersion: string;
  profileId?: string;
  profileVersion?: string;
  direction: TradeDirection;
  entry: CanonicalEntryIntent;
  stop: CanonicalStopIntent;
  primaryTarget: CanonicalTargetCandidate;
  intermediateTargets: readonly CanonicalTargetCandidate[];
  fallbackPolicyId?: string;
  supportingFactIds: readonly string[];
  sourceFingerprint: string;
}

export interface IncompleteStrategyGeometryIntent extends StrategyGeometryPolicyIdentity {
  status: "SOURCE_BLOCKED" | "INCOMPLETE";
  strategyId: string;
  strategyVersion: string;
  profileId?: string;
  profileVersion?: string;
  direction?: TradeDirection;
  unresolvedRules: readonly string[];
  supportingFactIds: readonly string[];
  sourceFingerprint?: string;
}

export type StrategyGeometryIntent = CompleteStrategyGeometryIntent | IncompleteStrategyGeometryIntent;

