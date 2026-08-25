# INT-3A Candidate Conflict Policy

There is no automatic ranking by R:R, distance, recency, or historical result.

- Same-direction valid candidates are preserved as separate plans.
- Opposing valid canonical candidates produce
  `CONFLICTING_CANONICAL_SETUPS`.
- A conflict suppresses the legacy single primary plan and signal selection.
- Both candidates remain visible with their own candidate and geometry IDs.
- Source-blocked context never participates as executable geometry.

No trade selector was added in INT-3A.
