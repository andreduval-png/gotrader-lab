# GoTrader V2 Phase 2A.5 Displacement and FVG Fact Report

## Starting State

- starting commit: `095d45a808f7d4831d1245e3665cda26f2ea0dc8`
- implementation branch: `codex/gotrader-v2-phase-2a5-displacement-fvg`
- final commit: this report ships with the Phase 2A.5 implementation commit

## Implemented

- explicit `displacement` and `fair_value_gap` fact families;
- policy-versioned context identity for both families;
- exact ten-candle mean-body displacement baseline;
- legacy-compatible `1.6x` body threshold;
- one-bar causal confirmation for the `leavesFvg` result;
- strict structure-close lineage to session liquidity pools;
- strict three-candle bullish and bearish FVG geometry;
- exclusive fresh, touched, partial-fill, filled, and inverted lifecycle states;
- displacement-to-FVG derivation lineage;
- baseline-manifest and focused safety coverage.

## Deterministic Fixture Result

The Phase 2A.5 fixture produces:

- five deterministic displacement facts;
- two deterministic fair-value-gap facts;
- verified lifecycle snapshots for `fresh`, `touched`, `partially_filled`, `filled`, and `inverted`;
- a bullish displacement linked to a causally available Asia buy-side pool;
- a bullish FVG linked to its matching displacement;
- a separate bearish FVG that remains fresh;
- stable context and fact identities;
- no separate IFVG trade candidate;
- no raw candle serialization;
- zero production adoption;
- authority `none / none / none`.

## Preserved Boundaries

- no detector or strategy thresholds changed;
- no FVG becomes an entry model or trade signal;
- no IFVG retest, order block, breaker, MSS, or HTF fact is inferred;
- no existing sweep fact is rewritten retrospectively;
- no live use is claimed while terminal clock verification is stale;
- no evidence, readiness, Paper-Demo, broker, or execution behavior changed.

## Next Context Step

Phase 2A.6 should add deterministic higher-timeframe directional context using explicit M15, H1, H4, D1, and W1 windows. Missing timeframes must remain visible rather than being synthesized. That completes the initial seven primitive Phase 2 shadow families before any Phase 3 IFVG canary adapter is considered.

## Acceptance Validation

The complete preservation matrix is recorded when the implementation commit is finalized:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke`
- `npm.cmd run test:v2-displacement-fvg-facts`

Frozen behavior hashes must remain unchanged:

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
PHASE 2A.5 IMPLEMENTED IN SHADOW - DISPLACEMENT AND FVG LIFECYCLE ARE CONTEXT, NOT TRADE APPROVAL
```
