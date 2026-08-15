# GoTrader Canonical AI-Agent Interface

GoTrader exposes an agent-neutral Model Context Protocol interface. It is not an OpenClaw, Hermes, Codex, or vendor-specific skill. Those integrations may act as clients or legacy adapters, but they do not define the GoTrader contract.

## Servers

- `npm run agent:mcp-interface` starts the canonical read and proposal interface.
- `npm run agent:mcp-memory` starts the advisory research-memory interface.
- `npm run agent:memory-sidecar` starts the loopback projection and research-memory sidecar.

All servers preserve `executionAuthority: none`, `brokerAuthority: none`, and `readinessOverrideAuthority: none`.

## Canonical Read Tools

- `gotrader_agent_interface_status`
- `gotrader_get_current_cycle`
- `gotrader_get_results`
- `gotrader_list_certified_profiles`

Current-cycle and Results reads come from compact browser projections written to the loopback sidecar. They exclude raw candles, broker state, credentials, account data, orders, and positions. Missing, stale, future-dated, oversized, or unsafe projections fail closed.

Certified-profile discovery is historical evidence. It includes certificate-bound Liquidity Reclaim Scalper artifacts when configured through `GOTRADER_CERTIFIED_EVIDENCE_ROOTS`. Discovery does not imply validation, readiness, proposal eligibility, Paper Demo eligibility, or production adoption.

## Provenance

Both MCP servers return `gotrader.agent_provenance` version `1.0`. Every response identifies one evidence class:

- `fresh_operational_projection`
- `historical_certified_evidence`
- `advisory_memory`

Agents must not substitute historical or advisory evidence for a fresh current-cycle observation.

## Compatibility

Existing trade-proposal and paper-demo tool names remain available for compatibility. OpenClaw/Hermes scripts remain explicit legacy advisory adapters and are not the canonical MCP identity.
