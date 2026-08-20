# I1 IRL/ERL Delivery Foundation

IRL and ERL are range-relative liquidity facts, not standalone labels. Every canonical INTERNAL or EXTERNAL liquidity ID includes its `dealingRangeId`.

An anchor or boundary liquidity fact is EXTERNAL; eligible liquidity strictly inside the range is INTERNAL. The canonical transition contract represents IRL_TO_ERL_DELIVERY and ERL_TO_IRL_DELIVERY with endpoint IDs, range ID, direction, start, confirmation, and state.

The endpoint validator rejects mismatched classes or ranges. These are descriptive facts only: no entry, stop, target, readiness, or trade intent is created in I1.
