# GoTrader V2 Phase 2A.3 Session and Opening-Price Fact Report

## Starting State

- starting commit: `b7f8171daf911fe5eb9bd2d3ffd96f96d67fe06e`
- implementation branch: `codex/gotrader-v2-phase-2a3-context-facts`
- final commit: this report ships with the Phase 2A.3 implementation commit

## Implemented

- explicit `session` and `opening_price` fact-family requests;
- policy-versioned context identity for requested fact families;
- daylight-saving-aware New York session boundaries;
- complete/degraded session quality based on exact M5 coverage;
- exact Sunday, midnight, and 09:30 opening-price facts;
- strict no-fallback behavior for missing opening candles;
- closed-candle causal timestamps and stable fact IDs;
- explicit blockers for unsupported families and missing eligible M5 input;
- deterministic summer/winter, partial-session, missing-boundary, identity, serialization, adoption, and authority tests;
- baseline-manifest coverage for the Phase 2A context and continuity checks.

## Fixture Result

The focused deterministic fixture produced:

- five complete session facts;
- three exact opening-price facts;
- correct July New York midnight at `04:00Z`;
- correct January New York midnight at `05:00Z`;
- degraded status for a partially observed New York AM session;
- no midnight fact when the exact boundary candle was absent;
- a hard block when only a 15-minute window was supplied;
- no serialized raw candle arrays;
- zero production adoptions;
- authority `none / none / none`.

## Live Shadow Finding

The local wrapper and upstream latest-candle path were reachable, but the terminal clock contract was stale/unavailable. `diagnose:v2-mt5-terminal-clock` correctly returned `blocked_terminal_probe_unavailable` with `terminal_observation_stale`.

This is not converted into a fixture success or a favorable live fact. A fresh manual `GoTraderClockProbe` observation and uninterrupted collector regime are required before live shadow facts can be evaluated.

## Preserved Boundaries

- no production source, UI, strategy, Current Read, research cycle, validation chain, evidence, readiness, or Paper-Demo consumer was added;
- no session/opening fact is generated unless explicitly requested;
- no raw candle, tick, account, order, position, deal, credential, or secret data is stored in facts;
- no manual or later-candle opening-price substitution exists;
- historical DST verification remains separate and incomplete;
- daily and weekly opening facts are deferred;
- no execution or broker authority exists.

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
- `npm.cmd run test:v2-session-opening-facts`
- `npm.cmd run test:v2-context-foundation`
- `npm.cmd run test:v2-mt5-offset-regime`
- `npm.cmd run test:v2-mt5-offset-regime-collector`

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
PHASE 2A.3 IMPLEMENTED IN SHADOW - LIVE USE REMAINS BLOCKED UNTIL TERMINAL TIME CONTINUITY IS FRESH
```
