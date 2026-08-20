import { type CSSProperties, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  CircleStop,
  Clock3,
  Crosshair,
  Database,
  Gauge,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert
} from "lucide-react";

import { WORKSPACE_PAGE, WORKSPACE_SECTION_LABEL } from "@/components/common/workspaceStyles";
import { useOperatorConsole } from "@/components/operator/useOperatorConsole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  runOperatorResearchCycle,
  stopOperatorResearchCycle,
  type OperatorCycleStage
} from "@/lib/operatorConsole";
import type { LabState } from "@/lib/types";
import { cn } from "@/lib/utils";

type OperatorConsoleViewProps = {
  state: LabState;
};

const percent = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return `${normalized.toFixed(normalized >= 10 ? 0 : 1)}%`;
};

const number = (value?: number, suffix = "") =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "--";

const price = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: Math.abs(value) >= 100 ? 2 : 4,
    maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 5
  });
};

const time = (value?: string) => {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not yet";
  return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const words = (value?: string) => value ? value.replace(/_/g, " ") : "Unavailable";

const elapsedTime = (startedAt?: string, completedAt?: string, now = Date.now()) => {
  const startedMs = Date.parse(startedAt ?? "");
  if (!Number.isFinite(startedMs)) return "--:--";
  const completedMs = Date.parse(completedAt ?? "");
  const elapsedSeconds = Math.max(0, Math.floor(((Number.isFinite(completedMs) ? completedMs : now) - startedMs) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const normalizedConfidence = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.abs(value) <= 1 ? value : value / 100;
};

const probabilityPresentation = (value?: number) => {
  const normalized = normalizedConfidence(value);
  if (normalized === undefined) return { label: "Unavailable", percentage: "--", tone: "neutral" as const };
  if (normalized >= 0.7) return { label: "High", percentage: percent(normalized), tone: "positive" as const };
  if (normalized >= 0.5) return { label: "Medium", percentage: percent(normalized), tone: "caution" as const };
  return { label: "Low", percentage: percent(normalized), tone: "negative" as const };
};

const toneClasses = {
  neutral: "bg-[#0d1420] text-slate-100",
  positive: "bg-emerald-400/[0.07] text-emerald-300",
  negative: "bg-rose-400/[0.07] text-rose-300",
  caution: "bg-amber-400/[0.07] text-amber-200"
} as const;

const metricRows = (snapshot: ReturnType<typeof useOperatorConsole>["snapshot"]) => [
  { label: "Research trades", value: snapshot.results.totalTrades.toLocaleString(), note: "latest cycle" },
  { label: "Win rate", value: percent(snapshot.results.winRate), note: "simulation" },
  { label: "Average R", value: number(snapshot.results.averageR, "R"), note: "per outcome" },
  { label: "Max drawdown", value: number(snapshot.results.maxDrawdownR, "R"), note: "research sample" },
  { label: "Profit factor", value: number(snapshot.results.profitFactor), note: snapshot.results.walkForwardStatus }
];

const cycleHeartbeatFor = (stage: OperatorCycleStage) => {
  switch (stage) {
    case "activating_source":
      return { rgb: "34 211 238", label: "Source pulse" };
    case "building_market_read":
      return { rgb: "96 165 250", label: "Market-read pulse" };
    case "running_research":
      return { rgb: "232 121 249", label: "Research pulse" };
    case "finalizing":
      return { rgb: "52 211 153", label: "Results pulse" };
    default:
      return { rgb: "34 211 238", label: "Cycle pulse" };
  }
};

export function OperatorConsoleView({ state }: OperatorConsoleViewProps) {
  const { snapshot, refresh } = useOperatorConsole();
  const [commandError, setCommandError] = useState<string>();
  const [clockNow, setClockNow] = useState(() => Date.now());
  const cycleActive = snapshot.cycle.status === "running" || snapshot.cycle.status === "stopping";
  const cycleElapsed = elapsedTime(snapshot.cycle.startedAt, snapshot.cycle.completedAt, clockNow);
  const probability = probabilityPresentation(snapshot.insight.confidence);
  const targetProvenance = snapshot.researchPlan.targetProvenance;
  const targetGateStatus = targetProvenance?.gateStatus ?? "unavailable";
  const cycleHeartbeat = cycleHeartbeatFor(snapshot.cycle.stage);
  const cycleHeartbeatStyle = {
    "--cycle-heartbeat-rgb": cycleHeartbeat.rgb
  } as CSSProperties;

  useEffect(() => {
    setClockNow(Date.now());
    if (!cycleActive) return undefined;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cycleActive, snapshot.cycle.cycleId, snapshot.cycle.startedAt]);

  const start = async () => {
    setCommandError(undefined);
    try {
      await runOperatorResearchCycle(state);
      await refresh();
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "The research cycle could not start.");
    }
  };

  const stop = () => {
    stopOperatorResearchCycle();
    void refresh();
  };

  return (
    <div className={cn(WORKSPACE_PAGE, "space-y-5")} data-testid="operator-console">
      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0b111b] shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-5 border-b border-white/10 px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={WORKSPACE_SECTION_LABEL}>Research operations</p>
              <Badge variant="secondary">Supervised autonomy</Badge>
              <Badge variant="muted">Authority none</Badge>
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">Operator Console</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Start one guarded research cycle, monitor its progress, and review only the decisions that need you.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {cycleActive ? (
              <Button variant="destructive" onClick={stop} disabled={snapshot.cycle.status === "stopping"} data-testid="operator-stop-cycle">
                <CircleStop className="mr-2 h-4 w-4" aria-hidden="true" />
                {snapshot.cycle.status === "stopping" ? "Stopping..." : "Stop cycle"}
              </Button>
            ) : (
              <Button onClick={() => void start()} data-testid="operator-start-cycle">
                <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                Start research cycle
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => void refresh()} title="Refresh operator summary" aria-label="Refresh operator summary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-px bg-white/10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div
            className={cn("relative min-w-0 bg-[#0b111b] px-5 py-5 sm:px-7", cycleActive && "cycle-status-running")}
            data-cycle-running={cycleActive ? "true" : "false"}
            style={cycleActive ? cycleHeartbeatStyle : undefined}
          >
            <div className="flex min-w-0 items-start gap-3">
              {cycleActive ? (
                <div
                  className="cycle-heartbeat-beacon mt-1 shrink-0"
                  data-testid="operator-cycle-heartbeat"
                  role="status"
                  aria-label={`${cycleHeartbeat.label}. ${snapshot.cycle.message}`}
                >
                  <span className="cycle-heartbeat-ring cycle-heartbeat-ring-primary" aria-hidden="true" />
                  <span className="cycle-heartbeat-ring cycle-heartbeat-ring-secondary" aria-hidden="true" />
                  <span className="cycle-heartbeat-core" aria-hidden="true">
                    <Activity className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                </div>
              ) : (
                <div className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                  snapshot.cycle.status === "completed" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" :
                    snapshot.cycle.status === "failed" || snapshot.cycle.status === "blocked" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" :
                      "border-white/10 bg-white/[0.04] text-slate-400"
                )}>
                  {snapshot.cycle.status === "completed" ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> :
                    <BrainCircuit className="h-5 w-5" aria-hidden="true" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Cycle status</p>
                    <p className="mt-1 text-lg font-semibold capitalize text-slate-100">{snapshot.cycle.status.replace(/_/g, " ")}</p>
                    {cycleActive ? (
                      <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]" style={{ color: `rgb(${cycleHeartbeat.rgb})` }}>
                        {cycleHeartbeat.label}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-sky-200"
                      data-testid="operator-cycle-elapsed"
                      title={cycleActive ? "Elapsed cycle time" : "Final cycle duration"}
                    >
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {cycleElapsed}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-300">{snapshot.cycle.progressPercent}%</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
                    style={{ width: `${snapshot.cycle.progressPercent}%` }}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-400">{snapshot.cycle.message}</p>
                {commandError ? <p className="mt-2 text-sm text-rose-300">{commandError}</p> : null}
              </div>
            </div>
          </div>

          <div className="bg-[#0b111b] px-5 py-5 sm:px-7">
            <div className="flex items-start gap-3">
              <Database className={cn("mt-0.5 h-5 w-5 shrink-0", snapshot.source.researchEligible ? "text-emerald-300" : "text-amber-300")} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Research source</p>
                <p className="mt-1 text-base font-semibold text-slate-100">
                  {snapshot.source.brokerSymbol ?? snapshot.source.requestedSymbol} <span className="font-normal text-slate-500">to</span> {snapshot.source.requestedSymbol}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {snapshot.source.candleCount.toLocaleString()} {snapshot.source.timeframe} candles · {snapshot.source.statusLabel}
                </p>
                <p className="mt-2 truncate font-mono text-[0.68rem] text-slate-600" title={snapshot.source.fingerprint}>
                  {snapshot.source.fingerprint ?? "No source fingerprint"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-5" aria-label="Latest research results">
        {metricRows(snapshot).map((metric) => (
          <div key={metric.label} className="min-w-0 bg-[#0d1420] px-5 py-4">
            <p className="text-xs text-slate-500">{metric.label}</p>
            <p className="mt-2 truncate text-2xl font-semibold tabular-nums text-slate-100">{metric.value}</p>
            <p className="mt-1 truncate text-xs capitalize text-slate-600">{metric.note}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <section
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1420]"
          data-testid="operator-gbrain-memory-summary"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
            <div>
              <p className={WORKSPACE_SECTION_LABEL}>Research memory</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-100">Research evidence and agent memory</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Native evidence is authoritative; memory packets are compact advisory copies.</p>
            </div>
            <Badge variant={snapshot.memory.gbrainDeliveryEnabled ? "warning" : "muted"}>
              local memory delivery {snapshot.memory.gbrainDeliveryEnabled ? "on" : "off"}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4 xl:grid-cols-2">
            {[
              ["Stored cycles", snapshot.memory.storedEvidenceRecords],
              ["Profile identities", snapshot.memory.profileIdentities],
              ["Memory queued", snapshot.memory.gbrainPending],
              ["Memory delivered", snapshot.memory.gbrainDelivered]
            ].map(([label, value]) => (
              <div key={label} className="bg-[#0d1420] px-5 py-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-100">{Number(value).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
            <p className="min-w-0 truncate text-xs text-slate-500">
              {snapshot.memory.latestProfile
                ? `${snapshot.memory.latestProfile.replace(/_/g, " ")} / ${snapshot.memory.independentCycleDates} independent dates`
                : "No completed cycle evidence stored yet."}
              {snapshot.memory.gbrainFailed ? ` / ${snapshot.memory.gbrainFailed} delivery failures` : ""}
            </p>
            <Link className="inline-flex items-center text-xs font-medium text-sky-300 hover:text-sky-200" to="/self-improvement">
              Open memory <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1420]"
          data-testid="operator-research-risk-preview"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <Crosshair className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className={WORKSPACE_SECTION_LABEL}>Research trade plan</p>
                <h3 className="mt-2 truncate text-lg font-semibold capitalize text-slate-100">{snapshot.researchPlan.setup}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {snapshot.researchPlan.entryPriceMethod === "rr_implied_recovery"
                    ? "Entry recovered from the stored stop, target, and R:R geometry."
                    : "Deterministic entry from the latest compact current read."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={snapshot.researchPlan.setupDirection === "bullish" ? "success" : snapshot.researchPlan.setupDirection === "bearish" ? "danger" : "muted"}>
                {snapshot.researchPlan.setupDirection} setup
              </Badge>
              <Badge variant={snapshot.researchPlan.signal === "NO_TRADE" ? "muted" : "success"}>
                {snapshot.researchPlan.signal.replace("_", " ")}
              </Badge>
              <Badge variant="muted">{snapshot.researchPlan.status.replace(/_/g, " ")}</Badge>
              <Badge variant={snapshot.researchPlan.planIdentityStatus === "current" ? "success" : "warning"}>
                {snapshot.researchPlan.planIdentityStatus.replace(/_/g, " ")}
              </Badge>
              <Badge variant="warning">Informational only</Badge>
            </div>
          </div>

          {snapshot.researchPlan.planCoherence === "incoherent" ? (
            <div className="border-b border-amber-400/20 bg-amber-400/[0.07] px-5 py-3 text-sm leading-6 text-amber-200 sm:px-6" role="alert">
              Price plan rejected: {snapshot.researchPlan.planCoherenceReason}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2 2xl:grid-cols-3">
            {[
              { label: "Entry price", value: price(snapshot.researchPlan.entryPrice), tone: snapshot.researchPlan.signal === "NO_TRADE" ? "neutral" as const : "positive" as const },
              { label: "Stop loss", value: price(snapshot.researchPlan.stopLoss), tone: typeof snapshot.researchPlan.stopLoss === "number" ? "negative" as const : "neutral" as const },
              { label: "Take profit", value: price(snapshot.researchPlan.takeProfit), tone: typeof snapshot.researchPlan.takeProfit === "number" ? "positive" as const : "neutral" as const },
              { label: "Risk / reward", value: number(snapshot.researchPlan.riskReward, "R"), tone: typeof snapshot.researchPlan.riskReward !== "number" ? "neutral" as const : snapshot.researchPlan.riskReward > 0 ? "positive" as const : "negative" as const },
              { label: "Probability", value: `${probability.label} · ${probability.percentage}`, tone: probability.tone }
            ].map(({ label, value, tone }) => (
              <div
                key={label}
                className={cn("min-w-0 px-4 py-4", toneClasses[tone])}
                data-result-tone={tone}
                data-testid={label === "Probability" ? "operator-plan-probability" : undefined}
              >
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white">{label}</p>
                <p
                  className="mt-2 whitespace-nowrap font-mono text-sm font-semibold tabular-nums sm:text-base"
                  data-testid={label === "Probability" ? "operator-plan-probability-value" : undefined}
                  title={String(value)}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 px-5 py-4 sm:px-6" data-testid="operator-target-provenance">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white">Target selection</p>
                <p className="mt-1 text-xs text-slate-400">Target gate only; overall candidate and readiness gates remain separate.</p>
              </div>
              <Badge variant={targetGateStatus === "accepted" ? "success" : targetGateStatus === "rejected" ? "danger" : "muted"}>
                {words(targetGateStatus)} target
              </Badge>
            </div>
            <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Target type", value: words(targetProvenance?.type) },
                { label: "Source timeframe", value: targetProvenance?.sourceTimeframe ?? "Unavailable" },
                { label: "Distance", value: typeof targetProvenance?.distancePoints === "number" ? number(targetProvenance.distancePoints, " points") : "Unavailable" },
                {
                  label: "RR gate",
                  value: targetProvenance
                    ? `${number(targetProvenance.rr, "R")} / ${number(targetProvenance.minimumRR, "R")} minimum`
                    : "Unavailable"
                }
              ].map(({ label, value }) => (
                <div key={label} className="min-w-0">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
                  <p className="mt-1 break-words text-sm font-medium capitalize text-slate-100">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-slate-400">
              <span className="font-semibold text-slate-200">Selection reason: </span>
              {targetProvenance?.selectionReason ?? "No identity-bound target provenance is available for this plan."}
              {targetProvenance?.rejectionReasons.length ? (
                <span className="mt-1 block text-rose-300" data-testid="operator-target-rejection-reason">
                  {targetProvenance.rejectionReasons.join(" ")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 px-5 py-4 sm:grid-cols-3 sm:px-6">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-600">Market risk screen</p>
              <p className="mt-1 text-sm capitalize text-slate-300">{snapshot.researchPlan.riskScreeningStatus}</p>
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-600">Account-risk engine</p>
              <p className="mt-1 text-sm text-amber-200">External simulation required</p>
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-600">Max research risk</p>
              <p className="mt-1 text-sm tabular-nums text-slate-300">
                {typeof snapshot.researchPlan.recommendedMaxRiskPerTradePct === "number"
                  ? `${snapshot.researchPlan.recommendedMaxRiskPerTradePct.toFixed(2)}%`
                  : "Not available"}
              </p>
            </div>
            <p className="text-xs leading-5 text-slate-500 sm:col-span-3">
              {snapshot.researchPlan.riskScreeningReason} The browser creates no risk decision, reservation, or order; sizing and account-risk approval require the independent deterministic simulation governor.
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-2xl border border-white/10 bg-[#0d1420] p-5 sm:p-6" data-testid="operator-market-brief">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={WORKSPACE_SECTION_LABEL}>Current market brief</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-100">{snapshot.insight.setup}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="muted">{snapshot.insight.bias}</Badge>
              <Badge variant="secondary">{snapshot.insight.modelLane}</Badge>
              <Badge variant={probability.tone === "positive" ? "success" : probability.tone === "negative" ? "danger" : probability.tone === "caution" ? "warning" : "muted"}>
                {probability.label} probability · {probability.percentage}
              </Badge>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">{snapshot.insight.summary}</p>
          <div className="mt-5 flex items-start gap-3 border-t border-white/10 pt-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">System next action</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">{snapshot.insight.nextAction}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2" data-testid="operator-prediction-summary">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Forward watch</p>
              <p className="mt-1 text-sm font-medium capitalize text-slate-200">{snapshot.prediction.latestFamily}</p>
              <p className="mt-1 text-xs capitalize text-slate-500">
                {snapshot.prediction.latestState} / {snapshot.prediction.pendingForecasts} pending
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Forecast calibration</p>
              <p className="mt-1 text-sm font-medium capitalize text-slate-200">{snapshot.prediction.classification}</p>
              <p className="mt-1 text-xs text-slate-500">
                {snapshot.prediction.completedForecasts} causal outcomes
                {typeof snapshot.prediction.averageRealizedR === "number" ? ` / ${number(snapshot.prediction.averageRealizedR, "R")} avg` : ""}
              </p>
            </div>
            <p className="text-xs leading-5 text-slate-500 sm:col-span-2">{snapshot.prediction.nextAction}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0d1420] p-5 sm:p-6" data-testid="operator-decision-summary">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={WORKSPACE_SECTION_LABEL}>Decision inbox</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-100">
                {snapshot.decisions.length ? `${snapshot.decisions.length} need review` : "No action required"}
              </h3>
            </div>
            {snapshot.decisions.length ? <TriangleAlert className="h-5 w-5 text-amber-300" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {snapshot.decisions[0]?.detail ?? "Research can remain unattended. GoTrader will surface a decision only when operator review is genuinely required."}
          </p>
          <Link className="mt-5 inline-flex items-center text-sm font-medium text-sky-300 hover:text-sky-200" to="/advisor">
            Open decision inbox <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Operator shortcuts">
        <Link className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-4 transition-colors hover:bg-white/[0.06]" to="/performance">
          <BarChart3 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="font-medium text-slate-200">Results</p><p className="truncate text-xs text-slate-500">Performance and research outcomes</p></div>
          <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
        <Link className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-4 transition-colors hover:bg-white/[0.06]" to="/research-lab">
          <Gauge className="h-5 w-5 text-sky-300" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="font-medium text-slate-200">Advanced Research Lab</p><p className="truncate text-xs text-slate-500">Diagnostics and manual workflows</p></div>
          <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-4">
          <Clock3 className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <div className="min-w-0"><p className="font-medium text-slate-200">Last completed</p><p className="truncate text-xs text-slate-500">{time(snapshot.cycle.completedAt ?? snapshot.results.generatedAt)}</p></div>
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
        {snapshot.safetyNote}
      </div>
    </div>
  );
}
