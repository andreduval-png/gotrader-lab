# G1.1 Final Acceptance Report

## Decision

`G1.1 PASSED WITH DOCUMENTED STRATEGY-MIGRATION LIMITATIONS`

`ICT_I3_READY_FOR_IMPLEMENTATION`

I3 must create canonical geometry directly and may not use legacy advisor
completion, current-price entry fallback, or an undeclared target fallback.

## Acceptance summary

- Concurrency: `G1_1_SAFE_WITH_RESTRICTIONS`.
- Canonical owner: `buildCanonicalTradeGeometry` in the G1.1 shared service.
- Entry/stop/target intent owners: strategy/profile policy.
- Direction, distance, theoretical R:R, identity, and actionability owner: G1.1.
- Fill, costs, ambiguity, net R:R, and outcome owner: BT2.
- Authority: none/none/none; research-only; no production adoption.
- Selected first migration: Order Block Retracement.
- Recent persisted candidate audit: unavailable; no defensible compact production
  candidate ledger was found, so below-1R count and percentage are unavailable.

## Required questions

1. Dominant root cause: `MULTIPLE_CAUSES`, led by target selection, current-price
   entry fallback, absolute-distance R:R, and UI implied-entry recovery.
2. Nearest liquidity was selected as primary in Order Block Retracement and some
   generic completion paths. G1.1 separates it from primary draw identity.
3. Current Opportunity recalculated R:R/status from primitives; it did not usually
   choose a new target. It now projects canonical geometry when available.
4. Current Read primarily copied target values; it was not the dominant mutator.
5. Current market price could replace missing intended entry in advisor completion.
6. That fallback could preserve late candidates as a form of chase.
7. Native strategy stops were structural where detectors supplied them.
8. Generic stop completion was active when native geometry was absent.
9. Generic directional target completion was active.
10. The dedicated trade-construction formula was directional; the legacy shared
    estimator used `abs()`. Canonical G1.1 is signed and direction-safe.
11. G1.1 uses absolute canonical prices and introduces no CFD/futures conversion.
    Explicit symbol tick/point normalization remains a producer migration item.
12. Adopted UI theoretical R:R is projected from the displayed canonical levels.
13. Accepted I2 BT2 requests receive identical intended entry midpoint, stop, and target.
14. No-divergence geometry can remain research-visible.
15. Below-threshold geometry remains research-visible.
16. Below-threshold geometry can never be labeled actionable.
17. `primaryDrawOnLiquidityId` and `nearestLiquidityId` are separate fields and
    target policy explicitly requests one category/identity.
18. Consumed targets are unavailable by default and yield `TARGET_CONSUMED`.
19. A passed entry yields `ENTRY_MISSED`, or remains waiting at the original price
    only when the strategy explicitly permits a causal retrace.
20. Adopted canonical projections cannot chase price; intended entry is immutable.
21. The service cannot tighten a structural stop for R:R.
22. The selector cannot stretch a target for R:R; only declared fallbacks are legal.
23. Candidates may expose multiple targets, while policy identifies one primary
    decision target. Partial TP1 does not replace it.
24. Order Block Retracement was the most visibly affected strategy.
25. Audited production percentage below 1R: unavailable, not inferred.
26. `buildCanonicalTradeGeometry` is the canonical shared producer.
27. Current Opportunity and Operator Console adopted projections are lossless.
28. BT2 remains the exclusive execution simulator.
29. Geometry identities are stable over material strategy/candidate/intent/policy/source data.
30. Causality passes; future-valid targets are invisible.
31. Future-extension invariance passes at fixed `asOf`.
32. Frozen detector snapshots were not rewritten. Shared UI/status changes are
    display-only or fail-closed corrections.
33. Removing implied entry, signed R:R, and preserving primary target identity are bug fixes.
34. Canonical geometry is ready for I3 if I3 adopts it from its first candidate state.
35. I3 has no remaining shared-geometry blocker. Legacy strategy and MCP producer
    migrations are documented but are not I3 dependencies.

## Verification

Passed:

- all seven `test:trade-geometry*` suites;
- typecheck and production build;
- source integrity, provenance, safety, and MT5 read-only safety;
- C1/C1.1 multi-timeframe and top-down context;
- I1 canonical facts;
- ICT 2022 and Power of Three behavior and causality;
- I2 Current Read, governance, and BT2;
- trade construction, IFVG, Silver Bullet, Turtle Soup, CISD, phase-two models,
  Current Read flow, Current Opportunity, and Operator Console;
- 46/46 sequential Chromium smoke tests.

Known limitations reproduced honestly:

- aggregate `npm test` reaches the documented missing generated
  `ictCalibrationBridge.mjs` defect;
- `test:ict-index-smt` and `test:ict-target-invalidation-rr-audit` reach the
  documented stale generated `currentOpportunity` resolution defect;
- existing Rollup circular-chunk and large-chunk warnings remain unchanged.

No raw candles, orders, positions, account data, secrets, broker mutation, Paper
Demo authority, or execution intent are added.

