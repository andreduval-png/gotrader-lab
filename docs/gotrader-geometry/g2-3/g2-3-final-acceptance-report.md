# G2.3 Final Acceptance

## Decision

`G2.3 PASSED WITH DOCUMENTED SOURCE LIMITATIONS`

`IFVG PRODUCER NOW FAILS CLOSED`

## Accepted

- The observed tight stop is produced by the IFVG distal edge plus its existing buffer.
- Setup detection, geometry eligibility, and actionability are distinct.
- Sub-four-point MNQ/USTECH stops retain native levels and emit `STOP_DISTANCE_TOO_SMALL`.
- Retracement entries have explicit waiting/missed lifecycle states.
- Historical scoring requires a causal future entry touch.
- No stop widening, target stretching, current-price substitution, authority, broker mutation, or execution was added.
- V4 remains research-only.

## Limitation

No accepted source policy authorizes a wider IFVG invalidation alternative. The producer therefore rejects rather than substitutes. Heavy certified-history recharacterization remains outstanding.

## Next Gate

`IFVG_REBASELINE_REQUIRED`

