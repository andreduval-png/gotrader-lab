# GoTrader Local gbrain Sidecar Runbook

Last updated: 2026-07-24

## Purpose

GoTrader uses a loopback-only sidecar to copy compact completed-cycle memory into a local
[`garrytan/gbrain`](https://github.com/garrytan/gbrain) PGLite brain. This gives
Self-Improvement durable retrieval across restarts without making gbrain a source of
trading evidence or authority.

The native GoTrader Research Evidence Ledger remains authoritative. gbrain is a durable
advisory index over sanitized Markdown copies.

## Install

From the GoTrader repository:

```powershell
npm.cmd run gbrain:setup -- --install
```

The setup script:

1. Locates or installs Bun.
2. Installs an isolated checkout of the official gbrain repository at the audited revision
   recorded by the setup script when a working CLI is not already available.
3. Creates a dedicated PGLite brain.
4. Disables embedding generation and configures keyword-only retrieval.
5. Runs a compact gbrain health check.

No OpenAI, Voyage, or other embedding API key is required. Bun installation details are
available in the [official Bun documentation](https://bun.sh/docs/installation).

## Start

The normal unified GoTrader startup includes the sidecar:

```powershell
.\START-GOTRADER.CMD
```

It can also be started independently:

```powershell
npm.cmd run gbrain:sidecar
```

The service binds only to:

```text
http://127.0.0.1:8799
```

Useful commands:

```powershell
npm.cmd run gbrain:status
npm.cmd run gbrain:sync
npm.cmd run gbrain:backfill -- --input-file <research-evidence-export.json> --dry-run
npm.cmd run test:gbrain-sidecar
npm.cmd run test:gbrain-sidecar:real
npm.cmd run test:gotrader-mcp-research-memory
npm.cmd run test:gbrain-backfill
npm.cmd run test:gbrain-mcp-real-client
```

`test:gbrain-sidecar:real` creates a disposable PGLite brain, captures one compact test
document, verifies keyword retrieval, and removes the disposable test directory.

## Storage

The default sidecar root is:

```text
.gotrader/gbrain-sidecar/
```

Data is stored as:

```text
.gotrader/gbrain-sidecar/documents/                  Atomic compact Markdown spool
.gotrader/gbrain-sidecar/index.json                  Compact delivery/index state
.gotrader/gbrain-sidecar/receipts.jsonl              Append-only indexing receipts
.gotrader/gbrain-sidecar/gbrain-home/.gbrain/
  brain.pglite/                                      Local gbrain PGLite database
  config.json                                        Isolated gbrain configuration
.gotrader/gbrain-sidecar/vendor/gbrain/              Isolated official gbrain checkout
.gotrader/gbrain-sidecar/bin/gbrain.cmd              Local CLI wrapper on Windows
```

These runtime files are local and ignored by Git.

The browser outbox at `gotrader.gbrain-memory-outbox.v1` is transport state only.
Acknowledged documents are removed from the outbox after durable sidecar storage, avoiding
unbounded `localStorage` growth.

## Runtime Flow

```text
Completed deterministic research cycle
  -> append compact native evidence to IndexedDB
  -> update deterministic lifetime aggregate
  -> queue sanitized gbrain Markdown copy
  -> trusted loopback sidecar handshake
  -> atomic Markdown spool
  -> local gbrain PGLite capture
  -> keyword retrieval in Self-Improvement
  -> advisory context for the next hypothesis
  -> deterministic replay / walk-forward / evidence gates
```

The sidecar also backfills existing compact native evidence records when the
Self-Improvement memory panel is opened or the operator selects **Sync memory**.
Interactive backfill is bounded to 100 records per run by default and resumes
from a compact checkpoint. The CLI accepts a sanitized native-evidence export;
it does not open browser IndexedDB files directly.

## Offline Behavior

The sidecar is an optional local service:

- If it is offline, research cycles continue.
- Native IndexedDB evidence remains available.
- Pending browser outbox entries stay retryable.
- If gbrain itself is unavailable, the atomic Markdown spool remains durable and offers
  bounded keyword fallback search.
- Unified startup and diagnostics report the service state without blocking market-data
  or deterministic research readiness.

## Safety Contract

The sidecar accepts only compact GoTrader memory documents. It rejects:

- raw candle arrays or imported OHLCV arrays
- raw runtime snapshots
- account, order, or position data
- MT5 credentials
- secrets, API keys, passwords, or tokens
- screenshots or base64 payloads
- any authority value other than `none`

It exposes no execution, account, order, or position endpoint and never calls MT5.

Every response preserves:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

gbrain retrieval can inform a research hypothesis. It cannot create evidence, approve
readiness, apply calibration, promote Paper-Demo status, or place a trade.

## Local MCP Retrieval

The normal GoTrader stdio MCP now exposes three read-only memory tools:

```text
gotrader_research_memory_status
gotrader_search_research_memory
gotrader_get_research_memory_summary
```

They use the same loopback sidecar and compact metadata contracts as the local
UI. No direct gbrain MCP server is exposed, and no memory-write tool exists.
Searches are bounded, audited by query hash rather than raw query, and returned
text is marked as untrusted advisory content.

For clients that should see only research memory, use the dedicated stdio
entrypoint:

```powershell
npm.cmd run mcp:research-memory
```

This endpoint exposes exactly the three tools above. It does not include trade
proposal or Paper-Demo tools. MCP client configuration changes require that
client to reload its MCP registry.
