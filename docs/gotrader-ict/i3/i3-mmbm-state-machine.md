# MMBM State Machine

MMBM is the bullish profile of the shared MMXM core. It does not own a separate algorithm.

- Start: active range plus C1/C1.1 bullish maturation and range-relative discount.
- Engineering event: consumed canonical external sell-side liquidity.
- Delivery confirmation: bullish canonical ERL-to-IRL transition plus displacement.
- Reprice: eligible bullish canonical PD array after confirmation.
- Entry: immutable PD-array midpoint; never current price.
- Invalidation: sell-side engineering extreme or any invalid canonical geometry.
- Objective: named opposite external buyside liquidity.

`ENTRY_MISSED`, `SETUP_EXPIRED`, `TARGET_CONSUMED`, and `GEOMETRY_NON_ACTIONABLE` are terminal for the original candidate. A later retracement must create a separately governed candidate transition; the base profile does not chase.
