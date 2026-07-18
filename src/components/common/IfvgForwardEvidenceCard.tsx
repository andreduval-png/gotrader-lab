import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS,
  FORWARD_EVIDENCE_UPDATED_EVENT,
  auditForwardEvidenceCycleSample,
  buildForwardEvidenceGatewayReport,
  evaluateForwardEvidenceLedger,
  ifvgFreshRetestV3FrozenProfile,
  loadForwardEvidenceLedger
} from "@/lib/forwardEvidence";
import {
  RESEARCH_CYCLE_UPDATED_EVENT,
  latestResearchCycleRun,
  loadResearchCycleState
} from "@/lib/researchCycle";

const readable = (value: string) => value.replace(/_/g, " ");
const dateTime = (value: string) => new Date(value).toLocaleString();

export function IfvgForwardEvidenceCard({
  context = "dashboard"
}: {
  context?: "dashboard" | "self_improvement";
}) {
  const [entries, setEntries] = useState(() => loadForwardEvidenceLedger());
  const [latestCycle, setLatestCycle] = useState(() => latestResearchCycleRun(loadResearchCycleState()));
  const evaluation = useMemo(() => evaluateForwardEvidenceLedger(entries), [entries]);
  const cycleAudit = useMemo(
    () => auditForwardEvidenceCycleSample(
      latestCycle
        ? {
            cycleId: latestCycle.cycleId,
            strategyProfile: latestCycle.validationSummary?.provenance?.strategyProfile,
            totalTrades: latestCycle.backtestSummary?.totalTrades,
            metricSource: latestCycle.canonicalMetrics?.metricSourceLabel
          }
        : undefined,
      entries
    ),
    [entries, latestCycle]
  );
  const frozen = ifvgFreshRetestV3FrozenProfile;

  const exportGatewayEvidence = () => {
    const report = buildForwardEvidenceGatewayReport(evaluation);
    const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ifvg-v3-forward-evidence.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const refreshEvidence = () => setEntries(loadForwardEvidenceLedger());
    const refreshCycle = () => setLatestCycle(latestResearchCycleRun(loadResearchCycleState()));
    window.addEventListener(FORWARD_EVIDENCE_UPDATED_EVENT, refreshEvidence);
    window.addEventListener(RESEARCH_CYCLE_UPDATED_EVENT, refreshCycle);
    window.addEventListener("storage", refreshEvidence);
    return () => {
      window.removeEventListener(FORWARD_EVIDENCE_UPDATED_EVENT, refreshEvidence);
      window.removeEventListener(RESEARCH_CYCLE_UPDATED_EVENT, refreshCycle);
      window.removeEventListener("storage", refreshEvidence);
    };
  }, []);

  return (
    <Card className="border-cyan-300/20 bg-cyan-300/5" data-testid="ifvg-v3-frozen-profile-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>IFVG v3 Frozen Profile</CardTitle>
            <CardDescription>
              Untouched forward evidence only after {dateTime(frozen.validationCutoff)}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">frozen</Badge>
            <Badge variant={evaluation.reassessmentEligible ? "warning" : "secondary"}>
              {evaluation.reassessmentEligible ? "reassessment available" : "collecting forward evidence"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border bg-background/45 p-3">
            <p className="text-xs uppercase text-muted-foreground">Preserved validation</p>
            <p className="mt-1 font-semibold">{frozen.evidence.completedTrades} trades / {frozen.evidence.averageR.toFixed(3)}R</p>
            <p className="mt-1 text-xs text-muted-foreground">PF {frozen.evidence.profitFactor.toFixed(3)} / {frozen.evidence.uniqueDates} dates</p>
          </div>
          <div className="rounded-md border border-border bg-background/45 p-3">
            <p className="text-xs uppercase text-muted-foreground">Forward outcomes</p>
            <p className="mt-1 font-semibold">{evaluation.completedForwardOutcomes} / {FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.completedOutcomes}</p>
            <p className="mt-1 text-xs text-muted-foreground">{evaluation.pendingOutcomes} pending</p>
          </div>
          <div className="rounded-md border border-border bg-background/45 p-3">
            <p className="text-xs uppercase text-muted-foreground">Independent dates</p>
            <p className="mt-1 font-semibold">{evaluation.independentDates} / {FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.independentDates}</p>
            <p className="mt-1 text-xs text-muted-foreground">post-cutoff only</p>
          </div>
          <div className="rounded-md border border-border bg-background/45 p-3">
            <p className="text-xs uppercase text-muted-foreground">Forward windows</p>
            <p className="mt-1 font-semibold">{evaluation.forwardWindows} / {FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS.forwardWindows}</p>
            <p className="mt-1 text-xs text-muted-foreground">Recommendation: {readable(evaluation.recommendation)}</p>
          </div>
        </div>
        <div className="rounded-md border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-cyan-50">
          IFVG v3 is frozen. Further changes require a new profile version and forward evidence.
          {context === "self_improvement" ? (
            <span className="mt-1 block text-xs text-cyan-100/75">
              Direct mutation is blocked. Draft a fork as {frozen.suggestedForkProfileId}; it remains validation-only and cannot auto-apply.
            </span>
          ) : null}
        </div>
        <div className="rounded-md border border-border bg-background/45 p-3 text-sm" data-testid="ifvg-forward-cycle-audit">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Latest cycle evidence role</p>
            <Badge variant="secondary">
              {cycleAudit.cycleTradeCount} validation trade{cycleAudit.cycleTradeCount === 1 ? "" : "s"} / {cycleAudit.creditedForwardOutcomes} forward credit
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{cycleAudit.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">Next: {cycleAudit.nextAction}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="muted">authority none / none / none</Badge>
          <Badge variant="muted">auto-promotion disabled</Badge>
          <Badge variant="muted">{frozen.mutationPolicy}</Badge>
          {evaluation.unverifiedOutcomes ? (
            <Badge variant="warning">{evaluation.unverifiedOutcomes} unverified outcome{evaluation.unverifiedOutcomes === 1 ? "" : "s"} excluded</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/45 p-3">
          <p className="text-xs text-muted-foreground">
            Export a compact report for the local Paper-Demo validator. Entries and raw candles are excluded.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={exportGatewayEvidence}>
            Export gateway evidence
          </Button>
        </div>
        {evaluation.blockers.length ? (
          <p className="text-xs text-muted-foreground">Next: {evaluation.blockers[0]}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Thresholds are met for deterministic reassessment only; no readiness or Paper-Demo promotion occurs automatically.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
