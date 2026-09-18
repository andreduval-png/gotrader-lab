import type { IctHierarchicalNarrative } from "@/lib/ictI2/ictI2Types";
import type { CanonicalIctAuthority, CanonicalIctFact } from "@/lib/ictCanonical/canonicalIctTypes";
import type { CanonicalPdArrayType } from "@/lib/ictCanonical/canonicalIctTypes";

export type IctI4SliceDecision =
  | "ACCEPTED_RESEARCH_MODEL"
  | "ACCEPTED_EXECUTION_POLICY"
  | "ACCEPTED_FRAMEWORK"
  | "ACCEPTED_WITH_LIMITATIONS"
  | "ALIAS_DO_NOT_REGISTER"
  | "CONCEPT_ONLY"
  | "BLOCKED_SOURCE_SEMANTICS"
  | "BLOCKED_CANONICAL_DEPENDENCY";

export interface IctI4ContextInput {
  facts: readonly CanonicalIctFact[];
  asOf: string;
  sourceFingerprint: string;
  narrative: IctHierarchicalNarrative;
}

export type UnicornPhase =
  | "SEARCHING"
  | "BREAKER_CONFIRMED"
  | "QUALIFYING_FVG_CONFIRMED"
  | "OVERLAP_REGION_ESTABLISHED"
  | "SOURCE_BLOCKED";

export interface UnicornContext {
  contextId: string;
  artifactId: "gotrader.ict.i4.unicorn-context.v1";
  displayName: "ICT Unicorn / Breaker+FVG Context";
  aliases: readonly ["breaker_fvg_model"];
  taxonomy: "COMPOSITE_SETUP";
  decision: "BLOCKED_SOURCE_SEMANTICS";
  executable: false;
  phase: UnicornPhase;
  direction: "bullish" | "bearish" | "unresolved";
  breakerFactId?: string;
  fvgFactId?: string;
  overlap?: readonly [number, number];
  supportingFactIds: readonly string[];
  blockers: readonly string[];
  sourceFingerprint: string;
  authority: CanonicalIctAuthority;
  researchValidated: false;
}

export type OtePolicyPhase =
  | "SEARCHING"
  | "DEALING_RANGE_ESTABLISHED"
  | "DIRECTIONAL_THESIS_ESTABLISHED"
  | "OTE_ZONE_ACTIVE"
  | "WAITING_FOR_RETRACE"
  | "ZONE_REACHED"
  | "RANGE_INVALIDATED";

export interface OtePolicyInput extends IctI4ContextInput {
  direction: "bullish" | "bearish";
  observedPrice?: number;
  observedAt?: string;
}

export interface OteEntryPolicyContext {
  contextId: string;
  artifactId: "gotrader.ict.i4.ote-entry-policy.v1";
  taxonomy: "ENTRY_MODEL";
  decision: "ACCEPTED_EXECUTION_POLICY";
  acceptanceClassification: "OTE_ENTRY_POLICY_ONLY";
  executable: false;
  phase: OtePolicyPhase;
  direction: "bullish" | "bearish";
  dealingRangeId?: string;
  rangeHigh?: number;
  rangeLow?: number;
  oteZoneId?: string;
  proximalPrice?: number;
  distalPrice?: number;
  retracementPolicyId?: string;
  retracementFractions?: readonly [number, number];
  zoneEncountered: boolean;
  supportingFactIds: readonly string[];
  blockers: readonly string[];
  sourceFingerprint: string;
  authority: CanonicalIctAuthority;
  researchValidated: false;
}

export type DeliveryFrameworkPhase =
  | "SEARCHING"
  | "ORIGIN_ESTABLISHED"
  | "TRANSITION_FORMING"
  | "DELIVERY_ACTIVE"
  | "DELIVERY_COMPLETED"
  | "OBJECTIVE_CONSUMED"
  | "INVALIDATED";

export interface IrlErlDeliveryContext {
  contextId: string;
  artifactId: "gotrader.ict.i4.irl-to-erl-framework.v1" | "gotrader.ict.i4.erl-to-irl-framework.v1";
  taxonomy: "CANONICAL_FACT_FRAMEWORK";
  decision: "ACCEPTED_FRAMEWORK";
  executable: false;
  transitionType: "IRL_TO_ERL_DELIVERY" | "ERL_TO_IRL_DELIVERY";
  phase: DeliveryFrameworkPhase;
  direction: "bullish" | "bearish" | "unresolved";
  dealingRangeId?: string;
  originLiquidityId?: string;
  originLiquidityClass?: "INTERNAL" | "EXTERNAL";
  transitionId?: string;
  objectiveLiquidityId?: string;
  objectiveLiquidityClass?: "INTERNAL" | "EXTERNAL";
  supportingFactIds: readonly string[];
  blockers: readonly string[];
  mmxmFrameworkId: "gotrader.ict.i3.mmxm-delivery-framework.v1";
  sourceFingerprint: string;
  authority: CanonicalIctAuthority;
  researchValidated: false;
}

export interface PdArrayExecutionPolicyContext {
  contextId: string;
  artifactId: "gotrader.ict.i4.pd-array-execution-policy.v1";
  taxonomy: "STRATEGY_PROFILE";
  decision: "ACCEPTED_EXECUTION_POLICY";
  executable: false;
  direction: "bullish" | "bearish";
  eligiblePdArrayTypes: readonly CanonicalPdArrayType[];
  selectedPdArrayId?: string;
  selectedPdArrayType?: CanonicalPdArrayType;
  priceRange?: readonly [number, number];
  retraceObserved: boolean;
  supportingFactIds: readonly string[];
  blockers: readonly string[];
  sourceFingerprint: string;
  authority: CanonicalIctAuthority;
  researchValidated: false;
}

export interface IctI4RegistryEntry {
  artifactId: string;
  displayName: string;
  taxonomy: "COMPOSITE_SETUP" | "ENTRY_MODEL" | "CANONICAL_FACT_FRAMEWORK" | "CANONICAL_FACT" | "STRATEGY_PROFILE";
  decision: IctI4SliceDecision;
  executable: false;
  aliases: readonly string[];
  narrativePolicyId: string;
  smtPolicy: "DISABLED" | "OPTIONAL" | "REQUIRED";
  researchValidated: false;
}

export type IctI4Artifact = UnicornContext | OteEntryPolicyContext | IrlErlDeliveryContext | PdArrayExecutionPolicyContext;

export interface IctI4CurrentReadProjection {
  artifactId: string;
  displayName: string;
  classification: "framework" | "entry_policy" | "composite_context" | "execution_policy";
  state: string;
  detail: string;
  supportingFactIds: readonly string[];
  blockers: readonly string[];
  executable: false;
  authority: CanonicalIctAuthority;
  researchValidated: false;
}
