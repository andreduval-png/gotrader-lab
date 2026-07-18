import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ClipboardCheck, ShieldCheck, TriangleAlert } from "lucide-react";

import { WORKSPACE_PAGE, WORKSPACE_SECTION_LABEL } from "@/components/common/workspaceStyles";
import { useOperatorConsole } from "@/components/operator/useOperatorConsole";
import { Badge } from "@/components/ui/badge";

const severityStyles = {
  info: "border-sky-400/20 bg-sky-400/[0.05]",
  warning: "border-amber-400/20 bg-amber-400/[0.05]",
  critical: "border-rose-400/20 bg-rose-400/[0.05]"
};

export function OperatorDecisionsView() {
  const { snapshot } = useOperatorConsole();

  return (
    <div className={`${WORKSPACE_PAGE} space-y-5`} data-testid="operator-decisions">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={WORKSPACE_SECTION_LABEL}>Operator review</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-50">Decision Inbox</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Only decisions requiring human judgment appear here. Analysis, replay, and validation details remain in the Advanced Research Lab.
          </p>
        </div>
        <Badge variant="muted">{snapshot.decisions.length} open</Badge>
      </header>

      {snapshot.decisions.length ? (
        <div className="space-y-3">
          {snapshot.decisions.map((decision) => (
            <article key={decision.id} className={`rounded-xl border px-5 py-4 ${severityStyles[decision.severity]}`}>
              <div className="flex items-start gap-4">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-100">{decision.title}</h3>
                    <Badge variant="muted">{decision.kind.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{decision.detail}</p>
                  <Link className="mt-3 inline-flex items-center text-sm font-medium text-sky-300 hover:text-sky-200" to={decision.href}>
                    {decision.actionLabel} <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-6 text-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-300" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold text-slate-100">No manual decision required</h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
            GoTrader is either ready for a cycle or continuing within deterministic research gates. You will be notified when source recovery, proposal review, or Paper-Demo review needs you.
          </p>
          <Link className="mt-5 inline-flex items-center text-sm font-medium text-sky-300 hover:text-sky-200" to="/dashboard">
            Return to console <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        <Link className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-4 hover:bg-white/[0.06]" to="/research-advisor">
          <ClipboardCheck className="h-5 w-5 text-sky-300" aria-hidden="true" />
          <div className="min-w-0"><p className="font-medium text-slate-200">Advanced Advisor</p><p className="truncate text-xs text-slate-500">Full thesis, validation, and OpenClaw review</p></div>
        </Link>
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-4">
          <ShieldCheck className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          <div><p className="font-medium text-slate-200">Safety locked</p><p className="text-xs text-slate-500">No execution, broker authority, readiness override, or auto-apply</p></div>
        </div>
      </section>
    </div>
  );
}
