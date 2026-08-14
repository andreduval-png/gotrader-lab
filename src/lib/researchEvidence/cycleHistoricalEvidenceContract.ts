import type { ValidationProvenanceIdentity } from "@/lib/validationProvenance";

export type CycleHistoricalEvidenceStatus =
  | "matched_certified"
  | "matched_uncertified"
  | "mismatched"
  | "unavailable";

export interface CycleTacticalEvidenceIdentity {
  strategyProfile?: string;
  parameterFingerprint?: string;
  sourceProvider?: string;
  requestedSymbol?: string;
  brokerSymbol?: string;
  timeframe?: string;
  activeSourceFingerprint?: string;
}

export interface CertifiedHistoricalEvidenceBinding {
  datasetCertificateId: string;
  datasetId: string;
  reportId: string;
  coverageStart: string;
  coverageEnd: string;
  strategyProfile: string;
  parameterFingerprint: string;
  sourceFingerprint: string;
}

export interface CycleHistoricalEvidenceContract {
  schemaVersion: 1;
  status: CycleHistoricalEvidenceStatus;
  supportScope: "candidate_support" | "profile_context_only" | "none";
  tacticalIdentity: CycleTacticalEvidenceIdentity;
  historicalIdentity?: ValidationProvenanceIdentity;
  certificate?: CertifiedHistoricalEvidenceBinding;
  mismatchReasons: string[];
  summary: string;
  researchOnly: true;
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

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const same = (left: unknown, right: unknown) => text(left) === text(right);

const missingIdentityFields = (
  tactical: CycleTacticalEvidenceIdentity,
  historical?: ValidationProvenanceIdentity
) => {
  const missing: string[] = [];
  const requiredTactical: Array<keyof CycleTacticalEvidenceIdentity> = [
    "strategyProfile",
    "parameterFingerprint",
    "sourceProvider",
    "requestedSymbol",
    "brokerSymbol",
    "timeframe",
    "activeSourceFingerprint"
  ];
  const requiredHistorical: Array<keyof ValidationProvenanceIdentity> = [
    "strategyProfile",
    "parameterFingerprint",
    "sourceProvider",
    "requestedSymbol",
    "brokerSymbol",
    "timeframe",
    "sourceFingerprint",
    "validationRunId"
  ];
  requiredTactical.forEach((field) => {
    if (!text(tactical[field])) missing.push(`tactical.${field}`);
  });
  requiredHistorical.forEach((field) => {
    if (!text(historical?.[field])) missing.push(`historical.${field}`);
  });
  return missing;
};

const identityMismatches = (
  tactical: CycleTacticalEvidenceIdentity,
  historical?: ValidationProvenanceIdentity
) => {
  if (!historical) return [];
  const mismatches: string[] = [];
  const compare = (label: string, left: unknown, right: unknown) => {
    if (text(left) && text(right) && !same(left, right)) mismatches.push(label);
  };
  compare("strategy_profile_mismatch", tactical.strategyProfile, historical.strategyProfile);
  compare("parameter_fingerprint_mismatch", tactical.parameterFingerprint, historical.parameterFingerprint);
  compare("source_provider_mismatch", tactical.sourceProvider, historical.sourceProvider);
  compare("requested_symbol_mismatch", tactical.requestedSymbol, historical.requestedSymbol);
  compare("broker_symbol_mismatch", tactical.brokerSymbol, historical.brokerSymbol);
  compare("timeframe_mismatch", tactical.timeframe, historical.timeframe);
  return mismatches;
};

const certificateProblems = (
  historical: ValidationProvenanceIdentity,
  certificate?: CertifiedHistoricalEvidenceBinding
) => {
  if (!certificate) return ["certified_dataset_binding_unavailable"];
  const problems: string[] = [];
  const required = [
    certificate.datasetCertificateId,
    certificate.datasetId,
    certificate.reportId,
    certificate.coverageStart,
    certificate.coverageEnd,
    certificate.strategyProfile,
    certificate.parameterFingerprint,
    certificate.sourceFingerprint
  ];
  if (required.some((value) => !text(value))) problems.push("certificate_binding_incomplete");
  if (!same(certificate.strategyProfile, historical.strategyProfile)) problems.push("certificate_strategy_profile_mismatch");
  if (!same(certificate.parameterFingerprint, historical.parameterFingerprint)) problems.push("certificate_parameter_fingerprint_mismatch");
  if (!same(certificate.sourceFingerprint, historical.sourceFingerprint)) problems.push("certificate_source_fingerprint_mismatch");
  const start = Date.parse(certificate.coverageStart);
  const end = Date.parse(certificate.coverageEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) problems.push("certificate_coverage_invalid");
  return problems;
};

export function evaluateCycleHistoricalEvidence(input: {
  tacticalIdentity: CycleTacticalEvidenceIdentity;
  historicalIdentity?: ValidationProvenanceIdentity;
  certificate?: CertifiedHistoricalEvidenceBinding;
}): CycleHistoricalEvidenceContract {
  const tacticalIdentity = { ...input.tacticalIdentity };
  const historicalIdentity = input.historicalIdentity ? { ...input.historicalIdentity } : undefined;
  const missing = missingIdentityFields(tacticalIdentity, historicalIdentity);
  const mismatches = identityMismatches(tacticalIdentity, historicalIdentity);

  if (mismatches.length) {
    return {
      schemaVersion: 1,
      status: "mismatched",
      supportScope: "none",
      tacticalIdentity,
      historicalIdentity,
      certificate: input.certificate,
      mismatchReasons: [...mismatches, ...missing],
      summary: "Historical results do not match the current tactical strategy identity and cannot support this candidate.",
      researchOnly: true,
      authority
    };
  }

  if (missing.length || !historicalIdentity) {
    return {
      schemaVersion: 1,
      status: "unavailable",
      supportScope: "none",
      tacticalIdentity,
      historicalIdentity,
      certificate: input.certificate,
      mismatchReasons: missing.length ? missing : ["historical_identity_unavailable"],
      summary: "Identity-complete historical evidence is unavailable for the current tactical candidate.",
      researchOnly: true,
      authority
    };
  }

  const certification = certificateProblems(historicalIdentity, input.certificate);
  if (certification.length) {
    return {
      schemaVersion: 1,
      status: "matched_uncertified",
      supportScope: "profile_context_only",
      tacticalIdentity,
      historicalIdentity,
      certificate: input.certificate,
      mismatchReasons: certification,
      summary: "Historical identity matches, but no valid certificate-bound dataset report is attached; results are profile context only.",
      researchOnly: true,
      authority
    };
  }

  return {
    schemaVersion: 1,
    status: "matched_certified",
    supportScope: "candidate_support",
    tacticalIdentity,
    historicalIdentity,
    certificate: input.certificate,
    mismatchReasons: [],
    summary: "Certified historical evidence matches the current strategy, parameters, source family, symbol mapping, and timeframe.",
    researchOnly: true,
    authority
  };
}
