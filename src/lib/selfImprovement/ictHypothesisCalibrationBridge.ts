import {
  loadSelfImprovementState,
  resolveActiveBacktestConfig,
  upsertCalibrationProposal
} from "@/lib/selfImprovement/approveCalibrationProposal";
import { summarizeValidationMetrics } from "@/lib/selfImprovement/evaluateCalibrationProposal";
import type { CalibrationProposal } from "@/lib/selfImprovement/selfImprovementTypes";
import type { IctResearchHypothesis } from "@/lib/ict-strategy-suite/ictSelfImprovementTypes";
import { loadLatestValidationReport } from "@/lib/validation";
import { matchValidationProvenance } from "@/lib/validationProvenance";

export interface IctHypothesisCalibrationBridgeResult {
  status: "draft_created" | "existing_draft" | "blocked_identity" | "blocked_validation";
  proposalId?: string;
  reason: string;
  blockers: string[];
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}

const authority = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const compact = (values: Array<string | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const requiredValidationSteps = [
  {
    requirementId: "ai_research_cycle" as const,
    label: "AI Research Cycle",
    status: "required" as const,
    detail: "Turn the ICT hypothesis into an executable candidate and rerun the identity-matched research cycle."
  },
  {
    requirementId: "walk_forward" as const,
    label: "Walk-forward validation",
    status: "required" as const,
    detail: "Require identity-matched out-of-sample evidence before any concrete calibration patch."
  },
  {
    requirementId: "evidence_quality" as const,
    label: "Evidence quality",
    status: "required" as const,
    detail: "Confirm source quality, sample size, and failure attribution."
  },
  {
    requirementId: "maturity_check" as const,
    label: "Maturity check",
    status: "required" as const,
    detail: "Keep readiness and production adoption blocked until maturity gates pass."
  },
  {
    requirementId: "regime_consistency" as const,
    label: "Regime consistency",
    status: "required" as const,
    detail: "Replay the hypothesis across representative market regimes."
  }
];

export function bridgeIctHypothesisToCalibrationDraft(
  hypothesis: IctResearchHypothesis
): IctHypothesisCalibrationBridgeResult {
  if (!hypothesis.sourceFingerprint) {
    return {
      status: "blocked_identity",
      reason: "ICT hypothesis has no immutable source fingerprint.",
      blockers: ["missing_source_fingerprint"],
      authority
    };
  }

  const report = loadLatestValidationReport();
  if (!report?.provenance) {
    return {
      status: "blocked_validation",
      reason: "No provenance-complete validation report is available for this ICT hypothesis.",
      blockers: ["missing_validation_provenance"],
      authority
    };
  }

  const provenance = report.provenance;
  const match = matchValidationProvenance(
    {
      ...provenance,
      requestedSymbol: hypothesis.requestedSymbol,
      brokerSymbol: hypothesis.brokerSymbol,
      timeframe: hypothesis.primaryTimeframe,
      sourceFingerprint: hypothesis.sourceFingerprint
    },
    provenance,
    { purpose: "calibration_approval" }
  );
  if (!match.matched) {
    return {
      status: "blocked_identity",
      reason: "Latest validation evidence does not match the ICT hypothesis identity.",
      blockers: compact([
        ...match.blockers,
        ...match.missingFields.map((field) => `missing_${field}`),
        ...match.mismatchedFields.map((field) => `mismatch_${field}`)
      ]),
      authority
    };
  }

  const state = resolveActiveBacktestConfig();
  const proposalId = `ict_hypothesis_intent_${stableHash(`${hypothesis.hypothesisId}|${report.id}|${provenance.parameterFingerprint}`)}`;
  const existing = loadSelfImprovementState().proposals.find((proposal) => proposal.proposalId === proposalId);
  if (existing) {
    return {
      status: "existing_draft",
      proposalId,
      reason: "Matching identity-bound ICT calibration draft already exists.",
      blockers: [],
      authority
    };
  }

  const baselineConfig = state.config;
  const beforeMetrics = summarizeValidationMetrics(report);
  const candidateFamily = hypothesis.sourceOpportunity.modelFamily ?? hypothesis.sourceOpportunity.modelName ?? hypothesis.sourceOpportunity.type;
  const reportFingerprint = `validation_${stableHash(JSON.stringify({
    id: report.id,
    generatedAt: report.generatedAt,
    provenance,
    hypothesisId: hypothesis.hypothesisId
  }))}`;
  const proposal: CalibrationProposal = {
    proposalId,
    timestamp: new Date().toISOString(),
    source: "internal",
    status: "proposed",
    proposalIntent: "ict_research_hypothesis_intent",
    mode: "simulation",
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none",
    reason: `ICT hypothesis ${hypothesis.title} was joined to the exact current validation identity as a draft-only research intent.`,
    targetProblem: "trade_generation_blocked",
    proposedChanges: {},
    expectedImprovement: "Create and replay an executable candidate for the missing ICT confirmations without changing current calibration.",
    safetyNotes: [
      "Draft ICT hypothesis intent only; no concrete calibration patch exists.",
      "Exact current validation provenance matched before this draft was created.",
      "Auto-apply, readiness promotion, broker authority, and execution remain blocked.",
      "A new candidate must pass replay, walk-forward, evidence quality, maturity, and regime consistency gates."
    ],
    beforeMetrics,
    baselineConfig,
    proposedConfig: baselineConfig,
    approvalRequired: true,
    sourceCandidateId: hypothesis.hypothesisId,
    sourceCandidateLabel: hypothesis.title,
    proposalIntentDetails: {
      title: hypothesis.title,
      targetSubsystem: "ICT strategy suite",
      candidateFamily,
      generatedAt: hypothesis.generatedAt,
      reportFingerprint,
      sourceFingerprint: hypothesis.sourceFingerprint,
      reason: hypothesis.nextAction,
      draftOnly: true,
      autoApplyAllowed: false,
      sourceProfile: provenance.strategyProfile,
      firstFailedGate: hypothesis.missingConfirmation[0] ?? hypothesis.blockers[0],
      executableStatus: "diagnostic_only",
      executableStatusLabel: "hypothesis draft",
      executableAutoResearchFamilies: [],
      closestAutoResearchFamilies: [],
      executableStatusReason: "The ICT hypothesis has not yet been translated into a concrete Auto Research candidate family.",
      nextImplementationStep: hypothesis.proposedValidationRules[0] ?? "Build a controlled replay candidate.",
      sourceContext: {
        provider: provenance.sourceProvider,
        dataSourceLabel: provenance.sourceProvider,
        requestedSymbol: provenance.requestedSymbol,
        brokerSymbol: provenance.brokerSymbol,
        timeframe: provenance.timeframe,
        candleCount: hypothesis.candleCount,
        sourceFingerprint: provenance.sourceFingerprint
      },
      requiredValidationSteps
    },
    improvementSummary: [
      `Joined hypothesis ${hypothesis.hypothesisId} to validation ${report.id}.`,
      `Missing confirmations: ${hypothesis.missingConfirmation.join(", ") || "none recorded"}.`,
      "No threshold, profile, timing, or trading-rule change has been proposed."
    ],
    notReadyReasons: compact([
      "Draft-only ICT hypothesis intent; no concrete calibration patch exists.",
      ...hypothesis.missingConfirmation,
      ...hypothesis.blockers
    ]),
    nextValidationRequirement: hypothesis.proposedValidationRules[0] ?? "Run identity-matched replay validation.",
    autoApplyStatus: "blocked",
    autoApplyBlockedReasons: [
      "ICT hypothesis drafts are not concrete configuration patches.",
      "Required replay and validation gates have not completed.",
      "Manual review remains required."
    ]
  };

  upsertCalibrationProposal(
    proposal,
    "created",
    `Created identity-bound ICT hypothesis draft from ${hypothesis.hypothesisId}; no calibration changed.`
  );
  return {
    status: "draft_created",
    proposalId,
    reason: "Identity-bound ICT hypothesis draft created for controlled replay validation.",
    blockers: [],
    authority
  };
}
