# GoTrader Trade-Proposal MCP Compatibility Notice

Status: superseded on 2026-08-18 by `docs/gotrader-research-mcp.md`.

The former v3-only Trade-Proposal MCP is no longer the canonical service. Its script and package-command names remain as compatibility aliases for local integrations, but both delegate to the agent-neutral GoTrader Research MCP.

Current entry points:

- stdio: `npm.cmd run mcp:research`
- authenticated loopback Streamable HTTP: `npm.cmd run mcp:research:http`
- compatibility stdio alias: `npm.cmd run mcp:trade-proposal`

The current validator resolves the exact active operator profile from GoTrader's runtime snapshot. It requires matching profile version, parameter fingerprint, source fingerprint, validation identity, and an identity-bound validation certification record from the canonical evidence ledger. No v3 allowlist remains, and v3 evidence cannot validate a v4 proposal.

See `docs/gotrader-research-mcp.md` for tools, transports, frontend behavior, gbrain advisory integration, and the `none/none/none` authority boundary.
