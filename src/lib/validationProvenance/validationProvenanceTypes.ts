export type ValidationProvenanceBlocker =
  | "missing_validation_provenance"
  | "strategy_profile_mismatch"
  | "strategy_profile_version_mismatch"
  | "proposal_validation_mismatch"
  | "candidate_validation_mismatch"
  | "source_fingerprint_mismatch"
  | "timeframe_mismatch"
  | "parameter_fingerprint_mismatch"
  | "walk_forward_run_mismatch"
  | "missing_matching_oos_evidence"
  | "stale_validation_evidence"
  | "legacy_unverified_provenance";

export type ValidationProvenancePurpose =
  | "validation"
  | "walk_forward"
  | "calibration_approval"
  | "readiness";

/** Compact identity only. Raw candles, snapshots, and mutable broker data are forbidden. */
export interface ValidationProvenanceIdentity {
  strategyProfile?: string;
  strategyProfileVersion?: string;
  proposalId?: string;
  candidateId?: string;
  sourceProvider?: string;
  requestedSymbol?: string;
  brokerSymbol?: string;
  timeframe?: string;
  sourceFingerprint?: string;
  parameterFingerprint?: string;
  detectorProfileFingerprint?: string;
  validationRunId?: string;
  walkForwardRunId?: string;
  validationCutoff?: string;
  dataRangeStart?: string;
  dataRangeEnd?: string;
}

export interface ValidationProvenanceMatchOptions {
  purpose?: ValidationProvenancePurpose;
  requireProposalId?: boolean;
  requireCandidateId?: boolean;
  requireValidationRunId?: boolean;
  requireWalkForwardRunId?: boolean;
  requireDataRange?: boolean;
  requireMatchingOosEvidence?: boolean;
  maximumEvidenceAgeMs?: number;
  evaluatedAt?: string;
}

export interface ValidationProvenanceMatchResult {
  matched: boolean;
  status: "matched" | "blocked" | "legacy_unverified_provenance";
  blockers: ValidationProvenanceBlocker[];
  missingFields: Array<keyof ValidationProvenanceIdentity>;
  mismatchedFields: Array<keyof ValidationProvenanceIdentity>;
  summary: string;
  legacyRecordVisible: true;
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}
