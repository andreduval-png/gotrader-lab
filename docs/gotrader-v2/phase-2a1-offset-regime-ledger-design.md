# GoTrader V2 Phase 2A.1 MT5 Offset-Regime Continuity Ledger

## Purpose

Phase 2A.1 extends the Phase 2A.0 current-live time boundary across repeated, accepted MT5 terminal observations. It does not verify historical DST, implement market-context facts, or adopt V2 context in production.

The ledger solves one narrow problem: a single terminal probe is fresh for at most 120 seconds and cannot authorize candles that predate that probe. Repeated observations can establish a continuous same-offset regime from the first accepted capture to the latest accepted capture.

## Contract

- schema: `gotrader-v2-mt5-offset-regime-ledger`
- version: `1.0.0`
- policy: `gotrader-v2-mt5-offset-regime-continuity-v1`
- default and maximum observation gap: 120 seconds
- retained regime summaries: 24
- authority: `none / none / none`
- mode: shadow-only

Each observation contains only compact provenance:

- observation and probe-instance IDs;
- broker symbol;
- capture time;
- provider time basis and observed UTC offset;
- terminal build when available;
- basis/transport classifications;
- compact blockers and warnings;
- authority.

It excludes raw terminal clocks, raw candles, ticks, account data, orders, positions, credentials, and secrets.

## State Transition

An accepted observation creates or extends an active regime only when all of these remain stable:

- broker symbol;
- probe instance;
- terminal build;
- provider time basis;
- observed offset;
- observation cadence within 120 seconds.

The active regime ends on:

- an observation gap;
- terminal instance or build change;
- provider basis or offset change;
- stale quote;
- conflicting terminal evidence;
- any other rejected observation.

A later accepted observation may start a new regime, but cannot bridge the terminated interval. Duplicate latest observations are idempotent. Out-of-order observations are rejected without rewriting accepted history.

## Identity

The first observation deterministically identifies the regime. Every extension chains a canonical SHA-256 continuity hash from the previous hash and compact observation fields.

Context input identities include the active `offsetRegimeId`. A terminal restart therefore changes context identity even when the resulting candle values happen to be identical.

## Adapter Boundary

The V2 MT5 normalized adapter accepts an optional ledger. When supplied, it must match the latest time contract and remain unexpired. Its start time replaces the one-observation capture boundary for current-live shadow context.

The ledger never grants historical eligibility. Replay, walk-forward, deep research, evidence, and readiness still require a historically verified time/DST contract.

When no ledger is supplied, the Phase 2A.0 single-observation behavior remains available and conservatively starts coverage at the latest probe capture.

## No-Adoption Boundary

No production source outside `src/lib/v2` imports the ledger. There is no browser storage, file persistence, route, UI, strategy, Current Read, Research Cycle, evidence, Paper-Demo, broker, or execution adoption in this phase.

## Rollback

Revert the Phase 2A.1 commit. No production state migration is required because the ledger is a shadow contract and pure transition function.
