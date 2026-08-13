import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS,
  FORWARD_EVIDENCE_COLLECTOR_UPDATED_EVENT,
  FORWARD_EVIDENCE_UPDATED_EVENT,
  auditForwardEvidenceCycleSample,
  buildForwardEvidenceGatewayReport,
  evaluateForwardEvidenceLedger,
  getFrozenResearchProfile,
  forwardEvidenceCollectionCutoff,
  ifvgFreshRetestV3FrozenProfile,
  loadForwardEvidenceCollectorStatuses,
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
  const [collectorStatuses, setCollectorStatuses] = useState(() => loadForwardEvidenceCollectorStatuses());
  const [latestCycle, setLatestCycle] = useState(() => latestResearchCycleRun(loadResearchCycleState()));
  const frozen = useMemo(() => {
    const cycleProfile = getFrozenResearchProfile(
      latestCycle?.validationSummary?.provenance?.strategyProfile ?? ""
    );
    if (cycleProfile) return cycleProfile;
    const latestLedgerProfile = [...entries]
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .map((entry) => getFrozenResearchProfile(entry.profileId))
      .find(Boolean);
    return latestLedgerProfile ?? ifvgFreshRetestV3FrozenProfile;
  }, [entries, latestCycle]);
  const evaluation = useMemo(
    () => evaluateForwardEvidenceLedger(entries, frozen.profileId),
    [entries, frozen.profileId]
  );
  const forwardQuality = evaluation.qualityAttribution;
  const strongestLane = forwardQuality.strongestSessionLane;
  const collectorStatus = collectorStatuses[frozen.profileId];
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
  const exportGatewayEvidence = () => {
    const report = buildForwardEvidenceGatewayReport(evaluation);
    const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${frozen.profileId}-forward-evidence.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const refreshEvidence = () => setEntries(loadForwardEvidenceLedger());
    const refreshCollector = () => setCollectorStatuses(loadForwardEvidenceCollectorStatuses());
    const refreshCycle = () => setLatestCycle(latestResearchCycleRun(loadResearchCycleState()));
    const refreshStoredEvidence = () => {
      refreshEvidence();
      refreshCollector();
    };
    window.addEventListener(FORWARD_EVIDENCE_UPDATED_EVENT, refreshEvidence);
    window.addEventListener(FORWARD_EVIDENCE_COLLECTOR_UPDATED_EVENT, refreshCollector);
    window.addEventListener(RESEARCH_CYCLE_UPDATED_EVENT, refreshCycle);
    window.addEventListener("storage", refreshStoredEvidence);
    return () => {
      window.removeEventListener(FORWARD_EVIDENCE_UPDATED_EVENT, refreshEvidence);
      window.removeEventListener(FORWARD_EVIDENCE_COLLECTOR_UPDATED_EVENT, refreshCollector);
      window.removeEventListener(RESEARCH_CYCLE_UPDATED_EVENT, refreshCycle);
      window.removeEventListener("storage", refreshStoredEvidence);
    };
  }, []);

  return (
    <Card className="border-cyan-300/20 bg-cyan-300/5" data-testid="ifvg-frozen-profile-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{frozen.profileId.replace(/_/g, " ")} Frozen Profile</CardTitle>
            <CardDescription>
              Untouched forward evidence only after {dateTime(forwardEvidenceCollectionCutoff(frozen))}.
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
          {frozen.profileId.replace(/_/g, " ")} is frozen. Further changes require a new profile version and forward evidence.
          {context === "self_improvement" ? (
            <span className="mt-1 block text-xs text-cyan-100/75">
              Direct mutation is blocked.
              {frozen.suggestedForkProfileId
                ? ` Draft a fork as ${frozen.suggestedForkProfileId}; it remains validation-only and cannot auto-apply.`
                : " Any further refinement requires a separately versioned research profile and new validation."}
            </span>
          ) : null}
        </div>
        <div className="rounded-md border border-border bg-background/45 p-3 text-sm" data-testid="ifvg-forward-quality-attribution">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Forward session quality</p>
            <Badge variant={forwardQuality.attributionCoverage >= 0.9 ? "success" : "warning"}>
              {Math.round(forwardQuality.attributionCoverage * 100)}% loss attribution
            </Badge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Strongest lane</p>
              <p className="mt-1 font-medium">
                {strongestLane
                  ? `${strongestLane.session} / ${readable(strongestLane.status)}`
                  : "Awaiting completed outcomes"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Cost stress</p>
              <p className="mt-1 font-medium">
                {strongestLane?.costAdjustedAverageR05 == null
                  ? "n/a"
                  : `${strongestLane.costAdjustedAverageR05.toFixed(2)}R at +0.50R`}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Invalidations</p>
              <p className="mt-1 font-medium">
                {forwardQuality.attributedInvalidationCount} attributed / {forwardQuality.invalidationCount} total
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Next: {forwardQuality.nextAction}</p>
        </div>
        <div className="rounded-md border border-border bg-background/45 p-3 text-sm" data-testid="ifvg-forward-collector-status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Forward collector</p>
            <Badge variant={collectorStatus?.subscriptionActive ? "success" : "warning"}>
              {collectorStatus?.subscriptionActive ? "listening" : "not active"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {collectorStatus
              ? `${readable(collectorStatus.state)}; ${collectorStatus.processedClosedCandles} closed candle(s) processed, ${collectorStatus.issuedObservations} observation(s) issued, ${collectorStatus.resolvedOutcomes} outcome update(s).`
              : "Collector has not initialized in this browser session."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {collectorStatus?.lastCandleTimestamp
              ? `Last eligible close checked ${dateTime(collectorStatus.lastCandleTimestamp)} with ${collectorStatus.lastHistoryCandleCount} internal history candles.`
              : "Waiting for the next canonical MNQ/USTECH 5m closed candle."}
          </p>
          {collectorStatus?.blockerReason ? (
            <p className="mt-1 text-xs text-amber-200">Reason: {readable(collectorStatus.blockerReason)}</p>
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
