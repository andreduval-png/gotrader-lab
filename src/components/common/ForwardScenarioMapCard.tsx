import { Activity, Eye, ShieldCheck } from "lucide-react";

import { WORKSPACE_CARD, WORKSPACE_SECTION_LABEL } from "@/components/common/workspaceStyles";
import { Badge } from "@/components/ui/badge";
import type { ForwardScenarioMap } from "@/lib/forwardScenario";

const readable = (value: string) => value.replace(/_/g, " ");

const stateVariant = (state: ForwardScenarioMap["currentDecisionState"]) => {
  if (state === "confirmed_setup") return "success" as const;
  if (state === "invalidated") return "danger" as const;
  if (state === "no_trade" || state === "wait_for_confirmation") return "warning" as const;
  return "default" as const;
};

export function ForwardScenarioMapCard({
  map,
  compact = false,
  context = "dashboard"
}: {
  map?: ForwardScenarioMap;
  compact?: boolean;
  context?: "dashboard" | "ict_lab" | "self_improvement";
}) {
  if (!map) {
    return (
      <section className={`${WORKSPACE_CARD} p-4`} data-testid="forward-scenario-map">
        <span className={WORKSPACE_SECTION_LABEL}>Forward scenario map</span>
        <p className="mt-2 text-sm text-slate-400">Activate an eligible MT5 research source to build a deterministic scenario forecast.</p>
      </section>
    );
  }

  const primary = map.primaryScenario;
  const recommendation = map.recommendedResearchTest;

  return (
    <section className={`${WORKSPACE_CARD} p-4 sm:p-5`} data-testid="forward-scenario-map">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <span className={WORKSPACE_SECTION_LABEL}>Forward scenario map</span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-100">{readable(primary.scenarioFamily)}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{primary.thesis}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={stateVariant(map.currentDecisionState)}>{readable(map.currentDecisionState)}</Badge>
          <Badge variant="secondary">{readable(map.marketPhase)}</Badge>
          <Badge variant="muted">{primary.probabilityBand} probability</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="border-l-2 border-cyan-300/40 pl-3">
          <p className={WORKSPACE_SECTION_LABEL}>Liquidity draw</p>
          <p className="mt-1 text-sm text-slate-200">{primary.liquidityDraw}</p>
        </div>
        <div className="border-l-2 border-amber-300/40 pl-3">
          <p className={WORKSPACE_SECTION_LABEL}>Confirmation missing</p>
          <p className="mt-1 text-sm text-slate-200">{map.missingConfirmations[0] ?? "No additional confirmation identified."}</p>
        </div>
        <div className="border-l-2 border-emerald-300/40 pl-3">
          <p className={WORKSPACE_SECTION_LABEL}>Watch next</p>
          <p className="mt-1 text-sm text-slate-200">{map.nextEvidenceToWatch[0] ?? "Continue deterministic observation."}</p>
        </div>
      </div>

      {compact ? (
        <div className="mt-3 grid gap-2 border-t border-white/[0.07] pt-3 text-xs sm:grid-cols-2">
          <p className="text-slate-400">
            <span className="text-slate-500">Secondary:</span>{" "}
            {map.secondaryScenario ? readable(map.secondaryScenario.scenarioFamily) : "none ranked"}
          </p>
          <p className="text-slate-400">
            <span className="text-slate-500">Conditional plan:</span>{" "}
            {primary.conditionalEntryPlan.status} entry / {primary.conditionalStopPlan.status} stop / {primary.conditionalTargetPlan.status} targets
          </p>
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Eye className="h-4 w-4 text-cyan-300" aria-hidden="true" /> Expected sequence
            </div>
            <ol className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
              {primary.expectedSequence.slice(0, 5).map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
            </ol>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
            <p className="text-sm font-medium text-slate-200">Conditional research plan</p>
            <dl className="mt-2 space-y-2 text-xs leading-5">
              <div><dt className="text-slate-500">Entry</dt><dd className="text-slate-300">{primary.conditionalEntryPlan.trigger}</dd></div>
              <div><dt className="text-slate-500">Stop reference</dt><dd className="text-slate-300">{primary.conditionalStopPlan.condition}</dd></div>
              <div><dt className="text-slate-500">Targets</dt><dd className="text-slate-300">{primary.conditionalTargetPlan.references.map((item) => item.label).join("; ") || primary.conditionalTargetPlan.condition}</dd></div>
            </dl>
          </div>
        </div>
      ) : null}

      {recommendation ? (
        <div className="mt-4 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-xs leading-5 text-cyan-50">
          <span className="font-medium">Recommended research test:</span> {recommendation.reason}
          {context === "self_improvement" && recommendation.suggestedProfileFork ? (
            <span className="mt-1 block text-cyan-100/70">The frozen profile cannot be mutated. Any change must fork to {recommendation.suggestedProfileFork} and pass all deterministic gates.</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
        <span>{primary.safetyNotice}</span>
        <Badge variant="muted">authority none / none / none</Badge>
        <Badge variant="muted">auto-apply false</Badge>
      </div>
    </section>
  );
}
