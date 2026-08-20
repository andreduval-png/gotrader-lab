import type { Candle, FuturesSymbol, Timeframe } from "@/lib/types";
import type { CanonicalIctAuthority, CanonicalIctFact, CanonicalIctFactType } from "@/lib/ictCanonical/canonicalIctTypes";

export type CanonicalIctModelClassification = "research_only" | "diagnostic_only" | "confluence_only";
export type CanonicalIctSmtPolicy = "disabled" | "optional" | "required" | "opposing_smt_blocks";

export interface CanonicalIctParameterDefinition {
  name: string;
  classification: "SOURCE_DEFINED" | "CANONICAL_GOTRADER_RULE" | "RESEARCH_PARAMETER" | "UNRESOLVED";
  unit?: string;
  defaultValue?: unknown;
  minimum?: number;
  maximum?: number;
  allowedValues?: readonly unknown[];
}

export interface CanonicalIctParameterSchema {
  parameterSchemaId: string;
  version: string;
  parameters: readonly CanonicalIctParameterDefinition[];
}

export interface CanonicalIctGeometryIntent {
  entry: number | readonly [number, number];
  stop: number;
  target: number;
  expiresAt: string;
}

export interface CanonicalIctStrategyCandidate {
  candidateId: string;
  strategyId: string;
  strategyVersion: string;
  profileId: string;
  parameterFingerprint: string;
  sourceFingerprint: string;
  symbol: FuturesSymbol;
  timeframe: Timeframe;
  marketTimestamp: string;
  direction: "long" | "short";
  geometry: CanonicalIctGeometryIntent;
  requiredFactIds: readonly string[];
  blockers: readonly string[];
  authority: CanonicalIctAuthority;
}

export interface CanonicalIctDetectionInput {
  candlesByTimeframe: Readonly<Partial<Record<Timeframe, readonly Candle[]>>>;
  facts: readonly CanonicalIctFact[];
  asOf: string;
  sourceFingerprint: string;
  parameterFingerprint: string;
}

export interface CanonicalIctModel {
  strategyId: string;
  strategyVersion: string;
  classification: CanonicalIctModelClassification;
  requiredTimeframes: readonly Timeframe[];
  preferredTimeframes: readonly Timeframe[];
  optionalTimeframes: readonly Timeframe[];
  requiredFactTypes: readonly CanonicalIctFactType[];
  factDependencyIds: readonly string[];
  narrativePolicyId?: string;
  smtPolicy: CanonicalIctSmtPolicy;
  parameterSchema: CanonicalIctParameterSchema;
  authority: CanonicalIctAuthority;
  detect(input: CanonicalIctDetectionInput): readonly CanonicalIctStrategyCandidate[];
}

export const assertCanonicalModelContract = (model: CanonicalIctModel) => {
  if (!model.strategyId || !model.strategyVersion || !model.parameterSchema.parameterSchemaId) {
    throw new Error("Canonical ICT model identity is incomplete.");
  }
  if (
    model.authority.executionAuthority !== "none" ||
    model.authority.brokerAuthority !== "none" ||
    model.authority.readinessOverrideAuthority !== "none"
  ) {
    throw new Error("Canonical ICT models must preserve none/none/none authority.");
  }
  return model;
};
