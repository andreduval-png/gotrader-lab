import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, RefreshCw, Search, ShieldCheck } from "lucide-react";
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
  GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT,
  GBRAIN_SIDECAR_STATUS_UPDATED_EVENT,
  fetchGbrainSidecarStatus,
  loadGbrainMemoryOutbox,
  loadCachedGbrainSidecarStatus,
  searchGbrainResearchMemory,
  syncGbrainResearchMemory,
  type GbrainMemorySearchResult,
  type GbrainSidecarStatus,
  type GbrainMemoryOutboxState
} from "@/lib/researchMemory";

const resultVariant = (value?: string) =>
  value === "positive_edge" ? "success" : value === "negative_edge" ? "danger" : "warning";

export function ResearchEvidenceMemoryCard() {
  const [index, setIndex] = useState<ResearchEvidenceAggregateIndex>(() => loadResearchEvidenceAggregateIndex());
  const [outbox, setOutbox] = useState<GbrainMemoryOutboxState>(() => loadGbrainMemoryOutbox());
  const [sidecar, setSidecar] = useState<GbrainSidecarStatus>(() => loadCachedGbrainSidecarStatus());
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>();
  const [query, setQuery] = useState("positive edge blockers and next validation");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GbrainMemorySearchResult[]>([]);

  const syncMemory = useCallback(async () => {
    setSyncing(true);
    const result = await syncGbrainResearchMemory();
    setSidecar(result.statusSnapshot);
    setOutbox(loadGbrainMemoryOutbox());
    setSyncMessage(
      result.status === "offline"
        ? "Sidecar offline; compact browser evidence remains safe."
        : `${result.backfilled} durable document(s) checked; ${result.delivered} queued document(s) delivered.`
    );
    setSyncing(false);
  }, []);

  useEffect(() => {
    const previousRuns = loadResearchCycleState().runs;
    const hydrate = previousRuns.length
      ? backfillResearchEvidenceFromCycleRuns(previousRuns)
      : hydrateResearchEvidenceAggregateIndex();
    void hydrate
      .then((nextIndex) => {
        setIndex(nextIndex);
        return syncMemory();
      })
      .catch(() => undefined);
    void fetchGbrainSidecarStatus().then(setSidecar);
    const refreshEvidence = () => {
      setIndex(loadResearchEvidenceAggregateIndex());
      void syncMemory();
    };
    const refreshOutbox = () => setOutbox(loadGbrainMemoryOutbox());
    const refreshSidecar = (event: Event) => {
      const nextStatus = (event as CustomEvent<GbrainSidecarStatus>).detail;
      setSidecar(nextStatus ?? loadCachedGbrainSidecarStatus());
    };
    window.addEventListener(RESEARCH_EVIDENCE_UPDATED_EVENT, refreshEvidence);
    window.addEventListener(GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT, refreshOutbox);
    window.addEventListener(GBRAIN_SIDECAR_STATUS_UPDATED_EVENT, refreshSidecar);
    return () => {
      window.removeEventListener(RESEARCH_EVIDENCE_UPDATED_EVENT, refreshEvidence);
      window.removeEventListener(GBRAIN_MEMORY_OUTBOX_UPDATED_EVENT, refreshOutbox);
      window.removeEventListener(GBRAIN_SIDECAR_STATUS_UPDATED_EVENT, refreshSidecar);
    };
  }, [syncMemory]);

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
            <Badge variant={sidecar.status === "ready" ? "success" : sidecar.sidecarStatus === "running" ? "warning" : "muted"}>
              gbrain {sidecar.status.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div><p className="text-xs uppercase text-muted-foreground">Stored cycles</p><p className="mt-1 font-mono text-lg">{index.totalRecords}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Profile identities</p><p className="mt-1 font-mono text-lg">{index.totalProfiles}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Latest profile trades</p><p className="mt-1 font-mono text-lg">{latest?.totalTrades ?? 0}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">Durable gbrain docs</p><p className="mt-1 font-mono text-lg">{sidecar.durableDocumentCount}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">PGLite indexed</p><p className="mt-1 font-mono text-lg">{sidecar.indexedDocumentCount}</p></div>
          <div><p className="text-xs uppercase text-muted-foreground">gbrain queued</p><p className="mt-1 font-mono text-lg">{pendingMemory}</p></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-300/15 pt-3">
          <div>
            <p className="font-medium text-foreground">
              {sidecar.gbrainInitialized ? "Local gbrain PGLite memory active" : sidecar.sidecarStatus === "running" ? "Durable spool active; PGLite indexing pending" : "Local gbrain sidecar offline"}
            </p>
            <p className="text-xs text-muted-foreground">
              {syncMessage ?? sidecar.lastError ?? `${sidecar.pendingDocumentCount} document(s) awaiting indexing.`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void syncMemory()} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync memory
          </Button>
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
        <div className="space-y-2 border-t border-emerald-300/15 pt-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prior cycle evidence"
              aria-label="Search prior gbrain research memory"
            />
            <Button
              variant="secondary"
              disabled={searching || !query.trim()}
              onClick={() => {
                setSearching(true);
                void searchGbrainResearchMemory(query)
                  .then((result) => setSearchResults(result.results))
                  .finally(() => setSearching(false));
              }}
            >
              <Search className="mr-2 h-4 w-4" />
              Search memory
            </Button>
          </div>
          {searchResults.length ? (
            <div className="grid gap-2 lg:grid-cols-2" data-testid="gbrain-memory-search-results">
              {searchResults.slice(0, 4).map((result, resultIndex) => (
                <div key={result.documentId ?? result.slug ?? resultIndex} className="border-l-2 border-emerald-300/30 pl-3">
                  <p className="font-medium text-foreground">{result.title ?? result.path ?? result.slug ?? "Research memory"}</p>
                  <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{result.summary ?? result.content ?? "Compact memory result."}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Historical retrieval can inform new proposal drafts, but it cannot create evidence, approve readiness, apply calibration, or enable execution.
        </p>
      </CardContent>
    </Card>
  );
}
