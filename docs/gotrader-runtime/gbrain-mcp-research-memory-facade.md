# GoTrader GBrain G2 Read-Only MCP Research-Memory Facade

Date: 2026-07-24

## Final Status

`GBRAIN G1-G2 PASSED - READ-ONLY MCP RESEARCH MEMORY ESTABLISHED`

## Architecture

```text
Codex / Claude / another local MCP client
  -> GoTrader stdio MCP
  -> GoTrader research-memory safety facade
  -> bounded loopback request
  -> local gbrain sidecar
  -> exact GoTrader identity filters
  -> local PGLite keyword retrieval or bounded spool fallback
  -> GoTrader-owned compact summary
  -> untrusted advisory context
  -> deterministic GoTrader validation
```

The native Research Evidence Ledger remains authoritative. The facade cannot
write memory, create evidence, approve readiness, apply calibration, create a
trade intent, or access a broker. The sidecar is the only local retrieval
dependency and is restricted to loopback HTTP.

## MCP Tools

The existing GoTrader MCP adds exactly three research-memory tools:

```text
gotrader_research_memory_status
gotrader_search_research_memory
gotrader_get_research_memory_summary
```

No memory write, capture, delete, update, SQL, filesystem, command, or arbitrary
gbrain tool is exposed.

### Status

`gotrader_research_memory_status` returns sidecar/PGLite health, fallback-search
availability, bounded counts, last sync/receipt identity, warnings, blockers,
and the authority contract. Missing PGLite produces a degraded spool-only state;
an offline sidecar produces `offline` without blocking deterministic research.

### Search

`gotrader_search_research_memory` requires a query of 3-300 characters. It
supports exact filters for:

- profile ID and version
- parameter fingerprint
- source fingerprint
- requested and broker symbols
- timeframe
- UTC date range
- outcome
- blocker
- up to 10 tags

The default result count is 5 and the maximum is 20. The maximum accepted date
range is 730 days. Identity filters are applied to GoTrader-owned index metadata,
not inferred from arbitrary memory prose.

### Summary

`gotrader_get_research_memory_summary` accepts only a stable
`gbrain_document_*` memory ID. It returns compact identity, source, outcome,
metrics, blockers, hypothesis, tags, receipt, and provenance. Full Markdown,
raw database rows, and arbitrary files are not returned.

## Response Safety

Every returned memory is rebuilt from a fixed allowlist and includes:

```text
source: local_gbrain_sidecar
retrievalMode: keyword | bounded_fallback | direct_lookup
untrustedRetrievedContent: true
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

HTML and script content, prompt-injection phrases, non-none authority claims,
base64, and credential-like content are removed from compact narrative fields.
Unknown metadata fields, fabricated evidence flags, raw candles/OHLCV, runtime
snapshots, credentials, and account/order/position content are rejected at
ingestion or request validation.

Retrieved narrative is evidence-linked historical context, not an instruction.
An agent may use it to propose a hypothesis. It cannot use it as authority or
create evidence from the retrieval alone.

## Operational Bounds

- loopback HTTP only (`127.0.0.1`, `localhost`, or `::1`)
- 8-second default request timeout
- maximum 2 concurrent searches per MCP process
- maximum 60 memory requests per 60 seconds per MCP process
- maximum 20 results
- maximum 64 KiB response
- bounded audit log: 512 KiB with 256 KiB retained on rotation

The audit records request ID, agent/session identity, tool, query hash, compact
filters, result count, response size, retrieval mode, status, blockers, and
authority. It never records the raw search query.

## Persistence And Provenance

Memory documents now carry explicit GoTrader metadata:

- evidence record ID
- research cycle ID
- profile ID/version
- parameter fingerprint
- requested/broker symbol
- timeframe and market date
- source provider/fingerprint
- outcome and compact aggregate metrics
- blockers and hypothesis summary

The sidecar assigns a stable receipt ID for each document content hash. Search
and direct summary responses preserve memory, evidence, cycle, source, and
receipt identities where available.

Legacy G1 documents without the new metadata remain durable and searchable by
keyword, but cannot satisfy exact identity filters they do not possess.
Backfilling from native evidence upgrades those memories idempotently.

## Verification

The disposable facade test proved:

- status, bounded search, and direct summary retrieval
- profile/source/symbol/timeframe/date/outcome/blocker/tag filtering
- default and maximum limits
- response-size truncation
- timeout, concurrency, and rate limits
- bounded hashed-query audit records
- hostile content sanitization
- raw-candle and fabricated-evidence rejection
- no memory write tools
- sidecar restart persistence
- sidecar-offline degradation
- authority `none / none / none`

The real disposable PGLite test proved capture, keyword retrieval, and retrieval
after a sidecar restart without embeddings or API spend.

## Known Limitations

- Retrieval is keyword-oriented; semantic embeddings are deliberately disabled.
- Rate limits are process-local. A future multi-client network MCP would need a
  shared authenticated limiter before exposure.
- The MCP transport is local stdio. No remote MCP listener is provided.
- Historical text is untrusted advisory context and is not automatically fed
  into strategy scoring, readiness, sizing, or execution.
- Legacy memories need an idempotent native-evidence backfill to gain complete
  profile/version/parameter identity.

## Rollback

Remove the three research-memory registrations and the facade core, then stop
the optional sidecar. Native evidence, research cycles, strategy behavior,
replay, walk-forward, readiness, and broker safety continue unchanged.
