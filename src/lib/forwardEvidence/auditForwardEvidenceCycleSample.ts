import { evaluateForwardEvidenceLedger } from "./evaluateForwardEvidenceLedger";
import { ifvgFreshRetestV3FrozenProfile } from "./frozenProfileRegistry";
import {
  FORWARD_EVIDENCE_AUTHORITY,
  type ForwardEvidenceCycleSampleAudit,
  type ForwardEvidenceCycleSampleInput,
  type ForwardEvidenceEntry
} from "./forwardEvidenceTypes";

/**
 * Completed cycle trades are reconstructed from candles already available when
 * the cycle starts. They remain validation evidence and can never be credited
 * as untouched forward outcomes.
 */
export function auditForwardEvidenceCycleSample(
  cycle: ForwardEvidenceCycleSampleInput | undefined,
  entries: ForwardEvidenceEntry[]
): ForwardEvidenceCycleSampleAudit {
  const evaluation = evaluateForwardEvidenceLedger(entries);
  const cycleTradeCount = Math.max(0, Math.floor(cycle?.totalTrades ?? 0));
  const strategyProfile = cycle?.strategyProfile ?? "unavailable";
  const metricSource = cycle?.metricSource ?? "research-cycle backtest";
  const shared = {
    cycleId: cycle?.cycleId,
    strategyProfile,
    cycleTradeCount,
    creditedForwardOutcomes: 0 as const,
    completedForwardOutcomes: evaluation.completedForwardOutcomes,
    pendingForwardOutcomes: evaluation.pendingOutcomes,
    authority: FORWARD_EVIDENCE_AUTHORITY
  };

  if (!cycle?.cycleId) {
    return {
      ...shared,
      classification: "no_cycle_sample",
      reason: "No completed research-cycle sample is available to classify.",
      nextAction: "Keep MT5 read-only refresh active so new closed candles can issue causal IFVG v3 observations."
    };
  }

  if (strategyProfile !== ifvgFreshRetestV3FrozenProfile.profileId) {
    return {
      ...shared,
      classification: "different_profile",
      reason: `Latest cycle used ${strategyProfile}; its simulated trades do not belong to the frozen IFVG v3 forward ledger.`,
      nextAction: "Run IFVG v3 research when needed, but count only setups issued by the live closed-candle tracker."
    };
  }

  return {
    ...shared,
    classification: "validation_only_backtest",
    reason: cycleTradeCount
      ? `${cycleTradeCount} simulated trade${cycleTradeCount === 1 ? " was" : "s were"} produced by ${metricSource} from candles already present when the cycle ran. They remain validation-only and receive zero forward credit.`
      : "The latest IFVG v3 cycle produced no completed simulated trades; it contributes no forward outcomes.",
    nextAction: "Wait for a new eligible IFVG v3 setup on an MT5 closed-candle event, then resolve it only with later closed candles."
  };
}
