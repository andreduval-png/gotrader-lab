# INT-3B Runtime Acceptance

## Result

INT-3B integrates the accepted MMXM framework and mirrored MMBM/MMSM producers into the certified INT-3A runtime architecture.

- MMXM remains diagnostic context only.
- `ict_market_maker_buy_model_v1` and `ict_market_maker_sell_model_v1` remain distinct executable research models.
- Both models consume the same current canonical fact snapshot and hierarchical narrative as ICT 2022, Power of Three, and Judas Swing.
- Both models emit `StrategyGeometryIntent` and use the current G1.1 canonical geometry adapter.
- Both models enter `buildCanonicalRuntimeCandidateSet`; no Market-Maker-specific selector or priority exists.
- Current Opportunity, Current Read, Activate Market candidate plans, and Operator candidate cards preserve strategy, candidate, and geometry identity.
- `researchValidated` remains `false`; old I3 evidence is compatible reference material that requires rebaseline.
- Authority remains `none/none/none`; production adoption remains false.

## Geometry policy

The producer owns immutable source-native geometry:

- entry: selected PD-array midpoint;
- stop: consumed liquidity-engineering extreme;
- target: named opposite external liquidity in the same dealing range.

There is no current-price substitution, chase entry, generic stop, target stretching, farther-target search, R:R-generated target, or downstream reconstruction. G1.1 may reject actionability without changing the producer prices.

The deterministic mirrored fixtures produce:

| Model | Direction | Entry | Stop | Target | R:R |
| --- | --- | ---: | ---: | ---: | ---: |
| MMBM | LONG | 99 | 90 | 120 | 2.3333333333R |
| MMSM | SHORT | 101 | 110 | 80 | 2.3333333333R |

Fixture identities are range `range-1`, engineering liquidity `engineering`, transition `transition`, PD array `pd-array`, and target liquidity `objective`. Candidate and geometry IDs are deterministic canonical fingerprints asserted by the producer and downstream parity tests.

## Conflict acceptance

The unified candidate tests use real MMBM/MMSM producer output from controlled canonical facts.

- IFVG LONG + ICT 2022 LONG + MMBM LONG retains three distinct candidates and geometries and returns `MULTIPLE_ALIGNED_CANONICAL_SETUPS` with no automatic winner.
- IFVG LONG + ICT 2022 LONG + MMSM SHORT retains all three and returns `CONFLICTING_CANONICAL_SETUPS`, with no selected candidate.
- Simultaneous actionable MMBM and MMSM returns conflict and no selected candidate.
- Bearish MMXM framework context alongside actionable IFVG LONG does not create a conflict.
- Activate Market retains exact candidate-plan geometry and suppresses singular `proposedGeometry` during conflict.
- Operator candidate cards preserve candidate actionability while global actionability becomes false during conflict.

## Lifecycle and causality

Focused tests cover mirrored lifecycle progression, nonuniform C1/C1.1 narrative, optional/neutral SMT, opposing-SMT warning behavior, target consumed, entry missed, below-R:R preservation, causal confirmation ordering, and fixed-`asOf` future-extension invariance.

## Verification

Passed on 2026-08-25:

- `npm run test:int-3b-runtime`
- `npm run test:source-integrity`
- `npm run test:provenance`
- `npm run test:safety`
- `npm run typecheck`
- `npm run build`

The build retained the repository's pre-existing Rollup circular-chunk and chunk-size warnings.

## Scope boundary

No historical characterization, BT-G1 integration, parameter optimization, validation inheritance, readiness promotion, primary-tree merge, or push was performed. The existing generic Operator UI projection was exercised through its snapshot contract; a dedicated live-browser single-MMBM/single-MMSM DOM acceptance scenario remains PARTIAL and should be added before calling INT-3B production-DOM evidence complete.
