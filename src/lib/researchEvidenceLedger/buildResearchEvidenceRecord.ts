import type { ResearchCycleRun } from "@/lib/researchCycle/researchCycleTypes";
import type { GoTraderResearchCycleMemory } from "@/lib/researchMemory/researchMemoryTypes";
import {
  gotraderResearchMemoryAuthorityNone,
  gotraderResearchMemoryExcludedSections
} from "@/lib/researchMemory/researchMemoryTypes";
import type {
  ResearchEvidenceCycleRecord,
  ResearchEvidenceResultClass
} from "./researchEvidenceLedgerTypes";
import {
  researchEvidenceAuthorityNone,
  researchEvidenceSafety
} from "./researchEvidenceLedgerTypes";

const uniqueText = (values: Array<string | undefined>, limit = 12) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].slice(0, limit);

const safeNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const profileFor = (run: ResearchCycleRun) =>
  run.validationSummary?.provenance?.strategyProfile ??
  run.validationReport?.provenance?.strategyProfile ??
  run.latestGeneratedProposal?.proposedConfig?.strategyProfile ??
  "unclassified_research_profile";

const resultClassFor = (run: ResearchCycleRun): ResearchEvidenceResultClass => {
  const trades = safeNumber(run.canonicalMetrics?.totalTrades ?? run.backtestSummary?.totalTrades);
  const averageR = safeNumber(run.canonicalMetrics?.averageR ?? run.backtestSummary?.averageR);
  const edgeVerdict = run.edgeAuditorSummary?.verdict ?? run.backtestSummary?.edgeStatistics?.verdict;
  if (trades === 0) return "no_sample";
  if (edgeVerdict === "positive_edge") return "positive_edge";
  if (trades < 20 && averageR > 0) return "promising_small_sample";
  if (averageR <= 0 || edgeVerdict === "no_edge") return "negative_edge";
  return "inconclusive";
};

const identityKeyFor = (parts: Array<string | undefined>) =>
  parts.map((part) => String(part ?? "unknown").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_")).join("|");

export function buildResearchEvidenceRecord(run: ResearchCycleRun): ResearchEvidenceCycleRecord {
  const provenance = run.validationSummary?.provenance ?? run.validationReport?.provenance;
  const metrics = run.canonicalMetrics;
  const profile = profileFor(run);
  const requestedSymbol = provenance?.requestedSymbol ?? metrics?.symbol ?? run.thesisSummary?.symbol ?? "unknown";
  const brokerSymbol = provenance?.brokerSymbol;
  const timeframe = provenance?.timeframe ?? metrics?.timeframe ?? run.researchTimeframe ?? "unknown";
  const provider = provenance?.sourceProvider ?? run.dataSourceMode ?? "unknown";
  const sourceFingerprint =
    provenance?.sourceFingerprint ??
    run.validationEvidenceSourceFingerprint ??
    run.sourceMetadata?.activeSourceFingerprint ??
    run.automatedEvidenceSummary?.sourceFingerprint ??
    "missing";
  const completedAt = run.completedAt ?? new Date().toISOString();
  const tradeCount = safeNumber(metrics?.totalTrades ?? run.backtestSummary?.totalTrades);
  const wins = safeNumber(metrics?.winningTrades ?? run.backtestSummary?.wins);
  const losses = safeNumber(metrics?.losingTrades ?? run.backtestSummary?.losses);

  return {
    schemaVersion: 1,
    evidenceId: `research_evidence_${run.cycleId}`,
    cycleId: run.cycleId,
    startedAt: run.startedAt,
    completedAt,
    cycleStatus: run.status,
    identity: {
      identityKey: identityKeyFor([
        profile,
        provenance?.strategyProfileVersion,
        provenance?.parameterFingerprint,
        requestedSymbol,
        brokerSymbol,
        timeframe,
        provider
      ]),
      strategyProfile: profile,
      strategyProfileVersion: provenance?.strategyProfileVersion,
      parameterFingerprint: provenance?.parameterFingerprint,
      requestedSymbol,
      brokerSymbol,
      timeframe,
      sourceProvider: provider
    },
    source: {
      provider,
      label: run.dataSourceLabel ?? run.sourceMetadata?.activeSourceLabel ?? provider,
      sourceFingerprint,
      candleCount: safeNumber(run.validationEvidenceCandleCount ?? run.sourceMetadata?.candleCount ?? run.rawCandleCount),
      processedCandleCount: safeNumber(run.processedCandleCount),
      requestedLookbackDays: run.validationEvidenceRequestedLookbackDays,
      availableLookbackDays: run.validationEvidenceLookbackDays,
      dataRangeStart: provenance?.dataRangeStart ?? run.sourceMetadata?.firstTimestamp,
      dataRangeEnd: provenance?.dataRangeEnd ?? run.sourceMetadata?.lastTimestamp,
      eligibility: run.sourceMetadata?.researchEligibility,
      warnings: uniqueText([...(run.sourceMetadata?.sourceWarnings ?? []), ...(run.candleWindowWarnings ?? [])], 8)
    },
    context: {
      regime: run.regimeSummary?.stableLabel ?? run.regimeSummary?.label,
      regimeConfidence: run.regimeSummary?.confidence,
      regimeDataQuality: run.regimeSummary?.dataQuality,
      setup: run.ictAdvisorSignalSummary?.setup,
      side: run.ictAdvisorSignalSummary?.side,
      thesisBias: run.thesisSummary?.bias,
      advisoryStatus: run.llmRun
        ? "available"
        : run.llmAdvisoryUnavailable
          ? "unavailable"
          : run.llmBridgeAvailable
            ? "skipped"
            : "unknown"
    },
    performance: {
      tradeCount,
      winningTrades: wins,
      losingTrades: losses,
      winRate: safeNumber(metrics?.winRate ?? run.backtestSummary?.winRate),
      averageR: safeNumber(metrics?.averageR ?? run.backtestSummary?.averageR),
      realizedR: safeNumber(metrics?.realizedR ?? run.backtestSummary?.realizedR),
      profitFactor: metrics?.profitFactor ?? run.backtestSummary?.profitFactor ?? null,
      maxDrawdownR: safeNumber(metrics?.maxDrawdownR ?? run.backtestSummary?.maxDrawdown),
      falsePositiveCount: safeNumber(metrics?.falsePositiveCount),
      skippedSignals: safeNumber(metrics?.skippedSignals ?? run.backtestSummary?.skippedSignals)
    },
    validation: {
      validationId: run.validationSummary?.validationId,
      readinessScore: run.validationSummary?.readinessScore,
      researchQualityGrade: run.researchQualitySummary?.readinessGrade,
      researchQualityScore: run.researchQualitySummary?.readinessScore,
      walkForwardRunId: provenance?.walkForwardRunId,
      walkForwardVerdict: run.automatedEvidenceSummary?.walkForwardVerdict,
      walkForwardOosTrades: safeNumber(run.automatedEvidenceSummary?.walkForwardOosTrades),
      walkForwardWindowsPassed: safeNumber(run.automatedEvidenceSummary?.walkForwardWindowsPassed),
      walkForwardWindowsTested: safeNumber(run.automatedEvidenceSummary?.walkForwardWindowsTested),
      edgeVerdict: run.edgeAuditorSummary?.verdict ?? run.backtestSummary?.edgeStatistics?.verdict,
      edgeFlags: uniqueText(run.edgeAuditorSummary?.overfitFlags ?? [], 8),
      monteCarloUsableOutcomes: safeNumber(run.automatedEvidenceSummary?.monteCarloUsableOutcomes),
      monteCarloRobustness: run.automatedEvidenceSummary?.monteCarloRobustness
    },
    evidenceMaturity: {
      evidenceScore: run.evidenceSummary?.evidenceScore,
      maturityScore: run.maturitySummary?.maturityScore,
      maturityGrade: run.maturitySummary?.maturityGrade,
      readinessState: run.readinessSnapshot?.state
    },
    proposal: {
      proposalId: run.createdProposalId,
      proposalStatus: run.proposalStatus,
      activeCalibrationId: run.activeCalibrationId
    },
    resultClass: resultClassFor(run),
    blockers: uniqueText(run.blockers ?? [], 12),
    promotionBlockers: uniqueText(run.promotionBlockers ?? [], 12),
    nextAction: run.nextRecommendedAction,
    resultSummary: run.resultSummary,
    researchOnly: true,
    authority: researchEvidenceAuthorityNone,
    safety: researchEvidenceSafety
  };
}

export function buildResearchEvidenceMemoryPacket(
  record: ResearchEvidenceCycleRecord
): GoTraderResearchCycleMemory {
  return {
    packetId: `gbrain_memory_${record.evidenceId}`,
    timestamp: record.completedAt,
    memoryType: "research_cycle",
    cycleId: record.cycleId,
    cycleStatus: record.cycleStatus as GoTraderResearchCycleMemory["cycleStatus"],
    completedAt: record.completedAt,
    resultSummary: record.resultSummary,
    advisoryStatus: record.context.advisoryStatus,
    sourceEligibility: record.source.eligibility,
    source: {
      provider: record.source.provider,
      sourceLabel: record.source.label,
      requestedSymbol: record.identity.requestedSymbol,
      brokerSymbol: record.identity.brokerSymbol,
      timeframe: record.identity.timeframe,
      candleCount: record.source.candleCount,
      firstTimestamp: record.source.dataRangeStart,
      lastTimestamp: record.source.dataRangeEnd,
      sourceFingerprint: record.source.sourceFingerprint,
      sourceEligibility: record.source.eligibility,
      eligibilityReasons: [],
      warnings: record.source.warnings
    },
    regime: {
      label: record.context.regime ?? "unknown",
      stableLabel: record.context.regime,
      confidence: record.context.regimeConfidence ?? null,
      dataQuality: record.context.regimeDataQuality ?? "unknown",
      transitionPending: false,
      candleCount: record.source.processedCandleCount,
      missingInputs: [],
      supportingFactors: [],
      warnings: [],
      sourceFingerprint: record.source.sourceFingerprint
    },
    ictThesis: record.context.thesisBias
      ? { bias: record.context.thesisBias, summary: record.resultSummary }
      : null,
    grinch: {
      profile: record.identity.strategyProfile,
      state: record.context.setup,
      entryIntent: record.context.side,
      detail: record.resultSummary
    },
    metrics: {
      netR: record.performance.realizedR,
      averageR: record.performance.averageR,
      profitFactor: record.performance.profitFactor,
      winRate: record.performance.winRate,
      maxDrawdownR: record.performance.maxDrawdownR,
      sampleSize: record.performance.tradeCount,
      falsePositiveRate: record.performance.tradeCount
        ? record.performance.falsePositiveCount / record.performance.tradeCount
        : null,
      processedCandles: record.source.processedCandleCount,
      rawCandles: record.source.candleCount,
      metricStatus: record.source.provider.includes("mock") ? "mock" : record.performance.tradeCount ? "simulated" : "insufficient"
    },
    readiness: {
      state: record.evidenceMaturity.readinessState ?? "Not Ready",
      recommendedNextStep: record.nextAction,
      failedRequirements: record.promotionBlockers,
      warnings: record.blockers
    },
    evidenceMaturity: {
      evidenceScore: record.evidenceMaturity.evidenceScore ?? null,
      maturityScore: record.evidenceMaturity.maturityScore ?? null,
      maturityGrade: record.evidenceMaturity.maturityGrade,
      weakestEvidenceCategories: record.blockers,
      maturityWarnings: record.promotionBlockers
    },
    walkForwardVerdict: record.validation.walkForwardVerdict
      ? {
          runId: record.validation.walkForwardRunId,
          verdict: record.validation.walkForwardVerdict,
          windowsTested: record.validation.walkForwardWindowsTested,
          outOfSampleWindowsPassed: record.validation.walkForwardWindowsPassed,
          warnings: []
        }
      : null,
    blockers: uniqueText([...record.blockers, ...record.promotionBlockers], 16),
    nextAction: record.nextAction,
    memoryIdentity: {
      evidenceRecordId: record.evidenceId,
      researchCycleId: record.cycleId,
      profileId: record.identity.strategyProfile,
      profileVersion: record.identity.strategyProfileVersion,
      parameterFingerprint: record.identity.parameterFingerprint,
      outcome: record.resultClass
    },
    authority: gotraderResearchMemoryAuthorityNone,
    exclusions: gotraderResearchMemoryExcludedSections
  };
}

const forbiddenKeyPattern = /(?:^|_)(?:candles?|rawcandles?|raw_runtime_snapshot|rawsnapshots?|imported_ohlcv|account|orders?|positions?|password|secret|api_?key|token|screenshots?|base64)(?:$|_)/i;

export function assertResearchEvidenceRecordIsCompact(record: ResearchEvidenceCycleRecord) {
  const visit = (value: unknown, path: string): string[] => {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => visit(item, `${path}[${index}]`));
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [
      ...(forbiddenKeyPattern.test(key) ? [`${path}.${key}`] : []),
      ...visit(item, `${path}.${key}`)
    ]);
  };
  const blockedFields = visit(record, "record");
  if (blockedFields.length) {
    throw new Error(`Research evidence record contains forbidden fields: ${blockedFields.join(", ")}`);
  }
  if (
    record.authority.executionAuthority !== "none" ||
    record.authority.brokerAuthority !== "none" ||
    record.authority.readinessOverrideAuthority !== "none"
  ) {
    throw new Error("Research evidence authority must remain none / none / none.");
  }
  return true;
}
