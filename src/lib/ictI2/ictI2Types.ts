import type { CanonicalIctAuthority, CanonicalIctFact } from "@/lib/ictCanonical/canonicalIctTypes";
import type { CanonicalIctGeometryIntent } from "@/lib/ictCanonical/canonicalIctModelContract";
import type { FuturesSymbol, Timeframe } from "@/lib/types";

export type IctI2RuleClassification =
  | "SOURCE_DEFINED"
  | "CANONICAL_GOTRADER_RULE"
  | "RESEARCH_PARAMETER"
  | "UNRESOLVED";

export interface IctI2SourceRule {
  ruleId: string;
  classification: IctI2RuleClassification;
  behavior: string;
  material: boolean;
  resolution: string;
}

export interface IctI2SourcePacket {
  packetId: string;
  strategyId: string;
  version: string;
  status: "RESOLVED_FOR_RESEARCH" | "BLOCKED_SOURCE_SEMANTICS";
  rules: readonly IctI2SourceRule[];
}

export type IctI2NarrativeDirection = "bullish" | "bearish" | "neutral" | "mixed" | "unavailable";

export interface IctI2NarrativeContext {
  structuralBias: IctI2NarrativeDirection;
  currentFlowDirection: IctI2NarrativeDirection;
  setupMaturationDirection: IctI2NarrativeDirection;
  retracementState: "forming" | "confirmed" | "not_present" | "unavailable";
  continuationState: "forming" | "confirmed" | "not_present" | "unavailable";
  liquidityPath: "buyside" | "sellside" | "balanced" | "unavailable";
  policyId: string;
  policyVersion: string;
}

export interface IctI2DatasetIdentity {
  datasetCertificateId: string;
  datasetId: string;
  datasetChecksum: string;
}

export interface IctI2DetectionInput {
  facts: readonly CanonicalIctFact[];
  candlesByTimeframe: Readonly<Partial<Record<Timeframe, readonly import("@/lib/types").Candle[]>>>;
  asOf: string;
  sourceFingerprint: string;
  narrative: IctI2NarrativeContext;
  parameterFingerprint: string;
  dataset?: IctI2DatasetIdentity;
}

export interface IctI2StateTransition<State extends string> {
  sequence: number;
  from: State | null;
  to: State;
  occurredAt: string;
  validFrom: string;
  supportingFactIds: readonly string[];
  reason: string;
}

export interface IctI2ModelCandidate<State extends string> {
  candidateId: string;
  strategyId: string;
  strategyVersion: string;
  profileId: string;
  parameterHash: string;
  sourceFingerprint: string;
  datasetCertificateId?: string;
  symbol?: FuturesSymbol;
  timeframe?: Timeframe;
  marketTimestamp: string;
  direction: "long" | "short" | "none";
  state: State;
  triggerCandleId?: string;
  supportingFactIds: readonly string[];
  transitions: readonly IctI2StateTransition<State>[];
  geometry?: CanonicalIctGeometryIntent;
  blockers: readonly string[];
  authority: CanonicalIctAuthority;
  researchValidated: false;
}

export interface IctI2CurrentReadProjection {
  strategyId: string;
  state: string;
  headline: string;
  detail: string;
  blockers: readonly string[];
  authority: CanonicalIctAuthority;
}

export interface IctI2RegistryEntry {
  strategyId: string;
  strategyVersion: string;
  displayName: string;
  registrationStatus: "ACTIVE_RESEARCH" | "SOURCE_BLOCKED" | "LEGACY_PLACEHOLDER";
  supersedes?: string;
  supersededBy?: string;
  sourcePacketId: string;
}
