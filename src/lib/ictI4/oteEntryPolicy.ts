import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import type { CanonicalDealingRangeFact, CanonicalOteZoneFact } from "@/lib/ictCanonical/canonicalIctTypes";
import { stableIctI4Id, visibleIctI4Facts } from "@/lib/ictI4/ictI4Identity";
import type { OteEntryPolicyContext, OtePolicyInput, OtePolicyPhase } from "@/lib/ictI4/ictI4Types";

const narrativeSupports = (input: OtePolicyInput) => {
  const expected = input.direction;
  return input.narrative.structural === expected ||
    input.narrative.intermediate === expected ||
    input.narrative.execution === expected;
};

export const evaluateOteEntryPolicy = (input: OtePolicyInput): OteEntryPolicyContext => {
  const facts = visibleIctI4Facts(input.facts, input.asOf);
  const ranges = facts.filter((fact): fact is CanonicalDealingRangeFact => fact.factType === "DEALING_RANGE");
  const range = ranges.slice().reverse().find((candidate) => candidate.state === "ACTIVE");
  const zones = facts.filter((fact): fact is CanonicalOteZoneFact => fact.factType === "OTE_ZONE");
  const zone = zones.slice().reverse().find((candidate) => candidate.dealingRangeId === range?.dealingRangeId && candidate.direction === input.direction && candidate.state === "ACTIVE");
  const expectedLocation = input.direction === "bullish" ? "DISCOUNT" : "PREMIUM";
  const zoneLocationValid = Boolean(zone && range && (
    input.direction === "bullish" ? zone.proximalPrice < range.equilibrium : zone.distalPrice > range.equilibrium
  ));
  const observationVisible = input.observedPrice !== undefined && input.observedAt !== undefined && Date.parse(input.observedAt) <= Date.parse(input.asOf);
  const zoneLow = zone ? Math.min(zone.distalPrice, zone.proximalPrice) : undefined;
  const zoneHigh = zone ? Math.max(zone.distalPrice, zone.proximalPrice) : undefined;
  const zoneEncountered = Boolean(zone && observationVisible && input.observedPrice! >= zoneLow! && input.observedPrice! <= zoneHigh!);
  let phase: OtePolicyPhase = "SEARCHING";
  const blockers: string[] = [];
  if (!range) blockers.push("An active canonical dealing range is missing.");
  else if (range.state === "INVALIDATED") phase = "RANGE_INVALIDATED";
  else if (!narrativeSupports(input)) {
    phase = "DEALING_RANGE_ESTABLISHED";
    blockers.push(`C1/C1.1 does not support the ${input.direction} setup-relative thesis.`);
  } else if (!zone) {
    phase = "DIRECTIONAL_THESIS_ESTABLISHED";
    blockers.push("A same-range, same-direction canonical OTE zone is missing.");
  } else if (!zoneLocationValid) {
    phase = "OTE_ZONE_ACTIVE";
    blockers.push(`OTE zone is not range-relative ${expectedLocation.toLowerCase()} for ${input.direction} policy.`);
  } else if (!zoneEncountered) {
    phase = "WAITING_FOR_RETRACE";
    blockers.push("Price has not causally encountered the canonical OTE zone.");
  } else {
    phase = "ZONE_REACHED";
    blockers.push("OTE is entry-policy context only; confirmation, stop, target, and expiry remain strategy-owned.");
  }
  const supportingFactIds = [range?.factId, zone?.factId].filter((value): value is string => Boolean(value));
  return Object.freeze({
    contextId: stableIctI4Id("ote-policy", [input.sourceFingerprint, input.direction, ...supportingFactIds]),
    artifactId: "gotrader.ict.i4.ote-entry-policy.v1",
    taxonomy: "ENTRY_MODEL",
    decision: "ACCEPTED_EXECUTION_POLICY",
    acceptanceClassification: "OTE_ENTRY_POLICY_ONLY",
    executable: false,
    phase,
    direction: input.direction,
    dealingRangeId: range?.dealingRangeId,
    rangeHigh: range?.highPrice,
    rangeLow: range?.lowPrice,
    oteZoneId: zone?.oteZoneId,
    proximalPrice: zone?.proximalPrice,
    distalPrice: zone?.distalPrice,
    retracementPolicyId: zone?.retracementPolicyId,
    retracementFractions: zone?.retracementFractions,
    zoneEncountered,
    supportingFactIds,
    blockers,
    sourceFingerprint: input.sourceFingerprint,
    authority: CANONICAL_ICT_NONE_AUTHORITY,
    researchValidated: false
  });
};
