# GBrain G3 Baseline Integration Report

## Final Status

```text
GBRAIN G3 PASSED WITH DOCUMENTED BACKFILL OR CLIENT LIMITATIONS
```

GBrain G1-G3 is technically accepted in its isolated integration worktree.
Merge into a production baseline remains gated by the still-incomplete A3.2
live operational qualification.

## Baselines And Commits

| Item | Value |
|---|---|
| Accepted runtime branch | `codex/gotrader-infrastructure-track-a3-2` |
| Accepted runtime commit | `ad8608a6f40361a3a9a84b92c93a4da4d64e59b1` |
| A3.2 qualification | blocked, operational acceptance incomplete |
| G1-G2 source branch | `codex/gotrader-gbrain-integration` |
| G1 commit | `7a64d97` - durable sidecar integration |
| G2 commit | `29ae356` - read-only MCP safety facade |
| G3 branch | `codex/gotrader-gbrain-g3-acceptance` |
| G3 backfill commit | `0cda333` - bounded native-evidence backfill |
| Pinned GBrain revision | `c44cdb52b1ced1a7726c3e2be099cbba6ed25ff4` |
| Pinned GBrain version | `0.42.65.0` |

G1 and G2 were already based directly on the accepted A3.2 commit, so no
conflicting re-port or overwrite was necessary. The dirty main worktree, A3.2
qualification worktree, and original G1-G2 source worktree were not modified.

## Architecture Result

```text
Completed deterministic research cycle
  -> native IndexedDB evidence commits
  -> deterministic lifetime aggregate updates
  -> sanitized advisory memory derives
  -> bounded browser outbox queues
  -> optional loopback sidecar stores atomically
  -> pinned local GBrain PGLite indexes
  -> GoTrader read-only MCP facade retrieves bounded summaries
  -> agent may propose a hypothesis
  -> deterministic GoTrader validation remains mandatory
```

The sidecar is optional. Its failure cannot roll back native evidence or block a
research cycle.

## Native-Evidence Authority

The authoritative store remains:

```text
IndexedDB database: gotrader-research-evidence
Object store: cycle_evidence
```

GBrain PGLite and its Markdown spool are derived advisory persistence only.
No schema migration mutates historical native evidence in place.

## Startup And Persistence

Unified startup can supervise the optional loopback sidecar. MT5, time
verification, feed, scheduler, canonical context, research-cycle completion,
and readiness do not depend on it.

Real disposable integration proved:

- isolated GBrain initialization without embeddings or API spend;
- direct pinned CLI invocation through Bun;
- compact memory capture and PGLite indexing;
- keyword retrieval;
- persistence across restart;
- spool-only degraded operation when GBrain is unavailable.

## Bounded Backfill

Command:

```powershell
npm.cmd run gbrain:backfill -- `
  --input-file <research-evidence-export.json> `
  --max-records 100 `
  --batch-size 25 `
  --dry-run
```

The in-app path reads IndexedDB through the native repository API. The CLI uses
a sanitized native-evidence export and does not open browser database files.

Acceptance counts:

```text
records scanned: 5
records eligible: 5
documents generated: 2
documents delivered during dry run: 0
legacy incomplete identity: 1
bounded: true
```

No production evidence was backfilled during acceptance. Stable native evidence
IDs, sidecar duplicate receipts, and compact checkpoints prevent duplicate
memory across retries and restarts. Legacy incomplete identities remain
keyword-searchable but ineligible for exact identity matches.

## MCP Acceptance

The dedicated stdio MCP exposes exactly:

```text
gotrader_research_memory_status
gotrader_search_research_memory
gotrader_get_research_memory_summary
```

Real MCP SDK acceptance proved status, exact-filter search, stable-ID summary,
hostile-content handling, offline degradation, restart recovery, query-hash
auditing, and bounded responses.

Codex Desktop has a separate `gotrader_research_memory` registration. A fresh
Codex task or MCP reload is required because the current task started before the
configuration was added.

## Safety Result

Absent:

- direct GBrain MCP;
- memory write/mutation MCP;
- SQL, filesystem, or arbitrary command MCP;
- raw Markdown or evidence database access;
- raw candles or runtime snapshots;
- credentials, account, order, or position data;
- replay, walk-forward, OOS, evidence, readiness, calibration, Paper-Demo, or
  execution invocation from memory.

Enforced:

```text
advisoryOnly: true
nativeEvidenceAuthoritative: true
canCreateEvidence: false
canApproveReadiness: false
canApplyCalibration: false
canCreateTradeIntent: false
productionAdoptionAllowed: false

executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## Regression Validation

All required G3 validation passed:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test`
- `npm.cmd run test:research-evidence-memory`
- `npm.cmd run test:gbrain-sidecar`
- `npm.cmd run test:gbrain-sidecar:real`
- `npm.cmd run test:gbrain-backfill`
- `npm.cmd run test:gotrader-mcp-research-memory`
- `npm.cmd run test:gbrain-mcp-real-client`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke`
- `npm.cmd run test:mt5-readonly-safety`
- `git diff --check`

The production build retains the accepted baseline's existing Rollup
circular-chunk and large-chunk warnings. G3 did not introduce a new build
failure or alter the chunking policy.

Frozen behavior remained byte-stable:

```text
IFVG v3 positive canary
1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a

IFVG v2 negative control
3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224

Strategy catalog behavior
43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de
```

## Known Limitations

1. A3.2 has not passed its required live market-break qualification, so G3
   should remain isolated from production adoption.
2. Production IndexedDB counts are not available honestly to a Node-only
   acceptance process; the bounded in-app repository path or an operator export
   must be used.
3. No production backfill was performed.
4. This running Codex task cannot hot-reload a newly added MCP registration.
5. Retrieval is intentionally keyword-only. Semantic embeddings and cloud
   memory remain out of scope.

## Rollback

1. Remove or disable the `gotrader_research_memory` Codex registration.
2. Stop the optional sidecar.
3. Revert the G3 commits if bounded backfill or the dedicated MCP entrypoint is
   not desired.
4. Leave native IndexedDB evidence untouched.

## Merge Recommendation

The G3 branch is suitable for review after full regression validation. Do not
merge it into the operating baseline or begin the Autonomous Canonical Research
Engine until A3.2 final operational qualification passes.
