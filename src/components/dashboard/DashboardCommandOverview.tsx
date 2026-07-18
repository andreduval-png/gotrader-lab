import { Link } from "react-router-dom";
import { ArrowRight, Gauge, Play } from "lucide-react";

import { useLatestValidationChainEntry } from "@/components/common/ValidationChainCard";
import { useSourceStatusSnapshot } from "@/components/common/SourceStatusBanner";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { sourceStatusLabel } from "@/lib/sourceStatus";
import { validationChainStatusLabel } from "@/lib/validationChain";
import { cn } from "@/lib/utils";
import {
  AUTHORITY_BADGE_LABEL,
  WORKSPACE_CARD_ACCENT,
  WORKSPACE_METRIC_GRID,
  WORKSPACE_SECTION_LABEL
} from "@/components/common/workspaceStyles";

type DashboardCommandOverviewProps = {
  className?: string;
  paperDemoBlocker?: string;
  paperDemoCandidate?: boolean;
  primaryBlocker?: string;
  primarySetupLabel?: string;
  researchReady?: boolean;
  validationNextAction?: string;
  blockers?: string[];
};

/**
 * Command overview strip: answers source, recognition, validation next step,
 * Research Ready / Paper-Demo status, and where to click next.
 */
export function DashboardCommandOverview({
  className,
  paperDemoBlocker,
  paperDemoCandidate,
  primaryBlocker,
  primarySetupLabel = "waiting for Activate Market",
  researchReady,
  validationNextAction,
  blockers = []
}: DashboardCommandOverviewProps) {
  const source = useSourceStatusSnapshot();
  const chain = useLatestValidationChainEntry();

  const sourceLabel = source
    ? `${source.requestedSymbol} ← ${source.brokerSymbol ?? "n/a"} · ${source.primaryTimeframe} · ${sourceStatusLabel(source.sourceStatus)}`
    : "Resolving MT5 / import source…";

  const validationLabel = chain
    ? `${chain.setupLabel} · ${validationChainStatusLabel(chain.hypothesisStatus)}`
    : "No validation queued — recognition is not evidence";

  const nextStep =
    validationNextAction ??
    chain?.nextAction ??
    (source?.isMockOrSample
      ? "Activate MT5 read-only research source before queuing validation."
      : primaryBlocker ?? "Open Advisor and run Activate Market.");

  const checklist = [
    ...blockers.slice(0, 4),
    ...(primaryBlocker && !blockers.includes(primaryBlocker) ? [primaryBlocker] : []),
    ...(paperDemoBlocker && paperDemoBlocker !== primaryBlocker && !blockers.includes(paperDemoBlocker)
      ? [paperDemoBlocker]
      : [])
  ].slice(0, 5);

  return (
    <section
      data-testid="dashboard-command-overview"
      className={cn(`${WORKSPACE_CARD_ACCENT} px-4 py-4 sm:px-5`, className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
          <div>
            <p className={WORKSPACE_SECTION_LABEL}>Command overview</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-50">Research workflow at a glance</h3>
          </div>
          <Badge variant="muted">{AUTHORITY_BADGE_LABEL}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="#research-cycle"
            data-testid="command-center-primary-cta"
            className={buttonVariants({ variant: "default", size: "sm", className: "inline-flex items-center gap-1.5" })}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            Run Full Research Cycle
          </a>
          <Link
            to="/advisor"
            className={buttonVariants({ variant: "secondary", size: "sm", className: "inline-flex items-center gap-1.5" })}
          >
            Open Advisor
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <dl className={`mt-4 ${WORKSPACE_METRIC_GRID}`}>
        <OverviewTile label="Market / source" testId="dashboard-overview-source" value={sourceLabel} />
        <OverviewTile label="Latest setup" testId="dashboard-overview-setup" value={primarySetupLabel} />
        <OverviewTile label="Validation chain" testId="dashboard-overview-validation" value={validationLabel} />
        <OverviewTile
          label="Research Ready"
          testId="dashboard-overview-research-ready"
          value={researchReady === undefined ? "loading" : researchReady ? "yes — checklist gates passed" : "no — more evidence required"}
        />
        <OverviewTile
          label="Paper-Demo Candidate"
          testId="dashboard-overview-paper-demo"
          value={
            paperDemoCandidate === undefined
              ? "loading"
              : paperDemoCandidate
                ? "eligible — review promotion checklist"
                : paperDemoBlocker ?? "not eligible yet"
          }
        />
        <OverviewTile label="Next step" testId="dashboard-overview-next" value={nextStep} />
      </dl>
      {checklist.length ? (
        <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-950/20 p-3" data-testid="command-center-blocker-checklist">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Blockers</p>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-50/90">
            {checklist.map((item) => (
              <li key={item} className="flex flex-wrap items-center justify-between gap-2">
                <span>{item}</span>
                <a href="#research-cycle" className="text-xs text-sky-300 underline underline-offset-2">
                  Open research cycle
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function OverviewTile({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div data-testid={testId} className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <dt className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-sm text-slate-100" title={value}>
        {value}
      </dd>
    </div>
  );
}
