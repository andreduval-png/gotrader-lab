import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS,
  FORWARD_EVIDENCE_UPDATED_EVENT,
  evaluateForwardEvidenceLedger,
  ifvgFreshRetestV3FrozenProfile,
  loadForwardEvidenceLedger
} from "@/lib/forwardEvidence";

const readable = (value: string) => value.replace(/_/g, " ");
const dateTime = (value: string) => new Date(value).toLocaleString();

export function IfvgForwardEvidenceCard({
  context = "dashboard"
}: {
  context?: "dashboard" | "self_improvement";
}) {
  const [entries, setEntries] = useState(() => loadForwardEvidenceLedger());
  const evaluation = useMemo(() => evaluateForwardEvidenceLedger(entries), [entries]);
  const frozen = ifvgFreshRetestV3FrozenProfile;

  useEffect(() => {
    const refresh = () => setEntries(loadForwardEvidenceLedger());
    window.addEventListener(FORWARD_EVIDENCE_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(FORWARD_EVIDENCE_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
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
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="muted">authority none / none / none</Badge>
          <Badge variant="muted">auto-promotion disabled</Badge>
          <Badge variant="muted">{frozen.mutationPolicy}</Badge>
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
