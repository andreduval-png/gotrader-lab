import {
  FORWARD_EVIDENCE_AUTHORITY,
  IFVG_FRESH_RETEST_V3_PROFILE_ID,
  type ForwardEvidenceLedgerEvaluation
} from "./forwardEvidenceTypes";

export interface ForwardEvidenceGatewayReport {
  reportType: "gotrader_forward_evidence_gateway_report";
  reportVersion: "v1";
  generatedAt: string;
  profileId: typeof IFVG_FRESH_RETEST_V3_PROFILE_ID;
  profileVersion: "v3";
  cutoff: string;
  completedForwardOutcomes: number;
  pendingOutcomes: number;
  rejectedOutcomes: number;
  unverifiedOutcomes: number;
  independentDates: number;
  forwardWindows: number;
  targetFirstRate: number | null;
  invalidationFirstRate: number | null;
  averageR: number | null;
  profitFactor: number | null;
  maxDrawdownR: number | null;
  reassessmentEligible: boolean;
  blockers: string[];
  recommendation: ForwardEvidenceLedgerEvaluation["recommendation"];
  autoPromotionAllowed: false;
  authority: typeof FORWARD_EVIDENCE_AUTHORITY;
}

export const buildForwardEvidenceGatewayReport = (
  evaluation: ForwardEvidenceLedgerEvaluation,
  generatedAt = new Date().toISOString()
): ForwardEvidenceGatewayReport => ({
  reportType: "gotrader_forward_evidence_gateway_report",
  reportVersion: "v1",
  generatedAt,
  profileId: IFVG_FRESH_RETEST_V3_PROFILE_ID,
  profileVersion: "v3",
  cutoff: evaluation.cutoff,
  completedForwardOutcomes: evaluation.completedForwardOutcomes,
  pendingOutcomes: evaluation.pendingOutcomes,
  rejectedOutcomes: evaluation.rejectedOutcomes,
  unverifiedOutcomes: evaluation.unverifiedOutcomes,
  independentDates: evaluation.independentDates,
  forwardWindows: evaluation.forwardWindows,
  targetFirstRate: evaluation.targetFirstRate,
  invalidationFirstRate: evaluation.invalidationFirstRate,
  averageR: evaluation.averageR,
  profitFactor: evaluation.profitFactor,
  maxDrawdownR: evaluation.maxDrawdownR,
  reassessmentEligible: evaluation.reassessmentEligible,
  blockers: [...evaluation.blockers],
  recommendation: evaluation.recommendation,
  autoPromotionAllowed: false,
  authority: FORWARD_EVIDENCE_AUTHORITY
});
