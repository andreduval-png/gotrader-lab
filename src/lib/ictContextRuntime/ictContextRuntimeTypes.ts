import type { CanonicalIctAuthority, CanonicalIctFact } from "@/lib/ictCanonical";
import type { IctHierarchicalNarrative } from "@/lib/ictI2";
import type { IctI5CalendarEvidence, IctI5PriceObservation } from "@/lib/ictI5";

export type IctRuntimeContextClassification =
  | "composite_context"
  | "entry_policy"
  | "delivery_framework"
  | "canonical_fact_context"
  | "execution_policy"
  | "opening_gap_context"
  | "source_blocked_context";

export interface IctRuntimeContextItem {
  contextId: string;
  artifactId: string;
  displayName: string;
  classification: IctRuntimeContextClassification;
  runtimeStatus: "active" | "forming" | "waiting" | "consumed" | "invalidated" | "source_blocked";
  state: string;
  detail: string;
  canonicalDependencies: readonly string[];
  supportingFactIds: readonly string[];
  geometryCapability: "none";
  candidateCapability: "none";
  sourceStatus: "accepted_context" | "accepted_framework" | "accepted_policy" | "blocked_source_semantics";
  sourceBlockCode?: string;
  sourceBlockReason?: string;
  missingSemanticFields?: readonly string[];
  executable: false;
  researchValidated: false;
  authority: CanonicalIctAuthority;
}

export interface IctRuntimeContextSnapshot {
  version: "gotrader.ict-context-runtime.v1";
  generatedAt: string;
  sourceFingerprint: string;
  items: readonly IctRuntimeContextItem[];
  counts: {
    executableStrategiesAdded: 0;
    frameworks: number;
    contexts: number;
    policies: number;
    sourceBlocked: number;
  };
  candidateCount: 0;
  executionAllowed: false;
  researchValidated: false;
  authority: CanonicalIctAuthority;
}

export interface IctRuntimeContextInput {
  facts: readonly CanonicalIctFact[];
  asOf: string;
  sourceFingerprint: string;
  narrative: IctHierarchicalNarrative;
  observedPrice?: number;
  observedAt?: string;
  openingGapEvidence?: Readonly<Record<string, IctI5CalendarEvidence | undefined>>;
  openingGapObservations?: Readonly<Record<string, readonly IctI5PriceObservation[] | undefined>>;
}
