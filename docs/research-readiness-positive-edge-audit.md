# Research Readiness Positive Edge Audit

Generated from the live MT5 read-only source and the explicit 90-day IFVG diagnostics on 2026-07-13.

## Finding

GoTrader's lack of Research Ready output was not caused by every registered strategy having no edge. The strongest deterministic result, `ifvg_filtered_v2_research`, existed in the Strategy Library and CLI diagnostics but was not an executable Auto Research/backtest profile. Auto Research therefore kept testing generic CIO/Grinch threshold and agent-weight variants even when the registered IFVG profile was the better research family.

## Evidence

The explicit 90-day USTECH/MNQ-style IFVG filter audit reported the `clean_retest_displacement` profile with:

- 31 candidates
- 22 unique trading dates
- 5 active rolling windows
- 74.19% target-first
- 25.81% invalidation-first
- 5.0538R average
- 20.5833 profit factor
- positive expectancy after both 0.5R and 1.0R modeled cost
- passed OOS classification
- research-only `paper_watchlist_candidate` classification

This evidence does not approve readiness or guarantee a current setup. The latest 1,000-candle live window contained no IFVG candidate that passed both clean-retest and displacement confirmation, so the current candidate remains rejected.

## Root Causes

1. The strategy registry described IFVG filtered v2, but backtesting had no strategy-profile selector for it.
2. Auto Research varied thresholds and agent weights without selecting registered detector families.
3. Self-improvement could not represent a strategy-profile proposal, so it could not queue deterministic validation of the strongest profile.
4. Generic backtesting repeatedly processed the entire historical prefix at every decision, making deep research quadratic and capable of exceeding browser-safe time limits.
5. Monte Carlo is fail-closed and works from compact replay outcomes, but it cannot create evidence until an executable strategy produces at least 20 usable outcomes.
6. Agent consensus cannot manufacture edge. The deterministic Edge Auditor correctly requires a sufficient sample, positive OOS expectancy lower bound, and passed walk-forward evidence.

## Changes

- Added the research-only `ifvg_filtered_v2_research` backtest profile.
- Added the IFVG profile to Auto Research candidate generation.
- Preserved clean-retest and displacement confirmation as hard research filters.
- Added compact strategy detector counts and blocker distribution to backtest/headless reporting.
- Added strategy-profile changes to draft self-improvement proposals and manual research calibration patches.
- Kept auto-apply disabled and all authority values `none`.
- Bounded generic decision context to the latest 300 candles so deep backtests do not reprocess the full history at every step.

## Current Decision

- Historical profile: promising research-only paper-watchlist evidence.
- Current live window: no eligible setup; do not force a trade.
- Research Ready: still requires a qualifying current/replay sample, full validation, walk-forward, positive OOS edge lower bound, evidence and maturity gates.
- Paper-Demo: blocked until the existing checklist passes.
- Execution: disabled.

## Next Deterministic Step

Run the IFVG filtered v2 family on an explicit deeper research window, then attach its compact replay outcomes to walk-forward and Monte Carlo. A current live idea should only appear when the same clean-retest and displacement gates pass on newly closed MT5 candles.
