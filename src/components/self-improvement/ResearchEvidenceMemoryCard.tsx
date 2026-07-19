import { useEffect, useMemo, useState } from "react";
import { Database, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  backfillResearchEvidenceFromCycleRuns,
  hydrateResearchEvidenceAggregateIndex,
  loadResearchEvidenceAggregateIndex,
  RESEARCH_EVIDENCE_UPDATED_EVENT,
  type ResearchEvidenceAggregateIndex
} from "@/lib/researchEvidenceLedger";
import { loadResearchCycleState } from "@/lib/researchCycle/runResearchCycle";
import {
  GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT,
  loadGbrainMemoryOutbox,
  type GbrainMemoryOutboxState
} from "@/lib/researchMemory";

const resultVariant = (value?: string) =>
  value === "positive_edge" ? "success" : value === "negative_edge" ? "danger" : "warning";

export function ResearchEvidenceMemoryCard() {
  const [index, setIndex] = useState<ResearchEvidenceAggregateIndex>(() => loadResearchEvidenceAggregateIndex());
  const [outbox, setOutbox] = useState<GbrainMemoryOutboxState>(() => loadGbrainMemoryOutbox());

  useEffect(() => {
    const previousRuns = loadResearchCycleState().runs;
    const hydrate = previousRuns.length
      ? backfillResearchEvidenceFromCycleRuns(previousRuns)
      : hydrateResearchEvidenceAggregateIndex();
    void hydrate.then(setIndex).catch(() => undefined);
    const refreshEvidence = () => setIndex(loadResearchEvidenceAggregateIndex());
    const refreshOutbox = () => setOutbox(loadGbrainMemoryOutbox());
    window.addEventListener(RESEARCH_EVIDENCE_UPDATED_EVENT, refreshEvidence);
    window.addEventListener(GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT, refreshOutbox);
    return () => {
      window.removeEventListener(RESEARCH_EVIDENCE_UPDATED_EVENT, refreshEvidence);
      window.removeEventListener(GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT, refreshOutbox);
    };
  }, []);

  const latest = useMemo(() => index.aggregates[0], [index]);
  const pendingMemory = outbox.entries.filter((entry) => entry.status === "pending").length;

  return (
    <Card className="border-emerald-300/20 bg-emerald-300/5" data-testid="research-evidence-memory-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" /> Persistent Research Memory</CardTitle>
            <CardDescription>
              Append-only compact cycle evidence is the deterministic memory source. gbrain receives advisory copies only.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success"><ShieldCheck className="mr-1 h-3 w-3" /> authority none</Badge>
            <Badge variant={outbox.deliveryEnabled ? "warning" : "muted"}>
              gbrain delivery {outbox.deliveryEnabled ? "enabled" : "off"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><p className="text-xs uppercase text-muted-foreground">Stored cycles</p><p className="mt-1 font-mono text-lg">{index.totalRecords}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Profile identities</p><p className="mt-1 font-mono text-lg">{index.totalProfiles}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Latest profile trades</p><p className="mt-1 font-mono text-lg">{latest?.totalTrades ?? 0}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Independent cycle dates</p><p className="mt-1 font-mono text-lg">{latest?.independentCycleDates ?? 0}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">gbrain queued</p><p className="mt-1 font-mono text-lg">{pendingMemory}</p></div>
        </div>
        {latest ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-300/15 pt-3">
            <div>
              <p className="font-medium text-foreground">{latest.identity.strategyProfile}</p>
              <p className="text-xs text-muted-foreground">
                {latest.cycleCount} cycles / {latest.totalTrades} simulated trades / {latest.weightedAverageR.toFixed(2)}R weighted average
              </p>
            </div>
            <Badge variant={resultVariant(latest.latestResultClass)}>{latest.latestResultClass.replace(/_/g, " ")}</Badge>
          </div>
        ) : (
          <p className="border-t border-emerald-300/15 pt-3 text-muted-foreground">
            The first completed research cycle will create the initial immutable evidence record.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          This memory can inform proposals, but it cannot create evidence, approve readiness, apply calibration, or enable execution.
        </p>
      </CardContent>
    </Card>
  );
}
