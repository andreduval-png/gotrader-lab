# GoTrader V2 Phase 2A.2 Shadow Offset-Regime Collector Report

## Starting State

- starting commit: `a1c50861a35ef249324704c745f8fa275e0f3e87`
- implementation branch: `codex/gotrader-v2-phase-2a2-shadow-collector`
- final commit: this report ships with the Phase 2A.2 implementation commit

## Implemented

- standalone loopback-only shadow collector for fixed `GET /time-contract` reads;
- default 60-second collection cadence with bounded interval and timeout configuration;
- strict persisted ledger/file contracts and deep validation;
- canonical SHA-256 checksum validation before accepted state is loaded;
- compact atomic file persistence and single-writer process locking;
- restart recovery that extends the same valid continuity regime;
- fail-closed behavior for malformed, tampered, incompatible, or broker-mismatched state;
- offline behavior that preserves the last accepted ledger without fabricating observations;
- rejected/stale observation behavior that terminates continuity;
- focused loopback HTTP, persistence, lock, serialization, authority, and no-adoption tests;
- operator runbook for explicit manual collection.

## Preserved Boundaries

- the collector is not automatically started by GoTrader or the local-stack supervisor;
- no browser route, UI, production candle source, strategy, Current Read, research cycle, validation chain, evidence, readiness, or Paper-Demo path reads the persisted file;
- historical DST remains unverified;
- replay, walk-forward, deep research, evidence, and readiness remain blocked without historical verification;
- no market-context facts are created in this phase;
- no raw candles, ticks, terminal clocks, credentials, account, order, position, or deal data are stored;
- no MT5, broker, account, order, or position mutation is possible.

## Persistence Decision

The ledger file is intentionally local and compact under `.gotrader/v2` by default. It is not browser storage and is not committed. A checksum covers the normalized ledger contract. Corrupt state is preserved for operator investigation rather than silently replaced.

The collector compiles its isolated V2 runtime only after acquiring the state lock. This prevents two collector processes from racing either generated runtime output or ledger persistence.

## Focused Test Result

The Phase 2A.2 collector test confirms:

- three requests used only loopback `GET /time-contract`;
- a second cycle reloaded disk state and extended the same regime;
- offline collection preserved state byte-for-byte;
- a stale contract terminated active continuity;
- checksum tampering and invalid JSON were rejected without overwrite;
- a concurrent collector was rejected and a dead-PID lock recovered;
- serialized state contained no raw candle arrays or sensitive fields;
- production V2 adoption count remained zero;
- authority remained `none / none / none`.

## Acceptance Validation

The complete Phase 0/1/2A preservation matrix passed on 2026-07-22:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke` (44/44)
- `npm.cmd run test:v2-baseline-snapshots`
- `npm.cmd run test:v2-candle-repository`
- `npm.cmd run test:v2-mt5-time-normalization`
- `npm.cmd run test:v2-mt5-upstream-time-contract`
- `npm.cmd run test:v2-mt5-terminal-clock`
- `npm.cmd run test:v2-context-foundation`
- `npm.cmd run test:v2-mt5-offset-regime`
- `npm.cmd run test:v2-mt5-offset-regime-collector`

Frozen behavior hashes remain unchanged:

- IFVG v3 positive canary: `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2 negative control: `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- strategy catalog behavior: `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

## Known Limitations

- useful continuity still requires the operator to run the collector while MT5 and the read-only wrapper are healthy;
- a process or machine shutdown creates a real observation gap and therefore a new regime after restart;
- this current-live continuity does not establish historical DST correctness;
- automatic local-stack adoption is deferred until live shadow collection has been observed and reviewed;
- no session/opening-price market-context facts are implemented yet.

## Safety

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## Final Decision

```text
PHASE 2A.2 IMPLEMENTED - SHADOW MT5 CONTINUITY COLLECTION REMAINS MANUAL AND NON-AUTHORITATIVE
```
