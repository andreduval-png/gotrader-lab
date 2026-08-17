import type { ResearchEvidenceCycleRecord } from "@/lib/researchEvidenceLedger";
import type { CalibrationProposal } from "@/lib/selfImprovement/selfImprovementTypes";
import {
  gotraderResearchMemoryAuthorityNone,
  gotraderResearchMemoryExcludedSections,
  type GoTraderAgentMetricMemory,
  type GoTraderGapAnalysisMemory,
  type GoTraderResearchMemoryBase,
  type GoTraderResearchMemoryMetricStatus,
  type GoTraderResearchMemoryPacket,
  type GoTraderSelfImprovementMemory,
  type GoTraderWalkForwardMemory
} from "./researchMemoryTypes";

const compactId = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 120);

const uniqueText = (values: Array<string | undefined>, limit = 12) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].slice(0, limit);

const metricStatusFor = (provider: string, sampleSize: number): GoTraderResearchMemoryMetricStatus =>
  /mock|sample/i.test(provider) ? "mock" : sampleSize > 0 ? "simulated" : "insufficient";

const baseFromEvidence = (record: ResearchEvidenceCycleRecord): GoTraderResearchMemoryBase => ({
  packetId: `gbrain_memory_${record.evidenceId}`,
  timestamp: record.completedAt,
  memoryType: "research_cycle",
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
    metricStatus: metricStatusFor(record.source.provider, record.performance.tradeCount)
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
});

export function buildSupplementalEvidenceMemoryPackets(
  record: ResearchEvidenceCycleRecord
): GoTraderResearchMemoryPacket[] {
  const base = baseFromEvidence(record);
  const packets: GoTraderResearchMemoryPacket[] = [];

  if (
    record.validation.walkForwardRunId ||
    record.validation.walkForwardVerdict ||
    record.validation.walkForwardWindowsTested > 0
  ) {
    packets.push({
      ...base,
      packetId: `gbrain_memory_walk_forward_${compactId(record.validation.walkForwardRunId ?? record.evidenceId)}`,
      memoryType: "walk_forward",
      runId: record.validation.walkForwardRunId,
      splitSummary: `${record.validation.walkForwardWindowsPassed}/${record.validation.walkForwardWindowsTested} out-of-sample windows passed; ${record.validation.walkForwardOosTrades} OOS trades.`,
      outOfSampleWindowsPassed: record.validation.walkForwardWindowsPassed,
      windowsTested: record.validation.walkForwardWindowsTested
    } satisfies GoTraderWalkForwardMemory);
  }

  if (record.blockers.length || record.promotionBlockers.length || record.validation.edgeFlags.length) {
    packets.push({
      ...base,
      packetId: `gbrain_memory_gap_analysis_${compactId(record.evidenceId)}`,
      memoryType: "gap_analysis",
      recurringGapIds: uniqueText(
        [...record.blockers, ...record.promotionBlockers].map((blocker) => compactId(blocker)),
        16
      ),
      missingEvidence: uniqueText([
        ...record.promotionBlockers,
        ...record.validation.edgeFlags,
        ...record.blockers
      ], 16),
      recommendedExperiments: uniqueText([record.nextAction], 6)
    } satisfies GoTraderGapAnalysisMemory);
  }

  if (record.proposal.proposalId) {
    packets.push({
      ...base,
      packetId: `gbrain_memory_self_improvement_${compactId(record.proposal.proposalId)}_${compactId(record.proposal.proposalStatus ?? "unknown")}`,
      memoryType: "self_improvement",
      proposalId: record.proposal.proposalId,
      proposalStatus: record.proposal.proposalStatus,
      beforeAfterDelta: "Current cycle evidence references this proposal; proposal metrics remain authoritative in the Self-Improvement ledger.",
      regressionWarnings: uniqueText(record.validation.edgeFlags, 12)
    } satisfies GoTraderSelfImprovementMemory);
  }

  const seenAgents = new Set<string>();
  (record.agentMetrics ?? [])
    .filter((agent) => agent.agentId && agent.totalOpinions > 0)
    .sort((left, right) => right.totalOpinions - left.totalOpinions || left.agentId.localeCompare(right.agentId))
    .slice(0, 12)
    .forEach((agent) => {
      if (seenAgents.has(agent.agentId)) return;
      seenAgents.add(agent.agentId);
      packets.push({
        ...base,
        packetId: `gbrain_memory_agent_metric_${compactId(record.evidenceId)}_${compactId(agent.agentId)}`,
        memoryType: "agent_metric",
        agentId: agent.agentId,
        agentLabel: agent.agentLabel,
        metricStatus: metricStatusFor(record.source.provider, agent.totalOpinions),
        sampleSize: agent.totalOpinions,
        averageConfidence: agent.averageConfidence,
        averageWeight: agent.averageWeight,
        cioAlignmentRate: agent.cioAlignmentRate,
        totalOpinions: agent.totalOpinions,
        lastUpdatedCycleId: record.cycleId,
        regimeContext: record.context.regime,
        metrics: {
          ...base.metrics,
          sampleSize: agent.totalOpinions,
          winRate: null,
          averageR: null,
          metricStatus: metricStatusFor(record.source.provider, agent.totalOpinions)
        }
      } satisfies GoTraderAgentMetricMemory);
    });

  return packets;
}

const proposalStateTimestamp = (proposal: CalibrationProposal) =>
  proposal.autoAppliedAt ?? proposal.revertedAt ?? proposal.rejectedAt ?? proposal.approvedAt ?? proposal.testedAt ?? proposal.timestamp;

export function buildSelfImprovementMemoryPacket(
  proposal: CalibrationProposal
): GoTraderSelfImprovementMemory {
  const provenance = proposal.afterMetrics?.provenance ?? proposal.beforeMetrics.provenance;
  const sourceContext = proposal.proposalIntentDetails?.sourceContext;
  const stateTimestamp = proposalStateTimestamp(proposal);
  const sourceProvider = provenance?.sourceProvider ?? sourceContext?.provider ?? "unknown";
  const before = proposal.beforeMetrics;
  const after = proposal.afterMetrics;
  const blockers = uniqueText([
    ...(proposal.notReadyReasons ?? []),
    ...(proposal.autoApplyBlockedReasons ?? []),
    ...(proposal.comparisonResult?.criticalRegressions ?? [])
  ], 16);

  return {
    packetId: `gbrain_memory_self_improvement_${compactId(proposal.proposalId)}_${compactId(proposal.status)}_${compactId(stateTimestamp)}`,
    timestamp: stateTimestamp,
    memoryType: "self_improvement",
    proposalId: proposal.proposalId,
    proposalStatus: proposal.status,
    beforeAfterDelta: after
      ? `Average R ${before.averageR} -> ${after.averageR}; drawdown ${before.maxDrawdown} -> ${after.maxDrawdown}; stability ${before.stabilityScore} -> ${after.stabilityScore}.`
      : "Draft or untested proposal; no after-metrics are available.",
    regressionWarnings: uniqueText([
      ...(proposal.comparisonResult?.criticalRegressions ?? []),
      ...(proposal.comparisonResult?.sanityWarnings ?? [])
    ], 12),
    source: {
      provider: sourceProvider,
      sourceLabel: sourceContext?.dataSourceLabel ?? sourceProvider,
      requestedSymbol: provenance?.requestedSymbol ?? sourceContext?.requestedSymbol ?? proposal.baselineConfig.symbol,
      brokerSymbol: provenance?.brokerSymbol ?? sourceContext?.brokerSymbol,
      timeframe: provenance?.timeframe ?? sourceContext?.timeframe ?? proposal.baselineConfig.timeframe,
      candleCount: sourceContext?.candleCount ?? 0,
      sourceFingerprint: provenance?.sourceFingerprint ?? sourceContext?.sourceFingerprint,
      eligibilityReasons: [],
      warnings: []
    },
    regime: {
      label: sourceContext?.regimeLabel ?? proposal.baselineConfig.marketRegime,
      confidence: null,
      dataQuality: sourceContext?.regimeDataQuality ?? "unknown",
      transitionPending: false,
      candleCount: sourceContext?.candleCount ?? 0,
      missingInputs: [],
      supportingFactors: [],
      warnings: [],
      sourceFingerprint: provenance?.sourceFingerprint ?? sourceContext?.sourceFingerprint
    },
    ictThesis: proposal.proposalIntent === "ict_research_hypothesis_intent"
      ? { summary: proposal.reason }
      : null,
    grinch: {
      profile: proposal.baselineConfig.strategyProfile,
      state: proposal.proposalIntent,
      detail: proposal.reason
    },
    metrics: {
      netR: null,
      averageR: after?.averageR ?? before.averageR,
      profitFactor: after?.profitFactor ?? before.profitFactor,
      winRate: after?.winRate ?? before.winRate,
      maxDrawdownR: after?.maxDrawdown ?? before.maxDrawdown,
      sampleSize: after?.totalTrades ?? before.totalTrades,
      falsePositiveRate: null,
      processedCandles: 0,
      rawCandles: 0,
      metricStatus: metricStatusFor(sourceProvider, after?.totalTrades ?? before.totalTrades)
    },
    readiness: {
      state: after?.readinessStatus ?? before.readinessStatus,
      recommendedNextStep: proposal.nextValidationRequirement ?? proposal.expectedImprovement,
      failedRequirements: blockers,
      warnings: proposal.safetyNotes
    },
    evidenceMaturity: {
      evidenceScore: null,
      maturityScore: null,
      weakestEvidenceCategories: blockers,
      maturityWarnings: []
    },
    walkForwardVerdict: null,
    blockers,
    nextAction: proposal.nextValidationRequirement ?? proposal.expectedImprovement,
    memoryIdentity: {
      researchCycleId: proposal.metricsSnapshot?.sourceCycleId,
      profileId: provenance?.strategyProfile ?? proposal.baselineConfig.strategyProfile,
      profileVersion: provenance?.strategyProfileVersion,
      parameterFingerprint: provenance?.parameterFingerprint,
      outcome: proposal.status
    },
    authority: gotraderResearchMemoryAuthorityNone,
    exclusions: gotraderResearchMemoryExcludedSections
  };
}
