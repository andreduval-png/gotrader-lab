import {
  FORWARD_EVIDENCE_AUTHORITY,
  type ForwardEvidenceEntry,
  type ForwardEvidenceFailureCauseSummary,
  type ForwardEvidenceQualityAttribution,
  type ForwardEvidenceSession,
  type ForwardEvidenceSessionLane,
  type ForwardEvidenceSessionLaneStatus
} from "./forwardEvidenceTypes";

const completedOutcomes = new Set<ForwardEvidenceEntry["outcome"]>([
  "target_first",
  "invalidation_first",
  "partial",
  "stalled",
  "expired"
]);

const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const average = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
};
const unique = <T>(values: T[]) => Array.from(new Set(values));

const maxDrawdown = (values: number[]) => {
  if (!values.length) return null;
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
  }
  return round(drawdown);
};

const profitFactor = (values: number[]) => {
  const gains = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const losses = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  if (!values.length) return null;
  if (losses === 0) return gains > 0 ? 99 : null;
  return round(gains / losses);
};

const causeLabels: Record<string, string> = {
  session_window_mismatch: "Session-window mismatch",
  counter_htf_delivery: "Counter-HTF delivery",
  missing_htf_context: "HTF context unavailable",
  stale_retest: "Stale retest",
  weak_displacement: "Displacement confirmation missing",
  missing_external_liquidity_target: "External liquidity target missing",
  unattributed_model_loss: "Unattributed model loss"
};

const failureCauseFor = (entry: ForwardEvidenceEntry) => {
  const context = entry.qualityContext;
  if (context?.preferredSession === false) {
    return { code: "session_window_mismatch", direct: true, evidence: "The observation was outside the preferred IFVG session." };
  }
  if (context?.htfAlignment === "against_htf") {
    return { code: "counter_htf_delivery", direct: true, evidence: "The observation was recorded against higher-timeframe delivery." };
  }
  if (context?.htfAlignment === "unavailable") {
    return { code: "missing_htf_context", direct: true, evidence: "Higher-timeframe alignment was unavailable when the observation was issued." };
  }
  if (context?.freshRetest === false || (context?.signalAgeBars ?? 0) > 0) {
    return { code: "stale_retest", direct: true, evidence: "The compact observation context records a stale retest." };
  }
  if (context?.displacementConfirmed === false) {
    return { code: "weak_displacement", direct: true, evidence: "Displacement confirmation was absent at observation time." };
  }
  if (context?.liquidityTargetPresent === false) {
    return { code: "missing_external_liquidity_target", direct: true, evidence: "No external liquidity target was present at observation time." };
  }
  return {
    code: "unattributed_model_loss",
    direct: false,
    evidence: "No recorded pre-entry quality defect explains this invalidation; preserve it as a model loss."
  };
};

const failureCausesFor = (entries: ForwardEvidenceEntry[]): ForwardEvidenceFailureCauseSummary[] => {
  const rows = new Map<string, {
    direct: boolean;
    evidence: string;
    entries: ForwardEvidenceEntry[];
  }>();
  for (const entry of entries.filter((item) => item.outcome === "invalidation_first")) {
    const cause = failureCauseFor(entry);
    const row = rows.get(cause.code) ?? { direct: cause.direct, evidence: cause.evidence, entries: [] };
    row.entries.push(entry);
    rows.set(cause.code, row);
  }
  return [...rows.entries()]
    .map(([causeCode, row]) => ({
      causeCode,
      label: causeLabels[causeCode] ?? causeCode.replace(/_/g, " "),
      invalidationCount: row.entries.length,
      totalLostR: round(Math.abs(row.entries.reduce((sum, entry) => sum + Math.min(0, entry.realizedR ?? 0), 0))),
      sessions: unique(row.entries.map((entry) => entry.qualityContext?.session ?? "Unknown" as ForwardEvidenceSession)),
      sides: unique(row.entries.map((entry) => entry.direction)),
      contextAssociated: row.direct,
      evidence: row.evidence
    }))
    .sort((left, right) => right.totalLostR - left.totalLostR || right.invalidationCount - left.invalidationCount);
};

const laneStatusFor = (
  completed: number,
  uniqueDates: number,
  windows: number,
  averageR: number | null,
  costAdjustedAverageR025: number | null,
  costAdjustedAverageR05: number | null,
  drawdown: number | null
): ForwardEvidenceSessionLaneStatus => {
  if (
    completed >= 20 && uniqueDates >= 10 && windows >= 2 &&
    (averageR ?? 0) > 0 && (costAdjustedAverageR05 ?? 0) > 0 && (drawdown ?? 99) <= 4
  ) return "stable_research";
  if (
    completed >= 8 && uniqueDates >= 5 && windows >= 1 &&
    (averageR ?? 0) > 0 && (costAdjustedAverageR025 ?? 0) > 0
  ) return "promising_small_sample";
  if (completed >= 5 && ((averageR ?? 0) <= 0 || (costAdjustedAverageR05 ?? 0) <= 0 || (drawdown ?? 0) > 6)) {
    return "weak";
  }
  return "insufficient_data";
};

const laneFor = (
  session: ForwardEvidenceSession,
  side: "all" | "long" | "short",
  entries: ForwardEvidenceEntry[]
): ForwardEvidenceSessionLane => {
  const values = entries.map((entry) => entry.realizedR ?? 0);
  const targetFirst = entries.filter((entry) => entry.outcome === "target_first").length;
  const invalidationFirst = entries.filter((entry) => entry.outcome === "invalidation_first").length;
  const resolved = targetFirst + invalidationFirst;
  const uniqueDates = unique(entries.map((entry) => entry.independentDate)).length;
  const activeWindows = unique(entries.map((entry) => entry.forwardWindowId)).length;
  const averageR = average(values);
  const costAdjustedAverageR025 = average(values.map((value) => value - 0.25));
  const costAdjustedAverageR05 = average(values.map((value) => value - 0.5));
  const drawdown = maxDrawdown(values);
  const status = laneStatusFor(
    entries.length,
    uniqueDates,
    activeWindows,
    averageR,
    costAdjustedAverageR025,
    costAdjustedAverageR05,
    drawdown
  );
  const blockers = [
    entries.length < 20 ? `needs_${20 - entries.length}_more_completed_outcomes` : undefined,
    uniqueDates < 10 ? `needs_${10 - uniqueDates}_more_independent_dates` : undefined,
    activeWindows < 2 ? `needs_${2 - activeWindows}_more_forward_windows` : undefined,
    (costAdjustedAverageR05 ?? 0) <= 0 ? "half_r_cost_stress_not_positive" : undefined,
    (drawdown ?? 0) > 4 ? "drawdown_above_4r" : undefined
  ].filter((item): item is string => Boolean(item));
  return {
    laneId: `${session.replace(/\s+/g, "_").toLowerCase()}_${side}`,
    session,
    side,
    completedOutcomes: entries.length,
    targetFirst,
    invalidationFirst,
    expiredOrStalled: entries.length - targetFirst - invalidationFirst,
    uniqueDates,
    activeWindows,
    targetFirstRate: resolved ? round(targetFirst / resolved) : null,
    averageR: averageR === null ? null : round(averageR),
    medianR: median(values),
    profitFactor: profitFactor(values),
    maxDrawdownR: drawdown,
    costAdjustedAverageR025: costAdjustedAverageR025 === null ? null : round(costAdjustedAverageR025),
    costAdjustedAverageR05: costAdjustedAverageR05 === null ? null : round(costAdjustedAverageR05),
    status,
    blockers
  };
};

const sessionLanesFor = (entries: ForwardEvidenceEntry[]) => {
  const sessions = unique(entries.map((entry) => entry.qualityContext?.session ?? "Unknown" as ForwardEvidenceSession));
  return sessions.flatMap((session) => {
    const scoped = entries.filter((entry) => (entry.qualityContext?.session ?? "Unknown") === session);
    return [
      laneFor(session, "all", scoped),
      ...(["long", "short"] as const)
        .map((side) => laneFor(session, side, scoped.filter((entry) => entry.direction === side)))
        .filter((lane) => lane.completedOutcomes > 0)
    ];
  });
};

export const analyzeForwardEvidenceQuality = (
  entries: ForwardEvidenceEntry[]
): ForwardEvidenceQualityAttribution => {
  const completed = entries.filter((entry) => completedOutcomes.has(entry.outcome));
  const invalidations = completed.filter((entry) => entry.outcome === "invalidation_first");
  const failureCauses = failureCausesFor(completed);
  const attributed = failureCauses
    .filter((cause) => cause.contextAssociated)
    .reduce((sum, cause) => sum + cause.invalidationCount, 0);
  const sessionLanes = sessionLanesFor(completed);
  const ranked = sessionLanes
    .filter((lane) => lane.side === "all" && lane.completedOutcomes > 0)
    .sort((left, right) =>
      (right.costAdjustedAverageR05 ?? -99) - (left.costAdjustedAverageR05 ?? -99) ||
      right.completedOutcomes - left.completedOutcomes
    );
  const topCause = failureCauses.find((cause) => cause.contextAssociated) ?? failureCauses[0];
  const coverage = invalidations.length ? attributed / invalidations.length : 1;
  const nextAction = completed.length < 40
    ? `Collect ${40 - completed.length} more causal post-freeze outcomes before reassessment.`
    : invalidations.length && coverage < 0.9
      ? "Improve compact pre-entry context until at least 90% of forward invalidations are context-associated; do not infer causality or tune the frozen profile."
      : ranked[0]?.status === "stable_research"
        ? `Reassess ${ranked[0].session} independently against the unchanged frozen profile and existing readiness gates.`
        : "Keep collecting independent session outcomes; no session lane is mature enough for reassessment.";
  return {
    basis: "causal_post_freeze_completed_outcomes",
    completedOutcomes: completed.length,
    invalidationCount: invalidations.length,
    attributedInvalidationCount: attributed,
    unattributedInvalidationCount: Math.max(0, invalidations.length - attributed),
    attributionCoverage: round(coverage),
    failureCauses,
    sessionLanes,
    strongestSessionLane: ranked[0],
    weakestSessionLane: ranked.at(-1),
    nextAction,
    authority: FORWARD_EVIDENCE_AUTHORITY,
    safety: {
      rawCandlesExcluded: true,
      fullTradeRecordsExcluded: true,
      accountOrderPositionDataExcluded: true,
      profileMutationAllowed: false,
      readinessPromotionAllowed: false
    }
  };
};
