import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const GOTRADER_MCP_CONTEXT_CONTRACT = "gotrader.mcp_authoritative_research_context";
export const GOTRADER_MCP_CONTEXT_VERSION = "1.0";
export const GOTRADER_MCP_CONTEXT_AUTHORITY = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const DEFAULT_VALIDATION_REPORT = ".gotrader/ifvg-v3-profile-oos.json";
const DEFAULT_FORWARD_REPORT = ".gotrader/ifvg-v3-forward-evidence.json";

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
};

const sha256 = (value) =>
  createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");

const resolveInsideRepo = (repoRoot, candidatePath) => {
  const resolvedRoot = path.resolve(repoRoot);
  const resolved = path.resolve(resolvedRoot, candidatePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("GoTrader MCP evidence path escaped the repository root.");
  }
  return resolved;
};

const readJsonEvidence = async (filePath) => {
  try {
    const [contents, details] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    return {
      data: JSON.parse(contents.replace(/^\uFEFF/, "")),
      updatedAt: details.mtime.toISOString()
    };
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
};

const authorityIsNone = (authority) =>
  authority?.executionAuthority === "none" &&
  authority?.brokerAuthority === "none" &&
  authority?.readinessOverrideAuthority === "none";

const compactSource = (report) => ({
  provider: report?.source?.provider,
  requestedSymbol: report?.source?.requestedSymbol,
  brokerSymbol: report?.source?.brokerSymbol,
  timeframe: report?.source?.timeframe,
  fingerprint: report?.source?.fingerprint,
  candleCount: report?.source?.normalizedCandleCount ?? report?.source?.returnedCount,
  firstTimestamp: report?.source?.firstTimestamp,
  lastTimestamp: report?.source?.lastTimestamp
});

const buildValidationBinding = ({ candidate, report, source }) => {
  const identity = {
    candidateId: candidate?.candidateId,
    profileId: candidate?.candidateFamily,
    validationRunId:
      candidate?.profileWalkForward?.validationRunId ??
      candidate?.temporalRobustness?.validationRunId ??
      report?.validationRunId,
    walkForwardRunId:
      candidate?.profileWalkForward?.walkForwardRunId ??
      candidate?.temporalRobustness?.walkForwardRunId ??
      report?.walkForwardRunId,
    source
  };
  return `validation_binding_v1_${sha256(identity).slice(0, 32)}`;
};

const summarizeProfile = ({ candidate, report, source }) => {
  const temporal = candidate?.temporalRobustness;
  const authority =
    candidate?.safetyAuthority ?? report?.safetyAuthority ?? report?.source?.safetyAuthority;
  const validationChainId = buildValidationBinding({ candidate, report, source });
  return {
    profileId: candidate?.candidateFamily,
    candidateId: candidate?.candidateId,
    validationChainId,
    sourceFingerprint: source.fingerprint,
    validationReadinessStatus: candidate?.validationReadinessStatus,
    walkForwardVerdict: candidate?.walkForwardVerdict,
    completedTrades: temporal?.summary?.trades,
    uniqueTradingDates: temporal?.summary?.uniqueTradingDates,
    activeRollingWindows: temporal?.rolling?.activeWindows,
    positiveRollingWindows: temporal?.rolling?.positiveWindows,
    monteCarloRobustness: temporal?.monteCarlo?.robustness,
    evidenceStatus:
      report?.status === "completed" && authorityIsNone(authority)
        ? "authoritative_compact_evidence"
        : "blocked",
    authority: GOTRADER_MCP_CONTEXT_AUTHORITY
  };
};

export const summarizeAuthoritativeValidationProfile = (report, profileId) => {
  const source = compactSource(report);
  const candidate = report?.candidates?.find((item) => item?.candidateFamily === profileId);
  if (!candidate) return undefined;
  return {
    source,
    profile: summarizeProfile({ candidate, report, source })
  };
};

export const loadAuthoritativeMcpContext = async ({
  allowedProfiles = [],
  env = process.env,
  now = new Date().toISOString(),
  repoRoot = process.cwd()
} = {}) => {
  const validationPath = resolveInsideRepo(
    repoRoot,
    env.GOTRADER_PAPER_VALIDATION_REPORT || DEFAULT_VALIDATION_REPORT
  );
  const forwardPath = resolveInsideRepo(
    repoRoot,
    env.GOTRADER_PAPER_FORWARD_EVIDENCE_REPORT || DEFAULT_FORWARD_REPORT
  );
  const [validationFile, forwardFile] = await Promise.all([
    readJsonEvidence(validationPath),
    readJsonEvidence(forwardPath)
  ]);
  const report = validationFile?.data;
  const source = compactSource(report);
  const reportAuthority =
    report?.safetyAuthority ?? report?.source?.safetyAuthority ?? GOTRADER_MCP_CONTEXT_AUTHORITY;
  const sourceComplete =
    source.provider === "mt5_read_only" &&
    Boolean(source.requestedSymbol) &&
    Boolean(source.brokerSymbol) &&
    Boolean(source.timeframe) &&
    Boolean(source.fingerprint);
  const profiles = (report?.candidates ?? [])
    .filter((candidate) => allowedProfiles.includes(candidate?.candidateFamily))
    .map((candidate) => summarizeProfile({ candidate, report, source }));
  const unsafe = Boolean(report) && !authorityIsNone(reportAuthority);
  const available =
    report?.status === "completed" &&
    sourceComplete &&
    profiles.length > 0 &&
    !unsafe;

  return {
    contract: GOTRADER_MCP_CONTEXT_CONTRACT,
    version: GOTRADER_MCP_CONTEXT_VERSION,
    generatedAt: now,
    status: unsafe ? "unsafe_evidence" : available ? "available" : "unavailable",
    validationReportUpdatedAt: validationFile?.updatedAt,
    forwardEvidenceUpdatedAt: forwardFile?.updatedAt,
    source: sourceComplete ? source : undefined,
    profiles,
    forwardEvidence: forwardFile?.data
      ? {
          profileId: forwardFile.data.profileId,
          completedForwardOutcomes: forwardFile.data.completedForwardOutcomes,
          independentDates: forwardFile.data.independentDates,
          forwardWindows: forwardFile.data.forwardWindows,
          reassessmentEligible: forwardFile.data.reassessmentEligible === true,
          recommendation: forwardFile.data.recommendation,
          authority: GOTRADER_MCP_CONTEXT_AUTHORITY
        }
      : undefined,
    blockers: [
      !validationFile ? "authoritative_validation_report_missing" : undefined,
      report && report.status !== "completed" ? "authoritative_validation_incomplete" : undefined,
      !sourceComplete ? "authoritative_source_identity_incomplete" : undefined,
      !profiles.length ? "allowlisted_profile_evidence_missing" : undefined,
      unsafe ? "authoritative_evidence_authority_not_none" : undefined
    ].filter(Boolean),
    safety: {
      compactEvidenceOnly: true,
      rawCandlesIncluded: false,
      accountDataIncluded: false,
      orderDataIncluded: false,
      positionDataIncluded: false,
      credentialsIncluded: false
    },
    authority: GOTRADER_MCP_CONTEXT_AUTHORITY
  };
};

export const findAuthoritativeProfile = (context, profileId) =>
  context?.profiles?.find((profile) => profile.profileId === profileId);
