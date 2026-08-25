# INT-1 Primary Runtime Truth

## Baseline

- Primary integration base: `d665288ecde763d103a59387584f3cdfd16f8c95`
- Base tree: `3e01136dd8bf8836a231139c22592d1d8e0ce14d`
- Integration branch: `codex/gotrader-int-1-primary-convergence`
- Integration worktree: `C:\Users\andre\OneDrive\Documents\gotrader-int-1-primary-convergence`

The primary worktree contains a large uncommitted operator/geometry patch set. INT-1 does not modify or commit that tree. Accepted behavior is reconstructed from clean commits only.

## Runtime At Base

The base does not contain `src/lib/ictCanonical` or `src/lib/tradeGeometry`. Its actionable lane still depends on Phase 1/2 signal/advisor construction, with IFVG v3 as the current detector and legacy geometry able to reach downstream projections. B&B and OSOK are detectable but do not yet have governed source-native actionable geometry. Later I2-I7 implementations and BT-G1 fold runners are absent from primary.

## INT-1 Minimum Truth

INT-1 integrates only the canonical facts needed by current strategies, G1.1 geometry, projection-only consumers, G2.3 IFVG lifecycle, and explicit B&B/OSOK source blocking. It does not claim I2-I7 or broad historical runner adoption. Missing canonical geometry must resolve to `NO_TRADE`.
