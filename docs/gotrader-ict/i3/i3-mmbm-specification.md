# MMBM Specification

Strategy ID: `ict_market_maker_buy_model_v1`. Classification: experimental research-only.

The base model requires an active canonical range, C1/C1.1 bullish setup maturation toward buyside, discount context in that range, consumed external sell-side liquidity, a bullish canonical ERL-to-IRL transition, bullish displacement, an eligible bullish PD array, and an available opposite external buyside objective.

MSS and S1 SMT are optional in the base profile. Neither creates facts or moves geometry. The frozen entry is the PD-array midpoint, the stop is the sell-side engineering extreme, and the target is the named opposite external liquidity. No fallback target exists.

G1.1 computes signed R:R. Below 2R remains research-visible and `GEOMETRY_NON_ACTIONABLE`; entry, stop, and target are not altered.
