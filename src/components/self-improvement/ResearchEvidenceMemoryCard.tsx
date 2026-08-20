import { useEffect, useMemo, useState } from "react";
import { Database, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  backfillResearchEvidenceFromCycleRuns,
  hydrateResearchEvidenceAggregateIndex,
  loadResearchEvidenceAggregateIndex,
  RESEARCH_EVIDENCE_UPDATED_EVENT,
  type ResearchEvidenceAggregateIndex
} from "@/lib/researchEvidenceLedger";
import { loadResearchCycleState } from "@/lib/researchCycle/runResearchCycle";
import {
  RESEARCH_MEMORY_OUTBOX_UPDATED_EVENT,
  deliverPendingResearchMemory,
  loadResearchMemoryOutbox,
  setResearchMemoryDeliveryEnabled,
  type ResearchMemoryOutboxState
} from "@/lib/researchMemory";

const resultVariant = (value?: string) =>
  value === "positive_edge" ? "success" : value === "negative_edge" ? "danger" : "warning";

export function ResearchEvidenceMemoryCard() {
  const [index, setIndex] = useState<ResearchEvidenceAggregateIndex>(() => loadResearchEvidenceAggregateIndex());
  const [outbox, setOutbox] = useState<ResearchMemoryOutboxState>(() => loadResearchMemoryOutbox());
  const [deliveryEndpoint, setDeliveryEndpoint] = useState(() =>
    outbox.endpointHost ? `http://${outbox.endpointHost}/ingest` : "http://127.0.0.1:8799/ingest"
  );
  const [deliveryResult, setDeliveryResult] = useState<string>();
  const [deliveryRunning, setDeliveryRunning] = useState(false);

  useEffect(() => {
    const previousRuns = loadResearchCycleState().runs;
    const hydrate = previousRuns.length
      ? backfillResearchEvidenceFromCycleRuns(previousRuns)
      : hydrateResearchEvidenceAggregateIndex();
    void hydrate.then(setIndex).catch(() => undefined);
    const refreshEvidence = () => setIndex(loadResearchEvidenceAggregateIndex());
    const refreshOutbox = () => setOutbox(loadResearchMemoryOutbox());
    window.addEventListener(RESEARCH_EVIDENCE_UPDATED_EVENT, refreshEvidence);
    window.addEventListener(RESEARCH_MEMORY_OUTBOX_UPDATED_EVENT, refreshOutbox);
    return () => {
      window.removeEventListener(RESEARCH_EVIDENCE_UPDATED_EVENT, refreshEvidence);
      window.removeEventListener(RESEARCH_MEMORY_OUTBOX_UPDATED_EVENT, refreshOutbox);
    };
  }, []);

  const latest = useMemo(() => index.aggregates[0], [index]);
  const pendingMemory = outbox.entries.filter((entry) => entry.status === "pending").length;
  const failedMemory = outbox.entries.filter((entry) => entry.status === "failed").length;

  const toggleDelivery = (enabled: boolean) => {
    setOutbox(setResearchMemoryDeliveryEnabled(enabled, deliveryEndpoint));
    setDeliveryResult(enabled ? "Local delivery enabled." : "Local delivery disabled.");
  };

  const deliverMemory = async () => {
    setDeliveryRunning(true);
    try {
      const result = await deliverPendingResearchMemory({ endpoint: deliveryEndpoint });
      setOutbox(loadResearchMemoryOutbox());
      setDeliveryResult(`${result.status.replace(/_/g, " ")}: ${result.delivered} delivered, ${result.failed} failed.`);
    } finally {
      setDeliveryRunning(false);
    }
  };

  return (
    <Card className="border-emerald-300/20 bg-emerald-300/5" data-testid="research-evidence-memory-card">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" /> Persistent Research Memory</CardTitle>
            <CardDescription>
              Append-only cycle evidence is authoritative. The AI-agent memory outbox contains compact advisory copies.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success"><ShieldCheck className="mr-1 h-3 w-3" /> authority none</Badge>
            <Badge variant={outbox.deliveryEnabled ? "warning" : "muted"}>
              local delivery {outbox.deliveryEnabled ? "enabled" : "off"}
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
          <div><p className="text-xs uppercase text-muted-foreground">Memory queued</p><p className="mt-1 font-mono text-lg">{pendingMemory}</p></div>
        </div>
        <div className="grid gap-3 border-t border-emerald-300/15 pt-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="min-w-0 space-y-1 text-xs font-medium text-muted-foreground">
            Local memory endpoint
            <Input
              aria-label="Local research memory endpoint"
              value={deliveryEndpoint}
              onChange={(event) => setDeliveryEndpoint(event.target.value)}
              placeholder="http://127.0.0.1:8799/ingest"
            />
          </label>
          <label className="flex h-10 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={outbox.deliveryEnabled}
              onChange={(event) => toggleDelivery(event.target.checked)}
            />
            Enable local delivery
          </label>
          <Button
            type="button"
            variant="secondary"
            disabled={!outbox.deliveryEnabled || deliveryRunning || pendingMemory + failedMemory === 0}
            onClick={() => void deliverMemory()}
          >
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            {deliveryRunning ? "Sending" : "Send queued"}
          </Button>
        </div>
        {deliveryResult ? <p className="text-xs text-muted-foreground" role="status">{deliveryResult}</p> : null}
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
          Advisory memory cannot create evidence, approve readiness, apply calibration, or enable execution.
        </p>
      </CardContent>
    </Card>
  );
}
