# G1.1 Real Failure Fixtures

The compact suite encodes the recent failure classes without raw candles:

| Fixture | Geometry | Expected result |
| --- | --- | --- |
| A: sub-1R target | long 100 / 96 / 103 | `VALID_BELOW_RR_THRESHOLD`, non-actionable, 0.75R |
| B: target too close | target equals entry | `TARGET_TOO_CLOSE` |
| C: late-entry chase | intended long 100, market 107 | `ENTRY_MISSED`; intended price unchanged |
| D: stop too wide | structural stop 96, target 103 | valid below threshold; stop unchanged |
| E: invalid short target | target above short entry | `GEOMETRY_DIRECTION_INVALID` |
| F: consumed primary | consumed primary, no allowed fallback | `TARGET_CONSUMED` |

Additional fixtures cover NaN, zero risk, a full-precision 1.995R threshold,
explicit fallback provenance, future target invisibility, stable identity, payload
conflict, and primary target selection when a closer partial TP1 exists.

The dedicated Order Block fixture preserves its nearest-draw failure rather than
stretching the target. It is the selected first strategy migration.

No compact persisted production candidate ledger was available for a defensible
recent-candidate distribution audit. Therefore the audited count and percentage
below 1R are reported as unavailable, not inferred from test fixtures or UI
screenshots.

