import type {
  ValidationProvenanceBlocker,
  ValidationProvenanceIdentity,
  ValidationProvenanceMatchOptions,
  ValidationProvenanceMatchResult
} from "./validationProvenanceTypes";

export const VALIDATION_PROVENANCE_AUTHORITY = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

export const MATCHING_OOS_UNAVAILABLE_MESSAGE =
  "Matching OOS evidence is unavailable for this exact strategy profile, parameter set, source fingerprint, and validation run.";

const BASE_REQUIRED_FIELDS: Array<keyof ValidationProvenanceIdentity> = [
  "strategyProfile",
  "sourceProvider",
  "requestedSymbol",
  "brokerSymbol",
  "timeframe",
  "sourceFingerprint",
  "parameterFingerprint"
];

const compact = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return value;
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const fingerprintValidationParameters = (parameters: unknown): string =>
  `params_${hashString(JSON.stringify(stableValue(parameters ?? {})))}`;

export const inferStrategyProfileVersion = (strategyProfile?: string): string | undefined => {
  const match = compact(strategyProfile)?.match(/(?:^|_)v(\d+)(?:_|$)/i);
  return match ? `v${match[1]}` : undefined;
};

export const buildValidationProvenanceIdentity = (
  input: ValidationProvenanceIdentity
): ValidationProvenanceIdentity => ({
  strategyProfile: compact(input.strategyProfile),
  strategyProfileVersion:
    compact(input.strategyProfileVersion) ?? inferStrategyProfileVersion(input.strategyProfile),
  proposalId: compact(input.proposalId),
  candidateId: compact(input.candidateId),
  sourceProvider: compact(input.sourceProvider),
  requestedSymbol: compact(input.requestedSymbol),
  brokerSymbol: compact(input.brokerSymbol),
  timeframe: compact(input.timeframe),
  sourceFingerprint: compact(input.sourceFingerprint),
  parameterFingerprint: compact(input.parameterFingerprint),
  detectorProfileFingerprint: compact(input.detectorProfileFingerprint),
  validationRunId: compact(input.validationRunId),
  walkForwardRunId: compact(input.walkForwardRunId),
  validationCutoff: compact(input.validationCutoff),
  dataRangeStart: compact(input.dataRangeStart),
  dataRangeEnd: compact(input.dataRangeEnd)
});

const addBlocker = (blockers: ValidationProvenanceBlocker[], blocker: ValidationProvenanceBlocker) => {
  if (!blockers.includes(blocker)) blockers.push(blocker);
};

const isMissing = (identity: ValidationProvenanceIdentity | undefined, field: keyof ValidationProvenanceIdentity) =>
  !compact(identity?.[field]);

const differs = (
  expected: ValidationProvenanceIdentity,
  actual: ValidationProvenanceIdentity,
  field: keyof ValidationProvenanceIdentity
) => compact(expected[field]) !== compact(actual[field]);

interface ParsedCandleWindowFingerprint {
  provider: string;
  candleCount: string;
  firstTimestamp: string;
  firstClose: string;
  lastTimestamp: string;
  lastClose: string;
}

const parseCandleWindowFingerprint = (
  fingerprint?: string
): ParsedCandleWindowFingerprint | undefined => {
  const parts = compact(fingerprint)?.split("|") ?? [];
  const canonical = parts.length >= 9;
  const legacy = parts.length >= 7;
  if (!canonical && !legacy) return undefined;
  const offset = canonical ? parts.length - 5 : parts.length - 5;
  return {
    provider: parts[0],
    candleCount: parts[offset],
    firstTimestamp: parts[offset + 1],
    firstClose: parts[offset + 2],
    lastTimestamp: parts[offset + 3],
    lastClose: parts[offset + 4]
  };
};

const sourceFingerprintsMatch = (expected?: string, actual?: string) => {
  if (compact(expected) === compact(actual)) return true;
  const expectedWindow = parseCandleWindowFingerprint(expected);
  const actualWindow = parseCandleWindowFingerprint(actual);
  return Boolean(
    expectedWindow &&
    actualWindow &&
    expectedWindow.provider === actualWindow.provider &&
    expectedWindow.candleCount === actualWindow.candleCount &&
    expectedWindow.firstTimestamp === actualWindow.firstTimestamp &&
    expectedWindow.firstClose === actualWindow.firstClose &&
    expectedWindow.lastTimestamp === actualWindow.lastTimestamp &&
    expectedWindow.lastClose === actualWindow.lastClose
  );
};

const requiredFieldsFor = (
  expected: ValidationProvenanceIdentity,
  options: ValidationProvenanceMatchOptions
) => {
  const fields = [...BASE_REQUIRED_FIELDS];
  if (expected.strategyProfileVersion || inferStrategyProfileVersion(expected.strategyProfile)) {
    fields.push("strategyProfileVersion");
  }
  if (options.requireProposalId || expected.proposalId) fields.push("proposalId");
  if (options.requireCandidateId || expected.candidateId) fields.push("candidateId");
  if (options.requireValidationRunId || expected.validationRunId) fields.push("validationRunId");
  if (expected.walkForwardRunId) fields.push("walkForwardRunId");
  if (expected.detectorProfileFingerprint) fields.push("detectorProfileFingerprint");
  if (options.requireDataRange || expected.validationCutoff) fields.push("validationCutoff");
  if (options.requireDataRange || expected.dataRangeStart) fields.push("dataRangeStart");
  if (options.requireDataRange || expected.dataRangeEnd) fields.push("dataRangeEnd");
  return [...new Set(fields)];
};

export function matchValidationProvenance(
  expectedInput: ValidationProvenanceIdentity | undefined,
  actualInput: ValidationProvenanceIdentity | undefined,
  options: ValidationProvenanceMatchOptions = {}
): ValidationProvenanceMatchResult {
  const expected = buildValidationProvenanceIdentity(expectedInput ?? {});
  const actual = buildValidationProvenanceIdentity(actualInput ?? {});
  const blockers: ValidationProvenanceBlocker[] = [];
  const requiredFields = requiredFieldsFor(expected, options);
  const missingFields = requiredFields.filter(
    (field) => isMissing(expected, field) || isMissing(actual, field)
  );
  if (options.requireWalkForwardRunId && isMissing(actual, "walkForwardRunId")) {
    missingFields.push("walkForwardRunId");
  }
  const mismatchedFields: Array<keyof ValidationProvenanceIdentity> = [];

  if (missingFields.length) {
    addBlocker(blockers, "missing_validation_provenance");
    addBlocker(blockers, "legacy_unverified_provenance");
  }

  const compare = (
    field: keyof ValidationProvenanceIdentity,
    blocker: ValidationProvenanceBlocker
  ) => {
    if (!isMissing(expected, field) && !isMissing(actual, field) && differs(expected, actual, field)) {
      mismatchedFields.push(field);
      addBlocker(blockers, blocker);
    }
  };

  compare("strategyProfile", "strategy_profile_mismatch");
  compare("strategyProfileVersion", "strategy_profile_version_mismatch");
  compare("proposalId", "proposal_validation_mismatch");
  compare("candidateId", "candidate_validation_mismatch");
  compare("sourceProvider", "source_fingerprint_mismatch");
  compare("requestedSymbol", "source_fingerprint_mismatch");
  compare("brokerSymbol", "source_fingerprint_mismatch");
  if (
    !isMissing(expected, "sourceFingerprint") &&
    !isMissing(actual, "sourceFingerprint") &&
    !sourceFingerprintsMatch(expected.sourceFingerprint, actual.sourceFingerprint)
  ) {
    mismatchedFields.push("sourceFingerprint");
    addBlocker(blockers, "source_fingerprint_mismatch");
  }
  compare("timeframe", "timeframe_mismatch");
  compare("parameterFingerprint", "parameter_fingerprint_mismatch");
  compare("detectorProfileFingerprint", "parameter_fingerprint_mismatch");
  compare("validationRunId", "walk_forward_run_mismatch");
  compare("walkForwardRunId", "walk_forward_run_mismatch");
  compare("validationCutoff", "stale_validation_evidence");
  compare("dataRangeStart", "stale_validation_evidence");
  compare("dataRangeEnd", "stale_validation_evidence");

  if (expected.validationCutoff && actual.dataRangeEnd) {
    const cutoff = Date.parse(expected.validationCutoff);
    const expectedRangeEnd = expected.dataRangeEnd
      ? Date.parse(expected.dataRangeEnd)
      : Number.NaN;
    const rangeEnd = Date.parse(actual.dataRangeEnd);
    const expectedRepresentsFrozenHistory =
      !Number.isFinite(expectedRangeEnd) || expectedRangeEnd <= cutoff;
    if (
      Number.isFinite(cutoff) &&
      Number.isFinite(rangeEnd) &&
      expectedRepresentsFrozenHistory &&
      rangeEnd > cutoff
    ) {
      addBlocker(blockers, "stale_validation_evidence");
      if (!mismatchedFields.includes("dataRangeEnd")) mismatchedFields.push("dataRangeEnd");
    }
  }

  if (options.maximumEvidenceAgeMs && actual.dataRangeEnd) {
    const evaluatedAt = Date.parse(options.evaluatedAt ?? new Date().toISOString());
    const rangeEnd = Date.parse(actual.dataRangeEnd);
    if (
      Number.isFinite(evaluatedAt) &&
      Number.isFinite(rangeEnd) &&
      evaluatedAt - rangeEnd > options.maximumEvidenceAgeMs
    ) {
      addBlocker(blockers, "stale_validation_evidence");
    }
  }

  if (options.requireMatchingOosEvidence && blockers.length) {
    addBlocker(blockers, "missing_matching_oos_evidence");
  }

  const legacy = blockers.includes("legacy_unverified_provenance");
  return {
    matched: blockers.length === 0,
    status: blockers.length === 0 ? "matched" : legacy ? "legacy_unverified_provenance" : "blocked",
    blockers,
    missingFields,
    mismatchedFields,
    summary: blockers.length === 0 ? "Validation provenance matches exactly." : MATCHING_OOS_UNAVAILABLE_MESSAGE,
    legacyRecordVisible: true,
    authority: VALIDATION_PROVENANCE_AUTHORITY
  };
}

/**
 * Matches the active strategy and canonical source series to frozen validation
 * evidence without treating a newly closed candle as a different research
 * identity. The frozen source fingerprint is still required and is matched
 * exactly between validation and OOS evidence by matchValidationProvenance.
 */
export function matchActiveResearchIdentity(
  activeInput: ValidationProvenanceIdentity | undefined,
  evidenceInput: ValidationProvenanceIdentity | undefined
): ValidationProvenanceMatchResult {
  const active = buildValidationProvenanceIdentity(activeInput ?? {});
  const evidence = buildValidationProvenanceIdentity(evidenceInput ?? {});
  const review = matchValidationProvenance(
    {
      ...active,
      // Active candle-window fingerprints advance as MT5 closes candles. Use
      // the frozen evidence fingerprint here only after confirming the active
      // source has a fingerprint, then compare the immutable series fields.
      sourceFingerprint: active.sourceFingerprint ? evidence.sourceFingerprint : undefined,
      validationRunId: undefined,
      walkForwardRunId: undefined,
      validationCutoff: undefined,
      dataRangeStart: undefined,
      dataRangeEnd: undefined
    },
    evidence,
    {
      purpose: "readiness",
      requireProposalId: Boolean(active.proposalId),
      requireCandidateId: Boolean(active.candidateId)
    }
  );

  return {
    ...review,
    summary: review.matched
      ? "Active strategy, parameters, and canonical source series match the frozen validation identity."
      : "Validation evidence does not match the active strategy, parameters, or canonical source series."
  };
}

/**
 * Older compact validation reports may predate provenance persistence even
 * though the research cycle that created them retained the exact identity.
 * Restore that identity only when both records name the same validation run.
 */
export function attachMatchingCycleValidationProvenance<
  TReport extends { id: string; provenance?: ValidationProvenanceIdentity }
>(
  report: TReport | undefined,
  cycleSummary:
    | { validationId: string; provenance?: ValidationProvenanceIdentity }
    | undefined
): TReport | undefined {
  if (
    !report ||
    report.provenance ||
    !cycleSummary?.provenance ||
    cycleSummary.validationId !== report.id
  ) {
    return report;
  }

  return {
    ...report,
    provenance: buildValidationProvenanceIdentity(cycleSummary.provenance)
  };
}

export const validationProvenanceBlockerLabel = (blocker: ValidationProvenanceBlocker): string =>
  blocker === "legacy_unverified_provenance"
    ? "Legacy record - unverified provenance"
    : blocker.replace(/_/g, " ");

export function selectMatchingValidationEvidence<T extends { provenance?: ValidationProvenanceIdentity }>(
  expected: ValidationProvenanceIdentity,
  records: T[],
  options: ValidationProvenanceMatchOptions = {}
): T | undefined {
  return records.find((record) => matchValidationProvenance(expected, record.provenance, options).matched);
}

/** Frozen historical evidence cannot be replaced by a tactical/current-window record. */
export function canReplaceValidationEvidence(
  existing: ValidationProvenanceIdentity | undefined,
  incoming: ValidationProvenanceIdentity | undefined
): boolean {
  if (!existing?.validationCutoff) return true;
  return matchValidationProvenance(existing, incoming, {
    purpose: "validation",
    requireDataRange: true,
    requireValidationRunId: Boolean(existing.validationRunId)
  }).matched;
}
