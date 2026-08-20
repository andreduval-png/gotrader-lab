# I1 Implementation Report

## Decision

`ICT I1 PASSED WITH DOCUMENTED LEGACY-COMPATIBILITY LIMITATIONS`

`ICT_I2_READY_FOR_IMPLEMENTATION`

I1 establishes one causal, deterministic, reusable fact language. It is additive and does not implement an I2 model, migrate frozen strategies, change BT2, or grant authority.

## Required Answers

1. Canonical swing owner: `ictCanonical/canonicalSwingLiquidity` (`ICT_FACT_SWING`).
2. Duplicate swings remain in `detectSwings` and strategy-suite swing helpers.
3. `occurredAt` is the market occurrence; `confirmedAt` is when confirmation exists; `validFrom` is the earliest legal consumption time.
4. Canonical liquidity owner: `canonicalSwingLiquidity` (`ICT_FACT_LIQUIDITY`).
5. Yes. INTERNAL and EXTERNAL liquidity IDs include the owning range relationship.
6. Yes. IRL and ERL are stable range-relative liquidity identities.
7. Yes. Both transition directions are typed descriptive facts.
8. Canonical FVG owner: `canonicalImbalance` (`ICT_FACT_FVG`).
9. Yes. Frozen IFVG code and its test outputs remain unchanged; canonical inversion links `originFvgId` in shadow.
10. Yes. BPR references both opposing FVG IDs and overlap bounds.
11. Canonical block owner: `canonicalBlocks` (`ICT_FACT_BLOCK`).
12. Yes. Order, breaker, and mitigation are distinct types with conversion lineage.
13. Canonical MSS owner: `canonicalStructure` (`ICT_FACT_STRUCTURE`).
14. Canonical displacement owner: `canonicalStructure`, with versioned measurement policies.
15. Canonical dealing-range owner: `canonicalRangePd` (`ICT_FACT_DEALING_RANGE`).
16. Yes. Every PD location includes `dealingRangeId`.
17. Yes. OTE-zone geometry requires an explicit versioned policy and creates no strategy.
18. Yes, for FVG, IFVG, BPR, order, breaker, mitigation, and OTE zone.
19. `canonicalTime` (`ICT_FACT_SESSION`) owns sessions and killzones through the accepted IANA resolver.
20. Yes. The macro contract exists; exact windows are explicitly UNRESOLVED.
21. Yes. `canonicalOpeningGap` owns NDOG/NWOG facts.
22. Yes. The selected primary target and `nearestLiquidityId` are separate fields.
23. Yes at the contract boundary. C1 remains narrative owner; both C1 suites pass. Direct consumption migration is deferred.
24. Yes. S1 can consume swing/liquidity facts while remaining SMT owner; its accepted suites pass.
25. No frozen strategy candidate changed.
26. No candidate geometry changed.
27. No blocker changed.
28. Yes. Fact timestamp ordering and visibility assertions pass.
29. Yes. A fixed-`asOf` snapshot is byte-equivalent after future candles are appended.
30. Yes. The typed model/dependency/parameter/candidate contract is ready for I2.

## Validation

Passed: canonical focused suite, typecheck, build, IFVG, Silver Bullet, Turtle Soup, CISD, CMD, Nasdaq London Raid, C1 MTF, C1 Current Read, S1 canonical/index-SMT, BT2 contracts/simulator/restart/stage2, source integrity, provenance, and safety. Existing Rollup circular-chunk and size warnings remain unchanged.

The initial broad wrappers reported CRLF-versus-LF text drift in the IFVG v3 positive-canary file. A temporary LF-normalized checkout proved all three snapshots byte-stable with their preserved hashes; no baseline was committed or rewritten. The broader core suite then stopped at the pre-existing Paper Demo harness import of missing `loadPaperSizingPreviewPolicy`. This path is outside I1. Strategy-specific semantic controls, source integrity, provenance, and safety passed.

## Limitations

Legacy detectors remain active; canonical adapters are shadow-only. Macro times remain unresolved. Holiday and early-close gap classification awaits an accepted source calendar. No raw candle store, runtime path, Paper Demo path, or strategy baseline was changed.

Authority remains `none/none/none`; production adoption, evidence creation, readiness approval, calibration application, and trade-intent creation are all false.
