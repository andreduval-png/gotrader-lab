export type PaperDemoStrategyFamily = "agent_consensus" | "ifvg" | "cmd";

export interface FrozenStrategyEvidenceInput {
  completedTrades: number;
  oosTrades: number;
  passedOosWindows: number;
  totalOosWindows: number;
  monteCarloRobustness: string;
}

export interface StrategyProfileEvidenceInput {
  strategyProfile?: string;
  currentCycleTrades: number;
  validationMatched: boolean;
  frozenEvidence?: FrozenStrategyEvidenceInput;
  frozenSourceMatches: boolean;
  grinchProfilePresent: boolean;
  grinchBlocked: boolean;
  grinchBlocker?: string;
  grinchDetail?: string;
}

export interface StrategyProfileEvidenceResult {
  family: PaperDemoStrategyFamily;
  label: string;
  status: "pass" | "warning" | "fail";
  currentValue: string;
  requiredValue: string;
  blockerReason: string;
  nextAction: string;
}

export const strategyFamilyForProfile = (strategyProfile?: string): PaperDemoStrategyFamily =>
  strategyProfile?.startsWith("ifvg_")
    ? "ifvg"
    : strategyProfile?.startsWith("cmd_")
      ? "cmd"
      : "agent_consensus";

export function resolveProfileTradeSample(input: {
  currentCycleTrades: number;
  frozenEvidenceTrades?: number;
  frozenSourceMatches: boolean;
}) {
  const frozenTrades = input.frozenSourceMatches ? input.frozenEvidenceTrades ?? 0 : 0;
  const count = Math.max(input.currentCycleTrades, frozenTrades);
  return {
    count,
    currentCycleTrades: input.currentCycleTrades,
    frozenTrades,
    source: frozenTrades > input.currentCycleTrades ? "exact_profile_historical_validation" : "latest_cycle"
  } as const;
}

export function resolveStrategyProfileEvidence(
  input: StrategyProfileEvidenceInput
): StrategyProfileEvidenceResult {
  const family = strategyFamilyForProfile(input.strategyProfile);

  if (family === "ifvg") {
    const evidence = input.frozenSourceMatches ? input.frozenEvidence : undefined;
    const frozenPass = Boolean(
      evidence &&
        evidence.completedTrades >= 30 &&
        evidence.oosTrades >= 20 &&
        evidence.passedOosWindows >= 2 &&
        evidence.monteCarloRobustness === "strong"
    );
    const runtimePass = !evidence && input.validationMatched && input.currentCycleTrades >= 30;
    const pass = frozenPass || runtimePass;
    const warning = !pass && (Boolean(evidence) || input.currentCycleTrades > 0);

    return {
      family,
      label: "IFVG detector profile evidence sufficient",
      status: pass ? "pass" : warning ? "warning" : "fail",
      currentValue: evidence
        ? `${input.strategyProfile}; ${evidence.completedTrades} historical trades; ${evidence.oosTrades} OOS; ${evidence.passedOosWindows}/${evidence.totalOosWindows} OOS windows; Monte Carlo ${evidence.monteCarloRobustness}`
        : `${input.strategyProfile ?? "none"}; ${input.currentCycleTrades} current-cycle trades; validation ${input.validationMatched ? "matched" : "not matched"}`,
      requiredValue:
        "IFVG-native detector evidence, >= 30 profile trades, >= 20 OOS trades, >= 2 passed OOS windows, strong Monte Carlo, matching source identity",
      blockerReason: pass
        ? "IFVG-native historical detector evidence clears the profile-evidence gate. Forward and readiness gates remain independent."
        : "IFVG detector evidence is missing, too shallow, or does not match the active profile/source identity.",
      nextAction: pass
        ? "Keep the frozen IFVG profile unchanged and collect untouched forward evidence."
        : "Run detector-specific IFVG validation and walk-forward using the exact active profile and canonical source."
    };
  }

  if (family === "cmd") {
    return {
      family,
      label: "CMD detector profile evidence sufficient",
      status: input.validationMatched && input.currentCycleTrades > 0 ? "warning" : "fail",
      currentValue: `${input.strategyProfile ?? "none"}; ${input.currentCycleTrades} current-cycle trades; validation ${input.validationMatched ? "matched" : "not matched"}`,
      requiredValue: "CMD independent-date gate passed with matching validation and OOS provenance",
      blockerReason: "CMD remains research-only until independent-date and rolling-window validation pass.",
      nextAction: "Run independent-date CMD validation over the frozen historical window."
    };
  }

  const pass = input.grinchProfilePresent && !input.grinchBlocked;
  return {
    family,
    label: "Grinch/ICT profile evidence sufficient",
    status: pass ? "pass" : input.grinchProfilePresent ? "warning" : "fail",
    currentValue: `${input.strategyProfile ?? "agent_consensus"}; blocker ${input.grinchBlocker ?? "none"}`,
    requiredValue: "valid ICT foundation plus Grinch refinement profile, no hard gate blocker",
    blockerReason: pass
      ? "Full-stack ICT/Grinch evidence is present."
      : "Grinch refinement evidence is not sufficient for candidate review.",
    nextAction: pass
      ? "Keep profile diagnostics attached."
      : input.grinchDetail ?? "Wait for a cleaner Grinch profile or run diagnostic-only calibration."
  };
}
