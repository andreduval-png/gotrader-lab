# BT2 Simulation Contract

The adapter accepts only blocker-free `ENTRY_ELIGIBLE` candidates with coherent
long or short geometry and the exact strategy/profile identity. Passive IFVG
and retracement entries map to BT2 `limit_at_price`; confirmation-close maps to
BT2 `market_at_next_open`.

The adapter does not inspect future candles and does not determine fills,
trade-through, stop/target ordering, ambiguity, spread, slippage, commission,
swap, or outcome. Those remain BT2 responsibilities. Native external-liquidity
geometry is never overwritten by a standardized-R overlay unless the profile
explicitly identifies that research target mode.
