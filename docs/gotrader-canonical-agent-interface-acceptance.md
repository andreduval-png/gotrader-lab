# GoTrader Canonical AI-Agent Interface Acceptance

Date: 2026-08-15

## Scope

Accepted on `codex/gotrader-canonical-agent-interface` from authorization commit `d96aa389` and integrated base `9d26664fe309da0a0941882f14383a1b5f096c01`.

The slice provides:

- agent-neutral MCP server identities and package aliases;
- current-cycle and Results compact read APIs;
- atomic loopback projection persistence with sensitive-field, size, timestamp, and authority checks;
- stale and future timestamp rejection;
- certificate-bound profile discovery including Liquidity Reclaim Scalper v1;
- one `gotrader.agent_provenance` contract across the canonical and memory MCP servers;
- restored advisory research-memory status and sync controls in Operator Console;
- a restored local research-memory sidecar using gbrain/PGLite as an implementation backend.

OpenClaw and Hermes remain optional legacy advisory clients. They do not define the canonical MCP interface.

## Safety

- Execution authority: `none`
- Broker authority: `none`
- Readiness override authority: `none`
- Raw candles exposed: no
- Account, order, position, or credential data exposed: no
- LRS proposal eligibility granted: no
- LRS research validation granted: no
- LRS production adoption granted: no

## Validation

- `npm run test:canonical-agent-interface` passed, including 14-tool MCP discovery, cycle/results reads, LRS discovery, freshness, sidecar persistence, and cross-server provenance.
- `npm run test:mcp-trade-proposal` passed, including stale validation rejection and 24 concurrent audit writes.
- `npm run test:gotrader-mcp-research-memory` passed.
- `npm run test:gbrain-sidecar` passed.
- `npm run test:operator-console` passed.
- `npm run test:results-workspace` passed.
- `npm run test:research-cycle-validation-linkage` passed.
- `npm run typecheck` passed.
- `npm run build` passed with the repository's existing Rollup circular-chunk and large-chunk warnings preserved.

## Operational State

The loopback sidecar was restored on `127.0.0.1:8799`, reported `ready`, used the `gbrain_local` PGLite backend, and retained authority `none/none/none`. Codex desktop MCP configuration now targets the canonical interface worktree for both MCP servers. A Codex restart or MCP reload is required for already-running MCP client sessions to adopt the updated configuration.
