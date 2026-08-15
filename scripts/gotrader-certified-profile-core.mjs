import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { GOTRADER_AGENT_AUTHORITY, withAgentProvenance } from "./gotrader-agent-provenance-core.mjs";

const authorityIsNone = (value) =>
  value?.executionAuthority === "none" &&
  value?.brokerAuthority === "none" &&
  value?.readinessOverrideAuthority === "none";

const readJson = async (filePath) => {
  try {
    const [text, details] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    return { value: JSON.parse(text.replace(/^\uFEFF/, "")), updatedAt: details.mtime.toISOString() };
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
};

const rootsFromEnv = (env) => String(env.GOTRADER_CERTIFIED_EVIDENCE_ROOTS || env.GOTRADER_REPO_ROOT || process.cwd())
  .split(";")
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => path.resolve(item));

const compactLrsReport = (report, filePath, updatedAt) => ({
  strategyId: report.strategyId,
  profileId: report.profileId,
  parameterHash: report.parameterHash,
  certificateId: report.certificateId,
  datasetId: report.datasetId,
  sourceFingerprint: report.sourceFingerprint,
  reportId: report.reportId,
  reportUpdatedAt: updatedAt,
  evidenceType: report.schemaVersion,
  status: report.status,
  coverage: { startUtc: report.startUtc, endUtc: report.endUtc },
  descriptiveMetrics: {
    tradeCount: report.tradeCount,
    filledTradeCount: report.filledTradeCount,
    averageNetR: report.metrics?.averageNetR,
    netWinRate: report.metrics?.netWinRate,
    maxDrawdownR: report.metrics?.maxDrawdownR,
    profitFactor: report.metrics?.profitFactor
  },
  researchValidated: report.researchValidated === true,
  productionAdoptionAllowed: report.productionAdoptionAllowed === true,
  proposalAllowed: false,
  evidenceClass: "historical_certified_evidence",
  authority: GOTRADER_AGENT_AUTHORITY,
  sourceFile: path.basename(filePath)
});

export const discoverCertifiedProfiles = async ({ env = process.env, now = new Date().toISOString() } = {}) => {
  const profiles = [];
  const warnings = [];
  for (const root of rootsFromEnv(env)) {
    const candidates = [
      path.join(root, ".gotrader", "liquidity-reclaim-scalper-v1", "certified-baseline-v1", "baseline-report.json"),
      path.join(root, ".gotrader", "liquidity-reclaim-scalper-v1", "certified-baseline-v2", "baseline-report.json"),
      path.join(root, ".gotrader", "liquidity-reclaim-scalper-v1", "r1-family-v1", "family-report.json")
    ];
    for (const filePath of candidates) {
      const record = await readJson(filePath);
      if (!record) continue;
      const report = record.value;
      const isLrs = report?.strategyId === "liquidity_reclaim_scalper_v1" && report?.profileId === "liquidity_reclaim_scalper_v1_base_research";
      const safe = authorityIsNone(report?.authority) && report?.rawCandlesSerialized !== true && report?.mt5Contacted !== true;
      const identityComplete = Boolean(report?.parameterHash && report?.certificateId && report?.datasetId && report?.reportId);
      if (!isLrs || !safe || !identityComplete) {
        warnings.push(`rejected_unrecognized_or_unsafe_evidence:${path.basename(filePath)}`);
        continue;
      }
      profiles.push(compactLrsReport(report, filePath, record.updatedAt));
    }
  }
  const unique = [...new Map(profiles.map((profile) => [`${profile.reportId}:${profile.parameterHash}`, profile])).values()];
  return withAgentProvenance({
    status: unique.length ? "available" : "unavailable",
    profiles: unique,
    count: unique.length,
    blockers: unique.length ? [] : ["certified_profile_evidence_not_found"],
    warnings
  }, {
    toolName: "gotrader_list_certified_profiles",
    evidenceClass: "historical_certified_evidence",
    source: "configured_certified_evidence_roots",
    generatedAt: now,
    freshness: { status: "historical", fresh: false }
  });
};
