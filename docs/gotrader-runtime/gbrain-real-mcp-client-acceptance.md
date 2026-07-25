# GBrain Real MCP Client Acceptance

## Result

`PASSED WITH CURRENT-CODEX-SESSION RELOAD REQUIRED`

A real `@modelcontextprotocol/sdk` client connected over stdio to the dedicated
GoTrader research-memory MCP server. No TCP MCP listener and no direct GBrain
MCP server were introduced.

## Client And Transport

| Item | Value |
|---|---|
| Client | Model Context Protocol SDK client |
| Transport | local stdio |
| Server | `scripts/gotrader-research-memory-mcp.mjs` |
| Sidecar | loopback HTTP at `127.0.0.1` |
| Persistent client configured | Codex Desktop |
| Codex configuration | `C:\Users\andre\.codex\config.toml` |
| Server name | `gotrader_research_memory` |

The existing `gotrader` proposal MCP registration was not replaced.
A backup of the prior Codex configuration was written to:

```text
C:\Users\andre\.codex\config.toml.gbrain-g3-backup-20260724-202335
```

## Discovered Surface

The real client discovered exactly:

```text
gotrader_research_memory_status
gotrader_search_research_memory
gotrader_get_research_memory_summary
```

It discovered no memory capture, write, update, delete, SQL, filesystem,
arbitrary-command, trade, order, or broker tool.

## Acceptance Results

### Status

The disposable sidecar intentionally ran without the GBrain CLI so the status
was an explicit degraded fallback:

```text
sidecarReachable: true
gbrainReachable: false
fallbackSearchAvailable: true
status: degraded
```

Separate real-sidecar acceptance initialized pinned GBrain `0.42.65.0`, captured
and indexed a compact document in PGLite, retrieved it, restarted the sidecar,
and retrieved it again.

### Search

The stdio client submitted a bounded exact-filter search using:

- profile ID and version;
- requested and broker symbols;
- timeframe;
- source fingerprint;
- date range;
- outcome;
- tags;
- result limit.

One matching compact summary was returned. Retrieval provenance marked the
content untrusted and advisory.

### Summary

The client retrieved one stable memory ID and received only allowlisted compact
identity, outcome, aggregate, blocker, hypothesis, tag, receipt, provenance, and
authority fields. It received no full Markdown.

### Hostile Content

Disposable fixtures proved:

- credential-like content is rejected at ingestion;
- HTML and script tags are removed;
- prompt-injection phrases are replaced;
- fake authority claims are removed;
- retrieved content remains marked untrusted.

No hostile fixture was written to the user's persistent GBrain.

### Offline And Recovery

With the optional sidecar stopped, the MCP remained available and returned:

```text
status: offline
blocker: gbrain_sidecar_offline
```

No research, readiness, or authority state changed. Restarting the disposable
sidecar restored bounded retrieval with the same memory ID.

### Audit And Limits

The acceptance proved:

- audit records contain a query hash rather than raw query text;
- agent/session/tool/status/result count and compact filters are recorded;
- source and parameter fingerprints are hashed in audit entries;
- default result limit is 5 and hard result limit is 20;
- response size is capped at 64 KiB;
- query length is 3 to 300 characters;
- date range is capped at 730 days;
- timeout is 8 seconds;
- concurrent searches are capped at 2;
- requests are capped at 60 per minute;
- audit storage is bounded and compacted.

## Codex Registration

Codex Desktop was configured with a separate local server:

```toml
[mcp_servers.gotrader_research_memory]
command = 'C:\Program Files\nodejs\node.exe'
args = ['C:\Users\andre\OneDrive\Documents\gotrader-gbrain-g3-acceptance\scripts\gotrader-research-memory-mcp.mjs']
startup_timeout_sec = 30
```

The current Codex task was already running when the registration was added, so
its tool registry cannot discover the new namespace until Codex starts a fresh
task or reloads MCP configuration. Protocol-level discovery is already proven
by the real stdio client test.

Before removing the G3 acceptance worktree after merge, update the configured
script path to the accepted merged GoTrader worktree.

## Safety

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

Retrieved memory can inform a hypothesis only. It cannot invoke replay,
walk-forward, OOS, evidence creation, readiness promotion, calibration apply,
Paper-Demo, or broker execution.
