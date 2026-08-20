import { loadLatestValidationReport } from "@/lib/validation";
import { fingerprintValidationParameters } from "@/lib/validationProvenance";
import {
  resolveActiveBacktestConfig,
  upsertCalibrationProposal
} from "@/lib/selfImprovement/approveCalibrationProposal";
import { summarizeValidationMetrics } from "@/lib/selfImprovement/evaluateCalibrationProposal";
import type {
  CalibrationProposal,
  CalibrationProposalIntentDetails,
  CalibrationProposalValidationRequirement
} from "@/lib/selfImprovement/selfImprovementTypes";
import type { IctHypothesisValidationResult } from "./ictHypothesisValidationTypes";
import type { IctResearchHypothesis } from "./ictSelfImprovementTypes";

export interface IctCalibrationBridgeResult {
  status: "created" | "not_eligible" | "identity_mismatch" | "validation_missing";
  proposal?: CalibrationProposal;
  reason: string;
}

const eligibleStatuses = new Set<IctHypothesisValidationResult["status"]>([
  "promising",
  "paper_watchlist_recommended"
]);

const requiredValidationSteps: CalibrationProposalValidationRequirement[] = [
  {
    requirementId: "ai_research_cycle",
    label: "AI Research Cycle",
    status: "required",
    detail: "Convert this replay-supported hypothesis into a bounded candidate with a concrete configuration patch."
  },
  {
    requirementId: "walk_forward",
    label: "Walk-forward",
    status: "required",
    detail: "The exact candidate identity must produce sufficient out-of-sample evidence."
  },
  {
    requirementId: "evidence_quality",
    label: "Evidence quality",
    status: "required",
    detail: "Evidence quality must remain source-bound and non-mock."
  },
  {
    requirementId: "maturity_check",
    label: "Maturity check",
    status: "required",
    detail: "Research maturity must pass after candidate testing."
  },
  {
    requirementId: "regime_consistency",
    label: "Regime consistency",
    status: "required",
    detail: "The candidate must remain stable in matching market regimes."
  }
];

const intentDetailsFor = (
  hypothesis: IctResearchHypothesis,
  validation: IctHypothesisValidationResult
): CalibrationProposalIntentDetails => {
  const candidateFamily = hypothesis.sourceOpportunity.modelName ?? hypothesis.sourceOpportunity.type;
  const reportFingerprint = fingerprintValidationParameters({
    hypothesisId: hypothesis.hypothesisId,
    sourceFingerprint: hypothesis.sourceFingerprint,
    status: validation.status,
    testedWindows: validation.testedWindows,
    usableOutcomes: validation.usableOutcomes,
    targetFirstRate: validation.targetFirstRate,
    invalidationFirstRate: validation.invalidationFirstRate,
    averageRr: validation.averageRr
  });
  return {
    title: `ICT hypothesis: ${hypothesis.title}`,
    targetSubsystem: "ICT candidate calibration",
    candidateFamily,
    generatedAt: validation.generatedAt,
    reportFingerprint,
    sourceFingerprint: hypothesis.sourceFingerprint,
    reason: validation.classificationReason,
    draftOnly: true,
    autoApplyAllowed: false,
    sourceProfile: hypothesis.sourceOpportunity.modelFamily,
    executableStatus: "diagnostic_only",
    executableStatusLabel: "validated hypothesis; concrete patch required",
    executableAutoResearchFamilies: [],
    closestAutoResearchFamilies: [],
    executableStatusReason:
      "Replay supports preserving this ICT hypothesis as calibration intent, but it does not identify a safe parameter mutation.",
    nextImplementationStep:
      "Use bounded Auto Research to produce and validate a concrete candidate configuration for this exact hypothesis and source identity.",
    sourceReportTitle: hypothesis.title,
    sourceReportFinding: validation.classificationReason,
    sourceContext: {
      provider: "ict_replay",
      dataSourceLabel: "ICT hypothesis replay validation",
      requestedSymbol: hypothesis.requestedSymbol,
      brokerSymbol: hypothesis.brokerSymbol,
      timeframe: hypothesis.primaryTimeframe,
      candleCount: hypothesis.candleCount,
      sourceFingerprint: hypothesis.sourceFingerprint
    },
    requiredValidationSteps
  };
};

export function bridgeValidatedIctHypothesisToCalibration(
  hypothesis: IctResearchHypothesis,
  validation: IctHypothesisValidationResult
): IctCalibrationBridgeResult {
  if (!eligibleStatuses.has(validation.status)) {
    return {
      status: "not_eligible",
      reason: `ICT hypothesis validation status ${validation.status} does not qualify for a calibration intent.`
    };
  }
  const latestValidation = loadLatestValidationReport();
  if (!latestValidation) {
    return {
      status: "validation_missing",
      reason: "A source-bound validation report is required before creating an ICT calibration intent."
    };
  }
  const validationSourceFingerprint = latestValidation.provenance?.sourceFingerprint;
  if (!hypothesis.sourceFingerprint || !validationSourceFingerprint) {
    return {
      status: "identity_mismatch",
      reason: "Both the ICT hypothesis and latest validation report require an exact source fingerprint."
    };
  }
  if (hypothesis.sourceFingerprint !== validationSourceFingerprint) {
    return {
      status: "identity_mismatch",
      reason: "The ICT hypothesis source fingerprint does not match the latest validation report."
    };
  }

  const baselineConfig = resolveActiveBacktestConfig().config;
  const beforeMetrics = summarizeValidationMetrics(latestValidation);
  const intentDetails = intentDetailsFor(hypothesis, validation);
  const proposalId = `ict_calibration_intent_${intentDetails.reportFingerprint}`;
  const proposal: CalibrationProposal = {
    proposalId,
    timestamp: validation.generatedAt,
    source: "internal",
    status: "proposed",
    proposalIntent: "ict_hypothesis_calibration_intent",
    mode: "simulation",
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none",
    reason: `${hypothesis.title}: ${validation.classificationReason}`,
    targetProblem: "trade_generation_blocked",
    proposedChanges: {},
    expectedImprovement:
      "Preserve a replay-supported ICT hypothesis as a bounded calibration intent without inventing a parameter change.",
    safetyNotes: [
      "Draft calibration intent only; no concrete configuration patch exists.",
      "Auto-apply and approval remain blocked until bounded candidate testing produces exact matching evidence.",
      "No broker, execution, paper-demo, readiness, or production authority is created."
    ],
    beforeMetrics,
    baselineConfig,
    proposedConfig: baselineConfig,
    approvalRequired: true,
    sourceCandidateId: hypothesis.hypothesisId,
    sourceCandidateLabel: hypothesis.title,
    proposalIntentDetails: intentDetails,
    improvementSummary: [
      `${validation.usableOutcomes} usable replay outcomes across ${validation.testedWindows} tested windows.`,
      `Validation status: ${validation.status.replace(/_/g, " ")}.`,
      "No production rule or threshold change has been proposed."
    ],
    notReadyReasons: [
      "Draft intent has no concrete calibration patch.",
      "AI Research, walk-forward, evidence quality, maturity, and regime consistency remain required."
    ],
    nextValidationRequirement: intentDetails.nextImplementationStep,
    autoApplyStatus: "blocked",
    autoApplyBlockedReasons: [
      "ICT hypothesis intent is not a concrete configuration patch.",
      "Required identity-bound validation stages are incomplete."
    ]
  };
  upsertCalibrationProposal(
    proposal,
    "created",
    "Created a draft calibration intent from an identity-matched replay-supported ICT hypothesis."
  );
  return {
    status: "created",
    proposal,
    reason: "Replay-supported ICT hypothesis joined to Self-Improvement as a draft calibration intent."
  };
}
