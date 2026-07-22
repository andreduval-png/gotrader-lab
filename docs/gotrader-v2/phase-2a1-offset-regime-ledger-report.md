# GoTrader V2 Phase 2A.1 Offset-Regime Ledger Report

## Starting State

- starting commit: `5f873b24d94857b08eccdd95c62f2974576d3b34`
- implementation branch: `codex/gotrader-v2-phase-2a1-offset-ledger`
- final commit: this report ships with the Phase 2A.1 implementation commit

## Implemented

- terminal probe instance identity propagated through the read-only MT5 time contract;
- typed compact continuity observation, regime, ledger, append-result, and coverage contracts;
- immutable create/append/restart/terminate transitions;
- deterministic regime ID and chained continuity hash;
- 120-second maximum continuity gap;
- explicit gap, instance, build, basis, offset, stale-quote, and evidence-conflict termination;
- adapter coverage resolution against the latest accepted contract;
- context identity linkage to the active offset regime;
- bounded compact regime summaries;
- focused causal, serialization, no-adoption, and authority tests.

## Preserved Boundaries

- historical DST remains unverified;
- `phase2Eligible` remains false for current-live-only contracts;
- replay, walk-forward, and deep research remain blocked without historical verification;
- context fact count remains zero;
- no strategy or production consumer imports the ledger;
- no evidence, readiness, Paper-Demo, broker, or execution behavior changes.

## Known Limitation

The ledger implementation is a pure shadow component. No long-running production collector or persistence adapter is added. Useful M5/M15/H1 continuity will require a later, explicitly reviewed read-only orchestrator to append fresh terminal observations at an interval shorter than 120 seconds.

This phase intentionally does not infer continuity across application restarts or observation gaps.

## Safety

The serialized ledger excludes raw clocks and candle arrays. It carries no account, order, position, credential, or secret fields.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## Acceptance Validation

The complete Phase 0/1/2A.0 preservation matrix passed on 2026-07-22:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke`
- `npm.cmd run test:v2-baseline-snapshots`
- `npm.cmd run test:v2-candle-repository`
- `npm.cmd run test:v2-mt5-time-normalization`
- `npm.cmd run test:v2-mt5-upstream-time-contract`
- `npm.cmd run test:v2-mt5-terminal-clock`
- `npm.cmd run test:v2-context-foundation`
- `npm.cmd run test:v2-mt5-offset-regime`

The frozen behavior hashes remain unchanged:

- IFVG v3 positive canary: `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2 negative control: `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- strategy catalog behavior: `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

The focused ledger suite confirms deterministic continuity hashes, current-live context coverage, latest-contract matching, gap/instance/offset restart behavior, stale-quote termination, no historical promotion, zero production consumers, no raw candle serialization, and authority `none / none / none`.

## Final Decision

```text
PHASE 2A.1 PASSED - MT5 OFFSET-REGIME CONTINUITY CONTRACT ESTABLISHED
```
