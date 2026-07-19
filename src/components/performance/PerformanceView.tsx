import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Layers3,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TechnicalDetails } from "@/components/common/TechnicalDetails";
import { MetricProvenanceDetails } from "@/components/common/MetricProvenanceDetails";
import { WhyNotReadyCard } from "@/components/common/WhyNotReadyCard";
import {
  detectCanonicalMetricsMismatch,
  normalizeCycleMetricsForDisplay,
  type CanonicalPerformanceMetrics
} from "@/lib/performance/canonicalMetrics";
import { buildSimulatedAccountFromCanonicalMetrics } from "@/lib/performance/simulatedAccount";
import { latestResearchCycleRun, loadResearchCycleState } from "@/lib/researchCycle";
import {
  resolveResearchRuntimeSnapshot,
  selectRuntimeFingerprintLabel,
  selectRuntimeProvenanceWarnings,
  type ResearchRuntimeSnapshot
} from "@/lib/runtime";
import { aggregatePortfolioMetrics, identifyWeakestAgent } from "@/lib/scoring";
import type { LabState, MarketOutcome } from "@/lib/types";
import { cn } from "@/lib/utils";
import { loadLatestValidationReport } from "@/lib/validation";
import { latestWalkForwardRun } from "@/lib/walkForward";
import { loadSelfImprovementState } from "@/lib/selfImprovement";
import { readLatestActivateMarketSummary } from "@/lib/ict-strategy-suite/ictActivateMarketPipeline";
import { readLatestResearchState } from "@/lib/ict-strategy-suite";
import { loadPaperDemoOperationsState } from "@/lib/paperDemoOperations";
import { loadPredictionLedger } from "@/lib/predictionLedger";
import { loadForwardEvidenceLedger } from "@/lib/forwardEvidence";
import { latestValidationChainEntry, readValidationChainState } from "@/lib/validationChain";
import { buildResultsWorkspaceSnapshot } from "@/lib/results";
import { WORKSPACE_PAGE, WORKSPACE_SECTION_LABEL } from "@/components/common/workspaceStyles";

type ResultsTab = "overview" | "backtest" | "replay" | "walk_forward" | "paper_forward" | "robustness";

const money = new Intl.NumberFormat(undefined, {
  currency: "USD",
  maximumFractionDigits: 2,
  style: "currency"
});

const wholeMoney = new Intl.NumberFormat(undefined, {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency"
});

const compactDate = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const safeNumber = (value?: number | null) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const pct = (value?: number, digits = 1) =>
  typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "n/a";
const rValue = (value?: number | null, digits = 2) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(digits)}R` : "n/a";
const readableProfile = (profileId: string) => profileId.replace(/_/g, " ");

interface CalendarCell {
  date: Date;
  dateKey: string;
  day: number;
  inMonth: boolean;
  move: number;
  trades: number;
  isToday: boolean;
  weekIndex: number;
  weekMove: number;
  weekTrades: number;
}

export function PerformanceView({ state }: { state: LabState }) {
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<ResearchRuntimeSnapshot>();
  const [resultsTab, setResultsTab] = useState<ResultsTab>("overview");
  const [monthOffset, setMonthOffset] = useState(0);

  const legacyMetrics = aggregatePortfolioMetrics(state);
  const weakest = identifyWeakestAgent(state);
  const latestCycle = latestResearchCycleRun(loadResearchCycleState());
  const latestValidation = loadLatestValidationReport();
  const walkForward = latestWalkForwardRun();
  const selfImprovement = loadSelfImprovementState();
  const latestProposal = selfImprovement.proposals?.[0];
  const canonicalMetrics = runtimeSnapshot?.performance.canonicalPerformanceMetrics ?? normalizeCycleMetricsForDisplay(latestCycle, latestValidation);
  const derivedCanonicalMetrics = normalizeCycleMetricsForDisplay(latestCycle, latestValidation);
  const canonicalMismatchWarnings = detectCanonicalMetricsMismatch(latestCycle?.canonicalMetrics, derivedCanonicalMetrics);
  const simulatedAccount = useMemo(
    () => runtimeSnapshot?.performance.simulatedAccountSummary ?? buildSimulatedAccountFromCanonicalMetrics(canonicalMetrics),
    [canonicalMetrics, runtimeSnapshot]
  );
  const calendar = useMemo(
    () =>
      buildResultsCalendar({
        metrics: canonicalMetrics,
        outcomes: state.outcomes,
        monthOffset
      }),
    [canonicalMetrics, simulatedAccount, state.outcomes, monthOffset]
  );
  const outcomeMoveCurve = useMemo(() => buildOutcomeMoveCurve(calendar.cells), [calendar.cells]);
  const tradeBars = useMemo(() => buildTradeBars(calendar.cells), [calendar.cells]);
  const recentRows = useMemo(() => buildRecentOutcomeRows(state.outcomes), [state.outcomes]);
  const resultsSnapshot = useMemo(
    () => buildResultsWorkspaceSnapshot({
      runtimeSnapshot,
      canonicalMetrics,
      activationSummary: readLatestActivateMarketSummary(),
      latestResearchState: readLatestResearchState(),
      walkForward,
      validationChainEntry: latestValidationChainEntry(readValidationChainState()),
      paperDemoState: loadPaperDemoOperationsState(),
      predictionLedger: loadPredictionLedger(),
      forwardEvidenceEntries: loadForwardEvidenceLedger()
    }),
    [canonicalMetrics, runtimeSnapshot, walkForward]
  );
  const sourceWarnings = selectRuntimeProvenanceWarnings(runtimeSnapshot);
  const winRate = canonicalMetrics?.winRate ?? legacyMetrics.hitRate;
  const avgWinLoss = averageWinLossRatio(canonicalMetrics);
  const hasDatedOutcomes = state.outcomes.length > 0;

  useEffect(() => {
    let mounted = true;
    resolveResearchRuntimeSnapshot({ labState: state }).then((snapshot) => {
      if (mounted) {
        setRuntimeSnapshot(snapshot);
      }
    }).catch((error) => {
      console.error("Results runtime snapshot failed to resolve.", error);
    });
    return () => {
      mounted = false;
    };
  }, [state]);

  return (
    <div data-testid="performance-results-page" className={`${WORKSPACE_PAGE} text-slate-100`}>
      <header className="premium-surface premium-panel-grid flex flex-col justify-between gap-4 rounded-lg p-4 sm:p-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className={WORKSPACE_SECTION_LABEL}>Research Results</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-normal text-slate-50">Research Performance</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            One evidence ledger for backtest, replay, chronological OOS, robustness, Paper-Demo monitoring, and forward forecasts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={resultsSnapshot.source.provider === "mt5_read_only" ? "success" : "warning"}>
            {resultsSnapshot.source.provider.replace(/_/g, " ")}
          </Badge>
          <Badge variant="secondary">{resultsSnapshot.source.brokerSymbol} -&gt; {resultsSnapshot.source.requestedSymbol} / {resultsSnapshot.source.timeframe}</Badge>
          <Badge variant="danger">authority none</Badge>
        </div>
      </header>

      <ResultsCalendar
        calendar={calendar}
        hasDatedOutcomes={hasDatedOutcomes}
        onPreviousMonth={() => setMonthOffset((value) => value - 1)}
        onNextMonth={() => setMonthOffset((value) => value + 1)}
        onToday={() => setMonthOffset(0)}
      />

      <div className="flex flex-wrap gap-2" data-testid="results-tabs" role="tablist" aria-label="Results series">
        {(
          [
            ["overview", "Overview"],
            ["backtest", "Backtest"],
            ["replay", "Replay"],
            ["walk_forward", "Walk-Forward OOS"],
            ["paper_forward", "Paper & Forward"],
            ["robustness", "Robustness"]
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            role="tab"
            aria-selected={resultsTab === id}
            size="sm"
            variant={resultsTab === id ? "default" : "outline"}
            onClick={() => setResultsTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {resultsTab === "overview" ? (
        <section className="space-y-4" data-testid="results-tab-overview">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ResultMetricCard
              label="Frozen research profile"
              value={`${resultsSnapshot.frozenProfile.historicalTrades} trades`}
              detail={`${readableProfile(resultsSnapshot.frozenProfile.profileId)} / ${pct(resultsSnapshot.frozenProfile.historicalTargetFirstRate)} target-first / ${rValue(resultsSnapshot.frozenProfile.historicalAverageR)}`}
              tone="positive"
            />
            <ResultMetricCard
              label="Chronological OOS"
              value={`${resultsSnapshot.frozenProfile.oosTrades} trades`}
              detail={`${resultsSnapshot.frozenProfile.rollingWindowsPassed}/${resultsSnapshot.frozenProfile.rollingWindowsTotal} rolling windows / ${rValue(resultsSnapshot.frozenProfile.oosAverageR)}`}
              tone="positive"
            />
            <ResultMetricCard
              label="Forward Evidence"
              value={`${resultsSnapshot.frozenProfile.forwardCompleted}/${resultsSnapshot.frozenProfile.forwardRequired}`}
              detail={`${resultsSnapshot.frozenProfile.forwardIndependentDates} dates / ${resultsSnapshot.frozenProfile.forwardWindows} windows`}
            />
            <ResultMetricCard
              label="Research Readiness"
              value={resultsSnapshot.validation.readinessState.replace(/_/g, " ")}
              detail={`Evidence ${resultsSnapshot.validation.evidenceScore} / Maturity ${resultsSnapshot.validation.maturityScore}`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ResultPanel>
              <PanelHeading icon={<Layers3 className="h-4 w-4" />} title="Analysis integrity" subtitle="Last explicit Activate Market context" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <StatTile label="Depth" value={resultsSnapshot.source.analysisDepthStatus.replace(/_/g, " ")} />
                <StatTile label="Required timeframes" value={resultsSnapshot.source.requiredTimeframesLoaded ? "loaded" : "incomplete"} />
                <StatTile label="Loaded" value={resultsSnapshot.source.analysisTimeframesLoaded.join(" / ") || "Activate Market required"} />
                <StatTile
                  label="Missing"
                  value={
                    resultsSnapshot.source.requiredTimeframesLoaded
                      ? resultsSnapshot.source.missingTimeframes.join(" / ") || "none"
                      : resultsSnapshot.source.missingTimeframes.join(" / ") || "Activate Market required"
                  }
                />
                <StatTile label="Weekly bias" value={`${resultsSnapshot.source.weeklyBiasDirection} / ${resultsSnapshot.source.weeklyBiasStatus}`} />
                <StatTile label="Fingerprint" value={resultsSnapshot.source.fingerprint} />
              </div>
            </ResultPanel>

            <ResultPanel>
              <PanelHeading icon={<ShieldCheck className="h-4 w-4" />} title="Progression gate" subtitle="Historical strength does not auto-promote a profile" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <StatTile label="Latest replay" value={resultsSnapshot.validation.replayVerdict.replace(/_/g, " ")} />
                <StatTile label="Latest walk-forward" value={resultsSnapshot.validation.walkForwardVerdict.replace(/_/g, " ")} />
                <StatTile label="Latest Monte Carlo" value={resultsSnapshot.monteCarlo.robustness.replace(/_/g, " ")} />
                <StatTile label="Paper-Demo" value={`${resultsSnapshot.paperDemo.monitoringCount} monitoring / broker disconnected`} />
              </div>
              <p className="mt-4 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm leading-6 text-emerald-100">
                {readableProfile(resultsSnapshot.frozenProfile.profileId)} historical replay, chronological OOS, and Monte Carlo evidence are preserved separately. Forward reassessment still requires untouched post-cutoff outcomes.
              </p>
              <p className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
                {resultsSnapshot.validation.nextAction}
              </p>
            </ResultPanel>
          </div>
        </section>
      ) : null}

      {resultsTab === "replay" ? (
        <section className="premium-surface space-y-4 rounded-lg p-4 sm:p-5" data-testid="results-tab-replay">
          <PanelHeading icon={<Activity className="h-4 w-4" />} title="Replay evidence" subtitle="Compact manual replay outcomes; no candles are stored here" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ResultMetricCard label="Signals" value={String(resultsSnapshot.replay.totalSignals)} detail={resultsSnapshot.replay.runId ?? "no saved replay"} />
            <ResultMetricCard label="Target-first" value={pct(resultsSnapshot.replay.targetFirstRate ?? undefined)} detail="all replay signals" />
            <ResultMetricCard label="Approved target-first" value={pct(resultsSnapshot.replay.approvedTargetFirstRate ?? undefined)} detail={`Approved RR ${rValue(resultsSnapshot.replay.approvedAverageRr)}`} />
            <ResultMetricCard label="Replay verdict" value={resultsSnapshot.replay.verdict.replace(/_/g, " ")} detail="Recognition alone is not evidence" />
          </div>
        </section>
      ) : null}

      {resultsTab === "walk_forward" ? (
        <section className="premium-surface space-y-4 rounded-lg p-4 sm:p-5" data-testid="results-tab-walk-forward">
          <PanelHeading
            icon={<TrendingUp className="h-4 w-4" />}
            title="Walk-forward and chronological OOS"
            subtitle="Latest active validation and frozen profile evidence are reported separately"
          />
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">latest run: {resultsSnapshot.walkForward.status.replace(/_/g, " ")}</Badge>
            <Badge variant="secondary">{readableProfile(resultsSnapshot.frozenProfile.profileId)}: OOS passed</Badge>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Latest active validation run</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ResultMetricCard label="OOS expectancy" value={rValue(resultsSnapshot.walkForward.oosAverageR)} detail={`${resultsSnapshot.walkForward.oosTrades} OOS trades`} />
            <ResultMetricCard label="Lower 95% expectancy" value={rValue(resultsSnapshot.walkForward.oosLower95)} detail="Must remain positive for stronger evidence" />
            <ResultMetricCard
              label="Windows passed"
              value={`${resultsSnapshot.walkForward.windowsPassed}/${resultsSnapshot.walkForward.windows}`}
              detail={`Stability ${walkForward?.stability?.stabilityScore ?? "n/a"} / use expectancy CI`}
            />
            <ResultMetricCard label="Verdict" value={resultsSnapshot.walkForward.verdict.replace(/_/g, " ")} detail={resultsSnapshot.walkForward.runId ?? "no saved WF run"} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Frozen profile chronological evidence</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ResultMetricCard label="OOS sample" value={`${resultsSnapshot.frozenProfile.oosTrades} trades`} detail={`${resultsSnapshot.frozenProfile.historicalUniqueDates} historical dates`} tone="positive" />
            <ResultMetricCard label="Rolling windows" value={`${resultsSnapshot.frozenProfile.rollingWindowsPassed}/${resultsSnapshot.frozenProfile.rollingWindowsTotal}`} detail="positive chronological windows" tone="positive" />
            <ResultMetricCard label="OOS average" value={rValue(resultsSnapshot.frozenProfile.oosAverageR)} detail="frozen detector profile" tone="positive" />
            <ResultMetricCard label="OOS profit factor" value={resultsSnapshot.frozenProfile.oosProfitFactor.toFixed(3)} detail="historical evidence; no auto-promotion" tone="positive" />
          </div>
        </section>
      ) : null}

      {resultsTab === "paper_forward" ? (
        <section className="space-y-4" data-testid="results-tab-paper-forward">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ResultMetricCard label="Paper candidates" value={String(resultsSnapshot.paperDemo.candidateCount)} detail={`${resultsSnapshot.paperDemo.monitoringCount} monitoring / ${resultsSnapshot.paperDemo.blockedCount} blocked`} />
            <ResultMetricCard label="Daily checklist" value={`${resultsSnapshot.paperDemo.checklistCompleted}/${resultsSnapshot.paperDemo.checklistTotal}`} detail={`${resultsSnapshot.paperDemo.journalEntries} compact journal entries`} />
            <ResultMetricCard label="Forward outcomes" value={`${resultsSnapshot.frozenProfile.forwardCompleted}/${resultsSnapshot.frozenProfile.forwardRequired}`} detail={`${resultsSnapshot.frozenProfile.forwardIndependentDates} independent dates`} />
            <ResultMetricCard label="Forecast calibration" value={resultsSnapshot.predictions.classification.replace(/_/g, " ")} detail={`${resultsSnapshot.predictions.completedForecasts} completed / ${resultsSnapshot.predictions.pendingForecasts} pending`} />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ResultPanel>
              <PanelHeading icon={<Target className="h-4 w-4" />} title="Frozen profile forward ledger" subtitle="Untouched outcomes after the validation cutoff" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <StatTile label="Target-first" value={pct(resultsSnapshot.frozenProfile.forwardTargetFirstRate ?? undefined)} />
                <StatTile label="Average R" value={rValue(resultsSnapshot.frozenProfile.forwardAverageR)} />
                <StatTile label="Reassessment" value={resultsSnapshot.frozenProfile.reassessmentEligible ? "eligible for review" : "not yet eligible"} />
                <StatTile label="Recommendation" value={resultsSnapshot.frozenProfile.recommendation.replace(/_/g, " ")} />
              </div>
            </ResultPanel>
            <ResultPanel>
              <PanelHeading icon={<TrendingUp className="h-4 w-4" />} title="Causal forecast ledger" subtitle="Anticipated scenarios measured before outcomes" />
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <StatTile label="Forecasts" value={`${resultsSnapshot.predictions.totalForecasts} total / ${resultsSnapshot.predictions.actionableForecasts} actionable`} />
                <StatTile label="Target-first" value={pct(resultsSnapshot.predictions.targetFirstRate ?? undefined)} />
                <StatTile label="Average realized R" value={rValue(resultsSnapshot.predictions.averageRealizedR)} />
                <StatTile label="Brier score" value={resultsSnapshot.predictions.brierScore?.toFixed(3) ?? "n/a"} />
              </div>
            </ResultPanel>
          </div>
        </section>
      ) : null}

      {resultsTab === "robustness" ? (
        <section className="space-y-4" data-testid="results-tab-robustness">
          <PanelHeading
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Robustness and Monte Carlo"
            subtitle="Latest saved simulation and frozen profile evidence remain distinct"
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ResultMetricCard label="Latest Monte Carlo" value={resultsSnapshot.monteCarlo.robustness.replace(/_/g, " ")} detail={`${resultsSnapshot.monteCarlo.usableOutcomes} usable outcomes`} />
            <ResultMetricCard label="5th percentile ending R" value={rValue(resultsSnapshot.monteCarlo.fifthPercentileEndingR)} detail={`Median ${rValue(resultsSnapshot.monteCarlo.medianEndingR)}`} />
            <ResultMetricCard label="Worst drawdown" value={resultsSnapshot.monteCarlo.worstMaxDrawdownPct === null ? "n/a" : `${resultsSnapshot.monteCarlo.worstMaxDrawdownPct.toFixed(2)}%`} detail={`Median ${resultsSnapshot.monteCarlo.medianMaxDrawdownPct?.toFixed(2) ?? "n/a"}%`} />
            <ResultMetricCard label="Risk of ruin" value={resultsSnapshot.monteCarlo.riskOfRuinPct === null ? "n/a" : `${resultsSnapshot.monteCarlo.riskOfRuinPct.toFixed(2)}%`} detail="Research simulation only" />
          </div>
          <ResultPanel>
            <PanelHeading icon={<Activity className="h-4 w-4" />} title={`${readableProfile(resultsSnapshot.frozenProfile.profileId)} robustness`} subtitle="Validated historical profile; forward reassessment remains gated" />
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              <StatTile label="Monte Carlo" value={resultsSnapshot.frozenProfile.monteCarloRobustness.replace(/_/g, " ")} />
              <StatTile label="Historical outcomes" value={String(resultsSnapshot.frozenProfile.historicalTrades)} />
              <StatTile label="Chronological OOS" value={`${resultsSnapshot.frozenProfile.oosTrades} trades`} />
              <StatTile label="Forward threshold" value={`${resultsSnapshot.frozenProfile.forwardCompleted}/${resultsSnapshot.frozenProfile.forwardRequired}`} />
            </div>
          </ResultPanel>
          <ResultPanel>
            <PanelHeading icon={<FlaskConical className="h-4 w-4" />} title="Calibration and deterministic review" subtitle="Drafts may be tested; nothing applies or promotes automatically" />
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <StatTile label="Latest proposal" value={latestProposal?.proposalId ?? "none"} />
              <StatTile label="Proposal status" value={latestProposal?.status ?? "none"} />
              <StatTile label="Active calibration" value={selfImprovement.activeResearchCalibration?.sourceProposalId ?? "none"} />
            </div>
          </ResultPanel>
        </section>
      ) : null}

      {resultsTab === "backtest" ? (
        <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <ResultMetricCard
          label="Aggregate simulated P&L"
          value={money.format(resultsSnapshot.backtest.realizedPnL ?? 0)}
          detail={`${resultsSnapshot.backtest.totalTrades.toLocaleString()} canonical research trades`}
          tone={(resultsSnapshot.backtest.realizedPnL ?? 0) >= 0 ? "positive" : "negative"}
        />
        <ResultMetricCard
          label="Win Rate"
          value={pct(winRate, 2)}
          detail={`${canonicalMetrics?.winningTrades ?? 0}/${canonicalMetrics?.totalTrades ?? 0} trades`}
          visual={<SemiGauge value={winRate} />}
        />
        <ResultMetricCard
          label="Reward / Risk"
          value={avgWinLoss ? avgWinLoss.toFixed(2) : "n/a"}
          detail={`Avg R ${rValue(canonicalMetrics?.averageR)}`}
          visual={<RatioBar value={avgWinLoss ?? 0} />}
        />
        <ResultMetricCard
          label="Profit Factor"
          value={canonicalMetrics?.profitFactor === null || canonicalMetrics?.profitFactor === undefined ? "n/a" : canonicalMetrics.profitFactor.toFixed(2)}
          detail="Canonical latest-cycle metric · in_sample"
        />
        <ResultMetricCard
          label="Max Drawdown"
          value={rValue(canonicalMetrics?.maxDrawdownR)}
          detail={wholeMoney.format(simulatedAccount?.maxDrawdownDollars ?? 0)}
          tone="negative"
        />
        <ResultMetricCard
          label="Current Balance"
          value={wholeMoney.format(simulatedAccount?.currentBalance ?? simulatedAccount?.startingBalance ?? 50000)}
          detail={`Start ${wholeMoney.format(simulatedAccount?.startingBalance ?? 50000)}`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <ResultPanel className="min-h-[430px] min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Performance Curve</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-50">Cumulative dated outcome move</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{canonicalMetrics?.sourceCycleId ?? "no cycle"}</Badge>
              <Badge variant="warning">in_sample</Badge>
            </div>
          </div>
          <div className="mt-5 h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 720, height: 320 }}>
              <AreaChart data={outcomeMoveCurve}>
                <defs>
                  <linearGradient id="performanceBalanceFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} tickLine={false} axisLine={false} width={72} />
                <Tooltip contentStyle={{ background: "#15151a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#f8fafc" }} formatter={(value) => `${Number(value).toFixed(2)} move units`} />
                <Area type="monotone" dataKey="cumulativeMove" stroke="#22c55e" strokeWidth={2.4} fill="url(#performanceBalanceFill)" dot={{ r: 2, fill: "#f8fafc" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ResultPanel>

        <ResultPanel className="min-h-[430px]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-slate-50">Statistics</h3>
            <Badge variant="secondary">Canonical</Badge>
          </div>
          <div className="mt-4 space-y-2">
            <StatRow label="Biggest trade" value={rValue(canonicalMetrics?.bestTradeR)} />
            <StatRow label="Worst trade" value={rValue(canonicalMetrics?.worstTradeR)} negative />
            <StatRow label="Expectancy" value={rValue(canonicalMetrics?.averageR)} />
            <StatRow label="Profit factor" value={canonicalMetrics?.profitFactor === null || canonicalMetrics?.profitFactor === undefined ? "n/a" : canonicalMetrics.profitFactor.toFixed(2)} />
            <StatRow label="False positives" value={String(canonicalMetrics?.falsePositiveCount ?? 0)} negative />
            <StatRow label="Skipped signals" value={String(canonicalMetrics?.skippedSignals ?? 0)} />
            <StatRow
              label="Readiness"
              value={String(
                canonicalMetrics?.readinessScore ??
                  runtimeSnapshot?.readiness.readinessSnapshot.validationSnapshot?.readinessScore ??
                  runtimeSnapshot?.readiness.readinessSnapshot.researchQualitySnapshot?.readinessScore ??
                  0
              )}
            />
            <StatRow label="Stability" value={String(canonicalMetrics?.stabilityScore ?? 0)} />
          </div>
          <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
            <ShieldAlert className="mr-2 inline h-4 w-4" aria-hidden="true" />
            Backtest tab is in-sample only. Use Walk-Forward OOS for promotion evidence.
          </div>
        </ResultPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ResultPanel>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-50">Daily Trade Load</h3>
            <CalendarDays className="h-4 w-4 text-sky-300" aria-hidden="true" />
          </div>
          <div className="mt-4 h-[220px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 480, height: 220 }}>
              <BarChart data={tradeBars}>
                <CartesianGrid stroke="rgba(148,163,184,0.14)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip contentStyle={{ background: "#15151a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#f8fafc" }} />
                <Bar dataKey="trades" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ResultPanel>

        <ResultPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-50">Source & Safety</h3>
              <p className="mt-1 text-sm text-slate-400">Compact provenance for this results view.</p>
            </div>
            <Badge variant="danger">in_sample · authority gated</Badge>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <StatTile label="Metric source" value={canonicalMetrics?.metricSourceLabel ?? "no completed research cycle"} />
            <StatTile label="Data source" value={canonicalMetrics?.dataSource ?? runtimeSnapshot?.marketData.sourceLabel ?? "n/a"} />
            <StatTile label="Candle window" value={canonicalMetrics?.candleWindow ?? "n/a"} />
            <StatTile label="Fingerprint" value={selectRuntimeFingerprintLabel(runtimeSnapshot)} />
          </div>
          {sourceWarnings.length || canonicalMismatchWarnings.length ? (
            <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
              {[...sourceWarnings, ...canonicalMismatchWarnings].join(" ")}
            </div>
          ) : null}
        </ResultPanel>
      </section>

      <WhyNotReadyCard context="performance" snapshot={runtimeSnapshot} />

      <ResultPanel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Outcome Log</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-50">Recent simulated outcomes</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{state.outcomes.length} stored outcomes</Badge>
            <Badge variant="warning">Local memory</Badge>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-slate-500">
                <th className="py-3 pr-4">#</th>
                <th className="py-3 pr-4">Date & Time</th>
                <th className="py-3 pr-4">Symbol</th>
                <th className="py-3 pr-4">Session</th>
                <th className="py-3 pr-4">Bias</th>
                <th className="py-3 pr-4">Move</th>
                <th className="py-3 pr-4">Target</th>
                <th className="py-3 pr-4">Invalidation</th>
                <th className="py-3 pr-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row, index) => (
                <tr key={row.id} className="border-b border-white/5 text-slate-300 hover:bg-white/[0.035]">
                  <td className="py-3 pr-4 font-mono text-slate-500">{String(index + 1).padStart(2, "0")}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{row.resolvedAt}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-100">{row.symbol}</td>
                  <td className="py-3 pr-4"><Badge variant="secondary">{row.session}</Badge></td>
                  <td className="py-3 pr-4"><Badge variant={row.actualBias === "bullish" ? "success" : row.actualBias === "bearish" ? "danger" : "warning"}>{row.actualBias}</Badge></td>
                  <td className={cn("py-3 pr-4 font-mono", row.move >= 0 ? "text-emerald-300" : "text-rose-300")}>{formatMove(row.move)}</td>
                  <td className="py-3 pr-4">{row.liquidityTargetReached ? "Reached" : "No"}</td>
                  <td className="py-3 pr-4">{row.invalidationHit ? "Hit" : "Held"}</td>
                  <td className="max-w-[360px] py-3 pr-4 text-slate-500">{row.notes}</td>
                </tr>
              ))}
              {!recentRows.length ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-slate-500">
                    No dated simulated outcomes are stored. Aggregate cycle metrics are not presented as individual outcome rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </ResultPanel>

      <TechnicalDetails title="Metric provenance" description="Full compact source details behind the Results page.">
        <MetricProvenanceDetails snapshot={runtimeSnapshot} />
      </TechnicalDetails>

      {weakest ? (
        <ResultPanel>
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-100">Research feedback loop remains locked to simulation.</p>
              <p className="mt-1 text-sm text-slate-400">
                Weakest agent: {weakest.name}. Prompt changes can be proposed through the lab, but this page cannot approve readiness or create execution intent.
              </p>
            </div>
          </div>
        </ResultPanel>
      ) : null}
        </>
      ) : null}
    </div>
  );
}

function ResultsCalendar({
  calendar,
  hasDatedOutcomes,
  onPreviousMonth,
  onNextMonth,
  onToday
}: {
  calendar: ReturnType<typeof buildResultsCalendar>;
  hasDatedOutcomes: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
}) {
  const activeDays = calendar.cells.filter((cell) => cell.inMonth && (cell.trades > 0 || Math.abs(cell.move) > 0)).length;
  const moveTone = calendar.monthMove > 0 ? "text-emerald-400" : calendar.monthMove < 0 ? "text-rose-400" : "text-slate-200";

  return (
    <section data-testid="results-calendar" className="results-calendar premium-surface overflow-hidden rounded-lg">
      <div className="border-b border-white/10 bg-[#0d1016] px-4 py-5 md:px-6">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="secondary" size="sm" aria-label="Previous month" onClick={onPreviousMonth}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Reporting period</p>
              <p className="financial-figure mt-1 text-xl font-semibold text-slate-100">{compactDate.format(calendar.anchorDate)}</p>
            </div>
            <Button variant="ghost" size="sm" aria-label="Next month" onClick={onNextMonth}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="border-white/10 text-left md:border-x md:px-8 md:text-center">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Monthly dated outcome</p>
            <p className={cn("financial-figure mt-1 text-3xl font-semibold", moveTone)}>{formatMove(calendar.monthMove)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Active days</p>
              <p className="financial-figure mt-0.5 text-sm font-semibold text-slate-200">{activeDays}</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Records</p>
              <p className="financial-figure mt-0.5 text-sm font-semibold text-slate-200">{calendar.monthTrades.toLocaleString()}</p>
            </div>
            <Badge variant={hasDatedOutcomes ? "warning" : "secondary"}>{hasDatedOutcomes ? "Simulation only" : "No dated outcomes"}</Badge>
            <Button variant="secondary" size="sm" onClick={onToday}>Today</Button>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500 md:mt-3">Recorded dated research outcomes only. Aggregate backtest statistics remain in their evidence tabs.</p>
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <div className="min-w-[760px] lg:min-w-0">
          <div className="grid grid-cols-7 border-b border-white/10 bg-[#090c11] text-center text-[11px] font-semibold uppercase text-slate-500">
            {weekdayLabels.map((label) => (
              <div key={label} className="border-r border-white/[0.055] px-3 py-3 last:border-r-0">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendar.cells.map((cell) => (
              <CalendarDayCell key={cell.dateKey} cell={cell} />
            ))}
          </div>
        </div>
      </div>
      {!hasDatedOutcomes ? (
        <div className="border-t border-white/10 px-5 py-3 text-sm text-slate-400">
          Aggregate backtest metrics are intentionally not spread across calendar days. Dated replay, paper, or forward outcomes will appear here when recorded.
        </div>
      ) : null}
    </section>
  );
}

function CalendarDayCell({ cell }: { cell: CalendarCell }) {
  const isWeekSummary = cell.date.getDay() === 6;
  const hasActivity = cell.trades > 0 || Math.abs(cell.move) > 0;
  const moveTone = cell.move > 0 ? "text-emerald-400" : cell.move < 0 ? "text-rose-400" : "text-slate-300";
  const weekMoveTone = cell.weekMove > 0 ? "text-emerald-400" : cell.weekMove < 0 ? "text-rose-400" : "text-slate-300";
  return (
    <div
      className={cn(
        "relative min-h-[116px] border-b border-r border-white/[0.075] bg-[#0c1016] px-3 py-3 text-left",
        !cell.inMonth && "bg-[#080a0e] text-slate-700",
        cell.inMonth && hasActivity && cell.move > 0 && "bg-[linear-gradient(180deg,rgba(16,185,129,0.13),rgba(16,185,129,0.035))]",
        cell.inMonth && hasActivity && cell.move < 0 && "bg-[linear-gradient(180deg,rgba(244,63,94,0.13),rgba(244,63,94,0.035))]",
        isWeekSummary && "border-l border-l-white/10 bg-[#0f131a]",
        cell.isToday && "ring-1 ring-inset ring-sky-400/80"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("financial-figure text-xs font-semibold", cell.inMonth ? "text-slate-400" : "text-slate-700")}>{String(cell.day).padStart(2, "0")}</span>
        {cell.isToday ? <span className="rounded-sm bg-sky-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-sky-300">Today</span> : null}
      </div>
      {isWeekSummary ? (
        <div className="flex min-h-[78px] flex-col justify-end pb-1">
          <div className="text-[10px] font-semibold uppercase text-slate-500">Week {cell.weekIndex + 1}</div>
          <div className={cn("financial-figure mt-1 text-xl font-semibold", weekMoveTone)}>
            {formatMove(cell.weekMove)}
          </div>
          <div className="financial-figure mt-1 text-[11px] text-slate-500">{cell.weekTrades} records</div>
        </div>
      ) : hasActivity ? (
        <div className="flex min-h-[78px] flex-col justify-end pb-1">
          <div className={cn("financial-figure text-xl font-semibold", moveTone)}>
            {formatMove(cell.move)}
          </div>
          <div className="financial-figure mt-1 text-[11px] text-slate-500">{cell.trades} records</div>
        </div>
      ) : null}
    </div>
  );
}

function ResultMetricCard({ detail, label, tone = "neutral", value, visual }: { detail?: string; label: string; tone?: "positive" | "negative" | "neutral"; value: string; visual?: ReactNode }) {
  return (
    <section className="premium-surface-soft min-h-[132px] rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className={cn("mt-3 font-mono text-3xl font-semibold", tone === "positive" && "text-emerald-400", tone === "negative" && "text-rose-400", tone === "neutral" && "text-slate-50")}>{value}</p>
          {detail ? <p className="mt-2 text-sm text-slate-500">{detail}</p> : null}
        </div>
        {visual ? <div className="min-w-[110px]">{visual}</div> : null}
      </div>
    </section>
  );
}

function ResultPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("premium-surface-soft rounded-lg p-5", className)}>
      {children}
    </section>
  );
}

function PanelHeading({ icon, subtitle, title }: { icon: ReactNode; subtitle: string; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sky-300/20 bg-sky-300/10 text-sky-300">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-50">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function SemiGauge({ value }: { value: number }) {
  const safeValue = clamp(value, 0, 1);
  return (
    <div className="relative h-[76px] w-[120px] overflow-hidden">
      <div
        className="h-[120px] w-[120px] rounded-full"
        style={{
          background: `conic-gradient(from 270deg, #22c55e 0deg, #22c55e ${safeValue * 180}deg, #ef4444 ${safeValue * 180}deg, #ef4444 180deg, transparent 180deg)`
        }}
      />
      <div className="absolute bottom-0 left-1/2 h-[82px] w-[82px] -translate-x-1/2 rounded-full bg-[#25252b]" />
    </div>
  );
}

function RatioBar({ value }: { value: number }) {
  const green = clamp(value / 3, 0.12, 0.82) * 100;
  return (
    <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${green}%` }} />
    </div>
  );
}

function StatRow({ label, negative, value }: { label: string; negative?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-black/18 px-3 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={cn("font-mono text-sm font-semibold text-slate-200", negative && "text-rose-300")}>{value}</span>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 break-words font-mono text-xs text-slate-200">{value}</p>
    </div>
  );
}

function buildResultsCalendar({
  metrics,
  outcomes,
  monthOffset = 0
}: {
  metrics?: CanonicalPerformanceMetrics;
  outcomes: MarketOutcome[];
  monthOffset?: number;
}) {
  const base = new Date(metrics?.generatedAt ?? outcomes[0]?.resolvedAt ?? Date.now());
  const anchorDate = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const calendarStart = new Date(firstOfMonth);
  calendarStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
  const outcomeByDay = new Map<string, { move: number; trades: number }>();
  for (const outcome of outcomes) {
    const key = dateKey(new Date(outcome.resolvedAt));
    const current = outcomeByDay.get(key) ?? { move: 0, trades: 0 };
    current.move += outcome.priceMove;
    current.trades += 1;
    outcomeByDay.set(key, current);
  }

  const todayKey = dateKey(new Date());
  const cells: CalendarCell[] = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const key = dateKey(date);
    const source = outcomeByDay.get(key);
    return {
      date,
      dateKey: key,
      day: date.getDate(),
      inMonth: date.getMonth() === anchorDate.getMonth(),
      move: Math.round((source?.move ?? 0) * 100) / 100,
      trades: source?.trades ?? 0,
      isToday: key === todayKey,
      weekIndex: Math.floor(index / 7),
      weekMove: 0,
      weekTrades: 0
    };
  });

  for (let week = 0; week < 6; week += 1) {
    const weekCells = cells.slice(week * 7, week * 7 + 7);
    const weekMove = weekCells.reduce((sum, cell) => sum + cell.move, 0);
    const weekTrades = weekCells.reduce((sum, cell) => sum + cell.trades, 0);
    weekCells.forEach((cell) => {
      cell.weekMove = Math.round(weekMove * 100) / 100;
      cell.weekTrades = weekTrades;
    });
  }

  return {
    anchorDate,
    cells,
    monthMove: Math.round(cells.filter((cell) => cell.inMonth).reduce((sum, cell) => sum + cell.move, 0) * 100) / 100,
    monthTrades: cells.filter((cell) => cell.inMonth).reduce((sum, cell) => sum + cell.trades, 0)
  };
}

function buildOutcomeMoveCurve(cells: CalendarCell[]) {
  let running = 0;
  return cells
    .filter((cell) => cell.inMonth && (cell.trades > 0 || Math.abs(cell.move) > 0))
    .map((cell) => {
      running += cell.move;
      return {
        label: String(cell.day),
        cumulativeMove: Math.round(running * 100) / 100
      };
    });
}

function buildTradeBars(cells: CalendarCell[]) {
  return cells
    .filter((cell) => cell.inMonth)
    .map((cell) => ({
      label: String(cell.day),
      trades: cell.trades
    }));
}

function buildRecentOutcomeRows(outcomes: MarketOutcome[]) {
  return outcomes
    .slice()
    .sort((left, right) => new Date(right.resolvedAt).getTime() - new Date(left.resolvedAt).getTime())
    .slice(0, 12)
    .map((outcome) => ({
      id: outcome.id,
      resolvedAt: new Date(outcome.resolvedAt).toLocaleString(),
      symbol: outcome.symbol,
      session: outcome.session,
      actualBias: outcome.actualBias,
      move: outcome.priceMove,
      liquidityTargetReached: outcome.liquidityTargetReached,
      invalidationHit: outcome.invalidationHit,
      notes: outcome.notes
    }));
}

function averageWinLossRatio(metrics?: CanonicalPerformanceMetrics) {
  if (!metrics?.profitFactor || !metrics.winningTrades || !metrics.losingTrades) {
    return metrics?.profitFactor ?? null;
  }
  return metrics.profitFactor * (metrics.losingTrades / metrics.winningTrades);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMove(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
