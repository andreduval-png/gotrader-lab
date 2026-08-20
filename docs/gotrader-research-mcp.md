# GoTrader Research MCP

Status: implemented 2026-08-18.

GoTrader exposes one agent-neutral MCP service for compact research state. The canonical server is `scripts/gotrader-research-mcp-server.mjs`; `scripts/gotrader-research-mcp.mjs` provides stdio and `scripts/gotrader-research-mcp-http.mjs` provides authenticated loopback Streamable HTTP on port `7332`.

The local stack supervisor starts and health-checks the HTTP service. Vite proxies `/gotrader-research-mcp/*` to the loopback service and injects a local bearer token stored under the ignored `.gotrader` runtime directory, so browser code does not store the token and supervised restarts retain the channel identity. Direct HTTP requests without the token fail with `401`.

## Source Of Truth

Browser-owned research stores remain canonical. The frontend builds a compact runtime mirror containing identities and derived summaries, excludes raw candles, snapshots, account data, orders, positions, and secrets, then posts it to `/runtime`. The service validates required identity fields, authority `none/none/none`, size, timestamp, and forbidden content before atomically persisting it with a SHA-256 evidence ID.

All read tools return capture time, freshness, evidence ID, active profile fingerprints, blockers, and authority. A missing, stale, incomplete, or hash-invalid mirror returns `blocked` or `unavailable`; it is never replaced with synthetic data. The Results UI renders stale as its own amber `stale / blocked` state instead of collapsing it into a generic identity or availability block.

Read tools cover current cycle, Results, active profile, certified evidence, validation identity, calibration proposals, readiness, simulated outcomes, and research-memory status.

## Proposal Validation

`gotrader_validate_trade_proposal` resolves the proposal against the current mirror and canonical validation identity. It requires exact profile ID/version, parameter fingerprint, source provider/fingerprint, symbol mapping, timeframe, validation ledger ID, freshness, readiness, price geometry, and minimum reward/risk. Certification is a cross-ledger record: it binds the canonical validation report ID to the matching evidence-ledger entry ID and repeats the exact profile, parameter, source, and validation identities. A v4 profile cannot consume v3 evidence. Profile or fingerprint changes invalidate old proposals.

Success returns `validated_research_proposal`. Any failed gate returns `blocked` with specific reasons. Neither result can place an order, access a broker, apply calibration, promote Paper Demo, or override readiness.

## Calibration And Memory

MCP may create draft calibration intents and memory-delivery requests. Calibration intents are always approval-required and cannot auto-apply. Memory requests do not perform delivery; the existing browser-owned operator policy must already be enabled, and no agent can set a remote destination or override it.

## gbrain Sidecar

`GOTRADER_GBRAIN_MCP_URL` and `GOTRADER_GBRAIN_MCP_TOKEN` optionally enable advisory `search` and `think`. Only loopback URLs are accepted. Results carry the GoTrader evidence ID, profile fingerprints, retrieval time, citations, and freshness context. gbrain output is advisory context, never evidence or calibration authority.

## Safety

- execution authority: `none`
- broker authority: `none`
- readiness override authority: `none`
- raw candles and secrets excluded
- no order, position, account, or broker mutation tools
- no auto-apply or execution route
