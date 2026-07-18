import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  CircleStop,
  Clock3,
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
  stopOperatorResearchCycle
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

const time = (value?: string) => {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not yet";
  return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const metricRows = (snapshot: ReturnType<typeof useOperatorConsole>["snapshot"]) => [
  { label: "Research trades", value: snapshot.results.totalTrades.toLocaleString(), note: "latest cycle" },
  { label: "Win rate", value: percent(snapshot.results.winRate), note: "simulation" },
  { label: "Average R", value: number(snapshot.results.averageR, "R"), note: "per outcome" },
  { label: "Max drawdown", value: number(snapshot.results.maxDrawdownR, "R"), note: "research sample" },
  { label: "Profit factor", value: number(snapshot.results.profitFactor), note: snapshot.results.walkForwardStatus }
];

export function OperatorConsoleView({ state }: OperatorConsoleViewProps) {
  const { snapshot, refresh } = useOperatorConsole();
  const [commandError, setCommandError] = useState<string>();
  const cycleActive = snapshot.cycle.status === "running" || snapshot.cycle.status === "stopping";

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

        <div className="grid gap-px bg-white/10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-[#0b111b] px-5 py-5 sm:px-7">
            <div className="flex items-start gap-3">
              <div className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                cycleActive ? "border-sky-400/30 bg-sky-400/10 text-sky-300" :
                  snapshot.cycle.status === "completed" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" :
                    snapshot.cycle.status === "failed" || snapshot.cycle.status === "blocked" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" :
                      "border-white/10 bg-white/[0.04] text-slate-400"
              )}>
                {cycleActive ? <Activity className="h-5 w-5" aria-hidden="true" /> :
                  snapshot.cycle.status === "completed" ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> :
                    <BrainCircuit className="h-5 w-5" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Cycle status</p>
                    <p className="mt-1 text-lg font-semibold capitalize text-slate-100">{snapshot.cycle.status.replace(/_/g, " ")}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-300">{snapshot.cycle.progressPercent}%</span>
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
              <Badge variant="muted">{percent(snapshot.insight.confidence)} confidence</Badge>
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
