import type { CalibrationProposalChanges } from "@/lib/selfImprovement";

export const AUTONOMOUS_CALIBRATION_AUTO_APPLY_STORAGE_KEY =
  "gotrader.autonomous-calibration-auto-apply.v1";
export const AUTONOMOUS_CALIBRATION_APPLY_NOT_ENABLED =
  "autonomous_calibration_apply_not_enabled";

const CONSENT_SCHEMA_VERSION = 1 as const;
const FROZEN_IFVG_V3_PROFILE = "ifvg_fresh_retest_v3_research";

export const AUTONOMOUS_CALIBRATION_ALLOWED_FIELDS = Object.freeze([
  "confluenceThreshold",
  "confidenceThreshold",
  "sessionFilter",
  "stopModel",
  "targetRMultiple",
  "allowLong",
  "allowShort",
  "ictScoringWeights",
  "agentWeights"
] as const);

const ALLOWED_ICT_WEIGHT_FIELDS = new Set([
  "bullishMSS",
  "bearishMSS",
  "bullishBOS",
  "bearishBOS",
  "liquiditySweep",
  "fvgAlignment",
  "premiumDiscountAlignment",
  "sessionKillZone",
  "latestSwingStructure",
  "riskRewardQuality"
]);

export interface AutonomousCalibrationAutoApplyPreference {
  schemaVersion: typeof CONSENT_SCHEMA_VERSION;
  enabled: boolean;
  confirmedAt?: string;
  source: "operator_ui" | "default_fail_closed" | "legacy_state_rejected";
}

export interface AutonomousCalibrationPermissionSummary {
  proposalGenerationAllowed: true;
  proposalScoringAllowed: true;
  dryRunValidationAllowed: true;
  calibrationApplyAllowed: boolean;
  blocker?: typeof AUTONOMOUS_CALIBRATION_APPLY_NOT_ENABLED;
}

export interface AutonomousCalibrationFinalApplyGuardInput {
  preference: AutonomousCalibrationAutoApplyPreference;
  runOptInEnabled: unknown;
  eligibilityPolicyEnabled: unknown;
  eligibilityApproved: boolean;
  cancellationRequested?: boolean;
  proposalStale?: boolean;
  proposalId?: string;
  eligibilityProposalId?: string;
  persistedProposalFound: boolean;
  persistedProposalMatches: boolean;
  proposalStatus?: string;
  proposedChanges: CalibrationProposalChanges | Record<string, unknown>;
  allowedAgentWeightFields?: string[];
  baseProfileId?: string;
  targetProfileId?: string;
  executionAuthority?: string;
  brokerAuthority?: string;
  readinessOverrideAuthority?: string;
}

export interface AutonomousCalibrationFinalApplyGuardResult {
  allowed: boolean;
  blockerCodes: string[];
  details: string[];
}

const disabledPreference = (
  source: AutonomousCalibrationAutoApplyPreference["source"] = "default_fail_closed"
): AutonomousCalibrationAutoApplyPreference => ({
  schemaVersion: CONSENT_SCHEMA_VERSION,
  enabled: false,
  source
});

const isBrowser = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function loadAutonomousCalibrationAutoApplyPreference(): AutonomousCalibrationAutoApplyPreference {
  if (!isBrowser()) {
    return disabledPreference();
  }

  const raw = window.localStorage.getItem(AUTONOMOUS_CALIBRATION_AUTO_APPLY_STORAGE_KEY);
  if (!raw) {
    return disabledPreference();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AutonomousCalibrationAutoApplyPreference>;
    if (
      parsed.schemaVersion !== CONSENT_SCHEMA_VERSION ||
      parsed.enabled !== true ||
      parsed.source !== "operator_ui" ||
      typeof parsed.confirmedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.confirmedAt))
    ) {
      return disabledPreference("legacy_state_rejected");
    }
    return {
      schemaVersion: CONSENT_SCHEMA_VERSION,
      enabled: true,
      confirmedAt: parsed.confirmedAt,
      source: "operator_ui"
    };
  } catch {
    return disabledPreference("legacy_state_rejected");
  }
}

export function saveAutonomousCalibrationAutoApplyPreference(
  enabled: boolean
): AutonomousCalibrationAutoApplyPreference {
  const preference: AutonomousCalibrationAutoApplyPreference = enabled
    ? {
        schemaVersion: CONSENT_SCHEMA_VERSION,
        enabled: true,
        confirmedAt: new Date().toISOString(),
        source: "operator_ui"
      }
    : disabledPreference();

  if (isBrowser()) {
    window.localStorage.setItem(
      AUTONOMOUS_CALIBRATION_AUTO_APPLY_STORAGE_KEY,
      JSON.stringify(preference)
    );
  }
  return preference;
}

export function summarizeAutonomousCalibrationPermissions(
  enabled: unknown
): AutonomousCalibrationPermissionSummary {
  const calibrationApplyAllowed = enabled === true;
  return {
    proposalGenerationAllowed: true,
    proposalScoringAllowed: true,
    dryRunValidationAllowed: true,
    calibrationApplyAllowed,
    blocker: calibrationApplyAllowed
      ? undefined
      : AUTONOMOUS_CALIBRATION_APPLY_NOT_ENABLED
  };
}

const patchBlockers = (
  changes: CalibrationProposalChanges | Record<string, unknown>,
  allowedAgentWeightFields: string[]
) => {
  const blockerCodes: string[] = [];
  const details: string[] = [];
  const allowedFields = new Set<string>(AUTONOMOUS_CALIBRATION_ALLOWED_FIELDS);
  const proposedFields = Object.keys(changes);
  const disallowedFields = proposedFields.filter((field) => !allowedFields.has(field));

  if (!proposedFields.length) {
    blockerCodes.push("autonomous_calibration_patch_empty");
    details.push("The proposal contains no allowlisted research calibration changes.");
  }
  if (disallowedFields.length) {
    blockerCodes.push("autonomous_calibration_fields_not_allowlisted");
    details.push(`Non-allowlisted calibration fields: ${disallowedFields.join(", ")}.`);
  }

  const agentWeights = (changes as CalibrationProposalChanges).agentWeights;
  if (agentWeights) {
    const allowedAgents = new Set(allowedAgentWeightFields);
    const invalidAgentFields = Object.keys(agentWeights).filter((field) => !allowedAgents.has(field));
    if (invalidAgentFields.length) {
      blockerCodes.push("autonomous_calibration_agent_fields_not_allowlisted");
      details.push(`Non-allowlisted agent weight fields: ${invalidAgentFields.join(", ")}.`);
    }
  }

  const ictWeights = (changes as CalibrationProposalChanges).ictScoringWeights;
  if (ictWeights) {
    const invalidIctFields = Object.keys(ictWeights).filter(
      (field) => !ALLOWED_ICT_WEIGHT_FIELDS.has(field)
    );
    if (invalidIctFields.length) {
      blockerCodes.push("autonomous_calibration_ict_fields_not_allowlisted");
      details.push(`Non-allowlisted ICT scoring fields: ${invalidIctFields.join(", ")}.`);
    }
  }

  return { blockerCodes, details };
};

export function validateAutonomousCalibrationFinalApply(
  input: AutonomousCalibrationFinalApplyGuardInput
): AutonomousCalibrationFinalApplyGuardResult {
  const blockerCodes: string[] = [];
  const details: string[] = [];

  if (
    !input.preference.enabled ||
    input.preference.source !== "operator_ui" ||
    input.runOptInEnabled !== true ||
    input.eligibilityPolicyEnabled !== true
  ) {
    blockerCodes.push(AUTONOMOUS_CALIBRATION_APPLY_NOT_ENABLED);
    details.push(
      "Research calibration auto-apply requires current, versioned operator opt-in at the final apply boundary."
    );
  }
  if (!input.eligibilityApproved) {
    blockerCodes.push("autonomous_calibration_eligibility_not_approved");
    details.push("Dry-run eligibility did not approve this proposal for apply.");
  }
  if (input.cancellationRequested) {
    blockerCodes.push("autonomous_calibration_apply_canceled");
    details.push("The autonomous run was canceled before calibration apply.");
  }
  if (
    input.proposalStale ||
    !input.persistedProposalFound ||
    !input.persistedProposalMatches ||
    !input.proposalId ||
    input.proposalId !== input.eligibilityProposalId
  ) {
    blockerCodes.push("autonomous_calibration_apply_stale");
    details.push("The proposal or its persisted state changed after dry-run evaluation.");
  }
  if (input.proposalStatus !== "proposed" && input.proposalStatus !== "testing") {
    blockerCodes.push("autonomous_calibration_proposal_not_active");
    details.push(`Proposal status ${input.proposalStatus ?? "missing"} cannot be applied.`);
  }
  if (
    input.executionAuthority !== "none" ||
    input.brokerAuthority !== "none" ||
    input.readinessOverrideAuthority !== "none"
  ) {
    blockerCodes.push("autonomous_calibration_authority_violation");
    details.push("Calibration apply cannot change execution, broker, or readiness authority.");
  }

  const patchReview = patchBlockers(
    input.proposedChanges,
    input.allowedAgentWeightFields ?? []
  );
  blockerCodes.push(...patchReview.blockerCodes);
  details.push(...patchReview.details);

  if (
    input.baseProfileId === FROZEN_IFVG_V3_PROFILE ||
    input.targetProfileId === FROZEN_IFVG_V3_PROFILE
  ) {
    blockerCodes.push("autonomous_calibration_frozen_profile_requires_new_version");
    details.push(
      "IFVG v3 is frozen; any calibration change requires a new candidate/profile version."
    );
  }

  return {
    allowed: blockerCodes.length === 0,
    blockerCodes: [...new Set(blockerCodes)],
    details: [...new Set(details)]
  };
}
