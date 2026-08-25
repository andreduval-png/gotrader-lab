# I1 Swing and Liquidity Specification

`canonicalSwingLiquidity` owns symmetric confirmed swing highs/lows, versioned equal-level grouping, swing/equal liquidity, and structural draw selection.

The canonical swing policy retains the current two-candle symmetric default without adding a new strength score. Equal-level tolerance preserves the legacy suite behavior: four basis points with a 0.01 minimum, policy version 1.0.0.

Liquidity uses BUY_SIDE_LIQUIDITY or SELL_SIDE_LIQUIDITY and classes INTERNAL, EXTERNAL, SESSION, SWING, and EQUAL_HIGH_LOW. Consumption requires a later candle after `validFrom` and records its time and candle ID.

Primary draw ranking is transparent: class relevance, then owner timeframe, then distance. It reports the nearest liquidity separately, so nearest and primary draw need not match.
