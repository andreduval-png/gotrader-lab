# G1.1 No-Chase Policy

No downstream surface may replace an intended entry with current market price.
For a long, price above the intended entry beyond the policy tolerance is passed;
for a short, price below it is passed. The result is `ENTRY_MISSED` unless the
strategy explicitly allows a causal retracement, in which case it remains
`WAITING_FOR_ENTRY` at the original intended price.

The tolerance is a price-availability policy, not permission to rewrite entry.
Current Read, Current Opportunity, Operator Console, MCP, and BT2 receive the
same immutable intended price. A new entry requires a new candidate or a valid,
versioned strategy state transition.

