# GoTrader Research Evidence Memory

## Purpose

GoTrader now separates deterministic research memory from advisory narrative memory.

The native Research Evidence Ledger is the system of record. gbrain is an optional advisory copy. Neither memory layer can approve readiness, apply calibration, or enable execution.

## Native Evidence Ledger

Every successfully completed research cycle writes one compact immutable record to IndexedDB:

- database: `gotrader-research-evidence`
- store: `cycle_evidence`
- key: `research_evidence_<cycleId>`

The record contains compact identity, source fingerprint, data range, regime, profile, simulated performance, replay/walk-forward/Monte Carlo summaries, evidence, maturity, readiness, blockers, proposal lineage, and authority.

It excludes:

- raw candle arrays and imported OHLCV arrays
- runtime snapshots
- secrets and credentials
- account, order, and position data
- screenshots and base64

Duplicate cycle IDs are ignored. Existing records are never updated in place. The normal IndexedDB ledger is not truncated. If IndexedDB is unavailable, a fail-safe localStorage fallback retains the latest 500 compact records; that fallback is not the preferred durable backend.

The Self-Improvement workspace performs an idempotent backfill of the existing compact recent-cycle history. This preserves cycles already present at upgrade time without copying raw candles or changing any readiness result.

## Deterministic Aggregates

After an append, GoTrader rebuilds a compact materialized aggregate index at:

`gotrader.research-evidence-aggregate.v1`

Aggregates are grouped by compatible research identity:

- strategy profile and version
- parameter fingerprint
- requested and broker symbol
- timeframe
- source provider

The aggregate tracks lifetime cycle/trade totals, independent cycle dates, source fingerprints, weighted average R, total realized R, drawdown, OOS trades/windows, recurring blockers, and the latest readiness state.

Self-Improvement proposal creation reads this aggregate. It uses it only as historical context. A lifetime aggregate does not become validation evidence and cannot approve or apply a proposal.

## Auto Research Experiment Selection

Auto Research reads the materialized aggregate before its initial bounded candidate pass. It only matches exact strategy profile and parameter fingerprints against the active source provider, requested symbol, broker symbol, and timeframe.

- positive compatible identities are prioritized for another independent confirmation cycle
- unseen identities remain bounded experiments
- experiments that address recurring blocker families receive higher priority
- exact identities with at least 20 trades, at least three independent cycle dates, non-positive weighted average R, and repeated negative-edge cycles are skipped in normal searches
- deep searches retain those failed identities only as regression diagnostics

Historical ranking cannot change candidate metrics, create evidence, promote readiness, apply calibration, or grant authority.

## gbrain Advisory Memory

Each native evidence record is also converted to the compact GoTrader research-memory contract and queued as Markdown for the local gbrain sidecar.

- storage: `gotrader.gbrain-memory-outbox.v1`
- delivery default before trusted sidecar handshake: `false`
- missing or legacy delivery setting: resolves to `false`
- allowed delivery endpoint: loopback only (`127.0.0.1`, `localhost`, or `::1`)
- browser tokens: prohibited
- acknowledged entries: removed from the browser outbox after durable sidecar storage

Suggested gbrain paths are stable, for example:

`gotrader/research-cycle/<cycleId>.md`

The outbox validator rejects unsafe authority and forbidden account/order/position, credential, raw snapshot, or candle-array fields. The delivery client enables transport only after the fixed loopback endpoint identifies itself as the GoTrader gbrain sidecar with none/none/none authority. GoTrader does not embed a gbrain token or connect to a remote gbrain host directly.

The sidecar stores:

- an atomic Markdown copy under `.gotrader/gbrain-sidecar/documents`
- compact delivery state in `.gotrader/gbrain-sidecar/index.json`
- capture receipts in `.gotrader/gbrain-sidecar/receipts.jsonl`
- the gbrain index in `.gotrader/gbrain-sidecar/gbrain-home/.gbrain/brain.pglite`

Self-Improvement can search this history for prior outcomes, recurring blockers, and next-action context. Retrieved memory remains advisory and cannot create validation evidence by itself.

## Authority

All records and documents force:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

The intended decision flow is:

```text
Completed research cycle
  -> immutable native evidence record
  -> deterministic aggregate
  -> Self-Improvement draft context
  -> replay / walk-forward / evidence / maturity gates

Same compact record
  -> fail-closed gbrain transport outbox
  -> loopback atomic spool and local PGLite index
  -> compact keyword retrieval
  -> advisory hypothesis or draft proposal
  -> GoTrader deterministic validation
```

## Verification

Run:

```powershell
npm.cmd run test:research-evidence-memory
npm.cmd run test:auto-research-lifetime-memory
npm.cmd run test:gbrain-sidecar
npm.cmd run test:gbrain-sidecar:real
npm.cmd run build
```

The focused tests verify append/deduplication, aggregation, gbrain fail-closed defaults, loopback-only delivery, localStorage cleanup after acknowledgement, packet exclusions, PGLite capture/retrieval, and none/none/none authority.
