# IFVG v2 Causal Validation Audit

## Finding

The original IFVG filtered v2 evidence was inflated by signal-time leakage. The diagnostic could detect a retest in an earlier candle, evaluate from a later sampled candle, and count post-retest candles as displacement confirmation. The executable backtest could then use the historical retest midpoint as its entry price.

## Corrections

- Evaluate every closed candle for the IFVG research profile.
- Require the selected retest to be the latest closed candle.
- Require delivery confirmation to be complete before the retest.
- Start outcome scoring after the actual retest candle.
- Resolve same-bar target/stop ambiguity stop-first.
- Suppress overlapping research positions.
- Preserve MT5 read-only source and authority `none/none/none`.

## Current 90-Day Window

- MT5 USTECH CFD/proxy for requested MNQ
- 5m: 17,521 candles
- 15m: 5,841 candles
- 1h context: 1,460 candles
- Strict clean-retest plus pre-entry-displacement candidates: 16
- Unique dates: 15
- Target-first: 68.75%
- Invalidation-first: 31.25%
- Weak rolling windows: 1 of 5
- OOS: insufficient data
- Result: promising but insufficient; not paper-watchlist eligible

## Independent Prior 90-Day Window

- Non-overlapping history ending 90 days before the latest MT5 candle
- Strict candidates: 6
- Unique dates: 6
- Target-first: 33.33%
- Invalidation-first: 66.67%
- Weak rolling windows: 4 of 5
- OOS: insufficient data
- Result: independent degradation; filtered v2 edge is not robust

## Decision

`ifvg_filtered_v2_research` remains executable for deterministic research, but its Strategy Library status is `replay_required`. It must not be described as paper-watchlist evidence and cannot create Paper-Demo eligibility from the superseded audit.

No threshold was loosened, no proposal was auto-applied, and no execution authority was introduced.
