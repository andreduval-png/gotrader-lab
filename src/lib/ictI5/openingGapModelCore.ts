import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import { stableIctI5Id, validIctI5Timestamp } from "@/lib/ictI5/ictI5Identity";
import { ICT_I5_TIME_POLICY } from "@/lib/ictI5/openingGapTimePolicy";
import type { IctI5GapOrientation, IctI5GapState, IctI5OpeningGapContext, IctI5OpeningGapInput, IctI5PriceObservation } from "@/lib/ictI5/ictI5Types";

const orientationOf = (prior: number, opening: number): IctI5GapOrientation =>
  opening > prior ? "GAP_UP" : opening < prior ? "GAP_DOWN" : "FLAT_OR_NO_GAP";

const causalObservations = (input: IctI5OpeningGapInput): IctI5PriceObservation[] => {
  const asOf = validIctI5Timestamp(input.asOf, "asOf");
  const validFrom = validIctI5Timestamp(input.gap.validFrom, "gap validFrom");
  return [...(input.observations ?? [])]
    .filter((observation) => {
      const observedAt = validIctI5Timestamp(observation.observedAt, "observation");
      return observedAt >= validFrom && observedAt <= asOf;
    })
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt) || left.observationId.localeCompare(right.observationId));
};

const calendarBlockers = (input: IctI5OpeningGapInput) => {
  const evidence = input.calendarEvidence;
  const blockers: string[] = [];
  if (evidence.calendarStatus !== "VERIFIED") blockers.push("calendar_evidence_not_verified");
  if (evidence.sourceContinuity !== "VERIFIED") blockers.push("source_continuity_not_verified");
  if (!evidence.openingReferenceAvailable) blockers.push("opening_reference_unavailable");
  if (["MAINTENANCE", "PROVIDER_OUTAGE", "UNKNOWN"].includes(evidence.boundaryKind)) blockers.push("boundary_not_eligible_opening_gap");
  if (input.gap.gapType === "NDOG" && !["DAY_ROLLOVER", "HOLIDAY_REOPEN", "EARLY_CLOSE_REOPEN"].includes(evidence.boundaryKind)) blockers.push("ndog_boundary_mismatch");
  if (input.gap.gapType === "NWOG" && !["WEEK_REOPEN", "HOLIDAY_REOPEN", "EARLY_CLOSE_REOPEN"].includes(evidence.boundaryKind)) blockers.push("nwog_boundary_mismatch");
  if (evidence.timeAuthorityId !== input.gap.timeAuthorityId) blockers.push("time_authority_mismatch");
  if (evidence.calendarPolicyId !== input.gap.calendarPolicyId) blockers.push("calendar_policy_mismatch");
  return blockers;
};

const retracementState = (input: IctI5OpeningGapInput, orientation: IctI5GapOrientation): IctI5GapState => {
  if (input.gap.state !== "ACTIVE") return "INVALIDATED";
  if (input.expiresAt && validIctI5Timestamp(input.asOf, "asOf") > validIctI5Timestamp(input.expiresAt, "expiry")) return "EXPIRED";
  if (orientation === "FLAT_OR_NO_GAP") return "INVALIDATED";
  const observations = causalObservations(input);
  if (orientation === "GAP_UP") {
    if (observations.some((item) => item.close < input.gap.gapLow)) return "CROSSED";
    if (observations.some((item) => item.low <= input.gap.gapLow)) return "FULLY_FILLED";
    if (observations.some((item) => item.low <= input.gap.midpoint)) return "MIDPOINT_REACHED";
    if (observations.some((item) => item.low <= input.gap.gapHigh)) return "PARTIALLY_RETRACED";
  } else {
    if (observations.some((item) => item.close > input.gap.gapHigh)) return "CROSSED";
    if (observations.some((item) => item.high >= input.gap.gapHigh)) return "FULLY_FILLED";
    if (observations.some((item) => item.high >= input.gap.midpoint)) return "MIDPOINT_REACHED";
    if (observations.some((item) => item.high >= input.gap.gapLow)) return "PARTIALLY_RETRACED";
  }
  return "UNTOUCHED";
};

export const evaluateOpeningGapContext = (input: IctI5OpeningGapInput): IctI5OpeningGapContext => {
  const asOf = validIctI5Timestamp(input.asOf, "asOf");
  if (validIctI5Timestamp(input.gap.validFrom, "gap validFrom") > asOf) throw new Error("I5 cannot consume an opening-gap fact before validFrom.");
  const orientation = orientationOf(input.gap.priorReferencePrice, input.gap.newOpenPrice);
  const blockers = calendarBlockers(input);
  const lifecycleState = blockers.length > 0 ? "SOURCE_BLOCKED" : retracementState(input, orientation);
  const dayGap = input.gap.gapType === "NDOG";
  const artifactId = dayGap ? "gotrader.ict.i5.ndog-context.v1" : "gotrader.ict.i5.nwog-context.v1";
  return {
    contextId: stableIctI5Id("ict-i5-opening-gap-context", [artifactId, input.gap.gapId, lifecycleState, input.asOf, input.calendarEvidence.evidenceId]),
    artifactId,
    displayName: dayGap ? "ICT New Day Opening Gap Context" : "ICT New Week Opening Gap Context",
    decision: "CONTEXT_ONLY",
    executable: false,
    gapId: input.gap.gapId,
    gapType: input.gap.gapType,
    orientation,
    state: lifecycleState,
    priorReferencePrice: input.gap.priorReferencePrice,
    openingReferencePrice: input.gap.newOpenPrice,
    gapLow: input.gap.gapLow,
    gapHigh: input.gap.gapHigh,
    gapMidpoint: input.gap.midpoint,
    midpointReached: ["MIDPOINT_REACHED", "FULLY_FILLED", "CROSSED"].includes(lifecycleState),
    fullyFilled: ["FULLY_FILLED", "CROSSED"].includes(lifecycleState),
    marketDateOrWeekIdentity: input.gap.marketDateOrWeekIdentity,
    calendarPolicyId: input.gap.calendarPolicyId,
    timeAuthorityId: input.gap.timeAuthorityId,
    boundaryPolicyId: dayGap ? ICT_I5_TIME_POLICY.dayBoundaryPolicyId : ICT_I5_TIME_POLICY.weekBoundaryPolicyId,
    openingReferencePolicyId: ICT_I5_TIME_POLICY.openingReferencePolicyId,
    cePolicyId: "gotrader.ict.i5.arithmetic-gap-midpoint.v1",
    supportingFactIds: [input.gap.factId],
    calendarEvidenceId: input.calendarEvidence.evidenceId,
    blockers: [...blockers, dayGap ? "ndog_trade_semantics_source_incomplete" : "nwog_trade_semantics_source_incomplete"],
    sourceFingerprint: input.sourceFingerprint,
    authority: CANONICAL_ICT_NONE_AUTHORITY,
    researchValidated: false
  };
};
