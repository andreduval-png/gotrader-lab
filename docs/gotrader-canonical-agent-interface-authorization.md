# GoTrader Canonical AI-Agent Interface Authorization

Date: 2026-08-15

## Authorized Slice

Implement a provider-neutral GoTrader MCP interface for local AI agents. OpenClaw,
Hermes, Codex, Claude, and other MCP hosts are clients, not interface identities.

This slice may:

- rename the MCP product surface to the GoTrader canonical agent interface;
- fail closed when current-cycle or validation evidence is stale;
- expose compact read-only current-cycle and Results projections;
- discover identity-bound certified profiles, including Liquidity Reclaim Scalper v1;
- unify provenance envelopes across proposal and research-memory MCP tools;
- restore bounded loopback research-memory sidecar supervision;
- add focused protocol, freshness, provenance, safety, and restart tests.

## Retained Boundaries

- executionAuthority: none
- brokerAuthority: none
- readinessOverrideAuthority: none
- no raw candles, credentials, accounts, orders, positions, or broker responses
- no strategy or parameter mutation
- no R1 mutation, restart, reduction, or authority change
- no readiness promotion, Paper Demo approval, runtime adoption, broker mutation,
  trade intent, order placement, or execution

The dirty primary worktree and active R1 family evidence are read-only external
inputs and must not be edited by this slice.
