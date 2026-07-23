# GoTrader V2 Phase 2A.4 Dealing-Range and Liquidity Fact Report

## Starting State

- starting commit: `1361c0377e4dd339c1607a411f84467d9852352c`
- implementation branch: `codex/gotrader-v2-phase-2a4-range-liquidity`
- final commit: this report ships with the Phase 2A.4 implementation commit

## Implemented

- explicit `dealing_range` and `liquidity` fact families;
- dependency validation requiring source session facts;
- policy-versioned identity for both families;
- session-scoped premium, discount, and equilibrium geometry;
- complete versus incomplete range quality;
- confirmed session-high and session-low liquidity pools;
- active, touched, and swept pool states;
- strict post-confirmation sweep detection;
- rejection-back-inside versus wick-through classification;
- compact causal fact lineage;
- baseline-manifest coverage and focused safety tests.

## Deterministic Fixture Result

The Phase 2A.4 fixture produces:

- five complete session dealing ranges;
- ten confirmed session liquidity pools;
- two strict post-session liquidity breaches;
- one rejection back inside and one wick-through close beyond the pool;
- no liquidity pool for an incomplete New York AM session;
- no inferred displacement follow-through;
- a hard block when a requested range omits its session dependency;
- stable context and fact identities;
- no raw candle serialization;
- zero production adoption;
- authority `none / none / none`.

## Preserved Boundaries

- no global swing range or setup-local range is guessed;
- no equal-level tolerance, tick-size tolerance, or broker-specific spread policy is invented;
- no displacement, FVG, IFVG, order-block, breaker, or HTF fact is inferred;
- no sweep becomes a strategy confirmation or research signal;
- no live use is claimed while the terminal clock probe remains stale;
- no evidence, readiness, Paper-Demo, broker, or execution behavior changed.

## Next Context Step

Phase 2A.5 should add deterministic displacement and FVG lifecycle facts. It should consume canonical closed candles and reference the liquidity facts without changing any detector thresholds or adopting the V2 context into production.

## Acceptance Validation

The complete preservation matrix passed on 2026-07-22:

- `npm.cmd run typecheck`
- `npm.cmd run build` (existing Rollup circular-chunk and size warnings only)
- `npm.cmd run test`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke` (44/44)
- `npm.cmd run test:v2-dealing-range-liquidity-facts`

Frozen behavior hashes remain unchanged:

- IFVG v3 positive canary: `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2 negative control: `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- strategy catalog behavior: `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

## Safety

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## Final Decision

```text
PHASE 2A.4 IMPLEMENTED IN SHADOW - RANGE AND LIQUIDITY EVENTS ARE CONTEXT, NOT TRADE APPROVAL
```
