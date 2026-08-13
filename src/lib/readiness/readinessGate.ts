import type { EdgeStatistics } from "@/lib/statistics/edgeStatistics";
import type { ResearchQualityReview } from "@/lib/researchQuality";
import {
  getLLMReadinessImpact,
  isLLMAdvisoryReviewPassed,
  latestLLMAdvisoryRun,
  loadLLMResearchState
} from "@/lib/llm/llmProvider";
import { countCompletedRunbookItems, simulationRunbookChecklist } from "@/lib/simulationRunbook";
import type { SimulationRunbookState } from "@/lib/simulationRunbook";
import type { ValidationScenarioResult, ValidationSuiteReport } from "@/lib/validation";
import type { ReadinessGateSnapshot, ReadinessRequirementResult, ReadinessState } from "@/lib/readiness/readinessTypes";
import { prioritizeReadinessRequirements } from "@/lib/readiness/readinessRequirementPriority";
import type { WalkForwardRun } from "@/lib/walkForward";
import {
  MATCHING_OOS_UNAVAILABLE_MESSAGE,
  matchValidationProvenance,
  type ValidationProvenanceIdentity
} from "@/lib/validationProvenance";

const nowId = (prefix: string) => `${prefix}_${Date.now()}`;

const requirement = (
  id: string,
  label: string,
  passed: boolean,
  detail: string,
  severity: ReadinessRequirementResult["severity"] = "blocker",
  debug: {
    currentValue: string;
    requiredValue: string;
    explanation: string;
    suggestedFix: string;
    runPage?: ReadinessRequirementResult["runPage"];
  }
): ReadinessRequirementResult => ({ id, label, passed, detail, severity, ...debug });

const conservativeScenarioFor = (validation?: ValidationSuiteReport) =>
  validation?.scenarios.find((scenario) => scenario.id === "conservative-confluence");

const averageCalibrationFor = (validation?: ValidationSuiteReport) => {
  if (!validation?.scenarios.length) {
    return 0;
  }
  return (
    validation.scenarios.reduce((sum, scenario) => sum + scenario.confidenceCalibration.score, 0) /
    validation.scenarios.length
  );
};

const maxDrawdownFor = (validation?: ValidationSuiteReport) =>
  validation?.scenarios.reduce((max, scenario) => Math.max(max, scenario.maxDrawdown), 0) ?? 0;

const sessionConsistencyPassed = (quality?: ResearchQualityReview) => {
  if (!quality?.sessionComparison.length) {
    return false;
  }
  const viableSessions = quality.sessionComparison.filter(
    (session) => session.readiness !== "red" && session.totalTrades > 0 && session.averageR >= -0.1
  );
  return viableSessions.length > 0;
};

const falsePositiveTotal = (quality?: ResearchQualityReview) =>
  quality?.failureAttribution
    ? quality.failureAttribution.attributedStopHitCount
    : quality?.falsePositivePatterns.reduce((sum, item) => sum + item.estimatedFalsePositives, 0) ?? 0;

const falsePositiveControlFor = (quality?: ResearchQualityReview) => {
  const attribution = quality?.failureAttribution;
  if (!attribution) {
    const count = falsePositiveTotal(quality);
    const patterns = quality?.falsePositivePatterns.length ?? 99;
    return {
      passed: Boolean(quality) && count <= 2 && patterns <= 2,
      currentValue: `${count} legacy estimated; ${patterns === 99 ? "missing" : patterns} patterns`,
      requiredValue: "legacy estimated <= 2 and patterns <= 2",
      detail: `Legacy estimated false positives ${count}; patterns ${patterns === 99 ? 0 : patterns}.`
    };
  }
  const directlyAttributedFamilies = attribution.failureCauses.filter((cause) => cause.directlyAttributed).length;
  const attributableRate = attribution.attributedStopHitCount / Math.max(1, attribution.completedTradeCount);
  const contextCoverage = attribution.contextEvaluationCoverage ?? 0;
  const coveragePassed = attribution.stopHitCount === 0 || contextCoverage >= 0.9;
  return {
    passed: coveragePassed && attributableRate <= 0.25 && directlyAttributedFamilies <= 2,
    currentValue: `${Math.round(attributableRate * 100)}% avoidable-loss rate; ${directlyAttributedFamilies} causal families; ${Math.round(contextCoverage * 100)}% context evaluated`,
    requiredValue: "avoidable-loss rate <= 25%, causal families <= 2, context evaluation >= 90%",
    detail: `${attribution.stopHitCount} completed stop hits; ${attribution.attributedStopHitCount} have a discriminating pre-entry cause; ${attribution.unattributedStopHitCount} are ordinary/unexplained model losses, not automatically false positives.`
  };
};

const redDrawdownClusters = (quality?: ResearchQualityReview) =>
  quality?.drawdownClusters.filter((cluster) => cluster.clusterRisk === "red").length ?? 0;

const totalValidationTrades = (validation?: ValidationSuiteReport) =>
  validation?.scenarios.reduce((sum, scenario) => sum + scenario.totalTrades, 0) ?? 0;

const runbookComplete = (runbook?: SimulationRunbookState) =>
  Boolean(
    runbook?.verifiedAt &&
      countCompletedRunbookItems(runbook) === simulationRunbookChecklist.length &&
      runbook.checklist.brokerExecutionSkipped &&
      runbook.checklist.positionsZero &&
      runbook.checklist.tradesZero &&
      runbook.checklist.shutdownComplete
  );

const conservativeStabilityPassed = (conservative?: ValidationScenarioResult) =>
  Boolean(
    conservative &&
      conservative.readiness === "green" &&
      conservative.totalTrades >= 5 &&
      conservative.averageR >= 0.15 &&
      conservative.maxDrawdown <= 4
  );

const stateFor = (requirements: ReadinessRequirementResult[], validation?: ValidationSuiteReport, quality?: ResearchQualityReview): ReadinessState => {
  if (requirements.every((item) => item.passed)) {
    return "Paper-Demo Candidate";
  }
  const matchingProvenance = requirements.find((item) => item.id === "matching-validation-provenance")?.passed;
  if (validation && quality && quality.readinessGrade !== "Not Ready" && matchingProvenance) {
    return "Research Ready";
  }
  return "Not Ready";
};

const nextStepFor = (state: ReadinessState, failed: ReadinessRequirementResult[]) => {
  if (state === "Paper-Demo Candidate") {
    return "Manual approval can be recorded, but broker execution remains disabled until a separate future implementation.";
  }
  if (state === "Research Ready") {
    return "Resolve failed blocker checks, rerun validation, and repeat research quality review before demo approval.";
  }
  const firstFailure = failed[0]?.label ?? "validation evidence";
  return `Blocked. Fix ${firstFailure.toLowerCase()} before considering paper-demo readiness.`;
};

const validationSnapshotFor = (validation?: ValidationSuiteReport) => {
  const conservative = conservativeScenarioFor(validation);
  if (!validation) {
    return undefined;
  }
  return {
    id: validation.id,
    generatedAt: validation.generatedAt,
    readinessStatus: validation.calibration.readinessStatus,
    readinessScore: validation.calibration.readinessScore,
    conservativeScenario: conservative
      ? {
          readiness: conservative.readiness,
          totalTrades: conservative.totalTrades,
          averageR: conservative.averageR,
          maxDrawdown: conservative.maxDrawdown,
          confidenceCalibration: conservative.confidenceCalibration.score
        }
      : undefined
  };
};

const researchQualitySnapshotFor = (quality?: ResearchQualityReview) =>
  quality
    ? {
        id: quality.id,
        generatedAt: quality.generatedAt,
        readinessGrade: quality.readinessGrade,
        readinessScore: quality.readinessScore,
        falsePositiveCount: falsePositiveTotal(quality),
        redDrawdownClusters: redDrawdownClusters(quality)
      }
    : undefined;

const runbookSnapshotFor = (runbook?: SimulationRunbookState) =>
  runbook
    ? {
        verifiedAt: runbook.verifiedAt,
        completedChecks: countCompletedRunbookItems(runbook),
        totalChecks: simulationRunbookChecklist.length,
        brokerExecutionSkipped: runbook.checklist.brokerExecutionSkipped,
        positionsZero: runbook.checklist.positionsZero,
        tradesZero: runbook.checklist.tradesZero,
        shutdownComplete: runbook.checklist.shutdownComplete
      }
    : undefined;

const llmSnapshotFor = () => {
  const state = loadLLMResearchState();
  const latest = latestLLMAdvisoryRun(state);
  return {
    latestRunAt: latest?.timestamp,
    providerMode: state.providerMode,
    providerConfigured: Boolean(latest?.providerConfigured),
    advisoryPassed: isLLMAdvisoryReviewPassed(state),
    unsafeResponseRejections: state.unsafeResponseRejections,
    readinessImpact: getLLMReadinessImpact(state)
  };
};

const compactIdentity = (identity?: ValidationProvenanceIdentity) => {
  if (!identity) return "missing";
  const profile = identity.strategyProfile ?? "unknown profile";
  const version = identity.strategyProfileVersion ? ` ${identity.strategyProfileVersion}` : "";
  const source = [identity.sourceProvider, identity.requestedSymbol, identity.brokerSymbol, identity.timeframe]
    .filter(Boolean)
    .join("/");
  const parameters = identity.parameterFingerprint ?? "parameters missing";
  return `${profile}${version}; ${source || "source missing"}; ${parameters}`;
};

export function evaluateReadinessGate({
  validation,
  quality,
  runbook,
  edgeStatistics,
  provenanceExpectation,
  walkForwardRun
}: {
  validation?: ValidationSuiteReport;
  quality?: ResearchQualityReview;
  runbook?: SimulationRunbookState;
  edgeStatistics?: EdgeStatistics;
  provenanceExpectation?: ValidationProvenanceIdentity;
  walkForwardRun?: WalkForwardRun;
}): ReadinessGateSnapshot {
  const conservative = conservativeScenarioFor(validation);
  const maxDrawdown = maxDrawdownFor(validation);
  const averageCalibration = averageCalibrationFor(validation);
  const validationTrades = totalValidationTrades(validation);
  const falsePositiveControl = falsePositiveControlFor(quality);
  const redClusters = redDrawdownClusters(quality);
  const llmSnapshot = llmSnapshotFor();
  const validationProvenanceReview = matchValidationProvenance(
    provenanceExpectation ?? validation?.provenance,
    validation?.provenance,
    {
      purpose: "readiness",
      requireValidationRunId: true
    }
  );
  const walkForwardProvenanceReview = matchValidationProvenance(
    validation?.provenance ?? provenanceExpectation,
    walkForwardRun?.provenance,
    {
      purpose: "readiness",
      requireValidationRunId: true,
      requireWalkForwardRunId: true,
      requireMatchingOosEvidence: true
    }
  );
  const matchedEvidenceProvenance =
    validationProvenanceReview.matched && walkForwardProvenanceReview.matched;
  const requirements: ReadinessRequirementResult[] = [
    requirement(
      "validation-exists",
      "Latest validation results exist",
      Boolean(validation),
      validation?.generatedAt ?? "No validation suite has been run.",
      "blocker",
      {
        currentValue: validation?.generatedAt ?? "missing",
        requiredValue: "completed validation suite",
        explanation: "The gate needs a current validation suite before it can judge strategy stability.",
        suggestedFix: "Run the validation suite on /validation.",
        runPage: "/validation"
      }
    ),
    requirement(
      "matching-validation-provenance",
      "Validation and OOS evidence match the active research identity",
      matchedEvidenceProvenance,
      matchedEvidenceProvenance
        ? "Active research identity matches; frozen validation and walk-forward provenance match exactly."
        : MATCHING_OOS_UNAVAILABLE_MESSAGE,
      "blocker",
      {
        currentValue: matchedEvidenceProvenance
          ? "exact profile/source/parameter/run match"
          : [
              `active: ${compactIdentity(provenanceExpectation)}`,
              `validation: ${compactIdentity(validation?.provenance)}`,
              `OOS: ${compactIdentity(walkForwardRun?.provenance)}`,
              `blockers: ${[...validationProvenanceReview.blockers, ...walkForwardProvenanceReview.blockers].join(", ")}`
            ].join(" | "),
        requiredValue: "active strategy/profile/source-series match plus exact frozen validation and OOS run provenance",
        explanation: "Evidence from another profile, parameter set, canonical source series, validation snapshot, or legacy record cannot promote readiness.",
        suggestedFix: "Run validation and walk-forward for the active research identity, then keep the resulting frozen validation/OOS pair linked.",
        runPage: "/walk-forward"
      }
    ),
    requirement(
      "research-quality-exists",
      "Latest research quality review exists",
      Boolean(quality),
      quality?.generatedAt ?? "No research quality review has been run.",
      "blocker",
      {
        currentValue: quality?.generatedAt ?? "missing",
        requiredValue: "completed research quality review",
        explanation: "The gate needs the quality review to identify false positives, weak sessions, and readiness grade.",
        suggestedFix: "Run Research Quality after validation is complete.",
        runPage: "/research-quality"
      }
    ),
    requirement(
      "simulated-trade-sample",
      "Insufficient simulated trades. Readiness cannot be evaluated.",
      Boolean(validation) && validationTrades > 0,
      validation ? `${validationTrades} total simulated trades across validation scenarios.` : "Validation suite is missing.",
      "blocker",
      {
        currentValue: validation ? `${validationTrades} total simulated trades` : "missing",
        requiredValue: "> 0 simulated trades before readiness evaluation",
        explanation:
          "Zero trades is not a strategy pass or failure; it means there is no outcome sample to evaluate readiness.",
        suggestedFix: "Open Backtest Lab or Auto Research, review zero-trade diagnostics, and run bounded recovery settings.",
        runPage: "/backtest-lab"
      }
    ),
    requirement(
      "quality-candidate",
      "Research Quality is Paper-Demo Candidate",
      quality?.readinessGrade === "Paper-Demo Candidate",
      quality ? `Current grade: ${quality.readinessGrade}.` : "Research quality review is missing.",
      "blocker",
      {
        currentValue: quality?.readinessGrade ?? "missing",
        requiredValue: "Paper-Demo Candidate",
        explanation: "Paper-demo candidate status can only come from the strict research quality review.",
        suggestedFix: quality ? "Resolve the quality review weaknesses, rerun validation, then rerun research quality." : "Run /research-quality after /validation.",
        runPage: quality ? "/validation" : "/research-quality"
      }
    ),
    requirement(
      "llm-advisory-review",
      "LLM advisory review passed through a configured provider",
      llmSnapshot.advisoryPassed,
      llmSnapshot.latestRunAt
        ? `Latest LLM run ${llmSnapshot.latestRunAt}; provider=${llmSnapshot.providerMode}; passed=${llmSnapshot.advisoryPassed}.`
        : "No configured LLM advisory run has passed.",
      "blocker",
      {
        currentValue: llmSnapshot.latestRunAt
          ? `${llmSnapshot.providerMode}; configured=${llmSnapshot.providerConfigured}; passed=${llmSnapshot.advisoryPassed}`
          : "missing",
        requiredValue: "configured real provider run passed with zero unsafe response rejections",
        explanation:
          "Real research mode requires LLM advisory review before Paper-Demo Candidate. Deterministic fallback and mock LLM runs are not sufficient.",
        suggestedFix:
          "Configure a secure local command, backend endpoint, Supabase Edge Function, or future provider service, then run /llm-agents.",
        runPage: "/llm-agents"
      }
    ),
    requirement(
      "runbook-complete",
      "Simulation runbook passed with broker execution skipped",
      runbookComplete(runbook),
      runbook
        ? `${countCompletedRunbookItems(runbook)}/${simulationRunbookChecklist.length} checks complete; broker skipped=${runbook.checklist.brokerExecutionSkipped}.`
        : "Simulation runbook is missing.",
      "blocker",
      {
        currentValue: runbook
          ? `${countCompletedRunbookItems(runbook)}/${simulationRunbookChecklist.length}; broker skipped=${runbook.checklist.brokerExecutionSkipped}`
          : "missing",
        requiredValue: `${simulationRunbookChecklist.length}/${simulationRunbookChecklist.length}; broker skipped=true; positions=0; trades=0`,
        explanation: "The app must prove the AI Lab to go-trader bridge was simulation-only and produced zero executed trades.",
        suggestedFix: "Complete every item in /simulation-runbook after a scheduler one-cycle simulation run.",
        runPage: "/simulation-runbook"
      }
    ),
    requirement(
      "drawdown-threshold",
      "Drawdown threshold passed",
      Boolean(validation) && maxDrawdown <= 4 && redClusters === 0,
      `Max validation drawdown ${maxDrawdown.toFixed(2)}R; red drawdown clusters ${redClusters}.`,
      "blocker",
      {
        currentValue: `${maxDrawdown.toFixed(2)}R max DD; ${redClusters} red clusters`,
        requiredValue: "max DD <= 4.00R and red clusters = 0",
        explanation: "Large drawdown or clustered losses block candidate status even if some scenarios look profitable.",
        suggestedFix: "Use Backtest Lab to increase confluence/confidence, reduce sessions, or compare stop models.",
        runPage: "/backtest-lab"
      }
    ),
    requirement(
      "confidence-calibration",
      "Confidence calibration passed",
      Boolean(validation) && averageCalibration >= 0.55 && (conservative?.confidenceCalibration.score ?? 0) >= 0.55,
      `Average calibration ${Math.round(averageCalibration * 100)}%; conservative calibration ${Math.round(
        (conservative?.confidenceCalibration.score ?? 0) * 100
      )}%.`,
      "blocker",
      {
        currentValue: `average ${Math.round(averageCalibration * 100)}%; conservative ${Math.round(
          (conservative?.confidenceCalibration.score ?? 0) * 100
        )}%`,
        requiredValue: "average >= 55% and conservative >= 55%",
        explanation: "Confidence must roughly match simulated outcomes; overconfident weak signals stay blocked.",
        suggestedFix: "Raise confidence/confluence thresholds, rerun validation, and check calibration again.",
        runPage: "/validation"
      }
    ),
    requirement(
      "false-positive-control",
      "False positives are controlled",
      falsePositiveControl.passed,
      falsePositiveControl.detail,
      "blocker",
      {
        currentValue: falsePositiveControl.currentValue,
        requiredValue: falsePositiveControl.requiredValue,
        explanation: "Completed stop hits are separated from attributable, recurring quality failures. Larger samples are judged by rate and causal families, not an absolute loss count.",
        suggestedFix: "Review stop-hit attribution in /research-quality, raise coverage to 90%, then test one causal exclusion at a time.",
        runPage: "/research-quality"
      }
    ),
    requirement(
      "session-consistency",
      "Session consistency passed",
      sessionConsistencyPassed(quality),
      quality?.sessionComparison.length
        ? quality.sessionComparison.map((session) => `${session.session}: ${session.readiness}, ${session.averageR.toFixed(2)}R`).join("; ")
        : "No session comparison is available.",
      "blocker",
      {
        currentValue: quality?.sessionComparison.length
          ? quality.sessionComparison.map((session) => `${session.session}: ${session.readiness}, ${session.averageR.toFixed(2)}R`).join("; ")
          : "missing",
        requiredValue: "at least one non-red session with trades and avg R >= -0.10",
        explanation: "The gate needs at least one session window that is not obviously unstable.",
        suggestedFix: "Compare NY AM vs London in Backtest Lab, then rerun validation and research quality.",
        runPage: "/backtest-lab"
      }
    ),
    requirement(
      "conservative-stability",
      "Conservative scenario stability passed",
      conservativeStabilityPassed(conservative),
      conservative
        ? `Readiness ${conservative.readiness}; trades ${conservative.totalTrades}; average R ${conservative.averageR.toFixed(2)}; max DD ${conservative.maxDrawdown.toFixed(2)}R.`
        : "Conservative scenario is missing.",
      "blocker",
      {
        currentValue: conservative
          ? `${conservative.readiness}; ${conservative.totalTrades} trades; ${conservative.averageR.toFixed(2)} avg R; ${conservative.maxDrawdown.toFixed(2)}R DD`
          : "missing",
        requiredValue: "green; >= 5 trades; avg R >= 0.15; max DD <= 4.00R",
        explanation: "Aggressive settings are not enough; conservative validation must remain stable.",
        suggestedFix: "Use conservative thresholds as the benchmark and rerun /validation.",
        runPage: "/validation"
      }
    ),
    requirement(
      "oos-edge-evidence",
      "Out-of-sample edge lower bound is positive with sufficient sample",
      Boolean(
        matchedEvidenceProvenance &&
          edgeStatistics &&
          edgeStatistics.provenance === "out_of_sample" &&
          edgeStatistics.sampleSize >= edgeStatistics.minimumSampleSize &&
          edgeStatistics.expectancyLower95 > 0
      ),
      edgeStatistics?.provenance === "out_of_sample"
        ? `${edgeStatistics.summary} Verdict: ${edgeStatistics.verdict.replace(/_/g, " ")}.`
        : edgeStatistics
          ? "In-sample edge statistics cannot satisfy the out-of-sample readiness gate. Run walk-forward validation."
          : "No walk-forward out-of-sample edge statistics are available yet.",
      "blocker",
      {
        currentValue: edgeStatistics?.provenance === "out_of_sample"
          ? `${edgeStatistics.sampleSize} OOS trades; lower 95% ${edgeStatistics.expectancyLower95.toFixed(2)}R`
          : edgeStatistics
            ? `in_sample only (${edgeStatistics.sampleSize} trades)`
            : "missing",
        requiredValue: `walk-forward OOS provenance; >= ${edgeStatistics?.minimumSampleSize ?? 20} trades and positive expectancy lower 95% bound`,
        explanation:
          "Paper-demo candidate status requires proven out-of-sample edge from walk-forward, not in-sample backtest fit.",
        suggestedFix: "Run walk-forward validation (or a full research cycle that includes it) on the active source.",
        runPage: "/walk-forward"
      }
    )
  ];

  const failedRequirements = requirements.filter((item) => !item.passed);
  const passedRequirements = requirements.filter((item) => item.passed);
  const { activeFailedRequirements, deferredRequirements } = prioritizeReadinessRequirements(requirements);
  const state = stateFor(requirements, validation, quality);
  const warnings = [
    "Simulation-only readiness gating. Broker execution remains disabled.",
    "Manual approval records readiness intent only; it does not enable live or paper broker execution.",
    state !== "Paper-Demo Candidate"
      ? "Progression is blocked until every required check passes."
      : "Separate future broker-demo implementation and risk controls are still required."
  ];

  return {
    id: nowId("readiness_gate"),
    evaluatedAt: new Date().toISOString(),
    state,
    passedRequirements,
    failedRequirements,
    activeFailedRequirements,
    deferredRequirements,
    warnings,
    recommendedNextStep: nextStepFor(state, activeFailedRequirements),
    brokerExecutionDisabled: true,
    validationSnapshot: validationSnapshotFor(validation),
    researchQualitySnapshot: researchQualitySnapshotFor(quality),
    runbookSnapshot: runbookSnapshotFor(runbook),
    llmSnapshot
  };
}

export function summarizeScenarioForGate(scenario?: ValidationScenarioResult) {
  if (!scenario) {
    return "missing";
  }
  return `${scenario.name}: ${scenario.readiness}, ${scenario.totalTrades} trades, ${scenario.averageR.toFixed(2)}R avg, ${scenario.maxDrawdown.toFixed(2)}R DD`;
}
