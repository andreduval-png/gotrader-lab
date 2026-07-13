import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

import { WORKSPACE_HERO, WORKSPACE_PRIMARY_PANEL, WORKSPACE_SECTION_LABEL } from "@/components/common/workspaceStyles";

/**
 * Retained only as a fail-closed compatibility surface for unfinished local work.
 * The application does not route to this component.
 */
export function ExecuteHubView() {
  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="execution-disabled-notice">
      <section className={WORKSPACE_HERO}>
        <p className={WORKSPACE_SECTION_LABEL}>Safety boundary</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Execution is disabled</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          GoTrader is a research-only terminal. It has no execution, broker, or readiness-override authority.
        </p>
      </section>

      <section className={`${WORKSPACE_PRIMARY_PANEL} space-y-3`}>
        <div className="flex items-center gap-2 text-slate-200">
          <Lock className="h-4 w-4" aria-hidden="true" />
          <h2 className="font-medium">Authority locked</h2>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Readout label="Execution authority" value="none" />
          <Readout label="Broker authority" value="none" />
          <Readout label="Readiness override" value="none" />
        </dl>
        <Link
          className="inline-flex h-8 items-center justify-center rounded border border-slate-700 px-3 text-sm font-medium text-slate-200 hover:bg-slate-800"
          to="/dashboard"
        >
          Return to research overview
        </Link>
      </section>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-200">{value}</dd>
    </div>
  );
}
