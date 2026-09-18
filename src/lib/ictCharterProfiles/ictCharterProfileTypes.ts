import type { CurrentOpportunity, CurrentOpportunityAuthority } from "@/lib/currentOpportunity/currentOpportunityTypes";

export type CharterModelNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type CharterProfileClassification =
  | "owner_profile"
  | "framework_only"
  | "source_blocked";

export type CharterProfileRuntimeStatus =
  | "owner_candidate_active"
  | "owner_candidate_unavailable"
  | "framework_only"
  | "source_blocked";

export interface CharterProfileDefinition {
  charterModelNumber: CharterModelNumber;
  charterIdentityId: string;
  charterProfileId: string;
  label: string;
  classification: CharterProfileClassification;
  ownerStrategyId?: string;
  ownerFrameworkId?: string;
  reason: string;
  researchValidated: false;
}

export interface CharterCandidateAttribution {
  charterModelNumber: CharterModelNumber;
  charterIdentityId: string;
  charterProfileId: string;
  ownerStrategyId: CurrentOpportunity["strategyId"];
  ownerCandidateId: string;
  attributionMode: "owner_candidate_metadata";
  researchValidated: false;
  productionAdoptionAllowed: false;
  authority: CurrentOpportunityAuthority;
}
export interface CharterProfileRuntimeItem {
  charterModelNumber: CharterModelNumber;
  charterIdentityId: string;
  charterProfileId: string;
  label: string;
  classification: CharterProfileClassification;
  runtimeStatus: CharterProfileRuntimeStatus;
  ownerStrategyId?: string;
  ownerFrameworkId?: string;
  ownerCandidateId?: string;
  detail: string;
  blocker?: string;
  candidateCapability: "owner_attribution_only" | "none";
  geometryCapability: "owner_native_only" | "none";
  executableStrategyAdded: false;
  emitsGeometry: false;
  researchValidated: false;
  productionAdoptionAllowed: false;
  authority: CurrentOpportunityAuthority;
}

export interface CharterProfileRuntimeSnapshot {
  version: "gotrader.ict-charter-profile-runtime.v1";
  generatedAt: string;
  sourceFingerprint?: string;
  profiles: readonly CharterProfileRuntimeItem[];
  ownerAttributionCount: number;
  executableStrategiesAdded: 0;
  geometryProduced: 0;
  researchValidated: false;
  productionAdoptionAllowed: false;
  authority: CurrentOpportunityAuthority;
}
