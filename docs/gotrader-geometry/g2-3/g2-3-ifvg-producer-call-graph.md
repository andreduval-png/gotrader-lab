# IFVG Producer Call Graph

`ictAdvisorEngine` -> `assessIctIfvgFreshRetestV3` -> `evaluateIctIfvg` -> `findInternalCandidate`.

Inside `findInternalCandidate`:

1. `detectFvgAt` establishes the FVG/IFVG bounds.
2. The entry is the bounds midpoint.
3. The stop is the distal IFVG edge plus `stopBufferFor`.
4. `findLiquidityTarget` selects the nearest qualifying prior swing in the trade direction.
5. `buildIctTradeConstruction` validates direction, structure, symbol risk distance, R:R, source, and authority.
6. `buildCandidate` emits setup, geometry, lifecycle, and validation eligibility.
7. `compactIctIfvgFreshRetestV3Assessment` feeds Current Opportunity and Activate Market.

Historical path: `runBacktest` -> v3/v4 assessment -> future retracement fill -> unchanged entry/stop/target outcome scoring.

