# G1.1 Entry Policy

The strategy owns the intended entry model and price. Canonical geometry records
that value once and never substitutes current market price. Entry models remain
strategy-specific, including FVG/IFVG prices, order-block edges or midpoints,
raid retraces, confirmation closes, and accepted session references.

The lifecycle is explicit: `WAITING_FOR_ENTRY`, `ENTRY_AVAILABLE`,
`ENTRY_TOUCHED_NOT_FILLED`, `ENTRY_FILLED`, `ENTRY_MISSED`, or `ENTRY_EXPIRED`.
Observed touch and fill belong to BT2. Geometry can classify availability,
missed, and expired states without claiming a fill.

`validFrom` and `expiresAt` are causal policy inputs. A future-valid entry is
waiting. An expired entry is expired even if price later returns.

