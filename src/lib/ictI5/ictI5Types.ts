import type { CanonicalIctAuthority, CanonicalOpeningGapFact } from "@/lib/ictCanonical/canonicalIctTypes";

export type IctI5SliceDecision =
  | "ACCEPTED_RESEARCH_MODEL"
  | "ACCEPTED_FRAMEWORK"
  | "ACCEPTED_ENTRY_POLICY"
  | "ACCEPTED_WITH_LIMITATIONS"
  | "CONTEXT_ONLY"
  | "PROFILE_OF_EXISTING_MODEL"
  | "ALIAS_DO_NOT_REGISTER"
  | "BLOCKED_SOURCE_SEMANTICS"
  | "BLOCKED_TIME_OR_CALENDAR_SEMANTICS";

export type IctI5BoundaryKind =
  | "DAY_ROLLOVER"
  | "WEEK_REOPEN"
  | "HOLIDAY_REOPEN"
  | "EARLY_CLOSE_REOPEN"
  | "MAINTENANCE"
  | "PROVIDER_OUTAGE"
  | "UNKNOWN";

export interface IctI5CalendarEvidence {
  evidenceId: string;
  boundaryKind: IctI5BoundaryKind;
  calendarStatus: "VERIFIED" | "UNVERIFIED" | "INVALID";
  sourceContinuity: "VERIFIED" | "UNVERIFIED" | "FAILED";
  openingReferenceAvailable: boolean;
  holidayStatus: "REGULAR" | "FULL_CLOSURE" | "EARLY_CLOSE" | "DELAYED_REOPEN" | "UNKNOWN";
  calendarPolicyId: string;
  timeAuthorityId: string;
}

export interface IctI5PriceObservation {
  observationId: string;
  observedAt: string;
  high: number;
  low: number;
  close: number;
}

export type IctI5GapOrientation = "GAP_UP" | "GAP_DOWN" | "FLAT_OR_NO_GAP";
export type IctI5GapState =
  | "UNTOUCHED"
  | "PARTIALLY_RETRACED"
  | "MIDPOINT_REACHED"
  | "FULLY_FILLED"
  | "CROSSED"
  | "INVALIDATED"
  | "EXPIRED"
  | "SOURCE_BLOCKED";

export interface IctI5OpeningGapInput {
  gap: CanonicalOpeningGapFact;
  asOf: string;
  sourceFingerprint: string;
  calendarEvidence: IctI5CalendarEvidence;
  observations?: readonly IctI5PriceObservation[];
  expiresAt?: string;
}

export interface IctI5OpeningGapContext {
  contextId: string;
  artifactId: "gotrader.ict.i5.ndog-context.v1" | "gotrader.ict.i5.nwog-context.v1";
  displayName: "ICT New Day Opening Gap Context" | "ICT New Week Opening Gap Context";
  decision: "CONTEXT_ONLY";
  executable: false;
  gapId: string;
  gapType: "NDOG" | "NWOG";
  orientation: IctI5GapOrientation;
  state: IctI5GapState;
  priorReferencePrice: number;
  openingReferencePrice: number;
  gapLow: number;
  gapHigh: number;
  gapMidpoint: number;
  midpointReached: boolean;
  fullyFilled: boolean;
  marketDateOrWeekIdentity: string;
  calendarPolicyId: string;
  timeAuthorityId: string;
  boundaryPolicyId: "I5_DAY_BOUNDARY_SOURCE_UNRESOLVED" | "I5_WEEK_BOUNDARY_SOURCE_UNRESOLVED";
  openingReferencePolicyId: "I5_OPENING_REFERENCE_SOURCE_UNRESOLVED";
  cePolicyId: "gotrader.ict.i5.arithmetic-gap-midpoint.v1";
  supportingFactIds: readonly string[];
  calendarEvidenceId: string;
  blockers: readonly string[];
  sourceFingerprint: string;
  authority: CanonicalIctAuthority;
  researchValidated: false;
}

export interface IctI5TgifContext {
  contextId: string;
  artifactId: "gotrader.ict.i5.tgif-context.v1";
  displayName: "ICT TGIF / Friday Model Context";
  decision: "BLOCKED_SOURCE_SEMANTICS";
  executable: false;
  state: "SOURCE_BLOCKED";
  blockers: readonly string[];
  supportingFactIds: readonly string[];
  sourceFingerprint: string;
  authority: CanonicalIctAuthority;
  researchValidated: false;
}

export type IctI5Artifact = IctI5OpeningGapContext | IctI5TgifContext;

export interface IctI5RegistryEntry {
  artifactId: IctI5Artifact["artifactId"];
  displayName: string;
  decision: IctI5SliceDecision;
  executable: false;
  aliases: readonly string[];
  narrativePolicyId: string;
  smtPolicy: "DISABLED" | "OPTIONAL" | "REQUIRED";
  researchValidated: false;
}
