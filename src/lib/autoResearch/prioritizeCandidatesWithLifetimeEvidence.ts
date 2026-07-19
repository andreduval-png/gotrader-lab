import type {
  AutoResearchCandidateConfig,
  AutoResearchLifetimeBlockerFamily,
  AutoResearchLifetimeCandidateDecision,
  AutoResearchLifetimeExperimentPlan,
  AutoResearchSearchMode
} from "@/lib/autoResearch/autoResearchTypes";
import type {
  ResearchEvidenceAggregate,
  ResearchEvidenceAggregateIndex
} from "@/lib/researchEvidenceLedger";
import { fingerprintValidationParameters } from "@/lib/validationProvenance";
import type { ValidationProvenanceIdentity } from "@/lib/validationProvenance";

const authorityNone = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

const normalize = (value?: string) => String(value ?? "").trim().toLowerCase();

export const classifyLifetimeBlocker = (blocker: string): AutoResearchLifetimeBlockerFamily => {
  const value = normalize(blocker);
  if (/walk.?forward|out.?of.?sample|\boos\b|independent|sample|trade count|monte carlo/.test(value)) return "evidence_depth";
  if (/drawdown|conservative|false.?positive|overfit|risk policy|instability/.test(value)) return "risk_stability";
  if (/session|kill.?zone|opening.?price/.test(value)) return "session_consistency";
  if (/confidence|calibration/.test(value)) return "confidence_calibration";
  if (/regime|higher.?timeframe|\bhtf\b|missing.*timeframe|macro|intermarket/.test(value)) return "context_quality";
  if (/evidence|maturity|readiness|runbook|advisory/.test(value)) return "validation_depth";
  return "other";
};

const sourceCompatible = (
  aggregate: ResearchEvidenceAggregate,
  identity?: ValidationProvenanceIdentity
) => Boolean(
  identity?.sourceProvider &&
  identity.requestedSymbol &&
  identity.timeframe &&
  normalize(aggregate.identity.sourceProvider) === normalize(identity.sourceProvider) &&
  normalize(aggregate.identity.requestedSymbol) === normalize(identity.requestedSymbol) &&
  normalize(aggregate.identity.timeframe) === normalize(identity.timeframe) &&
  (!identity.brokerSymbol || normalize(aggregate.identity.brokerSymbol) === normalize(identity.brokerSymbol))
);

const candidateAggregate = (
  candidate: AutoResearchCandidateConfig,
  aggregates: ResearchEvidenceAggregate[],
  identity?: ValidationProvenanceIdentity
) => {
  if (!identity) return undefined;
  const profile = candidate.config.strategyProfile ?? "agent_consensus";
  const parameterFingerprint = fingerprintValidationParameters(candidate.config);
  return aggregates.find((aggregate) =>
    sourceCompatible(aggregate, identity) &&
    aggregate.identity.strategyProfile === profile &&
    aggregate.identity.parameterFingerprint === parameterFingerprint
  );
};

const isProvenFailedIdentity = (aggregate: ResearchEvidenceAggregate) =>
  aggregate.totalTrades >= 20 &&
  aggregate.independentCycleDates >= 3 &&
  aggregate.weightedAverageR <= 0 &&
  aggregate.negativeEdgeCycles >= Math.max(1, aggregate.positiveEdgeCycles);

const candidateTargetsFamily = (
  candidate: AutoResearchCandidateConfig,
  family: AutoResearchLifetimeBlockerFamily
) => {
  const fields = new Set(candidate.changedParameters);
  const text = `${candidate.label} ${candidate.rationale}`.toLowerCase();
  if (family === "evidence_depth" || family === "validation_depth") {
    return fields.has("strategyProfile") || Boolean(candidate.candidateFamily);
  }
  if (family === "risk_stability") {
    return ["confluenceThreshold", "confidenceThreshold", "stopModel", "targetModel", "sessionFilter"]
      .some((field) => fields.has(field)) || /strict|conservative|stability|risk/.test(text);
  }
  if (family === "session_consistency") return fields.has("sessionFilter") || /session|kill.?zone|opening/.test(text);
  if (family === "confidence_calibration") {
    return fields.has("confidenceThreshold") || fields.has("agentWeights") || /confidence|calibration/.test(text);
  }
  return false;
};

const decisionFor = ({
  candidate,
  aggregate,
  activeBlockerFamilies,
  searchMode,
  identityAvailable
}: {
  candidate: AutoResearchCandidateConfig;
  aggregate?: ResearchEvidenceAggregate;
  activeBlockerFamilies: AutoResearchLifetimeBlockerFamily[];
  searchMode: AutoResearchSearchMode;
  identityAvailable: boolean;
}): AutoResearchLifetimeCandidateDecision => {
  const targeted = activeBlockerFamilies.filter((family) => candidateTargetsFamily(candidate, family));
  if (aggregate && isProvenFailedIdentity(aggregate)) {
    const diagnostic = searchMode === "deep";
    return {
      disposition: diagnostic ? "regression_diagnostic_only" : "deprioritize_failed_identity",
      priorityScore: diagnostic ? -80 : -100,
      compatibleIdentityFound: true,
      compatibleIdentityKey: aggregate.identity.identityKey,
      historicalCycles: aggregate.cycleCount,
      historicalTrades: aggregate.totalTrades,
      independentCycleDates: aggregate.independentCycleDates,
      weightedAverageR: aggregate.weightedAverageR,
      positiveEdgeCycles: aggregate.positiveEdgeCycles,
      negativeEdgeCycles: aggregate.negativeEdgeCycles,
      targetedBlockerFamilies: targeted,
      reason: diagnostic
        ? "This exact parameter identity has repeated negative evidence and is retained only for an explicit deep regression diagnostic."
        : "This exact parameter identity has repeated negative evidence across independent dates and is skipped in normal searches.",
      excludedFromNormalSearch: !diagnostic,
      historicalContextOnly: true
    };
  }

  if (aggregate) {
    const positive = aggregate.weightedAverageR > 0 && aggregate.positiveEdgeCycles > aggregate.negativeEdgeCycles;
    const negativeLean = aggregate.weightedAverageR <= 0 || aggregate.negativeEdgeCycles > aggregate.positiveEdgeCycles;
    const blockerBoost = negativeLean ? 0 : targeted.length * 15;
    return {
      disposition: targeted.length && !negativeLean
        ? "prioritize_unresolved_blocker"
        : positive
          ? "prioritize_positive_identity"
          : "neutral_insufficient_history",
      priorityScore: (positive ? 45 : negativeLean ? 0 : 10) + blockerBoost,
      compatibleIdentityFound: true,
      compatibleIdentityKey: aggregate.identity.identityKey,
      historicalCycles: aggregate.cycleCount,
      historicalTrades: aggregate.totalTrades,
      independentCycleDates: aggregate.independentCycleDates,
      weightedAverageR: aggregate.weightedAverageR,
      positiveEdgeCycles: aggregate.positiveEdgeCycles,
      negativeEdgeCycles: aggregate.negativeEdgeCycles,
      targetedBlockerFamilies: targeted,
      reason: targeted.length && !negativeLean
        ? `Compatible lifetime evidence exists and this experiment targets ${targeted.join(", ")}.`
        : positive
          ? "Compatible lifetime evidence is positive; prioritize confirmation on another independent cycle."
          : negativeLean
            ? "Compatible history leans negative but has not met the independent-sample failure gate; keep it neutral and unpromoted."
            : "Compatible history is not decisive enough to prioritize or reject this identity.",
      excludedFromNormalSearch: false,
      historicalContextOnly: true
    };
  }

  return {
    disposition: identityAvailable
      ? targeted.length
        ? "prioritize_unresolved_blocker"
        : "explore_unseen_identity"
      : "neutral_insufficient_history",
    priorityScore: targeted.length * 15 + (identityAvailable ? 20 : 0),
    compatibleIdentityFound: false,
    historicalCycles: 0,
    historicalTrades: 0,
    independentCycleDates: 0,
    positiveEdgeCycles: 0,
    negativeEdgeCycles: 0,
    targetedBlockerFamilies: targeted,
    reason: identityAvailable
      ? targeted.length
        ? `This is an unseen compatible experiment that targets ${targeted.join(", ")}.`
        : "No exact compatible profile and parameter history exists; treat this as a bounded new experiment."
      : "Active source identity is incomplete, so lifetime evidence cannot safely influence this candidate.",
    excludedFromNormalSearch: false,
    historicalContextOnly: true
  };
};

export function prioritizeCandidatesWithLifetimeEvidence({
  candidates,
  aggregateIndex,
  activeIdentity,
  searchMode
}: {
  candidates: AutoResearchCandidateConfig[];
  aggregateIndex: ResearchEvidenceAggregateIndex;
  activeIdentity?: ValidationProvenanceIdentity;
  searchMode: AutoResearchSearchMode;
}) {
  const compatibleActiveAggregates = aggregateIndex.aggregates.filter((aggregate) =>
    sourceCompatible(aggregate, activeIdentity) &&
    (!activeIdentity?.strategyProfile || aggregate.identity.strategyProfile === activeIdentity.strategyProfile) &&
    (!activeIdentity?.parameterFingerprint || aggregate.identity.parameterFingerprint === activeIdentity.parameterFingerprint)
  );
  const recurringBlockers = compatibleActiveAggregates
    .flatMap((aggregate) => aggregate.recurringBlockers)
    .reduce<Array<{ blocker: string; occurrences: number; family: AutoResearchLifetimeBlockerFamily }>>((items, item) => {
      const existing = items.find((entry) => normalize(entry.blocker) === normalize(item.blocker));
      if (existing) existing.occurrences += item.occurrences;
      else items.push({ ...item, family: classifyLifetimeBlocker(item.blocker) });
      return items;
    }, [])
    .sort((left, right) => right.occurrences - left.occurrences)
    .slice(0, 8);
  const blockerFamilies = [...new Set(recurringBlockers.map((item) => item.family))];
  const identityAvailable = Boolean(activeIdentity?.sourceProvider && activeIdentity.requestedSymbol && activeIdentity.timeframe);
  const annotated = candidates.map((candidate, originalIndex) => {
    const aggregate = candidateAggregate(candidate, aggregateIndex.aggregates, activeIdentity);
    const lifetimeEvidenceDecision = decisionFor({
      candidate,
      aggregate,
      activeBlockerFamilies: blockerFamilies,
      searchMode,
      identityAvailable
    });
    return { candidate: { ...candidate, lifetimeEvidenceDecision }, originalIndex };
  });
  const ranked = annotated
    .filter(({ candidate }) => !candidate.lifetimeEvidenceDecision?.excludedFromNormalSearch)
    .sort((left, right) =>
      (right.candidate.lifetimeEvidenceDecision?.priorityScore ?? 0) -
        (left.candidate.lifetimeEvidenceDecision?.priorityScore ?? 0) ||
      left.originalIndex - right.originalIndex
    )
    .map(({ candidate }) => candidate);
  const excluded = annotated
    .filter(({ candidate }) => candidate.lifetimeEvidenceDecision?.excludedFromNormalSearch)
    .map(({ candidate }) => candidate);
  const plan: AutoResearchLifetimeExperimentPlan = {
    generatedAt: new Date().toISOString(),
    activeIdentity,
    aggregateRecordsAvailable: aggregateIndex.totalRecords,
    compatibleActiveProfileFound: compatibleActiveAggregates.length > 0,
    recurringBlockers,
    prioritizedCandidateIds: ranked.map((candidate) => candidate.candidateId),
    excludedCandidateIds: excluded.map((candidate) => candidate.candidateId),
    summary: !identityAvailable
      ? "Lifetime experiment selection stayed neutral because the active source identity was incomplete."
      : excluded.length
        ? `Lifetime evidence prioritized ${ranked.length} candidate(s) and skipped ${excluded.length} exact failed parameter identity candidate(s).`
        : recurringBlockers.length
          ? `Lifetime evidence prioritized experiments against recurring blockers: ${recurringBlockers.map((item) => item.family).join(", ")}.`
          : "No compatible recurring blocker history was available; bounded unseen experiments remain eligible.",
    researchOnly: true,
    authority: authorityNone
  };
  return { candidates: ranked, excludedCandidates: excluded, plan };
}
