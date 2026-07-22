# GoTrader V2 Phase 2A.0 Context Foundation Report

## Starting State

- starting branch: `codex/gotrader-v2-phase-1-7a-contract-integration`
- starting commit: `345ea12712e8dc875d0f6ab106ae8f24ede9c781`
- implementation branch: `codex/gotrader-v2-phase-2a0-context-foundation`
- final commit: this report ships with the Phase 2A.0 implementation commit

Phase 1.7A remains blocked only on a fresh active-quote live confirmation. Historical DST policy remains unverified.

## Discovery

The V2 repository already defined a `context_shadow` query purpose, but the MT5 time-normalized adapter marked every source stale whenever historical `phase2Eligible` was false. The validator also exposed a normalization policy only for historically verified contracts. Therefore the proposed current-live shadow purpose could not consume the accepted current-live `1.1.0` terminal contract.

Legacy context is duplicated across advisor helpers, session narrative, session-raid models, market analysis, and strategy-specific detectors. Some helpers use fixed UTC session hours while stronger modules project through `America/New_York`. Phase 2A.0 does not choose a winner or change any legacy behavior.

## Implemented

- typed, versioned shadow context and future fact contracts;
- purpose-scoped current-live MT5 normalization policy;
- explicit current-live versus historical time eligibility metadata;
- strict 120-second observation expiry;
- pre-offset-regime window rejection;
- stable sorted multi-window input identity;
- pure context builder shell with zero fact output;
- no-adoption dependency scan;
- compact deterministic tests with no raw candle serialization.

## Not Implemented

- session or opening facts;
- dealing ranges, liquidity, sweeps, displacement, FVG/IFVG, or HTF engines;
- legacy comparison engine;
- live context diagnostic;
- offset-regime continuity ledger;
- strategy, Current Read, Research Cycle, replay, evidence, readiness, UI, Paper-Demo, broker, OpenClaw, or execution adoption.

## Eligibility Result

A fresh current-live `1.1.0` contract can normalize a bounded post-capture MT5 candle window without falsely granting historical eligibility. Observation expiry and any window starting before the verified offset-regime capture are blocked.

Because the current regime start is conservatively the latest accepted capture, complete higher-timeframe live context remains unavailable. An offset-regime continuity ledger is the next prerequisite before session/opening engines can operate on useful live windows.

## Identity And Safety

Equivalent multi-window inputs produce the same context artifact regardless of input ordering or build time. Raw candles remain builder inputs only and are absent from context artifacts. Facts remain empty in Phase 2A.0.

Authority remains:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## Acceptance Validation

The full Phase 0/1 acceptance matrix passed on 2026-07-22:

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

The frozen behavior hashes remain unchanged:

- IFVG v3 positive canary: `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2 negative control: `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- strategy catalog behavior: `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

`git diff --check` also passed. The focused context test confirms zero production adoptions, zero generated facts, current-live-only contracts blocked from replay, no raw candle serialization, and authority `none / none / none`.

## Final Decision

The Phase 2A.0 foundation is suitable for deterministic fixtures and narrowly bounded current-live shadow windows. Fact-engine implementation remains separately gated.

```text
PHASE 2A.0 PASSED - SHADOW CONTEXT CONTRACT AND ELIGIBILITY FOUNDATION ESTABLISHED
```
