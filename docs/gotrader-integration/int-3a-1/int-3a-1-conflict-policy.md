# INT-3A.1 Conflict Policy

Conflict is computed from unique directions among actionable canonical
candidates whose geometry exists, is valid, and is actionable.

- Long only or short only: no directional conflict.
- Long and short: `CONFLICTING_CANONICAL_SETUPS`.
- Multiple candidates in one direction: preserve all as aligned setups.
- Blocked or context-only direction labels: no conflict contribution.

During conflict there is no singular candidate, side, geometry, entry, stop,
target, or R:R. Both research hypotheses remain visible. No score, R:R,
strategy priority, SMT state, recency, first/last position, or historical result
may arbitrate the conflict. Same-direction candidates also remain separate;
agreement is not permission to synthesize a hybrid geometry.

