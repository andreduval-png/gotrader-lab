import { CANONICAL_ICT_NONE_AUTHORITY, type CanonicalBlockFact, type CanonicalOpeningGapFact } from "@/lib/ictCanonical";
import {
  evaluateIrlErlDeliveryFramework,
  evaluateOteEntryPolicy,
  evaluatePdArrayExecutionPolicy,
  evaluateUnicornContext,
  projectIctI4CurrentRead
} from "@/lib/ictI4";
import {
  evaluateNdogContext,
  evaluateNwogContexts,
  evaluateTgifContext,
  projectIctI5CurrentRead,
  type IctI5CalendarEvidence
} from "@/lib/ictI5";
import type { IctRuntimeContextInput, IctRuntimeContextItem, IctRuntimeContextSnapshot } from "@/lib/ictContextRuntime/ictContextRuntimeTypes";

const runtimeStatus = (state: string): IctRuntimeContextItem["runtimeStatus"] => {
  if (/SOURCE_BLOCKED/.test(state)) return "source_blocked";
  if (/CONSUMED|COMPLETED|FILLED|CROSSED/.test(state)) return "consumed";
  if (/INVALIDATED|EXPIRED/.test(state)) return "invalidated";
  if (/ACTIVE|REACHED|ESTABLISHED|RETRACE_OBSERVED|UNTOUCHED|PARTIALLY_RETRACED|MIDPOINT_REACHED/.test(state)) return "active";
  if (/FORMING/.test(state)) return "forming";
  return "waiting";
};

const sourceBlock = (artifactId: string) => {
  if (artifactId.includes("unicorn")) return {
    sourceBlockCode: "UNICORN_BLOCKED_SOURCE_SEMANTICS",
    sourceBlockReason: "Unicorn has no source-complete entry, stop, target, or expiry contract.",
    missingSemanticFields: ["entry", "stop", "target", "expiry"] as const
  };
  if (artifactId.includes("tgif")) return {
    sourceBlockCode: "TGIF_BLOCKED_SOURCE_SEMANTICS",
    sourceBlockReason: "TGIF setup, session, lifecycle, and trade geometry remain source-unresolved.",
    missingSemanticFields: ["session_window", "weekly_context", "entry", "invalidation", "stop", "target", "expiry"] as const
  };
  return {};
};

const i4Item = (artifact: ReturnType<typeof evaluateUnicornContext> | ReturnType<typeof evaluateOteEntryPolicy> | ReturnType<typeof evaluateIrlErlDeliveryFramework> | ReturnType<typeof evaluatePdArrayExecutionPolicy>): IctRuntimeContextItem => {
  const projection = projectIctI4CurrentRead(artifact);
  const classification = projection.classification === "framework" ? "delivery_framework" : projection.classification;
  const blocked = artifact.decision === "BLOCKED_SOURCE_SEMANTICS";
  return {
    contextId: artifact.contextId,
    artifactId: artifact.artifactId,
    displayName: projection.displayName,
    classification,
    runtimeStatus: runtimeStatus(projection.state),
    state: projection.state,
    detail: projection.detail,
    canonicalDependencies: artifact.artifactId.includes("unicorn")
      ? ["BREAKER_BLOCK", "FVG"]
      : artifact.artifactId.includes("ote")
        ? ["DEALING_RANGE", "OTE_ZONE"]
        : artifact.artifactId.includes("framework")
          ? ["IRL_ERL_TRANSITION", "LIQUIDITY", "DEALING_RANGE"]
          : ["PD_ARRAY"],
    supportingFactIds: projection.supportingFactIds,
    geometryCapability: "none",
    candidateCapability: "none",
    sourceStatus: blocked ? "blocked_source_semantics" : artifact.artifactId.includes("framework") ? "accepted_framework" : "accepted_policy",
    ...sourceBlock(artifact.artifactId),
    executable: false,
    researchValidated: false,
    authority: artifact.authority
  };
};

const i5Item = (artifact: ReturnType<typeof evaluateNdogContext> | ReturnType<typeof evaluateTgifContext>): IctRuntimeContextItem => {
  const projection = projectIctI5CurrentRead(artifact);
  const blocked = artifact.artifactId.includes("tgif") || projection.state === "SOURCE_BLOCKED";
  return {
    contextId: artifact.contextId,
    artifactId: artifact.artifactId,
    displayName: projection.displayName,
    classification: projection.classification,
    runtimeStatus: runtimeStatus(projection.state),
    state: projection.state,
    detail: projection.detail,
    canonicalDependencies: artifact.artifactId.includes("tgif") ? ["SESSION_WINDOW", "OPENING_GAP"] : ["OPENING_GAP", "SESSION/TIME"],
    supportingFactIds: projection.supportingFactIds,
    geometryCapability: "none",
    candidateCapability: "none",
    sourceStatus: blocked ? "blocked_source_semantics" : "accepted_context",
    ...(artifact.artifactId.includes("tgif") ? sourceBlock(artifact.artifactId) : {}),
    ...(projection.state === "SOURCE_BLOCKED" && !artifact.artifactId.includes("tgif") ? {
      sourceBlockCode: "OPENING_GAP_EVIDENCE_UNAVAILABLE",
      sourceBlockReason: "Calendar, continuity, or opening-reference evidence is incomplete.",
      missingSemanticFields: ["verified_calendar", "verified_continuity", "opening_reference"]
    } : {}),
    executable: false,
    researchValidated: false,
    authority: artifact.authority
  };
};

const factItem = (blockType: "BREAKER_BLOCK" | "MITIGATION_BLOCK", facts: readonly CanonicalBlockFact[], sourceFingerprint: string): IctRuntimeContextItem => {
  const fact = facts.filter((candidate) => candidate.blockType === blockType).at(-1);
  const label = blockType === "BREAKER_BLOCK" ? "Canonical Breaker Block" : "Canonical Mitigation Block";
  return {
    contextId: `gotrader.ict.i4.${blockType.toLowerCase()}.${fact?.factId ?? sourceFingerprint}`,
    artifactId: blockType === "BREAKER_BLOCK" ? "gotrader.ict.i4.breaker-fact.v1" : "gotrader.ict.i4.mitigation-fact.v1",
    displayName: label,
    classification: "canonical_fact_context",
    runtimeStatus: fact ? "active" : "waiting",
    state: fact ? fact.state : "NOT_PRESENT",
    detail: `${label} remains canonical fact context only.`,
    canonicalDependencies: [blockType],
    supportingFactIds: fact ? [fact.factId] : [],
    geometryCapability: "none",
    candidateCapability: "none",
    sourceStatus: "accepted_context",
    executable: false,
    researchValidated: false,
    authority: CANONICAL_ICT_NONE_AUTHORITY
  };
};

const unavailableGapEvidence = (gap: CanonicalOpeningGapFact): IctI5CalendarEvidence => ({
  evidenceId: `unavailable:${gap.gapId}`,
  boundaryKind: "UNKNOWN",
  calendarStatus: "UNVERIFIED",
  sourceContinuity: "UNVERIFIED",
  openingReferenceAvailable: false,
  holidayStatus: "UNKNOWN",
  calendarPolicyId: gap.calendarPolicyId,
  timeAuthorityId: gap.timeAuthorityId
});

export const buildIctRuntimeContextSnapshot = (input: IctRuntimeContextInput): IctRuntimeContextSnapshot => {
  const shared = { facts: input.facts, asOf: input.asOf, sourceFingerprint: input.sourceFingerprint, narrative: input.narrative };
  const direction = input.narrative.structural === "bearish" ? "bearish" : "bullish";
  const i4Artifacts = [
    evaluateUnicornContext(shared),
    evaluateOteEntryPolicy({ ...shared, direction, observedPrice: input.observedPrice, observedAt: input.observedAt }),
    evaluateIrlErlDeliveryFramework(shared, "IRL_TO_ERL_DELIVERY"),
    evaluateIrlErlDeliveryFramework(shared, "ERL_TO_IRL_DELIVERY"),
    evaluatePdArrayExecutionPolicy({ ...shared, direction, observedPrice: input.observedPrice, observedAt: input.observedAt })
  ];
  const blocks = input.facts.filter((fact): fact is CanonicalBlockFact => fact.factType === "BLOCK");
  const gaps = input.facts.filter((fact): fact is CanonicalOpeningGapFact => fact.factType === "OPENING_GAP" && Date.parse(fact.validFrom) <= Date.parse(input.asOf));
  const ndog = gaps.filter((gap) => gap.gapType === "NDOG").map((gap) => evaluateNdogContext({
    gap,
    asOf: input.asOf,
    sourceFingerprint: input.sourceFingerprint,
    calendarEvidence: input.openingGapEvidence?.[gap.gapId] ?? unavailableGapEvidence(gap),
    observations: input.openingGapObservations?.[gap.gapId]
  }));
  const nwog = evaluateNwogContexts(gaps.filter((gap) => gap.gapType === "NWOG").map((gap) => ({
    gap,
    asOf: input.asOf,
    sourceFingerprint: input.sourceFingerprint,
    calendarEvidence: input.openingGapEvidence?.[gap.gapId] ?? unavailableGapEvidence(gap),
    observations: input.openingGapObservations?.[gap.gapId]
  })));
  const items = [
    ...i4Artifacts.map(i4Item),
    factItem("BREAKER_BLOCK", blocks, input.sourceFingerprint),
    factItem("MITIGATION_BLOCK", blocks, input.sourceFingerprint),
    ...ndog.map(i5Item),
    ...nwog.map(i5Item),
    i5Item(evaluateTgifContext({ asOf: input.asOf, sourceFingerprint: input.sourceFingerprint }))
  ];
  return {
    version: "gotrader.ict-context-runtime.v1",
    generatedAt: input.asOf,
    sourceFingerprint: input.sourceFingerprint,
    items,
    counts: {
      executableStrategiesAdded: 0,
      frameworks: items.filter((item) => item.classification === "delivery_framework").length,
      contexts: items.filter((item) => ["composite_context", "canonical_fact_context", "opening_gap_context"].includes(item.classification)).length,
      policies: items.filter((item) => ["entry_policy", "execution_policy"].includes(item.classification)).length,
      sourceBlocked: items.filter((item) => item.sourceStatus === "blocked_source_semantics").length
    },
    candidateCount: 0,
    executionAllowed: false,
    researchValidated: false,
    authority: CANONICAL_ICT_NONE_AUTHORITY
  };
};

export const assertIctRuntimeContextSnapshot = (snapshot: IctRuntimeContextSnapshot) => {
  const serialized = JSON.stringify(snapshot);
  if (/"(entry|stop|target|riskReward|canonicalGeometry|proposedGeometry)"\s*:/i.test(serialized)) {
    throw new Error("INT-3C context snapshot crossed the trade-geometry boundary.");
  }
  if (snapshot.candidateCount !== 0 || snapshot.counts.executableStrategiesAdded !== 0 || snapshot.items.some((item) => item.executable)) {
    throw new Error("INT-3C context snapshot cannot create executable candidates.");
  }
  return { ok: true as const, serializedBytes: serialized.length };
};
