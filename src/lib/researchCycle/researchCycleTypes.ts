import type { AutoResearchCycle, AutoResearchExecutionCheckpoint, AutoResearchProgressSnapshot, AutoResearchSearchMode } from "@/lib/autoResearch";
import type { DebatePosition } from "@/lib/agentDebate";
import type {
  BacktestConfig,
  BacktestSummary,
  ResolvedBacktestConfig,
  TradeGenerationDiagnostic,
  TradeQualityDiagnostic
} from "@/lib/backtesting";
import type { EdgeAuditorReview } from "@/lib/agents/edgeAuditorAgent";
import type { EdgeStatistics } from "@/lib/statistics/edgeStatistics";
import type { LLMAdvisoryRun } from "@/lib/llm";
import type { CandleWindowSettings, CandleDataSourceMode, ResearchPerformanceMode } from "@/lib/marketData";
import type { CanonicalPerformanceMetrics } from "@/lib/performance/canonicalMetrics";
import type { ReadinessGateSnapshot } from "@/lib/readiness";
import type { RegimeClassification } from "@/lib/regime";
import type { ResearchQualityReview } from "@/lib/researchQuality";
import type { CalibrationProposal, CalibrationProposalChanges } from "@/lib/selfImprovement";
import type { FuturesSymbol, MarketBias, Timeframe } from "@/lib/types";
import type { ValidationSuiteReport } from "@/lib/validation";
import type { ValidationProvenanceIdentity } from "@/lib/validationProvenance";

export type ResearchCycleStatus = "idle" | "running" | "completed" | "completed_with_warnings" | "failed" | "canceled";

export type ResearchCycleStepStatus =
  | "pending"
  | "running"
  | "passed"
  | "completed"
  | "warning"
  | "failed"
  | "skipped";

export type ResearchCycleStepId =
  | "thesis_generation"
  | "backtest"
  | "llm_advisory"
  | "auto_research"
  | "validation"
  | "walk_forward"
  | "research_quality"
  | "self_improvement"
  | "simulation_verification"
  | "readiness_gate"
  | "communications_audit";

export interface ResearchCycleStepResult {
  stepId: ResearchCycleStepId;
  label: string;
  status: ResearchCycleStepStatus;
  summary: string;
  detail?: string;
  warning?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ResearchCycleThesisSummary {
  thesisId: string;
  debateSessionId: string;
  generatedAt: string;
  symbol: FuturesSymbol;
  timeframe: Timeframe;
  bias: MarketBias;
  confidence: number;
  ictBias: MarketBias;
  confluenceScore: number;
  summary: string;
  invalidation: number;
  target: number;
}

export interface ResearchCycleBacktestSummary
  extends Pick<
    BacktestSummary,
    | "totalTrades"
    | "wins"
    | "losses"
    | "unresolved"
    | "winRate"
    | "realizedR"
    | "averageR"
    | "maxDrawdown"
    | "profitFactor"
    | "skippedSignals"
    | "grinchSummary"
  > {
  config: Pick<
    ResolvedBacktestConfig,
    | "symbol"
    | "timeframe"
    | "sessionFilter"
    | "minimumConfluenceThreshold"
    | "minimumConfidenceThreshold"
    | "targetRMultiple"
    | "stopModel"
  >;
  bestTradeR?: number;
  worstTradeR?: number;
  edgeStatistics?: EdgeStatistics;
}

export interface ResearchCycleValidationSummary {
  validationId: string;
  generatedAt: string;
  provenance?: ValidationProvenanceIdentity;
  readinessStatus: ValidationSuiteReport["calibration"]["readinessStatus"];
  readinessScore: number;
  strongestScenario: string;
  weakestScenario: string;
  recommendedConfluenceThreshold: number;
  recommendedConfidenceThreshold: number;
}

export interface ResearchCycleQualitySummary {
  reviewId: string;
  generatedAt: string;
  readinessGrade: ResearchQualityReview["readinessGrade"];
  readinessScore: number;
  topWeaknesses: string[];
  topStrengths: string[];
  recommendedNextStep: string;
}

export interface ResearchCycleCandidateSummary {
  candidateId: string;
  label: string;
  score: number;
  resultCategory: string;
  readinessEstimate: string;
}

export interface ResearchCycleAgentDebateSummary {
  sessionId: string;
  consensusReached: boolean;
  position: DebatePosition;
  probability: number;
  strongestDisagreement: string;
  minorityView: string;
}

export interface ResearchCycleRegimeSummary {
  label: RegimeClassification["stableLabel"];
  instantaneousLabel: RegimeClassification["instantaneousLabel"];
  stableLabel: RegimeClassification["stableLabel"];
  confidence: number;
  dataQuality: RegimeClassification["dataQuality"];
  transitionPending: boolean;
  candleCount: number;
  requiredCandleCount: number;
  missingInputs: string[];
  supportingFactors: string[];
  warnings: string[];
  sourceFingerprint: string;
}

export interface ResearchCycleEvidenceSummary {
  evidenceScore: number;
  realEvidenceCoverage: number;
  weakestEvidenceCategories: string[];
  readinessEvidenceWarnings: string[];
  nextDataImprovement: string;
}

export interface ResearchCycleMaturitySummary {
  maturityScore: number;
  maturityGrade: string;
  missingRequirements: string[];
  maturityWarnings: string[];
  nextMaturityRequirement: string;
}

/**
 * Compact summary of the ICT Strategy Suite advisor recognition that ran on
 * the same candles as the research cycle. Unifies the Lab pipeline with the
 * Advisor signal engine so both surfaces reason about the same setups.
 */
export interface ResearchCycleAdvisorSignalSummary {
  packetId: string;
  generatedAt: string;
  strategyId: string;
  setup: string;
  side: string;
  decision: string;
  confidence: number;
  compositeBias: string;
  approvedProfileStatus?: string;
  approvalScore?: number;
  entryZoneMidpoint?: number;
  target?: number;
  invalidation?: number;
  rrEstimate?: number;
  summary: string;
  noTradeReasons: string[];
  universalRecognitionLabel?: string;
  alignsWithThesis?: boolean;
  sourceFingerprint?: string;
}

export interface ResearchCycleSourceMetadata {
  activeSourceMode: CandleDataSourceMode;
  activeSourceLabel: string;
  activeSourceFingerprint: string;
  candleCount: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  firstClose?: number;
  lastClose?: number;
  researchEligibility?: string;
  eligibilityReasons: string[];
  sourceWarnings: string[];
  authority: {
    executionAuthority: "none";
    brokerAuthority: "none";
    readinessOverrideAuthority: "none";
  };
}

export interface ResearchCycleRun {
  cycleId: string;
  startedAt: string;
  completedAt?: string;
  status: ResearchCycleStatus;
  steps: ResearchCycleStepResult[];
  llmBridgeAvailable: boolean;
  llmAdvisoryUnavailable?: boolean;
  llmAdvisoryUnavailableReason?: string;
  candidateProgress?: AutoResearchProgressSnapshot;
  autoResearchCheckpoint?: AutoResearchExecutionCheckpoint;
  llmRun?: LLMAdvisoryRun;
  autoResearchCycle?: AutoResearchCycle;
  validationReport?: ValidationSuiteReport;
  researchQualityReview?: ResearchQualityReview;
  readinessSnapshot?: ReadinessGateSnapshot;
  thesisSummary?: ResearchCycleThesisSummary;
  backtestSummary?: ResearchCycleBacktestSummary;
  backtestDiagnostics?: TradeGenerationDiagnostic[];
  tradeQualityDiagnostics?: TradeQualityDiagnostic[];
  canonicalMetrics?: CanonicalPerformanceMetrics;
  dataSourceMode?: CandleDataSourceMode;
  dataSourceLabel?: string;
  rawCandleCount?: number;
  researchWindowCandles?: number;
  processedCandleCount?: number;
  researchTimeframe?: Timeframe;
  performanceMode?: ResearchPerformanceMode;
  researchPreset?: "mock" | "safe" | "standard" | "advanced";
  advancedFullResearchMode?: boolean;
  effectiveSearchMode?: AutoResearchSearchMode;
  effectiveMaxCandidateCount?: number;
  heavyAuditSkipped?: boolean;
  candleWindowSettings?: CandleWindowSettings;
  candleWindowWarnings?: string[];
  activeCalibrationId?: string;
  activeCalibrationApprovedAt?: string;
  activeCalibrationApplied?: boolean;
  activeCalibrationPatch?: CalibrationProposalChanges;
  activeCalibrationMergeStatus?: string;
  activeCalibrationMergeLabel?: string;
  activeCalibrationMergeError?: string;
  activeCalibrationSourceTrace?: string[];
  defaultConfluenceThreshold?: number;
  savedConfluenceThreshold?: number;
  finalBacktestConfluenceThreshold?: number;
  activeConfluenceThreshold?: number;
  validationSummary?: ResearchCycleValidationSummary;
  researchQualitySummary?: ResearchCycleQualitySummary;
  bestCandidateSummary?: ResearchCycleCandidateSummary;
  agentDebateConsensus?: ResearchCycleAgentDebateSummary;
  ictAdvisorSignalSummary?: ResearchCycleAdvisorSignalSummary;
  edgeAuditorSummary?: EdgeAuditorReview;
  regimeSummary?: ResearchCycleRegimeSummary;
  evidenceSummary?: ResearchCycleEvidenceSummary;
  maturitySummary?: ResearchCycleMaturitySummary;
  sourceMetadata?: ResearchCycleSourceMetadata;
  proposalStatus?: string;
  blockers?: string[];
  /** Promotion/readiness blockers (includes LLM advisory); separate from research completion blockers. */
  promotionBlockers?: string[];
  createdProposalId?: string;
  latestGeneratedProposal?: CalibrationProposal;
  failedStepId?: ResearchCycleStepId;
  failedStepDetails?: string;
  nextRecommendedAction: string;
  resultSummary: string;
  safetyNotice: "Research cycle only. Broker execution remains disabled.";
}

export interface ResearchCycleState {
  latestRunId?: string;
  runs: ResearchCycleRun[];
  safetyNotice: "Research cycle only. Broker execution remains disabled.";
}

export interface ResearchCycleRunOptions {
  state: import("@/lib/types").LabState;
  searchMode?: AutoResearchSearchMode;
  maxCandidateCount?: number;
  maxResearchCandles?: number;
  backtestConfig?: BacktestConfig;
  candleWindowSettings?: Partial<CandleWindowSettings>;
  advancedFullResearchMode?: boolean;
  skipHeavyAudit?: boolean;
  skipLlmAdvisory?: boolean;
  skipAutoResearch?: boolean;
  maxAdaptivePasses?: number;
  autoResearchTimeoutMs?: number;
  autoResearchCheckpointPersistence?: "storage" | "memory_only";
  sourceGuard?: {
    requireEligibleResearchSource?: boolean;
    allowedSourceModes?: CandleDataSourceMode[];
    minimumCandleCount?: number;
    messagePrefix?: string;
  };
  onUpdate?: (run: ResearchCycleRun) => void;
  signal?: AbortSignal;
}
