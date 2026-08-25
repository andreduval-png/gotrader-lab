# INT-3A Source Audit

## Baseline

- Branch: `codex/gotrader-int-3a-core-ict-models`
- Base HEAD: `8f1c63658ebdd79ac6cf1bd74c465241f18cc2b5`
- Base tree: `fbdce015c39cfa6967b93c388837cdbdb2a2929c`
- Merge base: `8f1c63658ebdd79ac6cf1bd74c465241f18cc2b5`
- Geometry schema/version: `gotrader.trade-geometry.v1` / `g1.1.0`
- Canonical fact contract: `CanonicalIctFact` and the I1 canonical owner registry
- IFVG v3 identity: strategy version `v3`, profile `ifvg_fresh_retest_v3_research`
- Authority: `none` / `none` / `none`; production adoption and trade intent creation disabled

## Reference Identities

- I2: `f6a489bfba7948fded2445b4a4b92faec944dfd8`
- I2.1: `c0d2256596b5f07835041fccd23859fffef13cb3`

Both objects independently resolve as Git commits. They are semantic references,
not merge targets.

## Existing Implementations

### ICT 2022

I2 contains `src/lib/ictI2/ict2022Model.ts`. Its useful semantics are the
ordered objective, opposing raid, displacement, MSS, post-MSS FVG, retracement,
raid-extreme stop, and named external draw target. Its causal tests also remain
useful. INT-2 does not contain this runtime module, although G1.1/G2 inventory
documents recognize ICT 2022 as a canonical producer family.

### Power of Three

I2 contains `ictPowerOfThreeModel.ts` with an ordered accumulation,
manipulation, and distribution lifecycle. INT-2 has only the legacy
`amd_power_of_three_research_v1` placeholder in the strategy library. That
placeholder must not become a second executable strategy.

### Judas Swing

I2.1 preserves `ictJudasSwingModel.ts` as source-blocked. The accepted context
is New York midnight through 05:00, the New York midnight open, Asian range,
HTF thesis, an opposing deceptive move, and a liquidity attack. Reversal,
entry, stop, and target semantics remain unresolved. It must remain context
only with no geometry.

## Old I1 Dependencies

The old I2 implementation consumed I1 canonical `LIQUIDITY`,
`DRAW_ON_LIQUIDITY`, `DISPLACEMENT`, `MSS`, `FVG`, `DEALING_RANGE`, and
`SESSION_WINDOW` facts. Those contracts and builders already exist in INT-2.
The canonical aggregate snapshot currently omits draw and session projection,
so INT-3A must compose those existing owners without introducing private fact
detectors.

## Obsolete Paths

- The old `narrativeDirection` helper is a flat two-of-three vote and is not
  acceptable C1/C1.1 hierarchy.
- `CanonicalIctGeometryIntent` and raw `{ entry, stop, target }` payloads are
  superseded by `StrategyGeometryIntent` and G1.1 `CanonicalTradeGeometry`.
- The I2 BT2 request adapter is out of scope and must not be ported.
- The I2 standalone Current Read envelope is superseded by the integrated
  Current Opportunity, Current Read, Activate Market, signal, and operator
  runtime.
- Old direct strategy registry promotion is superseded by an integrated
  registry disposition that keeps evidence unvalidated.
- No strategy-private swing, liquidity, FVG, displacement, MSS, range,
  session, draw, or SMT detector may be copied.

## Useful Tests

The I2 ordered-state and fixed-`asOf` causality fixtures remain semantically
useful. They require migration to G1.1 geometry and the INT-2 runtime path.
PO3 lifecycle tests remain useful for state only; objective geometry must fail
closed when precedence is ambiguous. Judas tests remain useful only to prove
that context never creates geometry or a BT2 request.

## Audit Disposition

Selective porting is required. Wholesale merge is prohibited. INT-2 remains
authoritative for facts, geometry, runtime projections, safety, and authority.

