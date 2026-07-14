import {
  FORWARD_EVIDENCE_AUTHORITY,
  type ForwardEvidenceEntry,
  type ForwardEvidenceLedgerEvaluation,
  type ForwardEvidenceRecommendation
} from "./forwardEvidenceTypes";
import { ifvgFreshRetestV3FrozenProfile } from "./frozenProfileRegistry";

export const FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS = Object.freeze({
  completedOutcomes: 40,
  independentDates: 20,
  forwardWindows: 2
});

const completedOutcomes = new Set<ForwardEvidenceEntry["outcome"]>([
  "target_first",
  "invalidation_first",
  "partial",
  "stalled",
  "expired"
]);

const rounded = (value: number, digits = 4) => Number(value.toFixed(digits));

const maxDrawdownR = (values: number[]) => {
  if (!values.length) return null;
  let equity = 0;
  let peak = 0;
  let drawdown = 0;
  for (const value of values) {
    equity += value;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
  }
  return rounded(drawdown);
};

export const evaluateForwardEvidenceLedger = (
  entries: ForwardEvidenceEntry[]
): ForwardEvidenceLedgerEvaluation => {
  const frozen = ifvgFreshRetestV3FrozenProfile;
  const forwardEntries = entries
    .filter(
      (entry) =>
        entry.profileId === frozen.profileId &&
        entry.profileVersion === frozen.profileVersion &&
        Date.parse(entry.setupTimestamp) > Date.parse(frozen.validationCutoff)
    )
    .sort((left, right) => Date.parse(left.setupTimestamp) - Date.parse(right.setupTimestamp));
  const completed = forwardEntries.filter((entry) => completedOutcomes.has(entry.outcome));
  const pending = forwardEntries.filter((entry) => entry.outcome === "pending");
  const rejected = forwardEntries.filter((entry) => entry.outcome === "rejected");
  const independentDates = new Set(completed.map((entry) => entry.independentDate)).size;
  const forwardWindows = new Set(completed.map((entry) => entry.forwardWindowId).filter(Boolean)).size;
  const realized = completed
    .map((entry) => entry.realizedR)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const grossProfit = realized.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(realized.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const blockers: string[] = [];

  if (completed.length < FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.completedOutcomes) {
    blockers.push(
      `Collect ${FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.completedOutcomes - completed.length} more completed forward outcomes.`
    );
  }
  if (independentDates < FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.independentDates) {
    blockers.push(
      `Collect evidence on ${FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.independentDates - independentDates} more independent dates.`
    );
  }
  if (forwardWindows < FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.forwardWindows) {
    blockers.push(
      `Complete ${FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.forwardWindows - forwardWindows} more independent forward window${FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.forwardWindows - forwardWindows === 1 ? "" : "s"}.`
    );
  }

  const reassessmentEligible = blockers.length === 0;
  const averageR = realized.length ? rounded(realized.reduce((sum, value) => sum + value, 0) / realized.length) : null;
  const profitFactor = grossLoss > 0 ? rounded(grossProfit / grossLoss) : null;
  let recommendation: ForwardEvidenceRecommendation = "keep_collecting";

  if (reassessmentEligible) {
    if ((averageR ?? 0) <= 0 && (profitFactor ?? 0) < 0.8) {
      recommendation = "retire_profile";
    } else if ((averageR ?? 0) > 0 && (profitFactor ?? 0) > 1 && completed.filter((entry) => entry.outcome === "target_first").length / completed.length >= 0.45) {
      recommendation = "reassess_for_paper_demo";
    } else {
      recommendation = "fork_new_profile";
    }
  }

  return {
    profileId: frozen.profileId,
    profileVersion: frozen.profileVersion,
    cutoff: frozen.validationCutoff,
    totalForwardOutcomes: forwardEntries.length,
    completedForwardOutcomes: completed.length,
    pendingOutcomes: pending.length,
    rejectedOutcomes: rejected.length,
    independentDates,
    forwardWindows,
    targetFirstRate: completed.length
      ? rounded(completed.filter((entry) => entry.outcome === "target_first").length / completed.length)
      : null,
    invalidationFirstRate: completed.length
      ? rounded(completed.filter((entry) => entry.outcome === "invalidation_first").length / completed.length)
      : null,
    averageR,
    profitFactor,
    maxDrawdownR: maxDrawdownR(realized),
    reassessmentEligible,
    blockers,
    recommendation,
    autoPromotionAllowed: false,
    authority: FORWARD_EVIDENCE_AUTHORITY
  };
};
