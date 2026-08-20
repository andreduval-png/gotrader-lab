# G1.1 Target Selection Policy

The strategy declares a versioned primary target category and any allowed
fallback categories. Selection filters facts by direction and `validFrom`, then
selects the requested primary identity/type. It never searches progressively
farther to satisfy minimum R:R.

`primaryDrawOnLiquidityId` is distinct from `nearestLiquidityId`. Nearest
liquidity is used only when the strategy explicitly declares
`NEAREST_DIRECTIONAL_LIQUIDITY`. ICT 2022 retains its canonical external draw;
Liquidity Reclaim Scalper retains external liquidity. Power of Three remains
profile-owned. Order Block Retracement's legacy nearest-draw behavior is the
selected first migration because it caused visible too-close targets.

Consumed targets are unavailable by default. A consumed primary yields
`TARGET_CONSUMED` unless its versioned strategy policy explicitly permits reuse.
Fallback provenance is recorded as `EXPLICIT_FALLBACK`.

