# Entry Lifecycle Audit

Policy: `ifvg_distal_edge_buffer_and_retracement_limit_v1`.

IFVG uses a retracement-limit entry:

- Long: current price below the intended entry means the entry is missed and must not become an immediate buy-above-market plan.
- Short: current price above the intended entry means the entry is missed and must not become an immediate sell-below-market plan.
- Otherwise the candidate is `waiting_for_entry`.

The candidate records deterministic event identity plus detection, entry-intent, market, and missed timestamps where available. Both `ENTRY_MISSED` and independent geometry blockers are retained. Historical replay now requires a future candle to touch the intended entry before scoring stop or target; no touch is `ENTRY_NOT_RETRACED`.

A later retest does not resurrect the old candidate. The current v3 detector keys identity by original FVG, inversion, retest, side, source symbols, and timeframe. A genuinely new governed opportunity must have a distinct source event identity.

