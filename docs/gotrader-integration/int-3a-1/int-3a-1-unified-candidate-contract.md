# INT-3A.1 Unified Candidate Contract

`CanonicalRuntimeCandidate` is the narrow shared aggregation contract. It
preserves strategy ID/version/profile, candidate ID, direction, setup state,
actionability, blockers, the original `CanonicalTradeGeometry`, geometry ID,
source/fact identity, and evaluation/as-of identity.

The set has four dispositions:

- `NO_ACTIONABLE_CANDIDATE`
- `SINGLE_ACTIONABLE_CANDIDATE`
- `MULTIPLE_ALIGNED_CANONICAL_SETUPS`
- `CONFLICTING_CANONICAL_SETUPS`

Only a candidate with an actionable canonical geometry participates in
directional conflict. Blocked PO3, Judas, diagnostics, and context rows remain
visible but cannot create conflict. A singular selected candidate ID exists
only for `SINGLE_ACTIONABLE_CANDIDATE`.

Ordering is stable registry/strategy/candidate order and has no profitability,
confidence, R:R, or readiness meaning. Geometry is retained by reference and is
never copied, merged, widened, or stretched.

